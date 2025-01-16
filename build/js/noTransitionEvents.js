(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*! bluerouter - v0.1.0 - 2025-01-16 13:31:28 */
/**
 * A namespace.
 * @const
 */
const blueRouter = {};


/** @constructor */
blueRouter.router = function ( userOptions ) {

    // Init options
    this.options = {};
    blueRouter.utils.extend( this.options, blueRouter.defaultOptions, userOptions );
    this.checkOptions();

    // Preload pages if needed
    if ( this.options.preloadPagesOnLoad ){
        let self = this;
        blueRouter.htmlFetcher.loadAllUrls(
            this,
            () => {
                self.init();
            }
        );
        return;
    }

    // Do not preload pages, run init
    this.init();
};

/* Methods */

/** @suppress {missingProperties} */
blueRouter.router.prototype.init = function() {

    // Init some other vars
    this.routesMap = this.createRoutesMap();
    this.stack = [];

    // Add event listeners
    this.addEventListenersForWindow();

    // Navigate to window.location.href or home
    this.navigateUrl(
        this.options.updateOnLoad? window.location.href: '',
        this.options.animateTransitionsOnLoad
    );
};

// Check that mandatory user defined properties are defined
/** @suppress {missingProperties} */
blueRouter.router.prototype.checkOptions = function() {

    let errors = 0;
    let errorMessages = '';

    if ( ! this.options.routes ){
        ++errors;
        errorMessages += 'routes must be defined. ';
    }

    if ( ! this.options.eventsByPage ){
        ++errors;
        errorMessages += 'eventsByPage must be defined. ';
    }

    if ( errors ){
        this.alertError( 'Unable to initalize Blue router. ' + errors + ' errors found: ' + errorMessages );
    }
};

blueRouter.router.prototype.alertError = function( message ){
    alert( message );
    throw message;
};

blueRouter.router.prototype.addEventListenersForWindow = function() {
    /*
    window.onload = () => {
        this.navigateUrl( this.options.updateOnLoad? window.location.href: '', true );
    }
    */
    window.onpopstate = ( e ) => {
        this.navigateUrl( window.location.href, true );
        //this.navigateUrl( e.state[ 'page' ], true );
    };
};

/** @suppress {missingProperties} */
blueRouter.router.prototype.addEventListenersForLinks = function( pageId ) {
    
    let self = this;

    // Add event listeners for a elements
    blueRouter.utils.addEventListenerOnList(
        //document.getElementsByTagName( 'a' ),
        document.getElementById( pageId ).getElementsByTagName( 'a' ),
        'click', 
        (e) => {
            const href = e.target.getAttribute( 'href' );

            // Follow the link if it is external (if it is marked as external in the class list)
            /*
            if ( e.target.classList.contains ( self.options.externalClass ) ){
                return;
            }
            */
            // Follow the link if it is external (if it does not start by !)
            if ( ! href.startsWith( self.options.PAGE_PREFIX ) ){
                return;
            }

            e.preventDefault();
            history.pushState(
                {
                    'page': href
                },
                'page ' + href,
                '#' + href
            );
            self.navigateUrl( href, true );
        }
    );
};

// Create a map with the data in routes, using the path as the key
blueRouter.router.prototype.createRoutesMap = function() {

    const routerMap = {};
    const routes = this.options.routes || [];

    routes.map( routeItem => {
        routerMap[ routeItem.id ] = routeItem;
    });

    return routerMap;
};

/** @suppress {missingProperties} */
blueRouter.router.prototype.getRouteItem = function( pageId ) {

    // Look for the route
    let routeItem = this.routesMap[ pageId ];
    if ( routeItem ){
        return routeItem;
    }

    // No route found, 404 error
    routeItem = this.routesMap[ this.options.PAGE_ID_404_ERROR ];
    if ( routeItem ){
        return routeItem;
    }

    // No 404 page, build a 404 route
    return {
        id: this.options.PAGE_ID_404_ERROR,
        content: '<h3>404 - Page not found: ' + pageId + '</h3>'
    };
    //this.alertError( 'No route found with id ' + pageId + ' and no 404 page found.' );
};

blueRouter.router.prototype.navigateUrl = function( url, mustAnimateByCode ) {
    //alert( 'navigateUrl\nurl: ' + url );

    // Create an url object to make it easy everything
    let urlObject = blueRouter.utils.analizeUrl( url, this.options );

    // Update stack and get currentPageId
    let currentPageId = this.updateStack( urlObject.page );

    // Exit if trying to navigate to current page
    if ( currentPageId == urlObject.page ){
        return;
    }

    // Get the content
    let content = this.getContentForPage( urlObject.page );
    
    // If content is a Promise wait and resolve it
    let self = this;
    if ( content instanceof Promise ){
        content.then( function( text ){
            // Update content of route
            let routeItem = self.getRouteItem( urlObject.page );
            routeItem.content = text;

            // Run doPageTransition
            self.doPageTransition( text, urlObject.page, currentPageId, urlObject, mustAnimateByCode );
        });
        return;
    }

    // content is NOT a Promise: update current page
    this.doPageTransition( content, urlObject.page, currentPageId, urlObject, mustAnimateByCode );
};

blueRouter.router.prototype.updateStack = function( pageId ) {
    
    // If the penultimate element is the pageId then we are going backwards; otherwise we are going forward
    let isBackward = this.stack[ this.stack.length - 2 ] == pageId;

    if ( isBackward ){
        // Is backward
        return this.stack.pop();
    }

    // Is forward
    var currentPageId = this.stack[ this.stack.length - 1 ];
    this.stack.push( pageId );
    return currentPageId;
};

blueRouter.router.prototype.getContentForPage = function( pageId ) {

    // Get the routeItem from the routesMap
    let routeItem = this.getRouteItem( pageId );

    // Get the content of that route
    return this.getContentForRoute( routeItem );
};

blueRouter.router.prototype.getContentForRoute = function( routeItem ) {
    
    // Check keepAlive
    if ( routeItem.keepAlive ){
        let alivePage = document.getElementById( routeItem.id );
        if ( alivePage ){
            return alivePage;
        }
    }

    // Check content
    let content = routeItem.content;
    if ( content ){
        return content;
    }

    // Check url
    let url = routeItem.url;
    if ( url ){
        return blueRouter.htmlFetcher.loadUrl( url );
    }

    return '<div id="error">No content found for route from path ' + routeItem.id + '</div>';
};

/** @suppress {missingProperties} */
blueRouter.router.prototype.doPageTransition = function( content, nextPageId, currentPageId, urlObject, mustAnimateByCode ) {

    // Get mustAnimateOut and mustAnimateIn
    const mustAnimateOut = mustAnimateByCode && !!this.options.animationOut;
    const mustAnimateIn = mustAnimateByCode && !!this.options.animationIn;

    // Get the initEvent
    const initEvent = content instanceof HTMLElement? blueRouter.defaultOptions.EVENT_REINIT: blueRouter.defaultOptions.EVENT_INIT;

    // Run events
    this.runEvent( blueRouter.defaultOptions.EVENT_BEFORE_OUT, currentPageId, {} );

    // Get the currentPage and add next page
    let currentPage = document.getElementsByClassName( 'currentPage' )[0];
    let newPage = this.addNextPage( currentPage, content, nextPageId );

    // Render next page
    this.runRenderRelated( initEvent, nextPageId, urlObject );

    // Define currentPageAnimationendListener and newPageAnimationendListener
    let self = this;
    let currentPageAnimationendListener = () => {
        currentPage.removeEventListener( 'animationend', currentPageAnimationendListener );
        
        // Remove hidden class, add animationIn class
        newPage.classList.remove( 'hidden' );
        if ( mustAnimateIn ){
            newPage.classList.add( this.options.animationIn );
        }

        // Retire current page: save it as an alive page or remove it
        this.retireCurrentPage( currentPageId, currentPage );
        self.runEvent( blueRouter.defaultOptions.EVENT_AFTER_OUT, currentPageId, {} );

        //  Run newPageAnimationendListener if listener of amimationend on newPage was not added
        if ( ! mustAnimateIn ) {
            newPageAnimationendListener();
        }
    };

    let newPageAnimationendListener = () => {
        newPage.removeEventListener( 'animationend', newPageAnimationendListener );

        // Remove nextPage class, add currentPage class, remove animationIn class
        newPage.classList.remove( 'nextPage' );
        newPage.classList.add( 'currentPage' );
        if ( mustAnimateIn ){
            newPage.classList.remove( this.options.animationIn );
        }

        // Run EVENT_INIT or EVENT_REINIT
        self.runEvent( initEvent, nextPageId, urlObject );

        // Run EVENT_MOUNTED
        self.runEvent( blueRouter.defaultOptions.EVENT_MOUNTED, nextPageId, urlObject );
    };

    // Add event listeners
    if ( mustAnimateOut ){
        currentPage.addEventListener( 'animationend', currentPageAnimationendListener );
    }
    if ( mustAnimateIn ){
        newPage.addEventListener( 'animationend', newPageAnimationendListener );
    }

    // Animate!
    if ( mustAnimateOut ){
        currentPage.classList.add( this.options.animationOut );
    } else {
        currentPageAnimationendListener();
    }
};

/** @suppress {missingProperties} */
blueRouter.router.prototype.runRenderRelated = function( initEvent, nextPageId, urlObject ){

    // Run preEvent (EVENT_PRE_INIT or EVENT_PRE_REINIT)
    const preEvent = initEvent ===  this.options.EVENT_INIT?
        this.options.EVENT_PRE_INIT:
        this.options.EVENT_PRE_REINIT

    this.runEvent( preEvent, nextPageId, urlObject );

    // Run render if needed
    const routeItem = this.getRouteItem( nextPageId );
    const renderOption = initEvent ===  this.options.EVENT_INIT?
        this.options.RUN_RENDER_BEFORE_EVENT_INIT:
        this.options.RUN_RENDER_BEFORE_EVENT_REINIT;
    const routeProperty = initEvent ===  this.options.EVENT_INIT?
        'runRenderBeforeInit':
        'runRenderBeforeReinit';
    const mustRunRender = routeItem[ routeProperty ] === undefined?
        renderOption:
        routeItem[ routeProperty ];

    if ( mustRunRender && this.options.renderFunction && blueRouter.utils.isFunction( this.options.renderFunction ) ){
        this.options.renderFunction(
            this.buildPageInstance( nextPageId )
        );
    }
};

blueRouter.router.prototype.buildPageInstance = function( pageId ){

    return {
         'id': pageId,
         'el': document.getElementById( pageId )
    };
};

blueRouter.router.prototype.addNextPage = function( currentPage, content, nextPageId ){

    if ( content instanceof HTMLElement ){
        // content is HTMLElement
        currentPage.insertAdjacentElement(
            'afterend',
            content
        );
        content.classList.add( 'nextPage' );
        content.classList.add( 'hidden' );
        content.classList.remove( 'alive' );

    } else {
        // content must be text
        currentPage.insertAdjacentHTML(
            'afterend',
            '<div class="nextPage hidden page" id="' + nextPageId + '">'
            + content
            + '</div>'
        );
    }

    return document.getElementById( nextPageId );
};

// Retire current page: save it as an alive page or remove it
blueRouter.router.prototype.retireCurrentPage = function( currentPageId, currentPage ){

    let currentRoute = this.getRouteItem( currentPageId );

    // If must keep alive current page, set page and alive as classes removing the rest
    if ( currentRoute && currentRoute.keepAlive){
        currentPage.removeAttribute( 'class' );
        currentPage.classList.add( 'page' );
        currentPage.classList.add( 'alive' );
        return;
    }

    // Do not keep alive current page, so remove it
    currentPage.remove();
};

blueRouter.router.prototype.runEvent = function( eventId, pageId, urlObject ) {

    if ( eventId == blueRouter.defaultOptions.EVENT_INIT ){
        this.addEventListenersForLinks( pageId );
    }

    // Get the page object from options
    /** @suppress {missingProperties} */
    let page = this.options.eventsByPage[ pageId ];

    // If a page is found, run the event handler
    if ( page ){
        let event = {
            params: urlObject.params || {}
        };
        if ( page[ eventId ] && blueRouter.utils.isFunction( page[ eventId ] ) ){
            page[ eventId ]( event );
        }
    }
};


// Default options

blueRouter.defaultOptions = {
    updateOnLoad: true,
    preloadPagesOnLoad: false,

    // Animations
    animationOut: 'slide-out-top',
    //animationOut: false,
    animationIn: 'scale-in-center',
    //animationIn: false,
    animateTransitionsOnLoad: false,
    
    // Misc
    PAGE_PREFIX: '!',

    // Special pages ids
    PAGE_ID_HOME: '[home]',
    PAGE_ID_404_ERROR: '[404]',

    // Events
    EVENT_PRE_INIT: 'preInit',
    EVENT_INIT: 'init',
    EVENT_PRE_REINIT: 'preReinit',
    EVENT_REINIT: 'reinit',
    EVENT_MOUNTED: 'mounted',
    EVENT_BEFORE_OUT: 'beforeOut',
    EVENT_AFTER_OUT: 'afterOut',

    RUN_RENDER_BEFORE_EVENT_INIT: true,
    RUN_RENDER_BEFORE_EVENT_REINIT: false

};


blueRouter.htmlFetcher = {};

blueRouter.htmlFetcher.loadAllUrls = function( router, callback ){

    // Get the routes to use
    const routes = router.options.routes || [];

    // Init the number ot urls to get
    let pending = 0;

    // Iterate urlRoutes and load each routeItem if needed
    routes.map( routeItem => {
        let url = routeItem.url;
        if ( url ){
            ++pending;
            blueRouter.htmlFetcher.loadUrl( url ).then(
                function( text ){
                    // Update content of route
                    routeItem.content = text;

                    // Run callback when all files have been loaded
                    if ( --pending == 0 && callback && blueRouter.utils.isFunction( callback ) ){
                        callback();
                    }
                }
            );
        }
    });
};

/**
 * @param {string} url
 * 
 */
blueRouter.htmlFetcher.loadUrl = async function( url ){

    const response = await fetch( url );

    if ( ! response.ok ) {
        const message = `Error fetching ${url} has occured: ${response.status}`;
        alert ( message );
        throw new Error( message );
    }
  
    const text = await response.text();
    return text;
};

blueRouter.utils = {};

/*
    Builds an object with data about the url. An example:

    url : http://127.0.0.1:9000/samples/sample.html#!about?param1=a&param2=b"

    prepage: http://127.0.0.1:9000/samples/sample.html
    page: about
    params: {
        param1: a
        param2: b
    }
*/
blueRouter.utils.analizeUrl = function( url, options ) {
    
    let result = {};

    // Extract the parts before and after PAGE_PREFIX
    let urlParts = url.split( options.PAGE_PREFIX );
    result.prepage = urlParts[ 0 ];
    let postPath = urlParts[ 1 ] || '';

    // Remove # if present
    if ( result.prepage.endsWith( '#' ) ){
        result.prepage = result.prepage.slice( 0, -1 );
    }

    // Extract the parts before and after ?
    let pathParts = postPath.split( '?' );
    result.page = pathParts[ 0 ];

    // Fix home page
    if ( result.page == '') {
        result.page = options.PAGE_ID_HOME;
    }

    let paramsString = pathParts[ 1 ] || '';

    // Add params
    result.params = {};
    if ( paramsString == '' ){
        return result;
    }
    let vars = paramsString.split( '&' );
    for ( let i = 0; i < vars.length; i++ ) {
        let pair = vars[ i ].split( '=' );
        let paramName = pair[ 0 ];
        let paramValue = pair[ 1 ];
        result.params[ paramName ] = paramValue;
    }

    return result;
};

blueRouter.utils.addEventListenerOnList = function( list, event, fn ) {

    for ( let i = 0, len = list.length; i < len; i++ ) {
        list[ i ].addEventListener( event, fn, false );
    }
};

blueRouter.utils.extend = function( out, from1, from2 ) {
    out = out || {};

    for ( var i = 1; i < arguments.length; i++ ) {
        if ( ! arguments[ i ] ){
            continue;
        }

        for ( var key in arguments[ i ] ) {
            if ( arguments[ i ].hasOwnProperty( key ) ){
                out[ key ] = arguments[ i ][ key ];
            }
        }
    }

    return out;
};

/* formatString */
// Example: itils.formatString( '{0} is dead, but {1} is alive!', 'ASP', 'ASP.NET' )
/**
 * Takes 1 or more strings and do something cool with them.
 * @param {...string|number} format
 */
blueRouter.utils.formatString = function( format ) {
    
    var args = Array.prototype.slice.call( arguments, 1 );
    return format.replace(/{(\d+)}/g, function ( match, number ) {
        return typeof args[ number ] != 'undefined'? args[ number ] : match;
    });
};

blueRouter.utils.isFunction = function isFunction( obj ) {

    // Support: Chrome <=57, Firefox <=52
    // In some browsers, typeof returns "function" for HTML <object> elements
    // (i.e., `typeof document.createElement( "object" ) === "function"`).
    // We don't want to classify *any* DOM node as a function.
    return typeof obj === "function" && typeof obj.nodeType !== "number";
};
/* end of utils */

// Register blueRouter if we are using Node
if ( typeof module === 'object' && module.exports ) {
    module.exports = blueRouter;
}

},{}],2:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
(function (process,global,setImmediate){(function (){
/*!
 * QUnit 2.11.3
 * https://qunitjs.com/
 *
 * Copyright OpenJS Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2020-10-05T01:34Z
 */
(function (global$1) {
	'use strict';

	function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

	var global__default = /*#__PURE__*/_interopDefaultLegacy(global$1);

	var window$1 = global__default['default'].window;
	var self$1 = global__default['default'].self;
	var console = global__default['default'].console;
	var setTimeout$1 = global__default['default'].setTimeout;
	var clearTimeout = global__default['default'].clearTimeout;
	var document$1 = window$1 && window$1.document;
	var navigator = window$1 && window$1.navigator;
	var localSessionStorage = function () {
	  var x = "qunit-test-string";

	  try {
	    global__default['default'].sessionStorage.setItem(x, x);
	    global__default['default'].sessionStorage.removeItem(x);
	    return global__default['default'].sessionStorage;
	  } catch (e) {
	    return undefined;
	  }
	}(); // Support IE 9-10: Fallback for fuzzysort.js used by /reporter/html.js

	if (!global__default['default'].Map) {
	  global__default['default'].Map = function StringMap() {
	    var store = Object.create(null);

	    this.get = function (strKey) {
	      return store[strKey];
	    };

	    this.set = function (strKey, val) {
	      store[strKey] = val;
	      return this;
	    };

	    this.clear = function () {
	      store = Object.create(null);
	    };
	  };
	}

	function _typeof(obj) {
	  "@babel/helpers - typeof";

	  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
	    _typeof = function (obj) {
	      return typeof obj;
	    };
	  } else {
	    _typeof = function (obj) {
	      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	    };
	  }

	  return _typeof(obj);
	}

	function _classCallCheck(instance, Constructor) {
	  if (!(instance instanceof Constructor)) {
	    throw new TypeError("Cannot call a class as a function");
	  }
	}

	function _defineProperties(target, props) {
	  for (var i = 0; i < props.length; i++) {
	    var descriptor = props[i];
	    descriptor.enumerable = descriptor.enumerable || false;
	    descriptor.configurable = true;
	    if ("value" in descriptor) descriptor.writable = true;
	    Object.defineProperty(target, descriptor.key, descriptor);
	  }
	}

	function _createClass(Constructor, protoProps, staticProps) {
	  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
	  if (staticProps) _defineProperties(Constructor, staticProps);
	  return Constructor;
	}

	function _toConsumableArray(arr) {
	  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
	}

	function _arrayWithoutHoles(arr) {
	  if (Array.isArray(arr)) return _arrayLikeToArray(arr);
	}

	function _iterableToArray(iter) {
	  if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
	}

	function _unsupportedIterableToArray(o, minLen) {
	  if (!o) return;
	  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
	  var n = Object.prototype.toString.call(o).slice(8, -1);
	  if (n === "Object" && o.constructor) n = o.constructor.name;
	  if (n === "Map" || n === "Set") return Array.from(o);
	  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
	}

	function _arrayLikeToArray(arr, len) {
	  if (len == null || len > arr.length) len = arr.length;

	  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

	  return arr2;
	}

	function _nonIterableSpread() {
	  throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}

	function _createForOfIteratorHelper(o, allowArrayLike) {
	  var it;

	  if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) {
	    if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
	      if (it) o = it;
	      var i = 0;

	      var F = function () {};

	      return {
	        s: F,
	        n: function () {
	          if (i >= o.length) return {
	            done: true
	          };
	          return {
	            done: false,
	            value: o[i++]
	          };
	        },
	        e: function (e) {
	          throw e;
	        },
	        f: F
	      };
	    }

	    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	  }

	  var normalCompletion = true,
	      didErr = false,
	      err;
	  return {
	    s: function () {
	      it = o[Symbol.iterator]();
	    },
	    n: function () {
	      var step = it.next();
	      normalCompletion = step.done;
	      return step;
	    },
	    e: function (e) {
	      didErr = true;
	      err = e;
	    },
	    f: function () {
	      try {
	        if (!normalCompletion && it.return != null) it.return();
	      } finally {
	        if (didErr) throw err;
	      }
	    }
	  };
	}

	// This allows support for IE 9, which doesn't have a console
	// object if the developer tools are not open.

	var Logger = {
	  warn: console ? console.warn.bind(console) : function () {}
	};

	var toString = Object.prototype.toString;
	var hasOwn = Object.prototype.hasOwnProperty;
	var now = Date.now || function () {
	  return new Date().getTime();
	};
	var hasPerformanceApi = detectPerformanceApi();
	var performance = hasPerformanceApi ? window$1.performance : undefined;
	var performanceNow = hasPerformanceApi ? performance.now.bind(performance) : now;

	function detectPerformanceApi() {
	  return window$1 && typeof window$1.performance !== "undefined" && typeof window$1.performance.mark === "function" && typeof window$1.performance.measure === "function";
	}

	function measure(comment, startMark, endMark) {
	  // `performance.measure` may fail if the mark could not be found.
	  // reasons a specific mark could not be found include: outside code invoking `performance.clearMarks()`
	  try {
	    performance.measure(comment, startMark, endMark);
	  } catch (ex) {
	    Logger.warn("performance.measure could not be executed because of ", ex.message);
	  }
	}
	var defined = {
	  document: window$1 && window$1.document !== undefined,
	  setTimeout: setTimeout$1 !== undefined
	}; // Returns a new Array with the elements that are in a but not in b

	function diff(a, b) {
	  var i,
	      j,
	      result = a.slice();

	  for (i = 0; i < result.length; i++) {
	    for (j = 0; j < b.length; j++) {
	      if (result[i] === b[j]) {
	        result.splice(i, 1);
	        i--;
	        break;
	      }
	    }
	  }

	  return result;
	}
	/**
	 * Determines whether an element exists in a given array or not.
	 *
	 * @method inArray
	 * @param {Any} elem
	 * @param {Array} array
	 * @return {Boolean}
	 */

	function inArray(elem, array) {
	  return array.indexOf(elem) !== -1;
	}
	/**
	 * Makes a clone of an object using only Array or Object as base,
	 * and copies over the own enumerable properties.
	 *
	 * @param {Object} obj
	 * @return {Object} New object with only the own properties (recursively).
	 */

	function objectValues(obj) {
	  var key,
	      val,
	      vals = is("array", obj) ? [] : {};

	  for (key in obj) {
	    if (hasOwn.call(obj, key)) {
	      val = obj[key];
	      vals[key] = val === Object(val) ? objectValues(val) : val;
	    }
	  }

	  return vals;
	}
	function extend(a, b, undefOnly) {
	  for (var prop in b) {
	    if (hasOwn.call(b, prop)) {
	      if (b[prop] === undefined) {
	        delete a[prop];
	      } else if (!(undefOnly && typeof a[prop] !== "undefined")) {
	        a[prop] = b[prop];
	      }
	    }
	  }

	  return a;
	}
	function objectType(obj) {
	  if (typeof obj === "undefined") {
	    return "undefined";
	  } // Consider: typeof null === object


	  if (obj === null) {
	    return "null";
	  }

	  var match = toString.call(obj).match(/^\[object\s(.*)\]$/),
	      type = match && match[1];

	  switch (type) {
	    case "Number":
	      if (isNaN(obj)) {
	        return "nan";
	      }

	      return "number";

	    case "String":
	    case "Boolean":
	    case "Array":
	    case "Set":
	    case "Map":
	    case "Date":
	    case "RegExp":
	    case "Function":
	    case "Symbol":
	      return type.toLowerCase();

	    default:
	      return _typeof(obj);
	  }
	} // Safe object type checking

	function is(type, obj) {
	  return objectType(obj) === type;
	} // Based on Java's String.hashCode, a simple but not
	// rigorously collision resistant hashing function

	function generateHash(module, testName) {
	  var str = module + "\x1C" + testName;
	  var hash = 0;

	  for (var i = 0; i < str.length; i++) {
	    hash = (hash << 5) - hash + str.charCodeAt(i);
	    hash |= 0;
	  } // Convert the possibly negative integer hash code into an 8 character hex string, which isn't
	  // strictly necessary but increases user understanding that the id is a SHA-like hash


	  var hex = (0x100000000 + hash).toString(16);

	  if (hex.length < 8) {
	    hex = "0000000" + hex;
	  }

	  return hex.slice(-8);
	}

	// Authors: Philippe Rathé <prathe@gmail.com>, David Chan <david@troi.org>

	var equiv = (function () {
	  // Value pairs queued for comparison. Used for breadth-first processing order, recursion
	  // detection and avoiding repeated comparison (see below for details).
	  // Elements are { a: val, b: val }.
	  var pairs = [];

	  var getProto = Object.getPrototypeOf || function (obj) {
	    return obj.__proto__;
	  };

	  function useStrictEquality(a, b) {
	    // This only gets called if a and b are not strict equal, and is used to compare on
	    // the primitive values inside object wrappers. For example:
	    // `var i = 1;`
	    // `var j = new Number(1);`
	    // Neither a nor b can be null, as a !== b and they have the same type.
	    if (_typeof(a) === "object") {
	      a = a.valueOf();
	    }

	    if (_typeof(b) === "object") {
	      b = b.valueOf();
	    }

	    return a === b;
	  }

	  function compareConstructors(a, b) {
	    var protoA = getProto(a);
	    var protoB = getProto(b); // Comparing constructors is more strict than using `instanceof`

	    if (a.constructor === b.constructor) {
	      return true;
	    } // Ref #851
	    // If the obj prototype descends from a null constructor, treat it
	    // as a null prototype.


	    if (protoA && protoA.constructor === null) {
	      protoA = null;
	    }

	    if (protoB && protoB.constructor === null) {
	      protoB = null;
	    } // Allow objects with no prototype to be equivalent to
	    // objects with Object as their constructor.


	    if (protoA === null && protoB === Object.prototype || protoB === null && protoA === Object.prototype) {
	      return true;
	    }

	    return false;
	  }

	  function getRegExpFlags(regexp) {
	    return "flags" in regexp ? regexp.flags : regexp.toString().match(/[gimuy]*$/)[0];
	  }

	  function isContainer(val) {
	    return ["object", "array", "map", "set"].indexOf(objectType(val)) !== -1;
	  }

	  function breadthFirstCompareChild(a, b) {
	    // If a is a container not reference-equal to b, postpone the comparison to the
	    // end of the pairs queue -- unless (a, b) has been seen before, in which case skip
	    // over the pair.
	    if (a === b) {
	      return true;
	    }

	    if (!isContainer(a)) {
	      return typeEquiv(a, b);
	    }

	    if (pairs.every(function (pair) {
	      return pair.a !== a || pair.b !== b;
	    })) {
	      // Not yet started comparing this pair
	      pairs.push({
	        a: a,
	        b: b
	      });
	    }

	    return true;
	  }

	  var callbacks = {
	    "string": useStrictEquality,
	    "boolean": useStrictEquality,
	    "number": useStrictEquality,
	    "null": useStrictEquality,
	    "undefined": useStrictEquality,
	    "symbol": useStrictEquality,
	    "date": useStrictEquality,
	    "nan": function nan() {
	      return true;
	    },
	    "regexp": function regexp(a, b) {
	      return a.source === b.source && // Include flags in the comparison
	      getRegExpFlags(a) === getRegExpFlags(b);
	    },
	    // abort (identical references / instance methods were skipped earlier)
	    "function": function _function() {
	      return false;
	    },
	    "array": function array(a, b) {
	      var i, len;
	      len = a.length;

	      if (len !== b.length) {
	        // Safe and faster
	        return false;
	      }

	      for (i = 0; i < len; i++) {
	        // Compare non-containers; queue non-reference-equal containers
	        if (!breadthFirstCompareChild(a[i], b[i])) {
	          return false;
	        }
	      }

	      return true;
	    },
	    // Define sets a and b to be equivalent if for each element aVal in a, there
	    // is some element bVal in b such that aVal and bVal are equivalent. Element
	    // repetitions are not counted, so these are equivalent:
	    // a = new Set( [ {}, [], [] ] );
	    // b = new Set( [ {}, {}, [] ] );
	    "set": function set(a, b) {
	      var innerEq,
	          outerEq = true;

	      if (a.size !== b.size) {
	        // This optimization has certain quirks because of the lack of
	        // repetition counting. For instance, adding the same
	        // (reference-identical) element to two equivalent sets can
	        // make them non-equivalent.
	        return false;
	      }

	      a.forEach(function (aVal) {
	        // Short-circuit if the result is already known. (Using for...of
	        // with a break clause would be cleaner here, but it would cause
	        // a syntax error on older Javascript implementations even if
	        // Set is unused)
	        if (!outerEq) {
	          return;
	        }

	        innerEq = false;
	        b.forEach(function (bVal) {
	          var parentPairs; // Likewise, short-circuit if the result is already known

	          if (innerEq) {
	            return;
	          } // Swap out the global pairs list, as the nested call to
	          // innerEquiv will clobber its contents


	          parentPairs = pairs;

	          if (innerEquiv(bVal, aVal)) {
	            innerEq = true;
	          } // Replace the global pairs list


	          pairs = parentPairs;
	        });

	        if (!innerEq) {
	          outerEq = false;
	        }
	      });
	      return outerEq;
	    },
	    // Define maps a and b to be equivalent if for each key-value pair (aKey, aVal)
	    // in a, there is some key-value pair (bKey, bVal) in b such that
	    // [ aKey, aVal ] and [ bKey, bVal ] are equivalent. Key repetitions are not
	    // counted, so these are equivalent:
	    // a = new Map( [ [ {}, 1 ], [ {}, 1 ], [ [], 1 ] ] );
	    // b = new Map( [ [ {}, 1 ], [ [], 1 ], [ [], 1 ] ] );
	    "map": function map(a, b) {
	      var innerEq,
	          outerEq = true;

	      if (a.size !== b.size) {
	        // This optimization has certain quirks because of the lack of
	        // repetition counting. For instance, adding the same
	        // (reference-identical) key-value pair to two equivalent maps
	        // can make them non-equivalent.
	        return false;
	      }

	      a.forEach(function (aVal, aKey) {
	        // Short-circuit if the result is already known. (Using for...of
	        // with a break clause would be cleaner here, but it would cause
	        // a syntax error on older Javascript implementations even if
	        // Map is unused)
	        if (!outerEq) {
	          return;
	        }

	        innerEq = false;
	        b.forEach(function (bVal, bKey) {
	          var parentPairs; // Likewise, short-circuit if the result is already known

	          if (innerEq) {
	            return;
	          } // Swap out the global pairs list, as the nested call to
	          // innerEquiv will clobber its contents


	          parentPairs = pairs;

	          if (innerEquiv([bVal, bKey], [aVal, aKey])) {
	            innerEq = true;
	          } // Replace the global pairs list


	          pairs = parentPairs;
	        });

	        if (!innerEq) {
	          outerEq = false;
	        }
	      });
	      return outerEq;
	    },
	    "object": function object(a, b) {
	      var i,
	          aProperties = [],
	          bProperties = [];

	      if (compareConstructors(a, b) === false) {
	        return false;
	      } // Be strict: don't ensure hasOwnProperty and go deep


	      for (i in a) {
	        // Collect a's properties
	        aProperties.push(i); // Skip OOP methods that look the same

	        if (a.constructor !== Object && typeof a.constructor !== "undefined" && typeof a[i] === "function" && typeof b[i] === "function" && a[i].toString() === b[i].toString()) {
	          continue;
	        } // Compare non-containers; queue non-reference-equal containers


	        if (!breadthFirstCompareChild(a[i], b[i])) {
	          return false;
	        }
	      }

	      for (i in b) {
	        // Collect b's properties
	        bProperties.push(i);
	      } // Ensures identical properties name


	      return typeEquiv(aProperties.sort(), bProperties.sort());
	    }
	  };

	  function typeEquiv(a, b) {
	    var type = objectType(a); // Callbacks for containers will append to the pairs queue to achieve breadth-first
	    // search order. The pairs queue is also used to avoid reprocessing any pair of
	    // containers that are reference-equal to a previously visited pair (a special case
	    // this being recursion detection).
	    //
	    // Because of this approach, once typeEquiv returns a false value, it should not be
	    // called again without clearing the pair queue else it may wrongly report a visited
	    // pair as being equivalent.

	    return objectType(b) === type && callbacks[type](a, b);
	  }

	  function innerEquiv(a, b) {
	    var i, pair; // We're done when there's nothing more to compare

	    if (arguments.length < 2) {
	      return true;
	    } // Clear the global pair queue and add the top-level values being compared


	    pairs = [{
	      a: a,
	      b: b
	    }];

	    for (i = 0; i < pairs.length; i++) {
	      pair = pairs[i]; // Perform type-specific comparison on any pairs that are not strictly
	      // equal. For container types, that comparison will postpone comparison
	      // of any sub-container pair to the end of the pair queue. This gives
	      // breadth-first search order. It also avoids the reprocessing of
	      // reference-equal siblings, cousins etc, which can have a significant speed
	      // impact when comparing a container of small objects each of which has a
	      // reference to the same (singleton) large object.

	      if (pair.a !== pair.b && !typeEquiv(pair.a, pair.b)) {
	        return false;
	      }
	    } // ...across all consecutive argument pairs


	    return arguments.length === 2 || innerEquiv.apply(this, [].slice.call(arguments, 1));
	  }

	  return function () {
	    var result = innerEquiv.apply(void 0, arguments); // Release any retained objects

	    pairs.length = 0;
	    return result;
	  };
	})();

	/**
	 * Config object: Maintain internal state
	 * Later exposed as QUnit.config
	 * `config` initialized at top of scope
	 */

	var config = {
	  // The queue of tests to run
	  queue: [],
	  // Block until document ready
	  blocking: true,
	  // By default, run previously failed tests first
	  // very useful in combination with "Hide passed tests" checked
	  reorder: true,
	  // By default, modify document.title when suite is done
	  altertitle: true,
	  // HTML Reporter: collapse every test except the first failing test
	  // If false, all failing tests will be expanded
	  collapse: true,
	  // By default, scroll to top of the page when suite is done
	  scrolltop: true,
	  // Depth up-to which object will be dumped
	  maxDepth: 5,
	  // When enabled, all tests must call expect()
	  requireExpects: false,
	  // Placeholder for user-configurable form-exposed URL parameters
	  urlConfig: [],
	  // Set of all modules.
	  modules: [],
	  // The first unnamed module
	  currentModule: {
	    name: "",
	    tests: [],
	    childModules: [],
	    testsRun: 0,
	    unskippedTestsRun: 0,
	    hooks: {
	      before: [],
	      beforeEach: [],
	      afterEach: [],
	      after: []
	    }
	  },
	  callbacks: {},
	  // The storage module to use for reordering tests
	  storage: localSessionStorage
	}; // take a predefined QUnit.config and extend the defaults

	var globalConfig = window$1 && window$1.QUnit && window$1.QUnit.config; // only extend the global config if there is no QUnit overload

	if (window$1 && window$1.QUnit && !window$1.QUnit.version) {
	  extend(config, globalConfig);
	} // Push a loose unnamed module to the modules collection


	config.modules.push(config.currentModule);

	// https://flesler.blogspot.com/2008/05/jsdump-pretty-dump-of-any-javascript.html

	var dump = (function () {
	  function quote(str) {
	    return "\"" + str.toString().replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"";
	  }

	  function literal(o) {
	    return o + "";
	  }

	  function join(pre, arr, post) {
	    var s = dump.separator(),
	        base = dump.indent(),
	        inner = dump.indent(1);

	    if (arr.join) {
	      arr = arr.join("," + s + inner);
	    }

	    if (!arr) {
	      return pre + post;
	    }

	    return [pre, inner + arr, base + post].join(s);
	  }

	  function array(arr, stack) {
	    var i = arr.length,
	        ret = new Array(i);

	    if (dump.maxDepth && dump.depth > dump.maxDepth) {
	      return "[object Array]";
	    }

	    this.up();

	    while (i--) {
	      ret[i] = this.parse(arr[i], undefined, stack);
	    }

	    this.down();
	    return join("[", ret, "]");
	  }

	  function isArray(obj) {
	    return (//Native Arrays
	      toString.call(obj) === "[object Array]" || // NodeList objects
	      typeof obj.length === "number" && obj.item !== undefined && (obj.length ? obj.item(0) === obj[0] : obj.item(0) === null && obj[0] === undefined)
	    );
	  }

	  var reName = /^function (\w+)/,
	      dump = {
	    // The objType is used mostly internally, you can fix a (custom) type in advance
	    parse: function parse(obj, objType, stack) {
	      stack = stack || [];
	      var res,
	          parser,
	          parserType,
	          objIndex = stack.indexOf(obj);

	      if (objIndex !== -1) {
	        return "recursion(".concat(objIndex - stack.length, ")");
	      }

	      objType = objType || this.typeOf(obj);
	      parser = this.parsers[objType];
	      parserType = _typeof(parser);

	      if (parserType === "function") {
	        stack.push(obj);
	        res = parser.call(this, obj, stack);
	        stack.pop();
	        return res;
	      }

	      return parserType === "string" ? parser : this.parsers.error;
	    },
	    typeOf: function typeOf(obj) {
	      var type;

	      if (obj === null) {
	        type = "null";
	      } else if (typeof obj === "undefined") {
	        type = "undefined";
	      } else if (is("regexp", obj)) {
	        type = "regexp";
	      } else if (is("date", obj)) {
	        type = "date";
	      } else if (is("function", obj)) {
	        type = "function";
	      } else if (obj.setInterval !== undefined && obj.document !== undefined && obj.nodeType === undefined) {
	        type = "window";
	      } else if (obj.nodeType === 9) {
	        type = "document";
	      } else if (obj.nodeType) {
	        type = "node";
	      } else if (isArray(obj)) {
	        type = "array";
	      } else if (obj.constructor === Error.prototype.constructor) {
	        type = "error";
	      } else {
	        type = _typeof(obj);
	      }

	      return type;
	    },
	    separator: function separator() {
	      if (this.multiline) {
	        return this.HTML ? "<br />" : "\n";
	      } else {
	        return this.HTML ? "&#160;" : " ";
	      }
	    },
	    // Extra can be a number, shortcut for increasing-calling-decreasing
	    indent: function indent(extra) {
	      if (!this.multiline) {
	        return "";
	      }

	      var chr = this.indentChar;

	      if (this.HTML) {
	        chr = chr.replace(/\t/g, "   ").replace(/ /g, "&#160;");
	      }

	      return new Array(this.depth + (extra || 0)).join(chr);
	    },
	    up: function up(a) {
	      this.depth += a || 1;
	    },
	    down: function down(a) {
	      this.depth -= a || 1;
	    },
	    setParser: function setParser(name, parser) {
	      this.parsers[name] = parser;
	    },
	    // The next 3 are exposed so you can use them
	    quote: quote,
	    literal: literal,
	    join: join,
	    depth: 1,
	    maxDepth: config.maxDepth,
	    // This is the list of parsers, to modify them, use dump.setParser
	    parsers: {
	      window: "[Window]",
	      document: "[Document]",
	      error: function error(_error) {
	        return "Error(\"" + _error.message + "\")";
	      },
	      unknown: "[Unknown]",
	      "null": "null",
	      "undefined": "undefined",
	      "function": function _function(fn) {
	        var ret = "function",
	            // Functions never have name in IE
	        name = "name" in fn ? fn.name : (reName.exec(fn) || [])[1];

	        if (name) {
	          ret += " " + name;
	        }

	        ret += "(";
	        ret = [ret, dump.parse(fn, "functionArgs"), "){"].join("");
	        return join(ret, dump.parse(fn, "functionCode"), "}");
	      },
	      array: array,
	      nodelist: array,
	      "arguments": array,
	      object: function object(map, stack) {
	        var keys,
	            key,
	            val,
	            i,
	            nonEnumerableProperties,
	            ret = [];

	        if (dump.maxDepth && dump.depth > dump.maxDepth) {
	          return "[object Object]";
	        }

	        dump.up();
	        keys = [];

	        for (key in map) {
	          keys.push(key);
	        } // Some properties are not always enumerable on Error objects.


	        nonEnumerableProperties = ["message", "name"];

	        for (i in nonEnumerableProperties) {
	          key = nonEnumerableProperties[i];

	          if (key in map && !inArray(key, keys)) {
	            keys.push(key);
	          }
	        }

	        keys.sort();

	        for (i = 0; i < keys.length; i++) {
	          key = keys[i];
	          val = map[key];
	          ret.push(dump.parse(key, "key") + ": " + dump.parse(val, undefined, stack));
	        }

	        dump.down();
	        return join("{", ret, "}");
	      },
	      node: function node(_node) {
	        var len,
	            i,
	            val,
	            open = dump.HTML ? "&lt;" : "<",
	            close = dump.HTML ? "&gt;" : ">",
	            tag = _node.nodeName.toLowerCase(),
	            ret = open + tag,
	            attrs = _node.attributes;

	        if (attrs) {
	          for (i = 0, len = attrs.length; i < len; i++) {
	            val = attrs[i].nodeValue; // IE6 includes all attributes in .attributes, even ones not explicitly
	            // set. Those have values like undefined, null, 0, false, "" or
	            // "inherit".

	            if (val && val !== "inherit") {
	              ret += " " + attrs[i].nodeName + "=" + dump.parse(val, "attribute");
	            }
	          }
	        }

	        ret += close; // Show content of TextNode or CDATASection

	        if (_node.nodeType === 3 || _node.nodeType === 4) {
	          ret += _node.nodeValue;
	        }

	        return ret + open + "/" + tag + close;
	      },
	      // Function calls it internally, it's the arguments part of the function
	      functionArgs: function functionArgs(fn) {
	        var args,
	            l = fn.length;

	        if (!l) {
	          return "";
	        }

	        args = new Array(l);

	        while (l--) {
	          // 97 is 'a'
	          args[l] = String.fromCharCode(97 + l);
	        }

	        return " " + args.join(", ") + " ";
	      },
	      // Object calls it internally, the key part of an item in a map
	      key: quote,
	      // Function calls it internally, it's the content of the function
	      functionCode: "[code]",
	      // Node calls it internally, it's a html attribute value
	      attribute: quote,
	      string: quote,
	      date: quote,
	      regexp: literal,
	      number: literal,
	      "boolean": literal,
	      symbol: function symbol(sym) {
	        return sym.toString();
	      }
	    },
	    // If true, entities are escaped ( <, >, \t, space and \n )
	    HTML: false,
	    // Indentation unit
	    indentChar: "  ",
	    // If true, items in a collection, are separated by a \n, else just a space.
	    multiline: true
	  };
	  return dump;
	})();

	var SuiteReport = /*#__PURE__*/function () {
	  function SuiteReport(name, parentSuite) {
	    _classCallCheck(this, SuiteReport);

	    this.name = name;
	    this.fullName = parentSuite ? parentSuite.fullName.concat(name) : [];
	    this.tests = [];
	    this.childSuites = [];

	    if (parentSuite) {
	      parentSuite.pushChildSuite(this);
	    }
	  }

	  _createClass(SuiteReport, [{
	    key: "start",
	    value: function start(recordTime) {
	      if (recordTime) {
	        this._startTime = performanceNow();

	        if (performance) {
	          var suiteLevel = this.fullName.length;
	          performance.mark("qunit_suite_".concat(suiteLevel, "_start"));
	        }
	      }

	      return {
	        name: this.name,
	        fullName: this.fullName.slice(),
	        tests: this.tests.map(function (test) {
	          return test.start();
	        }),
	        childSuites: this.childSuites.map(function (suite) {
	          return suite.start();
	        }),
	        testCounts: {
	          total: this.getTestCounts().total
	        }
	      };
	    }
	  }, {
	    key: "end",
	    value: function end(recordTime) {
	      if (recordTime) {
	        this._endTime = performanceNow();

	        if (performance) {
	          var suiteLevel = this.fullName.length;
	          performance.mark("qunit_suite_".concat(suiteLevel, "_end"));
	          var suiteName = this.fullName.join(" – ");
	          measure(suiteLevel === 0 ? "QUnit Test Run" : "QUnit Test Suite: ".concat(suiteName), "qunit_suite_".concat(suiteLevel, "_start"), "qunit_suite_".concat(suiteLevel, "_end"));
	        }
	      }

	      return {
	        name: this.name,
	        fullName: this.fullName.slice(),
	        tests: this.tests.map(function (test) {
	          return test.end();
	        }),
	        childSuites: this.childSuites.map(function (suite) {
	          return suite.end();
	        }),
	        testCounts: this.getTestCounts(),
	        runtime: this.getRuntime(),
	        status: this.getStatus()
	      };
	    }
	  }, {
	    key: "pushChildSuite",
	    value: function pushChildSuite(suite) {
	      this.childSuites.push(suite);
	    }
	  }, {
	    key: "pushTest",
	    value: function pushTest(test) {
	      this.tests.push(test);
	    }
	  }, {
	    key: "getRuntime",
	    value: function getRuntime() {
	      return this._endTime - this._startTime;
	    }
	  }, {
	    key: "getTestCounts",
	    value: function getTestCounts() {
	      var counts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
	        passed: 0,
	        failed: 0,
	        skipped: 0,
	        todo: 0,
	        total: 0
	      };
	      counts = this.tests.reduce(function (counts, test) {
	        if (test.valid) {
	          counts[test.getStatus()]++;
	          counts.total++;
	        }

	        return counts;
	      }, counts);
	      return this.childSuites.reduce(function (counts, suite) {
	        return suite.getTestCounts(counts);
	      }, counts);
	    }
	  }, {
	    key: "getStatus",
	    value: function getStatus() {
	      var _this$getTestCounts = this.getTestCounts(),
	          total = _this$getTestCounts.total,
	          failed = _this$getTestCounts.failed,
	          skipped = _this$getTestCounts.skipped,
	          todo = _this$getTestCounts.todo;

	      if (failed) {
	        return "failed";
	      } else {
	        if (skipped === total) {
	          return "skipped";
	        } else if (todo === total) {
	          return "todo";
	        } else {
	          return "passed";
	        }
	      }
	    }
	  }]);

	  return SuiteReport;
	}();

	var focused = false;
	var moduleStack = [];

	function isParentModuleInQueue() {
	  var modulesInQueue = config.modules.map(function (module) {
	    return module.moduleId;
	  });
	  return moduleStack.some(function (module) {
	    return modulesInQueue.includes(module.moduleId);
	  });
	}

	function createModule(name, testEnvironment, modifiers) {
	  var parentModule = moduleStack.length ? moduleStack.slice(-1)[0] : null;
	  var moduleName = parentModule !== null ? [parentModule.name, name].join(" > ") : name;
	  var parentSuite = parentModule ? parentModule.suiteReport : globalSuite;
	  var skip = parentModule !== null && parentModule.skip || modifiers.skip;
	  var todo = parentModule !== null && parentModule.todo || modifiers.todo;
	  var module = {
	    name: moduleName,
	    parentModule: parentModule,
	    tests: [],
	    moduleId: generateHash(moduleName),
	    testsRun: 0,
	    unskippedTestsRun: 0,
	    childModules: [],
	    suiteReport: new SuiteReport(name, parentSuite),
	    // Pass along `skip` and `todo` properties from parent module, in case
	    // there is one, to childs. And use own otherwise.
	    // This property will be used to mark own tests and tests of child suites
	    // as either `skipped` or `todo`.
	    skip: skip,
	    todo: skip ? false : todo
	  };
	  var env = {};

	  if (parentModule) {
	    parentModule.childModules.push(module);
	    extend(env, parentModule.testEnvironment);
	  }

	  extend(env, testEnvironment);
	  module.testEnvironment = env;
	  config.modules.push(module);
	  return module;
	}

	function processModule(name, options, executeNow) {
	  var modifiers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

	  if (objectType(options) === "function") {
	    executeNow = options;
	    options = undefined;
	  }

	  var module = createModule(name, options, modifiers); // Move any hooks to a 'hooks' object

	  var testEnvironment = module.testEnvironment;
	  var hooks = module.hooks = {};
	  setHookFromEnvironment(hooks, testEnvironment, "before");
	  setHookFromEnvironment(hooks, testEnvironment, "beforeEach");
	  setHookFromEnvironment(hooks, testEnvironment, "afterEach");
	  setHookFromEnvironment(hooks, testEnvironment, "after");
	  var moduleFns = {
	    before: setHookFunction(module, "before"),
	    beforeEach: setHookFunction(module, "beforeEach"),
	    afterEach: setHookFunction(module, "afterEach"),
	    after: setHookFunction(module, "after")
	  };
	  var currentModule = config.currentModule;

	  if (objectType(executeNow) === "function") {
	    moduleStack.push(module);
	    config.currentModule = module;
	    executeNow.call(module.testEnvironment, moduleFns);
	    moduleStack.pop();
	    module = module.parentModule || currentModule;
	  }

	  config.currentModule = module;

	  function setHookFromEnvironment(hooks, environment, name) {
	    var potentialHook = environment[name];
	    hooks[name] = typeof potentialHook === "function" ? [potentialHook] : [];
	    delete environment[name];
	  }

	  function setHookFunction(module, hookName) {
	    return function setHook(callback) {
	      module.hooks[hookName].push(callback);
	    };
	  }
	}

	function module$1(name, options, executeNow) {
	  if (focused && !isParentModuleInQueue()) {
	    return;
	  }

	  processModule(name, options, executeNow);
	}

	module$1.only = function () {
	  if (!focused) {
	    config.modules.length = 0;
	    config.queue.length = 0;
	  }

	  processModule.apply(void 0, arguments);
	  focused = true;
	};

	module$1.skip = function (name, options, executeNow) {
	  if (focused) {
	    return;
	  }

	  processModule(name, options, executeNow, {
	    skip: true
	  });
	};

	module$1.todo = function (name, options, executeNow) {
	  if (focused) {
	    return;
	  }

	  processModule(name, options, executeNow, {
	    todo: true
	  });
	};

	var LISTENERS = Object.create(null);
	var SUPPORTED_EVENTS = ["runStart", "suiteStart", "testStart", "assertion", "testEnd", "suiteEnd", "runEnd"];
	/**
	 * Emits an event with the specified data to all currently registered listeners.
	 * Callbacks will fire in the order in which they are registered (FIFO). This
	 * function is not exposed publicly; it is used by QUnit internals to emit
	 * logging events.
	 *
	 * @private
	 * @method emit
	 * @param {String} eventName
	 * @param {Object} data
	 * @return {Void}
	 */

	function emit(eventName, data) {
	  if (objectType(eventName) !== "string") {
	    throw new TypeError("eventName must be a string when emitting an event");
	  } // Clone the callbacks in case one of them registers a new callback


	  var originalCallbacks = LISTENERS[eventName];
	  var callbacks = originalCallbacks ? _toConsumableArray(originalCallbacks) : [];

	  for (var i = 0; i < callbacks.length; i++) {
	    callbacks[i](data);
	  }
	}
	/**
	 * Registers a callback as a listener to the specified event.
	 *
	 * @public
	 * @method on
	 * @param {String} eventName
	 * @param {Function} callback
	 * @return {Void}
	 */

	function on(eventName, callback) {
	  if (objectType(eventName) !== "string") {
	    throw new TypeError("eventName must be a string when registering a listener");
	  } else if (!inArray(eventName, SUPPORTED_EVENTS)) {
	    var events = SUPPORTED_EVENTS.join(", ");
	    throw new Error("\"".concat(eventName, "\" is not a valid event; must be one of: ").concat(events, "."));
	  } else if (objectType(callback) !== "function") {
	    throw new TypeError("callback must be a function when registering a listener");
	  }

	  if (!LISTENERS[eventName]) {
	    LISTENERS[eventName] = [];
	  } // Don't register the same callback more than once


	  if (!inArray(callback, LISTENERS[eventName])) {
	    LISTENERS[eventName].push(callback);
	  }
	}

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, basedir, module) {
		return module = {
		  path: basedir,
		  exports: {},
		  require: function (path, base) {
	      return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
	    }
		}, fn(module, module.exports), module.exports;
	}

	function commonjsRequire () {
		throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
	}

	var es6Promise = createCommonjsModule(function (module, exports) {
	  /*!
	   * @overview es6-promise - a tiny implementation of Promises/A+.
	   * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
	   * @license   Licensed under MIT license
	   *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
	   * @version   v4.2.8+1e68dce6
	   */
	  (function (global, factory) {
	     module.exports = factory() ;
	  })(commonjsGlobal, function () {

	    function objectOrFunction(x) {
	      var type = typeof x;
	      return x !== null && (type === 'object' || type === 'function');
	    }

	    function isFunction(x) {
	      return typeof x === 'function';
	    }

	    var _isArray = void 0;

	    if (Array.isArray) {
	      _isArray = Array.isArray;
	    } else {
	      _isArray = function (x) {
	        return Object.prototype.toString.call(x) === '[object Array]';
	      };
	    }

	    var isArray = _isArray;
	    var len = 0;
	    var vertxNext = void 0;
	    var customSchedulerFn = void 0;

	    var asap = function asap(callback, arg) {
	      queue[len] = callback;
	      queue[len + 1] = arg;
	      len += 2;

	      if (len === 2) {
	        // If len is 2, that means that we need to schedule an async flush.
	        // If additional callbacks are queued before the queue is flushed, they
	        // will be processed by this flush that we are scheduling.
	        if (customSchedulerFn) {
	          customSchedulerFn(flush);
	        } else {
	          scheduleFlush();
	        }
	      }
	    };

	    function setScheduler(scheduleFn) {
	      customSchedulerFn = scheduleFn;
	    }

	    function setAsap(asapFn) {
	      asap = asapFn;
	    }

	    var browserWindow = typeof window !== 'undefined' ? window : undefined;
	    var browserGlobal = browserWindow || {};
	    var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
	    var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && {}.toString.call(process) === '[object process]'; // test for web worker but not in IE10

	    var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined'; // node

	    function useNextTick() {
	      // node version 0.10.x displays a deprecation warning when nextTick is used recursively
	      // see https://github.com/cujojs/when/issues/410 for details
	      return function () {
	        return process.nextTick(flush);
	      };
	    } // vertx


	    function useVertxTimer() {
	      if (typeof vertxNext !== 'undefined') {
	        return function () {
	          vertxNext(flush);
	        };
	      }

	      return useSetTimeout();
	    }

	    function useMutationObserver() {
	      var iterations = 0;
	      var observer = new BrowserMutationObserver(flush);
	      var node = document.createTextNode('');
	      observer.observe(node, {
	        characterData: true
	      });
	      return function () {
	        node.data = iterations = ++iterations % 2;
	      };
	    } // web worker


	    function useMessageChannel() {
	      var channel = new MessageChannel();
	      channel.port1.onmessage = flush;
	      return function () {
	        return channel.port2.postMessage(0);
	      };
	    }

	    function useSetTimeout() {
	      // Store setTimeout reference so es6-promise will be unaffected by
	      // other code modifying setTimeout (like sinon.useFakeTimers())
	      var globalSetTimeout = setTimeout;
	      return function () {
	        return globalSetTimeout(flush, 1);
	      };
	    }

	    var queue = new Array(1000);

	    function flush() {
	      for (var i = 0; i < len; i += 2) {
	        var callback = queue[i];
	        var arg = queue[i + 1];
	        callback(arg);
	        queue[i] = undefined;
	        queue[i + 1] = undefined;
	      }

	      len = 0;
	    }

	    function attemptVertx() {
	      try {
	        var vertx = Function('return this')().require('vertx');

	        vertxNext = vertx.runOnLoop || vertx.runOnContext;
	        return useVertxTimer();
	      } catch (e) {
	        return useSetTimeout();
	      }
	    }

	    var scheduleFlush = void 0; // Decide what async method to use to triggering processing of queued callbacks:

	    if (isNode) {
	      scheduleFlush = useNextTick();
	    } else if (BrowserMutationObserver) {
	      scheduleFlush = useMutationObserver();
	    } else if (isWorker) {
	      scheduleFlush = useMessageChannel();
	    } else if (browserWindow === undefined && typeof commonjsRequire === 'function') {
	      scheduleFlush = attemptVertx();
	    } else {
	      scheduleFlush = useSetTimeout();
	    }

	    function then(onFulfillment, onRejection) {
	      var parent = this;
	      var child = new this.constructor(noop);

	      if (child[PROMISE_ID] === undefined) {
	        makePromise(child);
	      }

	      var _state = parent._state;

	      if (_state) {
	        var callback = arguments[_state - 1];
	        asap(function () {
	          return invokeCallback(_state, child, callback, parent._result);
	        });
	      } else {
	        subscribe(parent, child, onFulfillment, onRejection);
	      }

	      return child;
	    }
	    /**
	      `Promise.resolve` returns a promise that will become resolved with the
	      passed `value`. It is shorthand for the following:
	    
	      ```javascript
	      let promise = new Promise(function(resolve, reject){
	        resolve(1);
	      });
	    
	      promise.then(function(value){
	        // value === 1
	      });
	      ```
	    
	      Instead of writing the above, your code now simply becomes the following:
	    
	      ```javascript
	      let promise = Promise.resolve(1);
	    
	      promise.then(function(value){
	        // value === 1
	      });
	      ```
	    
	      @method resolve
	      @static
	      @param {Any} value value that the returned promise will be resolved with
	      Useful for tooling.
	      @return {Promise} a promise that will become fulfilled with the given
	      `value`
	    */


	    function resolve$1(object) {
	      /*jshint validthis:true */
	      var Constructor = this;

	      if (object && typeof object === 'object' && object.constructor === Constructor) {
	        return object;
	      }

	      var promise = new Constructor(noop);
	      resolve(promise, object);
	      return promise;
	    }

	    var PROMISE_ID = Math.random().toString(36).substring(2);

	    function noop() {}

	    var PENDING = void 0;
	    var FULFILLED = 1;
	    var REJECTED = 2;

	    function selfFulfillment() {
	      return new TypeError("You cannot resolve a promise with itself");
	    }

	    function cannotReturnOwn() {
	      return new TypeError('A promises callback cannot return that same promise.');
	    }

	    function tryThen(then$$1, value, fulfillmentHandler, rejectionHandler) {
	      try {
	        then$$1.call(value, fulfillmentHandler, rejectionHandler);
	      } catch (e) {
	        return e;
	      }
	    }

	    function handleForeignThenable(promise, thenable, then$$1) {
	      asap(function (promise) {
	        var sealed = false;
	        var error = tryThen(then$$1, thenable, function (value) {
	          if (sealed) {
	            return;
	          }

	          sealed = true;

	          if (thenable !== value) {
	            resolve(promise, value);
	          } else {
	            fulfill(promise, value);
	          }
	        }, function (reason) {
	          if (sealed) {
	            return;
	          }

	          sealed = true;
	          reject(promise, reason);
	        }, 'Settle: ' + (promise._label || ' unknown promise'));

	        if (!sealed && error) {
	          sealed = true;
	          reject(promise, error);
	        }
	      }, promise);
	    }

	    function handleOwnThenable(promise, thenable) {
	      if (thenable._state === FULFILLED) {
	        fulfill(promise, thenable._result);
	      } else if (thenable._state === REJECTED) {
	        reject(promise, thenable._result);
	      } else {
	        subscribe(thenable, undefined, function (value) {
	          return resolve(promise, value);
	        }, function (reason) {
	          return reject(promise, reason);
	        });
	      }
	    }

	    function handleMaybeThenable(promise, maybeThenable, then$$1) {
	      if (maybeThenable.constructor === promise.constructor && then$$1 === then && maybeThenable.constructor.resolve === resolve$1) {
	        handleOwnThenable(promise, maybeThenable);
	      } else {
	        if (then$$1 === undefined) {
	          fulfill(promise, maybeThenable);
	        } else if (isFunction(then$$1)) {
	          handleForeignThenable(promise, maybeThenable, then$$1);
	        } else {
	          fulfill(promise, maybeThenable);
	        }
	      }
	    }

	    function resolve(promise, value) {
	      if (promise === value) {
	        reject(promise, selfFulfillment());
	      } else if (objectOrFunction(value)) {
	        var then$$1 = void 0;

	        try {
	          then$$1 = value.then;
	        } catch (error) {
	          reject(promise, error);
	          return;
	        }

	        handleMaybeThenable(promise, value, then$$1);
	      } else {
	        fulfill(promise, value);
	      }
	    }

	    function publishRejection(promise) {
	      if (promise._onerror) {
	        promise._onerror(promise._result);
	      }

	      publish(promise);
	    }

	    function fulfill(promise, value) {
	      if (promise._state !== PENDING) {
	        return;
	      }

	      promise._result = value;
	      promise._state = FULFILLED;

	      if (promise._subscribers.length !== 0) {
	        asap(publish, promise);
	      }
	    }

	    function reject(promise, reason) {
	      if (promise._state !== PENDING) {
	        return;
	      }

	      promise._state = REJECTED;
	      promise._result = reason;
	      asap(publishRejection, promise);
	    }

	    function subscribe(parent, child, onFulfillment, onRejection) {
	      var _subscribers = parent._subscribers;
	      var length = _subscribers.length;
	      parent._onerror = null;
	      _subscribers[length] = child;
	      _subscribers[length + FULFILLED] = onFulfillment;
	      _subscribers[length + REJECTED] = onRejection;

	      if (length === 0 && parent._state) {
	        asap(publish, parent);
	      }
	    }

	    function publish(promise) {
	      var subscribers = promise._subscribers;
	      var settled = promise._state;

	      if (subscribers.length === 0) {
	        return;
	      }

	      var child = void 0,
	          callback = void 0,
	          detail = promise._result;

	      for (var i = 0; i < subscribers.length; i += 3) {
	        child = subscribers[i];
	        callback = subscribers[i + settled];

	        if (child) {
	          invokeCallback(settled, child, callback, detail);
	        } else {
	          callback(detail);
	        }
	      }

	      promise._subscribers.length = 0;
	    }

	    function invokeCallback(settled, promise, callback, detail) {
	      var hasCallback = isFunction(callback),
	          value = void 0,
	          error = void 0,
	          succeeded = true;

	      if (hasCallback) {
	        try {
	          value = callback(detail);
	        } catch (e) {
	          succeeded = false;
	          error = e;
	        }

	        if (promise === value) {
	          reject(promise, cannotReturnOwn());
	          return;
	        }
	      } else {
	        value = detail;
	      }

	      if (promise._state !== PENDING) ; else if (hasCallback && succeeded) {
	        resolve(promise, value);
	      } else if (succeeded === false) {
	        reject(promise, error);
	      } else if (settled === FULFILLED) {
	        fulfill(promise, value);
	      } else if (settled === REJECTED) {
	        reject(promise, value);
	      }
	    }

	    function initializePromise(promise, resolver) {
	      try {
	        resolver(function resolvePromise(value) {
	          resolve(promise, value);
	        }, function rejectPromise(reason) {
	          reject(promise, reason);
	        });
	      } catch (e) {
	        reject(promise, e);
	      }
	    }

	    var id = 0;

	    function nextId() {
	      return id++;
	    }

	    function makePromise(promise) {
	      promise[PROMISE_ID] = id++;
	      promise._state = undefined;
	      promise._result = undefined;
	      promise._subscribers = [];
	    }

	    function validationError() {
	      return new Error('Array Methods must be provided an Array');
	    }

	    var Enumerator = function () {
	      function Enumerator(Constructor, input) {
	        this._instanceConstructor = Constructor;
	        this.promise = new Constructor(noop);

	        if (!this.promise[PROMISE_ID]) {
	          makePromise(this.promise);
	        }

	        if (isArray(input)) {
	          this.length = input.length;
	          this._remaining = input.length;
	          this._result = new Array(this.length);

	          if (this.length === 0) {
	            fulfill(this.promise, this._result);
	          } else {
	            this.length = this.length || 0;

	            this._enumerate(input);

	            if (this._remaining === 0) {
	              fulfill(this.promise, this._result);
	            }
	          }
	        } else {
	          reject(this.promise, validationError());
	        }
	      }

	      Enumerator.prototype._enumerate = function _enumerate(input) {
	        for (var i = 0; this._state === PENDING && i < input.length; i++) {
	          this._eachEntry(input[i], i);
	        }
	      };

	      Enumerator.prototype._eachEntry = function _eachEntry(entry, i) {
	        var c = this._instanceConstructor;
	        var resolve$$1 = c.resolve;

	        if (resolve$$1 === resolve$1) {
	          var _then = void 0;

	          var error = void 0;
	          var didError = false;

	          try {
	            _then = entry.then;
	          } catch (e) {
	            didError = true;
	            error = e;
	          }

	          if (_then === then && entry._state !== PENDING) {
	            this._settledAt(entry._state, i, entry._result);
	          } else if (typeof _then !== 'function') {
	            this._remaining--;
	            this._result[i] = entry;
	          } else if (c === Promise$1) {
	            var promise = new c(noop);

	            if (didError) {
	              reject(promise, error);
	            } else {
	              handleMaybeThenable(promise, entry, _then);
	            }

	            this._willSettleAt(promise, i);
	          } else {
	            this._willSettleAt(new c(function (resolve$$1) {
	              return resolve$$1(entry);
	            }), i);
	          }
	        } else {
	          this._willSettleAt(resolve$$1(entry), i);
	        }
	      };

	      Enumerator.prototype._settledAt = function _settledAt(state, i, value) {
	        var promise = this.promise;

	        if (promise._state === PENDING) {
	          this._remaining--;

	          if (state === REJECTED) {
	            reject(promise, value);
	          } else {
	            this._result[i] = value;
	          }
	        }

	        if (this._remaining === 0) {
	          fulfill(promise, this._result);
	        }
	      };

	      Enumerator.prototype._willSettleAt = function _willSettleAt(promise, i) {
	        var enumerator = this;
	        subscribe(promise, undefined, function (value) {
	          return enumerator._settledAt(FULFILLED, i, value);
	        }, function (reason) {
	          return enumerator._settledAt(REJECTED, i, reason);
	        });
	      };

	      return Enumerator;
	    }();
	    /**
	      `Promise.all` accepts an array of promises, and returns a new promise which
	      is fulfilled with an array of fulfillment values for the passed promises, or
	      rejected with the reason of the first passed promise to be rejected. It casts all
	      elements of the passed iterable to promises as it runs this algorithm.
	    
	      Example:
	    
	      ```javascript
	      let promise1 = resolve(1);
	      let promise2 = resolve(2);
	      let promise3 = resolve(3);
	      let promises = [ promise1, promise2, promise3 ];
	    
	      Promise.all(promises).then(function(array){
	        // The array here would be [ 1, 2, 3 ];
	      });
	      ```
	    
	      If any of the `promises` given to `all` are rejected, the first promise
	      that is rejected will be given as an argument to the returned promises's
	      rejection handler. For example:
	    
	      Example:
	    
	      ```javascript
	      let promise1 = resolve(1);
	      let promise2 = reject(new Error("2"));
	      let promise3 = reject(new Error("3"));
	      let promises = [ promise1, promise2, promise3 ];
	    
	      Promise.all(promises).then(function(array){
	        // Code here never runs because there are rejected promises!
	      }, function(error) {
	        // error.message === "2"
	      });
	      ```
	    
	      @method all
	      @static
	      @param {Array} entries array of promises
	      @param {String} label optional string for labeling the promise.
	      Useful for tooling.
	      @return {Promise} promise that is fulfilled when all `promises` have been
	      fulfilled, or rejected if any of them become rejected.
	      @static
	    */


	    function all(entries) {
	      return new Enumerator(this, entries).promise;
	    }
	    /**
	      `Promise.race` returns a new promise which is settled in the same way as the
	      first passed promise to settle.
	    
	      Example:
	    
	      ```javascript
	      let promise1 = new Promise(function(resolve, reject){
	        setTimeout(function(){
	          resolve('promise 1');
	        }, 200);
	      });
	    
	      let promise2 = new Promise(function(resolve, reject){
	        setTimeout(function(){
	          resolve('promise 2');
	        }, 100);
	      });
	    
	      Promise.race([promise1, promise2]).then(function(result){
	        // result === 'promise 2' because it was resolved before promise1
	        // was resolved.
	      });
	      ```
	    
	      `Promise.race` is deterministic in that only the state of the first
	      settled promise matters. For example, even if other promises given to the
	      `promises` array argument are resolved, but the first settled promise has
	      become rejected before the other promises became fulfilled, the returned
	      promise will become rejected:
	    
	      ```javascript
	      let promise1 = new Promise(function(resolve, reject){
	        setTimeout(function(){
	          resolve('promise 1');
	        }, 200);
	      });
	    
	      let promise2 = new Promise(function(resolve, reject){
	        setTimeout(function(){
	          reject(new Error('promise 2'));
	        }, 100);
	      });
	    
	      Promise.race([promise1, promise2]).then(function(result){
	        // Code here never runs
	      }, function(reason){
	        // reason.message === 'promise 2' because promise 2 became rejected before
	        // promise 1 became fulfilled
	      });
	      ```
	    
	      An example real-world use case is implementing timeouts:
	    
	      ```javascript
	      Promise.race([ajax('foo.json'), timeout(5000)])
	      ```
	    
	      @method race
	      @static
	      @param {Array} promises array of promises to observe
	      Useful for tooling.
	      @return {Promise} a promise which settles in the same way as the first passed
	      promise to settle.
	    */


	    function race(entries) {
	      /*jshint validthis:true */
	      var Constructor = this;

	      if (!isArray(entries)) {
	        return new Constructor(function (_, reject) {
	          return reject(new TypeError('You must pass an array to race.'));
	        });
	      } else {
	        return new Constructor(function (resolve, reject) {
	          var length = entries.length;

	          for (var i = 0; i < length; i++) {
	            Constructor.resolve(entries[i]).then(resolve, reject);
	          }
	        });
	      }
	    }
	    /**
	      `Promise.reject` returns a promise rejected with the passed `reason`.
	      It is shorthand for the following:
	    
	      ```javascript
	      let promise = new Promise(function(resolve, reject){
	        reject(new Error('WHOOPS'));
	      });
	    
	      promise.then(function(value){
	        // Code here doesn't run because the promise is rejected!
	      }, function(reason){
	        // reason.message === 'WHOOPS'
	      });
	      ```
	    
	      Instead of writing the above, your code now simply becomes the following:
	    
	      ```javascript
	      let promise = Promise.reject(new Error('WHOOPS'));
	    
	      promise.then(function(value){
	        // Code here doesn't run because the promise is rejected!
	      }, function(reason){
	        // reason.message === 'WHOOPS'
	      });
	      ```
	    
	      @method reject
	      @static
	      @param {Any} reason value that the returned promise will be rejected with.
	      Useful for tooling.
	      @return {Promise} a promise rejected with the given `reason`.
	    */


	    function reject$1(reason) {
	      /*jshint validthis:true */
	      var Constructor = this;
	      var promise = new Constructor(noop);
	      reject(promise, reason);
	      return promise;
	    }

	    function needsResolver() {
	      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
	    }

	    function needsNew() {
	      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
	    }
	    /**
	      Promise objects represent the eventual result of an asynchronous operation. The
	      primary way of interacting with a promise is through its `then` method, which
	      registers callbacks to receive either a promise's eventual value or the reason
	      why the promise cannot be fulfilled.
	    
	      Terminology
	      -----------
	    
	      - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
	      - `thenable` is an object or function that defines a `then` method.
	      - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
	      - `exception` is a value that is thrown using the throw statement.
	      - `reason` is a value that indicates why a promise was rejected.
	      - `settled` the final resting state of a promise, fulfilled or rejected.
	    
	      A promise can be in one of three states: pending, fulfilled, or rejected.
	    
	      Promises that are fulfilled have a fulfillment value and are in the fulfilled
	      state.  Promises that are rejected have a rejection reason and are in the
	      rejected state.  A fulfillment value is never a thenable.
	    
	      Promises can also be said to *resolve* a value.  If this value is also a
	      promise, then the original promise's settled state will match the value's
	      settled state.  So a promise that *resolves* a promise that rejects will
	      itself reject, and a promise that *resolves* a promise that fulfills will
	      itself fulfill.
	    
	    
	      Basic Usage:
	      ------------
	    
	      ```js
	      let promise = new Promise(function(resolve, reject) {
	        // on success
	        resolve(value);
	    
	        // on failure
	        reject(reason);
	      });
	    
	      promise.then(function(value) {
	        // on fulfillment
	      }, function(reason) {
	        // on rejection
	      });
	      ```
	    
	      Advanced Usage:
	      ---------------
	    
	      Promises shine when abstracting away asynchronous interactions such as
	      `XMLHttpRequest`s.
	    
	      ```js
	      function getJSON(url) {
	        return new Promise(function(resolve, reject){
	          let xhr = new XMLHttpRequest();
	    
	          xhr.open('GET', url);
	          xhr.onreadystatechange = handler;
	          xhr.responseType = 'json';
	          xhr.setRequestHeader('Accept', 'application/json');
	          xhr.send();
	    
	          function handler() {
	            if (this.readyState === this.DONE) {
	              if (this.status === 200) {
	                resolve(this.response);
	              } else {
	                reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
	              }
	            }
	          };
	        });
	      }
	    
	      getJSON('/posts.json').then(function(json) {
	        // on fulfillment
	      }, function(reason) {
	        // on rejection
	      });
	      ```
	    
	      Unlike callbacks, promises are great composable primitives.
	    
	      ```js
	      Promise.all([
	        getJSON('/posts'),
	        getJSON('/comments')
	      ]).then(function(values){
	        values[0] // => postsJSON
	        values[1] // => commentsJSON
	    
	        return values;
	      });
	      ```
	    
	      @class Promise
	      @param {Function} resolver
	      Useful for tooling.
	      @constructor
	    */


	    var Promise$1 = function () {
	      function Promise(resolver) {
	        this[PROMISE_ID] = nextId();
	        this._result = this._state = undefined;
	        this._subscribers = [];

	        if (noop !== resolver) {
	          typeof resolver !== 'function' && needsResolver();
	          this instanceof Promise ? initializePromise(this, resolver) : needsNew();
	        }
	      }
	      /**
	      The primary way of interacting with a promise is through its `then` method,
	      which registers callbacks to receive either a promise's eventual value or the
	      reason why the promise cannot be fulfilled.
	       ```js
	      findUser().then(function(user){
	        // user is available
	      }, function(reason){
	        // user is unavailable, and you are given the reason why
	      });
	      ```
	       Chaining
	      --------
	       The return value of `then` is itself a promise.  This second, 'downstream'
	      promise is resolved with the return value of the first promise's fulfillment
	      or rejection handler, or rejected if the handler throws an exception.
	       ```js
	      findUser().then(function (user) {
	        return user.name;
	      }, function (reason) {
	        return 'default name';
	      }).then(function (userName) {
	        // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
	        // will be `'default name'`
	      });
	       findUser().then(function (user) {
	        throw new Error('Found user, but still unhappy');
	      }, function (reason) {
	        throw new Error('`findUser` rejected and we're unhappy');
	      }).then(function (value) {
	        // never reached
	      }, function (reason) {
	        // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
	        // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
	      });
	      ```
	      If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
	       ```js
	      findUser().then(function (user) {
	        throw new PedagogicalException('Upstream error');
	      }).then(function (value) {
	        // never reached
	      }).then(function (value) {
	        // never reached
	      }, function (reason) {
	        // The `PedgagocialException` is propagated all the way down to here
	      });
	      ```
	       Assimilation
	      ------------
	       Sometimes the value you want to propagate to a downstream promise can only be
	      retrieved asynchronously. This can be achieved by returning a promise in the
	      fulfillment or rejection handler. The downstream promise will then be pending
	      until the returned promise is settled. This is called *assimilation*.
	       ```js
	      findUser().then(function (user) {
	        return findCommentsByAuthor(user);
	      }).then(function (comments) {
	        // The user's comments are now available
	      });
	      ```
	       If the assimliated promise rejects, then the downstream promise will also reject.
	       ```js
	      findUser().then(function (user) {
	        return findCommentsByAuthor(user);
	      }).then(function (comments) {
	        // If `findCommentsByAuthor` fulfills, we'll have the value here
	      }, function (reason) {
	        // If `findCommentsByAuthor` rejects, we'll have the reason here
	      });
	      ```
	       Simple Example
	      --------------
	       Synchronous Example
	       ```javascript
	      let result;
	       try {
	        result = findResult();
	        // success
	      } catch(reason) {
	        // failure
	      }
	      ```
	       Errback Example
	       ```js
	      findResult(function(result, err){
	        if (err) {
	          // failure
	        } else {
	          // success
	        }
	      });
	      ```
	       Promise Example;
	       ```javascript
	      findResult().then(function(result){
	        // success
	      }, function(reason){
	        // failure
	      });
	      ```
	       Advanced Example
	      --------------
	       Synchronous Example
	       ```javascript
	      let author, books;
	       try {
	        author = findAuthor();
	        books  = findBooksByAuthor(author);
	        // success
	      } catch(reason) {
	        // failure
	      }
	      ```
	       Errback Example
	       ```js
	       function foundBooks(books) {
	       }
	       function failure(reason) {
	       }
	       findAuthor(function(author, err){
	        if (err) {
	          failure(err);
	          // failure
	        } else {
	          try {
	            findBoooksByAuthor(author, function(books, err) {
	              if (err) {
	                failure(err);
	              } else {
	                try {
	                  foundBooks(books);
	                } catch(reason) {
	                  failure(reason);
	                }
	              }
	            });
	          } catch(error) {
	            failure(err);
	          }
	          // success
	        }
	      });
	      ```
	       Promise Example;
	       ```javascript
	      findAuthor().
	        then(findBooksByAuthor).
	        then(function(books){
	          // found books
	      }).catch(function(reason){
	        // something went wrong
	      });
	      ```
	       @method then
	      @param {Function} onFulfilled
	      @param {Function} onRejected
	      Useful for tooling.
	      @return {Promise}
	      */

	      /**
	      `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
	      as the catch block of a try/catch statement.
	      ```js
	      function findAuthor(){
	      throw new Error('couldn't find that author');
	      }
	      // synchronous
	      try {
	      findAuthor();
	      } catch(reason) {
	      // something went wrong
	      }
	      // async with promises
	      findAuthor().catch(function(reason){
	      // something went wrong
	      });
	      ```
	      @method catch
	      @param {Function} onRejection
	      Useful for tooling.
	      @return {Promise}
	      */


	      Promise.prototype.catch = function _catch(onRejection) {
	        return this.then(null, onRejection);
	      };
	      /**
	        `finally` will be invoked regardless of the promise's fate just as native
	        try/catch/finally behaves
	      
	        Synchronous example:
	      
	        ```js
	        findAuthor() {
	          if (Math.random() > 0.5) {
	            throw new Error();
	          }
	          return new Author();
	        }
	      
	        try {
	          return findAuthor(); // succeed or fail
	        } catch(error) {
	          return findOtherAuther();
	        } finally {
	          // always runs
	          // doesn't affect the return value
	        }
	        ```
	      
	        Asynchronous example:
	      
	        ```js
	        findAuthor().catch(function(reason){
	          return findOtherAuther();
	        }).finally(function(){
	          // author was either found, or not
	        });
	        ```
	      
	        @method finally
	        @param {Function} callback
	        @return {Promise}
	      */


	      Promise.prototype.finally = function _finally(callback) {
	        var promise = this;
	        var constructor = promise.constructor;

	        if (isFunction(callback)) {
	          return promise.then(function (value) {
	            return constructor.resolve(callback()).then(function () {
	              return value;
	            });
	          }, function (reason) {
	            return constructor.resolve(callback()).then(function () {
	              throw reason;
	            });
	          });
	        }

	        return promise.then(callback, callback);
	      };

	      return Promise;
	    }();

	    Promise$1.prototype.then = then;
	    Promise$1.all = all;
	    Promise$1.race = race;
	    Promise$1.resolve = resolve$1;
	    Promise$1.reject = reject$1;
	    Promise$1._setScheduler = setScheduler;
	    Promise$1._setAsap = setAsap;
	    Promise$1._asap = asap;
	    /*global self*/

	    function polyfill() {
	      var local = void 0;

	      if (typeof commonjsGlobal !== 'undefined') {
	        local = commonjsGlobal;
	      } else if (typeof self !== 'undefined') {
	        local = self;
	      } else {
	        try {
	          local = Function('return this')();
	        } catch (e) {
	          throw new Error('polyfill failed because global object is unavailable in this environment');
	        }
	      }

	      var P = local.Promise;

	      if (P) {
	        var promiseToString = null;

	        try {
	          promiseToString = Object.prototype.toString.call(P.resolve());
	        } catch (e) {// silently ignored
	        }

	        if (promiseToString === '[object Promise]' && !P.cast) {
	          return;
	        }
	      }

	      local.Promise = Promise$1;
	    } // Strange compat..


	    Promise$1.polyfill = polyfill;
	    Promise$1.Promise = Promise$1;
	    return Promise$1;
	  });
	});

	var Promise$1 = typeof Promise !== "undefined" ? Promise : es6Promise;

	function registerLoggingCallbacks(obj) {
	  var i,
	      l,
	      key,
	      callbackNames = ["begin", "done", "log", "testStart", "testDone", "moduleStart", "moduleDone"];

	  function registerLoggingCallback(key) {
	    var loggingCallback = function loggingCallback(callback) {
	      if (objectType(callback) !== "function") {
	        throw new Error("QUnit logging methods require a callback function as their first parameters.");
	      }

	      config.callbacks[key].push(callback);
	    };

	    return loggingCallback;
	  }

	  for (i = 0, l = callbackNames.length; i < l; i++) {
	    key = callbackNames[i]; // Initialize key collection of logging callback

	    if (objectType(config.callbacks[key]) === "undefined") {
	      config.callbacks[key] = [];
	    }

	    obj[key] = registerLoggingCallback(key);
	  }
	}
	function runLoggingCallbacks(key, args) {
	  var callbacks = config.callbacks[key]; // Handling 'log' callbacks separately. Unlike the other callbacks,
	  // the log callback is not controlled by the processing queue,
	  // but rather used by asserts. Hence to promisfy the 'log' callback
	  // would mean promisfying each step of a test

	  if (key === "log") {
	    callbacks.map(function (callback) {
	      return callback(args);
	    });
	    return;
	  } // ensure that each callback is executed serially


	  return callbacks.reduce(function (promiseChain, callback) {
	    return promiseChain.then(function () {
	      return Promise$1.resolve(callback(args));
	    });
	  }, Promise$1.resolve([]));
	}

	// Doesn't support IE9, it will return undefined on these browsers
	// See also https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error/Stack
	var fileName = (sourceFromStacktrace(0) || "").replace(/(:\d+)+\)?/, "").replace(/.+\//, "");
	function extractStacktrace(e, offset) {
	  offset = offset === undefined ? 4 : offset;
	  var stack, include, i;

	  if (e && e.stack) {
	    stack = e.stack.split("\n");

	    if (/^error$/i.test(stack[0])) {
	      stack.shift();
	    }

	    if (fileName) {
	      include = [];

	      for (i = offset; i < stack.length; i++) {
	        if (stack[i].indexOf(fileName) !== -1) {
	          break;
	        }

	        include.push(stack[i]);
	      }

	      if (include.length) {
	        return include.join("\n");
	      }
	    }

	    return stack[offset];
	  }
	}
	function sourceFromStacktrace(offset) {
	  var error = new Error(); // Support: Safari <=7 only, IE <=10 - 11 only
	  // Not all browsers generate the `stack` property for `new Error()`, see also #636

	  if (!error.stack) {
	    try {
	      throw error;
	    } catch (err) {
	      error = err;
	    }
	  }

	  return extractStacktrace(error, offset);
	}

	var priorityCount = 0;
	var unitSampler; // This is a queue of functions that are tasks within a single test.
	// After tests are dequeued from config.queue they are expanded into
	// a set of tasks in this queue.

	var taskQueue = [];
	/**
	 * Advances the taskQueue to the next task. If the taskQueue is empty,
	 * process the testQueue
	 */

	function advance() {
	  advanceTaskQueue();

	  if (!taskQueue.length && !config.blocking && !config.current) {
	    advanceTestQueue();
	  }
	}
	/**
	 * Advances the taskQueue with an increased depth
	 */


	function advanceTaskQueue() {
	  var start = now();
	  config.depth = (config.depth || 0) + 1;
	  processTaskQueue(start);
	  config.depth--;
	}
	/**
	 * Process the first task on the taskQueue as a promise.
	 * Each task is a function returned by https://github.com/qunitjs/qunit/blob/master/src/test.js#L381
	 */


	function processTaskQueue(start) {
	  if (taskQueue.length && !config.blocking) {
	    var elapsedTime = now() - start;

	    if (!defined.setTimeout || config.updateRate <= 0 || elapsedTime < config.updateRate) {
	      var task = taskQueue.shift();
	      Promise$1.resolve(task()).then(function () {
	        if (!taskQueue.length) {
	          advance();
	        } else {
	          processTaskQueue(start);
	        }
	      });
	    } else {
	      setTimeout$1(advance);
	    }
	  }
	}
	/**
	 * Advance the testQueue to the next test to process. Call done() if testQueue completes.
	 */


	function advanceTestQueue() {
	  if (!config.blocking && !config.queue.length && config.depth === 0) {
	    done();
	    return;
	  }

	  var testTasks = config.queue.shift();
	  addToTaskQueue(testTasks());

	  if (priorityCount > 0) {
	    priorityCount--;
	  }

	  advance();
	}
	/**
	 * Enqueue the tasks for a test into the task queue.
	 * @param {Array} tasksArray
	 */


	function addToTaskQueue(tasksArray) {
	  taskQueue.push.apply(taskQueue, _toConsumableArray(tasksArray));
	}
	/**
	 * Return the number of tasks remaining in the task queue to be processed.
	 * @return {Number}
	 */


	function taskQueueLength() {
	  return taskQueue.length;
	}
	/**
	 * Adds a test to the TestQueue for execution.
	 * @param {Function} testTasksFunc
	 * @param {Boolean} prioritize
	 * @param {String} seed
	 */


	function addToTestQueue(testTasksFunc, prioritize, seed) {
	  if (prioritize) {
	    config.queue.splice(priorityCount++, 0, testTasksFunc);
	  } else if (seed) {
	    if (!unitSampler) {
	      unitSampler = unitSamplerGenerator(seed);
	    } // Insert into a random position after all prioritized items


	    var index = Math.floor(unitSampler() * (config.queue.length - priorityCount + 1));
	    config.queue.splice(priorityCount + index, 0, testTasksFunc);
	  } else {
	    config.queue.push(testTasksFunc);
	  }
	}
	/**
	 * Creates a seeded "sample" generator which is used for randomizing tests.
	 */


	function unitSamplerGenerator(seed) {
	  // 32-bit xorshift, requires only a nonzero seed
	  // https://excamera.com/sphinx/article-xorshift.html
	  var sample = parseInt(generateHash(seed), 16) || -1;
	  return function () {
	    sample ^= sample << 13;
	    sample ^= sample >>> 17;
	    sample ^= sample << 5; // ECMAScript has no unsigned number type

	    if (sample < 0) {
	      sample += 0x100000000;
	    }

	    return sample / 0x100000000;
	  };
	}
	/**
	 * This function is called when the ProcessingQueue is done processing all
	 * items. It handles emitting the final run events.
	 */


	function done() {
	  var storage = config.storage;
	  ProcessingQueue.finished = true;
	  var runtime = now() - config.started;
	  var passed = config.stats.all - config.stats.bad;

	  if (config.stats.testCount === 0) {
	    if (config.filter && config.filter.length) {
	      throw new Error("No tests matched the filter \"".concat(config.filter, "\"."));
	    }

	    if (config.module && config.module.length) {
	      throw new Error("No tests matched the module \"".concat(config.module, "\"."));
	    }

	    if (config.moduleId && config.moduleId.length) {
	      throw new Error("No tests matched the moduleId \"".concat(config.moduleId, "\"."));
	    }

	    if (config.testId && config.testId.length) {
	      throw new Error("No tests matched the testId \"".concat(config.testId, "\"."));
	    }

	    throw new Error("No tests were run.");
	  }

	  emit("runEnd", globalSuite.end(true));
	  runLoggingCallbacks("done", {
	    passed: passed,
	    failed: config.stats.bad,
	    total: config.stats.all,
	    runtime: runtime
	  }).then(function () {
	    // Clear own storage items if all tests passed
	    if (storage && config.stats.bad === 0) {
	      for (var i = storage.length - 1; i >= 0; i--) {
	        var key = storage.key(i);

	        if (key.indexOf("qunit-test-") === 0) {
	          storage.removeItem(key);
	        }
	      }
	    }
	  });
	}

	var ProcessingQueue = {
	  finished: false,
	  add: addToTestQueue,
	  advance: advance,
	  taskCount: taskQueueLength
	};

	var TestReport = /*#__PURE__*/function () {
	  function TestReport(name, suite, options) {
	    _classCallCheck(this, TestReport);

	    this.name = name;
	    this.suiteName = suite.name;
	    this.fullName = suite.fullName.concat(name);
	    this.runtime = 0;
	    this.assertions = [];
	    this.skipped = !!options.skip;
	    this.todo = !!options.todo;
	    this.valid = options.valid;
	    this._startTime = 0;
	    this._endTime = 0;
	    suite.pushTest(this);
	  }

	  _createClass(TestReport, [{
	    key: "start",
	    value: function start(recordTime) {
	      if (recordTime) {
	        this._startTime = performanceNow();

	        if (performance) {
	          performance.mark("qunit_test_start");
	        }
	      }

	      return {
	        name: this.name,
	        suiteName: this.suiteName,
	        fullName: this.fullName.slice()
	      };
	    }
	  }, {
	    key: "end",
	    value: function end(recordTime) {
	      if (recordTime) {
	        this._endTime = performanceNow();

	        if (performance) {
	          performance.mark("qunit_test_end");
	          var testName = this.fullName.join(" – ");
	          measure("QUnit Test: ".concat(testName), "qunit_test_start", "qunit_test_end");
	        }
	      }

	      return extend(this.start(), {
	        runtime: this.getRuntime(),
	        status: this.getStatus(),
	        errors: this.getFailedAssertions(),
	        assertions: this.getAssertions()
	      });
	    }
	  }, {
	    key: "pushAssertion",
	    value: function pushAssertion(assertion) {
	      this.assertions.push(assertion);
	    }
	  }, {
	    key: "getRuntime",
	    value: function getRuntime() {
	      return this._endTime - this._startTime;
	    }
	  }, {
	    key: "getStatus",
	    value: function getStatus() {
	      if (this.skipped) {
	        return "skipped";
	      }

	      var testPassed = this.getFailedAssertions().length > 0 ? this.todo : !this.todo;

	      if (!testPassed) {
	        return "failed";
	      } else if (this.todo) {
	        return "todo";
	      } else {
	        return "passed";
	      }
	    }
	  }, {
	    key: "getFailedAssertions",
	    value: function getFailedAssertions() {
	      return this.assertions.filter(function (assertion) {
	        return !assertion.passed;
	      });
	    }
	  }, {
	    key: "getAssertions",
	    value: function getAssertions() {
	      return this.assertions.slice();
	    } // Remove actual and expected values from assertions. This is to prevent
	    // leaking memory throughout a test suite.

	  }, {
	    key: "slimAssertions",
	    value: function slimAssertions() {
	      this.assertions = this.assertions.map(function (assertion) {
	        delete assertion.actual;
	        delete assertion.expected;
	        return assertion;
	      });
	    }
	  }]);

	  return TestReport;
	}();

	var focused$1 = false;
	function Test(settings) {
	  var i, l;
	  ++Test.count;
	  this.expected = null;
	  this.assertions = [];
	  this.semaphore = 0;
	  this.module = config.currentModule;
	  this.steps = [];
	  this.timeout = undefined;
	  this.errorForStack = new Error(); // If a module is skipped, all its tests and the tests of the child suites
	  // should be treated as skipped even if they are defined as `only` or `todo`.
	  // As for `todo` module, all its tests will be treated as `todo` except for
	  // tests defined as `skip` which will be left intact.
	  //
	  // So, if a test is defined as `todo` and is inside a skipped module, we should
	  // then treat that test as if was defined as `skip`.

	  if (this.module.skip) {
	    settings.skip = true;
	    settings.todo = false; // Skipped tests should be left intact
	  } else if (this.module.todo && !settings.skip) {
	    settings.todo = true;
	  }

	  extend(this, settings);
	  this.testReport = new TestReport(settings.testName, this.module.suiteReport, {
	    todo: settings.todo,
	    skip: settings.skip,
	    valid: this.valid()
	  }); // Register unique strings

	  for (i = 0, l = this.module.tests; i < l.length; i++) {
	    if (this.module.tests[i].name === this.testName) {
	      this.testName += " ";
	    }
	  }

	  this.testId = generateHash(this.module.name, this.testName);
	  this.module.tests.push({
	    name: this.testName,
	    testId: this.testId,
	    skip: !!settings.skip
	  });

	  if (settings.skip) {
	    // Skipped tests will fully ignore any sent callback
	    this.callback = function () {};

	    this.async = false;
	    this.expected = 0;
	  } else {
	    if (typeof this.callback !== "function") {
	      var method = this.todo ? "todo" : "test"; // eslint-disable-next-line max-len

	      throw new TypeError("You must provide a function as a test callback to QUnit.".concat(method, "(\"").concat(settings.testName, "\")"));
	    }

	    this.assert = new Assert(this);
	  }
	}
	Test.count = 0;

	function getNotStartedModules(startModule) {
	  var module = startModule,
	      modules = [];

	  while (module && module.testsRun === 0) {
	    modules.push(module);
	    module = module.parentModule;
	  } // The above push modules from the child to the parent
	  // return a reversed order with the top being the top most parent module


	  return modules.reverse();
	}

	Test.prototype = {
	  // generating a stack trace can be expensive, so using a getter defers this until we need it
	  get stack() {
	    return extractStacktrace(this.errorForStack, 2);
	  },

	  before: function before() {
	    var _this = this;

	    var module = this.module,
	        notStartedModules = getNotStartedModules(module); // ensure the callbacks are executed serially for each module

	    var callbackPromises = notStartedModules.reduce(function (promiseChain, startModule) {
	      return promiseChain.then(function () {
	        startModule.stats = {
	          all: 0,
	          bad: 0,
	          started: now()
	        };
	        emit("suiteStart", startModule.suiteReport.start(true));
	        return runLoggingCallbacks("moduleStart", {
	          name: startModule.name,
	          tests: startModule.tests
	        });
	      });
	    }, Promise$1.resolve([]));
	    return callbackPromises.then(function () {
	      config.current = _this;
	      _this.testEnvironment = extend({}, module.testEnvironment);
	      _this.started = now();
	      emit("testStart", _this.testReport.start(true));
	      return runLoggingCallbacks("testStart", {
	        name: _this.testName,
	        module: module.name,
	        testId: _this.testId,
	        previousFailure: _this.previousFailure
	      }).then(function () {
	        if (!config.pollution) {
	          saveGlobal();
	        }
	      });
	    });
	  },
	  run: function run() {
	    var promise;
	    config.current = this;
	    this.callbackStarted = now();

	    if (config.notrycatch) {
	      runTest(this);
	      return;
	    }

	    try {
	      runTest(this);
	    } catch (e) {
	      this.pushFailure("Died on test #" + (this.assertions.length + 1) + " " + this.stack + ": " + (e.message || e), extractStacktrace(e, 0)); // Else next test will carry the responsibility

	      saveGlobal(); // Restart the tests if they're blocking

	      if (config.blocking) {
	        internalRecover(this);
	      }
	    }

	    function runTest(test) {
	      promise = test.callback.call(test.testEnvironment, test.assert);
	      test.resolvePromise(promise); // If the test has a "lock" on it, but the timeout is 0, then we push a
	      // failure as the test should be synchronous.

	      if (test.timeout === 0 && test.semaphore !== 0) {
	        pushFailure("Test did not finish synchronously even though assert.timeout( 0 ) was used.", sourceFromStacktrace(2));
	      }
	    }
	  },
	  after: function after() {
	    checkPollution();
	  },
	  queueHook: function queueHook(hook, hookName, hookOwner) {
	    var _this2 = this;

	    var callHook = function callHook() {
	      var promise = hook.call(_this2.testEnvironment, _this2.assert);

	      _this2.resolvePromise(promise, hookName);
	    };

	    var runHook = function runHook() {
	      if (hookName === "before") {
	        if (hookOwner.unskippedTestsRun !== 0) {
	          return;
	        }

	        _this2.preserveEnvironment = true;
	      } // The 'after' hook should only execute when there are not tests left and
	      // when the 'after' and 'finish' tasks are the only tasks left to process


	      if (hookName === "after" && hookOwner.unskippedTestsRun !== numberOfUnskippedTests(hookOwner) - 1 && (config.queue.length > 0 || ProcessingQueue.taskCount() > 2)) {
	        return;
	      }

	      config.current = _this2;

	      if (config.notrycatch) {
	        callHook();
	        return;
	      }

	      try {
	        callHook();
	      } catch (error) {
	        _this2.pushFailure(hookName + " failed on " + _this2.testName + ": " + (error.message || error), extractStacktrace(error, 0));
	      }
	    };

	    return runHook;
	  },
	  // Currently only used for module level hooks, can be used to add global level ones
	  hooks: function hooks(handler) {
	    var hooks = [];

	    function processHooks(test, module) {
	      if (module.parentModule) {
	        processHooks(test, module.parentModule);
	      }

	      if (module.hooks[handler].length) {
	        for (var i = 0; i < module.hooks[handler].length; i++) {
	          hooks.push(test.queueHook(module.hooks[handler][i], handler, module));
	        }
	      }
	    } // Hooks are ignored on skipped tests


	    if (!this.skip) {
	      processHooks(this, this.module);
	    }

	    return hooks;
	  },
	  finish: function finish() {
	    config.current = this; // Release the test callback to ensure that anything referenced has been
	    // released to be garbage collected.

	    this.callback = undefined;

	    if (this.steps.length) {
	      var stepsList = this.steps.join(", ");
	      this.pushFailure("Expected assert.verifySteps() to be called before end of test " + "after using assert.step(). Unverified steps: ".concat(stepsList), this.stack);
	    }

	    if (config.requireExpects && this.expected === null) {
	      this.pushFailure("Expected number of assertions to be defined, but expect() was " + "not called.", this.stack);
	    } else if (this.expected !== null && this.expected !== this.assertions.length) {
	      this.pushFailure("Expected " + this.expected + " assertions, but " + this.assertions.length + " were run", this.stack);
	    } else if (this.expected === null && !this.assertions.length) {
	      this.pushFailure("Expected at least one assertion, but none were run - call " + "expect(0) to accept zero assertions.", this.stack);
	    }

	    var i,
	        module = this.module,
	        moduleName = module.name,
	        testName = this.testName,
	        skipped = !!this.skip,
	        todo = !!this.todo,
	        bad = 0,
	        storage = config.storage;
	    this.runtime = now() - this.started;
	    config.stats.all += this.assertions.length;
	    config.stats.testCount += 1;
	    module.stats.all += this.assertions.length;

	    for (i = 0; i < this.assertions.length; i++) {
	      if (!this.assertions[i].result) {
	        bad++;
	        config.stats.bad++;
	        module.stats.bad++;
	      }
	    }

	    notifyTestsRan(module, skipped); // Store result when possible

	    if (storage) {
	      if (bad) {
	        storage.setItem("qunit-test-" + moduleName + "-" + testName, bad);
	      } else {
	        storage.removeItem("qunit-test-" + moduleName + "-" + testName);
	      }
	    } // After emitting the js-reporters event we cleanup the assertion data to
	    // avoid leaking it. It is not used by the legacy testDone callbacks.


	    emit("testEnd", this.testReport.end(true));
	    this.testReport.slimAssertions();
	    var test = this;
	    return runLoggingCallbacks("testDone", {
	      name: testName,
	      module: moduleName,
	      skipped: skipped,
	      todo: todo,
	      failed: bad,
	      passed: this.assertions.length - bad,
	      total: this.assertions.length,
	      runtime: skipped ? 0 : this.runtime,
	      // HTML Reporter use
	      assertions: this.assertions,
	      testId: this.testId,

	      // Source of Test
	      // generating stack trace is expensive, so using a getter will help defer this until we need it
	      get source() {
	        return test.stack;
	      }

	    }).then(function () {
	      if (module.testsRun === numberOfTests(module)) {
	        var completedModules = [module]; // Check if the parent modules, iteratively, are done. If that the case,
	        // we emit the `suiteEnd` event and trigger `moduleDone` callback.

	        var parent = module.parentModule;

	        while (parent && parent.testsRun === numberOfTests(parent)) {
	          completedModules.push(parent);
	          parent = parent.parentModule;
	        }

	        return completedModules.reduce(function (promiseChain, completedModule) {
	          return promiseChain.then(function () {
	            return logSuiteEnd(completedModule);
	          });
	        }, Promise$1.resolve([]));
	      }
	    }).then(function () {
	      config.current = undefined;
	    });

	    function logSuiteEnd(module) {
	      // Reset `module.hooks` to ensure that anything referenced in these hooks
	      // has been released to be garbage collected.
	      module.hooks = {};
	      emit("suiteEnd", module.suiteReport.end(true));
	      return runLoggingCallbacks("moduleDone", {
	        name: module.name,
	        tests: module.tests,
	        failed: module.stats.bad,
	        passed: module.stats.all - module.stats.bad,
	        total: module.stats.all,
	        runtime: now() - module.stats.started
	      });
	    }
	  },
	  preserveTestEnvironment: function preserveTestEnvironment() {
	    if (this.preserveEnvironment) {
	      this.module.testEnvironment = this.testEnvironment;
	      this.testEnvironment = extend({}, this.module.testEnvironment);
	    }
	  },
	  queue: function queue() {
	    var test = this;

	    if (!this.valid()) {
	      return;
	    }

	    function runTest() {
	      return [function () {
	        return test.before();
	      }].concat(_toConsumableArray(test.hooks("before")), [function () {
	        test.preserveTestEnvironment();
	      }], _toConsumableArray(test.hooks("beforeEach")), [function () {
	        test.run();
	      }], _toConsumableArray(test.hooks("afterEach").reverse()), _toConsumableArray(test.hooks("after").reverse()), [function () {
	        test.after();
	      }, function () {
	        return test.finish();
	      }]);
	    }

	    var previousFailCount = config.storage && +config.storage.getItem("qunit-test-" + this.module.name + "-" + this.testName); // Prioritize previously failed tests, detected from storage

	    var prioritize = config.reorder && !!previousFailCount;
	    this.previousFailure = !!previousFailCount;
	    ProcessingQueue.add(runTest, prioritize, config.seed); // If the queue has already finished, we manually process the new test

	    if (ProcessingQueue.finished) {
	      ProcessingQueue.advance();
	    }
	  },
	  pushResult: function pushResult(resultInfo) {
	    if (this !== config.current) {
	      throw new Error("Assertion occurred after test had finished.");
	    } // Destructure of resultInfo = { result, actual, expected, message, negative }


	    var source,
	        details = {
	      module: this.module.name,
	      name: this.testName,
	      result: resultInfo.result,
	      message: resultInfo.message,
	      actual: resultInfo.actual,
	      testId: this.testId,
	      negative: resultInfo.negative || false,
	      runtime: now() - this.started,
	      todo: !!this.todo
	    };

	    if (hasOwn.call(resultInfo, "expected")) {
	      details.expected = resultInfo.expected;
	    }

	    if (!resultInfo.result) {
	      source = resultInfo.source || sourceFromStacktrace();

	      if (source) {
	        details.source = source;
	      }
	    }

	    this.logAssertion(details);
	    this.assertions.push({
	      result: !!resultInfo.result,
	      message: resultInfo.message
	    });
	  },
	  pushFailure: function pushFailure(message, source, actual) {
	    if (!(this instanceof Test)) {
	      throw new Error("pushFailure() assertion outside test context, was " + sourceFromStacktrace(2));
	    }

	    this.pushResult({
	      result: false,
	      message: message || "error",
	      actual: actual || null,
	      source: source
	    });
	  },

	  /**
	   * Log assertion details using both the old QUnit.log interface and
	   * QUnit.on( "assertion" ) interface.
	   *
	   * @private
	   */
	  logAssertion: function logAssertion(details) {
	    runLoggingCallbacks("log", details);
	    var assertion = {
	      passed: details.result,
	      actual: details.actual,
	      expected: details.expected,
	      message: details.message,
	      stack: details.source,
	      todo: details.todo
	    };
	    this.testReport.pushAssertion(assertion);
	    emit("assertion", assertion);
	  },
	  resolvePromise: function resolvePromise(promise, phase) {
	    var then,
	        resume,
	        message,
	        test = this;

	    if (promise != null) {
	      then = promise.then;

	      if (objectType(then) === "function") {
	        resume = internalStop(test);

	        if (config.notrycatch) {
	          then.call(promise, function () {
	            resume();
	          });
	        } else {
	          then.call(promise, function () {
	            resume();
	          }, function (error) {
	            message = "Promise rejected " + (!phase ? "during" : phase.replace(/Each$/, "")) + " \"" + test.testName + "\": " + (error && error.message || error);
	            test.pushFailure(message, extractStacktrace(error, 0)); // Else next test will carry the responsibility

	            saveGlobal(); // Unblock

	            internalRecover(test);
	          });
	        }
	      }
	    }
	  },
	  valid: function valid() {
	    var filter = config.filter,
	        regexFilter = /^(!?)\/([\w\W]*)\/(i?$)/.exec(filter),
	        module = config.module && config.module.toLowerCase(),
	        fullName = this.module.name + ": " + this.testName;

	    function moduleChainNameMatch(testModule) {
	      var testModuleName = testModule.name ? testModule.name.toLowerCase() : null;

	      if (testModuleName === module) {
	        return true;
	      } else if (testModule.parentModule) {
	        return moduleChainNameMatch(testModule.parentModule);
	      } else {
	        return false;
	      }
	    }

	    function moduleChainIdMatch(testModule) {
	      return inArray(testModule.moduleId, config.moduleId) || testModule.parentModule && moduleChainIdMatch(testModule.parentModule);
	    } // Internally-generated tests are always valid


	    if (this.callback && this.callback.validTest) {
	      return true;
	    }

	    if (config.moduleId && config.moduleId.length > 0 && !moduleChainIdMatch(this.module)) {
	      return false;
	    }

	    if (config.testId && config.testId.length > 0 && !inArray(this.testId, config.testId)) {
	      return false;
	    }

	    if (module && !moduleChainNameMatch(this.module)) {
	      return false;
	    }

	    if (!filter) {
	      return true;
	    }

	    return regexFilter ? this.regexFilter(!!regexFilter[1], regexFilter[2], regexFilter[3], fullName) : this.stringFilter(filter, fullName);
	  },
	  regexFilter: function regexFilter(exclude, pattern, flags, fullName) {
	    var regex = new RegExp(pattern, flags);
	    var match = regex.test(fullName);
	    return match !== exclude;
	  },
	  stringFilter: function stringFilter(filter, fullName) {
	    filter = filter.toLowerCase();
	    fullName = fullName.toLowerCase();
	    var include = filter.charAt(0) !== "!";

	    if (!include) {
	      filter = filter.slice(1);
	    } // If the filter matches, we need to honour include


	    if (fullName.indexOf(filter) !== -1) {
	      return include;
	    } // Otherwise, do the opposite


	    return !include;
	  }
	};
	function pushFailure() {
	  if (!config.current) {
	    throw new Error("pushFailure() assertion outside test context, in " + sourceFromStacktrace(2));
	  } // Gets current test obj


	  var currentTest = config.current;
	  return currentTest.pushFailure.apply(currentTest, arguments);
	}

	function saveGlobal() {
	  config.pollution = [];

	  if (config.noglobals) {
	    for (var key in global__default['default']) {
	      if (hasOwn.call(global__default['default'], key)) {
	        // In Opera sometimes DOM element ids show up here, ignore them
	        if (/^qunit-test-output/.test(key)) {
	          continue;
	        }

	        config.pollution.push(key);
	      }
	    }
	  }
	}

	function checkPollution() {
	  var newGlobals,
	      deletedGlobals,
	      old = config.pollution;
	  saveGlobal();
	  newGlobals = diff(config.pollution, old);

	  if (newGlobals.length > 0) {
	    pushFailure("Introduced global variable(s): " + newGlobals.join(", "));
	  }

	  deletedGlobals = diff(old, config.pollution);

	  if (deletedGlobals.length > 0) {
	    pushFailure("Deleted global variable(s): " + deletedGlobals.join(", "));
	  }
	} // Will be exposed as QUnit.test


	function test(testName, callback) {
	  if (focused$1) {
	    return;
	  }

	  var newTest = new Test({
	    testName: testName,
	    callback: callback
	  });
	  newTest.queue();
	}
	function todo(testName, callback) {
	  if (focused$1) {
	    return;
	  }

	  var newTest = new Test({
	    testName: testName,
	    callback: callback,
	    todo: true
	  });
	  newTest.queue();
	} // Will be exposed as QUnit.skip

	function skip(testName) {
	  if (focused$1) {
	    return;
	  }

	  var test = new Test({
	    testName: testName,
	    skip: true
	  });
	  test.queue();
	} // Will be exposed as QUnit.only

	function only(testName, callback) {
	  if (!focused$1) {
	    config.queue.length = 0;
	    focused$1 = true;
	  }

	  var newTest = new Test({
	    testName: testName,
	    callback: callback
	  });
	  newTest.queue();
	} // Resets config.timeout with a new timeout duration.

	function resetTestTimeout(timeoutDuration) {
	  clearTimeout(config.timeout);
	  config.timeout = setTimeout$1(config.timeoutHandler(timeoutDuration), timeoutDuration);
	} // Put a hold on processing and return a function that will release it.

	function internalStop(test) {
	  var released = false;
	  test.semaphore += 1;
	  config.blocking = true; // Set a recovery timeout, if so configured.

	  if (defined.setTimeout) {
	    var timeoutDuration;

	    if (typeof test.timeout === "number") {
	      timeoutDuration = test.timeout;
	    } else if (typeof config.testTimeout === "number") {
	      timeoutDuration = config.testTimeout;
	    }

	    if (typeof timeoutDuration === "number" && timeoutDuration > 0) {
	      clearTimeout(config.timeout);

	      config.timeoutHandler = function (timeout) {
	        return function () {
	          pushFailure("Test took longer than ".concat(timeout, "ms; test timed out."), sourceFromStacktrace(2));
	          released = true;
	          internalRecover(test);
	        };
	      };

	      config.timeout = setTimeout$1(config.timeoutHandler(timeoutDuration), timeoutDuration);
	    }
	  }

	  return function resume() {
	    if (released) {
	      return;
	    }

	    released = true;
	    test.semaphore -= 1;
	    internalStart(test);
	  };
	} // Forcefully release all processing holds.

	function internalRecover(test) {
	  test.semaphore = 0;
	  internalStart(test);
	} // Release a processing hold, scheduling a resumption attempt if no holds remain.


	function internalStart(test) {
	  // If semaphore is non-numeric, throw error
	  if (isNaN(test.semaphore)) {
	    test.semaphore = 0;
	    pushFailure("Invalid value on test.semaphore", sourceFromStacktrace(2));
	    return;
	  } // Don't start until equal number of stop-calls


	  if (test.semaphore > 0) {
	    return;
	  } // Throw an Error if start is called more often than stop


	  if (test.semaphore < 0) {
	    test.semaphore = 0;
	    pushFailure("Tried to restart test while already started (test's semaphore was 0 already)", sourceFromStacktrace(2));
	    return;
	  } // Add a slight delay to allow more assertions etc.


	  if (defined.setTimeout) {
	    if (config.timeout) {
	      clearTimeout(config.timeout);
	    }

	    config.timeout = setTimeout$1(function () {
	      if (test.semaphore > 0) {
	        return;
	      }

	      if (config.timeout) {
	        clearTimeout(config.timeout);
	      }

	      begin();
	    });
	  } else {
	    begin();
	  }
	}

	function collectTests(module) {
	  var tests = [].concat(module.tests);

	  var modules = _toConsumableArray(module.childModules); // Do a breadth-first traversal of the child modules


	  while (modules.length) {
	    var nextModule = modules.shift();
	    tests.push.apply(tests, nextModule.tests);
	    modules.push.apply(modules, _toConsumableArray(nextModule.childModules));
	  }

	  return tests;
	}

	function numberOfTests(module) {
	  return collectTests(module).length;
	}

	function numberOfUnskippedTests(module) {
	  return collectTests(module).filter(function (test) {
	    return !test.skip;
	  }).length;
	}

	function notifyTestsRan(module, skipped) {
	  module.testsRun++;

	  if (!skipped) {
	    module.unskippedTestsRun++;
	  }

	  while (module = module.parentModule) {
	    module.testsRun++;

	    if (!skipped) {
	      module.unskippedTestsRun++;
	    }
	  }
	}

	var Assert = /*#__PURE__*/function () {
	  function Assert(testContext) {
	    _classCallCheck(this, Assert);

	    this.test = testContext;
	  } // Assert helpers


	  _createClass(Assert, [{
	    key: "timeout",
	    value: function timeout(duration) {
	      if (typeof duration !== "number") {
	        throw new Error("You must pass a number as the duration to assert.timeout");
	      }

	      this.test.timeout = duration; // If a timeout has been set, clear it and reset with the new duration

	      if (config.timeout) {
	        clearTimeout(config.timeout);

	        if (config.timeoutHandler && this.test.timeout > 0) {
	          resetTestTimeout(this.test.timeout);
	        }
	      }
	    } // Documents a "step", which is a string value, in a test as a passing assertion

	  }, {
	    key: "step",
	    value: function step(message) {
	      var assertionMessage = message;
	      var result = !!message;
	      this.test.steps.push(message);

	      if (objectType(message) === "undefined" || message === "") {
	        assertionMessage = "You must provide a message to assert.step";
	      } else if (objectType(message) !== "string") {
	        assertionMessage = "You must provide a string value to assert.step";
	        result = false;
	      }

	      this.pushResult({
	        result: result,
	        message: assertionMessage
	      });
	    } // Verifies the steps in a test match a given array of string values

	  }, {
	    key: "verifySteps",
	    value: function verifySteps(steps, message) {
	      // Since the steps array is just string values, we can clone with slice
	      var actualStepsClone = this.test.steps.slice();
	      this.deepEqual(actualStepsClone, steps, message);
	      this.test.steps.length = 0;
	    } // Specify the number of expected assertions to guarantee that failed test
	    // (no assertions are run at all) don't slip through.

	  }, {
	    key: "expect",
	    value: function expect(asserts) {
	      if (arguments.length === 1) {
	        this.test.expected = asserts;
	      } else {
	        return this.test.expected;
	      }
	    } // Put a hold on processing and return a function that will release it a maximum of once.

	  }, {
	    key: "async",
	    value: function async(count) {
	      var test = this.test;
	      var popped = false,
	          acceptCallCount = count;

	      if (typeof acceptCallCount === "undefined") {
	        acceptCallCount = 1;
	      }

	      var resume = internalStop(test);
	      return function done() {
	        if (config.current !== test) {
	          throw Error("assert.async callback called after test finished.");
	        }

	        if (popped) {
	          test.pushFailure("Too many calls to the `assert.async` callback", sourceFromStacktrace(2));
	          return;
	        }

	        acceptCallCount -= 1;

	        if (acceptCallCount > 0) {
	          return;
	        }

	        popped = true;
	        resume();
	      };
	    } // Exports test.push() to the user API
	    // Alias of pushResult.

	  }, {
	    key: "push",
	    value: function push(result, actual, expected, message, negative) {
	      Logger.warn("assert.push is deprecated and will be removed in QUnit 3.0." + " Please use assert.pushResult instead (https://api.qunitjs.com/assert/pushResult).");
	      var currentAssert = this instanceof Assert ? this : config.current.assert;
	      return currentAssert.pushResult({
	        result: result,
	        actual: actual,
	        expected: expected,
	        message: message,
	        negative: negative
	      });
	    }
	  }, {
	    key: "pushResult",
	    value: function pushResult(resultInfo) {
	      // Destructure of resultInfo = { result, actual, expected, message, negative }
	      var assert = this;
	      var currentTest = assert instanceof Assert && assert.test || config.current; // Backwards compatibility fix.
	      // Allows the direct use of global exported assertions and QUnit.assert.*
	      // Although, it's use is not recommended as it can leak assertions
	      // to other tests from async tests, because we only get a reference to the current test,
	      // not exactly the test where assertion were intended to be called.

	      if (!currentTest) {
	        throw new Error("assertion outside test context, in " + sourceFromStacktrace(2));
	      }

	      if (!(assert instanceof Assert)) {
	        assert = currentTest.assert;
	      }

	      return assert.test.pushResult(resultInfo);
	    }
	  }, {
	    key: "ok",
	    value: function ok(result, message) {
	      if (!message) {
	        message = result ? "okay" : "failed, expected argument to be truthy, was: ".concat(dump.parse(result));
	      }

	      this.pushResult({
	        result: !!result,
	        actual: result,
	        expected: true,
	        message: message
	      });
	    }
	  }, {
	    key: "notOk",
	    value: function notOk(result, message) {
	      if (!message) {
	        message = !result ? "okay" : "failed, expected argument to be falsy, was: ".concat(dump.parse(result));
	      }

	      this.pushResult({
	        result: !result,
	        actual: result,
	        expected: false,
	        message: message
	      });
	    }
	  }, {
	    key: "true",
	    value: function _true(result, message) {
	      this.pushResult({
	        result: result === true,
	        actual: result,
	        expected: true,
	        message: message
	      });
	    }
	  }, {
	    key: "false",
	    value: function _false(result, message) {
	      this.pushResult({
	        result: result === false,
	        actual: result,
	        expected: false,
	        message: message
	      });
	    }
	  }, {
	    key: "equal",
	    value: function equal(actual, expected, message) {
	      // eslint-disable-next-line eqeqeq
	      var result = expected == actual;
	      this.pushResult({
	        result: result,
	        actual: actual,
	        expected: expected,
	        message: message
	      });
	    }
	  }, {
	    key: "notEqual",
	    value: function notEqual(actual, expected, message) {
	      // eslint-disable-next-line eqeqeq
	      var result = expected != actual;
	      this.pushResult({
	        result: result,
	        actual: actual,
	        expected: expected,
	        message: message,
	        negative: true
	      });
	    }
	  }, {
	    key: "propEqual",
	    value: function propEqual(actual, expected, message) {
	      actual = objectValues(actual);
	      expected = objectValues(expected);
	      this.pushResult({
	        result: equiv(actual, expected),
	        actual: actual,
	        expected: expected,
	        message: message
	      });
	    }
	  }, {
	    key: "notPropEqual",
	    value: function notPropEqual(actual, expected, message) {
	      actual = objectValues(actual);
	      expected = objectValues(expected);
	      this.pushResult({
	        result: !equiv(actual, expected),
	        actual: actual,
	        expected: expected,
	        message: message,
	        negative: true
	      });
	    }
	  }, {
	    key: "deepEqual",
	    value: function deepEqual(actual, expected, message) {
	      this.pushResult({
	        result: equiv(actual, expected),
	        actual: actual,
	        expected: expected,
	        message: message
	      });
	    }
	  }, {
	    key: "notDeepEqual",
	    value: function notDeepEqual(actual, expected, message) {
	      this.pushResult({
	        result: !equiv(actual, expected),
	        actual: actual,
	        expected: expected,
	        message: message,
	        negative: true
	      });
	    }
	  }, {
	    key: "strictEqual",
	    value: function strictEqual(actual, expected, message) {
	      this.pushResult({
	        result: expected === actual,
	        actual: actual,
	        expected: expected,
	        message: message
	      });
	    }
	  }, {
	    key: "notStrictEqual",
	    value: function notStrictEqual(actual, expected, message) {
	      this.pushResult({
	        result: expected !== actual,
	        actual: actual,
	        expected: expected,
	        message: message,
	        negative: true
	      });
	    }
	  }, {
	    key: "throws",
	    value: function throws(block, expected, message) {
	      var actual,
	          result = false;
	      var currentTest = this instanceof Assert && this.test || config.current; // 'expected' is optional unless doing string comparison

	      if (objectType(expected) === "string") {
	        if (message == null) {
	          message = expected;
	          expected = null;
	        } else {
	          throw new Error("throws/raises does not accept a string value for the expected argument.\n" + "Use a non-string object value (e.g. regExp) instead if it's necessary.");
	        }
	      }

	      currentTest.ignoreGlobalErrors = true;

	      try {
	        block.call(currentTest.testEnvironment);
	      } catch (e) {
	        actual = e;
	      }

	      currentTest.ignoreGlobalErrors = false;

	      if (actual) {
	        var expectedType = objectType(expected); // We don't want to validate thrown error

	        if (!expected) {
	          result = true; // Expected is a regexp
	        } else if (expectedType === "regexp") {
	          result = expected.test(errorString(actual)); // Log the string form of the regexp

	          expected = String(expected); // Expected is a constructor, maybe an Error constructor
	        } else if (expectedType === "function" && actual instanceof expected) {
	          result = true; // Expected is an Error object
	        } else if (expectedType === "object") {
	          result = actual instanceof expected.constructor && actual.name === expected.name && actual.message === expected.message; // Log the string form of the Error object

	          expected = errorString(expected); // Expected is a validation function which returns true if validation passed
	        } else if (expectedType === "function" && expected.call({}, actual) === true) {
	          expected = null;
	          result = true;
	        }
	      }

	      currentTest.assert.pushResult({
	        result: result,
	        // undefined if it didn't throw
	        actual: actual && errorString(actual),
	        expected: expected,
	        message: message
	      });
	    }
	  }, {
	    key: "rejects",
	    value: function rejects(promise, expected, message) {
	      var result = false;
	      var currentTest = this instanceof Assert && this.test || config.current; // 'expected' is optional unless doing string comparison

	      if (objectType(expected) === "string") {
	        if (message === undefined) {
	          message = expected;
	          expected = undefined;
	        } else {
	          message = "assert.rejects does not accept a string value for the expected " + "argument.\nUse a non-string object value (e.g. validator function) instead " + "if necessary.";
	          currentTest.assert.pushResult({
	            result: false,
	            message: message
	          });
	          return;
	        }
	      }

	      var then = promise && promise.then;

	      if (objectType(then) !== "function") {
	        var _message = "The value provided to `assert.rejects` in " + "\"" + currentTest.testName + "\" was not a promise.";

	        currentTest.assert.pushResult({
	          result: false,
	          message: _message,
	          actual: promise
	        });
	        return;
	      }

	      var done = this.async();
	      return then.call(promise, function handleFulfillment() {
	        var message = "The promise returned by the `assert.rejects` callback in " + "\"" + currentTest.testName + "\" did not reject.";
	        currentTest.assert.pushResult({
	          result: false,
	          message: message,
	          actual: promise
	        });
	        done();
	      }, function handleRejection(actual) {
	        var expectedType = objectType(expected); // We don't want to validate

	        if (expected === undefined) {
	          result = true; // Expected is a regexp
	        } else if (expectedType === "regexp") {
	          result = expected.test(errorString(actual)); // Log the string form of the regexp

	          expected = String(expected); // Expected is a constructor, maybe an Error constructor
	        } else if (expectedType === "function" && actual instanceof expected) {
	          result = true; // Expected is an Error object
	        } else if (expectedType === "object") {
	          result = actual instanceof expected.constructor && actual.name === expected.name && actual.message === expected.message; // Log the string form of the Error object

	          expected = errorString(expected); // Expected is a validation function which returns true if validation passed
	        } else {
	          if (expectedType === "function") {
	            result = expected.call({}, actual) === true;
	            expected = null; // Expected is some other invalid type
	          } else {
	            result = false;
	            message = "invalid expected value provided to `assert.rejects` " + "callback in \"" + currentTest.testName + "\": " + expectedType + ".";
	          }
	        }

	        currentTest.assert.pushResult({
	          result: result,
	          // leave rejection value of undefined as-is
	          actual: actual && errorString(actual),
	          expected: expected,
	          message: message
	        });
	        done();
	      });
	    }
	  }]);

	  return Assert;
	}(); // Provide an alternative to assert.throws(), for environments that consider throws a reserved word
	// Known to us are: Closure Compiler, Narwhal
	// eslint-disable-next-line dot-notation


	Assert.prototype.raises = Assert.prototype["throws"];
	/**
	 * Converts an error into a simple string for comparisons.
	 *
	 * @param {Error|Object} error
	 * @return {String}
	 */

	function errorString(error) {
	  var resultErrorString = error.toString(); // If the error wasn't a subclass of Error but something like
	  // an object literal with name and message properties...

	  if (resultErrorString.substring(0, 7) === "[object") {
	    var name = error.name ? error.name.toString() : "Error";
	    var message = error.message ? error.message.toString() : "";

	    if (name && message) {
	      return "".concat(name, ": ").concat(message);
	    } else if (name) {
	      return name;
	    } else if (message) {
	      return message;
	    } else {
	      return "Error";
	    }
	  } else {
	    return resultErrorString;
	  }
	}

	/* global module, exports, define */
	function exportQUnit(QUnit) {
	  if (defined.document) {
	    // QUnit may be defined when it is preconfigured but then only QUnit and QUnit.config may be defined.
	    if (window$1.QUnit && window$1.QUnit.version) {
	      throw new Error("QUnit has already been defined.");
	    }

	    window$1.QUnit = QUnit;
	  } // For nodejs


	  if (typeof module !== "undefined" && module && module.exports) {
	    module.exports = QUnit; // For consistency with CommonJS environments' exports

	    module.exports.QUnit = QUnit;
	  } // For CommonJS with exports, but without module.exports, like Rhino


	  if (typeof exports !== "undefined" && exports) {
	    exports.QUnit = QUnit;
	  }

	  if (typeof define === "function" && define.amd) {
	    define(function () {
	      return QUnit;
	    });
	    QUnit.config.autostart = false;
	  } // For Web/Service Workers


	  if (self$1 && self$1.WorkerGlobalScope && self$1 instanceof self$1.WorkerGlobalScope) {
	    self$1.QUnit = QUnit;
	  }
	}

	// error handling should be suppressed and false otherwise.
	// In this case, we will only suppress further error handling if the
	// "ignoreGlobalErrors" configuration option is enabled.

	function onError(error) {
	  for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
	    args[_key - 1] = arguments[_key];
	  }

	  if (config.current) {
	    if (config.current.ignoreGlobalErrors) {
	      return true;
	    }

	    pushFailure.apply(void 0, [error.message, error.stacktrace || error.fileName + ":" + error.lineNumber].concat(args));
	  } else {
	    test("global failure", extend(function () {
	      pushFailure.apply(void 0, [error.message, error.stacktrace || error.fileName + ":" + error.lineNumber].concat(args));
	    }, {
	      validTest: true
	    }));
	  }

	  return false;
	}

	function onUnhandledRejection(reason) {
	  var resultInfo = {
	    result: false,
	    message: reason.message || "error",
	    actual: reason,
	    source: reason.stack || sourceFromStacktrace(3)
	  };
	  var currentTest = config.current;

	  if (currentTest) {
	    currentTest.assert.pushResult(resultInfo);
	  } else {
	    test("global failure", extend(function (assert) {
	      assert.pushResult(resultInfo);
	    }, {
	      validTest: true
	    }));
	  }
	}

	var QUnit = {};
	var globalSuite = new SuiteReport(); // The initial "currentModule" represents the global (or top-level) module that
	// is not explicitly defined by the user, therefore we add the "globalSuite" to
	// it since each module has a suiteReport associated with it.

	config.currentModule.suiteReport = globalSuite;
	var globalStartCalled = false;
	var runStarted = false; // Figure out if we're running the tests from a server or not

	QUnit.isLocal = !(defined.document && window$1.location.protocol !== "file:"); // Expose the current QUnit version

	QUnit.version = "2.11.3";
	extend(QUnit, {
	  on: on,
	  module: module$1,
	  test: test,
	  todo: todo,
	  skip: skip,
	  only: only,
	  start: function start(count) {
	    var globalStartAlreadyCalled = globalStartCalled;

	    if (!config.current) {
	      globalStartCalled = true;

	      if (runStarted) {
	        throw new Error("Called start() while test already started running");
	      } else if (globalStartAlreadyCalled || count > 1) {
	        throw new Error("Called start() outside of a test context too many times");
	      } else if (config.autostart) {
	        throw new Error("Called start() outside of a test context when " + "QUnit.config.autostart was true");
	      } else if (!config.pageLoaded) {
	        // The page isn't completely loaded yet, so we set autostart and then
	        // load if we're in Node or wait for the browser's load event.
	        config.autostart = true; // Starts from Node even if .load was not previously called. We still return
	        // early otherwise we'll wind up "beginning" twice.

	        if (!defined.document) {
	          QUnit.load();
	        }

	        return;
	      }
	    } else {
	      throw new Error("QUnit.start cannot be called inside a test context.");
	    }

	    scheduleBegin();
	  },
	  config: config,
	  is: is,
	  objectType: objectType,
	  extend: extend,
	  load: function load() {
	    config.pageLoaded = true; // Initialize the configuration options

	    extend(config, {
	      stats: {
	        all: 0,
	        bad: 0,
	        testCount: 0
	      },
	      started: 0,
	      updateRate: 1000,
	      autostart: true,
	      filter: ""
	    }, true);

	    if (!runStarted) {
	      config.blocking = false;

	      if (config.autostart) {
	        scheduleBegin();
	      }
	    }
	  },
	  stack: function stack(offset) {
	    offset = (offset || 0) + 2;
	    return sourceFromStacktrace(offset);
	  },
	  onError: onError,
	  onUnhandledRejection: onUnhandledRejection
	});
	QUnit.pushFailure = pushFailure;
	QUnit.assert = Assert.prototype;
	QUnit.equiv = equiv;
	QUnit.dump = dump;
	registerLoggingCallbacks(QUnit);

	function scheduleBegin() {
	  runStarted = true; // Add a slight delay to allow definition of more modules and tests.

	  if (defined.setTimeout) {
	    setTimeout$1(function () {
	      begin();
	    });
	  } else {
	    begin();
	  }
	}

	function unblockAndAdvanceQueue() {
	  config.blocking = false;
	  ProcessingQueue.advance();
	}

	function begin() {
	  var i,
	      l,
	      modulesLog = []; // If the test run hasn't officially begun yet

	  if (!config.started) {
	    // Record the time of the test run's beginning
	    config.started = now(); // Delete the loose unnamed module if unused.

	    if (config.modules[0].name === "" && config.modules[0].tests.length === 0) {
	      config.modules.shift();
	    } // Avoid unnecessary information by not logging modules' test environments


	    for (i = 0, l = config.modules.length; i < l; i++) {
	      modulesLog.push({
	        name: config.modules[i].name,
	        tests: config.modules[i].tests
	      });
	    } // The test run is officially beginning now


	    emit("runStart", globalSuite.start(true));
	    runLoggingCallbacks("begin", {
	      totalTests: Test.count,
	      modules: modulesLog
	    }).then(unblockAndAdvanceQueue);
	  } else {
	    unblockAndAdvanceQueue();
	  }
	}
	exportQUnit(QUnit);

	(function () {
	  if (typeof window$1 === "undefined" || typeof document$1 === "undefined") {
	    return;
	  }

	  var config = QUnit.config,
	      hasOwn = Object.prototype.hasOwnProperty; // Stores fixture HTML for resetting later

	  function storeFixture() {
	    // Avoid overwriting user-defined values
	    if (hasOwn.call(config, "fixture")) {
	      return;
	    }

	    var fixture = document$1.getElementById("qunit-fixture");

	    if (fixture) {
	      config.fixture = fixture.cloneNode(true);
	    }
	  }

	  QUnit.begin(storeFixture); // Resets the fixture DOM element if available.

	  function resetFixture() {
	    if (config.fixture == null) {
	      return;
	    }

	    var fixture = document$1.getElementById("qunit-fixture");

	    var resetFixtureType = _typeof(config.fixture);

	    if (resetFixtureType === "string") {
	      // support user defined values for `config.fixture`
	      var newFixture = document$1.createElement("div");
	      newFixture.setAttribute("id", "qunit-fixture");
	      newFixture.innerHTML = config.fixture;
	      fixture.parentNode.replaceChild(newFixture, fixture);
	    } else {
	      var clonedFixture = config.fixture.cloneNode(true);
	      fixture.parentNode.replaceChild(clonedFixture, fixture);
	    }
	  }

	  QUnit.testStart(resetFixture);
	})();

	(function () {
	  // Only interact with URLs via window.location
	  var location = typeof window$1 !== "undefined" && window$1.location;

	  if (!location) {
	    return;
	  }

	  var urlParams = getUrlParams();
	  QUnit.urlParams = urlParams; // Match module/test by inclusion in an array

	  QUnit.config.moduleId = [].concat(urlParams.moduleId || []);
	  QUnit.config.testId = [].concat(urlParams.testId || []); // Exact case-insensitive match of the module name

	  QUnit.config.module = urlParams.module; // Regular expression or case-insenstive substring match against "moduleName: testName"

	  QUnit.config.filter = urlParams.filter; // Test order randomization

	  if (urlParams.seed === true) {
	    // Generate a random seed if the option is specified without a value
	    QUnit.config.seed = Math.random().toString(36).slice(2);
	  } else if (urlParams.seed) {
	    QUnit.config.seed = urlParams.seed;
	  } // Add URL-parameter-mapped config values with UI form rendering data


	  QUnit.config.urlConfig.push({
	    id: "hidepassed",
	    label: "Hide passed tests",
	    tooltip: "Only show tests and assertions that fail. Stored as query-strings."
	  }, {
	    id: "noglobals",
	    label: "Check for Globals",
	    tooltip: "Enabling this will test if any test introduces new properties on the " + "global object (`window` in Browsers). Stored as query-strings."
	  }, {
	    id: "notrycatch",
	    label: "No try-catch",
	    tooltip: "Enabling this will run tests outside of a try-catch block. Makes debugging " + "exceptions in IE reasonable. Stored as query-strings."
	  });
	  QUnit.begin(function () {
	    var i,
	        option,
	        urlConfig = QUnit.config.urlConfig;

	    for (i = 0; i < urlConfig.length; i++) {
	      // Options can be either strings or objects with nonempty "id" properties
	      option = QUnit.config.urlConfig[i];

	      if (typeof option !== "string") {
	        option = option.id;
	      }

	      if (QUnit.config[option] === undefined) {
	        QUnit.config[option] = urlParams[option];
	      }
	    }
	  });

	  function getUrlParams() {
	    var i, param, name, value;
	    var urlParams = Object.create(null);
	    var params = location.search.slice(1).split("&");
	    var length = params.length;

	    for (i = 0; i < length; i++) {
	      if (params[i]) {
	        param = params[i].split("=");
	        name = decodeQueryParam(param[0]); // Allow just a key to turn on a flag, e.g., test.html?noglobals

	        value = param.length === 1 || decodeQueryParam(param.slice(1).join("="));

	        if (name in urlParams) {
	          urlParams[name] = [].concat(urlParams[name], value);
	        } else {
	          urlParams[name] = value;
	        }
	      }
	    }

	    return urlParams;
	  }

	  function decodeQueryParam(param) {
	    return decodeURIComponent(param.replace(/\+/g, "%20"));
	  }
	})();

	var fuzzysort = createCommonjsModule(function (module) {

	  (function (root, UMD) {
	    if ( module.exports) module.exports = UMD();else root.fuzzysort = UMD();
	  })(commonjsGlobal, function UMD() {
	    function fuzzysortNew(instanceOptions) {
	      var fuzzysort = {
	        single: function (search, target, options) {
	          if (!search) return null;
	          if (!isObj(search)) search = fuzzysort.getPreparedSearch(search);
	          if (!target) return null;
	          if (!isObj(target)) target = fuzzysort.getPrepared(target);
	          var allowTypo = options && options.allowTypo !== undefined ? options.allowTypo : instanceOptions && instanceOptions.allowTypo !== undefined ? instanceOptions.allowTypo : true;
	          var algorithm = allowTypo ? fuzzysort.algorithm : fuzzysort.algorithmNoTypo;
	          return algorithm(search, target, search[0]); // var threshold = options && options.threshold || instanceOptions && instanceOptions.threshold || -9007199254740991
	          // var result = algorithm(search, target, search[0])
	          // if(result === null) return null
	          // if(result.score < threshold) return null
	          // return result
	        },
	        go: function (search, targets, options) {
	          if (!search) return noResults;
	          search = fuzzysort.prepareSearch(search);
	          var searchLowerCode = search[0];
	          var threshold = options && options.threshold || instanceOptions && instanceOptions.threshold || -9007199254740991;
	          var limit = options && options.limit || instanceOptions && instanceOptions.limit || 9007199254740991;
	          var allowTypo = options && options.allowTypo !== undefined ? options.allowTypo : instanceOptions && instanceOptions.allowTypo !== undefined ? instanceOptions.allowTypo : true;
	          var algorithm = allowTypo ? fuzzysort.algorithm : fuzzysort.algorithmNoTypo;
	          var resultsLen = 0;
	          var limitedCount = 0;
	          var targetsLen = targets.length; // This code is copy/pasted 3 times for performance reasons [options.keys, options.key, no keys]
	          // options.keys

	          if (options && options.keys) {
	            var scoreFn = options.scoreFn || defaultScoreFn;
	            var keys = options.keys;
	            var keysLen = keys.length;

	            for (var i = targetsLen - 1; i >= 0; --i) {
	              var obj = targets[i];
	              var objResults = new Array(keysLen);

	              for (var keyI = keysLen - 1; keyI >= 0; --keyI) {
	                var key = keys[keyI];
	                var target = getValue(obj, key);

	                if (!target) {
	                  objResults[keyI] = null;
	                  continue;
	                }

	                if (!isObj(target)) target = fuzzysort.getPrepared(target);
	                objResults[keyI] = algorithm(search, target, searchLowerCode);
	              }

	              objResults.obj = obj; // before scoreFn so scoreFn can use it

	              var score = scoreFn(objResults);
	              if (score === null) continue;
	              if (score < threshold) continue;
	              objResults.score = score;

	              if (resultsLen < limit) {
	                q.add(objResults);
	                ++resultsLen;
	              } else {
	                ++limitedCount;
	                if (score > q.peek().score) q.replaceTop(objResults);
	              }
	            } // options.key

	          } else if (options && options.key) {
	            var key = options.key;

	            for (var i = targetsLen - 1; i >= 0; --i) {
	              var obj = targets[i];
	              var target = getValue(obj, key);
	              if (!target) continue;
	              if (!isObj(target)) target = fuzzysort.getPrepared(target);
	              var result = algorithm(search, target, searchLowerCode);
	              if (result === null) continue;
	              if (result.score < threshold) continue; // have to clone result so duplicate targets from different obj can each reference the correct obj

	              result = {
	                target: result.target,
	                _targetLowerCodes: null,
	                _nextBeginningIndexes: null,
	                score: result.score,
	                indexes: result.indexes,
	                obj: obj
	              }; // hidden

	              if (resultsLen < limit) {
	                q.add(result);
	                ++resultsLen;
	              } else {
	                ++limitedCount;
	                if (result.score > q.peek().score) q.replaceTop(result);
	              }
	            } // no keys

	          } else {
	            for (var i = targetsLen - 1; i >= 0; --i) {
	              var target = targets[i];
	              if (!target) continue;
	              if (!isObj(target)) target = fuzzysort.getPrepared(target);
	              var result = algorithm(search, target, searchLowerCode);
	              if (result === null) continue;
	              if (result.score < threshold) continue;

	              if (resultsLen < limit) {
	                q.add(result);
	                ++resultsLen;
	              } else {
	                ++limitedCount;
	                if (result.score > q.peek().score) q.replaceTop(result);
	              }
	            }
	          }

	          if (resultsLen === 0) return noResults;
	          var results = new Array(resultsLen);

	          for (var i = resultsLen - 1; i >= 0; --i) results[i] = q.poll();

	          results.total = resultsLen + limitedCount;
	          return results;
	        },
	        goAsync: function (search, targets, options) {
	          var canceled = false;
	          var p = new Promise(function (resolve, reject) {
	            if (!search) return resolve(noResults);
	            search = fuzzysort.prepareSearch(search);
	            var searchLowerCode = search[0];
	            var q = fastpriorityqueue();
	            var iCurrent = targets.length - 1;
	            var threshold = options && options.threshold || instanceOptions && instanceOptions.threshold || -9007199254740991;
	            var limit = options && options.limit || instanceOptions && instanceOptions.limit || 9007199254740991;
	            var allowTypo = options && options.allowTypo !== undefined ? options.allowTypo : instanceOptions && instanceOptions.allowTypo !== undefined ? instanceOptions.allowTypo : true;
	            var algorithm = allowTypo ? fuzzysort.algorithm : fuzzysort.algorithmNoTypo;
	            var resultsLen = 0;
	            var limitedCount = 0;

	            function step() {
	              if (canceled) return reject('canceled');
	              var startMs = Date.now(); // This code is copy/pasted 3 times for performance reasons [options.keys, options.key, no keys]
	              // options.keys

	              if (options && options.keys) {
	                var scoreFn = options.scoreFn || defaultScoreFn;
	                var keys = options.keys;
	                var keysLen = keys.length;

	                for (; iCurrent >= 0; --iCurrent) {
	                  var obj = targets[iCurrent];
	                  var objResults = new Array(keysLen);

	                  for (var keyI = keysLen - 1; keyI >= 0; --keyI) {
	                    var key = keys[keyI];
	                    var target = getValue(obj, key);

	                    if (!target) {
	                      objResults[keyI] = null;
	                      continue;
	                    }

	                    if (!isObj(target)) target = fuzzysort.getPrepared(target);
	                    objResults[keyI] = algorithm(search, target, searchLowerCode);
	                  }

	                  objResults.obj = obj; // before scoreFn so scoreFn can use it

	                  var score = scoreFn(objResults);
	                  if (score === null) continue;
	                  if (score < threshold) continue;
	                  objResults.score = score;

	                  if (resultsLen < limit) {
	                    q.add(objResults);
	                    ++resultsLen;
	                  } else {
	                    ++limitedCount;
	                    if (score > q.peek().score) q.replaceTop(objResults);
	                  }

	                  if (iCurrent % 1000
	                  /*itemsPerCheck*/
	                  === 0) {
	                    if (Date.now() - startMs >= 10
	                    /*asyncInterval*/
	                    ) {
	                        isNode ? setImmediate(step) : setTimeout(step);
	                        return;
	                      }
	                  }
	                } // options.key

	              } else if (options && options.key) {
	                var key = options.key;

	                for (; iCurrent >= 0; --iCurrent) {
	                  var obj = targets[iCurrent];
	                  var target = getValue(obj, key);
	                  if (!target) continue;
	                  if (!isObj(target)) target = fuzzysort.getPrepared(target);
	                  var result = algorithm(search, target, searchLowerCode);
	                  if (result === null) continue;
	                  if (result.score < threshold) continue; // have to clone result so duplicate targets from different obj can each reference the correct obj

	                  result = {
	                    target: result.target,
	                    _targetLowerCodes: null,
	                    _nextBeginningIndexes: null,
	                    score: result.score,
	                    indexes: result.indexes,
	                    obj: obj
	                  }; // hidden

	                  if (resultsLen < limit) {
	                    q.add(result);
	                    ++resultsLen;
	                  } else {
	                    ++limitedCount;
	                    if (result.score > q.peek().score) q.replaceTop(result);
	                  }

	                  if (iCurrent % 1000
	                  /*itemsPerCheck*/
	                  === 0) {
	                    if (Date.now() - startMs >= 10
	                    /*asyncInterval*/
	                    ) {
	                        isNode ? setImmediate(step) : setTimeout(step);
	                        return;
	                      }
	                  }
	                } // no keys

	              } else {
	                for (; iCurrent >= 0; --iCurrent) {
	                  var target = targets[iCurrent];
	                  if (!target) continue;
	                  if (!isObj(target)) target = fuzzysort.getPrepared(target);
	                  var result = algorithm(search, target, searchLowerCode);
	                  if (result === null) continue;
	                  if (result.score < threshold) continue;

	                  if (resultsLen < limit) {
	                    q.add(result);
	                    ++resultsLen;
	                  } else {
	                    ++limitedCount;
	                    if (result.score > q.peek().score) q.replaceTop(result);
	                  }

	                  if (iCurrent % 1000
	                  /*itemsPerCheck*/
	                  === 0) {
	                    if (Date.now() - startMs >= 10
	                    /*asyncInterval*/
	                    ) {
	                        isNode ? setImmediate(step) : setTimeout(step);
	                        return;
	                      }
	                  }
	                }
	              }

	              if (resultsLen === 0) return resolve(noResults);
	              var results = new Array(resultsLen);

	              for (var i = resultsLen - 1; i >= 0; --i) results[i] = q.poll();

	              results.total = resultsLen + limitedCount;
	              resolve(results);
	            }

	            isNode ? setImmediate(step) : step();
	          });

	          p.cancel = function () {
	            canceled = true;
	          };

	          return p;
	        },
	        highlight: function (result, hOpen, hClose) {
	          if (result === null) return null;
	          if (hOpen === undefined) hOpen = '<b>';
	          if (hClose === undefined) hClose = '</b>';
	          var highlighted = '';
	          var matchesIndex = 0;
	          var opened = false;
	          var target = result.target;
	          var targetLen = target.length;
	          var matchesBest = result.indexes;

	          for (var i = 0; i < targetLen; ++i) {
	            var char = target[i];

	            if (matchesBest[matchesIndex] === i) {
	              ++matchesIndex;

	              if (!opened) {
	                opened = true;
	                highlighted += hOpen;
	              }

	              if (matchesIndex === matchesBest.length) {
	                highlighted += char + hClose + target.substr(i + 1);
	                break;
	              }
	            } else {
	              if (opened) {
	                opened = false;
	                highlighted += hClose;
	              }
	            }

	            highlighted += char;
	          }

	          return highlighted;
	        },
	        prepare: function (target) {
	          if (!target) return;
	          return {
	            target: target,
	            _targetLowerCodes: fuzzysort.prepareLowerCodes(target),
	            _nextBeginningIndexes: null,
	            score: null,
	            indexes: null,
	            obj: null
	          }; // hidden
	        },
	        prepareSlow: function (target) {
	          if (!target) return;
	          return {
	            target: target,
	            _targetLowerCodes: fuzzysort.prepareLowerCodes(target),
	            _nextBeginningIndexes: fuzzysort.prepareNextBeginningIndexes(target),
	            score: null,
	            indexes: null,
	            obj: null
	          }; // hidden
	        },
	        prepareSearch: function (search) {
	          if (!search) return;
	          return fuzzysort.prepareLowerCodes(search);
	        },
	        // Below this point is only internal code
	        // Below this point is only internal code
	        // Below this point is only internal code
	        // Below this point is only internal code
	        getPrepared: function (target) {
	          if (target.length > 999) return fuzzysort.prepare(target); // don't cache huge targets

	          var targetPrepared = preparedCache.get(target);
	          if (targetPrepared !== undefined) return targetPrepared;
	          targetPrepared = fuzzysort.prepare(target);
	          preparedCache.set(target, targetPrepared);
	          return targetPrepared;
	        },
	        getPreparedSearch: function (search) {
	          if (search.length > 999) return fuzzysort.prepareSearch(search); // don't cache huge searches

	          var searchPrepared = preparedSearchCache.get(search);
	          if (searchPrepared !== undefined) return searchPrepared;
	          searchPrepared = fuzzysort.prepareSearch(search);
	          preparedSearchCache.set(search, searchPrepared);
	          return searchPrepared;
	        },
	        algorithm: function (searchLowerCodes, prepared, searchLowerCode) {
	          var targetLowerCodes = prepared._targetLowerCodes;
	          var searchLen = searchLowerCodes.length;
	          var targetLen = targetLowerCodes.length;
	          var searchI = 0; // where we at

	          var targetI = 0; // where you at

	          var typoSimpleI = 0;
	          var matchesSimpleLen = 0; // very basic fuzzy match; to remove non-matching targets ASAP!
	          // walk through target. find sequential matches.
	          // if all chars aren't found then exit

	          for (;;) {
	            var isMatch = searchLowerCode === targetLowerCodes[targetI];

	            if (isMatch) {
	              matchesSimple[matchesSimpleLen++] = targetI;
	              ++searchI;
	              if (searchI === searchLen) break;
	              searchLowerCode = searchLowerCodes[typoSimpleI === 0 ? searchI : typoSimpleI === searchI ? searchI + 1 : typoSimpleI === searchI - 1 ? searchI - 1 : searchI];
	            }

	            ++targetI;

	            if (targetI >= targetLen) {
	              // Failed to find searchI
	              // Check for typo or exit
	              // we go as far as possible before trying to transpose
	              // then we transpose backwards until we reach the beginning
	              for (;;) {
	                if (searchI <= 1) return null; // not allowed to transpose first char

	                if (typoSimpleI === 0) {
	                  // we haven't tried to transpose yet
	                  --searchI;
	                  var searchLowerCodeNew = searchLowerCodes[searchI];
	                  if (searchLowerCode === searchLowerCodeNew) continue; // doesn't make sense to transpose a repeat char

	                  typoSimpleI = searchI;
	                } else {
	                  if (typoSimpleI === 1) return null; // reached the end of the line for transposing

	                  --typoSimpleI;
	                  searchI = typoSimpleI;
	                  searchLowerCode = searchLowerCodes[searchI + 1];
	                  var searchLowerCodeNew = searchLowerCodes[searchI];
	                  if (searchLowerCode === searchLowerCodeNew) continue; // doesn't make sense to transpose a repeat char
	                }

	                matchesSimpleLen = searchI;
	                targetI = matchesSimple[matchesSimpleLen - 1] + 1;
	                break;
	              }
	            }
	          }

	          var searchI = 0;
	          var typoStrictI = 0;
	          var successStrict = false;
	          var matchesStrictLen = 0;
	          var nextBeginningIndexes = prepared._nextBeginningIndexes;
	          if (nextBeginningIndexes === null) nextBeginningIndexes = prepared._nextBeginningIndexes = fuzzysort.prepareNextBeginningIndexes(prepared.target);
	          var firstPossibleI = targetI = matchesSimple[0] === 0 ? 0 : nextBeginningIndexes[matchesSimple[0] - 1]; // Our target string successfully matched all characters in sequence!
	          // Let's try a more advanced and strict test to improve the score
	          // only count it as a match if it's consecutive or a beginning character!

	          if (targetI !== targetLen) for (;;) {
	            if (targetI >= targetLen) {
	              // We failed to find a good spot for this search char, go back to the previous search char and force it forward
	              if (searchI <= 0) {
	                // We failed to push chars forward for a better match
	                // transpose, starting from the beginning
	                ++typoStrictI;
	                if (typoStrictI > searchLen - 2) break;
	                if (searchLowerCodes[typoStrictI] === searchLowerCodes[typoStrictI + 1]) continue; // doesn't make sense to transpose a repeat char

	                targetI = firstPossibleI;
	                continue;
	              }

	              --searchI;
	              var lastMatch = matchesStrict[--matchesStrictLen];
	              targetI = nextBeginningIndexes[lastMatch];
	            } else {
	              var isMatch = searchLowerCodes[typoStrictI === 0 ? searchI : typoStrictI === searchI ? searchI + 1 : typoStrictI === searchI - 1 ? searchI - 1 : searchI] === targetLowerCodes[targetI];

	              if (isMatch) {
	                matchesStrict[matchesStrictLen++] = targetI;
	                ++searchI;

	                if (searchI === searchLen) {
	                  successStrict = true;
	                  break;
	                }

	                ++targetI;
	              } else {
	                targetI = nextBeginningIndexes[targetI];
	              }
	            }
	          }
	          {
	            // tally up the score & keep track of matches for highlighting later
	            if (successStrict) {
	              var matchesBest = matchesStrict;
	              var matchesBestLen = matchesStrictLen;
	            } else {
	              var matchesBest = matchesSimple;
	              var matchesBestLen = matchesSimpleLen;
	            }

	            var score = 0;
	            var lastTargetI = -1;

	            for (var i = 0; i < searchLen; ++i) {
	              var targetI = matchesBest[i]; // score only goes down if they're not consecutive

	              if (lastTargetI !== targetI - 1) score -= targetI;
	              lastTargetI = targetI;
	            }

	            if (!successStrict) {
	              score *= 1000;
	              if (typoSimpleI !== 0) score += -20;
	              /*typoPenalty*/
	            } else {
	              if (typoStrictI !== 0) score += -20;
	              /*typoPenalty*/
	            }

	            score -= targetLen - searchLen;
	            prepared.score = score;
	            prepared.indexes = new Array(matchesBestLen);

	            for (var i = matchesBestLen - 1; i >= 0; --i) prepared.indexes[i] = matchesBest[i];

	            return prepared;
	          }
	        },
	        algorithmNoTypo: function (searchLowerCodes, prepared, searchLowerCode) {
	          var targetLowerCodes = prepared._targetLowerCodes;
	          var searchLen = searchLowerCodes.length;
	          var targetLen = targetLowerCodes.length;
	          var searchI = 0; // where we at

	          var targetI = 0; // where you at

	          var matchesSimpleLen = 0; // very basic fuzzy match; to remove non-matching targets ASAP!
	          // walk through target. find sequential matches.
	          // if all chars aren't found then exit

	          for (;;) {
	            var isMatch = searchLowerCode === targetLowerCodes[targetI];

	            if (isMatch) {
	              matchesSimple[matchesSimpleLen++] = targetI;
	              ++searchI;
	              if (searchI === searchLen) break;
	              searchLowerCode = searchLowerCodes[searchI];
	            }

	            ++targetI;
	            if (targetI >= targetLen) return null; // Failed to find searchI
	          }

	          var searchI = 0;
	          var successStrict = false;
	          var matchesStrictLen = 0;
	          var nextBeginningIndexes = prepared._nextBeginningIndexes;
	          if (nextBeginningIndexes === null) nextBeginningIndexes = prepared._nextBeginningIndexes = fuzzysort.prepareNextBeginningIndexes(prepared.target);
	          var firstPossibleI = targetI = matchesSimple[0] === 0 ? 0 : nextBeginningIndexes[matchesSimple[0] - 1]; // Our target string successfully matched all characters in sequence!
	          // Let's try a more advanced and strict test to improve the score
	          // only count it as a match if it's consecutive or a beginning character!

	          if (targetI !== targetLen) for (;;) {
	            if (targetI >= targetLen) {
	              // We failed to find a good spot for this search char, go back to the previous search char and force it forward
	              if (searchI <= 0) break; // We failed to push chars forward for a better match

	              --searchI;
	              var lastMatch = matchesStrict[--matchesStrictLen];
	              targetI = nextBeginningIndexes[lastMatch];
	            } else {
	              var isMatch = searchLowerCodes[searchI] === targetLowerCodes[targetI];

	              if (isMatch) {
	                matchesStrict[matchesStrictLen++] = targetI;
	                ++searchI;

	                if (searchI === searchLen) {
	                  successStrict = true;
	                  break;
	                }

	                ++targetI;
	              } else {
	                targetI = nextBeginningIndexes[targetI];
	              }
	            }
	          }
	          {
	            // tally up the score & keep track of matches for highlighting later
	            if (successStrict) {
	              var matchesBest = matchesStrict;
	              var matchesBestLen = matchesStrictLen;
	            } else {
	              var matchesBest = matchesSimple;
	              var matchesBestLen = matchesSimpleLen;
	            }

	            var score = 0;
	            var lastTargetI = -1;

	            for (var i = 0; i < searchLen; ++i) {
	              var targetI = matchesBest[i]; // score only goes down if they're not consecutive

	              if (lastTargetI !== targetI - 1) score -= targetI;
	              lastTargetI = targetI;
	            }

	            if (!successStrict) score *= 1000;
	            score -= targetLen - searchLen;
	            prepared.score = score;
	            prepared.indexes = new Array(matchesBestLen);

	            for (var i = matchesBestLen - 1; i >= 0; --i) prepared.indexes[i] = matchesBest[i];

	            return prepared;
	          }
	        },
	        prepareLowerCodes: function (str) {
	          var strLen = str.length;
	          var lowerCodes = []; // new Array(strLen)    sparse array is too slow

	          var lower = str.toLowerCase();

	          for (var i = 0; i < strLen; ++i) lowerCodes[i] = lower.charCodeAt(i);

	          return lowerCodes;
	        },
	        prepareBeginningIndexes: function (target) {
	          var targetLen = target.length;
	          var beginningIndexes = [];
	          var beginningIndexesLen = 0;
	          var wasUpper = false;
	          var wasAlphanum = false;

	          for (var i = 0; i < targetLen; ++i) {
	            var targetCode = target.charCodeAt(i);
	            var isUpper = targetCode >= 65 && targetCode <= 90;
	            var isAlphanum = isUpper || targetCode >= 97 && targetCode <= 122 || targetCode >= 48 && targetCode <= 57;
	            var isBeginning = isUpper && !wasUpper || !wasAlphanum || !isAlphanum;
	            wasUpper = isUpper;
	            wasAlphanum = isAlphanum;
	            if (isBeginning) beginningIndexes[beginningIndexesLen++] = i;
	          }

	          return beginningIndexes;
	        },
	        prepareNextBeginningIndexes: function (target) {
	          var targetLen = target.length;
	          var beginningIndexes = fuzzysort.prepareBeginningIndexes(target);
	          var nextBeginningIndexes = []; // new Array(targetLen)     sparse array is too slow

	          var lastIsBeginning = beginningIndexes[0];
	          var lastIsBeginningI = 0;

	          for (var i = 0; i < targetLen; ++i) {
	            if (lastIsBeginning > i) {
	              nextBeginningIndexes[i] = lastIsBeginning;
	            } else {
	              lastIsBeginning = beginningIndexes[++lastIsBeginningI];
	              nextBeginningIndexes[i] = lastIsBeginning === undefined ? targetLen : lastIsBeginning;
	            }
	          }

	          return nextBeginningIndexes;
	        },
	        cleanup: cleanup,
	        new: fuzzysortNew
	      };
	      return fuzzysort;
	    } // fuzzysortNew
	    // This stuff is outside fuzzysortNew, because it's shared with instances of fuzzysort.new()


	    var isNode = typeof commonjsRequire !== 'undefined' && typeof window === 'undefined'; // var MAX_INT = Number.MAX_SAFE_INTEGER
	    // var MIN_INT = Number.MIN_VALUE

	    var preparedCache = new Map();
	    var preparedSearchCache = new Map();
	    var noResults = [];
	    noResults.total = 0;
	    var matchesSimple = [];
	    var matchesStrict = [];

	    function cleanup() {
	      preparedCache.clear();
	      preparedSearchCache.clear();
	      matchesSimple = [];
	      matchesStrict = [];
	    }

	    function defaultScoreFn(a) {
	      var max = -9007199254740991;

	      for (var i = a.length - 1; i >= 0; --i) {
	        var result = a[i];
	        if (result === null) continue;
	        var score = result.score;
	        if (score > max) max = score;
	      }

	      if (max === -9007199254740991) return null;
	      return max;
	    } // prop = 'key'              2.5ms optimized for this case, seems to be about as fast as direct obj[prop]
	    // prop = 'key1.key2'        10ms
	    // prop = ['key1', 'key2']   27ms


	    function getValue(obj, prop) {
	      var tmp = obj[prop];
	      if (tmp !== undefined) return tmp;
	      var segs = prop;
	      if (!Array.isArray(prop)) segs = prop.split('.');
	      var len = segs.length;
	      var i = -1;

	      while (obj && ++i < len) obj = obj[segs[i]];

	      return obj;
	    }

	    function isObj(x) {
	      return typeof x === 'object';
	    } // faster as a function
	    // Hacked version of https://github.com/lemire/FastPriorityQueue.js


	    var fastpriorityqueue = function () {
	      var r = [],
	          o = 0,
	          e = {};

	      function n() {
	        for (var e = 0, n = r[e], c = 1; c < o;) {
	          var f = c + 1;
	          e = c, f < o && r[f].score < r[c].score && (e = f), r[e - 1 >> 1] = r[e], c = 1 + (e << 1);
	        }

	        for (var a = e - 1 >> 1; e > 0 && n.score < r[a].score; a = (e = a) - 1 >> 1) r[e] = r[a];

	        r[e] = n;
	      }

	      return e.add = function (e) {
	        var n = o;
	        r[o++] = e;

	        for (var c = n - 1 >> 1; n > 0 && e.score < r[c].score; c = (n = c) - 1 >> 1) r[n] = r[c];

	        r[n] = e;
	      }, e.poll = function () {
	        if (0 !== o) {
	          var e = r[0];
	          return r[0] = r[--o], n(), e;
	        }
	      }, e.peek = function (e) {
	        if (0 !== o) return r[0];
	      }, e.replaceTop = function (o) {
	        r[0] = o, n();
	      }, e;
	    };

	    var q = fastpriorityqueue(); // reuse this, except for async, it needs to make its own

	    return fuzzysortNew();
	  }); // UMD
	  // TODO: (performance) wasm version!?
	  // TODO: (performance) layout memory in an optimal way to go fast by avoiding cache misses
	  // TODO: (performance) preparedCache is a memory leak
	  // TODO: (like sublime) backslash === forwardslash
	  // TODO: (performance) i have no idea how well optizmied the allowing typos algorithm is

	});

	var stats = {
	  passedTests: 0,
	  failedTests: 0,
	  skippedTests: 0,
	  todoTests: 0
	}; // Escape text for attribute or text content.

	function escapeText(s) {
	  if (!s) {
	    return "";
	  }

	  s = s + ""; // Both single quotes and double quotes (for attributes)

	  return s.replace(/['"<>&]/g, function (s) {
	    switch (s) {
	      case "'":
	        return "&#039;";

	      case "\"":
	        return "&quot;";

	      case "<":
	        return "&lt;";

	      case ">":
	        return "&gt;";

	      case "&":
	        return "&amp;";
	    }
	  });
	}

	(function () {
	  // Don't load the HTML Reporter on non-browser environments
	  if (typeof window$1 === "undefined" || !window$1.document) {
	    return;
	  }

	  var config = QUnit.config,
	      hiddenTests = [],
	      document = window$1.document,
	      collapseNext = false,
	      hasOwn = Object.prototype.hasOwnProperty,
	      unfilteredUrl = setUrl({
	    filter: undefined,
	    module: undefined,
	    moduleId: undefined,
	    testId: undefined
	  }),
	      modulesList = [];

	  function addEvent(elem, type, fn) {
	    elem.addEventListener(type, fn, false);
	  }

	  function removeEvent(elem, type, fn) {
	    elem.removeEventListener(type, fn, false);
	  }

	  function addEvents(elems, type, fn) {
	    var i = elems.length;

	    while (i--) {
	      addEvent(elems[i], type, fn);
	    }
	  }

	  function hasClass(elem, name) {
	    return (" " + elem.className + " ").indexOf(" " + name + " ") >= 0;
	  }

	  function addClass(elem, name) {
	    if (!hasClass(elem, name)) {
	      elem.className += (elem.className ? " " : "") + name;
	    }
	  }

	  function toggleClass(elem, name, force) {
	    if (force || typeof force === "undefined" && !hasClass(elem, name)) {
	      addClass(elem, name);
	    } else {
	      removeClass(elem, name);
	    }
	  }

	  function removeClass(elem, name) {
	    var set = " " + elem.className + " "; // Class name may appear multiple times

	    while (set.indexOf(" " + name + " ") >= 0) {
	      set = set.replace(" " + name + " ", " ");
	    } // Trim for prettiness


	    elem.className = typeof set.trim === "function" ? set.trim() : set.replace(/^\s+|\s+$/g, "");
	  }

	  function id(name) {
	    return document.getElementById && document.getElementById(name);
	  }

	  function abortTests() {
	    var abortButton = id("qunit-abort-tests-button");

	    if (abortButton) {
	      abortButton.disabled = true;
	      abortButton.innerHTML = "Aborting...";
	    }

	    QUnit.config.queue.length = 0;
	    return false;
	  }

	  function interceptNavigation(ev) {
	    applyUrlParams();

	    if (ev && ev.preventDefault) {
	      ev.preventDefault();
	    }

	    return false;
	  }

	  function getUrlConfigHtml() {
	    var i,
	        j,
	        val,
	        escaped,
	        escapedTooltip,
	        selection = false,
	        urlConfig = config.urlConfig,
	        urlConfigHtml = "";

	    for (i = 0; i < urlConfig.length; i++) {
	      // Options can be either strings or objects with nonempty "id" properties
	      val = config.urlConfig[i];

	      if (typeof val === "string") {
	        val = {
	          id: val,
	          label: val
	        };
	      }

	      escaped = escapeText(val.id);
	      escapedTooltip = escapeText(val.tooltip);

	      if (!val.value || typeof val.value === "string") {
	        urlConfigHtml += "<label for='qunit-urlconfig-" + escaped + "' title='" + escapedTooltip + "'><input id='qunit-urlconfig-" + escaped + "' name='" + escaped + "' type='checkbox'" + (val.value ? " value='" + escapeText(val.value) + "'" : "") + (config[val.id] ? " checked='checked'" : "") + " title='" + escapedTooltip + "' />" + escapeText(val.label) + "</label>";
	      } else {
	        urlConfigHtml += "<label for='qunit-urlconfig-" + escaped + "' title='" + escapedTooltip + "'>" + val.label + ": </label><select id='qunit-urlconfig-" + escaped + "' name='" + escaped + "' title='" + escapedTooltip + "'><option></option>";

	        if (QUnit.is("array", val.value)) {
	          for (j = 0; j < val.value.length; j++) {
	            escaped = escapeText(val.value[j]);
	            urlConfigHtml += "<option value='" + escaped + "'" + (config[val.id] === val.value[j] ? (selection = true) && " selected='selected'" : "") + ">" + escaped + "</option>";
	          }
	        } else {
	          for (j in val.value) {
	            if (hasOwn.call(val.value, j)) {
	              urlConfigHtml += "<option value='" + escapeText(j) + "'" + (config[val.id] === j ? (selection = true) && " selected='selected'" : "") + ">" + escapeText(val.value[j]) + "</option>";
	            }
	          }
	        }

	        if (config[val.id] && !selection) {
	          escaped = escapeText(config[val.id]);
	          urlConfigHtml += "<option value='" + escaped + "' selected='selected' disabled='disabled'>" + escaped + "</option>";
	        }

	        urlConfigHtml += "</select>";
	      }
	    }

	    return urlConfigHtml;
	  } // Handle "click" events on toolbar checkboxes and "change" for select menus.
	  // Updates the URL with the new state of `config.urlConfig` values.


	  function toolbarChanged() {
	    var updatedUrl,
	        value,
	        tests,
	        field = this,
	        params = {}; // Detect if field is a select menu or a checkbox

	    if ("selectedIndex" in field) {
	      value = field.options[field.selectedIndex].value || undefined;
	    } else {
	      value = field.checked ? field.defaultValue || true : undefined;
	    }

	    params[field.name] = value;
	    updatedUrl = setUrl(params); // Check if we can apply the change without a page refresh

	    if ("hidepassed" === field.name && "replaceState" in window$1.history) {
	      QUnit.urlParams[field.name] = value;
	      config[field.name] = value || false;
	      tests = id("qunit-tests");

	      if (tests) {
	        var length = tests.children.length;
	        var children = tests.children;

	        if (field.checked) {
	          for (var i = 0; i < length; i++) {
	            var test = children[i];
	            var className = test ? test.className : "";
	            var classNameHasPass = className.indexOf("pass") > -1;
	            var classNameHasSkipped = className.indexOf("skipped") > -1;

	            if (classNameHasPass || classNameHasSkipped) {
	              hiddenTests.push(test);
	            }
	          }

	          var _iterator = _createForOfIteratorHelper(hiddenTests),
	              _step;

	          try {
	            for (_iterator.s(); !(_step = _iterator.n()).done;) {
	              var hiddenTest = _step.value;
	              tests.removeChild(hiddenTest);
	            }
	          } catch (err) {
	            _iterator.e(err);
	          } finally {
	            _iterator.f();
	          }
	        } else {
	          while ((test = hiddenTests.pop()) != null) {
	            tests.appendChild(test);
	          }
	        }
	      }

	      window$1.history.replaceState(null, "", updatedUrl);
	    } else {
	      window$1.location = updatedUrl;
	    }
	  }

	  function setUrl(params) {
	    var key,
	        arrValue,
	        i,
	        querystring = "?",
	        location = window$1.location;
	    params = QUnit.extend(QUnit.extend({}, QUnit.urlParams), params);

	    for (key in params) {
	      // Skip inherited or undefined properties
	      if (hasOwn.call(params, key) && params[key] !== undefined) {
	        // Output a parameter for each value of this key
	        // (but usually just one)
	        arrValue = [].concat(params[key]);

	        for (i = 0; i < arrValue.length; i++) {
	          querystring += encodeURIComponent(key);

	          if (arrValue[i] !== true) {
	            querystring += "=" + encodeURIComponent(arrValue[i]);
	          }

	          querystring += "&";
	        }
	      }
	    }

	    return location.protocol + "//" + location.host + location.pathname + querystring.slice(0, -1);
	  }

	  function applyUrlParams() {
	    var i,
	        selectedModules = [],
	        modulesList = id("qunit-modulefilter-dropdown-list").getElementsByTagName("input"),
	        filter = id("qunit-filter-input").value;

	    for (i = 0; i < modulesList.length; i++) {
	      if (modulesList[i].checked) {
	        selectedModules.push(modulesList[i].value);
	      }
	    }

	    window$1.location = setUrl({
	      filter: filter === "" ? undefined : filter,
	      moduleId: selectedModules.length === 0 ? undefined : selectedModules,
	      // Remove module and testId filter
	      module: undefined,
	      testId: undefined
	    });
	  }

	  function toolbarUrlConfigContainer() {
	    var urlConfigContainer = document.createElement("span");
	    urlConfigContainer.innerHTML = getUrlConfigHtml();
	    addClass(urlConfigContainer, "qunit-url-config");
	    addEvents(urlConfigContainer.getElementsByTagName("input"), "change", toolbarChanged);
	    addEvents(urlConfigContainer.getElementsByTagName("select"), "change", toolbarChanged);
	    return urlConfigContainer;
	  }

	  function abortTestsButton() {
	    var button = document.createElement("button");
	    button.id = "qunit-abort-tests-button";
	    button.innerHTML = "Abort";
	    addEvent(button, "click", abortTests);
	    return button;
	  }

	  function toolbarLooseFilter() {
	    var filter = document.createElement("form"),
	        label = document.createElement("label"),
	        input = document.createElement("input"),
	        button = document.createElement("button");
	    addClass(filter, "qunit-filter");
	    label.innerHTML = "Filter: ";
	    input.type = "text";
	    input.value = config.filter || "";
	    input.name = "filter";
	    input.id = "qunit-filter-input";
	    button.innerHTML = "Go";
	    label.appendChild(input);
	    filter.appendChild(label);
	    filter.appendChild(document.createTextNode(" "));
	    filter.appendChild(button);
	    addEvent(filter, "submit", interceptNavigation);
	    return filter;
	  }

	  function moduleListHtml(modules) {
	    var i,
	        checked,
	        html = "";

	    for (i = 0; i < modules.length; i++) {
	      if (modules[i].name !== "") {
	        checked = config.moduleId.indexOf(modules[i].moduleId) > -1;
	        html += "<li><label class='clickable" + (checked ? " checked" : "") + "'><input type='checkbox' " + "value='" + modules[i].moduleId + "'" + (checked ? " checked='checked'" : "") + " />" + escapeText(modules[i].name) + "</label></li>";
	      }
	    }

	    return html;
	  }

	  function toolbarModuleFilter() {
	    var commit,
	        reset,
	        moduleFilter = document.createElement("form"),
	        label = document.createElement("label"),
	        moduleSearch = document.createElement("input"),
	        dropDown = document.createElement("div"),
	        actions = document.createElement("span"),
	        applyButton = document.createElement("button"),
	        resetButton = document.createElement("button"),
	        allModulesLabel = document.createElement("label"),
	        allCheckbox = document.createElement("input"),
	        dropDownList = document.createElement("ul"),
	        dirty = false;
	    moduleSearch.id = "qunit-modulefilter-search";
	    moduleSearch.autocomplete = "off";
	    addEvent(moduleSearch, "input", searchInput);
	    addEvent(moduleSearch, "input", searchFocus);
	    addEvent(moduleSearch, "focus", searchFocus);
	    addEvent(moduleSearch, "click", searchFocus);
	    config.modules.forEach(function (module) {
	      return module.namePrepared = fuzzysort.prepare(module.name);
	    });
	    label.id = "qunit-modulefilter-search-container";
	    label.innerHTML = "Module: ";
	    label.appendChild(moduleSearch);
	    applyButton.textContent = "Apply";
	    applyButton.style.display = "none";
	    resetButton.textContent = "Reset";
	    resetButton.type = "reset";
	    resetButton.style.display = "none";
	    allCheckbox.type = "checkbox";
	    allCheckbox.checked = config.moduleId.length === 0;
	    allModulesLabel.className = "clickable";

	    if (config.moduleId.length) {
	      allModulesLabel.className = "checked";
	    }

	    allModulesLabel.appendChild(allCheckbox);
	    allModulesLabel.appendChild(document.createTextNode("All modules"));
	    actions.id = "qunit-modulefilter-actions";
	    actions.appendChild(applyButton);
	    actions.appendChild(resetButton);
	    actions.appendChild(allModulesLabel);
	    commit = actions.firstChild;
	    reset = commit.nextSibling;
	    addEvent(commit, "click", applyUrlParams);
	    dropDownList.id = "qunit-modulefilter-dropdown-list";
	    dropDownList.innerHTML = moduleListHtml(config.modules);
	    dropDown.id = "qunit-modulefilter-dropdown";
	    dropDown.style.display = "none";
	    dropDown.appendChild(actions);
	    dropDown.appendChild(dropDownList);
	    addEvent(dropDown, "change", selectionChange);
	    selectionChange();
	    moduleFilter.id = "qunit-modulefilter";
	    moduleFilter.appendChild(label);
	    moduleFilter.appendChild(dropDown);
	    addEvent(moduleFilter, "submit", interceptNavigation);
	    addEvent(moduleFilter, "reset", function () {
	      // Let the reset happen, then update styles
	      window$1.setTimeout(selectionChange);
	    }); // Enables show/hide for the dropdown

	    function searchFocus() {
	      if (dropDown.style.display !== "none") {
	        return;
	      }

	      dropDown.style.display = "block";
	      addEvent(document, "click", hideHandler);
	      addEvent(document, "keydown", hideHandler); // Hide on Escape keydown or outside-container click

	      function hideHandler(e) {
	        var inContainer = moduleFilter.contains(e.target);

	        if (e.keyCode === 27 || !inContainer) {
	          if (e.keyCode === 27 && inContainer) {
	            moduleSearch.focus();
	          }

	          dropDown.style.display = "none";
	          removeEvent(document, "click", hideHandler);
	          removeEvent(document, "keydown", hideHandler);
	          moduleSearch.value = "";
	          searchInput();
	        }
	      }
	    }

	    function filterModules(searchText) {
	      if (searchText === "") {
	        return config.modules;
	      }

	      return fuzzysort.go(searchText, config.modules, {
	        key: "namePrepared",
	        threshold: -10000
	      }).map(function (module) {
	        return module.obj;
	      });
	    } // Processes module search box input


	    var searchInputTimeout;

	    function searchInput() {
	      window$1.clearTimeout(searchInputTimeout);
	      searchInputTimeout = window$1.setTimeout(function () {
	        var searchText = moduleSearch.value.toLowerCase(),
	            filteredModules = filterModules(searchText);
	        dropDownList.innerHTML = moduleListHtml(filteredModules);
	      }, 200);
	    } // Processes selection changes


	    function selectionChange(evt) {
	      var i,
	          item,
	          checkbox = evt && evt.target || allCheckbox,
	          modulesList = dropDownList.getElementsByTagName("input"),
	          selectedNames = [];
	      toggleClass(checkbox.parentNode, "checked", checkbox.checked);
	      dirty = false;

	      if (checkbox.checked && checkbox !== allCheckbox) {
	        allCheckbox.checked = false;
	        removeClass(allCheckbox.parentNode, "checked");
	      }

	      for (i = 0; i < modulesList.length; i++) {
	        item = modulesList[i];

	        if (!evt) {
	          toggleClass(item.parentNode, "checked", item.checked);
	        } else if (checkbox === allCheckbox && checkbox.checked) {
	          item.checked = false;
	          removeClass(item.parentNode, "checked");
	        }

	        dirty = dirty || item.checked !== item.defaultChecked;

	        if (item.checked) {
	          selectedNames.push(item.parentNode.textContent);
	        }
	      }

	      commit.style.display = reset.style.display = dirty ? "" : "none";
	      moduleSearch.placeholder = selectedNames.join(", ") || allCheckbox.parentNode.textContent;
	      moduleSearch.title = "Type to filter list. Current selection:\n" + (selectedNames.join("\n") || allCheckbox.parentNode.textContent);
	    }

	    return moduleFilter;
	  }

	  function toolbarFilters() {
	    var toolbarFilters = document.createElement("span");
	    toolbarFilters.id = "qunit-toolbar-filters";
	    toolbarFilters.appendChild(toolbarLooseFilter());
	    toolbarFilters.appendChild(toolbarModuleFilter());
	    return toolbarFilters;
	  }

	  function appendToolbar() {
	    var toolbar = id("qunit-testrunner-toolbar");

	    if (toolbar) {
	      toolbar.appendChild(toolbarUrlConfigContainer());
	      toolbar.appendChild(toolbarFilters());
	      toolbar.appendChild(document.createElement("div")).className = "clearfix";
	    }
	  }

	  function appendHeader() {
	    var header = id("qunit-header");

	    if (header) {
	      header.innerHTML = "<a href='" + escapeText(unfilteredUrl) + "'>" + header.innerHTML + "</a> ";
	    }
	  }

	  function appendBanner() {
	    var banner = id("qunit-banner");

	    if (banner) {
	      banner.className = "";
	    }
	  }

	  function appendTestResults() {
	    var tests = id("qunit-tests"),
	        result = id("qunit-testresult"),
	        controls;

	    if (result) {
	      result.parentNode.removeChild(result);
	    }

	    if (tests) {
	      tests.innerHTML = "";
	      result = document.createElement("p");
	      result.id = "qunit-testresult";
	      result.className = "result";
	      tests.parentNode.insertBefore(result, tests);
	      result.innerHTML = "<div id=\"qunit-testresult-display\">Running...<br />&#160;</div>" + "<div id=\"qunit-testresult-controls\"></div>" + "<div class=\"clearfix\"></div>";
	      controls = id("qunit-testresult-controls");
	    }

	    if (controls) {
	      controls.appendChild(abortTestsButton());
	    }
	  }

	  function appendFilteredTest() {
	    var testId = QUnit.config.testId;

	    if (!testId || testId.length <= 0) {
	      return "";
	    }

	    return "<div id='qunit-filteredTest'>Rerunning selected tests: " + escapeText(testId.join(", ")) + " <a id='qunit-clearFilter' href='" + escapeText(unfilteredUrl) + "'>Run all tests</a></div>";
	  }

	  function appendUserAgent() {
	    var userAgent = id("qunit-userAgent");

	    if (userAgent) {
	      userAgent.innerHTML = "";
	      userAgent.appendChild(document.createTextNode("QUnit " + QUnit.version + "; " + navigator.userAgent));
	    }
	  }

	  function appendInterface() {
	    var qunit = id("qunit"); // For compat with QUnit 1.2, and to support fully custom theme HTML,
	    // we will use any existing elements if no id="qunit" element exists.
	    //
	    // Note that we don't fail or fallback to creating it ourselves,
	    // because not having id="qunit" (and not having the below elements)
	    // simply means QUnit acts headless, allowing users to use their own
	    // reporters, or for a test runner to listen for events directly without
	    // having the HTML reporter actively render anything.

	    if (qunit) {
	      // Since QUnit 1.3, these are created automatically if the page
	      // contains id="qunit".
	      qunit.innerHTML = "<h1 id='qunit-header'>" + escapeText(document.title) + "</h1>" + "<h2 id='qunit-banner'></h2>" + "<div id='qunit-testrunner-toolbar'></div>" + appendFilteredTest() + "<h2 id='qunit-userAgent'></h2>" + "<ol id='qunit-tests'></ol>";
	    }

	    appendHeader();
	    appendBanner();
	    appendTestResults();
	    appendUserAgent();
	    appendToolbar();
	  }

	  function appendTest(name, testId, moduleName) {
	    var title,
	        rerunTrigger,
	        testBlock,
	        assertList,
	        tests = id("qunit-tests");

	    if (!tests) {
	      return;
	    }

	    title = document.createElement("strong");
	    title.innerHTML = getNameHtml(name, moduleName);
	    rerunTrigger = document.createElement("a");
	    rerunTrigger.innerHTML = "Rerun";
	    rerunTrigger.href = setUrl({
	      testId: testId
	    });
	    testBlock = document.createElement("li");
	    testBlock.appendChild(title);
	    testBlock.appendChild(rerunTrigger);
	    testBlock.id = "qunit-test-output-" + testId;
	    assertList = document.createElement("ol");
	    assertList.className = "qunit-assert-list";
	    testBlock.appendChild(assertList);
	    tests.appendChild(testBlock);
	  } // HTML Reporter initialization and load


	  QUnit.begin(function (details) {
	    var i, moduleObj; // Sort modules by name for the picker

	    for (i = 0; i < details.modules.length; i++) {
	      moduleObj = details.modules[i];

	      if (moduleObj.name) {
	        modulesList.push(moduleObj.name);
	      }
	    }

	    modulesList.sort(function (a, b) {
	      return a.localeCompare(b);
	    }); // Initialize QUnit elements

	    appendInterface();
	  });
	  QUnit.done(function (details) {
	    var banner = id("qunit-banner"),
	        tests = id("qunit-tests"),
	        abortButton = id("qunit-abort-tests-button"),
	        totalTests = stats.passedTests + stats.skippedTests + stats.todoTests + stats.failedTests,
	        html = [totalTests, " tests completed in ", details.runtime, " milliseconds, with ", stats.failedTests, " failed, ", stats.skippedTests, " skipped, and ", stats.todoTests, " todo.<br />", "<span class='passed'>", details.passed, "</span> assertions of <span class='total'>", details.total, "</span> passed, <span class='failed'>", details.failed, "</span> failed."].join(""),
	        test,
	        assertLi,
	        assertList; // Update remaining tests to aborted

	    if (abortButton && abortButton.disabled) {
	      html = "Tests aborted after " + details.runtime + " milliseconds.";

	      for (var i = 0; i < tests.children.length; i++) {
	        test = tests.children[i];

	        if (test.className === "" || test.className === "running") {
	          test.className = "aborted";
	          assertList = test.getElementsByTagName("ol")[0];
	          assertLi = document.createElement("li");
	          assertLi.className = "fail";
	          assertLi.innerHTML = "Test aborted.";
	          assertList.appendChild(assertLi);
	        }
	      }
	    }

	    if (banner && (!abortButton || abortButton.disabled === false)) {
	      banner.className = stats.failedTests ? "qunit-fail" : "qunit-pass";
	    }

	    if (abortButton) {
	      abortButton.parentNode.removeChild(abortButton);
	    }

	    if (tests) {
	      id("qunit-testresult-display").innerHTML = html;
	    }

	    if (config.altertitle && document.title) {
	      // Show ✖ for good, ✔ for bad suite result in title
	      // use escape sequences in case file gets loaded with non-utf-8
	      // charset
	      document.title = [stats.failedTests ? "\u2716" : "\u2714", document.title.replace(/^[\u2714\u2716] /i, "")].join(" ");
	    } // Scroll back to top to show results


	    if (config.scrolltop && window$1.scrollTo) {
	      window$1.scrollTo(0, 0);
	    }
	  });

	  function getNameHtml(name, module) {
	    var nameHtml = "";

	    if (module) {
	      nameHtml = "<span class='module-name'>" + escapeText(module) + "</span>: ";
	    }

	    nameHtml += "<span class='test-name'>" + escapeText(name) + "</span>";
	    return nameHtml;
	  }

	  function getProgressHtml(runtime, stats, total) {
	    var completed = stats.passedTests + stats.skippedTests + stats.todoTests + stats.failedTests;
	    return ["<br />", completed, " / ", total, " tests completed in ", runtime, " milliseconds, with ", stats.failedTests, " failed, ", stats.skippedTests, " skipped, and ", stats.todoTests, " todo."].join("");
	  }

	  QUnit.testStart(function (details) {
	    var running, bad;
	    appendTest(details.name, details.testId, details.module);
	    running = id("qunit-testresult-display");

	    if (running) {
	      addClass(running, "running");
	      bad = QUnit.config.reorder && details.previousFailure;
	      running.innerHTML = [bad ? "Rerunning previously failed test: <br />" : "Running: <br />", getNameHtml(details.name, details.module), getProgressHtml(now() - config.started, stats, Test.count)].join("");
	    }
	  });

	  function stripHtml(string) {
	    // Strip tags, html entity and whitespaces
	    return string.replace(/<\/?[^>]+(>|$)/g, "").replace(/&quot;/g, "").replace(/\s+/g, "");
	  }

	  QUnit.log(function (details) {
	    var assertList,
	        assertLi,
	        message,
	        expected,
	        actual,
	        diff,
	        showDiff = false,
	        testItem = id("qunit-test-output-" + details.testId);

	    if (!testItem) {
	      return;
	    }

	    message = escapeText(details.message) || (details.result ? "okay" : "failed");
	    message = "<span class='test-message'>" + message + "</span>";
	    message += "<span class='runtime'>@ " + details.runtime + " ms</span>"; // The pushFailure doesn't provide details.expected
	    // when it calls, it's implicit to also not show expected and diff stuff
	    // Also, we need to check details.expected existence, as it can exist and be undefined

	    if (!details.result && hasOwn.call(details, "expected")) {
	      if (details.negative) {
	        expected = "NOT " + QUnit.dump.parse(details.expected);
	      } else {
	        expected = QUnit.dump.parse(details.expected);
	      }

	      actual = QUnit.dump.parse(details.actual);
	      message += "<table><tr class='test-expected'><th>Expected: </th><td><pre>" + escapeText(expected) + "</pre></td></tr>";

	      if (actual !== expected) {
	        message += "<tr class='test-actual'><th>Result: </th><td><pre>" + escapeText(actual) + "</pre></td></tr>";

	        if (typeof details.actual === "number" && typeof details.expected === "number") {
	          if (!isNaN(details.actual) && !isNaN(details.expected)) {
	            showDiff = true;
	            diff = details.actual - details.expected;
	            diff = (diff > 0 ? "+" : "") + diff;
	          }
	        } else if (typeof details.actual !== "boolean" && typeof details.expected !== "boolean") {
	          diff = QUnit.diff(expected, actual); // don't show diff if there is zero overlap

	          showDiff = stripHtml(diff).length !== stripHtml(expected).length + stripHtml(actual).length;
	        }

	        if (showDiff) {
	          message += "<tr class='test-diff'><th>Diff: </th><td><pre>" + diff + "</pre></td></tr>";
	        }
	      } else if (expected.indexOf("[object Array]") !== -1 || expected.indexOf("[object Object]") !== -1) {
	        message += "<tr class='test-message'><th>Message: </th><td>" + "Diff suppressed as the depth of object is more than current max depth (" + QUnit.config.maxDepth + ").<p>Hint: Use <code>QUnit.dump.maxDepth</code> to " + " run with a higher max depth or <a href='" + escapeText(setUrl({
	          maxDepth: -1
	        })) + "'>" + "Rerun</a> without max depth.</p></td></tr>";
	      } else {
	        message += "<tr class='test-message'><th>Message: </th><td>" + "Diff suppressed as the expected and actual results have an equivalent" + " serialization</td></tr>";
	      }

	      if (details.source) {
	        message += "<tr class='test-source'><th>Source: </th><td><pre>" + escapeText(details.source) + "</pre></td></tr>";
	      }

	      message += "</table>"; // This occurs when pushFailure is set and we have an extracted stack trace
	    } else if (!details.result && details.source) {
	      message += "<table>" + "<tr class='test-source'><th>Source: </th><td><pre>" + escapeText(details.source) + "</pre></td></tr>" + "</table>";
	    }

	    assertList = testItem.getElementsByTagName("ol")[0];
	    assertLi = document.createElement("li");
	    assertLi.className = details.result ? "pass" : "fail";
	    assertLi.innerHTML = message;
	    assertList.appendChild(assertLi);
	  });
	  QUnit.testDone(function (details) {
	    var testTitle,
	        time,
	        testItem,
	        assertList,
	        status,
	        good,
	        bad,
	        testCounts,
	        skipped,
	        sourceName,
	        tests = id("qunit-tests");

	    if (!tests) {
	      return;
	    }

	    testItem = id("qunit-test-output-" + details.testId);
	    removeClass(testItem, "running");

	    if (details.failed > 0) {
	      status = "failed";
	    } else if (details.todo) {
	      status = "todo";
	    } else {
	      status = details.skipped ? "skipped" : "passed";
	    }

	    assertList = testItem.getElementsByTagName("ol")[0];
	    good = details.passed;
	    bad = details.failed; // This test passed if it has no unexpected failed assertions

	    var testPassed = details.failed > 0 ? details.todo : !details.todo;

	    if (testPassed) {
	      // Collapse the passing tests
	      addClass(assertList, "qunit-collapsed");
	    } else if (config.collapse) {
	      if (!collapseNext) {
	        // Skip collapsing the first failing test
	        collapseNext = true;
	      } else {
	        // Collapse remaining tests
	        addClass(assertList, "qunit-collapsed");
	      }
	    } // The testItem.firstChild is the test name


	    testTitle = testItem.firstChild;
	    testCounts = bad ? "<b class='failed'>" + bad + "</b>, " + "<b class='passed'>" + good + "</b>, " : "";
	    testTitle.innerHTML += " <b class='counts'>(" + testCounts + details.assertions.length + ")</b>";

	    if (details.skipped) {
	      stats.skippedTests++;
	      testItem.className = "skipped";
	      skipped = document.createElement("em");
	      skipped.className = "qunit-skipped-label";
	      skipped.innerHTML = "skipped";
	      testItem.insertBefore(skipped, testTitle);
	    } else {
	      addEvent(testTitle, "click", function () {
	        toggleClass(assertList, "qunit-collapsed");
	      });
	      testItem.className = testPassed ? "pass" : "fail";

	      if (details.todo) {
	        var todoLabel = document.createElement("em");
	        todoLabel.className = "qunit-todo-label";
	        todoLabel.innerHTML = "todo";
	        testItem.className += " todo";
	        testItem.insertBefore(todoLabel, testTitle);
	      }

	      time = document.createElement("span");
	      time.className = "runtime";
	      time.innerHTML = details.runtime + " ms";
	      testItem.insertBefore(time, assertList);

	      if (!testPassed) {
	        stats.failedTests++;
	      } else if (details.todo) {
	        stats.todoTests++;
	      } else {
	        stats.passedTests++;
	      }
	    } // Show the source of the test when showing assertions


	    if (details.source) {
	      sourceName = document.createElement("p");
	      sourceName.innerHTML = "<strong>Source: </strong>" + escapeText(details.source);
	      addClass(sourceName, "qunit-source");

	      if (testPassed) {
	        addClass(sourceName, "qunit-collapsed");
	      }

	      addEvent(testTitle, "click", function () {
	        toggleClass(sourceName, "qunit-collapsed");
	      });
	      testItem.appendChild(sourceName);
	    }

	    if (config.hidepassed && (status === "passed" || details.skipped)) {
	      // use removeChild instead of remove because of support
	      hiddenTests.push(testItem);
	      tests.removeChild(testItem);
	    }
	  }); // Avoid readyState issue with phantomjs
	  // Ref: #818

	  var notPhantom = function (p) {
	    return !(p && p.version && p.version.major > 0);
	  }(window$1.phantom);

	  if (notPhantom && document.readyState === "complete") {
	    QUnit.load();
	  } else {
	    addEvent(window$1, "load", QUnit.load);
	  } // Wrap window.onerror. We will call the original window.onerror to see if
	  // the existing handler fully handles the error; if not, we will call the
	  // QUnit.onError function.


	  var originalWindowOnError = window$1.onerror; // Cover uncaught exceptions
	  // Returning true will suppress the default browser handler,
	  // returning false will let it run.

	  window$1.onerror = function (message, fileName, lineNumber, columnNumber, errorObj) {
	    var ret = false;

	    if (originalWindowOnError) {
	      for (var _len = arguments.length, args = new Array(_len > 5 ? _len - 5 : 0), _key = 5; _key < _len; _key++) {
	        args[_key - 5] = arguments[_key];
	      }

	      ret = originalWindowOnError.call.apply(originalWindowOnError, [this, message, fileName, lineNumber, columnNumber, errorObj].concat(args));
	    } // Treat return value as window.onerror itself does,
	    // Only do our handling if not suppressed.


	    if (ret !== true) {
	      var error = {
	        message: message,
	        fileName: fileName,
	        lineNumber: lineNumber
	      }; // According to
	      // https://blog.sentry.io/2016/01/04/client-javascript-reporting-window-onerror,
	      // most modern browsers support an errorObj argument; use that to
	      // get a full stack trace if it's available.

	      if (errorObj && errorObj.stack) {
	        error.stacktrace = extractStacktrace(errorObj, 0);
	      }

	      ret = QUnit.onError(error);
	    }

	    return ret;
	  }; // Listen for unhandled rejections, and call QUnit.onUnhandledRejection


	  window$1.addEventListener("unhandledrejection", function (event) {
	    QUnit.onUnhandledRejection(event.reason);
	  });
	})();

	/*
	 * This file is a modified version of google-diff-match-patch's JavaScript implementation
	 * (https://code.google.com/p/google-diff-match-patch/source/browse/trunk/javascript/diff_match_patch_uncompressed.js),
	 * modifications are licensed as more fully set forth in LICENSE.txt.
	 *
	 * The original source of google-diff-match-patch is attributable and licensed as follows:
	 *
	 * Copyright 2006 Google Inc.
	 * https://code.google.com/p/google-diff-match-patch/
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 * https://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 *
	 * More Info:
	 *  https://code.google.com/p/google-diff-match-patch/
	 *
	 * Usage: QUnit.diff(expected, actual)
	 *
	 */

	QUnit.diff = function () {
	  function DiffMatchPatch() {} //  DIFF FUNCTIONS

	  /**
	   * The data structure representing a diff is an array of tuples:
	   * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
	   * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
	   */


	  var DIFF_DELETE = -1,
	      DIFF_INSERT = 1,
	      DIFF_EQUAL = 0,
	      hasOwn = Object.prototype.hasOwnProperty;
	  /**
	   * Find the differences between two texts.  Simplifies the problem by stripping
	   * any common prefix or suffix off the texts before diffing.
	   * @param {string} text1 Old string to be diffed.
	   * @param {string} text2 New string to be diffed.
	   * @param {boolean=} optChecklines Optional speedup flag. If present and false,
	   *     then don't run a line-level diff first to identify the changed areas.
	   *     Defaults to true, which does a faster, slightly less optimal diff.
	   * @return {!Array.<!DiffMatchPatch.Diff>} Array of diff tuples.
	   */

	  DiffMatchPatch.prototype.DiffMain = function (text1, text2, optChecklines) {
	    var deadline, checklines, commonlength, commonprefix, commonsuffix, diffs; // The diff must be complete in up to 1 second.

	    deadline = new Date().getTime() + 1000; // Check for null inputs.

	    if (text1 === null || text2 === null) {
	      throw new Error("Null input. (DiffMain)");
	    } // Check for equality (speedup).


	    if (text1 === text2) {
	      if (text1) {
	        return [[DIFF_EQUAL, text1]];
	      }

	      return [];
	    }

	    if (typeof optChecklines === "undefined") {
	      optChecklines = true;
	    }

	    checklines = optChecklines; // Trim off common prefix (speedup).

	    commonlength = this.diffCommonPrefix(text1, text2);
	    commonprefix = text1.substring(0, commonlength);
	    text1 = text1.substring(commonlength);
	    text2 = text2.substring(commonlength); // Trim off common suffix (speedup).

	    commonlength = this.diffCommonSuffix(text1, text2);
	    commonsuffix = text1.substring(text1.length - commonlength);
	    text1 = text1.substring(0, text1.length - commonlength);
	    text2 = text2.substring(0, text2.length - commonlength); // Compute the diff on the middle block.

	    diffs = this.diffCompute(text1, text2, checklines, deadline); // Restore the prefix and suffix.

	    if (commonprefix) {
	      diffs.unshift([DIFF_EQUAL, commonprefix]);
	    }

	    if (commonsuffix) {
	      diffs.push([DIFF_EQUAL, commonsuffix]);
	    }

	    this.diffCleanupMerge(diffs);
	    return diffs;
	  };
	  /**
	   * Reduce the number of edits by eliminating operationally trivial equalities.
	   * @param {!Array.<!DiffMatchPatch.Diff>} diffs Array of diff tuples.
	   */


	  DiffMatchPatch.prototype.diffCleanupEfficiency = function (diffs) {
	    var changes, equalities, equalitiesLength, lastequality, pointer, preIns, preDel, postIns, postDel;
	    changes = false;
	    equalities = []; // Stack of indices where equalities are found.

	    equalitiesLength = 0; // Keeping our own length var is faster in JS.

	    /** @type {?string} */

	    lastequality = null; // Always equal to diffs[equalities[equalitiesLength - 1]][1]

	    pointer = 0; // Index of current position.
	    // Is there an insertion operation before the last equality.

	    preIns = false; // Is there a deletion operation before the last equality.

	    preDel = false; // Is there an insertion operation after the last equality.

	    postIns = false; // Is there a deletion operation after the last equality.

	    postDel = false;

	    while (pointer < diffs.length) {
	      // Equality found.
	      if (diffs[pointer][0] === DIFF_EQUAL) {
	        if (diffs[pointer][1].length < 4 && (postIns || postDel)) {
	          // Candidate found.
	          equalities[equalitiesLength++] = pointer;
	          preIns = postIns;
	          preDel = postDel;
	          lastequality = diffs[pointer][1];
	        } else {
	          // Not a candidate, and can never become one.
	          equalitiesLength = 0;
	          lastequality = null;
	        }

	        postIns = postDel = false; // An insertion or deletion.
	      } else {
	        if (diffs[pointer][0] === DIFF_DELETE) {
	          postDel = true;
	        } else {
	          postIns = true;
	        }
	        /*
	         * Five types to be split:
	         * <ins>A</ins><del>B</del>XY<ins>C</ins><del>D</del>
	         * <ins>A</ins>X<ins>C</ins><del>D</del>
	         * <ins>A</ins><del>B</del>X<ins>C</ins>
	         * <ins>A</del>X<ins>C</ins><del>D</del>
	         * <ins>A</ins><del>B</del>X<del>C</del>
	         */


	        if (lastequality && (preIns && preDel && postIns && postDel || lastequality.length < 2 && preIns + preDel + postIns + postDel === 3)) {
	          // Duplicate record.
	          diffs.splice(equalities[equalitiesLength - 1], 0, [DIFF_DELETE, lastequality]); // Change second copy to insert.

	          diffs[equalities[equalitiesLength - 1] + 1][0] = DIFF_INSERT;
	          equalitiesLength--; // Throw away the equality we just deleted;

	          lastequality = null;

	          if (preIns && preDel) {
	            // No changes made which could affect previous entry, keep going.
	            postIns = postDel = true;
	            equalitiesLength = 0;
	          } else {
	            equalitiesLength--; // Throw away the previous equality.

	            pointer = equalitiesLength > 0 ? equalities[equalitiesLength - 1] : -1;
	            postIns = postDel = false;
	          }

	          changes = true;
	        }
	      }

	      pointer++;
	    }

	    if (changes) {
	      this.diffCleanupMerge(diffs);
	    }
	  };
	  /**
	   * Convert a diff array into a pretty HTML report.
	   * @param {!Array.<!DiffMatchPatch.Diff>} diffs Array of diff tuples.
	   * @param {integer} string to be beautified.
	   * @return {string} HTML representation.
	   */


	  DiffMatchPatch.prototype.diffPrettyHtml = function (diffs) {
	    var op,
	        data,
	        x,
	        html = [];

	    for (x = 0; x < diffs.length; x++) {
	      op = diffs[x][0]; // Operation (insert, delete, equal)

	      data = diffs[x][1]; // Text of change.

	      switch (op) {
	        case DIFF_INSERT:
	          html[x] = "<ins>" + escapeText(data) + "</ins>";
	          break;

	        case DIFF_DELETE:
	          html[x] = "<del>" + escapeText(data) + "</del>";
	          break;

	        case DIFF_EQUAL:
	          html[x] = "<span>" + escapeText(data) + "</span>";
	          break;
	      }
	    }

	    return html.join("");
	  };
	  /**
	   * Determine the common prefix of two strings.
	   * @param {string} text1 First string.
	   * @param {string} text2 Second string.
	   * @return {number} The number of characters common to the start of each
	   *     string.
	   */


	  DiffMatchPatch.prototype.diffCommonPrefix = function (text1, text2) {
	    var pointermid, pointermax, pointermin, pointerstart; // Quick check for common null cases.

	    if (!text1 || !text2 || text1.charAt(0) !== text2.charAt(0)) {
	      return 0;
	    } // Binary search.
	    // Performance analysis: https://neil.fraser.name/news/2007/10/09/


	    pointermin = 0;
	    pointermax = Math.min(text1.length, text2.length);
	    pointermid = pointermax;
	    pointerstart = 0;

	    while (pointermin < pointermid) {
	      if (text1.substring(pointerstart, pointermid) === text2.substring(pointerstart, pointermid)) {
	        pointermin = pointermid;
	        pointerstart = pointermin;
	      } else {
	        pointermax = pointermid;
	      }

	      pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
	    }

	    return pointermid;
	  };
	  /**
	   * Determine the common suffix of two strings.
	   * @param {string} text1 First string.
	   * @param {string} text2 Second string.
	   * @return {number} The number of characters common to the end of each string.
	   */


	  DiffMatchPatch.prototype.diffCommonSuffix = function (text1, text2) {
	    var pointermid, pointermax, pointermin, pointerend; // Quick check for common null cases.

	    if (!text1 || !text2 || text1.charAt(text1.length - 1) !== text2.charAt(text2.length - 1)) {
	      return 0;
	    } // Binary search.
	    // Performance analysis: https://neil.fraser.name/news/2007/10/09/


	    pointermin = 0;
	    pointermax = Math.min(text1.length, text2.length);
	    pointermid = pointermax;
	    pointerend = 0;

	    while (pointermin < pointermid) {
	      if (text1.substring(text1.length - pointermid, text1.length - pointerend) === text2.substring(text2.length - pointermid, text2.length - pointerend)) {
	        pointermin = pointermid;
	        pointerend = pointermin;
	      } else {
	        pointermax = pointermid;
	      }

	      pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
	    }

	    return pointermid;
	  };
	  /**
	   * Find the differences between two texts.  Assumes that the texts do not
	   * have any common prefix or suffix.
	   * @param {string} text1 Old string to be diffed.
	   * @param {string} text2 New string to be diffed.
	   * @param {boolean} checklines Speedup flag.  If false, then don't run a
	   *     line-level diff first to identify the changed areas.
	   *     If true, then run a faster, slightly less optimal diff.
	   * @param {number} deadline Time when the diff should be complete by.
	   * @return {!Array.<!DiffMatchPatch.Diff>} Array of diff tuples.
	   * @private
	   */


	  DiffMatchPatch.prototype.diffCompute = function (text1, text2, checklines, deadline) {
	    var diffs, longtext, shorttext, i, hm, text1A, text2A, text1B, text2B, midCommon, diffsA, diffsB;

	    if (!text1) {
	      // Just add some text (speedup).
	      return [[DIFF_INSERT, text2]];
	    }

	    if (!text2) {
	      // Just delete some text (speedup).
	      return [[DIFF_DELETE, text1]];
	    }

	    longtext = text1.length > text2.length ? text1 : text2;
	    shorttext = text1.length > text2.length ? text2 : text1;
	    i = longtext.indexOf(shorttext);

	    if (i !== -1) {
	      // Shorter text is inside the longer text (speedup).
	      diffs = [[DIFF_INSERT, longtext.substring(0, i)], [DIFF_EQUAL, shorttext], [DIFF_INSERT, longtext.substring(i + shorttext.length)]]; // Swap insertions for deletions if diff is reversed.

	      if (text1.length > text2.length) {
	        diffs[0][0] = diffs[2][0] = DIFF_DELETE;
	      }

	      return diffs;
	    }

	    if (shorttext.length === 1) {
	      // Single character string.
	      // After the previous speedup, the character can't be an equality.
	      return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
	    } // Check to see if the problem can be split in two.


	    hm = this.diffHalfMatch(text1, text2);

	    if (hm) {
	      // A half-match was found, sort out the return data.
	      text1A = hm[0];
	      text1B = hm[1];
	      text2A = hm[2];
	      text2B = hm[3];
	      midCommon = hm[4]; // Send both pairs off for separate processing.

	      diffsA = this.DiffMain(text1A, text2A, checklines, deadline);
	      diffsB = this.DiffMain(text1B, text2B, checklines, deadline); // Merge the results.

	      return diffsA.concat([[DIFF_EQUAL, midCommon]], diffsB);
	    }

	    if (checklines && text1.length > 100 && text2.length > 100) {
	      return this.diffLineMode(text1, text2, deadline);
	    }

	    return this.diffBisect(text1, text2, deadline);
	  };
	  /**
	   * Do the two texts share a substring which is at least half the length of the
	   * longer text?
	   * This speedup can produce non-minimal diffs.
	   * @param {string} text1 First string.
	   * @param {string} text2 Second string.
	   * @return {Array.<string>} Five element Array, containing the prefix of
	   *     text1, the suffix of text1, the prefix of text2, the suffix of
	   *     text2 and the common middle.  Or null if there was no match.
	   * @private
	   */


	  DiffMatchPatch.prototype.diffHalfMatch = function (text1, text2) {
	    var longtext, shorttext, dmp, text1A, text2B, text2A, text1B, midCommon, hm1, hm2, hm;
	    longtext = text1.length > text2.length ? text1 : text2;
	    shorttext = text1.length > text2.length ? text2 : text1;

	    if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
	      return null; // Pointless.
	    }

	    dmp = this; // 'this' becomes 'window' in a closure.

	    /**
	     * Does a substring of shorttext exist within longtext such that the substring
	     * is at least half the length of longtext?
	     * Closure, but does not reference any external variables.
	     * @param {string} longtext Longer string.
	     * @param {string} shorttext Shorter string.
	     * @param {number} i Start index of quarter length substring within longtext.
	     * @return {Array.<string>} Five element Array, containing the prefix of
	     *     longtext, the suffix of longtext, the prefix of shorttext, the suffix
	     *     of shorttext and the common middle.  Or null if there was no match.
	     * @private
	     */

	    function diffHalfMatchI(longtext, shorttext, i) {
	      var seed, j, bestCommon, prefixLength, suffixLength, bestLongtextA, bestLongtextB, bestShorttextA, bestShorttextB; // Start with a 1/4 length substring at position i as a seed.

	      seed = longtext.substring(i, i + Math.floor(longtext.length / 4));
	      j = -1;
	      bestCommon = "";

	      while ((j = shorttext.indexOf(seed, j + 1)) !== -1) {
	        prefixLength = dmp.diffCommonPrefix(longtext.substring(i), shorttext.substring(j));
	        suffixLength = dmp.diffCommonSuffix(longtext.substring(0, i), shorttext.substring(0, j));

	        if (bestCommon.length < suffixLength + prefixLength) {
	          bestCommon = shorttext.substring(j - suffixLength, j) + shorttext.substring(j, j + prefixLength);
	          bestLongtextA = longtext.substring(0, i - suffixLength);
	          bestLongtextB = longtext.substring(i + prefixLength);
	          bestShorttextA = shorttext.substring(0, j - suffixLength);
	          bestShorttextB = shorttext.substring(j + prefixLength);
	        }
	      }

	      if (bestCommon.length * 2 >= longtext.length) {
	        return [bestLongtextA, bestLongtextB, bestShorttextA, bestShorttextB, bestCommon];
	      } else {
	        return null;
	      }
	    } // First check if the second quarter is the seed for a half-match.


	    hm1 = diffHalfMatchI(longtext, shorttext, Math.ceil(longtext.length / 4)); // Check again based on the third quarter.

	    hm2 = diffHalfMatchI(longtext, shorttext, Math.ceil(longtext.length / 2));

	    if (!hm1 && !hm2) {
	      return null;
	    } else if (!hm2) {
	      hm = hm1;
	    } else if (!hm1) {
	      hm = hm2;
	    } else {
	      // Both matched.  Select the longest.
	      hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
	    } // A half-match was found, sort out the return data.


	    if (text1.length > text2.length) {
	      text1A = hm[0];
	      text1B = hm[1];
	      text2A = hm[2];
	      text2B = hm[3];
	    } else {
	      text2A = hm[0];
	      text2B = hm[1];
	      text1A = hm[2];
	      text1B = hm[3];
	    }

	    midCommon = hm[4];
	    return [text1A, text1B, text2A, text2B, midCommon];
	  };
	  /**
	   * Do a quick line-level diff on both strings, then rediff the parts for
	   * greater accuracy.
	   * This speedup can produce non-minimal diffs.
	   * @param {string} text1 Old string to be diffed.
	   * @param {string} text2 New string to be diffed.
	   * @param {number} deadline Time when the diff should be complete by.
	   * @return {!Array.<!DiffMatchPatch.Diff>} Array of diff tuples.
	   * @private
	   */


	  DiffMatchPatch.prototype.diffLineMode = function (text1, text2, deadline) {
	    var a, diffs, linearray, pointer, countInsert, countDelete, textInsert, textDelete, j; // Scan the text on a line-by-line basis first.

	    a = this.diffLinesToChars(text1, text2);
	    text1 = a.chars1;
	    text2 = a.chars2;
	    linearray = a.lineArray;
	    diffs = this.DiffMain(text1, text2, false, deadline); // Convert the diff back to original text.

	    this.diffCharsToLines(diffs, linearray); // Eliminate freak matches (e.g. blank lines)

	    this.diffCleanupSemantic(diffs); // Rediff any replacement blocks, this time character-by-character.
	    // Add a dummy entry at the end.

	    diffs.push([DIFF_EQUAL, ""]);
	    pointer = 0;
	    countDelete = 0;
	    countInsert = 0;
	    textDelete = "";
	    textInsert = "";

	    while (pointer < diffs.length) {
	      switch (diffs[pointer][0]) {
	        case DIFF_INSERT:
	          countInsert++;
	          textInsert += diffs[pointer][1];
	          break;

	        case DIFF_DELETE:
	          countDelete++;
	          textDelete += diffs[pointer][1];
	          break;

	        case DIFF_EQUAL:
	          // Upon reaching an equality, check for prior redundancies.
	          if (countDelete >= 1 && countInsert >= 1) {
	            // Delete the offending records and add the merged ones.
	            diffs.splice(pointer - countDelete - countInsert, countDelete + countInsert);
	            pointer = pointer - countDelete - countInsert;
	            a = this.DiffMain(textDelete, textInsert, false, deadline);

	            for (j = a.length - 1; j >= 0; j--) {
	              diffs.splice(pointer, 0, a[j]);
	            }

	            pointer = pointer + a.length;
	          }

	          countInsert = 0;
	          countDelete = 0;
	          textDelete = "";
	          textInsert = "";
	          break;
	      }

	      pointer++;
	    }

	    diffs.pop(); // Remove the dummy entry at the end.

	    return diffs;
	  };
	  /**
	   * Find the 'middle snake' of a diff, split the problem in two
	   * and return the recursively constructed diff.
	   * See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
	   * @param {string} text1 Old string to be diffed.
	   * @param {string} text2 New string to be diffed.
	   * @param {number} deadline Time at which to bail if not yet complete.
	   * @return {!Array.<!DiffMatchPatch.Diff>} Array of diff tuples.
	   * @private
	   */


	  DiffMatchPatch.prototype.diffBisect = function (text1, text2, deadline) {
	    var text1Length, text2Length, maxD, vOffset, vLength, v1, v2, x, delta, front, k1start, k1end, k2start, k2end, k2Offset, k1Offset, x1, x2, y1, y2, d, k1, k2; // Cache the text lengths to prevent multiple calls.

	    text1Length = text1.length;
	    text2Length = text2.length;
	    maxD = Math.ceil((text1Length + text2Length) / 2);
	    vOffset = maxD;
	    vLength = 2 * maxD;
	    v1 = new Array(vLength);
	    v2 = new Array(vLength); // Setting all elements to -1 is faster in Chrome & Firefox than mixing
	    // integers and undefined.

	    for (x = 0; x < vLength; x++) {
	      v1[x] = -1;
	      v2[x] = -1;
	    }

	    v1[vOffset + 1] = 0;
	    v2[vOffset + 1] = 0;
	    delta = text1Length - text2Length; // If the total number of characters is odd, then the front path will collide
	    // with the reverse path.

	    front = delta % 2 !== 0; // Offsets for start and end of k loop.
	    // Prevents mapping of space beyond the grid.

	    k1start = 0;
	    k1end = 0;
	    k2start = 0;
	    k2end = 0;

	    for (d = 0; d < maxD; d++) {
	      // Bail out if deadline is reached.
	      if (new Date().getTime() > deadline) {
	        break;
	      } // Walk the front path one step.


	      for (k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
	        k1Offset = vOffset + k1;

	        if (k1 === -d || k1 !== d && v1[k1Offset - 1] < v1[k1Offset + 1]) {
	          x1 = v1[k1Offset + 1];
	        } else {
	          x1 = v1[k1Offset - 1] + 1;
	        }

	        y1 = x1 - k1;

	        while (x1 < text1Length && y1 < text2Length && text1.charAt(x1) === text2.charAt(y1)) {
	          x1++;
	          y1++;
	        }

	        v1[k1Offset] = x1;

	        if (x1 > text1Length) {
	          // Ran off the right of the graph.
	          k1end += 2;
	        } else if (y1 > text2Length) {
	          // Ran off the bottom of the graph.
	          k1start += 2;
	        } else if (front) {
	          k2Offset = vOffset + delta - k1;

	          if (k2Offset >= 0 && k2Offset < vLength && v2[k2Offset] !== -1) {
	            // Mirror x2 onto top-left coordinate system.
	            x2 = text1Length - v2[k2Offset];

	            if (x1 >= x2) {
	              // Overlap detected.
	              return this.diffBisectSplit(text1, text2, x1, y1, deadline);
	            }
	          }
	        }
	      } // Walk the reverse path one step.


	      for (k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
	        k2Offset = vOffset + k2;

	        if (k2 === -d || k2 !== d && v2[k2Offset - 1] < v2[k2Offset + 1]) {
	          x2 = v2[k2Offset + 1];
	        } else {
	          x2 = v2[k2Offset - 1] + 1;
	        }

	        y2 = x2 - k2;

	        while (x2 < text1Length && y2 < text2Length && text1.charAt(text1Length - x2 - 1) === text2.charAt(text2Length - y2 - 1)) {
	          x2++;
	          y2++;
	        }

	        v2[k2Offset] = x2;

	        if (x2 > text1Length) {
	          // Ran off the left of the graph.
	          k2end += 2;
	        } else if (y2 > text2Length) {
	          // Ran off the top of the graph.
	          k2start += 2;
	        } else if (!front) {
	          k1Offset = vOffset + delta - k2;

	          if (k1Offset >= 0 && k1Offset < vLength && v1[k1Offset] !== -1) {
	            x1 = v1[k1Offset];
	            y1 = vOffset + x1 - k1Offset; // Mirror x2 onto top-left coordinate system.

	            x2 = text1Length - x2;

	            if (x1 >= x2) {
	              // Overlap detected.
	              return this.diffBisectSplit(text1, text2, x1, y1, deadline);
	            }
	          }
	        }
	      }
	    } // Diff took too long and hit the deadline or
	    // number of diffs equals number of characters, no commonality at all.


	    return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
	  };
	  /**
	   * Given the location of the 'middle snake', split the diff in two parts
	   * and recurse.
	   * @param {string} text1 Old string to be diffed.
	   * @param {string} text2 New string to be diffed.
	   * @param {number} x Index of split point in text1.
	   * @param {number} y Index of split point in text2.
	   * @param {number} deadline Time at which to bail if not yet complete.
	   * @return {!Array.<!DiffMatchPatch.Diff>} Array of diff tuples.
	   * @private
	   */


	  DiffMatchPatch.prototype.diffBisectSplit = function (text1, text2, x, y, deadline) {
	    var text1a, text1b, text2a, text2b, diffs, diffsb;
	    text1a = text1.substring(0, x);
	    text2a = text2.substring(0, y);
	    text1b = text1.substring(x);
	    text2b = text2.substring(y); // Compute both diffs serially.

	    diffs = this.DiffMain(text1a, text2a, false, deadline);
	    diffsb = this.DiffMain(text1b, text2b, false, deadline);
	    return diffs.concat(diffsb);
	  };
	  /**
	   * Reduce the number of edits by eliminating semantically trivial equalities.
	   * @param {!Array.<!DiffMatchPatch.Diff>} diffs Array of diff tuples.
	   */


	  DiffMatchPatch.prototype.diffCleanupSemantic = function (diffs) {
	    var changes, equalities, equalitiesLength, lastequality, pointer, lengthInsertions2, lengthDeletions2, lengthInsertions1, lengthDeletions1, deletion, insertion, overlapLength1, overlapLength2;
	    changes = false;
	    equalities = []; // Stack of indices where equalities are found.

	    equalitiesLength = 0; // Keeping our own length var is faster in JS.

	    /** @type {?string} */

	    lastequality = null; // Always equal to diffs[equalities[equalitiesLength - 1]][1]

	    pointer = 0; // Index of current position.
	    // Number of characters that changed prior to the equality.

	    lengthInsertions1 = 0;
	    lengthDeletions1 = 0; // Number of characters that changed after the equality.

	    lengthInsertions2 = 0;
	    lengthDeletions2 = 0;

	    while (pointer < diffs.length) {
	      if (diffs[pointer][0] === DIFF_EQUAL) {
	        // Equality found.
	        equalities[equalitiesLength++] = pointer;
	        lengthInsertions1 = lengthInsertions2;
	        lengthDeletions1 = lengthDeletions2;
	        lengthInsertions2 = 0;
	        lengthDeletions2 = 0;
	        lastequality = diffs[pointer][1];
	      } else {
	        // An insertion or deletion.
	        if (diffs[pointer][0] === DIFF_INSERT) {
	          lengthInsertions2 += diffs[pointer][1].length;
	        } else {
	          lengthDeletions2 += diffs[pointer][1].length;
	        } // Eliminate an equality that is smaller or equal to the edits on both
	        // sides of it.


	        if (lastequality && lastequality.length <= Math.max(lengthInsertions1, lengthDeletions1) && lastequality.length <= Math.max(lengthInsertions2, lengthDeletions2)) {
	          // Duplicate record.
	          diffs.splice(equalities[equalitiesLength - 1], 0, [DIFF_DELETE, lastequality]); // Change second copy to insert.

	          diffs[equalities[equalitiesLength - 1] + 1][0] = DIFF_INSERT; // Throw away the equality we just deleted.

	          equalitiesLength--; // Throw away the previous equality (it needs to be reevaluated).

	          equalitiesLength--;
	          pointer = equalitiesLength > 0 ? equalities[equalitiesLength - 1] : -1; // Reset the counters.

	          lengthInsertions1 = 0;
	          lengthDeletions1 = 0;
	          lengthInsertions2 = 0;
	          lengthDeletions2 = 0;
	          lastequality = null;
	          changes = true;
	        }
	      }

	      pointer++;
	    } // Normalize the diff.


	    if (changes) {
	      this.diffCleanupMerge(diffs);
	    } // Find any overlaps between deletions and insertions.
	    // e.g: <del>abcxxx</del><ins>xxxdef</ins>
	    //   -> <del>abc</del>xxx<ins>def</ins>
	    // e.g: <del>xxxabc</del><ins>defxxx</ins>
	    //   -> <ins>def</ins>xxx<del>abc</del>
	    // Only extract an overlap if it is as big as the edit ahead or behind it.


	    pointer = 1;

	    while (pointer < diffs.length) {
	      if (diffs[pointer - 1][0] === DIFF_DELETE && diffs[pointer][0] === DIFF_INSERT) {
	        deletion = diffs[pointer - 1][1];
	        insertion = diffs[pointer][1];
	        overlapLength1 = this.diffCommonOverlap(deletion, insertion);
	        overlapLength2 = this.diffCommonOverlap(insertion, deletion);

	        if (overlapLength1 >= overlapLength2) {
	          if (overlapLength1 >= deletion.length / 2 || overlapLength1 >= insertion.length / 2) {
	            // Overlap found.  Insert an equality and trim the surrounding edits.
	            diffs.splice(pointer, 0, [DIFF_EQUAL, insertion.substring(0, overlapLength1)]);
	            diffs[pointer - 1][1] = deletion.substring(0, deletion.length - overlapLength1);
	            diffs[pointer + 1][1] = insertion.substring(overlapLength1);
	            pointer++;
	          }
	        } else {
	          if (overlapLength2 >= deletion.length / 2 || overlapLength2 >= insertion.length / 2) {
	            // Reverse overlap found.
	            // Insert an equality and swap and trim the surrounding edits.
	            diffs.splice(pointer, 0, [DIFF_EQUAL, deletion.substring(0, overlapLength2)]);
	            diffs[pointer - 1][0] = DIFF_INSERT;
	            diffs[pointer - 1][1] = insertion.substring(0, insertion.length - overlapLength2);
	            diffs[pointer + 1][0] = DIFF_DELETE;
	            diffs[pointer + 1][1] = deletion.substring(overlapLength2);
	            pointer++;
	          }
	        }

	        pointer++;
	      }

	      pointer++;
	    }
	  };
	  /**
	   * Determine if the suffix of one string is the prefix of another.
	   * @param {string} text1 First string.
	   * @param {string} text2 Second string.
	   * @return {number} The number of characters common to the end of the first
	   *     string and the start of the second string.
	   * @private
	   */


	  DiffMatchPatch.prototype.diffCommonOverlap = function (text1, text2) {
	    var text1Length, text2Length, textLength, best, length, pattern, found; // Cache the text lengths to prevent multiple calls.

	    text1Length = text1.length;
	    text2Length = text2.length; // Eliminate the null case.

	    if (text1Length === 0 || text2Length === 0) {
	      return 0;
	    } // Truncate the longer string.


	    if (text1Length > text2Length) {
	      text1 = text1.substring(text1Length - text2Length);
	    } else if (text1Length < text2Length) {
	      text2 = text2.substring(0, text1Length);
	    }

	    textLength = Math.min(text1Length, text2Length); // Quick check for the worst case.

	    if (text1 === text2) {
	      return textLength;
	    } // Start by looking for a single character match
	    // and increase length until no match is found.
	    // Performance analysis: https://neil.fraser.name/news/2010/11/04/


	    best = 0;
	    length = 1;

	    while (true) {
	      pattern = text1.substring(textLength - length);
	      found = text2.indexOf(pattern);

	      if (found === -1) {
	        return best;
	      }

	      length += found;

	      if (found === 0 || text1.substring(textLength - length) === text2.substring(0, length)) {
	        best = length;
	        length++;
	      }
	    }
	  };
	  /**
	   * Split two texts into an array of strings.  Reduce the texts to a string of
	   * hashes where each Unicode character represents one line.
	   * @param {string} text1 First string.
	   * @param {string} text2 Second string.
	   * @return {{chars1: string, chars2: string, lineArray: !Array.<string>}}
	   *     An object containing the encoded text1, the encoded text2 and
	   *     the array of unique strings.
	   *     The zeroth element of the array of unique strings is intentionally blank.
	   * @private
	   */


	  DiffMatchPatch.prototype.diffLinesToChars = function (text1, text2) {
	    var lineArray, lineHash, chars1, chars2;
	    lineArray = []; // E.g. lineArray[4] === 'Hello\n'

	    lineHash = {}; // E.g. lineHash['Hello\n'] === 4
	    // '\x00' is a valid character, but various debuggers don't like it.
	    // So we'll insert a junk entry to avoid generating a null character.

	    lineArray[0] = "";
	    /**
	     * Split a text into an array of strings.  Reduce the texts to a string of
	     * hashes where each Unicode character represents one line.
	     * Modifies linearray and linehash through being a closure.
	     * @param {string} text String to encode.
	     * @return {string} Encoded string.
	     * @private
	     */

	    function diffLinesToCharsMunge(text) {
	      var chars, lineStart, lineEnd, lineArrayLength, line;
	      chars = ""; // Walk the text, pulling out a substring for each line.
	      // text.split('\n') would would temporarily double our memory footprint.
	      // Modifying text would create many large strings to garbage collect.

	      lineStart = 0;
	      lineEnd = -1; // Keeping our own length variable is faster than looking it up.

	      lineArrayLength = lineArray.length;

	      while (lineEnd < text.length - 1) {
	        lineEnd = text.indexOf("\n", lineStart);

	        if (lineEnd === -1) {
	          lineEnd = text.length - 1;
	        }

	        line = text.substring(lineStart, lineEnd + 1);
	        lineStart = lineEnd + 1;

	        if (hasOwn.call(lineHash, line)) {
	          chars += String.fromCharCode(lineHash[line]);
	        } else {
	          chars += String.fromCharCode(lineArrayLength);
	          lineHash[line] = lineArrayLength;
	          lineArray[lineArrayLength++] = line;
	        }
	      }

	      return chars;
	    }

	    chars1 = diffLinesToCharsMunge(text1);
	    chars2 = diffLinesToCharsMunge(text2);
	    return {
	      chars1: chars1,
	      chars2: chars2,
	      lineArray: lineArray
	    };
	  };
	  /**
	   * Rehydrate the text in a diff from a string of line hashes to real lines of
	   * text.
	   * @param {!Array.<!DiffMatchPatch.Diff>} diffs Array of diff tuples.
	   * @param {!Array.<string>} lineArray Array of unique strings.
	   * @private
	   */


	  DiffMatchPatch.prototype.diffCharsToLines = function (diffs, lineArray) {
	    var x, chars, text, y;

	    for (x = 0; x < diffs.length; x++) {
	      chars = diffs[x][1];
	      text = [];

	      for (y = 0; y < chars.length; y++) {
	        text[y] = lineArray[chars.charCodeAt(y)];
	      }

	      diffs[x][1] = text.join("");
	    }
	  };
	  /**
	   * Reorder and merge like edit sections.  Merge equalities.
	   * Any edit section can move as long as it doesn't cross an equality.
	   * @param {!Array.<!DiffMatchPatch.Diff>} diffs Array of diff tuples.
	   */


	  DiffMatchPatch.prototype.diffCleanupMerge = function (diffs) {
	    var pointer, countDelete, countInsert, textInsert, textDelete, commonlength, changes, diffPointer, position;
	    diffs.push([DIFF_EQUAL, ""]); // Add a dummy entry at the end.

	    pointer = 0;
	    countDelete = 0;
	    countInsert = 0;
	    textDelete = "";
	    textInsert = "";

	    while (pointer < diffs.length) {
	      switch (diffs[pointer][0]) {
	        case DIFF_INSERT:
	          countInsert++;
	          textInsert += diffs[pointer][1];
	          pointer++;
	          break;

	        case DIFF_DELETE:
	          countDelete++;
	          textDelete += diffs[pointer][1];
	          pointer++;
	          break;

	        case DIFF_EQUAL:
	          // Upon reaching an equality, check for prior redundancies.
	          if (countDelete + countInsert > 1) {
	            if (countDelete !== 0 && countInsert !== 0) {
	              // Factor out any common prefixes.
	              commonlength = this.diffCommonPrefix(textInsert, textDelete);

	              if (commonlength !== 0) {
	                if (pointer - countDelete - countInsert > 0 && diffs[pointer - countDelete - countInsert - 1][0] === DIFF_EQUAL) {
	                  diffs[pointer - countDelete - countInsert - 1][1] += textInsert.substring(0, commonlength);
	                } else {
	                  diffs.splice(0, 0, [DIFF_EQUAL, textInsert.substring(0, commonlength)]);
	                  pointer++;
	                }

	                textInsert = textInsert.substring(commonlength);
	                textDelete = textDelete.substring(commonlength);
	              } // Factor out any common suffixies.


	              commonlength = this.diffCommonSuffix(textInsert, textDelete);

	              if (commonlength !== 0) {
	                diffs[pointer][1] = textInsert.substring(textInsert.length - commonlength) + diffs[pointer][1];
	                textInsert = textInsert.substring(0, textInsert.length - commonlength);
	                textDelete = textDelete.substring(0, textDelete.length - commonlength);
	              }
	            } // Delete the offending records and add the merged ones.


	            if (countDelete === 0) {
	              diffs.splice(pointer - countInsert, countDelete + countInsert, [DIFF_INSERT, textInsert]);
	            } else if (countInsert === 0) {
	              diffs.splice(pointer - countDelete, countDelete + countInsert, [DIFF_DELETE, textDelete]);
	            } else {
	              diffs.splice(pointer - countDelete - countInsert, countDelete + countInsert, [DIFF_DELETE, textDelete], [DIFF_INSERT, textInsert]);
	            }

	            pointer = pointer - countDelete - countInsert + (countDelete ? 1 : 0) + (countInsert ? 1 : 0) + 1;
	          } else if (pointer !== 0 && diffs[pointer - 1][0] === DIFF_EQUAL) {
	            // Merge this equality with the previous one.
	            diffs[pointer - 1][1] += diffs[pointer][1];
	            diffs.splice(pointer, 1);
	          } else {
	            pointer++;
	          }

	          countInsert = 0;
	          countDelete = 0;
	          textDelete = "";
	          textInsert = "";
	          break;
	      }
	    }

	    if (diffs[diffs.length - 1][1] === "") {
	      diffs.pop(); // Remove the dummy entry at the end.
	    } // Second pass: look for single edits surrounded on both sides by equalities
	    // which can be shifted sideways to eliminate an equality.
	    // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC


	    changes = false;
	    pointer = 1; // Intentionally ignore the first and last element (don't need checking).

	    while (pointer < diffs.length - 1) {
	      if (diffs[pointer - 1][0] === DIFF_EQUAL && diffs[pointer + 1][0] === DIFF_EQUAL) {
	        diffPointer = diffs[pointer][1];
	        position = diffPointer.substring(diffPointer.length - diffs[pointer - 1][1].length); // This is a single edit surrounded by equalities.

	        if (position === diffs[pointer - 1][1]) {
	          // Shift the edit over the previous equality.
	          diffs[pointer][1] = diffs[pointer - 1][1] + diffs[pointer][1].substring(0, diffs[pointer][1].length - diffs[pointer - 1][1].length);
	          diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
	          diffs.splice(pointer - 1, 1);
	          changes = true;
	        } else if (diffPointer.substring(0, diffs[pointer + 1][1].length) === diffs[pointer + 1][1]) {
	          // Shift the edit over the next equality.
	          diffs[pointer - 1][1] += diffs[pointer + 1][1];
	          diffs[pointer][1] = diffs[pointer][1].substring(diffs[pointer + 1][1].length) + diffs[pointer + 1][1];
	          diffs.splice(pointer + 1, 1);
	          changes = true;
	        }
	      }

	      pointer++;
	    } // If shifts were made, the diff needs reordering and another shift sweep.


	    if (changes) {
	      this.diffCleanupMerge(diffs);
	    }
	  };

	  return function (o, n) {
	    var diff, output, text;
	    diff = new DiffMatchPatch();
	    output = diff.DiffMain(o, n);
	    diff.diffCleanupEfficiency(output);
	    text = diff.diffPrettyHtml(output);
	    return text;
	  };
	}();

}((function() { return this; }())));

}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("timers").setImmediate)

},{"_process":2,"timers":4}],4:[function(require,module,exports){
(function (setImmediate,clearImmediate){(function (){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this)}).call(this,require("timers").setImmediate,require("timers").clearImmediate)

},{"process/browser.js":2,"timers":4}],5:[function(require,module,exports){
/*! zzdom - v0.2.0 - 2020-11-12 13:32:51 */
/**
 * A namespace.
 * @const
 */
var zzDOM = {};

/*
    zz function
    
    zz( '#', 'id' );
    zz( '.', 'className' );
    zz( 't', 'tagName' );
    zz( 'tn', 'namespace', 'tagName' );
    zz( 'n', 'name' );
    zz( 's', 'string selector' );
    zz( document.getElementById( 'id' ) ); // Element
    zz( document.getElementsByClassName( 'className' ) ); // HTMLCollection
    zz( document.getElementsByName( 'name' ) ); // NodeList
    zz( 'table.className tr td' ); // String selector
    zz( '<div>New div</div>' ); // HTML code in string
*/
/**
 * @param {string|Element|HTMLCollection|NodeList} x
 * @param {string=} s1
 * @param {string=} s2 
 */
zzDOM.zz = function( x, s1, s2 ){
    
    // Redefine x if a selector id is found
    if ( s1 ){
        switch ( x ){
        case '#':
            x = document.getElementById( s1 );
            break;
        case '.':
            x = document.getElementsByClassName( s1 );
            break;
        case 't':
            x = document.getElementsByTagName( s1 );
            break;
        case 'tn':
            x = document.getElementsByTagNameNS( s1, s2 || '' );
            break;
        case 'n':
            x = document.getElementsByName( s1 );
            break;
        case 's':
            x = document.querySelector( s1 );
            break;
        default:
            throw 'Unsupported selector id found running zz function: ' + x;
        }
    }
    
    // Is it an Element?
    if ( x instanceof Element ){
        return new zzDOM.SS( x );
    }
    
    // Is it an HTMLCollection or a NodeList?
    if ( x instanceof HTMLCollection || x instanceof NodeList ){
        return zzDOM._build( x );
    }
    
    if ( typeof x === 'string' ){
        x = x.trim();
        return zzDOM._build(
            x.charAt( 0 ) === '<'? // Is it HTML code?
                zzDOM._htmlToElement( x ):
                document.querySelectorAll( x ) // Must be a standard selector
        );
    }
    
    throw 'Unsupported selector type found running zz function.';
};

// Build args array with toInsert as first position and then the arguments of this function
zzDOM._args = function( previousArgs, toInsert ){
    var result = Array.prototype.slice.call( previousArgs );
    result.push( toInsert );
    return result;
};

zzDOM._build = function ( x ) {
    if ( x instanceof Element ){
        return new zzDOM.SS( x );
    }
    if ( x instanceof HTMLCollection || x instanceof NodeList ){
        x = Array.prototype.slice.call( x );
    }
    return x.length === 1? new zzDOM.SS( x[ 0 ] ): new zzDOM.MM( x );
};

zzDOM._getError = function ( method ) {
    return 'Method "' + method + '" not ready for that type!';
};

zzDOM._htmlToElement = function ( html ) {
    var template = document.createElement( 'template' );
    template.innerHTML = html.trim();
    return template.content.childElementCount === 1?
        template.content.firstChild:
        template.content.childNodes;
};

// Register zz function
var zz;
(function() { 
    zz = zzDOM.zz; 
})();

zzDOM._events = {};

zzDOM._addEventListener = function( ss, eventName, listener, useCapture ){
    var el = ss.el;
    var elId = ss._getElId();
    var thisEvents = zzDOM._events[ elId ];
    if ( ! thisEvents ){
        thisEvents = {};
        zzDOM._events[ elId ] = thisEvents;
    }
    var thisListeners = thisEvents[ eventName ];
    if ( ! thisListeners ){
        thisListeners = [];
        thisEvents[ eventName ] = thisListeners;
    }
    thisListeners.push( listener );
    
    // addEventListener
    el.addEventListener( eventName, listener, useCapture );
};

//TODO must remove all listeners when an element is removed
zzDOM._removeEventListener = function( ss, eventName, listener, useCapture ){
    var el = ss.el;
    var elId = ss._getElId();
    var thisEvents = zzDOM._events[ elId ];
    if ( ! thisEvents ){
        return;
    }
    
    if ( ! eventName ){ 
        // Must remove all events
        for ( var currentEventName in thisEvents ){
            var currentListeners = thisEvents[ currentEventName ];
            zzDOM._removeListeners( el, currentListeners, null, useCapture, currentEventName );
        }
        return;
    }
    
    // Must remove listeners of only one event
    var thisListeners = thisEvents[ eventName ];
    zzDOM._removeListeners( el, thisListeners, listener, useCapture, eventName );
};

//TODO test all the listeners are removed
zzDOM._removeListeners = function( el, thisListeners, listener, useCapture, eventName ){
    if ( ! thisListeners ){
        return;
    }
    for ( var i = 0; i < thisListeners.length; ++i ){
        var currentListener = thisListeners[ i ];
        if ( ! listener || currentListener === listener ){
            thisListeners.splice( i, 1 ); // Delete listener at i position
            el.removeEventListener( eventName, currentListener, useCapture );
            if ( listener ){
                return;
            }
        }
    } 
};
/* End of events */

zzDOM._dd = {};

zzDOM._getDefaultDisplay = function( el ) {
    var nodeName = el.nodeName;
    var display = zzDOM._dd[ nodeName ];

    if ( display ) {
        return display;
    }

    var doc = el.ownerDocument;
    var temp = doc.body.appendChild( doc.createElement( nodeName ) );
    display = getComputedStyle( temp )[ 'display' ];

    temp.parentNode.removeChild( temp );

    if ( display === 'none' ) {
        display = 'block';
    }
    zzDOM._dd[ nodeName ] = display;

    return display;
};
/* End of visible */

/* It depends on forms plugin! */
// Serialize a ss instance, a mm instance or an object into a query string
zzDOM._paramItem = function( r, key, value ) {
    r.push( 
        encodeURIComponent( key ) + '=' + encodeURIComponent( value == null? '': value )
    );
};
/** @nocollapse */
zzDOM.param = function( x ) {
	
    if ( x == null ) {
        return '';
    }

    var r = [];
    
    if ( x instanceof zzDOM.SS ){
        zzDOM._paramItem( r, x.attr( 'name' ), x.val() );
    } else if ( x instanceof zzDOM.MM ){
        for ( var c = 0; c < x.list.length; ++c ){
            var ss = x.list[ c ];
            zzDOM._paramItem( r, ss.attr( 'name' ), ss.val() );
        }
    } else if ( typeof x === 'object' ){  
        for ( var i in x ) {
            zzDOM._paramItem( r, i, x[ i ] );
        }
    } else {
        throw zzDOM._getError( 'param' );
    }

    return r.join( '&' );
};
/* end of utils */

/** @constructor */
zzDOM.SS = function ( _el ) {
    this.el = _el;
    this.nodes = [ _el ];
    
    // Array like
    this.length = 1;
    this[ 0 ] = _el;
};

/* Methods NOT included in jquery */
zzDOM.SS.prototype._gcs = function ( self, property ) {
    var x = getComputedStyle( self.el, null )[ property ].replace( 'px', '' );
    return isNaN( x )? x: parseFloat( x );
};

zzDOM.SS.prototype._getElId = function(){
    var elId = this.el.getAttribute( 'data-elId' );
    if ( ! elId ){
        // Generate a random string with 4 chars
        elId = Math.floor( ( 1 + Math.random() ) * 0x10000 )
            .toString( 16 )
            .substring( 1 );
        this.el.setAttribute( 'data-elId', elId );
    }
    return elId;
};

zzDOM.SS.prototype._insertHelper = function ( position, x ) {
    if ( x instanceof Element ){
        this.el.insertAdjacentElement( position, x );
    } else if ( x instanceof zzDOM.SS ){
        this.el.insertAdjacentElement( position, x.el );
    } else if ( typeof x === 'string' ) {
        this.el.insertAdjacentHTML( position, x );
    } else {
        throw 'Insert operation not ready for that type!';
    }
    return this;
};

zzDOM.SS.prototype._iterate = function( value, fn ){
    if ( Array.isArray( value ) ){
        for ( var i = 0; i < value.length; ++i ){
            fn( this, value[ i ] );
        }
    } else {
        fn( this, value );   
    }
    return this;
};

zzDOM.SS.prototype._outer = function ( property, linked1, linked2, withMargin ) {
    if ( this.el[ 'offset' + property ] ) {
        return zzDOM.SS._outerCalc( this, property, linked1, linked2, withMargin );
    }
    
    var self = this;
    return this._swap( 
        this.el, 
        function(){
            return zzDOM.SS._outerCalc( self, property, linked1, linked2, withMargin );
        } 
    );
};

zzDOM.SS._outerCalc = function ( ss, property, linked1, linked2, withMargin ) {
    var value = ss._gcs( ss, property.toLowerCase() );
    var padding = ss._gcs( ss, 'padding' + linked1 ) + ss._gcs( ss, 'padding' + linked2 );
    var border = ss._gcs( ss, 'border' + linked1 + 'Width' ) + ss._gcs( ss, 'border' + linked2 + 'Width' );
    
    var total = value + padding + border;
    
    // No margin
    if ( ! withMargin ){
        return total;
    }
    
    var margin = ss._gcs( ss, 'margin' + linked1 ) + ss._gcs( ss, 'margin' + linked2 );
    return total + margin;
};

zzDOM.SS.prototype._setCssUsingKeyValue = function ( key, value ) {
    if ( typeof value === 'function' ) {
        value = value.call( this.el, this._i === undefined? 0: this._i, this );
    }
    this.el.style[ key ] = 
        typeof value === 'string' && ! /^-?\d+\.?\d*$/.test( value )? // if it is a string and is not a float number
            value: 
            value + 'px';
};

zzDOM.SS.prototype._setCssUsingObject = function ( object ) {
    for ( var key in object ) {
        this._setCssUsingKeyValue( key, object[ key ] );
    }
};

/**
 * @param {string} property
 * @param {string|Function=} value
 */
zzDOM.SS.prototype._styleProperty = function ( property, value ) {
    // get
    if ( value === undefined ){
        var self = this;
        value = this._gcs( this, property );
        return parseFloat( 
            value !== 'auto'? 
                value: 
                this._swap( 
                    this.el, 
                    function(){
                        return self._gcs( self, property );
                    } 
                )
        );
    }

    // set
    this._setCssUsingKeyValue( property, value );
    return this;
};

zzDOM.SS.prototype._swap = function( _el, callback ) {
    var old = {};
    var options = {
        display: 'block',
        position: 'absolute',
        visibility: 'hidden'
    };

    // Remember the old values and insert the new ones
    for ( var name in options ) {
        old[ name ] = _el.style[ name ];
        _el.style[ name ] = options[ name ];
    }

    var val = callback.call( _el );

    // Revert the old values
    for ( name in options ) {
        _el.style[ name ] = old[ name ];
    }

    return val;
};

/* Methods included in jquery */
zzDOM.SS.prototype.addClass = function ( name ) {
    return this._iterate(
        name,
        function( self, v ){
            self.el.classList.add( v ); 
        }
    );
};

zzDOM.SS.prototype.after = function ( x ) {
    return this._insertHelper( 'afterend', x );
};

zzDOM.SS.prototype.append = function ( x ) {
    if ( x instanceof Element ){
        this.el.appendChild( x );
    } else if ( x instanceof zzDOM.SS ){
        this.el.appendChild( x.el );
    } else if ( typeof x === 'string' ) {
        this.el.insertAdjacentHTML( 'beforeend', x );
    } else {
        throw zzDOM._getError( 'append' );
    }
    return this;
};

zzDOM.SS.prototype.appendTo = function ( x ) {
    // Do nothing and return this if it is null
    if ( x == null ){
        return this;    
    }
    
    // Is it a Element?
    if ( x instanceof Element ){
        x.appendChild( this.el );
        return this;
    }
    
    // Is it a string?
    if ( typeof x === 'string' ){
        x = zzDOM._build(
            document.querySelectorAll( x )
        );
    }
    
    // Is it a zzDOM.SS?
    if ( x instanceof zzDOM.SS ) {
        x.el.appendChild( this.el );
        return this;
    }
    
    // Is it a zzDOM.MM?
    if ( x instanceof zzDOM.MM ) {
        for ( var i = 0; i < x.nodes.length; ++i ){
            x.nodes[ i ].appendChild( this.el.cloneNode( true ) );
        }
        return this;
    } 
    
    throw zzDOM._getError( 'is' );
};

//TODO add support of function type in value
/**
 * @param {string|Object} x
 * @param {string=} value
 */
zzDOM.SS.prototype.attr = function ( x, value ) {
    // set using object
    if ( typeof x === 'object' ){
        for ( var key in x ) {
            this.attr( key, x[ key ] );
        }
        return this;
    }
    
    // get
    if ( value === undefined ){
        return this.el.getAttribute( x );
    }
    
    // remove attr
    if ( value === null ){
        return this.removeAttr( x );    
    }
    
    // set
    this.el.setAttribute( x, value );
    return this;
};

zzDOM.SS.prototype.before = function ( x ) {
    return this._insertHelper( 'beforebegin', x );
};

zzDOM.SS.prototype.children = function ( selector ) {
    return zzDOM._build( 
        selector?
            Array.prototype.filter.call(
                this.el.children, 
                function( child ){
                    return child.matches( selector );
                }
            ):
            this.el.children 
    );
};

zzDOM.SS.prototype.clone = function (  ) {
    return new zzDOM.SS( this.el.cloneNode( true ) );
};

//TODO add support of function type in value
/**
 * @param {string|Object} x1
 * @param {string|number=} x2
 */
zzDOM.SS.prototype.css = function ( x1, x2 ) {
    var number = arguments.length;
    
    if ( number === 1 ){
        if ( ! x1 ){
            throw 'Null value not allowed in css method!';
        }
        
        // get
        if ( typeof x1 === 'string' ) {
            return getComputedStyle( this.el )[ x1 ];
        }
        
        // set using object
        if ( typeof x1 === 'object' ){
            this._setCssUsingObject( x1 );
            return this;
        }
        
        throw 'Wrong type or argument in css method!';
    }
    
    // set using key value pair
    if ( number === 2 ){
        this._setCssUsingKeyValue( x1, x2 );
        return this;
    }
    
    throw 'Wrong number of arguments in css method!';
};

zzDOM.SS.prototype.each = function ( eachFn ) {
    eachFn.call( this.el, 0, this, this.nodes );
    return this;
};

zzDOM.SS.prototype.empty = function (  ) {
    while( this.el.firstChild ){
        this.el.removeChild( this.el.firstChild );
    }
    return this;
};

zzDOM.SS.prototype.filter = function ( x ) {
    if ( typeof x === 'string' ){ // Is a string selector
        return zzDOM._build( 
            this.el.matches( x )? [ this.el ]: []
        );
    }
    
    if ( typeof x === 'function' ){ // Is a function
        return zzDOM._build(
            x.call( this.el, this._i === undefined? 0: this._i, this )? [ this.el ]: []
        );
    }  
    
    throw zzDOM._getError( 'filter' );
};

zzDOM.SS.prototype.find = function ( selector ) {
    return zzDOM._build( 
        this.el.querySelectorAll( selector )
    );
};

zzDOM.SS.prototype.hasClass = function ( name ) {
    return this.el.classList.contains( name );
};

zzDOM.SS.prototype.height = function ( value ) {
    return this._styleProperty( 'height', value );
};

//TODO add support of function type in value
zzDOM.SS.prototype.html = function ( value ) {
    // get
    if ( value === undefined ){
        return this.el.innerHTML;
    }

    // set
    this.el.innerHTML = value;
    return this;
};

zzDOM.SS.prototype.index = function () {
    if ( ! this.el ){
        return -1;
    }
    
    var i = 0;
    var currentEl = this.el;
    do {
        i++;
    } while ( currentEl = currentEl.previousElementSibling );
    
    return i;
};

zzDOM.SS.prototype.is = function ( x ) {
    if ( x == null ){
        return false;    
    }
    
    if ( x instanceof Element ){
        return this.el === x;
    }
    
    if ( x instanceof zzDOM.SS ) {
        return this.el === x.el;
    } 

    if ( x instanceof zzDOM.MM ) {
        for ( var i = 0; i < x.nodes.length; ++i ){
            if ( this.el === x.nodes[ i ] ){
                return true;
            }
        }
        return false;
    } 

    if ( typeof x === 'string' ){
        return this.el.matches( x );
    }
    
    return false;
};

zzDOM.SS.prototype.next = function () {
    return new zzDOM.SS( this.el.nextElementSibling );
};

zzDOM.SS.prototype.offset = function ( c ) {
    
    // set top and left using css
    if ( c ){
        this._styleProperty( 'top', c.top );
        this._styleProperty( 'left', c.left );
        return this;
    }
    
    // get
    var rect = this.el.getBoundingClientRect();
    return {
        top: rect.top + document.body.scrollTop,
        left: rect.left + document.body.scrollLeft
    };
};

zzDOM.SS.prototype.offsetParent = function () {
    var offsetParent = this.el.offsetParent;
    return offsetParent? new zzDOM.SS( offsetParent ): this;
};

/**
 * @param {boolean=} withMargin
 */
zzDOM.SS.prototype.outerHeight = function ( withMargin ) {
    return this._outer( 'Height', 'Top', 'Bottom', withMargin );
};

/**
 * @param {boolean=} withMargin
 */
zzDOM.SS.prototype.outerWidth = function ( withMargin ) {
    return this._outer( 'Width', 'Left', 'Right', withMargin );
};

zzDOM.SS.prototype.parent = function () {
    return new zzDOM.SS( this.el.parentNode );
};

zzDOM.SS.prototype.position = function ( relativeToViewport ) {
    return relativeToViewport?
        this.el.getBoundingClientRect():
        { 
            left: this.el.offsetLeft, 
            top: this.el.offsetTop
        };
};

zzDOM.SS.prototype.prepend = function ( x ) {
    if ( x instanceof Element ){
        this.el.insertBefore( x, this.el.firstChild );
    } else if ( x instanceof zzDOM.SS ){
        this.el.insertBefore( x.el, this.el.firstChild );
    } else if ( typeof x === 'string' ){
        this.el.insertAdjacentHTML( 'afterbegin', x );
    } else {
        throw zzDOM._getError( 'prepend' );
    }
    return this;
};

zzDOM.SS.prototype.prev = function () {
    return new zzDOM.SS( this.el.previousElementSibling );
};

zzDOM.SS.prototype.remove = function () {
    this.el.parentNode.removeChild( this.el );
    return this;
};

zzDOM.SS.prototype.removeAttr = function ( name ) {
    this.el.removeAttribute( name );
    return this;
};

zzDOM.SS.prototype.removeClass = function ( name ) {
    if ( ! name ){
        this.el.className = '';
        return this;
    }
    
    return this._iterate(
        name,
        function( self, v ){
            self.el.classList.remove( v );
        }
    );
};

zzDOM.SS.prototype.replaceWith = function ( value ) {
    this.el.outerHTML = value;
    return this;
};

zzDOM.SS.prototype.siblings = function ( selector ) {
    var self = this;
    var nodes = Array.prototype.filter.call( 
        this.el.parentNode.children, 
        selector?
            function( child ){
                return child !== self.el && child.matches( selector );
            }:
            function( child ){
                return child !== self.el;
            }
    );
    return zzDOM._build( nodes );
};

//TODO add support of function type in value
zzDOM.SS.prototype.text = function ( value ) {
    // get
    if ( value === undefined ){
        return this.el.textContent;
    }

    // set
    this.el.textContent = value;
    return this;
};

zzDOM.SS.prototype.toggleClass = function ( name, state ) {
    return this._iterate(
        name,
        state === undefined?
            function( self, v ){
                self.el.classList.toggle( v );
            }:
            function( self, v ){
                self.el.classList.toggle( v, state );
            }
    );
};

zzDOM.SS.prototype.width = function ( value ) {
    return this._styleProperty( 'width', value );
};

zzDOM.SS.prototype.off = function ( eventName, listener, useCapture ) {
    zzDOM._removeEventListener( this, eventName, listener, useCapture );
    return this;
};

zzDOM.SS.prototype.on = function ( eventName, listener, data, useCapture ) {
    zzDOM._addEventListener( 
        this, 
        eventName, 
        data? 
            function( e ){
                e.data = data;
                return listener.call( e.currentTarget, e );
            }:
            listener, 
        useCapture 
    );
    return this;
};

zzDOM.SS.prototype.trigger = function ( eventName ) {
    var event = document.createEvent( 'HTMLEvents' );
    event.initEvent( eventName, true, false );
    this.el.dispatchEvent( event );
    return this;
};
/* End of events */

zzDOM.SS.prototype.hide = function () {
    if ( this.isVisible() ){
        this.attr( 
            'data-display', 
            getComputedStyle( this.el, null )[ 'display' ]
        );
        this.el.style.display = 'none';
    }
    return this;
};

zzDOM.SS.prototype.isVisible = function () {
    return !! this.el.offsetParent;
    //return getComputedStyle( this.el, null ).getPropertyValue( 'display' ) !== 'none';
};

zzDOM.SS.prototype.show = function () {
    if ( ! this.isVisible() ){
        var display = this.attr( 'data-display' );
        this.el.style.display = display? display: zzDOM._getDefaultDisplay( this.el );
    }
    return this;
};

zzDOM.SS.prototype.toggle = function ( state ) {
    var value = state !== undefined? ! state: this.isVisible();
    return value? this.hide(): this.show();
};
/* End of visible */

zzDOM.SS.prototype.checked = function ( check ) {
    if ( this.el.nodeName !== 'INPUT' || ( this.el.type !== 'checkbox' && this.el.type !== 'radio') ) {
        throw zzDOM._getError( 'checked' );
    }
    
    // get
    if ( check === undefined ){
        return !! this.el.checked;
    }
    
    // set
    this.el.checked = check;
    return this;
};

/**
 * @param {Array<?>|String=} value
 */
zzDOM.SS.prototype.val = function ( value ) {
    // get
    if ( value === undefined ){
        switch ( this.el.nodeName ) {
        case 'INPUT':
        case 'TEXTAREA':
        case 'BUTTON':
            return this.el.value;
        case 'SELECT':
            var values = [];
            for ( var i = 0; i < this.el.length; ++i ) {
                if ( this.el[ i ].selected ) {
                    values.push( this.el[ i ].value );
                }
            }
            return values.length > 1? values: values[ 0 ];
        default:
            throw zzDOM._getError( 'val' );
        }
    }
    
    // set
    switch ( this.el.nodeName ) {
    case 'INPUT':
    case 'TEXTAREA':
    case 'BUTTON':
        this.el.value = value;
        break;
    case 'SELECT':
        if ( typeof value === 'string' || typeof value === 'number' ) {
            value = [ value ];
        }
        for ( i = 0; i < this.el.length; ++i ) {
            for ( var j = 0; j < value.length; ++j ) {
                this.el[ i ].selected = '';
                if ( this.el[ i ].value === value[ j ] ) {
                    this.el[ i ].selected = 'selected';
                    break;
                }
            }
        }
        break;
    default:
        throw zzDOM._getError( 'val' );
    }
    
    return this;
};
/* End of forms */

zzDOM.SS.prototype.getXCenter = function() {
    return ( document.documentElement.clientWidth - this.outerWidth() ) / 2;
};

zzDOM.SS.prototype.getYCenter = function() {
    return ( document.documentElement.clientHeight - this.outerHeight() ) / 2;
};

zzDOM.SS.prototype.getCenter = function() {
    return {
        left: this.getXCenter(),
        top: this.getYCenter()
    };
};

zzDOM.SS.prototype.center = function() {
    this.offset( 
        this.getCenter() 
    );
    return this;
};

zzDOM.SS.prototype.centerX = function() {
    this.css( 'left', this.getXCenter() );
    return this;
};

zzDOM.SS.prototype.centerY = function() {
    this.css( 'top', this.getYCenter() );
    return this;
};
/* End of center */

/** @constructor */
zzDOM.MM = function ( _nodes ) {    
    this.list = [];
    this.nodes = _nodes;
    this.length = _nodes.length;
    
    // Init nodes
    for ( var i = 0; i < this.length; i++ ) {
        var el = this.nodes[ i ];
        this[ i ] = el; // for array like
        var ss = new zzDOM.SS( el );
        this.list.push( ss );
        ss._i = i; // for index in functions
    }
};

/*
Unify the definition of a function of zzDOM.SS.prototype and a definition of zzDOM.MM.prototype. Example:

    zzDOM.add( 
        zzDOM.SS.prototype.myCustomFunction = function(){
            ...
            return this;
        },
        zzDOM.MM.constructors.concat
    );
);
*/
/**
 * @param {Function} ssPrototype
 * @param {Function=} constructor
 */
zzDOM.add = function( ssPrototype, constructor ){
    for ( var id in zzDOM.SS.prototype ){
        var current = zzDOM.SS.prototype[ id ];
        if ( ssPrototype === current ){
            var closure = function(){
                var functionId = id;
                return constructor? constructor( functionId ): zzDOM.MM.constructors.default( functionId );
            };
            zzDOM.MM.prototype[ id ] = closure();
            return;
        }
    }
    
    throw 'Error registering zzDOM.MM: zzDOM.SS not found.';
};

zzDOM.MM.constructors = {};
zzDOM.MM.constructors.booleanOr = function( functionId ){
    return function(){
        for ( var i = 0; i < this.list.length; i++ ) {
            var ss = this.list[ i ];
            var x = ss[ functionId ].apply( ss, arguments );
            if ( x ){
                return true;
            }
        }
        return false;
    };
};
zzDOM.MM.constructors.concat = function( functionId ){
    return function(){
        var newNodes = [];
        for ( var i = 0; i < this.list.length; i++ ) {
            var ss = this.list[ i ];
            var x = ss[ functionId ].apply( ss, arguments );
            newNodes = newNodes.concat( x.nodes );
        }
        return zzDOM._build( newNodes );
    };
};
zzDOM.MM.constructors.default = function( functionId ){
    return function(){
        for ( var i = 0; i < this.list.length; i++ ) {
            var ss = this.list[ i ];
            var r = ss[ functionId ].apply( ss, arguments );
            if ( i === 0 && ! ( r instanceof zzDOM.SS ) ){
                return r;
            }
        }
        return this;
    };
};

// Init prototype functions from zzDOM.SS
zzDOM.MM.init = function(){
    // Concat functions
    var concatF = [
        'children',
        'clone',
        'filter',
        'find',
        'next',
        'offsetParent',
        'parent',
        'prev',
        'siblings'
    ];
    // Boolean functions
    var booleanOrF = [
        'hasClass',
        'is'
    ];
    for ( var id in zzDOM.SS.prototype ){
        var closure = function(){
            var functionId = id;
            
            if ( concatF.indexOf( functionId ) !== -1 ){
                return zzDOM.MM.constructors.concat( functionId );
            }
            if ( booleanOrF.indexOf( functionId ) !== -1 ){
                return zzDOM.MM.constructors.booleanOr( functionId );
            }
            return zzDOM.MM.constructors.default( functionId );
        };
        zzDOM.MM.prototype[ id ] = closure();
    }
}();

/* Methods included in jquery */
zzDOM.MM.prototype.each = function ( eachFn ) {
    var self = this;
    Array.prototype.forEach.call( 
        this.list, 
        function( currentValue, index ){
            eachFn.call( currentValue.el, index, currentValue, self.nodes );
        }
    );
    return this;
};

// Register zzDOM if we are using Node
if ( typeof module === 'object' && module.exports ) {
    module.exports = zzDOM;
}

},{}],6:[function(require,module,exports){
var zzDOM = require('./build/zzDOM-closures-full.js');
module.exports = zzDOM.zz;

},{"./build/zzDOM-closures-full.js":5}],7:[function(require,module,exports){
// Tests for events

var zz = require( 'zzdom' );
var utils = require( './utils.js' );
var Qunit = require( 'qunit' );

// Unit tests
module.exports = function ( router, eventList ) {

    // Invoked from Simple events test and Simple events keepAlive test
    const simpleEventTest = async function( assert, initEventAgain ){
        // Get a reference to finish the qunit test later
        var done = assert.async();
        
        // Wait in case lazy Url
        await utils.waitShort();

        // Start testing, eventList and expectedEventList must be empty at first
        eventList.length = 0;
        const expectedEventList = [];
        assert.deepEqual( eventList , expectedEventList );

        // Go to page 1
        zz('#home_page1Link').el.click();
        await utils.waitShort();
        expectedEventList.push( 'page1_init' );
        expectedEventList.push( 'page1_mounted' );
        assert.deepEqual( eventList , expectedEventList );

        // Go to home using link
        zz('#page1_homeLink').el.click();
        await utils.waitShort();
        expectedEventList.push( 'page1_beforeOut' );
        expectedEventList.push( 'page1_afterOut' );
        assert.deepEqual( eventList , expectedEventList );

        // Go to page 1 again
        zz('#home_page1Link').el.click();
        await utils.waitShort();
        expectedEventList.push( initEventAgain );
        expectedEventList.push( 'page1_mounted' );
        assert.deepEqual( eventList , expectedEventList );

        // Go to home using back
        history.back();
        await utils.waitShort();
        expectedEventList.push( 'page1_beforeOut' );
        expectedEventList.push( 'page1_afterOut' );
        assert.deepEqual( eventList , expectedEventList );
        
        // Go to page 1 again using forward
        history.forward();
        await utils.waitShort();
        expectedEventList.push( initEventAgain );
        expectedEventList.push( 'page1_mounted' );
        assert.deepEqual( eventList , expectedEventList );
        
        // Go to home using link
        zz('#page1_homeLink').el.click();
        await utils.waitShort();

        // Finish qunit test
        done();
    };

    // Check that all init events are page1_init
    QUnit.test( "Simple events test", async function( assert ) {
        simpleEventTest( assert, 'page1_init' );
    });

    // Check that all the init events except the first one are page1_reinit
    QUnit.test( "Simple events keepAlive test", async function( assert ) {

        // Set keepAlive of page1 to true
        router.routesMap[ 'page1' ].keepAlive = true;

        simpleEventTest( assert, 'page1_reinit' );
    });

    // Invoked from No keep alive in edited page test and Keep alive in edited page
    const editedPageTest = async function( assert, textContent1, textContent2, textContent3, textContent4 ){
        // Get a reference to finish the qunit test later
        var done = assert.async();

        // Go to page 1 and then to textWriter page
        zz('#home_page1Link').el.click();
        await utils.waitShort();
        zz('#page1_textWriterLink').el.click();
        await utils.waitShort();
        assert.equal( zz('#textWriter_history').text(), '' );

        // Add some text and check it is added to textWriter_history
        zz('#textWriter_textToAdd').val( 'First line added' );
        zz('#textWriter_addTextButton').el.click();
        assert.equal( zz('#textWriter_history').text(), textContent1 );

        // Go back to page1, go forward to textWriter page
        history.back();
        await utils.waitShort();
        history.forward();
        await utils.waitShort();
        assert.equal( zz('#textWriter_history').text(), textContent2 );

        // Add some text and check it is added to textWriter_history
        zz('#textWriter_textToAdd').val( 'Second line added' );
        zz('#textWriter_addTextButton').el.click();
        assert.equal( zz('#textWriter_history').text(), textContent3 );

        // Go back to page1, go forward to textWriter page
        history.back();
        await utils.waitShort();
        history.forward();
        await utils.waitShort();
        assert.equal( zz('#textWriter_history').text(), textContent4 );
        
        // Go to home using link
        zz('#textWriter_homeLink').el.click();
        await utils.waitShort();

        // Finish qunit test
        done();
    };

    QUnit.test( "No keep alive in edited page test", async function( assert ) {

        editedPageTest(
            assert,
            'First line added',
            '',
            'Second line added',
            ''
        );
    });

    QUnit.test( "Keep alive in edited page test", async function( assert ) {
        // Set keepAlive of page1 to true
        router.routesMap[ 'textWriter' ].keepAlive = true;
        
        editedPageTest(
            assert,
            'First line added',
            'First line added',
            'First line addedSecond line added',
            'First line addedSecond line added'
        );
    });

};

},{"./utils.js":12,"qunit":3,"zzdom":6}],8:[function(require,module,exports){
"use strict";

var Qunit = require( 'qunit' );
var zz = require( 'zzdom' );
var blueRouter = require( '../../build/blueRouter.js' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Load js of pages
    pages[ 'page1' ] = require( './pages/page1.js' )( eventList );
    pages[ 'textWriter' ] = require( './pages/textWriter.js' );

    // Initialize options: no animations
    let options = {
        eventsByPage: pages,
        animationOut: false,
        animationIn: false,
        routes: require( './routesInlineForEvents.js' )
    };

    // Create new router instance
    return new blueRouter.router( options );
};

// Init router
let eventList = [];
const router = initRouter();

// Unit tests
require( './events.js' )( router, eventList );


},{"../../build/blueRouter.js":1,"./events.js":7,"./pages/page1.js":9,"./pages/textWriter.js":10,"./routesInlineForEvents.js":11,"qunit":3,"zzdom":6}],9:[function(require,module,exports){
/* page1 page */


//module.exports = page;
module.exports = function ( eventList ) {

    const page = {};

    page[ 'init' ] = function( event ){
        //alert( 'EVENT_INIT' );
        eventList.push( 'page1_init' );
    };
    
    page[ 'reinit' ] = function( event ){
        //alert( 'EVENT_REINIT' );
        eventList.push( 'page1_reinit' );
    };
    
    page[ 'mounted' ] = function( event ){
        //alert( 'EVENT_MOUNTED' );
        eventList.push( 'page1_mounted' );
    };
    
    page[ 'beforeOut' ] = function( event ){
        //alert( 'EVENT_BEFORE_OUT' );
        eventList.push( 'page1_beforeOut' );
    };
    
    page[ 'afterOut' ] = function( event ){
        //alert( 'EVENT_AFTER_OUT' );
        eventList.push( 'page1_afterOut' );
    };

    return page;
};

},{}],10:[function(require,module,exports){
/* textWriter page */
const page = {};

page[ 'init' ] = function( event ){
    //alert( 'EVENT_INIT' );

    document.getElementById( 'textWriter_addTextButton' ).addEventListener( 'click', function( event ){
        let text = document.getElementById( 'textWriter_textToAdd' ).value;
        //alert( 'text: ' + text );
        document.getElementById( 'textWriter_history' ).innerHTML += text + '<br>';
        document.getElementById( 'textWriter_textToAdd' ).value = '';
    });
};

page[ 'mounted' ] = function( event ){
    //alert( 'EVENT_MOUNTED' );

    // Add text1 and text2 parameters to textWriter_history
    if ( event.params ){
        if ( event.params.text1 ){
            document.getElementById( 'textWriter_history' ).innerHTML += event.params.text1 + '<br>';
        }
        if ( event.params.text2 ){
            document.getElementById( 'textWriter_history' ).innerHTML += event.params.text2 + '<br>';
        }
    }
};

module.exports = page;

},{}],11:[function(require,module,exports){
// Routes for inline content for event tests
const routes = [
    // Home page
    {
        id: '[home]',
        content: `
<h1>Blue router test</h1>

<div class="page-content">
<h3>Home page</h3>
<p>
    This is Home page
</p>

<ul id="home_links">
    <li>
        <a href="!page1" id="home_page1Link">Page 1</a>. Go to page 1.
    </li>
    <li>
        <a href="!page2" id="home_page2Link">Page 2</a>. Go to page 2.
    </li>
</ul>
</div>
`
    },
    // page1
    {
        id: 'page1',
        content: `
<h1>Blue router test</h1>

<div>
<a href="!" id="page1_homeLink">Home</a>
</div>

<div class="page-content">
<h3>Page 1</h3>
<p>
    This is Page 1
</p>

<ul id="page1_links">
    <li>
        <a href="!textWriter" id="page1_textWriterLink">Text writer</a>. Go to Text writer page.
    </li>
</ul>
</div>
`
    },
    // textWriter
    {
        id: 'textWriter',
        content: `
<h1>Blue router test</h1>

<div>
<a href="!" id="textWriter_homeLink">Home</a>
</div>

<div class="page-content">
<h3>Text writer page</h3>
<p>
    This is the text writer page. Write text and click 'Add text' button or press 'Enter' to add text.
</p>

<div class="field">
    <div>Text</div>
    <div>
        <input type="text" id="textWriter_textToAdd" name="textWriter_textToAdd" required>
        <button id="textWriter_addTextButton">Add text</button>
    </div>
</div>

<div class="field">
    <div>History</div>
    <div id="textWriter_history"></div>
</div>
</div>
`
    },
    // page2
    {
        id: 'page2',
        content: `
<h1>Blue router test</h1>

<div>
<a href="!" id="page2_homeLink">Home</a>
</div>

<div class="page-content">
<h3>Page 2</h3>
<p>
    This is Page 2
</p>
</div>
`
    },
    // Default route (404 page)
    {
        id: '[404]',
        content: `
<h1>Blue router test</h1>

<div>
<a href="!" id="e404_homeLink">Home</a>
</div>

<div class="page-content">
<h3>404 page</h3>
<p>
    Sorry
</p>
<p id="e404_p">
    Requested content not found.
</p>
</div>
`
    }
];

module.exports = routes;



},{}],12:[function(require,module,exports){
const utils = {};

utils.waitShort = function() {
    return utils.wait( 1000 );
};

utils.wait = function( timeout ) {
    return new Promise( resolve => {
        setTimeout( resolve, timeout );
    });
};

module.exports = utils;


},{}]},{},[8])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJidWlsZC9ibHVlUm91dGVyLmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9xdW5pdC9xdW5pdC9xdW5pdC5qcyIsIm5vZGVfbW9kdWxlcy90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzIiwibm9kZV9tb2R1bGVzL3p6ZG9tL2J1aWxkL3p6RE9NLWNsb3N1cmVzLWZ1bGwuanMiLCJub2RlX21vZHVsZXMvenpkb20vaW5kZXguanMiLCJ0ZXN0L2pzL2V2ZW50cy5qcyIsInRlc3QvanMvbm9UcmFuc2l0aW9uRXZlbnRzLmpzIiwidGVzdC9qcy9wYWdlcy9wYWdlMS5qcyIsInRlc3QvanMvcGFnZXMvdGV4dFdyaXRlci5qcyIsInRlc3QvanMvcm91dGVzSW5saW5lRm9yRXZlbnRzLmpzIiwidGVzdC9qcy91dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0bUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN0b09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMWlDQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8qISBibHVlcm91dGVyIC0gdjAuMS4wIC0gMjAyNS0wMS0xNiAxMzozMToyOCAqL1xuLyoqXG4gKiBBIG5hbWVzcGFjZS5cbiAqIEBjb25zdFxuICovXG5jb25zdCBibHVlUm91dGVyID0ge307XG5cblxuLyoqIEBjb25zdHJ1Y3RvciAqL1xuYmx1ZVJvdXRlci5yb3V0ZXIgPSBmdW5jdGlvbiAoIHVzZXJPcHRpb25zICkge1xuXG4gICAgLy8gSW5pdCBvcHRpb25zXG4gICAgdGhpcy5vcHRpb25zID0ge307XG4gICAgYmx1ZVJvdXRlci51dGlscy5leHRlbmQoIHRoaXMub3B0aW9ucywgYmx1ZVJvdXRlci5kZWZhdWx0T3B0aW9ucywgdXNlck9wdGlvbnMgKTtcbiAgICB0aGlzLmNoZWNrT3B0aW9ucygpO1xuXG4gICAgLy8gUHJlbG9hZCBwYWdlcyBpZiBuZWVkZWRcbiAgICBpZiAoIHRoaXMub3B0aW9ucy5wcmVsb2FkUGFnZXNPbkxvYWQgKXtcbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgICAgICBibHVlUm91dGVyLmh0bWxGZXRjaGVyLmxvYWRBbGxVcmxzKFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxmLmluaXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIERvIG5vdCBwcmVsb2FkIHBhZ2VzLCBydW4gaW5pdFxuICAgIHRoaXMuaW5pdCgpO1xufTtcblxuLyogTWV0aG9kcyAqL1xuXG4vKiogQHN1cHByZXNzIHttaXNzaW5nUHJvcGVydGllc30gKi9cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAvLyBJbml0IHNvbWUgb3RoZXIgdmFyc1xuICAgIHRoaXMucm91dGVzTWFwID0gdGhpcy5jcmVhdGVSb3V0ZXNNYXAoKTtcbiAgICB0aGlzLnN0YWNrID0gW107XG5cbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyc0ZvcldpbmRvdygpO1xuXG4gICAgLy8gTmF2aWdhdGUgdG8gd2luZG93LmxvY2F0aW9uLmhyZWYgb3IgaG9tZVxuICAgIHRoaXMubmF2aWdhdGVVcmwoXG4gICAgICAgIHRoaXMub3B0aW9ucy51cGRhdGVPbkxvYWQ/IHdpbmRvdy5sb2NhdGlvbi5ocmVmOiAnJyxcbiAgICAgICAgdGhpcy5vcHRpb25zLmFuaW1hdGVUcmFuc2l0aW9uc09uTG9hZFxuICAgICk7XG59O1xuXG4vLyBDaGVjayB0aGF0IG1hbmRhdG9yeSB1c2VyIGRlZmluZWQgcHJvcGVydGllcyBhcmUgZGVmaW5lZFxuLyoqIEBzdXBwcmVzcyB7bWlzc2luZ1Byb3BlcnRpZXN9ICovXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuY2hlY2tPcHRpb25zID0gZnVuY3Rpb24oKSB7XG5cbiAgICBsZXQgZXJyb3JzID0gMDtcbiAgICBsZXQgZXJyb3JNZXNzYWdlcyA9ICcnO1xuXG4gICAgaWYgKCAhIHRoaXMub3B0aW9ucy5yb3V0ZXMgKXtcbiAgICAgICAgKytlcnJvcnM7XG4gICAgICAgIGVycm9yTWVzc2FnZXMgKz0gJ3JvdXRlcyBtdXN0IGJlIGRlZmluZWQuICc7XG4gICAgfVxuXG4gICAgaWYgKCAhIHRoaXMub3B0aW9ucy5ldmVudHNCeVBhZ2UgKXtcbiAgICAgICAgKytlcnJvcnM7XG4gICAgICAgIGVycm9yTWVzc2FnZXMgKz0gJ2V2ZW50c0J5UGFnZSBtdXN0IGJlIGRlZmluZWQuICc7XG4gICAgfVxuXG4gICAgaWYgKCBlcnJvcnMgKXtcbiAgICAgICAgdGhpcy5hbGVydEVycm9yKCAnVW5hYmxlIHRvIGluaXRhbGl6ZSBCbHVlIHJvdXRlci4gJyArIGVycm9ycyArICcgZXJyb3JzIGZvdW5kOiAnICsgZXJyb3JNZXNzYWdlcyApO1xuICAgIH1cbn07XG5cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5hbGVydEVycm9yID0gZnVuY3Rpb24oIG1lc3NhZ2UgKXtcbiAgICBhbGVydCggbWVzc2FnZSApO1xuICAgIHRocm93IG1lc3NhZ2U7XG59O1xuXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lcnNGb3JXaW5kb3cgPSBmdW5jdGlvbigpIHtcbiAgICAvKlxuICAgIHdpbmRvdy5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHRoaXMubmF2aWdhdGVVcmwoIHRoaXMub3B0aW9ucy51cGRhdGVPbkxvYWQ/IHdpbmRvdy5sb2NhdGlvbi5ocmVmOiAnJywgdHJ1ZSApO1xuICAgIH1cbiAgICAqL1xuICAgIHdpbmRvdy5vbnBvcHN0YXRlID0gKCBlICkgPT4ge1xuICAgICAgICB0aGlzLm5hdmlnYXRlVXJsKCB3aW5kb3cubG9jYXRpb24uaHJlZiwgdHJ1ZSApO1xuICAgICAgICAvL3RoaXMubmF2aWdhdGVVcmwoIGUuc3RhdGVbICdwYWdlJyBdLCB0cnVlICk7XG4gICAgfTtcbn07XG5cbi8qKiBAc3VwcHJlc3Mge21pc3NpbmdQcm9wZXJ0aWVzfSAqL1xuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXJzRm9yTGlua3MgPSBmdW5jdGlvbiggcGFnZUlkICkge1xuICAgIFxuICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgIC8vIEFkZCBldmVudCBsaXN0ZW5lcnMgZm9yIGEgZWxlbWVudHNcbiAgICBibHVlUm91dGVyLnV0aWxzLmFkZEV2ZW50TGlzdGVuZXJPbkxpc3QoXG4gICAgICAgIC8vZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoICdhJyApLFxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggcGFnZUlkICkuZ2V0RWxlbWVudHNCeVRhZ05hbWUoICdhJyApLFxuICAgICAgICAnY2xpY2snLCBcbiAgICAgICAgKGUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGhyZWYgPSBlLnRhcmdldC5nZXRBdHRyaWJ1dGUoICdocmVmJyApO1xuXG4gICAgICAgICAgICAvLyBGb2xsb3cgdGhlIGxpbmsgaWYgaXQgaXMgZXh0ZXJuYWwgKGlmIGl0IGlzIG1hcmtlZCBhcyBleHRlcm5hbCBpbiB0aGUgY2xhc3MgbGlzdClcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICBpZiAoIGUudGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucyAoIHNlbGYub3B0aW9ucy5leHRlcm5hbENsYXNzICkgKXtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgLy8gRm9sbG93IHRoZSBsaW5rIGlmIGl0IGlzIGV4dGVybmFsIChpZiBpdCBkb2VzIG5vdCBzdGFydCBieSAhKVxuICAgICAgICAgICAgaWYgKCAhIGhyZWYuc3RhcnRzV2l0aCggc2VsZi5vcHRpb25zLlBBR0VfUFJFRklYICkgKXtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIGhpc3RvcnkucHVzaFN0YXRlKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJ3BhZ2UnOiBocmVmXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAncGFnZSAnICsgaHJlZixcbiAgICAgICAgICAgICAgICAnIycgKyBocmVmXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgc2VsZi5uYXZpZ2F0ZVVybCggaHJlZiwgdHJ1ZSApO1xuICAgICAgICB9XG4gICAgKTtcbn07XG5cbi8vIENyZWF0ZSBhIG1hcCB3aXRoIHRoZSBkYXRhIGluIHJvdXRlcywgdXNpbmcgdGhlIHBhdGggYXMgdGhlIGtleVxuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmNyZWF0ZVJvdXRlc01hcCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgY29uc3Qgcm91dGVyTWFwID0ge307XG4gICAgY29uc3Qgcm91dGVzID0gdGhpcy5vcHRpb25zLnJvdXRlcyB8fCBbXTtcblxuICAgIHJvdXRlcy5tYXAoIHJvdXRlSXRlbSA9PiB7XG4gICAgICAgIHJvdXRlck1hcFsgcm91dGVJdGVtLmlkIF0gPSByb3V0ZUl0ZW07XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcm91dGVyTWFwO1xufTtcblxuLyoqIEBzdXBwcmVzcyB7bWlzc2luZ1Byb3BlcnRpZXN9ICovXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuZ2V0Um91dGVJdGVtID0gZnVuY3Rpb24oIHBhZ2VJZCApIHtcblxuICAgIC8vIExvb2sgZm9yIHRoZSByb3V0ZVxuICAgIGxldCByb3V0ZUl0ZW0gPSB0aGlzLnJvdXRlc01hcFsgcGFnZUlkIF07XG4gICAgaWYgKCByb3V0ZUl0ZW0gKXtcbiAgICAgICAgcmV0dXJuIHJvdXRlSXRlbTtcbiAgICB9XG5cbiAgICAvLyBObyByb3V0ZSBmb3VuZCwgNDA0IGVycm9yXG4gICAgcm91dGVJdGVtID0gdGhpcy5yb3V0ZXNNYXBbIHRoaXMub3B0aW9ucy5QQUdFX0lEXzQwNF9FUlJPUiBdO1xuICAgIGlmICggcm91dGVJdGVtICl7XG4gICAgICAgIHJldHVybiByb3V0ZUl0ZW07XG4gICAgfVxuXG4gICAgLy8gTm8gNDA0IHBhZ2UsIGJ1aWxkIGEgNDA0IHJvdXRlXG4gICAgcmV0dXJuIHtcbiAgICAgICAgaWQ6IHRoaXMub3B0aW9ucy5QQUdFX0lEXzQwNF9FUlJPUixcbiAgICAgICAgY29udGVudDogJzxoMz40MDQgLSBQYWdlIG5vdCBmb3VuZDogJyArIHBhZ2VJZCArICc8L2gzPidcbiAgICB9O1xuICAgIC8vdGhpcy5hbGVydEVycm9yKCAnTm8gcm91dGUgZm91bmQgd2l0aCBpZCAnICsgcGFnZUlkICsgJyBhbmQgbm8gNDA0IHBhZ2UgZm91bmQuJyApO1xufTtcblxuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLm5hdmlnYXRlVXJsID0gZnVuY3Rpb24oIHVybCwgbXVzdEFuaW1hdGVCeUNvZGUgKSB7XG4gICAgLy9hbGVydCggJ25hdmlnYXRlVXJsXFxudXJsOiAnICsgdXJsICk7XG5cbiAgICAvLyBDcmVhdGUgYW4gdXJsIG9iamVjdCB0byBtYWtlIGl0IGVhc3kgZXZlcnl0aGluZ1xuICAgIGxldCB1cmxPYmplY3QgPSBibHVlUm91dGVyLnV0aWxzLmFuYWxpemVVcmwoIHVybCwgdGhpcy5vcHRpb25zICk7XG5cbiAgICAvLyBVcGRhdGUgc3RhY2sgYW5kIGdldCBjdXJyZW50UGFnZUlkXG4gICAgbGV0IGN1cnJlbnRQYWdlSWQgPSB0aGlzLnVwZGF0ZVN0YWNrKCB1cmxPYmplY3QucGFnZSApO1xuXG4gICAgLy8gRXhpdCBpZiB0cnlpbmcgdG8gbmF2aWdhdGUgdG8gY3VycmVudCBwYWdlXG4gICAgaWYgKCBjdXJyZW50UGFnZUlkID09IHVybE9iamVjdC5wYWdlICl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBHZXQgdGhlIGNvbnRlbnRcbiAgICBsZXQgY29udGVudCA9IHRoaXMuZ2V0Q29udGVudEZvclBhZ2UoIHVybE9iamVjdC5wYWdlICk7XG4gICAgXG4gICAgLy8gSWYgY29udGVudCBpcyBhIFByb21pc2Ugd2FpdCBhbmQgcmVzb2x2ZSBpdFxuICAgIGxldCBzZWxmID0gdGhpcztcbiAgICBpZiAoIGNvbnRlbnQgaW5zdGFuY2VvZiBQcm9taXNlICl7XG4gICAgICAgIGNvbnRlbnQudGhlbiggZnVuY3Rpb24oIHRleHQgKXtcbiAgICAgICAgICAgIC8vIFVwZGF0ZSBjb250ZW50IG9mIHJvdXRlXG4gICAgICAgICAgICBsZXQgcm91dGVJdGVtID0gc2VsZi5nZXRSb3V0ZUl0ZW0oIHVybE9iamVjdC5wYWdlICk7XG4gICAgICAgICAgICByb3V0ZUl0ZW0uY29udGVudCA9IHRleHQ7XG5cbiAgICAgICAgICAgIC8vIFJ1biBkb1BhZ2VUcmFuc2l0aW9uXG4gICAgICAgICAgICBzZWxmLmRvUGFnZVRyYW5zaXRpb24oIHRleHQsIHVybE9iamVjdC5wYWdlLCBjdXJyZW50UGFnZUlkLCB1cmxPYmplY3QsIG11c3RBbmltYXRlQnlDb2RlICk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gY29udGVudCBpcyBOT1QgYSBQcm9taXNlOiB1cGRhdGUgY3VycmVudCBwYWdlXG4gICAgdGhpcy5kb1BhZ2VUcmFuc2l0aW9uKCBjb250ZW50LCB1cmxPYmplY3QucGFnZSwgY3VycmVudFBhZ2VJZCwgdXJsT2JqZWN0LCBtdXN0QW5pbWF0ZUJ5Q29kZSApO1xufTtcblxuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLnVwZGF0ZVN0YWNrID0gZnVuY3Rpb24oIHBhZ2VJZCApIHtcbiAgICBcbiAgICAvLyBJZiB0aGUgcGVudWx0aW1hdGUgZWxlbWVudCBpcyB0aGUgcGFnZUlkIHRoZW4gd2UgYXJlIGdvaW5nIGJhY2t3YXJkczsgb3RoZXJ3aXNlIHdlIGFyZSBnb2luZyBmb3J3YXJkXG4gICAgbGV0IGlzQmFja3dhcmQgPSB0aGlzLnN0YWNrWyB0aGlzLnN0YWNrLmxlbmd0aCAtIDIgXSA9PSBwYWdlSWQ7XG5cbiAgICBpZiAoIGlzQmFja3dhcmQgKXtcbiAgICAgICAgLy8gSXMgYmFja3dhcmRcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhY2sucG9wKCk7XG4gICAgfVxuXG4gICAgLy8gSXMgZm9yd2FyZFxuICAgIHZhciBjdXJyZW50UGFnZUlkID0gdGhpcy5zdGFja1sgdGhpcy5zdGFjay5sZW5ndGggLSAxIF07XG4gICAgdGhpcy5zdGFjay5wdXNoKCBwYWdlSWQgKTtcbiAgICByZXR1cm4gY3VycmVudFBhZ2VJZDtcbn07XG5cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5nZXRDb250ZW50Rm9yUGFnZSA9IGZ1bmN0aW9uKCBwYWdlSWQgKSB7XG5cbiAgICAvLyBHZXQgdGhlIHJvdXRlSXRlbSBmcm9tIHRoZSByb3V0ZXNNYXBcbiAgICBsZXQgcm91dGVJdGVtID0gdGhpcy5nZXRSb3V0ZUl0ZW0oIHBhZ2VJZCApO1xuXG4gICAgLy8gR2V0IHRoZSBjb250ZW50IG9mIHRoYXQgcm91dGVcbiAgICByZXR1cm4gdGhpcy5nZXRDb250ZW50Rm9yUm91dGUoIHJvdXRlSXRlbSApO1xufTtcblxuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmdldENvbnRlbnRGb3JSb3V0ZSA9IGZ1bmN0aW9uKCByb3V0ZUl0ZW0gKSB7XG4gICAgXG4gICAgLy8gQ2hlY2sga2VlcEFsaXZlXG4gICAgaWYgKCByb3V0ZUl0ZW0ua2VlcEFsaXZlICl7XG4gICAgICAgIGxldCBhbGl2ZVBhZ2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggcm91dGVJdGVtLmlkICk7XG4gICAgICAgIGlmICggYWxpdmVQYWdlICl7XG4gICAgICAgICAgICByZXR1cm4gYWxpdmVQYWdlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgY29udGVudFxuICAgIGxldCBjb250ZW50ID0gcm91dGVJdGVtLmNvbnRlbnQ7XG4gICAgaWYgKCBjb250ZW50ICl7XG4gICAgICAgIHJldHVybiBjb250ZW50O1xuICAgIH1cblxuICAgIC8vIENoZWNrIHVybFxuICAgIGxldCB1cmwgPSByb3V0ZUl0ZW0udXJsO1xuICAgIGlmICggdXJsICl7XG4gICAgICAgIHJldHVybiBibHVlUm91dGVyLmh0bWxGZXRjaGVyLmxvYWRVcmwoIHVybCApO1xuICAgIH1cblxuICAgIHJldHVybiAnPGRpdiBpZD1cImVycm9yXCI+Tm8gY29udGVudCBmb3VuZCBmb3Igcm91dGUgZnJvbSBwYXRoICcgKyByb3V0ZUl0ZW0uaWQgKyAnPC9kaXY+Jztcbn07XG5cbi8qKiBAc3VwcHJlc3Mge21pc3NpbmdQcm9wZXJ0aWVzfSAqL1xuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmRvUGFnZVRyYW5zaXRpb24gPSBmdW5jdGlvbiggY29udGVudCwgbmV4dFBhZ2VJZCwgY3VycmVudFBhZ2VJZCwgdXJsT2JqZWN0LCBtdXN0QW5pbWF0ZUJ5Q29kZSApIHtcblxuICAgIC8vIEdldCBtdXN0QW5pbWF0ZU91dCBhbmQgbXVzdEFuaW1hdGVJblxuICAgIGNvbnN0IG11c3RBbmltYXRlT3V0ID0gbXVzdEFuaW1hdGVCeUNvZGUgJiYgISF0aGlzLm9wdGlvbnMuYW5pbWF0aW9uT3V0O1xuICAgIGNvbnN0IG11c3RBbmltYXRlSW4gPSBtdXN0QW5pbWF0ZUJ5Q29kZSAmJiAhIXRoaXMub3B0aW9ucy5hbmltYXRpb25JbjtcblxuICAgIC8vIEdldCB0aGUgaW5pdEV2ZW50XG4gICAgY29uc3QgaW5pdEV2ZW50ID0gY29udGVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50PyBibHVlUm91dGVyLmRlZmF1bHRPcHRpb25zLkVWRU5UX1JFSU5JVDogYmx1ZVJvdXRlci5kZWZhdWx0T3B0aW9ucy5FVkVOVF9JTklUO1xuXG4gICAgLy8gUnVuIGV2ZW50c1xuICAgIHRoaXMucnVuRXZlbnQoIGJsdWVSb3V0ZXIuZGVmYXVsdE9wdGlvbnMuRVZFTlRfQkVGT1JFX09VVCwgY3VycmVudFBhZ2VJZCwge30gKTtcblxuICAgIC8vIEdldCB0aGUgY3VycmVudFBhZ2UgYW5kIGFkZCBuZXh0IHBhZ2VcbiAgICBsZXQgY3VycmVudFBhZ2UgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCAnY3VycmVudFBhZ2UnIClbMF07XG4gICAgbGV0IG5ld1BhZ2UgPSB0aGlzLmFkZE5leHRQYWdlKCBjdXJyZW50UGFnZSwgY29udGVudCwgbmV4dFBhZ2VJZCApO1xuXG4gICAgLy8gUmVuZGVyIG5leHQgcGFnZVxuICAgIHRoaXMucnVuUmVuZGVyUmVsYXRlZCggaW5pdEV2ZW50LCBuZXh0UGFnZUlkLCB1cmxPYmplY3QgKTtcblxuICAgIC8vIERlZmluZSBjdXJyZW50UGFnZUFuaW1hdGlvbmVuZExpc3RlbmVyIGFuZCBuZXdQYWdlQW5pbWF0aW9uZW5kTGlzdGVuZXJcbiAgICBsZXQgc2VsZiA9IHRoaXM7XG4gICAgbGV0IGN1cnJlbnRQYWdlQW5pbWF0aW9uZW5kTGlzdGVuZXIgPSAoKSA9PiB7XG4gICAgICAgIGN1cnJlbnRQYWdlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdhbmltYXRpb25lbmQnLCBjdXJyZW50UGFnZUFuaW1hdGlvbmVuZExpc3RlbmVyICk7XG4gICAgICAgIFxuICAgICAgICAvLyBSZW1vdmUgaGlkZGVuIGNsYXNzLCBhZGQgYW5pbWF0aW9uSW4gY2xhc3NcbiAgICAgICAgbmV3UGFnZS5jbGFzc0xpc3QucmVtb3ZlKCAnaGlkZGVuJyApO1xuICAgICAgICBpZiAoIG11c3RBbmltYXRlSW4gKXtcbiAgICAgICAgICAgIG5ld1BhZ2UuY2xhc3NMaXN0LmFkZCggdGhpcy5vcHRpb25zLmFuaW1hdGlvbkluICk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXRpcmUgY3VycmVudCBwYWdlOiBzYXZlIGl0IGFzIGFuIGFsaXZlIHBhZ2Ugb3IgcmVtb3ZlIGl0XG4gICAgICAgIHRoaXMucmV0aXJlQ3VycmVudFBhZ2UoIGN1cnJlbnRQYWdlSWQsIGN1cnJlbnRQYWdlICk7XG4gICAgICAgIHNlbGYucnVuRXZlbnQoIGJsdWVSb3V0ZXIuZGVmYXVsdE9wdGlvbnMuRVZFTlRfQUZURVJfT1VULCBjdXJyZW50UGFnZUlkLCB7fSApO1xuXG4gICAgICAgIC8vICBSdW4gbmV3UGFnZUFuaW1hdGlvbmVuZExpc3RlbmVyIGlmIGxpc3RlbmVyIG9mIGFtaW1hdGlvbmVuZCBvbiBuZXdQYWdlIHdhcyBub3QgYWRkZWRcbiAgICAgICAgaWYgKCAhIG11c3RBbmltYXRlSW4gKSB7XG4gICAgICAgICAgICBuZXdQYWdlQW5pbWF0aW9uZW5kTGlzdGVuZXIoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBsZXQgbmV3UGFnZUFuaW1hdGlvbmVuZExpc3RlbmVyID0gKCkgPT4ge1xuICAgICAgICBuZXdQYWdlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdhbmltYXRpb25lbmQnLCBuZXdQYWdlQW5pbWF0aW9uZW5kTGlzdGVuZXIgKTtcblxuICAgICAgICAvLyBSZW1vdmUgbmV4dFBhZ2UgY2xhc3MsIGFkZCBjdXJyZW50UGFnZSBjbGFzcywgcmVtb3ZlIGFuaW1hdGlvbkluIGNsYXNzXG4gICAgICAgIG5ld1BhZ2UuY2xhc3NMaXN0LnJlbW92ZSggJ25leHRQYWdlJyApO1xuICAgICAgICBuZXdQYWdlLmNsYXNzTGlzdC5hZGQoICdjdXJyZW50UGFnZScgKTtcbiAgICAgICAgaWYgKCBtdXN0QW5pbWF0ZUluICl7XG4gICAgICAgICAgICBuZXdQYWdlLmNsYXNzTGlzdC5yZW1vdmUoIHRoaXMub3B0aW9ucy5hbmltYXRpb25JbiApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUnVuIEVWRU5UX0lOSVQgb3IgRVZFTlRfUkVJTklUXG4gICAgICAgIHNlbGYucnVuRXZlbnQoIGluaXRFdmVudCwgbmV4dFBhZ2VJZCwgdXJsT2JqZWN0ICk7XG5cbiAgICAgICAgLy8gUnVuIEVWRU5UX01PVU5URURcbiAgICAgICAgc2VsZi5ydW5FdmVudCggYmx1ZVJvdXRlci5kZWZhdWx0T3B0aW9ucy5FVkVOVF9NT1VOVEVELCBuZXh0UGFnZUlkLCB1cmxPYmplY3QgKTtcbiAgICB9O1xuXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVyc1xuICAgIGlmICggbXVzdEFuaW1hdGVPdXQgKXtcbiAgICAgICAgY3VycmVudFBhZ2UuYWRkRXZlbnRMaXN0ZW5lciggJ2FuaW1hdGlvbmVuZCcsIGN1cnJlbnRQYWdlQW5pbWF0aW9uZW5kTGlzdGVuZXIgKTtcbiAgICB9XG4gICAgaWYgKCBtdXN0QW5pbWF0ZUluICl7XG4gICAgICAgIG5ld1BhZ2UuYWRkRXZlbnRMaXN0ZW5lciggJ2FuaW1hdGlvbmVuZCcsIG5ld1BhZ2VBbmltYXRpb25lbmRMaXN0ZW5lciApO1xuICAgIH1cblxuICAgIC8vIEFuaW1hdGUhXG4gICAgaWYgKCBtdXN0QW5pbWF0ZU91dCApe1xuICAgICAgICBjdXJyZW50UGFnZS5jbGFzc0xpc3QuYWRkKCB0aGlzLm9wdGlvbnMuYW5pbWF0aW9uT3V0ICk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY3VycmVudFBhZ2VBbmltYXRpb25lbmRMaXN0ZW5lcigpO1xuICAgIH1cbn07XG5cbi8qKiBAc3VwcHJlc3Mge21pc3NpbmdQcm9wZXJ0aWVzfSAqL1xuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLnJ1blJlbmRlclJlbGF0ZWQgPSBmdW5jdGlvbiggaW5pdEV2ZW50LCBuZXh0UGFnZUlkLCB1cmxPYmplY3QgKXtcblxuICAgIC8vIFJ1biBwcmVFdmVudCAoRVZFTlRfUFJFX0lOSVQgb3IgRVZFTlRfUFJFX1JFSU5JVClcbiAgICBjb25zdCBwcmVFdmVudCA9IGluaXRFdmVudCA9PT0gIHRoaXMub3B0aW9ucy5FVkVOVF9JTklUP1xuICAgICAgICB0aGlzLm9wdGlvbnMuRVZFTlRfUFJFX0lOSVQ6XG4gICAgICAgIHRoaXMub3B0aW9ucy5FVkVOVF9QUkVfUkVJTklUXG5cbiAgICB0aGlzLnJ1bkV2ZW50KCBwcmVFdmVudCwgbmV4dFBhZ2VJZCwgdXJsT2JqZWN0ICk7XG5cbiAgICAvLyBSdW4gcmVuZGVyIGlmIG5lZWRlZFxuICAgIGNvbnN0IHJvdXRlSXRlbSA9IHRoaXMuZ2V0Um91dGVJdGVtKCBuZXh0UGFnZUlkICk7XG4gICAgY29uc3QgcmVuZGVyT3B0aW9uID0gaW5pdEV2ZW50ID09PSAgdGhpcy5vcHRpb25zLkVWRU5UX0lOSVQ/XG4gICAgICAgIHRoaXMub3B0aW9ucy5SVU5fUkVOREVSX0JFRk9SRV9FVkVOVF9JTklUOlxuICAgICAgICB0aGlzLm9wdGlvbnMuUlVOX1JFTkRFUl9CRUZPUkVfRVZFTlRfUkVJTklUO1xuICAgIGNvbnN0IHJvdXRlUHJvcGVydHkgPSBpbml0RXZlbnQgPT09ICB0aGlzLm9wdGlvbnMuRVZFTlRfSU5JVD9cbiAgICAgICAgJ3J1blJlbmRlckJlZm9yZUluaXQnOlxuICAgICAgICAncnVuUmVuZGVyQmVmb3JlUmVpbml0JztcbiAgICBjb25zdCBtdXN0UnVuUmVuZGVyID0gcm91dGVJdGVtWyByb3V0ZVByb3BlcnR5IF0gPT09IHVuZGVmaW5lZD9cbiAgICAgICAgcmVuZGVyT3B0aW9uOlxuICAgICAgICByb3V0ZUl0ZW1bIHJvdXRlUHJvcGVydHkgXTtcblxuICAgIGlmICggbXVzdFJ1blJlbmRlciAmJiB0aGlzLm9wdGlvbnMucmVuZGVyRnVuY3Rpb24gJiYgYmx1ZVJvdXRlci51dGlscy5pc0Z1bmN0aW9uKCB0aGlzLm9wdGlvbnMucmVuZGVyRnVuY3Rpb24gKSApe1xuICAgICAgICB0aGlzLm9wdGlvbnMucmVuZGVyRnVuY3Rpb24oXG4gICAgICAgICAgICB0aGlzLmJ1aWxkUGFnZUluc3RhbmNlKCBuZXh0UGFnZUlkIClcbiAgICAgICAgKTtcbiAgICB9XG59O1xuXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuYnVpbGRQYWdlSW5zdGFuY2UgPSBmdW5jdGlvbiggcGFnZUlkICl7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICAgJ2lkJzogcGFnZUlkLFxuICAgICAgICAgJ2VsJzogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIHBhZ2VJZCApXG4gICAgfTtcbn07XG5cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5hZGROZXh0UGFnZSA9IGZ1bmN0aW9uKCBjdXJyZW50UGFnZSwgY29udGVudCwgbmV4dFBhZ2VJZCApe1xuXG4gICAgaWYgKCBjb250ZW50IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgKXtcbiAgICAgICAgLy8gY29udGVudCBpcyBIVE1MRWxlbWVudFxuICAgICAgICBjdXJyZW50UGFnZS5pbnNlcnRBZGphY2VudEVsZW1lbnQoXG4gICAgICAgICAgICAnYWZ0ZXJlbmQnLFxuICAgICAgICAgICAgY29udGVudFxuICAgICAgICApO1xuICAgICAgICBjb250ZW50LmNsYXNzTGlzdC5hZGQoICduZXh0UGFnZScgKTtcbiAgICAgICAgY29udGVudC5jbGFzc0xpc3QuYWRkKCAnaGlkZGVuJyApO1xuICAgICAgICBjb250ZW50LmNsYXNzTGlzdC5yZW1vdmUoICdhbGl2ZScgKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGNvbnRlbnQgbXVzdCBiZSB0ZXh0XG4gICAgICAgIGN1cnJlbnRQYWdlLmluc2VydEFkamFjZW50SFRNTChcbiAgICAgICAgICAgICdhZnRlcmVuZCcsXG4gICAgICAgICAgICAnPGRpdiBjbGFzcz1cIm5leHRQYWdlIGhpZGRlbiBwYWdlXCIgaWQ9XCInICsgbmV4dFBhZ2VJZCArICdcIj4nXG4gICAgICAgICAgICArIGNvbnRlbnRcbiAgICAgICAgICAgICsgJzwvZGl2PidcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIG5leHRQYWdlSWQgKTtcbn07XG5cbi8vIFJldGlyZSBjdXJyZW50IHBhZ2U6IHNhdmUgaXQgYXMgYW4gYWxpdmUgcGFnZSBvciByZW1vdmUgaXRcbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5yZXRpcmVDdXJyZW50UGFnZSA9IGZ1bmN0aW9uKCBjdXJyZW50UGFnZUlkLCBjdXJyZW50UGFnZSApe1xuXG4gICAgbGV0IGN1cnJlbnRSb3V0ZSA9IHRoaXMuZ2V0Um91dGVJdGVtKCBjdXJyZW50UGFnZUlkICk7XG5cbiAgICAvLyBJZiBtdXN0IGtlZXAgYWxpdmUgY3VycmVudCBwYWdlLCBzZXQgcGFnZSBhbmQgYWxpdmUgYXMgY2xhc3NlcyByZW1vdmluZyB0aGUgcmVzdFxuICAgIGlmICggY3VycmVudFJvdXRlICYmIGN1cnJlbnRSb3V0ZS5rZWVwQWxpdmUpe1xuICAgICAgICBjdXJyZW50UGFnZS5yZW1vdmVBdHRyaWJ1dGUoICdjbGFzcycgKTtcbiAgICAgICAgY3VycmVudFBhZ2UuY2xhc3NMaXN0LmFkZCggJ3BhZ2UnICk7XG4gICAgICAgIGN1cnJlbnRQYWdlLmNsYXNzTGlzdC5hZGQoICdhbGl2ZScgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIERvIG5vdCBrZWVwIGFsaXZlIGN1cnJlbnQgcGFnZSwgc28gcmVtb3ZlIGl0XG4gICAgY3VycmVudFBhZ2UucmVtb3ZlKCk7XG59O1xuXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUucnVuRXZlbnQgPSBmdW5jdGlvbiggZXZlbnRJZCwgcGFnZUlkLCB1cmxPYmplY3QgKSB7XG5cbiAgICBpZiAoIGV2ZW50SWQgPT0gYmx1ZVJvdXRlci5kZWZhdWx0T3B0aW9ucy5FVkVOVF9JTklUICl7XG4gICAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnNGb3JMaW5rcyggcGFnZUlkICk7XG4gICAgfVxuXG4gICAgLy8gR2V0IHRoZSBwYWdlIG9iamVjdCBmcm9tIG9wdGlvbnNcbiAgICAvKiogQHN1cHByZXNzIHttaXNzaW5nUHJvcGVydGllc30gKi9cbiAgICBsZXQgcGFnZSA9IHRoaXMub3B0aW9ucy5ldmVudHNCeVBhZ2VbIHBhZ2VJZCBdO1xuXG4gICAgLy8gSWYgYSBwYWdlIGlzIGZvdW5kLCBydW4gdGhlIGV2ZW50IGhhbmRsZXJcbiAgICBpZiAoIHBhZ2UgKXtcbiAgICAgICAgbGV0IGV2ZW50ID0ge1xuICAgICAgICAgICAgcGFyYW1zOiB1cmxPYmplY3QucGFyYW1zIHx8IHt9XG4gICAgICAgIH07XG4gICAgICAgIGlmICggcGFnZVsgZXZlbnRJZCBdICYmIGJsdWVSb3V0ZXIudXRpbHMuaXNGdW5jdGlvbiggcGFnZVsgZXZlbnRJZCBdICkgKXtcbiAgICAgICAgICAgIHBhZ2VbIGV2ZW50SWQgXSggZXZlbnQgKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblxuLy8gRGVmYXVsdCBvcHRpb25zXG5cbmJsdWVSb3V0ZXIuZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgdXBkYXRlT25Mb2FkOiB0cnVlLFxuICAgIHByZWxvYWRQYWdlc09uTG9hZDogZmFsc2UsXG5cbiAgICAvLyBBbmltYXRpb25zXG4gICAgYW5pbWF0aW9uT3V0OiAnc2xpZGUtb3V0LXRvcCcsXG4gICAgLy9hbmltYXRpb25PdXQ6IGZhbHNlLFxuICAgIGFuaW1hdGlvbkluOiAnc2NhbGUtaW4tY2VudGVyJyxcbiAgICAvL2FuaW1hdGlvbkluOiBmYWxzZSxcbiAgICBhbmltYXRlVHJhbnNpdGlvbnNPbkxvYWQ6IGZhbHNlLFxuICAgIFxuICAgIC8vIE1pc2NcbiAgICBQQUdFX1BSRUZJWDogJyEnLFxuXG4gICAgLy8gU3BlY2lhbCBwYWdlcyBpZHNcbiAgICBQQUdFX0lEX0hPTUU6ICdbaG9tZV0nLFxuICAgIFBBR0VfSURfNDA0X0VSUk9SOiAnWzQwNF0nLFxuXG4gICAgLy8gRXZlbnRzXG4gICAgRVZFTlRfUFJFX0lOSVQ6ICdwcmVJbml0JyxcbiAgICBFVkVOVF9JTklUOiAnaW5pdCcsXG4gICAgRVZFTlRfUFJFX1JFSU5JVDogJ3ByZVJlaW5pdCcsXG4gICAgRVZFTlRfUkVJTklUOiAncmVpbml0JyxcbiAgICBFVkVOVF9NT1VOVEVEOiAnbW91bnRlZCcsXG4gICAgRVZFTlRfQkVGT1JFX09VVDogJ2JlZm9yZU91dCcsXG4gICAgRVZFTlRfQUZURVJfT1VUOiAnYWZ0ZXJPdXQnLFxuXG4gICAgUlVOX1JFTkRFUl9CRUZPUkVfRVZFTlRfSU5JVDogdHJ1ZSxcbiAgICBSVU5fUkVOREVSX0JFRk9SRV9FVkVOVF9SRUlOSVQ6IGZhbHNlXG5cbn07XG5cblxuYmx1ZVJvdXRlci5odG1sRmV0Y2hlciA9IHt9O1xuXG5ibHVlUm91dGVyLmh0bWxGZXRjaGVyLmxvYWRBbGxVcmxzID0gZnVuY3Rpb24oIHJvdXRlciwgY2FsbGJhY2sgKXtcblxuICAgIC8vIEdldCB0aGUgcm91dGVzIHRvIHVzZVxuICAgIGNvbnN0IHJvdXRlcyA9IHJvdXRlci5vcHRpb25zLnJvdXRlcyB8fCBbXTtcblxuICAgIC8vIEluaXQgdGhlIG51bWJlciBvdCB1cmxzIHRvIGdldFxuICAgIGxldCBwZW5kaW5nID0gMDtcblxuICAgIC8vIEl0ZXJhdGUgdXJsUm91dGVzIGFuZCBsb2FkIGVhY2ggcm91dGVJdGVtIGlmIG5lZWRlZFxuICAgIHJvdXRlcy5tYXAoIHJvdXRlSXRlbSA9PiB7XG4gICAgICAgIGxldCB1cmwgPSByb3V0ZUl0ZW0udXJsO1xuICAgICAgICBpZiAoIHVybCApe1xuICAgICAgICAgICAgKytwZW5kaW5nO1xuICAgICAgICAgICAgYmx1ZVJvdXRlci5odG1sRmV0Y2hlci5sb2FkVXJsKCB1cmwgKS50aGVuKFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCB0ZXh0ICl7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBjb250ZW50IG9mIHJvdXRlXG4gICAgICAgICAgICAgICAgICAgIHJvdXRlSXRlbS5jb250ZW50ID0gdGV4dDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBSdW4gY2FsbGJhY2sgd2hlbiBhbGwgZmlsZXMgaGF2ZSBiZWVuIGxvYWRlZFxuICAgICAgICAgICAgICAgICAgICBpZiAoIC0tcGVuZGluZyA9PSAwICYmIGNhbGxiYWNrICYmIGJsdWVSb3V0ZXIudXRpbHMuaXNGdW5jdGlvbiggY2FsbGJhY2sgKSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd9IHVybFxuICogXG4gKi9cbmJsdWVSb3V0ZXIuaHRtbEZldGNoZXIubG9hZFVybCA9IGFzeW5jIGZ1bmN0aW9uKCB1cmwgKXtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goIHVybCApO1xuXG4gICAgaWYgKCAhIHJlc3BvbnNlLm9rICkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gYEVycm9yIGZldGNoaW5nICR7dXJsfSBoYXMgb2NjdXJlZDogJHtyZXNwb25zZS5zdGF0dXN9YDtcbiAgICAgICAgYWxlcnQgKCBtZXNzYWdlICk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvciggbWVzc2FnZSApO1xuICAgIH1cbiAgXG4gICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICByZXR1cm4gdGV4dDtcbn07XG5cbmJsdWVSb3V0ZXIudXRpbHMgPSB7fTtcblxuLypcbiAgICBCdWlsZHMgYW4gb2JqZWN0IHdpdGggZGF0YSBhYm91dCB0aGUgdXJsLiBBbiBleGFtcGxlOlxuXG4gICAgdXJsIDogaHR0cDovLzEyNy4wLjAuMTo5MDAwL3NhbXBsZXMvc2FtcGxlLmh0bWwjIWFib3V0P3BhcmFtMT1hJnBhcmFtMj1iXCJcblxuICAgIHByZXBhZ2U6IGh0dHA6Ly8xMjcuMC4wLjE6OTAwMC9zYW1wbGVzL3NhbXBsZS5odG1sXG4gICAgcGFnZTogYWJvdXRcbiAgICBwYXJhbXM6IHtcbiAgICAgICAgcGFyYW0xOiBhXG4gICAgICAgIHBhcmFtMjogYlxuICAgIH1cbiovXG5ibHVlUm91dGVyLnV0aWxzLmFuYWxpemVVcmwgPSBmdW5jdGlvbiggdXJsLCBvcHRpb25zICkge1xuICAgIFxuICAgIGxldCByZXN1bHQgPSB7fTtcblxuICAgIC8vIEV4dHJhY3QgdGhlIHBhcnRzIGJlZm9yZSBhbmQgYWZ0ZXIgUEFHRV9QUkVGSVhcbiAgICBsZXQgdXJsUGFydHMgPSB1cmwuc3BsaXQoIG9wdGlvbnMuUEFHRV9QUkVGSVggKTtcbiAgICByZXN1bHQucHJlcGFnZSA9IHVybFBhcnRzWyAwIF07XG4gICAgbGV0IHBvc3RQYXRoID0gdXJsUGFydHNbIDEgXSB8fCAnJztcblxuICAgIC8vIFJlbW92ZSAjIGlmIHByZXNlbnRcbiAgICBpZiAoIHJlc3VsdC5wcmVwYWdlLmVuZHNXaXRoKCAnIycgKSApe1xuICAgICAgICByZXN1bHQucHJlcGFnZSA9IHJlc3VsdC5wcmVwYWdlLnNsaWNlKCAwLCAtMSApO1xuICAgIH1cblxuICAgIC8vIEV4dHJhY3QgdGhlIHBhcnRzIGJlZm9yZSBhbmQgYWZ0ZXIgP1xuICAgIGxldCBwYXRoUGFydHMgPSBwb3N0UGF0aC5zcGxpdCggJz8nICk7XG4gICAgcmVzdWx0LnBhZ2UgPSBwYXRoUGFydHNbIDAgXTtcblxuICAgIC8vIEZpeCBob21lIHBhZ2VcbiAgICBpZiAoIHJlc3VsdC5wYWdlID09ICcnKSB7XG4gICAgICAgIHJlc3VsdC5wYWdlID0gb3B0aW9ucy5QQUdFX0lEX0hPTUU7XG4gICAgfVxuXG4gICAgbGV0IHBhcmFtc1N0cmluZyA9IHBhdGhQYXJ0c1sgMSBdIHx8ICcnO1xuXG4gICAgLy8gQWRkIHBhcmFtc1xuICAgIHJlc3VsdC5wYXJhbXMgPSB7fTtcbiAgICBpZiAoIHBhcmFtc1N0cmluZyA9PSAnJyApe1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICBsZXQgdmFycyA9IHBhcmFtc1N0cmluZy5zcGxpdCggJyYnICk7XG4gICAgZm9yICggbGV0IGkgPSAwOyBpIDwgdmFycy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgbGV0IHBhaXIgPSB2YXJzWyBpIF0uc3BsaXQoICc9JyApO1xuICAgICAgICBsZXQgcGFyYW1OYW1lID0gcGFpclsgMCBdO1xuICAgICAgICBsZXQgcGFyYW1WYWx1ZSA9IHBhaXJbIDEgXTtcbiAgICAgICAgcmVzdWx0LnBhcmFtc1sgcGFyYW1OYW1lIF0gPSBwYXJhbVZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5ibHVlUm91dGVyLnV0aWxzLmFkZEV2ZW50TGlzdGVuZXJPbkxpc3QgPSBmdW5jdGlvbiggbGlzdCwgZXZlbnQsIGZuICkge1xuXG4gICAgZm9yICggbGV0IGkgPSAwLCBsZW4gPSBsaXN0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrICkge1xuICAgICAgICBsaXN0WyBpIF0uYWRkRXZlbnRMaXN0ZW5lciggZXZlbnQsIGZuLCBmYWxzZSApO1xuICAgIH1cbn07XG5cbmJsdWVSb3V0ZXIudXRpbHMuZXh0ZW5kID0gZnVuY3Rpb24oIG91dCwgZnJvbTEsIGZyb20yICkge1xuICAgIG91dCA9IG91dCB8fCB7fTtcblxuICAgIGZvciAoIHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgaWYgKCAhIGFyZ3VtZW50c1sgaSBdICl7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoIHZhciBrZXkgaW4gYXJndW1lbnRzWyBpIF0gKSB7XG4gICAgICAgICAgICBpZiAoIGFyZ3VtZW50c1sgaSBdLmhhc093blByb3BlcnR5KCBrZXkgKSApe1xuICAgICAgICAgICAgICAgIG91dFsga2V5IF0gPSBhcmd1bWVudHNbIGkgXVsga2V5IF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb3V0O1xufTtcblxuLyogZm9ybWF0U3RyaW5nICovXG4vLyBFeGFtcGxlOiBpdGlscy5mb3JtYXRTdHJpbmcoICd7MH0gaXMgZGVhZCwgYnV0IHsxfSBpcyBhbGl2ZSEnLCAnQVNQJywgJ0FTUC5ORVQnIClcbi8qKlxuICogVGFrZXMgMSBvciBtb3JlIHN0cmluZ3MgYW5kIGRvIHNvbWV0aGluZyBjb29sIHdpdGggdGhlbS5cbiAqIEBwYXJhbSB7Li4uc3RyaW5nfG51bWJlcn0gZm9ybWF0XG4gKi9cbmJsdWVSb3V0ZXIudXRpbHMuZm9ybWF0U3RyaW5nID0gZnVuY3Rpb24oIGZvcm1hdCApIHtcbiAgICBcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBhcmd1bWVudHMsIDEgKTtcbiAgICByZXR1cm4gZm9ybWF0LnJlcGxhY2UoL3soXFxkKyl9L2csIGZ1bmN0aW9uICggbWF0Y2gsIG51bWJlciApIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBhcmdzWyBudW1iZXIgXSAhPSAndW5kZWZpbmVkJz8gYXJnc1sgbnVtYmVyIF0gOiBtYXRjaDtcbiAgICB9KTtcbn07XG5cbmJsdWVSb3V0ZXIudXRpbHMuaXNGdW5jdGlvbiA9IGZ1bmN0aW9uIGlzRnVuY3Rpb24oIG9iaiApIHtcblxuICAgIC8vIFN1cHBvcnQ6IENocm9tZSA8PTU3LCBGaXJlZm94IDw9NTJcbiAgICAvLyBJbiBzb21lIGJyb3dzZXJzLCB0eXBlb2YgcmV0dXJucyBcImZ1bmN0aW9uXCIgZm9yIEhUTUwgPG9iamVjdD4gZWxlbWVudHNcbiAgICAvLyAoaS5lLiwgYHR5cGVvZiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCBcIm9iamVjdFwiICkgPT09IFwiZnVuY3Rpb25cImApLlxuICAgIC8vIFdlIGRvbid0IHdhbnQgdG8gY2xhc3NpZnkgKmFueSogRE9NIG5vZGUgYXMgYSBmdW5jdGlvbi5cbiAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBvYmoubm9kZVR5cGUgIT09IFwibnVtYmVyXCI7XG59O1xuLyogZW5kIG9mIHV0aWxzICovXG5cbi8vIFJlZ2lzdGVyIGJsdWVSb3V0ZXIgaWYgd2UgYXJlIHVzaW5nIE5vZGVcbmlmICggdHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMgKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBibHVlUm91dGVyO1xufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qIVxuICogUVVuaXQgMi4xMS4zXG4gKiBodHRwczovL3F1bml0anMuY29tL1xuICpcbiAqIENvcHlyaWdodCBPcGVuSlMgRm91bmRhdGlvbiBhbmQgb3RoZXIgY29udHJpYnV0b3JzXG4gKiBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2VcbiAqIGh0dHBzOi8vanF1ZXJ5Lm9yZy9saWNlbnNlXG4gKlxuICogRGF0ZTogMjAyMC0xMC0wNVQwMTozNFpcbiAqL1xuKGZ1bmN0aW9uIChnbG9iYWwkMSkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0ZnVuY3Rpb24gX2ludGVyb3BEZWZhdWx0TGVnYWN5IChlKSB7IHJldHVybiBlICYmIHR5cGVvZiBlID09PSAnb2JqZWN0JyAmJiAnZGVmYXVsdCcgaW4gZSA/IGUgOiB7ICdkZWZhdWx0JzogZSB9OyB9XG5cblx0dmFyIGdsb2JhbF9fZGVmYXVsdCA9IC8qI19fUFVSRV9fKi9faW50ZXJvcERlZmF1bHRMZWdhY3koZ2xvYmFsJDEpO1xuXG5cdHZhciB3aW5kb3ckMSA9IGdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddLndpbmRvdztcblx0dmFyIHNlbGYkMSA9IGdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddLnNlbGY7XG5cdHZhciBjb25zb2xlID0gZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10uY29uc29sZTtcblx0dmFyIHNldFRpbWVvdXQkMSA9IGdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddLnNldFRpbWVvdXQ7XG5cdHZhciBjbGVhclRpbWVvdXQgPSBnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXS5jbGVhclRpbWVvdXQ7XG5cdHZhciBkb2N1bWVudCQxID0gd2luZG93JDEgJiYgd2luZG93JDEuZG9jdW1lbnQ7XG5cdHZhciBuYXZpZ2F0b3IgPSB3aW5kb3ckMSAmJiB3aW5kb3ckMS5uYXZpZ2F0b3I7XG5cdHZhciBsb2NhbFNlc3Npb25TdG9yYWdlID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciB4ID0gXCJxdW5pdC10ZXN0LXN0cmluZ1wiO1xuXG5cdCAgdHJ5IHtcblx0ICAgIGdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddLnNlc3Npb25TdG9yYWdlLnNldEl0ZW0oeCwgeCk7XG5cdCAgICBnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXS5zZXNzaW9uU3RvcmFnZS5yZW1vdmVJdGVtKHgpO1xuXHQgICAgcmV0dXJuIGdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddLnNlc3Npb25TdG9yYWdlO1xuXHQgIH0gY2F0Y2ggKGUpIHtcblx0ICAgIHJldHVybiB1bmRlZmluZWQ7XG5cdCAgfVxuXHR9KCk7IC8vIFN1cHBvcnQgSUUgOS0xMDogRmFsbGJhY2sgZm9yIGZ1enp5c29ydC5qcyB1c2VkIGJ5IC9yZXBvcnRlci9odG1sLmpzXG5cblx0aWYgKCFnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXS5NYXApIHtcblx0ICBnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXS5NYXAgPSBmdW5jdGlvbiBTdHJpbmdNYXAoKSB7XG5cdCAgICB2YXIgc3RvcmUgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG5cdCAgICB0aGlzLmdldCA9IGZ1bmN0aW9uIChzdHJLZXkpIHtcblx0ICAgICAgcmV0dXJuIHN0b3JlW3N0cktleV07XG5cdCAgICB9O1xuXG5cdCAgICB0aGlzLnNldCA9IGZ1bmN0aW9uIChzdHJLZXksIHZhbCkge1xuXHQgICAgICBzdG9yZVtzdHJLZXldID0gdmFsO1xuXHQgICAgICByZXR1cm4gdGhpcztcblx0ICAgIH07XG5cblx0ICAgIHRoaXMuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHN0b3JlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0ICAgIH07XG5cdCAgfTtcblx0fVxuXG5cdGZ1bmN0aW9uIF90eXBlb2Yob2JqKSB7XG5cdCAgXCJAYmFiZWwvaGVscGVycyAtIHR5cGVvZlwiO1xuXG5cdCAgaWYgKHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcInN5bWJvbFwiKSB7XG5cdCAgICBfdHlwZW9mID0gZnVuY3Rpb24gKG9iaikge1xuXHQgICAgICByZXR1cm4gdHlwZW9mIG9iajtcblx0ICAgIH07XG5cdCAgfSBlbHNlIHtcblx0ICAgIF90eXBlb2YgPSBmdW5jdGlvbiAob2JqKSB7XG5cdCAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9iai5jb25zdHJ1Y3RvciA9PT0gU3ltYm9sICYmIG9iaiAhPT0gU3ltYm9sLnByb3RvdHlwZSA/IFwic3ltYm9sXCIgOiB0eXBlb2Ygb2JqO1xuXHQgICAgfTtcblx0ICB9XG5cblx0ICByZXR1cm4gX3R5cGVvZihvYmopO1xuXHR9XG5cblx0ZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3Rvcikge1xuXHQgIGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7XG5cdCAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpO1xuXHQgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIF9kZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHtcblx0ICBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldO1xuXHQgICAgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlO1xuXHQgICAgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlO1xuXHQgICAgaWYgKFwidmFsdWVcIiBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTtcblx0ICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTtcblx0ICB9XG5cdH1cblxuXHRmdW5jdGlvbiBfY3JlYXRlQ2xhc3MoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG5cdCAgaWYgKHByb3RvUHJvcHMpIF9kZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7XG5cdCAgaWYgKHN0YXRpY1Byb3BzKSBfZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpO1xuXHQgIHJldHVybiBDb25zdHJ1Y3Rvcjtcblx0fVxuXG5cdGZ1bmN0aW9uIF90b0NvbnN1bWFibGVBcnJheShhcnIpIHtcblx0ICByZXR1cm4gX2FycmF5V2l0aG91dEhvbGVzKGFycikgfHwgX2l0ZXJhYmxlVG9BcnJheShhcnIpIHx8IF91bnN1cHBvcnRlZEl0ZXJhYmxlVG9BcnJheShhcnIpIHx8IF9ub25JdGVyYWJsZVNwcmVhZCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gX2FycmF5V2l0aG91dEhvbGVzKGFycikge1xuXHQgIGlmIChBcnJheS5pc0FycmF5KGFycikpIHJldHVybiBfYXJyYXlMaWtlVG9BcnJheShhcnIpO1xuXHR9XG5cblx0ZnVuY3Rpb24gX2l0ZXJhYmxlVG9BcnJheShpdGVyKSB7XG5cdCAgaWYgKHR5cGVvZiBTeW1ib2wgIT09IFwidW5kZWZpbmVkXCIgJiYgU3ltYm9sLml0ZXJhdG9yIGluIE9iamVjdChpdGVyKSkgcmV0dXJuIEFycmF5LmZyb20oaXRlcik7XG5cdH1cblxuXHRmdW5jdGlvbiBfdW5zdXBwb3J0ZWRJdGVyYWJsZVRvQXJyYXkobywgbWluTGVuKSB7XG5cdCAgaWYgKCFvKSByZXR1cm47XG5cdCAgaWYgKHR5cGVvZiBvID09PSBcInN0cmluZ1wiKSByZXR1cm4gX2FycmF5TGlrZVRvQXJyYXkobywgbWluTGVuKTtcblx0ICB2YXIgbiA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKS5zbGljZSg4LCAtMSk7XG5cdCAgaWYgKG4gPT09IFwiT2JqZWN0XCIgJiYgby5jb25zdHJ1Y3RvcikgbiA9IG8uY29uc3RydWN0b3IubmFtZTtcblx0ICBpZiAobiA9PT0gXCJNYXBcIiB8fCBuID09PSBcIlNldFwiKSByZXR1cm4gQXJyYXkuZnJvbShvKTtcblx0ICBpZiAobiA9PT0gXCJBcmd1bWVudHNcIiB8fCAvXig/OlVpfEkpbnQoPzo4fDE2fDMyKSg/OkNsYW1wZWQpP0FycmF5JC8udGVzdChuKSkgcmV0dXJuIF9hcnJheUxpa2VUb0FycmF5KG8sIG1pbkxlbik7XG5cdH1cblxuXHRmdW5jdGlvbiBfYXJyYXlMaWtlVG9BcnJheShhcnIsIGxlbikge1xuXHQgIGlmIChsZW4gPT0gbnVsbCB8fCBsZW4gPiBhcnIubGVuZ3RoKSBsZW4gPSBhcnIubGVuZ3RoO1xuXG5cdCAgZm9yICh2YXIgaSA9IDAsIGFycjIgPSBuZXcgQXJyYXkobGVuKTsgaSA8IGxlbjsgaSsrKSBhcnIyW2ldID0gYXJyW2ldO1xuXG5cdCAgcmV0dXJuIGFycjI7XG5cdH1cblxuXHRmdW5jdGlvbiBfbm9uSXRlcmFibGVTcHJlYWQoKSB7XG5cdCAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgYXR0ZW1wdCB0byBzcHJlYWQgbm9uLWl0ZXJhYmxlIGluc3RhbmNlLlxcbkluIG9yZGVyIHRvIGJlIGl0ZXJhYmxlLCBub24tYXJyYXkgb2JqZWN0cyBtdXN0IGhhdmUgYSBbU3ltYm9sLml0ZXJhdG9yXSgpIG1ldGhvZC5cIik7XG5cdH1cblxuXHRmdW5jdGlvbiBfY3JlYXRlRm9yT2ZJdGVyYXRvckhlbHBlcihvLCBhbGxvd0FycmF5TGlrZSkge1xuXHQgIHZhciBpdDtcblxuXHQgIGlmICh0eXBlb2YgU3ltYm9sID09PSBcInVuZGVmaW5lZFwiIHx8IG9bU3ltYm9sLml0ZXJhdG9yXSA9PSBudWxsKSB7XG5cdCAgICBpZiAoQXJyYXkuaXNBcnJheShvKSB8fCAoaXQgPSBfdW5zdXBwb3J0ZWRJdGVyYWJsZVRvQXJyYXkobykpIHx8IGFsbG93QXJyYXlMaWtlICYmIG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSB7XG5cdCAgICAgIGlmIChpdCkgbyA9IGl0O1xuXHQgICAgICB2YXIgaSA9IDA7XG5cblx0ICAgICAgdmFyIEYgPSBmdW5jdGlvbiAoKSB7fTtcblxuXHQgICAgICByZXR1cm4ge1xuXHQgICAgICAgIHM6IEYsXG5cdCAgICAgICAgbjogZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgaWYgKGkgPj0gby5sZW5ndGgpIHJldHVybiB7XG5cdCAgICAgICAgICAgIGRvbmU6IHRydWVcblx0ICAgICAgICAgIH07XG5cdCAgICAgICAgICByZXR1cm4ge1xuXHQgICAgICAgICAgICBkb25lOiBmYWxzZSxcblx0ICAgICAgICAgICAgdmFsdWU6IG9baSsrXVxuXHQgICAgICAgICAgfTtcblx0ICAgICAgICB9LFxuXHQgICAgICAgIGU6IGZ1bmN0aW9uIChlKSB7XG5cdCAgICAgICAgICB0aHJvdyBlO1xuXHQgICAgICAgIH0sXG5cdCAgICAgICAgZjogRlxuXHQgICAgICB9O1xuXHQgICAgfVxuXG5cdCAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBhdHRlbXB0IHRvIGl0ZXJhdGUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlLlxcbkluIG9yZGVyIHRvIGJlIGl0ZXJhYmxlLCBub24tYXJyYXkgb2JqZWN0cyBtdXN0IGhhdmUgYSBbU3ltYm9sLml0ZXJhdG9yXSgpIG1ldGhvZC5cIik7XG5cdCAgfVxuXG5cdCAgdmFyIG5vcm1hbENvbXBsZXRpb24gPSB0cnVlLFxuXHQgICAgICBkaWRFcnIgPSBmYWxzZSxcblx0ICAgICAgZXJyO1xuXHQgIHJldHVybiB7XG5cdCAgICBzOiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGl0ID0gb1tTeW1ib2wuaXRlcmF0b3JdKCk7XG5cdCAgICB9LFxuXHQgICAgbjogZnVuY3Rpb24gKCkge1xuXHQgICAgICB2YXIgc3RlcCA9IGl0Lm5leHQoKTtcblx0ICAgICAgbm9ybWFsQ29tcGxldGlvbiA9IHN0ZXAuZG9uZTtcblx0ICAgICAgcmV0dXJuIHN0ZXA7XG5cdCAgICB9LFxuXHQgICAgZTogZnVuY3Rpb24gKGUpIHtcblx0ICAgICAgZGlkRXJyID0gdHJ1ZTtcblx0ICAgICAgZXJyID0gZTtcblx0ICAgIH0sXG5cdCAgICBmOiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHRyeSB7XG5cdCAgICAgICAgaWYgKCFub3JtYWxDb21wbGV0aW9uICYmIGl0LnJldHVybiAhPSBudWxsKSBpdC5yZXR1cm4oKTtcblx0ICAgICAgfSBmaW5hbGx5IHtcblx0ICAgICAgICBpZiAoZGlkRXJyKSB0aHJvdyBlcnI7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9O1xuXHR9XG5cblx0Ly8gVGhpcyBhbGxvd3Mgc3VwcG9ydCBmb3IgSUUgOSwgd2hpY2ggZG9lc24ndCBoYXZlIGEgY29uc29sZVxuXHQvLyBvYmplY3QgaWYgdGhlIGRldmVsb3BlciB0b29scyBhcmUgbm90IG9wZW4uXG5cblx0dmFyIExvZ2dlciA9IHtcblx0ICB3YXJuOiBjb25zb2xlID8gY29uc29sZS53YXJuLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7fVxuXHR9O1xuXG5cdHZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cdHZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXHR2YXIgbm93ID0gRGF0ZS5ub3cgfHwgZnVuY3Rpb24gKCkge1xuXHQgIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0fTtcblx0dmFyIGhhc1BlcmZvcm1hbmNlQXBpID0gZGV0ZWN0UGVyZm9ybWFuY2VBcGkoKTtcblx0dmFyIHBlcmZvcm1hbmNlID0gaGFzUGVyZm9ybWFuY2VBcGkgPyB3aW5kb3ckMS5wZXJmb3JtYW5jZSA6IHVuZGVmaW5lZDtcblx0dmFyIHBlcmZvcm1hbmNlTm93ID0gaGFzUGVyZm9ybWFuY2VBcGkgPyBwZXJmb3JtYW5jZS5ub3cuYmluZChwZXJmb3JtYW5jZSkgOiBub3c7XG5cblx0ZnVuY3Rpb24gZGV0ZWN0UGVyZm9ybWFuY2VBcGkoKSB7XG5cdCAgcmV0dXJuIHdpbmRvdyQxICYmIHR5cGVvZiB3aW5kb3ckMS5wZXJmb3JtYW5jZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2Ygd2luZG93JDEucGVyZm9ybWFuY2UubWFyayA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiB3aW5kb3ckMS5wZXJmb3JtYW5jZS5tZWFzdXJlID09PSBcImZ1bmN0aW9uXCI7XG5cdH1cblxuXHRmdW5jdGlvbiBtZWFzdXJlKGNvbW1lbnQsIHN0YXJ0TWFyaywgZW5kTWFyaykge1xuXHQgIC8vIGBwZXJmb3JtYW5jZS5tZWFzdXJlYCBtYXkgZmFpbCBpZiB0aGUgbWFyayBjb3VsZCBub3QgYmUgZm91bmQuXG5cdCAgLy8gcmVhc29ucyBhIHNwZWNpZmljIG1hcmsgY291bGQgbm90IGJlIGZvdW5kIGluY2x1ZGU6IG91dHNpZGUgY29kZSBpbnZva2luZyBgcGVyZm9ybWFuY2UuY2xlYXJNYXJrcygpYFxuXHQgIHRyeSB7XG5cdCAgICBwZXJmb3JtYW5jZS5tZWFzdXJlKGNvbW1lbnQsIHN0YXJ0TWFyaywgZW5kTWFyayk7XG5cdCAgfSBjYXRjaCAoZXgpIHtcblx0ICAgIExvZ2dlci53YXJuKFwicGVyZm9ybWFuY2UubWVhc3VyZSBjb3VsZCBub3QgYmUgZXhlY3V0ZWQgYmVjYXVzZSBvZiBcIiwgZXgubWVzc2FnZSk7XG5cdCAgfVxuXHR9XG5cdHZhciBkZWZpbmVkID0ge1xuXHQgIGRvY3VtZW50OiB3aW5kb3ckMSAmJiB3aW5kb3ckMS5kb2N1bWVudCAhPT0gdW5kZWZpbmVkLFxuXHQgIHNldFRpbWVvdXQ6IHNldFRpbWVvdXQkMSAhPT0gdW5kZWZpbmVkXG5cdH07IC8vIFJldHVybnMgYSBuZXcgQXJyYXkgd2l0aCB0aGUgZWxlbWVudHMgdGhhdCBhcmUgaW4gYSBidXQgbm90IGluIGJcblxuXHRmdW5jdGlvbiBkaWZmKGEsIGIpIHtcblx0ICB2YXIgaSxcblx0ICAgICAgaixcblx0ICAgICAgcmVzdWx0ID0gYS5zbGljZSgpO1xuXG5cdCAgZm9yIChpID0gMDsgaSA8IHJlc3VsdC5sZW5ndGg7IGkrKykge1xuXHQgICAgZm9yIChqID0gMDsgaiA8IGIubGVuZ3RoOyBqKyspIHtcblx0ICAgICAgaWYgKHJlc3VsdFtpXSA9PT0gYltqXSkge1xuXHQgICAgICAgIHJlc3VsdC5zcGxpY2UoaSwgMSk7XG5cdCAgICAgICAgaS0tO1xuXHQgICAgICAgIGJyZWFrO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgcmV0dXJuIHJlc3VsdDtcblx0fVxuXHQvKipcblx0ICogRGV0ZXJtaW5lcyB3aGV0aGVyIGFuIGVsZW1lbnQgZXhpc3RzIGluIGEgZ2l2ZW4gYXJyYXkgb3Igbm90LlxuXHQgKlxuXHQgKiBAbWV0aG9kIGluQXJyYXlcblx0ICogQHBhcmFtIHtBbnl9IGVsZW1cblx0ICogQHBhcmFtIHtBcnJheX0gYXJyYXlcblx0ICogQHJldHVybiB7Qm9vbGVhbn1cblx0ICovXG5cblx0ZnVuY3Rpb24gaW5BcnJheShlbGVtLCBhcnJheSkge1xuXHQgIHJldHVybiBhcnJheS5pbmRleE9mKGVsZW0pICE9PSAtMTtcblx0fVxuXHQvKipcblx0ICogTWFrZXMgYSBjbG9uZSBvZiBhbiBvYmplY3QgdXNpbmcgb25seSBBcnJheSBvciBPYmplY3QgYXMgYmFzZSxcblx0ICogYW5kIGNvcGllcyBvdmVyIHRoZSBvd24gZW51bWVyYWJsZSBwcm9wZXJ0aWVzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb2JqXG5cdCAqIEByZXR1cm4ge09iamVjdH0gTmV3IG9iamVjdCB3aXRoIG9ubHkgdGhlIG93biBwcm9wZXJ0aWVzIChyZWN1cnNpdmVseSkuXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIG9iamVjdFZhbHVlcyhvYmopIHtcblx0ICB2YXIga2V5LFxuXHQgICAgICB2YWwsXG5cdCAgICAgIHZhbHMgPSBpcyhcImFycmF5XCIsIG9iaikgPyBbXSA6IHt9O1xuXG5cdCAgZm9yIChrZXkgaW4gb2JqKSB7XG5cdCAgICBpZiAoaGFzT3duLmNhbGwob2JqLCBrZXkpKSB7XG5cdCAgICAgIHZhbCA9IG9ialtrZXldO1xuXHQgICAgICB2YWxzW2tleV0gPSB2YWwgPT09IE9iamVjdCh2YWwpID8gb2JqZWN0VmFsdWVzKHZhbCkgOiB2YWw7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgcmV0dXJuIHZhbHM7XG5cdH1cblx0ZnVuY3Rpb24gZXh0ZW5kKGEsIGIsIHVuZGVmT25seSkge1xuXHQgIGZvciAodmFyIHByb3AgaW4gYikge1xuXHQgICAgaWYgKGhhc093bi5jYWxsKGIsIHByb3ApKSB7XG5cdCAgICAgIGlmIChiW3Byb3BdID09PSB1bmRlZmluZWQpIHtcblx0ICAgICAgICBkZWxldGUgYVtwcm9wXTtcblx0ICAgICAgfSBlbHNlIGlmICghKHVuZGVmT25seSAmJiB0eXBlb2YgYVtwcm9wXSAhPT0gXCJ1bmRlZmluZWRcIikpIHtcblx0ICAgICAgICBhW3Byb3BdID0gYltwcm9wXTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiBhO1xuXHR9XG5cdGZ1bmN0aW9uIG9iamVjdFR5cGUob2JqKSB7XG5cdCAgaWYgKHR5cGVvZiBvYmogPT09IFwidW5kZWZpbmVkXCIpIHtcblx0ICAgIHJldHVybiBcInVuZGVmaW5lZFwiO1xuXHQgIH0gLy8gQ29uc2lkZXI6IHR5cGVvZiBudWxsID09PSBvYmplY3RcblxuXG5cdCAgaWYgKG9iaiA9PT0gbnVsbCkge1xuXHQgICAgcmV0dXJuIFwibnVsbFwiO1xuXHQgIH1cblxuXHQgIHZhciBtYXRjaCA9IHRvU3RyaW5nLmNhbGwob2JqKS5tYXRjaCgvXlxcW29iamVjdFxccyguKilcXF0kLyksXG5cdCAgICAgIHR5cGUgPSBtYXRjaCAmJiBtYXRjaFsxXTtcblxuXHQgIHN3aXRjaCAodHlwZSkge1xuXHQgICAgY2FzZSBcIk51bWJlclwiOlxuXHQgICAgICBpZiAoaXNOYU4ob2JqKSkge1xuXHQgICAgICAgIHJldHVybiBcIm5hblwiO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIFwibnVtYmVyXCI7XG5cblx0ICAgIGNhc2UgXCJTdHJpbmdcIjpcblx0ICAgIGNhc2UgXCJCb29sZWFuXCI6XG5cdCAgICBjYXNlIFwiQXJyYXlcIjpcblx0ICAgIGNhc2UgXCJTZXRcIjpcblx0ICAgIGNhc2UgXCJNYXBcIjpcblx0ICAgIGNhc2UgXCJEYXRlXCI6XG5cdCAgICBjYXNlIFwiUmVnRXhwXCI6XG5cdCAgICBjYXNlIFwiRnVuY3Rpb25cIjpcblx0ICAgIGNhc2UgXCJTeW1ib2xcIjpcblx0ICAgICAgcmV0dXJuIHR5cGUudG9Mb3dlckNhc2UoKTtcblxuXHQgICAgZGVmYXVsdDpcblx0ICAgICAgcmV0dXJuIF90eXBlb2Yob2JqKTtcblx0ICB9XG5cdH0gLy8gU2FmZSBvYmplY3QgdHlwZSBjaGVja2luZ1xuXG5cdGZ1bmN0aW9uIGlzKHR5cGUsIG9iaikge1xuXHQgIHJldHVybiBvYmplY3RUeXBlKG9iaikgPT09IHR5cGU7XG5cdH0gLy8gQmFzZWQgb24gSmF2YSdzIFN0cmluZy5oYXNoQ29kZSwgYSBzaW1wbGUgYnV0IG5vdFxuXHQvLyByaWdvcm91c2x5IGNvbGxpc2lvbiByZXNpc3RhbnQgaGFzaGluZyBmdW5jdGlvblxuXG5cdGZ1bmN0aW9uIGdlbmVyYXRlSGFzaChtb2R1bGUsIHRlc3ROYW1lKSB7XG5cdCAgdmFyIHN0ciA9IG1vZHVsZSArIFwiXFx4MUNcIiArIHRlc3ROYW1lO1xuXHQgIHZhciBoYXNoID0gMDtcblxuXHQgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG5cdCAgICBoYXNoID0gKGhhc2ggPDwgNSkgLSBoYXNoICsgc3RyLmNoYXJDb2RlQXQoaSk7XG5cdCAgICBoYXNoIHw9IDA7XG5cdCAgfSAvLyBDb252ZXJ0IHRoZSBwb3NzaWJseSBuZWdhdGl2ZSBpbnRlZ2VyIGhhc2ggY29kZSBpbnRvIGFuIDggY2hhcmFjdGVyIGhleCBzdHJpbmcsIHdoaWNoIGlzbid0XG5cdCAgLy8gc3RyaWN0bHkgbmVjZXNzYXJ5IGJ1dCBpbmNyZWFzZXMgdXNlciB1bmRlcnN0YW5kaW5nIHRoYXQgdGhlIGlkIGlzIGEgU0hBLWxpa2UgaGFzaFxuXG5cblx0ICB2YXIgaGV4ID0gKDB4MTAwMDAwMDAwICsgaGFzaCkudG9TdHJpbmcoMTYpO1xuXG5cdCAgaWYgKGhleC5sZW5ndGggPCA4KSB7XG5cdCAgICBoZXggPSBcIjAwMDAwMDBcIiArIGhleDtcblx0ICB9XG5cblx0ICByZXR1cm4gaGV4LnNsaWNlKC04KTtcblx0fVxuXG5cdC8vIEF1dGhvcnM6IFBoaWxpcHBlIFJhdGjDqSA8cHJhdGhlQGdtYWlsLmNvbT4sIERhdmlkIENoYW4gPGRhdmlkQHRyb2kub3JnPlxuXG5cdHZhciBlcXVpdiA9IChmdW5jdGlvbiAoKSB7XG5cdCAgLy8gVmFsdWUgcGFpcnMgcXVldWVkIGZvciBjb21wYXJpc29uLiBVc2VkIGZvciBicmVhZHRoLWZpcnN0IHByb2Nlc3Npbmcgb3JkZXIsIHJlY3Vyc2lvblxuXHQgIC8vIGRldGVjdGlvbiBhbmQgYXZvaWRpbmcgcmVwZWF0ZWQgY29tcGFyaXNvbiAoc2VlIGJlbG93IGZvciBkZXRhaWxzKS5cblx0ICAvLyBFbGVtZW50cyBhcmUgeyBhOiB2YWwsIGI6IHZhbCB9LlxuXHQgIHZhciBwYWlycyA9IFtdO1xuXG5cdCAgdmFyIGdldFByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mIHx8IGZ1bmN0aW9uIChvYmopIHtcblx0ICAgIHJldHVybiBvYmouX19wcm90b19fO1xuXHQgIH07XG5cblx0ICBmdW5jdGlvbiB1c2VTdHJpY3RFcXVhbGl0eShhLCBiKSB7XG5cdCAgICAvLyBUaGlzIG9ubHkgZ2V0cyBjYWxsZWQgaWYgYSBhbmQgYiBhcmUgbm90IHN0cmljdCBlcXVhbCwgYW5kIGlzIHVzZWQgdG8gY29tcGFyZSBvblxuXHQgICAgLy8gdGhlIHByaW1pdGl2ZSB2YWx1ZXMgaW5zaWRlIG9iamVjdCB3cmFwcGVycy4gRm9yIGV4YW1wbGU6XG5cdCAgICAvLyBgdmFyIGkgPSAxO2Bcblx0ICAgIC8vIGB2YXIgaiA9IG5ldyBOdW1iZXIoMSk7YFxuXHQgICAgLy8gTmVpdGhlciBhIG5vciBiIGNhbiBiZSBudWxsLCBhcyBhICE9PSBiIGFuZCB0aGV5IGhhdmUgdGhlIHNhbWUgdHlwZS5cblx0ICAgIGlmIChfdHlwZW9mKGEpID09PSBcIm9iamVjdFwiKSB7XG5cdCAgICAgIGEgPSBhLnZhbHVlT2YoKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKF90eXBlb2YoYikgPT09IFwib2JqZWN0XCIpIHtcblx0ICAgICAgYiA9IGIudmFsdWVPZigpO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gYSA9PT0gYjtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBjb21wYXJlQ29uc3RydWN0b3JzKGEsIGIpIHtcblx0ICAgIHZhciBwcm90b0EgPSBnZXRQcm90byhhKTtcblx0ICAgIHZhciBwcm90b0IgPSBnZXRQcm90byhiKTsgLy8gQ29tcGFyaW5nIGNvbnN0cnVjdG9ycyBpcyBtb3JlIHN0cmljdCB0aGFuIHVzaW5nIGBpbnN0YW5jZW9mYFxuXG5cdCAgICBpZiAoYS5jb25zdHJ1Y3RvciA9PT0gYi5jb25zdHJ1Y3Rvcikge1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH0gLy8gUmVmICM4NTFcblx0ICAgIC8vIElmIHRoZSBvYmogcHJvdG90eXBlIGRlc2NlbmRzIGZyb20gYSBudWxsIGNvbnN0cnVjdG9yLCB0cmVhdCBpdFxuXHQgICAgLy8gYXMgYSBudWxsIHByb3RvdHlwZS5cblxuXG5cdCAgICBpZiAocHJvdG9BICYmIHByb3RvQS5jb25zdHJ1Y3RvciA9PT0gbnVsbCkge1xuXHQgICAgICBwcm90b0EgPSBudWxsO1xuXHQgICAgfVxuXG5cdCAgICBpZiAocHJvdG9CICYmIHByb3RvQi5jb25zdHJ1Y3RvciA9PT0gbnVsbCkge1xuXHQgICAgICBwcm90b0IgPSBudWxsO1xuXHQgICAgfSAvLyBBbGxvdyBvYmplY3RzIHdpdGggbm8gcHJvdG90eXBlIHRvIGJlIGVxdWl2YWxlbnQgdG9cblx0ICAgIC8vIG9iamVjdHMgd2l0aCBPYmplY3QgYXMgdGhlaXIgY29uc3RydWN0b3IuXG5cblxuXHQgICAgaWYgKHByb3RvQSA9PT0gbnVsbCAmJiBwcm90b0IgPT09IE9iamVjdC5wcm90b3R5cGUgfHwgcHJvdG9CID09PSBudWxsICYmIHByb3RvQSA9PT0gT2JqZWN0LnByb3RvdHlwZSkge1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGdldFJlZ0V4cEZsYWdzKHJlZ2V4cCkge1xuXHQgICAgcmV0dXJuIFwiZmxhZ3NcIiBpbiByZWdleHAgPyByZWdleHAuZmxhZ3MgOiByZWdleHAudG9TdHJpbmcoKS5tYXRjaCgvW2dpbXV5XSokLylbMF07XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gaXNDb250YWluZXIodmFsKSB7XG5cdCAgICByZXR1cm4gW1wib2JqZWN0XCIsIFwiYXJyYXlcIiwgXCJtYXBcIiwgXCJzZXRcIl0uaW5kZXhPZihvYmplY3RUeXBlKHZhbCkpICE9PSAtMTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBicmVhZHRoRmlyc3RDb21wYXJlQ2hpbGQoYSwgYikge1xuXHQgICAgLy8gSWYgYSBpcyBhIGNvbnRhaW5lciBub3QgcmVmZXJlbmNlLWVxdWFsIHRvIGIsIHBvc3Rwb25lIHRoZSBjb21wYXJpc29uIHRvIHRoZVxuXHQgICAgLy8gZW5kIG9mIHRoZSBwYWlycyBxdWV1ZSAtLSB1bmxlc3MgKGEsIGIpIGhhcyBiZWVuIHNlZW4gYmVmb3JlLCBpbiB3aGljaCBjYXNlIHNraXBcblx0ICAgIC8vIG92ZXIgdGhlIHBhaXIuXG5cdCAgICBpZiAoYSA9PT0gYikge1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH1cblxuXHQgICAgaWYgKCFpc0NvbnRhaW5lcihhKSkge1xuXHQgICAgICByZXR1cm4gdHlwZUVxdWl2KGEsIGIpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAocGFpcnMuZXZlcnkoZnVuY3Rpb24gKHBhaXIpIHtcblx0ICAgICAgcmV0dXJuIHBhaXIuYSAhPT0gYSB8fCBwYWlyLmIgIT09IGI7XG5cdCAgICB9KSkge1xuXHQgICAgICAvLyBOb3QgeWV0IHN0YXJ0ZWQgY29tcGFyaW5nIHRoaXMgcGFpclxuXHQgICAgICBwYWlycy5wdXNoKHtcblx0ICAgICAgICBhOiBhLFxuXHQgICAgICAgIGI6IGJcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiB0cnVlO1xuXHQgIH1cblxuXHQgIHZhciBjYWxsYmFja3MgPSB7XG5cdCAgICBcInN0cmluZ1wiOiB1c2VTdHJpY3RFcXVhbGl0eSxcblx0ICAgIFwiYm9vbGVhblwiOiB1c2VTdHJpY3RFcXVhbGl0eSxcblx0ICAgIFwibnVtYmVyXCI6IHVzZVN0cmljdEVxdWFsaXR5LFxuXHQgICAgXCJudWxsXCI6IHVzZVN0cmljdEVxdWFsaXR5LFxuXHQgICAgXCJ1bmRlZmluZWRcIjogdXNlU3RyaWN0RXF1YWxpdHksXG5cdCAgICBcInN5bWJvbFwiOiB1c2VTdHJpY3RFcXVhbGl0eSxcblx0ICAgIFwiZGF0ZVwiOiB1c2VTdHJpY3RFcXVhbGl0eSxcblx0ICAgIFwibmFuXCI6IGZ1bmN0aW9uIG5hbigpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9LFxuXHQgICAgXCJyZWdleHBcIjogZnVuY3Rpb24gcmVnZXhwKGEsIGIpIHtcblx0ICAgICAgcmV0dXJuIGEuc291cmNlID09PSBiLnNvdXJjZSAmJiAvLyBJbmNsdWRlIGZsYWdzIGluIHRoZSBjb21wYXJpc29uXG5cdCAgICAgIGdldFJlZ0V4cEZsYWdzKGEpID09PSBnZXRSZWdFeHBGbGFncyhiKTtcblx0ICAgIH0sXG5cdCAgICAvLyBhYm9ydCAoaWRlbnRpY2FsIHJlZmVyZW5jZXMgLyBpbnN0YW5jZSBtZXRob2RzIHdlcmUgc2tpcHBlZCBlYXJsaWVyKVxuXHQgICAgXCJmdW5jdGlvblwiOiBmdW5jdGlvbiBfZnVuY3Rpb24oKSB7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH0sXG5cdCAgICBcImFycmF5XCI6IGZ1bmN0aW9uIGFycmF5KGEsIGIpIHtcblx0ICAgICAgdmFyIGksIGxlbjtcblx0ICAgICAgbGVuID0gYS5sZW5ndGg7XG5cblx0ICAgICAgaWYgKGxlbiAhPT0gYi5sZW5ndGgpIHtcblx0ICAgICAgICAvLyBTYWZlIGFuZCBmYXN0ZXJcblx0ICAgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICAgIH1cblxuXHQgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcblx0ICAgICAgICAvLyBDb21wYXJlIG5vbi1jb250YWluZXJzOyBxdWV1ZSBub24tcmVmZXJlbmNlLWVxdWFsIGNvbnRhaW5lcnNcblx0ICAgICAgICBpZiAoIWJyZWFkdGhGaXJzdENvbXBhcmVDaGlsZChhW2ldLCBiW2ldKSkge1xuXHQgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfSxcblx0ICAgIC8vIERlZmluZSBzZXRzIGEgYW5kIGIgdG8gYmUgZXF1aXZhbGVudCBpZiBmb3IgZWFjaCBlbGVtZW50IGFWYWwgaW4gYSwgdGhlcmVcblx0ICAgIC8vIGlzIHNvbWUgZWxlbWVudCBiVmFsIGluIGIgc3VjaCB0aGF0IGFWYWwgYW5kIGJWYWwgYXJlIGVxdWl2YWxlbnQuIEVsZW1lbnRcblx0ICAgIC8vIHJlcGV0aXRpb25zIGFyZSBub3QgY291bnRlZCwgc28gdGhlc2UgYXJlIGVxdWl2YWxlbnQ6XG5cdCAgICAvLyBhID0gbmV3IFNldCggWyB7fSwgW10sIFtdIF0gKTtcblx0ICAgIC8vIGIgPSBuZXcgU2V0KCBbIHt9LCB7fSwgW10gXSApO1xuXHQgICAgXCJzZXRcIjogZnVuY3Rpb24gc2V0KGEsIGIpIHtcblx0ICAgICAgdmFyIGlubmVyRXEsXG5cdCAgICAgICAgICBvdXRlckVxID0gdHJ1ZTtcblxuXHQgICAgICBpZiAoYS5zaXplICE9PSBiLnNpemUpIHtcblx0ICAgICAgICAvLyBUaGlzIG9wdGltaXphdGlvbiBoYXMgY2VydGFpbiBxdWlya3MgYmVjYXVzZSBvZiB0aGUgbGFjayBvZlxuXHQgICAgICAgIC8vIHJlcGV0aXRpb24gY291bnRpbmcuIEZvciBpbnN0YW5jZSwgYWRkaW5nIHRoZSBzYW1lXG5cdCAgICAgICAgLy8gKHJlZmVyZW5jZS1pZGVudGljYWwpIGVsZW1lbnQgdG8gdHdvIGVxdWl2YWxlbnQgc2V0cyBjYW5cblx0ICAgICAgICAvLyBtYWtlIHRoZW0gbm9uLWVxdWl2YWxlbnQuXG5cdCAgICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgICB9XG5cblx0ICAgICAgYS5mb3JFYWNoKGZ1bmN0aW9uIChhVmFsKSB7XG5cdCAgICAgICAgLy8gU2hvcnQtY2lyY3VpdCBpZiB0aGUgcmVzdWx0IGlzIGFscmVhZHkga25vd24uIChVc2luZyBmb3IuLi5vZlxuXHQgICAgICAgIC8vIHdpdGggYSBicmVhayBjbGF1c2Ugd291bGQgYmUgY2xlYW5lciBoZXJlLCBidXQgaXQgd291bGQgY2F1c2Vcblx0ICAgICAgICAvLyBhIHN5bnRheCBlcnJvciBvbiBvbGRlciBKYXZhc2NyaXB0IGltcGxlbWVudGF0aW9ucyBldmVuIGlmXG5cdCAgICAgICAgLy8gU2V0IGlzIHVudXNlZClcblx0ICAgICAgICBpZiAoIW91dGVyRXEpIHtcblx0ICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBpbm5lckVxID0gZmFsc2U7XG5cdCAgICAgICAgYi5mb3JFYWNoKGZ1bmN0aW9uIChiVmFsKSB7XG5cdCAgICAgICAgICB2YXIgcGFyZW50UGFpcnM7IC8vIExpa2V3aXNlLCBzaG9ydC1jaXJjdWl0IGlmIHRoZSByZXN1bHQgaXMgYWxyZWFkeSBrbm93blxuXG5cdCAgICAgICAgICBpZiAoaW5uZXJFcSkge1xuXHQgICAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgICB9IC8vIFN3YXAgb3V0IHRoZSBnbG9iYWwgcGFpcnMgbGlzdCwgYXMgdGhlIG5lc3RlZCBjYWxsIHRvXG5cdCAgICAgICAgICAvLyBpbm5lckVxdWl2IHdpbGwgY2xvYmJlciBpdHMgY29udGVudHNcblxuXG5cdCAgICAgICAgICBwYXJlbnRQYWlycyA9IHBhaXJzO1xuXG5cdCAgICAgICAgICBpZiAoaW5uZXJFcXVpdihiVmFsLCBhVmFsKSkge1xuXHQgICAgICAgICAgICBpbm5lckVxID0gdHJ1ZTtcblx0ICAgICAgICAgIH0gLy8gUmVwbGFjZSB0aGUgZ2xvYmFsIHBhaXJzIGxpc3RcblxuXG5cdCAgICAgICAgICBwYWlycyA9IHBhcmVudFBhaXJzO1xuXHQgICAgICAgIH0pO1xuXG5cdCAgICAgICAgaWYgKCFpbm5lckVxKSB7XG5cdCAgICAgICAgICBvdXRlckVxID0gZmFsc2U7XG5cdCAgICAgICAgfVxuXHQgICAgICB9KTtcblx0ICAgICAgcmV0dXJuIG91dGVyRXE7XG5cdCAgICB9LFxuXHQgICAgLy8gRGVmaW5lIG1hcHMgYSBhbmQgYiB0byBiZSBlcXVpdmFsZW50IGlmIGZvciBlYWNoIGtleS12YWx1ZSBwYWlyIChhS2V5LCBhVmFsKVxuXHQgICAgLy8gaW4gYSwgdGhlcmUgaXMgc29tZSBrZXktdmFsdWUgcGFpciAoYktleSwgYlZhbCkgaW4gYiBzdWNoIHRoYXRcblx0ICAgIC8vIFsgYUtleSwgYVZhbCBdIGFuZCBbIGJLZXksIGJWYWwgXSBhcmUgZXF1aXZhbGVudC4gS2V5IHJlcGV0aXRpb25zIGFyZSBub3Rcblx0ICAgIC8vIGNvdW50ZWQsIHNvIHRoZXNlIGFyZSBlcXVpdmFsZW50OlxuXHQgICAgLy8gYSA9IG5ldyBNYXAoIFsgWyB7fSwgMSBdLCBbIHt9LCAxIF0sIFsgW10sIDEgXSBdICk7XG5cdCAgICAvLyBiID0gbmV3IE1hcCggWyBbIHt9LCAxIF0sIFsgW10sIDEgXSwgWyBbXSwgMSBdIF0gKTtcblx0ICAgIFwibWFwXCI6IGZ1bmN0aW9uIG1hcChhLCBiKSB7XG5cdCAgICAgIHZhciBpbm5lckVxLFxuXHQgICAgICAgICAgb3V0ZXJFcSA9IHRydWU7XG5cblx0ICAgICAgaWYgKGEuc2l6ZSAhPT0gYi5zaXplKSB7XG5cdCAgICAgICAgLy8gVGhpcyBvcHRpbWl6YXRpb24gaGFzIGNlcnRhaW4gcXVpcmtzIGJlY2F1c2Ugb2YgdGhlIGxhY2sgb2Zcblx0ICAgICAgICAvLyByZXBldGl0aW9uIGNvdW50aW5nLiBGb3IgaW5zdGFuY2UsIGFkZGluZyB0aGUgc2FtZVxuXHQgICAgICAgIC8vIChyZWZlcmVuY2UtaWRlbnRpY2FsKSBrZXktdmFsdWUgcGFpciB0byB0d28gZXF1aXZhbGVudCBtYXBzXG5cdCAgICAgICAgLy8gY2FuIG1ha2UgdGhlbSBub24tZXF1aXZhbGVudC5cblx0ICAgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICAgIH1cblxuXHQgICAgICBhLmZvckVhY2goZnVuY3Rpb24gKGFWYWwsIGFLZXkpIHtcblx0ICAgICAgICAvLyBTaG9ydC1jaXJjdWl0IGlmIHRoZSByZXN1bHQgaXMgYWxyZWFkeSBrbm93bi4gKFVzaW5nIGZvci4uLm9mXG5cdCAgICAgICAgLy8gd2l0aCBhIGJyZWFrIGNsYXVzZSB3b3VsZCBiZSBjbGVhbmVyIGhlcmUsIGJ1dCBpdCB3b3VsZCBjYXVzZVxuXHQgICAgICAgIC8vIGEgc3ludGF4IGVycm9yIG9uIG9sZGVyIEphdmFzY3JpcHQgaW1wbGVtZW50YXRpb25zIGV2ZW4gaWZcblx0ICAgICAgICAvLyBNYXAgaXMgdW51c2VkKVxuXHQgICAgICAgIGlmICghb3V0ZXJFcSkge1xuXHQgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGlubmVyRXEgPSBmYWxzZTtcblx0ICAgICAgICBiLmZvckVhY2goZnVuY3Rpb24gKGJWYWwsIGJLZXkpIHtcblx0ICAgICAgICAgIHZhciBwYXJlbnRQYWlyczsgLy8gTGlrZXdpc2UsIHNob3J0LWNpcmN1aXQgaWYgdGhlIHJlc3VsdCBpcyBhbHJlYWR5IGtub3duXG5cblx0ICAgICAgICAgIGlmIChpbm5lckVxKSB7XG5cdCAgICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICAgIH0gLy8gU3dhcCBvdXQgdGhlIGdsb2JhbCBwYWlycyBsaXN0LCBhcyB0aGUgbmVzdGVkIGNhbGwgdG9cblx0ICAgICAgICAgIC8vIGlubmVyRXF1aXYgd2lsbCBjbG9iYmVyIGl0cyBjb250ZW50c1xuXG5cblx0ICAgICAgICAgIHBhcmVudFBhaXJzID0gcGFpcnM7XG5cblx0ICAgICAgICAgIGlmIChpbm5lckVxdWl2KFtiVmFsLCBiS2V5XSwgW2FWYWwsIGFLZXldKSkge1xuXHQgICAgICAgICAgICBpbm5lckVxID0gdHJ1ZTtcblx0ICAgICAgICAgIH0gLy8gUmVwbGFjZSB0aGUgZ2xvYmFsIHBhaXJzIGxpc3RcblxuXG5cdCAgICAgICAgICBwYWlycyA9IHBhcmVudFBhaXJzO1xuXHQgICAgICAgIH0pO1xuXG5cdCAgICAgICAgaWYgKCFpbm5lckVxKSB7XG5cdCAgICAgICAgICBvdXRlckVxID0gZmFsc2U7XG5cdCAgICAgICAgfVxuXHQgICAgICB9KTtcblx0ICAgICAgcmV0dXJuIG91dGVyRXE7XG5cdCAgICB9LFxuXHQgICAgXCJvYmplY3RcIjogZnVuY3Rpb24gb2JqZWN0KGEsIGIpIHtcblx0ICAgICAgdmFyIGksXG5cdCAgICAgICAgICBhUHJvcGVydGllcyA9IFtdLFxuXHQgICAgICAgICAgYlByb3BlcnRpZXMgPSBbXTtcblxuXHQgICAgICBpZiAoY29tcGFyZUNvbnN0cnVjdG9ycyhhLCBiKSA9PT0gZmFsc2UpIHtcblx0ICAgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICAgIH0gLy8gQmUgc3RyaWN0OiBkb24ndCBlbnN1cmUgaGFzT3duUHJvcGVydHkgYW5kIGdvIGRlZXBcblxuXG5cdCAgICAgIGZvciAoaSBpbiBhKSB7XG5cdCAgICAgICAgLy8gQ29sbGVjdCBhJ3MgcHJvcGVydGllc1xuXHQgICAgICAgIGFQcm9wZXJ0aWVzLnB1c2goaSk7IC8vIFNraXAgT09QIG1ldGhvZHMgdGhhdCBsb29rIHRoZSBzYW1lXG5cblx0ICAgICAgICBpZiAoYS5jb25zdHJ1Y3RvciAhPT0gT2JqZWN0ICYmIHR5cGVvZiBhLmNvbnN0cnVjdG9yICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBhW2ldID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGJbaV0gPT09IFwiZnVuY3Rpb25cIiAmJiBhW2ldLnRvU3RyaW5nKCkgPT09IGJbaV0udG9TdHJpbmcoKSkge1xuXHQgICAgICAgICAgY29udGludWU7XG5cdCAgICAgICAgfSAvLyBDb21wYXJlIG5vbi1jb250YWluZXJzOyBxdWV1ZSBub24tcmVmZXJlbmNlLWVxdWFsIGNvbnRhaW5lcnNcblxuXG5cdCAgICAgICAgaWYgKCFicmVhZHRoRmlyc3RDb21wYXJlQ2hpbGQoYVtpXSwgYltpXSkpIHtcblx0ICAgICAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBmb3IgKGkgaW4gYikge1xuXHQgICAgICAgIC8vIENvbGxlY3QgYidzIHByb3BlcnRpZXNcblx0ICAgICAgICBiUHJvcGVydGllcy5wdXNoKGkpO1xuXHQgICAgICB9IC8vIEVuc3VyZXMgaWRlbnRpY2FsIHByb3BlcnRpZXMgbmFtZVxuXG5cblx0ICAgICAgcmV0dXJuIHR5cGVFcXVpdihhUHJvcGVydGllcy5zb3J0KCksIGJQcm9wZXJ0aWVzLnNvcnQoKSk7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIGZ1bmN0aW9uIHR5cGVFcXVpdihhLCBiKSB7XG5cdCAgICB2YXIgdHlwZSA9IG9iamVjdFR5cGUoYSk7IC8vIENhbGxiYWNrcyBmb3IgY29udGFpbmVycyB3aWxsIGFwcGVuZCB0byB0aGUgcGFpcnMgcXVldWUgdG8gYWNoaWV2ZSBicmVhZHRoLWZpcnN0XG5cdCAgICAvLyBzZWFyY2ggb3JkZXIuIFRoZSBwYWlycyBxdWV1ZSBpcyBhbHNvIHVzZWQgdG8gYXZvaWQgcmVwcm9jZXNzaW5nIGFueSBwYWlyIG9mXG5cdCAgICAvLyBjb250YWluZXJzIHRoYXQgYXJlIHJlZmVyZW5jZS1lcXVhbCB0byBhIHByZXZpb3VzbHkgdmlzaXRlZCBwYWlyIChhIHNwZWNpYWwgY2FzZVxuXHQgICAgLy8gdGhpcyBiZWluZyByZWN1cnNpb24gZGV0ZWN0aW9uKS5cblx0ICAgIC8vXG5cdCAgICAvLyBCZWNhdXNlIG9mIHRoaXMgYXBwcm9hY2gsIG9uY2UgdHlwZUVxdWl2IHJldHVybnMgYSBmYWxzZSB2YWx1ZSwgaXQgc2hvdWxkIG5vdCBiZVxuXHQgICAgLy8gY2FsbGVkIGFnYWluIHdpdGhvdXQgY2xlYXJpbmcgdGhlIHBhaXIgcXVldWUgZWxzZSBpdCBtYXkgd3JvbmdseSByZXBvcnQgYSB2aXNpdGVkXG5cdCAgICAvLyBwYWlyIGFzIGJlaW5nIGVxdWl2YWxlbnQuXG5cblx0ICAgIHJldHVybiBvYmplY3RUeXBlKGIpID09PSB0eXBlICYmIGNhbGxiYWNrc1t0eXBlXShhLCBiKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBpbm5lckVxdWl2KGEsIGIpIHtcblx0ICAgIHZhciBpLCBwYWlyOyAvLyBXZSdyZSBkb25lIHdoZW4gdGhlcmUncyBub3RoaW5nIG1vcmUgdG8gY29tcGFyZVxuXG5cdCAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9IC8vIENsZWFyIHRoZSBnbG9iYWwgcGFpciBxdWV1ZSBhbmQgYWRkIHRoZSB0b3AtbGV2ZWwgdmFsdWVzIGJlaW5nIGNvbXBhcmVkXG5cblxuXHQgICAgcGFpcnMgPSBbe1xuXHQgICAgICBhOiBhLFxuXHQgICAgICBiOiBiXG5cdCAgICB9XTtcblxuXHQgICAgZm9yIChpID0gMDsgaSA8IHBhaXJzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIHBhaXIgPSBwYWlyc1tpXTsgLy8gUGVyZm9ybSB0eXBlLXNwZWNpZmljIGNvbXBhcmlzb24gb24gYW55IHBhaXJzIHRoYXQgYXJlIG5vdCBzdHJpY3RseVxuXHQgICAgICAvLyBlcXVhbC4gRm9yIGNvbnRhaW5lciB0eXBlcywgdGhhdCBjb21wYXJpc29uIHdpbGwgcG9zdHBvbmUgY29tcGFyaXNvblxuXHQgICAgICAvLyBvZiBhbnkgc3ViLWNvbnRhaW5lciBwYWlyIHRvIHRoZSBlbmQgb2YgdGhlIHBhaXIgcXVldWUuIFRoaXMgZ2l2ZXNcblx0ICAgICAgLy8gYnJlYWR0aC1maXJzdCBzZWFyY2ggb3JkZXIuIEl0IGFsc28gYXZvaWRzIHRoZSByZXByb2Nlc3Npbmcgb2Zcblx0ICAgICAgLy8gcmVmZXJlbmNlLWVxdWFsIHNpYmxpbmdzLCBjb3VzaW5zIGV0Yywgd2hpY2ggY2FuIGhhdmUgYSBzaWduaWZpY2FudCBzcGVlZFxuXHQgICAgICAvLyBpbXBhY3Qgd2hlbiBjb21wYXJpbmcgYSBjb250YWluZXIgb2Ygc21hbGwgb2JqZWN0cyBlYWNoIG9mIHdoaWNoIGhhcyBhXG5cdCAgICAgIC8vIHJlZmVyZW5jZSB0byB0aGUgc2FtZSAoc2luZ2xldG9uKSBsYXJnZSBvYmplY3QuXG5cblx0ICAgICAgaWYgKHBhaXIuYSAhPT0gcGFpci5iICYmICF0eXBlRXF1aXYocGFpci5hLCBwYWlyLmIpKSB7XG5cdCAgICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgICB9XG5cdCAgICB9IC8vIC4uLmFjcm9zcyBhbGwgY29uc2VjdXRpdmUgYXJndW1lbnQgcGFpcnNcblxuXG5cdCAgICByZXR1cm4gYXJndW1lbnRzLmxlbmd0aCA9PT0gMiB8fCBpbm5lckVxdWl2LmFwcGx5KHRoaXMsIFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0ICAgIHZhciByZXN1bHQgPSBpbm5lckVxdWl2LmFwcGx5KHZvaWQgMCwgYXJndW1lbnRzKTsgLy8gUmVsZWFzZSBhbnkgcmV0YWluZWQgb2JqZWN0c1xuXG5cdCAgICBwYWlycy5sZW5ndGggPSAwO1xuXHQgICAgcmV0dXJuIHJlc3VsdDtcblx0ICB9O1xuXHR9KSgpO1xuXG5cdC8qKlxuXHQgKiBDb25maWcgb2JqZWN0OiBNYWludGFpbiBpbnRlcm5hbCBzdGF0ZVxuXHQgKiBMYXRlciBleHBvc2VkIGFzIFFVbml0LmNvbmZpZ1xuXHQgKiBgY29uZmlnYCBpbml0aWFsaXplZCBhdCB0b3Agb2Ygc2NvcGVcblx0ICovXG5cblx0dmFyIGNvbmZpZyA9IHtcblx0ICAvLyBUaGUgcXVldWUgb2YgdGVzdHMgdG8gcnVuXG5cdCAgcXVldWU6IFtdLFxuXHQgIC8vIEJsb2NrIHVudGlsIGRvY3VtZW50IHJlYWR5XG5cdCAgYmxvY2tpbmc6IHRydWUsXG5cdCAgLy8gQnkgZGVmYXVsdCwgcnVuIHByZXZpb3VzbHkgZmFpbGVkIHRlc3RzIGZpcnN0XG5cdCAgLy8gdmVyeSB1c2VmdWwgaW4gY29tYmluYXRpb24gd2l0aCBcIkhpZGUgcGFzc2VkIHRlc3RzXCIgY2hlY2tlZFxuXHQgIHJlb3JkZXI6IHRydWUsXG5cdCAgLy8gQnkgZGVmYXVsdCwgbW9kaWZ5IGRvY3VtZW50LnRpdGxlIHdoZW4gc3VpdGUgaXMgZG9uZVxuXHQgIGFsdGVydGl0bGU6IHRydWUsXG5cdCAgLy8gSFRNTCBSZXBvcnRlcjogY29sbGFwc2UgZXZlcnkgdGVzdCBleGNlcHQgdGhlIGZpcnN0IGZhaWxpbmcgdGVzdFxuXHQgIC8vIElmIGZhbHNlLCBhbGwgZmFpbGluZyB0ZXN0cyB3aWxsIGJlIGV4cGFuZGVkXG5cdCAgY29sbGFwc2U6IHRydWUsXG5cdCAgLy8gQnkgZGVmYXVsdCwgc2Nyb2xsIHRvIHRvcCBvZiB0aGUgcGFnZSB3aGVuIHN1aXRlIGlzIGRvbmVcblx0ICBzY3JvbGx0b3A6IHRydWUsXG5cdCAgLy8gRGVwdGggdXAtdG8gd2hpY2ggb2JqZWN0IHdpbGwgYmUgZHVtcGVkXG5cdCAgbWF4RGVwdGg6IDUsXG5cdCAgLy8gV2hlbiBlbmFibGVkLCBhbGwgdGVzdHMgbXVzdCBjYWxsIGV4cGVjdCgpXG5cdCAgcmVxdWlyZUV4cGVjdHM6IGZhbHNlLFxuXHQgIC8vIFBsYWNlaG9sZGVyIGZvciB1c2VyLWNvbmZpZ3VyYWJsZSBmb3JtLWV4cG9zZWQgVVJMIHBhcmFtZXRlcnNcblx0ICB1cmxDb25maWc6IFtdLFxuXHQgIC8vIFNldCBvZiBhbGwgbW9kdWxlcy5cblx0ICBtb2R1bGVzOiBbXSxcblx0ICAvLyBUaGUgZmlyc3QgdW5uYW1lZCBtb2R1bGVcblx0ICBjdXJyZW50TW9kdWxlOiB7XG5cdCAgICBuYW1lOiBcIlwiLFxuXHQgICAgdGVzdHM6IFtdLFxuXHQgICAgY2hpbGRNb2R1bGVzOiBbXSxcblx0ICAgIHRlc3RzUnVuOiAwLFxuXHQgICAgdW5za2lwcGVkVGVzdHNSdW46IDAsXG5cdCAgICBob29rczoge1xuXHQgICAgICBiZWZvcmU6IFtdLFxuXHQgICAgICBiZWZvcmVFYWNoOiBbXSxcblx0ICAgICAgYWZ0ZXJFYWNoOiBbXSxcblx0ICAgICAgYWZ0ZXI6IFtdXG5cdCAgICB9XG5cdCAgfSxcblx0ICBjYWxsYmFja3M6IHt9LFxuXHQgIC8vIFRoZSBzdG9yYWdlIG1vZHVsZSB0byB1c2UgZm9yIHJlb3JkZXJpbmcgdGVzdHNcblx0ICBzdG9yYWdlOiBsb2NhbFNlc3Npb25TdG9yYWdlXG5cdH07IC8vIHRha2UgYSBwcmVkZWZpbmVkIFFVbml0LmNvbmZpZyBhbmQgZXh0ZW5kIHRoZSBkZWZhdWx0c1xuXG5cdHZhciBnbG9iYWxDb25maWcgPSB3aW5kb3ckMSAmJiB3aW5kb3ckMS5RVW5pdCAmJiB3aW5kb3ckMS5RVW5pdC5jb25maWc7IC8vIG9ubHkgZXh0ZW5kIHRoZSBnbG9iYWwgY29uZmlnIGlmIHRoZXJlIGlzIG5vIFFVbml0IG92ZXJsb2FkXG5cblx0aWYgKHdpbmRvdyQxICYmIHdpbmRvdyQxLlFVbml0ICYmICF3aW5kb3ckMS5RVW5pdC52ZXJzaW9uKSB7XG5cdCAgZXh0ZW5kKGNvbmZpZywgZ2xvYmFsQ29uZmlnKTtcblx0fSAvLyBQdXNoIGEgbG9vc2UgdW5uYW1lZCBtb2R1bGUgdG8gdGhlIG1vZHVsZXMgY29sbGVjdGlvblxuXG5cblx0Y29uZmlnLm1vZHVsZXMucHVzaChjb25maWcuY3VycmVudE1vZHVsZSk7XG5cblx0Ly8gaHR0cHM6Ly9mbGVzbGVyLmJsb2dzcG90LmNvbS8yMDA4LzA1L2pzZHVtcC1wcmV0dHktZHVtcC1vZi1hbnktamF2YXNjcmlwdC5odG1sXG5cblx0dmFyIGR1bXAgPSAoZnVuY3Rpb24gKCkge1xuXHQgIGZ1bmN0aW9uIHF1b3RlKHN0cikge1xuXHQgICAgcmV0dXJuIFwiXFxcIlwiICsgc3RyLnRvU3RyaW5nKCkucmVwbGFjZSgvXFxcXC9nLCBcIlxcXFxcXFxcXCIpLnJlcGxhY2UoL1wiL2csIFwiXFxcXFxcXCJcIikgKyBcIlxcXCJcIjtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBsaXRlcmFsKG8pIHtcblx0ICAgIHJldHVybiBvICsgXCJcIjtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBqb2luKHByZSwgYXJyLCBwb3N0KSB7XG5cdCAgICB2YXIgcyA9IGR1bXAuc2VwYXJhdG9yKCksXG5cdCAgICAgICAgYmFzZSA9IGR1bXAuaW5kZW50KCksXG5cdCAgICAgICAgaW5uZXIgPSBkdW1wLmluZGVudCgxKTtcblxuXHQgICAgaWYgKGFyci5qb2luKSB7XG5cdCAgICAgIGFyciA9IGFyci5qb2luKFwiLFwiICsgcyArIGlubmVyKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKCFhcnIpIHtcblx0ICAgICAgcmV0dXJuIHByZSArIHBvc3Q7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBbcHJlLCBpbm5lciArIGFyciwgYmFzZSArIHBvc3RdLmpvaW4ocyk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYXJyYXkoYXJyLCBzdGFjaykge1xuXHQgICAgdmFyIGkgPSBhcnIubGVuZ3RoLFxuXHQgICAgICAgIHJldCA9IG5ldyBBcnJheShpKTtcblxuXHQgICAgaWYgKGR1bXAubWF4RGVwdGggJiYgZHVtcC5kZXB0aCA+IGR1bXAubWF4RGVwdGgpIHtcblx0ICAgICAgcmV0dXJuIFwiW29iamVjdCBBcnJheV1cIjtcblx0ICAgIH1cblxuXHQgICAgdGhpcy51cCgpO1xuXG5cdCAgICB3aGlsZSAoaS0tKSB7XG5cdCAgICAgIHJldFtpXSA9IHRoaXMucGFyc2UoYXJyW2ldLCB1bmRlZmluZWQsIHN0YWNrKTtcblx0ICAgIH1cblxuXHQgICAgdGhpcy5kb3duKCk7XG5cdCAgICByZXR1cm4gam9pbihcIltcIiwgcmV0LCBcIl1cIik7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gaXNBcnJheShvYmopIHtcblx0ICAgIHJldHVybiAoLy9OYXRpdmUgQXJyYXlzXG5cdCAgICAgIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiIHx8IC8vIE5vZGVMaXN0IG9iamVjdHNcblx0ICAgICAgdHlwZW9mIG9iai5sZW5ndGggPT09IFwibnVtYmVyXCIgJiYgb2JqLml0ZW0gIT09IHVuZGVmaW5lZCAmJiAob2JqLmxlbmd0aCA/IG9iai5pdGVtKDApID09PSBvYmpbMF0gOiBvYmouaXRlbSgwKSA9PT0gbnVsbCAmJiBvYmpbMF0gPT09IHVuZGVmaW5lZClcblx0ICAgICk7XG5cdCAgfVxuXG5cdCAgdmFyIHJlTmFtZSA9IC9eZnVuY3Rpb24gKFxcdyspLyxcblx0ICAgICAgZHVtcCA9IHtcblx0ICAgIC8vIFRoZSBvYmpUeXBlIGlzIHVzZWQgbW9zdGx5IGludGVybmFsbHksIHlvdSBjYW4gZml4IGEgKGN1c3RvbSkgdHlwZSBpbiBhZHZhbmNlXG5cdCAgICBwYXJzZTogZnVuY3Rpb24gcGFyc2Uob2JqLCBvYmpUeXBlLCBzdGFjaykge1xuXHQgICAgICBzdGFjayA9IHN0YWNrIHx8IFtdO1xuXHQgICAgICB2YXIgcmVzLFxuXHQgICAgICAgICAgcGFyc2VyLFxuXHQgICAgICAgICAgcGFyc2VyVHlwZSxcblx0ICAgICAgICAgIG9iakluZGV4ID0gc3RhY2suaW5kZXhPZihvYmopO1xuXG5cdCAgICAgIGlmIChvYmpJbmRleCAhPT0gLTEpIHtcblx0ICAgICAgICByZXR1cm4gXCJyZWN1cnNpb24oXCIuY29uY2F0KG9iakluZGV4IC0gc3RhY2subGVuZ3RoLCBcIilcIik7XG5cdCAgICAgIH1cblxuXHQgICAgICBvYmpUeXBlID0gb2JqVHlwZSB8fCB0aGlzLnR5cGVPZihvYmopO1xuXHQgICAgICBwYXJzZXIgPSB0aGlzLnBhcnNlcnNbb2JqVHlwZV07XG5cdCAgICAgIHBhcnNlclR5cGUgPSBfdHlwZW9mKHBhcnNlcik7XG5cblx0ICAgICAgaWYgKHBhcnNlclR5cGUgPT09IFwiZnVuY3Rpb25cIikge1xuXHQgICAgICAgIHN0YWNrLnB1c2gob2JqKTtcblx0ICAgICAgICByZXMgPSBwYXJzZXIuY2FsbCh0aGlzLCBvYmosIHN0YWNrKTtcblx0ICAgICAgICBzdGFjay5wb3AoKTtcblx0ICAgICAgICByZXR1cm4gcmVzO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIHBhcnNlclR5cGUgPT09IFwic3RyaW5nXCIgPyBwYXJzZXIgOiB0aGlzLnBhcnNlcnMuZXJyb3I7XG5cdCAgICB9LFxuXHQgICAgdHlwZU9mOiBmdW5jdGlvbiB0eXBlT2Yob2JqKSB7XG5cdCAgICAgIHZhciB0eXBlO1xuXG5cdCAgICAgIGlmIChvYmogPT09IG51bGwpIHtcblx0ICAgICAgICB0eXBlID0gXCJudWxsXCI7XG5cdCAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG9iaiA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHQgICAgICAgIHR5cGUgPSBcInVuZGVmaW5lZFwiO1xuXHQgICAgICB9IGVsc2UgaWYgKGlzKFwicmVnZXhwXCIsIG9iaikpIHtcblx0ICAgICAgICB0eXBlID0gXCJyZWdleHBcIjtcblx0ICAgICAgfSBlbHNlIGlmIChpcyhcImRhdGVcIiwgb2JqKSkge1xuXHQgICAgICAgIHR5cGUgPSBcImRhdGVcIjtcblx0ICAgICAgfSBlbHNlIGlmIChpcyhcImZ1bmN0aW9uXCIsIG9iaikpIHtcblx0ICAgICAgICB0eXBlID0gXCJmdW5jdGlvblwiO1xuXHQgICAgICB9IGVsc2UgaWYgKG9iai5zZXRJbnRlcnZhbCAhPT0gdW5kZWZpbmVkICYmIG9iai5kb2N1bWVudCAhPT0gdW5kZWZpbmVkICYmIG9iai5ub2RlVHlwZSA9PT0gdW5kZWZpbmVkKSB7XG5cdCAgICAgICAgdHlwZSA9IFwid2luZG93XCI7XG5cdCAgICAgIH0gZWxzZSBpZiAob2JqLm5vZGVUeXBlID09PSA5KSB7XG5cdCAgICAgICAgdHlwZSA9IFwiZG9jdW1lbnRcIjtcblx0ICAgICAgfSBlbHNlIGlmIChvYmoubm9kZVR5cGUpIHtcblx0ICAgICAgICB0eXBlID0gXCJub2RlXCI7XG5cdCAgICAgIH0gZWxzZSBpZiAoaXNBcnJheShvYmopKSB7XG5cdCAgICAgICAgdHlwZSA9IFwiYXJyYXlcIjtcblx0ICAgICAgfSBlbHNlIGlmIChvYmouY29uc3RydWN0b3IgPT09IEVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcikge1xuXHQgICAgICAgIHR5cGUgPSBcImVycm9yXCI7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgdHlwZSA9IF90eXBlb2Yob2JqKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiB0eXBlO1xuXHQgICAgfSxcblx0ICAgIHNlcGFyYXRvcjogZnVuY3Rpb24gc2VwYXJhdG9yKCkge1xuXHQgICAgICBpZiAodGhpcy5tdWx0aWxpbmUpIHtcblx0ICAgICAgICByZXR1cm4gdGhpcy5IVE1MID8gXCI8YnIgLz5cIiA6IFwiXFxuXCI7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmV0dXJuIHRoaXMuSFRNTCA/IFwiJiMxNjA7XCIgOiBcIiBcIjtcblx0ICAgICAgfVxuXHQgICAgfSxcblx0ICAgIC8vIEV4dHJhIGNhbiBiZSBhIG51bWJlciwgc2hvcnRjdXQgZm9yIGluY3JlYXNpbmctY2FsbGluZy1kZWNyZWFzaW5nXG5cdCAgICBpbmRlbnQ6IGZ1bmN0aW9uIGluZGVudChleHRyYSkge1xuXHQgICAgICBpZiAoIXRoaXMubXVsdGlsaW5lKSB7XG5cdCAgICAgICAgcmV0dXJuIFwiXCI7XG5cdCAgICAgIH1cblxuXHQgICAgICB2YXIgY2hyID0gdGhpcy5pbmRlbnRDaGFyO1xuXG5cdCAgICAgIGlmICh0aGlzLkhUTUwpIHtcblx0ICAgICAgICBjaHIgPSBjaHIucmVwbGFjZSgvXFx0L2csIFwiICAgXCIpLnJlcGxhY2UoLyAvZywgXCImIzE2MDtcIik7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gbmV3IEFycmF5KHRoaXMuZGVwdGggKyAoZXh0cmEgfHwgMCkpLmpvaW4oY2hyKTtcblx0ICAgIH0sXG5cdCAgICB1cDogZnVuY3Rpb24gdXAoYSkge1xuXHQgICAgICB0aGlzLmRlcHRoICs9IGEgfHwgMTtcblx0ICAgIH0sXG5cdCAgICBkb3duOiBmdW5jdGlvbiBkb3duKGEpIHtcblx0ICAgICAgdGhpcy5kZXB0aCAtPSBhIHx8IDE7XG5cdCAgICB9LFxuXHQgICAgc2V0UGFyc2VyOiBmdW5jdGlvbiBzZXRQYXJzZXIobmFtZSwgcGFyc2VyKSB7XG5cdCAgICAgIHRoaXMucGFyc2Vyc1tuYW1lXSA9IHBhcnNlcjtcblx0ICAgIH0sXG5cdCAgICAvLyBUaGUgbmV4dCAzIGFyZSBleHBvc2VkIHNvIHlvdSBjYW4gdXNlIHRoZW1cblx0ICAgIHF1b3RlOiBxdW90ZSxcblx0ICAgIGxpdGVyYWw6IGxpdGVyYWwsXG5cdCAgICBqb2luOiBqb2luLFxuXHQgICAgZGVwdGg6IDEsXG5cdCAgICBtYXhEZXB0aDogY29uZmlnLm1heERlcHRoLFxuXHQgICAgLy8gVGhpcyBpcyB0aGUgbGlzdCBvZiBwYXJzZXJzLCB0byBtb2RpZnkgdGhlbSwgdXNlIGR1bXAuc2V0UGFyc2VyXG5cdCAgICBwYXJzZXJzOiB7XG5cdCAgICAgIHdpbmRvdzogXCJbV2luZG93XVwiLFxuXHQgICAgICBkb2N1bWVudDogXCJbRG9jdW1lbnRdXCIsXG5cdCAgICAgIGVycm9yOiBmdW5jdGlvbiBlcnJvcihfZXJyb3IpIHtcblx0ICAgICAgICByZXR1cm4gXCJFcnJvcihcXFwiXCIgKyBfZXJyb3IubWVzc2FnZSArIFwiXFxcIilcIjtcblx0ICAgICAgfSxcblx0ICAgICAgdW5rbm93bjogXCJbVW5rbm93bl1cIixcblx0ICAgICAgXCJudWxsXCI6IFwibnVsbFwiLFxuXHQgICAgICBcInVuZGVmaW5lZFwiOiBcInVuZGVmaW5lZFwiLFxuXHQgICAgICBcImZ1bmN0aW9uXCI6IGZ1bmN0aW9uIF9mdW5jdGlvbihmbikge1xuXHQgICAgICAgIHZhciByZXQgPSBcImZ1bmN0aW9uXCIsXG5cdCAgICAgICAgICAgIC8vIEZ1bmN0aW9ucyBuZXZlciBoYXZlIG5hbWUgaW4gSUVcblx0ICAgICAgICBuYW1lID0gXCJuYW1lXCIgaW4gZm4gPyBmbi5uYW1lIDogKHJlTmFtZS5leGVjKGZuKSB8fCBbXSlbMV07XG5cblx0ICAgICAgICBpZiAobmFtZSkge1xuXHQgICAgICAgICAgcmV0ICs9IFwiIFwiICsgbmFtZTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICByZXQgKz0gXCIoXCI7XG5cdCAgICAgICAgcmV0ID0gW3JldCwgZHVtcC5wYXJzZShmbiwgXCJmdW5jdGlvbkFyZ3NcIiksIFwiKXtcIl0uam9pbihcIlwiKTtcblx0ICAgICAgICByZXR1cm4gam9pbihyZXQsIGR1bXAucGFyc2UoZm4sIFwiZnVuY3Rpb25Db2RlXCIpLCBcIn1cIik7XG5cdCAgICAgIH0sXG5cdCAgICAgIGFycmF5OiBhcnJheSxcblx0ICAgICAgbm9kZWxpc3Q6IGFycmF5LFxuXHQgICAgICBcImFyZ3VtZW50c1wiOiBhcnJheSxcblx0ICAgICAgb2JqZWN0OiBmdW5jdGlvbiBvYmplY3QobWFwLCBzdGFjaykge1xuXHQgICAgICAgIHZhciBrZXlzLFxuXHQgICAgICAgICAgICBrZXksXG5cdCAgICAgICAgICAgIHZhbCxcblx0ICAgICAgICAgICAgaSxcblx0ICAgICAgICAgICAgbm9uRW51bWVyYWJsZVByb3BlcnRpZXMsXG5cdCAgICAgICAgICAgIHJldCA9IFtdO1xuXG5cdCAgICAgICAgaWYgKGR1bXAubWF4RGVwdGggJiYgZHVtcC5kZXB0aCA+IGR1bXAubWF4RGVwdGgpIHtcblx0ICAgICAgICAgIHJldHVybiBcIltvYmplY3QgT2JqZWN0XVwiO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGR1bXAudXAoKTtcblx0ICAgICAgICBrZXlzID0gW107XG5cblx0ICAgICAgICBmb3IgKGtleSBpbiBtYXApIHtcblx0ICAgICAgICAgIGtleXMucHVzaChrZXkpO1xuXHQgICAgICAgIH0gLy8gU29tZSBwcm9wZXJ0aWVzIGFyZSBub3QgYWx3YXlzIGVudW1lcmFibGUgb24gRXJyb3Igb2JqZWN0cy5cblxuXG5cdCAgICAgICAgbm9uRW51bWVyYWJsZVByb3BlcnRpZXMgPSBbXCJtZXNzYWdlXCIsIFwibmFtZVwiXTtcblxuXHQgICAgICAgIGZvciAoaSBpbiBub25FbnVtZXJhYmxlUHJvcGVydGllcykge1xuXHQgICAgICAgICAga2V5ID0gbm9uRW51bWVyYWJsZVByb3BlcnRpZXNbaV07XG5cblx0ICAgICAgICAgIGlmIChrZXkgaW4gbWFwICYmICFpbkFycmF5KGtleSwga2V5cykpIHtcblx0ICAgICAgICAgICAga2V5cy5wdXNoKGtleSk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAga2V5cy5zb3J0KCk7XG5cblx0ICAgICAgICBmb3IgKGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAga2V5ID0ga2V5c1tpXTtcblx0ICAgICAgICAgIHZhbCA9IG1hcFtrZXldO1xuXHQgICAgICAgICAgcmV0LnB1c2goZHVtcC5wYXJzZShrZXksIFwia2V5XCIpICsgXCI6IFwiICsgZHVtcC5wYXJzZSh2YWwsIHVuZGVmaW5lZCwgc3RhY2spKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBkdW1wLmRvd24oKTtcblx0ICAgICAgICByZXR1cm4gam9pbihcIntcIiwgcmV0LCBcIn1cIik7XG5cdCAgICAgIH0sXG5cdCAgICAgIG5vZGU6IGZ1bmN0aW9uIG5vZGUoX25vZGUpIHtcblx0ICAgICAgICB2YXIgbGVuLFxuXHQgICAgICAgICAgICBpLFxuXHQgICAgICAgICAgICB2YWwsXG5cdCAgICAgICAgICAgIG9wZW4gPSBkdW1wLkhUTUwgPyBcIiZsdDtcIiA6IFwiPFwiLFxuXHQgICAgICAgICAgICBjbG9zZSA9IGR1bXAuSFRNTCA/IFwiJmd0O1wiIDogXCI+XCIsXG5cdCAgICAgICAgICAgIHRhZyA9IF9ub2RlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCksXG5cdCAgICAgICAgICAgIHJldCA9IG9wZW4gKyB0YWcsXG5cdCAgICAgICAgICAgIGF0dHJzID0gX25vZGUuYXR0cmlidXRlcztcblxuXHQgICAgICAgIGlmIChhdHRycykge1xuXHQgICAgICAgICAgZm9yIChpID0gMCwgbGVuID0gYXR0cnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0ICAgICAgICAgICAgdmFsID0gYXR0cnNbaV0ubm9kZVZhbHVlOyAvLyBJRTYgaW5jbHVkZXMgYWxsIGF0dHJpYnV0ZXMgaW4gLmF0dHJpYnV0ZXMsIGV2ZW4gb25lcyBub3QgZXhwbGljaXRseVxuXHQgICAgICAgICAgICAvLyBzZXQuIFRob3NlIGhhdmUgdmFsdWVzIGxpa2UgdW5kZWZpbmVkLCBudWxsLCAwLCBmYWxzZSwgXCJcIiBvclxuXHQgICAgICAgICAgICAvLyBcImluaGVyaXRcIi5cblxuXHQgICAgICAgICAgICBpZiAodmFsICYmIHZhbCAhPT0gXCJpbmhlcml0XCIpIHtcblx0ICAgICAgICAgICAgICByZXQgKz0gXCIgXCIgKyBhdHRyc1tpXS5ub2RlTmFtZSArIFwiPVwiICsgZHVtcC5wYXJzZSh2YWwsIFwiYXR0cmlidXRlXCIpO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgcmV0ICs9IGNsb3NlOyAvLyBTaG93IGNvbnRlbnQgb2YgVGV4dE5vZGUgb3IgQ0RBVEFTZWN0aW9uXG5cblx0ICAgICAgICBpZiAoX25vZGUubm9kZVR5cGUgPT09IDMgfHwgX25vZGUubm9kZVR5cGUgPT09IDQpIHtcblx0ICAgICAgICAgIHJldCArPSBfbm9kZS5ub2RlVmFsdWU7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgcmV0dXJuIHJldCArIG9wZW4gKyBcIi9cIiArIHRhZyArIGNsb3NlO1xuXHQgICAgICB9LFxuXHQgICAgICAvLyBGdW5jdGlvbiBjYWxscyBpdCBpbnRlcm5hbGx5LCBpdCdzIHRoZSBhcmd1bWVudHMgcGFydCBvZiB0aGUgZnVuY3Rpb25cblx0ICAgICAgZnVuY3Rpb25BcmdzOiBmdW5jdGlvbiBmdW5jdGlvbkFyZ3MoZm4pIHtcblx0ICAgICAgICB2YXIgYXJncyxcblx0ICAgICAgICAgICAgbCA9IGZuLmxlbmd0aDtcblxuXHQgICAgICAgIGlmICghbCkge1xuXHQgICAgICAgICAgcmV0dXJuIFwiXCI7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgYXJncyA9IG5ldyBBcnJheShsKTtcblxuXHQgICAgICAgIHdoaWxlIChsLS0pIHtcblx0ICAgICAgICAgIC8vIDk3IGlzICdhJ1xuXHQgICAgICAgICAgYXJnc1tsXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoOTcgKyBsKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICByZXR1cm4gXCIgXCIgKyBhcmdzLmpvaW4oXCIsIFwiKSArIFwiIFwiO1xuXHQgICAgICB9LFxuXHQgICAgICAvLyBPYmplY3QgY2FsbHMgaXQgaW50ZXJuYWxseSwgdGhlIGtleSBwYXJ0IG9mIGFuIGl0ZW0gaW4gYSBtYXBcblx0ICAgICAga2V5OiBxdW90ZSxcblx0ICAgICAgLy8gRnVuY3Rpb24gY2FsbHMgaXQgaW50ZXJuYWxseSwgaXQncyB0aGUgY29udGVudCBvZiB0aGUgZnVuY3Rpb25cblx0ICAgICAgZnVuY3Rpb25Db2RlOiBcIltjb2RlXVwiLFxuXHQgICAgICAvLyBOb2RlIGNhbGxzIGl0IGludGVybmFsbHksIGl0J3MgYSBodG1sIGF0dHJpYnV0ZSB2YWx1ZVxuXHQgICAgICBhdHRyaWJ1dGU6IHF1b3RlLFxuXHQgICAgICBzdHJpbmc6IHF1b3RlLFxuXHQgICAgICBkYXRlOiBxdW90ZSxcblx0ICAgICAgcmVnZXhwOiBsaXRlcmFsLFxuXHQgICAgICBudW1iZXI6IGxpdGVyYWwsXG5cdCAgICAgIFwiYm9vbGVhblwiOiBsaXRlcmFsLFxuXHQgICAgICBzeW1ib2w6IGZ1bmN0aW9uIHN5bWJvbChzeW0pIHtcblx0ICAgICAgICByZXR1cm4gc3ltLnRvU3RyaW5nKCk7XG5cdCAgICAgIH1cblx0ICAgIH0sXG5cdCAgICAvLyBJZiB0cnVlLCBlbnRpdGllcyBhcmUgZXNjYXBlZCAoIDwsID4sIFxcdCwgc3BhY2UgYW5kIFxcbiApXG5cdCAgICBIVE1MOiBmYWxzZSxcblx0ICAgIC8vIEluZGVudGF0aW9uIHVuaXRcblx0ICAgIGluZGVudENoYXI6IFwiICBcIixcblx0ICAgIC8vIElmIHRydWUsIGl0ZW1zIGluIGEgY29sbGVjdGlvbiwgYXJlIHNlcGFyYXRlZCBieSBhIFxcbiwgZWxzZSBqdXN0IGEgc3BhY2UuXG5cdCAgICBtdWx0aWxpbmU6IHRydWVcblx0ICB9O1xuXHQgIHJldHVybiBkdW1wO1xuXHR9KSgpO1xuXG5cdHZhciBTdWl0ZVJlcG9ydCA9IC8qI19fUFVSRV9fKi9mdW5jdGlvbiAoKSB7XG5cdCAgZnVuY3Rpb24gU3VpdGVSZXBvcnQobmFtZSwgcGFyZW50U3VpdGUpIHtcblx0ICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBTdWl0ZVJlcG9ydCk7XG5cblx0ICAgIHRoaXMubmFtZSA9IG5hbWU7XG5cdCAgICB0aGlzLmZ1bGxOYW1lID0gcGFyZW50U3VpdGUgPyBwYXJlbnRTdWl0ZS5mdWxsTmFtZS5jb25jYXQobmFtZSkgOiBbXTtcblx0ICAgIHRoaXMudGVzdHMgPSBbXTtcblx0ICAgIHRoaXMuY2hpbGRTdWl0ZXMgPSBbXTtcblxuXHQgICAgaWYgKHBhcmVudFN1aXRlKSB7XG5cdCAgICAgIHBhcmVudFN1aXRlLnB1c2hDaGlsZFN1aXRlKHRoaXMpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIF9jcmVhdGVDbGFzcyhTdWl0ZVJlcG9ydCwgW3tcblx0ICAgIGtleTogXCJzdGFydFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHN0YXJ0KHJlY29yZFRpbWUpIHtcblx0ICAgICAgaWYgKHJlY29yZFRpbWUpIHtcblx0ICAgICAgICB0aGlzLl9zdGFydFRpbWUgPSBwZXJmb3JtYW5jZU5vdygpO1xuXG5cdCAgICAgICAgaWYgKHBlcmZvcm1hbmNlKSB7XG5cdCAgICAgICAgICB2YXIgc3VpdGVMZXZlbCA9IHRoaXMuZnVsbE5hbWUubGVuZ3RoO1xuXHQgICAgICAgICAgcGVyZm9ybWFuY2UubWFyayhcInF1bml0X3N1aXRlX1wiLmNvbmNhdChzdWl0ZUxldmVsLCBcIl9zdGFydFwiKSk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIHtcblx0ICAgICAgICBuYW1lOiB0aGlzLm5hbWUsXG5cdCAgICAgICAgZnVsbE5hbWU6IHRoaXMuZnVsbE5hbWUuc2xpY2UoKSxcblx0ICAgICAgICB0ZXN0czogdGhpcy50ZXN0cy5tYXAoZnVuY3Rpb24gKHRlc3QpIHtcblx0ICAgICAgICAgIHJldHVybiB0ZXN0LnN0YXJ0KCk7XG5cdCAgICAgICAgfSksXG5cdCAgICAgICAgY2hpbGRTdWl0ZXM6IHRoaXMuY2hpbGRTdWl0ZXMubWFwKGZ1bmN0aW9uIChzdWl0ZSkge1xuXHQgICAgICAgICAgcmV0dXJuIHN1aXRlLnN0YXJ0KCk7XG5cdCAgICAgICAgfSksXG5cdCAgICAgICAgdGVzdENvdW50czoge1xuXHQgICAgICAgICAgdG90YWw6IHRoaXMuZ2V0VGVzdENvdW50cygpLnRvdGFsXG5cdCAgICAgICAgfVxuXHQgICAgICB9O1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJlbmRcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBlbmQocmVjb3JkVGltZSkge1xuXHQgICAgICBpZiAocmVjb3JkVGltZSkge1xuXHQgICAgICAgIHRoaXMuX2VuZFRpbWUgPSBwZXJmb3JtYW5jZU5vdygpO1xuXG5cdCAgICAgICAgaWYgKHBlcmZvcm1hbmNlKSB7XG5cdCAgICAgICAgICB2YXIgc3VpdGVMZXZlbCA9IHRoaXMuZnVsbE5hbWUubGVuZ3RoO1xuXHQgICAgICAgICAgcGVyZm9ybWFuY2UubWFyayhcInF1bml0X3N1aXRlX1wiLmNvbmNhdChzdWl0ZUxldmVsLCBcIl9lbmRcIikpO1xuXHQgICAgICAgICAgdmFyIHN1aXRlTmFtZSA9IHRoaXMuZnVsbE5hbWUuam9pbihcIiDigJMgXCIpO1xuXHQgICAgICAgICAgbWVhc3VyZShzdWl0ZUxldmVsID09PSAwID8gXCJRVW5pdCBUZXN0IFJ1blwiIDogXCJRVW5pdCBUZXN0IFN1aXRlOiBcIi5jb25jYXQoc3VpdGVOYW1lKSwgXCJxdW5pdF9zdWl0ZV9cIi5jb25jYXQoc3VpdGVMZXZlbCwgXCJfc3RhcnRcIiksIFwicXVuaXRfc3VpdGVfXCIuY29uY2F0KHN1aXRlTGV2ZWwsIFwiX2VuZFwiKSk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIHtcblx0ICAgICAgICBuYW1lOiB0aGlzLm5hbWUsXG5cdCAgICAgICAgZnVsbE5hbWU6IHRoaXMuZnVsbE5hbWUuc2xpY2UoKSxcblx0ICAgICAgICB0ZXN0czogdGhpcy50ZXN0cy5tYXAoZnVuY3Rpb24gKHRlc3QpIHtcblx0ICAgICAgICAgIHJldHVybiB0ZXN0LmVuZCgpO1xuXHQgICAgICAgIH0pLFxuXHQgICAgICAgIGNoaWxkU3VpdGVzOiB0aGlzLmNoaWxkU3VpdGVzLm1hcChmdW5jdGlvbiAoc3VpdGUpIHtcblx0ICAgICAgICAgIHJldHVybiBzdWl0ZS5lbmQoKTtcblx0ICAgICAgICB9KSxcblx0ICAgICAgICB0ZXN0Q291bnRzOiB0aGlzLmdldFRlc3RDb3VudHMoKSxcblx0ICAgICAgICBydW50aW1lOiB0aGlzLmdldFJ1bnRpbWUoKSxcblx0ICAgICAgICBzdGF0dXM6IHRoaXMuZ2V0U3RhdHVzKClcblx0ICAgICAgfTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwicHVzaENoaWxkU3VpdGVcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBwdXNoQ2hpbGRTdWl0ZShzdWl0ZSkge1xuXHQgICAgICB0aGlzLmNoaWxkU3VpdGVzLnB1c2goc3VpdGUpO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJwdXNoVGVzdFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHB1c2hUZXN0KHRlc3QpIHtcblx0ICAgICAgdGhpcy50ZXN0cy5wdXNoKHRlc3QpO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJnZXRSdW50aW1lXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0UnVudGltZSgpIHtcblx0ICAgICAgcmV0dXJuIHRoaXMuX2VuZFRpbWUgLSB0aGlzLl9zdGFydFRpbWU7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImdldFRlc3RDb3VudHNcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRUZXN0Q291bnRzKCkge1xuXHQgICAgICB2YXIgY291bnRzID0gYXJndW1lbnRzLmxlbmd0aCA+IDAgJiYgYXJndW1lbnRzWzBdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbMF0gOiB7XG5cdCAgICAgICAgcGFzc2VkOiAwLFxuXHQgICAgICAgIGZhaWxlZDogMCxcblx0ICAgICAgICBza2lwcGVkOiAwLFxuXHQgICAgICAgIHRvZG86IDAsXG5cdCAgICAgICAgdG90YWw6IDBcblx0ICAgICAgfTtcblx0ICAgICAgY291bnRzID0gdGhpcy50ZXN0cy5yZWR1Y2UoZnVuY3Rpb24gKGNvdW50cywgdGVzdCkge1xuXHQgICAgICAgIGlmICh0ZXN0LnZhbGlkKSB7XG5cdCAgICAgICAgICBjb3VudHNbdGVzdC5nZXRTdGF0dXMoKV0rKztcblx0ICAgICAgICAgIGNvdW50cy50b3RhbCsrO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHJldHVybiBjb3VudHM7XG5cdCAgICAgIH0sIGNvdW50cyk7XG5cdCAgICAgIHJldHVybiB0aGlzLmNoaWxkU3VpdGVzLnJlZHVjZShmdW5jdGlvbiAoY291bnRzLCBzdWl0ZSkge1xuXHQgICAgICAgIHJldHVybiBzdWl0ZS5nZXRUZXN0Q291bnRzKGNvdW50cyk7XG5cdCAgICAgIH0sIGNvdW50cyk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImdldFN0YXR1c1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGdldFN0YXR1cygpIHtcblx0ICAgICAgdmFyIF90aGlzJGdldFRlc3RDb3VudHMgPSB0aGlzLmdldFRlc3RDb3VudHMoKSxcblx0ICAgICAgICAgIHRvdGFsID0gX3RoaXMkZ2V0VGVzdENvdW50cy50b3RhbCxcblx0ICAgICAgICAgIGZhaWxlZCA9IF90aGlzJGdldFRlc3RDb3VudHMuZmFpbGVkLFxuXHQgICAgICAgICAgc2tpcHBlZCA9IF90aGlzJGdldFRlc3RDb3VudHMuc2tpcHBlZCxcblx0ICAgICAgICAgIHRvZG8gPSBfdGhpcyRnZXRUZXN0Q291bnRzLnRvZG87XG5cblx0ICAgICAgaWYgKGZhaWxlZCkge1xuXHQgICAgICAgIHJldHVybiBcImZhaWxlZFwiO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIGlmIChza2lwcGVkID09PSB0b3RhbCkge1xuXHQgICAgICAgICAgcmV0dXJuIFwic2tpcHBlZFwiO1xuXHQgICAgICAgIH0gZWxzZSBpZiAodG9kbyA9PT0gdG90YWwpIHtcblx0ICAgICAgICAgIHJldHVybiBcInRvZG9cIjtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgcmV0dXJuIFwicGFzc2VkXCI7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfV0pO1xuXG5cdCAgcmV0dXJuIFN1aXRlUmVwb3J0O1xuXHR9KCk7XG5cblx0dmFyIGZvY3VzZWQgPSBmYWxzZTtcblx0dmFyIG1vZHVsZVN0YWNrID0gW107XG5cblx0ZnVuY3Rpb24gaXNQYXJlbnRNb2R1bGVJblF1ZXVlKCkge1xuXHQgIHZhciBtb2R1bGVzSW5RdWV1ZSA9IGNvbmZpZy5tb2R1bGVzLm1hcChmdW5jdGlvbiAobW9kdWxlKSB7XG5cdCAgICByZXR1cm4gbW9kdWxlLm1vZHVsZUlkO1xuXHQgIH0pO1xuXHQgIHJldHVybiBtb2R1bGVTdGFjay5zb21lKGZ1bmN0aW9uIChtb2R1bGUpIHtcblx0ICAgIHJldHVybiBtb2R1bGVzSW5RdWV1ZS5pbmNsdWRlcyhtb2R1bGUubW9kdWxlSWQpO1xuXHQgIH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gY3JlYXRlTW9kdWxlKG5hbWUsIHRlc3RFbnZpcm9ubWVudCwgbW9kaWZpZXJzKSB7XG5cdCAgdmFyIHBhcmVudE1vZHVsZSA9IG1vZHVsZVN0YWNrLmxlbmd0aCA/IG1vZHVsZVN0YWNrLnNsaWNlKC0xKVswXSA6IG51bGw7XG5cdCAgdmFyIG1vZHVsZU5hbWUgPSBwYXJlbnRNb2R1bGUgIT09IG51bGwgPyBbcGFyZW50TW9kdWxlLm5hbWUsIG5hbWVdLmpvaW4oXCIgPiBcIikgOiBuYW1lO1xuXHQgIHZhciBwYXJlbnRTdWl0ZSA9IHBhcmVudE1vZHVsZSA/IHBhcmVudE1vZHVsZS5zdWl0ZVJlcG9ydCA6IGdsb2JhbFN1aXRlO1xuXHQgIHZhciBza2lwID0gcGFyZW50TW9kdWxlICE9PSBudWxsICYmIHBhcmVudE1vZHVsZS5za2lwIHx8IG1vZGlmaWVycy5za2lwO1xuXHQgIHZhciB0b2RvID0gcGFyZW50TW9kdWxlICE9PSBudWxsICYmIHBhcmVudE1vZHVsZS50b2RvIHx8IG1vZGlmaWVycy50b2RvO1xuXHQgIHZhciBtb2R1bGUgPSB7XG5cdCAgICBuYW1lOiBtb2R1bGVOYW1lLFxuXHQgICAgcGFyZW50TW9kdWxlOiBwYXJlbnRNb2R1bGUsXG5cdCAgICB0ZXN0czogW10sXG5cdCAgICBtb2R1bGVJZDogZ2VuZXJhdGVIYXNoKG1vZHVsZU5hbWUpLFxuXHQgICAgdGVzdHNSdW46IDAsXG5cdCAgICB1bnNraXBwZWRUZXN0c1J1bjogMCxcblx0ICAgIGNoaWxkTW9kdWxlczogW10sXG5cdCAgICBzdWl0ZVJlcG9ydDogbmV3IFN1aXRlUmVwb3J0KG5hbWUsIHBhcmVudFN1aXRlKSxcblx0ICAgIC8vIFBhc3MgYWxvbmcgYHNraXBgIGFuZCBgdG9kb2AgcHJvcGVydGllcyBmcm9tIHBhcmVudCBtb2R1bGUsIGluIGNhc2Vcblx0ICAgIC8vIHRoZXJlIGlzIG9uZSwgdG8gY2hpbGRzLiBBbmQgdXNlIG93biBvdGhlcndpc2UuXG5cdCAgICAvLyBUaGlzIHByb3BlcnR5IHdpbGwgYmUgdXNlZCB0byBtYXJrIG93biB0ZXN0cyBhbmQgdGVzdHMgb2YgY2hpbGQgc3VpdGVzXG5cdCAgICAvLyBhcyBlaXRoZXIgYHNraXBwZWRgIG9yIGB0b2RvYC5cblx0ICAgIHNraXA6IHNraXAsXG5cdCAgICB0b2RvOiBza2lwID8gZmFsc2UgOiB0b2RvXG5cdCAgfTtcblx0ICB2YXIgZW52ID0ge307XG5cblx0ICBpZiAocGFyZW50TW9kdWxlKSB7XG5cdCAgICBwYXJlbnRNb2R1bGUuY2hpbGRNb2R1bGVzLnB1c2gobW9kdWxlKTtcblx0ICAgIGV4dGVuZChlbnYsIHBhcmVudE1vZHVsZS50ZXN0RW52aXJvbm1lbnQpO1xuXHQgIH1cblxuXHQgIGV4dGVuZChlbnYsIHRlc3RFbnZpcm9ubWVudCk7XG5cdCAgbW9kdWxlLnRlc3RFbnZpcm9ubWVudCA9IGVudjtcblx0ICBjb25maWcubW9kdWxlcy5wdXNoKG1vZHVsZSk7XG5cdCAgcmV0dXJuIG1vZHVsZTtcblx0fVxuXG5cdGZ1bmN0aW9uIHByb2Nlc3NNb2R1bGUobmFtZSwgb3B0aW9ucywgZXhlY3V0ZU5vdykge1xuXHQgIHZhciBtb2RpZmllcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMyAmJiBhcmd1bWVudHNbM10gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1szXSA6IHt9O1xuXG5cdCAgaWYgKG9iamVjdFR5cGUob3B0aW9ucykgPT09IFwiZnVuY3Rpb25cIikge1xuXHQgICAgZXhlY3V0ZU5vdyA9IG9wdGlvbnM7XG5cdCAgICBvcHRpb25zID0gdW5kZWZpbmVkO1xuXHQgIH1cblxuXHQgIHZhciBtb2R1bGUgPSBjcmVhdGVNb2R1bGUobmFtZSwgb3B0aW9ucywgbW9kaWZpZXJzKTsgLy8gTW92ZSBhbnkgaG9va3MgdG8gYSAnaG9va3MnIG9iamVjdFxuXG5cdCAgdmFyIHRlc3RFbnZpcm9ubWVudCA9IG1vZHVsZS50ZXN0RW52aXJvbm1lbnQ7XG5cdCAgdmFyIGhvb2tzID0gbW9kdWxlLmhvb2tzID0ge307XG5cdCAgc2V0SG9va0Zyb21FbnZpcm9ubWVudChob29rcywgdGVzdEVudmlyb25tZW50LCBcImJlZm9yZVwiKTtcblx0ICBzZXRIb29rRnJvbUVudmlyb25tZW50KGhvb2tzLCB0ZXN0RW52aXJvbm1lbnQsIFwiYmVmb3JlRWFjaFwiKTtcblx0ICBzZXRIb29rRnJvbUVudmlyb25tZW50KGhvb2tzLCB0ZXN0RW52aXJvbm1lbnQsIFwiYWZ0ZXJFYWNoXCIpO1xuXHQgIHNldEhvb2tGcm9tRW52aXJvbm1lbnQoaG9va3MsIHRlc3RFbnZpcm9ubWVudCwgXCJhZnRlclwiKTtcblx0ICB2YXIgbW9kdWxlRm5zID0ge1xuXHQgICAgYmVmb3JlOiBzZXRIb29rRnVuY3Rpb24obW9kdWxlLCBcImJlZm9yZVwiKSxcblx0ICAgIGJlZm9yZUVhY2g6IHNldEhvb2tGdW5jdGlvbihtb2R1bGUsIFwiYmVmb3JlRWFjaFwiKSxcblx0ICAgIGFmdGVyRWFjaDogc2V0SG9va0Z1bmN0aW9uKG1vZHVsZSwgXCJhZnRlckVhY2hcIiksXG5cdCAgICBhZnRlcjogc2V0SG9va0Z1bmN0aW9uKG1vZHVsZSwgXCJhZnRlclwiKVxuXHQgIH07XG5cdCAgdmFyIGN1cnJlbnRNb2R1bGUgPSBjb25maWcuY3VycmVudE1vZHVsZTtcblxuXHQgIGlmIChvYmplY3RUeXBlKGV4ZWN1dGVOb3cpID09PSBcImZ1bmN0aW9uXCIpIHtcblx0ICAgIG1vZHVsZVN0YWNrLnB1c2gobW9kdWxlKTtcblx0ICAgIGNvbmZpZy5jdXJyZW50TW9kdWxlID0gbW9kdWxlO1xuXHQgICAgZXhlY3V0ZU5vdy5jYWxsKG1vZHVsZS50ZXN0RW52aXJvbm1lbnQsIG1vZHVsZUZucyk7XG5cdCAgICBtb2R1bGVTdGFjay5wb3AoKTtcblx0ICAgIG1vZHVsZSA9IG1vZHVsZS5wYXJlbnRNb2R1bGUgfHwgY3VycmVudE1vZHVsZTtcblx0ICB9XG5cblx0ICBjb25maWcuY3VycmVudE1vZHVsZSA9IG1vZHVsZTtcblxuXHQgIGZ1bmN0aW9uIHNldEhvb2tGcm9tRW52aXJvbm1lbnQoaG9va3MsIGVudmlyb25tZW50LCBuYW1lKSB7XG5cdCAgICB2YXIgcG90ZW50aWFsSG9vayA9IGVudmlyb25tZW50W25hbWVdO1xuXHQgICAgaG9va3NbbmFtZV0gPSB0eXBlb2YgcG90ZW50aWFsSG9vayA9PT0gXCJmdW5jdGlvblwiID8gW3BvdGVudGlhbEhvb2tdIDogW107XG5cdCAgICBkZWxldGUgZW52aXJvbm1lbnRbbmFtZV07XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gc2V0SG9va0Z1bmN0aW9uKG1vZHVsZSwgaG9va05hbWUpIHtcblx0ICAgIHJldHVybiBmdW5jdGlvbiBzZXRIb29rKGNhbGxiYWNrKSB7XG5cdCAgICAgIG1vZHVsZS5ob29rc1tob29rTmFtZV0ucHVzaChjYWxsYmFjayk7XG5cdCAgICB9O1xuXHQgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIG1vZHVsZSQxKG5hbWUsIG9wdGlvbnMsIGV4ZWN1dGVOb3cpIHtcblx0ICBpZiAoZm9jdXNlZCAmJiAhaXNQYXJlbnRNb2R1bGVJblF1ZXVlKCkpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICBwcm9jZXNzTW9kdWxlKG5hbWUsIG9wdGlvbnMsIGV4ZWN1dGVOb3cpO1xuXHR9XG5cblx0bW9kdWxlJDEub25seSA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAoIWZvY3VzZWQpIHtcblx0ICAgIGNvbmZpZy5tb2R1bGVzLmxlbmd0aCA9IDA7XG5cdCAgICBjb25maWcucXVldWUubGVuZ3RoID0gMDtcblx0ICB9XG5cblx0ICBwcm9jZXNzTW9kdWxlLmFwcGx5KHZvaWQgMCwgYXJndW1lbnRzKTtcblx0ICBmb2N1c2VkID0gdHJ1ZTtcblx0fTtcblxuXHRtb2R1bGUkMS5za2lwID0gZnVuY3Rpb24gKG5hbWUsIG9wdGlvbnMsIGV4ZWN1dGVOb3cpIHtcblx0ICBpZiAoZm9jdXNlZCkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHByb2Nlc3NNb2R1bGUobmFtZSwgb3B0aW9ucywgZXhlY3V0ZU5vdywge1xuXHQgICAgc2tpcDogdHJ1ZVxuXHQgIH0pO1xuXHR9O1xuXG5cdG1vZHVsZSQxLnRvZG8gPSBmdW5jdGlvbiAobmFtZSwgb3B0aW9ucywgZXhlY3V0ZU5vdykge1xuXHQgIGlmIChmb2N1c2VkKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgcHJvY2Vzc01vZHVsZShuYW1lLCBvcHRpb25zLCBleGVjdXRlTm93LCB7XG5cdCAgICB0b2RvOiB0cnVlXG5cdCAgfSk7XG5cdH07XG5cblx0dmFyIExJU1RFTkVSUyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdHZhciBTVVBQT1JURURfRVZFTlRTID0gW1wicnVuU3RhcnRcIiwgXCJzdWl0ZVN0YXJ0XCIsIFwidGVzdFN0YXJ0XCIsIFwiYXNzZXJ0aW9uXCIsIFwidGVzdEVuZFwiLCBcInN1aXRlRW5kXCIsIFwicnVuRW5kXCJdO1xuXHQvKipcblx0ICogRW1pdHMgYW4gZXZlbnQgd2l0aCB0aGUgc3BlY2lmaWVkIGRhdGEgdG8gYWxsIGN1cnJlbnRseSByZWdpc3RlcmVkIGxpc3RlbmVycy5cblx0ICogQ2FsbGJhY2tzIHdpbGwgZmlyZSBpbiB0aGUgb3JkZXIgaW4gd2hpY2ggdGhleSBhcmUgcmVnaXN0ZXJlZCAoRklGTykuIFRoaXNcblx0ICogZnVuY3Rpb24gaXMgbm90IGV4cG9zZWQgcHVibGljbHk7IGl0IGlzIHVzZWQgYnkgUVVuaXQgaW50ZXJuYWxzIHRvIGVtaXRcblx0ICogbG9nZ2luZyBldmVudHMuXG5cdCAqXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBtZXRob2QgZW1pdFxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhXG5cdCAqIEByZXR1cm4ge1ZvaWR9XG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGVtaXQoZXZlbnROYW1lLCBkYXRhKSB7XG5cdCAgaWYgKG9iamVjdFR5cGUoZXZlbnROYW1lKSAhPT0gXCJzdHJpbmdcIikge1xuXHQgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImV2ZW50TmFtZSBtdXN0IGJlIGEgc3RyaW5nIHdoZW4gZW1pdHRpbmcgYW4gZXZlbnRcIik7XG5cdCAgfSAvLyBDbG9uZSB0aGUgY2FsbGJhY2tzIGluIGNhc2Ugb25lIG9mIHRoZW0gcmVnaXN0ZXJzIGEgbmV3IGNhbGxiYWNrXG5cblxuXHQgIHZhciBvcmlnaW5hbENhbGxiYWNrcyA9IExJU1RFTkVSU1tldmVudE5hbWVdO1xuXHQgIHZhciBjYWxsYmFja3MgPSBvcmlnaW5hbENhbGxiYWNrcyA/IF90b0NvbnN1bWFibGVBcnJheShvcmlnaW5hbENhbGxiYWNrcykgOiBbXTtcblxuXHQgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICBjYWxsYmFja3NbaV0oZGF0YSk7XG5cdCAgfVxuXHR9XG5cdC8qKlxuXHQgKiBSZWdpc3RlcnMgYSBjYWxsYmFjayBhcyBhIGxpc3RlbmVyIHRvIHRoZSBzcGVjaWZpZWQgZXZlbnQuXG5cdCAqXG5cdCAqIEBwdWJsaWNcblx0ICogQG1ldGhvZCBvblxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG5cdCAqIEByZXR1cm4ge1ZvaWR9XG5cdCAqL1xuXG5cdGZ1bmN0aW9uIG9uKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcblx0ICBpZiAob2JqZWN0VHlwZShldmVudE5hbWUpICE9PSBcInN0cmluZ1wiKSB7XG5cdCAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZXZlbnROYW1lIG11c3QgYmUgYSBzdHJpbmcgd2hlbiByZWdpc3RlcmluZyBhIGxpc3RlbmVyXCIpO1xuXHQgIH0gZWxzZSBpZiAoIWluQXJyYXkoZXZlbnROYW1lLCBTVVBQT1JURURfRVZFTlRTKSkge1xuXHQgICAgdmFyIGV2ZW50cyA9IFNVUFBPUlRFRF9FVkVOVFMuam9pbihcIiwgXCIpO1xuXHQgICAgdGhyb3cgbmV3IEVycm9yKFwiXFxcIlwiLmNvbmNhdChldmVudE5hbWUsIFwiXFxcIiBpcyBub3QgYSB2YWxpZCBldmVudDsgbXVzdCBiZSBvbmUgb2Y6IFwiKS5jb25jYXQoZXZlbnRzLCBcIi5cIikpO1xuXHQgIH0gZWxzZSBpZiAob2JqZWN0VHlwZShjYWxsYmFjaykgIT09IFwiZnVuY3Rpb25cIikge1xuXHQgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbGxiYWNrIG11c3QgYmUgYSBmdW5jdGlvbiB3aGVuIHJlZ2lzdGVyaW5nIGEgbGlzdGVuZXJcIik7XG5cdCAgfVxuXG5cdCAgaWYgKCFMSVNURU5FUlNbZXZlbnROYW1lXSkge1xuXHQgICAgTElTVEVORVJTW2V2ZW50TmFtZV0gPSBbXTtcblx0ICB9IC8vIERvbid0IHJlZ2lzdGVyIHRoZSBzYW1lIGNhbGxiYWNrIG1vcmUgdGhhbiBvbmNlXG5cblxuXHQgIGlmICghaW5BcnJheShjYWxsYmFjaywgTElTVEVORVJTW2V2ZW50TmFtZV0pKSB7XG5cdCAgICBMSVNURU5FUlNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcblx0ICB9XG5cdH1cblxuXHR2YXIgY29tbW9uanNHbG9iYWwgPSB0eXBlb2YgZ2xvYmFsVGhpcyAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWxUaGlzIDogdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJyA/IHNlbGYgOiB7fTtcblxuXHRmdW5jdGlvbiBjcmVhdGVDb21tb25qc01vZHVsZShmbiwgYmFzZWRpciwgbW9kdWxlKSB7XG5cdFx0cmV0dXJuIG1vZHVsZSA9IHtcblx0XHQgIHBhdGg6IGJhc2VkaXIsXG5cdFx0ICBleHBvcnRzOiB7fSxcblx0XHQgIHJlcXVpcmU6IGZ1bmN0aW9uIChwYXRoLCBiYXNlKSB7XG5cdCAgICAgIHJldHVybiBjb21tb25qc1JlcXVpcmUocGF0aCwgKGJhc2UgPT09IHVuZGVmaW5lZCB8fCBiYXNlID09PSBudWxsKSA/IG1vZHVsZS5wYXRoIDogYmFzZSk7XG5cdCAgICB9XG5cdFx0fSwgZm4obW9kdWxlLCBtb2R1bGUuZXhwb3J0cyksIG1vZHVsZS5leHBvcnRzO1xuXHR9XG5cblx0ZnVuY3Rpb24gY29tbW9uanNSZXF1aXJlICgpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0R5bmFtaWMgcmVxdWlyZXMgYXJlIG5vdCBjdXJyZW50bHkgc3VwcG9ydGVkIGJ5IEByb2xsdXAvcGx1Z2luLWNvbW1vbmpzJyk7XG5cdH1cblxuXHR2YXIgZXM2UHJvbWlzZSA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0ICAvKiFcblx0ICAgKiBAb3ZlcnZpZXcgZXM2LXByb21pc2UgLSBhIHRpbnkgaW1wbGVtZW50YXRpb24gb2YgUHJvbWlzZXMvQSsuXG5cdCAgICogQGNvcHlyaWdodCBDb3B5cmlnaHQgKGMpIDIwMTQgWWVodWRhIEthdHosIFRvbSBEYWxlLCBTdGVmYW4gUGVubmVyIGFuZCBjb250cmlidXRvcnMgKENvbnZlcnNpb24gdG8gRVM2IEFQSSBieSBKYWtlIEFyY2hpYmFsZClcblx0ICAgKiBAbGljZW5zZSAgIExpY2Vuc2VkIHVuZGVyIE1JVCBsaWNlbnNlXG5cdCAgICogICAgICAgICAgICBTZWUgaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL3N0ZWZhbnBlbm5lci9lczYtcHJvbWlzZS9tYXN0ZXIvTElDRU5TRVxuXHQgICAqIEB2ZXJzaW9uICAgdjQuMi44KzFlNjhkY2U2XG5cdCAgICovXG5cdCAgKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcblx0ICAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKSA7XG5cdCAgfSkoY29tbW9uanNHbG9iYWwsIGZ1bmN0aW9uICgpIHtcblxuXHQgICAgZnVuY3Rpb24gb2JqZWN0T3JGdW5jdGlvbih4KSB7XG5cdCAgICAgIHZhciB0eXBlID0gdHlwZW9mIHg7XG5cdCAgICAgIHJldHVybiB4ICE9PSBudWxsICYmICh0eXBlID09PSAnb2JqZWN0JyB8fCB0eXBlID09PSAnZnVuY3Rpb24nKTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gaXNGdW5jdGlvbih4KSB7XG5cdCAgICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJztcblx0ICAgIH1cblxuXHQgICAgdmFyIF9pc0FycmF5ID0gdm9pZCAwO1xuXG5cdCAgICBpZiAoQXJyYXkuaXNBcnJheSkge1xuXHQgICAgICBfaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBfaXNBcnJheSA9IGZ1bmN0aW9uICh4KSB7XG5cdCAgICAgICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcblx0ICAgICAgfTtcblx0ICAgIH1cblxuXHQgICAgdmFyIGlzQXJyYXkgPSBfaXNBcnJheTtcblx0ICAgIHZhciBsZW4gPSAwO1xuXHQgICAgdmFyIHZlcnR4TmV4dCA9IHZvaWQgMDtcblx0ICAgIHZhciBjdXN0b21TY2hlZHVsZXJGbiA9IHZvaWQgMDtcblxuXHQgICAgdmFyIGFzYXAgPSBmdW5jdGlvbiBhc2FwKGNhbGxiYWNrLCBhcmcpIHtcblx0ICAgICAgcXVldWVbbGVuXSA9IGNhbGxiYWNrO1xuXHQgICAgICBxdWV1ZVtsZW4gKyAxXSA9IGFyZztcblx0ICAgICAgbGVuICs9IDI7XG5cblx0ICAgICAgaWYgKGxlbiA9PT0gMikge1xuXHQgICAgICAgIC8vIElmIGxlbiBpcyAyLCB0aGF0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byBzY2hlZHVsZSBhbiBhc3luYyBmbHVzaC5cblx0ICAgICAgICAvLyBJZiBhZGRpdGlvbmFsIGNhbGxiYWNrcyBhcmUgcXVldWVkIGJlZm9yZSB0aGUgcXVldWUgaXMgZmx1c2hlZCwgdGhleVxuXHQgICAgICAgIC8vIHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoaXMgZmx1c2ggdGhhdCB3ZSBhcmUgc2NoZWR1bGluZy5cblx0ICAgICAgICBpZiAoY3VzdG9tU2NoZWR1bGVyRm4pIHtcblx0ICAgICAgICAgIGN1c3RvbVNjaGVkdWxlckZuKGZsdXNoKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgc2NoZWR1bGVGbHVzaCgpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfTtcblxuXHQgICAgZnVuY3Rpb24gc2V0U2NoZWR1bGVyKHNjaGVkdWxlRm4pIHtcblx0ICAgICAgY3VzdG9tU2NoZWR1bGVyRm4gPSBzY2hlZHVsZUZuO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBzZXRBc2FwKGFzYXBGbikge1xuXHQgICAgICBhc2FwID0gYXNhcEZuO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgYnJvd3NlcldpbmRvdyA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogdW5kZWZpbmVkO1xuXHQgICAgdmFyIGJyb3dzZXJHbG9iYWwgPSBicm93c2VyV2luZG93IHx8IHt9O1xuXHQgICAgdmFyIEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyID0gYnJvd3Nlckdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGJyb3dzZXJHbG9iYWwuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjtcblx0ICAgIHZhciBpc05vZGUgPSB0eXBlb2Ygc2VsZiA9PT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHt9LnRvU3RyaW5nLmNhbGwocHJvY2VzcykgPT09ICdbb2JqZWN0IHByb2Nlc3NdJzsgLy8gdGVzdCBmb3Igd2ViIHdvcmtlciBidXQgbm90IGluIElFMTBcblxuXHQgICAgdmFyIGlzV29ya2VyID0gdHlwZW9mIFVpbnQ4Q2xhbXBlZEFycmF5ICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgaW1wb3J0U2NyaXB0cyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIE1lc3NhZ2VDaGFubmVsICE9PSAndW5kZWZpbmVkJzsgLy8gbm9kZVxuXG5cdCAgICBmdW5jdGlvbiB1c2VOZXh0VGljaygpIHtcblx0ICAgICAgLy8gbm9kZSB2ZXJzaW9uIDAuMTAueCBkaXNwbGF5cyBhIGRlcHJlY2F0aW9uIHdhcm5pbmcgd2hlbiBuZXh0VGljayBpcyB1c2VkIHJlY3Vyc2l2ZWx5XG5cdCAgICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vY3Vqb2pzL3doZW4vaXNzdWVzLzQxMCBmb3IgZGV0YWlsc1xuXHQgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHJldHVybiBwcm9jZXNzLm5leHRUaWNrKGZsdXNoKTtcblx0ICAgICAgfTtcblx0ICAgIH0gLy8gdmVydHhcblxuXG5cdCAgICBmdW5jdGlvbiB1c2VWZXJ0eFRpbWVyKCkge1xuXHQgICAgICBpZiAodHlwZW9mIHZlcnR4TmV4dCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0ICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgdmVydHhOZXh0KGZsdXNoKTtcblx0ICAgICAgICB9O1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIHVzZVNldFRpbWVvdXQoKTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gdXNlTXV0YXRpb25PYnNlcnZlcigpIHtcblx0ICAgICAgdmFyIGl0ZXJhdGlvbnMgPSAwO1xuXHQgICAgICB2YXIgb2JzZXJ2ZXIgPSBuZXcgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIoZmx1c2gpO1xuXHQgICAgICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcblx0ICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZShub2RlLCB7XG5cdCAgICAgICAgY2hhcmFjdGVyRGF0YTogdHJ1ZVxuXHQgICAgICB9KTtcblx0ICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBub2RlLmRhdGEgPSBpdGVyYXRpb25zID0gKytpdGVyYXRpb25zICUgMjtcblx0ICAgICAgfTtcblx0ICAgIH0gLy8gd2ViIHdvcmtlclxuXG5cblx0ICAgIGZ1bmN0aW9uIHVzZU1lc3NhZ2VDaGFubmVsKCkge1xuXHQgICAgICB2YXIgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuXHQgICAgICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGZsdXNoO1xuXHQgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHJldHVybiBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuXHQgICAgICB9O1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiB1c2VTZXRUaW1lb3V0KCkge1xuXHQgICAgICAvLyBTdG9yZSBzZXRUaW1lb3V0IHJlZmVyZW5jZSBzbyBlczYtcHJvbWlzZSB3aWxsIGJlIHVuYWZmZWN0ZWQgYnlcblx0ICAgICAgLy8gb3RoZXIgY29kZSBtb2RpZnlpbmcgc2V0VGltZW91dCAobGlrZSBzaW5vbi51c2VGYWtlVGltZXJzKCkpXG5cdCAgICAgIHZhciBnbG9iYWxTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcblx0ICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICByZXR1cm4gZ2xvYmFsU2V0VGltZW91dChmbHVzaCwgMSk7XG5cdCAgICAgIH07XG5cdCAgICB9XG5cblx0ICAgIHZhciBxdWV1ZSA9IG5ldyBBcnJheSgxMDAwKTtcblxuXHQgICAgZnVuY3Rpb24gZmx1c2goKSB7XG5cdCAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDIpIHtcblx0ICAgICAgICB2YXIgY2FsbGJhY2sgPSBxdWV1ZVtpXTtcblx0ICAgICAgICB2YXIgYXJnID0gcXVldWVbaSArIDFdO1xuXHQgICAgICAgIGNhbGxiYWNrKGFyZyk7XG5cdCAgICAgICAgcXVldWVbaV0gPSB1bmRlZmluZWQ7XG5cdCAgICAgICAgcXVldWVbaSArIDFdID0gdW5kZWZpbmVkO1xuXHQgICAgICB9XG5cblx0ICAgICAgbGVuID0gMDtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gYXR0ZW1wdFZlcnR4KCkge1xuXHQgICAgICB0cnkge1xuXHQgICAgICAgIHZhciB2ZXJ0eCA9IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCkucmVxdWlyZSgndmVydHgnKTtcblxuXHQgICAgICAgIHZlcnR4TmV4dCA9IHZlcnR4LnJ1bk9uTG9vcCB8fCB2ZXJ0eC5ydW5PbkNvbnRleHQ7XG5cdCAgICAgICAgcmV0dXJuIHVzZVZlcnR4VGltZXIoKTtcblx0ICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgIHJldHVybiB1c2VTZXRUaW1lb3V0KCk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgdmFyIHNjaGVkdWxlRmx1c2ggPSB2b2lkIDA7IC8vIERlY2lkZSB3aGF0IGFzeW5jIG1ldGhvZCB0byB1c2UgdG8gdHJpZ2dlcmluZyBwcm9jZXNzaW5nIG9mIHF1ZXVlZCBjYWxsYmFja3M6XG5cblx0ICAgIGlmIChpc05vZGUpIHtcblx0ICAgICAgc2NoZWR1bGVGbHVzaCA9IHVzZU5leHRUaWNrKCk7XG5cdCAgICB9IGVsc2UgaWYgKEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKSB7XG5cdCAgICAgIHNjaGVkdWxlRmx1c2ggPSB1c2VNdXRhdGlvbk9ic2VydmVyKCk7XG5cdCAgICB9IGVsc2UgaWYgKGlzV29ya2VyKSB7XG5cdCAgICAgIHNjaGVkdWxlRmx1c2ggPSB1c2VNZXNzYWdlQ2hhbm5lbCgpO1xuXHQgICAgfSBlbHNlIGlmIChicm93c2VyV2luZG93ID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIGNvbW1vbmpzUmVxdWlyZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHQgICAgICBzY2hlZHVsZUZsdXNoID0gYXR0ZW1wdFZlcnR4KCk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBzY2hlZHVsZUZsdXNoID0gdXNlU2V0VGltZW91dCgpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiB0aGVuKG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG5cdCAgICAgIHZhciBwYXJlbnQgPSB0aGlzO1xuXHQgICAgICB2YXIgY2hpbGQgPSBuZXcgdGhpcy5jb25zdHJ1Y3Rvcihub29wKTtcblxuXHQgICAgICBpZiAoY2hpbGRbUFJPTUlTRV9JRF0gPT09IHVuZGVmaW5lZCkge1xuXHQgICAgICAgIG1ha2VQcm9taXNlKGNoaWxkKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHZhciBfc3RhdGUgPSBwYXJlbnQuX3N0YXRlO1xuXG5cdCAgICAgIGlmIChfc3RhdGUpIHtcblx0ICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbX3N0YXRlIC0gMV07XG5cdCAgICAgICAgYXNhcChmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICByZXR1cm4gaW52b2tlQ2FsbGJhY2soX3N0YXRlLCBjaGlsZCwgY2FsbGJhY2ssIHBhcmVudC5fcmVzdWx0KTtcblx0ICAgICAgICB9KTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIGNoaWxkO1xuXHQgICAgfVxuXHQgICAgLyoqXG5cdCAgICAgIGBQcm9taXNlLnJlc29sdmVgIHJldHVybnMgYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgcmVzb2x2ZWQgd2l0aCB0aGVcblx0ICAgICAgcGFzc2VkIGB2YWx1ZWAuIEl0IGlzIHNob3J0aGFuZCBmb3IgdGhlIGZvbGxvd2luZzpcblx0ICAgIFxuXHQgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGxldCBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0ICAgICAgICByZXNvbHZlKDEpO1xuXHQgICAgICB9KTtcblx0ICAgIFxuXHQgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuXHQgICAgICAgIC8vIHZhbHVlID09PSAxXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlIGFib3ZlLCB5b3VyIGNvZGUgbm93IHNpbXBseSBiZWNvbWVzIHRoZSBmb2xsb3dpbmc6XG5cdCAgICBcblx0ICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBsZXQgcHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgxKTtcblx0ICAgIFxuXHQgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuXHQgICAgICAgIC8vIHZhbHVlID09PSAxXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBAbWV0aG9kIHJlc29sdmVcblx0ICAgICAgQHN0YXRpY1xuXHQgICAgICBAcGFyYW0ge0FueX0gdmFsdWUgdmFsdWUgdGhhdCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlc29sdmVkIHdpdGhcblx0ICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuXHQgICAgICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSBmdWxmaWxsZWQgd2l0aCB0aGUgZ2l2ZW5cblx0ICAgICAgYHZhbHVlYFxuXHQgICAgKi9cblxuXG5cdCAgICBmdW5jdGlvbiByZXNvbHZlJDEob2JqZWN0KSB7XG5cdCAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG5cdCAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cblx0ICAgICAgaWYgKG9iamVjdCAmJiB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJiBvYmplY3QuY29uc3RydWN0b3IgPT09IENvbnN0cnVjdG9yKSB7XG5cdCAgICAgICAgcmV0dXJuIG9iamVjdDtcblx0ICAgICAgfVxuXG5cdCAgICAgIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKG5vb3ApO1xuXHQgICAgICByZXNvbHZlKHByb21pc2UsIG9iamVjdCk7XG5cdCAgICAgIHJldHVybiBwcm9taXNlO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgUFJPTUlTRV9JRCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZygyKTtcblxuXHQgICAgZnVuY3Rpb24gbm9vcCgpIHt9XG5cblx0ICAgIHZhciBQRU5ESU5HID0gdm9pZCAwO1xuXHQgICAgdmFyIEZVTEZJTExFRCA9IDE7XG5cdCAgICB2YXIgUkVKRUNURUQgPSAyO1xuXG5cdCAgICBmdW5jdGlvbiBzZWxmRnVsZmlsbG1lbnQoKSB7XG5cdCAgICAgIHJldHVybiBuZXcgVHlwZUVycm9yKFwiWW91IGNhbm5vdCByZXNvbHZlIGEgcHJvbWlzZSB3aXRoIGl0c2VsZlwiKTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gY2Fubm90UmV0dXJuT3duKCkge1xuXHQgICAgICByZXR1cm4gbmV3IFR5cGVFcnJvcignQSBwcm9taXNlcyBjYWxsYmFjayBjYW5ub3QgcmV0dXJuIHRoYXQgc2FtZSBwcm9taXNlLicpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiB0cnlUaGVuKHRoZW4kJDEsIHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpIHtcblx0ICAgICAgdHJ5IHtcblx0ICAgICAgICB0aGVuJCQxLmNhbGwodmFsdWUsIGZ1bGZpbGxtZW50SGFuZGxlciwgcmVqZWN0aW9uSGFuZGxlcik7XG5cdCAgICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgICByZXR1cm4gZTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBoYW5kbGVGb3JlaWduVGhlbmFibGUocHJvbWlzZSwgdGhlbmFibGUsIHRoZW4kJDEpIHtcblx0ICAgICAgYXNhcChmdW5jdGlvbiAocHJvbWlzZSkge1xuXHQgICAgICAgIHZhciBzZWFsZWQgPSBmYWxzZTtcblx0ICAgICAgICB2YXIgZXJyb3IgPSB0cnlUaGVuKHRoZW4kJDEsIHRoZW5hYmxlLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0ICAgICAgICAgIGlmIChzZWFsZWQpIHtcblx0ICAgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuXG5cdCAgICAgICAgICBpZiAodGhlbmFibGUgIT09IHZhbHVlKSB7XG5cdCAgICAgICAgICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuXHQgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuXHQgICAgICAgICAgaWYgKHNlYWxlZCkge1xuXHQgICAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIHNlYWxlZCA9IHRydWU7XG5cdCAgICAgICAgICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcblx0ICAgICAgICB9LCAnU2V0dGxlOiAnICsgKHByb21pc2UuX2xhYmVsIHx8ICcgdW5rbm93biBwcm9taXNlJykpO1xuXG5cdCAgICAgICAgaWYgKCFzZWFsZWQgJiYgZXJyb3IpIHtcblx0ICAgICAgICAgIHNlYWxlZCA9IHRydWU7XG5cdCAgICAgICAgICByZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSwgcHJvbWlzZSk7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlKSB7XG5cdCAgICAgIGlmICh0aGVuYWJsZS5fc3RhdGUgPT09IEZVTEZJTExFRCkge1xuXHQgICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG5cdCAgICAgIH0gZWxzZSBpZiAodGhlbmFibGUuX3N0YXRlID09PSBSRUpFQ1RFRCkge1xuXHQgICAgICAgIHJlamVjdChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBzdWJzY3JpYmUodGhlbmFibGUsIHVuZGVmaW5lZCwgZnVuY3Rpb24gKHZhbHVlKSB7XG5cdCAgICAgICAgICByZXR1cm4gcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG5cdCAgICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuXHQgICAgICAgICAgcmV0dXJuIHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuXHQgICAgICAgIH0pO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSwgdGhlbiQkMSkge1xuXHQgICAgICBpZiAobWF5YmVUaGVuYWJsZS5jb25zdHJ1Y3RvciA9PT0gcHJvbWlzZS5jb25zdHJ1Y3RvciAmJiB0aGVuJCQxID09PSB0aGVuICYmIG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IucmVzb2x2ZSA9PT0gcmVzb2x2ZSQxKSB7XG5cdCAgICAgICAgaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgaWYgKHRoZW4kJDEgPT09IHVuZGVmaW5lZCkge1xuXHQgICAgICAgICAgZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcblx0ICAgICAgICB9IGVsc2UgaWYgKGlzRnVuY3Rpb24odGhlbiQkMSkpIHtcblx0ICAgICAgICAgIGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlLCB0aGVuJCQxKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSkge1xuXHQgICAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcblx0ICAgICAgICByZWplY3QocHJvbWlzZSwgc2VsZkZ1bGZpbGxtZW50KCkpO1xuXHQgICAgICB9IGVsc2UgaWYgKG9iamVjdE9yRnVuY3Rpb24odmFsdWUpKSB7XG5cdCAgICAgICAgdmFyIHRoZW4kJDEgPSB2b2lkIDA7XG5cblx0ICAgICAgICB0cnkge1xuXHQgICAgICAgICAgdGhlbiQkMSA9IHZhbHVlLnRoZW47XG5cdCAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcblx0ICAgICAgICAgIHJlamVjdChwcm9taXNlLCBlcnJvcik7XG5cdCAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSwgdGhlbiQkMSk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gcHVibGlzaFJlamVjdGlvbihwcm9taXNlKSB7XG5cdCAgICAgIGlmIChwcm9taXNlLl9vbmVycm9yKSB7XG5cdCAgICAgICAgcHJvbWlzZS5fb25lcnJvcihwcm9taXNlLl9yZXN1bHQpO1xuXHQgICAgICB9XG5cblx0ICAgICAgcHVibGlzaChwcm9taXNlKTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gZnVsZmlsbChwcm9taXNlLCB2YWx1ZSkge1xuXHQgICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcblx0ICAgICAgICByZXR1cm47XG5cdCAgICAgIH1cblxuXHQgICAgICBwcm9taXNlLl9yZXN1bHQgPSB2YWx1ZTtcblx0ICAgICAgcHJvbWlzZS5fc3RhdGUgPSBGVUxGSUxMRUQ7XG5cblx0ICAgICAgaWYgKHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCAhPT0gMCkge1xuXHQgICAgICAgIGFzYXAocHVibGlzaCwgcHJvbWlzZSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gcmVqZWN0KHByb21pc2UsIHJlYXNvbikge1xuXHQgICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcblx0ICAgICAgICByZXR1cm47XG5cdCAgICAgIH1cblxuXHQgICAgICBwcm9taXNlLl9zdGF0ZSA9IFJFSkVDVEVEO1xuXHQgICAgICBwcm9taXNlLl9yZXN1bHQgPSByZWFzb247XG5cdCAgICAgIGFzYXAocHVibGlzaFJlamVjdGlvbiwgcHJvbWlzZSk7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuXHQgICAgICB2YXIgX3N1YnNjcmliZXJzID0gcGFyZW50Ll9zdWJzY3JpYmVycztcblx0ICAgICAgdmFyIGxlbmd0aCA9IF9zdWJzY3JpYmVycy5sZW5ndGg7XG5cdCAgICAgIHBhcmVudC5fb25lcnJvciA9IG51bGw7XG5cdCAgICAgIF9zdWJzY3JpYmVyc1tsZW5ndGhdID0gY2hpbGQ7XG5cdCAgICAgIF9zdWJzY3JpYmVyc1tsZW5ndGggKyBGVUxGSUxMRURdID0gb25GdWxmaWxsbWVudDtcblx0ICAgICAgX3N1YnNjcmliZXJzW2xlbmd0aCArIFJFSkVDVEVEXSA9IG9uUmVqZWN0aW9uO1xuXG5cdCAgICAgIGlmIChsZW5ndGggPT09IDAgJiYgcGFyZW50Ll9zdGF0ZSkge1xuXHQgICAgICAgIGFzYXAocHVibGlzaCwgcGFyZW50KTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBwdWJsaXNoKHByb21pc2UpIHtcblx0ICAgICAgdmFyIHN1YnNjcmliZXJzID0gcHJvbWlzZS5fc3Vic2NyaWJlcnM7XG5cdCAgICAgIHZhciBzZXR0bGVkID0gcHJvbWlzZS5fc3RhdGU7XG5cblx0ICAgICAgaWYgKHN1YnNjcmliZXJzLmxlbmd0aCA9PT0gMCkge1xuXHQgICAgICAgIHJldHVybjtcblx0ICAgICAgfVxuXG5cdCAgICAgIHZhciBjaGlsZCA9IHZvaWQgMCxcblx0ICAgICAgICAgIGNhbGxiYWNrID0gdm9pZCAwLFxuXHQgICAgICAgICAgZGV0YWlsID0gcHJvbWlzZS5fcmVzdWx0O1xuXG5cdCAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3Vic2NyaWJlcnMubGVuZ3RoOyBpICs9IDMpIHtcblx0ICAgICAgICBjaGlsZCA9IHN1YnNjcmliZXJzW2ldO1xuXHQgICAgICAgIGNhbGxiYWNrID0gc3Vic2NyaWJlcnNbaSArIHNldHRsZWRdO1xuXG5cdCAgICAgICAgaWYgKGNoaWxkKSB7XG5cdCAgICAgICAgICBpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBjaGlsZCwgY2FsbGJhY2ssIGRldGFpbCk7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGNhbGxiYWNrKGRldGFpbCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgcHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoID0gMDtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgcHJvbWlzZSwgY2FsbGJhY2ssIGRldGFpbCkge1xuXHQgICAgICB2YXIgaGFzQ2FsbGJhY2sgPSBpc0Z1bmN0aW9uKGNhbGxiYWNrKSxcblx0ICAgICAgICAgIHZhbHVlID0gdm9pZCAwLFxuXHQgICAgICAgICAgZXJyb3IgPSB2b2lkIDAsXG5cdCAgICAgICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuXG5cdCAgICAgIGlmIChoYXNDYWxsYmFjaykge1xuXHQgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICB2YWx1ZSA9IGNhbGxiYWNrKGRldGFpbCk7XG5cdCAgICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgICAgc3VjY2VlZGVkID0gZmFsc2U7XG5cdCAgICAgICAgICBlcnJvciA9IGU7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG5cdCAgICAgICAgICByZWplY3QocHJvbWlzZSwgY2Fubm90UmV0dXJuT3duKCkpO1xuXHQgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICB2YWx1ZSA9IGRldGFpbDtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gUEVORElORykgOyBlbHNlIGlmIChoYXNDYWxsYmFjayAmJiBzdWNjZWVkZWQpIHtcblx0ICAgICAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcblx0ICAgICAgfSBlbHNlIGlmIChzdWNjZWVkZWQgPT09IGZhbHNlKSB7XG5cdCAgICAgICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcblx0ICAgICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBGVUxGSUxMRUQpIHtcblx0ICAgICAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcblx0ICAgICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBSRUpFQ1RFRCkge1xuXHQgICAgICAgIHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gaW5pdGlhbGl6ZVByb21pc2UocHJvbWlzZSwgcmVzb2x2ZXIpIHtcblx0ICAgICAgdHJ5IHtcblx0ICAgICAgICByZXNvbHZlcihmdW5jdGlvbiByZXNvbHZlUHJvbWlzZSh2YWx1ZSkge1xuXHQgICAgICAgICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG5cdCAgICAgICAgfSwgZnVuY3Rpb24gcmVqZWN0UHJvbWlzZShyZWFzb24pIHtcblx0ICAgICAgICAgIHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuXHQgICAgICAgIH0pO1xuXHQgICAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgICAgcmVqZWN0KHByb21pc2UsIGUpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHZhciBpZCA9IDA7XG5cblx0ICAgIGZ1bmN0aW9uIG5leHRJZCgpIHtcblx0ICAgICAgcmV0dXJuIGlkKys7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIG1ha2VQcm9taXNlKHByb21pc2UpIHtcblx0ICAgICAgcHJvbWlzZVtQUk9NSVNFX0lEXSA9IGlkKys7XG5cdCAgICAgIHByb21pc2UuX3N0YXRlID0gdW5kZWZpbmVkO1xuXHQgICAgICBwcm9taXNlLl9yZXN1bHQgPSB1bmRlZmluZWQ7XG5cdCAgICAgIHByb21pc2UuX3N1YnNjcmliZXJzID0gW107XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHZhbGlkYXRpb25FcnJvcigpIHtcblx0ICAgICAgcmV0dXJuIG5ldyBFcnJvcignQXJyYXkgTWV0aG9kcyBtdXN0IGJlIHByb3ZpZGVkIGFuIEFycmF5Jyk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBFbnVtZXJhdG9yID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICBmdW5jdGlvbiBFbnVtZXJhdG9yKENvbnN0cnVjdG9yLCBpbnB1dCkge1xuXHQgICAgICAgIHRoaXMuX2luc3RhbmNlQ29uc3RydWN0b3IgPSBDb25zdHJ1Y3Rvcjtcblx0ICAgICAgICB0aGlzLnByb21pc2UgPSBuZXcgQ29uc3RydWN0b3Iobm9vcCk7XG5cblx0ICAgICAgICBpZiAoIXRoaXMucHJvbWlzZVtQUk9NSVNFX0lEXSkge1xuXHQgICAgICAgICAgbWFrZVByb21pc2UodGhpcy5wcm9taXNlKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBpZiAoaXNBcnJheShpbnB1dCkpIHtcblx0ICAgICAgICAgIHRoaXMubGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuXHQgICAgICAgICAgdGhpcy5fcmVtYWluaW5nID0gaW5wdXQubGVuZ3RoO1xuXHQgICAgICAgICAgdGhpcy5fcmVzdWx0ID0gbmV3IEFycmF5KHRoaXMubGVuZ3RoKTtcblxuXHQgICAgICAgICAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSB7XG5cdCAgICAgICAgICAgIGZ1bGZpbGwodGhpcy5wcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuXHQgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgdGhpcy5sZW5ndGggPSB0aGlzLmxlbmd0aCB8fCAwO1xuXG5cdCAgICAgICAgICAgIHRoaXMuX2VudW1lcmF0ZShpbnB1dCk7XG5cblx0ICAgICAgICAgICAgaWYgKHRoaXMuX3JlbWFpbmluZyA9PT0gMCkge1xuXHQgICAgICAgICAgICAgIGZ1bGZpbGwodGhpcy5wcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHJlamVjdCh0aGlzLnByb21pc2UsIHZhbGlkYXRpb25FcnJvcigpKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBFbnVtZXJhdG9yLnByb3RvdHlwZS5fZW51bWVyYXRlID0gZnVuY3Rpb24gX2VudW1lcmF0ZShpbnB1dCkge1xuXHQgICAgICAgIGZvciAodmFyIGkgPSAwOyB0aGlzLl9zdGF0ZSA9PT0gUEVORElORyAmJiBpIDwgaW5wdXQubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgIHRoaXMuX2VhY2hFbnRyeShpbnB1dFtpXSwgaSk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9O1xuXG5cdCAgICAgIEVudW1lcmF0b3IucHJvdG90eXBlLl9lYWNoRW50cnkgPSBmdW5jdGlvbiBfZWFjaEVudHJ5KGVudHJ5LCBpKSB7XG5cdCAgICAgICAgdmFyIGMgPSB0aGlzLl9pbnN0YW5jZUNvbnN0cnVjdG9yO1xuXHQgICAgICAgIHZhciByZXNvbHZlJCQxID0gYy5yZXNvbHZlO1xuXG5cdCAgICAgICAgaWYgKHJlc29sdmUkJDEgPT09IHJlc29sdmUkMSkge1xuXHQgICAgICAgICAgdmFyIF90aGVuID0gdm9pZCAwO1xuXG5cdCAgICAgICAgICB2YXIgZXJyb3IgPSB2b2lkIDA7XG5cdCAgICAgICAgICB2YXIgZGlkRXJyb3IgPSBmYWxzZTtcblxuXHQgICAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgICAgX3RoZW4gPSBlbnRyeS50aGVuO1xuXHQgICAgICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgICAgICBkaWRFcnJvciA9IHRydWU7XG5cdCAgICAgICAgICAgIGVycm9yID0gZTtcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgaWYgKF90aGVuID09PSB0aGVuICYmIGVudHJ5Ll9zdGF0ZSAhPT0gUEVORElORykge1xuXHQgICAgICAgICAgICB0aGlzLl9zZXR0bGVkQXQoZW50cnkuX3N0YXRlLCBpLCBlbnRyeS5fcmVzdWx0KTtcblx0ICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIF90aGVuICE9PSAnZnVuY3Rpb24nKSB7XG5cdCAgICAgICAgICAgIHRoaXMuX3JlbWFpbmluZy0tO1xuXHQgICAgICAgICAgICB0aGlzLl9yZXN1bHRbaV0gPSBlbnRyeTtcblx0ICAgICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gUHJvbWlzZSQxKSB7XG5cdCAgICAgICAgICAgIHZhciBwcm9taXNlID0gbmV3IGMobm9vcCk7XG5cblx0ICAgICAgICAgICAgaWYgKGRpZEVycm9yKSB7XG5cdCAgICAgICAgICAgICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcblx0ICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICBoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIGVudHJ5LCBfdGhlbik7XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICB0aGlzLl93aWxsU2V0dGxlQXQocHJvbWlzZSwgaSk7XG5cdCAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICB0aGlzLl93aWxsU2V0dGxlQXQobmV3IGMoZnVuY3Rpb24gKHJlc29sdmUkJDEpIHtcblx0ICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZSQkMShlbnRyeSk7XG5cdCAgICAgICAgICAgIH0pLCBpKTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KHJlc29sdmUkJDEoZW50cnkpLCBpKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH07XG5cblx0ICAgICAgRW51bWVyYXRvci5wcm90b3R5cGUuX3NldHRsZWRBdCA9IGZ1bmN0aW9uIF9zZXR0bGVkQXQoc3RhdGUsIGksIHZhbHVlKSB7XG5cdCAgICAgICAgdmFyIHByb21pc2UgPSB0aGlzLnByb21pc2U7XG5cblx0ICAgICAgICBpZiAocHJvbWlzZS5fc3RhdGUgPT09IFBFTkRJTkcpIHtcblx0ICAgICAgICAgIHRoaXMuX3JlbWFpbmluZy0tO1xuXG5cdCAgICAgICAgICBpZiAoc3RhdGUgPT09IFJFSkVDVEVEKSB7XG5cdCAgICAgICAgICAgIHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG5cdCAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICB0aGlzLl9yZXN1bHRbaV0gPSB2YWx1ZTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cblx0ICAgICAgICBpZiAodGhpcy5fcmVtYWluaW5nID09PSAwKSB7XG5cdCAgICAgICAgICBmdWxmaWxsKHByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9O1xuXG5cdCAgICAgIEVudW1lcmF0b3IucHJvdG90eXBlLl93aWxsU2V0dGxlQXQgPSBmdW5jdGlvbiBfd2lsbFNldHRsZUF0KHByb21pc2UsIGkpIHtcblx0ICAgICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG5cdCAgICAgICAgc3Vic2NyaWJlKHByb21pc2UsIHVuZGVmaW5lZCwgZnVuY3Rpb24gKHZhbHVlKSB7XG5cdCAgICAgICAgICByZXR1cm4gZW51bWVyYXRvci5fc2V0dGxlZEF0KEZVTEZJTExFRCwgaSwgdmFsdWUpO1xuXHQgICAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcblx0ICAgICAgICAgIHJldHVybiBlbnVtZXJhdG9yLl9zZXR0bGVkQXQoUkVKRUNURUQsIGksIHJlYXNvbik7XG5cdCAgICAgICAgfSk7XG5cdCAgICAgIH07XG5cblx0ICAgICAgcmV0dXJuIEVudW1lcmF0b3I7XG5cdCAgICB9KCk7XG5cdCAgICAvKipcblx0ICAgICAgYFByb21pc2UuYWxsYCBhY2NlcHRzIGFuIGFycmF5IG9mIHByb21pc2VzLCBhbmQgcmV0dXJucyBhIG5ldyBwcm9taXNlIHdoaWNoXG5cdCAgICAgIGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGFycmF5IG9mIGZ1bGZpbGxtZW50IHZhbHVlcyBmb3IgdGhlIHBhc3NlZCBwcm9taXNlcywgb3Jcblx0ICAgICAgcmVqZWN0ZWQgd2l0aCB0aGUgcmVhc29uIG9mIHRoZSBmaXJzdCBwYXNzZWQgcHJvbWlzZSB0byBiZSByZWplY3RlZC4gSXQgY2FzdHMgYWxsXG5cdCAgICAgIGVsZW1lbnRzIG9mIHRoZSBwYXNzZWQgaXRlcmFibGUgdG8gcHJvbWlzZXMgYXMgaXQgcnVucyB0aGlzIGFsZ29yaXRobS5cblx0ICAgIFxuXHQgICAgICBFeGFtcGxlOlxuXHQgICAgXG5cdCAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgbGV0IHByb21pc2UxID0gcmVzb2x2ZSgxKTtcblx0ICAgICAgbGV0IHByb21pc2UyID0gcmVzb2x2ZSgyKTtcblx0ICAgICAgbGV0IHByb21pc2UzID0gcmVzb2x2ZSgzKTtcblx0ICAgICAgbGV0IHByb21pc2VzID0gWyBwcm9taXNlMSwgcHJvbWlzZTIsIHByb21pc2UzIF07XG5cdCAgICBcblx0ICAgICAgUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24oYXJyYXkpe1xuXHQgICAgICAgIC8vIFRoZSBhcnJheSBoZXJlIHdvdWxkIGJlIFsgMSwgMiwgMyBdO1xuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgSWYgYW55IG9mIHRoZSBgcHJvbWlzZXNgIGdpdmVuIHRvIGBhbGxgIGFyZSByZWplY3RlZCwgdGhlIGZpcnN0IHByb21pc2Vcblx0ICAgICAgdGhhdCBpcyByZWplY3RlZCB3aWxsIGJlIGdpdmVuIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSByZXR1cm5lZCBwcm9taXNlcydzXG5cdCAgICAgIHJlamVjdGlvbiBoYW5kbGVyLiBGb3IgZXhhbXBsZTpcblx0ICAgIFxuXHQgICAgICBFeGFtcGxlOlxuXHQgICAgXG5cdCAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgbGV0IHByb21pc2UxID0gcmVzb2x2ZSgxKTtcblx0ICAgICAgbGV0IHByb21pc2UyID0gcmVqZWN0KG5ldyBFcnJvcihcIjJcIikpO1xuXHQgICAgICBsZXQgcHJvbWlzZTMgPSByZWplY3QobmV3IEVycm9yKFwiM1wiKSk7XG5cdCAgICAgIGxldCBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXHQgICAgXG5cdCAgICAgIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcblx0ICAgICAgICAvLyBDb2RlIGhlcmUgbmV2ZXIgcnVucyBiZWNhdXNlIHRoZXJlIGFyZSByZWplY3RlZCBwcm9taXNlcyFcblx0ICAgICAgfSwgZnVuY3Rpb24oZXJyb3IpIHtcblx0ICAgICAgICAvLyBlcnJvci5tZXNzYWdlID09PSBcIjJcIlxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgQG1ldGhvZCBhbGxcblx0ICAgICAgQHN0YXRpY1xuXHQgICAgICBAcGFyYW0ge0FycmF5fSBlbnRyaWVzIGFycmF5IG9mIHByb21pc2VzXG5cdCAgICAgIEBwYXJhbSB7U3RyaW5nfSBsYWJlbCBvcHRpb25hbCBzdHJpbmcgZm9yIGxhYmVsaW5nIHRoZSBwcm9taXNlLlxuXHQgICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG5cdCAgICAgIEByZXR1cm4ge1Byb21pc2V9IHByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2hlbiBhbGwgYHByb21pc2VzYCBoYXZlIGJlZW5cblx0ICAgICAgZnVsZmlsbGVkLCBvciByZWplY3RlZCBpZiBhbnkgb2YgdGhlbSBiZWNvbWUgcmVqZWN0ZWQuXG5cdCAgICAgIEBzdGF0aWNcblx0ICAgICovXG5cblxuXHQgICAgZnVuY3Rpb24gYWxsKGVudHJpZXMpIHtcblx0ICAgICAgcmV0dXJuIG5ldyBFbnVtZXJhdG9yKHRoaXMsIGVudHJpZXMpLnByb21pc2U7XG5cdCAgICB9XG5cdCAgICAvKipcblx0ICAgICAgYFByb21pc2UucmFjZWAgcmV0dXJucyBhIG5ldyBwcm9taXNlIHdoaWNoIGlzIHNldHRsZWQgaW4gdGhlIHNhbWUgd2F5IGFzIHRoZVxuXHQgICAgICBmaXJzdCBwYXNzZWQgcHJvbWlzZSB0byBzZXR0bGUuXG5cdCAgICBcblx0ICAgICAgRXhhbXBsZTpcblx0ICAgIFxuXHQgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGxldCBwcm9taXNlMSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdCAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuXHQgICAgICAgICAgcmVzb2x2ZSgncHJvbWlzZSAxJyk7XG5cdCAgICAgICAgfSwgMjAwKTtcblx0ICAgICAgfSk7XG5cdCAgICBcblx0ICAgICAgbGV0IHByb21pc2UyID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0ICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG5cdCAgICAgICAgICByZXNvbHZlKCdwcm9taXNlIDInKTtcblx0ICAgICAgICB9LCAxMDApO1xuXHQgICAgICB9KTtcblx0ICAgIFxuXHQgICAgICBQcm9taXNlLnJhY2UoW3Byb21pc2UxLCBwcm9taXNlMl0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcblx0ICAgICAgICAvLyByZXN1bHQgPT09ICdwcm9taXNlIDInIGJlY2F1c2UgaXQgd2FzIHJlc29sdmVkIGJlZm9yZSBwcm9taXNlMVxuXHQgICAgICAgIC8vIHdhcyByZXNvbHZlZC5cblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIGBQcm9taXNlLnJhY2VgIGlzIGRldGVybWluaXN0aWMgaW4gdGhhdCBvbmx5IHRoZSBzdGF0ZSBvZiB0aGUgZmlyc3Rcblx0ICAgICAgc2V0dGxlZCBwcm9taXNlIG1hdHRlcnMuIEZvciBleGFtcGxlLCBldmVuIGlmIG90aGVyIHByb21pc2VzIGdpdmVuIHRvIHRoZVxuXHQgICAgICBgcHJvbWlzZXNgIGFycmF5IGFyZ3VtZW50IGFyZSByZXNvbHZlZCwgYnV0IHRoZSBmaXJzdCBzZXR0bGVkIHByb21pc2UgaGFzXG5cdCAgICAgIGJlY29tZSByZWplY3RlZCBiZWZvcmUgdGhlIG90aGVyIHByb21pc2VzIGJlY2FtZSBmdWxmaWxsZWQsIHRoZSByZXR1cm5lZFxuXHQgICAgICBwcm9taXNlIHdpbGwgYmVjb21lIHJlamVjdGVkOlxuXHQgICAgXG5cdCAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgbGV0IHByb21pc2UxID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0ICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG5cdCAgICAgICAgICByZXNvbHZlKCdwcm9taXNlIDEnKTtcblx0ICAgICAgICB9LCAyMDApO1xuXHQgICAgICB9KTtcblx0ICAgIFxuXHQgICAgICBsZXQgcHJvbWlzZTIgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHQgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcblx0ICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ3Byb21pc2UgMicpKTtcblx0ICAgICAgICB9LCAxMDApO1xuXHQgICAgICB9KTtcblx0ICAgIFxuXHQgICAgICBQcm9taXNlLnJhY2UoW3Byb21pc2UxLCBwcm9taXNlMl0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcblx0ICAgICAgICAvLyBDb2RlIGhlcmUgbmV2ZXIgcnVuc1xuXHQgICAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuXHQgICAgICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSAncHJvbWlzZSAyJyBiZWNhdXNlIHByb21pc2UgMiBiZWNhbWUgcmVqZWN0ZWQgYmVmb3JlXG5cdCAgICAgICAgLy8gcHJvbWlzZSAxIGJlY2FtZSBmdWxmaWxsZWRcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIEFuIGV4YW1wbGUgcmVhbC13b3JsZCB1c2UgY2FzZSBpcyBpbXBsZW1lbnRpbmcgdGltZW91dHM6XG5cdCAgICBcblx0ICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBQcm9taXNlLnJhY2UoW2FqYXgoJ2Zvby5qc29uJyksIHRpbWVvdXQoNTAwMCldKVxuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBAbWV0aG9kIHJhY2Vcblx0ICAgICAgQHN0YXRpY1xuXHQgICAgICBAcGFyYW0ge0FycmF5fSBwcm9taXNlcyBhcnJheSBvZiBwcm9taXNlcyB0byBvYnNlcnZlXG5cdCAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cblx0ICAgICAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHdoaWNoIHNldHRsZXMgaW4gdGhlIHNhbWUgd2F5IGFzIHRoZSBmaXJzdCBwYXNzZWRcblx0ICAgICAgcHJvbWlzZSB0byBzZXR0bGUuXG5cdCAgICAqL1xuXG5cblx0ICAgIGZ1bmN0aW9uIHJhY2UoZW50cmllcykge1xuXHQgICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuXHQgICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG5cdCAgICAgIGlmICghaXNBcnJheShlbnRyaWVzKSkge1xuXHQgICAgICAgIHJldHVybiBuZXcgQ29uc3RydWN0b3IoZnVuY3Rpb24gKF8sIHJlamVjdCkge1xuXHQgICAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGFuIGFycmF5IHRvIHJhY2UuJykpO1xuXHQgICAgICAgIH0pO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHJldHVybiBuZXcgQ29uc3RydWN0b3IoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHQgICAgICAgICAgdmFyIGxlbmd0aCA9IGVudHJpZXMubGVuZ3RoO1xuXG5cdCAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICAgIENvbnN0cnVjdG9yLnJlc29sdmUoZW50cmllc1tpXSkudGhlbihyZXNvbHZlLCByZWplY3QpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0pO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgICAvKipcblx0ICAgICAgYFByb21pc2UucmVqZWN0YCByZXR1cm5zIGEgcHJvbWlzZSByZWplY3RlZCB3aXRoIHRoZSBwYXNzZWQgYHJlYXNvbmAuXG5cdCAgICAgIEl0IGlzIHNob3J0aGFuZCBmb3IgdGhlIGZvbGxvd2luZzpcblx0ICAgIFxuXHQgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGxldCBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0ICAgICAgICByZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG5cdCAgICAgIH0pO1xuXHQgICAgXG5cdCAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG5cdCAgICAgICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG5cdCAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG5cdCAgICAgICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlIGFib3ZlLCB5b3VyIGNvZGUgbm93IHNpbXBseSBiZWNvbWVzIHRoZSBmb2xsb3dpbmc6XG5cdCAgICBcblx0ICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBsZXQgcHJvbWlzZSA9IFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignV0hPT1BTJykpO1xuXHQgICAgXG5cdCAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG5cdCAgICAgICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG5cdCAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG5cdCAgICAgICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBAbWV0aG9kIHJlamVjdFxuXHQgICAgICBAc3RhdGljXG5cdCAgICAgIEBwYXJhbSB7QW55fSByZWFzb24gdmFsdWUgdGhhdCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkIHdpdGguXG5cdCAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cblx0ICAgICAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHJlamVjdGVkIHdpdGggdGhlIGdpdmVuIGByZWFzb25gLlxuXHQgICAgKi9cblxuXG5cdCAgICBmdW5jdGlvbiByZWplY3QkMShyZWFzb24pIHtcblx0ICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cblx0ICAgICAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcblx0ICAgICAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3Iobm9vcCk7XG5cdCAgICAgIHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuXHQgICAgICByZXR1cm4gcHJvbWlzZTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gbmVlZHNSZXNvbHZlcigpIHtcblx0ICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhIHJlc29sdmVyIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgcHJvbWlzZSBjb25zdHJ1Y3RvcicpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBuZWVkc05ldygpIHtcblx0ICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1Byb21pc2UnOiBQbGVhc2UgdXNlIHRoZSAnbmV3JyBvcGVyYXRvciwgdGhpcyBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLlwiKTtcblx0ICAgIH1cblx0ICAgIC8qKlxuXHQgICAgICBQcm9taXNlIG9iamVjdHMgcmVwcmVzZW50IHRoZSBldmVudHVhbCByZXN1bHQgb2YgYW4gYXN5bmNocm9ub3VzIG9wZXJhdGlvbi4gVGhlXG5cdCAgICAgIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsIHdoaWNoXG5cdCAgICAgIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlIHJlYXNvblxuXHQgICAgICB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cblx0ICAgIFxuXHQgICAgICBUZXJtaW5vbG9neVxuXHQgICAgICAtLS0tLS0tLS0tLVxuXHQgICAgXG5cdCAgICAgIC0gYHByb21pc2VgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB3aXRoIGEgYHRoZW5gIG1ldGhvZCB3aG9zZSBiZWhhdmlvciBjb25mb3JtcyB0byB0aGlzIHNwZWNpZmljYXRpb24uXG5cdCAgICAgIC0gYHRoZW5hYmxlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gdGhhdCBkZWZpbmVzIGEgYHRoZW5gIG1ldGhvZC5cblx0ICAgICAgLSBgdmFsdWVgIGlzIGFueSBsZWdhbCBKYXZhU2NyaXB0IHZhbHVlIChpbmNsdWRpbmcgdW5kZWZpbmVkLCBhIHRoZW5hYmxlLCBvciBhIHByb21pc2UpLlxuXHQgICAgICAtIGBleGNlcHRpb25gIGlzIGEgdmFsdWUgdGhhdCBpcyB0aHJvd24gdXNpbmcgdGhlIHRocm93IHN0YXRlbWVudC5cblx0ICAgICAgLSBgcmVhc29uYCBpcyBhIHZhbHVlIHRoYXQgaW5kaWNhdGVzIHdoeSBhIHByb21pc2Ugd2FzIHJlamVjdGVkLlxuXHQgICAgICAtIGBzZXR0bGVkYCB0aGUgZmluYWwgcmVzdGluZyBzdGF0ZSBvZiBhIHByb21pc2UsIGZ1bGZpbGxlZCBvciByZWplY3RlZC5cblx0ICAgIFxuXHQgICAgICBBIHByb21pc2UgY2FuIGJlIGluIG9uZSBvZiB0aHJlZSBzdGF0ZXM6IHBlbmRpbmcsIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQuXG5cdCAgICBcblx0ICAgICAgUHJvbWlzZXMgdGhhdCBhcmUgZnVsZmlsbGVkIGhhdmUgYSBmdWxmaWxsbWVudCB2YWx1ZSBhbmQgYXJlIGluIHRoZSBmdWxmaWxsZWRcblx0ICAgICAgc3RhdGUuICBQcm9taXNlcyB0aGF0IGFyZSByZWplY3RlZCBoYXZlIGEgcmVqZWN0aW9uIHJlYXNvbiBhbmQgYXJlIGluIHRoZVxuXHQgICAgICByZWplY3RlZCBzdGF0ZS4gIEEgZnVsZmlsbG1lbnQgdmFsdWUgaXMgbmV2ZXIgYSB0aGVuYWJsZS5cblx0ICAgIFxuXHQgICAgICBQcm9taXNlcyBjYW4gYWxzbyBiZSBzYWlkIHRvICpyZXNvbHZlKiBhIHZhbHVlLiAgSWYgdGhpcyB2YWx1ZSBpcyBhbHNvIGFcblx0ICAgICAgcHJvbWlzZSwgdGhlbiB0aGUgb3JpZ2luYWwgcHJvbWlzZSdzIHNldHRsZWQgc3RhdGUgd2lsbCBtYXRjaCB0aGUgdmFsdWUnc1xuXHQgICAgICBzZXR0bGVkIHN0YXRlLiAgU28gYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCByZWplY3RzIHdpbGxcblx0ICAgICAgaXRzZWxmIHJlamVjdCwgYW5kIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgd2lsbFxuXHQgICAgICBpdHNlbGYgZnVsZmlsbC5cblx0ICAgIFxuXHQgICAgXG5cdCAgICAgIEJhc2ljIFVzYWdlOlxuXHQgICAgICAtLS0tLS0tLS0tLS1cblx0ICAgIFxuXHQgICAgICBgYGBqc1xuXHQgICAgICBsZXQgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuXHQgICAgICAgIC8vIG9uIHN1Y2Nlc3Ncblx0ICAgICAgICByZXNvbHZlKHZhbHVlKTtcblx0ICAgIFxuXHQgICAgICAgIC8vIG9uIGZhaWx1cmVcblx0ICAgICAgICByZWplY3QocmVhc29uKTtcblx0ICAgICAgfSk7XG5cdCAgICBcblx0ICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG5cdCAgICAgICAgLy8gb24gZnVsZmlsbG1lbnRcblx0ICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG5cdCAgICAgICAgLy8gb24gcmVqZWN0aW9uXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBBZHZhbmNlZCBVc2FnZTpcblx0ICAgICAgLS0tLS0tLS0tLS0tLS0tXG5cdCAgICBcblx0ICAgICAgUHJvbWlzZXMgc2hpbmUgd2hlbiBhYnN0cmFjdGluZyBhd2F5IGFzeW5jaHJvbm91cyBpbnRlcmFjdGlvbnMgc3VjaCBhc1xuXHQgICAgICBgWE1MSHR0cFJlcXVlc3Rgcy5cblx0ICAgIFxuXHQgICAgICBgYGBqc1xuXHQgICAgICBmdW5jdGlvbiBnZXRKU09OKHVybCkge1xuXHQgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHQgICAgICAgICAgbGV0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHQgICAgXG5cdCAgICAgICAgICB4aHIub3BlbignR0VUJywgdXJsKTtcblx0ICAgICAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBoYW5kbGVyO1xuXHQgICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcblx0ICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuXHQgICAgICAgICAgeGhyLnNlbmQoKTtcblx0ICAgIFxuXHQgICAgICAgICAgZnVuY3Rpb24gaGFuZGxlcigpIHtcblx0ICAgICAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gdGhpcy5ET05FKSB7XG5cdCAgICAgICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAyMDApIHtcblx0ICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXNwb25zZSk7XG5cdCAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ2dldEpTT046IGAnICsgdXJsICsgJ2AgZmFpbGVkIHdpdGggc3RhdHVzOiBbJyArIHRoaXMuc3RhdHVzICsgJ10nKSk7XG5cdCAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9O1xuXHQgICAgICAgIH0pO1xuXHQgICAgICB9XG5cdCAgICBcblx0ICAgICAgZ2V0SlNPTignL3Bvc3RzLmpzb24nKS50aGVuKGZ1bmN0aW9uKGpzb24pIHtcblx0ICAgICAgICAvLyBvbiBmdWxmaWxsbWVudFxuXHQgICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcblx0ICAgICAgICAvLyBvbiByZWplY3Rpb25cblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIFVubGlrZSBjYWxsYmFja3MsIHByb21pc2VzIGFyZSBncmVhdCBjb21wb3NhYmxlIHByaW1pdGl2ZXMuXG5cdCAgICBcblx0ICAgICAgYGBganNcblx0ICAgICAgUHJvbWlzZS5hbGwoW1xuXHQgICAgICAgIGdldEpTT04oJy9wb3N0cycpLFxuXHQgICAgICAgIGdldEpTT04oJy9jb21tZW50cycpXG5cdCAgICAgIF0pLnRoZW4oZnVuY3Rpb24odmFsdWVzKXtcblx0ICAgICAgICB2YWx1ZXNbMF0gLy8gPT4gcG9zdHNKU09OXG5cdCAgICAgICAgdmFsdWVzWzFdIC8vID0+IGNvbW1lbnRzSlNPTlxuXHQgICAgXG5cdCAgICAgICAgcmV0dXJuIHZhbHVlcztcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIEBjbGFzcyBQcm9taXNlXG5cdCAgICAgIEBwYXJhbSB7RnVuY3Rpb259IHJlc29sdmVyXG5cdCAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cblx0ICAgICAgQGNvbnN0cnVjdG9yXG5cdCAgICAqL1xuXG5cblx0ICAgIHZhciBQcm9taXNlJDEgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGZ1bmN0aW9uIFByb21pc2UocmVzb2x2ZXIpIHtcblx0ICAgICAgICB0aGlzW1BST01JU0VfSURdID0gbmV4dElkKCk7XG5cdCAgICAgICAgdGhpcy5fcmVzdWx0ID0gdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG5cdCAgICAgICAgdGhpcy5fc3Vic2NyaWJlcnMgPSBbXTtcblxuXHQgICAgICAgIGlmIChub29wICE9PSByZXNvbHZlcikge1xuXHQgICAgICAgICAgdHlwZW9mIHJlc29sdmVyICE9PSAnZnVuY3Rpb24nICYmIG5lZWRzUmVzb2x2ZXIoKTtcblx0ICAgICAgICAgIHRoaXMgaW5zdGFuY2VvZiBQcm9taXNlID8gaW5pdGlhbGl6ZVByb21pc2UodGhpcywgcmVzb2x2ZXIpIDogbmVlZHNOZXcoKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgICAgLyoqXG5cdCAgICAgIFRoZSBwcmltYXJ5IHdheSBvZiBpbnRlcmFjdGluZyB3aXRoIGEgcHJvbWlzZSBpcyB0aHJvdWdoIGl0cyBgdGhlbmAgbWV0aG9kLFxuXHQgICAgICB3aGljaCByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZVxuXHQgICAgICByZWFzb24gd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG5cdCAgICAgICBgYGBqc1xuXHQgICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24odXNlcil7XG5cdCAgICAgICAgLy8gdXNlciBpcyBhdmFpbGFibGVcblx0ICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcblx0ICAgICAgICAvLyB1c2VyIGlzIHVuYXZhaWxhYmxlLCBhbmQgeW91IGFyZSBnaXZlbiB0aGUgcmVhc29uIHdoeVxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICAgICBDaGFpbmluZ1xuXHQgICAgICAtLS0tLS0tLVxuXHQgICAgICAgVGhlIHJldHVybiB2YWx1ZSBvZiBgdGhlbmAgaXMgaXRzZWxmIGEgcHJvbWlzZS4gIFRoaXMgc2Vjb25kLCAnZG93bnN0cmVhbSdcblx0ICAgICAgcHJvbWlzZSBpcyByZXNvbHZlZCB3aXRoIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZpcnN0IHByb21pc2UncyBmdWxmaWxsbWVudFxuXHQgICAgICBvciByZWplY3Rpb24gaGFuZGxlciwgb3IgcmVqZWN0ZWQgaWYgdGhlIGhhbmRsZXIgdGhyb3dzIGFuIGV4Y2VwdGlvbi5cblx0ICAgICAgIGBgYGpzXG5cdCAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuXHQgICAgICAgIHJldHVybiB1c2VyLm5hbWU7XG5cdCAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcblx0ICAgICAgICByZXR1cm4gJ2RlZmF1bHQgbmFtZSc7XG5cdCAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHVzZXJOYW1lKSB7XG5cdCAgICAgICAgLy8gSWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGB1c2VyTmFtZWAgd2lsbCBiZSB0aGUgdXNlcidzIG5hbWUsIG90aGVyd2lzZSBpdFxuXHQgICAgICAgIC8vIHdpbGwgYmUgYCdkZWZhdWx0IG5hbWUnYFxuXHQgICAgICB9KTtcblx0ICAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuXHQgICAgICAgIHRocm93IG5ldyBFcnJvcignRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknKTtcblx0ICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuXHQgICAgICAgIHRocm93IG5ldyBFcnJvcignYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScpO1xuXHQgICAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuXHQgICAgICAgIC8vIG5ldmVyIHJlYWNoZWRcblx0ICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuXHQgICAgICAgIC8vIGlmIGBmaW5kVXNlcmAgZnVsZmlsbGVkLCBgcmVhc29uYCB3aWxsIGJlICdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScuXG5cdCAgICAgICAgLy8gSWYgYGZpbmRVc2VyYCByZWplY3RlZCwgYHJlYXNvbmAgd2lsbCBiZSAnYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScuXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgICAgSWYgdGhlIGRvd25zdHJlYW0gcHJvbWlzZSBkb2VzIG5vdCBzcGVjaWZ5IGEgcmVqZWN0aW9uIGhhbmRsZXIsIHJlamVjdGlvbiByZWFzb25zIHdpbGwgYmUgcHJvcGFnYXRlZCBmdXJ0aGVyIGRvd25zdHJlYW0uXG5cdCAgICAgICBgYGBqc1xuXHQgICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcblx0ICAgICAgICB0aHJvdyBuZXcgUGVkYWdvZ2ljYWxFeGNlcHRpb24oJ1Vwc3RyZWFtIGVycm9yJyk7XG5cdCAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG5cdCAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuXHQgICAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuXHQgICAgICAgIC8vIG5ldmVyIHJlYWNoZWRcblx0ICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuXHQgICAgICAgIC8vIFRoZSBgUGVkZ2Fnb2NpYWxFeGNlcHRpb25gIGlzIHByb3BhZ2F0ZWQgYWxsIHRoZSB3YXkgZG93biB0byBoZXJlXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgICAgIEFzc2ltaWxhdGlvblxuXHQgICAgICAtLS0tLS0tLS0tLS1cblx0ICAgICAgIFNvbWV0aW1lcyB0aGUgdmFsdWUgeW91IHdhbnQgdG8gcHJvcGFnYXRlIHRvIGEgZG93bnN0cmVhbSBwcm9taXNlIGNhbiBvbmx5IGJlXG5cdCAgICAgIHJldHJpZXZlZCBhc3luY2hyb25vdXNseS4gVGhpcyBjYW4gYmUgYWNoaWV2ZWQgYnkgcmV0dXJuaW5nIGEgcHJvbWlzZSBpbiB0aGVcblx0ICAgICAgZnVsZmlsbG1lbnQgb3IgcmVqZWN0aW9uIGhhbmRsZXIuIFRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCB0aGVuIGJlIHBlbmRpbmdcblx0ICAgICAgdW50aWwgdGhlIHJldHVybmVkIHByb21pc2UgaXMgc2V0dGxlZC4gVGhpcyBpcyBjYWxsZWQgKmFzc2ltaWxhdGlvbiouXG5cdCAgICAgICBgYGBqc1xuXHQgICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcblx0ICAgICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG5cdCAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG5cdCAgICAgICAgLy8gVGhlIHVzZXIncyBjb21tZW50cyBhcmUgbm93IGF2YWlsYWJsZVxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICAgICBJZiB0aGUgYXNzaW1saWF0ZWQgcHJvbWlzZSByZWplY3RzLCB0aGVuIHRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCBhbHNvIHJlamVjdC5cblx0ICAgICAgIGBgYGpzXG5cdCAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuXHQgICAgICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcblx0ICAgICAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcblx0ICAgICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIGZ1bGZpbGxzLCB3ZSdsbCBoYXZlIHRoZSB2YWx1ZSBoZXJlXG5cdCAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcblx0ICAgICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIHJlamVjdHMsIHdlJ2xsIGhhdmUgdGhlIHJlYXNvbiBoZXJlXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgICAgIFNpbXBsZSBFeGFtcGxlXG5cdCAgICAgIC0tLS0tLS0tLS0tLS0tXG5cdCAgICAgICBTeW5jaHJvbm91cyBFeGFtcGxlXG5cdCAgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGxldCByZXN1bHQ7XG5cdCAgICAgICB0cnkge1xuXHQgICAgICAgIHJlc3VsdCA9IGZpbmRSZXN1bHQoKTtcblx0ICAgICAgICAvLyBzdWNjZXNzXG5cdCAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG5cdCAgICAgICAgLy8gZmFpbHVyZVxuXHQgICAgICB9XG5cdCAgICAgIGBgYFxuXHQgICAgICAgRXJyYmFjayBFeGFtcGxlXG5cdCAgICAgICBgYGBqc1xuXHQgICAgICBmaW5kUmVzdWx0KGZ1bmN0aW9uKHJlc3VsdCwgZXJyKXtcblx0ICAgICAgICBpZiAoZXJyKSB7XG5cdCAgICAgICAgICAvLyBmYWlsdXJlXG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIC8vIHN1Y2Nlc3Ncblx0ICAgICAgICB9XG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgICAgIFByb21pc2UgRXhhbXBsZTtcblx0ICAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgZmluZFJlc3VsdCgpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcblx0ICAgICAgICAvLyBzdWNjZXNzXG5cdCAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG5cdCAgICAgICAgLy8gZmFpbHVyZVxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICAgICBBZHZhbmNlZCBFeGFtcGxlXG5cdCAgICAgIC0tLS0tLS0tLS0tLS0tXG5cdCAgICAgICBTeW5jaHJvbm91cyBFeGFtcGxlXG5cdCAgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGxldCBhdXRob3IsIGJvb2tzO1xuXHQgICAgICAgdHJ5IHtcblx0ICAgICAgICBhdXRob3IgPSBmaW5kQXV0aG9yKCk7XG5cdCAgICAgICAgYm9va3MgID0gZmluZEJvb2tzQnlBdXRob3IoYXV0aG9yKTtcblx0ICAgICAgICAvLyBzdWNjZXNzXG5cdCAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG5cdCAgICAgICAgLy8gZmFpbHVyZVxuXHQgICAgICB9XG5cdCAgICAgIGBgYFxuXHQgICAgICAgRXJyYmFjayBFeGFtcGxlXG5cdCAgICAgICBgYGBqc1xuXHQgICAgICAgZnVuY3Rpb24gZm91bmRCb29rcyhib29rcykge1xuXHQgICAgICAgfVxuXHQgICAgICAgZnVuY3Rpb24gZmFpbHVyZShyZWFzb24pIHtcblx0ICAgICAgIH1cblx0ICAgICAgIGZpbmRBdXRob3IoZnVuY3Rpb24oYXV0aG9yLCBlcnIpe1xuXHQgICAgICAgIGlmIChlcnIpIHtcblx0ICAgICAgICAgIGZhaWx1cmUoZXJyKTtcblx0ICAgICAgICAgIC8vIGZhaWx1cmVcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgICAgZmluZEJvb29rc0J5QXV0aG9yKGF1dGhvciwgZnVuY3Rpb24oYm9va3MsIGVycikge1xuXHQgICAgICAgICAgICAgIGlmIChlcnIpIHtcblx0ICAgICAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcblx0ICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgICAgICAgICAgZm91bmRCb29rcyhib29rcyk7XG5cdCAgICAgICAgICAgICAgICB9IGNhdGNoKHJlYXNvbikge1xuXHQgICAgICAgICAgICAgICAgICBmYWlsdXJlKHJlYXNvbik7XG5cdCAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcblx0ICAgICAgICAgICAgZmFpbHVyZShlcnIpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgICAgLy8gc3VjY2Vzc1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgICAgUHJvbWlzZSBFeGFtcGxlO1xuXHQgICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBmaW5kQXV0aG9yKCkuXG5cdCAgICAgICAgdGhlbihmaW5kQm9va3NCeUF1dGhvcikuXG5cdCAgICAgICAgdGhlbihmdW5jdGlvbihib29rcyl7XG5cdCAgICAgICAgICAvLyBmb3VuZCBib29rc1xuXHQgICAgICB9KS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuXHQgICAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgICAgIEBtZXRob2QgdGhlblxuXHQgICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvbkZ1bGZpbGxlZFxuXHQgICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkXG5cdCAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cblx0ICAgICAgQHJldHVybiB7UHJvbWlzZX1cblx0ICAgICAgKi9cblxuXHQgICAgICAvKipcblx0ICAgICAgYGNhdGNoYCBpcyBzaW1wbHkgc3VnYXIgZm9yIGB0aGVuKHVuZGVmaW5lZCwgb25SZWplY3Rpb24pYCB3aGljaCBtYWtlcyBpdCB0aGUgc2FtZVxuXHQgICAgICBhcyB0aGUgY2F0Y2ggYmxvY2sgb2YgYSB0cnkvY2F0Y2ggc3RhdGVtZW50LlxuXHQgICAgICBgYGBqc1xuXHQgICAgICBmdW5jdGlvbiBmaW5kQXV0aG9yKCl7XG5cdCAgICAgIHRocm93IG5ldyBFcnJvcignY291bGRuJ3QgZmluZCB0aGF0IGF1dGhvcicpO1xuXHQgICAgICB9XG5cdCAgICAgIC8vIHN5bmNocm9ub3VzXG5cdCAgICAgIHRyeSB7XG5cdCAgICAgIGZpbmRBdXRob3IoKTtcblx0ICAgICAgfSBjYXRjaChyZWFzb24pIHtcblx0ICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3Jvbmdcblx0ICAgICAgfVxuXHQgICAgICAvLyBhc3luYyB3aXRoIHByb21pc2VzXG5cdCAgICAgIGZpbmRBdXRob3IoKS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuXHQgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICAgIEBtZXRob2QgY2F0Y2hcblx0ICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3Rpb25cblx0ICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuXHQgICAgICBAcmV0dXJuIHtQcm9taXNlfVxuXHQgICAgICAqL1xuXG5cblx0ICAgICAgUHJvbWlzZS5wcm90b3R5cGUuY2F0Y2ggPSBmdW5jdGlvbiBfY2F0Y2gob25SZWplY3Rpb24pIHtcblx0ICAgICAgICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0aW9uKTtcblx0ICAgICAgfTtcblx0ICAgICAgLyoqXG5cdCAgICAgICAgYGZpbmFsbHlgIHdpbGwgYmUgaW52b2tlZCByZWdhcmRsZXNzIG9mIHRoZSBwcm9taXNlJ3MgZmF0ZSBqdXN0IGFzIG5hdGl2ZVxuXHQgICAgICAgIHRyeS9jYXRjaC9maW5hbGx5IGJlaGF2ZXNcblx0ICAgICAgXG5cdCAgICAgICAgU3luY2hyb25vdXMgZXhhbXBsZTpcblx0ICAgICAgXG5cdCAgICAgICAgYGBganNcblx0ICAgICAgICBmaW5kQXV0aG9yKCkge1xuXHQgICAgICAgICAgaWYgKE1hdGgucmFuZG9tKCkgPiAwLjUpIHtcblx0ICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgICByZXR1cm4gbmV3IEF1dGhvcigpO1xuXHQgICAgICAgIH1cblx0ICAgICAgXG5cdCAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgIHJldHVybiBmaW5kQXV0aG9yKCk7IC8vIHN1Y2NlZWQgb3IgZmFpbFxuXHQgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcblx0ICAgICAgICAgIHJldHVybiBmaW5kT3RoZXJBdXRoZXIoKTtcblx0ICAgICAgICB9IGZpbmFsbHkge1xuXHQgICAgICAgICAgLy8gYWx3YXlzIHJ1bnNcblx0ICAgICAgICAgIC8vIGRvZXNuJ3QgYWZmZWN0IHRoZSByZXR1cm4gdmFsdWVcblx0ICAgICAgICB9XG5cdCAgICAgICAgYGBgXG5cdCAgICAgIFxuXHQgICAgICAgIEFzeW5jaHJvbm91cyBleGFtcGxlOlxuXHQgICAgICBcblx0ICAgICAgICBgYGBqc1xuXHQgICAgICAgIGZpbmRBdXRob3IoKS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuXHQgICAgICAgICAgcmV0dXJuIGZpbmRPdGhlckF1dGhlcigpO1xuXHQgICAgICAgIH0pLmZpbmFsbHkoZnVuY3Rpb24oKXtcblx0ICAgICAgICAgIC8vIGF1dGhvciB3YXMgZWl0aGVyIGZvdW5kLCBvciBub3Rcblx0ICAgICAgICB9KTtcblx0ICAgICAgICBgYGBcblx0ICAgICAgXG5cdCAgICAgICAgQG1ldGhvZCBmaW5hbGx5XG5cdCAgICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcblx0ICAgICAgICBAcmV0dXJuIHtQcm9taXNlfVxuXHQgICAgICAqL1xuXG5cblx0ICAgICAgUHJvbWlzZS5wcm90b3R5cGUuZmluYWxseSA9IGZ1bmN0aW9uIF9maW5hbGx5KGNhbGxiYWNrKSB7XG5cdCAgICAgICAgdmFyIHByb21pc2UgPSB0aGlzO1xuXHQgICAgICAgIHZhciBjb25zdHJ1Y3RvciA9IHByb21pc2UuY29uc3RydWN0b3I7XG5cblx0ICAgICAgICBpZiAoaXNGdW5jdGlvbihjYWxsYmFjaykpIHtcblx0ICAgICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG5cdCAgICAgICAgICAgIHJldHVybiBjb25zdHJ1Y3Rvci5yZXNvbHZlKGNhbGxiYWNrKCkpLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcblx0ICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgICAgICAgICAgIHJldHVybiBjb25zdHJ1Y3Rvci5yZXNvbHZlKGNhbGxiYWNrKCkpLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICAgIHRocm93IHJlYXNvbjtcblx0ICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICB9KTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuKGNhbGxiYWNrLCBjYWxsYmFjayk7XG5cdCAgICAgIH07XG5cblx0ICAgICAgcmV0dXJuIFByb21pc2U7XG5cdCAgICB9KCk7XG5cblx0ICAgIFByb21pc2UkMS5wcm90b3R5cGUudGhlbiA9IHRoZW47XG5cdCAgICBQcm9taXNlJDEuYWxsID0gYWxsO1xuXHQgICAgUHJvbWlzZSQxLnJhY2UgPSByYWNlO1xuXHQgICAgUHJvbWlzZSQxLnJlc29sdmUgPSByZXNvbHZlJDE7XG5cdCAgICBQcm9taXNlJDEucmVqZWN0ID0gcmVqZWN0JDE7XG5cdCAgICBQcm9taXNlJDEuX3NldFNjaGVkdWxlciA9IHNldFNjaGVkdWxlcjtcblx0ICAgIFByb21pc2UkMS5fc2V0QXNhcCA9IHNldEFzYXA7XG5cdCAgICBQcm9taXNlJDEuX2FzYXAgPSBhc2FwO1xuXHQgICAgLypnbG9iYWwgc2VsZiovXG5cblx0ICAgIGZ1bmN0aW9uIHBvbHlmaWxsKCkge1xuXHQgICAgICB2YXIgbG9jYWwgPSB2b2lkIDA7XG5cblx0ICAgICAgaWYgKHR5cGVvZiBjb21tb25qc0dsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0ICAgICAgICBsb2NhbCA9IGNvbW1vbmpzR2xvYmFsO1xuXHQgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuXHQgICAgICAgIGxvY2FsID0gc2VsZjtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICB0cnkge1xuXHQgICAgICAgICAgbG9jYWwgPSBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuXHQgICAgICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seWZpbGwgZmFpbGVkIGJlY2F1c2UgZ2xvYmFsIG9iamVjdCBpcyB1bmF2YWlsYWJsZSBpbiB0aGlzIGVudmlyb25tZW50Jyk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgdmFyIFAgPSBsb2NhbC5Qcm9taXNlO1xuXG5cdCAgICAgIGlmIChQKSB7XG5cdCAgICAgICAgdmFyIHByb21pc2VUb1N0cmluZyA9IG51bGw7XG5cblx0ICAgICAgICB0cnkge1xuXHQgICAgICAgICAgcHJvbWlzZVRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKFAucmVzb2x2ZSgpKTtcblx0ICAgICAgICB9IGNhdGNoIChlKSB7Ly8gc2lsZW50bHkgaWdub3JlZFxuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGlmIChwcm9taXNlVG9TdHJpbmcgPT09ICdbb2JqZWN0IFByb21pc2VdJyAmJiAhUC5jYXN0KSB7XG5cdCAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgbG9jYWwuUHJvbWlzZSA9IFByb21pc2UkMTtcblx0ICAgIH0gLy8gU3RyYW5nZSBjb21wYXQuLlxuXG5cblx0ICAgIFByb21pc2UkMS5wb2x5ZmlsbCA9IHBvbHlmaWxsO1xuXHQgICAgUHJvbWlzZSQxLlByb21pc2UgPSBQcm9taXNlJDE7XG5cdCAgICByZXR1cm4gUHJvbWlzZSQxO1xuXHQgIH0pO1xuXHR9KTtcblxuXHR2YXIgUHJvbWlzZSQxID0gdHlwZW9mIFByb21pc2UgIT09IFwidW5kZWZpbmVkXCIgPyBQcm9taXNlIDogZXM2UHJvbWlzZTtcblxuXHRmdW5jdGlvbiByZWdpc3RlckxvZ2dpbmdDYWxsYmFja3Mob2JqKSB7XG5cdCAgdmFyIGksXG5cdCAgICAgIGwsXG5cdCAgICAgIGtleSxcblx0ICAgICAgY2FsbGJhY2tOYW1lcyA9IFtcImJlZ2luXCIsIFwiZG9uZVwiLCBcImxvZ1wiLCBcInRlc3RTdGFydFwiLCBcInRlc3REb25lXCIsIFwibW9kdWxlU3RhcnRcIiwgXCJtb2R1bGVEb25lXCJdO1xuXG5cdCAgZnVuY3Rpb24gcmVnaXN0ZXJMb2dnaW5nQ2FsbGJhY2soa2V5KSB7XG5cdCAgICB2YXIgbG9nZ2luZ0NhbGxiYWNrID0gZnVuY3Rpb24gbG9nZ2luZ0NhbGxiYWNrKGNhbGxiYWNrKSB7XG5cdCAgICAgIGlmIChvYmplY3RUeXBlKGNhbGxiYWNrKSAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUVVuaXQgbG9nZ2luZyBtZXRob2RzIHJlcXVpcmUgYSBjYWxsYmFjayBmdW5jdGlvbiBhcyB0aGVpciBmaXJzdCBwYXJhbWV0ZXJzLlwiKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGNvbmZpZy5jYWxsYmFja3Nba2V5XS5wdXNoKGNhbGxiYWNrKTtcblx0ICAgIH07XG5cblx0ICAgIHJldHVybiBsb2dnaW5nQ2FsbGJhY2s7XG5cdCAgfVxuXG5cdCAgZm9yIChpID0gMCwgbCA9IGNhbGxiYWNrTmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdCAgICBrZXkgPSBjYWxsYmFja05hbWVzW2ldOyAvLyBJbml0aWFsaXplIGtleSBjb2xsZWN0aW9uIG9mIGxvZ2dpbmcgY2FsbGJhY2tcblxuXHQgICAgaWYgKG9iamVjdFR5cGUoY29uZmlnLmNhbGxiYWNrc1trZXldKSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHQgICAgICBjb25maWcuY2FsbGJhY2tzW2tleV0gPSBbXTtcblx0ICAgIH1cblxuXHQgICAgb2JqW2tleV0gPSByZWdpc3RlckxvZ2dpbmdDYWxsYmFjayhrZXkpO1xuXHQgIH1cblx0fVxuXHRmdW5jdGlvbiBydW5Mb2dnaW5nQ2FsbGJhY2tzKGtleSwgYXJncykge1xuXHQgIHZhciBjYWxsYmFja3MgPSBjb25maWcuY2FsbGJhY2tzW2tleV07IC8vIEhhbmRsaW5nICdsb2cnIGNhbGxiYWNrcyBzZXBhcmF0ZWx5LiBVbmxpa2UgdGhlIG90aGVyIGNhbGxiYWNrcyxcblx0ICAvLyB0aGUgbG9nIGNhbGxiYWNrIGlzIG5vdCBjb250cm9sbGVkIGJ5IHRoZSBwcm9jZXNzaW5nIHF1ZXVlLFxuXHQgIC8vIGJ1dCByYXRoZXIgdXNlZCBieSBhc3NlcnRzLiBIZW5jZSB0byBwcm9taXNmeSB0aGUgJ2xvZycgY2FsbGJhY2tcblx0ICAvLyB3b3VsZCBtZWFuIHByb21pc2Z5aW5nIGVhY2ggc3RlcCBvZiBhIHRlc3RcblxuXHQgIGlmIChrZXkgPT09IFwibG9nXCIpIHtcblx0ICAgIGNhbGxiYWNrcy5tYXAoZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG5cdCAgICAgIHJldHVybiBjYWxsYmFjayhhcmdzKTtcblx0ICAgIH0pO1xuXHQgICAgcmV0dXJuO1xuXHQgIH0gLy8gZW5zdXJlIHRoYXQgZWFjaCBjYWxsYmFjayBpcyBleGVjdXRlZCBzZXJpYWxseVxuXG5cblx0ICByZXR1cm4gY2FsbGJhY2tzLnJlZHVjZShmdW5jdGlvbiAocHJvbWlzZUNoYWluLCBjYWxsYmFjaykge1xuXHQgICAgcmV0dXJuIHByb21pc2VDaGFpbi50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgcmV0dXJuIFByb21pc2UkMS5yZXNvbHZlKGNhbGxiYWNrKGFyZ3MpKTtcblx0ICAgIH0pO1xuXHQgIH0sIFByb21pc2UkMS5yZXNvbHZlKFtdKSk7XG5cdH1cblxuXHQvLyBEb2Vzbid0IHN1cHBvcnQgSUU5LCBpdCB3aWxsIHJldHVybiB1bmRlZmluZWQgb24gdGhlc2UgYnJvd3NlcnNcblx0Ly8gU2VlIGFsc28gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRXJyb3IvU3RhY2tcblx0dmFyIGZpbGVOYW1lID0gKHNvdXJjZUZyb21TdGFja3RyYWNlKDApIHx8IFwiXCIpLnJlcGxhY2UoLyg6XFxkKykrXFwpPy8sIFwiXCIpLnJlcGxhY2UoLy4rXFwvLywgXCJcIik7XG5cdGZ1bmN0aW9uIGV4dHJhY3RTdGFja3RyYWNlKGUsIG9mZnNldCkge1xuXHQgIG9mZnNldCA9IG9mZnNldCA9PT0gdW5kZWZpbmVkID8gNCA6IG9mZnNldDtcblx0ICB2YXIgc3RhY2ssIGluY2x1ZGUsIGk7XG5cblx0ICBpZiAoZSAmJiBlLnN0YWNrKSB7XG5cdCAgICBzdGFjayA9IGUuc3RhY2suc3BsaXQoXCJcXG5cIik7XG5cblx0ICAgIGlmICgvXmVycm9yJC9pLnRlc3Qoc3RhY2tbMF0pKSB7XG5cdCAgICAgIHN0YWNrLnNoaWZ0KCk7XG5cdCAgICB9XG5cblx0ICAgIGlmIChmaWxlTmFtZSkge1xuXHQgICAgICBpbmNsdWRlID0gW107XG5cblx0ICAgICAgZm9yIChpID0gb2Zmc2V0OyBpIDwgc3RhY2subGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICBpZiAoc3RhY2tbaV0uaW5kZXhPZihmaWxlTmFtZSkgIT09IC0xKSB7XG5cdCAgICAgICAgICBicmVhaztcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBpbmNsdWRlLnB1c2goc3RhY2tbaV0pO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKGluY2x1ZGUubGVuZ3RoKSB7XG5cdCAgICAgICAgcmV0dXJuIGluY2x1ZGUuam9pbihcIlxcblwiKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gc3RhY2tbb2Zmc2V0XTtcblx0ICB9XG5cdH1cblx0ZnVuY3Rpb24gc291cmNlRnJvbVN0YWNrdHJhY2Uob2Zmc2V0KSB7XG5cdCAgdmFyIGVycm9yID0gbmV3IEVycm9yKCk7IC8vIFN1cHBvcnQ6IFNhZmFyaSA8PTcgb25seSwgSUUgPD0xMCAtIDExIG9ubHlcblx0ICAvLyBOb3QgYWxsIGJyb3dzZXJzIGdlbmVyYXRlIHRoZSBgc3RhY2tgIHByb3BlcnR5IGZvciBgbmV3IEVycm9yKClgLCBzZWUgYWxzbyAjNjM2XG5cblx0ICBpZiAoIWVycm9yLnN0YWNrKSB7XG5cdCAgICB0cnkge1xuXHQgICAgICB0aHJvdyBlcnJvcjtcblx0ICAgIH0gY2F0Y2ggKGVycikge1xuXHQgICAgICBlcnJvciA9IGVycjtcblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gZXh0cmFjdFN0YWNrdHJhY2UoZXJyb3IsIG9mZnNldCk7XG5cdH1cblxuXHR2YXIgcHJpb3JpdHlDb3VudCA9IDA7XG5cdHZhciB1bml0U2FtcGxlcjsgLy8gVGhpcyBpcyBhIHF1ZXVlIG9mIGZ1bmN0aW9ucyB0aGF0IGFyZSB0YXNrcyB3aXRoaW4gYSBzaW5nbGUgdGVzdC5cblx0Ly8gQWZ0ZXIgdGVzdHMgYXJlIGRlcXVldWVkIGZyb20gY29uZmlnLnF1ZXVlIHRoZXkgYXJlIGV4cGFuZGVkIGludG9cblx0Ly8gYSBzZXQgb2YgdGFza3MgaW4gdGhpcyBxdWV1ZS5cblxuXHR2YXIgdGFza1F1ZXVlID0gW107XG5cdC8qKlxuXHQgKiBBZHZhbmNlcyB0aGUgdGFza1F1ZXVlIHRvIHRoZSBuZXh0IHRhc2suIElmIHRoZSB0YXNrUXVldWUgaXMgZW1wdHksXG5cdCAqIHByb2Nlc3MgdGhlIHRlc3RRdWV1ZVxuXHQgKi9cblxuXHRmdW5jdGlvbiBhZHZhbmNlKCkge1xuXHQgIGFkdmFuY2VUYXNrUXVldWUoKTtcblxuXHQgIGlmICghdGFza1F1ZXVlLmxlbmd0aCAmJiAhY29uZmlnLmJsb2NraW5nICYmICFjb25maWcuY3VycmVudCkge1xuXHQgICAgYWR2YW5jZVRlc3RRdWV1ZSgpO1xuXHQgIH1cblx0fVxuXHQvKipcblx0ICogQWR2YW5jZXMgdGhlIHRhc2tRdWV1ZSB3aXRoIGFuIGluY3JlYXNlZCBkZXB0aFxuXHQgKi9cblxuXG5cdGZ1bmN0aW9uIGFkdmFuY2VUYXNrUXVldWUoKSB7XG5cdCAgdmFyIHN0YXJ0ID0gbm93KCk7XG5cdCAgY29uZmlnLmRlcHRoID0gKGNvbmZpZy5kZXB0aCB8fCAwKSArIDE7XG5cdCAgcHJvY2Vzc1Rhc2tRdWV1ZShzdGFydCk7XG5cdCAgY29uZmlnLmRlcHRoLS07XG5cdH1cblx0LyoqXG5cdCAqIFByb2Nlc3MgdGhlIGZpcnN0IHRhc2sgb24gdGhlIHRhc2tRdWV1ZSBhcyBhIHByb21pc2UuXG5cdCAqIEVhY2ggdGFzayBpcyBhIGZ1bmN0aW9uIHJldHVybmVkIGJ5IGh0dHBzOi8vZ2l0aHViLmNvbS9xdW5pdGpzL3F1bml0L2Jsb2IvbWFzdGVyL3NyYy90ZXN0LmpzI0wzODFcblx0ICovXG5cblxuXHRmdW5jdGlvbiBwcm9jZXNzVGFza1F1ZXVlKHN0YXJ0KSB7XG5cdCAgaWYgKHRhc2tRdWV1ZS5sZW5ndGggJiYgIWNvbmZpZy5ibG9ja2luZykge1xuXHQgICAgdmFyIGVsYXBzZWRUaW1lID0gbm93KCkgLSBzdGFydDtcblxuXHQgICAgaWYgKCFkZWZpbmVkLnNldFRpbWVvdXQgfHwgY29uZmlnLnVwZGF0ZVJhdGUgPD0gMCB8fCBlbGFwc2VkVGltZSA8IGNvbmZpZy51cGRhdGVSYXRlKSB7XG5cdCAgICAgIHZhciB0YXNrID0gdGFza1F1ZXVlLnNoaWZ0KCk7XG5cdCAgICAgIFByb21pc2UkMS5yZXNvbHZlKHRhc2soKSkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgaWYgKCF0YXNrUXVldWUubGVuZ3RoKSB7XG5cdCAgICAgICAgICBhZHZhbmNlKCk7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHByb2Nlc3NUYXNrUXVldWUoc3RhcnQpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBzZXRUaW1lb3V0JDEoYWR2YW5jZSk7XG5cdCAgICB9XG5cdCAgfVxuXHR9XG5cdC8qKlxuXHQgKiBBZHZhbmNlIHRoZSB0ZXN0UXVldWUgdG8gdGhlIG5leHQgdGVzdCB0byBwcm9jZXNzLiBDYWxsIGRvbmUoKSBpZiB0ZXN0UXVldWUgY29tcGxldGVzLlxuXHQgKi9cblxuXG5cdGZ1bmN0aW9uIGFkdmFuY2VUZXN0UXVldWUoKSB7XG5cdCAgaWYgKCFjb25maWcuYmxvY2tpbmcgJiYgIWNvbmZpZy5xdWV1ZS5sZW5ndGggJiYgY29uZmlnLmRlcHRoID09PSAwKSB7XG5cdCAgICBkb25lKCk7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgdmFyIHRlc3RUYXNrcyA9IGNvbmZpZy5xdWV1ZS5zaGlmdCgpO1xuXHQgIGFkZFRvVGFza1F1ZXVlKHRlc3RUYXNrcygpKTtcblxuXHQgIGlmIChwcmlvcml0eUNvdW50ID4gMCkge1xuXHQgICAgcHJpb3JpdHlDb3VudC0tO1xuXHQgIH1cblxuXHQgIGFkdmFuY2UoKTtcblx0fVxuXHQvKipcblx0ICogRW5xdWV1ZSB0aGUgdGFza3MgZm9yIGEgdGVzdCBpbnRvIHRoZSB0YXNrIHF1ZXVlLlxuXHQgKiBAcGFyYW0ge0FycmF5fSB0YXNrc0FycmF5XG5cdCAqL1xuXG5cblx0ZnVuY3Rpb24gYWRkVG9UYXNrUXVldWUodGFza3NBcnJheSkge1xuXHQgIHRhc2tRdWV1ZS5wdXNoLmFwcGx5KHRhc2tRdWV1ZSwgX3RvQ29uc3VtYWJsZUFycmF5KHRhc2tzQXJyYXkpKTtcblx0fVxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBudW1iZXIgb2YgdGFza3MgcmVtYWluaW5nIGluIHRoZSB0YXNrIHF1ZXVlIHRvIGJlIHByb2Nlc3NlZC5cblx0ICogQHJldHVybiB7TnVtYmVyfVxuXHQgKi9cblxuXG5cdGZ1bmN0aW9uIHRhc2tRdWV1ZUxlbmd0aCgpIHtcblx0ICByZXR1cm4gdGFza1F1ZXVlLmxlbmd0aDtcblx0fVxuXHQvKipcblx0ICogQWRkcyBhIHRlc3QgdG8gdGhlIFRlc3RRdWV1ZSBmb3IgZXhlY3V0aW9uLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSB0ZXN0VGFza3NGdW5jXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gcHJpb3JpdGl6ZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gc2VlZFxuXHQgKi9cblxuXG5cdGZ1bmN0aW9uIGFkZFRvVGVzdFF1ZXVlKHRlc3RUYXNrc0Z1bmMsIHByaW9yaXRpemUsIHNlZWQpIHtcblx0ICBpZiAocHJpb3JpdGl6ZSkge1xuXHQgICAgY29uZmlnLnF1ZXVlLnNwbGljZShwcmlvcml0eUNvdW50KyssIDAsIHRlc3RUYXNrc0Z1bmMpO1xuXHQgIH0gZWxzZSBpZiAoc2VlZCkge1xuXHQgICAgaWYgKCF1bml0U2FtcGxlcikge1xuXHQgICAgICB1bml0U2FtcGxlciA9IHVuaXRTYW1wbGVyR2VuZXJhdG9yKHNlZWQpO1xuXHQgICAgfSAvLyBJbnNlcnQgaW50byBhIHJhbmRvbSBwb3NpdGlvbiBhZnRlciBhbGwgcHJpb3JpdGl6ZWQgaXRlbXNcblxuXG5cdCAgICB2YXIgaW5kZXggPSBNYXRoLmZsb29yKHVuaXRTYW1wbGVyKCkgKiAoY29uZmlnLnF1ZXVlLmxlbmd0aCAtIHByaW9yaXR5Q291bnQgKyAxKSk7XG5cdCAgICBjb25maWcucXVldWUuc3BsaWNlKHByaW9yaXR5Q291bnQgKyBpbmRleCwgMCwgdGVzdFRhc2tzRnVuYyk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIGNvbmZpZy5xdWV1ZS5wdXNoKHRlc3RUYXNrc0Z1bmMpO1xuXHQgIH1cblx0fVxuXHQvKipcblx0ICogQ3JlYXRlcyBhIHNlZWRlZCBcInNhbXBsZVwiIGdlbmVyYXRvciB3aGljaCBpcyB1c2VkIGZvciByYW5kb21pemluZyB0ZXN0cy5cblx0ICovXG5cblxuXHRmdW5jdGlvbiB1bml0U2FtcGxlckdlbmVyYXRvcihzZWVkKSB7XG5cdCAgLy8gMzItYml0IHhvcnNoaWZ0LCByZXF1aXJlcyBvbmx5IGEgbm9uemVybyBzZWVkXG5cdCAgLy8gaHR0cHM6Ly9leGNhbWVyYS5jb20vc3BoaW54L2FydGljbGUteG9yc2hpZnQuaHRtbFxuXHQgIHZhciBzYW1wbGUgPSBwYXJzZUludChnZW5lcmF0ZUhhc2goc2VlZCksIDE2KSB8fCAtMTtcblx0ICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXHQgICAgc2FtcGxlIF49IHNhbXBsZSA8PCAxMztcblx0ICAgIHNhbXBsZSBePSBzYW1wbGUgPj4+IDE3O1xuXHQgICAgc2FtcGxlIF49IHNhbXBsZSA8PCA1OyAvLyBFQ01BU2NyaXB0IGhhcyBubyB1bnNpZ25lZCBudW1iZXIgdHlwZVxuXG5cdCAgICBpZiAoc2FtcGxlIDwgMCkge1xuXHQgICAgICBzYW1wbGUgKz0gMHgxMDAwMDAwMDA7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBzYW1wbGUgLyAweDEwMDAwMDAwMDtcblx0ICB9O1xuXHR9XG5cdC8qKlxuXHQgKiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aGVuIHRoZSBQcm9jZXNzaW5nUXVldWUgaXMgZG9uZSBwcm9jZXNzaW5nIGFsbFxuXHQgKiBpdGVtcy4gSXQgaGFuZGxlcyBlbWl0dGluZyB0aGUgZmluYWwgcnVuIGV2ZW50cy5cblx0ICovXG5cblxuXHRmdW5jdGlvbiBkb25lKCkge1xuXHQgIHZhciBzdG9yYWdlID0gY29uZmlnLnN0b3JhZ2U7XG5cdCAgUHJvY2Vzc2luZ1F1ZXVlLmZpbmlzaGVkID0gdHJ1ZTtcblx0ICB2YXIgcnVudGltZSA9IG5vdygpIC0gY29uZmlnLnN0YXJ0ZWQ7XG5cdCAgdmFyIHBhc3NlZCA9IGNvbmZpZy5zdGF0cy5hbGwgLSBjb25maWcuc3RhdHMuYmFkO1xuXG5cdCAgaWYgKGNvbmZpZy5zdGF0cy50ZXN0Q291bnQgPT09IDApIHtcblx0ICAgIGlmIChjb25maWcuZmlsdGVyICYmIGNvbmZpZy5maWx0ZXIubGVuZ3RoKSB7XG5cdCAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHRlc3RzIG1hdGNoZWQgdGhlIGZpbHRlciBcXFwiXCIuY29uY2F0KGNvbmZpZy5maWx0ZXIsIFwiXFxcIi5cIikpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY29uZmlnLm1vZHVsZSAmJiBjb25maWcubW9kdWxlLmxlbmd0aCkge1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyB0ZXN0cyBtYXRjaGVkIHRoZSBtb2R1bGUgXFxcIlwiLmNvbmNhdChjb25maWcubW9kdWxlLCBcIlxcXCIuXCIpKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGNvbmZpZy5tb2R1bGVJZCAmJiBjb25maWcubW9kdWxlSWQubGVuZ3RoKSB7XG5cdCAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHRlc3RzIG1hdGNoZWQgdGhlIG1vZHVsZUlkIFxcXCJcIi5jb25jYXQoY29uZmlnLm1vZHVsZUlkLCBcIlxcXCIuXCIpKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGNvbmZpZy50ZXN0SWQgJiYgY29uZmlnLnRlc3RJZC5sZW5ndGgpIHtcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gdGVzdHMgbWF0Y2hlZCB0aGUgdGVzdElkIFxcXCJcIi5jb25jYXQoY29uZmlnLnRlc3RJZCwgXCJcXFwiLlwiKSk7XG5cdCAgICB9XG5cblx0ICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHRlc3RzIHdlcmUgcnVuLlwiKTtcblx0ICB9XG5cblx0ICBlbWl0KFwicnVuRW5kXCIsIGdsb2JhbFN1aXRlLmVuZCh0cnVlKSk7XG5cdCAgcnVuTG9nZ2luZ0NhbGxiYWNrcyhcImRvbmVcIiwge1xuXHQgICAgcGFzc2VkOiBwYXNzZWQsXG5cdCAgICBmYWlsZWQ6IGNvbmZpZy5zdGF0cy5iYWQsXG5cdCAgICB0b3RhbDogY29uZmlnLnN0YXRzLmFsbCxcblx0ICAgIHJ1bnRpbWU6IHJ1bnRpbWVcblx0ICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgIC8vIENsZWFyIG93biBzdG9yYWdlIGl0ZW1zIGlmIGFsbCB0ZXN0cyBwYXNzZWRcblx0ICAgIGlmIChzdG9yYWdlICYmIGNvbmZpZy5zdGF0cy5iYWQgPT09IDApIHtcblx0ICAgICAgZm9yICh2YXIgaSA9IHN0b3JhZ2UubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0ICAgICAgICB2YXIga2V5ID0gc3RvcmFnZS5rZXkoaSk7XG5cblx0ICAgICAgICBpZiAoa2V5LmluZGV4T2YoXCJxdW5pdC10ZXN0LVwiKSA9PT0gMCkge1xuXHQgICAgICAgICAgc3RvcmFnZS5yZW1vdmVJdGVtKGtleSk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfSk7XG5cdH1cblxuXHR2YXIgUHJvY2Vzc2luZ1F1ZXVlID0ge1xuXHQgIGZpbmlzaGVkOiBmYWxzZSxcblx0ICBhZGQ6IGFkZFRvVGVzdFF1ZXVlLFxuXHQgIGFkdmFuY2U6IGFkdmFuY2UsXG5cdCAgdGFza0NvdW50OiB0YXNrUXVldWVMZW5ndGhcblx0fTtcblxuXHR2YXIgVGVzdFJlcG9ydCA9IC8qI19fUFVSRV9fKi9mdW5jdGlvbiAoKSB7XG5cdCAgZnVuY3Rpb24gVGVzdFJlcG9ydChuYW1lLCBzdWl0ZSwgb3B0aW9ucykge1xuXHQgICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFRlc3RSZXBvcnQpO1xuXG5cdCAgICB0aGlzLm5hbWUgPSBuYW1lO1xuXHQgICAgdGhpcy5zdWl0ZU5hbWUgPSBzdWl0ZS5uYW1lO1xuXHQgICAgdGhpcy5mdWxsTmFtZSA9IHN1aXRlLmZ1bGxOYW1lLmNvbmNhdChuYW1lKTtcblx0ICAgIHRoaXMucnVudGltZSA9IDA7XG5cdCAgICB0aGlzLmFzc2VydGlvbnMgPSBbXTtcblx0ICAgIHRoaXMuc2tpcHBlZCA9ICEhb3B0aW9ucy5za2lwO1xuXHQgICAgdGhpcy50b2RvID0gISFvcHRpb25zLnRvZG87XG5cdCAgICB0aGlzLnZhbGlkID0gb3B0aW9ucy52YWxpZDtcblx0ICAgIHRoaXMuX3N0YXJ0VGltZSA9IDA7XG5cdCAgICB0aGlzLl9lbmRUaW1lID0gMDtcblx0ICAgIHN1aXRlLnB1c2hUZXN0KHRoaXMpO1xuXHQgIH1cblxuXHQgIF9jcmVhdGVDbGFzcyhUZXN0UmVwb3J0LCBbe1xuXHQgICAga2V5OiBcInN0YXJ0XCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gc3RhcnQocmVjb3JkVGltZSkge1xuXHQgICAgICBpZiAocmVjb3JkVGltZSkge1xuXHQgICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IHBlcmZvcm1hbmNlTm93KCk7XG5cblx0ICAgICAgICBpZiAocGVyZm9ybWFuY2UpIHtcblx0ICAgICAgICAgIHBlcmZvcm1hbmNlLm1hcmsoXCJxdW5pdF90ZXN0X3N0YXJ0XCIpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiB7XG5cdCAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxuXHQgICAgICAgIHN1aXRlTmFtZTogdGhpcy5zdWl0ZU5hbWUsXG5cdCAgICAgICAgZnVsbE5hbWU6IHRoaXMuZnVsbE5hbWUuc2xpY2UoKVxuXHQgICAgICB9O1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJlbmRcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBlbmQocmVjb3JkVGltZSkge1xuXHQgICAgICBpZiAocmVjb3JkVGltZSkge1xuXHQgICAgICAgIHRoaXMuX2VuZFRpbWUgPSBwZXJmb3JtYW5jZU5vdygpO1xuXG5cdCAgICAgICAgaWYgKHBlcmZvcm1hbmNlKSB7XG5cdCAgICAgICAgICBwZXJmb3JtYW5jZS5tYXJrKFwicXVuaXRfdGVzdF9lbmRcIik7XG5cdCAgICAgICAgICB2YXIgdGVzdE5hbWUgPSB0aGlzLmZ1bGxOYW1lLmpvaW4oXCIg4oCTIFwiKTtcblx0ICAgICAgICAgIG1lYXN1cmUoXCJRVW5pdCBUZXN0OiBcIi5jb25jYXQodGVzdE5hbWUpLCBcInF1bml0X3Rlc3Rfc3RhcnRcIiwgXCJxdW5pdF90ZXN0X2VuZFwiKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gZXh0ZW5kKHRoaXMuc3RhcnQoKSwge1xuXHQgICAgICAgIHJ1bnRpbWU6IHRoaXMuZ2V0UnVudGltZSgpLFxuXHQgICAgICAgIHN0YXR1czogdGhpcy5nZXRTdGF0dXMoKSxcblx0ICAgICAgICBlcnJvcnM6IHRoaXMuZ2V0RmFpbGVkQXNzZXJ0aW9ucygpLFxuXHQgICAgICAgIGFzc2VydGlvbnM6IHRoaXMuZ2V0QXNzZXJ0aW9ucygpXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJwdXNoQXNzZXJ0aW9uXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gcHVzaEFzc2VydGlvbihhc3NlcnRpb24pIHtcblx0ICAgICAgdGhpcy5hc3NlcnRpb25zLnB1c2goYXNzZXJ0aW9uKTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZ2V0UnVudGltZVwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGdldFJ1bnRpbWUoKSB7XG5cdCAgICAgIHJldHVybiB0aGlzLl9lbmRUaW1lIC0gdGhpcy5fc3RhcnRUaW1lO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJnZXRTdGF0dXNcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRTdGF0dXMoKSB7XG5cdCAgICAgIGlmICh0aGlzLnNraXBwZWQpIHtcblx0ICAgICAgICByZXR1cm4gXCJza2lwcGVkXCI7XG5cdCAgICAgIH1cblxuXHQgICAgICB2YXIgdGVzdFBhc3NlZCA9IHRoaXMuZ2V0RmFpbGVkQXNzZXJ0aW9ucygpLmxlbmd0aCA+IDAgPyB0aGlzLnRvZG8gOiAhdGhpcy50b2RvO1xuXG5cdCAgICAgIGlmICghdGVzdFBhc3NlZCkge1xuXHQgICAgICAgIHJldHVybiBcImZhaWxlZFwiO1xuXHQgICAgICB9IGVsc2UgaWYgKHRoaXMudG9kbykge1xuXHQgICAgICAgIHJldHVybiBcInRvZG9cIjtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICByZXR1cm4gXCJwYXNzZWRcIjtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJnZXRGYWlsZWRBc3NlcnRpb25zXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0RmFpbGVkQXNzZXJ0aW9ucygpIHtcblx0ICAgICAgcmV0dXJuIHRoaXMuYXNzZXJ0aW9ucy5maWx0ZXIoZnVuY3Rpb24gKGFzc2VydGlvbikge1xuXHQgICAgICAgIHJldHVybiAhYXNzZXJ0aW9uLnBhc3NlZDtcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImdldEFzc2VydGlvbnNcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRBc3NlcnRpb25zKCkge1xuXHQgICAgICByZXR1cm4gdGhpcy5hc3NlcnRpb25zLnNsaWNlKCk7XG5cdCAgICB9IC8vIFJlbW92ZSBhY3R1YWwgYW5kIGV4cGVjdGVkIHZhbHVlcyBmcm9tIGFzc2VydGlvbnMuIFRoaXMgaXMgdG8gcHJldmVudFxuXHQgICAgLy8gbGVha2luZyBtZW1vcnkgdGhyb3VnaG91dCBhIHRlc3Qgc3VpdGUuXG5cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwic2xpbUFzc2VydGlvbnNcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBzbGltQXNzZXJ0aW9ucygpIHtcblx0ICAgICAgdGhpcy5hc3NlcnRpb25zID0gdGhpcy5hc3NlcnRpb25zLm1hcChmdW5jdGlvbiAoYXNzZXJ0aW9uKSB7XG5cdCAgICAgICAgZGVsZXRlIGFzc2VydGlvbi5hY3R1YWw7XG5cdCAgICAgICAgZGVsZXRlIGFzc2VydGlvbi5leHBlY3RlZDtcblx0ICAgICAgICByZXR1cm4gYXNzZXJ0aW9uO1xuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9XSk7XG5cblx0ICByZXR1cm4gVGVzdFJlcG9ydDtcblx0fSgpO1xuXG5cdHZhciBmb2N1c2VkJDEgPSBmYWxzZTtcblx0ZnVuY3Rpb24gVGVzdChzZXR0aW5ncykge1xuXHQgIHZhciBpLCBsO1xuXHQgICsrVGVzdC5jb3VudDtcblx0ICB0aGlzLmV4cGVjdGVkID0gbnVsbDtcblx0ICB0aGlzLmFzc2VydGlvbnMgPSBbXTtcblx0ICB0aGlzLnNlbWFwaG9yZSA9IDA7XG5cdCAgdGhpcy5tb2R1bGUgPSBjb25maWcuY3VycmVudE1vZHVsZTtcblx0ICB0aGlzLnN0ZXBzID0gW107XG5cdCAgdGhpcy50aW1lb3V0ID0gdW5kZWZpbmVkO1xuXHQgIHRoaXMuZXJyb3JGb3JTdGFjayA9IG5ldyBFcnJvcigpOyAvLyBJZiBhIG1vZHVsZSBpcyBza2lwcGVkLCBhbGwgaXRzIHRlc3RzIGFuZCB0aGUgdGVzdHMgb2YgdGhlIGNoaWxkIHN1aXRlc1xuXHQgIC8vIHNob3VsZCBiZSB0cmVhdGVkIGFzIHNraXBwZWQgZXZlbiBpZiB0aGV5IGFyZSBkZWZpbmVkIGFzIGBvbmx5YCBvciBgdG9kb2AuXG5cdCAgLy8gQXMgZm9yIGB0b2RvYCBtb2R1bGUsIGFsbCBpdHMgdGVzdHMgd2lsbCBiZSB0cmVhdGVkIGFzIGB0b2RvYCBleGNlcHQgZm9yXG5cdCAgLy8gdGVzdHMgZGVmaW5lZCBhcyBgc2tpcGAgd2hpY2ggd2lsbCBiZSBsZWZ0IGludGFjdC5cblx0ICAvL1xuXHQgIC8vIFNvLCBpZiBhIHRlc3QgaXMgZGVmaW5lZCBhcyBgdG9kb2AgYW5kIGlzIGluc2lkZSBhIHNraXBwZWQgbW9kdWxlLCB3ZSBzaG91bGRcblx0ICAvLyB0aGVuIHRyZWF0IHRoYXQgdGVzdCBhcyBpZiB3YXMgZGVmaW5lZCBhcyBgc2tpcGAuXG5cblx0ICBpZiAodGhpcy5tb2R1bGUuc2tpcCkge1xuXHQgICAgc2V0dGluZ3Muc2tpcCA9IHRydWU7XG5cdCAgICBzZXR0aW5ncy50b2RvID0gZmFsc2U7IC8vIFNraXBwZWQgdGVzdHMgc2hvdWxkIGJlIGxlZnQgaW50YWN0XG5cdCAgfSBlbHNlIGlmICh0aGlzLm1vZHVsZS50b2RvICYmICFzZXR0aW5ncy5za2lwKSB7XG5cdCAgICBzZXR0aW5ncy50b2RvID0gdHJ1ZTtcblx0ICB9XG5cblx0ICBleHRlbmQodGhpcywgc2V0dGluZ3MpO1xuXHQgIHRoaXMudGVzdFJlcG9ydCA9IG5ldyBUZXN0UmVwb3J0KHNldHRpbmdzLnRlc3ROYW1lLCB0aGlzLm1vZHVsZS5zdWl0ZVJlcG9ydCwge1xuXHQgICAgdG9kbzogc2V0dGluZ3MudG9kbyxcblx0ICAgIHNraXA6IHNldHRpbmdzLnNraXAsXG5cdCAgICB2YWxpZDogdGhpcy52YWxpZCgpXG5cdCAgfSk7IC8vIFJlZ2lzdGVyIHVuaXF1ZSBzdHJpbmdzXG5cblx0ICBmb3IgKGkgPSAwLCBsID0gdGhpcy5tb2R1bGUudGVzdHM7IGkgPCBsLmxlbmd0aDsgaSsrKSB7XG5cdCAgICBpZiAodGhpcy5tb2R1bGUudGVzdHNbaV0ubmFtZSA9PT0gdGhpcy50ZXN0TmFtZSkge1xuXHQgICAgICB0aGlzLnRlc3ROYW1lICs9IFwiIFwiO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIHRoaXMudGVzdElkID0gZ2VuZXJhdGVIYXNoKHRoaXMubW9kdWxlLm5hbWUsIHRoaXMudGVzdE5hbWUpO1xuXHQgIHRoaXMubW9kdWxlLnRlc3RzLnB1c2goe1xuXHQgICAgbmFtZTogdGhpcy50ZXN0TmFtZSxcblx0ICAgIHRlc3RJZDogdGhpcy50ZXN0SWQsXG5cdCAgICBza2lwOiAhIXNldHRpbmdzLnNraXBcblx0ICB9KTtcblxuXHQgIGlmIChzZXR0aW5ncy5za2lwKSB7XG5cdCAgICAvLyBTa2lwcGVkIHRlc3RzIHdpbGwgZnVsbHkgaWdub3JlIGFueSBzZW50IGNhbGxiYWNrXG5cdCAgICB0aGlzLmNhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG5cblx0ICAgIHRoaXMuYXN5bmMgPSBmYWxzZTtcblx0ICAgIHRoaXMuZXhwZWN0ZWQgPSAwO1xuXHQgIH0gZWxzZSB7XG5cdCAgICBpZiAodHlwZW9mIHRoaXMuY2FsbGJhY2sgIT09IFwiZnVuY3Rpb25cIikge1xuXHQgICAgICB2YXIgbWV0aG9kID0gdGhpcy50b2RvID8gXCJ0b2RvXCIgOiBcInRlc3RcIjsgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1sZW5cblxuXHQgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiWW91IG11c3QgcHJvdmlkZSBhIGZ1bmN0aW9uIGFzIGEgdGVzdCBjYWxsYmFjayB0byBRVW5pdC5cIi5jb25jYXQobWV0aG9kLCBcIihcXFwiXCIpLmNvbmNhdChzZXR0aW5ncy50ZXN0TmFtZSwgXCJcXFwiKVwiKSk7XG5cdCAgICB9XG5cblx0ICAgIHRoaXMuYXNzZXJ0ID0gbmV3IEFzc2VydCh0aGlzKTtcblx0ICB9XG5cdH1cblx0VGVzdC5jb3VudCA9IDA7XG5cblx0ZnVuY3Rpb24gZ2V0Tm90U3RhcnRlZE1vZHVsZXMoc3RhcnRNb2R1bGUpIHtcblx0ICB2YXIgbW9kdWxlID0gc3RhcnRNb2R1bGUsXG5cdCAgICAgIG1vZHVsZXMgPSBbXTtcblxuXHQgIHdoaWxlIChtb2R1bGUgJiYgbW9kdWxlLnRlc3RzUnVuID09PSAwKSB7XG5cdCAgICBtb2R1bGVzLnB1c2gobW9kdWxlKTtcblx0ICAgIG1vZHVsZSA9IG1vZHVsZS5wYXJlbnRNb2R1bGU7XG5cdCAgfSAvLyBUaGUgYWJvdmUgcHVzaCBtb2R1bGVzIGZyb20gdGhlIGNoaWxkIHRvIHRoZSBwYXJlbnRcblx0ICAvLyByZXR1cm4gYSByZXZlcnNlZCBvcmRlciB3aXRoIHRoZSB0b3AgYmVpbmcgdGhlIHRvcCBtb3N0IHBhcmVudCBtb2R1bGVcblxuXG5cdCAgcmV0dXJuIG1vZHVsZXMucmV2ZXJzZSgpO1xuXHR9XG5cblx0VGVzdC5wcm90b3R5cGUgPSB7XG5cdCAgLy8gZ2VuZXJhdGluZyBhIHN0YWNrIHRyYWNlIGNhbiBiZSBleHBlbnNpdmUsIHNvIHVzaW5nIGEgZ2V0dGVyIGRlZmVycyB0aGlzIHVudGlsIHdlIG5lZWQgaXRcblx0ICBnZXQgc3RhY2soKSB7XG5cdCAgICByZXR1cm4gZXh0cmFjdFN0YWNrdHJhY2UodGhpcy5lcnJvckZvclN0YWNrLCAyKTtcblx0ICB9LFxuXG5cdCAgYmVmb3JlOiBmdW5jdGlvbiBiZWZvcmUoKSB7XG5cdCAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG5cdCAgICB2YXIgbW9kdWxlID0gdGhpcy5tb2R1bGUsXG5cdCAgICAgICAgbm90U3RhcnRlZE1vZHVsZXMgPSBnZXROb3RTdGFydGVkTW9kdWxlcyhtb2R1bGUpOyAvLyBlbnN1cmUgdGhlIGNhbGxiYWNrcyBhcmUgZXhlY3V0ZWQgc2VyaWFsbHkgZm9yIGVhY2ggbW9kdWxlXG5cblx0ICAgIHZhciBjYWxsYmFja1Byb21pc2VzID0gbm90U3RhcnRlZE1vZHVsZXMucmVkdWNlKGZ1bmN0aW9uIChwcm9taXNlQ2hhaW4sIHN0YXJ0TW9kdWxlKSB7XG5cdCAgICAgIHJldHVybiBwcm9taXNlQ2hhaW4udGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgc3RhcnRNb2R1bGUuc3RhdHMgPSB7XG5cdCAgICAgICAgICBhbGw6IDAsXG5cdCAgICAgICAgICBiYWQ6IDAsXG5cdCAgICAgICAgICBzdGFydGVkOiBub3coKVxuXHQgICAgICAgIH07XG5cdCAgICAgICAgZW1pdChcInN1aXRlU3RhcnRcIiwgc3RhcnRNb2R1bGUuc3VpdGVSZXBvcnQuc3RhcnQodHJ1ZSkpO1xuXHQgICAgICAgIHJldHVybiBydW5Mb2dnaW5nQ2FsbGJhY2tzKFwibW9kdWxlU3RhcnRcIiwge1xuXHQgICAgICAgICAgbmFtZTogc3RhcnRNb2R1bGUubmFtZSxcblx0ICAgICAgICAgIHRlc3RzOiBzdGFydE1vZHVsZS50ZXN0c1xuXHQgICAgICAgIH0pO1xuXHQgICAgICB9KTtcblx0ICAgIH0sIFByb21pc2UkMS5yZXNvbHZlKFtdKSk7XG5cdCAgICByZXR1cm4gY2FsbGJhY2tQcm9taXNlcy50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgY29uZmlnLmN1cnJlbnQgPSBfdGhpcztcblx0ICAgICAgX3RoaXMudGVzdEVudmlyb25tZW50ID0gZXh0ZW5kKHt9LCBtb2R1bGUudGVzdEVudmlyb25tZW50KTtcblx0ICAgICAgX3RoaXMuc3RhcnRlZCA9IG5vdygpO1xuXHQgICAgICBlbWl0KFwidGVzdFN0YXJ0XCIsIF90aGlzLnRlc3RSZXBvcnQuc3RhcnQodHJ1ZSkpO1xuXHQgICAgICByZXR1cm4gcnVuTG9nZ2luZ0NhbGxiYWNrcyhcInRlc3RTdGFydFwiLCB7XG5cdCAgICAgICAgbmFtZTogX3RoaXMudGVzdE5hbWUsXG5cdCAgICAgICAgbW9kdWxlOiBtb2R1bGUubmFtZSxcblx0ICAgICAgICB0ZXN0SWQ6IF90aGlzLnRlc3RJZCxcblx0ICAgICAgICBwcmV2aW91c0ZhaWx1cmU6IF90aGlzLnByZXZpb3VzRmFpbHVyZVxuXHQgICAgICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBpZiAoIWNvbmZpZy5wb2xsdXRpb24pIHtcblx0ICAgICAgICAgIHNhdmVHbG9iYWwoKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0pO1xuXHQgICAgfSk7XG5cdCAgfSxcblx0ICBydW46IGZ1bmN0aW9uIHJ1bigpIHtcblx0ICAgIHZhciBwcm9taXNlO1xuXHQgICAgY29uZmlnLmN1cnJlbnQgPSB0aGlzO1xuXHQgICAgdGhpcy5jYWxsYmFja1N0YXJ0ZWQgPSBub3coKTtcblxuXHQgICAgaWYgKGNvbmZpZy5ub3RyeWNhdGNoKSB7XG5cdCAgICAgIHJ1blRlc3QodGhpcyk7XG5cdCAgICAgIHJldHVybjtcblx0ICAgIH1cblxuXHQgICAgdHJ5IHtcblx0ICAgICAgcnVuVGVzdCh0aGlzKTtcblx0ICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgdGhpcy5wdXNoRmFpbHVyZShcIkRpZWQgb24gdGVzdCAjXCIgKyAodGhpcy5hc3NlcnRpb25zLmxlbmd0aCArIDEpICsgXCIgXCIgKyB0aGlzLnN0YWNrICsgXCI6IFwiICsgKGUubWVzc2FnZSB8fCBlKSwgZXh0cmFjdFN0YWNrdHJhY2UoZSwgMCkpOyAvLyBFbHNlIG5leHQgdGVzdCB3aWxsIGNhcnJ5IHRoZSByZXNwb25zaWJpbGl0eVxuXG5cdCAgICAgIHNhdmVHbG9iYWwoKTsgLy8gUmVzdGFydCB0aGUgdGVzdHMgaWYgdGhleSdyZSBibG9ja2luZ1xuXG5cdCAgICAgIGlmIChjb25maWcuYmxvY2tpbmcpIHtcblx0ICAgICAgICBpbnRlcm5hbFJlY292ZXIodGhpcyk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gcnVuVGVzdCh0ZXN0KSB7XG5cdCAgICAgIHByb21pc2UgPSB0ZXN0LmNhbGxiYWNrLmNhbGwodGVzdC50ZXN0RW52aXJvbm1lbnQsIHRlc3QuYXNzZXJ0KTtcblx0ICAgICAgdGVzdC5yZXNvbHZlUHJvbWlzZShwcm9taXNlKTsgLy8gSWYgdGhlIHRlc3QgaGFzIGEgXCJsb2NrXCIgb24gaXQsIGJ1dCB0aGUgdGltZW91dCBpcyAwLCB0aGVuIHdlIHB1c2ggYVxuXHQgICAgICAvLyBmYWlsdXJlIGFzIHRoZSB0ZXN0IHNob3VsZCBiZSBzeW5jaHJvbm91cy5cblxuXHQgICAgICBpZiAodGVzdC50aW1lb3V0ID09PSAwICYmIHRlc3Quc2VtYXBob3JlICE9PSAwKSB7XG5cdCAgICAgICAgcHVzaEZhaWx1cmUoXCJUZXN0IGRpZCBub3QgZmluaXNoIHN5bmNocm9ub3VzbHkgZXZlbiB0aG91Z2ggYXNzZXJ0LnRpbWVvdXQoIDAgKSB3YXMgdXNlZC5cIiwgc291cmNlRnJvbVN0YWNrdHJhY2UoMikpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfSxcblx0ICBhZnRlcjogZnVuY3Rpb24gYWZ0ZXIoKSB7XG5cdCAgICBjaGVja1BvbGx1dGlvbigpO1xuXHQgIH0sXG5cdCAgcXVldWVIb29rOiBmdW5jdGlvbiBxdWV1ZUhvb2soaG9vaywgaG9va05hbWUsIGhvb2tPd25lcikge1xuXHQgICAgdmFyIF90aGlzMiA9IHRoaXM7XG5cblx0ICAgIHZhciBjYWxsSG9vayA9IGZ1bmN0aW9uIGNhbGxIb29rKCkge1xuXHQgICAgICB2YXIgcHJvbWlzZSA9IGhvb2suY2FsbChfdGhpczIudGVzdEVudmlyb25tZW50LCBfdGhpczIuYXNzZXJ0KTtcblxuXHQgICAgICBfdGhpczIucmVzb2x2ZVByb21pc2UocHJvbWlzZSwgaG9va05hbWUpO1xuXHQgICAgfTtcblxuXHQgICAgdmFyIHJ1bkhvb2sgPSBmdW5jdGlvbiBydW5Ib29rKCkge1xuXHQgICAgICBpZiAoaG9va05hbWUgPT09IFwiYmVmb3JlXCIpIHtcblx0ICAgICAgICBpZiAoaG9va093bmVyLnVuc2tpcHBlZFRlc3RzUnVuICE9PSAwKSB7XG5cdCAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgX3RoaXMyLnByZXNlcnZlRW52aXJvbm1lbnQgPSB0cnVlO1xuXHQgICAgICB9IC8vIFRoZSAnYWZ0ZXInIGhvb2sgc2hvdWxkIG9ubHkgZXhlY3V0ZSB3aGVuIHRoZXJlIGFyZSBub3QgdGVzdHMgbGVmdCBhbmRcblx0ICAgICAgLy8gd2hlbiB0aGUgJ2FmdGVyJyBhbmQgJ2ZpbmlzaCcgdGFza3MgYXJlIHRoZSBvbmx5IHRhc2tzIGxlZnQgdG8gcHJvY2Vzc1xuXG5cblx0ICAgICAgaWYgKGhvb2tOYW1lID09PSBcImFmdGVyXCIgJiYgaG9va093bmVyLnVuc2tpcHBlZFRlc3RzUnVuICE9PSBudW1iZXJPZlVuc2tpcHBlZFRlc3RzKGhvb2tPd25lcikgLSAxICYmIChjb25maWcucXVldWUubGVuZ3RoID4gMCB8fCBQcm9jZXNzaW5nUXVldWUudGFza0NvdW50KCkgPiAyKSkge1xuXHQgICAgICAgIHJldHVybjtcblx0ICAgICAgfVxuXG5cdCAgICAgIGNvbmZpZy5jdXJyZW50ID0gX3RoaXMyO1xuXG5cdCAgICAgIGlmIChjb25maWcubm90cnljYXRjaCkge1xuXHQgICAgICAgIGNhbGxIb29rKCk7XG5cdCAgICAgICAgcmV0dXJuO1xuXHQgICAgICB9XG5cblx0ICAgICAgdHJ5IHtcblx0ICAgICAgICBjYWxsSG9vaygpO1xuXHQgICAgICB9IGNhdGNoIChlcnJvcikge1xuXHQgICAgICAgIF90aGlzMi5wdXNoRmFpbHVyZShob29rTmFtZSArIFwiIGZhaWxlZCBvbiBcIiArIF90aGlzMi50ZXN0TmFtZSArIFwiOiBcIiArIChlcnJvci5tZXNzYWdlIHx8IGVycm9yKSwgZXh0cmFjdFN0YWNrdHJhY2UoZXJyb3IsIDApKTtcblx0ICAgICAgfVxuXHQgICAgfTtcblxuXHQgICAgcmV0dXJuIHJ1bkhvb2s7XG5cdCAgfSxcblx0ICAvLyBDdXJyZW50bHkgb25seSB1c2VkIGZvciBtb2R1bGUgbGV2ZWwgaG9va3MsIGNhbiBiZSB1c2VkIHRvIGFkZCBnbG9iYWwgbGV2ZWwgb25lc1xuXHQgIGhvb2tzOiBmdW5jdGlvbiBob29rcyhoYW5kbGVyKSB7XG5cdCAgICB2YXIgaG9va3MgPSBbXTtcblxuXHQgICAgZnVuY3Rpb24gcHJvY2Vzc0hvb2tzKHRlc3QsIG1vZHVsZSkge1xuXHQgICAgICBpZiAobW9kdWxlLnBhcmVudE1vZHVsZSkge1xuXHQgICAgICAgIHByb2Nlc3NIb29rcyh0ZXN0LCBtb2R1bGUucGFyZW50TW9kdWxlKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChtb2R1bGUuaG9va3NbaGFuZGxlcl0ubGVuZ3RoKSB7XG5cdCAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtb2R1bGUuaG9va3NbaGFuZGxlcl0ubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgIGhvb2tzLnB1c2godGVzdC5xdWV1ZUhvb2sobW9kdWxlLmhvb2tzW2hhbmRsZXJdW2ldLCBoYW5kbGVyLCBtb2R1bGUpKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH0gLy8gSG9va3MgYXJlIGlnbm9yZWQgb24gc2tpcHBlZCB0ZXN0c1xuXG5cblx0ICAgIGlmICghdGhpcy5za2lwKSB7XG5cdCAgICAgIHByb2Nlc3NIb29rcyh0aGlzLCB0aGlzLm1vZHVsZSk7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBob29rcztcblx0ICB9LFxuXHQgIGZpbmlzaDogZnVuY3Rpb24gZmluaXNoKCkge1xuXHQgICAgY29uZmlnLmN1cnJlbnQgPSB0aGlzOyAvLyBSZWxlYXNlIHRoZSB0ZXN0IGNhbGxiYWNrIHRvIGVuc3VyZSB0aGF0IGFueXRoaW5nIHJlZmVyZW5jZWQgaGFzIGJlZW5cblx0ICAgIC8vIHJlbGVhc2VkIHRvIGJlIGdhcmJhZ2UgY29sbGVjdGVkLlxuXG5cdCAgICB0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xuXG5cdCAgICBpZiAodGhpcy5zdGVwcy5sZW5ndGgpIHtcblx0ICAgICAgdmFyIHN0ZXBzTGlzdCA9IHRoaXMuc3RlcHMuam9pbihcIiwgXCIpO1xuXHQgICAgICB0aGlzLnB1c2hGYWlsdXJlKFwiRXhwZWN0ZWQgYXNzZXJ0LnZlcmlmeVN0ZXBzKCkgdG8gYmUgY2FsbGVkIGJlZm9yZSBlbmQgb2YgdGVzdCBcIiArIFwiYWZ0ZXIgdXNpbmcgYXNzZXJ0LnN0ZXAoKS4gVW52ZXJpZmllZCBzdGVwczogXCIuY29uY2F0KHN0ZXBzTGlzdCksIHRoaXMuc3RhY2spO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY29uZmlnLnJlcXVpcmVFeHBlY3RzICYmIHRoaXMuZXhwZWN0ZWQgPT09IG51bGwpIHtcblx0ICAgICAgdGhpcy5wdXNoRmFpbHVyZShcIkV4cGVjdGVkIG51bWJlciBvZiBhc3NlcnRpb25zIHRvIGJlIGRlZmluZWQsIGJ1dCBleHBlY3QoKSB3YXMgXCIgKyBcIm5vdCBjYWxsZWQuXCIsIHRoaXMuc3RhY2spO1xuXHQgICAgfSBlbHNlIGlmICh0aGlzLmV4cGVjdGVkICE9PSBudWxsICYmIHRoaXMuZXhwZWN0ZWQgIT09IHRoaXMuYXNzZXJ0aW9ucy5sZW5ndGgpIHtcblx0ICAgICAgdGhpcy5wdXNoRmFpbHVyZShcIkV4cGVjdGVkIFwiICsgdGhpcy5leHBlY3RlZCArIFwiIGFzc2VydGlvbnMsIGJ1dCBcIiArIHRoaXMuYXNzZXJ0aW9ucy5sZW5ndGggKyBcIiB3ZXJlIHJ1blwiLCB0aGlzLnN0YWNrKTtcblx0ICAgIH0gZWxzZSBpZiAodGhpcy5leHBlY3RlZCA9PT0gbnVsbCAmJiAhdGhpcy5hc3NlcnRpb25zLmxlbmd0aCkge1xuXHQgICAgICB0aGlzLnB1c2hGYWlsdXJlKFwiRXhwZWN0ZWQgYXQgbGVhc3Qgb25lIGFzc2VydGlvbiwgYnV0IG5vbmUgd2VyZSBydW4gLSBjYWxsIFwiICsgXCJleHBlY3QoMCkgdG8gYWNjZXB0IHplcm8gYXNzZXJ0aW9ucy5cIiwgdGhpcy5zdGFjayk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBpLFxuXHQgICAgICAgIG1vZHVsZSA9IHRoaXMubW9kdWxlLFxuXHQgICAgICAgIG1vZHVsZU5hbWUgPSBtb2R1bGUubmFtZSxcblx0ICAgICAgICB0ZXN0TmFtZSA9IHRoaXMudGVzdE5hbWUsXG5cdCAgICAgICAgc2tpcHBlZCA9ICEhdGhpcy5za2lwLFxuXHQgICAgICAgIHRvZG8gPSAhIXRoaXMudG9kbyxcblx0ICAgICAgICBiYWQgPSAwLFxuXHQgICAgICAgIHN0b3JhZ2UgPSBjb25maWcuc3RvcmFnZTtcblx0ICAgIHRoaXMucnVudGltZSA9IG5vdygpIC0gdGhpcy5zdGFydGVkO1xuXHQgICAgY29uZmlnLnN0YXRzLmFsbCArPSB0aGlzLmFzc2VydGlvbnMubGVuZ3RoO1xuXHQgICAgY29uZmlnLnN0YXRzLnRlc3RDb3VudCArPSAxO1xuXHQgICAgbW9kdWxlLnN0YXRzLmFsbCArPSB0aGlzLmFzc2VydGlvbnMubGVuZ3RoO1xuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5hc3NlcnRpb25zLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIGlmICghdGhpcy5hc3NlcnRpb25zW2ldLnJlc3VsdCkge1xuXHQgICAgICAgIGJhZCsrO1xuXHQgICAgICAgIGNvbmZpZy5zdGF0cy5iYWQrKztcblx0ICAgICAgICBtb2R1bGUuc3RhdHMuYmFkKys7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgbm90aWZ5VGVzdHNSYW4obW9kdWxlLCBza2lwcGVkKTsgLy8gU3RvcmUgcmVzdWx0IHdoZW4gcG9zc2libGVcblxuXHQgICAgaWYgKHN0b3JhZ2UpIHtcblx0ICAgICAgaWYgKGJhZCkge1xuXHQgICAgICAgIHN0b3JhZ2Uuc2V0SXRlbShcInF1bml0LXRlc3QtXCIgKyBtb2R1bGVOYW1lICsgXCItXCIgKyB0ZXN0TmFtZSwgYmFkKTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBzdG9yYWdlLnJlbW92ZUl0ZW0oXCJxdW5pdC10ZXN0LVwiICsgbW9kdWxlTmFtZSArIFwiLVwiICsgdGVzdE5hbWUpO1xuXHQgICAgICB9XG5cdCAgICB9IC8vIEFmdGVyIGVtaXR0aW5nIHRoZSBqcy1yZXBvcnRlcnMgZXZlbnQgd2UgY2xlYW51cCB0aGUgYXNzZXJ0aW9uIGRhdGEgdG9cblx0ICAgIC8vIGF2b2lkIGxlYWtpbmcgaXQuIEl0IGlzIG5vdCB1c2VkIGJ5IHRoZSBsZWdhY3kgdGVzdERvbmUgY2FsbGJhY2tzLlxuXG5cblx0ICAgIGVtaXQoXCJ0ZXN0RW5kXCIsIHRoaXMudGVzdFJlcG9ydC5lbmQodHJ1ZSkpO1xuXHQgICAgdGhpcy50ZXN0UmVwb3J0LnNsaW1Bc3NlcnRpb25zKCk7XG5cdCAgICB2YXIgdGVzdCA9IHRoaXM7XG5cdCAgICByZXR1cm4gcnVuTG9nZ2luZ0NhbGxiYWNrcyhcInRlc3REb25lXCIsIHtcblx0ICAgICAgbmFtZTogdGVzdE5hbWUsXG5cdCAgICAgIG1vZHVsZTogbW9kdWxlTmFtZSxcblx0ICAgICAgc2tpcHBlZDogc2tpcHBlZCxcblx0ICAgICAgdG9kbzogdG9kbyxcblx0ICAgICAgZmFpbGVkOiBiYWQsXG5cdCAgICAgIHBhc3NlZDogdGhpcy5hc3NlcnRpb25zLmxlbmd0aCAtIGJhZCxcblx0ICAgICAgdG90YWw6IHRoaXMuYXNzZXJ0aW9ucy5sZW5ndGgsXG5cdCAgICAgIHJ1bnRpbWU6IHNraXBwZWQgPyAwIDogdGhpcy5ydW50aW1lLFxuXHQgICAgICAvLyBIVE1MIFJlcG9ydGVyIHVzZVxuXHQgICAgICBhc3NlcnRpb25zOiB0aGlzLmFzc2VydGlvbnMsXG5cdCAgICAgIHRlc3RJZDogdGhpcy50ZXN0SWQsXG5cblx0ICAgICAgLy8gU291cmNlIG9mIFRlc3Rcblx0ICAgICAgLy8gZ2VuZXJhdGluZyBzdGFjayB0cmFjZSBpcyBleHBlbnNpdmUsIHNvIHVzaW5nIGEgZ2V0dGVyIHdpbGwgaGVscCBkZWZlciB0aGlzIHVudGlsIHdlIG5lZWQgaXRcblx0ICAgICAgZ2V0IHNvdXJjZSgpIHtcblx0ICAgICAgICByZXR1cm4gdGVzdC5zdGFjaztcblx0ICAgICAgfVxuXG5cdCAgICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgaWYgKG1vZHVsZS50ZXN0c1J1biA9PT0gbnVtYmVyT2ZUZXN0cyhtb2R1bGUpKSB7XG5cdCAgICAgICAgdmFyIGNvbXBsZXRlZE1vZHVsZXMgPSBbbW9kdWxlXTsgLy8gQ2hlY2sgaWYgdGhlIHBhcmVudCBtb2R1bGVzLCBpdGVyYXRpdmVseSwgYXJlIGRvbmUuIElmIHRoYXQgdGhlIGNhc2UsXG5cdCAgICAgICAgLy8gd2UgZW1pdCB0aGUgYHN1aXRlRW5kYCBldmVudCBhbmQgdHJpZ2dlciBgbW9kdWxlRG9uZWAgY2FsbGJhY2suXG5cblx0ICAgICAgICB2YXIgcGFyZW50ID0gbW9kdWxlLnBhcmVudE1vZHVsZTtcblxuXHQgICAgICAgIHdoaWxlIChwYXJlbnQgJiYgcGFyZW50LnRlc3RzUnVuID09PSBudW1iZXJPZlRlc3RzKHBhcmVudCkpIHtcblx0ICAgICAgICAgIGNvbXBsZXRlZE1vZHVsZXMucHVzaChwYXJlbnQpO1xuXHQgICAgICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudE1vZHVsZTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICByZXR1cm4gY29tcGxldGVkTW9kdWxlcy5yZWR1Y2UoZnVuY3Rpb24gKHByb21pc2VDaGFpbiwgY29tcGxldGVkTW9kdWxlKSB7XG5cdCAgICAgICAgICByZXR1cm4gcHJvbWlzZUNoYWluLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICByZXR1cm4gbG9nU3VpdGVFbmQoY29tcGxldGVkTW9kdWxlKTtcblx0ICAgICAgICAgIH0pO1xuXHQgICAgICAgIH0sIFByb21pc2UkMS5yZXNvbHZlKFtdKSk7XG5cdCAgICAgIH1cblx0ICAgIH0pLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgICBjb25maWcuY3VycmVudCA9IHVuZGVmaW5lZDtcblx0ICAgIH0pO1xuXG5cdCAgICBmdW5jdGlvbiBsb2dTdWl0ZUVuZChtb2R1bGUpIHtcblx0ICAgICAgLy8gUmVzZXQgYG1vZHVsZS5ob29rc2AgdG8gZW5zdXJlIHRoYXQgYW55dGhpbmcgcmVmZXJlbmNlZCBpbiB0aGVzZSBob29rc1xuXHQgICAgICAvLyBoYXMgYmVlbiByZWxlYXNlZCB0byBiZSBnYXJiYWdlIGNvbGxlY3RlZC5cblx0ICAgICAgbW9kdWxlLmhvb2tzID0ge307XG5cdCAgICAgIGVtaXQoXCJzdWl0ZUVuZFwiLCBtb2R1bGUuc3VpdGVSZXBvcnQuZW5kKHRydWUpKTtcblx0ICAgICAgcmV0dXJuIHJ1bkxvZ2dpbmdDYWxsYmFja3MoXCJtb2R1bGVEb25lXCIsIHtcblx0ICAgICAgICBuYW1lOiBtb2R1bGUubmFtZSxcblx0ICAgICAgICB0ZXN0czogbW9kdWxlLnRlc3RzLFxuXHQgICAgICAgIGZhaWxlZDogbW9kdWxlLnN0YXRzLmJhZCxcblx0ICAgICAgICBwYXNzZWQ6IG1vZHVsZS5zdGF0cy5hbGwgLSBtb2R1bGUuc3RhdHMuYmFkLFxuXHQgICAgICAgIHRvdGFsOiBtb2R1bGUuc3RhdHMuYWxsLFxuXHQgICAgICAgIHJ1bnRpbWU6IG5vdygpIC0gbW9kdWxlLnN0YXRzLnN0YXJ0ZWRcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSxcblx0ICBwcmVzZXJ2ZVRlc3RFbnZpcm9ubWVudDogZnVuY3Rpb24gcHJlc2VydmVUZXN0RW52aXJvbm1lbnQoKSB7XG5cdCAgICBpZiAodGhpcy5wcmVzZXJ2ZUVudmlyb25tZW50KSB7XG5cdCAgICAgIHRoaXMubW9kdWxlLnRlc3RFbnZpcm9ubWVudCA9IHRoaXMudGVzdEVudmlyb25tZW50O1xuXHQgICAgICB0aGlzLnRlc3RFbnZpcm9ubWVudCA9IGV4dGVuZCh7fSwgdGhpcy5tb2R1bGUudGVzdEVudmlyb25tZW50KTtcblx0ICAgIH1cblx0ICB9LFxuXHQgIHF1ZXVlOiBmdW5jdGlvbiBxdWV1ZSgpIHtcblx0ICAgIHZhciB0ZXN0ID0gdGhpcztcblxuXHQgICAgaWYgKCF0aGlzLnZhbGlkKCkpIHtcblx0ICAgICAgcmV0dXJuO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBydW5UZXN0KCkge1xuXHQgICAgICByZXR1cm4gW2Z1bmN0aW9uICgpIHtcblx0ICAgICAgICByZXR1cm4gdGVzdC5iZWZvcmUoKTtcblx0ICAgICAgfV0uY29uY2F0KF90b0NvbnN1bWFibGVBcnJheSh0ZXN0Lmhvb2tzKFwiYmVmb3JlXCIpKSwgW2Z1bmN0aW9uICgpIHtcblx0ICAgICAgICB0ZXN0LnByZXNlcnZlVGVzdEVudmlyb25tZW50KCk7XG5cdCAgICAgIH1dLCBfdG9Db25zdW1hYmxlQXJyYXkodGVzdC5ob29rcyhcImJlZm9yZUVhY2hcIikpLCBbZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHRlc3QucnVuKCk7XG5cdCAgICAgIH1dLCBfdG9Db25zdW1hYmxlQXJyYXkodGVzdC5ob29rcyhcImFmdGVyRWFjaFwiKS5yZXZlcnNlKCkpLCBfdG9Db25zdW1hYmxlQXJyYXkodGVzdC5ob29rcyhcImFmdGVyXCIpLnJldmVyc2UoKSksIFtmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgdGVzdC5hZnRlcigpO1xuXHQgICAgICB9LCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgcmV0dXJuIHRlc3QuZmluaXNoKCk7XG5cdCAgICAgIH1dKTtcblx0ICAgIH1cblxuXHQgICAgdmFyIHByZXZpb3VzRmFpbENvdW50ID0gY29uZmlnLnN0b3JhZ2UgJiYgK2NvbmZpZy5zdG9yYWdlLmdldEl0ZW0oXCJxdW5pdC10ZXN0LVwiICsgdGhpcy5tb2R1bGUubmFtZSArIFwiLVwiICsgdGhpcy50ZXN0TmFtZSk7IC8vIFByaW9yaXRpemUgcHJldmlvdXNseSBmYWlsZWQgdGVzdHMsIGRldGVjdGVkIGZyb20gc3RvcmFnZVxuXG5cdCAgICB2YXIgcHJpb3JpdGl6ZSA9IGNvbmZpZy5yZW9yZGVyICYmICEhcHJldmlvdXNGYWlsQ291bnQ7XG5cdCAgICB0aGlzLnByZXZpb3VzRmFpbHVyZSA9ICEhcHJldmlvdXNGYWlsQ291bnQ7XG5cdCAgICBQcm9jZXNzaW5nUXVldWUuYWRkKHJ1blRlc3QsIHByaW9yaXRpemUsIGNvbmZpZy5zZWVkKTsgLy8gSWYgdGhlIHF1ZXVlIGhhcyBhbHJlYWR5IGZpbmlzaGVkLCB3ZSBtYW51YWxseSBwcm9jZXNzIHRoZSBuZXcgdGVzdFxuXG5cdCAgICBpZiAoUHJvY2Vzc2luZ1F1ZXVlLmZpbmlzaGVkKSB7XG5cdCAgICAgIFByb2Nlc3NpbmdRdWV1ZS5hZHZhbmNlKCk7XG5cdCAgICB9XG5cdCAgfSxcblx0ICBwdXNoUmVzdWx0OiBmdW5jdGlvbiBwdXNoUmVzdWx0KHJlc3VsdEluZm8pIHtcblx0ICAgIGlmICh0aGlzICE9PSBjb25maWcuY3VycmVudCkge1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBc3NlcnRpb24gb2NjdXJyZWQgYWZ0ZXIgdGVzdCBoYWQgZmluaXNoZWQuXCIpO1xuXHQgICAgfSAvLyBEZXN0cnVjdHVyZSBvZiByZXN1bHRJbmZvID0geyByZXN1bHQsIGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsIG5lZ2F0aXZlIH1cblxuXG5cdCAgICB2YXIgc291cmNlLFxuXHQgICAgICAgIGRldGFpbHMgPSB7XG5cdCAgICAgIG1vZHVsZTogdGhpcy5tb2R1bGUubmFtZSxcblx0ICAgICAgbmFtZTogdGhpcy50ZXN0TmFtZSxcblx0ICAgICAgcmVzdWx0OiByZXN1bHRJbmZvLnJlc3VsdCxcblx0ICAgICAgbWVzc2FnZTogcmVzdWx0SW5mby5tZXNzYWdlLFxuXHQgICAgICBhY3R1YWw6IHJlc3VsdEluZm8uYWN0dWFsLFxuXHQgICAgICB0ZXN0SWQ6IHRoaXMudGVzdElkLFxuXHQgICAgICBuZWdhdGl2ZTogcmVzdWx0SW5mby5uZWdhdGl2ZSB8fCBmYWxzZSxcblx0ICAgICAgcnVudGltZTogbm93KCkgLSB0aGlzLnN0YXJ0ZWQsXG5cdCAgICAgIHRvZG86ICEhdGhpcy50b2RvXG5cdCAgICB9O1xuXG5cdCAgICBpZiAoaGFzT3duLmNhbGwocmVzdWx0SW5mbywgXCJleHBlY3RlZFwiKSkge1xuXHQgICAgICBkZXRhaWxzLmV4cGVjdGVkID0gcmVzdWx0SW5mby5leHBlY3RlZDtcblx0ICAgIH1cblxuXHQgICAgaWYgKCFyZXN1bHRJbmZvLnJlc3VsdCkge1xuXHQgICAgICBzb3VyY2UgPSByZXN1bHRJbmZvLnNvdXJjZSB8fCBzb3VyY2VGcm9tU3RhY2t0cmFjZSgpO1xuXG5cdCAgICAgIGlmIChzb3VyY2UpIHtcblx0ICAgICAgICBkZXRhaWxzLnNvdXJjZSA9IHNvdXJjZTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICB0aGlzLmxvZ0Fzc2VydGlvbihkZXRhaWxzKTtcblx0ICAgIHRoaXMuYXNzZXJ0aW9ucy5wdXNoKHtcblx0ICAgICAgcmVzdWx0OiAhIXJlc3VsdEluZm8ucmVzdWx0LFxuXHQgICAgICBtZXNzYWdlOiByZXN1bHRJbmZvLm1lc3NhZ2Vcblx0ICAgIH0pO1xuXHQgIH0sXG5cdCAgcHVzaEZhaWx1cmU6IGZ1bmN0aW9uIHB1c2hGYWlsdXJlKG1lc3NhZ2UsIHNvdXJjZSwgYWN0dWFsKSB7XG5cdCAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgVGVzdCkpIHtcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKFwicHVzaEZhaWx1cmUoKSBhc3NlcnRpb24gb3V0c2lkZSB0ZXN0IGNvbnRleHQsIHdhcyBcIiArIHNvdXJjZUZyb21TdGFja3RyYWNlKDIpKTtcblx0ICAgIH1cblxuXHQgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgcmVzdWx0OiBmYWxzZSxcblx0ICAgICAgbWVzc2FnZTogbWVzc2FnZSB8fCBcImVycm9yXCIsXG5cdCAgICAgIGFjdHVhbDogYWN0dWFsIHx8IG51bGwsXG5cdCAgICAgIHNvdXJjZTogc291cmNlXG5cdCAgICB9KTtcblx0ICB9LFxuXG5cdCAgLyoqXG5cdCAgICogTG9nIGFzc2VydGlvbiBkZXRhaWxzIHVzaW5nIGJvdGggdGhlIG9sZCBRVW5pdC5sb2cgaW50ZXJmYWNlIGFuZFxuXHQgICAqIFFVbml0Lm9uKCBcImFzc2VydGlvblwiICkgaW50ZXJmYWNlLlxuXHQgICAqXG5cdCAgICogQHByaXZhdGVcblx0ICAgKi9cblx0ICBsb2dBc3NlcnRpb246IGZ1bmN0aW9uIGxvZ0Fzc2VydGlvbihkZXRhaWxzKSB7XG5cdCAgICBydW5Mb2dnaW5nQ2FsbGJhY2tzKFwibG9nXCIsIGRldGFpbHMpO1xuXHQgICAgdmFyIGFzc2VydGlvbiA9IHtcblx0ICAgICAgcGFzc2VkOiBkZXRhaWxzLnJlc3VsdCxcblx0ICAgICAgYWN0dWFsOiBkZXRhaWxzLmFjdHVhbCxcblx0ICAgICAgZXhwZWN0ZWQ6IGRldGFpbHMuZXhwZWN0ZWQsXG5cdCAgICAgIG1lc3NhZ2U6IGRldGFpbHMubWVzc2FnZSxcblx0ICAgICAgc3RhY2s6IGRldGFpbHMuc291cmNlLFxuXHQgICAgICB0b2RvOiBkZXRhaWxzLnRvZG9cblx0ICAgIH07XG5cdCAgICB0aGlzLnRlc3RSZXBvcnQucHVzaEFzc2VydGlvbihhc3NlcnRpb24pO1xuXHQgICAgZW1pdChcImFzc2VydGlvblwiLCBhc3NlcnRpb24pO1xuXHQgIH0sXG5cdCAgcmVzb2x2ZVByb21pc2U6IGZ1bmN0aW9uIHJlc29sdmVQcm9taXNlKHByb21pc2UsIHBoYXNlKSB7XG5cdCAgICB2YXIgdGhlbixcblx0ICAgICAgICByZXN1bWUsXG5cdCAgICAgICAgbWVzc2FnZSxcblx0ICAgICAgICB0ZXN0ID0gdGhpcztcblxuXHQgICAgaWYgKHByb21pc2UgIT0gbnVsbCkge1xuXHQgICAgICB0aGVuID0gcHJvbWlzZS50aGVuO1xuXG5cdCAgICAgIGlmIChvYmplY3RUeXBlKHRoZW4pID09PSBcImZ1bmN0aW9uXCIpIHtcblx0ICAgICAgICByZXN1bWUgPSBpbnRlcm5hbFN0b3AodGVzdCk7XG5cblx0ICAgICAgICBpZiAoY29uZmlnLm5vdHJ5Y2F0Y2gpIHtcblx0ICAgICAgICAgIHRoZW4uY2FsbChwcm9taXNlLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgIHJlc3VtZSgpO1xuXHQgICAgICAgICAgfSk7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHRoZW4uY2FsbChwcm9taXNlLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgIHJlc3VtZSgpO1xuXHQgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG5cdCAgICAgICAgICAgIG1lc3NhZ2UgPSBcIlByb21pc2UgcmVqZWN0ZWQgXCIgKyAoIXBoYXNlID8gXCJkdXJpbmdcIiA6IHBoYXNlLnJlcGxhY2UoL0VhY2gkLywgXCJcIikpICsgXCIgXFxcIlwiICsgdGVzdC50ZXN0TmFtZSArIFwiXFxcIjogXCIgKyAoZXJyb3IgJiYgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG5cdCAgICAgICAgICAgIHRlc3QucHVzaEZhaWx1cmUobWVzc2FnZSwgZXh0cmFjdFN0YWNrdHJhY2UoZXJyb3IsIDApKTsgLy8gRWxzZSBuZXh0IHRlc3Qgd2lsbCBjYXJyeSB0aGUgcmVzcG9uc2liaWxpdHlcblxuXHQgICAgICAgICAgICBzYXZlR2xvYmFsKCk7IC8vIFVuYmxvY2tcblxuXHQgICAgICAgICAgICBpbnRlcm5hbFJlY292ZXIodGVzdCk7XG5cdCAgICAgICAgICB9KTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9LFxuXHQgIHZhbGlkOiBmdW5jdGlvbiB2YWxpZCgpIHtcblx0ICAgIHZhciBmaWx0ZXIgPSBjb25maWcuZmlsdGVyLFxuXHQgICAgICAgIHJlZ2V4RmlsdGVyID0gL14oIT8pXFwvKFtcXHdcXFddKilcXC8oaT8kKS8uZXhlYyhmaWx0ZXIpLFxuXHQgICAgICAgIG1vZHVsZSA9IGNvbmZpZy5tb2R1bGUgJiYgY29uZmlnLm1vZHVsZS50b0xvd2VyQ2FzZSgpLFxuXHQgICAgICAgIGZ1bGxOYW1lID0gdGhpcy5tb2R1bGUubmFtZSArIFwiOiBcIiArIHRoaXMudGVzdE5hbWU7XG5cblx0ICAgIGZ1bmN0aW9uIG1vZHVsZUNoYWluTmFtZU1hdGNoKHRlc3RNb2R1bGUpIHtcblx0ICAgICAgdmFyIHRlc3RNb2R1bGVOYW1lID0gdGVzdE1vZHVsZS5uYW1lID8gdGVzdE1vZHVsZS5uYW1lLnRvTG93ZXJDYXNlKCkgOiBudWxsO1xuXG5cdCAgICAgIGlmICh0ZXN0TW9kdWxlTmFtZSA9PT0gbW9kdWxlKSB7XG5cdCAgICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICAgIH0gZWxzZSBpZiAodGVzdE1vZHVsZS5wYXJlbnRNb2R1bGUpIHtcblx0ICAgICAgICByZXR1cm4gbW9kdWxlQ2hhaW5OYW1lTWF0Y2godGVzdE1vZHVsZS5wYXJlbnRNb2R1bGUpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBtb2R1bGVDaGFpbklkTWF0Y2godGVzdE1vZHVsZSkge1xuXHQgICAgICByZXR1cm4gaW5BcnJheSh0ZXN0TW9kdWxlLm1vZHVsZUlkLCBjb25maWcubW9kdWxlSWQpIHx8IHRlc3RNb2R1bGUucGFyZW50TW9kdWxlICYmIG1vZHVsZUNoYWluSWRNYXRjaCh0ZXN0TW9kdWxlLnBhcmVudE1vZHVsZSk7XG5cdCAgICB9IC8vIEludGVybmFsbHktZ2VuZXJhdGVkIHRlc3RzIGFyZSBhbHdheXMgdmFsaWRcblxuXG5cdCAgICBpZiAodGhpcy5jYWxsYmFjayAmJiB0aGlzLmNhbGxiYWNrLnZhbGlkVGVzdCkge1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGNvbmZpZy5tb2R1bGVJZCAmJiBjb25maWcubW9kdWxlSWQubGVuZ3RoID4gMCAmJiAhbW9kdWxlQ2hhaW5JZE1hdGNoKHRoaXMubW9kdWxlKSkge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjb25maWcudGVzdElkICYmIGNvbmZpZy50ZXN0SWQubGVuZ3RoID4gMCAmJiAhaW5BcnJheSh0aGlzLnRlc3RJZCwgY29uZmlnLnRlc3RJZCkpIHtcblx0ICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgfVxuXG5cdCAgICBpZiAobW9kdWxlICYmICFtb2R1bGVDaGFpbk5hbWVNYXRjaCh0aGlzLm1vZHVsZSkpIHtcblx0ICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoIWZpbHRlcikge1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHJlZ2V4RmlsdGVyID8gdGhpcy5yZWdleEZpbHRlcighIXJlZ2V4RmlsdGVyWzFdLCByZWdleEZpbHRlclsyXSwgcmVnZXhGaWx0ZXJbM10sIGZ1bGxOYW1lKSA6IHRoaXMuc3RyaW5nRmlsdGVyKGZpbHRlciwgZnVsbE5hbWUpO1xuXHQgIH0sXG5cdCAgcmVnZXhGaWx0ZXI6IGZ1bmN0aW9uIHJlZ2V4RmlsdGVyKGV4Y2x1ZGUsIHBhdHRlcm4sIGZsYWdzLCBmdWxsTmFtZSkge1xuXHQgICAgdmFyIHJlZ2V4ID0gbmV3IFJlZ0V4cChwYXR0ZXJuLCBmbGFncyk7XG5cdCAgICB2YXIgbWF0Y2ggPSByZWdleC50ZXN0KGZ1bGxOYW1lKTtcblx0ICAgIHJldHVybiBtYXRjaCAhPT0gZXhjbHVkZTtcblx0ICB9LFxuXHQgIHN0cmluZ0ZpbHRlcjogZnVuY3Rpb24gc3RyaW5nRmlsdGVyKGZpbHRlciwgZnVsbE5hbWUpIHtcblx0ICAgIGZpbHRlciA9IGZpbHRlci50b0xvd2VyQ2FzZSgpO1xuXHQgICAgZnVsbE5hbWUgPSBmdWxsTmFtZS50b0xvd2VyQ2FzZSgpO1xuXHQgICAgdmFyIGluY2x1ZGUgPSBmaWx0ZXIuY2hhckF0KDApICE9PSBcIiFcIjtcblxuXHQgICAgaWYgKCFpbmNsdWRlKSB7XG5cdCAgICAgIGZpbHRlciA9IGZpbHRlci5zbGljZSgxKTtcblx0ICAgIH0gLy8gSWYgdGhlIGZpbHRlciBtYXRjaGVzLCB3ZSBuZWVkIHRvIGhvbm91ciBpbmNsdWRlXG5cblxuXHQgICAgaWYgKGZ1bGxOYW1lLmluZGV4T2YoZmlsdGVyKSAhPT0gLTEpIHtcblx0ICAgICAgcmV0dXJuIGluY2x1ZGU7XG5cdCAgICB9IC8vIE90aGVyd2lzZSwgZG8gdGhlIG9wcG9zaXRlXG5cblxuXHQgICAgcmV0dXJuICFpbmNsdWRlO1xuXHQgIH1cblx0fTtcblx0ZnVuY3Rpb24gcHVzaEZhaWx1cmUoKSB7XG5cdCAgaWYgKCFjb25maWcuY3VycmVudCkge1xuXHQgICAgdGhyb3cgbmV3IEVycm9yKFwicHVzaEZhaWx1cmUoKSBhc3NlcnRpb24gb3V0c2lkZSB0ZXN0IGNvbnRleHQsIGluIFwiICsgc291cmNlRnJvbVN0YWNrdHJhY2UoMikpO1xuXHQgIH0gLy8gR2V0cyBjdXJyZW50IHRlc3Qgb2JqXG5cblxuXHQgIHZhciBjdXJyZW50VGVzdCA9IGNvbmZpZy5jdXJyZW50O1xuXHQgIHJldHVybiBjdXJyZW50VGVzdC5wdXNoRmFpbHVyZS5hcHBseShjdXJyZW50VGVzdCwgYXJndW1lbnRzKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNhdmVHbG9iYWwoKSB7XG5cdCAgY29uZmlnLnBvbGx1dGlvbiA9IFtdO1xuXG5cdCAgaWYgKGNvbmZpZy5ub2dsb2JhbHMpIHtcblx0ICAgIGZvciAodmFyIGtleSBpbiBnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXSkge1xuXHQgICAgICBpZiAoaGFzT3duLmNhbGwoZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10sIGtleSkpIHtcblx0ICAgICAgICAvLyBJbiBPcGVyYSBzb21ldGltZXMgRE9NIGVsZW1lbnQgaWRzIHNob3cgdXAgaGVyZSwgaWdub3JlIHRoZW1cblx0ICAgICAgICBpZiAoL15xdW5pdC10ZXN0LW91dHB1dC8udGVzdChrZXkpKSB7XG5cdCAgICAgICAgICBjb250aW51ZTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBjb25maWcucG9sbHV0aW9uLnB1c2goa2V5KTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIGNoZWNrUG9sbHV0aW9uKCkge1xuXHQgIHZhciBuZXdHbG9iYWxzLFxuXHQgICAgICBkZWxldGVkR2xvYmFscyxcblx0ICAgICAgb2xkID0gY29uZmlnLnBvbGx1dGlvbjtcblx0ICBzYXZlR2xvYmFsKCk7XG5cdCAgbmV3R2xvYmFscyA9IGRpZmYoY29uZmlnLnBvbGx1dGlvbiwgb2xkKTtcblxuXHQgIGlmIChuZXdHbG9iYWxzLmxlbmd0aCA+IDApIHtcblx0ICAgIHB1c2hGYWlsdXJlKFwiSW50cm9kdWNlZCBnbG9iYWwgdmFyaWFibGUocyk6IFwiICsgbmV3R2xvYmFscy5qb2luKFwiLCBcIikpO1xuXHQgIH1cblxuXHQgIGRlbGV0ZWRHbG9iYWxzID0gZGlmZihvbGQsIGNvbmZpZy5wb2xsdXRpb24pO1xuXG5cdCAgaWYgKGRlbGV0ZWRHbG9iYWxzLmxlbmd0aCA+IDApIHtcblx0ICAgIHB1c2hGYWlsdXJlKFwiRGVsZXRlZCBnbG9iYWwgdmFyaWFibGUocyk6IFwiICsgZGVsZXRlZEdsb2JhbHMuam9pbihcIiwgXCIpKTtcblx0ICB9XG5cdH0gLy8gV2lsbCBiZSBleHBvc2VkIGFzIFFVbml0LnRlc3RcblxuXG5cdGZ1bmN0aW9uIHRlc3QodGVzdE5hbWUsIGNhbGxiYWNrKSB7XG5cdCAgaWYgKGZvY3VzZWQkMSkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHZhciBuZXdUZXN0ID0gbmV3IFRlc3Qoe1xuXHQgICAgdGVzdE5hbWU6IHRlc3ROYW1lLFxuXHQgICAgY2FsbGJhY2s6IGNhbGxiYWNrXG5cdCAgfSk7XG5cdCAgbmV3VGVzdC5xdWV1ZSgpO1xuXHR9XG5cdGZ1bmN0aW9uIHRvZG8odGVzdE5hbWUsIGNhbGxiYWNrKSB7XG5cdCAgaWYgKGZvY3VzZWQkMSkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHZhciBuZXdUZXN0ID0gbmV3IFRlc3Qoe1xuXHQgICAgdGVzdE5hbWU6IHRlc3ROYW1lLFxuXHQgICAgY2FsbGJhY2s6IGNhbGxiYWNrLFxuXHQgICAgdG9kbzogdHJ1ZVxuXHQgIH0pO1xuXHQgIG5ld1Rlc3QucXVldWUoKTtcblx0fSAvLyBXaWxsIGJlIGV4cG9zZWQgYXMgUVVuaXQuc2tpcFxuXG5cdGZ1bmN0aW9uIHNraXAodGVzdE5hbWUpIHtcblx0ICBpZiAoZm9jdXNlZCQxKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgdmFyIHRlc3QgPSBuZXcgVGVzdCh7XG5cdCAgICB0ZXN0TmFtZTogdGVzdE5hbWUsXG5cdCAgICBza2lwOiB0cnVlXG5cdCAgfSk7XG5cdCAgdGVzdC5xdWV1ZSgpO1xuXHR9IC8vIFdpbGwgYmUgZXhwb3NlZCBhcyBRVW5pdC5vbmx5XG5cblx0ZnVuY3Rpb24gb25seSh0ZXN0TmFtZSwgY2FsbGJhY2spIHtcblx0ICBpZiAoIWZvY3VzZWQkMSkge1xuXHQgICAgY29uZmlnLnF1ZXVlLmxlbmd0aCA9IDA7XG5cdCAgICBmb2N1c2VkJDEgPSB0cnVlO1xuXHQgIH1cblxuXHQgIHZhciBuZXdUZXN0ID0gbmV3IFRlc3Qoe1xuXHQgICAgdGVzdE5hbWU6IHRlc3ROYW1lLFxuXHQgICAgY2FsbGJhY2s6IGNhbGxiYWNrXG5cdCAgfSk7XG5cdCAgbmV3VGVzdC5xdWV1ZSgpO1xuXHR9IC8vIFJlc2V0cyBjb25maWcudGltZW91dCB3aXRoIGEgbmV3IHRpbWVvdXQgZHVyYXRpb24uXG5cblx0ZnVuY3Rpb24gcmVzZXRUZXN0VGltZW91dCh0aW1lb3V0RHVyYXRpb24pIHtcblx0ICBjbGVhclRpbWVvdXQoY29uZmlnLnRpbWVvdXQpO1xuXHQgIGNvbmZpZy50aW1lb3V0ID0gc2V0VGltZW91dCQxKGNvbmZpZy50aW1lb3V0SGFuZGxlcih0aW1lb3V0RHVyYXRpb24pLCB0aW1lb3V0RHVyYXRpb24pO1xuXHR9IC8vIFB1dCBhIGhvbGQgb24gcHJvY2Vzc2luZyBhbmQgcmV0dXJuIGEgZnVuY3Rpb24gdGhhdCB3aWxsIHJlbGVhc2UgaXQuXG5cblx0ZnVuY3Rpb24gaW50ZXJuYWxTdG9wKHRlc3QpIHtcblx0ICB2YXIgcmVsZWFzZWQgPSBmYWxzZTtcblx0ICB0ZXN0LnNlbWFwaG9yZSArPSAxO1xuXHQgIGNvbmZpZy5ibG9ja2luZyA9IHRydWU7IC8vIFNldCBhIHJlY292ZXJ5IHRpbWVvdXQsIGlmIHNvIGNvbmZpZ3VyZWQuXG5cblx0ICBpZiAoZGVmaW5lZC5zZXRUaW1lb3V0KSB7XG5cdCAgICB2YXIgdGltZW91dER1cmF0aW9uO1xuXG5cdCAgICBpZiAodHlwZW9mIHRlc3QudGltZW91dCA9PT0gXCJudW1iZXJcIikge1xuXHQgICAgICB0aW1lb3V0RHVyYXRpb24gPSB0ZXN0LnRpbWVvdXQ7XG5cdCAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25maWcudGVzdFRpbWVvdXQgPT09IFwibnVtYmVyXCIpIHtcblx0ICAgICAgdGltZW91dER1cmF0aW9uID0gY29uZmlnLnRlc3RUaW1lb3V0O1xuXHQgICAgfVxuXG5cdCAgICBpZiAodHlwZW9mIHRpbWVvdXREdXJhdGlvbiA9PT0gXCJudW1iZXJcIiAmJiB0aW1lb3V0RHVyYXRpb24gPiAwKSB7XG5cdCAgICAgIGNsZWFyVGltZW91dChjb25maWcudGltZW91dCk7XG5cblx0ICAgICAgY29uZmlnLnRpbWVvdXRIYW5kbGVyID0gZnVuY3Rpb24gKHRpbWVvdXQpIHtcblx0ICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgcHVzaEZhaWx1cmUoXCJUZXN0IHRvb2sgbG9uZ2VyIHRoYW4gXCIuY29uY2F0KHRpbWVvdXQsIFwibXM7IHRlc3QgdGltZWQgb3V0LlwiKSwgc291cmNlRnJvbVN0YWNrdHJhY2UoMikpO1xuXHQgICAgICAgICAgcmVsZWFzZWQgPSB0cnVlO1xuXHQgICAgICAgICAgaW50ZXJuYWxSZWNvdmVyKHRlc3QpO1xuXHQgICAgICAgIH07XG5cdCAgICAgIH07XG5cblx0ICAgICAgY29uZmlnLnRpbWVvdXQgPSBzZXRUaW1lb3V0JDEoY29uZmlnLnRpbWVvdXRIYW5kbGVyKHRpbWVvdXREdXJhdGlvbiksIHRpbWVvdXREdXJhdGlvbik7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGZ1bmN0aW9uIHJlc3VtZSgpIHtcblx0ICAgIGlmIChyZWxlYXNlZCkge1xuXHQgICAgICByZXR1cm47XG5cdCAgICB9XG5cblx0ICAgIHJlbGVhc2VkID0gdHJ1ZTtcblx0ICAgIHRlc3Quc2VtYXBob3JlIC09IDE7XG5cdCAgICBpbnRlcm5hbFN0YXJ0KHRlc3QpO1xuXHQgIH07XG5cdH0gLy8gRm9yY2VmdWxseSByZWxlYXNlIGFsbCBwcm9jZXNzaW5nIGhvbGRzLlxuXG5cdGZ1bmN0aW9uIGludGVybmFsUmVjb3Zlcih0ZXN0KSB7XG5cdCAgdGVzdC5zZW1hcGhvcmUgPSAwO1xuXHQgIGludGVybmFsU3RhcnQodGVzdCk7XG5cdH0gLy8gUmVsZWFzZSBhIHByb2Nlc3NpbmcgaG9sZCwgc2NoZWR1bGluZyBhIHJlc3VtcHRpb24gYXR0ZW1wdCBpZiBubyBob2xkcyByZW1haW4uXG5cblxuXHRmdW5jdGlvbiBpbnRlcm5hbFN0YXJ0KHRlc3QpIHtcblx0ICAvLyBJZiBzZW1hcGhvcmUgaXMgbm9uLW51bWVyaWMsIHRocm93IGVycm9yXG5cdCAgaWYgKGlzTmFOKHRlc3Quc2VtYXBob3JlKSkge1xuXHQgICAgdGVzdC5zZW1hcGhvcmUgPSAwO1xuXHQgICAgcHVzaEZhaWx1cmUoXCJJbnZhbGlkIHZhbHVlIG9uIHRlc3Quc2VtYXBob3JlXCIsIHNvdXJjZUZyb21TdGFja3RyYWNlKDIpKTtcblx0ICAgIHJldHVybjtcblx0ICB9IC8vIERvbid0IHN0YXJ0IHVudGlsIGVxdWFsIG51bWJlciBvZiBzdG9wLWNhbGxzXG5cblxuXHQgIGlmICh0ZXN0LnNlbWFwaG9yZSA+IDApIHtcblx0ICAgIHJldHVybjtcblx0ICB9IC8vIFRocm93IGFuIEVycm9yIGlmIHN0YXJ0IGlzIGNhbGxlZCBtb3JlIG9mdGVuIHRoYW4gc3RvcFxuXG5cblx0ICBpZiAodGVzdC5zZW1hcGhvcmUgPCAwKSB7XG5cdCAgICB0ZXN0LnNlbWFwaG9yZSA9IDA7XG5cdCAgICBwdXNoRmFpbHVyZShcIlRyaWVkIHRvIHJlc3RhcnQgdGVzdCB3aGlsZSBhbHJlYWR5IHN0YXJ0ZWQgKHRlc3QncyBzZW1hcGhvcmUgd2FzIDAgYWxyZWFkeSlcIiwgc291cmNlRnJvbVN0YWNrdHJhY2UoMikpO1xuXHQgICAgcmV0dXJuO1xuXHQgIH0gLy8gQWRkIGEgc2xpZ2h0IGRlbGF5IHRvIGFsbG93IG1vcmUgYXNzZXJ0aW9ucyBldGMuXG5cblxuXHQgIGlmIChkZWZpbmVkLnNldFRpbWVvdXQpIHtcblx0ICAgIGlmIChjb25maWcudGltZW91dCkge1xuXHQgICAgICBjbGVhclRpbWVvdXQoY29uZmlnLnRpbWVvdXQpO1xuXHQgICAgfVxuXG5cdCAgICBjb25maWcudGltZW91dCA9IHNldFRpbWVvdXQkMShmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGlmICh0ZXN0LnNlbWFwaG9yZSA+IDApIHtcblx0ICAgICAgICByZXR1cm47XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAoY29uZmlnLnRpbWVvdXQpIHtcblx0ICAgICAgICBjbGVhclRpbWVvdXQoY29uZmlnLnRpbWVvdXQpO1xuXHQgICAgICB9XG5cblx0ICAgICAgYmVnaW4oKTtcblx0ICAgIH0pO1xuXHQgIH0gZWxzZSB7XG5cdCAgICBiZWdpbigpO1xuXHQgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIGNvbGxlY3RUZXN0cyhtb2R1bGUpIHtcblx0ICB2YXIgdGVzdHMgPSBbXS5jb25jYXQobW9kdWxlLnRlc3RzKTtcblxuXHQgIHZhciBtb2R1bGVzID0gX3RvQ29uc3VtYWJsZUFycmF5KG1vZHVsZS5jaGlsZE1vZHVsZXMpOyAvLyBEbyBhIGJyZWFkdGgtZmlyc3QgdHJhdmVyc2FsIG9mIHRoZSBjaGlsZCBtb2R1bGVzXG5cblxuXHQgIHdoaWxlIChtb2R1bGVzLmxlbmd0aCkge1xuXHQgICAgdmFyIG5leHRNb2R1bGUgPSBtb2R1bGVzLnNoaWZ0KCk7XG5cdCAgICB0ZXN0cy5wdXNoLmFwcGx5KHRlc3RzLCBuZXh0TW9kdWxlLnRlc3RzKTtcblx0ICAgIG1vZHVsZXMucHVzaC5hcHBseShtb2R1bGVzLCBfdG9Db25zdW1hYmxlQXJyYXkobmV4dE1vZHVsZS5jaGlsZE1vZHVsZXMpKTtcblx0ICB9XG5cblx0ICByZXR1cm4gdGVzdHM7XG5cdH1cblxuXHRmdW5jdGlvbiBudW1iZXJPZlRlc3RzKG1vZHVsZSkge1xuXHQgIHJldHVybiBjb2xsZWN0VGVzdHMobW9kdWxlKS5sZW5ndGg7XG5cdH1cblxuXHRmdW5jdGlvbiBudW1iZXJPZlVuc2tpcHBlZFRlc3RzKG1vZHVsZSkge1xuXHQgIHJldHVybiBjb2xsZWN0VGVzdHMobW9kdWxlKS5maWx0ZXIoZnVuY3Rpb24gKHRlc3QpIHtcblx0ICAgIHJldHVybiAhdGVzdC5za2lwO1xuXHQgIH0pLmxlbmd0aDtcblx0fVxuXG5cdGZ1bmN0aW9uIG5vdGlmeVRlc3RzUmFuKG1vZHVsZSwgc2tpcHBlZCkge1xuXHQgIG1vZHVsZS50ZXN0c1J1bisrO1xuXG5cdCAgaWYgKCFza2lwcGVkKSB7XG5cdCAgICBtb2R1bGUudW5za2lwcGVkVGVzdHNSdW4rKztcblx0ICB9XG5cblx0ICB3aGlsZSAobW9kdWxlID0gbW9kdWxlLnBhcmVudE1vZHVsZSkge1xuXHQgICAgbW9kdWxlLnRlc3RzUnVuKys7XG5cblx0ICAgIGlmICghc2tpcHBlZCkge1xuXHQgICAgICBtb2R1bGUudW5za2lwcGVkVGVzdHNSdW4rKztcblx0ICAgIH1cblx0ICB9XG5cdH1cblxuXHR2YXIgQXNzZXJ0ID0gLyojX19QVVJFX18qL2Z1bmN0aW9uICgpIHtcblx0ICBmdW5jdGlvbiBBc3NlcnQodGVzdENvbnRleHQpIHtcblx0ICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBBc3NlcnQpO1xuXG5cdCAgICB0aGlzLnRlc3QgPSB0ZXN0Q29udGV4dDtcblx0ICB9IC8vIEFzc2VydCBoZWxwZXJzXG5cblxuXHQgIF9jcmVhdGVDbGFzcyhBc3NlcnQsIFt7XG5cdCAgICBrZXk6IFwidGltZW91dFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHRpbWVvdXQoZHVyYXRpb24pIHtcblx0ICAgICAgaWYgKHR5cGVvZiBkdXJhdGlvbiAhPT0gXCJudW1iZXJcIikge1xuXHQgICAgICAgIHRocm93IG5ldyBFcnJvcihcIllvdSBtdXN0IHBhc3MgYSBudW1iZXIgYXMgdGhlIGR1cmF0aW9uIHRvIGFzc2VydC50aW1lb3V0XCIpO1xuXHQgICAgICB9XG5cblx0ICAgICAgdGhpcy50ZXN0LnRpbWVvdXQgPSBkdXJhdGlvbjsgLy8gSWYgYSB0aW1lb3V0IGhhcyBiZWVuIHNldCwgY2xlYXIgaXQgYW5kIHJlc2V0IHdpdGggdGhlIG5ldyBkdXJhdGlvblxuXG5cdCAgICAgIGlmIChjb25maWcudGltZW91dCkge1xuXHQgICAgICAgIGNsZWFyVGltZW91dChjb25maWcudGltZW91dCk7XG5cblx0ICAgICAgICBpZiAoY29uZmlnLnRpbWVvdXRIYW5kbGVyICYmIHRoaXMudGVzdC50aW1lb3V0ID4gMCkge1xuXHQgICAgICAgICAgcmVzZXRUZXN0VGltZW91dCh0aGlzLnRlc3QudGltZW91dCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9IC8vIERvY3VtZW50cyBhIFwic3RlcFwiLCB3aGljaCBpcyBhIHN0cmluZyB2YWx1ZSwgaW4gYSB0ZXN0IGFzIGEgcGFzc2luZyBhc3NlcnRpb25cblxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJzdGVwXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gc3RlcChtZXNzYWdlKSB7XG5cdCAgICAgIHZhciBhc3NlcnRpb25NZXNzYWdlID0gbWVzc2FnZTtcblx0ICAgICAgdmFyIHJlc3VsdCA9ICEhbWVzc2FnZTtcblx0ICAgICAgdGhpcy50ZXN0LnN0ZXBzLnB1c2gobWVzc2FnZSk7XG5cblx0ICAgICAgaWYgKG9iamVjdFR5cGUobWVzc2FnZSkgPT09IFwidW5kZWZpbmVkXCIgfHwgbWVzc2FnZSA9PT0gXCJcIikge1xuXHQgICAgICAgIGFzc2VydGlvbk1lc3NhZ2UgPSBcIllvdSBtdXN0IHByb3ZpZGUgYSBtZXNzYWdlIHRvIGFzc2VydC5zdGVwXCI7XG5cdCAgICAgIH0gZWxzZSBpZiAob2JqZWN0VHlwZShtZXNzYWdlKSAhPT0gXCJzdHJpbmdcIikge1xuXHQgICAgICAgIGFzc2VydGlvbk1lc3NhZ2UgPSBcIllvdSBtdXN0IHByb3ZpZGUgYSBzdHJpbmcgdmFsdWUgdG8gYXNzZXJ0LnN0ZXBcIjtcblx0ICAgICAgICByZXN1bHQgPSBmYWxzZTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiByZXN1bHQsXG5cdCAgICAgICAgbWVzc2FnZTogYXNzZXJ0aW9uTWVzc2FnZVxuXHQgICAgICB9KTtcblx0ICAgIH0gLy8gVmVyaWZpZXMgdGhlIHN0ZXBzIGluIGEgdGVzdCBtYXRjaCBhIGdpdmVuIGFycmF5IG9mIHN0cmluZyB2YWx1ZXNcblxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJ2ZXJpZnlTdGVwc1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHZlcmlmeVN0ZXBzKHN0ZXBzLCBtZXNzYWdlKSB7XG5cdCAgICAgIC8vIFNpbmNlIHRoZSBzdGVwcyBhcnJheSBpcyBqdXN0IHN0cmluZyB2YWx1ZXMsIHdlIGNhbiBjbG9uZSB3aXRoIHNsaWNlXG5cdCAgICAgIHZhciBhY3R1YWxTdGVwc0Nsb25lID0gdGhpcy50ZXN0LnN0ZXBzLnNsaWNlKCk7XG5cdCAgICAgIHRoaXMuZGVlcEVxdWFsKGFjdHVhbFN0ZXBzQ2xvbmUsIHN0ZXBzLCBtZXNzYWdlKTtcblx0ICAgICAgdGhpcy50ZXN0LnN0ZXBzLmxlbmd0aCA9IDA7XG5cdCAgICB9IC8vIFNwZWNpZnkgdGhlIG51bWJlciBvZiBleHBlY3RlZCBhc3NlcnRpb25zIHRvIGd1YXJhbnRlZSB0aGF0IGZhaWxlZCB0ZXN0XG5cdCAgICAvLyAobm8gYXNzZXJ0aW9ucyBhcmUgcnVuIGF0IGFsbCkgZG9uJ3Qgc2xpcCB0aHJvdWdoLlxuXG5cdCAgfSwge1xuXHQgICAga2V5OiBcImV4cGVjdFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGV4cGVjdChhc3NlcnRzKSB7XG5cdCAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG5cdCAgICAgICAgdGhpcy50ZXN0LmV4cGVjdGVkID0gYXNzZXJ0cztcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICByZXR1cm4gdGhpcy50ZXN0LmV4cGVjdGVkO1xuXHQgICAgICB9XG5cdCAgICB9IC8vIFB1dCBhIGhvbGQgb24gcHJvY2Vzc2luZyBhbmQgcmV0dXJuIGEgZnVuY3Rpb24gdGhhdCB3aWxsIHJlbGVhc2UgaXQgYSBtYXhpbXVtIG9mIG9uY2UuXG5cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiYXN5bmNcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBhc3luYyhjb3VudCkge1xuXHQgICAgICB2YXIgdGVzdCA9IHRoaXMudGVzdDtcblx0ICAgICAgdmFyIHBvcHBlZCA9IGZhbHNlLFxuXHQgICAgICAgICAgYWNjZXB0Q2FsbENvdW50ID0gY291bnQ7XG5cblx0ICAgICAgaWYgKHR5cGVvZiBhY2NlcHRDYWxsQ291bnQgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0ICAgICAgICBhY2NlcHRDYWxsQ291bnQgPSAxO1xuXHQgICAgICB9XG5cblx0ICAgICAgdmFyIHJlc3VtZSA9IGludGVybmFsU3RvcCh0ZXN0KTtcblx0ICAgICAgcmV0dXJuIGZ1bmN0aW9uIGRvbmUoKSB7XG5cdCAgICAgICAgaWYgKGNvbmZpZy5jdXJyZW50ICE9PSB0ZXN0KSB7XG5cdCAgICAgICAgICB0aHJvdyBFcnJvcihcImFzc2VydC5hc3luYyBjYWxsYmFjayBjYWxsZWQgYWZ0ZXIgdGVzdCBmaW5pc2hlZC5cIik7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaWYgKHBvcHBlZCkge1xuXHQgICAgICAgICAgdGVzdC5wdXNoRmFpbHVyZShcIlRvbyBtYW55IGNhbGxzIHRvIHRoZSBgYXNzZXJ0LmFzeW5jYCBjYWxsYmFja1wiLCBzb3VyY2VGcm9tU3RhY2t0cmFjZSgyKSk7XG5cdCAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgYWNjZXB0Q2FsbENvdW50IC09IDE7XG5cblx0ICAgICAgICBpZiAoYWNjZXB0Q2FsbENvdW50ID4gMCkge1xuXHQgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHBvcHBlZCA9IHRydWU7XG5cdCAgICAgICAgcmVzdW1lKCk7XG5cdCAgICAgIH07XG5cdCAgICB9IC8vIEV4cG9ydHMgdGVzdC5wdXNoKCkgdG8gdGhlIHVzZXIgQVBJXG5cdCAgICAvLyBBbGlhcyBvZiBwdXNoUmVzdWx0LlxuXG5cdCAgfSwge1xuXHQgICAga2V5OiBcInB1c2hcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBwdXNoKHJlc3VsdCwgYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgbmVnYXRpdmUpIHtcblx0ICAgICAgTG9nZ2VyLndhcm4oXCJhc3NlcnQucHVzaCBpcyBkZXByZWNhdGVkIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gUVVuaXQgMy4wLlwiICsgXCIgUGxlYXNlIHVzZSBhc3NlcnQucHVzaFJlc3VsdCBpbnN0ZWFkIChodHRwczovL2FwaS5xdW5pdGpzLmNvbS9hc3NlcnQvcHVzaFJlc3VsdCkuXCIpO1xuXHQgICAgICB2YXIgY3VycmVudEFzc2VydCA9IHRoaXMgaW5zdGFuY2VvZiBBc3NlcnQgPyB0aGlzIDogY29uZmlnLmN1cnJlbnQuYXNzZXJ0O1xuXHQgICAgICByZXR1cm4gY3VycmVudEFzc2VydC5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6IHJlc3VsdCxcblx0ICAgICAgICBhY3R1YWw6IGFjdHVhbCxcblx0ICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcblx0ICAgICAgICBuZWdhdGl2ZTogbmVnYXRpdmVcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcInB1c2hSZXN1bHRcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBwdXNoUmVzdWx0KHJlc3VsdEluZm8pIHtcblx0ICAgICAgLy8gRGVzdHJ1Y3R1cmUgb2YgcmVzdWx0SW5mbyA9IHsgcmVzdWx0LCBhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCBuZWdhdGl2ZSB9XG5cdCAgICAgIHZhciBhc3NlcnQgPSB0aGlzO1xuXHQgICAgICB2YXIgY3VycmVudFRlc3QgPSBhc3NlcnQgaW5zdGFuY2VvZiBBc3NlcnQgJiYgYXNzZXJ0LnRlc3QgfHwgY29uZmlnLmN1cnJlbnQ7IC8vIEJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IGZpeC5cblx0ICAgICAgLy8gQWxsb3dzIHRoZSBkaXJlY3QgdXNlIG9mIGdsb2JhbCBleHBvcnRlZCBhc3NlcnRpb25zIGFuZCBRVW5pdC5hc3NlcnQuKlxuXHQgICAgICAvLyBBbHRob3VnaCwgaXQncyB1c2UgaXMgbm90IHJlY29tbWVuZGVkIGFzIGl0IGNhbiBsZWFrIGFzc2VydGlvbnNcblx0ICAgICAgLy8gdG8gb3RoZXIgdGVzdHMgZnJvbSBhc3luYyB0ZXN0cywgYmVjYXVzZSB3ZSBvbmx5IGdldCBhIHJlZmVyZW5jZSB0byB0aGUgY3VycmVudCB0ZXN0LFxuXHQgICAgICAvLyBub3QgZXhhY3RseSB0aGUgdGVzdCB3aGVyZSBhc3NlcnRpb24gd2VyZSBpbnRlbmRlZCB0byBiZSBjYWxsZWQuXG5cblx0ICAgICAgaWYgKCFjdXJyZW50VGVzdCkge1xuXHQgICAgICAgIHRocm93IG5ldyBFcnJvcihcImFzc2VydGlvbiBvdXRzaWRlIHRlc3QgY29udGV4dCwgaW4gXCIgKyBzb3VyY2VGcm9tU3RhY2t0cmFjZSgyKSk7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAoIShhc3NlcnQgaW5zdGFuY2VvZiBBc3NlcnQpKSB7XG5cdCAgICAgICAgYXNzZXJ0ID0gY3VycmVudFRlc3QuYXNzZXJ0O1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIGFzc2VydC50ZXN0LnB1c2hSZXN1bHQocmVzdWx0SW5mbyk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcIm9rXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gb2socmVzdWx0LCBtZXNzYWdlKSB7XG5cdCAgICAgIGlmICghbWVzc2FnZSkge1xuXHQgICAgICAgIG1lc3NhZ2UgPSByZXN1bHQgPyBcIm9rYXlcIiA6IFwiZmFpbGVkLCBleHBlY3RlZCBhcmd1bWVudCB0byBiZSB0cnV0aHksIHdhczogXCIuY29uY2F0KGR1bXAucGFyc2UocmVzdWx0KSk7XG5cdCAgICAgIH1cblxuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogISFyZXN1bHQsXG5cdCAgICAgICAgYWN0dWFsOiByZXN1bHQsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IHRydWUsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwibm90T2tcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBub3RPayhyZXN1bHQsIG1lc3NhZ2UpIHtcblx0ICAgICAgaWYgKCFtZXNzYWdlKSB7XG5cdCAgICAgICAgbWVzc2FnZSA9ICFyZXN1bHQgPyBcIm9rYXlcIiA6IFwiZmFpbGVkLCBleHBlY3RlZCBhcmd1bWVudCB0byBiZSBmYWxzeSwgd2FzOiBcIi5jb25jYXQoZHVtcC5wYXJzZShyZXN1bHQpKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiAhcmVzdWx0LFxuXHQgICAgICAgIGFjdHVhbDogcmVzdWx0LFxuXHQgICAgICAgIGV4cGVjdGVkOiBmYWxzZSxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJ0cnVlXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gX3RydWUocmVzdWx0LCBtZXNzYWdlKSB7XG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiByZXN1bHQgPT09IHRydWUsXG5cdCAgICAgICAgYWN0dWFsOiByZXN1bHQsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IHRydWUsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZmFsc2VcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBfZmFsc2UocmVzdWx0LCBtZXNzYWdlKSB7XG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiByZXN1bHQgPT09IGZhbHNlLFxuXHQgICAgICAgIGFjdHVhbDogcmVzdWx0LFxuXHQgICAgICAgIGV4cGVjdGVkOiBmYWxzZSxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJlcXVhbFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcblx0ICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGVxZXFlcVxuXHQgICAgICB2YXIgcmVzdWx0ID0gZXhwZWN0ZWQgPT0gYWN0dWFsO1xuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogcmVzdWx0LFxuXHQgICAgICAgIGFjdHVhbDogYWN0dWFsLFxuXHQgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJub3RFcXVhbFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIG5vdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcblx0ICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGVxZXFlcVxuXHQgICAgICB2YXIgcmVzdWx0ID0gZXhwZWN0ZWQgIT0gYWN0dWFsO1xuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogcmVzdWx0LFxuXHQgICAgICAgIGFjdHVhbDogYWN0dWFsLFxuXHQgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuXHQgICAgICAgIG5lZ2F0aXZlOiB0cnVlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJwcm9wRXF1YWxcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBwcm9wRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuXHQgICAgICBhY3R1YWwgPSBvYmplY3RWYWx1ZXMoYWN0dWFsKTtcblx0ICAgICAgZXhwZWN0ZWQgPSBvYmplY3RWYWx1ZXMoZXhwZWN0ZWQpO1xuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogZXF1aXYoYWN0dWFsLCBleHBlY3RlZCksXG5cdCAgICAgICAgYWN0dWFsOiBhY3R1YWwsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2Vcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcIm5vdFByb3BFcXVhbFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIG5vdFByb3BFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG5cdCAgICAgIGFjdHVhbCA9IG9iamVjdFZhbHVlcyhhY3R1YWwpO1xuXHQgICAgICBleHBlY3RlZCA9IG9iamVjdFZhbHVlcyhleHBlY3RlZCk7XG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiAhZXF1aXYoYWN0dWFsLCBleHBlY3RlZCksXG5cdCAgICAgICAgYWN0dWFsOiBhY3R1YWwsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG5cdCAgICAgICAgbmVnYXRpdmU6IHRydWVcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImRlZXBFcXVhbFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGRlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiBlcXVpdihhY3R1YWwsIGV4cGVjdGVkKSxcblx0ICAgICAgICBhY3R1YWw6IGFjdHVhbCxcblx0ICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwibm90RGVlcEVxdWFsXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gbm90RGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6ICFlcXVpdihhY3R1YWwsIGV4cGVjdGVkKSxcblx0ICAgICAgICBhY3R1YWw6IGFjdHVhbCxcblx0ICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcblx0ICAgICAgICBuZWdhdGl2ZTogdHJ1ZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwic3RyaWN0RXF1YWxcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBzdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiBleHBlY3RlZCA9PT0gYWN0dWFsLFxuXHQgICAgICAgIGFjdHVhbDogYWN0dWFsLFxuXHQgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJub3RTdHJpY3RFcXVhbFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIG5vdFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6IGV4cGVjdGVkICE9PSBhY3R1YWwsXG5cdCAgICAgICAgYWN0dWFsOiBhY3R1YWwsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG5cdCAgICAgICAgbmVnYXRpdmU6IHRydWVcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcInRocm93c1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHRocm93cyhibG9jaywgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcblx0ICAgICAgdmFyIGFjdHVhbCxcblx0ICAgICAgICAgIHJlc3VsdCA9IGZhbHNlO1xuXHQgICAgICB2YXIgY3VycmVudFRlc3QgPSB0aGlzIGluc3RhbmNlb2YgQXNzZXJ0ICYmIHRoaXMudGVzdCB8fCBjb25maWcuY3VycmVudDsgLy8gJ2V4cGVjdGVkJyBpcyBvcHRpb25hbCB1bmxlc3MgZG9pbmcgc3RyaW5nIGNvbXBhcmlzb25cblxuXHQgICAgICBpZiAob2JqZWN0VHlwZShleHBlY3RlZCkgPT09IFwic3RyaW5nXCIpIHtcblx0ICAgICAgICBpZiAobWVzc2FnZSA9PSBudWxsKSB7XG5cdCAgICAgICAgICBtZXNzYWdlID0gZXhwZWN0ZWQ7XG5cdCAgICAgICAgICBleHBlY3RlZCA9IG51bGw7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInRocm93cy9yYWlzZXMgZG9lcyBub3QgYWNjZXB0IGEgc3RyaW5nIHZhbHVlIGZvciB0aGUgZXhwZWN0ZWQgYXJndW1lbnQuXFxuXCIgKyBcIlVzZSBhIG5vbi1zdHJpbmcgb2JqZWN0IHZhbHVlIChlLmcuIHJlZ0V4cCkgaW5zdGVhZCBpZiBpdCdzIG5lY2Vzc2FyeS5cIik7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgY3VycmVudFRlc3QuaWdub3JlR2xvYmFsRXJyb3JzID0gdHJ1ZTtcblxuXHQgICAgICB0cnkge1xuXHQgICAgICAgIGJsb2NrLmNhbGwoY3VycmVudFRlc3QudGVzdEVudmlyb25tZW50KTtcblx0ICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgIGFjdHVhbCA9IGU7XG5cdCAgICAgIH1cblxuXHQgICAgICBjdXJyZW50VGVzdC5pZ25vcmVHbG9iYWxFcnJvcnMgPSBmYWxzZTtcblxuXHQgICAgICBpZiAoYWN0dWFsKSB7XG5cdCAgICAgICAgdmFyIGV4cGVjdGVkVHlwZSA9IG9iamVjdFR5cGUoZXhwZWN0ZWQpOyAvLyBXZSBkb24ndCB3YW50IHRvIHZhbGlkYXRlIHRocm93biBlcnJvclxuXG5cdCAgICAgICAgaWYgKCFleHBlY3RlZCkge1xuXHQgICAgICAgICAgcmVzdWx0ID0gdHJ1ZTsgLy8gRXhwZWN0ZWQgaXMgYSByZWdleHBcblx0ICAgICAgICB9IGVsc2UgaWYgKGV4cGVjdGVkVHlwZSA9PT0gXCJyZWdleHBcIikge1xuXHQgICAgICAgICAgcmVzdWx0ID0gZXhwZWN0ZWQudGVzdChlcnJvclN0cmluZyhhY3R1YWwpKTsgLy8gTG9nIHRoZSBzdHJpbmcgZm9ybSBvZiB0aGUgcmVnZXhwXG5cblx0ICAgICAgICAgIGV4cGVjdGVkID0gU3RyaW5nKGV4cGVjdGVkKTsgLy8gRXhwZWN0ZWQgaXMgYSBjb25zdHJ1Y3RvciwgbWF5YmUgYW4gRXJyb3IgY29uc3RydWN0b3Jcblx0ICAgICAgICB9IGVsc2UgaWYgKGV4cGVjdGVkVHlwZSA9PT0gXCJmdW5jdGlvblwiICYmIGFjdHVhbCBpbnN0YW5jZW9mIGV4cGVjdGVkKSB7XG5cdCAgICAgICAgICByZXN1bHQgPSB0cnVlOyAvLyBFeHBlY3RlZCBpcyBhbiBFcnJvciBvYmplY3Rcblx0ICAgICAgICB9IGVsc2UgaWYgKGV4cGVjdGVkVHlwZSA9PT0gXCJvYmplY3RcIikge1xuXHQgICAgICAgICAgcmVzdWx0ID0gYWN0dWFsIGluc3RhbmNlb2YgZXhwZWN0ZWQuY29uc3RydWN0b3IgJiYgYWN0dWFsLm5hbWUgPT09IGV4cGVjdGVkLm5hbWUgJiYgYWN0dWFsLm1lc3NhZ2UgPT09IGV4cGVjdGVkLm1lc3NhZ2U7IC8vIExvZyB0aGUgc3RyaW5nIGZvcm0gb2YgdGhlIEVycm9yIG9iamVjdFxuXG5cdCAgICAgICAgICBleHBlY3RlZCA9IGVycm9yU3RyaW5nKGV4cGVjdGVkKTsgLy8gRXhwZWN0ZWQgaXMgYSB2YWxpZGF0aW9uIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgdHJ1ZSBpZiB2YWxpZGF0aW9uIHBhc3NlZFxuXHQgICAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWRUeXBlID09PSBcImZ1bmN0aW9uXCIgJiYgZXhwZWN0ZWQuY2FsbCh7fSwgYWN0dWFsKSA9PT0gdHJ1ZSkge1xuXHQgICAgICAgICAgZXhwZWN0ZWQgPSBudWxsO1xuXHQgICAgICAgICAgcmVzdWx0ID0gdHJ1ZTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBjdXJyZW50VGVzdC5hc3NlcnQucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiByZXN1bHQsXG5cdCAgICAgICAgLy8gdW5kZWZpbmVkIGlmIGl0IGRpZG4ndCB0aHJvd1xuXHQgICAgICAgIGFjdHVhbDogYWN0dWFsICYmIGVycm9yU3RyaW5nKGFjdHVhbCksXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2Vcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcInJlamVjdHNcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiByZWplY3RzKHByb21pc2UsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG5cdCAgICAgIHZhciByZXN1bHQgPSBmYWxzZTtcblx0ICAgICAgdmFyIGN1cnJlbnRUZXN0ID0gdGhpcyBpbnN0YW5jZW9mIEFzc2VydCAmJiB0aGlzLnRlc3QgfHwgY29uZmlnLmN1cnJlbnQ7IC8vICdleHBlY3RlZCcgaXMgb3B0aW9uYWwgdW5sZXNzIGRvaW5nIHN0cmluZyBjb21wYXJpc29uXG5cblx0ICAgICAgaWYgKG9iamVjdFR5cGUoZXhwZWN0ZWQpID09PSBcInN0cmluZ1wiKSB7XG5cdCAgICAgICAgaWYgKG1lc3NhZ2UgPT09IHVuZGVmaW5lZCkge1xuXHQgICAgICAgICAgbWVzc2FnZSA9IGV4cGVjdGVkO1xuXHQgICAgICAgICAgZXhwZWN0ZWQgPSB1bmRlZmluZWQ7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIG1lc3NhZ2UgPSBcImFzc2VydC5yZWplY3RzIGRvZXMgbm90IGFjY2VwdCBhIHN0cmluZyB2YWx1ZSBmb3IgdGhlIGV4cGVjdGVkIFwiICsgXCJhcmd1bWVudC5cXG5Vc2UgYSBub24tc3RyaW5nIG9iamVjdCB2YWx1ZSAoZS5nLiB2YWxpZGF0b3IgZnVuY3Rpb24pIGluc3RlYWQgXCIgKyBcImlmIG5lY2Vzc2FyeS5cIjtcblx0ICAgICAgICAgIGN1cnJlbnRUZXN0LmFzc2VydC5wdXNoUmVzdWx0KHtcblx0ICAgICAgICAgICAgcmVzdWx0OiBmYWxzZSxcblx0ICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuXHQgICAgICAgICAgfSk7XG5cdCAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgdmFyIHRoZW4gPSBwcm9taXNlICYmIHByb21pc2UudGhlbjtcblxuXHQgICAgICBpZiAob2JqZWN0VHlwZSh0aGVuKSAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdCAgICAgICAgdmFyIF9tZXNzYWdlID0gXCJUaGUgdmFsdWUgcHJvdmlkZWQgdG8gYGFzc2VydC5yZWplY3RzYCBpbiBcIiArIFwiXFxcIlwiICsgY3VycmVudFRlc3QudGVzdE5hbWUgKyBcIlxcXCIgd2FzIG5vdCBhIHByb21pc2UuXCI7XG5cblx0ICAgICAgICBjdXJyZW50VGVzdC5hc3NlcnQucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgICByZXN1bHQ6IGZhbHNlLFxuXHQgICAgICAgICAgbWVzc2FnZTogX21lc3NhZ2UsXG5cdCAgICAgICAgICBhY3R1YWw6IHByb21pc2Vcblx0ICAgICAgICB9KTtcblx0ICAgICAgICByZXR1cm47XG5cdCAgICAgIH1cblxuXHQgICAgICB2YXIgZG9uZSA9IHRoaXMuYXN5bmMoKTtcblx0ICAgICAgcmV0dXJuIHRoZW4uY2FsbChwcm9taXNlLCBmdW5jdGlvbiBoYW5kbGVGdWxmaWxsbWVudCgpIHtcblx0ICAgICAgICB2YXIgbWVzc2FnZSA9IFwiVGhlIHByb21pc2UgcmV0dXJuZWQgYnkgdGhlIGBhc3NlcnQucmVqZWN0c2AgY2FsbGJhY2sgaW4gXCIgKyBcIlxcXCJcIiArIGN1cnJlbnRUZXN0LnRlc3ROYW1lICsgXCJcXFwiIGRpZCBub3QgcmVqZWN0LlwiO1xuXHQgICAgICAgIGN1cnJlbnRUZXN0LmFzc2VydC5wdXNoUmVzdWx0KHtcblx0ICAgICAgICAgIHJlc3VsdDogZmFsc2UsXG5cdCAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuXHQgICAgICAgICAgYWN0dWFsOiBwcm9taXNlXG5cdCAgICAgICAgfSk7XG5cdCAgICAgICAgZG9uZSgpO1xuXHQgICAgICB9LCBmdW5jdGlvbiBoYW5kbGVSZWplY3Rpb24oYWN0dWFsKSB7XG5cdCAgICAgICAgdmFyIGV4cGVjdGVkVHlwZSA9IG9iamVjdFR5cGUoZXhwZWN0ZWQpOyAvLyBXZSBkb24ndCB3YW50IHRvIHZhbGlkYXRlXG5cblx0ICAgICAgICBpZiAoZXhwZWN0ZWQgPT09IHVuZGVmaW5lZCkge1xuXHQgICAgICAgICAgcmVzdWx0ID0gdHJ1ZTsgLy8gRXhwZWN0ZWQgaXMgYSByZWdleHBcblx0ICAgICAgICB9IGVsc2UgaWYgKGV4cGVjdGVkVHlwZSA9PT0gXCJyZWdleHBcIikge1xuXHQgICAgICAgICAgcmVzdWx0ID0gZXhwZWN0ZWQudGVzdChlcnJvclN0cmluZyhhY3R1YWwpKTsgLy8gTG9nIHRoZSBzdHJpbmcgZm9ybSBvZiB0aGUgcmVnZXhwXG5cblx0ICAgICAgICAgIGV4cGVjdGVkID0gU3RyaW5nKGV4cGVjdGVkKTsgLy8gRXhwZWN0ZWQgaXMgYSBjb25zdHJ1Y3RvciwgbWF5YmUgYW4gRXJyb3IgY29uc3RydWN0b3Jcblx0ICAgICAgICB9IGVsc2UgaWYgKGV4cGVjdGVkVHlwZSA9PT0gXCJmdW5jdGlvblwiICYmIGFjdHVhbCBpbnN0YW5jZW9mIGV4cGVjdGVkKSB7XG5cdCAgICAgICAgICByZXN1bHQgPSB0cnVlOyAvLyBFeHBlY3RlZCBpcyBhbiBFcnJvciBvYmplY3Rcblx0ICAgICAgICB9IGVsc2UgaWYgKGV4cGVjdGVkVHlwZSA9PT0gXCJvYmplY3RcIikge1xuXHQgICAgICAgICAgcmVzdWx0ID0gYWN0dWFsIGluc3RhbmNlb2YgZXhwZWN0ZWQuY29uc3RydWN0b3IgJiYgYWN0dWFsLm5hbWUgPT09IGV4cGVjdGVkLm5hbWUgJiYgYWN0dWFsLm1lc3NhZ2UgPT09IGV4cGVjdGVkLm1lc3NhZ2U7IC8vIExvZyB0aGUgc3RyaW5nIGZvcm0gb2YgdGhlIEVycm9yIG9iamVjdFxuXG5cdCAgICAgICAgICBleHBlY3RlZCA9IGVycm9yU3RyaW5nKGV4cGVjdGVkKTsgLy8gRXhwZWN0ZWQgaXMgYSB2YWxpZGF0aW9uIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgdHJ1ZSBpZiB2YWxpZGF0aW9uIHBhc3NlZFxuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBpZiAoZXhwZWN0ZWRUeXBlID09PSBcImZ1bmN0aW9uXCIpIHtcblx0ICAgICAgICAgICAgcmVzdWx0ID0gZXhwZWN0ZWQuY2FsbCh7fSwgYWN0dWFsKSA9PT0gdHJ1ZTtcblx0ICAgICAgICAgICAgZXhwZWN0ZWQgPSBudWxsOyAvLyBFeHBlY3RlZCBpcyBzb21lIG90aGVyIGludmFsaWQgdHlwZVxuXHQgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG5cdCAgICAgICAgICAgIG1lc3NhZ2UgPSBcImludmFsaWQgZXhwZWN0ZWQgdmFsdWUgcHJvdmlkZWQgdG8gYGFzc2VydC5yZWplY3RzYCBcIiArIFwiY2FsbGJhY2sgaW4gXFxcIlwiICsgY3VycmVudFRlc3QudGVzdE5hbWUgKyBcIlxcXCI6IFwiICsgZXhwZWN0ZWRUeXBlICsgXCIuXCI7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgY3VycmVudFRlc3QuYXNzZXJ0LnB1c2hSZXN1bHQoe1xuXHQgICAgICAgICAgcmVzdWx0OiByZXN1bHQsXG5cdCAgICAgICAgICAvLyBsZWF2ZSByZWplY3Rpb24gdmFsdWUgb2YgdW5kZWZpbmVkIGFzLWlzXG5cdCAgICAgICAgICBhY3R1YWw6IGFjdHVhbCAmJiBlcnJvclN0cmluZyhhY3R1YWwpLFxuXHQgICAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuXHQgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuXHQgICAgICAgIH0pO1xuXHQgICAgICAgIGRvbmUoKTtcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfV0pO1xuXG5cdCAgcmV0dXJuIEFzc2VydDtcblx0fSgpOyAvLyBQcm92aWRlIGFuIGFsdGVybmF0aXZlIHRvIGFzc2VydC50aHJvd3MoKSwgZm9yIGVudmlyb25tZW50cyB0aGF0IGNvbnNpZGVyIHRocm93cyBhIHJlc2VydmVkIHdvcmRcblx0Ly8gS25vd24gdG8gdXMgYXJlOiBDbG9zdXJlIENvbXBpbGVyLCBOYXJ3aGFsXG5cdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBkb3Qtbm90YXRpb25cblxuXG5cdEFzc2VydC5wcm90b3R5cGUucmFpc2VzID0gQXNzZXJ0LnByb3RvdHlwZVtcInRocm93c1wiXTtcblx0LyoqXG5cdCAqIENvbnZlcnRzIGFuIGVycm9yIGludG8gYSBzaW1wbGUgc3RyaW5nIGZvciBjb21wYXJpc29ucy5cblx0ICpcblx0ICogQHBhcmFtIHtFcnJvcnxPYmplY3R9IGVycm9yXG5cdCAqIEByZXR1cm4ge1N0cmluZ31cblx0ICovXG5cblx0ZnVuY3Rpb24gZXJyb3JTdHJpbmcoZXJyb3IpIHtcblx0ICB2YXIgcmVzdWx0RXJyb3JTdHJpbmcgPSBlcnJvci50b1N0cmluZygpOyAvLyBJZiB0aGUgZXJyb3Igd2Fzbid0IGEgc3ViY2xhc3Mgb2YgRXJyb3IgYnV0IHNvbWV0aGluZyBsaWtlXG5cdCAgLy8gYW4gb2JqZWN0IGxpdGVyYWwgd2l0aCBuYW1lIGFuZCBtZXNzYWdlIHByb3BlcnRpZXMuLi5cblxuXHQgIGlmIChyZXN1bHRFcnJvclN0cmluZy5zdWJzdHJpbmcoMCwgNykgPT09IFwiW29iamVjdFwiKSB7XG5cdCAgICB2YXIgbmFtZSA9IGVycm9yLm5hbWUgPyBlcnJvci5uYW1lLnRvU3RyaW5nKCkgOiBcIkVycm9yXCI7XG5cdCAgICB2YXIgbWVzc2FnZSA9IGVycm9yLm1lc3NhZ2UgPyBlcnJvci5tZXNzYWdlLnRvU3RyaW5nKCkgOiBcIlwiO1xuXG5cdCAgICBpZiAobmFtZSAmJiBtZXNzYWdlKSB7XG5cdCAgICAgIHJldHVybiBcIlwiLmNvbmNhdChuYW1lLCBcIjogXCIpLmNvbmNhdChtZXNzYWdlKTtcblx0ICAgIH0gZWxzZSBpZiAobmFtZSkge1xuXHQgICAgICByZXR1cm4gbmFtZTtcblx0ICAgIH0gZWxzZSBpZiAobWVzc2FnZSkge1xuXHQgICAgICByZXR1cm4gbWVzc2FnZTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHJldHVybiBcIkVycm9yXCI7XG5cdCAgICB9XG5cdCAgfSBlbHNlIHtcblx0ICAgIHJldHVybiByZXN1bHRFcnJvclN0cmluZztcblx0ICB9XG5cdH1cblxuXHQvKiBnbG9iYWwgbW9kdWxlLCBleHBvcnRzLCBkZWZpbmUgKi9cblx0ZnVuY3Rpb24gZXhwb3J0UVVuaXQoUVVuaXQpIHtcblx0ICBpZiAoZGVmaW5lZC5kb2N1bWVudCkge1xuXHQgICAgLy8gUVVuaXQgbWF5IGJlIGRlZmluZWQgd2hlbiBpdCBpcyBwcmVjb25maWd1cmVkIGJ1dCB0aGVuIG9ubHkgUVVuaXQgYW5kIFFVbml0LmNvbmZpZyBtYXkgYmUgZGVmaW5lZC5cblx0ICAgIGlmICh3aW5kb3ckMS5RVW5pdCAmJiB3aW5kb3ckMS5RVW5pdC52ZXJzaW9uKSB7XG5cdCAgICAgIHRocm93IG5ldyBFcnJvcihcIlFVbml0IGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZC5cIik7XG5cdCAgICB9XG5cblx0ICAgIHdpbmRvdyQxLlFVbml0ID0gUVVuaXQ7XG5cdCAgfSAvLyBGb3Igbm9kZWpzXG5cblxuXHQgIGlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZSAmJiBtb2R1bGUuZXhwb3J0cykge1xuXHQgICAgbW9kdWxlLmV4cG9ydHMgPSBRVW5pdDsgLy8gRm9yIGNvbnNpc3RlbmN5IHdpdGggQ29tbW9uSlMgZW52aXJvbm1lbnRzJyBleHBvcnRzXG5cblx0ICAgIG1vZHVsZS5leHBvcnRzLlFVbml0ID0gUVVuaXQ7XG5cdCAgfSAvLyBGb3IgQ29tbW9uSlMgd2l0aCBleHBvcnRzLCBidXQgd2l0aG91dCBtb2R1bGUuZXhwb3J0cywgbGlrZSBSaGlub1xuXG5cblx0ICBpZiAodHlwZW9mIGV4cG9ydHMgIT09IFwidW5kZWZpbmVkXCIgJiYgZXhwb3J0cykge1xuXHQgICAgZXhwb3J0cy5RVW5pdCA9IFFVbml0O1xuXHQgIH1cblxuXHQgIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkge1xuXHQgICAgZGVmaW5lKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgcmV0dXJuIFFVbml0O1xuXHQgICAgfSk7XG5cdCAgICBRVW5pdC5jb25maWcuYXV0b3N0YXJ0ID0gZmFsc2U7XG5cdCAgfSAvLyBGb3IgV2ViL1NlcnZpY2UgV29ya2Vyc1xuXG5cblx0ICBpZiAoc2VsZiQxICYmIHNlbGYkMS5Xb3JrZXJHbG9iYWxTY29wZSAmJiBzZWxmJDEgaW5zdGFuY2VvZiBzZWxmJDEuV29ya2VyR2xvYmFsU2NvcGUpIHtcblx0ICAgIHNlbGYkMS5RVW5pdCA9IFFVbml0O1xuXHQgIH1cblx0fVxuXG5cdC8vIGVycm9yIGhhbmRsaW5nIHNob3VsZCBiZSBzdXBwcmVzc2VkIGFuZCBmYWxzZSBvdGhlcndpc2UuXG5cdC8vIEluIHRoaXMgY2FzZSwgd2Ugd2lsbCBvbmx5IHN1cHByZXNzIGZ1cnRoZXIgZXJyb3IgaGFuZGxpbmcgaWYgdGhlXG5cdC8vIFwiaWdub3JlR2xvYmFsRXJyb3JzXCIgY29uZmlndXJhdGlvbiBvcHRpb24gaXMgZW5hYmxlZC5cblxuXHRmdW5jdGlvbiBvbkVycm9yKGVycm9yKSB7XG5cdCAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBuZXcgQXJyYXkoX2xlbiA+IDEgPyBfbGVuIC0gMSA6IDApLCBfa2V5ID0gMTsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuXHQgICAgYXJnc1tfa2V5IC0gMV0gPSBhcmd1bWVudHNbX2tleV07XG5cdCAgfVxuXG5cdCAgaWYgKGNvbmZpZy5jdXJyZW50KSB7XG5cdCAgICBpZiAoY29uZmlnLmN1cnJlbnQuaWdub3JlR2xvYmFsRXJyb3JzKSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfVxuXG5cdCAgICBwdXNoRmFpbHVyZS5hcHBseSh2b2lkIDAsIFtlcnJvci5tZXNzYWdlLCBlcnJvci5zdGFja3RyYWNlIHx8IGVycm9yLmZpbGVOYW1lICsgXCI6XCIgKyBlcnJvci5saW5lTnVtYmVyXS5jb25jYXQoYXJncykpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICB0ZXN0KFwiZ2xvYmFsIGZhaWx1cmVcIiwgZXh0ZW5kKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgcHVzaEZhaWx1cmUuYXBwbHkodm9pZCAwLCBbZXJyb3IubWVzc2FnZSwgZXJyb3Iuc3RhY2t0cmFjZSB8fCBlcnJvci5maWxlTmFtZSArIFwiOlwiICsgZXJyb3IubGluZU51bWJlcl0uY29uY2F0KGFyZ3MpKTtcblx0ICAgIH0sIHtcblx0ICAgICAgdmFsaWRUZXN0OiB0cnVlXG5cdCAgICB9KSk7XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0ZnVuY3Rpb24gb25VbmhhbmRsZWRSZWplY3Rpb24ocmVhc29uKSB7XG5cdCAgdmFyIHJlc3VsdEluZm8gPSB7XG5cdCAgICByZXN1bHQ6IGZhbHNlLFxuXHQgICAgbWVzc2FnZTogcmVhc29uLm1lc3NhZ2UgfHwgXCJlcnJvclwiLFxuXHQgICAgYWN0dWFsOiByZWFzb24sXG5cdCAgICBzb3VyY2U6IHJlYXNvbi5zdGFjayB8fCBzb3VyY2VGcm9tU3RhY2t0cmFjZSgzKVxuXHQgIH07XG5cdCAgdmFyIGN1cnJlbnRUZXN0ID0gY29uZmlnLmN1cnJlbnQ7XG5cblx0ICBpZiAoY3VycmVudFRlc3QpIHtcblx0ICAgIGN1cnJlbnRUZXN0LmFzc2VydC5wdXNoUmVzdWx0KHJlc3VsdEluZm8pO1xuXHQgIH0gZWxzZSB7XG5cdCAgICB0ZXN0KFwiZ2xvYmFsIGZhaWx1cmVcIiwgZXh0ZW5kKGZ1bmN0aW9uIChhc3NlcnQpIHtcblx0ICAgICAgYXNzZXJ0LnB1c2hSZXN1bHQocmVzdWx0SW5mbyk7XG5cdCAgICB9LCB7XG5cdCAgICAgIHZhbGlkVGVzdDogdHJ1ZVxuXHQgICAgfSkpO1xuXHQgIH1cblx0fVxuXG5cdHZhciBRVW5pdCA9IHt9O1xuXHR2YXIgZ2xvYmFsU3VpdGUgPSBuZXcgU3VpdGVSZXBvcnQoKTsgLy8gVGhlIGluaXRpYWwgXCJjdXJyZW50TW9kdWxlXCIgcmVwcmVzZW50cyB0aGUgZ2xvYmFsIChvciB0b3AtbGV2ZWwpIG1vZHVsZSB0aGF0XG5cdC8vIGlzIG5vdCBleHBsaWNpdGx5IGRlZmluZWQgYnkgdGhlIHVzZXIsIHRoZXJlZm9yZSB3ZSBhZGQgdGhlIFwiZ2xvYmFsU3VpdGVcIiB0b1xuXHQvLyBpdCBzaW5jZSBlYWNoIG1vZHVsZSBoYXMgYSBzdWl0ZVJlcG9ydCBhc3NvY2lhdGVkIHdpdGggaXQuXG5cblx0Y29uZmlnLmN1cnJlbnRNb2R1bGUuc3VpdGVSZXBvcnQgPSBnbG9iYWxTdWl0ZTtcblx0dmFyIGdsb2JhbFN0YXJ0Q2FsbGVkID0gZmFsc2U7XG5cdHZhciBydW5TdGFydGVkID0gZmFsc2U7IC8vIEZpZ3VyZSBvdXQgaWYgd2UncmUgcnVubmluZyB0aGUgdGVzdHMgZnJvbSBhIHNlcnZlciBvciBub3RcblxuXHRRVW5pdC5pc0xvY2FsID0gIShkZWZpbmVkLmRvY3VtZW50ICYmIHdpbmRvdyQxLmxvY2F0aW9uLnByb3RvY29sICE9PSBcImZpbGU6XCIpOyAvLyBFeHBvc2UgdGhlIGN1cnJlbnQgUVVuaXQgdmVyc2lvblxuXG5cdFFVbml0LnZlcnNpb24gPSBcIjIuMTEuM1wiO1xuXHRleHRlbmQoUVVuaXQsIHtcblx0ICBvbjogb24sXG5cdCAgbW9kdWxlOiBtb2R1bGUkMSxcblx0ICB0ZXN0OiB0ZXN0LFxuXHQgIHRvZG86IHRvZG8sXG5cdCAgc2tpcDogc2tpcCxcblx0ICBvbmx5OiBvbmx5LFxuXHQgIHN0YXJ0OiBmdW5jdGlvbiBzdGFydChjb3VudCkge1xuXHQgICAgdmFyIGdsb2JhbFN0YXJ0QWxyZWFkeUNhbGxlZCA9IGdsb2JhbFN0YXJ0Q2FsbGVkO1xuXG5cdCAgICBpZiAoIWNvbmZpZy5jdXJyZW50KSB7XG5cdCAgICAgIGdsb2JhbFN0YXJ0Q2FsbGVkID0gdHJ1ZTtcblxuXHQgICAgICBpZiAocnVuU3RhcnRlZCkge1xuXHQgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbGxlZCBzdGFydCgpIHdoaWxlIHRlc3QgYWxyZWFkeSBzdGFydGVkIHJ1bm5pbmdcIik7XG5cdCAgICAgIH0gZWxzZSBpZiAoZ2xvYmFsU3RhcnRBbHJlYWR5Q2FsbGVkIHx8IGNvdW50ID4gMSkge1xuXHQgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbGxlZCBzdGFydCgpIG91dHNpZGUgb2YgYSB0ZXN0IGNvbnRleHQgdG9vIG1hbnkgdGltZXNcIik7XG5cdCAgICAgIH0gZWxzZSBpZiAoY29uZmlnLmF1dG9zdGFydCkge1xuXHQgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbGxlZCBzdGFydCgpIG91dHNpZGUgb2YgYSB0ZXN0IGNvbnRleHQgd2hlbiBcIiArIFwiUVVuaXQuY29uZmlnLmF1dG9zdGFydCB3YXMgdHJ1ZVwiKTtcblx0ICAgICAgfSBlbHNlIGlmICghY29uZmlnLnBhZ2VMb2FkZWQpIHtcblx0ICAgICAgICAvLyBUaGUgcGFnZSBpc24ndCBjb21wbGV0ZWx5IGxvYWRlZCB5ZXQsIHNvIHdlIHNldCBhdXRvc3RhcnQgYW5kIHRoZW5cblx0ICAgICAgICAvLyBsb2FkIGlmIHdlJ3JlIGluIE5vZGUgb3Igd2FpdCBmb3IgdGhlIGJyb3dzZXIncyBsb2FkIGV2ZW50LlxuXHQgICAgICAgIGNvbmZpZy5hdXRvc3RhcnQgPSB0cnVlOyAvLyBTdGFydHMgZnJvbSBOb2RlIGV2ZW4gaWYgLmxvYWQgd2FzIG5vdCBwcmV2aW91c2x5IGNhbGxlZC4gV2Ugc3RpbGwgcmV0dXJuXG5cdCAgICAgICAgLy8gZWFybHkgb3RoZXJ3aXNlIHdlJ2xsIHdpbmQgdXAgXCJiZWdpbm5pbmdcIiB0d2ljZS5cblxuXHQgICAgICAgIGlmICghZGVmaW5lZC5kb2N1bWVudCkge1xuXHQgICAgICAgICAgUVVuaXQubG9hZCgpO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHJldHVybjtcblx0ICAgICAgfVxuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUVVuaXQuc3RhcnQgY2Fubm90IGJlIGNhbGxlZCBpbnNpZGUgYSB0ZXN0IGNvbnRleHQuXCIpO1xuXHQgICAgfVxuXG5cdCAgICBzY2hlZHVsZUJlZ2luKCk7XG5cdCAgfSxcblx0ICBjb25maWc6IGNvbmZpZyxcblx0ICBpczogaXMsXG5cdCAgb2JqZWN0VHlwZTogb2JqZWN0VHlwZSxcblx0ICBleHRlbmQ6IGV4dGVuZCxcblx0ICBsb2FkOiBmdW5jdGlvbiBsb2FkKCkge1xuXHQgICAgY29uZmlnLnBhZ2VMb2FkZWQgPSB0cnVlOyAvLyBJbml0aWFsaXplIHRoZSBjb25maWd1cmF0aW9uIG9wdGlvbnNcblxuXHQgICAgZXh0ZW5kKGNvbmZpZywge1xuXHQgICAgICBzdGF0czoge1xuXHQgICAgICAgIGFsbDogMCxcblx0ICAgICAgICBiYWQ6IDAsXG5cdCAgICAgICAgdGVzdENvdW50OiAwXG5cdCAgICAgIH0sXG5cdCAgICAgIHN0YXJ0ZWQ6IDAsXG5cdCAgICAgIHVwZGF0ZVJhdGU6IDEwMDAsXG5cdCAgICAgIGF1dG9zdGFydDogdHJ1ZSxcblx0ICAgICAgZmlsdGVyOiBcIlwiXG5cdCAgICB9LCB0cnVlKTtcblxuXHQgICAgaWYgKCFydW5TdGFydGVkKSB7XG5cdCAgICAgIGNvbmZpZy5ibG9ja2luZyA9IGZhbHNlO1xuXG5cdCAgICAgIGlmIChjb25maWcuYXV0b3N0YXJ0KSB7XG5cdCAgICAgICAgc2NoZWR1bGVCZWdpbigpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfSxcblx0ICBzdGFjazogZnVuY3Rpb24gc3RhY2sob2Zmc2V0KSB7XG5cdCAgICBvZmZzZXQgPSAob2Zmc2V0IHx8IDApICsgMjtcblx0ICAgIHJldHVybiBzb3VyY2VGcm9tU3RhY2t0cmFjZShvZmZzZXQpO1xuXHQgIH0sXG5cdCAgb25FcnJvcjogb25FcnJvcixcblx0ICBvblVuaGFuZGxlZFJlamVjdGlvbjogb25VbmhhbmRsZWRSZWplY3Rpb25cblx0fSk7XG5cdFFVbml0LnB1c2hGYWlsdXJlID0gcHVzaEZhaWx1cmU7XG5cdFFVbml0LmFzc2VydCA9IEFzc2VydC5wcm90b3R5cGU7XG5cdFFVbml0LmVxdWl2ID0gZXF1aXY7XG5cdFFVbml0LmR1bXAgPSBkdW1wO1xuXHRyZWdpc3RlckxvZ2dpbmdDYWxsYmFja3MoUVVuaXQpO1xuXG5cdGZ1bmN0aW9uIHNjaGVkdWxlQmVnaW4oKSB7XG5cdCAgcnVuU3RhcnRlZCA9IHRydWU7IC8vIEFkZCBhIHNsaWdodCBkZWxheSB0byBhbGxvdyBkZWZpbml0aW9uIG9mIG1vcmUgbW9kdWxlcyBhbmQgdGVzdHMuXG5cblx0ICBpZiAoZGVmaW5lZC5zZXRUaW1lb3V0KSB7XG5cdCAgICBzZXRUaW1lb3V0JDEoZnVuY3Rpb24gKCkge1xuXHQgICAgICBiZWdpbigpO1xuXHQgICAgfSk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIGJlZ2luKCk7XG5cdCAgfVxuXHR9XG5cblx0ZnVuY3Rpb24gdW5ibG9ja0FuZEFkdmFuY2VRdWV1ZSgpIHtcblx0ICBjb25maWcuYmxvY2tpbmcgPSBmYWxzZTtcblx0ICBQcm9jZXNzaW5nUXVldWUuYWR2YW5jZSgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gYmVnaW4oKSB7XG5cdCAgdmFyIGksXG5cdCAgICAgIGwsXG5cdCAgICAgIG1vZHVsZXNMb2cgPSBbXTsgLy8gSWYgdGhlIHRlc3QgcnVuIGhhc24ndCBvZmZpY2lhbGx5IGJlZ3VuIHlldFxuXG5cdCAgaWYgKCFjb25maWcuc3RhcnRlZCkge1xuXHQgICAgLy8gUmVjb3JkIHRoZSB0aW1lIG9mIHRoZSB0ZXN0IHJ1bidzIGJlZ2lubmluZ1xuXHQgICAgY29uZmlnLnN0YXJ0ZWQgPSBub3coKTsgLy8gRGVsZXRlIHRoZSBsb29zZSB1bm5hbWVkIG1vZHVsZSBpZiB1bnVzZWQuXG5cblx0ICAgIGlmIChjb25maWcubW9kdWxlc1swXS5uYW1lID09PSBcIlwiICYmIGNvbmZpZy5tb2R1bGVzWzBdLnRlc3RzLmxlbmd0aCA9PT0gMCkge1xuXHQgICAgICBjb25maWcubW9kdWxlcy5zaGlmdCgpO1xuXHQgICAgfSAvLyBBdm9pZCB1bm5lY2Vzc2FyeSBpbmZvcm1hdGlvbiBieSBub3QgbG9nZ2luZyBtb2R1bGVzJyB0ZXN0IGVudmlyb25tZW50c1xuXG5cblx0ICAgIGZvciAoaSA9IDAsIGwgPSBjb25maWcubW9kdWxlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0ICAgICAgbW9kdWxlc0xvZy5wdXNoKHtcblx0ICAgICAgICBuYW1lOiBjb25maWcubW9kdWxlc1tpXS5uYW1lLFxuXHQgICAgICAgIHRlc3RzOiBjb25maWcubW9kdWxlc1tpXS50ZXN0c1xuXHQgICAgICB9KTtcblx0ICAgIH0gLy8gVGhlIHRlc3QgcnVuIGlzIG9mZmljaWFsbHkgYmVnaW5uaW5nIG5vd1xuXG5cblx0ICAgIGVtaXQoXCJydW5TdGFydFwiLCBnbG9iYWxTdWl0ZS5zdGFydCh0cnVlKSk7XG5cdCAgICBydW5Mb2dnaW5nQ2FsbGJhY2tzKFwiYmVnaW5cIiwge1xuXHQgICAgICB0b3RhbFRlc3RzOiBUZXN0LmNvdW50LFxuXHQgICAgICBtb2R1bGVzOiBtb2R1bGVzTG9nXG5cdCAgICB9KS50aGVuKHVuYmxvY2tBbmRBZHZhbmNlUXVldWUpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICB1bmJsb2NrQW5kQWR2YW5jZVF1ZXVlKCk7XG5cdCAgfVxuXHR9XG5cdGV4cG9ydFFVbml0KFFVbml0KTtcblxuXHQoZnVuY3Rpb24gKCkge1xuXHQgIGlmICh0eXBlb2Ygd2luZG93JDEgPT09IFwidW5kZWZpbmVkXCIgfHwgdHlwZW9mIGRvY3VtZW50JDEgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICB2YXIgY29uZmlnID0gUVVuaXQuY29uZmlnLFxuXHQgICAgICBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5OyAvLyBTdG9yZXMgZml4dHVyZSBIVE1MIGZvciByZXNldHRpbmcgbGF0ZXJcblxuXHQgIGZ1bmN0aW9uIHN0b3JlRml4dHVyZSgpIHtcblx0ICAgIC8vIEF2b2lkIG92ZXJ3cml0aW5nIHVzZXItZGVmaW5lZCB2YWx1ZXNcblx0ICAgIGlmIChoYXNPd24uY2FsbChjb25maWcsIFwiZml4dHVyZVwiKSkge1xuXHQgICAgICByZXR1cm47XG5cdCAgICB9XG5cblx0ICAgIHZhciBmaXh0dXJlID0gZG9jdW1lbnQkMS5nZXRFbGVtZW50QnlJZChcInF1bml0LWZpeHR1cmVcIik7XG5cblx0ICAgIGlmIChmaXh0dXJlKSB7XG5cdCAgICAgIGNvbmZpZy5maXh0dXJlID0gZml4dHVyZS5jbG9uZU5vZGUodHJ1ZSk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgUVVuaXQuYmVnaW4oc3RvcmVGaXh0dXJlKTsgLy8gUmVzZXRzIHRoZSBmaXh0dXJlIERPTSBlbGVtZW50IGlmIGF2YWlsYWJsZS5cblxuXHQgIGZ1bmN0aW9uIHJlc2V0Rml4dHVyZSgpIHtcblx0ICAgIGlmIChjb25maWcuZml4dHVyZSA9PSBudWxsKSB7XG5cdCAgICAgIHJldHVybjtcblx0ICAgIH1cblxuXHQgICAgdmFyIGZpeHR1cmUgPSBkb2N1bWVudCQxLmdldEVsZW1lbnRCeUlkKFwicXVuaXQtZml4dHVyZVwiKTtcblxuXHQgICAgdmFyIHJlc2V0Rml4dHVyZVR5cGUgPSBfdHlwZW9mKGNvbmZpZy5maXh0dXJlKTtcblxuXHQgICAgaWYgKHJlc2V0Rml4dHVyZVR5cGUgPT09IFwic3RyaW5nXCIpIHtcblx0ICAgICAgLy8gc3VwcG9ydCB1c2VyIGRlZmluZWQgdmFsdWVzIGZvciBgY29uZmlnLmZpeHR1cmVgXG5cdCAgICAgIHZhciBuZXdGaXh0dXJlID0gZG9jdW1lbnQkMS5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHQgICAgICBuZXdGaXh0dXJlLnNldEF0dHJpYnV0ZShcImlkXCIsIFwicXVuaXQtZml4dHVyZVwiKTtcblx0ICAgICAgbmV3Rml4dHVyZS5pbm5lckhUTUwgPSBjb25maWcuZml4dHVyZTtcblx0ICAgICAgZml4dHVyZS5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdGaXh0dXJlLCBmaXh0dXJlKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHZhciBjbG9uZWRGaXh0dXJlID0gY29uZmlnLmZpeHR1cmUuY2xvbmVOb2RlKHRydWUpO1xuXHQgICAgICBmaXh0dXJlLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGNsb25lZEZpeHR1cmUsIGZpeHR1cmUpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIFFVbml0LnRlc3RTdGFydChyZXNldEZpeHR1cmUpO1xuXHR9KSgpO1xuXG5cdChmdW5jdGlvbiAoKSB7XG5cdCAgLy8gT25seSBpbnRlcmFjdCB3aXRoIFVSTHMgdmlhIHdpbmRvdy5sb2NhdGlvblxuXHQgIHZhciBsb2NhdGlvbiA9IHR5cGVvZiB3aW5kb3ckMSAhPT0gXCJ1bmRlZmluZWRcIiAmJiB3aW5kb3ckMS5sb2NhdGlvbjtcblxuXHQgIGlmICghbG9jYXRpb24pIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICB2YXIgdXJsUGFyYW1zID0gZ2V0VXJsUGFyYW1zKCk7XG5cdCAgUVVuaXQudXJsUGFyYW1zID0gdXJsUGFyYW1zOyAvLyBNYXRjaCBtb2R1bGUvdGVzdCBieSBpbmNsdXNpb24gaW4gYW4gYXJyYXlcblxuXHQgIFFVbml0LmNvbmZpZy5tb2R1bGVJZCA9IFtdLmNvbmNhdCh1cmxQYXJhbXMubW9kdWxlSWQgfHwgW10pO1xuXHQgIFFVbml0LmNvbmZpZy50ZXN0SWQgPSBbXS5jb25jYXQodXJsUGFyYW1zLnRlc3RJZCB8fCBbXSk7IC8vIEV4YWN0IGNhc2UtaW5zZW5zaXRpdmUgbWF0Y2ggb2YgdGhlIG1vZHVsZSBuYW1lXG5cblx0ICBRVW5pdC5jb25maWcubW9kdWxlID0gdXJsUGFyYW1zLm1vZHVsZTsgLy8gUmVndWxhciBleHByZXNzaW9uIG9yIGNhc2UtaW5zZW5zdGl2ZSBzdWJzdHJpbmcgbWF0Y2ggYWdhaW5zdCBcIm1vZHVsZU5hbWU6IHRlc3ROYW1lXCJcblxuXHQgIFFVbml0LmNvbmZpZy5maWx0ZXIgPSB1cmxQYXJhbXMuZmlsdGVyOyAvLyBUZXN0IG9yZGVyIHJhbmRvbWl6YXRpb25cblxuXHQgIGlmICh1cmxQYXJhbXMuc2VlZCA9PT0gdHJ1ZSkge1xuXHQgICAgLy8gR2VuZXJhdGUgYSByYW5kb20gc2VlZCBpZiB0aGUgb3B0aW9uIGlzIHNwZWNpZmllZCB3aXRob3V0IGEgdmFsdWVcblx0ICAgIFFVbml0LmNvbmZpZy5zZWVkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMik7XG5cdCAgfSBlbHNlIGlmICh1cmxQYXJhbXMuc2VlZCkge1xuXHQgICAgUVVuaXQuY29uZmlnLnNlZWQgPSB1cmxQYXJhbXMuc2VlZDtcblx0ICB9IC8vIEFkZCBVUkwtcGFyYW1ldGVyLW1hcHBlZCBjb25maWcgdmFsdWVzIHdpdGggVUkgZm9ybSByZW5kZXJpbmcgZGF0YVxuXG5cblx0ICBRVW5pdC5jb25maWcudXJsQ29uZmlnLnB1c2goe1xuXHQgICAgaWQ6IFwiaGlkZXBhc3NlZFwiLFxuXHQgICAgbGFiZWw6IFwiSGlkZSBwYXNzZWQgdGVzdHNcIixcblx0ICAgIHRvb2x0aXA6IFwiT25seSBzaG93IHRlc3RzIGFuZCBhc3NlcnRpb25zIHRoYXQgZmFpbC4gU3RvcmVkIGFzIHF1ZXJ5LXN0cmluZ3MuXCJcblx0ICB9LCB7XG5cdCAgICBpZDogXCJub2dsb2JhbHNcIixcblx0ICAgIGxhYmVsOiBcIkNoZWNrIGZvciBHbG9iYWxzXCIsXG5cdCAgICB0b29sdGlwOiBcIkVuYWJsaW5nIHRoaXMgd2lsbCB0ZXN0IGlmIGFueSB0ZXN0IGludHJvZHVjZXMgbmV3IHByb3BlcnRpZXMgb24gdGhlIFwiICsgXCJnbG9iYWwgb2JqZWN0IChgd2luZG93YCBpbiBCcm93c2VycykuIFN0b3JlZCBhcyBxdWVyeS1zdHJpbmdzLlwiXG5cdCAgfSwge1xuXHQgICAgaWQ6IFwibm90cnljYXRjaFwiLFxuXHQgICAgbGFiZWw6IFwiTm8gdHJ5LWNhdGNoXCIsXG5cdCAgICB0b29sdGlwOiBcIkVuYWJsaW5nIHRoaXMgd2lsbCBydW4gdGVzdHMgb3V0c2lkZSBvZiBhIHRyeS1jYXRjaCBibG9jay4gTWFrZXMgZGVidWdnaW5nIFwiICsgXCJleGNlcHRpb25zIGluIElFIHJlYXNvbmFibGUuIFN0b3JlZCBhcyBxdWVyeS1zdHJpbmdzLlwiXG5cdCAgfSk7XG5cdCAgUVVuaXQuYmVnaW4oZnVuY3Rpb24gKCkge1xuXHQgICAgdmFyIGksXG5cdCAgICAgICAgb3B0aW9uLFxuXHQgICAgICAgIHVybENvbmZpZyA9IFFVbml0LmNvbmZpZy51cmxDb25maWc7XG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCB1cmxDb25maWcubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgLy8gT3B0aW9ucyBjYW4gYmUgZWl0aGVyIHN0cmluZ3Mgb3Igb2JqZWN0cyB3aXRoIG5vbmVtcHR5IFwiaWRcIiBwcm9wZXJ0aWVzXG5cdCAgICAgIG9wdGlvbiA9IFFVbml0LmNvbmZpZy51cmxDb25maWdbaV07XG5cblx0ICAgICAgaWYgKHR5cGVvZiBvcHRpb24gIT09IFwic3RyaW5nXCIpIHtcblx0ICAgICAgICBvcHRpb24gPSBvcHRpb24uaWQ7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAoUVVuaXQuY29uZmlnW29wdGlvbl0gPT09IHVuZGVmaW5lZCkge1xuXHQgICAgICAgIFFVbml0LmNvbmZpZ1tvcHRpb25dID0gdXJsUGFyYW1zW29wdGlvbl07XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9KTtcblxuXHQgIGZ1bmN0aW9uIGdldFVybFBhcmFtcygpIHtcblx0ICAgIHZhciBpLCBwYXJhbSwgbmFtZSwgdmFsdWU7XG5cdCAgICB2YXIgdXJsUGFyYW1zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0ICAgIHZhciBwYXJhbXMgPSBsb2NhdGlvbi5zZWFyY2guc2xpY2UoMSkuc3BsaXQoXCImXCIpO1xuXHQgICAgdmFyIGxlbmd0aCA9IHBhcmFtcy5sZW5ndGg7XG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuXHQgICAgICBpZiAocGFyYW1zW2ldKSB7XG5cdCAgICAgICAgcGFyYW0gPSBwYXJhbXNbaV0uc3BsaXQoXCI9XCIpO1xuXHQgICAgICAgIG5hbWUgPSBkZWNvZGVRdWVyeVBhcmFtKHBhcmFtWzBdKTsgLy8gQWxsb3cganVzdCBhIGtleSB0byB0dXJuIG9uIGEgZmxhZywgZS5nLiwgdGVzdC5odG1sP25vZ2xvYmFsc1xuXG5cdCAgICAgICAgdmFsdWUgPSBwYXJhbS5sZW5ndGggPT09IDEgfHwgZGVjb2RlUXVlcnlQYXJhbShwYXJhbS5zbGljZSgxKS5qb2luKFwiPVwiKSk7XG5cblx0ICAgICAgICBpZiAobmFtZSBpbiB1cmxQYXJhbXMpIHtcblx0ICAgICAgICAgIHVybFBhcmFtc1tuYW1lXSA9IFtdLmNvbmNhdCh1cmxQYXJhbXNbbmFtZV0sIHZhbHVlKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgdXJsUGFyYW1zW25hbWVdID0gdmFsdWU7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiB1cmxQYXJhbXM7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gZGVjb2RlUXVlcnlQYXJhbShwYXJhbSkge1xuXHQgICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChwYXJhbS5yZXBsYWNlKC9cXCsvZywgXCIlMjBcIikpO1xuXHQgIH1cblx0fSkoKTtcblxuXHR2YXIgZnV6enlzb3J0ID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSkge1xuXG5cdCAgKGZ1bmN0aW9uIChyb290LCBVTUQpIHtcblx0ICAgIGlmICggbW9kdWxlLmV4cG9ydHMpIG1vZHVsZS5leHBvcnRzID0gVU1EKCk7ZWxzZSByb290LmZ1enp5c29ydCA9IFVNRCgpO1xuXHQgIH0pKGNvbW1vbmpzR2xvYmFsLCBmdW5jdGlvbiBVTUQoKSB7XG5cdCAgICBmdW5jdGlvbiBmdXp6eXNvcnROZXcoaW5zdGFuY2VPcHRpb25zKSB7XG5cdCAgICAgIHZhciBmdXp6eXNvcnQgPSB7XG5cdCAgICAgICAgc2luZ2xlOiBmdW5jdGlvbiAoc2VhcmNoLCB0YXJnZXQsIG9wdGlvbnMpIHtcblx0ICAgICAgICAgIGlmICghc2VhcmNoKSByZXR1cm4gbnVsbDtcblx0ICAgICAgICAgIGlmICghaXNPYmooc2VhcmNoKSkgc2VhcmNoID0gZnV6enlzb3J0LmdldFByZXBhcmVkU2VhcmNoKHNlYXJjaCk7XG5cdCAgICAgICAgICBpZiAoIXRhcmdldCkgcmV0dXJuIG51bGw7XG5cdCAgICAgICAgICBpZiAoIWlzT2JqKHRhcmdldCkpIHRhcmdldCA9IGZ1enp5c29ydC5nZXRQcmVwYXJlZCh0YXJnZXQpO1xuXHQgICAgICAgICAgdmFyIGFsbG93VHlwbyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5hbGxvd1R5cG8gIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuYWxsb3dUeXBvIDogaW5zdGFuY2VPcHRpb25zICYmIGluc3RhbmNlT3B0aW9ucy5hbGxvd1R5cG8gIT09IHVuZGVmaW5lZCA/IGluc3RhbmNlT3B0aW9ucy5hbGxvd1R5cG8gOiB0cnVlO1xuXHQgICAgICAgICAgdmFyIGFsZ29yaXRobSA9IGFsbG93VHlwbyA/IGZ1enp5c29ydC5hbGdvcml0aG0gOiBmdXp6eXNvcnQuYWxnb3JpdGhtTm9UeXBvO1xuXHQgICAgICAgICAgcmV0dXJuIGFsZ29yaXRobShzZWFyY2gsIHRhcmdldCwgc2VhcmNoWzBdKTsgLy8gdmFyIHRocmVzaG9sZCA9IG9wdGlvbnMgJiYgb3B0aW9ucy50aHJlc2hvbGQgfHwgaW5zdGFuY2VPcHRpb25zICYmIGluc3RhbmNlT3B0aW9ucy50aHJlc2hvbGQgfHwgLTkwMDcxOTkyNTQ3NDA5OTFcblx0ICAgICAgICAgIC8vIHZhciByZXN1bHQgPSBhbGdvcml0aG0oc2VhcmNoLCB0YXJnZXQsIHNlYXJjaFswXSlcblx0ICAgICAgICAgIC8vIGlmKHJlc3VsdCA9PT0gbnVsbCkgcmV0dXJuIG51bGxcblx0ICAgICAgICAgIC8vIGlmKHJlc3VsdC5zY29yZSA8IHRocmVzaG9sZCkgcmV0dXJuIG51bGxcblx0ICAgICAgICAgIC8vIHJldHVybiByZXN1bHRcblx0ICAgICAgICB9LFxuXHQgICAgICAgIGdvOiBmdW5jdGlvbiAoc2VhcmNoLCB0YXJnZXRzLCBvcHRpb25zKSB7XG5cdCAgICAgICAgICBpZiAoIXNlYXJjaCkgcmV0dXJuIG5vUmVzdWx0cztcblx0ICAgICAgICAgIHNlYXJjaCA9IGZ1enp5c29ydC5wcmVwYXJlU2VhcmNoKHNlYXJjaCk7XG5cdCAgICAgICAgICB2YXIgc2VhcmNoTG93ZXJDb2RlID0gc2VhcmNoWzBdO1xuXHQgICAgICAgICAgdmFyIHRocmVzaG9sZCA9IG9wdGlvbnMgJiYgb3B0aW9ucy50aHJlc2hvbGQgfHwgaW5zdGFuY2VPcHRpb25zICYmIGluc3RhbmNlT3B0aW9ucy50aHJlc2hvbGQgfHwgLTkwMDcxOTkyNTQ3NDA5OTE7XG5cdCAgICAgICAgICB2YXIgbGltaXQgPSBvcHRpb25zICYmIG9wdGlvbnMubGltaXQgfHwgaW5zdGFuY2VPcHRpb25zICYmIGluc3RhbmNlT3B0aW9ucy5saW1pdCB8fCA5MDA3MTk5MjU0NzQwOTkxO1xuXHQgICAgICAgICAgdmFyIGFsbG93VHlwbyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5hbGxvd1R5cG8gIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuYWxsb3dUeXBvIDogaW5zdGFuY2VPcHRpb25zICYmIGluc3RhbmNlT3B0aW9ucy5hbGxvd1R5cG8gIT09IHVuZGVmaW5lZCA/IGluc3RhbmNlT3B0aW9ucy5hbGxvd1R5cG8gOiB0cnVlO1xuXHQgICAgICAgICAgdmFyIGFsZ29yaXRobSA9IGFsbG93VHlwbyA/IGZ1enp5c29ydC5hbGdvcml0aG0gOiBmdXp6eXNvcnQuYWxnb3JpdGhtTm9UeXBvO1xuXHQgICAgICAgICAgdmFyIHJlc3VsdHNMZW4gPSAwO1xuXHQgICAgICAgICAgdmFyIGxpbWl0ZWRDb3VudCA9IDA7XG5cdCAgICAgICAgICB2YXIgdGFyZ2V0c0xlbiA9IHRhcmdldHMubGVuZ3RoOyAvLyBUaGlzIGNvZGUgaXMgY29weS9wYXN0ZWQgMyB0aW1lcyBmb3IgcGVyZm9ybWFuY2UgcmVhc29ucyBbb3B0aW9ucy5rZXlzLCBvcHRpb25zLmtleSwgbm8ga2V5c11cblx0ICAgICAgICAgIC8vIG9wdGlvbnMua2V5c1xuXG5cdCAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmtleXMpIHtcblx0ICAgICAgICAgICAgdmFyIHNjb3JlRm4gPSBvcHRpb25zLnNjb3JlRm4gfHwgZGVmYXVsdFNjb3JlRm47XG5cdCAgICAgICAgICAgIHZhciBrZXlzID0gb3B0aW9ucy5rZXlzO1xuXHQgICAgICAgICAgICB2YXIga2V5c0xlbiA9IGtleXMubGVuZ3RoO1xuXG5cdCAgICAgICAgICAgIGZvciAodmFyIGkgPSB0YXJnZXRzTGVuIC0gMTsgaSA+PSAwOyAtLWkpIHtcblx0ICAgICAgICAgICAgICB2YXIgb2JqID0gdGFyZ2V0c1tpXTtcblx0ICAgICAgICAgICAgICB2YXIgb2JqUmVzdWx0cyA9IG5ldyBBcnJheShrZXlzTGVuKTtcblxuXHQgICAgICAgICAgICAgIGZvciAodmFyIGtleUkgPSBrZXlzTGVuIC0gMTsga2V5SSA+PSAwOyAtLWtleUkpIHtcblx0ICAgICAgICAgICAgICAgIHZhciBrZXkgPSBrZXlzW2tleUldO1xuXHQgICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IGdldFZhbHVlKG9iaiwga2V5KTtcblxuXHQgICAgICAgICAgICAgICAgaWYgKCF0YXJnZXQpIHtcblx0ICAgICAgICAgICAgICAgICAgb2JqUmVzdWx0c1trZXlJXSA9IG51bGw7XG5cdCAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICBpZiAoIWlzT2JqKHRhcmdldCkpIHRhcmdldCA9IGZ1enp5c29ydC5nZXRQcmVwYXJlZCh0YXJnZXQpO1xuXHQgICAgICAgICAgICAgICAgb2JqUmVzdWx0c1trZXlJXSA9IGFsZ29yaXRobShzZWFyY2gsIHRhcmdldCwgc2VhcmNoTG93ZXJDb2RlKTtcblx0ICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICBvYmpSZXN1bHRzLm9iaiA9IG9iajsgLy8gYmVmb3JlIHNjb3JlRm4gc28gc2NvcmVGbiBjYW4gdXNlIGl0XG5cblx0ICAgICAgICAgICAgICB2YXIgc2NvcmUgPSBzY29yZUZuKG9ialJlc3VsdHMpO1xuXHQgICAgICAgICAgICAgIGlmIChzY29yZSA9PT0gbnVsbCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgaWYgKHNjb3JlIDwgdGhyZXNob2xkKSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICBvYmpSZXN1bHRzLnNjb3JlID0gc2NvcmU7XG5cblx0ICAgICAgICAgICAgICBpZiAocmVzdWx0c0xlbiA8IGxpbWl0KSB7XG5cdCAgICAgICAgICAgICAgICBxLmFkZChvYmpSZXN1bHRzKTtcblx0ICAgICAgICAgICAgICAgICsrcmVzdWx0c0xlbjtcblx0ICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgKytsaW1pdGVkQ291bnQ7XG5cdCAgICAgICAgICAgICAgICBpZiAoc2NvcmUgPiBxLnBlZWsoKS5zY29yZSkgcS5yZXBsYWNlVG9wKG9ialJlc3VsdHMpO1xuXHQgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfSAvLyBvcHRpb25zLmtleVxuXG5cdCAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5rZXkpIHtcblx0ICAgICAgICAgICAgdmFyIGtleSA9IG9wdGlvbnMua2V5O1xuXG5cdCAgICAgICAgICAgIGZvciAodmFyIGkgPSB0YXJnZXRzTGVuIC0gMTsgaSA+PSAwOyAtLWkpIHtcblx0ICAgICAgICAgICAgICB2YXIgb2JqID0gdGFyZ2V0c1tpXTtcblx0ICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZ2V0VmFsdWUob2JqLCBrZXkpO1xuXHQgICAgICAgICAgICAgIGlmICghdGFyZ2V0KSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICBpZiAoIWlzT2JqKHRhcmdldCkpIHRhcmdldCA9IGZ1enp5c29ydC5nZXRQcmVwYXJlZCh0YXJnZXQpO1xuXHQgICAgICAgICAgICAgIHZhciByZXN1bHQgPSBhbGdvcml0aG0oc2VhcmNoLCB0YXJnZXQsIHNlYXJjaExvd2VyQ29kZSk7XG5cdCAgICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zY29yZSA8IHRocmVzaG9sZCkgY29udGludWU7IC8vIGhhdmUgdG8gY2xvbmUgcmVzdWx0IHNvIGR1cGxpY2F0ZSB0YXJnZXRzIGZyb20gZGlmZmVyZW50IG9iaiBjYW4gZWFjaCByZWZlcmVuY2UgdGhlIGNvcnJlY3Qgb2JqXG5cblx0ICAgICAgICAgICAgICByZXN1bHQgPSB7XG5cdCAgICAgICAgICAgICAgICB0YXJnZXQ6IHJlc3VsdC50YXJnZXQsXG5cdCAgICAgICAgICAgICAgICBfdGFyZ2V0TG93ZXJDb2RlczogbnVsbCxcblx0ICAgICAgICAgICAgICAgIF9uZXh0QmVnaW5uaW5nSW5kZXhlczogbnVsbCxcblx0ICAgICAgICAgICAgICAgIHNjb3JlOiByZXN1bHQuc2NvcmUsXG5cdCAgICAgICAgICAgICAgICBpbmRleGVzOiByZXN1bHQuaW5kZXhlcyxcblx0ICAgICAgICAgICAgICAgIG9iajogb2JqXG5cdCAgICAgICAgICAgICAgfTsgLy8gaGlkZGVuXG5cblx0ICAgICAgICAgICAgICBpZiAocmVzdWx0c0xlbiA8IGxpbWl0KSB7XG5cdCAgICAgICAgICAgICAgICBxLmFkZChyZXN1bHQpO1xuXHQgICAgICAgICAgICAgICAgKytyZXN1bHRzTGVuO1xuXHQgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICArK2xpbWl0ZWRDb3VudDtcblx0ICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc2NvcmUgPiBxLnBlZWsoKS5zY29yZSkgcS5yZXBsYWNlVG9wKHJlc3VsdCk7XG5cdCAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9IC8vIG5vIGtleXNcblxuXHQgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgZm9yICh2YXIgaSA9IHRhcmdldHNMZW4gLSAxOyBpID49IDA7IC0taSkge1xuXHQgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSB0YXJnZXRzW2ldO1xuXHQgICAgICAgICAgICAgIGlmICghdGFyZ2V0KSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICBpZiAoIWlzT2JqKHRhcmdldCkpIHRhcmdldCA9IGZ1enp5c29ydC5nZXRQcmVwYXJlZCh0YXJnZXQpO1xuXHQgICAgICAgICAgICAgIHZhciByZXN1bHQgPSBhbGdvcml0aG0oc2VhcmNoLCB0YXJnZXQsIHNlYXJjaExvd2VyQ29kZSk7XG5cdCAgICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zY29yZSA8IHRocmVzaG9sZCkgY29udGludWU7XG5cblx0ICAgICAgICAgICAgICBpZiAocmVzdWx0c0xlbiA8IGxpbWl0KSB7XG5cdCAgICAgICAgICAgICAgICBxLmFkZChyZXN1bHQpO1xuXHQgICAgICAgICAgICAgICAgKytyZXN1bHRzTGVuO1xuXHQgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICArK2xpbWl0ZWRDb3VudDtcblx0ICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc2NvcmUgPiBxLnBlZWsoKS5zY29yZSkgcS5yZXBsYWNlVG9wKHJlc3VsdCk7XG5cdCAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIGlmIChyZXN1bHRzTGVuID09PSAwKSByZXR1cm4gbm9SZXN1bHRzO1xuXHQgICAgICAgICAgdmFyIHJlc3VsdHMgPSBuZXcgQXJyYXkocmVzdWx0c0xlbik7XG5cblx0ICAgICAgICAgIGZvciAodmFyIGkgPSByZXN1bHRzTGVuIC0gMTsgaSA+PSAwOyAtLWkpIHJlc3VsdHNbaV0gPSBxLnBvbGwoKTtcblxuXHQgICAgICAgICAgcmVzdWx0cy50b3RhbCA9IHJlc3VsdHNMZW4gKyBsaW1pdGVkQ291bnQ7XG5cdCAgICAgICAgICByZXR1cm4gcmVzdWx0cztcblx0ICAgICAgICB9LFxuXHQgICAgICAgIGdvQXN5bmM6IGZ1bmN0aW9uIChzZWFyY2gsIHRhcmdldHMsIG9wdGlvbnMpIHtcblx0ICAgICAgICAgIHZhciBjYW5jZWxlZCA9IGZhbHNlO1xuXHQgICAgICAgICAgdmFyIHAgPSBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdCAgICAgICAgICAgIGlmICghc2VhcmNoKSByZXR1cm4gcmVzb2x2ZShub1Jlc3VsdHMpO1xuXHQgICAgICAgICAgICBzZWFyY2ggPSBmdXp6eXNvcnQucHJlcGFyZVNlYXJjaChzZWFyY2gpO1xuXHQgICAgICAgICAgICB2YXIgc2VhcmNoTG93ZXJDb2RlID0gc2VhcmNoWzBdO1xuXHQgICAgICAgICAgICB2YXIgcSA9IGZhc3Rwcmlvcml0eXF1ZXVlKCk7XG5cdCAgICAgICAgICAgIHZhciBpQ3VycmVudCA9IHRhcmdldHMubGVuZ3RoIC0gMTtcblx0ICAgICAgICAgICAgdmFyIHRocmVzaG9sZCA9IG9wdGlvbnMgJiYgb3B0aW9ucy50aHJlc2hvbGQgfHwgaW5zdGFuY2VPcHRpb25zICYmIGluc3RhbmNlT3B0aW9ucy50aHJlc2hvbGQgfHwgLTkwMDcxOTkyNTQ3NDA5OTE7XG5cdCAgICAgICAgICAgIHZhciBsaW1pdCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5saW1pdCB8fCBpbnN0YW5jZU9wdGlvbnMgJiYgaW5zdGFuY2VPcHRpb25zLmxpbWl0IHx8IDkwMDcxOTkyNTQ3NDA5OTE7XG5cdCAgICAgICAgICAgIHZhciBhbGxvd1R5cG8gPSBvcHRpb25zICYmIG9wdGlvbnMuYWxsb3dUeXBvICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmFsbG93VHlwbyA6IGluc3RhbmNlT3B0aW9ucyAmJiBpbnN0YW5jZU9wdGlvbnMuYWxsb3dUeXBvICE9PSB1bmRlZmluZWQgPyBpbnN0YW5jZU9wdGlvbnMuYWxsb3dUeXBvIDogdHJ1ZTtcblx0ICAgICAgICAgICAgdmFyIGFsZ29yaXRobSA9IGFsbG93VHlwbyA/IGZ1enp5c29ydC5hbGdvcml0aG0gOiBmdXp6eXNvcnQuYWxnb3JpdGhtTm9UeXBvO1xuXHQgICAgICAgICAgICB2YXIgcmVzdWx0c0xlbiA9IDA7XG5cdCAgICAgICAgICAgIHZhciBsaW1pdGVkQ291bnQgPSAwO1xuXG5cdCAgICAgICAgICAgIGZ1bmN0aW9uIHN0ZXAoKSB7XG5cdCAgICAgICAgICAgICAgaWYgKGNhbmNlbGVkKSByZXR1cm4gcmVqZWN0KCdjYW5jZWxlZCcpO1xuXHQgICAgICAgICAgICAgIHZhciBzdGFydE1zID0gRGF0ZS5ub3coKTsgLy8gVGhpcyBjb2RlIGlzIGNvcHkvcGFzdGVkIDMgdGltZXMgZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnMgW29wdGlvbnMua2V5cywgb3B0aW9ucy5rZXksIG5vIGtleXNdXG5cdCAgICAgICAgICAgICAgLy8gb3B0aW9ucy5rZXlzXG5cblx0ICAgICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmtleXMpIHtcblx0ICAgICAgICAgICAgICAgIHZhciBzY29yZUZuID0gb3B0aW9ucy5zY29yZUZuIHx8IGRlZmF1bHRTY29yZUZuO1xuXHQgICAgICAgICAgICAgICAgdmFyIGtleXMgPSBvcHRpb25zLmtleXM7XG5cdCAgICAgICAgICAgICAgICB2YXIga2V5c0xlbiA9IGtleXMubGVuZ3RoO1xuXG5cdCAgICAgICAgICAgICAgICBmb3IgKDsgaUN1cnJlbnQgPj0gMDsgLS1pQ3VycmVudCkge1xuXHQgICAgICAgICAgICAgICAgICB2YXIgb2JqID0gdGFyZ2V0c1tpQ3VycmVudF07XG5cdCAgICAgICAgICAgICAgICAgIHZhciBvYmpSZXN1bHRzID0gbmV3IEFycmF5KGtleXNMZW4pO1xuXG5cdCAgICAgICAgICAgICAgICAgIGZvciAodmFyIGtleUkgPSBrZXlzTGVuIC0gMTsga2V5SSA+PSAwOyAtLWtleUkpIHtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0ga2V5c1trZXlJXTtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZ2V0VmFsdWUob2JqLCBrZXkpO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKCF0YXJnZXQpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgIG9ialJlc3VsdHNba2V5SV0gPSBudWxsO1xuXHQgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKCFpc09iaih0YXJnZXQpKSB0YXJnZXQgPSBmdXp6eXNvcnQuZ2V0UHJlcGFyZWQodGFyZ2V0KTtcblx0ICAgICAgICAgICAgICAgICAgICBvYmpSZXN1bHRzW2tleUldID0gYWxnb3JpdGhtKHNlYXJjaCwgdGFyZ2V0LCBzZWFyY2hMb3dlckNvZGUpO1xuXHQgICAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgICAgb2JqUmVzdWx0cy5vYmogPSBvYmo7IC8vIGJlZm9yZSBzY29yZUZuIHNvIHNjb3JlRm4gY2FuIHVzZSBpdFxuXG5cdCAgICAgICAgICAgICAgICAgIHZhciBzY29yZSA9IHNjb3JlRm4ob2JqUmVzdWx0cyk7XG5cdCAgICAgICAgICAgICAgICAgIGlmIChzY29yZSA9PT0gbnVsbCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgICAgIGlmIChzY29yZSA8IHRocmVzaG9sZCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgICAgIG9ialJlc3VsdHMuc2NvcmUgPSBzY29yZTtcblxuXHQgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0c0xlbiA8IGxpbWl0KSB7XG5cdCAgICAgICAgICAgICAgICAgICAgcS5hZGQob2JqUmVzdWx0cyk7XG5cdCAgICAgICAgICAgICAgICAgICAgKytyZXN1bHRzTGVuO1xuXHQgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgICAgICsrbGltaXRlZENvdW50O1xuXHQgICAgICAgICAgICAgICAgICAgIGlmIChzY29yZSA+IHEucGVlaygpLnNjb3JlKSBxLnJlcGxhY2VUb3Aob2JqUmVzdWx0cyk7XG5cdCAgICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgICBpZiAoaUN1cnJlbnQgJSAxMDAwXG5cdCAgICAgICAgICAgICAgICAgIC8qaXRlbXNQZXJDaGVjayovXG5cdCAgICAgICAgICAgICAgICAgID09PSAwKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKERhdGUubm93KCkgLSBzdGFydE1zID49IDEwXG5cdCAgICAgICAgICAgICAgICAgICAgLyphc3luY0ludGVydmFsKi9cblx0ICAgICAgICAgICAgICAgICAgICApIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgaXNOb2RlID8gc2V0SW1tZWRpYXRlKHN0ZXApIDogc2V0VGltZW91dChzdGVwKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICB9IC8vIG9wdGlvbnMua2V5XG5cblx0ICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5rZXkpIHtcblx0ICAgICAgICAgICAgICAgIHZhciBrZXkgPSBvcHRpb25zLmtleTtcblxuXHQgICAgICAgICAgICAgICAgZm9yICg7IGlDdXJyZW50ID49IDA7IC0taUN1cnJlbnQpIHtcblx0ICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IHRhcmdldHNbaUN1cnJlbnRdO1xuXHQgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZ2V0VmFsdWUob2JqLCBrZXkpO1xuXHQgICAgICAgICAgICAgICAgICBpZiAoIXRhcmdldCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgICAgIGlmICghaXNPYmoodGFyZ2V0KSkgdGFyZ2V0ID0gZnV6enlzb3J0LmdldFByZXBhcmVkKHRhcmdldCk7XG5cdCAgICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSBhbGdvcml0aG0oc2VhcmNoLCB0YXJnZXQsIHNlYXJjaExvd2VyQ29kZSk7XG5cdCAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnNjb3JlIDwgdGhyZXNob2xkKSBjb250aW51ZTsgLy8gaGF2ZSB0byBjbG9uZSByZXN1bHQgc28gZHVwbGljYXRlIHRhcmdldHMgZnJvbSBkaWZmZXJlbnQgb2JqIGNhbiBlYWNoIHJlZmVyZW5jZSB0aGUgY29ycmVjdCBvYmpcblxuXHQgICAgICAgICAgICAgICAgICByZXN1bHQgPSB7XG5cdCAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiByZXN1bHQudGFyZ2V0LFxuXHQgICAgICAgICAgICAgICAgICAgIF90YXJnZXRMb3dlckNvZGVzOiBudWxsLFxuXHQgICAgICAgICAgICAgICAgICAgIF9uZXh0QmVnaW5uaW5nSW5kZXhlczogbnVsbCxcblx0ICAgICAgICAgICAgICAgICAgICBzY29yZTogcmVzdWx0LnNjb3JlLFxuXHQgICAgICAgICAgICAgICAgICAgIGluZGV4ZXM6IHJlc3VsdC5pbmRleGVzLFxuXHQgICAgICAgICAgICAgICAgICAgIG9iajogb2JqXG5cdCAgICAgICAgICAgICAgICAgIH07IC8vIGhpZGRlblxuXG5cdCAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHRzTGVuIDwgbGltaXQpIHtcblx0ICAgICAgICAgICAgICAgICAgICBxLmFkZChyZXN1bHQpO1xuXHQgICAgICAgICAgICAgICAgICAgICsrcmVzdWx0c0xlbjtcblx0ICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgICAgICArK2xpbWl0ZWRDb3VudDtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnNjb3JlID4gcS5wZWVrKCkuc2NvcmUpIHEucmVwbGFjZVRvcChyZXN1bHQpO1xuXHQgICAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgICAgaWYgKGlDdXJyZW50ICUgMTAwMFxuXHQgICAgICAgICAgICAgICAgICAvKml0ZW1zUGVyQ2hlY2sqL1xuXHQgICAgICAgICAgICAgICAgICA9PT0gMCkge1xuXHQgICAgICAgICAgICAgICAgICAgIGlmIChEYXRlLm5vdygpIC0gc3RhcnRNcyA+PSAxMFxuXHQgICAgICAgICAgICAgICAgICAgIC8qYXN5bmNJbnRlcnZhbCovXG5cdCAgICAgICAgICAgICAgICAgICAgKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGlzTm9kZSA/IHNldEltbWVkaWF0ZShzdGVwKSA6IHNldFRpbWVvdXQoc3RlcCk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgfSAvLyBubyBrZXlzXG5cblx0ICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgZm9yICg7IGlDdXJyZW50ID49IDA7IC0taUN1cnJlbnQpIHtcblx0ICAgICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IHRhcmdldHNbaUN1cnJlbnRdO1xuXHQgICAgICAgICAgICAgICAgICBpZiAoIXRhcmdldCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgICAgIGlmICghaXNPYmoodGFyZ2V0KSkgdGFyZ2V0ID0gZnV6enlzb3J0LmdldFByZXBhcmVkKHRhcmdldCk7XG5cdCAgICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSBhbGdvcml0aG0oc2VhcmNoLCB0YXJnZXQsIHNlYXJjaExvd2VyQ29kZSk7XG5cdCAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnNjb3JlIDwgdGhyZXNob2xkKSBjb250aW51ZTtcblxuXHQgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0c0xlbiA8IGxpbWl0KSB7XG5cdCAgICAgICAgICAgICAgICAgICAgcS5hZGQocmVzdWx0KTtcblx0ICAgICAgICAgICAgICAgICAgICArK3Jlc3VsdHNMZW47XG5cdCAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICAgICAgKytsaW1pdGVkQ291bnQ7XG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zY29yZSA+IHEucGVlaygpLnNjb3JlKSBxLnJlcGxhY2VUb3AocmVzdWx0KTtcblx0ICAgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICAgIGlmIChpQ3VycmVudCAlIDEwMDBcblx0ICAgICAgICAgICAgICAgICAgLyppdGVtc1BlckNoZWNrKi9cblx0ICAgICAgICAgICAgICAgICAgPT09IDApIHtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAoRGF0ZS5ub3coKSAtIHN0YXJ0TXMgPj0gMTBcblx0ICAgICAgICAgICAgICAgICAgICAvKmFzeW5jSW50ZXJ2YWwqL1xuXHQgICAgICAgICAgICAgICAgICAgICkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBpc05vZGUgPyBzZXRJbW1lZGlhdGUoc3RlcCkgOiBzZXRUaW1lb3V0KHN0ZXApO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICBpZiAocmVzdWx0c0xlbiA9PT0gMCkgcmV0dXJuIHJlc29sdmUobm9SZXN1bHRzKTtcblx0ICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IG5ldyBBcnJheShyZXN1bHRzTGVuKTtcblxuXHQgICAgICAgICAgICAgIGZvciAodmFyIGkgPSByZXN1bHRzTGVuIC0gMTsgaSA+PSAwOyAtLWkpIHJlc3VsdHNbaV0gPSBxLnBvbGwoKTtcblxuXHQgICAgICAgICAgICAgIHJlc3VsdHMudG90YWwgPSByZXN1bHRzTGVuICsgbGltaXRlZENvdW50O1xuXHQgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0cyk7XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICBpc05vZGUgPyBzZXRJbW1lZGlhdGUoc3RlcCkgOiBzdGVwKCk7XG5cdCAgICAgICAgICB9KTtcblxuXHQgICAgICAgICAgcC5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgIGNhbmNlbGVkID0gdHJ1ZTtcblx0ICAgICAgICAgIH07XG5cblx0ICAgICAgICAgIHJldHVybiBwO1xuXHQgICAgICAgIH0sXG5cdCAgICAgICAgaGlnaGxpZ2h0OiBmdW5jdGlvbiAocmVzdWx0LCBoT3BlbiwgaENsb3NlKSB7XG5cdCAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKSByZXR1cm4gbnVsbDtcblx0ICAgICAgICAgIGlmIChoT3BlbiA9PT0gdW5kZWZpbmVkKSBoT3BlbiA9ICc8Yj4nO1xuXHQgICAgICAgICAgaWYgKGhDbG9zZSA9PT0gdW5kZWZpbmVkKSBoQ2xvc2UgPSAnPC9iPic7XG5cdCAgICAgICAgICB2YXIgaGlnaGxpZ2h0ZWQgPSAnJztcblx0ICAgICAgICAgIHZhciBtYXRjaGVzSW5kZXggPSAwO1xuXHQgICAgICAgICAgdmFyIG9wZW5lZCA9IGZhbHNlO1xuXHQgICAgICAgICAgdmFyIHRhcmdldCA9IHJlc3VsdC50YXJnZXQ7XG5cdCAgICAgICAgICB2YXIgdGFyZ2V0TGVuID0gdGFyZ2V0Lmxlbmd0aDtcblx0ICAgICAgICAgIHZhciBtYXRjaGVzQmVzdCA9IHJlc3VsdC5pbmRleGVzO1xuXG5cdCAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRhcmdldExlbjsgKytpKSB7XG5cdCAgICAgICAgICAgIHZhciBjaGFyID0gdGFyZ2V0W2ldO1xuXG5cdCAgICAgICAgICAgIGlmIChtYXRjaGVzQmVzdFttYXRjaGVzSW5kZXhdID09PSBpKSB7XG5cdCAgICAgICAgICAgICAgKyttYXRjaGVzSW5kZXg7XG5cblx0ICAgICAgICAgICAgICBpZiAoIW9wZW5lZCkge1xuXHQgICAgICAgICAgICAgICAgb3BlbmVkID0gdHJ1ZTtcblx0ICAgICAgICAgICAgICAgIGhpZ2hsaWdodGVkICs9IGhPcGVuO1xuXHQgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgIGlmIChtYXRjaGVzSW5kZXggPT09IG1hdGNoZXNCZXN0Lmxlbmd0aCkge1xuXHQgICAgICAgICAgICAgICAgaGlnaGxpZ2h0ZWQgKz0gY2hhciArIGhDbG9zZSArIHRhcmdldC5zdWJzdHIoaSArIDEpO1xuXHQgICAgICAgICAgICAgICAgYnJlYWs7XG5cdCAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgIGlmIChvcGVuZWQpIHtcblx0ICAgICAgICAgICAgICAgIG9wZW5lZCA9IGZhbHNlO1xuXHQgICAgICAgICAgICAgICAgaGlnaGxpZ2h0ZWQgKz0gaENsb3NlO1xuXHQgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIGhpZ2hsaWdodGVkICs9IGNoYXI7XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIHJldHVybiBoaWdobGlnaHRlZDtcblx0ICAgICAgICB9LFxuXHQgICAgICAgIHByZXBhcmU6IGZ1bmN0aW9uICh0YXJnZXQpIHtcblx0ICAgICAgICAgIGlmICghdGFyZ2V0KSByZXR1cm47XG5cdCAgICAgICAgICByZXR1cm4ge1xuXHQgICAgICAgICAgICB0YXJnZXQ6IHRhcmdldCxcblx0ICAgICAgICAgICAgX3RhcmdldExvd2VyQ29kZXM6IGZ1enp5c29ydC5wcmVwYXJlTG93ZXJDb2Rlcyh0YXJnZXQpLFxuXHQgICAgICAgICAgICBfbmV4dEJlZ2lubmluZ0luZGV4ZXM6IG51bGwsXG5cdCAgICAgICAgICAgIHNjb3JlOiBudWxsLFxuXHQgICAgICAgICAgICBpbmRleGVzOiBudWxsLFxuXHQgICAgICAgICAgICBvYmo6IG51bGxcblx0ICAgICAgICAgIH07IC8vIGhpZGRlblxuXHQgICAgICAgIH0sXG5cdCAgICAgICAgcHJlcGFyZVNsb3c6IGZ1bmN0aW9uICh0YXJnZXQpIHtcblx0ICAgICAgICAgIGlmICghdGFyZ2V0KSByZXR1cm47XG5cdCAgICAgICAgICByZXR1cm4ge1xuXHQgICAgICAgICAgICB0YXJnZXQ6IHRhcmdldCxcblx0ICAgICAgICAgICAgX3RhcmdldExvd2VyQ29kZXM6IGZ1enp5c29ydC5wcmVwYXJlTG93ZXJDb2Rlcyh0YXJnZXQpLFxuXHQgICAgICAgICAgICBfbmV4dEJlZ2lubmluZ0luZGV4ZXM6IGZ1enp5c29ydC5wcmVwYXJlTmV4dEJlZ2lubmluZ0luZGV4ZXModGFyZ2V0KSxcblx0ICAgICAgICAgICAgc2NvcmU6IG51bGwsXG5cdCAgICAgICAgICAgIGluZGV4ZXM6IG51bGwsXG5cdCAgICAgICAgICAgIG9iajogbnVsbFxuXHQgICAgICAgICAgfTsgLy8gaGlkZGVuXG5cdCAgICAgICAgfSxcblx0ICAgICAgICBwcmVwYXJlU2VhcmNoOiBmdW5jdGlvbiAoc2VhcmNoKSB7XG5cdCAgICAgICAgICBpZiAoIXNlYXJjaCkgcmV0dXJuO1xuXHQgICAgICAgICAgcmV0dXJuIGZ1enp5c29ydC5wcmVwYXJlTG93ZXJDb2RlcyhzZWFyY2gpO1xuXHQgICAgICAgIH0sXG5cdCAgICAgICAgLy8gQmVsb3cgdGhpcyBwb2ludCBpcyBvbmx5IGludGVybmFsIGNvZGVcblx0ICAgICAgICAvLyBCZWxvdyB0aGlzIHBvaW50IGlzIG9ubHkgaW50ZXJuYWwgY29kZVxuXHQgICAgICAgIC8vIEJlbG93IHRoaXMgcG9pbnQgaXMgb25seSBpbnRlcm5hbCBjb2RlXG5cdCAgICAgICAgLy8gQmVsb3cgdGhpcyBwb2ludCBpcyBvbmx5IGludGVybmFsIGNvZGVcblx0ICAgICAgICBnZXRQcmVwYXJlZDogZnVuY3Rpb24gKHRhcmdldCkge1xuXHQgICAgICAgICAgaWYgKHRhcmdldC5sZW5ndGggPiA5OTkpIHJldHVybiBmdXp6eXNvcnQucHJlcGFyZSh0YXJnZXQpOyAvLyBkb24ndCBjYWNoZSBodWdlIHRhcmdldHNcblxuXHQgICAgICAgICAgdmFyIHRhcmdldFByZXBhcmVkID0gcHJlcGFyZWRDYWNoZS5nZXQodGFyZ2V0KTtcblx0ICAgICAgICAgIGlmICh0YXJnZXRQcmVwYXJlZCAhPT0gdW5kZWZpbmVkKSByZXR1cm4gdGFyZ2V0UHJlcGFyZWQ7XG5cdCAgICAgICAgICB0YXJnZXRQcmVwYXJlZCA9IGZ1enp5c29ydC5wcmVwYXJlKHRhcmdldCk7XG5cdCAgICAgICAgICBwcmVwYXJlZENhY2hlLnNldCh0YXJnZXQsIHRhcmdldFByZXBhcmVkKTtcblx0ICAgICAgICAgIHJldHVybiB0YXJnZXRQcmVwYXJlZDtcblx0ICAgICAgICB9LFxuXHQgICAgICAgIGdldFByZXBhcmVkU2VhcmNoOiBmdW5jdGlvbiAoc2VhcmNoKSB7XG5cdCAgICAgICAgICBpZiAoc2VhcmNoLmxlbmd0aCA+IDk5OSkgcmV0dXJuIGZ1enp5c29ydC5wcmVwYXJlU2VhcmNoKHNlYXJjaCk7IC8vIGRvbid0IGNhY2hlIGh1Z2Ugc2VhcmNoZXNcblxuXHQgICAgICAgICAgdmFyIHNlYXJjaFByZXBhcmVkID0gcHJlcGFyZWRTZWFyY2hDYWNoZS5nZXQoc2VhcmNoKTtcblx0ICAgICAgICAgIGlmIChzZWFyY2hQcmVwYXJlZCAhPT0gdW5kZWZpbmVkKSByZXR1cm4gc2VhcmNoUHJlcGFyZWQ7XG5cdCAgICAgICAgICBzZWFyY2hQcmVwYXJlZCA9IGZ1enp5c29ydC5wcmVwYXJlU2VhcmNoKHNlYXJjaCk7XG5cdCAgICAgICAgICBwcmVwYXJlZFNlYXJjaENhY2hlLnNldChzZWFyY2gsIHNlYXJjaFByZXBhcmVkKTtcblx0ICAgICAgICAgIHJldHVybiBzZWFyY2hQcmVwYXJlZDtcblx0ICAgICAgICB9LFxuXHQgICAgICAgIGFsZ29yaXRobTogZnVuY3Rpb24gKHNlYXJjaExvd2VyQ29kZXMsIHByZXBhcmVkLCBzZWFyY2hMb3dlckNvZGUpIHtcblx0ICAgICAgICAgIHZhciB0YXJnZXRMb3dlckNvZGVzID0gcHJlcGFyZWQuX3RhcmdldExvd2VyQ29kZXM7XG5cdCAgICAgICAgICB2YXIgc2VhcmNoTGVuID0gc2VhcmNoTG93ZXJDb2Rlcy5sZW5ndGg7XG5cdCAgICAgICAgICB2YXIgdGFyZ2V0TGVuID0gdGFyZ2V0TG93ZXJDb2Rlcy5sZW5ndGg7XG5cdCAgICAgICAgICB2YXIgc2VhcmNoSSA9IDA7IC8vIHdoZXJlIHdlIGF0XG5cblx0ICAgICAgICAgIHZhciB0YXJnZXRJID0gMDsgLy8gd2hlcmUgeW91IGF0XG5cblx0ICAgICAgICAgIHZhciB0eXBvU2ltcGxlSSA9IDA7XG5cdCAgICAgICAgICB2YXIgbWF0Y2hlc1NpbXBsZUxlbiA9IDA7IC8vIHZlcnkgYmFzaWMgZnV6enkgbWF0Y2g7IHRvIHJlbW92ZSBub24tbWF0Y2hpbmcgdGFyZ2V0cyBBU0FQIVxuXHQgICAgICAgICAgLy8gd2FsayB0aHJvdWdoIHRhcmdldC4gZmluZCBzZXF1ZW50aWFsIG1hdGNoZXMuXG5cdCAgICAgICAgICAvLyBpZiBhbGwgY2hhcnMgYXJlbid0IGZvdW5kIHRoZW4gZXhpdFxuXG5cdCAgICAgICAgICBmb3IgKDs7KSB7XG5cdCAgICAgICAgICAgIHZhciBpc01hdGNoID0gc2VhcmNoTG93ZXJDb2RlID09PSB0YXJnZXRMb3dlckNvZGVzW3RhcmdldEldO1xuXG5cdCAgICAgICAgICAgIGlmIChpc01hdGNoKSB7XG5cdCAgICAgICAgICAgICAgbWF0Y2hlc1NpbXBsZVttYXRjaGVzU2ltcGxlTGVuKytdID0gdGFyZ2V0STtcblx0ICAgICAgICAgICAgICArK3NlYXJjaEk7XG5cdCAgICAgICAgICAgICAgaWYgKHNlYXJjaEkgPT09IHNlYXJjaExlbikgYnJlYWs7XG5cdCAgICAgICAgICAgICAgc2VhcmNoTG93ZXJDb2RlID0gc2VhcmNoTG93ZXJDb2Rlc1t0eXBvU2ltcGxlSSA9PT0gMCA/IHNlYXJjaEkgOiB0eXBvU2ltcGxlSSA9PT0gc2VhcmNoSSA/IHNlYXJjaEkgKyAxIDogdHlwb1NpbXBsZUkgPT09IHNlYXJjaEkgLSAxID8gc2VhcmNoSSAtIDEgOiBzZWFyY2hJXTtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICsrdGFyZ2V0STtcblxuXHQgICAgICAgICAgICBpZiAodGFyZ2V0SSA+PSB0YXJnZXRMZW4pIHtcblx0ICAgICAgICAgICAgICAvLyBGYWlsZWQgdG8gZmluZCBzZWFyY2hJXG5cdCAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHR5cG8gb3IgZXhpdFxuXHQgICAgICAgICAgICAgIC8vIHdlIGdvIGFzIGZhciBhcyBwb3NzaWJsZSBiZWZvcmUgdHJ5aW5nIHRvIHRyYW5zcG9zZVxuXHQgICAgICAgICAgICAgIC8vIHRoZW4gd2UgdHJhbnNwb3NlIGJhY2t3YXJkcyB1bnRpbCB3ZSByZWFjaCB0aGUgYmVnaW5uaW5nXG5cdCAgICAgICAgICAgICAgZm9yICg7Oykge1xuXHQgICAgICAgICAgICAgICAgaWYgKHNlYXJjaEkgPD0gMSkgcmV0dXJuIG51bGw7IC8vIG5vdCBhbGxvd2VkIHRvIHRyYW5zcG9zZSBmaXJzdCBjaGFyXG5cblx0ICAgICAgICAgICAgICAgIGlmICh0eXBvU2ltcGxlSSA9PT0gMCkge1xuXHQgICAgICAgICAgICAgICAgICAvLyB3ZSBoYXZlbid0IHRyaWVkIHRvIHRyYW5zcG9zZSB5ZXRcblx0ICAgICAgICAgICAgICAgICAgLS1zZWFyY2hJO1xuXHQgICAgICAgICAgICAgICAgICB2YXIgc2VhcmNoTG93ZXJDb2RlTmV3ID0gc2VhcmNoTG93ZXJDb2Rlc1tzZWFyY2hJXTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKHNlYXJjaExvd2VyQ29kZSA9PT0gc2VhcmNoTG93ZXJDb2RlTmV3KSBjb250aW51ZTsgLy8gZG9lc24ndCBtYWtlIHNlbnNlIHRvIHRyYW5zcG9zZSBhIHJlcGVhdCBjaGFyXG5cblx0ICAgICAgICAgICAgICAgICAgdHlwb1NpbXBsZUkgPSBzZWFyY2hJO1xuXHQgICAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgICAgaWYgKHR5cG9TaW1wbGVJID09PSAxKSByZXR1cm4gbnVsbDsgLy8gcmVhY2hlZCB0aGUgZW5kIG9mIHRoZSBsaW5lIGZvciB0cmFuc3Bvc2luZ1xuXG5cdCAgICAgICAgICAgICAgICAgIC0tdHlwb1NpbXBsZUk7XG5cdCAgICAgICAgICAgICAgICAgIHNlYXJjaEkgPSB0eXBvU2ltcGxlSTtcblx0ICAgICAgICAgICAgICAgICAgc2VhcmNoTG93ZXJDb2RlID0gc2VhcmNoTG93ZXJDb2Rlc1tzZWFyY2hJICsgMV07XG5cdCAgICAgICAgICAgICAgICAgIHZhciBzZWFyY2hMb3dlckNvZGVOZXcgPSBzZWFyY2hMb3dlckNvZGVzW3NlYXJjaEldO1xuXHQgICAgICAgICAgICAgICAgICBpZiAoc2VhcmNoTG93ZXJDb2RlID09PSBzZWFyY2hMb3dlckNvZGVOZXcpIGNvbnRpbnVlOyAvLyBkb2Vzbid0IG1ha2Ugc2Vuc2UgdG8gdHJhbnNwb3NlIGEgcmVwZWF0IGNoYXJcblx0ICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgbWF0Y2hlc1NpbXBsZUxlbiA9IHNlYXJjaEk7XG5cdCAgICAgICAgICAgICAgICB0YXJnZXRJID0gbWF0Y2hlc1NpbXBsZVttYXRjaGVzU2ltcGxlTGVuIC0gMV0gKyAxO1xuXHQgICAgICAgICAgICAgICAgYnJlYWs7XG5cdCAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIHZhciBzZWFyY2hJID0gMDtcblx0ICAgICAgICAgIHZhciB0eXBvU3RyaWN0SSA9IDA7XG5cdCAgICAgICAgICB2YXIgc3VjY2Vzc1N0cmljdCA9IGZhbHNlO1xuXHQgICAgICAgICAgdmFyIG1hdGNoZXNTdHJpY3RMZW4gPSAwO1xuXHQgICAgICAgICAgdmFyIG5leHRCZWdpbm5pbmdJbmRleGVzID0gcHJlcGFyZWQuX25leHRCZWdpbm5pbmdJbmRleGVzO1xuXHQgICAgICAgICAgaWYgKG5leHRCZWdpbm5pbmdJbmRleGVzID09PSBudWxsKSBuZXh0QmVnaW5uaW5nSW5kZXhlcyA9IHByZXBhcmVkLl9uZXh0QmVnaW5uaW5nSW5kZXhlcyA9IGZ1enp5c29ydC5wcmVwYXJlTmV4dEJlZ2lubmluZ0luZGV4ZXMocHJlcGFyZWQudGFyZ2V0KTtcblx0ICAgICAgICAgIHZhciBmaXJzdFBvc3NpYmxlSSA9IHRhcmdldEkgPSBtYXRjaGVzU2ltcGxlWzBdID09PSAwID8gMCA6IG5leHRCZWdpbm5pbmdJbmRleGVzW21hdGNoZXNTaW1wbGVbMF0gLSAxXTsgLy8gT3VyIHRhcmdldCBzdHJpbmcgc3VjY2Vzc2Z1bGx5IG1hdGNoZWQgYWxsIGNoYXJhY3RlcnMgaW4gc2VxdWVuY2UhXG5cdCAgICAgICAgICAvLyBMZXQncyB0cnkgYSBtb3JlIGFkdmFuY2VkIGFuZCBzdHJpY3QgdGVzdCB0byBpbXByb3ZlIHRoZSBzY29yZVxuXHQgICAgICAgICAgLy8gb25seSBjb3VudCBpdCBhcyBhIG1hdGNoIGlmIGl0J3MgY29uc2VjdXRpdmUgb3IgYSBiZWdpbm5pbmcgY2hhcmFjdGVyIVxuXG5cdCAgICAgICAgICBpZiAodGFyZ2V0SSAhPT0gdGFyZ2V0TGVuKSBmb3IgKDs7KSB7XG5cdCAgICAgICAgICAgIGlmICh0YXJnZXRJID49IHRhcmdldExlbikge1xuXHQgICAgICAgICAgICAgIC8vIFdlIGZhaWxlZCB0byBmaW5kIGEgZ29vZCBzcG90IGZvciB0aGlzIHNlYXJjaCBjaGFyLCBnbyBiYWNrIHRvIHRoZSBwcmV2aW91cyBzZWFyY2ggY2hhciBhbmQgZm9yY2UgaXQgZm9yd2FyZFxuXHQgICAgICAgICAgICAgIGlmIChzZWFyY2hJIDw9IDApIHtcblx0ICAgICAgICAgICAgICAgIC8vIFdlIGZhaWxlZCB0byBwdXNoIGNoYXJzIGZvcndhcmQgZm9yIGEgYmV0dGVyIG1hdGNoXG5cdCAgICAgICAgICAgICAgICAvLyB0cmFuc3Bvc2UsIHN0YXJ0aW5nIGZyb20gdGhlIGJlZ2lubmluZ1xuXHQgICAgICAgICAgICAgICAgKyt0eXBvU3RyaWN0STtcblx0ICAgICAgICAgICAgICAgIGlmICh0eXBvU3RyaWN0SSA+IHNlYXJjaExlbiAtIDIpIGJyZWFrO1xuXHQgICAgICAgICAgICAgICAgaWYgKHNlYXJjaExvd2VyQ29kZXNbdHlwb1N0cmljdEldID09PSBzZWFyY2hMb3dlckNvZGVzW3R5cG9TdHJpY3RJICsgMV0pIGNvbnRpbnVlOyAvLyBkb2Vzbid0IG1ha2Ugc2Vuc2UgdG8gdHJhbnNwb3NlIGEgcmVwZWF0IGNoYXJcblxuXHQgICAgICAgICAgICAgICAgdGFyZ2V0SSA9IGZpcnN0UG9zc2libGVJO1xuXHQgICAgICAgICAgICAgICAgY29udGludWU7XG5cdCAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgLS1zZWFyY2hJO1xuXHQgICAgICAgICAgICAgIHZhciBsYXN0TWF0Y2ggPSBtYXRjaGVzU3RyaWN0Wy0tbWF0Y2hlc1N0cmljdExlbl07XG5cdCAgICAgICAgICAgICAgdGFyZ2V0SSA9IG5leHRCZWdpbm5pbmdJbmRleGVzW2xhc3RNYXRjaF07XG5cdCAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgdmFyIGlzTWF0Y2ggPSBzZWFyY2hMb3dlckNvZGVzW3R5cG9TdHJpY3RJID09PSAwID8gc2VhcmNoSSA6IHR5cG9TdHJpY3RJID09PSBzZWFyY2hJID8gc2VhcmNoSSArIDEgOiB0eXBvU3RyaWN0SSA9PT0gc2VhcmNoSSAtIDEgPyBzZWFyY2hJIC0gMSA6IHNlYXJjaEldID09PSB0YXJnZXRMb3dlckNvZGVzW3RhcmdldEldO1xuXG5cdCAgICAgICAgICAgICAgaWYgKGlzTWF0Y2gpIHtcblx0ICAgICAgICAgICAgICAgIG1hdGNoZXNTdHJpY3RbbWF0Y2hlc1N0cmljdExlbisrXSA9IHRhcmdldEk7XG5cdCAgICAgICAgICAgICAgICArK3NlYXJjaEk7XG5cblx0ICAgICAgICAgICAgICAgIGlmIChzZWFyY2hJID09PSBzZWFyY2hMZW4pIHtcblx0ICAgICAgICAgICAgICAgICAgc3VjY2Vzc1N0cmljdCA9IHRydWU7XG5cdCAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXHQgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICArK3RhcmdldEk7XG5cdCAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgIHRhcmdldEkgPSBuZXh0QmVnaW5uaW5nSW5kZXhlc1t0YXJnZXRJXTtcblx0ICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblx0ICAgICAgICAgIHtcblx0ICAgICAgICAgICAgLy8gdGFsbHkgdXAgdGhlIHNjb3JlICYga2VlcCB0cmFjayBvZiBtYXRjaGVzIGZvciBoaWdobGlnaHRpbmcgbGF0ZXJcblx0ICAgICAgICAgICAgaWYgKHN1Y2Nlc3NTdHJpY3QpIHtcblx0ICAgICAgICAgICAgICB2YXIgbWF0Y2hlc0Jlc3QgPSBtYXRjaGVzU3RyaWN0O1xuXHQgICAgICAgICAgICAgIHZhciBtYXRjaGVzQmVzdExlbiA9IG1hdGNoZXNTdHJpY3RMZW47XG5cdCAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgdmFyIG1hdGNoZXNCZXN0ID0gbWF0Y2hlc1NpbXBsZTtcblx0ICAgICAgICAgICAgICB2YXIgbWF0Y2hlc0Jlc3RMZW4gPSBtYXRjaGVzU2ltcGxlTGVuO1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgdmFyIHNjb3JlID0gMDtcblx0ICAgICAgICAgICAgdmFyIGxhc3RUYXJnZXRJID0gLTE7XG5cblx0ICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWFyY2hMZW47ICsraSkge1xuXHQgICAgICAgICAgICAgIHZhciB0YXJnZXRJID0gbWF0Y2hlc0Jlc3RbaV07IC8vIHNjb3JlIG9ubHkgZ29lcyBkb3duIGlmIHRoZXkncmUgbm90IGNvbnNlY3V0aXZlXG5cblx0ICAgICAgICAgICAgICBpZiAobGFzdFRhcmdldEkgIT09IHRhcmdldEkgLSAxKSBzY29yZSAtPSB0YXJnZXRJO1xuXHQgICAgICAgICAgICAgIGxhc3RUYXJnZXRJID0gdGFyZ2V0STtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIGlmICghc3VjY2Vzc1N0cmljdCkge1xuXHQgICAgICAgICAgICAgIHNjb3JlICo9IDEwMDA7XG5cdCAgICAgICAgICAgICAgaWYgKHR5cG9TaW1wbGVJICE9PSAwKSBzY29yZSArPSAtMjA7XG5cdCAgICAgICAgICAgICAgLyp0eXBvUGVuYWx0eSovXG5cdCAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgaWYgKHR5cG9TdHJpY3RJICE9PSAwKSBzY29yZSArPSAtMjA7XG5cdCAgICAgICAgICAgICAgLyp0eXBvUGVuYWx0eSovXG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICBzY29yZSAtPSB0YXJnZXRMZW4gLSBzZWFyY2hMZW47XG5cdCAgICAgICAgICAgIHByZXBhcmVkLnNjb3JlID0gc2NvcmU7XG5cdCAgICAgICAgICAgIHByZXBhcmVkLmluZGV4ZXMgPSBuZXcgQXJyYXkobWF0Y2hlc0Jlc3RMZW4pO1xuXG5cdCAgICAgICAgICAgIGZvciAodmFyIGkgPSBtYXRjaGVzQmVzdExlbiAtIDE7IGkgPj0gMDsgLS1pKSBwcmVwYXJlZC5pbmRleGVzW2ldID0gbWF0Y2hlc0Jlc3RbaV07XG5cblx0ICAgICAgICAgICAgcmV0dXJuIHByZXBhcmVkO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0sXG5cdCAgICAgICAgYWxnb3JpdGhtTm9UeXBvOiBmdW5jdGlvbiAoc2VhcmNoTG93ZXJDb2RlcywgcHJlcGFyZWQsIHNlYXJjaExvd2VyQ29kZSkge1xuXHQgICAgICAgICAgdmFyIHRhcmdldExvd2VyQ29kZXMgPSBwcmVwYXJlZC5fdGFyZ2V0TG93ZXJDb2Rlcztcblx0ICAgICAgICAgIHZhciBzZWFyY2hMZW4gPSBzZWFyY2hMb3dlckNvZGVzLmxlbmd0aDtcblx0ICAgICAgICAgIHZhciB0YXJnZXRMZW4gPSB0YXJnZXRMb3dlckNvZGVzLmxlbmd0aDtcblx0ICAgICAgICAgIHZhciBzZWFyY2hJID0gMDsgLy8gd2hlcmUgd2UgYXRcblxuXHQgICAgICAgICAgdmFyIHRhcmdldEkgPSAwOyAvLyB3aGVyZSB5b3UgYXRcblxuXHQgICAgICAgICAgdmFyIG1hdGNoZXNTaW1wbGVMZW4gPSAwOyAvLyB2ZXJ5IGJhc2ljIGZ1enp5IG1hdGNoOyB0byByZW1vdmUgbm9uLW1hdGNoaW5nIHRhcmdldHMgQVNBUCFcblx0ICAgICAgICAgIC8vIHdhbGsgdGhyb3VnaCB0YXJnZXQuIGZpbmQgc2VxdWVudGlhbCBtYXRjaGVzLlxuXHQgICAgICAgICAgLy8gaWYgYWxsIGNoYXJzIGFyZW4ndCBmb3VuZCB0aGVuIGV4aXRcblxuXHQgICAgICAgICAgZm9yICg7Oykge1xuXHQgICAgICAgICAgICB2YXIgaXNNYXRjaCA9IHNlYXJjaExvd2VyQ29kZSA9PT0gdGFyZ2V0TG93ZXJDb2Rlc1t0YXJnZXRJXTtcblxuXHQgICAgICAgICAgICBpZiAoaXNNYXRjaCkge1xuXHQgICAgICAgICAgICAgIG1hdGNoZXNTaW1wbGVbbWF0Y2hlc1NpbXBsZUxlbisrXSA9IHRhcmdldEk7XG5cdCAgICAgICAgICAgICAgKytzZWFyY2hJO1xuXHQgICAgICAgICAgICAgIGlmIChzZWFyY2hJID09PSBzZWFyY2hMZW4pIGJyZWFrO1xuXHQgICAgICAgICAgICAgIHNlYXJjaExvd2VyQ29kZSA9IHNlYXJjaExvd2VyQ29kZXNbc2VhcmNoSV07XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICArK3RhcmdldEk7XG5cdCAgICAgICAgICAgIGlmICh0YXJnZXRJID49IHRhcmdldExlbikgcmV0dXJuIG51bGw7IC8vIEZhaWxlZCB0byBmaW5kIHNlYXJjaElcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgdmFyIHNlYXJjaEkgPSAwO1xuXHQgICAgICAgICAgdmFyIHN1Y2Nlc3NTdHJpY3QgPSBmYWxzZTtcblx0ICAgICAgICAgIHZhciBtYXRjaGVzU3RyaWN0TGVuID0gMDtcblx0ICAgICAgICAgIHZhciBuZXh0QmVnaW5uaW5nSW5kZXhlcyA9IHByZXBhcmVkLl9uZXh0QmVnaW5uaW5nSW5kZXhlcztcblx0ICAgICAgICAgIGlmIChuZXh0QmVnaW5uaW5nSW5kZXhlcyA9PT0gbnVsbCkgbmV4dEJlZ2lubmluZ0luZGV4ZXMgPSBwcmVwYXJlZC5fbmV4dEJlZ2lubmluZ0luZGV4ZXMgPSBmdXp6eXNvcnQucHJlcGFyZU5leHRCZWdpbm5pbmdJbmRleGVzKHByZXBhcmVkLnRhcmdldCk7XG5cdCAgICAgICAgICB2YXIgZmlyc3RQb3NzaWJsZUkgPSB0YXJnZXRJID0gbWF0Y2hlc1NpbXBsZVswXSA9PT0gMCA/IDAgOiBuZXh0QmVnaW5uaW5nSW5kZXhlc1ttYXRjaGVzU2ltcGxlWzBdIC0gMV07IC8vIE91ciB0YXJnZXQgc3RyaW5nIHN1Y2Nlc3NmdWxseSBtYXRjaGVkIGFsbCBjaGFyYWN0ZXJzIGluIHNlcXVlbmNlIVxuXHQgICAgICAgICAgLy8gTGV0J3MgdHJ5IGEgbW9yZSBhZHZhbmNlZCBhbmQgc3RyaWN0IHRlc3QgdG8gaW1wcm92ZSB0aGUgc2NvcmVcblx0ICAgICAgICAgIC8vIG9ubHkgY291bnQgaXQgYXMgYSBtYXRjaCBpZiBpdCdzIGNvbnNlY3V0aXZlIG9yIGEgYmVnaW5uaW5nIGNoYXJhY3RlciFcblxuXHQgICAgICAgICAgaWYgKHRhcmdldEkgIT09IHRhcmdldExlbikgZm9yICg7Oykge1xuXHQgICAgICAgICAgICBpZiAodGFyZ2V0SSA+PSB0YXJnZXRMZW4pIHtcblx0ICAgICAgICAgICAgICAvLyBXZSBmYWlsZWQgdG8gZmluZCBhIGdvb2Qgc3BvdCBmb3IgdGhpcyBzZWFyY2ggY2hhciwgZ28gYmFjayB0byB0aGUgcHJldmlvdXMgc2VhcmNoIGNoYXIgYW5kIGZvcmNlIGl0IGZvcndhcmRcblx0ICAgICAgICAgICAgICBpZiAoc2VhcmNoSSA8PSAwKSBicmVhazsgLy8gV2UgZmFpbGVkIHRvIHB1c2ggY2hhcnMgZm9yd2FyZCBmb3IgYSBiZXR0ZXIgbWF0Y2hcblxuXHQgICAgICAgICAgICAgIC0tc2VhcmNoSTtcblx0ICAgICAgICAgICAgICB2YXIgbGFzdE1hdGNoID0gbWF0Y2hlc1N0cmljdFstLW1hdGNoZXNTdHJpY3RMZW5dO1xuXHQgICAgICAgICAgICAgIHRhcmdldEkgPSBuZXh0QmVnaW5uaW5nSW5kZXhlc1tsYXN0TWF0Y2hdO1xuXHQgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgIHZhciBpc01hdGNoID0gc2VhcmNoTG93ZXJDb2Rlc1tzZWFyY2hJXSA9PT0gdGFyZ2V0TG93ZXJDb2Rlc1t0YXJnZXRJXTtcblxuXHQgICAgICAgICAgICAgIGlmIChpc01hdGNoKSB7XG5cdCAgICAgICAgICAgICAgICBtYXRjaGVzU3RyaWN0W21hdGNoZXNTdHJpY3RMZW4rK10gPSB0YXJnZXRJO1xuXHQgICAgICAgICAgICAgICAgKytzZWFyY2hJO1xuXG5cdCAgICAgICAgICAgICAgICBpZiAoc2VhcmNoSSA9PT0gc2VhcmNoTGVuKSB7XG5cdCAgICAgICAgICAgICAgICAgIHN1Y2Nlc3NTdHJpY3QgPSB0cnVlO1xuXHQgICAgICAgICAgICAgICAgICBicmVhaztcblx0ICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgKyt0YXJnZXRJO1xuXHQgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICB0YXJnZXRJID0gbmV4dEJlZ2lubmluZ0luZGV4ZXNbdGFyZ2V0SV07XG5cdCAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgICB7XG5cdCAgICAgICAgICAgIC8vIHRhbGx5IHVwIHRoZSBzY29yZSAmIGtlZXAgdHJhY2sgb2YgbWF0Y2hlcyBmb3IgaGlnaGxpZ2h0aW5nIGxhdGVyXG5cdCAgICAgICAgICAgIGlmIChzdWNjZXNzU3RyaWN0KSB7XG5cdCAgICAgICAgICAgICAgdmFyIG1hdGNoZXNCZXN0ID0gbWF0Y2hlc1N0cmljdDtcblx0ICAgICAgICAgICAgICB2YXIgbWF0Y2hlc0Jlc3RMZW4gPSBtYXRjaGVzU3RyaWN0TGVuO1xuXHQgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgIHZhciBtYXRjaGVzQmVzdCA9IG1hdGNoZXNTaW1wbGU7XG5cdCAgICAgICAgICAgICAgdmFyIG1hdGNoZXNCZXN0TGVuID0gbWF0Y2hlc1NpbXBsZUxlbjtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIHZhciBzY29yZSA9IDA7XG5cdCAgICAgICAgICAgIHZhciBsYXN0VGFyZ2V0SSA9IC0xO1xuXG5cdCAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VhcmNoTGVuOyArK2kpIHtcblx0ICAgICAgICAgICAgICB2YXIgdGFyZ2V0SSA9IG1hdGNoZXNCZXN0W2ldOyAvLyBzY29yZSBvbmx5IGdvZXMgZG93biBpZiB0aGV5J3JlIG5vdCBjb25zZWN1dGl2ZVxuXG5cdCAgICAgICAgICAgICAgaWYgKGxhc3RUYXJnZXRJICE9PSB0YXJnZXRJIC0gMSkgc2NvcmUgLT0gdGFyZ2V0STtcblx0ICAgICAgICAgICAgICBsYXN0VGFyZ2V0SSA9IHRhcmdldEk7XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICBpZiAoIXN1Y2Nlc3NTdHJpY3QpIHNjb3JlICo9IDEwMDA7XG5cdCAgICAgICAgICAgIHNjb3JlIC09IHRhcmdldExlbiAtIHNlYXJjaExlbjtcblx0ICAgICAgICAgICAgcHJlcGFyZWQuc2NvcmUgPSBzY29yZTtcblx0ICAgICAgICAgICAgcHJlcGFyZWQuaW5kZXhlcyA9IG5ldyBBcnJheShtYXRjaGVzQmVzdExlbik7XG5cblx0ICAgICAgICAgICAgZm9yICh2YXIgaSA9IG1hdGNoZXNCZXN0TGVuIC0gMTsgaSA+PSAwOyAtLWkpIHByZXBhcmVkLmluZGV4ZXNbaV0gPSBtYXRjaGVzQmVzdFtpXTtcblxuXHQgICAgICAgICAgICByZXR1cm4gcHJlcGFyZWQ7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBwcmVwYXJlTG93ZXJDb2RlczogZnVuY3Rpb24gKHN0cikge1xuXHQgICAgICAgICAgdmFyIHN0ckxlbiA9IHN0ci5sZW5ndGg7XG5cdCAgICAgICAgICB2YXIgbG93ZXJDb2RlcyA9IFtdOyAvLyBuZXcgQXJyYXkoc3RyTGVuKSAgICBzcGFyc2UgYXJyYXkgaXMgdG9vIHNsb3dcblxuXHQgICAgICAgICAgdmFyIGxvd2VyID0gc3RyLnRvTG93ZXJDYXNlKCk7XG5cblx0ICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyTGVuOyArK2kpIGxvd2VyQ29kZXNbaV0gPSBsb3dlci5jaGFyQ29kZUF0KGkpO1xuXG5cdCAgICAgICAgICByZXR1cm4gbG93ZXJDb2Rlcztcblx0ICAgICAgICB9LFxuXHQgICAgICAgIHByZXBhcmVCZWdpbm5pbmdJbmRleGVzOiBmdW5jdGlvbiAodGFyZ2V0KSB7XG5cdCAgICAgICAgICB2YXIgdGFyZ2V0TGVuID0gdGFyZ2V0Lmxlbmd0aDtcblx0ICAgICAgICAgIHZhciBiZWdpbm5pbmdJbmRleGVzID0gW107XG5cdCAgICAgICAgICB2YXIgYmVnaW5uaW5nSW5kZXhlc0xlbiA9IDA7XG5cdCAgICAgICAgICB2YXIgd2FzVXBwZXIgPSBmYWxzZTtcblx0ICAgICAgICAgIHZhciB3YXNBbHBoYW51bSA9IGZhbHNlO1xuXG5cdCAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRhcmdldExlbjsgKytpKSB7XG5cdCAgICAgICAgICAgIHZhciB0YXJnZXRDb2RlID0gdGFyZ2V0LmNoYXJDb2RlQXQoaSk7XG5cdCAgICAgICAgICAgIHZhciBpc1VwcGVyID0gdGFyZ2V0Q29kZSA+PSA2NSAmJiB0YXJnZXRDb2RlIDw9IDkwO1xuXHQgICAgICAgICAgICB2YXIgaXNBbHBoYW51bSA9IGlzVXBwZXIgfHwgdGFyZ2V0Q29kZSA+PSA5NyAmJiB0YXJnZXRDb2RlIDw9IDEyMiB8fCB0YXJnZXRDb2RlID49IDQ4ICYmIHRhcmdldENvZGUgPD0gNTc7XG5cdCAgICAgICAgICAgIHZhciBpc0JlZ2lubmluZyA9IGlzVXBwZXIgJiYgIXdhc1VwcGVyIHx8ICF3YXNBbHBoYW51bSB8fCAhaXNBbHBoYW51bTtcblx0ICAgICAgICAgICAgd2FzVXBwZXIgPSBpc1VwcGVyO1xuXHQgICAgICAgICAgICB3YXNBbHBoYW51bSA9IGlzQWxwaGFudW07XG5cdCAgICAgICAgICAgIGlmIChpc0JlZ2lubmluZykgYmVnaW5uaW5nSW5kZXhlc1tiZWdpbm5pbmdJbmRleGVzTGVuKytdID0gaTtcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgcmV0dXJuIGJlZ2lubmluZ0luZGV4ZXM7XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBwcmVwYXJlTmV4dEJlZ2lubmluZ0luZGV4ZXM6IGZ1bmN0aW9uICh0YXJnZXQpIHtcblx0ICAgICAgICAgIHZhciB0YXJnZXRMZW4gPSB0YXJnZXQubGVuZ3RoO1xuXHQgICAgICAgICAgdmFyIGJlZ2lubmluZ0luZGV4ZXMgPSBmdXp6eXNvcnQucHJlcGFyZUJlZ2lubmluZ0luZGV4ZXModGFyZ2V0KTtcblx0ICAgICAgICAgIHZhciBuZXh0QmVnaW5uaW5nSW5kZXhlcyA9IFtdOyAvLyBuZXcgQXJyYXkodGFyZ2V0TGVuKSAgICAgc3BhcnNlIGFycmF5IGlzIHRvbyBzbG93XG5cblx0ICAgICAgICAgIHZhciBsYXN0SXNCZWdpbm5pbmcgPSBiZWdpbm5pbmdJbmRleGVzWzBdO1xuXHQgICAgICAgICAgdmFyIGxhc3RJc0JlZ2lubmluZ0kgPSAwO1xuXG5cdCAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRhcmdldExlbjsgKytpKSB7XG5cdCAgICAgICAgICAgIGlmIChsYXN0SXNCZWdpbm5pbmcgPiBpKSB7XG5cdCAgICAgICAgICAgICAgbmV4dEJlZ2lubmluZ0luZGV4ZXNbaV0gPSBsYXN0SXNCZWdpbm5pbmc7XG5cdCAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgbGFzdElzQmVnaW5uaW5nID0gYmVnaW5uaW5nSW5kZXhlc1srK2xhc3RJc0JlZ2lubmluZ0ldO1xuXHQgICAgICAgICAgICAgIG5leHRCZWdpbm5pbmdJbmRleGVzW2ldID0gbGFzdElzQmVnaW5uaW5nID09PSB1bmRlZmluZWQgPyB0YXJnZXRMZW4gOiBsYXN0SXNCZWdpbm5pbmc7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgcmV0dXJuIG5leHRCZWdpbm5pbmdJbmRleGVzO1xuXHQgICAgICAgIH0sXG5cdCAgICAgICAgY2xlYW51cDogY2xlYW51cCxcblx0ICAgICAgICBuZXc6IGZ1enp5c29ydE5ld1xuXHQgICAgICB9O1xuXHQgICAgICByZXR1cm4gZnV6enlzb3J0O1xuXHQgICAgfSAvLyBmdXp6eXNvcnROZXdcblx0ICAgIC8vIFRoaXMgc3R1ZmYgaXMgb3V0c2lkZSBmdXp6eXNvcnROZXcsIGJlY2F1c2UgaXQncyBzaGFyZWQgd2l0aCBpbnN0YW5jZXMgb2YgZnV6enlzb3J0Lm5ldygpXG5cblxuXHQgICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBjb21tb25qc1JlcXVpcmUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnOyAvLyB2YXIgTUFYX0lOVCA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSXG5cdCAgICAvLyB2YXIgTUlOX0lOVCA9IE51bWJlci5NSU5fVkFMVUVcblxuXHQgICAgdmFyIHByZXBhcmVkQ2FjaGUgPSBuZXcgTWFwKCk7XG5cdCAgICB2YXIgcHJlcGFyZWRTZWFyY2hDYWNoZSA9IG5ldyBNYXAoKTtcblx0ICAgIHZhciBub1Jlc3VsdHMgPSBbXTtcblx0ICAgIG5vUmVzdWx0cy50b3RhbCA9IDA7XG5cdCAgICB2YXIgbWF0Y2hlc1NpbXBsZSA9IFtdO1xuXHQgICAgdmFyIG1hdGNoZXNTdHJpY3QgPSBbXTtcblxuXHQgICAgZnVuY3Rpb24gY2xlYW51cCgpIHtcblx0ICAgICAgcHJlcGFyZWRDYWNoZS5jbGVhcigpO1xuXHQgICAgICBwcmVwYXJlZFNlYXJjaENhY2hlLmNsZWFyKCk7XG5cdCAgICAgIG1hdGNoZXNTaW1wbGUgPSBbXTtcblx0ICAgICAgbWF0Y2hlc1N0cmljdCA9IFtdO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBkZWZhdWx0U2NvcmVGbihhKSB7XG5cdCAgICAgIHZhciBtYXggPSAtOTAwNzE5OTI1NDc0MDk5MTtcblxuXHQgICAgICBmb3IgKHZhciBpID0gYS5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuXHQgICAgICAgIHZhciByZXN1bHQgPSBhW2ldO1xuXHQgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwpIGNvbnRpbnVlO1xuXHQgICAgICAgIHZhciBzY29yZSA9IHJlc3VsdC5zY29yZTtcblx0ICAgICAgICBpZiAoc2NvcmUgPiBtYXgpIG1heCA9IHNjb3JlO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKG1heCA9PT0gLTkwMDcxOTkyNTQ3NDA5OTEpIHJldHVybiBudWxsO1xuXHQgICAgICByZXR1cm4gbWF4O1xuXHQgICAgfSAvLyBwcm9wID0gJ2tleScgICAgICAgICAgICAgIDIuNW1zIG9wdGltaXplZCBmb3IgdGhpcyBjYXNlLCBzZWVtcyB0byBiZSBhYm91dCBhcyBmYXN0IGFzIGRpcmVjdCBvYmpbcHJvcF1cblx0ICAgIC8vIHByb3AgPSAna2V5MS5rZXkyJyAgICAgICAgMTBtc1xuXHQgICAgLy8gcHJvcCA9IFsna2V5MScsICdrZXkyJ10gICAyN21zXG5cblxuXHQgICAgZnVuY3Rpb24gZ2V0VmFsdWUob2JqLCBwcm9wKSB7XG5cdCAgICAgIHZhciB0bXAgPSBvYmpbcHJvcF07XG5cdCAgICAgIGlmICh0bXAgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHRtcDtcblx0ICAgICAgdmFyIHNlZ3MgPSBwcm9wO1xuXHQgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJvcCkpIHNlZ3MgPSBwcm9wLnNwbGl0KCcuJyk7XG5cdCAgICAgIHZhciBsZW4gPSBzZWdzLmxlbmd0aDtcblx0ICAgICAgdmFyIGkgPSAtMTtcblxuXHQgICAgICB3aGlsZSAob2JqICYmICsraSA8IGxlbikgb2JqID0gb2JqW3NlZ3NbaV1dO1xuXG5cdCAgICAgIHJldHVybiBvYmo7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGlzT2JqKHgpIHtcblx0ICAgICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnb2JqZWN0Jztcblx0ICAgIH0gLy8gZmFzdGVyIGFzIGEgZnVuY3Rpb25cblx0ICAgIC8vIEhhY2tlZCB2ZXJzaW9uIG9mIGh0dHBzOi8vZ2l0aHViLmNvbS9sZW1pcmUvRmFzdFByaW9yaXR5UXVldWUuanNcblxuXG5cdCAgICB2YXIgZmFzdHByaW9yaXR5cXVldWUgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHZhciByID0gW10sXG5cdCAgICAgICAgICBvID0gMCxcblx0ICAgICAgICAgIGUgPSB7fTtcblxuXHQgICAgICBmdW5jdGlvbiBuKCkge1xuXHQgICAgICAgIGZvciAodmFyIGUgPSAwLCBuID0gcltlXSwgYyA9IDE7IGMgPCBvOykge1xuXHQgICAgICAgICAgdmFyIGYgPSBjICsgMTtcblx0ICAgICAgICAgIGUgPSBjLCBmIDwgbyAmJiByW2ZdLnNjb3JlIDwgcltjXS5zY29yZSAmJiAoZSA9IGYpLCByW2UgLSAxID4+IDFdID0gcltlXSwgYyA9IDEgKyAoZSA8PCAxKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBmb3IgKHZhciBhID0gZSAtIDEgPj4gMTsgZSA+IDAgJiYgbi5zY29yZSA8IHJbYV0uc2NvcmU7IGEgPSAoZSA9IGEpIC0gMSA+PiAxKSByW2VdID0gclthXTtcblxuXHQgICAgICAgIHJbZV0gPSBuO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIGUuYWRkID0gZnVuY3Rpb24gKGUpIHtcblx0ICAgICAgICB2YXIgbiA9IG87XG5cdCAgICAgICAgcltvKytdID0gZTtcblxuXHQgICAgICAgIGZvciAodmFyIGMgPSBuIC0gMSA+PiAxOyBuID4gMCAmJiBlLnNjb3JlIDwgcltjXS5zY29yZTsgYyA9IChuID0gYykgLSAxID4+IDEpIHJbbl0gPSByW2NdO1xuXG5cdCAgICAgICAgcltuXSA9IGU7XG5cdCAgICAgIH0sIGUucG9sbCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBpZiAoMCAhPT0gbykge1xuXHQgICAgICAgICAgdmFyIGUgPSByWzBdO1xuXHQgICAgICAgICAgcmV0dXJuIHJbMF0gPSByWy0tb10sIG4oKSwgZTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0sIGUucGVlayA9IGZ1bmN0aW9uIChlKSB7XG5cdCAgICAgICAgaWYgKDAgIT09IG8pIHJldHVybiByWzBdO1xuXHQgICAgICB9LCBlLnJlcGxhY2VUb3AgPSBmdW5jdGlvbiAobykge1xuXHQgICAgICAgIHJbMF0gPSBvLCBuKCk7XG5cdCAgICAgIH0sIGU7XG5cdCAgICB9O1xuXG5cdCAgICB2YXIgcSA9IGZhc3Rwcmlvcml0eXF1ZXVlKCk7IC8vIHJldXNlIHRoaXMsIGV4Y2VwdCBmb3IgYXN5bmMsIGl0IG5lZWRzIHRvIG1ha2UgaXRzIG93blxuXG5cdCAgICByZXR1cm4gZnV6enlzb3J0TmV3KCk7XG5cdCAgfSk7IC8vIFVNRFxuXHQgIC8vIFRPRE86IChwZXJmb3JtYW5jZSkgd2FzbSB2ZXJzaW9uIT9cblx0ICAvLyBUT0RPOiAocGVyZm9ybWFuY2UpIGxheW91dCBtZW1vcnkgaW4gYW4gb3B0aW1hbCB3YXkgdG8gZ28gZmFzdCBieSBhdm9pZGluZyBjYWNoZSBtaXNzZXNcblx0ICAvLyBUT0RPOiAocGVyZm9ybWFuY2UpIHByZXBhcmVkQ2FjaGUgaXMgYSBtZW1vcnkgbGVha1xuXHQgIC8vIFRPRE86IChsaWtlIHN1YmxpbWUpIGJhY2tzbGFzaCA9PT0gZm9yd2FyZHNsYXNoXG5cdCAgLy8gVE9ETzogKHBlcmZvcm1hbmNlKSBpIGhhdmUgbm8gaWRlYSBob3cgd2VsbCBvcHRpem1pZWQgdGhlIGFsbG93aW5nIHR5cG9zIGFsZ29yaXRobSBpc1xuXG5cdH0pO1xuXG5cdHZhciBzdGF0cyA9IHtcblx0ICBwYXNzZWRUZXN0czogMCxcblx0ICBmYWlsZWRUZXN0czogMCxcblx0ICBza2lwcGVkVGVzdHM6IDAsXG5cdCAgdG9kb1Rlc3RzOiAwXG5cdH07IC8vIEVzY2FwZSB0ZXh0IGZvciBhdHRyaWJ1dGUgb3IgdGV4dCBjb250ZW50LlxuXG5cdGZ1bmN0aW9uIGVzY2FwZVRleHQocykge1xuXHQgIGlmICghcykge1xuXHQgICAgcmV0dXJuIFwiXCI7XG5cdCAgfVxuXG5cdCAgcyA9IHMgKyBcIlwiOyAvLyBCb3RoIHNpbmdsZSBxdW90ZXMgYW5kIGRvdWJsZSBxdW90ZXMgKGZvciBhdHRyaWJ1dGVzKVxuXG5cdCAgcmV0dXJuIHMucmVwbGFjZSgvWydcIjw+Jl0vZywgZnVuY3Rpb24gKHMpIHtcblx0ICAgIHN3aXRjaCAocykge1xuXHQgICAgICBjYXNlIFwiJ1wiOlxuXHQgICAgICAgIHJldHVybiBcIiYjMDM5O1wiO1xuXG5cdCAgICAgIGNhc2UgXCJcXFwiXCI6XG5cdCAgICAgICAgcmV0dXJuIFwiJnF1b3Q7XCI7XG5cblx0ICAgICAgY2FzZSBcIjxcIjpcblx0ICAgICAgICByZXR1cm4gXCImbHQ7XCI7XG5cblx0ICAgICAgY2FzZSBcIj5cIjpcblx0ICAgICAgICByZXR1cm4gXCImZ3Q7XCI7XG5cblx0ICAgICAgY2FzZSBcIiZcIjpcblx0ICAgICAgICByZXR1cm4gXCImYW1wO1wiO1xuXHQgICAgfVxuXHQgIH0pO1xuXHR9XG5cblx0KGZ1bmN0aW9uICgpIHtcblx0ICAvLyBEb24ndCBsb2FkIHRoZSBIVE1MIFJlcG9ydGVyIG9uIG5vbi1icm93c2VyIGVudmlyb25tZW50c1xuXHQgIGlmICh0eXBlb2Ygd2luZG93JDEgPT09IFwidW5kZWZpbmVkXCIgfHwgIXdpbmRvdyQxLmRvY3VtZW50KSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgdmFyIGNvbmZpZyA9IFFVbml0LmNvbmZpZyxcblx0ICAgICAgaGlkZGVuVGVzdHMgPSBbXSxcblx0ICAgICAgZG9jdW1lbnQgPSB3aW5kb3ckMS5kb2N1bWVudCxcblx0ICAgICAgY29sbGFwc2VOZXh0ID0gZmFsc2UsXG5cdCAgICAgIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHksXG5cdCAgICAgIHVuZmlsdGVyZWRVcmwgPSBzZXRVcmwoe1xuXHQgICAgZmlsdGVyOiB1bmRlZmluZWQsXG5cdCAgICBtb2R1bGU6IHVuZGVmaW5lZCxcblx0ICAgIG1vZHVsZUlkOiB1bmRlZmluZWQsXG5cdCAgICB0ZXN0SWQ6IHVuZGVmaW5lZFxuXHQgIH0pLFxuXHQgICAgICBtb2R1bGVzTGlzdCA9IFtdO1xuXG5cdCAgZnVuY3Rpb24gYWRkRXZlbnQoZWxlbSwgdHlwZSwgZm4pIHtcblx0ICAgIGVsZW0uYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgZmFsc2UpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHJlbW92ZUV2ZW50KGVsZW0sIHR5cGUsIGZuKSB7XG5cdCAgICBlbGVtLnJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgZm4sIGZhbHNlKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhZGRFdmVudHMoZWxlbXMsIHR5cGUsIGZuKSB7XG5cdCAgICB2YXIgaSA9IGVsZW1zLmxlbmd0aDtcblxuXHQgICAgd2hpbGUgKGktLSkge1xuXHQgICAgICBhZGRFdmVudChlbGVtc1tpXSwgdHlwZSwgZm4pO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGhhc0NsYXNzKGVsZW0sIG5hbWUpIHtcblx0ICAgIHJldHVybiAoXCIgXCIgKyBlbGVtLmNsYXNzTmFtZSArIFwiIFwiKS5pbmRleE9mKFwiIFwiICsgbmFtZSArIFwiIFwiKSA+PSAwO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFkZENsYXNzKGVsZW0sIG5hbWUpIHtcblx0ICAgIGlmICghaGFzQ2xhc3MoZWxlbSwgbmFtZSkpIHtcblx0ICAgICAgZWxlbS5jbGFzc05hbWUgKz0gKGVsZW0uY2xhc3NOYW1lID8gXCIgXCIgOiBcIlwiKSArIG5hbWU7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gdG9nZ2xlQ2xhc3MoZWxlbSwgbmFtZSwgZm9yY2UpIHtcblx0ICAgIGlmIChmb3JjZSB8fCB0eXBlb2YgZm9yY2UgPT09IFwidW5kZWZpbmVkXCIgJiYgIWhhc0NsYXNzKGVsZW0sIG5hbWUpKSB7XG5cdCAgICAgIGFkZENsYXNzKGVsZW0sIG5hbWUpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgcmVtb3ZlQ2xhc3MoZWxlbSwgbmFtZSk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gcmVtb3ZlQ2xhc3MoZWxlbSwgbmFtZSkge1xuXHQgICAgdmFyIHNldCA9IFwiIFwiICsgZWxlbS5jbGFzc05hbWUgKyBcIiBcIjsgLy8gQ2xhc3MgbmFtZSBtYXkgYXBwZWFyIG11bHRpcGxlIHRpbWVzXG5cblx0ICAgIHdoaWxlIChzZXQuaW5kZXhPZihcIiBcIiArIG5hbWUgKyBcIiBcIikgPj0gMCkge1xuXHQgICAgICBzZXQgPSBzZXQucmVwbGFjZShcIiBcIiArIG5hbWUgKyBcIiBcIiwgXCIgXCIpO1xuXHQgICAgfSAvLyBUcmltIGZvciBwcmV0dGluZXNzXG5cblxuXHQgICAgZWxlbS5jbGFzc05hbWUgPSB0eXBlb2Ygc2V0LnRyaW0gPT09IFwiZnVuY3Rpb25cIiA/IHNldC50cmltKCkgOiBzZXQucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgXCJcIik7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gaWQobmFtZSkge1xuXHQgICAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkICYmIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG5hbWUpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFib3J0VGVzdHMoKSB7XG5cdCAgICB2YXIgYWJvcnRCdXR0b24gPSBpZChcInF1bml0LWFib3J0LXRlc3RzLWJ1dHRvblwiKTtcblxuXHQgICAgaWYgKGFib3J0QnV0dG9uKSB7XG5cdCAgICAgIGFib3J0QnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcblx0ICAgICAgYWJvcnRCdXR0b24uaW5uZXJIVE1MID0gXCJBYm9ydGluZy4uLlwiO1xuXHQgICAgfVxuXG5cdCAgICBRVW5pdC5jb25maWcucXVldWUubGVuZ3RoID0gMDtcblx0ICAgIHJldHVybiBmYWxzZTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBpbnRlcmNlcHROYXZpZ2F0aW9uKGV2KSB7XG5cdCAgICBhcHBseVVybFBhcmFtcygpO1xuXG5cdCAgICBpZiAoZXYgJiYgZXYucHJldmVudERlZmF1bHQpIHtcblx0ICAgICAgZXYucHJldmVudERlZmF1bHQoKTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGdldFVybENvbmZpZ0h0bWwoKSB7XG5cdCAgICB2YXIgaSxcblx0ICAgICAgICBqLFxuXHQgICAgICAgIHZhbCxcblx0ICAgICAgICBlc2NhcGVkLFxuXHQgICAgICAgIGVzY2FwZWRUb29sdGlwLFxuXHQgICAgICAgIHNlbGVjdGlvbiA9IGZhbHNlLFxuXHQgICAgICAgIHVybENvbmZpZyA9IGNvbmZpZy51cmxDb25maWcsXG5cdCAgICAgICAgdXJsQ29uZmlnSHRtbCA9IFwiXCI7XG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCB1cmxDb25maWcubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgLy8gT3B0aW9ucyBjYW4gYmUgZWl0aGVyIHN0cmluZ3Mgb3Igb2JqZWN0cyB3aXRoIG5vbmVtcHR5IFwiaWRcIiBwcm9wZXJ0aWVzXG5cdCAgICAgIHZhbCA9IGNvbmZpZy51cmxDb25maWdbaV07XG5cblx0ICAgICAgaWYgKHR5cGVvZiB2YWwgPT09IFwic3RyaW5nXCIpIHtcblx0ICAgICAgICB2YWwgPSB7XG5cdCAgICAgICAgICBpZDogdmFsLFxuXHQgICAgICAgICAgbGFiZWw6IHZhbFxuXHQgICAgICAgIH07XG5cdCAgICAgIH1cblxuXHQgICAgICBlc2NhcGVkID0gZXNjYXBlVGV4dCh2YWwuaWQpO1xuXHQgICAgICBlc2NhcGVkVG9vbHRpcCA9IGVzY2FwZVRleHQodmFsLnRvb2x0aXApO1xuXG5cdCAgICAgIGlmICghdmFsLnZhbHVlIHx8IHR5cGVvZiB2YWwudmFsdWUgPT09IFwic3RyaW5nXCIpIHtcblx0ICAgICAgICB1cmxDb25maWdIdG1sICs9IFwiPGxhYmVsIGZvcj0ncXVuaXQtdXJsY29uZmlnLVwiICsgZXNjYXBlZCArIFwiJyB0aXRsZT0nXCIgKyBlc2NhcGVkVG9vbHRpcCArIFwiJz48aW5wdXQgaWQ9J3F1bml0LXVybGNvbmZpZy1cIiArIGVzY2FwZWQgKyBcIicgbmFtZT0nXCIgKyBlc2NhcGVkICsgXCInIHR5cGU9J2NoZWNrYm94J1wiICsgKHZhbC52YWx1ZSA/IFwiIHZhbHVlPSdcIiArIGVzY2FwZVRleHQodmFsLnZhbHVlKSArIFwiJ1wiIDogXCJcIikgKyAoY29uZmlnW3ZhbC5pZF0gPyBcIiBjaGVja2VkPSdjaGVja2VkJ1wiIDogXCJcIikgKyBcIiB0aXRsZT0nXCIgKyBlc2NhcGVkVG9vbHRpcCArIFwiJyAvPlwiICsgZXNjYXBlVGV4dCh2YWwubGFiZWwpICsgXCI8L2xhYmVsPlwiO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHVybENvbmZpZ0h0bWwgKz0gXCI8bGFiZWwgZm9yPSdxdW5pdC11cmxjb25maWctXCIgKyBlc2NhcGVkICsgXCInIHRpdGxlPSdcIiArIGVzY2FwZWRUb29sdGlwICsgXCInPlwiICsgdmFsLmxhYmVsICsgXCI6IDwvbGFiZWw+PHNlbGVjdCBpZD0ncXVuaXQtdXJsY29uZmlnLVwiICsgZXNjYXBlZCArIFwiJyBuYW1lPSdcIiArIGVzY2FwZWQgKyBcIicgdGl0bGU9J1wiICsgZXNjYXBlZFRvb2x0aXAgKyBcIic+PG9wdGlvbj48L29wdGlvbj5cIjtcblxuXHQgICAgICAgIGlmIChRVW5pdC5pcyhcImFycmF5XCIsIHZhbC52YWx1ZSkpIHtcblx0ICAgICAgICAgIGZvciAoaiA9IDA7IGogPCB2YWwudmFsdWUubGVuZ3RoOyBqKyspIHtcblx0ICAgICAgICAgICAgZXNjYXBlZCA9IGVzY2FwZVRleHQodmFsLnZhbHVlW2pdKTtcblx0ICAgICAgICAgICAgdXJsQ29uZmlnSHRtbCArPSBcIjxvcHRpb24gdmFsdWU9J1wiICsgZXNjYXBlZCArIFwiJ1wiICsgKGNvbmZpZ1t2YWwuaWRdID09PSB2YWwudmFsdWVbal0gPyAoc2VsZWN0aW9uID0gdHJ1ZSkgJiYgXCIgc2VsZWN0ZWQ9J3NlbGVjdGVkJ1wiIDogXCJcIikgKyBcIj5cIiArIGVzY2FwZWQgKyBcIjwvb3B0aW9uPlwiO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBmb3IgKGogaW4gdmFsLnZhbHVlKSB7XG5cdCAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbCh2YWwudmFsdWUsIGopKSB7XG5cdCAgICAgICAgICAgICAgdXJsQ29uZmlnSHRtbCArPSBcIjxvcHRpb24gdmFsdWU9J1wiICsgZXNjYXBlVGV4dChqKSArIFwiJ1wiICsgKGNvbmZpZ1t2YWwuaWRdID09PSBqID8gKHNlbGVjdGlvbiA9IHRydWUpICYmIFwiIHNlbGVjdGVkPSdzZWxlY3RlZCdcIiA6IFwiXCIpICsgXCI+XCIgKyBlc2NhcGVUZXh0KHZhbC52YWx1ZVtqXSkgKyBcIjwvb3B0aW9uPlwiO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaWYgKGNvbmZpZ1t2YWwuaWRdICYmICFzZWxlY3Rpb24pIHtcblx0ICAgICAgICAgIGVzY2FwZWQgPSBlc2NhcGVUZXh0KGNvbmZpZ1t2YWwuaWRdKTtcblx0ICAgICAgICAgIHVybENvbmZpZ0h0bWwgKz0gXCI8b3B0aW9uIHZhbHVlPSdcIiArIGVzY2FwZWQgKyBcIicgc2VsZWN0ZWQ9J3NlbGVjdGVkJyBkaXNhYmxlZD0nZGlzYWJsZWQnPlwiICsgZXNjYXBlZCArIFwiPC9vcHRpb24+XCI7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgdXJsQ29uZmlnSHRtbCArPSBcIjwvc2VsZWN0PlwiO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiB1cmxDb25maWdIdG1sO1xuXHQgIH0gLy8gSGFuZGxlIFwiY2xpY2tcIiBldmVudHMgb24gdG9vbGJhciBjaGVja2JveGVzIGFuZCBcImNoYW5nZVwiIGZvciBzZWxlY3QgbWVudXMuXG5cdCAgLy8gVXBkYXRlcyB0aGUgVVJMIHdpdGggdGhlIG5ldyBzdGF0ZSBvZiBgY29uZmlnLnVybENvbmZpZ2AgdmFsdWVzLlxuXG5cblx0ICBmdW5jdGlvbiB0b29sYmFyQ2hhbmdlZCgpIHtcblx0ICAgIHZhciB1cGRhdGVkVXJsLFxuXHQgICAgICAgIHZhbHVlLFxuXHQgICAgICAgIHRlc3RzLFxuXHQgICAgICAgIGZpZWxkID0gdGhpcyxcblx0ICAgICAgICBwYXJhbXMgPSB7fTsgLy8gRGV0ZWN0IGlmIGZpZWxkIGlzIGEgc2VsZWN0IG1lbnUgb3IgYSBjaGVja2JveFxuXG5cdCAgICBpZiAoXCJzZWxlY3RlZEluZGV4XCIgaW4gZmllbGQpIHtcblx0ICAgICAgdmFsdWUgPSBmaWVsZC5vcHRpb25zW2ZpZWxkLnNlbGVjdGVkSW5kZXhdLnZhbHVlIHx8IHVuZGVmaW5lZDtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHZhbHVlID0gZmllbGQuY2hlY2tlZCA/IGZpZWxkLmRlZmF1bHRWYWx1ZSB8fCB0cnVlIDogdW5kZWZpbmVkO1xuXHQgICAgfVxuXG5cdCAgICBwYXJhbXNbZmllbGQubmFtZV0gPSB2YWx1ZTtcblx0ICAgIHVwZGF0ZWRVcmwgPSBzZXRVcmwocGFyYW1zKTsgLy8gQ2hlY2sgaWYgd2UgY2FuIGFwcGx5IHRoZSBjaGFuZ2Ugd2l0aG91dCBhIHBhZ2UgcmVmcmVzaFxuXG5cdCAgICBpZiAoXCJoaWRlcGFzc2VkXCIgPT09IGZpZWxkLm5hbWUgJiYgXCJyZXBsYWNlU3RhdGVcIiBpbiB3aW5kb3ckMS5oaXN0b3J5KSB7XG5cdCAgICAgIFFVbml0LnVybFBhcmFtc1tmaWVsZC5uYW1lXSA9IHZhbHVlO1xuXHQgICAgICBjb25maWdbZmllbGQubmFtZV0gPSB2YWx1ZSB8fCBmYWxzZTtcblx0ICAgICAgdGVzdHMgPSBpZChcInF1bml0LXRlc3RzXCIpO1xuXG5cdCAgICAgIGlmICh0ZXN0cykge1xuXHQgICAgICAgIHZhciBsZW5ndGggPSB0ZXN0cy5jaGlsZHJlbi5sZW5ndGg7XG5cdCAgICAgICAgdmFyIGNoaWxkcmVuID0gdGVzdHMuY2hpbGRyZW47XG5cblx0ICAgICAgICBpZiAoZmllbGQuY2hlY2tlZCkge1xuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgICB2YXIgdGVzdCA9IGNoaWxkcmVuW2ldO1xuXHQgICAgICAgICAgICB2YXIgY2xhc3NOYW1lID0gdGVzdCA/IHRlc3QuY2xhc3NOYW1lIDogXCJcIjtcblx0ICAgICAgICAgICAgdmFyIGNsYXNzTmFtZUhhc1Bhc3MgPSBjbGFzc05hbWUuaW5kZXhPZihcInBhc3NcIikgPiAtMTtcblx0ICAgICAgICAgICAgdmFyIGNsYXNzTmFtZUhhc1NraXBwZWQgPSBjbGFzc05hbWUuaW5kZXhPZihcInNraXBwZWRcIikgPiAtMTtcblxuXHQgICAgICAgICAgICBpZiAoY2xhc3NOYW1lSGFzUGFzcyB8fCBjbGFzc05hbWVIYXNTa2lwcGVkKSB7XG5cdCAgICAgICAgICAgICAgaGlkZGVuVGVzdHMucHVzaCh0ZXN0KTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICB2YXIgX2l0ZXJhdG9yID0gX2NyZWF0ZUZvck9mSXRlcmF0b3JIZWxwZXIoaGlkZGVuVGVzdHMpLFxuXHQgICAgICAgICAgICAgIF9zdGVwO1xuXG5cdCAgICAgICAgICB0cnkge1xuXHQgICAgICAgICAgICBmb3IgKF9pdGVyYXRvci5zKCk7ICEoX3N0ZXAgPSBfaXRlcmF0b3IubigpKS5kb25lOykge1xuXHQgICAgICAgICAgICAgIHZhciBoaWRkZW5UZXN0ID0gX3N0ZXAudmFsdWU7XG5cdCAgICAgICAgICAgICAgdGVzdHMucmVtb3ZlQ2hpbGQoaGlkZGVuVGVzdCk7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuXHQgICAgICAgICAgICBfaXRlcmF0b3IuZShlcnIpO1xuXHQgICAgICAgICAgfSBmaW5hbGx5IHtcblx0ICAgICAgICAgICAgX2l0ZXJhdG9yLmYoKTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgd2hpbGUgKCh0ZXN0ID0gaGlkZGVuVGVzdHMucG9wKCkpICE9IG51bGwpIHtcblx0ICAgICAgICAgICAgdGVzdHMuYXBwZW5kQ2hpbGQodGVzdCk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgd2luZG93JDEuaGlzdG9yeS5yZXBsYWNlU3RhdGUobnVsbCwgXCJcIiwgdXBkYXRlZFVybCk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB3aW5kb3ckMS5sb2NhdGlvbiA9IHVwZGF0ZWRVcmw7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gc2V0VXJsKHBhcmFtcykge1xuXHQgICAgdmFyIGtleSxcblx0ICAgICAgICBhcnJWYWx1ZSxcblx0ICAgICAgICBpLFxuXHQgICAgICAgIHF1ZXJ5c3RyaW5nID0gXCI/XCIsXG5cdCAgICAgICAgbG9jYXRpb24gPSB3aW5kb3ckMS5sb2NhdGlvbjtcblx0ICAgIHBhcmFtcyA9IFFVbml0LmV4dGVuZChRVW5pdC5leHRlbmQoe30sIFFVbml0LnVybFBhcmFtcyksIHBhcmFtcyk7XG5cblx0ICAgIGZvciAoa2V5IGluIHBhcmFtcykge1xuXHQgICAgICAvLyBTa2lwIGluaGVyaXRlZCBvciB1bmRlZmluZWQgcHJvcGVydGllc1xuXHQgICAgICBpZiAoaGFzT3duLmNhbGwocGFyYW1zLCBrZXkpICYmIHBhcmFtc1trZXldICE9PSB1bmRlZmluZWQpIHtcblx0ICAgICAgICAvLyBPdXRwdXQgYSBwYXJhbWV0ZXIgZm9yIGVhY2ggdmFsdWUgb2YgdGhpcyBrZXlcblx0ICAgICAgICAvLyAoYnV0IHVzdWFsbHkganVzdCBvbmUpXG5cdCAgICAgICAgYXJyVmFsdWUgPSBbXS5jb25jYXQocGFyYW1zW2tleV0pO1xuXG5cdCAgICAgICAgZm9yIChpID0gMDsgaSA8IGFyclZhbHVlLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICBxdWVyeXN0cmluZyArPSBlbmNvZGVVUklDb21wb25lbnQoa2V5KTtcblxuXHQgICAgICAgICAgaWYgKGFyclZhbHVlW2ldICE9PSB0cnVlKSB7XG5cdCAgICAgICAgICAgIHF1ZXJ5c3RyaW5nICs9IFwiPVwiICsgZW5jb2RlVVJJQ29tcG9uZW50KGFyclZhbHVlW2ldKTtcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgcXVlcnlzdHJpbmcgKz0gXCImXCI7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBsb2NhdGlvbi5wcm90b2NvbCArIFwiLy9cIiArIGxvY2F0aW9uLmhvc3QgKyBsb2NhdGlvbi5wYXRobmFtZSArIHF1ZXJ5c3RyaW5nLnNsaWNlKDAsIC0xKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhcHBseVVybFBhcmFtcygpIHtcblx0ICAgIHZhciBpLFxuXHQgICAgICAgIHNlbGVjdGVkTW9kdWxlcyA9IFtdLFxuXHQgICAgICAgIG1vZHVsZXNMaXN0ID0gaWQoXCJxdW5pdC1tb2R1bGVmaWx0ZXItZHJvcGRvd24tbGlzdFwiKS5nZXRFbGVtZW50c0J5VGFnTmFtZShcImlucHV0XCIpLFxuXHQgICAgICAgIGZpbHRlciA9IGlkKFwicXVuaXQtZmlsdGVyLWlucHV0XCIpLnZhbHVlO1xuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgbW9kdWxlc0xpc3QubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgaWYgKG1vZHVsZXNMaXN0W2ldLmNoZWNrZWQpIHtcblx0ICAgICAgICBzZWxlY3RlZE1vZHVsZXMucHVzaChtb2R1bGVzTGlzdFtpXS52YWx1ZSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgd2luZG93JDEubG9jYXRpb24gPSBzZXRVcmwoe1xuXHQgICAgICBmaWx0ZXI6IGZpbHRlciA9PT0gXCJcIiA/IHVuZGVmaW5lZCA6IGZpbHRlcixcblx0ICAgICAgbW9kdWxlSWQ6IHNlbGVjdGVkTW9kdWxlcy5sZW5ndGggPT09IDAgPyB1bmRlZmluZWQgOiBzZWxlY3RlZE1vZHVsZXMsXG5cdCAgICAgIC8vIFJlbW92ZSBtb2R1bGUgYW5kIHRlc3RJZCBmaWx0ZXJcblx0ICAgICAgbW9kdWxlOiB1bmRlZmluZWQsXG5cdCAgICAgIHRlc3RJZDogdW5kZWZpbmVkXG5cdCAgICB9KTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiB0b29sYmFyVXJsQ29uZmlnQ29udGFpbmVyKCkge1xuXHQgICAgdmFyIHVybENvbmZpZ0NvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuXHQgICAgdXJsQ29uZmlnQ29udGFpbmVyLmlubmVySFRNTCA9IGdldFVybENvbmZpZ0h0bWwoKTtcblx0ICAgIGFkZENsYXNzKHVybENvbmZpZ0NvbnRhaW5lciwgXCJxdW5pdC11cmwtY29uZmlnXCIpO1xuXHQgICAgYWRkRXZlbnRzKHVybENvbmZpZ0NvbnRhaW5lci5nZXRFbGVtZW50c0J5VGFnTmFtZShcImlucHV0XCIpLCBcImNoYW5nZVwiLCB0b29sYmFyQ2hhbmdlZCk7XG5cdCAgICBhZGRFdmVudHModXJsQ29uZmlnQ29udGFpbmVyLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwic2VsZWN0XCIpLCBcImNoYW5nZVwiLCB0b29sYmFyQ2hhbmdlZCk7XG5cdCAgICByZXR1cm4gdXJsQ29uZmlnQ29udGFpbmVyO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFib3J0VGVzdHNCdXR0b24oKSB7XG5cdCAgICB2YXIgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcblx0ICAgIGJ1dHRvbi5pZCA9IFwicXVuaXQtYWJvcnQtdGVzdHMtYnV0dG9uXCI7XG5cdCAgICBidXR0b24uaW5uZXJIVE1MID0gXCJBYm9ydFwiO1xuXHQgICAgYWRkRXZlbnQoYnV0dG9uLCBcImNsaWNrXCIsIGFib3J0VGVzdHMpO1xuXHQgICAgcmV0dXJuIGJ1dHRvbjtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiB0b29sYmFyTG9vc2VGaWx0ZXIoKSB7XG5cdCAgICB2YXIgZmlsdGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImZvcm1cIiksXG5cdCAgICAgICAgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGFiZWxcIiksXG5cdCAgICAgICAgaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW5wdXRcIiksXG5cdCAgICAgICAgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcblx0ICAgIGFkZENsYXNzKGZpbHRlciwgXCJxdW5pdC1maWx0ZXJcIik7XG5cdCAgICBsYWJlbC5pbm5lckhUTUwgPSBcIkZpbHRlcjogXCI7XG5cdCAgICBpbnB1dC50eXBlID0gXCJ0ZXh0XCI7XG5cdCAgICBpbnB1dC52YWx1ZSA9IGNvbmZpZy5maWx0ZXIgfHwgXCJcIjtcblx0ICAgIGlucHV0Lm5hbWUgPSBcImZpbHRlclwiO1xuXHQgICAgaW5wdXQuaWQgPSBcInF1bml0LWZpbHRlci1pbnB1dFwiO1xuXHQgICAgYnV0dG9uLmlubmVySFRNTCA9IFwiR29cIjtcblx0ICAgIGxhYmVsLmFwcGVuZENoaWxkKGlucHV0KTtcblx0ICAgIGZpbHRlci5hcHBlbmRDaGlsZChsYWJlbCk7XG5cdCAgICBmaWx0ZXIuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCIgXCIpKTtcblx0ICAgIGZpbHRlci5hcHBlbmRDaGlsZChidXR0b24pO1xuXHQgICAgYWRkRXZlbnQoZmlsdGVyLCBcInN1Ym1pdFwiLCBpbnRlcmNlcHROYXZpZ2F0aW9uKTtcblx0ICAgIHJldHVybiBmaWx0ZXI7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gbW9kdWxlTGlzdEh0bWwobW9kdWxlcykge1xuXHQgICAgdmFyIGksXG5cdCAgICAgICAgY2hlY2tlZCxcblx0ICAgICAgICBodG1sID0gXCJcIjtcblxuXHQgICAgZm9yIChpID0gMDsgaSA8IG1vZHVsZXMubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgaWYgKG1vZHVsZXNbaV0ubmFtZSAhPT0gXCJcIikge1xuXHQgICAgICAgIGNoZWNrZWQgPSBjb25maWcubW9kdWxlSWQuaW5kZXhPZihtb2R1bGVzW2ldLm1vZHVsZUlkKSA+IC0xO1xuXHQgICAgICAgIGh0bWwgKz0gXCI8bGk+PGxhYmVsIGNsYXNzPSdjbGlja2FibGVcIiArIChjaGVja2VkID8gXCIgY2hlY2tlZFwiIDogXCJcIikgKyBcIic+PGlucHV0IHR5cGU9J2NoZWNrYm94JyBcIiArIFwidmFsdWU9J1wiICsgbW9kdWxlc1tpXS5tb2R1bGVJZCArIFwiJ1wiICsgKGNoZWNrZWQgPyBcIiBjaGVja2VkPSdjaGVja2VkJ1wiIDogXCJcIikgKyBcIiAvPlwiICsgZXNjYXBlVGV4dChtb2R1bGVzW2ldLm5hbWUpICsgXCI8L2xhYmVsPjwvbGk+XCI7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGh0bWw7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gdG9vbGJhck1vZHVsZUZpbHRlcigpIHtcblx0ICAgIHZhciBjb21taXQsXG5cdCAgICAgICAgcmVzZXQsXG5cdCAgICAgICAgbW9kdWxlRmlsdGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImZvcm1cIiksXG5cdCAgICAgICAgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGFiZWxcIiksXG5cdCAgICAgICAgbW9kdWxlU2VhcmNoID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlucHV0XCIpLFxuXHQgICAgICAgIGRyb3BEb3duID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKSxcblx0ICAgICAgICBhY3Rpb25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIiksXG5cdCAgICAgICAgYXBwbHlCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpLFxuXHQgICAgICAgIHJlc2V0QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKSxcblx0ICAgICAgICBhbGxNb2R1bGVzTGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGFiZWxcIiksXG5cdCAgICAgICAgYWxsQ2hlY2tib3ggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW5wdXRcIiksXG5cdCAgICAgICAgZHJvcERvd25MaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInVsXCIpLFxuXHQgICAgICAgIGRpcnR5ID0gZmFsc2U7XG5cdCAgICBtb2R1bGVTZWFyY2guaWQgPSBcInF1bml0LW1vZHVsZWZpbHRlci1zZWFyY2hcIjtcblx0ICAgIG1vZHVsZVNlYXJjaC5hdXRvY29tcGxldGUgPSBcIm9mZlwiO1xuXHQgICAgYWRkRXZlbnQobW9kdWxlU2VhcmNoLCBcImlucHV0XCIsIHNlYXJjaElucHV0KTtcblx0ICAgIGFkZEV2ZW50KG1vZHVsZVNlYXJjaCwgXCJpbnB1dFwiLCBzZWFyY2hGb2N1cyk7XG5cdCAgICBhZGRFdmVudChtb2R1bGVTZWFyY2gsIFwiZm9jdXNcIiwgc2VhcmNoRm9jdXMpO1xuXHQgICAgYWRkRXZlbnQobW9kdWxlU2VhcmNoLCBcImNsaWNrXCIsIHNlYXJjaEZvY3VzKTtcblx0ICAgIGNvbmZpZy5tb2R1bGVzLmZvckVhY2goZnVuY3Rpb24gKG1vZHVsZSkge1xuXHQgICAgICByZXR1cm4gbW9kdWxlLm5hbWVQcmVwYXJlZCA9IGZ1enp5c29ydC5wcmVwYXJlKG1vZHVsZS5uYW1lKTtcblx0ICAgIH0pO1xuXHQgICAgbGFiZWwuaWQgPSBcInF1bml0LW1vZHVsZWZpbHRlci1zZWFyY2gtY29udGFpbmVyXCI7XG5cdCAgICBsYWJlbC5pbm5lckhUTUwgPSBcIk1vZHVsZTogXCI7XG5cdCAgICBsYWJlbC5hcHBlbmRDaGlsZChtb2R1bGVTZWFyY2gpO1xuXHQgICAgYXBwbHlCdXR0b24udGV4dENvbnRlbnQgPSBcIkFwcGx5XCI7XG5cdCAgICBhcHBseUJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdCAgICByZXNldEJ1dHRvbi50ZXh0Q29udGVudCA9IFwiUmVzZXRcIjtcblx0ICAgIHJlc2V0QnV0dG9uLnR5cGUgPSBcInJlc2V0XCI7XG5cdCAgICByZXNldEJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdCAgICBhbGxDaGVja2JveC50eXBlID0gXCJjaGVja2JveFwiO1xuXHQgICAgYWxsQ2hlY2tib3guY2hlY2tlZCA9IGNvbmZpZy5tb2R1bGVJZC5sZW5ndGggPT09IDA7XG5cdCAgICBhbGxNb2R1bGVzTGFiZWwuY2xhc3NOYW1lID0gXCJjbGlja2FibGVcIjtcblxuXHQgICAgaWYgKGNvbmZpZy5tb2R1bGVJZC5sZW5ndGgpIHtcblx0ICAgICAgYWxsTW9kdWxlc0xhYmVsLmNsYXNzTmFtZSA9IFwiY2hlY2tlZFwiO1xuXHQgICAgfVxuXG5cdCAgICBhbGxNb2R1bGVzTGFiZWwuYXBwZW5kQ2hpbGQoYWxsQ2hlY2tib3gpO1xuXHQgICAgYWxsTW9kdWxlc0xhYmVsLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiQWxsIG1vZHVsZXNcIikpO1xuXHQgICAgYWN0aW9ucy5pZCA9IFwicXVuaXQtbW9kdWxlZmlsdGVyLWFjdGlvbnNcIjtcblx0ICAgIGFjdGlvbnMuYXBwZW5kQ2hpbGQoYXBwbHlCdXR0b24pO1xuXHQgICAgYWN0aW9ucy5hcHBlbmRDaGlsZChyZXNldEJ1dHRvbik7XG5cdCAgICBhY3Rpb25zLmFwcGVuZENoaWxkKGFsbE1vZHVsZXNMYWJlbCk7XG5cdCAgICBjb21taXQgPSBhY3Rpb25zLmZpcnN0Q2hpbGQ7XG5cdCAgICByZXNldCA9IGNvbW1pdC5uZXh0U2libGluZztcblx0ICAgIGFkZEV2ZW50KGNvbW1pdCwgXCJjbGlja1wiLCBhcHBseVVybFBhcmFtcyk7XG5cdCAgICBkcm9wRG93bkxpc3QuaWQgPSBcInF1bml0LW1vZHVsZWZpbHRlci1kcm9wZG93bi1saXN0XCI7XG5cdCAgICBkcm9wRG93bkxpc3QuaW5uZXJIVE1MID0gbW9kdWxlTGlzdEh0bWwoY29uZmlnLm1vZHVsZXMpO1xuXHQgICAgZHJvcERvd24uaWQgPSBcInF1bml0LW1vZHVsZWZpbHRlci1kcm9wZG93blwiO1xuXHQgICAgZHJvcERvd24uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHQgICAgZHJvcERvd24uYXBwZW5kQ2hpbGQoYWN0aW9ucyk7XG5cdCAgICBkcm9wRG93bi5hcHBlbmRDaGlsZChkcm9wRG93bkxpc3QpO1xuXHQgICAgYWRkRXZlbnQoZHJvcERvd24sIFwiY2hhbmdlXCIsIHNlbGVjdGlvbkNoYW5nZSk7XG5cdCAgICBzZWxlY3Rpb25DaGFuZ2UoKTtcblx0ICAgIG1vZHVsZUZpbHRlci5pZCA9IFwicXVuaXQtbW9kdWxlZmlsdGVyXCI7XG5cdCAgICBtb2R1bGVGaWx0ZXIuYXBwZW5kQ2hpbGQobGFiZWwpO1xuXHQgICAgbW9kdWxlRmlsdGVyLmFwcGVuZENoaWxkKGRyb3BEb3duKTtcblx0ICAgIGFkZEV2ZW50KG1vZHVsZUZpbHRlciwgXCJzdWJtaXRcIiwgaW50ZXJjZXB0TmF2aWdhdGlvbik7XG5cdCAgICBhZGRFdmVudChtb2R1bGVGaWx0ZXIsIFwicmVzZXRcIiwgZnVuY3Rpb24gKCkge1xuXHQgICAgICAvLyBMZXQgdGhlIHJlc2V0IGhhcHBlbiwgdGhlbiB1cGRhdGUgc3R5bGVzXG5cdCAgICAgIHdpbmRvdyQxLnNldFRpbWVvdXQoc2VsZWN0aW9uQ2hhbmdlKTtcblx0ICAgIH0pOyAvLyBFbmFibGVzIHNob3cvaGlkZSBmb3IgdGhlIGRyb3Bkb3duXG5cblx0ICAgIGZ1bmN0aW9uIHNlYXJjaEZvY3VzKCkge1xuXHQgICAgICBpZiAoZHJvcERvd24uc3R5bGUuZGlzcGxheSAhPT0gXCJub25lXCIpIHtcblx0ICAgICAgICByZXR1cm47XG5cdCAgICAgIH1cblxuXHQgICAgICBkcm9wRG93bi5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuXHQgICAgICBhZGRFdmVudChkb2N1bWVudCwgXCJjbGlja1wiLCBoaWRlSGFuZGxlcik7XG5cdCAgICAgIGFkZEV2ZW50KGRvY3VtZW50LCBcImtleWRvd25cIiwgaGlkZUhhbmRsZXIpOyAvLyBIaWRlIG9uIEVzY2FwZSBrZXlkb3duIG9yIG91dHNpZGUtY29udGFpbmVyIGNsaWNrXG5cblx0ICAgICAgZnVuY3Rpb24gaGlkZUhhbmRsZXIoZSkge1xuXHQgICAgICAgIHZhciBpbkNvbnRhaW5lciA9IG1vZHVsZUZpbHRlci5jb250YWlucyhlLnRhcmdldCk7XG5cblx0ICAgICAgICBpZiAoZS5rZXlDb2RlID09PSAyNyB8fCAhaW5Db250YWluZXIpIHtcblx0ICAgICAgICAgIGlmIChlLmtleUNvZGUgPT09IDI3ICYmIGluQ29udGFpbmVyKSB7XG5cdCAgICAgICAgICAgIG1vZHVsZVNlYXJjaC5mb2N1cygpO1xuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICBkcm9wRG93bi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdCAgICAgICAgICByZW1vdmVFdmVudChkb2N1bWVudCwgXCJjbGlja1wiLCBoaWRlSGFuZGxlcik7XG5cdCAgICAgICAgICByZW1vdmVFdmVudChkb2N1bWVudCwgXCJrZXlkb3duXCIsIGhpZGVIYW5kbGVyKTtcblx0ICAgICAgICAgIG1vZHVsZVNlYXJjaC52YWx1ZSA9IFwiXCI7XG5cdCAgICAgICAgICBzZWFyY2hJbnB1dCgpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBmaWx0ZXJNb2R1bGVzKHNlYXJjaFRleHQpIHtcblx0ICAgICAgaWYgKHNlYXJjaFRleHQgPT09IFwiXCIpIHtcblx0ICAgICAgICByZXR1cm4gY29uZmlnLm1vZHVsZXM7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gZnV6enlzb3J0LmdvKHNlYXJjaFRleHQsIGNvbmZpZy5tb2R1bGVzLCB7XG5cdCAgICAgICAga2V5OiBcIm5hbWVQcmVwYXJlZFwiLFxuXHQgICAgICAgIHRocmVzaG9sZDogLTEwMDAwXG5cdCAgICAgIH0pLm1hcChmdW5jdGlvbiAobW9kdWxlKSB7XG5cdCAgICAgICAgcmV0dXJuIG1vZHVsZS5vYmo7XG5cdCAgICAgIH0pO1xuXHQgICAgfSAvLyBQcm9jZXNzZXMgbW9kdWxlIHNlYXJjaCBib3ggaW5wdXRcblxuXG5cdCAgICB2YXIgc2VhcmNoSW5wdXRUaW1lb3V0O1xuXG5cdCAgICBmdW5jdGlvbiBzZWFyY2hJbnB1dCgpIHtcblx0ICAgICAgd2luZG93JDEuY2xlYXJUaW1lb3V0KHNlYXJjaElucHV0VGltZW91dCk7XG5cdCAgICAgIHNlYXJjaElucHV0VGltZW91dCA9IHdpbmRvdyQxLnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHZhciBzZWFyY2hUZXh0ID0gbW9kdWxlU2VhcmNoLnZhbHVlLnRvTG93ZXJDYXNlKCksXG5cdCAgICAgICAgICAgIGZpbHRlcmVkTW9kdWxlcyA9IGZpbHRlck1vZHVsZXMoc2VhcmNoVGV4dCk7XG5cdCAgICAgICAgZHJvcERvd25MaXN0LmlubmVySFRNTCA9IG1vZHVsZUxpc3RIdG1sKGZpbHRlcmVkTW9kdWxlcyk7XG5cdCAgICAgIH0sIDIwMCk7XG5cdCAgICB9IC8vIFByb2Nlc3NlcyBzZWxlY3Rpb24gY2hhbmdlc1xuXG5cblx0ICAgIGZ1bmN0aW9uIHNlbGVjdGlvbkNoYW5nZShldnQpIHtcblx0ICAgICAgdmFyIGksXG5cdCAgICAgICAgICBpdGVtLFxuXHQgICAgICAgICAgY2hlY2tib3ggPSBldnQgJiYgZXZ0LnRhcmdldCB8fCBhbGxDaGVja2JveCxcblx0ICAgICAgICAgIG1vZHVsZXNMaXN0ID0gZHJvcERvd25MaXN0LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiaW5wdXRcIiksXG5cdCAgICAgICAgICBzZWxlY3RlZE5hbWVzID0gW107XG5cdCAgICAgIHRvZ2dsZUNsYXNzKGNoZWNrYm94LnBhcmVudE5vZGUsIFwiY2hlY2tlZFwiLCBjaGVja2JveC5jaGVja2VkKTtcblx0ICAgICAgZGlydHkgPSBmYWxzZTtcblxuXHQgICAgICBpZiAoY2hlY2tib3guY2hlY2tlZCAmJiBjaGVja2JveCAhPT0gYWxsQ2hlY2tib3gpIHtcblx0ICAgICAgICBhbGxDaGVja2JveC5jaGVja2VkID0gZmFsc2U7XG5cdCAgICAgICAgcmVtb3ZlQ2xhc3MoYWxsQ2hlY2tib3gucGFyZW50Tm9kZSwgXCJjaGVja2VkXCIpO1xuXHQgICAgICB9XG5cblx0ICAgICAgZm9yIChpID0gMDsgaSA8IG1vZHVsZXNMaXN0Lmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgaXRlbSA9IG1vZHVsZXNMaXN0W2ldO1xuXG5cdCAgICAgICAgaWYgKCFldnQpIHtcblx0ICAgICAgICAgIHRvZ2dsZUNsYXNzKGl0ZW0ucGFyZW50Tm9kZSwgXCJjaGVja2VkXCIsIGl0ZW0uY2hlY2tlZCk7XG5cdCAgICAgICAgfSBlbHNlIGlmIChjaGVja2JveCA9PT0gYWxsQ2hlY2tib3ggJiYgY2hlY2tib3guY2hlY2tlZCkge1xuXHQgICAgICAgICAgaXRlbS5jaGVja2VkID0gZmFsc2U7XG5cdCAgICAgICAgICByZW1vdmVDbGFzcyhpdGVtLnBhcmVudE5vZGUsIFwiY2hlY2tlZFwiKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBkaXJ0eSA9IGRpcnR5IHx8IGl0ZW0uY2hlY2tlZCAhPT0gaXRlbS5kZWZhdWx0Q2hlY2tlZDtcblxuXHQgICAgICAgIGlmIChpdGVtLmNoZWNrZWQpIHtcblx0ICAgICAgICAgIHNlbGVjdGVkTmFtZXMucHVzaChpdGVtLnBhcmVudE5vZGUudGV4dENvbnRlbnQpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIGNvbW1pdC5zdHlsZS5kaXNwbGF5ID0gcmVzZXQuc3R5bGUuZGlzcGxheSA9IGRpcnR5ID8gXCJcIiA6IFwibm9uZVwiO1xuXHQgICAgICBtb2R1bGVTZWFyY2gucGxhY2Vob2xkZXIgPSBzZWxlY3RlZE5hbWVzLmpvaW4oXCIsIFwiKSB8fCBhbGxDaGVja2JveC5wYXJlbnROb2RlLnRleHRDb250ZW50O1xuXHQgICAgICBtb2R1bGVTZWFyY2gudGl0bGUgPSBcIlR5cGUgdG8gZmlsdGVyIGxpc3QuIEN1cnJlbnQgc2VsZWN0aW9uOlxcblwiICsgKHNlbGVjdGVkTmFtZXMuam9pbihcIlxcblwiKSB8fCBhbGxDaGVja2JveC5wYXJlbnROb2RlLnRleHRDb250ZW50KTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIG1vZHVsZUZpbHRlcjtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiB0b29sYmFyRmlsdGVycygpIHtcblx0ICAgIHZhciB0b29sYmFyRmlsdGVycyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuXHQgICAgdG9vbGJhckZpbHRlcnMuaWQgPSBcInF1bml0LXRvb2xiYXItZmlsdGVyc1wiO1xuXHQgICAgdG9vbGJhckZpbHRlcnMuYXBwZW5kQ2hpbGQodG9vbGJhckxvb3NlRmlsdGVyKCkpO1xuXHQgICAgdG9vbGJhckZpbHRlcnMuYXBwZW5kQ2hpbGQodG9vbGJhck1vZHVsZUZpbHRlcigpKTtcblx0ICAgIHJldHVybiB0b29sYmFyRmlsdGVycztcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhcHBlbmRUb29sYmFyKCkge1xuXHQgICAgdmFyIHRvb2xiYXIgPSBpZChcInF1bml0LXRlc3RydW5uZXItdG9vbGJhclwiKTtcblxuXHQgICAgaWYgKHRvb2xiYXIpIHtcblx0ICAgICAgdG9vbGJhci5hcHBlbmRDaGlsZCh0b29sYmFyVXJsQ29uZmlnQ29udGFpbmVyKCkpO1xuXHQgICAgICB0b29sYmFyLmFwcGVuZENoaWxkKHRvb2xiYXJGaWx0ZXJzKCkpO1xuXHQgICAgICB0b29sYmFyLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIikpLmNsYXNzTmFtZSA9IFwiY2xlYXJmaXhcIjtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhcHBlbmRIZWFkZXIoKSB7XG5cdCAgICB2YXIgaGVhZGVyID0gaWQoXCJxdW5pdC1oZWFkZXJcIik7XG5cblx0ICAgIGlmIChoZWFkZXIpIHtcblx0ICAgICAgaGVhZGVyLmlubmVySFRNTCA9IFwiPGEgaHJlZj0nXCIgKyBlc2NhcGVUZXh0KHVuZmlsdGVyZWRVcmwpICsgXCInPlwiICsgaGVhZGVyLmlubmVySFRNTCArIFwiPC9hPiBcIjtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhcHBlbmRCYW5uZXIoKSB7XG5cdCAgICB2YXIgYmFubmVyID0gaWQoXCJxdW5pdC1iYW5uZXJcIik7XG5cblx0ICAgIGlmIChiYW5uZXIpIHtcblx0ICAgICAgYmFubmVyLmNsYXNzTmFtZSA9IFwiXCI7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYXBwZW5kVGVzdFJlc3VsdHMoKSB7XG5cdCAgICB2YXIgdGVzdHMgPSBpZChcInF1bml0LXRlc3RzXCIpLFxuXHQgICAgICAgIHJlc3VsdCA9IGlkKFwicXVuaXQtdGVzdHJlc3VsdFwiKSxcblx0ICAgICAgICBjb250cm9scztcblxuXHQgICAgaWYgKHJlc3VsdCkge1xuXHQgICAgICByZXN1bHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChyZXN1bHQpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAodGVzdHMpIHtcblx0ICAgICAgdGVzdHMuaW5uZXJIVE1MID0gXCJcIjtcblx0ICAgICAgcmVzdWx0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInBcIik7XG5cdCAgICAgIHJlc3VsdC5pZCA9IFwicXVuaXQtdGVzdHJlc3VsdFwiO1xuXHQgICAgICByZXN1bHQuY2xhc3NOYW1lID0gXCJyZXN1bHRcIjtcblx0ICAgICAgdGVzdHMucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVzdWx0LCB0ZXN0cyk7XG5cdCAgICAgIHJlc3VsdC5pbm5lckhUTUwgPSBcIjxkaXYgaWQ9XFxcInF1bml0LXRlc3RyZXN1bHQtZGlzcGxheVxcXCI+UnVubmluZy4uLjxiciAvPiYjMTYwOzwvZGl2PlwiICsgXCI8ZGl2IGlkPVxcXCJxdW5pdC10ZXN0cmVzdWx0LWNvbnRyb2xzXFxcIj48L2Rpdj5cIiArIFwiPGRpdiBjbGFzcz1cXFwiY2xlYXJmaXhcXFwiPjwvZGl2PlwiO1xuXHQgICAgICBjb250cm9scyA9IGlkKFwicXVuaXQtdGVzdHJlc3VsdC1jb250cm9sc1wiKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGNvbnRyb2xzKSB7XG5cdCAgICAgIGNvbnRyb2xzLmFwcGVuZENoaWxkKGFib3J0VGVzdHNCdXR0b24oKSk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYXBwZW5kRmlsdGVyZWRUZXN0KCkge1xuXHQgICAgdmFyIHRlc3RJZCA9IFFVbml0LmNvbmZpZy50ZXN0SWQ7XG5cblx0ICAgIGlmICghdGVzdElkIHx8IHRlc3RJZC5sZW5ndGggPD0gMCkge1xuXHQgICAgICByZXR1cm4gXCJcIjtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIFwiPGRpdiBpZD0ncXVuaXQtZmlsdGVyZWRUZXN0Jz5SZXJ1bm5pbmcgc2VsZWN0ZWQgdGVzdHM6IFwiICsgZXNjYXBlVGV4dCh0ZXN0SWQuam9pbihcIiwgXCIpKSArIFwiIDxhIGlkPSdxdW5pdC1jbGVhckZpbHRlcicgaHJlZj0nXCIgKyBlc2NhcGVUZXh0KHVuZmlsdGVyZWRVcmwpICsgXCInPlJ1biBhbGwgdGVzdHM8L2E+PC9kaXY+XCI7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYXBwZW5kVXNlckFnZW50KCkge1xuXHQgICAgdmFyIHVzZXJBZ2VudCA9IGlkKFwicXVuaXQtdXNlckFnZW50XCIpO1xuXG5cdCAgICBpZiAodXNlckFnZW50KSB7XG5cdCAgICAgIHVzZXJBZ2VudC5pbm5lckhUTUwgPSBcIlwiO1xuXHQgICAgICB1c2VyQWdlbnQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJRVW5pdCBcIiArIFFVbml0LnZlcnNpb24gKyBcIjsgXCIgKyBuYXZpZ2F0b3IudXNlckFnZW50KSk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYXBwZW5kSW50ZXJmYWNlKCkge1xuXHQgICAgdmFyIHF1bml0ID0gaWQoXCJxdW5pdFwiKTsgLy8gRm9yIGNvbXBhdCB3aXRoIFFVbml0IDEuMiwgYW5kIHRvIHN1cHBvcnQgZnVsbHkgY3VzdG9tIHRoZW1lIEhUTUwsXG5cdCAgICAvLyB3ZSB3aWxsIHVzZSBhbnkgZXhpc3RpbmcgZWxlbWVudHMgaWYgbm8gaWQ9XCJxdW5pdFwiIGVsZW1lbnQgZXhpc3RzLlxuXHQgICAgLy9cblx0ICAgIC8vIE5vdGUgdGhhdCB3ZSBkb24ndCBmYWlsIG9yIGZhbGxiYWNrIHRvIGNyZWF0aW5nIGl0IG91cnNlbHZlcyxcblx0ICAgIC8vIGJlY2F1c2Ugbm90IGhhdmluZyBpZD1cInF1bml0XCIgKGFuZCBub3QgaGF2aW5nIHRoZSBiZWxvdyBlbGVtZW50cylcblx0ICAgIC8vIHNpbXBseSBtZWFucyBRVW5pdCBhY3RzIGhlYWRsZXNzLCBhbGxvd2luZyB1c2VycyB0byB1c2UgdGhlaXIgb3duXG5cdCAgICAvLyByZXBvcnRlcnMsIG9yIGZvciBhIHRlc3QgcnVubmVyIHRvIGxpc3RlbiBmb3IgZXZlbnRzIGRpcmVjdGx5IHdpdGhvdXRcblx0ICAgIC8vIGhhdmluZyB0aGUgSFRNTCByZXBvcnRlciBhY3RpdmVseSByZW5kZXIgYW55dGhpbmcuXG5cblx0ICAgIGlmIChxdW5pdCkge1xuXHQgICAgICAvLyBTaW5jZSBRVW5pdCAxLjMsIHRoZXNlIGFyZSBjcmVhdGVkIGF1dG9tYXRpY2FsbHkgaWYgdGhlIHBhZ2Vcblx0ICAgICAgLy8gY29udGFpbnMgaWQ9XCJxdW5pdFwiLlxuXHQgICAgICBxdW5pdC5pbm5lckhUTUwgPSBcIjxoMSBpZD0ncXVuaXQtaGVhZGVyJz5cIiArIGVzY2FwZVRleHQoZG9jdW1lbnQudGl0bGUpICsgXCI8L2gxPlwiICsgXCI8aDIgaWQ9J3F1bml0LWJhbm5lcic+PC9oMj5cIiArIFwiPGRpdiBpZD0ncXVuaXQtdGVzdHJ1bm5lci10b29sYmFyJz48L2Rpdj5cIiArIGFwcGVuZEZpbHRlcmVkVGVzdCgpICsgXCI8aDIgaWQ9J3F1bml0LXVzZXJBZ2VudCc+PC9oMj5cIiArIFwiPG9sIGlkPSdxdW5pdC10ZXN0cyc+PC9vbD5cIjtcblx0ICAgIH1cblxuXHQgICAgYXBwZW5kSGVhZGVyKCk7XG5cdCAgICBhcHBlbmRCYW5uZXIoKTtcblx0ICAgIGFwcGVuZFRlc3RSZXN1bHRzKCk7XG5cdCAgICBhcHBlbmRVc2VyQWdlbnQoKTtcblx0ICAgIGFwcGVuZFRvb2xiYXIoKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhcHBlbmRUZXN0KG5hbWUsIHRlc3RJZCwgbW9kdWxlTmFtZSkge1xuXHQgICAgdmFyIHRpdGxlLFxuXHQgICAgICAgIHJlcnVuVHJpZ2dlcixcblx0ICAgICAgICB0ZXN0QmxvY2ssXG5cdCAgICAgICAgYXNzZXJ0TGlzdCxcblx0ICAgICAgICB0ZXN0cyA9IGlkKFwicXVuaXQtdGVzdHNcIik7XG5cblx0ICAgIGlmICghdGVzdHMpIHtcblx0ICAgICAgcmV0dXJuO1xuXHQgICAgfVxuXG5cdCAgICB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHJvbmdcIik7XG5cdCAgICB0aXRsZS5pbm5lckhUTUwgPSBnZXROYW1lSHRtbChuYW1lLCBtb2R1bGVOYW1lKTtcblx0ICAgIHJlcnVuVHJpZ2dlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpO1xuXHQgICAgcmVydW5UcmlnZ2VyLmlubmVySFRNTCA9IFwiUmVydW5cIjtcblx0ICAgIHJlcnVuVHJpZ2dlci5ocmVmID0gc2V0VXJsKHtcblx0ICAgICAgdGVzdElkOiB0ZXN0SWRcblx0ICAgIH0pO1xuXHQgICAgdGVzdEJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpO1xuXHQgICAgdGVzdEJsb2NrLmFwcGVuZENoaWxkKHRpdGxlKTtcblx0ICAgIHRlc3RCbG9jay5hcHBlbmRDaGlsZChyZXJ1blRyaWdnZXIpO1xuXHQgICAgdGVzdEJsb2NrLmlkID0gXCJxdW5pdC10ZXN0LW91dHB1dC1cIiArIHRlc3RJZDtcblx0ICAgIGFzc2VydExpc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwib2xcIik7XG5cdCAgICBhc3NlcnRMaXN0LmNsYXNzTmFtZSA9IFwicXVuaXQtYXNzZXJ0LWxpc3RcIjtcblx0ICAgIHRlc3RCbG9jay5hcHBlbmRDaGlsZChhc3NlcnRMaXN0KTtcblx0ICAgIHRlc3RzLmFwcGVuZENoaWxkKHRlc3RCbG9jayk7XG5cdCAgfSAvLyBIVE1MIFJlcG9ydGVyIGluaXRpYWxpemF0aW9uIGFuZCBsb2FkXG5cblxuXHQgIFFVbml0LmJlZ2luKGZ1bmN0aW9uIChkZXRhaWxzKSB7XG5cdCAgICB2YXIgaSwgbW9kdWxlT2JqOyAvLyBTb3J0IG1vZHVsZXMgYnkgbmFtZSBmb3IgdGhlIHBpY2tlclxuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgZGV0YWlscy5tb2R1bGVzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIG1vZHVsZU9iaiA9IGRldGFpbHMubW9kdWxlc1tpXTtcblxuXHQgICAgICBpZiAobW9kdWxlT2JqLm5hbWUpIHtcblx0ICAgICAgICBtb2R1bGVzTGlzdC5wdXNoKG1vZHVsZU9iai5uYW1lKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBtb2R1bGVzTGlzdC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG5cdCAgICAgIHJldHVybiBhLmxvY2FsZUNvbXBhcmUoYik7XG5cdCAgICB9KTsgLy8gSW5pdGlhbGl6ZSBRVW5pdCBlbGVtZW50c1xuXG5cdCAgICBhcHBlbmRJbnRlcmZhY2UoKTtcblx0ICB9KTtcblx0ICBRVW5pdC5kb25lKGZ1bmN0aW9uIChkZXRhaWxzKSB7XG5cdCAgICB2YXIgYmFubmVyID0gaWQoXCJxdW5pdC1iYW5uZXJcIiksXG5cdCAgICAgICAgdGVzdHMgPSBpZChcInF1bml0LXRlc3RzXCIpLFxuXHQgICAgICAgIGFib3J0QnV0dG9uID0gaWQoXCJxdW5pdC1hYm9ydC10ZXN0cy1idXR0b25cIiksXG5cdCAgICAgICAgdG90YWxUZXN0cyA9IHN0YXRzLnBhc3NlZFRlc3RzICsgc3RhdHMuc2tpcHBlZFRlc3RzICsgc3RhdHMudG9kb1Rlc3RzICsgc3RhdHMuZmFpbGVkVGVzdHMsXG5cdCAgICAgICAgaHRtbCA9IFt0b3RhbFRlc3RzLCBcIiB0ZXN0cyBjb21wbGV0ZWQgaW4gXCIsIGRldGFpbHMucnVudGltZSwgXCIgbWlsbGlzZWNvbmRzLCB3aXRoIFwiLCBzdGF0cy5mYWlsZWRUZXN0cywgXCIgZmFpbGVkLCBcIiwgc3RhdHMuc2tpcHBlZFRlc3RzLCBcIiBza2lwcGVkLCBhbmQgXCIsIHN0YXRzLnRvZG9UZXN0cywgXCIgdG9kby48YnIgLz5cIiwgXCI8c3BhbiBjbGFzcz0ncGFzc2VkJz5cIiwgZGV0YWlscy5wYXNzZWQsIFwiPC9zcGFuPiBhc3NlcnRpb25zIG9mIDxzcGFuIGNsYXNzPSd0b3RhbCc+XCIsIGRldGFpbHMudG90YWwsIFwiPC9zcGFuPiBwYXNzZWQsIDxzcGFuIGNsYXNzPSdmYWlsZWQnPlwiLCBkZXRhaWxzLmZhaWxlZCwgXCI8L3NwYW4+IGZhaWxlZC5cIl0uam9pbihcIlwiKSxcblx0ICAgICAgICB0ZXN0LFxuXHQgICAgICAgIGFzc2VydExpLFxuXHQgICAgICAgIGFzc2VydExpc3Q7IC8vIFVwZGF0ZSByZW1haW5pbmcgdGVzdHMgdG8gYWJvcnRlZFxuXG5cdCAgICBpZiAoYWJvcnRCdXR0b24gJiYgYWJvcnRCdXR0b24uZGlzYWJsZWQpIHtcblx0ICAgICAgaHRtbCA9IFwiVGVzdHMgYWJvcnRlZCBhZnRlciBcIiArIGRldGFpbHMucnVudGltZSArIFwiIG1pbGxpc2Vjb25kcy5cIjtcblxuXHQgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRlc3RzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgdGVzdCA9IHRlc3RzLmNoaWxkcmVuW2ldO1xuXG5cdCAgICAgICAgaWYgKHRlc3QuY2xhc3NOYW1lID09PSBcIlwiIHx8IHRlc3QuY2xhc3NOYW1lID09PSBcInJ1bm5pbmdcIikge1xuXHQgICAgICAgICAgdGVzdC5jbGFzc05hbWUgPSBcImFib3J0ZWRcIjtcblx0ICAgICAgICAgIGFzc2VydExpc3QgPSB0ZXN0LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwib2xcIilbMF07XG5cdCAgICAgICAgICBhc3NlcnRMaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcblx0ICAgICAgICAgIGFzc2VydExpLmNsYXNzTmFtZSA9IFwiZmFpbFwiO1xuXHQgICAgICAgICAgYXNzZXJ0TGkuaW5uZXJIVE1MID0gXCJUZXN0IGFib3J0ZWQuXCI7XG5cdCAgICAgICAgICBhc3NlcnRMaXN0LmFwcGVuZENoaWxkKGFzc2VydExpKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgaWYgKGJhbm5lciAmJiAoIWFib3J0QnV0dG9uIHx8IGFib3J0QnV0dG9uLmRpc2FibGVkID09PSBmYWxzZSkpIHtcblx0ICAgICAgYmFubmVyLmNsYXNzTmFtZSA9IHN0YXRzLmZhaWxlZFRlc3RzID8gXCJxdW5pdC1mYWlsXCIgOiBcInF1bml0LXBhc3NcIjtcblx0ICAgIH1cblxuXHQgICAgaWYgKGFib3J0QnV0dG9uKSB7XG5cdCAgICAgIGFib3J0QnV0dG9uLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYWJvcnRCdXR0b24pO1xuXHQgICAgfVxuXG5cdCAgICBpZiAodGVzdHMpIHtcblx0ICAgICAgaWQoXCJxdW5pdC10ZXN0cmVzdWx0LWRpc3BsYXlcIikuaW5uZXJIVE1MID0gaHRtbDtcblx0ICAgIH1cblxuXHQgICAgaWYgKGNvbmZpZy5hbHRlcnRpdGxlICYmIGRvY3VtZW50LnRpdGxlKSB7XG5cdCAgICAgIC8vIFNob3cg4pyWIGZvciBnb29kLCDinJQgZm9yIGJhZCBzdWl0ZSByZXN1bHQgaW4gdGl0bGVcblx0ICAgICAgLy8gdXNlIGVzY2FwZSBzZXF1ZW5jZXMgaW4gY2FzZSBmaWxlIGdldHMgbG9hZGVkIHdpdGggbm9uLXV0Zi04XG5cdCAgICAgIC8vIGNoYXJzZXRcblx0ICAgICAgZG9jdW1lbnQudGl0bGUgPSBbc3RhdHMuZmFpbGVkVGVzdHMgPyBcIlxcdTI3MTZcIiA6IFwiXFx1MjcxNFwiLCBkb2N1bWVudC50aXRsZS5yZXBsYWNlKC9eW1xcdTI3MTRcXHUyNzE2XSAvaSwgXCJcIildLmpvaW4oXCIgXCIpO1xuXHQgICAgfSAvLyBTY3JvbGwgYmFjayB0byB0b3AgdG8gc2hvdyByZXN1bHRzXG5cblxuXHQgICAgaWYgKGNvbmZpZy5zY3JvbGx0b3AgJiYgd2luZG93JDEuc2Nyb2xsVG8pIHtcblx0ICAgICAgd2luZG93JDEuc2Nyb2xsVG8oMCwgMCk7XG5cdCAgICB9XG5cdCAgfSk7XG5cblx0ICBmdW5jdGlvbiBnZXROYW1lSHRtbChuYW1lLCBtb2R1bGUpIHtcblx0ICAgIHZhciBuYW1lSHRtbCA9IFwiXCI7XG5cblx0ICAgIGlmIChtb2R1bGUpIHtcblx0ICAgICAgbmFtZUh0bWwgPSBcIjxzcGFuIGNsYXNzPSdtb2R1bGUtbmFtZSc+XCIgKyBlc2NhcGVUZXh0KG1vZHVsZSkgKyBcIjwvc3Bhbj46IFwiO1xuXHQgICAgfVxuXG5cdCAgICBuYW1lSHRtbCArPSBcIjxzcGFuIGNsYXNzPSd0ZXN0LW5hbWUnPlwiICsgZXNjYXBlVGV4dChuYW1lKSArIFwiPC9zcGFuPlwiO1xuXHQgICAgcmV0dXJuIG5hbWVIdG1sO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGdldFByb2dyZXNzSHRtbChydW50aW1lLCBzdGF0cywgdG90YWwpIHtcblx0ICAgIHZhciBjb21wbGV0ZWQgPSBzdGF0cy5wYXNzZWRUZXN0cyArIHN0YXRzLnNraXBwZWRUZXN0cyArIHN0YXRzLnRvZG9UZXN0cyArIHN0YXRzLmZhaWxlZFRlc3RzO1xuXHQgICAgcmV0dXJuIFtcIjxiciAvPlwiLCBjb21wbGV0ZWQsIFwiIC8gXCIsIHRvdGFsLCBcIiB0ZXN0cyBjb21wbGV0ZWQgaW4gXCIsIHJ1bnRpbWUsIFwiIG1pbGxpc2Vjb25kcywgd2l0aCBcIiwgc3RhdHMuZmFpbGVkVGVzdHMsIFwiIGZhaWxlZCwgXCIsIHN0YXRzLnNraXBwZWRUZXN0cywgXCIgc2tpcHBlZCwgYW5kIFwiLCBzdGF0cy50b2RvVGVzdHMsIFwiIHRvZG8uXCJdLmpvaW4oXCJcIik7XG5cdCAgfVxuXG5cdCAgUVVuaXQudGVzdFN0YXJ0KGZ1bmN0aW9uIChkZXRhaWxzKSB7XG5cdCAgICB2YXIgcnVubmluZywgYmFkO1xuXHQgICAgYXBwZW5kVGVzdChkZXRhaWxzLm5hbWUsIGRldGFpbHMudGVzdElkLCBkZXRhaWxzLm1vZHVsZSk7XG5cdCAgICBydW5uaW5nID0gaWQoXCJxdW5pdC10ZXN0cmVzdWx0LWRpc3BsYXlcIik7XG5cblx0ICAgIGlmIChydW5uaW5nKSB7XG5cdCAgICAgIGFkZENsYXNzKHJ1bm5pbmcsIFwicnVubmluZ1wiKTtcblx0ICAgICAgYmFkID0gUVVuaXQuY29uZmlnLnJlb3JkZXIgJiYgZGV0YWlscy5wcmV2aW91c0ZhaWx1cmU7XG5cdCAgICAgIHJ1bm5pbmcuaW5uZXJIVE1MID0gW2JhZCA/IFwiUmVydW5uaW5nIHByZXZpb3VzbHkgZmFpbGVkIHRlc3Q6IDxiciAvPlwiIDogXCJSdW5uaW5nOiA8YnIgLz5cIiwgZ2V0TmFtZUh0bWwoZGV0YWlscy5uYW1lLCBkZXRhaWxzLm1vZHVsZSksIGdldFByb2dyZXNzSHRtbChub3coKSAtIGNvbmZpZy5zdGFydGVkLCBzdGF0cywgVGVzdC5jb3VudCldLmpvaW4oXCJcIik7XG5cdCAgICB9XG5cdCAgfSk7XG5cblx0ICBmdW5jdGlvbiBzdHJpcEh0bWwoc3RyaW5nKSB7XG5cdCAgICAvLyBTdHJpcCB0YWdzLCBodG1sIGVudGl0eSBhbmQgd2hpdGVzcGFjZXNcblx0ICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvPFxcLz9bXj5dKyg+fCQpL2csIFwiXCIpLnJlcGxhY2UoLyZxdW90Oy9nLCBcIlwiKS5yZXBsYWNlKC9cXHMrL2csIFwiXCIpO1xuXHQgIH1cblxuXHQgIFFVbml0LmxvZyhmdW5jdGlvbiAoZGV0YWlscykge1xuXHQgICAgdmFyIGFzc2VydExpc3QsXG5cdCAgICAgICAgYXNzZXJ0TGksXG5cdCAgICAgICAgbWVzc2FnZSxcblx0ICAgICAgICBleHBlY3RlZCxcblx0ICAgICAgICBhY3R1YWwsXG5cdCAgICAgICAgZGlmZixcblx0ICAgICAgICBzaG93RGlmZiA9IGZhbHNlLFxuXHQgICAgICAgIHRlc3RJdGVtID0gaWQoXCJxdW5pdC10ZXN0LW91dHB1dC1cIiArIGRldGFpbHMudGVzdElkKTtcblxuXHQgICAgaWYgKCF0ZXN0SXRlbSkge1xuXHQgICAgICByZXR1cm47XG5cdCAgICB9XG5cblx0ICAgIG1lc3NhZ2UgPSBlc2NhcGVUZXh0KGRldGFpbHMubWVzc2FnZSkgfHwgKGRldGFpbHMucmVzdWx0ID8gXCJva2F5XCIgOiBcImZhaWxlZFwiKTtcblx0ICAgIG1lc3NhZ2UgPSBcIjxzcGFuIGNsYXNzPSd0ZXN0LW1lc3NhZ2UnPlwiICsgbWVzc2FnZSArIFwiPC9zcGFuPlwiO1xuXHQgICAgbWVzc2FnZSArPSBcIjxzcGFuIGNsYXNzPSdydW50aW1lJz5AIFwiICsgZGV0YWlscy5ydW50aW1lICsgXCIgbXM8L3NwYW4+XCI7IC8vIFRoZSBwdXNoRmFpbHVyZSBkb2Vzbid0IHByb3ZpZGUgZGV0YWlscy5leHBlY3RlZFxuXHQgICAgLy8gd2hlbiBpdCBjYWxscywgaXQncyBpbXBsaWNpdCB0byBhbHNvIG5vdCBzaG93IGV4cGVjdGVkIGFuZCBkaWZmIHN0dWZmXG5cdCAgICAvLyBBbHNvLCB3ZSBuZWVkIHRvIGNoZWNrIGRldGFpbHMuZXhwZWN0ZWQgZXhpc3RlbmNlLCBhcyBpdCBjYW4gZXhpc3QgYW5kIGJlIHVuZGVmaW5lZFxuXG5cdCAgICBpZiAoIWRldGFpbHMucmVzdWx0ICYmIGhhc093bi5jYWxsKGRldGFpbHMsIFwiZXhwZWN0ZWRcIikpIHtcblx0ICAgICAgaWYgKGRldGFpbHMubmVnYXRpdmUpIHtcblx0ICAgICAgICBleHBlY3RlZCA9IFwiTk9UIFwiICsgUVVuaXQuZHVtcC5wYXJzZShkZXRhaWxzLmV4cGVjdGVkKTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBleHBlY3RlZCA9IFFVbml0LmR1bXAucGFyc2UoZGV0YWlscy5leHBlY3RlZCk7XG5cdCAgICAgIH1cblxuXHQgICAgICBhY3R1YWwgPSBRVW5pdC5kdW1wLnBhcnNlKGRldGFpbHMuYWN0dWFsKTtcblx0ICAgICAgbWVzc2FnZSArPSBcIjx0YWJsZT48dHIgY2xhc3M9J3Rlc3QtZXhwZWN0ZWQnPjx0aD5FeHBlY3RlZDogPC90aD48dGQ+PHByZT5cIiArIGVzY2FwZVRleHQoZXhwZWN0ZWQpICsgXCI8L3ByZT48L3RkPjwvdHI+XCI7XG5cblx0ICAgICAgaWYgKGFjdHVhbCAhPT0gZXhwZWN0ZWQpIHtcblx0ICAgICAgICBtZXNzYWdlICs9IFwiPHRyIGNsYXNzPSd0ZXN0LWFjdHVhbCc+PHRoPlJlc3VsdDogPC90aD48dGQ+PHByZT5cIiArIGVzY2FwZVRleHQoYWN0dWFsKSArIFwiPC9wcmU+PC90ZD48L3RyPlwiO1xuXG5cdCAgICAgICAgaWYgKHR5cGVvZiBkZXRhaWxzLmFjdHVhbCA9PT0gXCJudW1iZXJcIiAmJiB0eXBlb2YgZGV0YWlscy5leHBlY3RlZCA9PT0gXCJudW1iZXJcIikge1xuXHQgICAgICAgICAgaWYgKCFpc05hTihkZXRhaWxzLmFjdHVhbCkgJiYgIWlzTmFOKGRldGFpbHMuZXhwZWN0ZWQpKSB7XG5cdCAgICAgICAgICAgIHNob3dEaWZmID0gdHJ1ZTtcblx0ICAgICAgICAgICAgZGlmZiA9IGRldGFpbHMuYWN0dWFsIC0gZGV0YWlscy5leHBlY3RlZDtcblx0ICAgICAgICAgICAgZGlmZiA9IChkaWZmID4gMCA/IFwiK1wiIDogXCJcIikgKyBkaWZmO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGRldGFpbHMuYWN0dWFsICE9PSBcImJvb2xlYW5cIiAmJiB0eXBlb2YgZGV0YWlscy5leHBlY3RlZCAhPT0gXCJib29sZWFuXCIpIHtcblx0ICAgICAgICAgIGRpZmYgPSBRVW5pdC5kaWZmKGV4cGVjdGVkLCBhY3R1YWwpOyAvLyBkb24ndCBzaG93IGRpZmYgaWYgdGhlcmUgaXMgemVybyBvdmVybGFwXG5cblx0ICAgICAgICAgIHNob3dEaWZmID0gc3RyaXBIdG1sKGRpZmYpLmxlbmd0aCAhPT0gc3RyaXBIdG1sKGV4cGVjdGVkKS5sZW5ndGggKyBzdHJpcEh0bWwoYWN0dWFsKS5sZW5ndGg7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaWYgKHNob3dEaWZmKSB7XG5cdCAgICAgICAgICBtZXNzYWdlICs9IFwiPHRyIGNsYXNzPSd0ZXN0LWRpZmYnPjx0aD5EaWZmOiA8L3RoPjx0ZD48cHJlPlwiICsgZGlmZiArIFwiPC9wcmU+PC90ZD48L3RyPlwiO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSBlbHNlIGlmIChleHBlY3RlZC5pbmRleE9mKFwiW29iamVjdCBBcnJheV1cIikgIT09IC0xIHx8IGV4cGVjdGVkLmluZGV4T2YoXCJbb2JqZWN0IE9iamVjdF1cIikgIT09IC0xKSB7XG5cdCAgICAgICAgbWVzc2FnZSArPSBcIjx0ciBjbGFzcz0ndGVzdC1tZXNzYWdlJz48dGg+TWVzc2FnZTogPC90aD48dGQ+XCIgKyBcIkRpZmYgc3VwcHJlc3NlZCBhcyB0aGUgZGVwdGggb2Ygb2JqZWN0IGlzIG1vcmUgdGhhbiBjdXJyZW50IG1heCBkZXB0aCAoXCIgKyBRVW5pdC5jb25maWcubWF4RGVwdGggKyBcIikuPHA+SGludDogVXNlIDxjb2RlPlFVbml0LmR1bXAubWF4RGVwdGg8L2NvZGU+IHRvIFwiICsgXCIgcnVuIHdpdGggYSBoaWdoZXIgbWF4IGRlcHRoIG9yIDxhIGhyZWY9J1wiICsgZXNjYXBlVGV4dChzZXRVcmwoe1xuXHQgICAgICAgICAgbWF4RGVwdGg6IC0xXG5cdCAgICAgICAgfSkpICsgXCInPlwiICsgXCJSZXJ1bjwvYT4gd2l0aG91dCBtYXggZGVwdGguPC9wPjwvdGQ+PC90cj5cIjtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBtZXNzYWdlICs9IFwiPHRyIGNsYXNzPSd0ZXN0LW1lc3NhZ2UnPjx0aD5NZXNzYWdlOiA8L3RoPjx0ZD5cIiArIFwiRGlmZiBzdXBwcmVzc2VkIGFzIHRoZSBleHBlY3RlZCBhbmQgYWN0dWFsIHJlc3VsdHMgaGF2ZSBhbiBlcXVpdmFsZW50XCIgKyBcIiBzZXJpYWxpemF0aW9uPC90ZD48L3RyPlwiO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKGRldGFpbHMuc291cmNlKSB7XG5cdCAgICAgICAgbWVzc2FnZSArPSBcIjx0ciBjbGFzcz0ndGVzdC1zb3VyY2UnPjx0aD5Tb3VyY2U6IDwvdGg+PHRkPjxwcmU+XCIgKyBlc2NhcGVUZXh0KGRldGFpbHMuc291cmNlKSArIFwiPC9wcmU+PC90ZD48L3RyPlwiO1xuXHQgICAgICB9XG5cblx0ICAgICAgbWVzc2FnZSArPSBcIjwvdGFibGU+XCI7IC8vIFRoaXMgb2NjdXJzIHdoZW4gcHVzaEZhaWx1cmUgaXMgc2V0IGFuZCB3ZSBoYXZlIGFuIGV4dHJhY3RlZCBzdGFjayB0cmFjZVxuXHQgICAgfSBlbHNlIGlmICghZGV0YWlscy5yZXN1bHQgJiYgZGV0YWlscy5zb3VyY2UpIHtcblx0ICAgICAgbWVzc2FnZSArPSBcIjx0YWJsZT5cIiArIFwiPHRyIGNsYXNzPSd0ZXN0LXNvdXJjZSc+PHRoPlNvdXJjZTogPC90aD48dGQ+PHByZT5cIiArIGVzY2FwZVRleHQoZGV0YWlscy5zb3VyY2UpICsgXCI8L3ByZT48L3RkPjwvdHI+XCIgKyBcIjwvdGFibGU+XCI7XG5cdCAgICB9XG5cblx0ICAgIGFzc2VydExpc3QgPSB0ZXN0SXRlbS5nZXRFbGVtZW50c0J5VGFnTmFtZShcIm9sXCIpWzBdO1xuXHQgICAgYXNzZXJ0TGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG5cdCAgICBhc3NlcnRMaS5jbGFzc05hbWUgPSBkZXRhaWxzLnJlc3VsdCA/IFwicGFzc1wiIDogXCJmYWlsXCI7XG5cdCAgICBhc3NlcnRMaS5pbm5lckhUTUwgPSBtZXNzYWdlO1xuXHQgICAgYXNzZXJ0TGlzdC5hcHBlbmRDaGlsZChhc3NlcnRMaSk7XG5cdCAgfSk7XG5cdCAgUVVuaXQudGVzdERvbmUoZnVuY3Rpb24gKGRldGFpbHMpIHtcblx0ICAgIHZhciB0ZXN0VGl0bGUsXG5cdCAgICAgICAgdGltZSxcblx0ICAgICAgICB0ZXN0SXRlbSxcblx0ICAgICAgICBhc3NlcnRMaXN0LFxuXHQgICAgICAgIHN0YXR1cyxcblx0ICAgICAgICBnb29kLFxuXHQgICAgICAgIGJhZCxcblx0ICAgICAgICB0ZXN0Q291bnRzLFxuXHQgICAgICAgIHNraXBwZWQsXG5cdCAgICAgICAgc291cmNlTmFtZSxcblx0ICAgICAgICB0ZXN0cyA9IGlkKFwicXVuaXQtdGVzdHNcIik7XG5cblx0ICAgIGlmICghdGVzdHMpIHtcblx0ICAgICAgcmV0dXJuO1xuXHQgICAgfVxuXG5cdCAgICB0ZXN0SXRlbSA9IGlkKFwicXVuaXQtdGVzdC1vdXRwdXQtXCIgKyBkZXRhaWxzLnRlc3RJZCk7XG5cdCAgICByZW1vdmVDbGFzcyh0ZXN0SXRlbSwgXCJydW5uaW5nXCIpO1xuXG5cdCAgICBpZiAoZGV0YWlscy5mYWlsZWQgPiAwKSB7XG5cdCAgICAgIHN0YXR1cyA9IFwiZmFpbGVkXCI7XG5cdCAgICB9IGVsc2UgaWYgKGRldGFpbHMudG9kbykge1xuXHQgICAgICBzdGF0dXMgPSBcInRvZG9cIjtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHN0YXR1cyA9IGRldGFpbHMuc2tpcHBlZCA/IFwic2tpcHBlZFwiIDogXCJwYXNzZWRcIjtcblx0ICAgIH1cblxuXHQgICAgYXNzZXJ0TGlzdCA9IHRlc3RJdGVtLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwib2xcIilbMF07XG5cdCAgICBnb29kID0gZGV0YWlscy5wYXNzZWQ7XG5cdCAgICBiYWQgPSBkZXRhaWxzLmZhaWxlZDsgLy8gVGhpcyB0ZXN0IHBhc3NlZCBpZiBpdCBoYXMgbm8gdW5leHBlY3RlZCBmYWlsZWQgYXNzZXJ0aW9uc1xuXG5cdCAgICB2YXIgdGVzdFBhc3NlZCA9IGRldGFpbHMuZmFpbGVkID4gMCA/IGRldGFpbHMudG9kbyA6ICFkZXRhaWxzLnRvZG87XG5cblx0ICAgIGlmICh0ZXN0UGFzc2VkKSB7XG5cdCAgICAgIC8vIENvbGxhcHNlIHRoZSBwYXNzaW5nIHRlc3RzXG5cdCAgICAgIGFkZENsYXNzKGFzc2VydExpc3QsIFwicXVuaXQtY29sbGFwc2VkXCIpO1xuXHQgICAgfSBlbHNlIGlmIChjb25maWcuY29sbGFwc2UpIHtcblx0ICAgICAgaWYgKCFjb2xsYXBzZU5leHQpIHtcblx0ICAgICAgICAvLyBTa2lwIGNvbGxhcHNpbmcgdGhlIGZpcnN0IGZhaWxpbmcgdGVzdFxuXHQgICAgICAgIGNvbGxhcHNlTmV4dCA9IHRydWU7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgLy8gQ29sbGFwc2UgcmVtYWluaW5nIHRlc3RzXG5cdCAgICAgICAgYWRkQ2xhc3MoYXNzZXJ0TGlzdCwgXCJxdW5pdC1jb2xsYXBzZWRcIik7XG5cdCAgICAgIH1cblx0ICAgIH0gLy8gVGhlIHRlc3RJdGVtLmZpcnN0Q2hpbGQgaXMgdGhlIHRlc3QgbmFtZVxuXG5cblx0ICAgIHRlc3RUaXRsZSA9IHRlc3RJdGVtLmZpcnN0Q2hpbGQ7XG5cdCAgICB0ZXN0Q291bnRzID0gYmFkID8gXCI8YiBjbGFzcz0nZmFpbGVkJz5cIiArIGJhZCArIFwiPC9iPiwgXCIgKyBcIjxiIGNsYXNzPSdwYXNzZWQnPlwiICsgZ29vZCArIFwiPC9iPiwgXCIgOiBcIlwiO1xuXHQgICAgdGVzdFRpdGxlLmlubmVySFRNTCArPSBcIiA8YiBjbGFzcz0nY291bnRzJz4oXCIgKyB0ZXN0Q291bnRzICsgZGV0YWlscy5hc3NlcnRpb25zLmxlbmd0aCArIFwiKTwvYj5cIjtcblxuXHQgICAgaWYgKGRldGFpbHMuc2tpcHBlZCkge1xuXHQgICAgICBzdGF0cy5za2lwcGVkVGVzdHMrKztcblx0ICAgICAgdGVzdEl0ZW0uY2xhc3NOYW1lID0gXCJza2lwcGVkXCI7XG5cdCAgICAgIHNraXBwZWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZW1cIik7XG5cdCAgICAgIHNraXBwZWQuY2xhc3NOYW1lID0gXCJxdW5pdC1za2lwcGVkLWxhYmVsXCI7XG5cdCAgICAgIHNraXBwZWQuaW5uZXJIVE1MID0gXCJza2lwcGVkXCI7XG5cdCAgICAgIHRlc3RJdGVtLmluc2VydEJlZm9yZShza2lwcGVkLCB0ZXN0VGl0bGUpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgYWRkRXZlbnQodGVzdFRpdGxlLCBcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICB0b2dnbGVDbGFzcyhhc3NlcnRMaXN0LCBcInF1bml0LWNvbGxhcHNlZFwiKTtcblx0ICAgICAgfSk7XG5cdCAgICAgIHRlc3RJdGVtLmNsYXNzTmFtZSA9IHRlc3RQYXNzZWQgPyBcInBhc3NcIiA6IFwiZmFpbFwiO1xuXG5cdCAgICAgIGlmIChkZXRhaWxzLnRvZG8pIHtcblx0ICAgICAgICB2YXIgdG9kb0xhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImVtXCIpO1xuXHQgICAgICAgIHRvZG9MYWJlbC5jbGFzc05hbWUgPSBcInF1bml0LXRvZG8tbGFiZWxcIjtcblx0ICAgICAgICB0b2RvTGFiZWwuaW5uZXJIVE1MID0gXCJ0b2RvXCI7XG5cdCAgICAgICAgdGVzdEl0ZW0uY2xhc3NOYW1lICs9IFwiIHRvZG9cIjtcblx0ICAgICAgICB0ZXN0SXRlbS5pbnNlcnRCZWZvcmUodG9kb0xhYmVsLCB0ZXN0VGl0bGUpO1xuXHQgICAgICB9XG5cblx0ICAgICAgdGltZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuXHQgICAgICB0aW1lLmNsYXNzTmFtZSA9IFwicnVudGltZVwiO1xuXHQgICAgICB0aW1lLmlubmVySFRNTCA9IGRldGFpbHMucnVudGltZSArIFwiIG1zXCI7XG5cdCAgICAgIHRlc3RJdGVtLmluc2VydEJlZm9yZSh0aW1lLCBhc3NlcnRMaXN0KTtcblxuXHQgICAgICBpZiAoIXRlc3RQYXNzZWQpIHtcblx0ICAgICAgICBzdGF0cy5mYWlsZWRUZXN0cysrO1xuXHQgICAgICB9IGVsc2UgaWYgKGRldGFpbHMudG9kbykge1xuXHQgICAgICAgIHN0YXRzLnRvZG9UZXN0cysrO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHN0YXRzLnBhc3NlZFRlc3RzKys7XG5cdCAgICAgIH1cblx0ICAgIH0gLy8gU2hvdyB0aGUgc291cmNlIG9mIHRoZSB0ZXN0IHdoZW4gc2hvd2luZyBhc3NlcnRpb25zXG5cblxuXHQgICAgaWYgKGRldGFpbHMuc291cmNlKSB7XG5cdCAgICAgIHNvdXJjZU5hbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwicFwiKTtcblx0ICAgICAgc291cmNlTmFtZS5pbm5lckhUTUwgPSBcIjxzdHJvbmc+U291cmNlOiA8L3N0cm9uZz5cIiArIGVzY2FwZVRleHQoZGV0YWlscy5zb3VyY2UpO1xuXHQgICAgICBhZGRDbGFzcyhzb3VyY2VOYW1lLCBcInF1bml0LXNvdXJjZVwiKTtcblxuXHQgICAgICBpZiAodGVzdFBhc3NlZCkge1xuXHQgICAgICAgIGFkZENsYXNzKHNvdXJjZU5hbWUsIFwicXVuaXQtY29sbGFwc2VkXCIpO1xuXHQgICAgICB9XG5cblx0ICAgICAgYWRkRXZlbnQodGVzdFRpdGxlLCBcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICB0b2dnbGVDbGFzcyhzb3VyY2VOYW1lLCBcInF1bml0LWNvbGxhcHNlZFwiKTtcblx0ICAgICAgfSk7XG5cdCAgICAgIHRlc3RJdGVtLmFwcGVuZENoaWxkKHNvdXJjZU5hbWUpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY29uZmlnLmhpZGVwYXNzZWQgJiYgKHN0YXR1cyA9PT0gXCJwYXNzZWRcIiB8fCBkZXRhaWxzLnNraXBwZWQpKSB7XG5cdCAgICAgIC8vIHVzZSByZW1vdmVDaGlsZCBpbnN0ZWFkIG9mIHJlbW92ZSBiZWNhdXNlIG9mIHN1cHBvcnRcblx0ICAgICAgaGlkZGVuVGVzdHMucHVzaCh0ZXN0SXRlbSk7XG5cdCAgICAgIHRlc3RzLnJlbW92ZUNoaWxkKHRlc3RJdGVtKTtcblx0ICAgIH1cblx0ICB9KTsgLy8gQXZvaWQgcmVhZHlTdGF0ZSBpc3N1ZSB3aXRoIHBoYW50b21qc1xuXHQgIC8vIFJlZjogIzgxOFxuXG5cdCAgdmFyIG5vdFBoYW50b20gPSBmdW5jdGlvbiAocCkge1xuXHQgICAgcmV0dXJuICEocCAmJiBwLnZlcnNpb24gJiYgcC52ZXJzaW9uLm1ham9yID4gMCk7XG5cdCAgfSh3aW5kb3ckMS5waGFudG9tKTtcblxuXHQgIGlmIChub3RQaGFudG9tICYmIGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwiY29tcGxldGVcIikge1xuXHQgICAgUVVuaXQubG9hZCgpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICBhZGRFdmVudCh3aW5kb3ckMSwgXCJsb2FkXCIsIFFVbml0LmxvYWQpO1xuXHQgIH0gLy8gV3JhcCB3aW5kb3cub25lcnJvci4gV2Ugd2lsbCBjYWxsIHRoZSBvcmlnaW5hbCB3aW5kb3cub25lcnJvciB0byBzZWUgaWZcblx0ICAvLyB0aGUgZXhpc3RpbmcgaGFuZGxlciBmdWxseSBoYW5kbGVzIHRoZSBlcnJvcjsgaWYgbm90LCB3ZSB3aWxsIGNhbGwgdGhlXG5cdCAgLy8gUVVuaXQub25FcnJvciBmdW5jdGlvbi5cblxuXG5cdCAgdmFyIG9yaWdpbmFsV2luZG93T25FcnJvciA9IHdpbmRvdyQxLm9uZXJyb3I7IC8vIENvdmVyIHVuY2F1Z2h0IGV4Y2VwdGlvbnNcblx0ICAvLyBSZXR1cm5pbmcgdHJ1ZSB3aWxsIHN1cHByZXNzIHRoZSBkZWZhdWx0IGJyb3dzZXIgaGFuZGxlcixcblx0ICAvLyByZXR1cm5pbmcgZmFsc2Ugd2lsbCBsZXQgaXQgcnVuLlxuXG5cdCAgd2luZG93JDEub25lcnJvciA9IGZ1bmN0aW9uIChtZXNzYWdlLCBmaWxlTmFtZSwgbGluZU51bWJlciwgY29sdW1uTnVtYmVyLCBlcnJvck9iaikge1xuXHQgICAgdmFyIHJldCA9IGZhbHNlO1xuXG5cdCAgICBpZiAob3JpZ2luYWxXaW5kb3dPbkVycm9yKSB7XG5cdCAgICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gbmV3IEFycmF5KF9sZW4gPiA1ID8gX2xlbiAtIDUgOiAwKSwgX2tleSA9IDU7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcblx0ICAgICAgICBhcmdzW19rZXkgLSA1XSA9IGFyZ3VtZW50c1tfa2V5XTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldCA9IG9yaWdpbmFsV2luZG93T25FcnJvci5jYWxsLmFwcGx5KG9yaWdpbmFsV2luZG93T25FcnJvciwgW3RoaXMsIG1lc3NhZ2UsIGZpbGVOYW1lLCBsaW5lTnVtYmVyLCBjb2x1bW5OdW1iZXIsIGVycm9yT2JqXS5jb25jYXQoYXJncykpO1xuXHQgICAgfSAvLyBUcmVhdCByZXR1cm4gdmFsdWUgYXMgd2luZG93Lm9uZXJyb3IgaXRzZWxmIGRvZXMsXG5cdCAgICAvLyBPbmx5IGRvIG91ciBoYW5kbGluZyBpZiBub3Qgc3VwcHJlc3NlZC5cblxuXG5cdCAgICBpZiAocmV0ICE9PSB0cnVlKSB7XG5cdCAgICAgIHZhciBlcnJvciA9IHtcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuXHQgICAgICAgIGZpbGVOYW1lOiBmaWxlTmFtZSxcblx0ICAgICAgICBsaW5lTnVtYmVyOiBsaW5lTnVtYmVyXG5cdCAgICAgIH07IC8vIEFjY29yZGluZyB0b1xuXHQgICAgICAvLyBodHRwczovL2Jsb2cuc2VudHJ5LmlvLzIwMTYvMDEvMDQvY2xpZW50LWphdmFzY3JpcHQtcmVwb3J0aW5nLXdpbmRvdy1vbmVycm9yLFxuXHQgICAgICAvLyBtb3N0IG1vZGVybiBicm93c2VycyBzdXBwb3J0IGFuIGVycm9yT2JqIGFyZ3VtZW50OyB1c2UgdGhhdCB0b1xuXHQgICAgICAvLyBnZXQgYSBmdWxsIHN0YWNrIHRyYWNlIGlmIGl0J3MgYXZhaWxhYmxlLlxuXG5cdCAgICAgIGlmIChlcnJvck9iaiAmJiBlcnJvck9iai5zdGFjaykge1xuXHQgICAgICAgIGVycm9yLnN0YWNrdHJhY2UgPSBleHRyYWN0U3RhY2t0cmFjZShlcnJvck9iaiwgMCk7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXQgPSBRVW5pdC5vbkVycm9yKGVycm9yKTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHJldDtcblx0ICB9OyAvLyBMaXN0ZW4gZm9yIHVuaGFuZGxlZCByZWplY3Rpb25zLCBhbmQgY2FsbCBRVW5pdC5vblVuaGFuZGxlZFJlamVjdGlvblxuXG5cblx0ICB3aW5kb3ckMS5hZGRFdmVudExpc3RlbmVyKFwidW5oYW5kbGVkcmVqZWN0aW9uXCIsIGZ1bmN0aW9uIChldmVudCkge1xuXHQgICAgUVVuaXQub25VbmhhbmRsZWRSZWplY3Rpb24oZXZlbnQucmVhc29uKTtcblx0ICB9KTtcblx0fSkoKTtcblxuXHQvKlxuXHQgKiBUaGlzIGZpbGUgaXMgYSBtb2RpZmllZCB2ZXJzaW9uIG9mIGdvb2dsZS1kaWZmLW1hdGNoLXBhdGNoJ3MgSmF2YVNjcmlwdCBpbXBsZW1lbnRhdGlvblxuXHQgKiAoaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9nb29nbGUtZGlmZi1tYXRjaC1wYXRjaC9zb3VyY2UvYnJvd3NlL3RydW5rL2phdmFzY3JpcHQvZGlmZl9tYXRjaF9wYXRjaF91bmNvbXByZXNzZWQuanMpLFxuXHQgKiBtb2RpZmljYXRpb25zIGFyZSBsaWNlbnNlZCBhcyBtb3JlIGZ1bGx5IHNldCBmb3J0aCBpbiBMSUNFTlNFLnR4dC5cblx0ICpcblx0ICogVGhlIG9yaWdpbmFsIHNvdXJjZSBvZiBnb29nbGUtZGlmZi1tYXRjaC1wYXRjaCBpcyBhdHRyaWJ1dGFibGUgYW5kIGxpY2Vuc2VkIGFzIGZvbGxvd3M6XG5cdCAqXG5cdCAqIENvcHlyaWdodCAyMDA2IEdvb2dsZSBJbmMuXG5cdCAqIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvZ29vZ2xlLWRpZmYtbWF0Y2gtcGF0Y2gvXG5cdCAqXG5cdCAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG5cdCAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cblx0ICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cdCAqXG5cdCAqIGh0dHBzOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblx0ICpcblx0ICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuXHQgKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5cdCAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuXHQgKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5cdCAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuXHQgKlxuXHQgKiBNb3JlIEluZm86XG5cdCAqICBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2dvb2dsZS1kaWZmLW1hdGNoLXBhdGNoL1xuXHQgKlxuXHQgKiBVc2FnZTogUVVuaXQuZGlmZihleHBlY3RlZCwgYWN0dWFsKVxuXHQgKlxuXHQgKi9cblxuXHRRVW5pdC5kaWZmID0gZnVuY3Rpb24gKCkge1xuXHQgIGZ1bmN0aW9uIERpZmZNYXRjaFBhdGNoKCkge30gLy8gIERJRkYgRlVOQ1RJT05TXG5cblx0ICAvKipcblx0ICAgKiBUaGUgZGF0YSBzdHJ1Y3R1cmUgcmVwcmVzZW50aW5nIGEgZGlmZiBpcyBhbiBhcnJheSBvZiB0dXBsZXM6XG5cdCAgICogW1tESUZGX0RFTEVURSwgJ0hlbGxvJ10sIFtESUZGX0lOU0VSVCwgJ0dvb2RieWUnXSwgW0RJRkZfRVFVQUwsICcgd29ybGQuJ11dXG5cdCAgICogd2hpY2ggbWVhbnM6IGRlbGV0ZSAnSGVsbG8nLCBhZGQgJ0dvb2RieWUnIGFuZCBrZWVwICcgd29ybGQuJ1xuXHQgICAqL1xuXG5cblx0ICB2YXIgRElGRl9ERUxFVEUgPSAtMSxcblx0ICAgICAgRElGRl9JTlNFUlQgPSAxLFxuXHQgICAgICBESUZGX0VRVUFMID0gMCxcblx0ICAgICAgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblx0ICAvKipcblx0ICAgKiBGaW5kIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHR3byB0ZXh0cy4gIFNpbXBsaWZpZXMgdGhlIHByb2JsZW0gYnkgc3RyaXBwaW5nXG5cdCAgICogYW55IGNvbW1vbiBwcmVmaXggb3Igc3VmZml4IG9mZiB0aGUgdGV4dHMgYmVmb3JlIGRpZmZpbmcuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cblx0ICAgKiBAcGFyYW0ge2Jvb2xlYW49fSBvcHRDaGVja2xpbmVzIE9wdGlvbmFsIHNwZWVkdXAgZmxhZy4gSWYgcHJlc2VudCBhbmQgZmFsc2UsXG5cdCAgICogICAgIHRoZW4gZG9uJ3QgcnVuIGEgbGluZS1sZXZlbCBkaWZmIGZpcnN0IHRvIGlkZW50aWZ5IHRoZSBjaGFuZ2VkIGFyZWFzLlxuXHQgICAqICAgICBEZWZhdWx0cyB0byB0cnVlLCB3aGljaCBkb2VzIGEgZmFzdGVyLCBzbGlnaHRseSBsZXNzIG9wdGltYWwgZGlmZi5cblx0ICAgKiBAcmV0dXJuIHshQXJyYXkuPCFEaWZmTWF0Y2hQYXRjaC5EaWZmPn0gQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG5cdCAgICovXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuRGlmZk1haW4gPSBmdW5jdGlvbiAodGV4dDEsIHRleHQyLCBvcHRDaGVja2xpbmVzKSB7XG5cdCAgICB2YXIgZGVhZGxpbmUsIGNoZWNrbGluZXMsIGNvbW1vbmxlbmd0aCwgY29tbW9ucHJlZml4LCBjb21tb25zdWZmaXgsIGRpZmZzOyAvLyBUaGUgZGlmZiBtdXN0IGJlIGNvbXBsZXRlIGluIHVwIHRvIDEgc2Vjb25kLlxuXG5cdCAgICBkZWFkbGluZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpICsgMTAwMDsgLy8gQ2hlY2sgZm9yIG51bGwgaW5wdXRzLlxuXG5cdCAgICBpZiAodGV4dDEgPT09IG51bGwgfHwgdGV4dDIgPT09IG51bGwpIHtcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTnVsbCBpbnB1dC4gKERpZmZNYWluKVwiKTtcblx0ICAgIH0gLy8gQ2hlY2sgZm9yIGVxdWFsaXR5IChzcGVlZHVwKS5cblxuXG5cdCAgICBpZiAodGV4dDEgPT09IHRleHQyKSB7XG5cdCAgICAgIGlmICh0ZXh0MSkge1xuXHQgICAgICAgIHJldHVybiBbW0RJRkZfRVFVQUwsIHRleHQxXV07XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gW107XG5cdCAgICB9XG5cblx0ICAgIGlmICh0eXBlb2Ygb3B0Q2hlY2tsaW5lcyA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHQgICAgICBvcHRDaGVja2xpbmVzID0gdHJ1ZTtcblx0ICAgIH1cblxuXHQgICAgY2hlY2tsaW5lcyA9IG9wdENoZWNrbGluZXM7IC8vIFRyaW0gb2ZmIGNvbW1vbiBwcmVmaXggKHNwZWVkdXApLlxuXG5cdCAgICBjb21tb25sZW5ndGggPSB0aGlzLmRpZmZDb21tb25QcmVmaXgodGV4dDEsIHRleHQyKTtcblx0ICAgIGNvbW1vbnByZWZpeCA9IHRleHQxLnN1YnN0cmluZygwLCBjb21tb25sZW5ndGgpO1xuXHQgICAgdGV4dDEgPSB0ZXh0MS5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcblx0ICAgIHRleHQyID0gdGV4dDIuc3Vic3RyaW5nKGNvbW1vbmxlbmd0aCk7IC8vIFRyaW0gb2ZmIGNvbW1vbiBzdWZmaXggKHNwZWVkdXApLlxuXG5cdCAgICBjb21tb25sZW5ndGggPSB0aGlzLmRpZmZDb21tb25TdWZmaXgodGV4dDEsIHRleHQyKTtcblx0ICAgIGNvbW1vbnN1ZmZpeCA9IHRleHQxLnN1YnN0cmluZyh0ZXh0MS5sZW5ndGggLSBjb21tb25sZW5ndGgpO1xuXHQgICAgdGV4dDEgPSB0ZXh0MS5zdWJzdHJpbmcoMCwgdGV4dDEubGVuZ3RoIC0gY29tbW9ubGVuZ3RoKTtcblx0ICAgIHRleHQyID0gdGV4dDIuc3Vic3RyaW5nKDAsIHRleHQyLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7IC8vIENvbXB1dGUgdGhlIGRpZmYgb24gdGhlIG1pZGRsZSBibG9jay5cblxuXHQgICAgZGlmZnMgPSB0aGlzLmRpZmZDb21wdXRlKHRleHQxLCB0ZXh0MiwgY2hlY2tsaW5lcywgZGVhZGxpbmUpOyAvLyBSZXN0b3JlIHRoZSBwcmVmaXggYW5kIHN1ZmZpeC5cblxuXHQgICAgaWYgKGNvbW1vbnByZWZpeCkge1xuXHQgICAgICBkaWZmcy51bnNoaWZ0KFtESUZGX0VRVUFMLCBjb21tb25wcmVmaXhdKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGNvbW1vbnN1ZmZpeCkge1xuXHQgICAgICBkaWZmcy5wdXNoKFtESUZGX0VRVUFMLCBjb21tb25zdWZmaXhdKTtcblx0ICAgIH1cblxuXHQgICAgdGhpcy5kaWZmQ2xlYW51cE1lcmdlKGRpZmZzKTtcblx0ICAgIHJldHVybiBkaWZmcztcblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIFJlZHVjZSB0aGUgbnVtYmVyIG9mIGVkaXRzIGJ5IGVsaW1pbmF0aW5nIG9wZXJhdGlvbmFsbHkgdHJpdmlhbCBlcXVhbGl0aWVzLlxuXHQgICAqIEBwYXJhbSB7IUFycmF5LjwhRGlmZk1hdGNoUGF0Y2guRGlmZj59IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkNsZWFudXBFZmZpY2llbmN5ID0gZnVuY3Rpb24gKGRpZmZzKSB7XG5cdCAgICB2YXIgY2hhbmdlcywgZXF1YWxpdGllcywgZXF1YWxpdGllc0xlbmd0aCwgbGFzdGVxdWFsaXR5LCBwb2ludGVyLCBwcmVJbnMsIHByZURlbCwgcG9zdElucywgcG9zdERlbDtcblx0ICAgIGNoYW5nZXMgPSBmYWxzZTtcblx0ICAgIGVxdWFsaXRpZXMgPSBbXTsgLy8gU3RhY2sgb2YgaW5kaWNlcyB3aGVyZSBlcXVhbGl0aWVzIGFyZSBmb3VuZC5cblxuXHQgICAgZXF1YWxpdGllc0xlbmd0aCA9IDA7IC8vIEtlZXBpbmcgb3VyIG93biBsZW5ndGggdmFyIGlzIGZhc3RlciBpbiBKUy5cblxuXHQgICAgLyoqIEB0eXBlIHs/c3RyaW5nfSAqL1xuXG5cdCAgICBsYXN0ZXF1YWxpdHkgPSBudWxsOyAvLyBBbHdheXMgZXF1YWwgdG8gZGlmZnNbZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV1dWzFdXG5cblx0ICAgIHBvaW50ZXIgPSAwOyAvLyBJbmRleCBvZiBjdXJyZW50IHBvc2l0aW9uLlxuXHQgICAgLy8gSXMgdGhlcmUgYW4gaW5zZXJ0aW9uIG9wZXJhdGlvbiBiZWZvcmUgdGhlIGxhc3QgZXF1YWxpdHkuXG5cblx0ICAgIHByZUlucyA9IGZhbHNlOyAvLyBJcyB0aGVyZSBhIGRlbGV0aW9uIG9wZXJhdGlvbiBiZWZvcmUgdGhlIGxhc3QgZXF1YWxpdHkuXG5cblx0ICAgIHByZURlbCA9IGZhbHNlOyAvLyBJcyB0aGVyZSBhbiBpbnNlcnRpb24gb3BlcmF0aW9uIGFmdGVyIHRoZSBsYXN0IGVxdWFsaXR5LlxuXG5cdCAgICBwb3N0SW5zID0gZmFsc2U7IC8vIElzIHRoZXJlIGEgZGVsZXRpb24gb3BlcmF0aW9uIGFmdGVyIHRoZSBsYXN0IGVxdWFsaXR5LlxuXG5cdCAgICBwb3N0RGVsID0gZmFsc2U7XG5cblx0ICAgIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoKSB7XG5cdCAgICAgIC8vIEVxdWFsaXR5IGZvdW5kLlxuXHQgICAgICBpZiAoZGlmZnNbcG9pbnRlcl1bMF0gPT09IERJRkZfRVFVQUwpIHtcblx0ICAgICAgICBpZiAoZGlmZnNbcG9pbnRlcl1bMV0ubGVuZ3RoIDwgNCAmJiAocG9zdElucyB8fCBwb3N0RGVsKSkge1xuXHQgICAgICAgICAgLy8gQ2FuZGlkYXRlIGZvdW5kLlxuXHQgICAgICAgICAgZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoKytdID0gcG9pbnRlcjtcblx0ICAgICAgICAgIHByZUlucyA9IHBvc3RJbnM7XG5cdCAgICAgICAgICBwcmVEZWwgPSBwb3N0RGVsO1xuXHQgICAgICAgICAgbGFzdGVxdWFsaXR5ID0gZGlmZnNbcG9pbnRlcl1bMV07XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIC8vIE5vdCBhIGNhbmRpZGF0ZSwgYW5kIGNhbiBuZXZlciBiZWNvbWUgb25lLlxuXHQgICAgICAgICAgZXF1YWxpdGllc0xlbmd0aCA9IDA7XG5cdCAgICAgICAgICBsYXN0ZXF1YWxpdHkgPSBudWxsO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHBvc3RJbnMgPSBwb3N0RGVsID0gZmFsc2U7IC8vIEFuIGluc2VydGlvbiBvciBkZWxldGlvbi5cblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBpZiAoZGlmZnNbcG9pbnRlcl1bMF0gPT09IERJRkZfREVMRVRFKSB7XG5cdCAgICAgICAgICBwb3N0RGVsID0gdHJ1ZTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgcG9zdElucyA9IHRydWU7XG5cdCAgICAgICAgfVxuXHQgICAgICAgIC8qXG5cdCAgICAgICAgICogRml2ZSB0eXBlcyB0byBiZSBzcGxpdDpcblx0ICAgICAgICAgKiA8aW5zPkE8L2lucz48ZGVsPkI8L2RlbD5YWTxpbnM+QzwvaW5zPjxkZWw+RDwvZGVsPlxuXHQgICAgICAgICAqIDxpbnM+QTwvaW5zPlg8aW5zPkM8L2lucz48ZGVsPkQ8L2RlbD5cblx0ICAgICAgICAgKiA8aW5zPkE8L2lucz48ZGVsPkI8L2RlbD5YPGlucz5DPC9pbnM+XG5cdCAgICAgICAgICogPGlucz5BPC9kZWw+WDxpbnM+QzwvaW5zPjxkZWw+RDwvZGVsPlxuXHQgICAgICAgICAqIDxpbnM+QTwvaW5zPjxkZWw+QjwvZGVsPlg8ZGVsPkM8L2RlbD5cblx0ICAgICAgICAgKi9cblxuXG5cdCAgICAgICAgaWYgKGxhc3RlcXVhbGl0eSAmJiAocHJlSW5zICYmIHByZURlbCAmJiBwb3N0SW5zICYmIHBvc3REZWwgfHwgbGFzdGVxdWFsaXR5Lmxlbmd0aCA8IDIgJiYgcHJlSW5zICsgcHJlRGVsICsgcG9zdElucyArIHBvc3REZWwgPT09IDMpKSB7XG5cdCAgICAgICAgICAvLyBEdXBsaWNhdGUgcmVjb3JkLlxuXHQgICAgICAgICAgZGlmZnMuc3BsaWNlKGVxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdLCAwLCBbRElGRl9ERUxFVEUsIGxhc3RlcXVhbGl0eV0pOyAvLyBDaGFuZ2Ugc2Vjb25kIGNvcHkgdG8gaW5zZXJ0LlxuXG5cdCAgICAgICAgICBkaWZmc1tlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGggLSAxXSArIDFdWzBdID0gRElGRl9JTlNFUlQ7XG5cdCAgICAgICAgICBlcXVhbGl0aWVzTGVuZ3RoLS07IC8vIFRocm93IGF3YXkgdGhlIGVxdWFsaXR5IHdlIGp1c3QgZGVsZXRlZDtcblxuXHQgICAgICAgICAgbGFzdGVxdWFsaXR5ID0gbnVsbDtcblxuXHQgICAgICAgICAgaWYgKHByZUlucyAmJiBwcmVEZWwpIHtcblx0ICAgICAgICAgICAgLy8gTm8gY2hhbmdlcyBtYWRlIHdoaWNoIGNvdWxkIGFmZmVjdCBwcmV2aW91cyBlbnRyeSwga2VlcCBnb2luZy5cblx0ICAgICAgICAgICAgcG9zdElucyA9IHBvc3REZWwgPSB0cnVlO1xuXHQgICAgICAgICAgICBlcXVhbGl0aWVzTGVuZ3RoID0gMDtcblx0ICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgIGVxdWFsaXRpZXNMZW5ndGgtLTsgLy8gVGhyb3cgYXdheSB0aGUgcHJldmlvdXMgZXF1YWxpdHkuXG5cblx0ICAgICAgICAgICAgcG9pbnRlciA9IGVxdWFsaXRpZXNMZW5ndGggPiAwID8gZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV0gOiAtMTtcblx0ICAgICAgICAgICAgcG9zdElucyA9IHBvc3REZWwgPSBmYWxzZTtcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgY2hhbmdlcyA9IHRydWU7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgcG9pbnRlcisrO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY2hhbmdlcykge1xuXHQgICAgICB0aGlzLmRpZmZDbGVhbnVwTWVyZ2UoZGlmZnMpO1xuXHQgICAgfVxuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogQ29udmVydCBhIGRpZmYgYXJyYXkgaW50byBhIHByZXR0eSBIVE1MIHJlcG9ydC5cblx0ICAgKiBAcGFyYW0geyFBcnJheS48IURpZmZNYXRjaFBhdGNoLkRpZmY+fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblx0ICAgKiBAcGFyYW0ge2ludGVnZXJ9IHN0cmluZyB0byBiZSBiZWF1dGlmaWVkLlxuXHQgICAqIEByZXR1cm4ge3N0cmluZ30gSFRNTCByZXByZXNlbnRhdGlvbi5cblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZQcmV0dHlIdG1sID0gZnVuY3Rpb24gKGRpZmZzKSB7XG5cdCAgICB2YXIgb3AsXG5cdCAgICAgICAgZGF0YSxcblx0ICAgICAgICB4LFxuXHQgICAgICAgIGh0bWwgPSBbXTtcblxuXHQgICAgZm9yICh4ID0gMDsgeCA8IGRpZmZzLmxlbmd0aDsgeCsrKSB7XG5cdCAgICAgIG9wID0gZGlmZnNbeF1bMF07IC8vIE9wZXJhdGlvbiAoaW5zZXJ0LCBkZWxldGUsIGVxdWFsKVxuXG5cdCAgICAgIGRhdGEgPSBkaWZmc1t4XVsxXTsgLy8gVGV4dCBvZiBjaGFuZ2UuXG5cblx0ICAgICAgc3dpdGNoIChvcCkge1xuXHQgICAgICAgIGNhc2UgRElGRl9JTlNFUlQ6XG5cdCAgICAgICAgICBodG1sW3hdID0gXCI8aW5zPlwiICsgZXNjYXBlVGV4dChkYXRhKSArIFwiPC9pbnM+XCI7XG5cdCAgICAgICAgICBicmVhaztcblxuXHQgICAgICAgIGNhc2UgRElGRl9ERUxFVEU6XG5cdCAgICAgICAgICBodG1sW3hdID0gXCI8ZGVsPlwiICsgZXNjYXBlVGV4dChkYXRhKSArIFwiPC9kZWw+XCI7XG5cdCAgICAgICAgICBicmVhaztcblxuXHQgICAgICAgIGNhc2UgRElGRl9FUVVBTDpcblx0ICAgICAgICAgIGh0bWxbeF0gPSBcIjxzcGFuPlwiICsgZXNjYXBlVGV4dChkYXRhKSArIFwiPC9zcGFuPlwiO1xuXHQgICAgICAgICAgYnJlYWs7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGh0bWwuam9pbihcIlwiKTtcblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIERldGVybWluZSB0aGUgY29tbW9uIHByZWZpeCBvZiB0d28gc3RyaW5ncy5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgRmlyc3Qgc3RyaW5nLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBTZWNvbmQgc3RyaW5nLlxuXHQgICAqIEByZXR1cm4ge251bWJlcn0gVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGNvbW1vbiB0byB0aGUgc3RhcnQgb2YgZWFjaFxuXHQgICAqICAgICBzdHJpbmcuXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmQ29tbW9uUHJlZml4ID0gZnVuY3Rpb24gKHRleHQxLCB0ZXh0Mikge1xuXHQgICAgdmFyIHBvaW50ZXJtaWQsIHBvaW50ZXJtYXgsIHBvaW50ZXJtaW4sIHBvaW50ZXJzdGFydDsgLy8gUXVpY2sgY2hlY2sgZm9yIGNvbW1vbiBudWxsIGNhc2VzLlxuXG5cdCAgICBpZiAoIXRleHQxIHx8ICF0ZXh0MiB8fCB0ZXh0MS5jaGFyQXQoMCkgIT09IHRleHQyLmNoYXJBdCgwKSkge1xuXHQgICAgICByZXR1cm4gMDtcblx0ICAgIH0gLy8gQmluYXJ5IHNlYXJjaC5cblx0ICAgIC8vIFBlcmZvcm1hbmNlIGFuYWx5c2lzOiBodHRwczovL25laWwuZnJhc2VyLm5hbWUvbmV3cy8yMDA3LzEwLzA5L1xuXG5cblx0ICAgIHBvaW50ZXJtaW4gPSAwO1xuXHQgICAgcG9pbnRlcm1heCA9IE1hdGgubWluKHRleHQxLmxlbmd0aCwgdGV4dDIubGVuZ3RoKTtcblx0ICAgIHBvaW50ZXJtaWQgPSBwb2ludGVybWF4O1xuXHQgICAgcG9pbnRlcnN0YXJ0ID0gMDtcblxuXHQgICAgd2hpbGUgKHBvaW50ZXJtaW4gPCBwb2ludGVybWlkKSB7XG5cdCAgICAgIGlmICh0ZXh0MS5zdWJzdHJpbmcocG9pbnRlcnN0YXJ0LCBwb2ludGVybWlkKSA9PT0gdGV4dDIuc3Vic3RyaW5nKHBvaW50ZXJzdGFydCwgcG9pbnRlcm1pZCkpIHtcblx0ICAgICAgICBwb2ludGVybWluID0gcG9pbnRlcm1pZDtcblx0ICAgICAgICBwb2ludGVyc3RhcnQgPSBwb2ludGVybWluO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHBvaW50ZXJtYXggPSBwb2ludGVybWlkO1xuXHQgICAgICB9XG5cblx0ICAgICAgcG9pbnRlcm1pZCA9IE1hdGguZmxvb3IoKHBvaW50ZXJtYXggLSBwb2ludGVybWluKSAvIDIgKyBwb2ludGVybWluKTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHBvaW50ZXJtaWQ7XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBEZXRlcm1pbmUgdGhlIGNvbW1vbiBzdWZmaXggb2YgdHdvIHN0cmluZ3MuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIEZpcnN0IHN0cmluZy5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cblx0ICAgKiBAcmV0dXJuIHtudW1iZXJ9IFRoZSBudW1iZXIgb2YgY2hhcmFjdGVycyBjb21tb24gdG8gdGhlIGVuZCBvZiBlYWNoIHN0cmluZy5cblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZDb21tb25TdWZmaXggPSBmdW5jdGlvbiAodGV4dDEsIHRleHQyKSB7XG5cdCAgICB2YXIgcG9pbnRlcm1pZCwgcG9pbnRlcm1heCwgcG9pbnRlcm1pbiwgcG9pbnRlcmVuZDsgLy8gUXVpY2sgY2hlY2sgZm9yIGNvbW1vbiBudWxsIGNhc2VzLlxuXG5cdCAgICBpZiAoIXRleHQxIHx8ICF0ZXh0MiB8fCB0ZXh0MS5jaGFyQXQodGV4dDEubGVuZ3RoIC0gMSkgIT09IHRleHQyLmNoYXJBdCh0ZXh0Mi5sZW5ndGggLSAxKSkge1xuXHQgICAgICByZXR1cm4gMDtcblx0ICAgIH0gLy8gQmluYXJ5IHNlYXJjaC5cblx0ICAgIC8vIFBlcmZvcm1hbmNlIGFuYWx5c2lzOiBodHRwczovL25laWwuZnJhc2VyLm5hbWUvbmV3cy8yMDA3LzEwLzA5L1xuXG5cblx0ICAgIHBvaW50ZXJtaW4gPSAwO1xuXHQgICAgcG9pbnRlcm1heCA9IE1hdGgubWluKHRleHQxLmxlbmd0aCwgdGV4dDIubGVuZ3RoKTtcblx0ICAgIHBvaW50ZXJtaWQgPSBwb2ludGVybWF4O1xuXHQgICAgcG9pbnRlcmVuZCA9IDA7XG5cblx0ICAgIHdoaWxlIChwb2ludGVybWluIDwgcG9pbnRlcm1pZCkge1xuXHQgICAgICBpZiAodGV4dDEuc3Vic3RyaW5nKHRleHQxLmxlbmd0aCAtIHBvaW50ZXJtaWQsIHRleHQxLmxlbmd0aCAtIHBvaW50ZXJlbmQpID09PSB0ZXh0Mi5zdWJzdHJpbmcodGV4dDIubGVuZ3RoIC0gcG9pbnRlcm1pZCwgdGV4dDIubGVuZ3RoIC0gcG9pbnRlcmVuZCkpIHtcblx0ICAgICAgICBwb2ludGVybWluID0gcG9pbnRlcm1pZDtcblx0ICAgICAgICBwb2ludGVyZW5kID0gcG9pbnRlcm1pbjtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBwb2ludGVybWF4ID0gcG9pbnRlcm1pZDtcblx0ICAgICAgfVxuXG5cdCAgICAgIHBvaW50ZXJtaWQgPSBNYXRoLmZsb29yKChwb2ludGVybWF4IC0gcG9pbnRlcm1pbikgLyAyICsgcG9pbnRlcm1pbik7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBwb2ludGVybWlkO1xuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogRmluZCB0aGUgZGlmZmVyZW5jZXMgYmV0d2VlbiB0d28gdGV4dHMuICBBc3N1bWVzIHRoYXQgdGhlIHRleHRzIGRvIG5vdFxuXHQgICAqIGhhdmUgYW55IGNvbW1vbiBwcmVmaXggb3Igc3VmZml4LlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgTmV3IHN0cmluZyB0byBiZSBkaWZmZWQuXG5cdCAgICogQHBhcmFtIHtib29sZWFufSBjaGVja2xpbmVzIFNwZWVkdXAgZmxhZy4gIElmIGZhbHNlLCB0aGVuIGRvbid0IHJ1biBhXG5cdCAgICogICAgIGxpbmUtbGV2ZWwgZGlmZiBmaXJzdCB0byBpZGVudGlmeSB0aGUgY2hhbmdlZCBhcmVhcy5cblx0ICAgKiAgICAgSWYgdHJ1ZSwgdGhlbiBydW4gYSBmYXN0ZXIsIHNsaWdodGx5IGxlc3Mgb3B0aW1hbCBkaWZmLlxuXHQgICAqIEBwYXJhbSB7bnVtYmVyfSBkZWFkbGluZSBUaW1lIHdoZW4gdGhlIGRpZmYgc2hvdWxkIGJlIGNvbXBsZXRlIGJ5LlxuXHQgICAqIEByZXR1cm4geyFBcnJheS48IURpZmZNYXRjaFBhdGNoLkRpZmY+fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblx0ICAgKiBAcHJpdmF0ZVxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkNvbXB1dGUgPSBmdW5jdGlvbiAodGV4dDEsIHRleHQyLCBjaGVja2xpbmVzLCBkZWFkbGluZSkge1xuXHQgICAgdmFyIGRpZmZzLCBsb25ndGV4dCwgc2hvcnR0ZXh0LCBpLCBobSwgdGV4dDFBLCB0ZXh0MkEsIHRleHQxQiwgdGV4dDJCLCBtaWRDb21tb24sIGRpZmZzQSwgZGlmZnNCO1xuXG5cdCAgICBpZiAoIXRleHQxKSB7XG5cdCAgICAgIC8vIEp1c3QgYWRkIHNvbWUgdGV4dCAoc3BlZWR1cCkuXG5cdCAgICAgIHJldHVybiBbW0RJRkZfSU5TRVJULCB0ZXh0Ml1dO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoIXRleHQyKSB7XG5cdCAgICAgIC8vIEp1c3QgZGVsZXRlIHNvbWUgdGV4dCAoc3BlZWR1cCkuXG5cdCAgICAgIHJldHVybiBbW0RJRkZfREVMRVRFLCB0ZXh0MV1dO1xuXHQgICAgfVxuXG5cdCAgICBsb25ndGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQxIDogdGV4dDI7XG5cdCAgICBzaG9ydHRleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MiA6IHRleHQxO1xuXHQgICAgaSA9IGxvbmd0ZXh0LmluZGV4T2Yoc2hvcnR0ZXh0KTtcblxuXHQgICAgaWYgKGkgIT09IC0xKSB7XG5cdCAgICAgIC8vIFNob3J0ZXIgdGV4dCBpcyBpbnNpZGUgdGhlIGxvbmdlciB0ZXh0IChzcGVlZHVwKS5cblx0ICAgICAgZGlmZnMgPSBbW0RJRkZfSU5TRVJULCBsb25ndGV4dC5zdWJzdHJpbmcoMCwgaSldLCBbRElGRl9FUVVBTCwgc2hvcnR0ZXh0XSwgW0RJRkZfSU5TRVJULCBsb25ndGV4dC5zdWJzdHJpbmcoaSArIHNob3J0dGV4dC5sZW5ndGgpXV07IC8vIFN3YXAgaW5zZXJ0aW9ucyBmb3IgZGVsZXRpb25zIGlmIGRpZmYgaXMgcmV2ZXJzZWQuXG5cblx0ICAgICAgaWYgKHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCkge1xuXHQgICAgICAgIGRpZmZzWzBdWzBdID0gZGlmZnNbMl1bMF0gPSBESUZGX0RFTEVURTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBkaWZmcztcblx0ICAgIH1cblxuXHQgICAgaWYgKHNob3J0dGV4dC5sZW5ndGggPT09IDEpIHtcblx0ICAgICAgLy8gU2luZ2xlIGNoYXJhY3RlciBzdHJpbmcuXG5cdCAgICAgIC8vIEFmdGVyIHRoZSBwcmV2aW91cyBzcGVlZHVwLCB0aGUgY2hhcmFjdGVyIGNhbid0IGJlIGFuIGVxdWFsaXR5LlxuXHQgICAgICByZXR1cm4gW1tESUZGX0RFTEVURSwgdGV4dDFdLCBbRElGRl9JTlNFUlQsIHRleHQyXV07XG5cdCAgICB9IC8vIENoZWNrIHRvIHNlZSBpZiB0aGUgcHJvYmxlbSBjYW4gYmUgc3BsaXQgaW4gdHdvLlxuXG5cblx0ICAgIGhtID0gdGhpcy5kaWZmSGFsZk1hdGNoKHRleHQxLCB0ZXh0Mik7XG5cblx0ICAgIGlmIChobSkge1xuXHQgICAgICAvLyBBIGhhbGYtbWF0Y2ggd2FzIGZvdW5kLCBzb3J0IG91dCB0aGUgcmV0dXJuIGRhdGEuXG5cdCAgICAgIHRleHQxQSA9IGhtWzBdO1xuXHQgICAgICB0ZXh0MUIgPSBobVsxXTtcblx0ICAgICAgdGV4dDJBID0gaG1bMl07XG5cdCAgICAgIHRleHQyQiA9IGhtWzNdO1xuXHQgICAgICBtaWRDb21tb24gPSBobVs0XTsgLy8gU2VuZCBib3RoIHBhaXJzIG9mZiBmb3Igc2VwYXJhdGUgcHJvY2Vzc2luZy5cblxuXHQgICAgICBkaWZmc0EgPSB0aGlzLkRpZmZNYWluKHRleHQxQSwgdGV4dDJBLCBjaGVja2xpbmVzLCBkZWFkbGluZSk7XG5cdCAgICAgIGRpZmZzQiA9IHRoaXMuRGlmZk1haW4odGV4dDFCLCB0ZXh0MkIsIGNoZWNrbGluZXMsIGRlYWRsaW5lKTsgLy8gTWVyZ2UgdGhlIHJlc3VsdHMuXG5cblx0ICAgICAgcmV0dXJuIGRpZmZzQS5jb25jYXQoW1tESUZGX0VRVUFMLCBtaWRDb21tb25dXSwgZGlmZnNCKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGNoZWNrbGluZXMgJiYgdGV4dDEubGVuZ3RoID4gMTAwICYmIHRleHQyLmxlbmd0aCA+IDEwMCkge1xuXHQgICAgICByZXR1cm4gdGhpcy5kaWZmTGluZU1vZGUodGV4dDEsIHRleHQyLCBkZWFkbGluZSk7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiB0aGlzLmRpZmZCaXNlY3QodGV4dDEsIHRleHQyLCBkZWFkbGluZSk7XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBEbyB0aGUgdHdvIHRleHRzIHNoYXJlIGEgc3Vic3RyaW5nIHdoaWNoIGlzIGF0IGxlYXN0IGhhbGYgdGhlIGxlbmd0aCBvZiB0aGVcblx0ICAgKiBsb25nZXIgdGV4dD9cblx0ICAgKiBUaGlzIHNwZWVkdXAgY2FuIHByb2R1Y2Ugbm9uLW1pbmltYWwgZGlmZnMuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIEZpcnN0IHN0cmluZy5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cblx0ICAgKiBAcmV0dXJuIHtBcnJheS48c3RyaW5nPn0gRml2ZSBlbGVtZW50IEFycmF5LCBjb250YWluaW5nIHRoZSBwcmVmaXggb2Zcblx0ICAgKiAgICAgdGV4dDEsIHRoZSBzdWZmaXggb2YgdGV4dDEsIHRoZSBwcmVmaXggb2YgdGV4dDIsIHRoZSBzdWZmaXggb2Zcblx0ICAgKiAgICAgdGV4dDIgYW5kIHRoZSBjb21tb24gbWlkZGxlLiAgT3IgbnVsbCBpZiB0aGVyZSB3YXMgbm8gbWF0Y2guXG5cdCAgICogQHByaXZhdGVcblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZIYWxmTWF0Y2ggPSBmdW5jdGlvbiAodGV4dDEsIHRleHQyKSB7XG5cdCAgICB2YXIgbG9uZ3RleHQsIHNob3J0dGV4dCwgZG1wLCB0ZXh0MUEsIHRleHQyQiwgdGV4dDJBLCB0ZXh0MUIsIG1pZENvbW1vbiwgaG0xLCBobTIsIGhtO1xuXHQgICAgbG9uZ3RleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MSA6IHRleHQyO1xuXHQgICAgc2hvcnR0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDIgOiB0ZXh0MTtcblxuXHQgICAgaWYgKGxvbmd0ZXh0Lmxlbmd0aCA8IDQgfHwgc2hvcnR0ZXh0Lmxlbmd0aCAqIDIgPCBsb25ndGV4dC5sZW5ndGgpIHtcblx0ICAgICAgcmV0dXJuIG51bGw7IC8vIFBvaW50bGVzcy5cblx0ICAgIH1cblxuXHQgICAgZG1wID0gdGhpczsgLy8gJ3RoaXMnIGJlY29tZXMgJ3dpbmRvdycgaW4gYSBjbG9zdXJlLlxuXG5cdCAgICAvKipcblx0ICAgICAqIERvZXMgYSBzdWJzdHJpbmcgb2Ygc2hvcnR0ZXh0IGV4aXN0IHdpdGhpbiBsb25ndGV4dCBzdWNoIHRoYXQgdGhlIHN1YnN0cmluZ1xuXHQgICAgICogaXMgYXQgbGVhc3QgaGFsZiB0aGUgbGVuZ3RoIG9mIGxvbmd0ZXh0P1xuXHQgICAgICogQ2xvc3VyZSwgYnV0IGRvZXMgbm90IHJlZmVyZW5jZSBhbnkgZXh0ZXJuYWwgdmFyaWFibGVzLlxuXHQgICAgICogQHBhcmFtIHtzdHJpbmd9IGxvbmd0ZXh0IExvbmdlciBzdHJpbmcuXG5cdCAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2hvcnR0ZXh0IFNob3J0ZXIgc3RyaW5nLlxuXHQgICAgICogQHBhcmFtIHtudW1iZXJ9IGkgU3RhcnQgaW5kZXggb2YgcXVhcnRlciBsZW5ndGggc3Vic3RyaW5nIHdpdGhpbiBsb25ndGV4dC5cblx0ICAgICAqIEByZXR1cm4ge0FycmF5LjxzdHJpbmc+fSBGaXZlIGVsZW1lbnQgQXJyYXksIGNvbnRhaW5pbmcgdGhlIHByZWZpeCBvZlxuXHQgICAgICogICAgIGxvbmd0ZXh0LCB0aGUgc3VmZml4IG9mIGxvbmd0ZXh0LCB0aGUgcHJlZml4IG9mIHNob3J0dGV4dCwgdGhlIHN1ZmZpeFxuXHQgICAgICogICAgIG9mIHNob3J0dGV4dCBhbmQgdGhlIGNvbW1vbiBtaWRkbGUuICBPciBudWxsIGlmIHRoZXJlIHdhcyBubyBtYXRjaC5cblx0ICAgICAqIEBwcml2YXRlXG5cdCAgICAgKi9cblxuXHQgICAgZnVuY3Rpb24gZGlmZkhhbGZNYXRjaEkobG9uZ3RleHQsIHNob3J0dGV4dCwgaSkge1xuXHQgICAgICB2YXIgc2VlZCwgaiwgYmVzdENvbW1vbiwgcHJlZml4TGVuZ3RoLCBzdWZmaXhMZW5ndGgsIGJlc3RMb25ndGV4dEEsIGJlc3RMb25ndGV4dEIsIGJlc3RTaG9ydHRleHRBLCBiZXN0U2hvcnR0ZXh0QjsgLy8gU3RhcnQgd2l0aCBhIDEvNCBsZW5ndGggc3Vic3RyaW5nIGF0IHBvc2l0aW9uIGkgYXMgYSBzZWVkLlxuXG5cdCAgICAgIHNlZWQgPSBsb25ndGV4dC5zdWJzdHJpbmcoaSwgaSArIE1hdGguZmxvb3IobG9uZ3RleHQubGVuZ3RoIC8gNCkpO1xuXHQgICAgICBqID0gLTE7XG5cdCAgICAgIGJlc3RDb21tb24gPSBcIlwiO1xuXG5cdCAgICAgIHdoaWxlICgoaiA9IHNob3J0dGV4dC5pbmRleE9mKHNlZWQsIGogKyAxKSkgIT09IC0xKSB7XG5cdCAgICAgICAgcHJlZml4TGVuZ3RoID0gZG1wLmRpZmZDb21tb25QcmVmaXgobG9uZ3RleHQuc3Vic3RyaW5nKGkpLCBzaG9ydHRleHQuc3Vic3RyaW5nKGopKTtcblx0ICAgICAgICBzdWZmaXhMZW5ndGggPSBkbXAuZGlmZkNvbW1vblN1ZmZpeChsb25ndGV4dC5zdWJzdHJpbmcoMCwgaSksIHNob3J0dGV4dC5zdWJzdHJpbmcoMCwgaikpO1xuXG5cdCAgICAgICAgaWYgKGJlc3RDb21tb24ubGVuZ3RoIDwgc3VmZml4TGVuZ3RoICsgcHJlZml4TGVuZ3RoKSB7XG5cdCAgICAgICAgICBiZXN0Q29tbW9uID0gc2hvcnR0ZXh0LnN1YnN0cmluZyhqIC0gc3VmZml4TGVuZ3RoLCBqKSArIHNob3J0dGV4dC5zdWJzdHJpbmcoaiwgaiArIHByZWZpeExlbmd0aCk7XG5cdCAgICAgICAgICBiZXN0TG9uZ3RleHRBID0gbG9uZ3RleHQuc3Vic3RyaW5nKDAsIGkgLSBzdWZmaXhMZW5ndGgpO1xuXHQgICAgICAgICAgYmVzdExvbmd0ZXh0QiA9IGxvbmd0ZXh0LnN1YnN0cmluZyhpICsgcHJlZml4TGVuZ3RoKTtcblx0ICAgICAgICAgIGJlc3RTaG9ydHRleHRBID0gc2hvcnR0ZXh0LnN1YnN0cmluZygwLCBqIC0gc3VmZml4TGVuZ3RoKTtcblx0ICAgICAgICAgIGJlc3RTaG9ydHRleHRCID0gc2hvcnR0ZXh0LnN1YnN0cmluZyhqICsgcHJlZml4TGVuZ3RoKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAoYmVzdENvbW1vbi5sZW5ndGggKiAyID49IGxvbmd0ZXh0Lmxlbmd0aCkge1xuXHQgICAgICAgIHJldHVybiBbYmVzdExvbmd0ZXh0QSwgYmVzdExvbmd0ZXh0QiwgYmVzdFNob3J0dGV4dEEsIGJlc3RTaG9ydHRleHRCLCBiZXN0Q29tbW9uXTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICByZXR1cm4gbnVsbDtcblx0ICAgICAgfVxuXHQgICAgfSAvLyBGaXJzdCBjaGVjayBpZiB0aGUgc2Vjb25kIHF1YXJ0ZXIgaXMgdGhlIHNlZWQgZm9yIGEgaGFsZi1tYXRjaC5cblxuXG5cdCAgICBobTEgPSBkaWZmSGFsZk1hdGNoSShsb25ndGV4dCwgc2hvcnR0ZXh0LCBNYXRoLmNlaWwobG9uZ3RleHQubGVuZ3RoIC8gNCkpOyAvLyBDaGVjayBhZ2FpbiBiYXNlZCBvbiB0aGUgdGhpcmQgcXVhcnRlci5cblxuXHQgICAgaG0yID0gZGlmZkhhbGZNYXRjaEkobG9uZ3RleHQsIHNob3J0dGV4dCwgTWF0aC5jZWlsKGxvbmd0ZXh0Lmxlbmd0aCAvIDIpKTtcblxuXHQgICAgaWYgKCFobTEgJiYgIWhtMikge1xuXHQgICAgICByZXR1cm4gbnVsbDtcblx0ICAgIH0gZWxzZSBpZiAoIWhtMikge1xuXHQgICAgICBobSA9IGhtMTtcblx0ICAgIH0gZWxzZSBpZiAoIWhtMSkge1xuXHQgICAgICBobSA9IGhtMjtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIC8vIEJvdGggbWF0Y2hlZC4gIFNlbGVjdCB0aGUgbG9uZ2VzdC5cblx0ICAgICAgaG0gPSBobTFbNF0ubGVuZ3RoID4gaG0yWzRdLmxlbmd0aCA/IGhtMSA6IGhtMjtcblx0ICAgIH0gLy8gQSBoYWxmLW1hdGNoIHdhcyBmb3VuZCwgc29ydCBvdXQgdGhlIHJldHVybiBkYXRhLlxuXG5cblx0ICAgIGlmICh0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGgpIHtcblx0ICAgICAgdGV4dDFBID0gaG1bMF07XG5cdCAgICAgIHRleHQxQiA9IGhtWzFdO1xuXHQgICAgICB0ZXh0MkEgPSBobVsyXTtcblx0ICAgICAgdGV4dDJCID0gaG1bM107XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB0ZXh0MkEgPSBobVswXTtcblx0ICAgICAgdGV4dDJCID0gaG1bMV07XG5cdCAgICAgIHRleHQxQSA9IGhtWzJdO1xuXHQgICAgICB0ZXh0MUIgPSBobVszXTtcblx0ICAgIH1cblxuXHQgICAgbWlkQ29tbW9uID0gaG1bNF07XG5cdCAgICByZXR1cm4gW3RleHQxQSwgdGV4dDFCLCB0ZXh0MkEsIHRleHQyQiwgbWlkQ29tbW9uXTtcblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIERvIGEgcXVpY2sgbGluZS1sZXZlbCBkaWZmIG9uIGJvdGggc3RyaW5ncywgdGhlbiByZWRpZmYgdGhlIHBhcnRzIGZvclxuXHQgICAqIGdyZWF0ZXIgYWNjdXJhY3kuXG5cdCAgICogVGhpcyBzcGVlZHVwIGNhbiBwcm9kdWNlIG5vbi1taW5pbWFsIGRpZmZzLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgTmV3IHN0cmluZyB0byBiZSBkaWZmZWQuXG5cdCAgICogQHBhcmFtIHtudW1iZXJ9IGRlYWRsaW5lIFRpbWUgd2hlbiB0aGUgZGlmZiBzaG91bGQgYmUgY29tcGxldGUgYnkuXG5cdCAgICogQHJldHVybiB7IUFycmF5LjwhRGlmZk1hdGNoUGF0Y2guRGlmZj59IEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuXHQgICAqIEBwcml2YXRlXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmTGluZU1vZGUgPSBmdW5jdGlvbiAodGV4dDEsIHRleHQyLCBkZWFkbGluZSkge1xuXHQgICAgdmFyIGEsIGRpZmZzLCBsaW5lYXJyYXksIHBvaW50ZXIsIGNvdW50SW5zZXJ0LCBjb3VudERlbGV0ZSwgdGV4dEluc2VydCwgdGV4dERlbGV0ZSwgajsgLy8gU2NhbiB0aGUgdGV4dCBvbiBhIGxpbmUtYnktbGluZSBiYXNpcyBmaXJzdC5cblxuXHQgICAgYSA9IHRoaXMuZGlmZkxpbmVzVG9DaGFycyh0ZXh0MSwgdGV4dDIpO1xuXHQgICAgdGV4dDEgPSBhLmNoYXJzMTtcblx0ICAgIHRleHQyID0gYS5jaGFyczI7XG5cdCAgICBsaW5lYXJyYXkgPSBhLmxpbmVBcnJheTtcblx0ICAgIGRpZmZzID0gdGhpcy5EaWZmTWFpbih0ZXh0MSwgdGV4dDIsIGZhbHNlLCBkZWFkbGluZSk7IC8vIENvbnZlcnQgdGhlIGRpZmYgYmFjayB0byBvcmlnaW5hbCB0ZXh0LlxuXG5cdCAgICB0aGlzLmRpZmZDaGFyc1RvTGluZXMoZGlmZnMsIGxpbmVhcnJheSk7IC8vIEVsaW1pbmF0ZSBmcmVhayBtYXRjaGVzIChlLmcuIGJsYW5rIGxpbmVzKVxuXG5cdCAgICB0aGlzLmRpZmZDbGVhbnVwU2VtYW50aWMoZGlmZnMpOyAvLyBSZWRpZmYgYW55IHJlcGxhY2VtZW50IGJsb2NrcywgdGhpcyB0aW1lIGNoYXJhY3Rlci1ieS1jaGFyYWN0ZXIuXG5cdCAgICAvLyBBZGQgYSBkdW1teSBlbnRyeSBhdCB0aGUgZW5kLlxuXG5cdCAgICBkaWZmcy5wdXNoKFtESUZGX0VRVUFMLCBcIlwiXSk7XG5cdCAgICBwb2ludGVyID0gMDtcblx0ICAgIGNvdW50RGVsZXRlID0gMDtcblx0ICAgIGNvdW50SW5zZXJ0ID0gMDtcblx0ICAgIHRleHREZWxldGUgPSBcIlwiO1xuXHQgICAgdGV4dEluc2VydCA9IFwiXCI7XG5cblx0ICAgIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoKSB7XG5cdCAgICAgIHN3aXRjaCAoZGlmZnNbcG9pbnRlcl1bMF0pIHtcblx0ICAgICAgICBjYXNlIERJRkZfSU5TRVJUOlxuXHQgICAgICAgICAgY291bnRJbnNlcnQrKztcblx0ICAgICAgICAgIHRleHRJbnNlcnQgKz0gZGlmZnNbcG9pbnRlcl1bMV07XG5cdCAgICAgICAgICBicmVhaztcblxuXHQgICAgICAgIGNhc2UgRElGRl9ERUxFVEU6XG5cdCAgICAgICAgICBjb3VudERlbGV0ZSsrO1xuXHQgICAgICAgICAgdGV4dERlbGV0ZSArPSBkaWZmc1twb2ludGVyXVsxXTtcblx0ICAgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgICAgY2FzZSBESUZGX0VRVUFMOlxuXHQgICAgICAgICAgLy8gVXBvbiByZWFjaGluZyBhbiBlcXVhbGl0eSwgY2hlY2sgZm9yIHByaW9yIHJlZHVuZGFuY2llcy5cblx0ICAgICAgICAgIGlmIChjb3VudERlbGV0ZSA+PSAxICYmIGNvdW50SW5zZXJ0ID49IDEpIHtcblx0ICAgICAgICAgICAgLy8gRGVsZXRlIHRoZSBvZmZlbmRpbmcgcmVjb3JkcyBhbmQgYWRkIHRoZSBtZXJnZWQgb25lcy5cblx0ICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSBjb3VudERlbGV0ZSAtIGNvdW50SW5zZXJ0LCBjb3VudERlbGV0ZSArIGNvdW50SW5zZXJ0KTtcblx0ICAgICAgICAgICAgcG9pbnRlciA9IHBvaW50ZXIgLSBjb3VudERlbGV0ZSAtIGNvdW50SW5zZXJ0O1xuXHQgICAgICAgICAgICBhID0gdGhpcy5EaWZmTWFpbih0ZXh0RGVsZXRlLCB0ZXh0SW5zZXJ0LCBmYWxzZSwgZGVhZGxpbmUpO1xuXG5cdCAgICAgICAgICAgIGZvciAoaiA9IGEubGVuZ3RoIC0gMTsgaiA+PSAwOyBqLS0pIHtcblx0ICAgICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciwgMCwgYVtqXSk7XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICBwb2ludGVyID0gcG9pbnRlciArIGEubGVuZ3RoO1xuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICBjb3VudEluc2VydCA9IDA7XG5cdCAgICAgICAgICBjb3VudERlbGV0ZSA9IDA7XG5cdCAgICAgICAgICB0ZXh0RGVsZXRlID0gXCJcIjtcblx0ICAgICAgICAgIHRleHRJbnNlcnQgPSBcIlwiO1xuXHQgICAgICAgICAgYnJlYWs7XG5cdCAgICAgIH1cblxuXHQgICAgICBwb2ludGVyKys7XG5cdCAgICB9XG5cblx0ICAgIGRpZmZzLnBvcCgpOyAvLyBSZW1vdmUgdGhlIGR1bW15IGVudHJ5IGF0IHRoZSBlbmQuXG5cblx0ICAgIHJldHVybiBkaWZmcztcblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIEZpbmQgdGhlICdtaWRkbGUgc25ha2UnIG9mIGEgZGlmZiwgc3BsaXQgdGhlIHByb2JsZW0gaW4gdHdvXG5cdCAgICogYW5kIHJldHVybiB0aGUgcmVjdXJzaXZlbHkgY29uc3RydWN0ZWQgZGlmZi5cblx0ICAgKiBTZWUgTXllcnMgMTk4NiBwYXBlcjogQW4gTyhORCkgRGlmZmVyZW5jZSBBbGdvcml0aG0gYW5kIEl0cyBWYXJpYXRpb25zLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgTmV3IHN0cmluZyB0byBiZSBkaWZmZWQuXG5cdCAgICogQHBhcmFtIHtudW1iZXJ9IGRlYWRsaW5lIFRpbWUgYXQgd2hpY2ggdG8gYmFpbCBpZiBub3QgeWV0IGNvbXBsZXRlLlxuXHQgICAqIEByZXR1cm4geyFBcnJheS48IURpZmZNYXRjaFBhdGNoLkRpZmY+fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblx0ICAgKiBAcHJpdmF0ZVxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkJpc2VjdCA9IGZ1bmN0aW9uICh0ZXh0MSwgdGV4dDIsIGRlYWRsaW5lKSB7XG5cdCAgICB2YXIgdGV4dDFMZW5ndGgsIHRleHQyTGVuZ3RoLCBtYXhELCB2T2Zmc2V0LCB2TGVuZ3RoLCB2MSwgdjIsIHgsIGRlbHRhLCBmcm9udCwgazFzdGFydCwgazFlbmQsIGsyc3RhcnQsIGsyZW5kLCBrMk9mZnNldCwgazFPZmZzZXQsIHgxLCB4MiwgeTEsIHkyLCBkLCBrMSwgazI7IC8vIENhY2hlIHRoZSB0ZXh0IGxlbmd0aHMgdG8gcHJldmVudCBtdWx0aXBsZSBjYWxscy5cblxuXHQgICAgdGV4dDFMZW5ndGggPSB0ZXh0MS5sZW5ndGg7XG5cdCAgICB0ZXh0Mkxlbmd0aCA9IHRleHQyLmxlbmd0aDtcblx0ICAgIG1heEQgPSBNYXRoLmNlaWwoKHRleHQxTGVuZ3RoICsgdGV4dDJMZW5ndGgpIC8gMik7XG5cdCAgICB2T2Zmc2V0ID0gbWF4RDtcblx0ICAgIHZMZW5ndGggPSAyICogbWF4RDtcblx0ICAgIHYxID0gbmV3IEFycmF5KHZMZW5ndGgpO1xuXHQgICAgdjIgPSBuZXcgQXJyYXkodkxlbmd0aCk7IC8vIFNldHRpbmcgYWxsIGVsZW1lbnRzIHRvIC0xIGlzIGZhc3RlciBpbiBDaHJvbWUgJiBGaXJlZm94IHRoYW4gbWl4aW5nXG5cdCAgICAvLyBpbnRlZ2VycyBhbmQgdW5kZWZpbmVkLlxuXG5cdCAgICBmb3IgKHggPSAwOyB4IDwgdkxlbmd0aDsgeCsrKSB7XG5cdCAgICAgIHYxW3hdID0gLTE7XG5cdCAgICAgIHYyW3hdID0gLTE7XG5cdCAgICB9XG5cblx0ICAgIHYxW3ZPZmZzZXQgKyAxXSA9IDA7XG5cdCAgICB2Mlt2T2Zmc2V0ICsgMV0gPSAwO1xuXHQgICAgZGVsdGEgPSB0ZXh0MUxlbmd0aCAtIHRleHQyTGVuZ3RoOyAvLyBJZiB0aGUgdG90YWwgbnVtYmVyIG9mIGNoYXJhY3RlcnMgaXMgb2RkLCB0aGVuIHRoZSBmcm9udCBwYXRoIHdpbGwgY29sbGlkZVxuXHQgICAgLy8gd2l0aCB0aGUgcmV2ZXJzZSBwYXRoLlxuXG5cdCAgICBmcm9udCA9IGRlbHRhICUgMiAhPT0gMDsgLy8gT2Zmc2V0cyBmb3Igc3RhcnQgYW5kIGVuZCBvZiBrIGxvb3AuXG5cdCAgICAvLyBQcmV2ZW50cyBtYXBwaW5nIG9mIHNwYWNlIGJleW9uZCB0aGUgZ3JpZC5cblxuXHQgICAgazFzdGFydCA9IDA7XG5cdCAgICBrMWVuZCA9IDA7XG5cdCAgICBrMnN0YXJ0ID0gMDtcblx0ICAgIGsyZW5kID0gMDtcblxuXHQgICAgZm9yIChkID0gMDsgZCA8IG1heEQ7IGQrKykge1xuXHQgICAgICAvLyBCYWlsIG91dCBpZiBkZWFkbGluZSBpcyByZWFjaGVkLlxuXHQgICAgICBpZiAobmV3IERhdGUoKS5nZXRUaW1lKCkgPiBkZWFkbGluZSkge1xuXHQgICAgICAgIGJyZWFrO1xuXHQgICAgICB9IC8vIFdhbGsgdGhlIGZyb250IHBhdGggb25lIHN0ZXAuXG5cblxuXHQgICAgICBmb3IgKGsxID0gLWQgKyBrMXN0YXJ0OyBrMSA8PSBkIC0gazFlbmQ7IGsxICs9IDIpIHtcblx0ICAgICAgICBrMU9mZnNldCA9IHZPZmZzZXQgKyBrMTtcblxuXHQgICAgICAgIGlmIChrMSA9PT0gLWQgfHwgazEgIT09IGQgJiYgdjFbazFPZmZzZXQgLSAxXSA8IHYxW2sxT2Zmc2V0ICsgMV0pIHtcblx0ICAgICAgICAgIHgxID0gdjFbazFPZmZzZXQgKyAxXTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgeDEgPSB2MVtrMU9mZnNldCAtIDFdICsgMTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICB5MSA9IHgxIC0gazE7XG5cblx0ICAgICAgICB3aGlsZSAoeDEgPCB0ZXh0MUxlbmd0aCAmJiB5MSA8IHRleHQyTGVuZ3RoICYmIHRleHQxLmNoYXJBdCh4MSkgPT09IHRleHQyLmNoYXJBdCh5MSkpIHtcblx0ICAgICAgICAgIHgxKys7XG5cdCAgICAgICAgICB5MSsrO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHYxW2sxT2Zmc2V0XSA9IHgxO1xuXG5cdCAgICAgICAgaWYgKHgxID4gdGV4dDFMZW5ndGgpIHtcblx0ICAgICAgICAgIC8vIFJhbiBvZmYgdGhlIHJpZ2h0IG9mIHRoZSBncmFwaC5cblx0ICAgICAgICAgIGsxZW5kICs9IDI7XG5cdCAgICAgICAgfSBlbHNlIGlmICh5MSA+IHRleHQyTGVuZ3RoKSB7XG5cdCAgICAgICAgICAvLyBSYW4gb2ZmIHRoZSBib3R0b20gb2YgdGhlIGdyYXBoLlxuXHQgICAgICAgICAgazFzdGFydCArPSAyO1xuXHQgICAgICAgIH0gZWxzZSBpZiAoZnJvbnQpIHtcblx0ICAgICAgICAgIGsyT2Zmc2V0ID0gdk9mZnNldCArIGRlbHRhIC0gazE7XG5cblx0ICAgICAgICAgIGlmIChrMk9mZnNldCA+PSAwICYmIGsyT2Zmc2V0IDwgdkxlbmd0aCAmJiB2MltrMk9mZnNldF0gIT09IC0xKSB7XG5cdCAgICAgICAgICAgIC8vIE1pcnJvciB4MiBvbnRvIHRvcC1sZWZ0IGNvb3JkaW5hdGUgc3lzdGVtLlxuXHQgICAgICAgICAgICB4MiA9IHRleHQxTGVuZ3RoIC0gdjJbazJPZmZzZXRdO1xuXG5cdCAgICAgICAgICAgIGlmICh4MSA+PSB4Mikge1xuXHQgICAgICAgICAgICAgIC8vIE92ZXJsYXAgZGV0ZWN0ZWQuXG5cdCAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGlmZkJpc2VjdFNwbGl0KHRleHQxLCB0ZXh0MiwgeDEsIHkxLCBkZWFkbGluZSk7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cdCAgICAgIH0gLy8gV2FsayB0aGUgcmV2ZXJzZSBwYXRoIG9uZSBzdGVwLlxuXG5cblx0ICAgICAgZm9yIChrMiA9IC1kICsgazJzdGFydDsgazIgPD0gZCAtIGsyZW5kOyBrMiArPSAyKSB7XG5cdCAgICAgICAgazJPZmZzZXQgPSB2T2Zmc2V0ICsgazI7XG5cblx0ICAgICAgICBpZiAoazIgPT09IC1kIHx8IGsyICE9PSBkICYmIHYyW2syT2Zmc2V0IC0gMV0gPCB2MltrMk9mZnNldCArIDFdKSB7XG5cdCAgICAgICAgICB4MiA9IHYyW2syT2Zmc2V0ICsgMV07XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHgyID0gdjJbazJPZmZzZXQgLSAxXSArIDE7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgeTIgPSB4MiAtIGsyO1xuXG5cdCAgICAgICAgd2hpbGUgKHgyIDwgdGV4dDFMZW5ndGggJiYgeTIgPCB0ZXh0Mkxlbmd0aCAmJiB0ZXh0MS5jaGFyQXQodGV4dDFMZW5ndGggLSB4MiAtIDEpID09PSB0ZXh0Mi5jaGFyQXQodGV4dDJMZW5ndGggLSB5MiAtIDEpKSB7XG5cdCAgICAgICAgICB4MisrO1xuXHQgICAgICAgICAgeTIrKztcblx0ICAgICAgICB9XG5cblx0ICAgICAgICB2MltrMk9mZnNldF0gPSB4MjtcblxuXHQgICAgICAgIGlmICh4MiA+IHRleHQxTGVuZ3RoKSB7XG5cdCAgICAgICAgICAvLyBSYW4gb2ZmIHRoZSBsZWZ0IG9mIHRoZSBncmFwaC5cblx0ICAgICAgICAgIGsyZW5kICs9IDI7XG5cdCAgICAgICAgfSBlbHNlIGlmICh5MiA+IHRleHQyTGVuZ3RoKSB7XG5cdCAgICAgICAgICAvLyBSYW4gb2ZmIHRoZSB0b3Agb2YgdGhlIGdyYXBoLlxuXHQgICAgICAgICAgazJzdGFydCArPSAyO1xuXHQgICAgICAgIH0gZWxzZSBpZiAoIWZyb250KSB7XG5cdCAgICAgICAgICBrMU9mZnNldCA9IHZPZmZzZXQgKyBkZWx0YSAtIGsyO1xuXG5cdCAgICAgICAgICBpZiAoazFPZmZzZXQgPj0gMCAmJiBrMU9mZnNldCA8IHZMZW5ndGggJiYgdjFbazFPZmZzZXRdICE9PSAtMSkge1xuXHQgICAgICAgICAgICB4MSA9IHYxW2sxT2Zmc2V0XTtcblx0ICAgICAgICAgICAgeTEgPSB2T2Zmc2V0ICsgeDEgLSBrMU9mZnNldDsgLy8gTWlycm9yIHgyIG9udG8gdG9wLWxlZnQgY29vcmRpbmF0ZSBzeXN0ZW0uXG5cblx0ICAgICAgICAgICAgeDIgPSB0ZXh0MUxlbmd0aCAtIHgyO1xuXG5cdCAgICAgICAgICAgIGlmICh4MSA+PSB4Mikge1xuXHQgICAgICAgICAgICAgIC8vIE92ZXJsYXAgZGV0ZWN0ZWQuXG5cdCAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGlmZkJpc2VjdFNwbGl0KHRleHQxLCB0ZXh0MiwgeDEsIHkxLCBkZWFkbGluZSk7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH0gLy8gRGlmZiB0b29rIHRvbyBsb25nIGFuZCBoaXQgdGhlIGRlYWRsaW5lIG9yXG5cdCAgICAvLyBudW1iZXIgb2YgZGlmZnMgZXF1YWxzIG51bWJlciBvZiBjaGFyYWN0ZXJzLCBubyBjb21tb25hbGl0eSBhdCBhbGwuXG5cblxuXHQgICAgcmV0dXJuIFtbRElGRl9ERUxFVEUsIHRleHQxXSwgW0RJRkZfSU5TRVJULCB0ZXh0Ml1dO1xuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogR2l2ZW4gdGhlIGxvY2F0aW9uIG9mIHRoZSAnbWlkZGxlIHNuYWtlJywgc3BsaXQgdGhlIGRpZmYgaW4gdHdvIHBhcnRzXG5cdCAgICogYW5kIHJlY3Vyc2UuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cblx0ICAgKiBAcGFyYW0ge251bWJlcn0geCBJbmRleCBvZiBzcGxpdCBwb2ludCBpbiB0ZXh0MS5cblx0ICAgKiBAcGFyYW0ge251bWJlcn0geSBJbmRleCBvZiBzcGxpdCBwb2ludCBpbiB0ZXh0Mi5cblx0ICAgKiBAcGFyYW0ge251bWJlcn0gZGVhZGxpbmUgVGltZSBhdCB3aGljaCB0byBiYWlsIGlmIG5vdCB5ZXQgY29tcGxldGUuXG5cdCAgICogQHJldHVybiB7IUFycmF5LjwhRGlmZk1hdGNoUGF0Y2guRGlmZj59IEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuXHQgICAqIEBwcml2YXRlXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmQmlzZWN0U3BsaXQgPSBmdW5jdGlvbiAodGV4dDEsIHRleHQyLCB4LCB5LCBkZWFkbGluZSkge1xuXHQgICAgdmFyIHRleHQxYSwgdGV4dDFiLCB0ZXh0MmEsIHRleHQyYiwgZGlmZnMsIGRpZmZzYjtcblx0ICAgIHRleHQxYSA9IHRleHQxLnN1YnN0cmluZygwLCB4KTtcblx0ICAgIHRleHQyYSA9IHRleHQyLnN1YnN0cmluZygwLCB5KTtcblx0ICAgIHRleHQxYiA9IHRleHQxLnN1YnN0cmluZyh4KTtcblx0ICAgIHRleHQyYiA9IHRleHQyLnN1YnN0cmluZyh5KTsgLy8gQ29tcHV0ZSBib3RoIGRpZmZzIHNlcmlhbGx5LlxuXG5cdCAgICBkaWZmcyA9IHRoaXMuRGlmZk1haW4odGV4dDFhLCB0ZXh0MmEsIGZhbHNlLCBkZWFkbGluZSk7XG5cdCAgICBkaWZmc2IgPSB0aGlzLkRpZmZNYWluKHRleHQxYiwgdGV4dDJiLCBmYWxzZSwgZGVhZGxpbmUpO1xuXHQgICAgcmV0dXJuIGRpZmZzLmNvbmNhdChkaWZmc2IpO1xuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogUmVkdWNlIHRoZSBudW1iZXIgb2YgZWRpdHMgYnkgZWxpbWluYXRpbmcgc2VtYW50aWNhbGx5IHRyaXZpYWwgZXF1YWxpdGllcy5cblx0ICAgKiBAcGFyYW0geyFBcnJheS48IURpZmZNYXRjaFBhdGNoLkRpZmY+fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZDbGVhbnVwU2VtYW50aWMgPSBmdW5jdGlvbiAoZGlmZnMpIHtcblx0ICAgIHZhciBjaGFuZ2VzLCBlcXVhbGl0aWVzLCBlcXVhbGl0aWVzTGVuZ3RoLCBsYXN0ZXF1YWxpdHksIHBvaW50ZXIsIGxlbmd0aEluc2VydGlvbnMyLCBsZW5ndGhEZWxldGlvbnMyLCBsZW5ndGhJbnNlcnRpb25zMSwgbGVuZ3RoRGVsZXRpb25zMSwgZGVsZXRpb24sIGluc2VydGlvbiwgb3ZlcmxhcExlbmd0aDEsIG92ZXJsYXBMZW5ndGgyO1xuXHQgICAgY2hhbmdlcyA9IGZhbHNlO1xuXHQgICAgZXF1YWxpdGllcyA9IFtdOyAvLyBTdGFjayBvZiBpbmRpY2VzIHdoZXJlIGVxdWFsaXRpZXMgYXJlIGZvdW5kLlxuXG5cdCAgICBlcXVhbGl0aWVzTGVuZ3RoID0gMDsgLy8gS2VlcGluZyBvdXIgb3duIGxlbmd0aCB2YXIgaXMgZmFzdGVyIGluIEpTLlxuXG5cdCAgICAvKiogQHR5cGUgez9zdHJpbmd9ICovXG5cblx0ICAgIGxhc3RlcXVhbGl0eSA9IG51bGw7IC8vIEFsd2F5cyBlcXVhbCB0byBkaWZmc1tlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGggLSAxXV1bMV1cblxuXHQgICAgcG9pbnRlciA9IDA7IC8vIEluZGV4IG9mIGN1cnJlbnQgcG9zaXRpb24uXG5cdCAgICAvLyBOdW1iZXIgb2YgY2hhcmFjdGVycyB0aGF0IGNoYW5nZWQgcHJpb3IgdG8gdGhlIGVxdWFsaXR5LlxuXG5cdCAgICBsZW5ndGhJbnNlcnRpb25zMSA9IDA7XG5cdCAgICBsZW5ndGhEZWxldGlvbnMxID0gMDsgLy8gTnVtYmVyIG9mIGNoYXJhY3RlcnMgdGhhdCBjaGFuZ2VkIGFmdGVyIHRoZSBlcXVhbGl0eS5cblxuXHQgICAgbGVuZ3RoSW5zZXJ0aW9uczIgPSAwO1xuXHQgICAgbGVuZ3RoRGVsZXRpb25zMiA9IDA7XG5cblx0ICAgIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoKSB7XG5cdCAgICAgIGlmIChkaWZmc1twb2ludGVyXVswXSA9PT0gRElGRl9FUVVBTCkge1xuXHQgICAgICAgIC8vIEVxdWFsaXR5IGZvdW5kLlxuXHQgICAgICAgIGVxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCsrXSA9IHBvaW50ZXI7XG5cdCAgICAgICAgbGVuZ3RoSW5zZXJ0aW9uczEgPSBsZW5ndGhJbnNlcnRpb25zMjtcblx0ICAgICAgICBsZW5ndGhEZWxldGlvbnMxID0gbGVuZ3RoRGVsZXRpb25zMjtcblx0ICAgICAgICBsZW5ndGhJbnNlcnRpb25zMiA9IDA7XG5cdCAgICAgICAgbGVuZ3RoRGVsZXRpb25zMiA9IDA7XG5cdCAgICAgICAgbGFzdGVxdWFsaXR5ID0gZGlmZnNbcG9pbnRlcl1bMV07XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgLy8gQW4gaW5zZXJ0aW9uIG9yIGRlbGV0aW9uLlxuXHQgICAgICAgIGlmIChkaWZmc1twb2ludGVyXVswXSA9PT0gRElGRl9JTlNFUlQpIHtcblx0ICAgICAgICAgIGxlbmd0aEluc2VydGlvbnMyICs9IGRpZmZzW3BvaW50ZXJdWzFdLmxlbmd0aDtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgbGVuZ3RoRGVsZXRpb25zMiArPSBkaWZmc1twb2ludGVyXVsxXS5sZW5ndGg7XG5cdCAgICAgICAgfSAvLyBFbGltaW5hdGUgYW4gZXF1YWxpdHkgdGhhdCBpcyBzbWFsbGVyIG9yIGVxdWFsIHRvIHRoZSBlZGl0cyBvbiBib3RoXG5cdCAgICAgICAgLy8gc2lkZXMgb2YgaXQuXG5cblxuXHQgICAgICAgIGlmIChsYXN0ZXF1YWxpdHkgJiYgbGFzdGVxdWFsaXR5Lmxlbmd0aCA8PSBNYXRoLm1heChsZW5ndGhJbnNlcnRpb25zMSwgbGVuZ3RoRGVsZXRpb25zMSkgJiYgbGFzdGVxdWFsaXR5Lmxlbmd0aCA8PSBNYXRoLm1heChsZW5ndGhJbnNlcnRpb25zMiwgbGVuZ3RoRGVsZXRpb25zMikpIHtcblx0ICAgICAgICAgIC8vIER1cGxpY2F0ZSByZWNvcmQuXG5cdCAgICAgICAgICBkaWZmcy5zcGxpY2UoZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV0sIDAsIFtESUZGX0RFTEVURSwgbGFzdGVxdWFsaXR5XSk7IC8vIENoYW5nZSBzZWNvbmQgY29weSB0byBpbnNlcnQuXG5cblx0ICAgICAgICAgIGRpZmZzW2VxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdICsgMV1bMF0gPSBESUZGX0lOU0VSVDsgLy8gVGhyb3cgYXdheSB0aGUgZXF1YWxpdHkgd2UganVzdCBkZWxldGVkLlxuXG5cdCAgICAgICAgICBlcXVhbGl0aWVzTGVuZ3RoLS07IC8vIFRocm93IGF3YXkgdGhlIHByZXZpb3VzIGVxdWFsaXR5IChpdCBuZWVkcyB0byBiZSByZWV2YWx1YXRlZCkuXG5cblx0ICAgICAgICAgIGVxdWFsaXRpZXNMZW5ndGgtLTtcblx0ICAgICAgICAgIHBvaW50ZXIgPSBlcXVhbGl0aWVzTGVuZ3RoID4gMCA/IGVxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdIDogLTE7IC8vIFJlc2V0IHRoZSBjb3VudGVycy5cblxuXHQgICAgICAgICAgbGVuZ3RoSW5zZXJ0aW9uczEgPSAwO1xuXHQgICAgICAgICAgbGVuZ3RoRGVsZXRpb25zMSA9IDA7XG5cdCAgICAgICAgICBsZW5ndGhJbnNlcnRpb25zMiA9IDA7XG5cdCAgICAgICAgICBsZW5ndGhEZWxldGlvbnMyID0gMDtcblx0ICAgICAgICAgIGxhc3RlcXVhbGl0eSA9IG51bGw7XG5cdCAgICAgICAgICBjaGFuZ2VzID0gdHJ1ZTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBwb2ludGVyKys7XG5cdCAgICB9IC8vIE5vcm1hbGl6ZSB0aGUgZGlmZi5cblxuXG5cdCAgICBpZiAoY2hhbmdlcykge1xuXHQgICAgICB0aGlzLmRpZmZDbGVhbnVwTWVyZ2UoZGlmZnMpO1xuXHQgICAgfSAvLyBGaW5kIGFueSBvdmVybGFwcyBiZXR3ZWVuIGRlbGV0aW9ucyBhbmQgaW5zZXJ0aW9ucy5cblx0ICAgIC8vIGUuZzogPGRlbD5hYmN4eHg8L2RlbD48aW5zPnh4eGRlZjwvaW5zPlxuXHQgICAgLy8gICAtPiA8ZGVsPmFiYzwvZGVsPnh4eDxpbnM+ZGVmPC9pbnM+XG5cdCAgICAvLyBlLmc6IDxkZWw+eHh4YWJjPC9kZWw+PGlucz5kZWZ4eHg8L2lucz5cblx0ICAgIC8vICAgLT4gPGlucz5kZWY8L2lucz54eHg8ZGVsPmFiYzwvZGVsPlxuXHQgICAgLy8gT25seSBleHRyYWN0IGFuIG92ZXJsYXAgaWYgaXQgaXMgYXMgYmlnIGFzIHRoZSBlZGl0IGFoZWFkIG9yIGJlaGluZCBpdC5cblxuXG5cdCAgICBwb2ludGVyID0gMTtcblxuXHQgICAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGgpIHtcblx0ICAgICAgaWYgKGRpZmZzW3BvaW50ZXIgLSAxXVswXSA9PT0gRElGRl9ERUxFVEUgJiYgZGlmZnNbcG9pbnRlcl1bMF0gPT09IERJRkZfSU5TRVJUKSB7XG5cdCAgICAgICAgZGVsZXRpb24gPSBkaWZmc1twb2ludGVyIC0gMV1bMV07XG5cdCAgICAgICAgaW5zZXJ0aW9uID0gZGlmZnNbcG9pbnRlcl1bMV07XG5cdCAgICAgICAgb3ZlcmxhcExlbmd0aDEgPSB0aGlzLmRpZmZDb21tb25PdmVybGFwKGRlbGV0aW9uLCBpbnNlcnRpb24pO1xuXHQgICAgICAgIG92ZXJsYXBMZW5ndGgyID0gdGhpcy5kaWZmQ29tbW9uT3ZlcmxhcChpbnNlcnRpb24sIGRlbGV0aW9uKTtcblxuXHQgICAgICAgIGlmIChvdmVybGFwTGVuZ3RoMSA+PSBvdmVybGFwTGVuZ3RoMikge1xuXHQgICAgICAgICAgaWYgKG92ZXJsYXBMZW5ndGgxID49IGRlbGV0aW9uLmxlbmd0aCAvIDIgfHwgb3ZlcmxhcExlbmd0aDEgPj0gaW5zZXJ0aW9uLmxlbmd0aCAvIDIpIHtcblx0ICAgICAgICAgICAgLy8gT3ZlcmxhcCBmb3VuZC4gIEluc2VydCBhbiBlcXVhbGl0eSBhbmQgdHJpbSB0aGUgc3Vycm91bmRpbmcgZWRpdHMuXG5cdCAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyLCAwLCBbRElGRl9FUVVBTCwgaW5zZXJ0aW9uLnN1YnN0cmluZygwLCBvdmVybGFwTGVuZ3RoMSldKTtcblx0ICAgICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdID0gZGVsZXRpb24uc3Vic3RyaW5nKDAsIGRlbGV0aW9uLmxlbmd0aCAtIG92ZXJsYXBMZW5ndGgxKTtcblx0ICAgICAgICAgICAgZGlmZnNbcG9pbnRlciArIDFdWzFdID0gaW5zZXJ0aW9uLnN1YnN0cmluZyhvdmVybGFwTGVuZ3RoMSk7XG5cdCAgICAgICAgICAgIHBvaW50ZXIrKztcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgaWYgKG92ZXJsYXBMZW5ndGgyID49IGRlbGV0aW9uLmxlbmd0aCAvIDIgfHwgb3ZlcmxhcExlbmd0aDIgPj0gaW5zZXJ0aW9uLmxlbmd0aCAvIDIpIHtcblx0ICAgICAgICAgICAgLy8gUmV2ZXJzZSBvdmVybGFwIGZvdW5kLlxuXHQgICAgICAgICAgICAvLyBJbnNlcnQgYW4gZXF1YWxpdHkgYW5kIHN3YXAgYW5kIHRyaW0gdGhlIHN1cnJvdW5kaW5nIGVkaXRzLlxuXHQgICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciwgMCwgW0RJRkZfRVFVQUwsIGRlbGV0aW9uLnN1YnN0cmluZygwLCBvdmVybGFwTGVuZ3RoMildKTtcblx0ICAgICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzBdID0gRElGRl9JTlNFUlQ7XG5cdCAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXSA9IGluc2VydGlvbi5zdWJzdHJpbmcoMCwgaW5zZXJ0aW9uLmxlbmd0aCAtIG92ZXJsYXBMZW5ndGgyKTtcblx0ICAgICAgICAgICAgZGlmZnNbcG9pbnRlciArIDFdWzBdID0gRElGRl9ERUxFVEU7XG5cdCAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSA9IGRlbGV0aW9uLnN1YnN0cmluZyhvdmVybGFwTGVuZ3RoMik7XG5cdCAgICAgICAgICAgIHBvaW50ZXIrKztcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cblx0ICAgICAgICBwb2ludGVyKys7XG5cdCAgICAgIH1cblxuXHQgICAgICBwb2ludGVyKys7XG5cdCAgICB9XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBEZXRlcm1pbmUgaWYgdGhlIHN1ZmZpeCBvZiBvbmUgc3RyaW5nIGlzIHRoZSBwcmVmaXggb2YgYW5vdGhlci5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgRmlyc3Qgc3RyaW5nLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBTZWNvbmQgc3RyaW5nLlxuXHQgICAqIEByZXR1cm4ge251bWJlcn0gVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGNvbW1vbiB0byB0aGUgZW5kIG9mIHRoZSBmaXJzdFxuXHQgICAqICAgICBzdHJpbmcgYW5kIHRoZSBzdGFydCBvZiB0aGUgc2Vjb25kIHN0cmluZy5cblx0ICAgKiBAcHJpdmF0ZVxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkNvbW1vbk92ZXJsYXAgPSBmdW5jdGlvbiAodGV4dDEsIHRleHQyKSB7XG5cdCAgICB2YXIgdGV4dDFMZW5ndGgsIHRleHQyTGVuZ3RoLCB0ZXh0TGVuZ3RoLCBiZXN0LCBsZW5ndGgsIHBhdHRlcm4sIGZvdW5kOyAvLyBDYWNoZSB0aGUgdGV4dCBsZW5ndGhzIHRvIHByZXZlbnQgbXVsdGlwbGUgY2FsbHMuXG5cblx0ICAgIHRleHQxTGVuZ3RoID0gdGV4dDEubGVuZ3RoO1xuXHQgICAgdGV4dDJMZW5ndGggPSB0ZXh0Mi5sZW5ndGg7IC8vIEVsaW1pbmF0ZSB0aGUgbnVsbCBjYXNlLlxuXG5cdCAgICBpZiAodGV4dDFMZW5ndGggPT09IDAgfHwgdGV4dDJMZW5ndGggPT09IDApIHtcblx0ICAgICAgcmV0dXJuIDA7XG5cdCAgICB9IC8vIFRydW5jYXRlIHRoZSBsb25nZXIgc3RyaW5nLlxuXG5cblx0ICAgIGlmICh0ZXh0MUxlbmd0aCA+IHRleHQyTGVuZ3RoKSB7XG5cdCAgICAgIHRleHQxID0gdGV4dDEuc3Vic3RyaW5nKHRleHQxTGVuZ3RoIC0gdGV4dDJMZW5ndGgpO1xuXHQgICAgfSBlbHNlIGlmICh0ZXh0MUxlbmd0aCA8IHRleHQyTGVuZ3RoKSB7XG5cdCAgICAgIHRleHQyID0gdGV4dDIuc3Vic3RyaW5nKDAsIHRleHQxTGVuZ3RoKTtcblx0ICAgIH1cblxuXHQgICAgdGV4dExlbmd0aCA9IE1hdGgubWluKHRleHQxTGVuZ3RoLCB0ZXh0Mkxlbmd0aCk7IC8vIFF1aWNrIGNoZWNrIGZvciB0aGUgd29yc3QgY2FzZS5cblxuXHQgICAgaWYgKHRleHQxID09PSB0ZXh0Mikge1xuXHQgICAgICByZXR1cm4gdGV4dExlbmd0aDtcblx0ICAgIH0gLy8gU3RhcnQgYnkgbG9va2luZyBmb3IgYSBzaW5nbGUgY2hhcmFjdGVyIG1hdGNoXG5cdCAgICAvLyBhbmQgaW5jcmVhc2UgbGVuZ3RoIHVudGlsIG5vIG1hdGNoIGlzIGZvdW5kLlxuXHQgICAgLy8gUGVyZm9ybWFuY2UgYW5hbHlzaXM6IGh0dHBzOi8vbmVpbC5mcmFzZXIubmFtZS9uZXdzLzIwMTAvMTEvMDQvXG5cblxuXHQgICAgYmVzdCA9IDA7XG5cdCAgICBsZW5ndGggPSAxO1xuXG5cdCAgICB3aGlsZSAodHJ1ZSkge1xuXHQgICAgICBwYXR0ZXJuID0gdGV4dDEuc3Vic3RyaW5nKHRleHRMZW5ndGggLSBsZW5ndGgpO1xuXHQgICAgICBmb3VuZCA9IHRleHQyLmluZGV4T2YocGF0dGVybik7XG5cblx0ICAgICAgaWYgKGZvdW5kID09PSAtMSkge1xuXHQgICAgICAgIHJldHVybiBiZXN0O1xuXHQgICAgICB9XG5cblx0ICAgICAgbGVuZ3RoICs9IGZvdW5kO1xuXG5cdCAgICAgIGlmIChmb3VuZCA9PT0gMCB8fCB0ZXh0MS5zdWJzdHJpbmcodGV4dExlbmd0aCAtIGxlbmd0aCkgPT09IHRleHQyLnN1YnN0cmluZygwLCBsZW5ndGgpKSB7XG5cdCAgICAgICAgYmVzdCA9IGxlbmd0aDtcblx0ICAgICAgICBsZW5ndGgrKztcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogU3BsaXQgdHdvIHRleHRzIGludG8gYW4gYXJyYXkgb2Ygc3RyaW5ncy4gIFJlZHVjZSB0aGUgdGV4dHMgdG8gYSBzdHJpbmcgb2Zcblx0ICAgKiBoYXNoZXMgd2hlcmUgZWFjaCBVbmljb2RlIGNoYXJhY3RlciByZXByZXNlbnRzIG9uZSBsaW5lLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIFNlY29uZCBzdHJpbmcuXG5cdCAgICogQHJldHVybiB7e2NoYXJzMTogc3RyaW5nLCBjaGFyczI6IHN0cmluZywgbGluZUFycmF5OiAhQXJyYXkuPHN0cmluZz59fVxuXHQgICAqICAgICBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgZW5jb2RlZCB0ZXh0MSwgdGhlIGVuY29kZWQgdGV4dDIgYW5kXG5cdCAgICogICAgIHRoZSBhcnJheSBvZiB1bmlxdWUgc3RyaW5ncy5cblx0ICAgKiAgICAgVGhlIHplcm90aCBlbGVtZW50IG9mIHRoZSBhcnJheSBvZiB1bmlxdWUgc3RyaW5ncyBpcyBpbnRlbnRpb25hbGx5IGJsYW5rLlxuXHQgICAqIEBwcml2YXRlXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmTGluZXNUb0NoYXJzID0gZnVuY3Rpb24gKHRleHQxLCB0ZXh0Mikge1xuXHQgICAgdmFyIGxpbmVBcnJheSwgbGluZUhhc2gsIGNoYXJzMSwgY2hhcnMyO1xuXHQgICAgbGluZUFycmF5ID0gW107IC8vIEUuZy4gbGluZUFycmF5WzRdID09PSAnSGVsbG9cXG4nXG5cblx0ICAgIGxpbmVIYXNoID0ge307IC8vIEUuZy4gbGluZUhhc2hbJ0hlbGxvXFxuJ10gPT09IDRcblx0ICAgIC8vICdcXHgwMCcgaXMgYSB2YWxpZCBjaGFyYWN0ZXIsIGJ1dCB2YXJpb3VzIGRlYnVnZ2VycyBkb24ndCBsaWtlIGl0LlxuXHQgICAgLy8gU28gd2UnbGwgaW5zZXJ0IGEganVuayBlbnRyeSB0byBhdm9pZCBnZW5lcmF0aW5nIGEgbnVsbCBjaGFyYWN0ZXIuXG5cblx0ICAgIGxpbmVBcnJheVswXSA9IFwiXCI7XG5cdCAgICAvKipcblx0ICAgICAqIFNwbGl0IGEgdGV4dCBpbnRvIGFuIGFycmF5IG9mIHN0cmluZ3MuICBSZWR1Y2UgdGhlIHRleHRzIHRvIGEgc3RyaW5nIG9mXG5cdCAgICAgKiBoYXNoZXMgd2hlcmUgZWFjaCBVbmljb2RlIGNoYXJhY3RlciByZXByZXNlbnRzIG9uZSBsaW5lLlxuXHQgICAgICogTW9kaWZpZXMgbGluZWFycmF5IGFuZCBsaW5laGFzaCB0aHJvdWdoIGJlaW5nIGEgY2xvc3VyZS5cblx0ICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IFN0cmluZyB0byBlbmNvZGUuXG5cdCAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IEVuY29kZWQgc3RyaW5nLlxuXHQgICAgICogQHByaXZhdGVcblx0ICAgICAqL1xuXG5cdCAgICBmdW5jdGlvbiBkaWZmTGluZXNUb0NoYXJzTXVuZ2UodGV4dCkge1xuXHQgICAgICB2YXIgY2hhcnMsIGxpbmVTdGFydCwgbGluZUVuZCwgbGluZUFycmF5TGVuZ3RoLCBsaW5lO1xuXHQgICAgICBjaGFycyA9IFwiXCI7IC8vIFdhbGsgdGhlIHRleHQsIHB1bGxpbmcgb3V0IGEgc3Vic3RyaW5nIGZvciBlYWNoIGxpbmUuXG5cdCAgICAgIC8vIHRleHQuc3BsaXQoJ1xcbicpIHdvdWxkIHdvdWxkIHRlbXBvcmFyaWx5IGRvdWJsZSBvdXIgbWVtb3J5IGZvb3RwcmludC5cblx0ICAgICAgLy8gTW9kaWZ5aW5nIHRleHQgd291bGQgY3JlYXRlIG1hbnkgbGFyZ2Ugc3RyaW5ncyB0byBnYXJiYWdlIGNvbGxlY3QuXG5cblx0ICAgICAgbGluZVN0YXJ0ID0gMDtcblx0ICAgICAgbGluZUVuZCA9IC0xOyAvLyBLZWVwaW5nIG91ciBvd24gbGVuZ3RoIHZhcmlhYmxlIGlzIGZhc3RlciB0aGFuIGxvb2tpbmcgaXQgdXAuXG5cblx0ICAgICAgbGluZUFycmF5TGVuZ3RoID0gbGluZUFycmF5Lmxlbmd0aDtcblxuXHQgICAgICB3aGlsZSAobGluZUVuZCA8IHRleHQubGVuZ3RoIC0gMSkge1xuXHQgICAgICAgIGxpbmVFbmQgPSB0ZXh0LmluZGV4T2YoXCJcXG5cIiwgbGluZVN0YXJ0KTtcblxuXHQgICAgICAgIGlmIChsaW5lRW5kID09PSAtMSkge1xuXHQgICAgICAgICAgbGluZUVuZCA9IHRleHQubGVuZ3RoIC0gMTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBsaW5lID0gdGV4dC5zdWJzdHJpbmcobGluZVN0YXJ0LCBsaW5lRW5kICsgMSk7XG5cdCAgICAgICAgbGluZVN0YXJ0ID0gbGluZUVuZCArIDE7XG5cblx0ICAgICAgICBpZiAoaGFzT3duLmNhbGwobGluZUhhc2gsIGxpbmUpKSB7XG5cdCAgICAgICAgICBjaGFycyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGxpbmVIYXNoW2xpbmVdKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgY2hhcnMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShsaW5lQXJyYXlMZW5ndGgpO1xuXHQgICAgICAgICAgbGluZUhhc2hbbGluZV0gPSBsaW5lQXJyYXlMZW5ndGg7XG5cdCAgICAgICAgICBsaW5lQXJyYXlbbGluZUFycmF5TGVuZ3RoKytdID0gbGluZTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gY2hhcnM7XG5cdCAgICB9XG5cblx0ICAgIGNoYXJzMSA9IGRpZmZMaW5lc1RvQ2hhcnNNdW5nZSh0ZXh0MSk7XG5cdCAgICBjaGFyczIgPSBkaWZmTGluZXNUb0NoYXJzTXVuZ2UodGV4dDIpO1xuXHQgICAgcmV0dXJuIHtcblx0ICAgICAgY2hhcnMxOiBjaGFyczEsXG5cdCAgICAgIGNoYXJzMjogY2hhcnMyLFxuXHQgICAgICBsaW5lQXJyYXk6IGxpbmVBcnJheVxuXHQgICAgfTtcblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIFJlaHlkcmF0ZSB0aGUgdGV4dCBpbiBhIGRpZmYgZnJvbSBhIHN0cmluZyBvZiBsaW5lIGhhc2hlcyB0byByZWFsIGxpbmVzIG9mXG5cdCAgICogdGV4dC5cblx0ICAgKiBAcGFyYW0geyFBcnJheS48IURpZmZNYXRjaFBhdGNoLkRpZmY+fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblx0ICAgKiBAcGFyYW0geyFBcnJheS48c3RyaW5nPn0gbGluZUFycmF5IEFycmF5IG9mIHVuaXF1ZSBzdHJpbmdzLlxuXHQgICAqIEBwcml2YXRlXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmQ2hhcnNUb0xpbmVzID0gZnVuY3Rpb24gKGRpZmZzLCBsaW5lQXJyYXkpIHtcblx0ICAgIHZhciB4LCBjaGFycywgdGV4dCwgeTtcblxuXHQgICAgZm9yICh4ID0gMDsgeCA8IGRpZmZzLmxlbmd0aDsgeCsrKSB7XG5cdCAgICAgIGNoYXJzID0gZGlmZnNbeF1bMV07XG5cdCAgICAgIHRleHQgPSBbXTtcblxuXHQgICAgICBmb3IgKHkgPSAwOyB5IDwgY2hhcnMubGVuZ3RoOyB5KyspIHtcblx0ICAgICAgICB0ZXh0W3ldID0gbGluZUFycmF5W2NoYXJzLmNoYXJDb2RlQXQoeSldO1xuXHQgICAgICB9XG5cblx0ICAgICAgZGlmZnNbeF1bMV0gPSB0ZXh0LmpvaW4oXCJcIik7XG5cdCAgICB9XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBSZW9yZGVyIGFuZCBtZXJnZSBsaWtlIGVkaXQgc2VjdGlvbnMuICBNZXJnZSBlcXVhbGl0aWVzLlxuXHQgICAqIEFueSBlZGl0IHNlY3Rpb24gY2FuIG1vdmUgYXMgbG9uZyBhcyBpdCBkb2Vzbid0IGNyb3NzIGFuIGVxdWFsaXR5LlxuXHQgICAqIEBwYXJhbSB7IUFycmF5LjwhRGlmZk1hdGNoUGF0Y2guRGlmZj59IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkNsZWFudXBNZXJnZSA9IGZ1bmN0aW9uIChkaWZmcykge1xuXHQgICAgdmFyIHBvaW50ZXIsIGNvdW50RGVsZXRlLCBjb3VudEluc2VydCwgdGV4dEluc2VydCwgdGV4dERlbGV0ZSwgY29tbW9ubGVuZ3RoLCBjaGFuZ2VzLCBkaWZmUG9pbnRlciwgcG9zaXRpb247XG5cdCAgICBkaWZmcy5wdXNoKFtESUZGX0VRVUFMLCBcIlwiXSk7IC8vIEFkZCBhIGR1bW15IGVudHJ5IGF0IHRoZSBlbmQuXG5cblx0ICAgIHBvaW50ZXIgPSAwO1xuXHQgICAgY291bnREZWxldGUgPSAwO1xuXHQgICAgY291bnRJbnNlcnQgPSAwO1xuXHQgICAgdGV4dERlbGV0ZSA9IFwiXCI7XG5cdCAgICB0ZXh0SW5zZXJ0ID0gXCJcIjtcblxuXHQgICAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGgpIHtcblx0ICAgICAgc3dpdGNoIChkaWZmc1twb2ludGVyXVswXSkge1xuXHQgICAgICAgIGNhc2UgRElGRl9JTlNFUlQ6XG5cdCAgICAgICAgICBjb3VudEluc2VydCsrO1xuXHQgICAgICAgICAgdGV4dEluc2VydCArPSBkaWZmc1twb2ludGVyXVsxXTtcblx0ICAgICAgICAgIHBvaW50ZXIrKztcblx0ICAgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgICAgY2FzZSBESUZGX0RFTEVURTpcblx0ICAgICAgICAgIGNvdW50RGVsZXRlKys7XG5cdCAgICAgICAgICB0ZXh0RGVsZXRlICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuXHQgICAgICAgICAgcG9pbnRlcisrO1xuXHQgICAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgICBjYXNlIERJRkZfRVFVQUw6XG5cdCAgICAgICAgICAvLyBVcG9uIHJlYWNoaW5nIGFuIGVxdWFsaXR5LCBjaGVjayBmb3IgcHJpb3IgcmVkdW5kYW5jaWVzLlxuXHQgICAgICAgICAgaWYgKGNvdW50RGVsZXRlICsgY291bnRJbnNlcnQgPiAxKSB7XG5cdCAgICAgICAgICAgIGlmIChjb3VudERlbGV0ZSAhPT0gMCAmJiBjb3VudEluc2VydCAhPT0gMCkge1xuXHQgICAgICAgICAgICAgIC8vIEZhY3RvciBvdXQgYW55IGNvbW1vbiBwcmVmaXhlcy5cblx0ICAgICAgICAgICAgICBjb21tb25sZW5ndGggPSB0aGlzLmRpZmZDb21tb25QcmVmaXgodGV4dEluc2VydCwgdGV4dERlbGV0ZSk7XG5cblx0ICAgICAgICAgICAgICBpZiAoY29tbW9ubGVuZ3RoICE9PSAwKSB7XG5cdCAgICAgICAgICAgICAgICBpZiAocG9pbnRlciAtIGNvdW50RGVsZXRlIC0gY291bnRJbnNlcnQgPiAwICYmIGRpZmZzW3BvaW50ZXIgLSBjb3VudERlbGV0ZSAtIGNvdW50SW5zZXJ0IC0gMV1bMF0gPT09IERJRkZfRVFVQUwpIHtcblx0ICAgICAgICAgICAgICAgICAgZGlmZnNbcG9pbnRlciAtIGNvdW50RGVsZXRlIC0gY291bnRJbnNlcnQgLSAxXVsxXSArPSB0ZXh0SW5zZXJ0LnN1YnN0cmluZygwLCBjb21tb25sZW5ndGgpO1xuXHQgICAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgICAgZGlmZnMuc3BsaWNlKDAsIDAsIFtESUZGX0VRVUFMLCB0ZXh0SW5zZXJ0LnN1YnN0cmluZygwLCBjb21tb25sZW5ndGgpXSk7XG5cdCAgICAgICAgICAgICAgICAgIHBvaW50ZXIrKztcblx0ICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgdGV4dEluc2VydCA9IHRleHRJbnNlcnQuc3Vic3RyaW5nKGNvbW1vbmxlbmd0aCk7XG5cdCAgICAgICAgICAgICAgICB0ZXh0RGVsZXRlID0gdGV4dERlbGV0ZS5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcblx0ICAgICAgICAgICAgICB9IC8vIEZhY3RvciBvdXQgYW55IGNvbW1vbiBzdWZmaXhpZXMuXG5cblxuXHQgICAgICAgICAgICAgIGNvbW1vbmxlbmd0aCA9IHRoaXMuZGlmZkNvbW1vblN1ZmZpeCh0ZXh0SW5zZXJ0LCB0ZXh0RGVsZXRlKTtcblxuXHQgICAgICAgICAgICAgIGlmIChjb21tb25sZW5ndGggIT09IDApIHtcblx0ICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdID0gdGV4dEluc2VydC5zdWJzdHJpbmcodGV4dEluc2VydC5sZW5ndGggLSBjb21tb25sZW5ndGgpICsgZGlmZnNbcG9pbnRlcl1bMV07XG5cdCAgICAgICAgICAgICAgICB0ZXh0SW5zZXJ0ID0gdGV4dEluc2VydC5zdWJzdHJpbmcoMCwgdGV4dEluc2VydC5sZW5ndGggLSBjb21tb25sZW5ndGgpO1xuXHQgICAgICAgICAgICAgICAgdGV4dERlbGV0ZSA9IHRleHREZWxldGUuc3Vic3RyaW5nKDAsIHRleHREZWxldGUubGVuZ3RoIC0gY29tbW9ubGVuZ3RoKTtcblx0ICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH0gLy8gRGVsZXRlIHRoZSBvZmZlbmRpbmcgcmVjb3JkcyBhbmQgYWRkIHRoZSBtZXJnZWQgb25lcy5cblxuXG5cdCAgICAgICAgICAgIGlmIChjb3VudERlbGV0ZSA9PT0gMCkge1xuXHQgICAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnRJbnNlcnQsIGNvdW50RGVsZXRlICsgY291bnRJbnNlcnQsIFtESUZGX0lOU0VSVCwgdGV4dEluc2VydF0pO1xuXHQgICAgICAgICAgICB9IGVsc2UgaWYgKGNvdW50SW5zZXJ0ID09PSAwKSB7XG5cdCAgICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSBjb3VudERlbGV0ZSwgY291bnREZWxldGUgKyBjb3VudEluc2VydCwgW0RJRkZfREVMRVRFLCB0ZXh0RGVsZXRlXSk7XG5cdCAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSBjb3VudERlbGV0ZSAtIGNvdW50SW5zZXJ0LCBjb3VudERlbGV0ZSArIGNvdW50SW5zZXJ0LCBbRElGRl9ERUxFVEUsIHRleHREZWxldGVdLCBbRElGRl9JTlNFUlQsIHRleHRJbnNlcnRdKTtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIHBvaW50ZXIgPSBwb2ludGVyIC0gY291bnREZWxldGUgLSBjb3VudEluc2VydCArIChjb3VudERlbGV0ZSA/IDEgOiAwKSArIChjb3VudEluc2VydCA/IDEgOiAwKSArIDE7XG5cdCAgICAgICAgICB9IGVsc2UgaWYgKHBvaW50ZXIgIT09IDAgJiYgZGlmZnNbcG9pbnRlciAtIDFdWzBdID09PSBESUZGX0VRVUFMKSB7XG5cdCAgICAgICAgICAgIC8vIE1lcmdlIHRoaXMgZXF1YWxpdHkgd2l0aCB0aGUgcHJldmlvdXMgb25lLlxuXHQgICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0gKz0gZGlmZnNbcG9pbnRlcl1bMV07XG5cdCAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyLCAxKTtcblx0ICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgIHBvaW50ZXIrKztcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgY291bnRJbnNlcnQgPSAwO1xuXHQgICAgICAgICAgY291bnREZWxldGUgPSAwO1xuXHQgICAgICAgICAgdGV4dERlbGV0ZSA9IFwiXCI7XG5cdCAgICAgICAgICB0ZXh0SW5zZXJ0ID0gXCJcIjtcblx0ICAgICAgICAgIGJyZWFrO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGlmIChkaWZmc1tkaWZmcy5sZW5ndGggLSAxXVsxXSA9PT0gXCJcIikge1xuXHQgICAgICBkaWZmcy5wb3AoKTsgLy8gUmVtb3ZlIHRoZSBkdW1teSBlbnRyeSBhdCB0aGUgZW5kLlxuXHQgICAgfSAvLyBTZWNvbmQgcGFzczogbG9vayBmb3Igc2luZ2xlIGVkaXRzIHN1cnJvdW5kZWQgb24gYm90aCBzaWRlcyBieSBlcXVhbGl0aWVzXG5cdCAgICAvLyB3aGljaCBjYW4gYmUgc2hpZnRlZCBzaWRld2F5cyB0byBlbGltaW5hdGUgYW4gZXF1YWxpdHkuXG5cdCAgICAvLyBlLmc6IEE8aW5zPkJBPC9pbnM+QyAtPiA8aW5zPkFCPC9pbnM+QUNcblxuXG5cdCAgICBjaGFuZ2VzID0gZmFsc2U7XG5cdCAgICBwb2ludGVyID0gMTsgLy8gSW50ZW50aW9uYWxseSBpZ25vcmUgdGhlIGZpcnN0IGFuZCBsYXN0IGVsZW1lbnQgKGRvbid0IG5lZWQgY2hlY2tpbmcpLlxuXG5cdCAgICB3aGlsZSAocG9pbnRlciA8IGRpZmZzLmxlbmd0aCAtIDEpIHtcblx0ICAgICAgaWYgKGRpZmZzW3BvaW50ZXIgLSAxXVswXSA9PT0gRElGRl9FUVVBTCAmJiBkaWZmc1twb2ludGVyICsgMV1bMF0gPT09IERJRkZfRVFVQUwpIHtcblx0ICAgICAgICBkaWZmUG9pbnRlciA9IGRpZmZzW3BvaW50ZXJdWzFdO1xuXHQgICAgICAgIHBvc2l0aW9uID0gZGlmZlBvaW50ZXIuc3Vic3RyaW5nKGRpZmZQb2ludGVyLmxlbmd0aCAtIGRpZmZzW3BvaW50ZXIgLSAxXVsxXS5sZW5ndGgpOyAvLyBUaGlzIGlzIGEgc2luZ2xlIGVkaXQgc3Vycm91bmRlZCBieSBlcXVhbGl0aWVzLlxuXG5cdCAgICAgICAgaWYgKHBvc2l0aW9uID09PSBkaWZmc1twb2ludGVyIC0gMV1bMV0pIHtcblx0ICAgICAgICAgIC8vIFNoaWZ0IHRoZSBlZGl0IG92ZXIgdGhlIHByZXZpb3VzIGVxdWFsaXR5LlxuXHQgICAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0gPSBkaWZmc1twb2ludGVyIC0gMV1bMV0gKyBkaWZmc1twb2ludGVyXVsxXS5zdWJzdHJpbmcoMCwgZGlmZnNbcG9pbnRlcl1bMV0ubGVuZ3RoIC0gZGlmZnNbcG9pbnRlciAtIDFdWzFdLmxlbmd0aCk7XG5cdCAgICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMV0gPSBkaWZmc1twb2ludGVyIC0gMV1bMV0gKyBkaWZmc1twb2ludGVyICsgMV1bMV07XG5cdCAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIDEsIDEpO1xuXHQgICAgICAgICAgY2hhbmdlcyA9IHRydWU7XG5cdCAgICAgICAgfSBlbHNlIGlmIChkaWZmUG9pbnRlci5zdWJzdHJpbmcoMCwgZGlmZnNbcG9pbnRlciArIDFdWzFdLmxlbmd0aCkgPT09IGRpZmZzW3BvaW50ZXIgKyAxXVsxXSkge1xuXHQgICAgICAgICAgLy8gU2hpZnQgdGhlIGVkaXQgb3ZlciB0aGUgbmV4dCBlcXVhbGl0eS5cblx0ICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXSArPSBkaWZmc1twb2ludGVyICsgMV1bMV07XG5cdCAgICAgICAgICBkaWZmc1twb2ludGVyXVsxXSA9IGRpZmZzW3BvaW50ZXJdWzFdLnN1YnN0cmluZyhkaWZmc1twb2ludGVyICsgMV1bMV0ubGVuZ3RoKSArIGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcblx0ICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyICsgMSwgMSk7XG5cdCAgICAgICAgICBjaGFuZ2VzID0gdHJ1ZTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBwb2ludGVyKys7XG5cdCAgICB9IC8vIElmIHNoaWZ0cyB3ZXJlIG1hZGUsIHRoZSBkaWZmIG5lZWRzIHJlb3JkZXJpbmcgYW5kIGFub3RoZXIgc2hpZnQgc3dlZXAuXG5cblxuXHQgICAgaWYgKGNoYW5nZXMpIHtcblx0ICAgICAgdGhpcy5kaWZmQ2xlYW51cE1lcmdlKGRpZmZzKTtcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgcmV0dXJuIGZ1bmN0aW9uIChvLCBuKSB7XG5cdCAgICB2YXIgZGlmZiwgb3V0cHV0LCB0ZXh0O1xuXHQgICAgZGlmZiA9IG5ldyBEaWZmTWF0Y2hQYXRjaCgpO1xuXHQgICAgb3V0cHV0ID0gZGlmZi5EaWZmTWFpbihvLCBuKTtcblx0ICAgIGRpZmYuZGlmZkNsZWFudXBFZmZpY2llbmN5KG91dHB1dCk7XG5cdCAgICB0ZXh0ID0gZGlmZi5kaWZmUHJldHR5SHRtbChvdXRwdXQpO1xuXHQgICAgcmV0dXJuIHRleHQ7XG5cdCAgfTtcblx0fSgpO1xuXG59KChmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH0oKSkpKTtcbiIsInZhciBuZXh0VGljayA9IHJlcXVpcmUoJ3Byb2Nlc3MvYnJvd3Nlci5qcycpLm5leHRUaWNrO1xudmFyIGFwcGx5ID0gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5O1xudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIGltbWVkaWF0ZUlkcyA9IHt9O1xudmFyIG5leHRJbW1lZGlhdGVJZCA9IDA7XG5cbi8vIERPTSBBUElzLCBmb3IgY29tcGxldGVuZXNzXG5cbmV4cG9ydHMuc2V0VGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFRpbWVvdXQoYXBwbHkuY2FsbChzZXRUaW1lb3V0LCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFyVGltZW91dCk7XG59O1xuZXhwb3J0cy5zZXRJbnRlcnZhbCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFRpbWVvdXQoYXBwbHkuY2FsbChzZXRJbnRlcnZhbCwgd2luZG93LCBhcmd1bWVudHMpLCBjbGVhckludGVydmFsKTtcbn07XG5leHBvcnRzLmNsZWFyVGltZW91dCA9XG5leHBvcnRzLmNsZWFySW50ZXJ2YWwgPSBmdW5jdGlvbih0aW1lb3V0KSB7IHRpbWVvdXQuY2xvc2UoKTsgfTtcblxuZnVuY3Rpb24gVGltZW91dChpZCwgY2xlYXJGbikge1xuICB0aGlzLl9pZCA9IGlkO1xuICB0aGlzLl9jbGVhckZuID0gY2xlYXJGbjtcbn1cblRpbWVvdXQucHJvdG90eXBlLnVucmVmID0gVGltZW91dC5wcm90b3R5cGUucmVmID0gZnVuY3Rpb24oKSB7fTtcblRpbWVvdXQucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX2NsZWFyRm4uY2FsbCh3aW5kb3csIHRoaXMuX2lkKTtcbn07XG5cbi8vIERvZXMgbm90IHN0YXJ0IHRoZSB0aW1lLCBqdXN0IHNldHMgdXAgdGhlIG1lbWJlcnMgbmVlZGVkLlxuZXhwb3J0cy5lbnJvbGwgPSBmdW5jdGlvbihpdGVtLCBtc2Vjcykge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG4gIGl0ZW0uX2lkbGVUaW1lb3V0ID0gbXNlY3M7XG59O1xuXG5leHBvcnRzLnVuZW5yb2xsID0gZnVuY3Rpb24oaXRlbSkge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG4gIGl0ZW0uX2lkbGVUaW1lb3V0ID0gLTE7XG59O1xuXG5leHBvcnRzLl91bnJlZkFjdGl2ZSA9IGV4cG9ydHMuYWN0aXZlID0gZnVuY3Rpb24oaXRlbSkge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG5cbiAgdmFyIG1zZWNzID0gaXRlbS5faWRsZVRpbWVvdXQ7XG4gIGlmIChtc2VjcyA+PSAwKSB7XG4gICAgaXRlbS5faWRsZVRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gb25UaW1lb3V0KCkge1xuICAgICAgaWYgKGl0ZW0uX29uVGltZW91dClcbiAgICAgICAgaXRlbS5fb25UaW1lb3V0KCk7XG4gICAgfSwgbXNlY3MpO1xuICB9XG59O1xuXG4vLyBUaGF0J3Mgbm90IGhvdyBub2RlLmpzIGltcGxlbWVudHMgaXQgYnV0IHRoZSBleHBvc2VkIGFwaSBpcyB0aGUgc2FtZS5cbmV4cG9ydHMuc2V0SW1tZWRpYXRlID0gdHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gc2V0SW1tZWRpYXRlIDogZnVuY3Rpb24oZm4pIHtcbiAgdmFyIGlkID0gbmV4dEltbWVkaWF0ZUlkKys7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzLmxlbmd0aCA8IDIgPyBmYWxzZSA6IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICBpbW1lZGlhdGVJZHNbaWRdID0gdHJ1ZTtcblxuICBuZXh0VGljayhmdW5jdGlvbiBvbk5leHRUaWNrKCkge1xuICAgIGlmIChpbW1lZGlhdGVJZHNbaWRdKSB7XG4gICAgICAvLyBmbi5jYWxsKCkgaXMgZmFzdGVyIHNvIHdlIG9wdGltaXplIGZvciB0aGUgY29tbW9uIHVzZS1jYXNlXG4gICAgICAvLyBAc2VlIGh0dHA6Ly9qc3BlcmYuY29tL2NhbGwtYXBwbHktc2VndVxuICAgICAgaWYgKGFyZ3MpIHtcbiAgICAgICAgZm4uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmbi5jYWxsKG51bGwpO1xuICAgICAgfVxuICAgICAgLy8gUHJldmVudCBpZHMgZnJvbSBsZWFraW5nXG4gICAgICBleHBvcnRzLmNsZWFySW1tZWRpYXRlKGlkKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpZDtcbn07XG5cbmV4cG9ydHMuY2xlYXJJbW1lZGlhdGUgPSB0eXBlb2YgY2xlYXJJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIiA/IGNsZWFySW1tZWRpYXRlIDogZnVuY3Rpb24oaWQpIHtcbiAgZGVsZXRlIGltbWVkaWF0ZUlkc1tpZF07XG59OyIsIi8qISB6emRvbSAtIHYwLjIuMCAtIDIwMjAtMTEtMTIgMTM6MzI6NTEgKi9cbi8qKlxuICogQSBuYW1lc3BhY2UuXG4gKiBAY29uc3RcbiAqL1xudmFyIHp6RE9NID0ge307XG5cbi8qXG4gICAgenogZnVuY3Rpb25cbiAgICBcbiAgICB6eiggJyMnLCAnaWQnICk7XG4gICAgenooICcuJywgJ2NsYXNzTmFtZScgKTtcbiAgICB6eiggJ3QnLCAndGFnTmFtZScgKTtcbiAgICB6eiggJ3RuJywgJ25hbWVzcGFjZScsICd0YWdOYW1lJyApO1xuICAgIHp6KCAnbicsICduYW1lJyApO1xuICAgIHp6KCAncycsICdzdHJpbmcgc2VsZWN0b3InICk7XG4gICAgenooIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnaWQnICkgKTsgLy8gRWxlbWVudFxuICAgIHp6KCBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCAnY2xhc3NOYW1lJyApICk7IC8vIEhUTUxDb2xsZWN0aW9uXG4gICAgenooIGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKCAnbmFtZScgKSApOyAvLyBOb2RlTGlzdFxuICAgIHp6KCAndGFibGUuY2xhc3NOYW1lIHRyIHRkJyApOyAvLyBTdHJpbmcgc2VsZWN0b3JcbiAgICB6eiggJzxkaXY+TmV3IGRpdjwvZGl2PicgKTsgLy8gSFRNTCBjb2RlIGluIHN0cmluZ1xuKi9cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd8RWxlbWVudHxIVE1MQ29sbGVjdGlvbnxOb2RlTGlzdH0geFxuICogQHBhcmFtIHtzdHJpbmc9fSBzMVxuICogQHBhcmFtIHtzdHJpbmc9fSBzMiBcbiAqL1xuenpET00uenogPSBmdW5jdGlvbiggeCwgczEsIHMyICl7XG4gICAgXG4gICAgLy8gUmVkZWZpbmUgeCBpZiBhIHNlbGVjdG9yIGlkIGlzIGZvdW5kXG4gICAgaWYgKCBzMSApe1xuICAgICAgICBzd2l0Y2ggKCB4ICl7XG4gICAgICAgIGNhc2UgJyMnOlxuICAgICAgICAgICAgeCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBzMSApO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJy4nOlxuICAgICAgICAgICAgeCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoIHMxICk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndCc6XG4gICAgICAgICAgICB4ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoIHMxICk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndG4nOlxuICAgICAgICAgICAgeCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lTlMoIHMxLCBzMiB8fCAnJyApO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ24nOlxuICAgICAgICAgICAgeCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKCBzMSApO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3MnOlxuICAgICAgICAgICAgeCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoIHMxICk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRocm93ICdVbnN1cHBvcnRlZCBzZWxlY3RvciBpZCBmb3VuZCBydW5uaW5nIHp6IGZ1bmN0aW9uOiAnICsgeDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBJcyBpdCBhbiBFbGVtZW50P1xuICAgIGlmICggeCBpbnN0YW5jZW9mIEVsZW1lbnQgKXtcbiAgICAgICAgcmV0dXJuIG5ldyB6ekRPTS5TUyggeCApO1xuICAgIH1cbiAgICBcbiAgICAvLyBJcyBpdCBhbiBIVE1MQ29sbGVjdGlvbiBvciBhIE5vZGVMaXN0P1xuICAgIGlmICggeCBpbnN0YW5jZW9mIEhUTUxDb2xsZWN0aW9uIHx8IHggaW5zdGFuY2VvZiBOb2RlTGlzdCApe1xuICAgICAgICByZXR1cm4genpET00uX2J1aWxkKCB4ICk7XG4gICAgfVxuICAgIFxuICAgIGlmICggdHlwZW9mIHggPT09ICdzdHJpbmcnICl7XG4gICAgICAgIHggPSB4LnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIHp6RE9NLl9idWlsZChcbiAgICAgICAgICAgIHguY2hhckF0KCAwICkgPT09ICc8Jz8gLy8gSXMgaXQgSFRNTCBjb2RlP1xuICAgICAgICAgICAgICAgIHp6RE9NLl9odG1sVG9FbGVtZW50KCB4ICk6XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggeCApIC8vIE11c3QgYmUgYSBzdGFuZGFyZCBzZWxlY3RvclxuICAgICAgICApO1xuICAgIH1cbiAgICBcbiAgICB0aHJvdyAnVW5zdXBwb3J0ZWQgc2VsZWN0b3IgdHlwZSBmb3VuZCBydW5uaW5nIHp6IGZ1bmN0aW9uLic7XG59O1xuXG4vLyBCdWlsZCBhcmdzIGFycmF5IHdpdGggdG9JbnNlcnQgYXMgZmlyc3QgcG9zaXRpb24gYW5kIHRoZW4gdGhlIGFyZ3VtZW50cyBvZiB0aGlzIGZ1bmN0aW9uXG56ekRPTS5fYXJncyA9IGZ1bmN0aW9uKCBwcmV2aW91c0FyZ3MsIHRvSW5zZXJ0ICl7XG4gICAgdmFyIHJlc3VsdCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBwcmV2aW91c0FyZ3MgKTtcbiAgICByZXN1bHQucHVzaCggdG9JbnNlcnQgKTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuenpET00uX2J1aWxkID0gZnVuY3Rpb24gKCB4ICkge1xuICAgIGlmICggeCBpbnN0YW5jZW9mIEVsZW1lbnQgKXtcbiAgICAgICAgcmV0dXJuIG5ldyB6ekRPTS5TUyggeCApO1xuICAgIH1cbiAgICBpZiAoIHggaW5zdGFuY2VvZiBIVE1MQ29sbGVjdGlvbiB8fCB4IGluc3RhbmNlb2YgTm9kZUxpc3QgKXtcbiAgICAgICAgeCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCB4ICk7XG4gICAgfVxuICAgIHJldHVybiB4Lmxlbmd0aCA9PT0gMT8gbmV3IHp6RE9NLlNTKCB4WyAwIF0gKTogbmV3IHp6RE9NLk1NKCB4ICk7XG59O1xuXG56ekRPTS5fZ2V0RXJyb3IgPSBmdW5jdGlvbiAoIG1ldGhvZCApIHtcbiAgICByZXR1cm4gJ01ldGhvZCBcIicgKyBtZXRob2QgKyAnXCIgbm90IHJlYWR5IGZvciB0aGF0IHR5cGUhJztcbn07XG5cbnp6RE9NLl9odG1sVG9FbGVtZW50ID0gZnVuY3Rpb24gKCBodG1sICkge1xuICAgIHZhciB0ZW1wbGF0ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICd0ZW1wbGF0ZScgKTtcbiAgICB0ZW1wbGF0ZS5pbm5lckhUTUwgPSBodG1sLnRyaW0oKTtcbiAgICByZXR1cm4gdGVtcGxhdGUuY29udGVudC5jaGlsZEVsZW1lbnRDb3VudCA9PT0gMT9cbiAgICAgICAgdGVtcGxhdGUuY29udGVudC5maXJzdENoaWxkOlxuICAgICAgICB0ZW1wbGF0ZS5jb250ZW50LmNoaWxkTm9kZXM7XG59O1xuXG4vLyBSZWdpc3RlciB6eiBmdW5jdGlvblxudmFyIHp6O1xuKGZ1bmN0aW9uKCkgeyBcbiAgICB6eiA9IHp6RE9NLnp6OyBcbn0pKCk7XG5cbnp6RE9NLl9ldmVudHMgPSB7fTtcblxuenpET00uX2FkZEV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbiggc3MsIGV2ZW50TmFtZSwgbGlzdGVuZXIsIHVzZUNhcHR1cmUgKXtcbiAgICB2YXIgZWwgPSBzcy5lbDtcbiAgICB2YXIgZWxJZCA9IHNzLl9nZXRFbElkKCk7XG4gICAgdmFyIHRoaXNFdmVudHMgPSB6ekRPTS5fZXZlbnRzWyBlbElkIF07XG4gICAgaWYgKCAhIHRoaXNFdmVudHMgKXtcbiAgICAgICAgdGhpc0V2ZW50cyA9IHt9O1xuICAgICAgICB6ekRPTS5fZXZlbnRzWyBlbElkIF0gPSB0aGlzRXZlbnRzO1xuICAgIH1cbiAgICB2YXIgdGhpc0xpc3RlbmVycyA9IHRoaXNFdmVudHNbIGV2ZW50TmFtZSBdO1xuICAgIGlmICggISB0aGlzTGlzdGVuZXJzICl7XG4gICAgICAgIHRoaXNMaXN0ZW5lcnMgPSBbXTtcbiAgICAgICAgdGhpc0V2ZW50c1sgZXZlbnROYW1lIF0gPSB0aGlzTGlzdGVuZXJzO1xuICAgIH1cbiAgICB0aGlzTGlzdGVuZXJzLnB1c2goIGxpc3RlbmVyICk7XG4gICAgXG4gICAgLy8gYWRkRXZlbnRMaXN0ZW5lclxuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoIGV2ZW50TmFtZSwgbGlzdGVuZXIsIHVzZUNhcHR1cmUgKTtcbn07XG5cbi8vVE9ETyBtdXN0IHJlbW92ZSBhbGwgbGlzdGVuZXJzIHdoZW4gYW4gZWxlbWVudCBpcyByZW1vdmVkXG56ekRPTS5fcmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKCBzcywgZXZlbnROYW1lLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSApe1xuICAgIHZhciBlbCA9IHNzLmVsO1xuICAgIHZhciBlbElkID0gc3MuX2dldEVsSWQoKTtcbiAgICB2YXIgdGhpc0V2ZW50cyA9IHp6RE9NLl9ldmVudHNbIGVsSWQgXTtcbiAgICBpZiAoICEgdGhpc0V2ZW50cyApe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGlmICggISBldmVudE5hbWUgKXsgXG4gICAgICAgIC8vIE11c3QgcmVtb3ZlIGFsbCBldmVudHNcbiAgICAgICAgZm9yICggdmFyIGN1cnJlbnRFdmVudE5hbWUgaW4gdGhpc0V2ZW50cyApe1xuICAgICAgICAgICAgdmFyIGN1cnJlbnRMaXN0ZW5lcnMgPSB0aGlzRXZlbnRzWyBjdXJyZW50RXZlbnROYW1lIF07XG4gICAgICAgICAgICB6ekRPTS5fcmVtb3ZlTGlzdGVuZXJzKCBlbCwgY3VycmVudExpc3RlbmVycywgbnVsbCwgdXNlQ2FwdHVyZSwgY3VycmVudEV2ZW50TmFtZSApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLy8gTXVzdCByZW1vdmUgbGlzdGVuZXJzIG9mIG9ubHkgb25lIGV2ZW50XG4gICAgdmFyIHRoaXNMaXN0ZW5lcnMgPSB0aGlzRXZlbnRzWyBldmVudE5hbWUgXTtcbiAgICB6ekRPTS5fcmVtb3ZlTGlzdGVuZXJzKCBlbCwgdGhpc0xpc3RlbmVycywgbGlzdGVuZXIsIHVzZUNhcHR1cmUsIGV2ZW50TmFtZSApO1xufTtcblxuLy9UT0RPIHRlc3QgYWxsIHRoZSBsaXN0ZW5lcnMgYXJlIHJlbW92ZWRcbnp6RE9NLl9yZW1vdmVMaXN0ZW5lcnMgPSBmdW5jdGlvbiggZWwsIHRoaXNMaXN0ZW5lcnMsIGxpc3RlbmVyLCB1c2VDYXB0dXJlLCBldmVudE5hbWUgKXtcbiAgICBpZiAoICEgdGhpc0xpc3RlbmVycyApe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHRoaXNMaXN0ZW5lcnMubGVuZ3RoOyArK2kgKXtcbiAgICAgICAgdmFyIGN1cnJlbnRMaXN0ZW5lciA9IHRoaXNMaXN0ZW5lcnNbIGkgXTtcbiAgICAgICAgaWYgKCAhIGxpc3RlbmVyIHx8IGN1cnJlbnRMaXN0ZW5lciA9PT0gbGlzdGVuZXIgKXtcbiAgICAgICAgICAgIHRoaXNMaXN0ZW5lcnMuc3BsaWNlKCBpLCAxICk7IC8vIERlbGV0ZSBsaXN0ZW5lciBhdCBpIHBvc2l0aW9uXG4gICAgICAgICAgICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKCBldmVudE5hbWUsIGN1cnJlbnRMaXN0ZW5lciwgdXNlQ2FwdHVyZSApO1xuICAgICAgICAgICAgaWYgKCBsaXN0ZW5lciApe1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gXG59O1xuLyogRW5kIG9mIGV2ZW50cyAqL1xuXG56ekRPTS5fZGQgPSB7fTtcblxuenpET00uX2dldERlZmF1bHREaXNwbGF5ID0gZnVuY3Rpb24oIGVsICkge1xuICAgIHZhciBub2RlTmFtZSA9IGVsLm5vZGVOYW1lO1xuICAgIHZhciBkaXNwbGF5ID0genpET00uX2RkWyBub2RlTmFtZSBdO1xuXG4gICAgaWYgKCBkaXNwbGF5ICkge1xuICAgICAgICByZXR1cm4gZGlzcGxheTtcbiAgICB9XG5cbiAgICB2YXIgZG9jID0gZWwub3duZXJEb2N1bWVudDtcbiAgICB2YXIgdGVtcCA9IGRvYy5ib2R5LmFwcGVuZENoaWxkKCBkb2MuY3JlYXRlRWxlbWVudCggbm9kZU5hbWUgKSApO1xuICAgIGRpc3BsYXkgPSBnZXRDb21wdXRlZFN0eWxlKCB0ZW1wIClbICdkaXNwbGF5JyBdO1xuXG4gICAgdGVtcC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCB0ZW1wICk7XG5cbiAgICBpZiAoIGRpc3BsYXkgPT09ICdub25lJyApIHtcbiAgICAgICAgZGlzcGxheSA9ICdibG9jayc7XG4gICAgfVxuICAgIHp6RE9NLl9kZFsgbm9kZU5hbWUgXSA9IGRpc3BsYXk7XG5cbiAgICByZXR1cm4gZGlzcGxheTtcbn07XG4vKiBFbmQgb2YgdmlzaWJsZSAqL1xuXG4vKiBJdCBkZXBlbmRzIG9uIGZvcm1zIHBsdWdpbiEgKi9cbi8vIFNlcmlhbGl6ZSBhIHNzIGluc3RhbmNlLCBhIG1tIGluc3RhbmNlIG9yIGFuIG9iamVjdCBpbnRvIGEgcXVlcnkgc3RyaW5nXG56ekRPTS5fcGFyYW1JdGVtID0gZnVuY3Rpb24oIHIsIGtleSwgdmFsdWUgKSB7XG4gICAgci5wdXNoKCBcbiAgICAgICAgZW5jb2RlVVJJQ29tcG9uZW50KCBrZXkgKSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCggdmFsdWUgPT0gbnVsbD8gJyc6IHZhbHVlIClcbiAgICApO1xufTtcbi8qKiBAbm9jb2xsYXBzZSAqL1xuenpET00ucGFyYW0gPSBmdW5jdGlvbiggeCApIHtcblx0XG4gICAgaWYgKCB4ID09IG51bGwgKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG5cbiAgICB2YXIgciA9IFtdO1xuICAgIFxuICAgIGlmICggeCBpbnN0YW5jZW9mIHp6RE9NLlNTICl7XG4gICAgICAgIHp6RE9NLl9wYXJhbUl0ZW0oIHIsIHguYXR0ciggJ25hbWUnICksIHgudmFsKCkgKTtcbiAgICB9IGVsc2UgaWYgKCB4IGluc3RhbmNlb2YgenpET00uTU0gKXtcbiAgICAgICAgZm9yICggdmFyIGMgPSAwOyBjIDwgeC5saXN0Lmxlbmd0aDsgKytjICl7XG4gICAgICAgICAgICB2YXIgc3MgPSB4Lmxpc3RbIGMgXTtcbiAgICAgICAgICAgIHp6RE9NLl9wYXJhbUl0ZW0oIHIsIHNzLmF0dHIoICduYW1lJyApLCBzcy52YWwoKSApO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICggdHlwZW9mIHggPT09ICdvYmplY3QnICl7ICBcbiAgICAgICAgZm9yICggdmFyIGkgaW4geCApIHtcbiAgICAgICAgICAgIHp6RE9NLl9wYXJhbUl0ZW0oIHIsIGksIHhbIGkgXSApO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgenpET00uX2dldEVycm9yKCAncGFyYW0nICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHIuam9pbiggJyYnICk7XG59O1xuLyogZW5kIG9mIHV0aWxzICovXG5cbi8qKiBAY29uc3RydWN0b3IgKi9cbnp6RE9NLlNTID0gZnVuY3Rpb24gKCBfZWwgKSB7XG4gICAgdGhpcy5lbCA9IF9lbDtcbiAgICB0aGlzLm5vZGVzID0gWyBfZWwgXTtcbiAgICBcbiAgICAvLyBBcnJheSBsaWtlXG4gICAgdGhpcy5sZW5ndGggPSAxO1xuICAgIHRoaXNbIDAgXSA9IF9lbDtcbn07XG5cbi8qIE1ldGhvZHMgTk9UIGluY2x1ZGVkIGluIGpxdWVyeSAqL1xuenpET00uU1MucHJvdG90eXBlLl9nY3MgPSBmdW5jdGlvbiAoIHNlbGYsIHByb3BlcnR5ICkge1xuICAgIHZhciB4ID0gZ2V0Q29tcHV0ZWRTdHlsZSggc2VsZi5lbCwgbnVsbCApWyBwcm9wZXJ0eSBdLnJlcGxhY2UoICdweCcsICcnICk7XG4gICAgcmV0dXJuIGlzTmFOKCB4ICk/IHg6IHBhcnNlRmxvYXQoIHggKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5fZ2V0RWxJZCA9IGZ1bmN0aW9uKCl7XG4gICAgdmFyIGVsSWQgPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSggJ2RhdGEtZWxJZCcgKTtcbiAgICBpZiAoICEgZWxJZCApe1xuICAgICAgICAvLyBHZW5lcmF0ZSBhIHJhbmRvbSBzdHJpbmcgd2l0aCA0IGNoYXJzXG4gICAgICAgIGVsSWQgPSBNYXRoLmZsb29yKCAoIDEgKyBNYXRoLnJhbmRvbSgpICkgKiAweDEwMDAwIClcbiAgICAgICAgICAgIC50b1N0cmluZyggMTYgKVxuICAgICAgICAgICAgLnN1YnN0cmluZyggMSApO1xuICAgICAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtZWxJZCcsIGVsSWQgKTtcbiAgICB9XG4gICAgcmV0dXJuIGVsSWQ7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuX2luc2VydEhlbHBlciA9IGZ1bmN0aW9uICggcG9zaXRpb24sIHggKSB7XG4gICAgaWYgKCB4IGluc3RhbmNlb2YgRWxlbWVudCApe1xuICAgICAgICB0aGlzLmVsLmluc2VydEFkamFjZW50RWxlbWVudCggcG9zaXRpb24sIHggKTtcbiAgICB9IGVsc2UgaWYgKCB4IGluc3RhbmNlb2YgenpET00uU1MgKXtcbiAgICAgICAgdGhpcy5lbC5pbnNlcnRBZGphY2VudEVsZW1lbnQoIHBvc2l0aW9uLCB4LmVsICk7XG4gICAgfSBlbHNlIGlmICggdHlwZW9mIHggPT09ICdzdHJpbmcnICkge1xuICAgICAgICB0aGlzLmVsLmluc2VydEFkamFjZW50SFRNTCggcG9zaXRpb24sIHggKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyAnSW5zZXJ0IG9wZXJhdGlvbiBub3QgcmVhZHkgZm9yIHRoYXQgdHlwZSEnO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5faXRlcmF0ZSA9IGZ1bmN0aW9uKCB2YWx1ZSwgZm4gKXtcbiAgICBpZiAoIEFycmF5LmlzQXJyYXkoIHZhbHVlICkgKXtcbiAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyArK2kgKXtcbiAgICAgICAgICAgIGZuKCB0aGlzLCB2YWx1ZVsgaSBdICk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBmbiggdGhpcywgdmFsdWUgKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuX291dGVyID0gZnVuY3Rpb24gKCBwcm9wZXJ0eSwgbGlua2VkMSwgbGlua2VkMiwgd2l0aE1hcmdpbiApIHtcbiAgICBpZiAoIHRoaXMuZWxbICdvZmZzZXQnICsgcHJvcGVydHkgXSApIHtcbiAgICAgICAgcmV0dXJuIHp6RE9NLlNTLl9vdXRlckNhbGMoIHRoaXMsIHByb3BlcnR5LCBsaW5rZWQxLCBsaW5rZWQyLCB3aXRoTWFyZ2luICk7XG4gICAgfVxuICAgIFxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5fc3dhcCggXG4gICAgICAgIHRoaXMuZWwsIFxuICAgICAgICBmdW5jdGlvbigpe1xuICAgICAgICAgICAgcmV0dXJuIHp6RE9NLlNTLl9vdXRlckNhbGMoIHNlbGYsIHByb3BlcnR5LCBsaW5rZWQxLCBsaW5rZWQyLCB3aXRoTWFyZ2luICk7XG4gICAgICAgIH0gXG4gICAgKTtcbn07XG5cbnp6RE9NLlNTLl9vdXRlckNhbGMgPSBmdW5jdGlvbiAoIHNzLCBwcm9wZXJ0eSwgbGlua2VkMSwgbGlua2VkMiwgd2l0aE1hcmdpbiApIHtcbiAgICB2YXIgdmFsdWUgPSBzcy5fZ2NzKCBzcywgcHJvcGVydHkudG9Mb3dlckNhc2UoKSApO1xuICAgIHZhciBwYWRkaW5nID0gc3MuX2djcyggc3MsICdwYWRkaW5nJyArIGxpbmtlZDEgKSArIHNzLl9nY3MoIHNzLCAncGFkZGluZycgKyBsaW5rZWQyICk7XG4gICAgdmFyIGJvcmRlciA9IHNzLl9nY3MoIHNzLCAnYm9yZGVyJyArIGxpbmtlZDEgKyAnV2lkdGgnICkgKyBzcy5fZ2NzKCBzcywgJ2JvcmRlcicgKyBsaW5rZWQyICsgJ1dpZHRoJyApO1xuICAgIFxuICAgIHZhciB0b3RhbCA9IHZhbHVlICsgcGFkZGluZyArIGJvcmRlcjtcbiAgICBcbiAgICAvLyBObyBtYXJnaW5cbiAgICBpZiAoICEgd2l0aE1hcmdpbiApe1xuICAgICAgICByZXR1cm4gdG90YWw7XG4gICAgfVxuICAgIFxuICAgIHZhciBtYXJnaW4gPSBzcy5fZ2NzKCBzcywgJ21hcmdpbicgKyBsaW5rZWQxICkgKyBzcy5fZ2NzKCBzcywgJ21hcmdpbicgKyBsaW5rZWQyICk7XG4gICAgcmV0dXJuIHRvdGFsICsgbWFyZ2luO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLl9zZXRDc3NVc2luZ0tleVZhbHVlID0gZnVuY3Rpb24gKCBrZXksIHZhbHVlICkge1xuICAgIGlmICggdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICkge1xuICAgICAgICB2YWx1ZSA9IHZhbHVlLmNhbGwoIHRoaXMuZWwsIHRoaXMuX2kgPT09IHVuZGVmaW5lZD8gMDogdGhpcy5faSwgdGhpcyApO1xuICAgIH1cbiAgICB0aGlzLmVsLnN0eWxlWyBrZXkgXSA9IFxuICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmICEgL14tP1xcZCtcXC4/XFxkKiQvLnRlc3QoIHZhbHVlICk/IC8vIGlmIGl0IGlzIGEgc3RyaW5nIGFuZCBpcyBub3QgYSBmbG9hdCBudW1iZXJcbiAgICAgICAgICAgIHZhbHVlOiBcbiAgICAgICAgICAgIHZhbHVlICsgJ3B4Jztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5fc2V0Q3NzVXNpbmdPYmplY3QgPSBmdW5jdGlvbiAoIG9iamVjdCApIHtcbiAgICBmb3IgKCB2YXIga2V5IGluIG9iamVjdCApIHtcbiAgICAgICAgdGhpcy5fc2V0Q3NzVXNpbmdLZXlWYWx1ZSgga2V5LCBvYmplY3RbIGtleSBdICk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge3N0cmluZ30gcHJvcGVydHlcbiAqIEBwYXJhbSB7c3RyaW5nfEZ1bmN0aW9uPX0gdmFsdWVcbiAqL1xuenpET00uU1MucHJvdG90eXBlLl9zdHlsZVByb3BlcnR5ID0gZnVuY3Rpb24gKCBwcm9wZXJ0eSwgdmFsdWUgKSB7XG4gICAgLy8gZ2V0XG4gICAgaWYgKCB2YWx1ZSA9PT0gdW5kZWZpbmVkICl7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFsdWUgPSB0aGlzLl9nY3MoIHRoaXMsIHByb3BlcnR5ICk7XG4gICAgICAgIHJldHVybiBwYXJzZUZsb2F0KCBcbiAgICAgICAgICAgIHZhbHVlICE9PSAnYXV0byc/IFxuICAgICAgICAgICAgICAgIHZhbHVlOiBcbiAgICAgICAgICAgICAgICB0aGlzLl9zd2FwKCBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbCwgXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fZ2NzKCBzZWxmLCBwcm9wZXJ0eSApO1xuICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBzZXRcbiAgICB0aGlzLl9zZXRDc3NVc2luZ0tleVZhbHVlKCBwcm9wZXJ0eSwgdmFsdWUgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5fc3dhcCA9IGZ1bmN0aW9uKCBfZWwsIGNhbGxiYWNrICkge1xuICAgIHZhciBvbGQgPSB7fTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgZGlzcGxheTogJ2Jsb2NrJyxcbiAgICAgICAgcG9zaXRpb246ICdhYnNvbHV0ZScsXG4gICAgICAgIHZpc2liaWxpdHk6ICdoaWRkZW4nXG4gICAgfTtcblxuICAgIC8vIFJlbWVtYmVyIHRoZSBvbGQgdmFsdWVzIGFuZCBpbnNlcnQgdGhlIG5ldyBvbmVzXG4gICAgZm9yICggdmFyIG5hbWUgaW4gb3B0aW9ucyApIHtcbiAgICAgICAgb2xkWyBuYW1lIF0gPSBfZWwuc3R5bGVbIG5hbWUgXTtcbiAgICAgICAgX2VsLnN0eWxlWyBuYW1lIF0gPSBvcHRpb25zWyBuYW1lIF07XG4gICAgfVxuXG4gICAgdmFyIHZhbCA9IGNhbGxiYWNrLmNhbGwoIF9lbCApO1xuXG4gICAgLy8gUmV2ZXJ0IHRoZSBvbGQgdmFsdWVzXG4gICAgZm9yICggbmFtZSBpbiBvcHRpb25zICkge1xuICAgICAgICBfZWwuc3R5bGVbIG5hbWUgXSA9IG9sZFsgbmFtZSBdO1xuICAgIH1cblxuICAgIHJldHVybiB2YWw7XG59O1xuXG4vKiBNZXRob2RzIGluY2x1ZGVkIGluIGpxdWVyeSAqL1xuenpET00uU1MucHJvdG90eXBlLmFkZENsYXNzID0gZnVuY3Rpb24gKCBuYW1lICkge1xuICAgIHJldHVybiB0aGlzLl9pdGVyYXRlKFxuICAgICAgICBuYW1lLFxuICAgICAgICBmdW5jdGlvbiggc2VsZiwgdiApe1xuICAgICAgICAgICAgc2VsZi5lbC5jbGFzc0xpc3QuYWRkKCB2ICk7IFxuICAgICAgICB9XG4gICAgKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5hZnRlciA9IGZ1bmN0aW9uICggeCApIHtcbiAgICByZXR1cm4gdGhpcy5faW5zZXJ0SGVscGVyKCAnYWZ0ZXJlbmQnLCB4ICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24gKCB4ICkge1xuICAgIGlmICggeCBpbnN0YW5jZW9mIEVsZW1lbnQgKXtcbiAgICAgICAgdGhpcy5lbC5hcHBlbmRDaGlsZCggeCApO1xuICAgIH0gZWxzZSBpZiAoIHggaW5zdGFuY2VvZiB6ekRPTS5TUyApe1xuICAgICAgICB0aGlzLmVsLmFwcGVuZENoaWxkKCB4LmVsICk7XG4gICAgfSBlbHNlIGlmICggdHlwZW9mIHggPT09ICdzdHJpbmcnICkge1xuICAgICAgICB0aGlzLmVsLmluc2VydEFkamFjZW50SFRNTCggJ2JlZm9yZWVuZCcsIHggKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyB6ekRPTS5fZ2V0RXJyb3IoICdhcHBlbmQnICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmFwcGVuZFRvID0gZnVuY3Rpb24gKCB4ICkge1xuICAgIC8vIERvIG5vdGhpbmcgYW5kIHJldHVybiB0aGlzIGlmIGl0IGlzIG51bGxcbiAgICBpZiAoIHggPT0gbnVsbCApe1xuICAgICAgICByZXR1cm4gdGhpczsgICAgXG4gICAgfVxuICAgIFxuICAgIC8vIElzIGl0IGEgRWxlbWVudD9cbiAgICBpZiAoIHggaW5zdGFuY2VvZiBFbGVtZW50ICl7XG4gICAgICAgIHguYXBwZW5kQ2hpbGQoIHRoaXMuZWwgKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIFxuICAgIC8vIElzIGl0IGEgc3RyaW5nP1xuICAgIGlmICggdHlwZW9mIHggPT09ICdzdHJpbmcnICl7XG4gICAgICAgIHggPSB6ekRPTS5fYnVpbGQoXG4gICAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCB4IClcbiAgICAgICAgKTtcbiAgICB9XG4gICAgXG4gICAgLy8gSXMgaXQgYSB6ekRPTS5TUz9cbiAgICBpZiAoIHggaW5zdGFuY2VvZiB6ekRPTS5TUyApIHtcbiAgICAgICAgeC5lbC5hcHBlbmRDaGlsZCggdGhpcy5lbCApO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgXG4gICAgLy8gSXMgaXQgYSB6ekRPTS5NTT9cbiAgICBpZiAoIHggaW5zdGFuY2VvZiB6ekRPTS5NTSApIHtcbiAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgeC5ub2Rlcy5sZW5ndGg7ICsraSApe1xuICAgICAgICAgICAgeC5ub2Rlc1sgaSBdLmFwcGVuZENoaWxkKCB0aGlzLmVsLmNsb25lTm9kZSggdHJ1ZSApICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBcbiAgICBcbiAgICB0aHJvdyB6ekRPTS5fZ2V0RXJyb3IoICdpcycgKTtcbn07XG5cbi8vVE9ETyBhZGQgc3VwcG9ydCBvZiBmdW5jdGlvbiB0eXBlIGluIHZhbHVlXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfE9iamVjdH0geFxuICogQHBhcmFtIHtzdHJpbmc9fSB2YWx1ZVxuICovXG56ekRPTS5TUy5wcm90b3R5cGUuYXR0ciA9IGZ1bmN0aW9uICggeCwgdmFsdWUgKSB7XG4gICAgLy8gc2V0IHVzaW5nIG9iamVjdFxuICAgIGlmICggdHlwZW9mIHggPT09ICdvYmplY3QnICl7XG4gICAgICAgIGZvciAoIHZhciBrZXkgaW4geCApIHtcbiAgICAgICAgICAgIHRoaXMuYXR0cigga2V5LCB4WyBrZXkgXSApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBcbiAgICAvLyBnZXRcbiAgICBpZiAoIHZhbHVlID09PSB1bmRlZmluZWQgKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuZWwuZ2V0QXR0cmlidXRlKCB4ICk7XG4gICAgfVxuICAgIFxuICAgIC8vIHJlbW92ZSBhdHRyXG4gICAgaWYgKCB2YWx1ZSA9PT0gbnVsbCApe1xuICAgICAgICByZXR1cm4gdGhpcy5yZW1vdmVBdHRyKCB4ICk7ICAgIFxuICAgIH1cbiAgICBcbiAgICAvLyBzZXRcbiAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSggeCwgdmFsdWUgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5iZWZvcmUgPSBmdW5jdGlvbiAoIHggKSB7XG4gICAgcmV0dXJuIHRoaXMuX2luc2VydEhlbHBlciggJ2JlZm9yZWJlZ2luJywgeCApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmNoaWxkcmVuID0gZnVuY3Rpb24gKCBzZWxlY3RvciApIHtcbiAgICByZXR1cm4genpET00uX2J1aWxkKCBcbiAgICAgICAgc2VsZWN0b3I/XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUuZmlsdGVyLmNhbGwoXG4gICAgICAgICAgICAgICAgdGhpcy5lbC5jaGlsZHJlbiwgXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oIGNoaWxkICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjaGlsZC5tYXRjaGVzKCBzZWxlY3RvciApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk6XG4gICAgICAgICAgICB0aGlzLmVsLmNoaWxkcmVuIFxuICAgICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAoICApIHtcbiAgICByZXR1cm4gbmV3IHp6RE9NLlNTKCB0aGlzLmVsLmNsb25lTm9kZSggdHJ1ZSApICk7XG59O1xuXG4vL1RPRE8gYWRkIHN1cHBvcnQgb2YgZnVuY3Rpb24gdHlwZSBpbiB2YWx1ZVxuLyoqXG4gKiBAcGFyYW0ge3N0cmluZ3xPYmplY3R9IHgxXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXI9fSB4MlxuICovXG56ekRPTS5TUy5wcm90b3R5cGUuY3NzID0gZnVuY3Rpb24gKCB4MSwgeDIgKSB7XG4gICAgdmFyIG51bWJlciA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgXG4gICAgaWYgKCBudW1iZXIgPT09IDEgKXtcbiAgICAgICAgaWYgKCAhIHgxICl7XG4gICAgICAgICAgICB0aHJvdyAnTnVsbCB2YWx1ZSBub3QgYWxsb3dlZCBpbiBjc3MgbWV0aG9kISc7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIGdldFxuICAgICAgICBpZiAoIHR5cGVvZiB4MSA9PT0gJ3N0cmluZycgKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0Q29tcHV0ZWRTdHlsZSggdGhpcy5lbCApWyB4MSBdO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBzZXQgdXNpbmcgb2JqZWN0XG4gICAgICAgIGlmICggdHlwZW9mIHgxID09PSAnb2JqZWN0JyApe1xuICAgICAgICAgICAgdGhpcy5fc2V0Q3NzVXNpbmdPYmplY3QoIHgxICk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdGhyb3cgJ1dyb25nIHR5cGUgb3IgYXJndW1lbnQgaW4gY3NzIG1ldGhvZCEnO1xuICAgIH1cbiAgICBcbiAgICAvLyBzZXQgdXNpbmcga2V5IHZhbHVlIHBhaXJcbiAgICBpZiAoIG51bWJlciA9PT0gMiApe1xuICAgICAgICB0aGlzLl9zZXRDc3NVc2luZ0tleVZhbHVlKCB4MSwgeDIgKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIFxuICAgIHRocm93ICdXcm9uZyBudW1iZXIgb2YgYXJndW1lbnRzIGluIGNzcyBtZXRob2QhJztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5lYWNoID0gZnVuY3Rpb24gKCBlYWNoRm4gKSB7XG4gICAgZWFjaEZuLmNhbGwoIHRoaXMuZWwsIDAsIHRoaXMsIHRoaXMubm9kZXMgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5lbXB0eSA9IGZ1bmN0aW9uICggICkge1xuICAgIHdoaWxlKCB0aGlzLmVsLmZpcnN0Q2hpbGQgKXtcbiAgICAgICAgdGhpcy5lbC5yZW1vdmVDaGlsZCggdGhpcy5lbC5maXJzdENoaWxkICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmZpbHRlciA9IGZ1bmN0aW9uICggeCApIHtcbiAgICBpZiAoIHR5cGVvZiB4ID09PSAnc3RyaW5nJyApeyAvLyBJcyBhIHN0cmluZyBzZWxlY3RvclxuICAgICAgICByZXR1cm4genpET00uX2J1aWxkKCBcbiAgICAgICAgICAgIHRoaXMuZWwubWF0Y2hlcyggeCApPyBbIHRoaXMuZWwgXTogW11cbiAgICAgICAgKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKCB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJyApeyAvLyBJcyBhIGZ1bmN0aW9uXG4gICAgICAgIHJldHVybiB6ekRPTS5fYnVpbGQoXG4gICAgICAgICAgICB4LmNhbGwoIHRoaXMuZWwsIHRoaXMuX2kgPT09IHVuZGVmaW5lZD8gMDogdGhpcy5faSwgdGhpcyApPyBbIHRoaXMuZWwgXTogW11cbiAgICAgICAgKTtcbiAgICB9ICBcbiAgICBcbiAgICB0aHJvdyB6ekRPTS5fZ2V0RXJyb3IoICdmaWx0ZXInICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uICggc2VsZWN0b3IgKSB7XG4gICAgcmV0dXJuIHp6RE9NLl9idWlsZCggXG4gICAgICAgIHRoaXMuZWwucXVlcnlTZWxlY3RvckFsbCggc2VsZWN0b3IgKVxuICAgICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuaGFzQ2xhc3MgPSBmdW5jdGlvbiAoIG5hbWUgKSB7XG4gICAgcmV0dXJuIHRoaXMuZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCBuYW1lICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuaGVpZ2h0ID0gZnVuY3Rpb24gKCB2YWx1ZSApIHtcbiAgICByZXR1cm4gdGhpcy5fc3R5bGVQcm9wZXJ0eSggJ2hlaWdodCcsIHZhbHVlICk7XG59O1xuXG4vL1RPRE8gYWRkIHN1cHBvcnQgb2YgZnVuY3Rpb24gdHlwZSBpbiB2YWx1ZVxuenpET00uU1MucHJvdG90eXBlLmh0bWwgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuICAgIC8vIGdldFxuICAgIGlmICggdmFsdWUgPT09IHVuZGVmaW5lZCApe1xuICAgICAgICByZXR1cm4gdGhpcy5lbC5pbm5lckhUTUw7XG4gICAgfVxuXG4gICAgLy8gc2V0XG4gICAgdGhpcy5lbC5pbm5lckhUTUwgPSB2YWx1ZTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5pbmRleCA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoICEgdGhpcy5lbCApe1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgfVxuICAgIFxuICAgIHZhciBpID0gMDtcbiAgICB2YXIgY3VycmVudEVsID0gdGhpcy5lbDtcbiAgICBkbyB7XG4gICAgICAgIGkrKztcbiAgICB9IHdoaWxlICggY3VycmVudEVsID0gY3VycmVudEVsLnByZXZpb3VzRWxlbWVudFNpYmxpbmcgKTtcbiAgICBcbiAgICByZXR1cm4gaTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5pcyA9IGZ1bmN0aW9uICggeCApIHtcbiAgICBpZiAoIHggPT0gbnVsbCApe1xuICAgICAgICByZXR1cm4gZmFsc2U7ICAgIFxuICAgIH1cbiAgICBcbiAgICBpZiAoIHggaW5zdGFuY2VvZiBFbGVtZW50ICl7XG4gICAgICAgIHJldHVybiB0aGlzLmVsID09PSB4O1xuICAgIH1cbiAgICBcbiAgICBpZiAoIHggaW5zdGFuY2VvZiB6ekRPTS5TUyApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZWwgPT09IHguZWw7XG4gICAgfSBcblxuICAgIGlmICggeCBpbnN0YW5jZW9mIHp6RE9NLk1NICkge1xuICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCB4Lm5vZGVzLmxlbmd0aDsgKytpICl7XG4gICAgICAgICAgICBpZiAoIHRoaXMuZWwgPT09IHgubm9kZXNbIGkgXSApe1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IFxuXG4gICAgaWYgKCB0eXBlb2YgeCA9PT0gJ3N0cmluZycgKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuZWwubWF0Y2hlcyggeCApO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IHp6RE9NLlNTKCB0aGlzLmVsLm5leHRFbGVtZW50U2libGluZyApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLm9mZnNldCA9IGZ1bmN0aW9uICggYyApIHtcbiAgICBcbiAgICAvLyBzZXQgdG9wIGFuZCBsZWZ0IHVzaW5nIGNzc1xuICAgIGlmICggYyApe1xuICAgICAgICB0aGlzLl9zdHlsZVByb3BlcnR5KCAndG9wJywgYy50b3AgKTtcbiAgICAgICAgdGhpcy5fc3R5bGVQcm9wZXJ0eSggJ2xlZnQnLCBjLmxlZnQgKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIFxuICAgIC8vIGdldFxuICAgIHZhciByZWN0ID0gdGhpcy5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICByZXR1cm4ge1xuICAgICAgICB0b3A6IHJlY3QudG9wICsgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AsXG4gICAgICAgIGxlZnQ6IHJlY3QubGVmdCArIGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdFxuICAgIH07XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUub2Zmc2V0UGFyZW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBvZmZzZXRQYXJlbnQgPSB0aGlzLmVsLm9mZnNldFBhcmVudDtcbiAgICByZXR1cm4gb2Zmc2V0UGFyZW50PyBuZXcgenpET00uU1MoIG9mZnNldFBhcmVudCApOiB0aGlzO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge2Jvb2xlYW49fSB3aXRoTWFyZ2luXG4gKi9cbnp6RE9NLlNTLnByb3RvdHlwZS5vdXRlckhlaWdodCA9IGZ1bmN0aW9uICggd2l0aE1hcmdpbiApIHtcbiAgICByZXR1cm4gdGhpcy5fb3V0ZXIoICdIZWlnaHQnLCAnVG9wJywgJ0JvdHRvbScsIHdpdGhNYXJnaW4gKTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHtib29sZWFuPX0gd2l0aE1hcmdpblxuICovXG56ekRPTS5TUy5wcm90b3R5cGUub3V0ZXJXaWR0aCA9IGZ1bmN0aW9uICggd2l0aE1hcmdpbiApIHtcbiAgICByZXR1cm4gdGhpcy5fb3V0ZXIoICdXaWR0aCcsICdMZWZ0JywgJ1JpZ2h0Jywgd2l0aE1hcmdpbiApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnBhcmVudCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IHp6RE9NLlNTKCB0aGlzLmVsLnBhcmVudE5vZGUgKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5wb3NpdGlvbiA9IGZ1bmN0aW9uICggcmVsYXRpdmVUb1ZpZXdwb3J0ICkge1xuICAgIHJldHVybiByZWxhdGl2ZVRvVmlld3BvcnQ/XG4gICAgICAgIHRoaXMuZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk6XG4gICAgICAgIHsgXG4gICAgICAgICAgICBsZWZ0OiB0aGlzLmVsLm9mZnNldExlZnQsIFxuICAgICAgICAgICAgdG9wOiB0aGlzLmVsLm9mZnNldFRvcFxuICAgICAgICB9O1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnByZXBlbmQgPSBmdW5jdGlvbiAoIHggKSB7XG4gICAgaWYgKCB4IGluc3RhbmNlb2YgRWxlbWVudCApe1xuICAgICAgICB0aGlzLmVsLmluc2VydEJlZm9yZSggeCwgdGhpcy5lbC5maXJzdENoaWxkICk7XG4gICAgfSBlbHNlIGlmICggeCBpbnN0YW5jZW9mIHp6RE9NLlNTICl7XG4gICAgICAgIHRoaXMuZWwuaW5zZXJ0QmVmb3JlKCB4LmVsLCB0aGlzLmVsLmZpcnN0Q2hpbGQgKTtcbiAgICB9IGVsc2UgaWYgKCB0eXBlb2YgeCA9PT0gJ3N0cmluZycgKXtcbiAgICAgICAgdGhpcy5lbC5pbnNlcnRBZGphY2VudEhUTUwoICdhZnRlcmJlZ2luJywgeCApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IHp6RE9NLl9nZXRFcnJvciggJ3ByZXBlbmQnICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnByZXYgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyB6ekRPTS5TUyggdGhpcy5lbC5wcmV2aW91c0VsZW1lbnRTaWJsaW5nICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggdGhpcy5lbCApO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnJlbW92ZUF0dHIgPSBmdW5jdGlvbiAoIG5hbWUgKSB7XG4gICAgdGhpcy5lbC5yZW1vdmVBdHRyaWJ1dGUoIG5hbWUgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5yZW1vdmVDbGFzcyA9IGZ1bmN0aW9uICggbmFtZSApIHtcbiAgICBpZiAoICEgbmFtZSApe1xuICAgICAgICB0aGlzLmVsLmNsYXNzTmFtZSA9ICcnO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHRoaXMuX2l0ZXJhdGUoXG4gICAgICAgIG5hbWUsXG4gICAgICAgIGZ1bmN0aW9uKCBzZWxmLCB2ICl7XG4gICAgICAgICAgICBzZWxmLmVsLmNsYXNzTGlzdC5yZW1vdmUoIHYgKTtcbiAgICAgICAgfVxuICAgICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUucmVwbGFjZVdpdGggPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuICAgIHRoaXMuZWwub3V0ZXJIVE1MID0gdmFsdWU7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuc2libGluZ3MgPSBmdW5jdGlvbiAoIHNlbGVjdG9yICkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgbm9kZXMgPSBBcnJheS5wcm90b3R5cGUuZmlsdGVyLmNhbGwoIFxuICAgICAgICB0aGlzLmVsLnBhcmVudE5vZGUuY2hpbGRyZW4sIFxuICAgICAgICBzZWxlY3Rvcj9cbiAgICAgICAgICAgIGZ1bmN0aW9uKCBjaGlsZCApe1xuICAgICAgICAgICAgICAgIHJldHVybiBjaGlsZCAhPT0gc2VsZi5lbCAmJiBjaGlsZC5tYXRjaGVzKCBzZWxlY3RvciApO1xuICAgICAgICAgICAgfTpcbiAgICAgICAgICAgIGZ1bmN0aW9uKCBjaGlsZCApe1xuICAgICAgICAgICAgICAgIHJldHVybiBjaGlsZCAhPT0gc2VsZi5lbDtcbiAgICAgICAgICAgIH1cbiAgICApO1xuICAgIHJldHVybiB6ekRPTS5fYnVpbGQoIG5vZGVzICk7XG59O1xuXG4vL1RPRE8gYWRkIHN1cHBvcnQgb2YgZnVuY3Rpb24gdHlwZSBpbiB2YWx1ZVxuenpET00uU1MucHJvdG90eXBlLnRleHQgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuICAgIC8vIGdldFxuICAgIGlmICggdmFsdWUgPT09IHVuZGVmaW5lZCApe1xuICAgICAgICByZXR1cm4gdGhpcy5lbC50ZXh0Q29udGVudDtcbiAgICB9XG5cbiAgICAvLyBzZXRcbiAgICB0aGlzLmVsLnRleHRDb250ZW50ID0gdmFsdWU7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUudG9nZ2xlQ2xhc3MgPSBmdW5jdGlvbiAoIG5hbWUsIHN0YXRlICkge1xuICAgIHJldHVybiB0aGlzLl9pdGVyYXRlKFxuICAgICAgICBuYW1lLFxuICAgICAgICBzdGF0ZSA9PT0gdW5kZWZpbmVkP1xuICAgICAgICAgICAgZnVuY3Rpb24oIHNlbGYsIHYgKXtcbiAgICAgICAgICAgICAgICBzZWxmLmVsLmNsYXNzTGlzdC50b2dnbGUoIHYgKTtcbiAgICAgICAgICAgIH06XG4gICAgICAgICAgICBmdW5jdGlvbiggc2VsZiwgdiApe1xuICAgICAgICAgICAgICAgIHNlbGYuZWwuY2xhc3NMaXN0LnRvZ2dsZSggdiwgc3RhdGUgKTtcbiAgICAgICAgICAgIH1cbiAgICApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLndpZHRoID0gZnVuY3Rpb24gKCB2YWx1ZSApIHtcbiAgICByZXR1cm4gdGhpcy5fc3R5bGVQcm9wZXJ0eSggJ3dpZHRoJywgdmFsdWUgKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbiAoIGV2ZW50TmFtZSwgbGlzdGVuZXIsIHVzZUNhcHR1cmUgKSB7XG4gICAgenpET00uX3JlbW92ZUV2ZW50TGlzdGVuZXIoIHRoaXMsIGV2ZW50TmFtZSwgbGlzdGVuZXIsIHVzZUNhcHR1cmUgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uICggZXZlbnROYW1lLCBsaXN0ZW5lciwgZGF0YSwgdXNlQ2FwdHVyZSApIHtcbiAgICB6ekRPTS5fYWRkRXZlbnRMaXN0ZW5lciggXG4gICAgICAgIHRoaXMsIFxuICAgICAgICBldmVudE5hbWUsIFxuICAgICAgICBkYXRhPyBcbiAgICAgICAgICAgIGZ1bmN0aW9uKCBlICl7XG4gICAgICAgICAgICAgICAgZS5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbGlzdGVuZXIuY2FsbCggZS5jdXJyZW50VGFyZ2V0LCBlICk7XG4gICAgICAgICAgICB9OlxuICAgICAgICAgICAgbGlzdGVuZXIsIFxuICAgICAgICB1c2VDYXB0dXJlIFxuICAgICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUudHJpZ2dlciA9IGZ1bmN0aW9uICggZXZlbnROYW1lICkge1xuICAgIHZhciBldmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCAnSFRNTEV2ZW50cycgKTtcbiAgICBldmVudC5pbml0RXZlbnQoIGV2ZW50TmFtZSwgdHJ1ZSwgZmFsc2UgKTtcbiAgICB0aGlzLmVsLmRpc3BhdGNoRXZlbnQoIGV2ZW50ICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuLyogRW5kIG9mIGV2ZW50cyAqL1xuXG56ekRPTS5TUy5wcm90b3R5cGUuaGlkZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIHRoaXMuaXNWaXNpYmxlKCkgKXtcbiAgICAgICAgdGhpcy5hdHRyKCBcbiAgICAgICAgICAgICdkYXRhLWRpc3BsYXknLCBcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUoIHRoaXMuZWwsIG51bGwgKVsgJ2Rpc3BsYXknIF1cbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5lbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5pc1Zpc2libGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICEhIHRoaXMuZWwub2Zmc2V0UGFyZW50O1xuICAgIC8vcmV0dXJuIGdldENvbXB1dGVkU3R5bGUoIHRoaXMuZWwsIG51bGwgKS5nZXRQcm9wZXJ0eVZhbHVlKCAnZGlzcGxheScgKSAhPT0gJ25vbmUnO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCAhIHRoaXMuaXNWaXNpYmxlKCkgKXtcbiAgICAgICAgdmFyIGRpc3BsYXkgPSB0aGlzLmF0dHIoICdkYXRhLWRpc3BsYXknICk7XG4gICAgICAgIHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9IGRpc3BsYXk/IGRpc3BsYXk6IHp6RE9NLl9nZXREZWZhdWx0RGlzcGxheSggdGhpcy5lbCApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS50b2dnbGUgPSBmdW5jdGlvbiAoIHN0YXRlICkge1xuICAgIHZhciB2YWx1ZSA9IHN0YXRlICE9PSB1bmRlZmluZWQ/ICEgc3RhdGU6IHRoaXMuaXNWaXNpYmxlKCk7XG4gICAgcmV0dXJuIHZhbHVlPyB0aGlzLmhpZGUoKTogdGhpcy5zaG93KCk7XG59O1xuLyogRW5kIG9mIHZpc2libGUgKi9cblxuenpET00uU1MucHJvdG90eXBlLmNoZWNrZWQgPSBmdW5jdGlvbiAoIGNoZWNrICkge1xuICAgIGlmICggdGhpcy5lbC5ub2RlTmFtZSAhPT0gJ0lOUFVUJyB8fCAoIHRoaXMuZWwudHlwZSAhPT0gJ2NoZWNrYm94JyAmJiB0aGlzLmVsLnR5cGUgIT09ICdyYWRpbycpICkge1xuICAgICAgICB0aHJvdyB6ekRPTS5fZ2V0RXJyb3IoICdjaGVja2VkJyApO1xuICAgIH1cbiAgICBcbiAgICAvLyBnZXRcbiAgICBpZiAoIGNoZWNrID09PSB1bmRlZmluZWQgKXtcbiAgICAgICAgcmV0dXJuICEhIHRoaXMuZWwuY2hlY2tlZDtcbiAgICB9XG4gICAgXG4gICAgLy8gc2V0XG4gICAgdGhpcy5lbC5jaGVja2VkID0gY2hlY2s7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7QXJyYXk8Pz58U3RyaW5nPX0gdmFsdWVcbiAqL1xuenpET00uU1MucHJvdG90eXBlLnZhbCA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG4gICAgLy8gZ2V0XG4gICAgaWYgKCB2YWx1ZSA9PT0gdW5kZWZpbmVkICl7XG4gICAgICAgIHN3aXRjaCAoIHRoaXMuZWwubm9kZU5hbWUgKSB7XG4gICAgICAgIGNhc2UgJ0lOUFVUJzpcbiAgICAgICAgY2FzZSAnVEVYVEFSRUEnOlxuICAgICAgICBjYXNlICdCVVRUT04nOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZWwudmFsdWU7XG4gICAgICAgIGNhc2UgJ1NFTEVDVCc6XG4gICAgICAgICAgICB2YXIgdmFsdWVzID0gW107XG4gICAgICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmVsLmxlbmd0aDsgKytpICkge1xuICAgICAgICAgICAgICAgIGlmICggdGhpcy5lbFsgaSBdLnNlbGVjdGVkICkge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZXMucHVzaCggdGhpcy5lbFsgaSBdLnZhbHVlICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlcy5sZW5ndGggPiAxPyB2YWx1ZXM6IHZhbHVlc1sgMCBdO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgenpET00uX2dldEVycm9yKCAndmFsJyApO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIHNldFxuICAgIHN3aXRjaCAoIHRoaXMuZWwubm9kZU5hbWUgKSB7XG4gICAgY2FzZSAnSU5QVVQnOlxuICAgIGNhc2UgJ1RFWFRBUkVBJzpcbiAgICBjYXNlICdCVVRUT04nOlxuICAgICAgICB0aGlzLmVsLnZhbHVlID0gdmFsdWU7XG4gICAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ1NFTEVDVCc6XG4gICAgICAgIGlmICggdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICkge1xuICAgICAgICAgICAgdmFsdWUgPSBbIHZhbHVlIF07XG4gICAgICAgIH1cbiAgICAgICAgZm9yICggaSA9IDA7IGkgPCB0aGlzLmVsLmxlbmd0aDsgKytpICkge1xuICAgICAgICAgICAgZm9yICggdmFyIGogPSAwOyBqIDwgdmFsdWUubGVuZ3RoOyArK2ogKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbFsgaSBdLnNlbGVjdGVkID0gJyc7XG4gICAgICAgICAgICAgICAgaWYgKCB0aGlzLmVsWyBpIF0udmFsdWUgPT09IHZhbHVlWyBqIF0gKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZWxbIGkgXS5zZWxlY3RlZCA9ICdzZWxlY3RlZCc7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyB6ekRPTS5fZ2V0RXJyb3IoICd2YWwnICk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB0aGlzO1xufTtcbi8qIEVuZCBvZiBmb3JtcyAqL1xuXG56ekRPTS5TUy5wcm90b3R5cGUuZ2V0WENlbnRlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCAtIHRoaXMub3V0ZXJXaWR0aCgpICkgLyAyO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmdldFlDZW50ZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0IC0gdGhpcy5vdXRlckhlaWdodCgpICkgLyAyO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmdldENlbnRlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIGxlZnQ6IHRoaXMuZ2V0WENlbnRlcigpLFxuICAgICAgICB0b3A6IHRoaXMuZ2V0WUNlbnRlcigpXG4gICAgfTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5jZW50ZXIgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm9mZnNldCggXG4gICAgICAgIHRoaXMuZ2V0Q2VudGVyKCkgXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5jZW50ZXJYID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jc3MoICdsZWZ0JywgdGhpcy5nZXRYQ2VudGVyKCkgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5jZW50ZXJZID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jc3MoICd0b3AnLCB0aGlzLmdldFlDZW50ZXIoKSApO1xuICAgIHJldHVybiB0aGlzO1xufTtcbi8qIEVuZCBvZiBjZW50ZXIgKi9cblxuLyoqIEBjb25zdHJ1Y3RvciAqL1xuenpET00uTU0gPSBmdW5jdGlvbiAoIF9ub2RlcyApIHsgICAgXG4gICAgdGhpcy5saXN0ID0gW107XG4gICAgdGhpcy5ub2RlcyA9IF9ub2RlcztcbiAgICB0aGlzLmxlbmd0aCA9IF9ub2Rlcy5sZW5ndGg7XG4gICAgXG4gICAgLy8gSW5pdCBub2Rlc1xuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIHZhciBlbCA9IHRoaXMubm9kZXNbIGkgXTtcbiAgICAgICAgdGhpc1sgaSBdID0gZWw7IC8vIGZvciBhcnJheSBsaWtlXG4gICAgICAgIHZhciBzcyA9IG5ldyB6ekRPTS5TUyggZWwgKTtcbiAgICAgICAgdGhpcy5saXN0LnB1c2goIHNzICk7XG4gICAgICAgIHNzLl9pID0gaTsgLy8gZm9yIGluZGV4IGluIGZ1bmN0aW9uc1xuICAgIH1cbn07XG5cbi8qXG5VbmlmeSB0aGUgZGVmaW5pdGlvbiBvZiBhIGZ1bmN0aW9uIG9mIHp6RE9NLlNTLnByb3RvdHlwZSBhbmQgYSBkZWZpbml0aW9uIG9mIHp6RE9NLk1NLnByb3RvdHlwZS4gRXhhbXBsZTpcblxuICAgIHp6RE9NLmFkZCggXG4gICAgICAgIHp6RE9NLlNTLnByb3RvdHlwZS5teUN1c3RvbUZ1bmN0aW9uID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIC4uLlxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG4gICAgICAgIHp6RE9NLk1NLmNvbnN0cnVjdG9ycy5jb25jYXRcbiAgICApO1xuKTtcbiovXG4vKipcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHNzUHJvdG90eXBlXG4gKiBAcGFyYW0ge0Z1bmN0aW9uPX0gY29uc3RydWN0b3JcbiAqL1xuenpET00uYWRkID0gZnVuY3Rpb24oIHNzUHJvdG90eXBlLCBjb25zdHJ1Y3RvciApe1xuICAgIGZvciAoIHZhciBpZCBpbiB6ekRPTS5TUy5wcm90b3R5cGUgKXtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSB6ekRPTS5TUy5wcm90b3R5cGVbIGlkIF07XG4gICAgICAgIGlmICggc3NQcm90b3R5cGUgPT09IGN1cnJlbnQgKXtcbiAgICAgICAgICAgIHZhciBjbG9zdXJlID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICB2YXIgZnVuY3Rpb25JZCA9IGlkO1xuICAgICAgICAgICAgICAgIHJldHVybiBjb25zdHJ1Y3Rvcj8gY29uc3RydWN0b3IoIGZ1bmN0aW9uSWQgKTogenpET00uTU0uY29uc3RydWN0b3JzLmRlZmF1bHQoIGZ1bmN0aW9uSWQgKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB6ekRPTS5NTS5wcm90b3R5cGVbIGlkIF0gPSBjbG9zdXJlKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgdGhyb3cgJ0Vycm9yIHJlZ2lzdGVyaW5nIHp6RE9NLk1NOiB6ekRPTS5TUyBub3QgZm91bmQuJztcbn07XG5cbnp6RE9NLk1NLmNvbnN0cnVjdG9ycyA9IHt9O1xuenpET00uTU0uY29uc3RydWN0b3JzLmJvb2xlYW5PciA9IGZ1bmN0aW9uKCBmdW5jdGlvbklkICl7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCl7XG4gICAgICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHRoaXMubGlzdC5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgICAgIHZhciBzcyA9IHRoaXMubGlzdFsgaSBdO1xuICAgICAgICAgICAgdmFyIHggPSBzc1sgZnVuY3Rpb25JZCBdLmFwcGx5KCBzcywgYXJndW1lbnRzICk7XG4gICAgICAgICAgICBpZiAoIHggKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcbn07XG56ekRPTS5NTS5jb25zdHJ1Y3RvcnMuY29uY2F0ID0gZnVuY3Rpb24oIGZ1bmN0aW9uSWQgKXtcbiAgICByZXR1cm4gZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIG5ld05vZGVzID0gW107XG4gICAgICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHRoaXMubGlzdC5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgICAgIHZhciBzcyA9IHRoaXMubGlzdFsgaSBdO1xuICAgICAgICAgICAgdmFyIHggPSBzc1sgZnVuY3Rpb25JZCBdLmFwcGx5KCBzcywgYXJndW1lbnRzICk7XG4gICAgICAgICAgICBuZXdOb2RlcyA9IG5ld05vZGVzLmNvbmNhdCggeC5ub2RlcyApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB6ekRPTS5fYnVpbGQoIG5ld05vZGVzICk7XG4gICAgfTtcbn07XG56ekRPTS5NTS5jb25zdHJ1Y3RvcnMuZGVmYXVsdCA9IGZ1bmN0aW9uKCBmdW5jdGlvbklkICl7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCl7XG4gICAgICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHRoaXMubGlzdC5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgICAgIHZhciBzcyA9IHRoaXMubGlzdFsgaSBdO1xuICAgICAgICAgICAgdmFyIHIgPSBzc1sgZnVuY3Rpb25JZCBdLmFwcGx5KCBzcywgYXJndW1lbnRzICk7XG4gICAgICAgICAgICBpZiAoIGkgPT09IDAgJiYgISAoIHIgaW5zdGFuY2VvZiB6ekRPTS5TUyApICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbn07XG5cbi8vIEluaXQgcHJvdG90eXBlIGZ1bmN0aW9ucyBmcm9tIHp6RE9NLlNTXG56ekRPTS5NTS5pbml0ID0gZnVuY3Rpb24oKXtcbiAgICAvLyBDb25jYXQgZnVuY3Rpb25zXG4gICAgdmFyIGNvbmNhdEYgPSBbXG4gICAgICAgICdjaGlsZHJlbicsXG4gICAgICAgICdjbG9uZScsXG4gICAgICAgICdmaWx0ZXInLFxuICAgICAgICAnZmluZCcsXG4gICAgICAgICduZXh0JyxcbiAgICAgICAgJ29mZnNldFBhcmVudCcsXG4gICAgICAgICdwYXJlbnQnLFxuICAgICAgICAncHJldicsXG4gICAgICAgICdzaWJsaW5ncydcbiAgICBdO1xuICAgIC8vIEJvb2xlYW4gZnVuY3Rpb25zXG4gICAgdmFyIGJvb2xlYW5PckYgPSBbXG4gICAgICAgICdoYXNDbGFzcycsXG4gICAgICAgICdpcydcbiAgICBdO1xuICAgIGZvciAoIHZhciBpZCBpbiB6ekRPTS5TUy5wcm90b3R5cGUgKXtcbiAgICAgICAgdmFyIGNsb3N1cmUgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgdmFyIGZ1bmN0aW9uSWQgPSBpZDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCBjb25jYXRGLmluZGV4T2YoIGZ1bmN0aW9uSWQgKSAhPT0gLTEgKXtcbiAgICAgICAgICAgICAgICByZXR1cm4genpET00uTU0uY29uc3RydWN0b3JzLmNvbmNhdCggZnVuY3Rpb25JZCApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCBib29sZWFuT3JGLmluZGV4T2YoIGZ1bmN0aW9uSWQgKSAhPT0gLTEgKXtcbiAgICAgICAgICAgICAgICByZXR1cm4genpET00uTU0uY29uc3RydWN0b3JzLmJvb2xlYW5PciggZnVuY3Rpb25JZCApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHp6RE9NLk1NLmNvbnN0cnVjdG9ycy5kZWZhdWx0KCBmdW5jdGlvbklkICk7XG4gICAgICAgIH07XG4gICAgICAgIHp6RE9NLk1NLnByb3RvdHlwZVsgaWQgXSA9IGNsb3N1cmUoKTtcbiAgICB9XG59KCk7XG5cbi8qIE1ldGhvZHMgaW5jbHVkZWQgaW4ganF1ZXJ5ICovXG56ekRPTS5NTS5wcm90b3R5cGUuZWFjaCA9IGZ1bmN0aW9uICggZWFjaEZuICkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBcbiAgICAgICAgdGhpcy5saXN0LCBcbiAgICAgICAgZnVuY3Rpb24oIGN1cnJlbnRWYWx1ZSwgaW5kZXggKXtcbiAgICAgICAgICAgIGVhY2hGbi5jYWxsKCBjdXJyZW50VmFsdWUuZWwsIGluZGV4LCBjdXJyZW50VmFsdWUsIHNlbGYubm9kZXMgKTtcbiAgICAgICAgfVxuICAgICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBSZWdpc3RlciB6ekRPTSBpZiB3ZSBhcmUgdXNpbmcgTm9kZVxuaWYgKCB0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cyApIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHp6RE9NO1xufVxuIiwidmFyIHp6RE9NID0gcmVxdWlyZSgnLi9idWlsZC96ekRPTS1jbG9zdXJlcy1mdWxsLmpzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHp6RE9NLnp6O1xuIiwiLy8gVGVzdHMgZm9yIGV2ZW50c1xuXG52YXIgenogPSByZXF1aXJlKCAnenpkb20nICk7XG52YXIgdXRpbHMgPSByZXF1aXJlKCAnLi91dGlscy5qcycgKTtcbnZhciBRdW5pdCA9IHJlcXVpcmUoICdxdW5pdCcgKTtcblxuLy8gVW5pdCB0ZXN0c1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoIHJvdXRlciwgZXZlbnRMaXN0ICkge1xuXG4gICAgLy8gSW52b2tlZCBmcm9tIFNpbXBsZSBldmVudHMgdGVzdCBhbmQgU2ltcGxlIGV2ZW50cyBrZWVwQWxpdmUgdGVzdFxuICAgIGNvbnN0IHNpbXBsZUV2ZW50VGVzdCA9IGFzeW5jIGZ1bmN0aW9uKCBhc3NlcnQsIGluaXRFdmVudEFnYWluICl7XG4gICAgICAgIC8vIEdldCBhIHJlZmVyZW5jZSB0byBmaW5pc2ggdGhlIHF1bml0IHRlc3QgbGF0ZXJcbiAgICAgICAgdmFyIGRvbmUgPSBhc3NlcnQuYXN5bmMoKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFdhaXQgaW4gY2FzZSBsYXp5IFVybFxuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcblxuICAgICAgICAvLyBTdGFydCB0ZXN0aW5nLCBldmVudExpc3QgYW5kIGV4cGVjdGVkRXZlbnRMaXN0IG11c3QgYmUgZW1wdHkgYXQgZmlyc3RcbiAgICAgICAgZXZlbnRMaXN0Lmxlbmd0aCA9IDA7XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkRXZlbnRMaXN0ID0gW107XG4gICAgICAgIGFzc2VydC5kZWVwRXF1YWwoIGV2ZW50TGlzdCAsIGV4cGVjdGVkRXZlbnRMaXN0ICk7XG5cbiAgICAgICAgLy8gR28gdG8gcGFnZSAxXG4gICAgICAgIHp6KCcjaG9tZV9wYWdlMUxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgZXhwZWN0ZWRFdmVudExpc3QucHVzaCggJ3BhZ2UxX2luaXQnICk7XG4gICAgICAgIGV4cGVjdGVkRXZlbnRMaXN0LnB1c2goICdwYWdlMV9tb3VudGVkJyApO1xuICAgICAgICBhc3NlcnQuZGVlcEVxdWFsKCBldmVudExpc3QgLCBleHBlY3RlZEV2ZW50TGlzdCApO1xuXG4gICAgICAgIC8vIEdvIHRvIGhvbWUgdXNpbmcgbGlua1xuICAgICAgICB6eignI3BhZ2UxX2hvbWVMaW5rJykuZWwuY2xpY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG4gICAgICAgIGV4cGVjdGVkRXZlbnRMaXN0LnB1c2goICdwYWdlMV9iZWZvcmVPdXQnICk7XG4gICAgICAgIGV4cGVjdGVkRXZlbnRMaXN0LnB1c2goICdwYWdlMV9hZnRlck91dCcgKTtcbiAgICAgICAgYXNzZXJ0LmRlZXBFcXVhbCggZXZlbnRMaXN0ICwgZXhwZWN0ZWRFdmVudExpc3QgKTtcblxuICAgICAgICAvLyBHbyB0byBwYWdlIDEgYWdhaW5cbiAgICAgICAgenooJyNob21lX3BhZ2UxTGluaycpLmVsLmNsaWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBleHBlY3RlZEV2ZW50TGlzdC5wdXNoKCBpbml0RXZlbnRBZ2FpbiApO1xuICAgICAgICBleHBlY3RlZEV2ZW50TGlzdC5wdXNoKCAncGFnZTFfbW91bnRlZCcgKTtcbiAgICAgICAgYXNzZXJ0LmRlZXBFcXVhbCggZXZlbnRMaXN0ICwgZXhwZWN0ZWRFdmVudExpc3QgKTtcblxuICAgICAgICAvLyBHbyB0byBob21lIHVzaW5nIGJhY2tcbiAgICAgICAgaGlzdG9yeS5iYWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBleHBlY3RlZEV2ZW50TGlzdC5wdXNoKCAncGFnZTFfYmVmb3JlT3V0JyApO1xuICAgICAgICBleHBlY3RlZEV2ZW50TGlzdC5wdXNoKCAncGFnZTFfYWZ0ZXJPdXQnICk7XG4gICAgICAgIGFzc2VydC5kZWVwRXF1YWwoIGV2ZW50TGlzdCAsIGV4cGVjdGVkRXZlbnRMaXN0ICk7XG4gICAgICAgIFxuICAgICAgICAvLyBHbyB0byBwYWdlIDEgYWdhaW4gdXNpbmcgZm9yd2FyZFxuICAgICAgICBoaXN0b3J5LmZvcndhcmQoKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG4gICAgICAgIGV4cGVjdGVkRXZlbnRMaXN0LnB1c2goIGluaXRFdmVudEFnYWluICk7XG4gICAgICAgIGV4cGVjdGVkRXZlbnRMaXN0LnB1c2goICdwYWdlMV9tb3VudGVkJyApO1xuICAgICAgICBhc3NlcnQuZGVlcEVxdWFsKCBldmVudExpc3QgLCBleHBlY3RlZEV2ZW50TGlzdCApO1xuICAgICAgICBcbiAgICAgICAgLy8gR28gdG8gaG9tZSB1c2luZyBsaW5rXG4gICAgICAgIHp6KCcjcGFnZTFfaG9tZUxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcblxuICAgICAgICAvLyBGaW5pc2ggcXVuaXQgdGVzdFxuICAgICAgICBkb25lKCk7XG4gICAgfTtcblxuICAgIC8vIENoZWNrIHRoYXQgYWxsIGluaXQgZXZlbnRzIGFyZSBwYWdlMV9pbml0XG4gICAgUVVuaXQudGVzdCggXCJTaW1wbGUgZXZlbnRzIHRlc3RcIiwgYXN5bmMgZnVuY3Rpb24oIGFzc2VydCApIHtcbiAgICAgICAgc2ltcGxlRXZlbnRUZXN0KCBhc3NlcnQsICdwYWdlMV9pbml0JyApO1xuICAgIH0pO1xuXG4gICAgLy8gQ2hlY2sgdGhhdCBhbGwgdGhlIGluaXQgZXZlbnRzIGV4Y2VwdCB0aGUgZmlyc3Qgb25lIGFyZSBwYWdlMV9yZWluaXRcbiAgICBRVW5pdC50ZXN0KCBcIlNpbXBsZSBldmVudHMga2VlcEFsaXZlIHRlc3RcIiwgYXN5bmMgZnVuY3Rpb24oIGFzc2VydCApIHtcblxuICAgICAgICAvLyBTZXQga2VlcEFsaXZlIG9mIHBhZ2UxIHRvIHRydWVcbiAgICAgICAgcm91dGVyLnJvdXRlc01hcFsgJ3BhZ2UxJyBdLmtlZXBBbGl2ZSA9IHRydWU7XG5cbiAgICAgICAgc2ltcGxlRXZlbnRUZXN0KCBhc3NlcnQsICdwYWdlMV9yZWluaXQnICk7XG4gICAgfSk7XG5cbiAgICAvLyBJbnZva2VkIGZyb20gTm8ga2VlcCBhbGl2ZSBpbiBlZGl0ZWQgcGFnZSB0ZXN0IGFuZCBLZWVwIGFsaXZlIGluIGVkaXRlZCBwYWdlXG4gICAgY29uc3QgZWRpdGVkUGFnZVRlc3QgPSBhc3luYyBmdW5jdGlvbiggYXNzZXJ0LCB0ZXh0Q29udGVudDEsIHRleHRDb250ZW50MiwgdGV4dENvbnRlbnQzLCB0ZXh0Q29udGVudDQgKXtcbiAgICAgICAgLy8gR2V0IGEgcmVmZXJlbmNlIHRvIGZpbmlzaCB0aGUgcXVuaXQgdGVzdCBsYXRlclxuICAgICAgICB2YXIgZG9uZSA9IGFzc2VydC5hc3luYygpO1xuXG4gICAgICAgIC8vIEdvIHRvIHBhZ2UgMSBhbmQgdGhlbiB0byB0ZXh0V3JpdGVyIHBhZ2VcbiAgICAgICAgenooJyNob21lX3BhZ2UxTGluaycpLmVsLmNsaWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICB6eignI3BhZ2UxX3RleHRXcml0ZXJMaW5rJykuZWwuY2xpY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyN0ZXh0V3JpdGVyX2hpc3RvcnknKS50ZXh0KCksICcnICk7XG5cbiAgICAgICAgLy8gQWRkIHNvbWUgdGV4dCBhbmQgY2hlY2sgaXQgaXMgYWRkZWQgdG8gdGV4dFdyaXRlcl9oaXN0b3J5XG4gICAgICAgIHp6KCcjdGV4dFdyaXRlcl90ZXh0VG9BZGQnKS52YWwoICdGaXJzdCBsaW5lIGFkZGVkJyApO1xuICAgICAgICB6eignI3RleHRXcml0ZXJfYWRkVGV4dEJ1dHRvbicpLmVsLmNsaWNrKCk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyN0ZXh0V3JpdGVyX2hpc3RvcnknKS50ZXh0KCksIHRleHRDb250ZW50MSApO1xuXG4gICAgICAgIC8vIEdvIGJhY2sgdG8gcGFnZTEsIGdvIGZvcndhcmQgdG8gdGV4dFdyaXRlciBwYWdlXG4gICAgICAgIGhpc3RvcnkuYmFjaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgaGlzdG9yeS5mb3J3YXJkKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjdGV4dFdyaXRlcl9oaXN0b3J5JykudGV4dCgpLCB0ZXh0Q29udGVudDIgKTtcblxuICAgICAgICAvLyBBZGQgc29tZSB0ZXh0IGFuZCBjaGVjayBpdCBpcyBhZGRlZCB0byB0ZXh0V3JpdGVyX2hpc3RvcnlcbiAgICAgICAgenooJyN0ZXh0V3JpdGVyX3RleHRUb0FkZCcpLnZhbCggJ1NlY29uZCBsaW5lIGFkZGVkJyApO1xuICAgICAgICB6eignI3RleHRXcml0ZXJfYWRkVGV4dEJ1dHRvbicpLmVsLmNsaWNrKCk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyN0ZXh0V3JpdGVyX2hpc3RvcnknKS50ZXh0KCksIHRleHRDb250ZW50MyApO1xuXG4gICAgICAgIC8vIEdvIGJhY2sgdG8gcGFnZTEsIGdvIGZvcndhcmQgdG8gdGV4dFdyaXRlciBwYWdlXG4gICAgICAgIGhpc3RvcnkuYmFjaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgaGlzdG9yeS5mb3J3YXJkKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjdGV4dFdyaXRlcl9oaXN0b3J5JykudGV4dCgpLCB0ZXh0Q29udGVudDQgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEdvIHRvIGhvbWUgdXNpbmcgbGlua1xuICAgICAgICB6eignI3RleHRXcml0ZXJfaG9tZUxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcblxuICAgICAgICAvLyBGaW5pc2ggcXVuaXQgdGVzdFxuICAgICAgICBkb25lKCk7XG4gICAgfTtcblxuICAgIFFVbml0LnRlc3QoIFwiTm8ga2VlcCBhbGl2ZSBpbiBlZGl0ZWQgcGFnZSB0ZXN0XCIsIGFzeW5jIGZ1bmN0aW9uKCBhc3NlcnQgKSB7XG5cbiAgICAgICAgZWRpdGVkUGFnZVRlc3QoXG4gICAgICAgICAgICBhc3NlcnQsXG4gICAgICAgICAgICAnRmlyc3QgbGluZSBhZGRlZCcsXG4gICAgICAgICAgICAnJyxcbiAgICAgICAgICAgICdTZWNvbmQgbGluZSBhZGRlZCcsXG4gICAgICAgICAgICAnJ1xuICAgICAgICApO1xuICAgIH0pO1xuXG4gICAgUVVuaXQudGVzdCggXCJLZWVwIGFsaXZlIGluIGVkaXRlZCBwYWdlIHRlc3RcIiwgYXN5bmMgZnVuY3Rpb24oIGFzc2VydCApIHtcbiAgICAgICAgLy8gU2V0IGtlZXBBbGl2ZSBvZiBwYWdlMSB0byB0cnVlXG4gICAgICAgIHJvdXRlci5yb3V0ZXNNYXBbICd0ZXh0V3JpdGVyJyBdLmtlZXBBbGl2ZSA9IHRydWU7XG4gICAgICAgIFxuICAgICAgICBlZGl0ZWRQYWdlVGVzdChcbiAgICAgICAgICAgIGFzc2VydCxcbiAgICAgICAgICAgICdGaXJzdCBsaW5lIGFkZGVkJyxcbiAgICAgICAgICAgICdGaXJzdCBsaW5lIGFkZGVkJyxcbiAgICAgICAgICAgICdGaXJzdCBsaW5lIGFkZGVkU2Vjb25kIGxpbmUgYWRkZWQnLFxuICAgICAgICAgICAgJ0ZpcnN0IGxpbmUgYWRkZWRTZWNvbmQgbGluZSBhZGRlZCdcbiAgICAgICAgKTtcbiAgICB9KTtcblxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgUXVuaXQgPSByZXF1aXJlKCAncXVuaXQnICk7XG52YXIgenogPSByZXF1aXJlKCAnenpkb20nICk7XG52YXIgYmx1ZVJvdXRlciA9IHJlcXVpcmUoICcuLi8uLi9idWlsZC9ibHVlUm91dGVyLmpzJyApO1xuXG4vLyBJbml0IHJvdXRlclxuY29uc3QgaW5pdFJvdXRlciA9ICgpID0+IHtcbiAgICAvLyBJbml0aWFsaXplIHBhZ2VzXG4gICAgY29uc3QgcGFnZXMgPSB7fTtcblxuICAgIC8vIExvYWQganMgb2YgcGFnZXNcbiAgICBwYWdlc1sgJ3BhZ2UxJyBdID0gcmVxdWlyZSggJy4vcGFnZXMvcGFnZTEuanMnICkoIGV2ZW50TGlzdCApO1xuICAgIHBhZ2VzWyAndGV4dFdyaXRlcicgXSA9IHJlcXVpcmUoICcuL3BhZ2VzL3RleHRXcml0ZXIuanMnICk7XG5cbiAgICAvLyBJbml0aWFsaXplIG9wdGlvbnM6IG5vIGFuaW1hdGlvbnNcbiAgICBsZXQgb3B0aW9ucyA9IHtcbiAgICAgICAgZXZlbnRzQnlQYWdlOiBwYWdlcyxcbiAgICAgICAgYW5pbWF0aW9uT3V0OiBmYWxzZSxcbiAgICAgICAgYW5pbWF0aW9uSW46IGZhbHNlLFxuICAgICAgICByb3V0ZXM6IHJlcXVpcmUoICcuL3JvdXRlc0lubGluZUZvckV2ZW50cy5qcycgKVxuICAgIH07XG5cbiAgICAvLyBDcmVhdGUgbmV3IHJvdXRlciBpbnN0YW5jZVxuICAgIHJldHVybiBuZXcgYmx1ZVJvdXRlci5yb3V0ZXIoIG9wdGlvbnMgKTtcbn07XG5cbi8vIEluaXQgcm91dGVyXG5sZXQgZXZlbnRMaXN0ID0gW107XG5jb25zdCByb3V0ZXIgPSBpbml0Um91dGVyKCk7XG5cbi8vIFVuaXQgdGVzdHNcbnJlcXVpcmUoICcuL2V2ZW50cy5qcycgKSggcm91dGVyLCBldmVudExpc3QgKTtcblxuIiwiLyogcGFnZTEgcGFnZSAqL1xuXG5cbi8vbW9kdWxlLmV4cG9ydHMgPSBwYWdlO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoIGV2ZW50TGlzdCApIHtcblxuICAgIGNvbnN0IHBhZ2UgPSB7fTtcblxuICAgIHBhZ2VbICdpbml0JyBdID0gZnVuY3Rpb24oIGV2ZW50ICl7XG4gICAgICAgIC8vYWxlcnQoICdFVkVOVF9JTklUJyApO1xuICAgICAgICBldmVudExpc3QucHVzaCggJ3BhZ2UxX2luaXQnICk7XG4gICAgfTtcbiAgICBcbiAgICBwYWdlWyAncmVpbml0JyBdID0gZnVuY3Rpb24oIGV2ZW50ICl7XG4gICAgICAgIC8vYWxlcnQoICdFVkVOVF9SRUlOSVQnICk7XG4gICAgICAgIGV2ZW50TGlzdC5wdXNoKCAncGFnZTFfcmVpbml0JyApO1xuICAgIH07XG4gICAgXG4gICAgcGFnZVsgJ21vdW50ZWQnIF0gPSBmdW5jdGlvbiggZXZlbnQgKXtcbiAgICAgICAgLy9hbGVydCggJ0VWRU5UX01PVU5URUQnICk7XG4gICAgICAgIGV2ZW50TGlzdC5wdXNoKCAncGFnZTFfbW91bnRlZCcgKTtcbiAgICB9O1xuICAgIFxuICAgIHBhZ2VbICdiZWZvcmVPdXQnIF0gPSBmdW5jdGlvbiggZXZlbnQgKXtcbiAgICAgICAgLy9hbGVydCggJ0VWRU5UX0JFRk9SRV9PVVQnICk7XG4gICAgICAgIGV2ZW50TGlzdC5wdXNoKCAncGFnZTFfYmVmb3JlT3V0JyApO1xuICAgIH07XG4gICAgXG4gICAgcGFnZVsgJ2FmdGVyT3V0JyBdID0gZnVuY3Rpb24oIGV2ZW50ICl7XG4gICAgICAgIC8vYWxlcnQoICdFVkVOVF9BRlRFUl9PVVQnICk7XG4gICAgICAgIGV2ZW50TGlzdC5wdXNoKCAncGFnZTFfYWZ0ZXJPdXQnICk7XG4gICAgfTtcblxuICAgIHJldHVybiBwYWdlO1xufTtcbiIsIi8qIHRleHRXcml0ZXIgcGFnZSAqL1xuY29uc3QgcGFnZSA9IHt9O1xuXG5wYWdlWyAnaW5pdCcgXSA9IGZ1bmN0aW9uKCBldmVudCApe1xuICAgIC8vYWxlcnQoICdFVkVOVF9JTklUJyApO1xuXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd0ZXh0V3JpdGVyX2FkZFRleHRCdXR0b24nICkuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24oIGV2ZW50ICl7XG4gICAgICAgIGxldCB0ZXh0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd0ZXh0V3JpdGVyX3RleHRUb0FkZCcgKS52YWx1ZTtcbiAgICAgICAgLy9hbGVydCggJ3RleHQ6ICcgKyB0ZXh0ICk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAndGV4dFdyaXRlcl9oaXN0b3J5JyApLmlubmVySFRNTCArPSB0ZXh0ICsgJzxicj4nO1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3RleHRXcml0ZXJfdGV4dFRvQWRkJyApLnZhbHVlID0gJyc7XG4gICAgfSk7XG59O1xuXG5wYWdlWyAnbW91bnRlZCcgXSA9IGZ1bmN0aW9uKCBldmVudCApe1xuICAgIC8vYWxlcnQoICdFVkVOVF9NT1VOVEVEJyApO1xuXG4gICAgLy8gQWRkIHRleHQxIGFuZCB0ZXh0MiBwYXJhbWV0ZXJzIHRvIHRleHRXcml0ZXJfaGlzdG9yeVxuICAgIGlmICggZXZlbnQucGFyYW1zICl7XG4gICAgICAgIGlmICggZXZlbnQucGFyYW1zLnRleHQxICl7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3RleHRXcml0ZXJfaGlzdG9yeScgKS5pbm5lckhUTUwgKz0gZXZlbnQucGFyYW1zLnRleHQxICsgJzxicj4nO1xuICAgICAgICB9XG4gICAgICAgIGlmICggZXZlbnQucGFyYW1zLnRleHQyICl7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3RleHRXcml0ZXJfaGlzdG9yeScgKS5pbm5lckhUTUwgKz0gZXZlbnQucGFyYW1zLnRleHQyICsgJzxicj4nO1xuICAgICAgICB9XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBwYWdlO1xuIiwiLy8gUm91dGVzIGZvciBpbmxpbmUgY29udGVudCBmb3IgZXZlbnQgdGVzdHNcbmNvbnN0IHJvdXRlcyA9IFtcbiAgICAvLyBIb21lIHBhZ2VcbiAgICB7XG4gICAgICAgIGlkOiAnW2hvbWVdJyxcbiAgICAgICAgY29udGVudDogYFxuPGgxPkJsdWUgcm91dGVyIHRlc3Q8L2gxPlxuXG48ZGl2IGNsYXNzPVwicGFnZS1jb250ZW50XCI+XG48aDM+SG9tZSBwYWdlPC9oMz5cbjxwPlxuICAgIFRoaXMgaXMgSG9tZSBwYWdlXG48L3A+XG5cbjx1bCBpZD1cImhvbWVfbGlua3NcIj5cbiAgICA8bGk+XG4gICAgICAgIDxhIGhyZWY9XCIhcGFnZTFcIiBpZD1cImhvbWVfcGFnZTFMaW5rXCI+UGFnZSAxPC9hPi4gR28gdG8gcGFnZSAxLlxuICAgIDwvbGk+XG4gICAgPGxpPlxuICAgICAgICA8YSBocmVmPVwiIXBhZ2UyXCIgaWQ9XCJob21lX3BhZ2UyTGlua1wiPlBhZ2UgMjwvYT4uIEdvIHRvIHBhZ2UgMi5cbiAgICA8L2xpPlxuPC91bD5cbjwvZGl2PlxuYFxuICAgIH0sXG4gICAgLy8gcGFnZTFcbiAgICB7XG4gICAgICAgIGlkOiAncGFnZTEnLFxuICAgICAgICBjb250ZW50OiBgXG48aDE+Qmx1ZSByb3V0ZXIgdGVzdDwvaDE+XG5cbjxkaXY+XG48YSBocmVmPVwiIVwiIGlkPVwicGFnZTFfaG9tZUxpbmtcIj5Ib21lPC9hPlxuPC9kaXY+XG5cbjxkaXYgY2xhc3M9XCJwYWdlLWNvbnRlbnRcIj5cbjxoMz5QYWdlIDE8L2gzPlxuPHA+XG4gICAgVGhpcyBpcyBQYWdlIDFcbjwvcD5cblxuPHVsIGlkPVwicGFnZTFfbGlua3NcIj5cbiAgICA8bGk+XG4gICAgICAgIDxhIGhyZWY9XCIhdGV4dFdyaXRlclwiIGlkPVwicGFnZTFfdGV4dFdyaXRlckxpbmtcIj5UZXh0IHdyaXRlcjwvYT4uIEdvIHRvIFRleHQgd3JpdGVyIHBhZ2UuXG4gICAgPC9saT5cbjwvdWw+XG48L2Rpdj5cbmBcbiAgICB9LFxuICAgIC8vIHRleHRXcml0ZXJcbiAgICB7XG4gICAgICAgIGlkOiAndGV4dFdyaXRlcicsXG4gICAgICAgIGNvbnRlbnQ6IGBcbjxoMT5CbHVlIHJvdXRlciB0ZXN0PC9oMT5cblxuPGRpdj5cbjxhIGhyZWY9XCIhXCIgaWQ9XCJ0ZXh0V3JpdGVyX2hvbWVMaW5rXCI+SG9tZTwvYT5cbjwvZGl2PlxuXG48ZGl2IGNsYXNzPVwicGFnZS1jb250ZW50XCI+XG48aDM+VGV4dCB3cml0ZXIgcGFnZTwvaDM+XG48cD5cbiAgICBUaGlzIGlzIHRoZSB0ZXh0IHdyaXRlciBwYWdlLiBXcml0ZSB0ZXh0IGFuZCBjbGljayAnQWRkIHRleHQnIGJ1dHRvbiBvciBwcmVzcyAnRW50ZXInIHRvIGFkZCB0ZXh0LlxuPC9wPlxuXG48ZGl2IGNsYXNzPVwiZmllbGRcIj5cbiAgICA8ZGl2PlRleHQ8L2Rpdj5cbiAgICA8ZGl2PlxuICAgICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBpZD1cInRleHRXcml0ZXJfdGV4dFRvQWRkXCIgbmFtZT1cInRleHRXcml0ZXJfdGV4dFRvQWRkXCIgcmVxdWlyZWQ+XG4gICAgICAgIDxidXR0b24gaWQ9XCJ0ZXh0V3JpdGVyX2FkZFRleHRCdXR0b25cIj5BZGQgdGV4dDwvYnV0dG9uPlxuICAgIDwvZGl2PlxuPC9kaXY+XG5cbjxkaXYgY2xhc3M9XCJmaWVsZFwiPlxuICAgIDxkaXY+SGlzdG9yeTwvZGl2PlxuICAgIDxkaXYgaWQ9XCJ0ZXh0V3JpdGVyX2hpc3RvcnlcIj48L2Rpdj5cbjwvZGl2PlxuPC9kaXY+XG5gXG4gICAgfSxcbiAgICAvLyBwYWdlMlxuICAgIHtcbiAgICAgICAgaWQ6ICdwYWdlMicsXG4gICAgICAgIGNvbnRlbnQ6IGBcbjxoMT5CbHVlIHJvdXRlciB0ZXN0PC9oMT5cblxuPGRpdj5cbjxhIGhyZWY9XCIhXCIgaWQ9XCJwYWdlMl9ob21lTGlua1wiPkhvbWU8L2E+XG48L2Rpdj5cblxuPGRpdiBjbGFzcz1cInBhZ2UtY29udGVudFwiPlxuPGgzPlBhZ2UgMjwvaDM+XG48cD5cbiAgICBUaGlzIGlzIFBhZ2UgMlxuPC9wPlxuPC9kaXY+XG5gXG4gICAgfSxcbiAgICAvLyBEZWZhdWx0IHJvdXRlICg0MDQgcGFnZSlcbiAgICB7XG4gICAgICAgIGlkOiAnWzQwNF0nLFxuICAgICAgICBjb250ZW50OiBgXG48aDE+Qmx1ZSByb3V0ZXIgdGVzdDwvaDE+XG5cbjxkaXY+XG48YSBocmVmPVwiIVwiIGlkPVwiZTQwNF9ob21lTGlua1wiPkhvbWU8L2E+XG48L2Rpdj5cblxuPGRpdiBjbGFzcz1cInBhZ2UtY29udGVudFwiPlxuPGgzPjQwNCBwYWdlPC9oMz5cbjxwPlxuICAgIFNvcnJ5XG48L3A+XG48cCBpZD1cImU0MDRfcFwiPlxuICAgIFJlcXVlc3RlZCBjb250ZW50IG5vdCBmb3VuZC5cbjwvcD5cbjwvZGl2PlxuYFxuICAgIH1cbl07XG5cbm1vZHVsZS5leHBvcnRzID0gcm91dGVzO1xuXG5cbiIsImNvbnN0IHV0aWxzID0ge307XG5cbnV0aWxzLndhaXRTaG9ydCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB1dGlscy53YWl0KCAxMDAwICk7XG59O1xuXG51dGlscy53YWl0ID0gZnVuY3Rpb24oIHRpbWVvdXQgKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCByZXNvbHZlID0+IHtcbiAgICAgICAgc2V0VGltZW91dCggcmVzb2x2ZSwgdGltZW91dCApO1xuICAgIH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB1dGlscztcblxuIl19
