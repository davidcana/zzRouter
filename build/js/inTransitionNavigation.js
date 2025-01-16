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
// Tests for navigation, both transitions

var Qunit = require( 'qunit' );
var blueRouter = require( '../../build/blueRouter.js' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Initialize options: in animations
    let options = {
        eventsByPage: pages,
        animationOut: false,
        routes: require( './routesInlineForNavigation.js' )
    };

    // Create new router instance
    return new blueRouter.router( options );
};

// Init router
const router = initRouter();

// Unit tests
require( './navigation.js' )();



},{"../../build/blueRouter.js":1,"./navigation.js":8,"./routesInlineForNavigation.js":9,"qunit":3}],8:[function(require,module,exports){
const navigation = {};

var zz = require( 'zzdom' );
var utils = require( './utils.js' );

// Unit tests
module.exports = function () {

    QUnit.test( "Simple navigation test", async function( assert ) {
        
        // Get a reference to finish the qunit test later
        var done = assert.async();
        debugger;

        // Start testing
        assert.equal( zz('#home_page1Link').html() , "Page 1" );
        assert.equal( zz('#home_page2Link').html() , "Page 2" );

        // Go to page 1
        zz('#home_page1Link').el.click();
        await utils.waitShort();
        assert.equal( zz('#page1_page11Link').html() , "Page 11" );
        assert.equal( zz('#page1_page12Link').html() , "Page 12" );

        // Go to page 11
        zz('#page1_page11Link').el.click();
        await utils.waitShort();
        assert.equal( zz('#page11_p').text().trim() , "This is Page 11" );

        // Go to home
        zz('#page11_homeLink').el.click();
        await utils.waitShort();
        assert.equal( zz('#home_page1Link').html() , "Page 1" );
        assert.equal( zz('#home_page2Link').html() , "Page 2" );

        // Go to page 2
        zz('#home_page2Link').el.click();
        await utils.waitShort();
        assert.equal( zz('#page2_page21Link').html() , "Page 21" );
        assert.equal( zz('#page2_page22Link').html() , "Page 22" );

        // Go to page 22
        zz('#page2_page22Link').el.click();
        await utils.waitShort();
        assert.equal( zz('#page22_p').text().trim() , "This is Page 22" );

        // Go to home
        zz('#page22_homeLink').el.click();
        await utils.waitShort();

        // Finish qunit test
        done();
    });

    QUnit.test( "History navigation test", async function( assert ) {
        
        // Get a reference to finish the qunit test later
        var done = assert.async();

        // Start testing
        assert.equal( zz('#home_page1Link').html() , "Page 1" );
        assert.equal( zz('#home_page2Link').html() , "Page 2" );

        // Go to page 1
        zz('#home_page1Link').el.click();
        await utils.waitShort();
        assert.equal( zz('#page1_page11Link').html() , "Page 11" );
        assert.equal( zz('#page1_page12Link').html() , "Page 12" );

        // Go to page 11
        zz('#page1_page11Link').el.click();
        await utils.waitShort();
        assert.equal( zz('#page11_p').text().trim() , "This is Page 11" );

        // Test first back-forward-back

        // Go back to page 1
        history.back();
        await utils.waitShort();
        assert.equal( zz('#page1_page11Link').html() , "Page 11" );
        assert.equal( zz('#page1_page12Link').html() , "Page 12" );

        // Go forward to page 11
        history.forward();
        await utils.waitShort();
        assert.equal( zz('#page11_p').text().trim() , "This is Page 11" );

        // Go back to page 1
        history.back();
        await utils.waitShort();
        assert.equal( zz('#page1_page11Link').html() , "Page 11" );
        assert.equal( zz('#page1_page12Link').html() , "Page 12" );

        // Go to home: can not use go back because of qunit strange behaviour
        zz('#page1_homeLink').el.click();
        await utils.waitShort();
        assert.equal( zz('#home_page1Link').html() , "Page 1" );
        assert.equal( zz('#home_page2Link').html() , "Page 2" );
        
        // Go to page 2
        zz('#home_page2Link').el.click();
        await utils.waitShort();
        assert.equal( zz('#page2_page21Link').html() , "Page 21" );
        assert.equal( zz('#page2_page22Link').html() , "Page 22" );
        
        // Go to page 22
        zz('#page2_page22Link').el.click();
        await utils.waitShort();
        assert.equal( zz('#page22_p').text().trim() , "This is Page 22" );
        
        // Go to page 221
        zz('#page22_page221Link').el.click();
        await utils.waitShort();
        assert.equal( zz('#page221_p').text().trim() , "This is Page 221" );
        
        // Test second back-back-forward-forward
        
        // Go back to page 22
        history.back();
        await utils.waitShort();
        assert.equal( zz('#page22_p').text().trim() , "This is Page 22" );
        
        // Go back to page 2
        history.back();
        await utils.waitShort();
        assert.equal( zz('#page2_page21Link').html() , "Page 21" );
        assert.equal( zz('#page2_page22Link').html() , "Page 22" );

        // Go forward to page 22
        history.forward();
        await utils.waitShort();
        assert.equal( zz('#page22_p').text().trim() , "This is Page 22" );

        // Go forward to page 221
        history.forward();
        await utils.waitShort();
        assert.equal( zz('#page221_p').text().trim() , "This is Page 221" );

        // Finish qunit test
        done();
    });

    QUnit.test( "404 error test", async function( assert ) {
        
        //let thisUrl = "/test/bothTransitionNavigation.html";
        let thisUrl = window.location.href;

        // Get a reference to finish the qunit test later
        var done = assert.async();

        // Try to go to 404 error page
        window.location.href = thisUrl + "#!notFound";
        await utils.waitShort();

        // Test 404 page
        assert.equal( zz('#e404_p').text().trim() , "Requested content not found." );
        
        // Go to home
        zz('#e404_homeLink').el.click();
        await utils.waitShort();

        // Go to bokenPage: page with no content defined
        zz('#home_brokenPageLink').el.click();
        await utils.waitShort();
        assert.ok( zz('#error').text().startsWith( "No content found for route from path" ) );

        // Go to home
        //window.location.href = thisUrl;
        //await utils.waitShort();

        // Finish qunit test
        done();
    });

};



},{"./utils.js":10,"zzdom":6}],9:[function(require,module,exports){
// Routes for inline content for navigation tests
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
        <li>
            <a href="!brokenPage" id="home_brokenPageLink">Broken page</a>. Go to broken page.
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
            <a href="!page11" id="page1_page11Link">Page 11</a>. Go to page 11.
        </li>
        <li>
            <a href="!page12" id="page1_page12Link">Page 12</a>. Go to page 12.
        </li>
    </ul>
</div>
`
    },
    // page11
    {
        id: 'page11',
        content: `
<h1>Blue router test</h1>

<div>
    <a href="!" id="page11_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 11</h3>
    <p id="page11_p">
        This is Page 11
    </p>
</div>
`
    },
    // page12
    {
        id: 'page12',
        content: `
<h1>Blue router test</h1>

<div>
    <a href="!" id="page12_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 12</h3>
    <p id="page12_p">
        This is Page 12
    </p>
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

    <ul id="page2_links">
        <li>
            <a href="!page21" id="page2_page21Link">Page 21</a>. Go to page 21.
        </li>
        <li>
            <a href="!page22" id="page2_page22Link">Page 22</a>. Go to page 22.
        </li>
    </ul>
</div>
`
    },
    // page21
    {
        id: 'page21',
        content: `
<h1>Blue router test</h1>

<div>
    <a href="!" id="page21_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 21</h3>
    <p id="page21_p">
        This is Page 21
    </p>
</div>
`
    },
    // page22
    {
        id: 'page22',
        content: `
<h1>Blue router test</h1>

<div>
    <a href="!" id="page22_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 22</h3>
    <p id="page22_p">
        This is Page 22
    </p>

    <ul id="page22_links">
        <li>
            <a href="!page221" id="page22_page221Link">Page 221</a>. Go to page 221.
        </li>
    </ul>
</div>
`
    },
    // page221
    {
        id: 'page221',
        content: `
<h1>Blue router test</h1>

<div>
    <a href="!" id="page221_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 221</h3>
    <p id="page221_p">
        This is Page 221
    </p>
</div>
`
    },
    // brokenPage
    {
        id: 'brokenPage'
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



},{}],10:[function(require,module,exports){
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


},{}]},{},[7])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJidWlsZC9ibHVlUm91dGVyLmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9xdW5pdC9xdW5pdC9xdW5pdC5qcyIsIm5vZGVfbW9kdWxlcy90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzIiwibm9kZV9tb2R1bGVzL3p6ZG9tL2J1aWxkL3p6RE9NLWNsb3N1cmVzLWZ1bGwuanMiLCJub2RlX21vZHVsZXMvenpkb20vaW5kZXguanMiLCJ0ZXN0L2pzL2luVHJhbnNpdGlvbk5hdmlnYXRpb24uanMiLCJ0ZXN0L2pzL25hdmlnYXRpb24uanMiLCJ0ZXN0L2pzL3JvdXRlc0lubGluZUZvck5hdmlnYXRpb24uanMiLCJ0ZXN0L2pzL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RtQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3RvT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxaUNBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLyohIGJsdWVyb3V0ZXIgLSB2MC4xLjAgLSAyMDI1LTAxLTE2IDEzOjMxOjI4ICovXG4vKipcbiAqIEEgbmFtZXNwYWNlLlxuICogQGNvbnN0XG4gKi9cbmNvbnN0IGJsdWVSb3V0ZXIgPSB7fTtcblxuXG4vKiogQGNvbnN0cnVjdG9yICovXG5ibHVlUm91dGVyLnJvdXRlciA9IGZ1bmN0aW9uICggdXNlck9wdGlvbnMgKSB7XG5cbiAgICAvLyBJbml0IG9wdGlvbnNcbiAgICB0aGlzLm9wdGlvbnMgPSB7fTtcbiAgICBibHVlUm91dGVyLnV0aWxzLmV4dGVuZCggdGhpcy5vcHRpb25zLCBibHVlUm91dGVyLmRlZmF1bHRPcHRpb25zLCB1c2VyT3B0aW9ucyApO1xuICAgIHRoaXMuY2hlY2tPcHRpb25zKCk7XG5cbiAgICAvLyBQcmVsb2FkIHBhZ2VzIGlmIG5lZWRlZFxuICAgIGlmICggdGhpcy5vcHRpb25zLnByZWxvYWRQYWdlc09uTG9hZCApe1xuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG4gICAgICAgIGJsdWVSb3V0ZXIuaHRtbEZldGNoZXIubG9hZEFsbFVybHMoXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNlbGYuaW5pdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gRG8gbm90IHByZWxvYWQgcGFnZXMsIHJ1biBpbml0XG4gICAgdGhpcy5pbml0KCk7XG59O1xuXG4vKiBNZXRob2RzICovXG5cbi8qKiBAc3VwcHJlc3Mge21pc3NpbmdQcm9wZXJ0aWVzfSAqL1xuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbigpIHtcblxuICAgIC8vIEluaXQgc29tZSBvdGhlciB2YXJzXG4gICAgdGhpcy5yb3V0ZXNNYXAgPSB0aGlzLmNyZWF0ZVJvdXRlc01hcCgpO1xuICAgIHRoaXMuc3RhY2sgPSBbXTtcblxuICAgIC8vIEFkZCBldmVudCBsaXN0ZW5lcnNcbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXJzRm9yV2luZG93KCk7XG5cbiAgICAvLyBOYXZpZ2F0ZSB0byB3aW5kb3cubG9jYXRpb24uaHJlZiBvciBob21lXG4gICAgdGhpcy5uYXZpZ2F0ZVVybChcbiAgICAgICAgdGhpcy5vcHRpb25zLnVwZGF0ZU9uTG9hZD8gd2luZG93LmxvY2F0aW9uLmhyZWY6ICcnLFxuICAgICAgICB0aGlzLm9wdGlvbnMuYW5pbWF0ZVRyYW5zaXRpb25zT25Mb2FkXG4gICAgKTtcbn07XG5cbi8vIENoZWNrIHRoYXQgbWFuZGF0b3J5IHVzZXIgZGVmaW5lZCBwcm9wZXJ0aWVzIGFyZSBkZWZpbmVkXG4vKiogQHN1cHByZXNzIHttaXNzaW5nUHJvcGVydGllc30gKi9cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5jaGVja09wdGlvbnMgPSBmdW5jdGlvbigpIHtcblxuICAgIGxldCBlcnJvcnMgPSAwO1xuICAgIGxldCBlcnJvck1lc3NhZ2VzID0gJyc7XG5cbiAgICBpZiAoICEgdGhpcy5vcHRpb25zLnJvdXRlcyApe1xuICAgICAgICArK2Vycm9ycztcbiAgICAgICAgZXJyb3JNZXNzYWdlcyArPSAncm91dGVzIG11c3QgYmUgZGVmaW5lZC4gJztcbiAgICB9XG5cbiAgICBpZiAoICEgdGhpcy5vcHRpb25zLmV2ZW50c0J5UGFnZSApe1xuICAgICAgICArK2Vycm9ycztcbiAgICAgICAgZXJyb3JNZXNzYWdlcyArPSAnZXZlbnRzQnlQYWdlIG11c3QgYmUgZGVmaW5lZC4gJztcbiAgICB9XG5cbiAgICBpZiAoIGVycm9ycyApe1xuICAgICAgICB0aGlzLmFsZXJ0RXJyb3IoICdVbmFibGUgdG8gaW5pdGFsaXplIEJsdWUgcm91dGVyLiAnICsgZXJyb3JzICsgJyBlcnJvcnMgZm91bmQ6ICcgKyBlcnJvck1lc3NhZ2VzICk7XG4gICAgfVxufTtcblxuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmFsZXJ0RXJyb3IgPSBmdW5jdGlvbiggbWVzc2FnZSApe1xuICAgIGFsZXJ0KCBtZXNzYWdlICk7XG4gICAgdGhyb3cgbWVzc2FnZTtcbn07XG5cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyc0ZvcldpbmRvdyA9IGZ1bmN0aW9uKCkge1xuICAgIC8qXG4gICAgd2luZG93Lm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgdGhpcy5uYXZpZ2F0ZVVybCggdGhpcy5vcHRpb25zLnVwZGF0ZU9uTG9hZD8gd2luZG93LmxvY2F0aW9uLmhyZWY6ICcnLCB0cnVlICk7XG4gICAgfVxuICAgICovXG4gICAgd2luZG93Lm9ucG9wc3RhdGUgPSAoIGUgKSA9PiB7XG4gICAgICAgIHRoaXMubmF2aWdhdGVVcmwoIHdpbmRvdy5sb2NhdGlvbi5ocmVmLCB0cnVlICk7XG4gICAgICAgIC8vdGhpcy5uYXZpZ2F0ZVVybCggZS5zdGF0ZVsgJ3BhZ2UnIF0sIHRydWUgKTtcbiAgICB9O1xufTtcblxuLyoqIEBzdXBwcmVzcyB7bWlzc2luZ1Byb3BlcnRpZXN9ICovXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lcnNGb3JMaW5rcyA9IGZ1bmN0aW9uKCBwYWdlSWQgKSB7XG4gICAgXG4gICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVycyBmb3IgYSBlbGVtZW50c1xuICAgIGJsdWVSb3V0ZXIudXRpbHMuYWRkRXZlbnRMaXN0ZW5lck9uTGlzdChcbiAgICAgICAgLy9kb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSggJ2EnICksXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBwYWdlSWQgKS5nZXRFbGVtZW50c0J5VGFnTmFtZSggJ2EnICksXG4gICAgICAgICdjbGljaycsIFxuICAgICAgICAoZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaHJlZiA9IGUudGFyZ2V0LmdldEF0dHJpYnV0ZSggJ2hyZWYnICk7XG5cbiAgICAgICAgICAgIC8vIEZvbGxvdyB0aGUgbGluayBpZiBpdCBpcyBleHRlcm5hbCAoaWYgaXQgaXMgbWFya2VkIGFzIGV4dGVybmFsIGluIHRoZSBjbGFzcyBsaXN0KVxuICAgICAgICAgICAgLypcbiAgICAgICAgICAgIGlmICggZS50YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zICggc2VsZi5vcHRpb25zLmV4dGVybmFsQ2xhc3MgKSApe1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICAvLyBGb2xsb3cgdGhlIGxpbmsgaWYgaXQgaXMgZXh0ZXJuYWwgKGlmIGl0IGRvZXMgbm90IHN0YXJ0IGJ5ICEpXG4gICAgICAgICAgICBpZiAoICEgaHJlZi5zdGFydHNXaXRoKCBzZWxmLm9wdGlvbnMuUEFHRV9QUkVGSVggKSApe1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgaGlzdG9yeS5wdXNoU3RhdGUoXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAncGFnZSc6IGhyZWZcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICdwYWdlICcgKyBocmVmLFxuICAgICAgICAgICAgICAgICcjJyArIGhyZWZcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBzZWxmLm5hdmlnYXRlVXJsKCBocmVmLCB0cnVlICk7XG4gICAgICAgIH1cbiAgICApO1xufTtcblxuLy8gQ3JlYXRlIGEgbWFwIHdpdGggdGhlIGRhdGEgaW4gcm91dGVzLCB1c2luZyB0aGUgcGF0aCBhcyB0aGUga2V5XG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuY3JlYXRlUm91dGVzTWFwID0gZnVuY3Rpb24oKSB7XG5cbiAgICBjb25zdCByb3V0ZXJNYXAgPSB7fTtcbiAgICBjb25zdCByb3V0ZXMgPSB0aGlzLm9wdGlvbnMucm91dGVzIHx8IFtdO1xuXG4gICAgcm91dGVzLm1hcCggcm91dGVJdGVtID0+IHtcbiAgICAgICAgcm91dGVyTWFwWyByb3V0ZUl0ZW0uaWQgXSA9IHJvdXRlSXRlbTtcbiAgICB9KTtcblxuICAgIHJldHVybiByb3V0ZXJNYXA7XG59O1xuXG4vKiogQHN1cHByZXNzIHttaXNzaW5nUHJvcGVydGllc30gKi9cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5nZXRSb3V0ZUl0ZW0gPSBmdW5jdGlvbiggcGFnZUlkICkge1xuXG4gICAgLy8gTG9vayBmb3IgdGhlIHJvdXRlXG4gICAgbGV0IHJvdXRlSXRlbSA9IHRoaXMucm91dGVzTWFwWyBwYWdlSWQgXTtcbiAgICBpZiAoIHJvdXRlSXRlbSApe1xuICAgICAgICByZXR1cm4gcm91dGVJdGVtO1xuICAgIH1cblxuICAgIC8vIE5vIHJvdXRlIGZvdW5kLCA0MDQgZXJyb3JcbiAgICByb3V0ZUl0ZW0gPSB0aGlzLnJvdXRlc01hcFsgdGhpcy5vcHRpb25zLlBBR0VfSURfNDA0X0VSUk9SIF07XG4gICAgaWYgKCByb3V0ZUl0ZW0gKXtcbiAgICAgICAgcmV0dXJuIHJvdXRlSXRlbTtcbiAgICB9XG5cbiAgICAvLyBObyA0MDQgcGFnZSwgYnVpbGQgYSA0MDQgcm91dGVcbiAgICByZXR1cm4ge1xuICAgICAgICBpZDogdGhpcy5vcHRpb25zLlBBR0VfSURfNDA0X0VSUk9SLFxuICAgICAgICBjb250ZW50OiAnPGgzPjQwNCAtIFBhZ2Ugbm90IGZvdW5kOiAnICsgcGFnZUlkICsgJzwvaDM+J1xuICAgIH07XG4gICAgLy90aGlzLmFsZXJ0RXJyb3IoICdObyByb3V0ZSBmb3VuZCB3aXRoIGlkICcgKyBwYWdlSWQgKyAnIGFuZCBubyA0MDQgcGFnZSBmb3VuZC4nICk7XG59O1xuXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUubmF2aWdhdGVVcmwgPSBmdW5jdGlvbiggdXJsLCBtdXN0QW5pbWF0ZUJ5Q29kZSApIHtcbiAgICAvL2FsZXJ0KCAnbmF2aWdhdGVVcmxcXG51cmw6ICcgKyB1cmwgKTtcblxuICAgIC8vIENyZWF0ZSBhbiB1cmwgb2JqZWN0IHRvIG1ha2UgaXQgZWFzeSBldmVyeXRoaW5nXG4gICAgbGV0IHVybE9iamVjdCA9IGJsdWVSb3V0ZXIudXRpbHMuYW5hbGl6ZVVybCggdXJsLCB0aGlzLm9wdGlvbnMgKTtcblxuICAgIC8vIFVwZGF0ZSBzdGFjayBhbmQgZ2V0IGN1cnJlbnRQYWdlSWRcbiAgICBsZXQgY3VycmVudFBhZ2VJZCA9IHRoaXMudXBkYXRlU3RhY2soIHVybE9iamVjdC5wYWdlICk7XG5cbiAgICAvLyBFeGl0IGlmIHRyeWluZyB0byBuYXZpZ2F0ZSB0byBjdXJyZW50IHBhZ2VcbiAgICBpZiAoIGN1cnJlbnRQYWdlSWQgPT0gdXJsT2JqZWN0LnBhZ2UgKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEdldCB0aGUgY29udGVudFxuICAgIGxldCBjb250ZW50ID0gdGhpcy5nZXRDb250ZW50Rm9yUGFnZSggdXJsT2JqZWN0LnBhZ2UgKTtcbiAgICBcbiAgICAvLyBJZiBjb250ZW50IGlzIGEgUHJvbWlzZSB3YWl0IGFuZCByZXNvbHZlIGl0XG4gICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgIGlmICggY29udGVudCBpbnN0YW5jZW9mIFByb21pc2UgKXtcbiAgICAgICAgY29udGVudC50aGVuKCBmdW5jdGlvbiggdGV4dCApe1xuICAgICAgICAgICAgLy8gVXBkYXRlIGNvbnRlbnQgb2Ygcm91dGVcbiAgICAgICAgICAgIGxldCByb3V0ZUl0ZW0gPSBzZWxmLmdldFJvdXRlSXRlbSggdXJsT2JqZWN0LnBhZ2UgKTtcbiAgICAgICAgICAgIHJvdXRlSXRlbS5jb250ZW50ID0gdGV4dDtcblxuICAgICAgICAgICAgLy8gUnVuIGRvUGFnZVRyYW5zaXRpb25cbiAgICAgICAgICAgIHNlbGYuZG9QYWdlVHJhbnNpdGlvbiggdGV4dCwgdXJsT2JqZWN0LnBhZ2UsIGN1cnJlbnRQYWdlSWQsIHVybE9iamVjdCwgbXVzdEFuaW1hdGVCeUNvZGUgKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBjb250ZW50IGlzIE5PVCBhIFByb21pc2U6IHVwZGF0ZSBjdXJyZW50IHBhZ2VcbiAgICB0aGlzLmRvUGFnZVRyYW5zaXRpb24oIGNvbnRlbnQsIHVybE9iamVjdC5wYWdlLCBjdXJyZW50UGFnZUlkLCB1cmxPYmplY3QsIG11c3RBbmltYXRlQnlDb2RlICk7XG59O1xuXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUudXBkYXRlU3RhY2sgPSBmdW5jdGlvbiggcGFnZUlkICkge1xuICAgIFxuICAgIC8vIElmIHRoZSBwZW51bHRpbWF0ZSBlbGVtZW50IGlzIHRoZSBwYWdlSWQgdGhlbiB3ZSBhcmUgZ29pbmcgYmFja3dhcmRzOyBvdGhlcndpc2Ugd2UgYXJlIGdvaW5nIGZvcndhcmRcbiAgICBsZXQgaXNCYWNrd2FyZCA9IHRoaXMuc3RhY2tbIHRoaXMuc3RhY2subGVuZ3RoIC0gMiBdID09IHBhZ2VJZDtcblxuICAgIGlmICggaXNCYWNrd2FyZCApe1xuICAgICAgICAvLyBJcyBiYWNrd2FyZFxuICAgICAgICByZXR1cm4gdGhpcy5zdGFjay5wb3AoKTtcbiAgICB9XG5cbiAgICAvLyBJcyBmb3J3YXJkXG4gICAgdmFyIGN1cnJlbnRQYWdlSWQgPSB0aGlzLnN0YWNrWyB0aGlzLnN0YWNrLmxlbmd0aCAtIDEgXTtcbiAgICB0aGlzLnN0YWNrLnB1c2goIHBhZ2VJZCApO1xuICAgIHJldHVybiBjdXJyZW50UGFnZUlkO1xufTtcblxuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmdldENvbnRlbnRGb3JQYWdlID0gZnVuY3Rpb24oIHBhZ2VJZCApIHtcblxuICAgIC8vIEdldCB0aGUgcm91dGVJdGVtIGZyb20gdGhlIHJvdXRlc01hcFxuICAgIGxldCByb3V0ZUl0ZW0gPSB0aGlzLmdldFJvdXRlSXRlbSggcGFnZUlkICk7XG5cbiAgICAvLyBHZXQgdGhlIGNvbnRlbnQgb2YgdGhhdCByb3V0ZVxuICAgIHJldHVybiB0aGlzLmdldENvbnRlbnRGb3JSb3V0ZSggcm91dGVJdGVtICk7XG59O1xuXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuZ2V0Q29udGVudEZvclJvdXRlID0gZnVuY3Rpb24oIHJvdXRlSXRlbSApIHtcbiAgICBcbiAgICAvLyBDaGVjayBrZWVwQWxpdmVcbiAgICBpZiAoIHJvdXRlSXRlbS5rZWVwQWxpdmUgKXtcbiAgICAgICAgbGV0IGFsaXZlUGFnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCByb3V0ZUl0ZW0uaWQgKTtcbiAgICAgICAgaWYgKCBhbGl2ZVBhZ2UgKXtcbiAgICAgICAgICAgIHJldHVybiBhbGl2ZVBhZ2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDaGVjayBjb250ZW50XG4gICAgbGV0IGNvbnRlbnQgPSByb3V0ZUl0ZW0uY29udGVudDtcbiAgICBpZiAoIGNvbnRlbnQgKXtcbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgdXJsXG4gICAgbGV0IHVybCA9IHJvdXRlSXRlbS51cmw7XG4gICAgaWYgKCB1cmwgKXtcbiAgICAgICAgcmV0dXJuIGJsdWVSb3V0ZXIuaHRtbEZldGNoZXIubG9hZFVybCggdXJsICk7XG4gICAgfVxuXG4gICAgcmV0dXJuICc8ZGl2IGlkPVwiZXJyb3JcIj5ObyBjb250ZW50IGZvdW5kIGZvciByb3V0ZSBmcm9tIHBhdGggJyArIHJvdXRlSXRlbS5pZCArICc8L2Rpdj4nO1xufTtcblxuLyoqIEBzdXBwcmVzcyB7bWlzc2luZ1Byb3BlcnRpZXN9ICovXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuZG9QYWdlVHJhbnNpdGlvbiA9IGZ1bmN0aW9uKCBjb250ZW50LCBuZXh0UGFnZUlkLCBjdXJyZW50UGFnZUlkLCB1cmxPYmplY3QsIG11c3RBbmltYXRlQnlDb2RlICkge1xuXG4gICAgLy8gR2V0IG11c3RBbmltYXRlT3V0IGFuZCBtdXN0QW5pbWF0ZUluXG4gICAgY29uc3QgbXVzdEFuaW1hdGVPdXQgPSBtdXN0QW5pbWF0ZUJ5Q29kZSAmJiAhIXRoaXMub3B0aW9ucy5hbmltYXRpb25PdXQ7XG4gICAgY29uc3QgbXVzdEFuaW1hdGVJbiA9IG11c3RBbmltYXRlQnlDb2RlICYmICEhdGhpcy5vcHRpb25zLmFuaW1hdGlvbkluO1xuXG4gICAgLy8gR2V0IHRoZSBpbml0RXZlbnRcbiAgICBjb25zdCBpbml0RXZlbnQgPSBjb250ZW50IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQ/IGJsdWVSb3V0ZXIuZGVmYXVsdE9wdGlvbnMuRVZFTlRfUkVJTklUOiBibHVlUm91dGVyLmRlZmF1bHRPcHRpb25zLkVWRU5UX0lOSVQ7XG5cbiAgICAvLyBSdW4gZXZlbnRzXG4gICAgdGhpcy5ydW5FdmVudCggYmx1ZVJvdXRlci5kZWZhdWx0T3B0aW9ucy5FVkVOVF9CRUZPUkVfT1VULCBjdXJyZW50UGFnZUlkLCB7fSApO1xuXG4gICAgLy8gR2V0IHRoZSBjdXJyZW50UGFnZSBhbmQgYWRkIG5leHQgcGFnZVxuICAgIGxldCBjdXJyZW50UGFnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoICdjdXJyZW50UGFnZScgKVswXTtcbiAgICBsZXQgbmV3UGFnZSA9IHRoaXMuYWRkTmV4dFBhZ2UoIGN1cnJlbnRQYWdlLCBjb250ZW50LCBuZXh0UGFnZUlkICk7XG5cbiAgICAvLyBSZW5kZXIgbmV4dCBwYWdlXG4gICAgdGhpcy5ydW5SZW5kZXJSZWxhdGVkKCBpbml0RXZlbnQsIG5leHRQYWdlSWQsIHVybE9iamVjdCApO1xuXG4gICAgLy8gRGVmaW5lIGN1cnJlbnRQYWdlQW5pbWF0aW9uZW5kTGlzdGVuZXIgYW5kIG5ld1BhZ2VBbmltYXRpb25lbmRMaXN0ZW5lclxuICAgIGxldCBzZWxmID0gdGhpcztcbiAgICBsZXQgY3VycmVudFBhZ2VBbmltYXRpb25lbmRMaXN0ZW5lciA9ICgpID0+IHtcbiAgICAgICAgY3VycmVudFBhZ2UucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2FuaW1hdGlvbmVuZCcsIGN1cnJlbnRQYWdlQW5pbWF0aW9uZW5kTGlzdGVuZXIgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFJlbW92ZSBoaWRkZW4gY2xhc3MsIGFkZCBhbmltYXRpb25JbiBjbGFzc1xuICAgICAgICBuZXdQYWdlLmNsYXNzTGlzdC5yZW1vdmUoICdoaWRkZW4nICk7XG4gICAgICAgIGlmICggbXVzdEFuaW1hdGVJbiApe1xuICAgICAgICAgICAgbmV3UGFnZS5jbGFzc0xpc3QuYWRkKCB0aGlzLm9wdGlvbnMuYW5pbWF0aW9uSW4gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJldGlyZSBjdXJyZW50IHBhZ2U6IHNhdmUgaXQgYXMgYW4gYWxpdmUgcGFnZSBvciByZW1vdmUgaXRcbiAgICAgICAgdGhpcy5yZXRpcmVDdXJyZW50UGFnZSggY3VycmVudFBhZ2VJZCwgY3VycmVudFBhZ2UgKTtcbiAgICAgICAgc2VsZi5ydW5FdmVudCggYmx1ZVJvdXRlci5kZWZhdWx0T3B0aW9ucy5FVkVOVF9BRlRFUl9PVVQsIGN1cnJlbnRQYWdlSWQsIHt9ICk7XG5cbiAgICAgICAgLy8gIFJ1biBuZXdQYWdlQW5pbWF0aW9uZW5kTGlzdGVuZXIgaWYgbGlzdGVuZXIgb2YgYW1pbWF0aW9uZW5kIG9uIG5ld1BhZ2Ugd2FzIG5vdCBhZGRlZFxuICAgICAgICBpZiAoICEgbXVzdEFuaW1hdGVJbiApIHtcbiAgICAgICAgICAgIG5ld1BhZ2VBbmltYXRpb25lbmRMaXN0ZW5lcigpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGxldCBuZXdQYWdlQW5pbWF0aW9uZW5kTGlzdGVuZXIgPSAoKSA9PiB7XG4gICAgICAgIG5ld1BhZ2UucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2FuaW1hdGlvbmVuZCcsIG5ld1BhZ2VBbmltYXRpb25lbmRMaXN0ZW5lciApO1xuXG4gICAgICAgIC8vIFJlbW92ZSBuZXh0UGFnZSBjbGFzcywgYWRkIGN1cnJlbnRQYWdlIGNsYXNzLCByZW1vdmUgYW5pbWF0aW9uSW4gY2xhc3NcbiAgICAgICAgbmV3UGFnZS5jbGFzc0xpc3QucmVtb3ZlKCAnbmV4dFBhZ2UnICk7XG4gICAgICAgIG5ld1BhZ2UuY2xhc3NMaXN0LmFkZCggJ2N1cnJlbnRQYWdlJyApO1xuICAgICAgICBpZiAoIG11c3RBbmltYXRlSW4gKXtcbiAgICAgICAgICAgIG5ld1BhZ2UuY2xhc3NMaXN0LnJlbW92ZSggdGhpcy5vcHRpb25zLmFuaW1hdGlvbkluICk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSdW4gRVZFTlRfSU5JVCBvciBFVkVOVF9SRUlOSVRcbiAgICAgICAgc2VsZi5ydW5FdmVudCggaW5pdEV2ZW50LCBuZXh0UGFnZUlkLCB1cmxPYmplY3QgKTtcblxuICAgICAgICAvLyBSdW4gRVZFTlRfTU9VTlRFRFxuICAgICAgICBzZWxmLnJ1bkV2ZW50KCBibHVlUm91dGVyLmRlZmF1bHRPcHRpb25zLkVWRU5UX01PVU5URUQsIG5leHRQYWdlSWQsIHVybE9iamVjdCApO1xuICAgIH07XG5cbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzXG4gICAgaWYgKCBtdXN0QW5pbWF0ZU91dCApe1xuICAgICAgICBjdXJyZW50UGFnZS5hZGRFdmVudExpc3RlbmVyKCAnYW5pbWF0aW9uZW5kJywgY3VycmVudFBhZ2VBbmltYXRpb25lbmRMaXN0ZW5lciApO1xuICAgIH1cbiAgICBpZiAoIG11c3RBbmltYXRlSW4gKXtcbiAgICAgICAgbmV3UGFnZS5hZGRFdmVudExpc3RlbmVyKCAnYW5pbWF0aW9uZW5kJywgbmV3UGFnZUFuaW1hdGlvbmVuZExpc3RlbmVyICk7XG4gICAgfVxuXG4gICAgLy8gQW5pbWF0ZSFcbiAgICBpZiAoIG11c3RBbmltYXRlT3V0ICl7XG4gICAgICAgIGN1cnJlbnRQYWdlLmNsYXNzTGlzdC5hZGQoIHRoaXMub3B0aW9ucy5hbmltYXRpb25PdXQgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjdXJyZW50UGFnZUFuaW1hdGlvbmVuZExpc3RlbmVyKCk7XG4gICAgfVxufTtcblxuLyoqIEBzdXBwcmVzcyB7bWlzc2luZ1Byb3BlcnRpZXN9ICovXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUucnVuUmVuZGVyUmVsYXRlZCA9IGZ1bmN0aW9uKCBpbml0RXZlbnQsIG5leHRQYWdlSWQsIHVybE9iamVjdCApe1xuXG4gICAgLy8gUnVuIHByZUV2ZW50IChFVkVOVF9QUkVfSU5JVCBvciBFVkVOVF9QUkVfUkVJTklUKVxuICAgIGNvbnN0IHByZUV2ZW50ID0gaW5pdEV2ZW50ID09PSAgdGhpcy5vcHRpb25zLkVWRU5UX0lOSVQ/XG4gICAgICAgIHRoaXMub3B0aW9ucy5FVkVOVF9QUkVfSU5JVDpcbiAgICAgICAgdGhpcy5vcHRpb25zLkVWRU5UX1BSRV9SRUlOSVRcblxuICAgIHRoaXMucnVuRXZlbnQoIHByZUV2ZW50LCBuZXh0UGFnZUlkLCB1cmxPYmplY3QgKTtcblxuICAgIC8vIFJ1biByZW5kZXIgaWYgbmVlZGVkXG4gICAgY29uc3Qgcm91dGVJdGVtID0gdGhpcy5nZXRSb3V0ZUl0ZW0oIG5leHRQYWdlSWQgKTtcbiAgICBjb25zdCByZW5kZXJPcHRpb24gPSBpbml0RXZlbnQgPT09ICB0aGlzLm9wdGlvbnMuRVZFTlRfSU5JVD9cbiAgICAgICAgdGhpcy5vcHRpb25zLlJVTl9SRU5ERVJfQkVGT1JFX0VWRU5UX0lOSVQ6XG4gICAgICAgIHRoaXMub3B0aW9ucy5SVU5fUkVOREVSX0JFRk9SRV9FVkVOVF9SRUlOSVQ7XG4gICAgY29uc3Qgcm91dGVQcm9wZXJ0eSA9IGluaXRFdmVudCA9PT0gIHRoaXMub3B0aW9ucy5FVkVOVF9JTklUP1xuICAgICAgICAncnVuUmVuZGVyQmVmb3JlSW5pdCc6XG4gICAgICAgICdydW5SZW5kZXJCZWZvcmVSZWluaXQnO1xuICAgIGNvbnN0IG11c3RSdW5SZW5kZXIgPSByb3V0ZUl0ZW1bIHJvdXRlUHJvcGVydHkgXSA9PT0gdW5kZWZpbmVkP1xuICAgICAgICByZW5kZXJPcHRpb246XG4gICAgICAgIHJvdXRlSXRlbVsgcm91dGVQcm9wZXJ0eSBdO1xuXG4gICAgaWYgKCBtdXN0UnVuUmVuZGVyICYmIHRoaXMub3B0aW9ucy5yZW5kZXJGdW5jdGlvbiAmJiBibHVlUm91dGVyLnV0aWxzLmlzRnVuY3Rpb24oIHRoaXMub3B0aW9ucy5yZW5kZXJGdW5jdGlvbiApICl7XG4gICAgICAgIHRoaXMub3B0aW9ucy5yZW5kZXJGdW5jdGlvbihcbiAgICAgICAgICAgIHRoaXMuYnVpbGRQYWdlSW5zdGFuY2UoIG5leHRQYWdlSWQgKVxuICAgICAgICApO1xuICAgIH1cbn07XG5cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5idWlsZFBhZ2VJbnN0YW5jZSA9IGZ1bmN0aW9uKCBwYWdlSWQgKXtcblxuICAgIHJldHVybiB7XG4gICAgICAgICAnaWQnOiBwYWdlSWQsXG4gICAgICAgICAnZWwnOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggcGFnZUlkIClcbiAgICB9O1xufTtcblxuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmFkZE5leHRQYWdlID0gZnVuY3Rpb24oIGN1cnJlbnRQYWdlLCBjb250ZW50LCBuZXh0UGFnZUlkICl7XG5cbiAgICBpZiAoIGNvbnRlbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCApe1xuICAgICAgICAvLyBjb250ZW50IGlzIEhUTUxFbGVtZW50XG4gICAgICAgIGN1cnJlbnRQYWdlLmluc2VydEFkamFjZW50RWxlbWVudChcbiAgICAgICAgICAgICdhZnRlcmVuZCcsXG4gICAgICAgICAgICBjb250ZW50XG4gICAgICAgICk7XG4gICAgICAgIGNvbnRlbnQuY2xhc3NMaXN0LmFkZCggJ25leHRQYWdlJyApO1xuICAgICAgICBjb250ZW50LmNsYXNzTGlzdC5hZGQoICdoaWRkZW4nICk7XG4gICAgICAgIGNvbnRlbnQuY2xhc3NMaXN0LnJlbW92ZSggJ2FsaXZlJyApO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gY29udGVudCBtdXN0IGJlIHRleHRcbiAgICAgICAgY3VycmVudFBhZ2UuaW5zZXJ0QWRqYWNlbnRIVE1MKFxuICAgICAgICAgICAgJ2FmdGVyZW5kJyxcbiAgICAgICAgICAgICc8ZGl2IGNsYXNzPVwibmV4dFBhZ2UgaGlkZGVuIHBhZ2VcIiBpZD1cIicgKyBuZXh0UGFnZUlkICsgJ1wiPidcbiAgICAgICAgICAgICsgY29udGVudFxuICAgICAgICAgICAgKyAnPC9kaXY+J1xuICAgICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggbmV4dFBhZ2VJZCApO1xufTtcblxuLy8gUmV0aXJlIGN1cnJlbnQgcGFnZTogc2F2ZSBpdCBhcyBhbiBhbGl2ZSBwYWdlIG9yIHJlbW92ZSBpdFxuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLnJldGlyZUN1cnJlbnRQYWdlID0gZnVuY3Rpb24oIGN1cnJlbnRQYWdlSWQsIGN1cnJlbnRQYWdlICl7XG5cbiAgICBsZXQgY3VycmVudFJvdXRlID0gdGhpcy5nZXRSb3V0ZUl0ZW0oIGN1cnJlbnRQYWdlSWQgKTtcblxuICAgIC8vIElmIG11c3Qga2VlcCBhbGl2ZSBjdXJyZW50IHBhZ2UsIHNldCBwYWdlIGFuZCBhbGl2ZSBhcyBjbGFzc2VzIHJlbW92aW5nIHRoZSByZXN0XG4gICAgaWYgKCBjdXJyZW50Um91dGUgJiYgY3VycmVudFJvdXRlLmtlZXBBbGl2ZSl7XG4gICAgICAgIGN1cnJlbnRQYWdlLnJlbW92ZUF0dHJpYnV0ZSggJ2NsYXNzJyApO1xuICAgICAgICBjdXJyZW50UGFnZS5jbGFzc0xpc3QuYWRkKCAncGFnZScgKTtcbiAgICAgICAgY3VycmVudFBhZ2UuY2xhc3NMaXN0LmFkZCggJ2FsaXZlJyApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gRG8gbm90IGtlZXAgYWxpdmUgY3VycmVudCBwYWdlLCBzbyByZW1vdmUgaXRcbiAgICBjdXJyZW50UGFnZS5yZW1vdmUoKTtcbn07XG5cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5ydW5FdmVudCA9IGZ1bmN0aW9uKCBldmVudElkLCBwYWdlSWQsIHVybE9iamVjdCApIHtcblxuICAgIGlmICggZXZlbnRJZCA9PSBibHVlUm91dGVyLmRlZmF1bHRPcHRpb25zLkVWRU5UX0lOSVQgKXtcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyc0ZvckxpbmtzKCBwYWdlSWQgKTtcbiAgICB9XG5cbiAgICAvLyBHZXQgdGhlIHBhZ2Ugb2JqZWN0IGZyb20gb3B0aW9uc1xuICAgIC8qKiBAc3VwcHJlc3Mge21pc3NpbmdQcm9wZXJ0aWVzfSAqL1xuICAgIGxldCBwYWdlID0gdGhpcy5vcHRpb25zLmV2ZW50c0J5UGFnZVsgcGFnZUlkIF07XG5cbiAgICAvLyBJZiBhIHBhZ2UgaXMgZm91bmQsIHJ1biB0aGUgZXZlbnQgaGFuZGxlclxuICAgIGlmICggcGFnZSApe1xuICAgICAgICBsZXQgZXZlbnQgPSB7XG4gICAgICAgICAgICBwYXJhbXM6IHVybE9iamVjdC5wYXJhbXMgfHwge31cbiAgICAgICAgfTtcbiAgICAgICAgaWYgKCBwYWdlWyBldmVudElkIF0gJiYgYmx1ZVJvdXRlci51dGlscy5pc0Z1bmN0aW9uKCBwYWdlWyBldmVudElkIF0gKSApe1xuICAgICAgICAgICAgcGFnZVsgZXZlbnRJZCBdKCBldmVudCApO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuXG4vLyBEZWZhdWx0IG9wdGlvbnNcblxuYmx1ZVJvdXRlci5kZWZhdWx0T3B0aW9ucyA9IHtcbiAgICB1cGRhdGVPbkxvYWQ6IHRydWUsXG4gICAgcHJlbG9hZFBhZ2VzT25Mb2FkOiBmYWxzZSxcblxuICAgIC8vIEFuaW1hdGlvbnNcbiAgICBhbmltYXRpb25PdXQ6ICdzbGlkZS1vdXQtdG9wJyxcbiAgICAvL2FuaW1hdGlvbk91dDogZmFsc2UsXG4gICAgYW5pbWF0aW9uSW46ICdzY2FsZS1pbi1jZW50ZXInLFxuICAgIC8vYW5pbWF0aW9uSW46IGZhbHNlLFxuICAgIGFuaW1hdGVUcmFuc2l0aW9uc09uTG9hZDogZmFsc2UsXG4gICAgXG4gICAgLy8gTWlzY1xuICAgIFBBR0VfUFJFRklYOiAnIScsXG5cbiAgICAvLyBTcGVjaWFsIHBhZ2VzIGlkc1xuICAgIFBBR0VfSURfSE9NRTogJ1tob21lXScsXG4gICAgUEFHRV9JRF80MDRfRVJST1I6ICdbNDA0XScsXG5cbiAgICAvLyBFdmVudHNcbiAgICBFVkVOVF9QUkVfSU5JVDogJ3ByZUluaXQnLFxuICAgIEVWRU5UX0lOSVQ6ICdpbml0JyxcbiAgICBFVkVOVF9QUkVfUkVJTklUOiAncHJlUmVpbml0JyxcbiAgICBFVkVOVF9SRUlOSVQ6ICdyZWluaXQnLFxuICAgIEVWRU5UX01PVU5URUQ6ICdtb3VudGVkJyxcbiAgICBFVkVOVF9CRUZPUkVfT1VUOiAnYmVmb3JlT3V0JyxcbiAgICBFVkVOVF9BRlRFUl9PVVQ6ICdhZnRlck91dCcsXG5cbiAgICBSVU5fUkVOREVSX0JFRk9SRV9FVkVOVF9JTklUOiB0cnVlLFxuICAgIFJVTl9SRU5ERVJfQkVGT1JFX0VWRU5UX1JFSU5JVDogZmFsc2VcblxufTtcblxuXG5ibHVlUm91dGVyLmh0bWxGZXRjaGVyID0ge307XG5cbmJsdWVSb3V0ZXIuaHRtbEZldGNoZXIubG9hZEFsbFVybHMgPSBmdW5jdGlvbiggcm91dGVyLCBjYWxsYmFjayApe1xuXG4gICAgLy8gR2V0IHRoZSByb3V0ZXMgdG8gdXNlXG4gICAgY29uc3Qgcm91dGVzID0gcm91dGVyLm9wdGlvbnMucm91dGVzIHx8IFtdO1xuXG4gICAgLy8gSW5pdCB0aGUgbnVtYmVyIG90IHVybHMgdG8gZ2V0XG4gICAgbGV0IHBlbmRpbmcgPSAwO1xuXG4gICAgLy8gSXRlcmF0ZSB1cmxSb3V0ZXMgYW5kIGxvYWQgZWFjaCByb3V0ZUl0ZW0gaWYgbmVlZGVkXG4gICAgcm91dGVzLm1hcCggcm91dGVJdGVtID0+IHtcbiAgICAgICAgbGV0IHVybCA9IHJvdXRlSXRlbS51cmw7XG4gICAgICAgIGlmICggdXJsICl7XG4gICAgICAgICAgICArK3BlbmRpbmc7XG4gICAgICAgICAgICBibHVlUm91dGVyLmh0bWxGZXRjaGVyLmxvYWRVcmwoIHVybCApLnRoZW4oXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oIHRleHQgKXtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIGNvbnRlbnQgb2Ygcm91dGVcbiAgICAgICAgICAgICAgICAgICAgcm91dGVJdGVtLmNvbnRlbnQgPSB0ZXh0O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFJ1biBjYWxsYmFjayB3aGVuIGFsbCBmaWxlcyBoYXZlIGJlZW4gbG9hZGVkXG4gICAgICAgICAgICAgICAgICAgIGlmICggLS1wZW5kaW5nID09IDAgJiYgY2FsbGJhY2sgJiYgYmx1ZVJvdXRlci51dGlscy5pc0Z1bmN0aW9uKCBjYWxsYmFjayApICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsXG4gKiBcbiAqL1xuYmx1ZVJvdXRlci5odG1sRmV0Y2hlci5sb2FkVXJsID0gYXN5bmMgZnVuY3Rpb24oIHVybCApe1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCggdXJsICk7XG5cbiAgICBpZiAoICEgcmVzcG9uc2Uub2sgKSB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgRXJyb3IgZmV0Y2hpbmcgJHt1cmx9IGhhcyBvY2N1cmVkOiAke3Jlc3BvbnNlLnN0YXR1c31gO1xuICAgICAgICBhbGVydCAoIG1lc3NhZ2UgKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCBtZXNzYWdlICk7XG4gICAgfVxuICBcbiAgICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuICAgIHJldHVybiB0ZXh0O1xufTtcblxuYmx1ZVJvdXRlci51dGlscyA9IHt9O1xuXG4vKlxuICAgIEJ1aWxkcyBhbiBvYmplY3Qgd2l0aCBkYXRhIGFib3V0IHRoZSB1cmwuIEFuIGV4YW1wbGU6XG5cbiAgICB1cmwgOiBodHRwOi8vMTI3LjAuMC4xOjkwMDAvc2FtcGxlcy9zYW1wbGUuaHRtbCMhYWJvdXQ/cGFyYW0xPWEmcGFyYW0yPWJcIlxuXG4gICAgcHJlcGFnZTogaHR0cDovLzEyNy4wLjAuMTo5MDAwL3NhbXBsZXMvc2FtcGxlLmh0bWxcbiAgICBwYWdlOiBhYm91dFxuICAgIHBhcmFtczoge1xuICAgICAgICBwYXJhbTE6IGFcbiAgICAgICAgcGFyYW0yOiBiXG4gICAgfVxuKi9cbmJsdWVSb3V0ZXIudXRpbHMuYW5hbGl6ZVVybCA9IGZ1bmN0aW9uKCB1cmwsIG9wdGlvbnMgKSB7XG4gICAgXG4gICAgbGV0IHJlc3VsdCA9IHt9O1xuXG4gICAgLy8gRXh0cmFjdCB0aGUgcGFydHMgYmVmb3JlIGFuZCBhZnRlciBQQUdFX1BSRUZJWFxuICAgIGxldCB1cmxQYXJ0cyA9IHVybC5zcGxpdCggb3B0aW9ucy5QQUdFX1BSRUZJWCApO1xuICAgIHJlc3VsdC5wcmVwYWdlID0gdXJsUGFydHNbIDAgXTtcbiAgICBsZXQgcG9zdFBhdGggPSB1cmxQYXJ0c1sgMSBdIHx8ICcnO1xuXG4gICAgLy8gUmVtb3ZlICMgaWYgcHJlc2VudFxuICAgIGlmICggcmVzdWx0LnByZXBhZ2UuZW5kc1dpdGgoICcjJyApICl7XG4gICAgICAgIHJlc3VsdC5wcmVwYWdlID0gcmVzdWx0LnByZXBhZ2Uuc2xpY2UoIDAsIC0xICk7XG4gICAgfVxuXG4gICAgLy8gRXh0cmFjdCB0aGUgcGFydHMgYmVmb3JlIGFuZCBhZnRlciA/XG4gICAgbGV0IHBhdGhQYXJ0cyA9IHBvc3RQYXRoLnNwbGl0KCAnPycgKTtcbiAgICByZXN1bHQucGFnZSA9IHBhdGhQYXJ0c1sgMCBdO1xuXG4gICAgLy8gRml4IGhvbWUgcGFnZVxuICAgIGlmICggcmVzdWx0LnBhZ2UgPT0gJycpIHtcbiAgICAgICAgcmVzdWx0LnBhZ2UgPSBvcHRpb25zLlBBR0VfSURfSE9NRTtcbiAgICB9XG5cbiAgICBsZXQgcGFyYW1zU3RyaW5nID0gcGF0aFBhcnRzWyAxIF0gfHwgJyc7XG5cbiAgICAvLyBBZGQgcGFyYW1zXG4gICAgcmVzdWx0LnBhcmFtcyA9IHt9O1xuICAgIGlmICggcGFyYW1zU3RyaW5nID09ICcnICl7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGxldCB2YXJzID0gcGFyYW1zU3RyaW5nLnNwbGl0KCAnJicgKTtcbiAgICBmb3IgKCBsZXQgaSA9IDA7IGkgPCB2YXJzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBsZXQgcGFpciA9IHZhcnNbIGkgXS5zcGxpdCggJz0nICk7XG4gICAgICAgIGxldCBwYXJhbU5hbWUgPSBwYWlyWyAwIF07XG4gICAgICAgIGxldCBwYXJhbVZhbHVlID0gcGFpclsgMSBdO1xuICAgICAgICByZXN1bHQucGFyYW1zWyBwYXJhbU5hbWUgXSA9IHBhcmFtVmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbmJsdWVSb3V0ZXIudXRpbHMuYWRkRXZlbnRMaXN0ZW5lck9uTGlzdCA9IGZ1bmN0aW9uKCBsaXN0LCBldmVudCwgZm4gKSB7XG5cbiAgICBmb3IgKCBsZXQgaSA9IDAsIGxlbiA9IGxpc3QubGVuZ3RoOyBpIDwgbGVuOyBpKysgKSB7XG4gICAgICAgIGxpc3RbIGkgXS5hZGRFdmVudExpc3RlbmVyKCBldmVudCwgZm4sIGZhbHNlICk7XG4gICAgfVxufTtcblxuYmx1ZVJvdXRlci51dGlscy5leHRlbmQgPSBmdW5jdGlvbiggb3V0LCBmcm9tMSwgZnJvbTIgKSB7XG4gICAgb3V0ID0gb3V0IHx8IHt9O1xuXG4gICAgZm9yICggdmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBpZiAoICEgYXJndW1lbnRzWyBpIF0gKXtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICggdmFyIGtleSBpbiBhcmd1bWVudHNbIGkgXSApIHtcbiAgICAgICAgICAgIGlmICggYXJndW1lbnRzWyBpIF0uaGFzT3duUHJvcGVydHkoIGtleSApICl7XG4gICAgICAgICAgICAgICAgb3V0WyBrZXkgXSA9IGFyZ3VtZW50c1sgaSBdWyBrZXkgXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvdXQ7XG59O1xuXG4vKiBmb3JtYXRTdHJpbmcgKi9cbi8vIEV4YW1wbGU6IGl0aWxzLmZvcm1hdFN0cmluZyggJ3swfSBpcyBkZWFkLCBidXQgezF9IGlzIGFsaXZlIScsICdBU1AnLCAnQVNQLk5FVCcgKVxuLyoqXG4gKiBUYWtlcyAxIG9yIG1vcmUgc3RyaW5ncyBhbmQgZG8gc29tZXRoaW5nIGNvb2wgd2l0aCB0aGVtLlxuICogQHBhcmFtIHsuLi5zdHJpbmd8bnVtYmVyfSBmb3JtYXRcbiAqL1xuYmx1ZVJvdXRlci51dGlscy5mb3JtYXRTdHJpbmcgPSBmdW5jdGlvbiggZm9ybWF0ICkge1xuICAgIFxuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGFyZ3VtZW50cywgMSApO1xuICAgIHJldHVybiBmb3JtYXQucmVwbGFjZSgveyhcXGQrKX0vZywgZnVuY3Rpb24gKCBtYXRjaCwgbnVtYmVyICkge1xuICAgICAgICByZXR1cm4gdHlwZW9mIGFyZ3NbIG51bWJlciBdICE9ICd1bmRlZmluZWQnPyBhcmdzWyBudW1iZXIgXSA6IG1hdGNoO1xuICAgIH0pO1xufTtcblxuYmx1ZVJvdXRlci51dGlscy5pc0Z1bmN0aW9uID0gZnVuY3Rpb24gaXNGdW5jdGlvbiggb2JqICkge1xuXG4gICAgLy8gU3VwcG9ydDogQ2hyb21lIDw9NTcsIEZpcmVmb3ggPD01MlxuICAgIC8vIEluIHNvbWUgYnJvd3NlcnMsIHR5cGVvZiByZXR1cm5zIFwiZnVuY3Rpb25cIiBmb3IgSFRNTCA8b2JqZWN0PiBlbGVtZW50c1xuICAgIC8vIChpLmUuLCBgdHlwZW9mIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoIFwib2JqZWN0XCIgKSA9PT0gXCJmdW5jdGlvblwiYCkuXG4gICAgLy8gV2UgZG9uJ3Qgd2FudCB0byBjbGFzc2lmeSAqYW55KiBET00gbm9kZSBhcyBhIGZ1bmN0aW9uLlxuICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIG9iai5ub2RlVHlwZSAhPT0gXCJudW1iZXJcIjtcbn07XG4vKiBlbmQgb2YgdXRpbHMgKi9cblxuLy8gUmVnaXN0ZXIgYmx1ZVJvdXRlciBpZiB3ZSBhcmUgdXNpbmcgTm9kZVxuaWYgKCB0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cyApIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGJsdWVSb3V0ZXI7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLyohXG4gKiBRVW5pdCAyLjExLjNcbiAqIGh0dHBzOi8vcXVuaXRqcy5jb20vXG4gKlxuICogQ29weXJpZ2h0IE9wZW5KUyBGb3VuZGF0aW9uIGFuZCBvdGhlciBjb250cmlidXRvcnNcbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZVxuICogaHR0cHM6Ly9qcXVlcnkub3JnL2xpY2Vuc2VcbiAqXG4gKiBEYXRlOiAyMDIwLTEwLTA1VDAxOjM0WlxuICovXG4oZnVuY3Rpb24gKGdsb2JhbCQxKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHRmdW5jdGlvbiBfaW50ZXJvcERlZmF1bHRMZWdhY3kgKGUpIHsgcmV0dXJuIGUgJiYgdHlwZW9mIGUgPT09ICdvYmplY3QnICYmICdkZWZhdWx0JyBpbiBlID8gZSA6IHsgJ2RlZmF1bHQnOiBlIH07IH1cblxuXHR2YXIgZ2xvYmFsX19kZWZhdWx0ID0gLyojX19QVVJFX18qL19pbnRlcm9wRGVmYXVsdExlZ2FjeShnbG9iYWwkMSk7XG5cblx0dmFyIHdpbmRvdyQxID0gZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10ud2luZG93O1xuXHR2YXIgc2VsZiQxID0gZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10uc2VsZjtcblx0dmFyIGNvbnNvbGUgPSBnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXS5jb25zb2xlO1xuXHR2YXIgc2V0VGltZW91dCQxID0gZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10uc2V0VGltZW91dDtcblx0dmFyIGNsZWFyVGltZW91dCA9IGdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddLmNsZWFyVGltZW91dDtcblx0dmFyIGRvY3VtZW50JDEgPSB3aW5kb3ckMSAmJiB3aW5kb3ckMS5kb2N1bWVudDtcblx0dmFyIG5hdmlnYXRvciA9IHdpbmRvdyQxICYmIHdpbmRvdyQxLm5hdmlnYXRvcjtcblx0dmFyIGxvY2FsU2Vzc2lvblN0b3JhZ2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIHggPSBcInF1bml0LXRlc3Qtc3RyaW5nXCI7XG5cblx0ICB0cnkge1xuXHQgICAgZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10uc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSh4LCB4KTtcblx0ICAgIGdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddLnNlc3Npb25TdG9yYWdlLnJlbW92ZUl0ZW0oeCk7XG5cdCAgICByZXR1cm4gZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10uc2Vzc2lvblN0b3JhZ2U7XG5cdCAgfSBjYXRjaCAoZSkge1xuXHQgICAgcmV0dXJuIHVuZGVmaW5lZDtcblx0ICB9XG5cdH0oKTsgLy8gU3VwcG9ydCBJRSA5LTEwOiBGYWxsYmFjayBmb3IgZnV6enlzb3J0LmpzIHVzZWQgYnkgL3JlcG9ydGVyL2h0bWwuanNcblxuXHRpZiAoIWdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddLk1hcCkge1xuXHQgIGdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddLk1hcCA9IGZ1bmN0aW9uIFN0cmluZ01hcCgpIHtcblx0ICAgIHZhciBzdG9yZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cblx0ICAgIHRoaXMuZ2V0ID0gZnVuY3Rpb24gKHN0cktleSkge1xuXHQgICAgICByZXR1cm4gc3RvcmVbc3RyS2V5XTtcblx0ICAgIH07XG5cblx0ICAgIHRoaXMuc2V0ID0gZnVuY3Rpb24gKHN0cktleSwgdmFsKSB7XG5cdCAgICAgIHN0b3JlW3N0cktleV0gPSB2YWw7XG5cdCAgICAgIHJldHVybiB0aGlzO1xuXHQgICAgfTtcblxuXHQgICAgdGhpcy5jbGVhciA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgc3RvcmUgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHQgICAgfTtcblx0ICB9O1xuXHR9XG5cblx0ZnVuY3Rpb24gX3R5cGVvZihvYmopIHtcblx0ICBcIkBiYWJlbC9oZWxwZXJzIC0gdHlwZW9mXCI7XG5cblx0ICBpZiAodHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIpIHtcblx0ICAgIF90eXBlb2YgPSBmdW5jdGlvbiAob2JqKSB7XG5cdCAgICAgIHJldHVybiB0eXBlb2Ygb2JqO1xuXHQgICAgfTtcblx0ICB9IGVsc2Uge1xuXHQgICAgX3R5cGVvZiA9IGZ1bmN0aW9uIChvYmopIHtcblx0ICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb2JqLmNvbnN0cnVjdG9yID09PSBTeW1ib2wgJiYgb2JqICE9PSBTeW1ib2wucHJvdG90eXBlID8gXCJzeW1ib2xcIiA6IHR5cGVvZiBvYmo7XG5cdCAgICB9O1xuXHQgIH1cblxuXHQgIHJldHVybiBfdHlwZW9mKG9iaik7XG5cdH1cblxuXHRmdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7XG5cdCAgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHtcblx0ICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIik7XG5cdCAgfVxuXHR9XG5cblx0ZnVuY3Rpb24gX2RlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykge1xuXHQgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHtcblx0ICAgIHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07XG5cdCAgICBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7XG5cdCAgICBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7XG5cdCAgICBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlO1xuXHQgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpO1xuXHQgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIF9jcmVhdGVDbGFzcyhDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHtcblx0ICBpZiAocHJvdG9Qcm9wcykgX2RlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTtcblx0ICBpZiAoc3RhdGljUHJvcHMpIF9kZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7XG5cdCAgcmV0dXJuIENvbnN0cnVjdG9yO1xuXHR9XG5cblx0ZnVuY3Rpb24gX3RvQ29uc3VtYWJsZUFycmF5KGFycikge1xuXHQgIHJldHVybiBfYXJyYXlXaXRob3V0SG9sZXMoYXJyKSB8fCBfaXRlcmFibGVUb0FycmF5KGFycikgfHwgX3Vuc3VwcG9ydGVkSXRlcmFibGVUb0FycmF5KGFycikgfHwgX25vbkl0ZXJhYmxlU3ByZWFkKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBfYXJyYXlXaXRob3V0SG9sZXMoYXJyKSB7XG5cdCAgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkgcmV0dXJuIF9hcnJheUxpa2VUb0FycmF5KGFycik7XG5cdH1cblxuXHRmdW5jdGlvbiBfaXRlcmFibGVUb0FycmF5KGl0ZXIpIHtcblx0ICBpZiAodHlwZW9mIFN5bWJvbCAhPT0gXCJ1bmRlZmluZWRcIiAmJiBTeW1ib2wuaXRlcmF0b3IgaW4gT2JqZWN0KGl0ZXIpKSByZXR1cm4gQXJyYXkuZnJvbShpdGVyKTtcblx0fVxuXG5cdGZ1bmN0aW9uIF91bnN1cHBvcnRlZEl0ZXJhYmxlVG9BcnJheShvLCBtaW5MZW4pIHtcblx0ICBpZiAoIW8pIHJldHVybjtcblx0ICBpZiAodHlwZW9mIG8gPT09IFwic3RyaW5nXCIpIHJldHVybiBfYXJyYXlMaWtlVG9BcnJheShvLCBtaW5MZW4pO1xuXHQgIHZhciBuID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pLnNsaWNlKDgsIC0xKTtcblx0ICBpZiAobiA9PT0gXCJPYmplY3RcIiAmJiBvLmNvbnN0cnVjdG9yKSBuID0gby5jb25zdHJ1Y3Rvci5uYW1lO1xuXHQgIGlmIChuID09PSBcIk1hcFwiIHx8IG4gPT09IFwiU2V0XCIpIHJldHVybiBBcnJheS5mcm9tKG8pO1xuXHQgIGlmIChuID09PSBcIkFyZ3VtZW50c1wiIHx8IC9eKD86VWl8SSludCg/Ojh8MTZ8MzIpKD86Q2xhbXBlZCk/QXJyYXkkLy50ZXN0KG4pKSByZXR1cm4gX2FycmF5TGlrZVRvQXJyYXkobywgbWluTGVuKTtcblx0fVxuXG5cdGZ1bmN0aW9uIF9hcnJheUxpa2VUb0FycmF5KGFyciwgbGVuKSB7XG5cdCAgaWYgKGxlbiA9PSBudWxsIHx8IGxlbiA+IGFyci5sZW5ndGgpIGxlbiA9IGFyci5sZW5ndGg7XG5cblx0ICBmb3IgKHZhciBpID0gMCwgYXJyMiA9IG5ldyBBcnJheShsZW4pOyBpIDwgbGVuOyBpKyspIGFycjJbaV0gPSBhcnJbaV07XG5cblx0ICByZXR1cm4gYXJyMjtcblx0fVxuXG5cdGZ1bmN0aW9uIF9ub25JdGVyYWJsZVNwcmVhZCgpIHtcblx0ICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBhdHRlbXB0IHRvIHNwcmVhZCBub24taXRlcmFibGUgaW5zdGFuY2UuXFxuSW4gb3JkZXIgdG8gYmUgaXRlcmFibGUsIG5vbi1hcnJheSBvYmplY3RzIG11c3QgaGF2ZSBhIFtTeW1ib2wuaXRlcmF0b3JdKCkgbWV0aG9kLlwiKTtcblx0fVxuXG5cdGZ1bmN0aW9uIF9jcmVhdGVGb3JPZkl0ZXJhdG9ySGVscGVyKG8sIGFsbG93QXJyYXlMaWtlKSB7XG5cdCAgdmFyIGl0O1xuXG5cdCAgaWYgKHR5cGVvZiBTeW1ib2wgPT09IFwidW5kZWZpbmVkXCIgfHwgb1tTeW1ib2wuaXRlcmF0b3JdID09IG51bGwpIHtcblx0ICAgIGlmIChBcnJheS5pc0FycmF5KG8pIHx8IChpdCA9IF91bnN1cHBvcnRlZEl0ZXJhYmxlVG9BcnJheShvKSkgfHwgYWxsb3dBcnJheUxpa2UgJiYgbyAmJiB0eXBlb2Ygby5sZW5ndGggPT09IFwibnVtYmVyXCIpIHtcblx0ICAgICAgaWYgKGl0KSBvID0gaXQ7XG5cdCAgICAgIHZhciBpID0gMDtcblxuXHQgICAgICB2YXIgRiA9IGZ1bmN0aW9uICgpIHt9O1xuXG5cdCAgICAgIHJldHVybiB7XG5cdCAgICAgICAgczogRixcblx0ICAgICAgICBuOiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICBpZiAoaSA+PSBvLmxlbmd0aCkgcmV0dXJuIHtcblx0ICAgICAgICAgICAgZG9uZTogdHJ1ZVxuXHQgICAgICAgICAgfTtcblx0ICAgICAgICAgIHJldHVybiB7XG5cdCAgICAgICAgICAgIGRvbmU6IGZhbHNlLFxuXHQgICAgICAgICAgICB2YWx1ZTogb1tpKytdXG5cdCAgICAgICAgICB9O1xuXHQgICAgICAgIH0sXG5cdCAgICAgICAgZTogZnVuY3Rpb24gKGUpIHtcblx0ICAgICAgICAgIHRocm93IGU7XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBmOiBGXG5cdCAgICAgIH07XG5cdCAgICB9XG5cblx0ICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGF0dGVtcHQgdG8gaXRlcmF0ZSBub24taXRlcmFibGUgaW5zdGFuY2UuXFxuSW4gb3JkZXIgdG8gYmUgaXRlcmFibGUsIG5vbi1hcnJheSBvYmplY3RzIG11c3QgaGF2ZSBhIFtTeW1ib2wuaXRlcmF0b3JdKCkgbWV0aG9kLlwiKTtcblx0ICB9XG5cblx0ICB2YXIgbm9ybWFsQ29tcGxldGlvbiA9IHRydWUsXG5cdCAgICAgIGRpZEVyciA9IGZhbHNlLFxuXHQgICAgICBlcnI7XG5cdCAgcmV0dXJuIHtcblx0ICAgIHM6IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgaXQgPSBvW1N5bWJvbC5pdGVyYXRvcl0oKTtcblx0ICAgIH0sXG5cdCAgICBuOiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHZhciBzdGVwID0gaXQubmV4dCgpO1xuXHQgICAgICBub3JtYWxDb21wbGV0aW9uID0gc3RlcC5kb25lO1xuXHQgICAgICByZXR1cm4gc3RlcDtcblx0ICAgIH0sXG5cdCAgICBlOiBmdW5jdGlvbiAoZSkge1xuXHQgICAgICBkaWRFcnIgPSB0cnVlO1xuXHQgICAgICBlcnIgPSBlO1xuXHQgICAgfSxcblx0ICAgIGY6IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgdHJ5IHtcblx0ICAgICAgICBpZiAoIW5vcm1hbENvbXBsZXRpb24gJiYgaXQucmV0dXJuICE9IG51bGwpIGl0LnJldHVybigpO1xuXHQgICAgICB9IGZpbmFsbHkge1xuXHQgICAgICAgIGlmIChkaWRFcnIpIHRocm93IGVycjtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH07XG5cdH1cblxuXHQvLyBUaGlzIGFsbG93cyBzdXBwb3J0IGZvciBJRSA5LCB3aGljaCBkb2Vzbid0IGhhdmUgYSBjb25zb2xlXG5cdC8vIG9iamVjdCBpZiB0aGUgZGV2ZWxvcGVyIHRvb2xzIGFyZSBub3Qgb3Blbi5cblxuXHR2YXIgTG9nZ2VyID0ge1xuXHQgIHdhcm46IGNvbnNvbGUgPyBjb25zb2xlLndhcm4uYmluZChjb25zb2xlKSA6IGZ1bmN0aW9uICgpIHt9XG5cdH07XG5cblx0dmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblx0dmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cdHZhciBub3cgPSBEYXRlLm5vdyB8fCBmdW5jdGlvbiAoKSB7XG5cdCAgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuXHR9O1xuXHR2YXIgaGFzUGVyZm9ybWFuY2VBcGkgPSBkZXRlY3RQZXJmb3JtYW5jZUFwaSgpO1xuXHR2YXIgcGVyZm9ybWFuY2UgPSBoYXNQZXJmb3JtYW5jZUFwaSA/IHdpbmRvdyQxLnBlcmZvcm1hbmNlIDogdW5kZWZpbmVkO1xuXHR2YXIgcGVyZm9ybWFuY2VOb3cgPSBoYXNQZXJmb3JtYW5jZUFwaSA/IHBlcmZvcm1hbmNlLm5vdy5iaW5kKHBlcmZvcm1hbmNlKSA6IG5vdztcblxuXHRmdW5jdGlvbiBkZXRlY3RQZXJmb3JtYW5jZUFwaSgpIHtcblx0ICByZXR1cm4gd2luZG93JDEgJiYgdHlwZW9mIHdpbmRvdyQxLnBlcmZvcm1hbmNlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiB3aW5kb3ckMS5wZXJmb3JtYW5jZS5tYXJrID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIHdpbmRvdyQxLnBlcmZvcm1hbmNlLm1lYXN1cmUgPT09IFwiZnVuY3Rpb25cIjtcblx0fVxuXG5cdGZ1bmN0aW9uIG1lYXN1cmUoY29tbWVudCwgc3RhcnRNYXJrLCBlbmRNYXJrKSB7XG5cdCAgLy8gYHBlcmZvcm1hbmNlLm1lYXN1cmVgIG1heSBmYWlsIGlmIHRoZSBtYXJrIGNvdWxkIG5vdCBiZSBmb3VuZC5cblx0ICAvLyByZWFzb25zIGEgc3BlY2lmaWMgbWFyayBjb3VsZCBub3QgYmUgZm91bmQgaW5jbHVkZTogb3V0c2lkZSBjb2RlIGludm9raW5nIGBwZXJmb3JtYW5jZS5jbGVhck1hcmtzKClgXG5cdCAgdHJ5IHtcblx0ICAgIHBlcmZvcm1hbmNlLm1lYXN1cmUoY29tbWVudCwgc3RhcnRNYXJrLCBlbmRNYXJrKTtcblx0ICB9IGNhdGNoIChleCkge1xuXHQgICAgTG9nZ2VyLndhcm4oXCJwZXJmb3JtYW5jZS5tZWFzdXJlIGNvdWxkIG5vdCBiZSBleGVjdXRlZCBiZWNhdXNlIG9mIFwiLCBleC5tZXNzYWdlKTtcblx0ICB9XG5cdH1cblx0dmFyIGRlZmluZWQgPSB7XG5cdCAgZG9jdW1lbnQ6IHdpbmRvdyQxICYmIHdpbmRvdyQxLmRvY3VtZW50ICE9PSB1bmRlZmluZWQsXG5cdCAgc2V0VGltZW91dDogc2V0VGltZW91dCQxICE9PSB1bmRlZmluZWRcblx0fTsgLy8gUmV0dXJucyBhIG5ldyBBcnJheSB3aXRoIHRoZSBlbGVtZW50cyB0aGF0IGFyZSBpbiBhIGJ1dCBub3QgaW4gYlxuXG5cdGZ1bmN0aW9uIGRpZmYoYSwgYikge1xuXHQgIHZhciBpLFxuXHQgICAgICBqLFxuXHQgICAgICByZXN1bHQgPSBhLnNsaWNlKCk7XG5cblx0ICBmb3IgKGkgPSAwOyBpIDwgcmVzdWx0Lmxlbmd0aDsgaSsrKSB7XG5cdCAgICBmb3IgKGogPSAwOyBqIDwgYi5sZW5ndGg7IGorKykge1xuXHQgICAgICBpZiAocmVzdWx0W2ldID09PSBiW2pdKSB7XG5cdCAgICAgICAgcmVzdWx0LnNwbGljZShpLCAxKTtcblx0ICAgICAgICBpLS07XG5cdCAgICAgICAgYnJlYWs7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gcmVzdWx0O1xuXHR9XG5cdC8qKlxuXHQgKiBEZXRlcm1pbmVzIHdoZXRoZXIgYW4gZWxlbWVudCBleGlzdHMgaW4gYSBnaXZlbiBhcnJheSBvciBub3QuXG5cdCAqXG5cdCAqIEBtZXRob2QgaW5BcnJheVxuXHQgKiBAcGFyYW0ge0FueX0gZWxlbVxuXHQgKiBAcGFyYW0ge0FycmF5fSBhcnJheVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufVxuXHQgKi9cblxuXHRmdW5jdGlvbiBpbkFycmF5KGVsZW0sIGFycmF5KSB7XG5cdCAgcmV0dXJuIGFycmF5LmluZGV4T2YoZWxlbSkgIT09IC0xO1xuXHR9XG5cdC8qKlxuXHQgKiBNYWtlcyBhIGNsb25lIG9mIGFuIG9iamVjdCB1c2luZyBvbmx5IEFycmF5IG9yIE9iamVjdCBhcyBiYXNlLFxuXHQgKiBhbmQgY29waWVzIG92ZXIgdGhlIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcblx0ICogQHJldHVybiB7T2JqZWN0fSBOZXcgb2JqZWN0IHdpdGggb25seSB0aGUgb3duIHByb3BlcnRpZXMgKHJlY3Vyc2l2ZWx5KS5cblx0ICovXG5cblx0ZnVuY3Rpb24gb2JqZWN0VmFsdWVzKG9iaikge1xuXHQgIHZhciBrZXksXG5cdCAgICAgIHZhbCxcblx0ICAgICAgdmFscyA9IGlzKFwiYXJyYXlcIiwgb2JqKSA/IFtdIDoge307XG5cblx0ICBmb3IgKGtleSBpbiBvYmopIHtcblx0ICAgIGlmIChoYXNPd24uY2FsbChvYmosIGtleSkpIHtcblx0ICAgICAgdmFsID0gb2JqW2tleV07XG5cdCAgICAgIHZhbHNba2V5XSA9IHZhbCA9PT0gT2JqZWN0KHZhbCkgPyBvYmplY3RWYWx1ZXModmFsKSA6IHZhbDtcblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gdmFscztcblx0fVxuXHRmdW5jdGlvbiBleHRlbmQoYSwgYiwgdW5kZWZPbmx5KSB7XG5cdCAgZm9yICh2YXIgcHJvcCBpbiBiKSB7XG5cdCAgICBpZiAoaGFzT3duLmNhbGwoYiwgcHJvcCkpIHtcblx0ICAgICAgaWYgKGJbcHJvcF0gPT09IHVuZGVmaW5lZCkge1xuXHQgICAgICAgIGRlbGV0ZSBhW3Byb3BdO1xuXHQgICAgICB9IGVsc2UgaWYgKCEodW5kZWZPbmx5ICYmIHR5cGVvZiBhW3Byb3BdICE9PSBcInVuZGVmaW5lZFwiKSkge1xuXHQgICAgICAgIGFbcHJvcF0gPSBiW3Byb3BdO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGE7XG5cdH1cblx0ZnVuY3Rpb24gb2JqZWN0VHlwZShvYmopIHtcblx0ICBpZiAodHlwZW9mIG9iaiA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHQgICAgcmV0dXJuIFwidW5kZWZpbmVkXCI7XG5cdCAgfSAvLyBDb25zaWRlcjogdHlwZW9mIG51bGwgPT09IG9iamVjdFxuXG5cblx0ICBpZiAob2JqID09PSBudWxsKSB7XG5cdCAgICByZXR1cm4gXCJudWxsXCI7XG5cdCAgfVxuXG5cdCAgdmFyIG1hdGNoID0gdG9TdHJpbmcuY2FsbChvYmopLm1hdGNoKC9eXFxbb2JqZWN0XFxzKC4qKVxcXSQvKSxcblx0ICAgICAgdHlwZSA9IG1hdGNoICYmIG1hdGNoWzFdO1xuXG5cdCAgc3dpdGNoICh0eXBlKSB7XG5cdCAgICBjYXNlIFwiTnVtYmVyXCI6XG5cdCAgICAgIGlmIChpc05hTihvYmopKSB7XG5cdCAgICAgICAgcmV0dXJuIFwibmFuXCI7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gXCJudW1iZXJcIjtcblxuXHQgICAgY2FzZSBcIlN0cmluZ1wiOlxuXHQgICAgY2FzZSBcIkJvb2xlYW5cIjpcblx0ICAgIGNhc2UgXCJBcnJheVwiOlxuXHQgICAgY2FzZSBcIlNldFwiOlxuXHQgICAgY2FzZSBcIk1hcFwiOlxuXHQgICAgY2FzZSBcIkRhdGVcIjpcblx0ICAgIGNhc2UgXCJSZWdFeHBcIjpcblx0ICAgIGNhc2UgXCJGdW5jdGlvblwiOlxuXHQgICAgY2FzZSBcIlN5bWJvbFwiOlxuXHQgICAgICByZXR1cm4gdHlwZS50b0xvd2VyQ2FzZSgpO1xuXG5cdCAgICBkZWZhdWx0OlxuXHQgICAgICByZXR1cm4gX3R5cGVvZihvYmopO1xuXHQgIH1cblx0fSAvLyBTYWZlIG9iamVjdCB0eXBlIGNoZWNraW5nXG5cblx0ZnVuY3Rpb24gaXModHlwZSwgb2JqKSB7XG5cdCAgcmV0dXJuIG9iamVjdFR5cGUob2JqKSA9PT0gdHlwZTtcblx0fSAvLyBCYXNlZCBvbiBKYXZhJ3MgU3RyaW5nLmhhc2hDb2RlLCBhIHNpbXBsZSBidXQgbm90XG5cdC8vIHJpZ29yb3VzbHkgY29sbGlzaW9uIHJlc2lzdGFudCBoYXNoaW5nIGZ1bmN0aW9uXG5cblx0ZnVuY3Rpb24gZ2VuZXJhdGVIYXNoKG1vZHVsZSwgdGVzdE5hbWUpIHtcblx0ICB2YXIgc3RyID0gbW9kdWxlICsgXCJcXHgxQ1wiICsgdGVzdE5hbWU7XG5cdCAgdmFyIGhhc2ggPSAwO1xuXG5cdCAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcblx0ICAgIGhhc2ggPSAoaGFzaCA8PCA1KSAtIGhhc2ggKyBzdHIuY2hhckNvZGVBdChpKTtcblx0ICAgIGhhc2ggfD0gMDtcblx0ICB9IC8vIENvbnZlcnQgdGhlIHBvc3NpYmx5IG5lZ2F0aXZlIGludGVnZXIgaGFzaCBjb2RlIGludG8gYW4gOCBjaGFyYWN0ZXIgaGV4IHN0cmluZywgd2hpY2ggaXNuJ3Rcblx0ICAvLyBzdHJpY3RseSBuZWNlc3NhcnkgYnV0IGluY3JlYXNlcyB1c2VyIHVuZGVyc3RhbmRpbmcgdGhhdCB0aGUgaWQgaXMgYSBTSEEtbGlrZSBoYXNoXG5cblxuXHQgIHZhciBoZXggPSAoMHgxMDAwMDAwMDAgKyBoYXNoKS50b1N0cmluZygxNik7XG5cblx0ICBpZiAoaGV4Lmxlbmd0aCA8IDgpIHtcblx0ICAgIGhleCA9IFwiMDAwMDAwMFwiICsgaGV4O1xuXHQgIH1cblxuXHQgIHJldHVybiBoZXguc2xpY2UoLTgpO1xuXHR9XG5cblx0Ly8gQXV0aG9yczogUGhpbGlwcGUgUmF0aMOpIDxwcmF0aGVAZ21haWwuY29tPiwgRGF2aWQgQ2hhbiA8ZGF2aWRAdHJvaS5vcmc+XG5cblx0dmFyIGVxdWl2ID0gKGZ1bmN0aW9uICgpIHtcblx0ICAvLyBWYWx1ZSBwYWlycyBxdWV1ZWQgZm9yIGNvbXBhcmlzb24uIFVzZWQgZm9yIGJyZWFkdGgtZmlyc3QgcHJvY2Vzc2luZyBvcmRlciwgcmVjdXJzaW9uXG5cdCAgLy8gZGV0ZWN0aW9uIGFuZCBhdm9pZGluZyByZXBlYXRlZCBjb21wYXJpc29uIChzZWUgYmVsb3cgZm9yIGRldGFpbHMpLlxuXHQgIC8vIEVsZW1lbnRzIGFyZSB7IGE6IHZhbCwgYjogdmFsIH0uXG5cdCAgdmFyIHBhaXJzID0gW107XG5cblx0ICB2YXIgZ2V0UHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YgfHwgZnVuY3Rpb24gKG9iaikge1xuXHQgICAgcmV0dXJuIG9iai5fX3Byb3RvX187XG5cdCAgfTtcblxuXHQgIGZ1bmN0aW9uIHVzZVN0cmljdEVxdWFsaXR5KGEsIGIpIHtcblx0ICAgIC8vIFRoaXMgb25seSBnZXRzIGNhbGxlZCBpZiBhIGFuZCBiIGFyZSBub3Qgc3RyaWN0IGVxdWFsLCBhbmQgaXMgdXNlZCB0byBjb21wYXJlIG9uXG5cdCAgICAvLyB0aGUgcHJpbWl0aXZlIHZhbHVlcyBpbnNpZGUgb2JqZWN0IHdyYXBwZXJzLiBGb3IgZXhhbXBsZTpcblx0ICAgIC8vIGB2YXIgaSA9IDE7YFxuXHQgICAgLy8gYHZhciBqID0gbmV3IE51bWJlcigxKTtgXG5cdCAgICAvLyBOZWl0aGVyIGEgbm9yIGIgY2FuIGJlIG51bGwsIGFzIGEgIT09IGIgYW5kIHRoZXkgaGF2ZSB0aGUgc2FtZSB0eXBlLlxuXHQgICAgaWYgKF90eXBlb2YoYSkgPT09IFwib2JqZWN0XCIpIHtcblx0ICAgICAgYSA9IGEudmFsdWVPZigpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoX3R5cGVvZihiKSA9PT0gXCJvYmplY3RcIikge1xuXHQgICAgICBiID0gYi52YWx1ZU9mKCk7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBhID09PSBiO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGNvbXBhcmVDb25zdHJ1Y3RvcnMoYSwgYikge1xuXHQgICAgdmFyIHByb3RvQSA9IGdldFByb3RvKGEpO1xuXHQgICAgdmFyIHByb3RvQiA9IGdldFByb3RvKGIpOyAvLyBDb21wYXJpbmcgY29uc3RydWN0b3JzIGlzIG1vcmUgc3RyaWN0IHRoYW4gdXNpbmcgYGluc3RhbmNlb2ZgXG5cblx0ICAgIGlmIChhLmNvbnN0cnVjdG9yID09PSBiLmNvbnN0cnVjdG9yKSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfSAvLyBSZWYgIzg1MVxuXHQgICAgLy8gSWYgdGhlIG9iaiBwcm90b3R5cGUgZGVzY2VuZHMgZnJvbSBhIG51bGwgY29uc3RydWN0b3IsIHRyZWF0IGl0XG5cdCAgICAvLyBhcyBhIG51bGwgcHJvdG90eXBlLlxuXG5cblx0ICAgIGlmIChwcm90b0EgJiYgcHJvdG9BLmNvbnN0cnVjdG9yID09PSBudWxsKSB7XG5cdCAgICAgIHByb3RvQSA9IG51bGw7XG5cdCAgICB9XG5cblx0ICAgIGlmIChwcm90b0IgJiYgcHJvdG9CLmNvbnN0cnVjdG9yID09PSBudWxsKSB7XG5cdCAgICAgIHByb3RvQiA9IG51bGw7XG5cdCAgICB9IC8vIEFsbG93IG9iamVjdHMgd2l0aCBubyBwcm90b3R5cGUgdG8gYmUgZXF1aXZhbGVudCB0b1xuXHQgICAgLy8gb2JqZWN0cyB3aXRoIE9iamVjdCBhcyB0aGVpciBjb25zdHJ1Y3Rvci5cblxuXG5cdCAgICBpZiAocHJvdG9BID09PSBudWxsICYmIHByb3RvQiA9PT0gT2JqZWN0LnByb3RvdHlwZSB8fCBwcm90b0IgPT09IG51bGwgJiYgcHJvdG9BID09PSBPYmplY3QucHJvdG90eXBlKSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gZmFsc2U7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gZ2V0UmVnRXhwRmxhZ3MocmVnZXhwKSB7XG5cdCAgICByZXR1cm4gXCJmbGFnc1wiIGluIHJlZ2V4cCA/IHJlZ2V4cC5mbGFncyA6IHJlZ2V4cC50b1N0cmluZygpLm1hdGNoKC9bZ2ltdXldKiQvKVswXTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBpc0NvbnRhaW5lcih2YWwpIHtcblx0ICAgIHJldHVybiBbXCJvYmplY3RcIiwgXCJhcnJheVwiLCBcIm1hcFwiLCBcInNldFwiXS5pbmRleE9mKG9iamVjdFR5cGUodmFsKSkgIT09IC0xO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGJyZWFkdGhGaXJzdENvbXBhcmVDaGlsZChhLCBiKSB7XG5cdCAgICAvLyBJZiBhIGlzIGEgY29udGFpbmVyIG5vdCByZWZlcmVuY2UtZXF1YWwgdG8gYiwgcG9zdHBvbmUgdGhlIGNvbXBhcmlzb24gdG8gdGhlXG5cdCAgICAvLyBlbmQgb2YgdGhlIHBhaXJzIHF1ZXVlIC0tIHVubGVzcyAoYSwgYikgaGFzIGJlZW4gc2VlbiBiZWZvcmUsIGluIHdoaWNoIGNhc2Ugc2tpcFxuXHQgICAgLy8gb3ZlciB0aGUgcGFpci5cblx0ICAgIGlmIChhID09PSBiKSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoIWlzQ29udGFpbmVyKGEpKSB7XG5cdCAgICAgIHJldHVybiB0eXBlRXF1aXYoYSwgYik7XG5cdCAgICB9XG5cblx0ICAgIGlmIChwYWlycy5ldmVyeShmdW5jdGlvbiAocGFpcikge1xuXHQgICAgICByZXR1cm4gcGFpci5hICE9PSBhIHx8IHBhaXIuYiAhPT0gYjtcblx0ICAgIH0pKSB7XG5cdCAgICAgIC8vIE5vdCB5ZXQgc3RhcnRlZCBjb21wYXJpbmcgdGhpcyBwYWlyXG5cdCAgICAgIHBhaXJzLnB1c2goe1xuXHQgICAgICAgIGE6IGEsXG5cdCAgICAgICAgYjogYlxuXHQgICAgICB9KTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHRydWU7XG5cdCAgfVxuXG5cdCAgdmFyIGNhbGxiYWNrcyA9IHtcblx0ICAgIFwic3RyaW5nXCI6IHVzZVN0cmljdEVxdWFsaXR5LFxuXHQgICAgXCJib29sZWFuXCI6IHVzZVN0cmljdEVxdWFsaXR5LFxuXHQgICAgXCJudW1iZXJcIjogdXNlU3RyaWN0RXF1YWxpdHksXG5cdCAgICBcIm51bGxcIjogdXNlU3RyaWN0RXF1YWxpdHksXG5cdCAgICBcInVuZGVmaW5lZFwiOiB1c2VTdHJpY3RFcXVhbGl0eSxcblx0ICAgIFwic3ltYm9sXCI6IHVzZVN0cmljdEVxdWFsaXR5LFxuXHQgICAgXCJkYXRlXCI6IHVzZVN0cmljdEVxdWFsaXR5LFxuXHQgICAgXCJuYW5cIjogZnVuY3Rpb24gbmFuKCkge1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH0sXG5cdCAgICBcInJlZ2V4cFwiOiBmdW5jdGlvbiByZWdleHAoYSwgYikge1xuXHQgICAgICByZXR1cm4gYS5zb3VyY2UgPT09IGIuc291cmNlICYmIC8vIEluY2x1ZGUgZmxhZ3MgaW4gdGhlIGNvbXBhcmlzb25cblx0ICAgICAgZ2V0UmVnRXhwRmxhZ3MoYSkgPT09IGdldFJlZ0V4cEZsYWdzKGIpO1xuXHQgICAgfSxcblx0ICAgIC8vIGFib3J0IChpZGVudGljYWwgcmVmZXJlbmNlcyAvIGluc3RhbmNlIG1ldGhvZHMgd2VyZSBza2lwcGVkIGVhcmxpZXIpXG5cdCAgICBcImZ1bmN0aW9uXCI6IGZ1bmN0aW9uIF9mdW5jdGlvbigpIHtcblx0ICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgfSxcblx0ICAgIFwiYXJyYXlcIjogZnVuY3Rpb24gYXJyYXkoYSwgYikge1xuXHQgICAgICB2YXIgaSwgbGVuO1xuXHQgICAgICBsZW4gPSBhLmxlbmd0aDtcblxuXHQgICAgICBpZiAobGVuICE9PSBiLmxlbmd0aCkge1xuXHQgICAgICAgIC8vIFNhZmUgYW5kIGZhc3RlclxuXHQgICAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuXHQgICAgICAgIC8vIENvbXBhcmUgbm9uLWNvbnRhaW5lcnM7IHF1ZXVlIG5vbi1yZWZlcmVuY2UtZXF1YWwgY29udGFpbmVyc1xuXHQgICAgICAgIGlmICghYnJlYWR0aEZpcnN0Q29tcGFyZUNoaWxkKGFbaV0sIGJbaV0pKSB7XG5cdCAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9LFxuXHQgICAgLy8gRGVmaW5lIHNldHMgYSBhbmQgYiB0byBiZSBlcXVpdmFsZW50IGlmIGZvciBlYWNoIGVsZW1lbnQgYVZhbCBpbiBhLCB0aGVyZVxuXHQgICAgLy8gaXMgc29tZSBlbGVtZW50IGJWYWwgaW4gYiBzdWNoIHRoYXQgYVZhbCBhbmQgYlZhbCBhcmUgZXF1aXZhbGVudC4gRWxlbWVudFxuXHQgICAgLy8gcmVwZXRpdGlvbnMgYXJlIG5vdCBjb3VudGVkLCBzbyB0aGVzZSBhcmUgZXF1aXZhbGVudDpcblx0ICAgIC8vIGEgPSBuZXcgU2V0KCBbIHt9LCBbXSwgW10gXSApO1xuXHQgICAgLy8gYiA9IG5ldyBTZXQoIFsge30sIHt9LCBbXSBdICk7XG5cdCAgICBcInNldFwiOiBmdW5jdGlvbiBzZXQoYSwgYikge1xuXHQgICAgICB2YXIgaW5uZXJFcSxcblx0ICAgICAgICAgIG91dGVyRXEgPSB0cnVlO1xuXG5cdCAgICAgIGlmIChhLnNpemUgIT09IGIuc2l6ZSkge1xuXHQgICAgICAgIC8vIFRoaXMgb3B0aW1pemF0aW9uIGhhcyBjZXJ0YWluIHF1aXJrcyBiZWNhdXNlIG9mIHRoZSBsYWNrIG9mXG5cdCAgICAgICAgLy8gcmVwZXRpdGlvbiBjb3VudGluZy4gRm9yIGluc3RhbmNlLCBhZGRpbmcgdGhlIHNhbWVcblx0ICAgICAgICAvLyAocmVmZXJlbmNlLWlkZW50aWNhbCkgZWxlbWVudCB0byB0d28gZXF1aXZhbGVudCBzZXRzIGNhblxuXHQgICAgICAgIC8vIG1ha2UgdGhlbSBub24tZXF1aXZhbGVudC5cblx0ICAgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICAgIH1cblxuXHQgICAgICBhLmZvckVhY2goZnVuY3Rpb24gKGFWYWwpIHtcblx0ICAgICAgICAvLyBTaG9ydC1jaXJjdWl0IGlmIHRoZSByZXN1bHQgaXMgYWxyZWFkeSBrbm93bi4gKFVzaW5nIGZvci4uLm9mXG5cdCAgICAgICAgLy8gd2l0aCBhIGJyZWFrIGNsYXVzZSB3b3VsZCBiZSBjbGVhbmVyIGhlcmUsIGJ1dCBpdCB3b3VsZCBjYXVzZVxuXHQgICAgICAgIC8vIGEgc3ludGF4IGVycm9yIG9uIG9sZGVyIEphdmFzY3JpcHQgaW1wbGVtZW50YXRpb25zIGV2ZW4gaWZcblx0ICAgICAgICAvLyBTZXQgaXMgdW51c2VkKVxuXHQgICAgICAgIGlmICghb3V0ZXJFcSkge1xuXHQgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGlubmVyRXEgPSBmYWxzZTtcblx0ICAgICAgICBiLmZvckVhY2goZnVuY3Rpb24gKGJWYWwpIHtcblx0ICAgICAgICAgIHZhciBwYXJlbnRQYWlyczsgLy8gTGlrZXdpc2UsIHNob3J0LWNpcmN1aXQgaWYgdGhlIHJlc3VsdCBpcyBhbHJlYWR5IGtub3duXG5cblx0ICAgICAgICAgIGlmIChpbm5lckVxKSB7XG5cdCAgICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICAgIH0gLy8gU3dhcCBvdXQgdGhlIGdsb2JhbCBwYWlycyBsaXN0LCBhcyB0aGUgbmVzdGVkIGNhbGwgdG9cblx0ICAgICAgICAgIC8vIGlubmVyRXF1aXYgd2lsbCBjbG9iYmVyIGl0cyBjb250ZW50c1xuXG5cblx0ICAgICAgICAgIHBhcmVudFBhaXJzID0gcGFpcnM7XG5cblx0ICAgICAgICAgIGlmIChpbm5lckVxdWl2KGJWYWwsIGFWYWwpKSB7XG5cdCAgICAgICAgICAgIGlubmVyRXEgPSB0cnVlO1xuXHQgICAgICAgICAgfSAvLyBSZXBsYWNlIHRoZSBnbG9iYWwgcGFpcnMgbGlzdFxuXG5cblx0ICAgICAgICAgIHBhaXJzID0gcGFyZW50UGFpcnM7XG5cdCAgICAgICAgfSk7XG5cblx0ICAgICAgICBpZiAoIWlubmVyRXEpIHtcblx0ICAgICAgICAgIG91dGVyRXEgPSBmYWxzZTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0pO1xuXHQgICAgICByZXR1cm4gb3V0ZXJFcTtcblx0ICAgIH0sXG5cdCAgICAvLyBEZWZpbmUgbWFwcyBhIGFuZCBiIHRvIGJlIGVxdWl2YWxlbnQgaWYgZm9yIGVhY2gga2V5LXZhbHVlIHBhaXIgKGFLZXksIGFWYWwpXG5cdCAgICAvLyBpbiBhLCB0aGVyZSBpcyBzb21lIGtleS12YWx1ZSBwYWlyIChiS2V5LCBiVmFsKSBpbiBiIHN1Y2ggdGhhdFxuXHQgICAgLy8gWyBhS2V5LCBhVmFsIF0gYW5kIFsgYktleSwgYlZhbCBdIGFyZSBlcXVpdmFsZW50LiBLZXkgcmVwZXRpdGlvbnMgYXJlIG5vdFxuXHQgICAgLy8gY291bnRlZCwgc28gdGhlc2UgYXJlIGVxdWl2YWxlbnQ6XG5cdCAgICAvLyBhID0gbmV3IE1hcCggWyBbIHt9LCAxIF0sIFsge30sIDEgXSwgWyBbXSwgMSBdIF0gKTtcblx0ICAgIC8vIGIgPSBuZXcgTWFwKCBbIFsge30sIDEgXSwgWyBbXSwgMSBdLCBbIFtdLCAxIF0gXSApO1xuXHQgICAgXCJtYXBcIjogZnVuY3Rpb24gbWFwKGEsIGIpIHtcblx0ICAgICAgdmFyIGlubmVyRXEsXG5cdCAgICAgICAgICBvdXRlckVxID0gdHJ1ZTtcblxuXHQgICAgICBpZiAoYS5zaXplICE9PSBiLnNpemUpIHtcblx0ICAgICAgICAvLyBUaGlzIG9wdGltaXphdGlvbiBoYXMgY2VydGFpbiBxdWlya3MgYmVjYXVzZSBvZiB0aGUgbGFjayBvZlxuXHQgICAgICAgIC8vIHJlcGV0aXRpb24gY291bnRpbmcuIEZvciBpbnN0YW5jZSwgYWRkaW5nIHRoZSBzYW1lXG5cdCAgICAgICAgLy8gKHJlZmVyZW5jZS1pZGVudGljYWwpIGtleS12YWx1ZSBwYWlyIHRvIHR3byBlcXVpdmFsZW50IG1hcHNcblx0ICAgICAgICAvLyBjYW4gbWFrZSB0aGVtIG5vbi1lcXVpdmFsZW50LlxuXHQgICAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGEuZm9yRWFjaChmdW5jdGlvbiAoYVZhbCwgYUtleSkge1xuXHQgICAgICAgIC8vIFNob3J0LWNpcmN1aXQgaWYgdGhlIHJlc3VsdCBpcyBhbHJlYWR5IGtub3duLiAoVXNpbmcgZm9yLi4ub2Zcblx0ICAgICAgICAvLyB3aXRoIGEgYnJlYWsgY2xhdXNlIHdvdWxkIGJlIGNsZWFuZXIgaGVyZSwgYnV0IGl0IHdvdWxkIGNhdXNlXG5cdCAgICAgICAgLy8gYSBzeW50YXggZXJyb3Igb24gb2xkZXIgSmF2YXNjcmlwdCBpbXBsZW1lbnRhdGlvbnMgZXZlbiBpZlxuXHQgICAgICAgIC8vIE1hcCBpcyB1bnVzZWQpXG5cdCAgICAgICAgaWYgKCFvdXRlckVxKSB7XG5cdCAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaW5uZXJFcSA9IGZhbHNlO1xuXHQgICAgICAgIGIuZm9yRWFjaChmdW5jdGlvbiAoYlZhbCwgYktleSkge1xuXHQgICAgICAgICAgdmFyIHBhcmVudFBhaXJzOyAvLyBMaWtld2lzZSwgc2hvcnQtY2lyY3VpdCBpZiB0aGUgcmVzdWx0IGlzIGFscmVhZHkga25vd25cblxuXHQgICAgICAgICAgaWYgKGlubmVyRXEpIHtcblx0ICAgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgICAgfSAvLyBTd2FwIG91dCB0aGUgZ2xvYmFsIHBhaXJzIGxpc3QsIGFzIHRoZSBuZXN0ZWQgY2FsbCB0b1xuXHQgICAgICAgICAgLy8gaW5uZXJFcXVpdiB3aWxsIGNsb2JiZXIgaXRzIGNvbnRlbnRzXG5cblxuXHQgICAgICAgICAgcGFyZW50UGFpcnMgPSBwYWlycztcblxuXHQgICAgICAgICAgaWYgKGlubmVyRXF1aXYoW2JWYWwsIGJLZXldLCBbYVZhbCwgYUtleV0pKSB7XG5cdCAgICAgICAgICAgIGlubmVyRXEgPSB0cnVlO1xuXHQgICAgICAgICAgfSAvLyBSZXBsYWNlIHRoZSBnbG9iYWwgcGFpcnMgbGlzdFxuXG5cblx0ICAgICAgICAgIHBhaXJzID0gcGFyZW50UGFpcnM7XG5cdCAgICAgICAgfSk7XG5cblx0ICAgICAgICBpZiAoIWlubmVyRXEpIHtcblx0ICAgICAgICAgIG91dGVyRXEgPSBmYWxzZTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0pO1xuXHQgICAgICByZXR1cm4gb3V0ZXJFcTtcblx0ICAgIH0sXG5cdCAgICBcIm9iamVjdFwiOiBmdW5jdGlvbiBvYmplY3QoYSwgYikge1xuXHQgICAgICB2YXIgaSxcblx0ICAgICAgICAgIGFQcm9wZXJ0aWVzID0gW10sXG5cdCAgICAgICAgICBiUHJvcGVydGllcyA9IFtdO1xuXG5cdCAgICAgIGlmIChjb21wYXJlQ29uc3RydWN0b3JzKGEsIGIpID09PSBmYWxzZSkge1xuXHQgICAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgICAgfSAvLyBCZSBzdHJpY3Q6IGRvbid0IGVuc3VyZSBoYXNPd25Qcm9wZXJ0eSBhbmQgZ28gZGVlcFxuXG5cblx0ICAgICAgZm9yIChpIGluIGEpIHtcblx0ICAgICAgICAvLyBDb2xsZWN0IGEncyBwcm9wZXJ0aWVzXG5cdCAgICAgICAgYVByb3BlcnRpZXMucHVzaChpKTsgLy8gU2tpcCBPT1AgbWV0aG9kcyB0aGF0IGxvb2sgdGhlIHNhbWVcblxuXHQgICAgICAgIGlmIChhLmNvbnN0cnVjdG9yICE9PSBPYmplY3QgJiYgdHlwZW9mIGEuY29uc3RydWN0b3IgIT09IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mIGFbaV0gPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgYltpXSA9PT0gXCJmdW5jdGlvblwiICYmIGFbaV0udG9TdHJpbmcoKSA9PT0gYltpXS50b1N0cmluZygpKSB7XG5cdCAgICAgICAgICBjb250aW51ZTtcblx0ICAgICAgICB9IC8vIENvbXBhcmUgbm9uLWNvbnRhaW5lcnM7IHF1ZXVlIG5vbi1yZWZlcmVuY2UtZXF1YWwgY29udGFpbmVyc1xuXG5cblx0ICAgICAgICBpZiAoIWJyZWFkdGhGaXJzdENvbXBhcmVDaGlsZChhW2ldLCBiW2ldKSkge1xuXHQgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIGZvciAoaSBpbiBiKSB7XG5cdCAgICAgICAgLy8gQ29sbGVjdCBiJ3MgcHJvcGVydGllc1xuXHQgICAgICAgIGJQcm9wZXJ0aWVzLnB1c2goaSk7XG5cdCAgICAgIH0gLy8gRW5zdXJlcyBpZGVudGljYWwgcHJvcGVydGllcyBuYW1lXG5cblxuXHQgICAgICByZXR1cm4gdHlwZUVxdWl2KGFQcm9wZXJ0aWVzLnNvcnQoKSwgYlByb3BlcnRpZXMuc29ydCgpKTtcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgZnVuY3Rpb24gdHlwZUVxdWl2KGEsIGIpIHtcblx0ICAgIHZhciB0eXBlID0gb2JqZWN0VHlwZShhKTsgLy8gQ2FsbGJhY2tzIGZvciBjb250YWluZXJzIHdpbGwgYXBwZW5kIHRvIHRoZSBwYWlycyBxdWV1ZSB0byBhY2hpZXZlIGJyZWFkdGgtZmlyc3Rcblx0ICAgIC8vIHNlYXJjaCBvcmRlci4gVGhlIHBhaXJzIHF1ZXVlIGlzIGFsc28gdXNlZCB0byBhdm9pZCByZXByb2Nlc3NpbmcgYW55IHBhaXIgb2Zcblx0ICAgIC8vIGNvbnRhaW5lcnMgdGhhdCBhcmUgcmVmZXJlbmNlLWVxdWFsIHRvIGEgcHJldmlvdXNseSB2aXNpdGVkIHBhaXIgKGEgc3BlY2lhbCBjYXNlXG5cdCAgICAvLyB0aGlzIGJlaW5nIHJlY3Vyc2lvbiBkZXRlY3Rpb24pLlxuXHQgICAgLy9cblx0ICAgIC8vIEJlY2F1c2Ugb2YgdGhpcyBhcHByb2FjaCwgb25jZSB0eXBlRXF1aXYgcmV0dXJucyBhIGZhbHNlIHZhbHVlLCBpdCBzaG91bGQgbm90IGJlXG5cdCAgICAvLyBjYWxsZWQgYWdhaW4gd2l0aG91dCBjbGVhcmluZyB0aGUgcGFpciBxdWV1ZSBlbHNlIGl0IG1heSB3cm9uZ2x5IHJlcG9ydCBhIHZpc2l0ZWRcblx0ICAgIC8vIHBhaXIgYXMgYmVpbmcgZXF1aXZhbGVudC5cblxuXHQgICAgcmV0dXJuIG9iamVjdFR5cGUoYikgPT09IHR5cGUgJiYgY2FsbGJhY2tzW3R5cGVdKGEsIGIpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGlubmVyRXF1aXYoYSwgYikge1xuXHQgICAgdmFyIGksIHBhaXI7IC8vIFdlJ3JlIGRvbmUgd2hlbiB0aGVyZSdzIG5vdGhpbmcgbW9yZSB0byBjb21wYXJlXG5cblx0ICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH0gLy8gQ2xlYXIgdGhlIGdsb2JhbCBwYWlyIHF1ZXVlIGFuZCBhZGQgdGhlIHRvcC1sZXZlbCB2YWx1ZXMgYmVpbmcgY29tcGFyZWRcblxuXG5cdCAgICBwYWlycyA9IFt7XG5cdCAgICAgIGE6IGEsXG5cdCAgICAgIGI6IGJcblx0ICAgIH1dO1xuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgcGFpcnMubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgcGFpciA9IHBhaXJzW2ldOyAvLyBQZXJmb3JtIHR5cGUtc3BlY2lmaWMgY29tcGFyaXNvbiBvbiBhbnkgcGFpcnMgdGhhdCBhcmUgbm90IHN0cmljdGx5XG5cdCAgICAgIC8vIGVxdWFsLiBGb3IgY29udGFpbmVyIHR5cGVzLCB0aGF0IGNvbXBhcmlzb24gd2lsbCBwb3N0cG9uZSBjb21wYXJpc29uXG5cdCAgICAgIC8vIG9mIGFueSBzdWItY29udGFpbmVyIHBhaXIgdG8gdGhlIGVuZCBvZiB0aGUgcGFpciBxdWV1ZS4gVGhpcyBnaXZlc1xuXHQgICAgICAvLyBicmVhZHRoLWZpcnN0IHNlYXJjaCBvcmRlci4gSXQgYWxzbyBhdm9pZHMgdGhlIHJlcHJvY2Vzc2luZyBvZlxuXHQgICAgICAvLyByZWZlcmVuY2UtZXF1YWwgc2libGluZ3MsIGNvdXNpbnMgZXRjLCB3aGljaCBjYW4gaGF2ZSBhIHNpZ25pZmljYW50IHNwZWVkXG5cdCAgICAgIC8vIGltcGFjdCB3aGVuIGNvbXBhcmluZyBhIGNvbnRhaW5lciBvZiBzbWFsbCBvYmplY3RzIGVhY2ggb2Ygd2hpY2ggaGFzIGFcblx0ICAgICAgLy8gcmVmZXJlbmNlIHRvIHRoZSBzYW1lIChzaW5nbGV0b24pIGxhcmdlIG9iamVjdC5cblxuXHQgICAgICBpZiAocGFpci5hICE9PSBwYWlyLmIgJiYgIXR5cGVFcXVpdihwYWlyLmEsIHBhaXIuYikpIHtcblx0ICAgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICAgIH1cblx0ICAgIH0gLy8gLi4uYWNyb3NzIGFsbCBjb25zZWN1dGl2ZSBhcmd1bWVudCBwYWlyc1xuXG5cblx0ICAgIHJldHVybiBhcmd1bWVudHMubGVuZ3RoID09PSAyIHx8IGlubmVyRXF1aXYuYXBwbHkodGhpcywgW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcblx0ICB9XG5cblx0ICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXHQgICAgdmFyIHJlc3VsdCA9IGlubmVyRXF1aXYuYXBwbHkodm9pZCAwLCBhcmd1bWVudHMpOyAvLyBSZWxlYXNlIGFueSByZXRhaW5lZCBvYmplY3RzXG5cblx0ICAgIHBhaXJzLmxlbmd0aCA9IDA7XG5cdCAgICByZXR1cm4gcmVzdWx0O1xuXHQgIH07XG5cdH0pKCk7XG5cblx0LyoqXG5cdCAqIENvbmZpZyBvYmplY3Q6IE1haW50YWluIGludGVybmFsIHN0YXRlXG5cdCAqIExhdGVyIGV4cG9zZWQgYXMgUVVuaXQuY29uZmlnXG5cdCAqIGBjb25maWdgIGluaXRpYWxpemVkIGF0IHRvcCBvZiBzY29wZVxuXHQgKi9cblxuXHR2YXIgY29uZmlnID0ge1xuXHQgIC8vIFRoZSBxdWV1ZSBvZiB0ZXN0cyB0byBydW5cblx0ICBxdWV1ZTogW10sXG5cdCAgLy8gQmxvY2sgdW50aWwgZG9jdW1lbnQgcmVhZHlcblx0ICBibG9ja2luZzogdHJ1ZSxcblx0ICAvLyBCeSBkZWZhdWx0LCBydW4gcHJldmlvdXNseSBmYWlsZWQgdGVzdHMgZmlyc3Rcblx0ICAvLyB2ZXJ5IHVzZWZ1bCBpbiBjb21iaW5hdGlvbiB3aXRoIFwiSGlkZSBwYXNzZWQgdGVzdHNcIiBjaGVja2VkXG5cdCAgcmVvcmRlcjogdHJ1ZSxcblx0ICAvLyBCeSBkZWZhdWx0LCBtb2RpZnkgZG9jdW1lbnQudGl0bGUgd2hlbiBzdWl0ZSBpcyBkb25lXG5cdCAgYWx0ZXJ0aXRsZTogdHJ1ZSxcblx0ICAvLyBIVE1MIFJlcG9ydGVyOiBjb2xsYXBzZSBldmVyeSB0ZXN0IGV4Y2VwdCB0aGUgZmlyc3QgZmFpbGluZyB0ZXN0XG5cdCAgLy8gSWYgZmFsc2UsIGFsbCBmYWlsaW5nIHRlc3RzIHdpbGwgYmUgZXhwYW5kZWRcblx0ICBjb2xsYXBzZTogdHJ1ZSxcblx0ICAvLyBCeSBkZWZhdWx0LCBzY3JvbGwgdG8gdG9wIG9mIHRoZSBwYWdlIHdoZW4gc3VpdGUgaXMgZG9uZVxuXHQgIHNjcm9sbHRvcDogdHJ1ZSxcblx0ICAvLyBEZXB0aCB1cC10byB3aGljaCBvYmplY3Qgd2lsbCBiZSBkdW1wZWRcblx0ICBtYXhEZXB0aDogNSxcblx0ICAvLyBXaGVuIGVuYWJsZWQsIGFsbCB0ZXN0cyBtdXN0IGNhbGwgZXhwZWN0KClcblx0ICByZXF1aXJlRXhwZWN0czogZmFsc2UsXG5cdCAgLy8gUGxhY2Vob2xkZXIgZm9yIHVzZXItY29uZmlndXJhYmxlIGZvcm0tZXhwb3NlZCBVUkwgcGFyYW1ldGVyc1xuXHQgIHVybENvbmZpZzogW10sXG5cdCAgLy8gU2V0IG9mIGFsbCBtb2R1bGVzLlxuXHQgIG1vZHVsZXM6IFtdLFxuXHQgIC8vIFRoZSBmaXJzdCB1bm5hbWVkIG1vZHVsZVxuXHQgIGN1cnJlbnRNb2R1bGU6IHtcblx0ICAgIG5hbWU6IFwiXCIsXG5cdCAgICB0ZXN0czogW10sXG5cdCAgICBjaGlsZE1vZHVsZXM6IFtdLFxuXHQgICAgdGVzdHNSdW46IDAsXG5cdCAgICB1bnNraXBwZWRUZXN0c1J1bjogMCxcblx0ICAgIGhvb2tzOiB7XG5cdCAgICAgIGJlZm9yZTogW10sXG5cdCAgICAgIGJlZm9yZUVhY2g6IFtdLFxuXHQgICAgICBhZnRlckVhY2g6IFtdLFxuXHQgICAgICBhZnRlcjogW11cblx0ICAgIH1cblx0ICB9LFxuXHQgIGNhbGxiYWNrczoge30sXG5cdCAgLy8gVGhlIHN0b3JhZ2UgbW9kdWxlIHRvIHVzZSBmb3IgcmVvcmRlcmluZyB0ZXN0c1xuXHQgIHN0b3JhZ2U6IGxvY2FsU2Vzc2lvblN0b3JhZ2Vcblx0fTsgLy8gdGFrZSBhIHByZWRlZmluZWQgUVVuaXQuY29uZmlnIGFuZCBleHRlbmQgdGhlIGRlZmF1bHRzXG5cblx0dmFyIGdsb2JhbENvbmZpZyA9IHdpbmRvdyQxICYmIHdpbmRvdyQxLlFVbml0ICYmIHdpbmRvdyQxLlFVbml0LmNvbmZpZzsgLy8gb25seSBleHRlbmQgdGhlIGdsb2JhbCBjb25maWcgaWYgdGhlcmUgaXMgbm8gUVVuaXQgb3ZlcmxvYWRcblxuXHRpZiAod2luZG93JDEgJiYgd2luZG93JDEuUVVuaXQgJiYgIXdpbmRvdyQxLlFVbml0LnZlcnNpb24pIHtcblx0ICBleHRlbmQoY29uZmlnLCBnbG9iYWxDb25maWcpO1xuXHR9IC8vIFB1c2ggYSBsb29zZSB1bm5hbWVkIG1vZHVsZSB0byB0aGUgbW9kdWxlcyBjb2xsZWN0aW9uXG5cblxuXHRjb25maWcubW9kdWxlcy5wdXNoKGNvbmZpZy5jdXJyZW50TW9kdWxlKTtcblxuXHQvLyBodHRwczovL2ZsZXNsZXIuYmxvZ3Nwb3QuY29tLzIwMDgvMDUvanNkdW1wLXByZXR0eS1kdW1wLW9mLWFueS1qYXZhc2NyaXB0Lmh0bWxcblxuXHR2YXIgZHVtcCA9IChmdW5jdGlvbiAoKSB7XG5cdCAgZnVuY3Rpb24gcXVvdGUoc3RyKSB7XG5cdCAgICByZXR1cm4gXCJcXFwiXCIgKyBzdHIudG9TdHJpbmcoKS5yZXBsYWNlKC9cXFxcL2csIFwiXFxcXFxcXFxcIikucmVwbGFjZSgvXCIvZywgXCJcXFxcXFxcIlwiKSArIFwiXFxcIlwiO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGxpdGVyYWwobykge1xuXHQgICAgcmV0dXJuIG8gKyBcIlwiO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGpvaW4ocHJlLCBhcnIsIHBvc3QpIHtcblx0ICAgIHZhciBzID0gZHVtcC5zZXBhcmF0b3IoKSxcblx0ICAgICAgICBiYXNlID0gZHVtcC5pbmRlbnQoKSxcblx0ICAgICAgICBpbm5lciA9IGR1bXAuaW5kZW50KDEpO1xuXG5cdCAgICBpZiAoYXJyLmpvaW4pIHtcblx0ICAgICAgYXJyID0gYXJyLmpvaW4oXCIsXCIgKyBzICsgaW5uZXIpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoIWFycikge1xuXHQgICAgICByZXR1cm4gcHJlICsgcG9zdDtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIFtwcmUsIGlubmVyICsgYXJyLCBiYXNlICsgcG9zdF0uam9pbihzKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhcnJheShhcnIsIHN0YWNrKSB7XG5cdCAgICB2YXIgaSA9IGFyci5sZW5ndGgsXG5cdCAgICAgICAgcmV0ID0gbmV3IEFycmF5KGkpO1xuXG5cdCAgICBpZiAoZHVtcC5tYXhEZXB0aCAmJiBkdW1wLmRlcHRoID4gZHVtcC5tYXhEZXB0aCkge1xuXHQgICAgICByZXR1cm4gXCJbb2JqZWN0IEFycmF5XVwiO1xuXHQgICAgfVxuXG5cdCAgICB0aGlzLnVwKCk7XG5cblx0ICAgIHdoaWxlIChpLS0pIHtcblx0ICAgICAgcmV0W2ldID0gdGhpcy5wYXJzZShhcnJbaV0sIHVuZGVmaW5lZCwgc3RhY2spO1xuXHQgICAgfVxuXG5cdCAgICB0aGlzLmRvd24oKTtcblx0ICAgIHJldHVybiBqb2luKFwiW1wiLCByZXQsIFwiXVwiKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBpc0FycmF5KG9iaikge1xuXHQgICAgcmV0dXJuICgvL05hdGl2ZSBBcnJheXNcblx0ICAgICAgdG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCIgfHwgLy8gTm9kZUxpc3Qgb2JqZWN0c1xuXHQgICAgICB0eXBlb2Ygb2JqLmxlbmd0aCA9PT0gXCJudW1iZXJcIiAmJiBvYmouaXRlbSAhPT0gdW5kZWZpbmVkICYmIChvYmoubGVuZ3RoID8gb2JqLml0ZW0oMCkgPT09IG9ialswXSA6IG9iai5pdGVtKDApID09PSBudWxsICYmIG9ialswXSA9PT0gdW5kZWZpbmVkKVxuXHQgICAgKTtcblx0ICB9XG5cblx0ICB2YXIgcmVOYW1lID0gL15mdW5jdGlvbiAoXFx3KykvLFxuXHQgICAgICBkdW1wID0ge1xuXHQgICAgLy8gVGhlIG9ialR5cGUgaXMgdXNlZCBtb3N0bHkgaW50ZXJuYWxseSwgeW91IGNhbiBmaXggYSAoY3VzdG9tKSB0eXBlIGluIGFkdmFuY2Vcblx0ICAgIHBhcnNlOiBmdW5jdGlvbiBwYXJzZShvYmosIG9ialR5cGUsIHN0YWNrKSB7XG5cdCAgICAgIHN0YWNrID0gc3RhY2sgfHwgW107XG5cdCAgICAgIHZhciByZXMsXG5cdCAgICAgICAgICBwYXJzZXIsXG5cdCAgICAgICAgICBwYXJzZXJUeXBlLFxuXHQgICAgICAgICAgb2JqSW5kZXggPSBzdGFjay5pbmRleE9mKG9iaik7XG5cblx0ICAgICAgaWYgKG9iakluZGV4ICE9PSAtMSkge1xuXHQgICAgICAgIHJldHVybiBcInJlY3Vyc2lvbihcIi5jb25jYXQob2JqSW5kZXggLSBzdGFjay5sZW5ndGgsIFwiKVwiKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIG9ialR5cGUgPSBvYmpUeXBlIHx8IHRoaXMudHlwZU9mKG9iaik7XG5cdCAgICAgIHBhcnNlciA9IHRoaXMucGFyc2Vyc1tvYmpUeXBlXTtcblx0ICAgICAgcGFyc2VyVHlwZSA9IF90eXBlb2YocGFyc2VyKTtcblxuXHQgICAgICBpZiAocGFyc2VyVHlwZSA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdCAgICAgICAgc3RhY2sucHVzaChvYmopO1xuXHQgICAgICAgIHJlcyA9IHBhcnNlci5jYWxsKHRoaXMsIG9iaiwgc3RhY2spO1xuXHQgICAgICAgIHN0YWNrLnBvcCgpO1xuXHQgICAgICAgIHJldHVybiByZXM7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gcGFyc2VyVHlwZSA9PT0gXCJzdHJpbmdcIiA/IHBhcnNlciA6IHRoaXMucGFyc2Vycy5lcnJvcjtcblx0ICAgIH0sXG5cdCAgICB0eXBlT2Y6IGZ1bmN0aW9uIHR5cGVPZihvYmopIHtcblx0ICAgICAgdmFyIHR5cGU7XG5cblx0ICAgICAgaWYgKG9iaiA9PT0gbnVsbCkge1xuXHQgICAgICAgIHR5cGUgPSBcIm51bGxcIjtcblx0ICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb2JqID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdCAgICAgICAgdHlwZSA9IFwidW5kZWZpbmVkXCI7XG5cdCAgICAgIH0gZWxzZSBpZiAoaXMoXCJyZWdleHBcIiwgb2JqKSkge1xuXHQgICAgICAgIHR5cGUgPSBcInJlZ2V4cFwiO1xuXHQgICAgICB9IGVsc2UgaWYgKGlzKFwiZGF0ZVwiLCBvYmopKSB7XG5cdCAgICAgICAgdHlwZSA9IFwiZGF0ZVwiO1xuXHQgICAgICB9IGVsc2UgaWYgKGlzKFwiZnVuY3Rpb25cIiwgb2JqKSkge1xuXHQgICAgICAgIHR5cGUgPSBcImZ1bmN0aW9uXCI7XG5cdCAgICAgIH0gZWxzZSBpZiAob2JqLnNldEludGVydmFsICE9PSB1bmRlZmluZWQgJiYgb2JqLmRvY3VtZW50ICE9PSB1bmRlZmluZWQgJiYgb2JqLm5vZGVUeXBlID09PSB1bmRlZmluZWQpIHtcblx0ICAgICAgICB0eXBlID0gXCJ3aW5kb3dcIjtcblx0ICAgICAgfSBlbHNlIGlmIChvYmoubm9kZVR5cGUgPT09IDkpIHtcblx0ICAgICAgICB0eXBlID0gXCJkb2N1bWVudFwiO1xuXHQgICAgICB9IGVsc2UgaWYgKG9iai5ub2RlVHlwZSkge1xuXHQgICAgICAgIHR5cGUgPSBcIm5vZGVcIjtcblx0ICAgICAgfSBlbHNlIGlmIChpc0FycmF5KG9iaikpIHtcblx0ICAgICAgICB0eXBlID0gXCJhcnJheVwiO1xuXHQgICAgICB9IGVsc2UgaWYgKG9iai5jb25zdHJ1Y3RvciA9PT0gRXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yKSB7XG5cdCAgICAgICAgdHlwZSA9IFwiZXJyb3JcIjtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICB0eXBlID0gX3R5cGVvZihvYmopO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIHR5cGU7XG5cdCAgICB9LFxuXHQgICAgc2VwYXJhdG9yOiBmdW5jdGlvbiBzZXBhcmF0b3IoKSB7XG5cdCAgICAgIGlmICh0aGlzLm11bHRpbGluZSkge1xuXHQgICAgICAgIHJldHVybiB0aGlzLkhUTUwgPyBcIjxiciAvPlwiIDogXCJcXG5cIjtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICByZXR1cm4gdGhpcy5IVE1MID8gXCImIzE2MDtcIiA6IFwiIFwiO1xuXHQgICAgICB9XG5cdCAgICB9LFxuXHQgICAgLy8gRXh0cmEgY2FuIGJlIGEgbnVtYmVyLCBzaG9ydGN1dCBmb3IgaW5jcmVhc2luZy1jYWxsaW5nLWRlY3JlYXNpbmdcblx0ICAgIGluZGVudDogZnVuY3Rpb24gaW5kZW50KGV4dHJhKSB7XG5cdCAgICAgIGlmICghdGhpcy5tdWx0aWxpbmUpIHtcblx0ICAgICAgICByZXR1cm4gXCJcIjtcblx0ICAgICAgfVxuXG5cdCAgICAgIHZhciBjaHIgPSB0aGlzLmluZGVudENoYXI7XG5cblx0ICAgICAgaWYgKHRoaXMuSFRNTCkge1xuXHQgICAgICAgIGNociA9IGNoci5yZXBsYWNlKC9cXHQvZywgXCIgICBcIikucmVwbGFjZSgvIC9nLCBcIiYjMTYwO1wiKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBuZXcgQXJyYXkodGhpcy5kZXB0aCArIChleHRyYSB8fCAwKSkuam9pbihjaHIpO1xuXHQgICAgfSxcblx0ICAgIHVwOiBmdW5jdGlvbiB1cChhKSB7XG5cdCAgICAgIHRoaXMuZGVwdGggKz0gYSB8fCAxO1xuXHQgICAgfSxcblx0ICAgIGRvd246IGZ1bmN0aW9uIGRvd24oYSkge1xuXHQgICAgICB0aGlzLmRlcHRoIC09IGEgfHwgMTtcblx0ICAgIH0sXG5cdCAgICBzZXRQYXJzZXI6IGZ1bmN0aW9uIHNldFBhcnNlcihuYW1lLCBwYXJzZXIpIHtcblx0ICAgICAgdGhpcy5wYXJzZXJzW25hbWVdID0gcGFyc2VyO1xuXHQgICAgfSxcblx0ICAgIC8vIFRoZSBuZXh0IDMgYXJlIGV4cG9zZWQgc28geW91IGNhbiB1c2UgdGhlbVxuXHQgICAgcXVvdGU6IHF1b3RlLFxuXHQgICAgbGl0ZXJhbDogbGl0ZXJhbCxcblx0ICAgIGpvaW46IGpvaW4sXG5cdCAgICBkZXB0aDogMSxcblx0ICAgIG1heERlcHRoOiBjb25maWcubWF4RGVwdGgsXG5cdCAgICAvLyBUaGlzIGlzIHRoZSBsaXN0IG9mIHBhcnNlcnMsIHRvIG1vZGlmeSB0aGVtLCB1c2UgZHVtcC5zZXRQYXJzZXJcblx0ICAgIHBhcnNlcnM6IHtcblx0ICAgICAgd2luZG93OiBcIltXaW5kb3ddXCIsXG5cdCAgICAgIGRvY3VtZW50OiBcIltEb2N1bWVudF1cIixcblx0ICAgICAgZXJyb3I6IGZ1bmN0aW9uIGVycm9yKF9lcnJvcikge1xuXHQgICAgICAgIHJldHVybiBcIkVycm9yKFxcXCJcIiArIF9lcnJvci5tZXNzYWdlICsgXCJcXFwiKVwiO1xuXHQgICAgICB9LFxuXHQgICAgICB1bmtub3duOiBcIltVbmtub3duXVwiLFxuXHQgICAgICBcIm51bGxcIjogXCJudWxsXCIsXG5cdCAgICAgIFwidW5kZWZpbmVkXCI6IFwidW5kZWZpbmVkXCIsXG5cdCAgICAgIFwiZnVuY3Rpb25cIjogZnVuY3Rpb24gX2Z1bmN0aW9uKGZuKSB7XG5cdCAgICAgICAgdmFyIHJldCA9IFwiZnVuY3Rpb25cIixcblx0ICAgICAgICAgICAgLy8gRnVuY3Rpb25zIG5ldmVyIGhhdmUgbmFtZSBpbiBJRVxuXHQgICAgICAgIG5hbWUgPSBcIm5hbWVcIiBpbiBmbiA/IGZuLm5hbWUgOiAocmVOYW1lLmV4ZWMoZm4pIHx8IFtdKVsxXTtcblxuXHQgICAgICAgIGlmIChuYW1lKSB7XG5cdCAgICAgICAgICByZXQgKz0gXCIgXCIgKyBuYW1lO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHJldCArPSBcIihcIjtcblx0ICAgICAgICByZXQgPSBbcmV0LCBkdW1wLnBhcnNlKGZuLCBcImZ1bmN0aW9uQXJnc1wiKSwgXCIpe1wiXS5qb2luKFwiXCIpO1xuXHQgICAgICAgIHJldHVybiBqb2luKHJldCwgZHVtcC5wYXJzZShmbiwgXCJmdW5jdGlvbkNvZGVcIiksIFwifVwiKTtcblx0ICAgICAgfSxcblx0ICAgICAgYXJyYXk6IGFycmF5LFxuXHQgICAgICBub2RlbGlzdDogYXJyYXksXG5cdCAgICAgIFwiYXJndW1lbnRzXCI6IGFycmF5LFxuXHQgICAgICBvYmplY3Q6IGZ1bmN0aW9uIG9iamVjdChtYXAsIHN0YWNrKSB7XG5cdCAgICAgICAgdmFyIGtleXMsXG5cdCAgICAgICAgICAgIGtleSxcblx0ICAgICAgICAgICAgdmFsLFxuXHQgICAgICAgICAgICBpLFxuXHQgICAgICAgICAgICBub25FbnVtZXJhYmxlUHJvcGVydGllcyxcblx0ICAgICAgICAgICAgcmV0ID0gW107XG5cblx0ICAgICAgICBpZiAoZHVtcC5tYXhEZXB0aCAmJiBkdW1wLmRlcHRoID4gZHVtcC5tYXhEZXB0aCkge1xuXHQgICAgICAgICAgcmV0dXJuIFwiW29iamVjdCBPYmplY3RdXCI7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgZHVtcC51cCgpO1xuXHQgICAgICAgIGtleXMgPSBbXTtcblxuXHQgICAgICAgIGZvciAoa2V5IGluIG1hcCkge1xuXHQgICAgICAgICAga2V5cy5wdXNoKGtleSk7XG5cdCAgICAgICAgfSAvLyBTb21lIHByb3BlcnRpZXMgYXJlIG5vdCBhbHdheXMgZW51bWVyYWJsZSBvbiBFcnJvciBvYmplY3RzLlxuXG5cblx0ICAgICAgICBub25FbnVtZXJhYmxlUHJvcGVydGllcyA9IFtcIm1lc3NhZ2VcIiwgXCJuYW1lXCJdO1xuXG5cdCAgICAgICAgZm9yIChpIGluIG5vbkVudW1lcmFibGVQcm9wZXJ0aWVzKSB7XG5cdCAgICAgICAgICBrZXkgPSBub25FbnVtZXJhYmxlUHJvcGVydGllc1tpXTtcblxuXHQgICAgICAgICAgaWYgKGtleSBpbiBtYXAgJiYgIWluQXJyYXkoa2V5LCBrZXlzKSkge1xuXHQgICAgICAgICAgICBrZXlzLnB1c2goa2V5KTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cblx0ICAgICAgICBrZXlzLnNvcnQoKTtcblxuXHQgICAgICAgIGZvciAoaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICBrZXkgPSBrZXlzW2ldO1xuXHQgICAgICAgICAgdmFsID0gbWFwW2tleV07XG5cdCAgICAgICAgICByZXQucHVzaChkdW1wLnBhcnNlKGtleSwgXCJrZXlcIikgKyBcIjogXCIgKyBkdW1wLnBhcnNlKHZhbCwgdW5kZWZpbmVkLCBzdGFjaykpO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGR1bXAuZG93bigpO1xuXHQgICAgICAgIHJldHVybiBqb2luKFwie1wiLCByZXQsIFwifVwiKTtcblx0ICAgICAgfSxcblx0ICAgICAgbm9kZTogZnVuY3Rpb24gbm9kZShfbm9kZSkge1xuXHQgICAgICAgIHZhciBsZW4sXG5cdCAgICAgICAgICAgIGksXG5cdCAgICAgICAgICAgIHZhbCxcblx0ICAgICAgICAgICAgb3BlbiA9IGR1bXAuSFRNTCA/IFwiJmx0O1wiIDogXCI8XCIsXG5cdCAgICAgICAgICAgIGNsb3NlID0gZHVtcC5IVE1MID8gXCImZ3Q7XCIgOiBcIj5cIixcblx0ICAgICAgICAgICAgdGFnID0gX25vZGUubm9kZU5hbWUudG9Mb3dlckNhc2UoKSxcblx0ICAgICAgICAgICAgcmV0ID0gb3BlbiArIHRhZyxcblx0ICAgICAgICAgICAgYXR0cnMgPSBfbm9kZS5hdHRyaWJ1dGVzO1xuXG5cdCAgICAgICAgaWYgKGF0dHJzKSB7XG5cdCAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBhdHRycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHQgICAgICAgICAgICB2YWwgPSBhdHRyc1tpXS5ub2RlVmFsdWU7IC8vIElFNiBpbmNsdWRlcyBhbGwgYXR0cmlidXRlcyBpbiAuYXR0cmlidXRlcywgZXZlbiBvbmVzIG5vdCBleHBsaWNpdGx5XG5cdCAgICAgICAgICAgIC8vIHNldC4gVGhvc2UgaGF2ZSB2YWx1ZXMgbGlrZSB1bmRlZmluZWQsIG51bGwsIDAsIGZhbHNlLCBcIlwiIG9yXG5cdCAgICAgICAgICAgIC8vIFwiaW5oZXJpdFwiLlxuXG5cdCAgICAgICAgICAgIGlmICh2YWwgJiYgdmFsICE9PSBcImluaGVyaXRcIikge1xuXHQgICAgICAgICAgICAgIHJldCArPSBcIiBcIiArIGF0dHJzW2ldLm5vZGVOYW1lICsgXCI9XCIgKyBkdW1wLnBhcnNlKHZhbCwgXCJhdHRyaWJ1dGVcIik7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cblx0ICAgICAgICByZXQgKz0gY2xvc2U7IC8vIFNob3cgY29udGVudCBvZiBUZXh0Tm9kZSBvciBDREFUQVNlY3Rpb25cblxuXHQgICAgICAgIGlmIChfbm9kZS5ub2RlVHlwZSA9PT0gMyB8fCBfbm9kZS5ub2RlVHlwZSA9PT0gNCkge1xuXHQgICAgICAgICAgcmV0ICs9IF9ub2RlLm5vZGVWYWx1ZTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICByZXR1cm4gcmV0ICsgb3BlbiArIFwiL1wiICsgdGFnICsgY2xvc2U7XG5cdCAgICAgIH0sXG5cdCAgICAgIC8vIEZ1bmN0aW9uIGNhbGxzIGl0IGludGVybmFsbHksIGl0J3MgdGhlIGFyZ3VtZW50cyBwYXJ0IG9mIHRoZSBmdW5jdGlvblxuXHQgICAgICBmdW5jdGlvbkFyZ3M6IGZ1bmN0aW9uIGZ1bmN0aW9uQXJncyhmbikge1xuXHQgICAgICAgIHZhciBhcmdzLFxuXHQgICAgICAgICAgICBsID0gZm4ubGVuZ3RoO1xuXG5cdCAgICAgICAgaWYgKCFsKSB7XG5cdCAgICAgICAgICByZXR1cm4gXCJcIjtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBhcmdzID0gbmV3IEFycmF5KGwpO1xuXG5cdCAgICAgICAgd2hpbGUgKGwtLSkge1xuXHQgICAgICAgICAgLy8gOTcgaXMgJ2EnXG5cdCAgICAgICAgICBhcmdzW2xdID0gU3RyaW5nLmZyb21DaGFyQ29kZSg5NyArIGwpO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHJldHVybiBcIiBcIiArIGFyZ3Muam9pbihcIiwgXCIpICsgXCIgXCI7XG5cdCAgICAgIH0sXG5cdCAgICAgIC8vIE9iamVjdCBjYWxscyBpdCBpbnRlcm5hbGx5LCB0aGUga2V5IHBhcnQgb2YgYW4gaXRlbSBpbiBhIG1hcFxuXHQgICAgICBrZXk6IHF1b3RlLFxuXHQgICAgICAvLyBGdW5jdGlvbiBjYWxscyBpdCBpbnRlcm5hbGx5LCBpdCdzIHRoZSBjb250ZW50IG9mIHRoZSBmdW5jdGlvblxuXHQgICAgICBmdW5jdGlvbkNvZGU6IFwiW2NvZGVdXCIsXG5cdCAgICAgIC8vIE5vZGUgY2FsbHMgaXQgaW50ZXJuYWxseSwgaXQncyBhIGh0bWwgYXR0cmlidXRlIHZhbHVlXG5cdCAgICAgIGF0dHJpYnV0ZTogcXVvdGUsXG5cdCAgICAgIHN0cmluZzogcXVvdGUsXG5cdCAgICAgIGRhdGU6IHF1b3RlLFxuXHQgICAgICByZWdleHA6IGxpdGVyYWwsXG5cdCAgICAgIG51bWJlcjogbGl0ZXJhbCxcblx0ICAgICAgXCJib29sZWFuXCI6IGxpdGVyYWwsXG5cdCAgICAgIHN5bWJvbDogZnVuY3Rpb24gc3ltYm9sKHN5bSkge1xuXHQgICAgICAgIHJldHVybiBzeW0udG9TdHJpbmcoKTtcblx0ICAgICAgfVxuXHQgICAgfSxcblx0ICAgIC8vIElmIHRydWUsIGVudGl0aWVzIGFyZSBlc2NhcGVkICggPCwgPiwgXFx0LCBzcGFjZSBhbmQgXFxuIClcblx0ICAgIEhUTUw6IGZhbHNlLFxuXHQgICAgLy8gSW5kZW50YXRpb24gdW5pdFxuXHQgICAgaW5kZW50Q2hhcjogXCIgIFwiLFxuXHQgICAgLy8gSWYgdHJ1ZSwgaXRlbXMgaW4gYSBjb2xsZWN0aW9uLCBhcmUgc2VwYXJhdGVkIGJ5IGEgXFxuLCBlbHNlIGp1c3QgYSBzcGFjZS5cblx0ICAgIG11bHRpbGluZTogdHJ1ZVxuXHQgIH07XG5cdCAgcmV0dXJuIGR1bXA7XG5cdH0pKCk7XG5cblx0dmFyIFN1aXRlUmVwb3J0ID0gLyojX19QVVJFX18qL2Z1bmN0aW9uICgpIHtcblx0ICBmdW5jdGlvbiBTdWl0ZVJlcG9ydChuYW1lLCBwYXJlbnRTdWl0ZSkge1xuXHQgICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFN1aXRlUmVwb3J0KTtcblxuXHQgICAgdGhpcy5uYW1lID0gbmFtZTtcblx0ICAgIHRoaXMuZnVsbE5hbWUgPSBwYXJlbnRTdWl0ZSA/IHBhcmVudFN1aXRlLmZ1bGxOYW1lLmNvbmNhdChuYW1lKSA6IFtdO1xuXHQgICAgdGhpcy50ZXN0cyA9IFtdO1xuXHQgICAgdGhpcy5jaGlsZFN1aXRlcyA9IFtdO1xuXG5cdCAgICBpZiAocGFyZW50U3VpdGUpIHtcblx0ICAgICAgcGFyZW50U3VpdGUucHVzaENoaWxkU3VpdGUodGhpcyk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgX2NyZWF0ZUNsYXNzKFN1aXRlUmVwb3J0LCBbe1xuXHQgICAga2V5OiBcInN0YXJ0XCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gc3RhcnQocmVjb3JkVGltZSkge1xuXHQgICAgICBpZiAocmVjb3JkVGltZSkge1xuXHQgICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IHBlcmZvcm1hbmNlTm93KCk7XG5cblx0ICAgICAgICBpZiAocGVyZm9ybWFuY2UpIHtcblx0ICAgICAgICAgIHZhciBzdWl0ZUxldmVsID0gdGhpcy5mdWxsTmFtZS5sZW5ndGg7XG5cdCAgICAgICAgICBwZXJmb3JtYW5jZS5tYXJrKFwicXVuaXRfc3VpdGVfXCIuY29uY2F0KHN1aXRlTGV2ZWwsIFwiX3N0YXJ0XCIpKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4ge1xuXHQgICAgICAgIG5hbWU6IHRoaXMubmFtZSxcblx0ICAgICAgICBmdWxsTmFtZTogdGhpcy5mdWxsTmFtZS5zbGljZSgpLFxuXHQgICAgICAgIHRlc3RzOiB0aGlzLnRlc3RzLm1hcChmdW5jdGlvbiAodGVzdCkge1xuXHQgICAgICAgICAgcmV0dXJuIHRlc3Quc3RhcnQoKTtcblx0ICAgICAgICB9KSxcblx0ICAgICAgICBjaGlsZFN1aXRlczogdGhpcy5jaGlsZFN1aXRlcy5tYXAoZnVuY3Rpb24gKHN1aXRlKSB7XG5cdCAgICAgICAgICByZXR1cm4gc3VpdGUuc3RhcnQoKTtcblx0ICAgICAgICB9KSxcblx0ICAgICAgICB0ZXN0Q291bnRzOiB7XG5cdCAgICAgICAgICB0b3RhbDogdGhpcy5nZXRUZXN0Q291bnRzKCkudG90YWxcblx0ICAgICAgICB9XG5cdCAgICAgIH07XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImVuZFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGVuZChyZWNvcmRUaW1lKSB7XG5cdCAgICAgIGlmIChyZWNvcmRUaW1lKSB7XG5cdCAgICAgICAgdGhpcy5fZW5kVGltZSA9IHBlcmZvcm1hbmNlTm93KCk7XG5cblx0ICAgICAgICBpZiAocGVyZm9ybWFuY2UpIHtcblx0ICAgICAgICAgIHZhciBzdWl0ZUxldmVsID0gdGhpcy5mdWxsTmFtZS5sZW5ndGg7XG5cdCAgICAgICAgICBwZXJmb3JtYW5jZS5tYXJrKFwicXVuaXRfc3VpdGVfXCIuY29uY2F0KHN1aXRlTGV2ZWwsIFwiX2VuZFwiKSk7XG5cdCAgICAgICAgICB2YXIgc3VpdGVOYW1lID0gdGhpcy5mdWxsTmFtZS5qb2luKFwiIOKAkyBcIik7XG5cdCAgICAgICAgICBtZWFzdXJlKHN1aXRlTGV2ZWwgPT09IDAgPyBcIlFVbml0IFRlc3QgUnVuXCIgOiBcIlFVbml0IFRlc3QgU3VpdGU6IFwiLmNvbmNhdChzdWl0ZU5hbWUpLCBcInF1bml0X3N1aXRlX1wiLmNvbmNhdChzdWl0ZUxldmVsLCBcIl9zdGFydFwiKSwgXCJxdW5pdF9zdWl0ZV9cIi5jb25jYXQoc3VpdGVMZXZlbCwgXCJfZW5kXCIpKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4ge1xuXHQgICAgICAgIG5hbWU6IHRoaXMubmFtZSxcblx0ICAgICAgICBmdWxsTmFtZTogdGhpcy5mdWxsTmFtZS5zbGljZSgpLFxuXHQgICAgICAgIHRlc3RzOiB0aGlzLnRlc3RzLm1hcChmdW5jdGlvbiAodGVzdCkge1xuXHQgICAgICAgICAgcmV0dXJuIHRlc3QuZW5kKCk7XG5cdCAgICAgICAgfSksXG5cdCAgICAgICAgY2hpbGRTdWl0ZXM6IHRoaXMuY2hpbGRTdWl0ZXMubWFwKGZ1bmN0aW9uIChzdWl0ZSkge1xuXHQgICAgICAgICAgcmV0dXJuIHN1aXRlLmVuZCgpO1xuXHQgICAgICAgIH0pLFxuXHQgICAgICAgIHRlc3RDb3VudHM6IHRoaXMuZ2V0VGVzdENvdW50cygpLFxuXHQgICAgICAgIHJ1bnRpbWU6IHRoaXMuZ2V0UnVudGltZSgpLFxuXHQgICAgICAgIHN0YXR1czogdGhpcy5nZXRTdGF0dXMoKVxuXHQgICAgICB9O1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJwdXNoQ2hpbGRTdWl0ZVwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHB1c2hDaGlsZFN1aXRlKHN1aXRlKSB7XG5cdCAgICAgIHRoaXMuY2hpbGRTdWl0ZXMucHVzaChzdWl0ZSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcInB1c2hUZXN0XCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gcHVzaFRlc3QodGVzdCkge1xuXHQgICAgICB0aGlzLnRlc3RzLnB1c2godGVzdCk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImdldFJ1bnRpbWVcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRSdW50aW1lKCkge1xuXHQgICAgICByZXR1cm4gdGhpcy5fZW5kVGltZSAtIHRoaXMuX3N0YXJ0VGltZTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZ2V0VGVzdENvdW50c1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGdldFRlc3RDb3VudHMoKSB7XG5cdCAgICAgIHZhciBjb3VudHMgPSBhcmd1bWVudHMubGVuZ3RoID4gMCAmJiBhcmd1bWVudHNbMF0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1swXSA6IHtcblx0ICAgICAgICBwYXNzZWQ6IDAsXG5cdCAgICAgICAgZmFpbGVkOiAwLFxuXHQgICAgICAgIHNraXBwZWQ6IDAsXG5cdCAgICAgICAgdG9kbzogMCxcblx0ICAgICAgICB0b3RhbDogMFxuXHQgICAgICB9O1xuXHQgICAgICBjb3VudHMgPSB0aGlzLnRlc3RzLnJlZHVjZShmdW5jdGlvbiAoY291bnRzLCB0ZXN0KSB7XG5cdCAgICAgICAgaWYgKHRlc3QudmFsaWQpIHtcblx0ICAgICAgICAgIGNvdW50c1t0ZXN0LmdldFN0YXR1cygpXSsrO1xuXHQgICAgICAgICAgY291bnRzLnRvdGFsKys7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgcmV0dXJuIGNvdW50cztcblx0ICAgICAgfSwgY291bnRzKTtcblx0ICAgICAgcmV0dXJuIHRoaXMuY2hpbGRTdWl0ZXMucmVkdWNlKGZ1bmN0aW9uIChjb3VudHMsIHN1aXRlKSB7XG5cdCAgICAgICAgcmV0dXJuIHN1aXRlLmdldFRlc3RDb3VudHMoY291bnRzKTtcblx0ICAgICAgfSwgY291bnRzKTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZ2V0U3RhdHVzXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0U3RhdHVzKCkge1xuXHQgICAgICB2YXIgX3RoaXMkZ2V0VGVzdENvdW50cyA9IHRoaXMuZ2V0VGVzdENvdW50cygpLFxuXHQgICAgICAgICAgdG90YWwgPSBfdGhpcyRnZXRUZXN0Q291bnRzLnRvdGFsLFxuXHQgICAgICAgICAgZmFpbGVkID0gX3RoaXMkZ2V0VGVzdENvdW50cy5mYWlsZWQsXG5cdCAgICAgICAgICBza2lwcGVkID0gX3RoaXMkZ2V0VGVzdENvdW50cy5za2lwcGVkLFxuXHQgICAgICAgICAgdG9kbyA9IF90aGlzJGdldFRlc3RDb3VudHMudG9kbztcblxuXHQgICAgICBpZiAoZmFpbGVkKSB7XG5cdCAgICAgICAgcmV0dXJuIFwiZmFpbGVkXCI7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgaWYgKHNraXBwZWQgPT09IHRvdGFsKSB7XG5cdCAgICAgICAgICByZXR1cm4gXCJza2lwcGVkXCI7XG5cdCAgICAgICAgfSBlbHNlIGlmICh0b2RvID09PSB0b3RhbCkge1xuXHQgICAgICAgICAgcmV0dXJuIFwidG9kb1wiO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICByZXR1cm4gXCJwYXNzZWRcIjtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9XSk7XG5cblx0ICByZXR1cm4gU3VpdGVSZXBvcnQ7XG5cdH0oKTtcblxuXHR2YXIgZm9jdXNlZCA9IGZhbHNlO1xuXHR2YXIgbW9kdWxlU3RhY2sgPSBbXTtcblxuXHRmdW5jdGlvbiBpc1BhcmVudE1vZHVsZUluUXVldWUoKSB7XG5cdCAgdmFyIG1vZHVsZXNJblF1ZXVlID0gY29uZmlnLm1vZHVsZXMubWFwKGZ1bmN0aW9uIChtb2R1bGUpIHtcblx0ICAgIHJldHVybiBtb2R1bGUubW9kdWxlSWQ7XG5cdCAgfSk7XG5cdCAgcmV0dXJuIG1vZHVsZVN0YWNrLnNvbWUoZnVuY3Rpb24gKG1vZHVsZSkge1xuXHQgICAgcmV0dXJuIG1vZHVsZXNJblF1ZXVlLmluY2x1ZGVzKG1vZHVsZS5tb2R1bGVJZCk7XG5cdCAgfSk7XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVNb2R1bGUobmFtZSwgdGVzdEVudmlyb25tZW50LCBtb2RpZmllcnMpIHtcblx0ICB2YXIgcGFyZW50TW9kdWxlID0gbW9kdWxlU3RhY2subGVuZ3RoID8gbW9kdWxlU3RhY2suc2xpY2UoLTEpWzBdIDogbnVsbDtcblx0ICB2YXIgbW9kdWxlTmFtZSA9IHBhcmVudE1vZHVsZSAhPT0gbnVsbCA/IFtwYXJlbnRNb2R1bGUubmFtZSwgbmFtZV0uam9pbihcIiA+IFwiKSA6IG5hbWU7XG5cdCAgdmFyIHBhcmVudFN1aXRlID0gcGFyZW50TW9kdWxlID8gcGFyZW50TW9kdWxlLnN1aXRlUmVwb3J0IDogZ2xvYmFsU3VpdGU7XG5cdCAgdmFyIHNraXAgPSBwYXJlbnRNb2R1bGUgIT09IG51bGwgJiYgcGFyZW50TW9kdWxlLnNraXAgfHwgbW9kaWZpZXJzLnNraXA7XG5cdCAgdmFyIHRvZG8gPSBwYXJlbnRNb2R1bGUgIT09IG51bGwgJiYgcGFyZW50TW9kdWxlLnRvZG8gfHwgbW9kaWZpZXJzLnRvZG87XG5cdCAgdmFyIG1vZHVsZSA9IHtcblx0ICAgIG5hbWU6IG1vZHVsZU5hbWUsXG5cdCAgICBwYXJlbnRNb2R1bGU6IHBhcmVudE1vZHVsZSxcblx0ICAgIHRlc3RzOiBbXSxcblx0ICAgIG1vZHVsZUlkOiBnZW5lcmF0ZUhhc2gobW9kdWxlTmFtZSksXG5cdCAgICB0ZXN0c1J1bjogMCxcblx0ICAgIHVuc2tpcHBlZFRlc3RzUnVuOiAwLFxuXHQgICAgY2hpbGRNb2R1bGVzOiBbXSxcblx0ICAgIHN1aXRlUmVwb3J0OiBuZXcgU3VpdGVSZXBvcnQobmFtZSwgcGFyZW50U3VpdGUpLFxuXHQgICAgLy8gUGFzcyBhbG9uZyBgc2tpcGAgYW5kIGB0b2RvYCBwcm9wZXJ0aWVzIGZyb20gcGFyZW50IG1vZHVsZSwgaW4gY2FzZVxuXHQgICAgLy8gdGhlcmUgaXMgb25lLCB0byBjaGlsZHMuIEFuZCB1c2Ugb3duIG90aGVyd2lzZS5cblx0ICAgIC8vIFRoaXMgcHJvcGVydHkgd2lsbCBiZSB1c2VkIHRvIG1hcmsgb3duIHRlc3RzIGFuZCB0ZXN0cyBvZiBjaGlsZCBzdWl0ZXNcblx0ICAgIC8vIGFzIGVpdGhlciBgc2tpcHBlZGAgb3IgYHRvZG9gLlxuXHQgICAgc2tpcDogc2tpcCxcblx0ICAgIHRvZG86IHNraXAgPyBmYWxzZSA6IHRvZG9cblx0ICB9O1xuXHQgIHZhciBlbnYgPSB7fTtcblxuXHQgIGlmIChwYXJlbnRNb2R1bGUpIHtcblx0ICAgIHBhcmVudE1vZHVsZS5jaGlsZE1vZHVsZXMucHVzaChtb2R1bGUpO1xuXHQgICAgZXh0ZW5kKGVudiwgcGFyZW50TW9kdWxlLnRlc3RFbnZpcm9ubWVudCk7XG5cdCAgfVxuXG5cdCAgZXh0ZW5kKGVudiwgdGVzdEVudmlyb25tZW50KTtcblx0ICBtb2R1bGUudGVzdEVudmlyb25tZW50ID0gZW52O1xuXHQgIGNvbmZpZy5tb2R1bGVzLnB1c2gobW9kdWxlKTtcblx0ICByZXR1cm4gbW9kdWxlO1xuXHR9XG5cblx0ZnVuY3Rpb24gcHJvY2Vzc01vZHVsZShuYW1lLCBvcHRpb25zLCBleGVjdXRlTm93KSB7XG5cdCAgdmFyIG1vZGlmaWVycyA9IGFyZ3VtZW50cy5sZW5ndGggPiAzICYmIGFyZ3VtZW50c1szXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzNdIDoge307XG5cblx0ICBpZiAob2JqZWN0VHlwZShvcHRpb25zKSA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdCAgICBleGVjdXRlTm93ID0gb3B0aW9ucztcblx0ICAgIG9wdGlvbnMgPSB1bmRlZmluZWQ7XG5cdCAgfVxuXG5cdCAgdmFyIG1vZHVsZSA9IGNyZWF0ZU1vZHVsZShuYW1lLCBvcHRpb25zLCBtb2RpZmllcnMpOyAvLyBNb3ZlIGFueSBob29rcyB0byBhICdob29rcycgb2JqZWN0XG5cblx0ICB2YXIgdGVzdEVudmlyb25tZW50ID0gbW9kdWxlLnRlc3RFbnZpcm9ubWVudDtcblx0ICB2YXIgaG9va3MgPSBtb2R1bGUuaG9va3MgPSB7fTtcblx0ICBzZXRIb29rRnJvbUVudmlyb25tZW50KGhvb2tzLCB0ZXN0RW52aXJvbm1lbnQsIFwiYmVmb3JlXCIpO1xuXHQgIHNldEhvb2tGcm9tRW52aXJvbm1lbnQoaG9va3MsIHRlc3RFbnZpcm9ubWVudCwgXCJiZWZvcmVFYWNoXCIpO1xuXHQgIHNldEhvb2tGcm9tRW52aXJvbm1lbnQoaG9va3MsIHRlc3RFbnZpcm9ubWVudCwgXCJhZnRlckVhY2hcIik7XG5cdCAgc2V0SG9va0Zyb21FbnZpcm9ubWVudChob29rcywgdGVzdEVudmlyb25tZW50LCBcImFmdGVyXCIpO1xuXHQgIHZhciBtb2R1bGVGbnMgPSB7XG5cdCAgICBiZWZvcmU6IHNldEhvb2tGdW5jdGlvbihtb2R1bGUsIFwiYmVmb3JlXCIpLFxuXHQgICAgYmVmb3JlRWFjaDogc2V0SG9va0Z1bmN0aW9uKG1vZHVsZSwgXCJiZWZvcmVFYWNoXCIpLFxuXHQgICAgYWZ0ZXJFYWNoOiBzZXRIb29rRnVuY3Rpb24obW9kdWxlLCBcImFmdGVyRWFjaFwiKSxcblx0ICAgIGFmdGVyOiBzZXRIb29rRnVuY3Rpb24obW9kdWxlLCBcImFmdGVyXCIpXG5cdCAgfTtcblx0ICB2YXIgY3VycmVudE1vZHVsZSA9IGNvbmZpZy5jdXJyZW50TW9kdWxlO1xuXG5cdCAgaWYgKG9iamVjdFR5cGUoZXhlY3V0ZU5vdykgPT09IFwiZnVuY3Rpb25cIikge1xuXHQgICAgbW9kdWxlU3RhY2sucHVzaChtb2R1bGUpO1xuXHQgICAgY29uZmlnLmN1cnJlbnRNb2R1bGUgPSBtb2R1bGU7XG5cdCAgICBleGVjdXRlTm93LmNhbGwobW9kdWxlLnRlc3RFbnZpcm9ubWVudCwgbW9kdWxlRm5zKTtcblx0ICAgIG1vZHVsZVN0YWNrLnBvcCgpO1xuXHQgICAgbW9kdWxlID0gbW9kdWxlLnBhcmVudE1vZHVsZSB8fCBjdXJyZW50TW9kdWxlO1xuXHQgIH1cblxuXHQgIGNvbmZpZy5jdXJyZW50TW9kdWxlID0gbW9kdWxlO1xuXG5cdCAgZnVuY3Rpb24gc2V0SG9va0Zyb21FbnZpcm9ubWVudChob29rcywgZW52aXJvbm1lbnQsIG5hbWUpIHtcblx0ICAgIHZhciBwb3RlbnRpYWxIb29rID0gZW52aXJvbm1lbnRbbmFtZV07XG5cdCAgICBob29rc1tuYW1lXSA9IHR5cGVvZiBwb3RlbnRpYWxIb29rID09PSBcImZ1bmN0aW9uXCIgPyBbcG90ZW50aWFsSG9va10gOiBbXTtcblx0ICAgIGRlbGV0ZSBlbnZpcm9ubWVudFtuYW1lXTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBzZXRIb29rRnVuY3Rpb24obW9kdWxlLCBob29rTmFtZSkge1xuXHQgICAgcmV0dXJuIGZ1bmN0aW9uIHNldEhvb2soY2FsbGJhY2spIHtcblx0ICAgICAgbW9kdWxlLmhvb2tzW2hvb2tOYW1lXS5wdXNoKGNhbGxiYWNrKTtcblx0ICAgIH07XG5cdCAgfVxuXHR9XG5cblx0ZnVuY3Rpb24gbW9kdWxlJDEobmFtZSwgb3B0aW9ucywgZXhlY3V0ZU5vdykge1xuXHQgIGlmIChmb2N1c2VkICYmICFpc1BhcmVudE1vZHVsZUluUXVldWUoKSkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHByb2Nlc3NNb2R1bGUobmFtZSwgb3B0aW9ucywgZXhlY3V0ZU5vdyk7XG5cdH1cblxuXHRtb2R1bGUkMS5vbmx5ID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICghZm9jdXNlZCkge1xuXHQgICAgY29uZmlnLm1vZHVsZXMubGVuZ3RoID0gMDtcblx0ICAgIGNvbmZpZy5xdWV1ZS5sZW5ndGggPSAwO1xuXHQgIH1cblxuXHQgIHByb2Nlc3NNb2R1bGUuYXBwbHkodm9pZCAwLCBhcmd1bWVudHMpO1xuXHQgIGZvY3VzZWQgPSB0cnVlO1xuXHR9O1xuXG5cdG1vZHVsZSQxLnNraXAgPSBmdW5jdGlvbiAobmFtZSwgb3B0aW9ucywgZXhlY3V0ZU5vdykge1xuXHQgIGlmIChmb2N1c2VkKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgcHJvY2Vzc01vZHVsZShuYW1lLCBvcHRpb25zLCBleGVjdXRlTm93LCB7XG5cdCAgICBza2lwOiB0cnVlXG5cdCAgfSk7XG5cdH07XG5cblx0bW9kdWxlJDEudG9kbyA9IGZ1bmN0aW9uIChuYW1lLCBvcHRpb25zLCBleGVjdXRlTm93KSB7XG5cdCAgaWYgKGZvY3VzZWQpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICBwcm9jZXNzTW9kdWxlKG5hbWUsIG9wdGlvbnMsIGV4ZWN1dGVOb3csIHtcblx0ICAgIHRvZG86IHRydWVcblx0ICB9KTtcblx0fTtcblxuXHR2YXIgTElTVEVORVJTID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0dmFyIFNVUFBPUlRFRF9FVkVOVFMgPSBbXCJydW5TdGFydFwiLCBcInN1aXRlU3RhcnRcIiwgXCJ0ZXN0U3RhcnRcIiwgXCJhc3NlcnRpb25cIiwgXCJ0ZXN0RW5kXCIsIFwic3VpdGVFbmRcIiwgXCJydW5FbmRcIl07XG5cdC8qKlxuXHQgKiBFbWl0cyBhbiBldmVudCB3aXRoIHRoZSBzcGVjaWZpZWQgZGF0YSB0byBhbGwgY3VycmVudGx5IHJlZ2lzdGVyZWQgbGlzdGVuZXJzLlxuXHQgKiBDYWxsYmFja3Mgd2lsbCBmaXJlIGluIHRoZSBvcmRlciBpbiB3aGljaCB0aGV5IGFyZSByZWdpc3RlcmVkIChGSUZPKS4gVGhpc1xuXHQgKiBmdW5jdGlvbiBpcyBub3QgZXhwb3NlZCBwdWJsaWNseTsgaXQgaXMgdXNlZCBieSBRVW5pdCBpbnRlcm5hbHMgdG8gZW1pdFxuXHQgKiBsb2dnaW5nIGV2ZW50cy5cblx0ICpcblx0ICogQHByaXZhdGVcblx0ICogQG1ldGhvZCBlbWl0XG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcblx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGFcblx0ICogQHJldHVybiB7Vm9pZH1cblx0ICovXG5cblx0ZnVuY3Rpb24gZW1pdChldmVudE5hbWUsIGRhdGEpIHtcblx0ICBpZiAob2JqZWN0VHlwZShldmVudE5hbWUpICE9PSBcInN0cmluZ1wiKSB7XG5cdCAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZXZlbnROYW1lIG11c3QgYmUgYSBzdHJpbmcgd2hlbiBlbWl0dGluZyBhbiBldmVudFwiKTtcblx0ICB9IC8vIENsb25lIHRoZSBjYWxsYmFja3MgaW4gY2FzZSBvbmUgb2YgdGhlbSByZWdpc3RlcnMgYSBuZXcgY2FsbGJhY2tcblxuXG5cdCAgdmFyIG9yaWdpbmFsQ2FsbGJhY2tzID0gTElTVEVORVJTW2V2ZW50TmFtZV07XG5cdCAgdmFyIGNhbGxiYWNrcyA9IG9yaWdpbmFsQ2FsbGJhY2tzID8gX3RvQ29uc3VtYWJsZUFycmF5KG9yaWdpbmFsQ2FsbGJhY2tzKSA6IFtdO1xuXG5cdCAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspIHtcblx0ICAgIGNhbGxiYWNrc1tpXShkYXRhKTtcblx0ICB9XG5cdH1cblx0LyoqXG5cdCAqIFJlZ2lzdGVycyBhIGNhbGxiYWNrIGFzIGEgbGlzdGVuZXIgdG8gdGhlIHNwZWNpZmllZCBldmVudC5cblx0ICpcblx0ICogQHB1YmxpY1xuXHQgKiBAbWV0aG9kIG9uXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcblx0ICogQHJldHVybiB7Vm9pZH1cblx0ICovXG5cblx0ZnVuY3Rpb24gb24oZXZlbnROYW1lLCBjYWxsYmFjaykge1xuXHQgIGlmIChvYmplY3RUeXBlKGV2ZW50TmFtZSkgIT09IFwic3RyaW5nXCIpIHtcblx0ICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJldmVudE5hbWUgbXVzdCBiZSBhIHN0cmluZyB3aGVuIHJlZ2lzdGVyaW5nIGEgbGlzdGVuZXJcIik7XG5cdCAgfSBlbHNlIGlmICghaW5BcnJheShldmVudE5hbWUsIFNVUFBPUlRFRF9FVkVOVFMpKSB7XG5cdCAgICB2YXIgZXZlbnRzID0gU1VQUE9SVEVEX0VWRU5UUy5qb2luKFwiLCBcIik7XG5cdCAgICB0aHJvdyBuZXcgRXJyb3IoXCJcXFwiXCIuY29uY2F0KGV2ZW50TmFtZSwgXCJcXFwiIGlzIG5vdCBhIHZhbGlkIGV2ZW50OyBtdXN0IGJlIG9uZSBvZjogXCIpLmNvbmNhdChldmVudHMsIFwiLlwiKSk7XG5cdCAgfSBlbHNlIGlmIChvYmplY3RUeXBlKGNhbGxiYWNrKSAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdCAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2FsbGJhY2sgbXVzdCBiZSBhIGZ1bmN0aW9uIHdoZW4gcmVnaXN0ZXJpbmcgYSBsaXN0ZW5lclwiKTtcblx0ICB9XG5cblx0ICBpZiAoIUxJU1RFTkVSU1tldmVudE5hbWVdKSB7XG5cdCAgICBMSVNURU5FUlNbZXZlbnROYW1lXSA9IFtdO1xuXHQgIH0gLy8gRG9uJ3QgcmVnaXN0ZXIgdGhlIHNhbWUgY2FsbGJhY2sgbW9yZSB0aGFuIG9uY2VcblxuXG5cdCAgaWYgKCFpbkFycmF5KGNhbGxiYWNrLCBMSVNURU5FUlNbZXZlbnROYW1lXSkpIHtcblx0ICAgIExJU1RFTkVSU1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuXHQgIH1cblx0fVxuXG5cdHZhciBjb21tb25qc0dsb2JhbCA9IHR5cGVvZiBnbG9iYWxUaGlzICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbFRoaXMgOiB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnID8gc2VsZiA6IHt9O1xuXG5cdGZ1bmN0aW9uIGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZuLCBiYXNlZGlyLCBtb2R1bGUpIHtcblx0XHRyZXR1cm4gbW9kdWxlID0ge1xuXHRcdCAgcGF0aDogYmFzZWRpcixcblx0XHQgIGV4cG9ydHM6IHt9LFxuXHRcdCAgcmVxdWlyZTogZnVuY3Rpb24gKHBhdGgsIGJhc2UpIHtcblx0ICAgICAgcmV0dXJuIGNvbW1vbmpzUmVxdWlyZShwYXRoLCAoYmFzZSA9PT0gdW5kZWZpbmVkIHx8IGJhc2UgPT09IG51bGwpID8gbW9kdWxlLnBhdGggOiBiYXNlKTtcblx0ICAgIH1cblx0XHR9LCBmbihtb2R1bGUsIG1vZHVsZS5leHBvcnRzKSwgbW9kdWxlLmV4cG9ydHM7XG5cdH1cblxuXHRmdW5jdGlvbiBjb21tb25qc1JlcXVpcmUgKCkge1xuXHRcdHRocm93IG5ldyBFcnJvcignRHluYW1pYyByZXF1aXJlcyBhcmUgbm90IGN1cnJlbnRseSBzdXBwb3J0ZWQgYnkgQHJvbGx1cC9wbHVnaW4tY29tbW9uanMnKTtcblx0fVxuXG5cdHZhciBlczZQcm9taXNlID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuXHQgIC8qIVxuXHQgICAqIEBvdmVydmlldyBlczYtcHJvbWlzZSAtIGEgdGlueSBpbXBsZW1lbnRhdGlvbiBvZiBQcm9taXNlcy9BKy5cblx0ICAgKiBAY29weXJpZ2h0IENvcHlyaWdodCAoYykgMjAxNCBZZWh1ZGEgS2F0eiwgVG9tIERhbGUsIFN0ZWZhbiBQZW5uZXIgYW5kIGNvbnRyaWJ1dG9ycyAoQ29udmVyc2lvbiB0byBFUzYgQVBJIGJ5IEpha2UgQXJjaGliYWxkKVxuXHQgICAqIEBsaWNlbnNlICAgTGljZW5zZWQgdW5kZXIgTUlUIGxpY2Vuc2Vcblx0ICAgKiAgICAgICAgICAgIFNlZSBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vc3RlZmFucGVubmVyL2VzNi1wcm9taXNlL21hc3Rlci9MSUNFTlNFXG5cdCAgICogQHZlcnNpb24gICB2NC4yLjgrMWU2OGRjZTZcblx0ICAgKi9cblx0ICAoZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuXHQgICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpIDtcblx0ICB9KShjb21tb25qc0dsb2JhbCwgZnVuY3Rpb24gKCkge1xuXG5cdCAgICBmdW5jdGlvbiBvYmplY3RPckZ1bmN0aW9uKHgpIHtcblx0ICAgICAgdmFyIHR5cGUgPSB0eXBlb2YgeDtcblx0ICAgICAgcmV0dXJuIHggIT09IG51bGwgJiYgKHR5cGUgPT09ICdvYmplY3QnIHx8IHR5cGUgPT09ICdmdW5jdGlvbicpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBpc0Z1bmN0aW9uKHgpIHtcblx0ICAgICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgX2lzQXJyYXkgPSB2b2lkIDA7XG5cblx0ICAgIGlmIChBcnJheS5pc0FycmF5KSB7XG5cdCAgICAgIF9pc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIF9pc0FycmF5ID0gZnVuY3Rpb24gKHgpIHtcblx0ICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHgpID09PSAnW29iamVjdCBBcnJheV0nO1xuXHQgICAgICB9O1xuXHQgICAgfVxuXG5cdCAgICB2YXIgaXNBcnJheSA9IF9pc0FycmF5O1xuXHQgICAgdmFyIGxlbiA9IDA7XG5cdCAgICB2YXIgdmVydHhOZXh0ID0gdm9pZCAwO1xuXHQgICAgdmFyIGN1c3RvbVNjaGVkdWxlckZuID0gdm9pZCAwO1xuXG5cdCAgICB2YXIgYXNhcCA9IGZ1bmN0aW9uIGFzYXAoY2FsbGJhY2ssIGFyZykge1xuXHQgICAgICBxdWV1ZVtsZW5dID0gY2FsbGJhY2s7XG5cdCAgICAgIHF1ZXVlW2xlbiArIDFdID0gYXJnO1xuXHQgICAgICBsZW4gKz0gMjtcblxuXHQgICAgICBpZiAobGVuID09PSAyKSB7XG5cdCAgICAgICAgLy8gSWYgbGVuIGlzIDIsIHRoYXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHNjaGVkdWxlIGFuIGFzeW5jIGZsdXNoLlxuXHQgICAgICAgIC8vIElmIGFkZGl0aW9uYWwgY2FsbGJhY2tzIGFyZSBxdWV1ZWQgYmVmb3JlIHRoZSBxdWV1ZSBpcyBmbHVzaGVkLCB0aGV5XG5cdCAgICAgICAgLy8gd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhpcyBmbHVzaCB0aGF0IHdlIGFyZSBzY2hlZHVsaW5nLlxuXHQgICAgICAgIGlmIChjdXN0b21TY2hlZHVsZXJGbikge1xuXHQgICAgICAgICAgY3VzdG9tU2NoZWR1bGVyRm4oZmx1c2gpO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBzY2hlZHVsZUZsdXNoKCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9O1xuXG5cdCAgICBmdW5jdGlvbiBzZXRTY2hlZHVsZXIoc2NoZWR1bGVGbikge1xuXHQgICAgICBjdXN0b21TY2hlZHVsZXJGbiA9IHNjaGVkdWxlRm47XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHNldEFzYXAoYXNhcEZuKSB7XG5cdCAgICAgIGFzYXAgPSBhc2FwRm47XG5cdCAgICB9XG5cblx0ICAgIHZhciBicm93c2VyV2luZG93ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB1bmRlZmluZWQ7XG5cdCAgICB2YXIgYnJvd3Nlckdsb2JhbCA9IGJyb3dzZXJXaW5kb3cgfHwge307XG5cdCAgICB2YXIgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIgPSBicm93c2VyR2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgYnJvd3Nlckdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xuXHQgICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBzZWxmID09PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYge30udG9TdHJpbmcuY2FsbChwcm9jZXNzKSA9PT0gJ1tvYmplY3QgcHJvY2Vzc10nOyAvLyB0ZXN0IGZvciB3ZWIgd29ya2VyIGJ1dCBub3QgaW4gSUUxMFxuXG5cdCAgICB2YXIgaXNXb3JrZXIgPSB0eXBlb2YgVWludDhDbGFtcGVkQXJyYXkgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBpbXBvcnRTY3JpcHRzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgIT09ICd1bmRlZmluZWQnOyAvLyBub2RlXG5cblx0ICAgIGZ1bmN0aW9uIHVzZU5leHRUaWNrKCkge1xuXHQgICAgICAvLyBub2RlIHZlcnNpb24gMC4xMC54IGRpc3BsYXlzIGEgZGVwcmVjYXRpb24gd2FybmluZyB3aGVuIG5leHRUaWNrIGlzIHVzZWQgcmVjdXJzaXZlbHlcblx0ICAgICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9jdWpvanMvd2hlbi9pc3N1ZXMvNDEwIGZvciBkZXRhaWxzXG5cdCAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgcmV0dXJuIHByb2Nlc3MubmV4dFRpY2soZmx1c2gpO1xuXHQgICAgICB9O1xuXHQgICAgfSAvLyB2ZXJ0eFxuXG5cblx0ICAgIGZ1bmN0aW9uIHVzZVZlcnR4VGltZXIoKSB7XG5cdCAgICAgIGlmICh0eXBlb2YgdmVydHhOZXh0ICE9PSAndW5kZWZpbmVkJykge1xuXHQgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICB2ZXJ0eE5leHQoZmx1c2gpO1xuXHQgICAgICAgIH07XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gdXNlU2V0VGltZW91dCgpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiB1c2VNdXRhdGlvbk9ic2VydmVyKCkge1xuXHQgICAgICB2YXIgaXRlcmF0aW9ucyA9IDA7XG5cdCAgICAgIHZhciBvYnNlcnZlciA9IG5ldyBCcm93c2VyTXV0YXRpb25PYnNlcnZlcihmbHVzaCk7XG5cdCAgICAgIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuXHQgICAgICBvYnNlcnZlci5vYnNlcnZlKG5vZGUsIHtcblx0ICAgICAgICBjaGFyYWN0ZXJEYXRhOiB0cnVlXG5cdCAgICAgIH0pO1xuXHQgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIG5vZGUuZGF0YSA9IGl0ZXJhdGlvbnMgPSArK2l0ZXJhdGlvbnMgJSAyO1xuXHQgICAgICB9O1xuXHQgICAgfSAvLyB3ZWIgd29ya2VyXG5cblxuXHQgICAgZnVuY3Rpb24gdXNlTWVzc2FnZUNoYW5uZWwoKSB7XG5cdCAgICAgIHZhciBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCk7XG5cdCAgICAgIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gZmx1c2g7XG5cdCAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgcmV0dXJuIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG5cdCAgICAgIH07XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHVzZVNldFRpbWVvdXQoKSB7XG5cdCAgICAgIC8vIFN0b3JlIHNldFRpbWVvdXQgcmVmZXJlbmNlIHNvIGVzNi1wcm9taXNlIHdpbGwgYmUgdW5hZmZlY3RlZCBieVxuXHQgICAgICAvLyBvdGhlciBjb2RlIG1vZGlmeWluZyBzZXRUaW1lb3V0IChsaWtlIHNpbm9uLnVzZUZha2VUaW1lcnMoKSlcblx0ICAgICAgdmFyIGdsb2JhbFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuXHQgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHJldHVybiBnbG9iYWxTZXRUaW1lb3V0KGZsdXNoLCAxKTtcblx0ICAgICAgfTtcblx0ICAgIH1cblxuXHQgICAgdmFyIHF1ZXVlID0gbmV3IEFycmF5KDEwMDApO1xuXG5cdCAgICBmdW5jdGlvbiBmbHVzaCgpIHtcblx0ICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gMikge1xuXHQgICAgICAgIHZhciBjYWxsYmFjayA9IHF1ZXVlW2ldO1xuXHQgICAgICAgIHZhciBhcmcgPSBxdWV1ZVtpICsgMV07XG5cdCAgICAgICAgY2FsbGJhY2soYXJnKTtcblx0ICAgICAgICBxdWV1ZVtpXSA9IHVuZGVmaW5lZDtcblx0ICAgICAgICBxdWV1ZVtpICsgMV0gPSB1bmRlZmluZWQ7XG5cdCAgICAgIH1cblxuXHQgICAgICBsZW4gPSAwO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBhdHRlbXB0VmVydHgoKSB7XG5cdCAgICAgIHRyeSB7XG5cdCAgICAgICAgdmFyIHZlcnR4ID0gRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKS5yZXF1aXJlKCd2ZXJ0eCcpO1xuXG5cdCAgICAgICAgdmVydHhOZXh0ID0gdmVydHgucnVuT25Mb29wIHx8IHZlcnR4LnJ1bk9uQ29udGV4dDtcblx0ICAgICAgICByZXR1cm4gdXNlVmVydHhUaW1lcigpO1xuXHQgICAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgICAgcmV0dXJuIHVzZVNldFRpbWVvdXQoKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICB2YXIgc2NoZWR1bGVGbHVzaCA9IHZvaWQgMDsgLy8gRGVjaWRlIHdoYXQgYXN5bmMgbWV0aG9kIHRvIHVzZSB0byB0cmlnZ2VyaW5nIHByb2Nlc3Npbmcgb2YgcXVldWVkIGNhbGxiYWNrczpcblxuXHQgICAgaWYgKGlzTm9kZSkge1xuXHQgICAgICBzY2hlZHVsZUZsdXNoID0gdXNlTmV4dFRpY2soKTtcblx0ICAgIH0gZWxzZSBpZiAoQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIpIHtcblx0ICAgICAgc2NoZWR1bGVGbHVzaCA9IHVzZU11dGF0aW9uT2JzZXJ2ZXIoKTtcblx0ICAgIH0gZWxzZSBpZiAoaXNXb3JrZXIpIHtcblx0ICAgICAgc2NoZWR1bGVGbHVzaCA9IHVzZU1lc3NhZ2VDaGFubmVsKCk7XG5cdCAgICB9IGVsc2UgaWYgKGJyb3dzZXJXaW5kb3cgPT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgY29tbW9uanNSZXF1aXJlID09PSAnZnVuY3Rpb24nKSB7XG5cdCAgICAgIHNjaGVkdWxlRmx1c2ggPSBhdHRlbXB0VmVydHgoKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHNjaGVkdWxlRmx1c2ggPSB1c2VTZXRUaW1lb3V0KCk7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHRoZW4ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcblx0ICAgICAgdmFyIHBhcmVudCA9IHRoaXM7XG5cdCAgICAgIHZhciBjaGlsZCA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKG5vb3ApO1xuXG5cdCAgICAgIGlmIChjaGlsZFtQUk9NSVNFX0lEXSA9PT0gdW5kZWZpbmVkKSB7XG5cdCAgICAgICAgbWFrZVByb21pc2UoY2hpbGQpO1xuXHQgICAgICB9XG5cblx0ICAgICAgdmFyIF9zdGF0ZSA9IHBhcmVudC5fc3RhdGU7XG5cblx0ICAgICAgaWYgKF9zdGF0ZSkge1xuXHQgICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3VtZW50c1tfc3RhdGUgLSAxXTtcblx0ICAgICAgICBhc2FwKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgIHJldHVybiBpbnZva2VDYWxsYmFjayhfc3RhdGUsIGNoaWxkLCBjYWxsYmFjaywgcGFyZW50Ll9yZXN1bHQpO1xuXHQgICAgICAgIH0pO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gY2hpbGQ7XG5cdCAgICB9XG5cdCAgICAvKipcblx0ICAgICAgYFByb21pc2UucmVzb2x2ZWAgcmV0dXJucyBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSByZXNvbHZlZCB3aXRoIHRoZVxuXHQgICAgICBwYXNzZWQgYHZhbHVlYC4gSXQgaXMgc2hvcnRoYW5kIGZvciB0aGUgZm9sbG93aW5nOlxuXHQgICAgXG5cdCAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgbGV0IHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHQgICAgICAgIHJlc29sdmUoMSk7XG5cdCAgICAgIH0pO1xuXHQgICAgXG5cdCAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG5cdCAgICAgICAgLy8gdmFsdWUgPT09IDFcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblx0ICAgIFxuXHQgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKDEpO1xuXHQgICAgXG5cdCAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG5cdCAgICAgICAgLy8gdmFsdWUgPT09IDFcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIEBtZXRob2QgcmVzb2x2ZVxuXHQgICAgICBAc3RhdGljXG5cdCAgICAgIEBwYXJhbSB7QW55fSB2YWx1ZSB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVzb2x2ZWQgd2l0aFxuXHQgICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG5cdCAgICAgIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIGZ1bGZpbGxlZCB3aXRoIHRoZSBnaXZlblxuXHQgICAgICBgdmFsdWVgXG5cdCAgICAqL1xuXG5cblx0ICAgIGZ1bmN0aW9uIHJlc29sdmUkMShvYmplY3QpIHtcblx0ICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cblx0ICAgICAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuXHQgICAgICBpZiAob2JqZWN0ICYmIHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmIG9iamVjdC5jb25zdHJ1Y3RvciA9PT0gQ29uc3RydWN0b3IpIHtcblx0ICAgICAgICByZXR1cm4gb2JqZWN0O1xuXHQgICAgICB9XG5cblx0ICAgICAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3Iobm9vcCk7XG5cdCAgICAgIHJlc29sdmUocHJvbWlzZSwgb2JqZWN0KTtcblx0ICAgICAgcmV0dXJuIHByb21pc2U7XG5cdCAgICB9XG5cblx0ICAgIHZhciBQUk9NSVNFX0lEID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDIpO1xuXG5cdCAgICBmdW5jdGlvbiBub29wKCkge31cblxuXHQgICAgdmFyIFBFTkRJTkcgPSB2b2lkIDA7XG5cdCAgICB2YXIgRlVMRklMTEVEID0gMTtcblx0ICAgIHZhciBSRUpFQ1RFRCA9IDI7XG5cblx0ICAgIGZ1bmN0aW9uIHNlbGZGdWxmaWxsbWVudCgpIHtcblx0ICAgICAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoXCJZb3UgY2Fubm90IHJlc29sdmUgYSBwcm9taXNlIHdpdGggaXRzZWxmXCIpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBjYW5ub3RSZXR1cm5Pd24oKSB7XG5cdCAgICAgIHJldHVybiBuZXcgVHlwZUVycm9yKCdBIHByb21pc2VzIGNhbGxiYWNrIGNhbm5vdCByZXR1cm4gdGhhdCBzYW1lIHByb21pc2UuJyk7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHRyeVRoZW4odGhlbiQkMSwgdmFsdWUsIGZ1bGZpbGxtZW50SGFuZGxlciwgcmVqZWN0aW9uSGFuZGxlcikge1xuXHQgICAgICB0cnkge1xuXHQgICAgICAgIHRoZW4kJDEuY2FsbCh2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKTtcblx0ICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgIHJldHVybiBlO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSwgdGhlbiQkMSkge1xuXHQgICAgICBhc2FwKGZ1bmN0aW9uIChwcm9taXNlKSB7XG5cdCAgICAgICAgdmFyIHNlYWxlZCA9IGZhbHNlO1xuXHQgICAgICAgIHZhciBlcnJvciA9IHRyeVRoZW4odGhlbiQkMSwgdGhlbmFibGUsIGZ1bmN0aW9uICh2YWx1ZSkge1xuXHQgICAgICAgICAgaWYgKHNlYWxlZCkge1xuXHQgICAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIHNlYWxlZCA9IHRydWU7XG5cblx0ICAgICAgICAgIGlmICh0aGVuYWJsZSAhPT0gdmFsdWUpIHtcblx0ICAgICAgICAgICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG5cdCAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgICAgICAgICBpZiAoc2VhbGVkKSB7XG5cdCAgICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgc2VhbGVkID0gdHJ1ZTtcblx0ICAgICAgICAgIHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuXHQgICAgICAgIH0sICdTZXR0bGU6ICcgKyAocHJvbWlzZS5fbGFiZWwgfHwgJyB1bmtub3duIHByb21pc2UnKSk7XG5cblx0ICAgICAgICBpZiAoIXNlYWxlZCAmJiBlcnJvcikge1xuXHQgICAgICAgICAgc2VhbGVkID0gdHJ1ZTtcblx0ICAgICAgICAgIHJlamVjdChwcm9taXNlLCBlcnJvcik7XG5cdCAgICAgICAgfVxuXHQgICAgICB9LCBwcm9taXNlKTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgdGhlbmFibGUpIHtcblx0ICAgICAgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gRlVMRklMTEVEKSB7XG5cdCAgICAgICAgZnVsZmlsbChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcblx0ICAgICAgfSBlbHNlIGlmICh0aGVuYWJsZS5fc3RhdGUgPT09IFJFSkVDVEVEKSB7XG5cdCAgICAgICAgcmVqZWN0KHByb21pc2UsIHRoZW5hYmxlLl9yZXN1bHQpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHN1YnNjcmliZSh0aGVuYWJsZSwgdW5kZWZpbmVkLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0ICAgICAgICAgIHJldHVybiByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcblx0ICAgICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgICAgICAgICByZXR1cm4gcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG5cdCAgICAgICAgfSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlLCB0aGVuJCQxKSB7XG5cdCAgICAgIGlmIChtYXliZVRoZW5hYmxlLmNvbnN0cnVjdG9yID09PSBwcm9taXNlLmNvbnN0cnVjdG9yICYmIHRoZW4kJDEgPT09IHRoZW4gJiYgbWF5YmVUaGVuYWJsZS5jb25zdHJ1Y3Rvci5yZXNvbHZlID09PSByZXNvbHZlJDEpIHtcblx0ICAgICAgICBoYW5kbGVPd25UaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBpZiAodGhlbiQkMSA9PT0gdW5kZWZpbmVkKSB7XG5cdCAgICAgICAgICBmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuXHQgICAgICAgIH0gZWxzZSBpZiAoaXNGdW5jdGlvbih0aGVuJCQxKSkge1xuXHQgICAgICAgICAgaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4kJDEpO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiByZXNvbHZlKHByb21pc2UsIHZhbHVlKSB7XG5cdCAgICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuXHQgICAgICAgIHJlamVjdChwcm9taXNlLCBzZWxmRnVsZmlsbG1lbnQoKSk7XG5cdCAgICAgIH0gZWxzZSBpZiAob2JqZWN0T3JGdW5jdGlvbih2YWx1ZSkpIHtcblx0ICAgICAgICB2YXIgdGhlbiQkMSA9IHZvaWQgMDtcblxuXHQgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICB0aGVuJCQxID0gdmFsdWUudGhlbjtcblx0ICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuXHQgICAgICAgICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcblx0ICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlLCB0aGVuJCQxKTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBwdWJsaXNoUmVqZWN0aW9uKHByb21pc2UpIHtcblx0ICAgICAgaWYgKHByb21pc2UuX29uZXJyb3IpIHtcblx0ICAgICAgICBwcm9taXNlLl9vbmVycm9yKHByb21pc2UuX3Jlc3VsdCk7XG5cdCAgICAgIH1cblxuXHQgICAgICBwdWJsaXNoKHByb21pc2UpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBmdWxmaWxsKHByb21pc2UsIHZhbHVlKSB7XG5cdCAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gUEVORElORykge1xuXHQgICAgICAgIHJldHVybjtcblx0ICAgICAgfVxuXG5cdCAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHZhbHVlO1xuXHQgICAgICBwcm9taXNlLl9zdGF0ZSA9IEZVTEZJTExFRDtcblxuXHQgICAgICBpZiAocHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoICE9PSAwKSB7XG5cdCAgICAgICAgYXNhcChwdWJsaXNoLCBwcm9taXNlKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiByZWplY3QocHJvbWlzZSwgcmVhc29uKSB7XG5cdCAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gUEVORElORykge1xuXHQgICAgICAgIHJldHVybjtcblx0ICAgICAgfVxuXG5cdCAgICAgIHByb21pc2UuX3N0YXRlID0gUkVKRUNURUQ7XG5cdCAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHJlYXNvbjtcblx0ICAgICAgYXNhcChwdWJsaXNoUmVqZWN0aW9uLCBwcm9taXNlKTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG5cdCAgICAgIHZhciBfc3Vic2NyaWJlcnMgPSBwYXJlbnQuX3N1YnNjcmliZXJzO1xuXHQgICAgICB2YXIgbGVuZ3RoID0gX3N1YnNjcmliZXJzLmxlbmd0aDtcblx0ICAgICAgcGFyZW50Ll9vbmVycm9yID0gbnVsbDtcblx0ICAgICAgX3N1YnNjcmliZXJzW2xlbmd0aF0gPSBjaGlsZDtcblx0ICAgICAgX3N1YnNjcmliZXJzW2xlbmd0aCArIEZVTEZJTExFRF0gPSBvbkZ1bGZpbGxtZW50O1xuXHQgICAgICBfc3Vic2NyaWJlcnNbbGVuZ3RoICsgUkVKRUNURURdID0gb25SZWplY3Rpb247XG5cblx0ICAgICAgaWYgKGxlbmd0aCA9PT0gMCAmJiBwYXJlbnQuX3N0YXRlKSB7XG5cdCAgICAgICAgYXNhcChwdWJsaXNoLCBwYXJlbnQpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHB1Ymxpc2gocHJvbWlzZSkge1xuXHQgICAgICB2YXIgc3Vic2NyaWJlcnMgPSBwcm9taXNlLl9zdWJzY3JpYmVycztcblx0ICAgICAgdmFyIHNldHRsZWQgPSBwcm9taXNlLl9zdGF0ZTtcblxuXHQgICAgICBpZiAoc3Vic2NyaWJlcnMubGVuZ3RoID09PSAwKSB7XG5cdCAgICAgICAgcmV0dXJuO1xuXHQgICAgICB9XG5cblx0ICAgICAgdmFyIGNoaWxkID0gdm9pZCAwLFxuXHQgICAgICAgICAgY2FsbGJhY2sgPSB2b2lkIDAsXG5cdCAgICAgICAgICBkZXRhaWwgPSBwcm9taXNlLl9yZXN1bHQ7XG5cblx0ICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdWJzY3JpYmVycy5sZW5ndGg7IGkgKz0gMykge1xuXHQgICAgICAgIGNoaWxkID0gc3Vic2NyaWJlcnNbaV07XG5cdCAgICAgICAgY2FsbGJhY2sgPSBzdWJzY3JpYmVyc1tpICsgc2V0dGxlZF07XG5cblx0ICAgICAgICBpZiAoY2hpbGQpIHtcblx0ICAgICAgICAgIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIGNoaWxkLCBjYWxsYmFjaywgZGV0YWlsKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgY2FsbGJhY2soZGV0YWlsKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggPSAwO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBwcm9taXNlLCBjYWxsYmFjaywgZGV0YWlsKSB7XG5cdCAgICAgIHZhciBoYXNDYWxsYmFjayA9IGlzRnVuY3Rpb24oY2FsbGJhY2spLFxuXHQgICAgICAgICAgdmFsdWUgPSB2b2lkIDAsXG5cdCAgICAgICAgICBlcnJvciA9IHZvaWQgMCxcblx0ICAgICAgICAgIHN1Y2NlZWRlZCA9IHRydWU7XG5cblx0ICAgICAgaWYgKGhhc0NhbGxiYWNrKSB7XG5cdCAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgIHZhbHVlID0gY2FsbGJhY2soZGV0YWlsKTtcblx0ICAgICAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgICAgICBzdWNjZWVkZWQgPSBmYWxzZTtcblx0ICAgICAgICAgIGVycm9yID0gZTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcblx0ICAgICAgICAgIHJlamVjdChwcm9taXNlLCBjYW5ub3RSZXR1cm5Pd24oKSk7XG5cdCAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgfVxuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHZhbHVlID0gZGV0YWlsO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSA7IGVsc2UgaWYgKGhhc0NhbGxiYWNrICYmIHN1Y2NlZWRlZCkge1xuXHQgICAgICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuXHQgICAgICB9IGVsc2UgaWYgKHN1Y2NlZWRlZCA9PT0gZmFsc2UpIHtcblx0ICAgICAgICByZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuXHQgICAgICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IEZVTEZJTExFRCkge1xuXHQgICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuXHQgICAgICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IFJFSkVDVEVEKSB7XG5cdCAgICAgICAgcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBpbml0aWFsaXplUHJvbWlzZShwcm9taXNlLCByZXNvbHZlcikge1xuXHQgICAgICB0cnkge1xuXHQgICAgICAgIHJlc29sdmVyKGZ1bmN0aW9uIHJlc29sdmVQcm9taXNlKHZhbHVlKSB7XG5cdCAgICAgICAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcblx0ICAgICAgICB9LCBmdW5jdGlvbiByZWplY3RQcm9taXNlKHJlYXNvbikge1xuXHQgICAgICAgICAgcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG5cdCAgICAgICAgfSk7XG5cdCAgICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgICByZWplY3QocHJvbWlzZSwgZSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgdmFyIGlkID0gMDtcblxuXHQgICAgZnVuY3Rpb24gbmV4dElkKCkge1xuXHQgICAgICByZXR1cm4gaWQrKztcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gbWFrZVByb21pc2UocHJvbWlzZSkge1xuXHQgICAgICBwcm9taXNlW1BST01JU0VfSURdID0gaWQrKztcblx0ICAgICAgcHJvbWlzZS5fc3RhdGUgPSB1bmRlZmluZWQ7XG5cdCAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHVuZGVmaW5lZDtcblx0ICAgICAgcHJvbWlzZS5fc3Vic2NyaWJlcnMgPSBbXTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gdmFsaWRhdGlvbkVycm9yKCkge1xuXHQgICAgICByZXR1cm4gbmV3IEVycm9yKCdBcnJheSBNZXRob2RzIG11c3QgYmUgcHJvdmlkZWQgYW4gQXJyYXknKTtcblx0ICAgIH1cblxuXHQgICAgdmFyIEVudW1lcmF0b3IgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGZ1bmN0aW9uIEVudW1lcmF0b3IoQ29uc3RydWN0b3IsIGlucHV0KSB7XG5cdCAgICAgICAgdGhpcy5faW5zdGFuY2VDb25zdHJ1Y3RvciA9IENvbnN0cnVjdG9yO1xuXHQgICAgICAgIHRoaXMucHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3Rvcihub29wKTtcblxuXHQgICAgICAgIGlmICghdGhpcy5wcm9taXNlW1BST01JU0VfSURdKSB7XG5cdCAgICAgICAgICBtYWtlUHJvbWlzZSh0aGlzLnByb21pc2UpO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGlmIChpc0FycmF5KGlucHV0KSkge1xuXHQgICAgICAgICAgdGhpcy5sZW5ndGggPSBpbnB1dC5sZW5ndGg7XG5cdCAgICAgICAgICB0aGlzLl9yZW1haW5pbmcgPSBpbnB1dC5sZW5ndGg7XG5cdCAgICAgICAgICB0aGlzLl9yZXN1bHQgPSBuZXcgQXJyYXkodGhpcy5sZW5ndGgpO1xuXG5cdCAgICAgICAgICBpZiAodGhpcy5sZW5ndGggPT09IDApIHtcblx0ICAgICAgICAgICAgZnVsZmlsbCh0aGlzLnByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG5cdCAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICB0aGlzLmxlbmd0aCA9IHRoaXMubGVuZ3RoIHx8IDA7XG5cblx0ICAgICAgICAgICAgdGhpcy5fZW51bWVyYXRlKGlucHV0KTtcblxuXHQgICAgICAgICAgICBpZiAodGhpcy5fcmVtYWluaW5nID09PSAwKSB7XG5cdCAgICAgICAgICAgICAgZnVsZmlsbCh0aGlzLnByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgcmVqZWN0KHRoaXMucHJvbWlzZSwgdmFsaWRhdGlvbkVycm9yKCkpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIEVudW1lcmF0b3IucHJvdG90eXBlLl9lbnVtZXJhdGUgPSBmdW5jdGlvbiBfZW51bWVyYXRlKGlucHV0KSB7XG5cdCAgICAgICAgZm9yICh2YXIgaSA9IDA7IHRoaXMuX3N0YXRlID09PSBQRU5ESU5HICYmIGkgPCBpbnB1dC5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgdGhpcy5fZWFjaEVudHJ5KGlucHV0W2ldLCBpKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH07XG5cblx0ICAgICAgRW51bWVyYXRvci5wcm90b3R5cGUuX2VhY2hFbnRyeSA9IGZ1bmN0aW9uIF9lYWNoRW50cnkoZW50cnksIGkpIHtcblx0ICAgICAgICB2YXIgYyA9IHRoaXMuX2luc3RhbmNlQ29uc3RydWN0b3I7XG5cdCAgICAgICAgdmFyIHJlc29sdmUkJDEgPSBjLnJlc29sdmU7XG5cblx0ICAgICAgICBpZiAocmVzb2x2ZSQkMSA9PT0gcmVzb2x2ZSQxKSB7XG5cdCAgICAgICAgICB2YXIgX3RoZW4gPSB2b2lkIDA7XG5cblx0ICAgICAgICAgIHZhciBlcnJvciA9IHZvaWQgMDtcblx0ICAgICAgICAgIHZhciBkaWRFcnJvciA9IGZhbHNlO1xuXG5cdCAgICAgICAgICB0cnkge1xuXHQgICAgICAgICAgICBfdGhlbiA9IGVudHJ5LnRoZW47XG5cdCAgICAgICAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgICAgICAgIGRpZEVycm9yID0gdHJ1ZTtcblx0ICAgICAgICAgICAgZXJyb3IgPSBlO1xuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICBpZiAoX3RoZW4gPT09IHRoZW4gJiYgZW50cnkuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG5cdCAgICAgICAgICAgIHRoaXMuX3NldHRsZWRBdChlbnRyeS5fc3RhdGUsIGksIGVudHJ5Ll9yZXN1bHQpO1xuXHQgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgX3RoZW4gIT09ICdmdW5jdGlvbicpIHtcblx0ICAgICAgICAgICAgdGhpcy5fcmVtYWluaW5nLS07XG5cdCAgICAgICAgICAgIHRoaXMuX3Jlc3VsdFtpXSA9IGVudHJ5O1xuXHQgICAgICAgICAgfSBlbHNlIGlmIChjID09PSBQcm9taXNlJDEpIHtcblx0ICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgYyhub29wKTtcblxuXHQgICAgICAgICAgICBpZiAoZGlkRXJyb3IpIHtcblx0ICAgICAgICAgICAgICByZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuXHQgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgIGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgZW50cnksIF90aGVuKTtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChwcm9taXNlLCBpKTtcblx0ICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChuZXcgYyhmdW5jdGlvbiAocmVzb2x2ZSQkMSkge1xuXHQgICAgICAgICAgICAgIHJldHVybiByZXNvbHZlJCQxKGVudHJ5KTtcblx0ICAgICAgICAgICAgfSksIGkpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICB0aGlzLl93aWxsU2V0dGxlQXQocmVzb2x2ZSQkMShlbnRyeSksIGkpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfTtcblxuXHQgICAgICBFbnVtZXJhdG9yLnByb3RvdHlwZS5fc2V0dGxlZEF0ID0gZnVuY3Rpb24gX3NldHRsZWRBdChzdGF0ZSwgaSwgdmFsdWUpIHtcblx0ICAgICAgICB2YXIgcHJvbWlzZSA9IHRoaXMucHJvbWlzZTtcblxuXHQgICAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSA9PT0gUEVORElORykge1xuXHQgICAgICAgICAgdGhpcy5fcmVtYWluaW5nLS07XG5cblx0ICAgICAgICAgIGlmIChzdGF0ZSA9PT0gUkVKRUNURUQpIHtcblx0ICAgICAgICAgICAgcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcblx0ICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgIHRoaXMuX3Jlc3VsdFtpXSA9IHZhbHVlO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGlmICh0aGlzLl9yZW1haW5pbmcgPT09IDApIHtcblx0ICAgICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcblx0ICAgICAgICB9XG5cdCAgICAgIH07XG5cblx0ICAgICAgRW51bWVyYXRvci5wcm90b3R5cGUuX3dpbGxTZXR0bGVBdCA9IGZ1bmN0aW9uIF93aWxsU2V0dGxlQXQocHJvbWlzZSwgaSkge1xuXHQgICAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcblx0ICAgICAgICBzdWJzY3JpYmUocHJvbWlzZSwgdW5kZWZpbmVkLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0ICAgICAgICAgIHJldHVybiBlbnVtZXJhdG9yLl9zZXR0bGVkQXQoRlVMRklMTEVELCBpLCB2YWx1ZSk7XG5cdCAgICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuXHQgICAgICAgICAgcmV0dXJuIGVudW1lcmF0b3IuX3NldHRsZWRBdChSRUpFQ1RFRCwgaSwgcmVhc29uKTtcblx0ICAgICAgICB9KTtcblx0ICAgICAgfTtcblxuXHQgICAgICByZXR1cm4gRW51bWVyYXRvcjtcblx0ICAgIH0oKTtcblx0ICAgIC8qKlxuXHQgICAgICBgUHJvbWlzZS5hbGxgIGFjY2VwdHMgYW4gYXJyYXkgb2YgcHJvbWlzZXMsIGFuZCByZXR1cm5zIGEgbmV3IHByb21pc2Ugd2hpY2hcblx0ICAgICAgaXMgZnVsZmlsbGVkIHdpdGggYW4gYXJyYXkgb2YgZnVsZmlsbG1lbnQgdmFsdWVzIGZvciB0aGUgcGFzc2VkIHByb21pc2VzLCBvclxuXHQgICAgICByZWplY3RlZCB3aXRoIHRoZSByZWFzb24gb2YgdGhlIGZpcnN0IHBhc3NlZCBwcm9taXNlIHRvIGJlIHJlamVjdGVkLiBJdCBjYXN0cyBhbGxcblx0ICAgICAgZWxlbWVudHMgb2YgdGhlIHBhc3NlZCBpdGVyYWJsZSB0byBwcm9taXNlcyBhcyBpdCBydW5zIHRoaXMgYWxnb3JpdGhtLlxuXHQgICAgXG5cdCAgICAgIEV4YW1wbGU6XG5cdCAgICBcblx0ICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBsZXQgcHJvbWlzZTEgPSByZXNvbHZlKDEpO1xuXHQgICAgICBsZXQgcHJvbWlzZTIgPSByZXNvbHZlKDIpO1xuXHQgICAgICBsZXQgcHJvbWlzZTMgPSByZXNvbHZlKDMpO1xuXHQgICAgICBsZXQgcHJvbWlzZXMgPSBbIHByb21pc2UxLCBwcm9taXNlMiwgcHJvbWlzZTMgXTtcblx0ICAgIFxuXHQgICAgICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbihhcnJheSl7XG5cdCAgICAgICAgLy8gVGhlIGFycmF5IGhlcmUgd291bGQgYmUgWyAxLCAyLCAzIF07XG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBJZiBhbnkgb2YgdGhlIGBwcm9taXNlc2AgZ2l2ZW4gdG8gYGFsbGAgYXJlIHJlamVjdGVkLCB0aGUgZmlyc3QgcHJvbWlzZVxuXHQgICAgICB0aGF0IGlzIHJlamVjdGVkIHdpbGwgYmUgZ2l2ZW4gYXMgYW4gYXJndW1lbnQgdG8gdGhlIHJldHVybmVkIHByb21pc2VzJ3Ncblx0ICAgICAgcmVqZWN0aW9uIGhhbmRsZXIuIEZvciBleGFtcGxlOlxuXHQgICAgXG5cdCAgICAgIEV4YW1wbGU6XG5cdCAgICBcblx0ICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBsZXQgcHJvbWlzZTEgPSByZXNvbHZlKDEpO1xuXHQgICAgICBsZXQgcHJvbWlzZTIgPSByZWplY3QobmV3IEVycm9yKFwiMlwiKSk7XG5cdCAgICAgIGxldCBwcm9taXNlMyA9IHJlamVjdChuZXcgRXJyb3IoXCIzXCIpKTtcblx0ICAgICAgbGV0IHByb21pc2VzID0gWyBwcm9taXNlMSwgcHJvbWlzZTIsIHByb21pc2UzIF07XG5cdCAgICBcblx0ICAgICAgUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24oYXJyYXkpe1xuXHQgICAgICAgIC8vIENvZGUgaGVyZSBuZXZlciBydW5zIGJlY2F1c2UgdGhlcmUgYXJlIHJlamVjdGVkIHByb21pc2VzIVxuXHQgICAgICB9LCBmdW5jdGlvbihlcnJvcikge1xuXHQgICAgICAgIC8vIGVycm9yLm1lc3NhZ2UgPT09IFwiMlwiXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBAbWV0aG9kIGFsbFxuXHQgICAgICBAc3RhdGljXG5cdCAgICAgIEBwYXJhbSB7QXJyYXl9IGVudHJpZXMgYXJyYXkgb2YgcHJvbWlzZXNcblx0ICAgICAgQHBhcmFtIHtTdHJpbmd9IGxhYmVsIG9wdGlvbmFsIHN0cmluZyBmb3IgbGFiZWxpbmcgdGhlIHByb21pc2UuXG5cdCAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cblx0ICAgICAgQHJldHVybiB7UHJvbWlzZX0gcHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aGVuIGFsbCBgcHJvbWlzZXNgIGhhdmUgYmVlblxuXHQgICAgICBmdWxmaWxsZWQsIG9yIHJlamVjdGVkIGlmIGFueSBvZiB0aGVtIGJlY29tZSByZWplY3RlZC5cblx0ICAgICAgQHN0YXRpY1xuXHQgICAgKi9cblxuXG5cdCAgICBmdW5jdGlvbiBhbGwoZW50cmllcykge1xuXHQgICAgICByZXR1cm4gbmV3IEVudW1lcmF0b3IodGhpcywgZW50cmllcykucHJvbWlzZTtcblx0ICAgIH1cblx0ICAgIC8qKlxuXHQgICAgICBgUHJvbWlzZS5yYWNlYCByZXR1cm5zIGEgbmV3IHByb21pc2Ugd2hpY2ggaXMgc2V0dGxlZCBpbiB0aGUgc2FtZSB3YXkgYXMgdGhlXG5cdCAgICAgIGZpcnN0IHBhc3NlZCBwcm9taXNlIHRvIHNldHRsZS5cblx0ICAgIFxuXHQgICAgICBFeGFtcGxlOlxuXHQgICAgXG5cdCAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgbGV0IHByb21pc2UxID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0ICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG5cdCAgICAgICAgICByZXNvbHZlKCdwcm9taXNlIDEnKTtcblx0ICAgICAgICB9LCAyMDApO1xuXHQgICAgICB9KTtcblx0ICAgIFxuXHQgICAgICBsZXQgcHJvbWlzZTIgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHQgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcblx0ICAgICAgICAgIHJlc29sdmUoJ3Byb21pc2UgMicpO1xuXHQgICAgICAgIH0sIDEwMCk7XG5cdCAgICAgIH0pO1xuXHQgICAgXG5cdCAgICAgIFByb21pc2UucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuXHQgICAgICAgIC8vIHJlc3VsdCA9PT0gJ3Byb21pc2UgMicgYmVjYXVzZSBpdCB3YXMgcmVzb2x2ZWQgYmVmb3JlIHByb21pc2UxXG5cdCAgICAgICAgLy8gd2FzIHJlc29sdmVkLlxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgYFByb21pc2UucmFjZWAgaXMgZGV0ZXJtaW5pc3RpYyBpbiB0aGF0IG9ubHkgdGhlIHN0YXRlIG9mIHRoZSBmaXJzdFxuXHQgICAgICBzZXR0bGVkIHByb21pc2UgbWF0dGVycy4gRm9yIGV4YW1wbGUsIGV2ZW4gaWYgb3RoZXIgcHJvbWlzZXMgZ2l2ZW4gdG8gdGhlXG5cdCAgICAgIGBwcm9taXNlc2AgYXJyYXkgYXJndW1lbnQgYXJlIHJlc29sdmVkLCBidXQgdGhlIGZpcnN0IHNldHRsZWQgcHJvbWlzZSBoYXNcblx0ICAgICAgYmVjb21lIHJlamVjdGVkIGJlZm9yZSB0aGUgb3RoZXIgcHJvbWlzZXMgYmVjYW1lIGZ1bGZpbGxlZCwgdGhlIHJldHVybmVkXG5cdCAgICAgIHByb21pc2Ugd2lsbCBiZWNvbWUgcmVqZWN0ZWQ6XG5cdCAgICBcblx0ICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBsZXQgcHJvbWlzZTEgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHQgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcblx0ICAgICAgICAgIHJlc29sdmUoJ3Byb21pc2UgMScpO1xuXHQgICAgICAgIH0sIDIwMCk7XG5cdCAgICAgIH0pO1xuXHQgICAgXG5cdCAgICAgIGxldCBwcm9taXNlMiA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdCAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuXHQgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcigncHJvbWlzZSAyJykpO1xuXHQgICAgICAgIH0sIDEwMCk7XG5cdCAgICAgIH0pO1xuXHQgICAgXG5cdCAgICAgIFByb21pc2UucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuXHQgICAgICAgIC8vIENvZGUgaGVyZSBuZXZlciBydW5zXG5cdCAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG5cdCAgICAgICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdwcm9taXNlIDInIGJlY2F1c2UgcHJvbWlzZSAyIGJlY2FtZSByZWplY3RlZCBiZWZvcmVcblx0ICAgICAgICAvLyBwcm9taXNlIDEgYmVjYW1lIGZ1bGZpbGxlZFxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgQW4gZXhhbXBsZSByZWFsLXdvcmxkIHVzZSBjYXNlIGlzIGltcGxlbWVudGluZyB0aW1lb3V0czpcblx0ICAgIFxuXHQgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIFByb21pc2UucmFjZShbYWpheCgnZm9vLmpzb24nKSwgdGltZW91dCg1MDAwKV0pXG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIEBtZXRob2QgcmFjZVxuXHQgICAgICBAc3RhdGljXG5cdCAgICAgIEBwYXJhbSB7QXJyYXl9IHByb21pc2VzIGFycmF5IG9mIHByb21pc2VzIHRvIG9ic2VydmVcblx0ICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuXHQgICAgICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2Ugd2hpY2ggc2V0dGxlcyBpbiB0aGUgc2FtZSB3YXkgYXMgdGhlIGZpcnN0IHBhc3NlZFxuXHQgICAgICBwcm9taXNlIHRvIHNldHRsZS5cblx0ICAgICovXG5cblxuXHQgICAgZnVuY3Rpb24gcmFjZShlbnRyaWVzKSB7XG5cdCAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG5cdCAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cblx0ICAgICAgaWYgKCFpc0FycmF5KGVudHJpZXMpKSB7XG5cdCAgICAgICAgcmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbiAoXywgcmVqZWN0KSB7XG5cdCAgICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gcmFjZS4nKSk7XG5cdCAgICAgICAgfSk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdCAgICAgICAgICB2YXIgbGVuZ3RoID0gZW50cmllcy5sZW5ndGg7XG5cblx0ICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgICAgQ29uc3RydWN0b3IucmVzb2x2ZShlbnRyaWVzW2ldKS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICAgIC8qKlxuXHQgICAgICBgUHJvbWlzZS5yZWplY3RgIHJldHVybnMgYSBwcm9taXNlIHJlamVjdGVkIHdpdGggdGhlIHBhc3NlZCBgcmVhc29uYC5cblx0ICAgICAgSXQgaXMgc2hvcnRoYW5kIGZvciB0aGUgZm9sbG93aW5nOlxuXHQgICAgXG5cdCAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgbGV0IHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHQgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1dIT09QUycpKTtcblx0ICAgICAgfSk7XG5cdCAgICBcblx0ICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcblx0ICAgICAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcblx0ICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcblx0ICAgICAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblx0ICAgIFxuXHQgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG5cdCAgICBcblx0ICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcblx0ICAgICAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcblx0ICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcblx0ICAgICAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIEBtZXRob2QgcmVqZWN0XG5cdCAgICAgIEBzdGF0aWNcblx0ICAgICAgQHBhcmFtIHtBbnl9IHJlYXNvbiB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aC5cblx0ICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuXHQgICAgICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2UgcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG5cdCAgICAqL1xuXG5cblx0ICAgIGZ1bmN0aW9uIHJlamVjdCQxKHJlYXNvbikge1xuXHQgICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuXHQgICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXHQgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3Rvcihub29wKTtcblx0ICAgICAgcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG5cdCAgICAgIHJldHVybiBwcm9taXNlO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBuZWVkc1Jlc29sdmVyKCkge1xuXHQgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGEgcmVzb2x2ZXIgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHRvIHRoZSBwcm9taXNlIGNvbnN0cnVjdG9yJyk7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIG5lZWRzTmV3KCkge1xuXHQgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRmFpbGVkIHRvIGNvbnN0cnVjdCAnUHJvbWlzZSc6IFBsZWFzZSB1c2UgdGhlICduZXcnIG9wZXJhdG9yLCB0aGlzIG9iamVjdCBjb25zdHJ1Y3RvciBjYW5ub3QgYmUgY2FsbGVkIGFzIGEgZnVuY3Rpb24uXCIpO1xuXHQgICAgfVxuXHQgICAgLyoqXG5cdCAgICAgIFByb21pc2Ugb2JqZWN0cyByZXByZXNlbnQgdGhlIGV2ZW50dWFsIHJlc3VsdCBvZiBhbiBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiBUaGVcblx0ICAgICAgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCwgd2hpY2hcblx0ICAgICAgcmVnaXN0ZXJzIGNhbGxiYWNrcyB0byByZWNlaXZlIGVpdGhlciBhIHByb21pc2UncyBldmVudHVhbCB2YWx1ZSBvciB0aGUgcmVhc29uXG5cdCAgICAgIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXHQgICAgXG5cdCAgICAgIFRlcm1pbm9sb2d5XG5cdCAgICAgIC0tLS0tLS0tLS0tXG5cdCAgICBcblx0ICAgICAgLSBgcHJvbWlzZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHdpdGggYSBgdGhlbmAgbWV0aG9kIHdob3NlIGJlaGF2aW9yIGNvbmZvcm1zIHRvIHRoaXMgc3BlY2lmaWNhdGlvbi5cblx0ICAgICAgLSBgdGhlbmFibGVgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB0aGF0IGRlZmluZXMgYSBgdGhlbmAgbWV0aG9kLlxuXHQgICAgICAtIGB2YWx1ZWAgaXMgYW55IGxlZ2FsIEphdmFTY3JpcHQgdmFsdWUgKGluY2x1ZGluZyB1bmRlZmluZWQsIGEgdGhlbmFibGUsIG9yIGEgcHJvbWlzZSkuXG5cdCAgICAgIC0gYGV4Y2VwdGlvbmAgaXMgYSB2YWx1ZSB0aGF0IGlzIHRocm93biB1c2luZyB0aGUgdGhyb3cgc3RhdGVtZW50LlxuXHQgICAgICAtIGByZWFzb25gIGlzIGEgdmFsdWUgdGhhdCBpbmRpY2F0ZXMgd2h5IGEgcHJvbWlzZSB3YXMgcmVqZWN0ZWQuXG5cdCAgICAgIC0gYHNldHRsZWRgIHRoZSBmaW5hbCByZXN0aW5nIHN0YXRlIG9mIGEgcHJvbWlzZSwgZnVsZmlsbGVkIG9yIHJlamVjdGVkLlxuXHQgICAgXG5cdCAgICAgIEEgcHJvbWlzZSBjYW4gYmUgaW4gb25lIG9mIHRocmVlIHN0YXRlczogcGVuZGluZywgZnVsZmlsbGVkLCBvciByZWplY3RlZC5cblx0ICAgIFxuXHQgICAgICBQcm9taXNlcyB0aGF0IGFyZSBmdWxmaWxsZWQgaGF2ZSBhIGZ1bGZpbGxtZW50IHZhbHVlIGFuZCBhcmUgaW4gdGhlIGZ1bGZpbGxlZFxuXHQgICAgICBzdGF0ZS4gIFByb21pc2VzIHRoYXQgYXJlIHJlamVjdGVkIGhhdmUgYSByZWplY3Rpb24gcmVhc29uIGFuZCBhcmUgaW4gdGhlXG5cdCAgICAgIHJlamVjdGVkIHN0YXRlLiAgQSBmdWxmaWxsbWVudCB2YWx1ZSBpcyBuZXZlciBhIHRoZW5hYmxlLlxuXHQgICAgXG5cdCAgICAgIFByb21pc2VzIGNhbiBhbHNvIGJlIHNhaWQgdG8gKnJlc29sdmUqIGEgdmFsdWUuICBJZiB0aGlzIHZhbHVlIGlzIGFsc28gYVxuXHQgICAgICBwcm9taXNlLCB0aGVuIHRoZSBvcmlnaW5hbCBwcm9taXNlJ3Mgc2V0dGxlZCBzdGF0ZSB3aWxsIG1hdGNoIHRoZSB2YWx1ZSdzXG5cdCAgICAgIHNldHRsZWQgc3RhdGUuICBTbyBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IHJlamVjdHMgd2lsbFxuXHQgICAgICBpdHNlbGYgcmVqZWN0LCBhbmQgYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCBmdWxmaWxscyB3aWxsXG5cdCAgICAgIGl0c2VsZiBmdWxmaWxsLlxuXHQgICAgXG5cdCAgICBcblx0ICAgICAgQmFzaWMgVXNhZ2U6XG5cdCAgICAgIC0tLS0tLS0tLS0tLVxuXHQgICAgXG5cdCAgICAgIGBgYGpzXG5cdCAgICAgIGxldCBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdCAgICAgICAgLy8gb24gc3VjY2Vzc1xuXHQgICAgICAgIHJlc29sdmUodmFsdWUpO1xuXHQgICAgXG5cdCAgICAgICAgLy8gb24gZmFpbHVyZVxuXHQgICAgICAgIHJlamVjdChyZWFzb24pO1xuXHQgICAgICB9KTtcblx0ICAgIFxuXHQgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcblx0ICAgICAgICAvLyBvbiBmdWxmaWxsbWVudFxuXHQgICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcblx0ICAgICAgICAvLyBvbiByZWplY3Rpb25cblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIEFkdmFuY2VkIFVzYWdlOlxuXHQgICAgICAtLS0tLS0tLS0tLS0tLS1cblx0ICAgIFxuXHQgICAgICBQcm9taXNlcyBzaGluZSB3aGVuIGFic3RyYWN0aW5nIGF3YXkgYXN5bmNocm9ub3VzIGludGVyYWN0aW9ucyBzdWNoIGFzXG5cdCAgICAgIGBYTUxIdHRwUmVxdWVzdGBzLlxuXHQgICAgXG5cdCAgICAgIGBgYGpzXG5cdCAgICAgIGZ1bmN0aW9uIGdldEpTT04odXJsKSB7XG5cdCAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdCAgICAgICAgICBsZXQgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cdCAgICBcblx0ICAgICAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwpO1xuXHQgICAgICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGhhbmRsZXI7XG5cdCAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuXHQgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG5cdCAgICAgICAgICB4aHIuc2VuZCgpO1xuXHQgICAgXG5cdCAgICAgICAgICBmdW5jdGlvbiBoYW5kbGVyKCkge1xuXHQgICAgICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSB0aGlzLkRPTkUpIHtcblx0ICAgICAgICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09IDIwMCkge1xuXHQgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJlc3BvbnNlKTtcblx0ICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignZ2V0SlNPTjogYCcgKyB1cmwgKyAnYCBmYWlsZWQgd2l0aCBzdGF0dXM6IFsnICsgdGhpcy5zdGF0dXMgKyAnXScpKTtcblx0ICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH07XG5cdCAgICAgICAgfSk7XG5cdCAgICAgIH1cblx0ICAgIFxuXHQgICAgICBnZXRKU09OKCcvcG9zdHMuanNvbicpLnRoZW4oZnVuY3Rpb24oanNvbikge1xuXHQgICAgICAgIC8vIG9uIGZ1bGZpbGxtZW50XG5cdCAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuXHQgICAgICAgIC8vIG9uIHJlamVjdGlvblxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgVW5saWtlIGNhbGxiYWNrcywgcHJvbWlzZXMgYXJlIGdyZWF0IGNvbXBvc2FibGUgcHJpbWl0aXZlcy5cblx0ICAgIFxuXHQgICAgICBgYGBqc1xuXHQgICAgICBQcm9taXNlLmFsbChbXG5cdCAgICAgICAgZ2V0SlNPTignL3Bvc3RzJyksXG5cdCAgICAgICAgZ2V0SlNPTignL2NvbW1lbnRzJylcblx0ICAgICAgXSkudGhlbihmdW5jdGlvbih2YWx1ZXMpe1xuXHQgICAgICAgIHZhbHVlc1swXSAvLyA9PiBwb3N0c0pTT05cblx0ICAgICAgICB2YWx1ZXNbMV0gLy8gPT4gY29tbWVudHNKU09OXG5cdCAgICBcblx0ICAgICAgICByZXR1cm4gdmFsdWVzO1xuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgQGNsYXNzIFByb21pc2Vcblx0ICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gcmVzb2x2ZXJcblx0ICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuXHQgICAgICBAY29uc3RydWN0b3Jcblx0ICAgICovXG5cblxuXHQgICAgdmFyIFByb21pc2UkMSA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgZnVuY3Rpb24gUHJvbWlzZShyZXNvbHZlcikge1xuXHQgICAgICAgIHRoaXNbUFJPTUlTRV9JRF0gPSBuZXh0SWQoKTtcblx0ICAgICAgICB0aGlzLl9yZXN1bHQgPSB0aGlzLl9zdGF0ZSA9IHVuZGVmaW5lZDtcblx0ICAgICAgICB0aGlzLl9zdWJzY3JpYmVycyA9IFtdO1xuXG5cdCAgICAgICAgaWYgKG5vb3AgIT09IHJlc29sdmVyKSB7XG5cdCAgICAgICAgICB0eXBlb2YgcmVzb2x2ZXIgIT09ICdmdW5jdGlvbicgJiYgbmVlZHNSZXNvbHZlcigpO1xuXHQgICAgICAgICAgdGhpcyBpbnN0YW5jZW9mIFByb21pc2UgPyBpbml0aWFsaXplUHJvbWlzZSh0aGlzLCByZXNvbHZlcikgOiBuZWVkc05ldygpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgICAvKipcblx0ICAgICAgVGhlIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsXG5cdCAgICAgIHdoaWNoIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlXG5cdCAgICAgIHJlYXNvbiB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cblx0ICAgICAgIGBgYGpzXG5cdCAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbih1c2VyKXtcblx0ICAgICAgICAvLyB1c2VyIGlzIGF2YWlsYWJsZVxuXHQgICAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuXHQgICAgICAgIC8vIHVzZXIgaXMgdW5hdmFpbGFibGUsIGFuZCB5b3UgYXJlIGdpdmVuIHRoZSByZWFzb24gd2h5XG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgICAgIENoYWluaW5nXG5cdCAgICAgIC0tLS0tLS0tXG5cdCAgICAgICBUaGUgcmV0dXJuIHZhbHVlIG9mIGB0aGVuYCBpcyBpdHNlbGYgYSBwcm9taXNlLiAgVGhpcyBzZWNvbmQsICdkb3duc3RyZWFtJ1xuXHQgICAgICBwcm9taXNlIGlzIHJlc29sdmVkIHdpdGggdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZmlyc3QgcHJvbWlzZSdzIGZ1bGZpbGxtZW50XG5cdCAgICAgIG9yIHJlamVjdGlvbiBoYW5kbGVyLCBvciByZWplY3RlZCBpZiB0aGUgaGFuZGxlciB0aHJvd3MgYW4gZXhjZXB0aW9uLlxuXHQgICAgICAgYGBganNcblx0ICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG5cdCAgICAgICAgcmV0dXJuIHVzZXIubmFtZTtcblx0ICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuXHQgICAgICAgIHJldHVybiAnZGVmYXVsdCBuYW1lJztcblx0ICAgICAgfSkudGhlbihmdW5jdGlvbiAodXNlck5hbWUpIHtcblx0ICAgICAgICAvLyBJZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHVzZXJOYW1lYCB3aWxsIGJlIHRoZSB1c2VyJ3MgbmFtZSwgb3RoZXJ3aXNlIGl0XG5cdCAgICAgICAgLy8gd2lsbCBiZSBgJ2RlZmF1bHQgbmFtZSdgXG5cdCAgICAgIH0pO1xuXHQgICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScpO1xuXHQgICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jyk7XG5cdCAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG5cdCAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuXHQgICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgICAgICAgLy8gaWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGByZWFzb25gIHdpbGwgYmUgJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jy5cblx0ICAgICAgICAvLyBJZiBgZmluZFVzZXJgIHJlamVjdGVkLCBgcmVhc29uYCB3aWxsIGJlICdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jy5cblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgICBJZiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIGRvZXMgbm90IHNwZWNpZnkgYSByZWplY3Rpb24gaGFuZGxlciwgcmVqZWN0aW9uIHJlYXNvbnMgd2lsbCBiZSBwcm9wYWdhdGVkIGZ1cnRoZXIgZG93bnN0cmVhbS5cblx0ICAgICAgIGBgYGpzXG5cdCAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuXHQgICAgICAgIHRocm93IG5ldyBQZWRhZ29naWNhbEV4Y2VwdGlvbignVXBzdHJlYW0gZXJyb3InKTtcblx0ICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcblx0ICAgICAgICAvLyBuZXZlciByZWFjaGVkXG5cdCAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG5cdCAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuXHQgICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgICAgICAgLy8gVGhlIGBQZWRnYWdvY2lhbEV4Y2VwdGlvbmAgaXMgcHJvcGFnYXRlZCBhbGwgdGhlIHdheSBkb3duIHRvIGhlcmVcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgICAgQXNzaW1pbGF0aW9uXG5cdCAgICAgIC0tLS0tLS0tLS0tLVxuXHQgICAgICAgU29tZXRpbWVzIHRoZSB2YWx1ZSB5b3Ugd2FudCB0byBwcm9wYWdhdGUgdG8gYSBkb3duc3RyZWFtIHByb21pc2UgY2FuIG9ubHkgYmVcblx0ICAgICAgcmV0cmlldmVkIGFzeW5jaHJvbm91c2x5LiBUaGlzIGNhbiBiZSBhY2hpZXZlZCBieSByZXR1cm5pbmcgYSBwcm9taXNlIGluIHRoZVxuXHQgICAgICBmdWxmaWxsbWVudCBvciByZWplY3Rpb24gaGFuZGxlci4gVGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIHRoZW4gYmUgcGVuZGluZ1xuXHQgICAgICB1bnRpbCB0aGUgcmV0dXJuZWQgcHJvbWlzZSBpcyBzZXR0bGVkLiBUaGlzIGlzIGNhbGxlZCAqYXNzaW1pbGF0aW9uKi5cblx0ICAgICAgIGBgYGpzXG5cdCAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuXHQgICAgICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcblx0ICAgICAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcblx0ICAgICAgICAvLyBUaGUgdXNlcidzIGNvbW1lbnRzIGFyZSBub3cgYXZhaWxhYmxlXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgICAgIElmIHRoZSBhc3NpbWxpYXRlZCBwcm9taXNlIHJlamVjdHMsIHRoZW4gdGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIGFsc28gcmVqZWN0LlxuXHQgICAgICAgYGBganNcblx0ICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG5cdCAgICAgICAgcmV0dXJuIGZpbmRDb21tZW50c0J5QXV0aG9yKHVzZXIpO1xuXHQgICAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuXHQgICAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgZnVsZmlsbHMsIHdlJ2xsIGhhdmUgdGhlIHZhbHVlIGhlcmVcblx0ICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuXHQgICAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgcmVqZWN0cywgd2UnbGwgaGF2ZSB0aGUgcmVhc29uIGhlcmVcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgICAgU2ltcGxlIEV4YW1wbGVcblx0ICAgICAgLS0tLS0tLS0tLS0tLS1cblx0ICAgICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcblx0ICAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgbGV0IHJlc3VsdDtcblx0ICAgICAgIHRyeSB7XG5cdCAgICAgICAgcmVzdWx0ID0gZmluZFJlc3VsdCgpO1xuXHQgICAgICAgIC8vIHN1Y2Nlc3Ncblx0ICAgICAgfSBjYXRjaChyZWFzb24pIHtcblx0ICAgICAgICAvLyBmYWlsdXJlXG5cdCAgICAgIH1cblx0ICAgICAgYGBgXG5cdCAgICAgICBFcnJiYWNrIEV4YW1wbGVcblx0ICAgICAgIGBgYGpzXG5cdCAgICAgIGZpbmRSZXN1bHQoZnVuY3Rpb24ocmVzdWx0LCBlcnIpe1xuXHQgICAgICAgIGlmIChlcnIpIHtcblx0ICAgICAgICAgIC8vIGZhaWx1cmVcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgLy8gc3VjY2Vzc1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgICAgUHJvbWlzZSBFeGFtcGxlO1xuXHQgICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBmaW5kUmVzdWx0KCkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuXHQgICAgICAgIC8vIHN1Y2Nlc3Ncblx0ICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcblx0ICAgICAgICAvLyBmYWlsdXJlXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgICAgIEFkdmFuY2VkIEV4YW1wbGVcblx0ICAgICAgLS0tLS0tLS0tLS0tLS1cblx0ICAgICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcblx0ICAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgbGV0IGF1dGhvciwgYm9va3M7XG5cdCAgICAgICB0cnkge1xuXHQgICAgICAgIGF1dGhvciA9IGZpbmRBdXRob3IoKTtcblx0ICAgICAgICBib29rcyAgPSBmaW5kQm9va3NCeUF1dGhvcihhdXRob3IpO1xuXHQgICAgICAgIC8vIHN1Y2Nlc3Ncblx0ICAgICAgfSBjYXRjaChyZWFzb24pIHtcblx0ICAgICAgICAvLyBmYWlsdXJlXG5cdCAgICAgIH1cblx0ICAgICAgYGBgXG5cdCAgICAgICBFcnJiYWNrIEV4YW1wbGVcblx0ICAgICAgIGBgYGpzXG5cdCAgICAgICBmdW5jdGlvbiBmb3VuZEJvb2tzKGJvb2tzKSB7XG5cdCAgICAgICB9XG5cdCAgICAgICBmdW5jdGlvbiBmYWlsdXJlKHJlYXNvbikge1xuXHQgICAgICAgfVxuXHQgICAgICAgZmluZEF1dGhvcihmdW5jdGlvbihhdXRob3IsIGVycil7XG5cdCAgICAgICAgaWYgKGVycikge1xuXHQgICAgICAgICAgZmFpbHVyZShlcnIpO1xuXHQgICAgICAgICAgLy8gZmFpbHVyZVxuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICB0cnkge1xuXHQgICAgICAgICAgICBmaW5kQm9vb2tzQnlBdXRob3IoYXV0aG9yLCBmdW5jdGlvbihib29rcywgZXJyKSB7XG5cdCAgICAgICAgICAgICAgaWYgKGVycikge1xuXHQgICAgICAgICAgICAgICAgZmFpbHVyZShlcnIpO1xuXHQgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICB0cnkge1xuXHQgICAgICAgICAgICAgICAgICBmb3VuZEJvb2tzKGJvb2tzKTtcblx0ICAgICAgICAgICAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG5cdCAgICAgICAgICAgICAgICAgIGZhaWx1cmUocmVhc29uKTtcblx0ICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgfSBjYXRjaChlcnJvcikge1xuXHQgICAgICAgICAgICBmYWlsdXJlKGVycik7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgICAvLyBzdWNjZXNzXG5cdCAgICAgICAgfVxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICAgICBQcm9taXNlIEV4YW1wbGU7XG5cdCAgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGZpbmRBdXRob3IoKS5cblx0ICAgICAgICB0aGVuKGZpbmRCb29rc0J5QXV0aG9yKS5cblx0ICAgICAgICB0aGVuKGZ1bmN0aW9uKGJvb2tzKXtcblx0ICAgICAgICAgIC8vIGZvdW5kIGJvb2tzXG5cdCAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG5cdCAgICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3Jvbmdcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgICAgQG1ldGhvZCB0aGVuXG5cdCAgICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uRnVsZmlsbGVkXG5cdCAgICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWRcblx0ICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuXHQgICAgICBAcmV0dXJuIHtQcm9taXNlfVxuXHQgICAgICAqL1xuXG5cdCAgICAgIC8qKlxuXHQgICAgICBgY2F0Y2hgIGlzIHNpbXBseSBzdWdhciBmb3IgYHRoZW4odW5kZWZpbmVkLCBvblJlamVjdGlvbilgIHdoaWNoIG1ha2VzIGl0IHRoZSBzYW1lXG5cdCAgICAgIGFzIHRoZSBjYXRjaCBibG9jayBvZiBhIHRyeS9jYXRjaCBzdGF0ZW1lbnQuXG5cdCAgICAgIGBgYGpzXG5cdCAgICAgIGZ1bmN0aW9uIGZpbmRBdXRob3IoKXtcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZG4ndCBmaW5kIHRoYXQgYXV0aG9yJyk7XG5cdCAgICAgIH1cblx0ICAgICAgLy8gc3luY2hyb25vdXNcblx0ICAgICAgdHJ5IHtcblx0ICAgICAgZmluZEF1dGhvcigpO1xuXHQgICAgICB9IGNhdGNoKHJlYXNvbikge1xuXHQgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuXHQgICAgICB9XG5cdCAgICAgIC8vIGFzeW5jIHdpdGggcHJvbWlzZXNcblx0ICAgICAgZmluZEF1dGhvcigpLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG5cdCAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgICAgQG1ldGhvZCBjYXRjaFxuXHQgICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGlvblxuXHQgICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG5cdCAgICAgIEByZXR1cm4ge1Byb21pc2V9XG5cdCAgICAgICovXG5cblxuXHQgICAgICBQcm9taXNlLnByb3RvdHlwZS5jYXRjaCA9IGZ1bmN0aW9uIF9jYXRjaChvblJlamVjdGlvbikge1xuXHQgICAgICAgIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3Rpb24pO1xuXHQgICAgICB9O1xuXHQgICAgICAvKipcblx0ICAgICAgICBgZmluYWxseWAgd2lsbCBiZSBpbnZva2VkIHJlZ2FyZGxlc3Mgb2YgdGhlIHByb21pc2UncyBmYXRlIGp1c3QgYXMgbmF0aXZlXG5cdCAgICAgICAgdHJ5L2NhdGNoL2ZpbmFsbHkgYmVoYXZlc1xuXHQgICAgICBcblx0ICAgICAgICBTeW5jaHJvbm91cyBleGFtcGxlOlxuXHQgICAgICBcblx0ICAgICAgICBgYGBqc1xuXHQgICAgICAgIGZpbmRBdXRob3IoKSB7XG5cdCAgICAgICAgICBpZiAoTWF0aC5yYW5kb20oKSA+IDAuNSkge1xuXHQgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoKTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICAgIHJldHVybiBuZXcgQXV0aG9yKCk7XG5cdCAgICAgICAgfVxuXHQgICAgICBcblx0ICAgICAgICB0cnkge1xuXHQgICAgICAgICAgcmV0dXJuIGZpbmRBdXRob3IoKTsgLy8gc3VjY2VlZCBvciBmYWlsXG5cdCAgICAgICAgfSBjYXRjaChlcnJvcikge1xuXHQgICAgICAgICAgcmV0dXJuIGZpbmRPdGhlckF1dGhlcigpO1xuXHQgICAgICAgIH0gZmluYWxseSB7XG5cdCAgICAgICAgICAvLyBhbHdheXMgcnVuc1xuXHQgICAgICAgICAgLy8gZG9lc24ndCBhZmZlY3QgdGhlIHJldHVybiB2YWx1ZVxuXHQgICAgICAgIH1cblx0ICAgICAgICBgYGBcblx0ICAgICAgXG5cdCAgICAgICAgQXN5bmNocm9ub3VzIGV4YW1wbGU6XG5cdCAgICAgIFxuXHQgICAgICAgIGBgYGpzXG5cdCAgICAgICAgZmluZEF1dGhvcigpLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG5cdCAgICAgICAgICByZXR1cm4gZmluZE90aGVyQXV0aGVyKCk7XG5cdCAgICAgICAgfSkuZmluYWxseShmdW5jdGlvbigpe1xuXHQgICAgICAgICAgLy8gYXV0aG9yIHdhcyBlaXRoZXIgZm91bmQsIG9yIG5vdFxuXHQgICAgICAgIH0pO1xuXHQgICAgICAgIGBgYFxuXHQgICAgICBcblx0ICAgICAgICBAbWV0aG9kIGZpbmFsbHlcblx0ICAgICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuXHQgICAgICAgIEByZXR1cm4ge1Byb21pc2V9XG5cdCAgICAgICovXG5cblxuXHQgICAgICBQcm9taXNlLnByb3RvdHlwZS5maW5hbGx5ID0gZnVuY3Rpb24gX2ZpbmFsbHkoY2FsbGJhY2spIHtcblx0ICAgICAgICB2YXIgcHJvbWlzZSA9IHRoaXM7XG5cdCAgICAgICAgdmFyIGNvbnN0cnVjdG9yID0gcHJvbWlzZS5jb25zdHJ1Y3RvcjtcblxuXHQgICAgICAgIGlmIChpc0Z1bmN0aW9uKGNhbGxiYWNrKSkge1xuXHQgICAgICAgICAgcmV0dXJuIHByb21pc2UudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcblx0ICAgICAgICAgICAgcmV0dXJuIGNvbnN0cnVjdG9yLnJlc29sdmUoY2FsbGJhY2soKSkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuXHQgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcblx0ICAgICAgICAgICAgcmV0dXJuIGNvbnN0cnVjdG9yLnJlc29sdmUoY2FsbGJhY2soKSkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgdGhyb3cgcmVhc29uO1xuXHQgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgIH0pO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oY2FsbGJhY2ssIGNhbGxiYWNrKTtcblx0ICAgICAgfTtcblxuXHQgICAgICByZXR1cm4gUHJvbWlzZTtcblx0ICAgIH0oKTtcblxuXHQgICAgUHJvbWlzZSQxLnByb3RvdHlwZS50aGVuID0gdGhlbjtcblx0ICAgIFByb21pc2UkMS5hbGwgPSBhbGw7XG5cdCAgICBQcm9taXNlJDEucmFjZSA9IHJhY2U7XG5cdCAgICBQcm9taXNlJDEucmVzb2x2ZSA9IHJlc29sdmUkMTtcblx0ICAgIFByb21pc2UkMS5yZWplY3QgPSByZWplY3QkMTtcblx0ICAgIFByb21pc2UkMS5fc2V0U2NoZWR1bGVyID0gc2V0U2NoZWR1bGVyO1xuXHQgICAgUHJvbWlzZSQxLl9zZXRBc2FwID0gc2V0QXNhcDtcblx0ICAgIFByb21pc2UkMS5fYXNhcCA9IGFzYXA7XG5cdCAgICAvKmdsb2JhbCBzZWxmKi9cblxuXHQgICAgZnVuY3Rpb24gcG9seWZpbGwoKSB7XG5cdCAgICAgIHZhciBsb2NhbCA9IHZvaWQgMDtcblxuXHQgICAgICBpZiAodHlwZW9mIGNvbW1vbmpzR2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuXHQgICAgICAgIGxvY2FsID0gY29tbW9uanNHbG9iYWw7XG5cdCAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnKSB7XG5cdCAgICAgICAgbG9jYWwgPSBzZWxmO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICBsb2NhbCA9IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG5cdCAgICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5ZmlsbCBmYWlsZWQgYmVjYXVzZSBnbG9iYWwgb2JqZWN0IGlzIHVuYXZhaWxhYmxlIGluIHRoaXMgZW52aXJvbm1lbnQnKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICB2YXIgUCA9IGxvY2FsLlByb21pc2U7XG5cblx0ICAgICAgaWYgKFApIHtcblx0ICAgICAgICB2YXIgcHJvbWlzZVRvU3RyaW5nID0gbnVsbDtcblxuXHQgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICBwcm9taXNlVG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoUC5yZXNvbHZlKCkpO1xuXHQgICAgICAgIH0gY2F0Y2ggKGUpIHsvLyBzaWxlbnRseSBpZ25vcmVkXG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaWYgKHByb21pc2VUb1N0cmluZyA9PT0gJ1tvYmplY3QgUHJvbWlzZV0nICYmICFQLmNhc3QpIHtcblx0ICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBsb2NhbC5Qcm9taXNlID0gUHJvbWlzZSQxO1xuXHQgICAgfSAvLyBTdHJhbmdlIGNvbXBhdC4uXG5cblxuXHQgICAgUHJvbWlzZSQxLnBvbHlmaWxsID0gcG9seWZpbGw7XG5cdCAgICBQcm9taXNlJDEuUHJvbWlzZSA9IFByb21pc2UkMTtcblx0ICAgIHJldHVybiBQcm9taXNlJDE7XG5cdCAgfSk7XG5cdH0pO1xuXG5cdHZhciBQcm9taXNlJDEgPSB0eXBlb2YgUHJvbWlzZSAhPT0gXCJ1bmRlZmluZWRcIiA/IFByb21pc2UgOiBlczZQcm9taXNlO1xuXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyTG9nZ2luZ0NhbGxiYWNrcyhvYmopIHtcblx0ICB2YXIgaSxcblx0ICAgICAgbCxcblx0ICAgICAga2V5LFxuXHQgICAgICBjYWxsYmFja05hbWVzID0gW1wiYmVnaW5cIiwgXCJkb25lXCIsIFwibG9nXCIsIFwidGVzdFN0YXJ0XCIsIFwidGVzdERvbmVcIiwgXCJtb2R1bGVTdGFydFwiLCBcIm1vZHVsZURvbmVcIl07XG5cblx0ICBmdW5jdGlvbiByZWdpc3RlckxvZ2dpbmdDYWxsYmFjayhrZXkpIHtcblx0ICAgIHZhciBsb2dnaW5nQ2FsbGJhY2sgPSBmdW5jdGlvbiBsb2dnaW5nQ2FsbGJhY2soY2FsbGJhY2spIHtcblx0ICAgICAgaWYgKG9iamVjdFR5cGUoY2FsbGJhY2spICE9PSBcImZ1bmN0aW9uXCIpIHtcblx0ICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJRVW5pdCBsb2dnaW5nIG1ldGhvZHMgcmVxdWlyZSBhIGNhbGxiYWNrIGZ1bmN0aW9uIGFzIHRoZWlyIGZpcnN0IHBhcmFtZXRlcnMuXCIpO1xuXHQgICAgICB9XG5cblx0ICAgICAgY29uZmlnLmNhbGxiYWNrc1trZXldLnB1c2goY2FsbGJhY2spO1xuXHQgICAgfTtcblxuXHQgICAgcmV0dXJuIGxvZ2dpbmdDYWxsYmFjaztcblx0ICB9XG5cblx0ICBmb3IgKGkgPSAwLCBsID0gY2FsbGJhY2tOYW1lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0ICAgIGtleSA9IGNhbGxiYWNrTmFtZXNbaV07IC8vIEluaXRpYWxpemUga2V5IGNvbGxlY3Rpb24gb2YgbG9nZ2luZyBjYWxsYmFja1xuXG5cdCAgICBpZiAob2JqZWN0VHlwZShjb25maWcuY2FsbGJhY2tzW2tleV0pID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdCAgICAgIGNvbmZpZy5jYWxsYmFja3Nba2V5XSA9IFtdO1xuXHQgICAgfVxuXG5cdCAgICBvYmpba2V5XSA9IHJlZ2lzdGVyTG9nZ2luZ0NhbGxiYWNrKGtleSk7XG5cdCAgfVxuXHR9XG5cdGZ1bmN0aW9uIHJ1bkxvZ2dpbmdDYWxsYmFja3Moa2V5LCBhcmdzKSB7XG5cdCAgdmFyIGNhbGxiYWNrcyA9IGNvbmZpZy5jYWxsYmFja3Nba2V5XTsgLy8gSGFuZGxpbmcgJ2xvZycgY2FsbGJhY2tzIHNlcGFyYXRlbHkuIFVubGlrZSB0aGUgb3RoZXIgY2FsbGJhY2tzLFxuXHQgIC8vIHRoZSBsb2cgY2FsbGJhY2sgaXMgbm90IGNvbnRyb2xsZWQgYnkgdGhlIHByb2Nlc3NpbmcgcXVldWUsXG5cdCAgLy8gYnV0IHJhdGhlciB1c2VkIGJ5IGFzc2VydHMuIEhlbmNlIHRvIHByb21pc2Z5IHRoZSAnbG9nJyBjYWxsYmFja1xuXHQgIC8vIHdvdWxkIG1lYW4gcHJvbWlzZnlpbmcgZWFjaCBzdGVwIG9mIGEgdGVzdFxuXG5cdCAgaWYgKGtleSA9PT0gXCJsb2dcIikge1xuXHQgICAgY2FsbGJhY2tzLm1hcChmdW5jdGlvbiAoY2FsbGJhY2spIHtcblx0ICAgICAgcmV0dXJuIGNhbGxiYWNrKGFyZ3MpO1xuXHQgICAgfSk7XG5cdCAgICByZXR1cm47XG5cdCAgfSAvLyBlbnN1cmUgdGhhdCBlYWNoIGNhbGxiYWNrIGlzIGV4ZWN1dGVkIHNlcmlhbGx5XG5cblxuXHQgIHJldHVybiBjYWxsYmFja3MucmVkdWNlKGZ1bmN0aW9uIChwcm9taXNlQ2hhaW4sIGNhbGxiYWNrKSB7XG5cdCAgICByZXR1cm4gcHJvbWlzZUNoYWluLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgICByZXR1cm4gUHJvbWlzZSQxLnJlc29sdmUoY2FsbGJhY2soYXJncykpO1xuXHQgICAgfSk7XG5cdCAgfSwgUHJvbWlzZSQxLnJlc29sdmUoW10pKTtcblx0fVxuXG5cdC8vIERvZXNuJ3Qgc3VwcG9ydCBJRTksIGl0IHdpbGwgcmV0dXJuIHVuZGVmaW5lZCBvbiB0aGVzZSBicm93c2Vyc1xuXHQvLyBTZWUgYWxzbyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9FcnJvci9TdGFja1xuXHR2YXIgZmlsZU5hbWUgPSAoc291cmNlRnJvbVN0YWNrdHJhY2UoMCkgfHwgXCJcIikucmVwbGFjZSgvKDpcXGQrKStcXCk/LywgXCJcIikucmVwbGFjZSgvLitcXC8vLCBcIlwiKTtcblx0ZnVuY3Rpb24gZXh0cmFjdFN0YWNrdHJhY2UoZSwgb2Zmc2V0KSB7XG5cdCAgb2Zmc2V0ID0gb2Zmc2V0ID09PSB1bmRlZmluZWQgPyA0IDogb2Zmc2V0O1xuXHQgIHZhciBzdGFjaywgaW5jbHVkZSwgaTtcblxuXHQgIGlmIChlICYmIGUuc3RhY2spIHtcblx0ICAgIHN0YWNrID0gZS5zdGFjay5zcGxpdChcIlxcblwiKTtcblxuXHQgICAgaWYgKC9eZXJyb3IkL2kudGVzdChzdGFja1swXSkpIHtcblx0ICAgICAgc3RhY2suc2hpZnQoKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGZpbGVOYW1lKSB7XG5cdCAgICAgIGluY2x1ZGUgPSBbXTtcblxuXHQgICAgICBmb3IgKGkgPSBvZmZzZXQ7IGkgPCBzdGFjay5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgIGlmIChzdGFja1tpXS5pbmRleE9mKGZpbGVOYW1lKSAhPT0gLTEpIHtcblx0ICAgICAgICAgIGJyZWFrO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGluY2x1ZGUucHVzaChzdGFja1tpXSk7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAoaW5jbHVkZS5sZW5ndGgpIHtcblx0ICAgICAgICByZXR1cm4gaW5jbHVkZS5qb2luKFwiXFxuXCIpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBzdGFja1tvZmZzZXRdO1xuXHQgIH1cblx0fVxuXHRmdW5jdGlvbiBzb3VyY2VGcm9tU3RhY2t0cmFjZShvZmZzZXQpIHtcblx0ICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoKTsgLy8gU3VwcG9ydDogU2FmYXJpIDw9NyBvbmx5LCBJRSA8PTEwIC0gMTEgb25seVxuXHQgIC8vIE5vdCBhbGwgYnJvd3NlcnMgZ2VuZXJhdGUgdGhlIGBzdGFja2AgcHJvcGVydHkgZm9yIGBuZXcgRXJyb3IoKWAsIHNlZSBhbHNvICM2MzZcblxuXHQgIGlmICghZXJyb3Iuc3RhY2spIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIHRocm93IGVycm9yO1xuXHQgICAgfSBjYXRjaCAoZXJyKSB7XG5cdCAgICAgIGVycm9yID0gZXJyO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiBleHRyYWN0U3RhY2t0cmFjZShlcnJvciwgb2Zmc2V0KTtcblx0fVxuXG5cdHZhciBwcmlvcml0eUNvdW50ID0gMDtcblx0dmFyIHVuaXRTYW1wbGVyOyAvLyBUaGlzIGlzIGEgcXVldWUgb2YgZnVuY3Rpb25zIHRoYXQgYXJlIHRhc2tzIHdpdGhpbiBhIHNpbmdsZSB0ZXN0LlxuXHQvLyBBZnRlciB0ZXN0cyBhcmUgZGVxdWV1ZWQgZnJvbSBjb25maWcucXVldWUgdGhleSBhcmUgZXhwYW5kZWQgaW50b1xuXHQvLyBhIHNldCBvZiB0YXNrcyBpbiB0aGlzIHF1ZXVlLlxuXG5cdHZhciB0YXNrUXVldWUgPSBbXTtcblx0LyoqXG5cdCAqIEFkdmFuY2VzIHRoZSB0YXNrUXVldWUgdG8gdGhlIG5leHQgdGFzay4gSWYgdGhlIHRhc2tRdWV1ZSBpcyBlbXB0eSxcblx0ICogcHJvY2VzcyB0aGUgdGVzdFF1ZXVlXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGFkdmFuY2UoKSB7XG5cdCAgYWR2YW5jZVRhc2tRdWV1ZSgpO1xuXG5cdCAgaWYgKCF0YXNrUXVldWUubGVuZ3RoICYmICFjb25maWcuYmxvY2tpbmcgJiYgIWNvbmZpZy5jdXJyZW50KSB7XG5cdCAgICBhZHZhbmNlVGVzdFF1ZXVlKCk7XG5cdCAgfVxuXHR9XG5cdC8qKlxuXHQgKiBBZHZhbmNlcyB0aGUgdGFza1F1ZXVlIHdpdGggYW4gaW5jcmVhc2VkIGRlcHRoXG5cdCAqL1xuXG5cblx0ZnVuY3Rpb24gYWR2YW5jZVRhc2tRdWV1ZSgpIHtcblx0ICB2YXIgc3RhcnQgPSBub3coKTtcblx0ICBjb25maWcuZGVwdGggPSAoY29uZmlnLmRlcHRoIHx8IDApICsgMTtcblx0ICBwcm9jZXNzVGFza1F1ZXVlKHN0YXJ0KTtcblx0ICBjb25maWcuZGVwdGgtLTtcblx0fVxuXHQvKipcblx0ICogUHJvY2VzcyB0aGUgZmlyc3QgdGFzayBvbiB0aGUgdGFza1F1ZXVlIGFzIGEgcHJvbWlzZS5cblx0ICogRWFjaCB0YXNrIGlzIGEgZnVuY3Rpb24gcmV0dXJuZWQgYnkgaHR0cHM6Ly9naXRodWIuY29tL3F1bml0anMvcXVuaXQvYmxvYi9tYXN0ZXIvc3JjL3Rlc3QuanMjTDM4MVxuXHQgKi9cblxuXG5cdGZ1bmN0aW9uIHByb2Nlc3NUYXNrUXVldWUoc3RhcnQpIHtcblx0ICBpZiAodGFza1F1ZXVlLmxlbmd0aCAmJiAhY29uZmlnLmJsb2NraW5nKSB7XG5cdCAgICB2YXIgZWxhcHNlZFRpbWUgPSBub3coKSAtIHN0YXJ0O1xuXG5cdCAgICBpZiAoIWRlZmluZWQuc2V0VGltZW91dCB8fCBjb25maWcudXBkYXRlUmF0ZSA8PSAwIHx8IGVsYXBzZWRUaW1lIDwgY29uZmlnLnVwZGF0ZVJhdGUpIHtcblx0ICAgICAgdmFyIHRhc2sgPSB0YXNrUXVldWUuc2hpZnQoKTtcblx0ICAgICAgUHJvbWlzZSQxLnJlc29sdmUodGFzaygpKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBpZiAoIXRhc2tRdWV1ZS5sZW5ndGgpIHtcblx0ICAgICAgICAgIGFkdmFuY2UoKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgcHJvY2Vzc1Rhc2tRdWV1ZShzdGFydCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9KTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHNldFRpbWVvdXQkMShhZHZhbmNlKTtcblx0ICAgIH1cblx0ICB9XG5cdH1cblx0LyoqXG5cdCAqIEFkdmFuY2UgdGhlIHRlc3RRdWV1ZSB0byB0aGUgbmV4dCB0ZXN0IHRvIHByb2Nlc3MuIENhbGwgZG9uZSgpIGlmIHRlc3RRdWV1ZSBjb21wbGV0ZXMuXG5cdCAqL1xuXG5cblx0ZnVuY3Rpb24gYWR2YW5jZVRlc3RRdWV1ZSgpIHtcblx0ICBpZiAoIWNvbmZpZy5ibG9ja2luZyAmJiAhY29uZmlnLnF1ZXVlLmxlbmd0aCAmJiBjb25maWcuZGVwdGggPT09IDApIHtcblx0ICAgIGRvbmUoKTtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICB2YXIgdGVzdFRhc2tzID0gY29uZmlnLnF1ZXVlLnNoaWZ0KCk7XG5cdCAgYWRkVG9UYXNrUXVldWUodGVzdFRhc2tzKCkpO1xuXG5cdCAgaWYgKHByaW9yaXR5Q291bnQgPiAwKSB7XG5cdCAgICBwcmlvcml0eUNvdW50LS07XG5cdCAgfVxuXG5cdCAgYWR2YW5jZSgpO1xuXHR9XG5cdC8qKlxuXHQgKiBFbnF1ZXVlIHRoZSB0YXNrcyBmb3IgYSB0ZXN0IGludG8gdGhlIHRhc2sgcXVldWUuXG5cdCAqIEBwYXJhbSB7QXJyYXl9IHRhc2tzQXJyYXlcblx0ICovXG5cblxuXHRmdW5jdGlvbiBhZGRUb1Rhc2tRdWV1ZSh0YXNrc0FycmF5KSB7XG5cdCAgdGFza1F1ZXVlLnB1c2guYXBwbHkodGFza1F1ZXVlLCBfdG9Db25zdW1hYmxlQXJyYXkodGFza3NBcnJheSkpO1xuXHR9XG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIG51bWJlciBvZiB0YXNrcyByZW1haW5pbmcgaW4gdGhlIHRhc2sgcXVldWUgdG8gYmUgcHJvY2Vzc2VkLlxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9XG5cdCAqL1xuXG5cblx0ZnVuY3Rpb24gdGFza1F1ZXVlTGVuZ3RoKCkge1xuXHQgIHJldHVybiB0YXNrUXVldWUubGVuZ3RoO1xuXHR9XG5cdC8qKlxuXHQgKiBBZGRzIGEgdGVzdCB0byB0aGUgVGVzdFF1ZXVlIGZvciBleGVjdXRpb24uXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RUYXNrc0Z1bmNcblx0ICogQHBhcmFtIHtCb29sZWFufSBwcmlvcml0aXplXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBzZWVkXG5cdCAqL1xuXG5cblx0ZnVuY3Rpb24gYWRkVG9UZXN0UXVldWUodGVzdFRhc2tzRnVuYywgcHJpb3JpdGl6ZSwgc2VlZCkge1xuXHQgIGlmIChwcmlvcml0aXplKSB7XG5cdCAgICBjb25maWcucXVldWUuc3BsaWNlKHByaW9yaXR5Q291bnQrKywgMCwgdGVzdFRhc2tzRnVuYyk7XG5cdCAgfSBlbHNlIGlmIChzZWVkKSB7XG5cdCAgICBpZiAoIXVuaXRTYW1wbGVyKSB7XG5cdCAgICAgIHVuaXRTYW1wbGVyID0gdW5pdFNhbXBsZXJHZW5lcmF0b3Ioc2VlZCk7XG5cdCAgICB9IC8vIEluc2VydCBpbnRvIGEgcmFuZG9tIHBvc2l0aW9uIGFmdGVyIGFsbCBwcmlvcml0aXplZCBpdGVtc1xuXG5cblx0ICAgIHZhciBpbmRleCA9IE1hdGguZmxvb3IodW5pdFNhbXBsZXIoKSAqIChjb25maWcucXVldWUubGVuZ3RoIC0gcHJpb3JpdHlDb3VudCArIDEpKTtcblx0ICAgIGNvbmZpZy5xdWV1ZS5zcGxpY2UocHJpb3JpdHlDb3VudCArIGluZGV4LCAwLCB0ZXN0VGFza3NGdW5jKTtcblx0ICB9IGVsc2Uge1xuXHQgICAgY29uZmlnLnF1ZXVlLnB1c2godGVzdFRhc2tzRnVuYyk7XG5cdCAgfVxuXHR9XG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgc2VlZGVkIFwic2FtcGxlXCIgZ2VuZXJhdG9yIHdoaWNoIGlzIHVzZWQgZm9yIHJhbmRvbWl6aW5nIHRlc3RzLlxuXHQgKi9cblxuXG5cdGZ1bmN0aW9uIHVuaXRTYW1wbGVyR2VuZXJhdG9yKHNlZWQpIHtcblx0ICAvLyAzMi1iaXQgeG9yc2hpZnQsIHJlcXVpcmVzIG9ubHkgYSBub256ZXJvIHNlZWRcblx0ICAvLyBodHRwczovL2V4Y2FtZXJhLmNvbS9zcGhpbngvYXJ0aWNsZS14b3JzaGlmdC5odG1sXG5cdCAgdmFyIHNhbXBsZSA9IHBhcnNlSW50KGdlbmVyYXRlSGFzaChzZWVkKSwgMTYpIHx8IC0xO1xuXHQgIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdCAgICBzYW1wbGUgXj0gc2FtcGxlIDw8IDEzO1xuXHQgICAgc2FtcGxlIF49IHNhbXBsZSA+Pj4gMTc7XG5cdCAgICBzYW1wbGUgXj0gc2FtcGxlIDw8IDU7IC8vIEVDTUFTY3JpcHQgaGFzIG5vIHVuc2lnbmVkIG51bWJlciB0eXBlXG5cblx0ICAgIGlmIChzYW1wbGUgPCAwKSB7XG5cdCAgICAgIHNhbXBsZSArPSAweDEwMDAwMDAwMDtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHNhbXBsZSAvIDB4MTAwMDAwMDAwO1xuXHQgIH07XG5cdH1cblx0LyoqXG5cdCAqIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdoZW4gdGhlIFByb2Nlc3NpbmdRdWV1ZSBpcyBkb25lIHByb2Nlc3NpbmcgYWxsXG5cdCAqIGl0ZW1zLiBJdCBoYW5kbGVzIGVtaXR0aW5nIHRoZSBmaW5hbCBydW4gZXZlbnRzLlxuXHQgKi9cblxuXG5cdGZ1bmN0aW9uIGRvbmUoKSB7XG5cdCAgdmFyIHN0b3JhZ2UgPSBjb25maWcuc3RvcmFnZTtcblx0ICBQcm9jZXNzaW5nUXVldWUuZmluaXNoZWQgPSB0cnVlO1xuXHQgIHZhciBydW50aW1lID0gbm93KCkgLSBjb25maWcuc3RhcnRlZDtcblx0ICB2YXIgcGFzc2VkID0gY29uZmlnLnN0YXRzLmFsbCAtIGNvbmZpZy5zdGF0cy5iYWQ7XG5cblx0ICBpZiAoY29uZmlnLnN0YXRzLnRlc3RDb3VudCA9PT0gMCkge1xuXHQgICAgaWYgKGNvbmZpZy5maWx0ZXIgJiYgY29uZmlnLmZpbHRlci5sZW5ndGgpIHtcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gdGVzdHMgbWF0Y2hlZCB0aGUgZmlsdGVyIFxcXCJcIi5jb25jYXQoY29uZmlnLmZpbHRlciwgXCJcXFwiLlwiKSk7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjb25maWcubW9kdWxlICYmIGNvbmZpZy5tb2R1bGUubGVuZ3RoKSB7XG5cdCAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHRlc3RzIG1hdGNoZWQgdGhlIG1vZHVsZSBcXFwiXCIuY29uY2F0KGNvbmZpZy5tb2R1bGUsIFwiXFxcIi5cIikpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY29uZmlnLm1vZHVsZUlkICYmIGNvbmZpZy5tb2R1bGVJZC5sZW5ndGgpIHtcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gdGVzdHMgbWF0Y2hlZCB0aGUgbW9kdWxlSWQgXFxcIlwiLmNvbmNhdChjb25maWcubW9kdWxlSWQsIFwiXFxcIi5cIikpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY29uZmlnLnRlc3RJZCAmJiBjb25maWcudGVzdElkLmxlbmd0aCkge1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyB0ZXN0cyBtYXRjaGVkIHRoZSB0ZXN0SWQgXFxcIlwiLmNvbmNhdChjb25maWcudGVzdElkLCBcIlxcXCIuXCIpKTtcblx0ICAgIH1cblxuXHQgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gdGVzdHMgd2VyZSBydW4uXCIpO1xuXHQgIH1cblxuXHQgIGVtaXQoXCJydW5FbmRcIiwgZ2xvYmFsU3VpdGUuZW5kKHRydWUpKTtcblx0ICBydW5Mb2dnaW5nQ2FsbGJhY2tzKFwiZG9uZVwiLCB7XG5cdCAgICBwYXNzZWQ6IHBhc3NlZCxcblx0ICAgIGZhaWxlZDogY29uZmlnLnN0YXRzLmJhZCxcblx0ICAgIHRvdGFsOiBjb25maWcuc3RhdHMuYWxsLFxuXHQgICAgcnVudGltZTogcnVudGltZVxuXHQgIH0pLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgLy8gQ2xlYXIgb3duIHN0b3JhZ2UgaXRlbXMgaWYgYWxsIHRlc3RzIHBhc3NlZFxuXHQgICAgaWYgKHN0b3JhZ2UgJiYgY29uZmlnLnN0YXRzLmJhZCA9PT0gMCkge1xuXHQgICAgICBmb3IgKHZhciBpID0gc3RvcmFnZS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHQgICAgICAgIHZhciBrZXkgPSBzdG9yYWdlLmtleShpKTtcblxuXHQgICAgICAgIGlmIChrZXkuaW5kZXhPZihcInF1bml0LXRlc3QtXCIpID09PSAwKSB7XG5cdCAgICAgICAgICBzdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9KTtcblx0fVxuXG5cdHZhciBQcm9jZXNzaW5nUXVldWUgPSB7XG5cdCAgZmluaXNoZWQ6IGZhbHNlLFxuXHQgIGFkZDogYWRkVG9UZXN0UXVldWUsXG5cdCAgYWR2YW5jZTogYWR2YW5jZSxcblx0ICB0YXNrQ291bnQ6IHRhc2tRdWV1ZUxlbmd0aFxuXHR9O1xuXG5cdHZhciBUZXN0UmVwb3J0ID0gLyojX19QVVJFX18qL2Z1bmN0aW9uICgpIHtcblx0ICBmdW5jdGlvbiBUZXN0UmVwb3J0KG5hbWUsIHN1aXRlLCBvcHRpb25zKSB7XG5cdCAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgVGVzdFJlcG9ydCk7XG5cblx0ICAgIHRoaXMubmFtZSA9IG5hbWU7XG5cdCAgICB0aGlzLnN1aXRlTmFtZSA9IHN1aXRlLm5hbWU7XG5cdCAgICB0aGlzLmZ1bGxOYW1lID0gc3VpdGUuZnVsbE5hbWUuY29uY2F0KG5hbWUpO1xuXHQgICAgdGhpcy5ydW50aW1lID0gMDtcblx0ICAgIHRoaXMuYXNzZXJ0aW9ucyA9IFtdO1xuXHQgICAgdGhpcy5za2lwcGVkID0gISFvcHRpb25zLnNraXA7XG5cdCAgICB0aGlzLnRvZG8gPSAhIW9wdGlvbnMudG9kbztcblx0ICAgIHRoaXMudmFsaWQgPSBvcHRpb25zLnZhbGlkO1xuXHQgICAgdGhpcy5fc3RhcnRUaW1lID0gMDtcblx0ICAgIHRoaXMuX2VuZFRpbWUgPSAwO1xuXHQgICAgc3VpdGUucHVzaFRlc3QodGhpcyk7XG5cdCAgfVxuXG5cdCAgX2NyZWF0ZUNsYXNzKFRlc3RSZXBvcnQsIFt7XG5cdCAgICBrZXk6IFwic3RhcnRcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBzdGFydChyZWNvcmRUaW1lKSB7XG5cdCAgICAgIGlmIChyZWNvcmRUaW1lKSB7XG5cdCAgICAgICAgdGhpcy5fc3RhcnRUaW1lID0gcGVyZm9ybWFuY2VOb3coKTtcblxuXHQgICAgICAgIGlmIChwZXJmb3JtYW5jZSkge1xuXHQgICAgICAgICAgcGVyZm9ybWFuY2UubWFyayhcInF1bml0X3Rlc3Rfc3RhcnRcIik7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIHtcblx0ICAgICAgICBuYW1lOiB0aGlzLm5hbWUsXG5cdCAgICAgICAgc3VpdGVOYW1lOiB0aGlzLnN1aXRlTmFtZSxcblx0ICAgICAgICBmdWxsTmFtZTogdGhpcy5mdWxsTmFtZS5zbGljZSgpXG5cdCAgICAgIH07XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImVuZFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGVuZChyZWNvcmRUaW1lKSB7XG5cdCAgICAgIGlmIChyZWNvcmRUaW1lKSB7XG5cdCAgICAgICAgdGhpcy5fZW5kVGltZSA9IHBlcmZvcm1hbmNlTm93KCk7XG5cblx0ICAgICAgICBpZiAocGVyZm9ybWFuY2UpIHtcblx0ICAgICAgICAgIHBlcmZvcm1hbmNlLm1hcmsoXCJxdW5pdF90ZXN0X2VuZFwiKTtcblx0ICAgICAgICAgIHZhciB0ZXN0TmFtZSA9IHRoaXMuZnVsbE5hbWUuam9pbihcIiDigJMgXCIpO1xuXHQgICAgICAgICAgbWVhc3VyZShcIlFVbml0IFRlc3Q6IFwiLmNvbmNhdCh0ZXN0TmFtZSksIFwicXVuaXRfdGVzdF9zdGFydFwiLCBcInF1bml0X3Rlc3RfZW5kXCIpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBleHRlbmQodGhpcy5zdGFydCgpLCB7XG5cdCAgICAgICAgcnVudGltZTogdGhpcy5nZXRSdW50aW1lKCksXG5cdCAgICAgICAgc3RhdHVzOiB0aGlzLmdldFN0YXR1cygpLFxuXHQgICAgICAgIGVycm9yczogdGhpcy5nZXRGYWlsZWRBc3NlcnRpb25zKCksXG5cdCAgICAgICAgYXNzZXJ0aW9uczogdGhpcy5nZXRBc3NlcnRpb25zKClcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcInB1c2hBc3NlcnRpb25cIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBwdXNoQXNzZXJ0aW9uKGFzc2VydGlvbikge1xuXHQgICAgICB0aGlzLmFzc2VydGlvbnMucHVzaChhc3NlcnRpb24pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJnZXRSdW50aW1lXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0UnVudGltZSgpIHtcblx0ICAgICAgcmV0dXJuIHRoaXMuX2VuZFRpbWUgLSB0aGlzLl9zdGFydFRpbWU7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImdldFN0YXR1c1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGdldFN0YXR1cygpIHtcblx0ICAgICAgaWYgKHRoaXMuc2tpcHBlZCkge1xuXHQgICAgICAgIHJldHVybiBcInNraXBwZWRcIjtcblx0ICAgICAgfVxuXG5cdCAgICAgIHZhciB0ZXN0UGFzc2VkID0gdGhpcy5nZXRGYWlsZWRBc3NlcnRpb25zKCkubGVuZ3RoID4gMCA/IHRoaXMudG9kbyA6ICF0aGlzLnRvZG87XG5cblx0ICAgICAgaWYgKCF0ZXN0UGFzc2VkKSB7XG5cdCAgICAgICAgcmV0dXJuIFwiZmFpbGVkXCI7XG5cdCAgICAgIH0gZWxzZSBpZiAodGhpcy50b2RvKSB7XG5cdCAgICAgICAgcmV0dXJuIFwidG9kb1wiO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHJldHVybiBcInBhc3NlZFwiO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImdldEZhaWxlZEFzc2VydGlvbnNcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRGYWlsZWRBc3NlcnRpb25zKCkge1xuXHQgICAgICByZXR1cm4gdGhpcy5hc3NlcnRpb25zLmZpbHRlcihmdW5jdGlvbiAoYXNzZXJ0aW9uKSB7XG5cdCAgICAgICAgcmV0dXJuICFhc3NlcnRpb24ucGFzc2VkO1xuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZ2V0QXNzZXJ0aW9uc1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGdldEFzc2VydGlvbnMoKSB7XG5cdCAgICAgIHJldHVybiB0aGlzLmFzc2VydGlvbnMuc2xpY2UoKTtcblx0ICAgIH0gLy8gUmVtb3ZlIGFjdHVhbCBhbmQgZXhwZWN0ZWQgdmFsdWVzIGZyb20gYXNzZXJ0aW9ucy4gVGhpcyBpcyB0byBwcmV2ZW50XG5cdCAgICAvLyBsZWFraW5nIG1lbW9yeSB0aHJvdWdob3V0IGEgdGVzdCBzdWl0ZS5cblxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJzbGltQXNzZXJ0aW9uc1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHNsaW1Bc3NlcnRpb25zKCkge1xuXHQgICAgICB0aGlzLmFzc2VydGlvbnMgPSB0aGlzLmFzc2VydGlvbnMubWFwKGZ1bmN0aW9uIChhc3NlcnRpb24pIHtcblx0ICAgICAgICBkZWxldGUgYXNzZXJ0aW9uLmFjdHVhbDtcblx0ICAgICAgICBkZWxldGUgYXNzZXJ0aW9uLmV4cGVjdGVkO1xuXHQgICAgICAgIHJldHVybiBhc3NlcnRpb247XG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH1dKTtcblxuXHQgIHJldHVybiBUZXN0UmVwb3J0O1xuXHR9KCk7XG5cblx0dmFyIGZvY3VzZWQkMSA9IGZhbHNlO1xuXHRmdW5jdGlvbiBUZXN0KHNldHRpbmdzKSB7XG5cdCAgdmFyIGksIGw7XG5cdCAgKytUZXN0LmNvdW50O1xuXHQgIHRoaXMuZXhwZWN0ZWQgPSBudWxsO1xuXHQgIHRoaXMuYXNzZXJ0aW9ucyA9IFtdO1xuXHQgIHRoaXMuc2VtYXBob3JlID0gMDtcblx0ICB0aGlzLm1vZHVsZSA9IGNvbmZpZy5jdXJyZW50TW9kdWxlO1xuXHQgIHRoaXMuc3RlcHMgPSBbXTtcblx0ICB0aGlzLnRpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdCAgdGhpcy5lcnJvckZvclN0YWNrID0gbmV3IEVycm9yKCk7IC8vIElmIGEgbW9kdWxlIGlzIHNraXBwZWQsIGFsbCBpdHMgdGVzdHMgYW5kIHRoZSB0ZXN0cyBvZiB0aGUgY2hpbGQgc3VpdGVzXG5cdCAgLy8gc2hvdWxkIGJlIHRyZWF0ZWQgYXMgc2tpcHBlZCBldmVuIGlmIHRoZXkgYXJlIGRlZmluZWQgYXMgYG9ubHlgIG9yIGB0b2RvYC5cblx0ICAvLyBBcyBmb3IgYHRvZG9gIG1vZHVsZSwgYWxsIGl0cyB0ZXN0cyB3aWxsIGJlIHRyZWF0ZWQgYXMgYHRvZG9gIGV4Y2VwdCBmb3Jcblx0ICAvLyB0ZXN0cyBkZWZpbmVkIGFzIGBza2lwYCB3aGljaCB3aWxsIGJlIGxlZnQgaW50YWN0LlxuXHQgIC8vXG5cdCAgLy8gU28sIGlmIGEgdGVzdCBpcyBkZWZpbmVkIGFzIGB0b2RvYCBhbmQgaXMgaW5zaWRlIGEgc2tpcHBlZCBtb2R1bGUsIHdlIHNob3VsZFxuXHQgIC8vIHRoZW4gdHJlYXQgdGhhdCB0ZXN0IGFzIGlmIHdhcyBkZWZpbmVkIGFzIGBza2lwYC5cblxuXHQgIGlmICh0aGlzLm1vZHVsZS5za2lwKSB7XG5cdCAgICBzZXR0aW5ncy5za2lwID0gdHJ1ZTtcblx0ICAgIHNldHRpbmdzLnRvZG8gPSBmYWxzZTsgLy8gU2tpcHBlZCB0ZXN0cyBzaG91bGQgYmUgbGVmdCBpbnRhY3Rcblx0ICB9IGVsc2UgaWYgKHRoaXMubW9kdWxlLnRvZG8gJiYgIXNldHRpbmdzLnNraXApIHtcblx0ICAgIHNldHRpbmdzLnRvZG8gPSB0cnVlO1xuXHQgIH1cblxuXHQgIGV4dGVuZCh0aGlzLCBzZXR0aW5ncyk7XG5cdCAgdGhpcy50ZXN0UmVwb3J0ID0gbmV3IFRlc3RSZXBvcnQoc2V0dGluZ3MudGVzdE5hbWUsIHRoaXMubW9kdWxlLnN1aXRlUmVwb3J0LCB7XG5cdCAgICB0b2RvOiBzZXR0aW5ncy50b2RvLFxuXHQgICAgc2tpcDogc2V0dGluZ3Muc2tpcCxcblx0ICAgIHZhbGlkOiB0aGlzLnZhbGlkKClcblx0ICB9KTsgLy8gUmVnaXN0ZXIgdW5pcXVlIHN0cmluZ3NcblxuXHQgIGZvciAoaSA9IDAsIGwgPSB0aGlzLm1vZHVsZS50ZXN0czsgaSA8IGwubGVuZ3RoOyBpKyspIHtcblx0ICAgIGlmICh0aGlzLm1vZHVsZS50ZXN0c1tpXS5uYW1lID09PSB0aGlzLnRlc3ROYW1lKSB7XG5cdCAgICAgIHRoaXMudGVzdE5hbWUgKz0gXCIgXCI7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgdGhpcy50ZXN0SWQgPSBnZW5lcmF0ZUhhc2godGhpcy5tb2R1bGUubmFtZSwgdGhpcy50ZXN0TmFtZSk7XG5cdCAgdGhpcy5tb2R1bGUudGVzdHMucHVzaCh7XG5cdCAgICBuYW1lOiB0aGlzLnRlc3ROYW1lLFxuXHQgICAgdGVzdElkOiB0aGlzLnRlc3RJZCxcblx0ICAgIHNraXA6ICEhc2V0dGluZ3Muc2tpcFxuXHQgIH0pO1xuXG5cdCAgaWYgKHNldHRpbmdzLnNraXApIHtcblx0ICAgIC8vIFNraXBwZWQgdGVzdHMgd2lsbCBmdWxseSBpZ25vcmUgYW55IHNlbnQgY2FsbGJhY2tcblx0ICAgIHRoaXMuY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcblxuXHQgICAgdGhpcy5hc3luYyA9IGZhbHNlO1xuXHQgICAgdGhpcy5leHBlY3RlZCA9IDA7XG5cdCAgfSBlbHNlIHtcblx0ICAgIGlmICh0eXBlb2YgdGhpcy5jYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdCAgICAgIHZhciBtZXRob2QgPSB0aGlzLnRvZG8gPyBcInRvZG9cIiA6IFwidGVzdFwiOyAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxlblxuXG5cdCAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJZb3UgbXVzdCBwcm92aWRlIGEgZnVuY3Rpb24gYXMgYSB0ZXN0IGNhbGxiYWNrIHRvIFFVbml0LlwiLmNvbmNhdChtZXRob2QsIFwiKFxcXCJcIikuY29uY2F0KHNldHRpbmdzLnRlc3ROYW1lLCBcIlxcXCIpXCIpKTtcblx0ICAgIH1cblxuXHQgICAgdGhpcy5hc3NlcnQgPSBuZXcgQXNzZXJ0KHRoaXMpO1xuXHQgIH1cblx0fVxuXHRUZXN0LmNvdW50ID0gMDtcblxuXHRmdW5jdGlvbiBnZXROb3RTdGFydGVkTW9kdWxlcyhzdGFydE1vZHVsZSkge1xuXHQgIHZhciBtb2R1bGUgPSBzdGFydE1vZHVsZSxcblx0ICAgICAgbW9kdWxlcyA9IFtdO1xuXG5cdCAgd2hpbGUgKG1vZHVsZSAmJiBtb2R1bGUudGVzdHNSdW4gPT09IDApIHtcblx0ICAgIG1vZHVsZXMucHVzaChtb2R1bGUpO1xuXHQgICAgbW9kdWxlID0gbW9kdWxlLnBhcmVudE1vZHVsZTtcblx0ICB9IC8vIFRoZSBhYm92ZSBwdXNoIG1vZHVsZXMgZnJvbSB0aGUgY2hpbGQgdG8gdGhlIHBhcmVudFxuXHQgIC8vIHJldHVybiBhIHJldmVyc2VkIG9yZGVyIHdpdGggdGhlIHRvcCBiZWluZyB0aGUgdG9wIG1vc3QgcGFyZW50IG1vZHVsZVxuXG5cblx0ICByZXR1cm4gbW9kdWxlcy5yZXZlcnNlKCk7XG5cdH1cblxuXHRUZXN0LnByb3RvdHlwZSA9IHtcblx0ICAvLyBnZW5lcmF0aW5nIGEgc3RhY2sgdHJhY2UgY2FuIGJlIGV4cGVuc2l2ZSwgc28gdXNpbmcgYSBnZXR0ZXIgZGVmZXJzIHRoaXMgdW50aWwgd2UgbmVlZCBpdFxuXHQgIGdldCBzdGFjaygpIHtcblx0ICAgIHJldHVybiBleHRyYWN0U3RhY2t0cmFjZSh0aGlzLmVycm9yRm9yU3RhY2ssIDIpO1xuXHQgIH0sXG5cblx0ICBiZWZvcmU6IGZ1bmN0aW9uIGJlZm9yZSgpIHtcblx0ICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cblx0ICAgIHZhciBtb2R1bGUgPSB0aGlzLm1vZHVsZSxcblx0ICAgICAgICBub3RTdGFydGVkTW9kdWxlcyA9IGdldE5vdFN0YXJ0ZWRNb2R1bGVzKG1vZHVsZSk7IC8vIGVuc3VyZSB0aGUgY2FsbGJhY2tzIGFyZSBleGVjdXRlZCBzZXJpYWxseSBmb3IgZWFjaCBtb2R1bGVcblxuXHQgICAgdmFyIGNhbGxiYWNrUHJvbWlzZXMgPSBub3RTdGFydGVkTW9kdWxlcy5yZWR1Y2UoZnVuY3Rpb24gKHByb21pc2VDaGFpbiwgc3RhcnRNb2R1bGUpIHtcblx0ICAgICAgcmV0dXJuIHByb21pc2VDaGFpbi50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBzdGFydE1vZHVsZS5zdGF0cyA9IHtcblx0ICAgICAgICAgIGFsbDogMCxcblx0ICAgICAgICAgIGJhZDogMCxcblx0ICAgICAgICAgIHN0YXJ0ZWQ6IG5vdygpXG5cdCAgICAgICAgfTtcblx0ICAgICAgICBlbWl0KFwic3VpdGVTdGFydFwiLCBzdGFydE1vZHVsZS5zdWl0ZVJlcG9ydC5zdGFydCh0cnVlKSk7XG5cdCAgICAgICAgcmV0dXJuIHJ1bkxvZ2dpbmdDYWxsYmFja3MoXCJtb2R1bGVTdGFydFwiLCB7XG5cdCAgICAgICAgICBuYW1lOiBzdGFydE1vZHVsZS5uYW1lLFxuXHQgICAgICAgICAgdGVzdHM6IHN0YXJ0TW9kdWxlLnRlc3RzXG5cdCAgICAgICAgfSk7XG5cdCAgICAgIH0pO1xuXHQgICAgfSwgUHJvbWlzZSQxLnJlc29sdmUoW10pKTtcblx0ICAgIHJldHVybiBjYWxsYmFja1Byb21pc2VzLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgICBjb25maWcuY3VycmVudCA9IF90aGlzO1xuXHQgICAgICBfdGhpcy50ZXN0RW52aXJvbm1lbnQgPSBleHRlbmQoe30sIG1vZHVsZS50ZXN0RW52aXJvbm1lbnQpO1xuXHQgICAgICBfdGhpcy5zdGFydGVkID0gbm93KCk7XG5cdCAgICAgIGVtaXQoXCJ0ZXN0U3RhcnRcIiwgX3RoaXMudGVzdFJlcG9ydC5zdGFydCh0cnVlKSk7XG5cdCAgICAgIHJldHVybiBydW5Mb2dnaW5nQ2FsbGJhY2tzKFwidGVzdFN0YXJ0XCIsIHtcblx0ICAgICAgICBuYW1lOiBfdGhpcy50ZXN0TmFtZSxcblx0ICAgICAgICBtb2R1bGU6IG1vZHVsZS5uYW1lLFxuXHQgICAgICAgIHRlc3RJZDogX3RoaXMudGVzdElkLFxuXHQgICAgICAgIHByZXZpb3VzRmFpbHVyZTogX3RoaXMucHJldmlvdXNGYWlsdXJlXG5cdCAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIGlmICghY29uZmlnLnBvbGx1dGlvbikge1xuXHQgICAgICAgICAgc2F2ZUdsb2JhbCgpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cdCAgICB9KTtcblx0ICB9LFxuXHQgIHJ1bjogZnVuY3Rpb24gcnVuKCkge1xuXHQgICAgdmFyIHByb21pc2U7XG5cdCAgICBjb25maWcuY3VycmVudCA9IHRoaXM7XG5cdCAgICB0aGlzLmNhbGxiYWNrU3RhcnRlZCA9IG5vdygpO1xuXG5cdCAgICBpZiAoY29uZmlnLm5vdHJ5Y2F0Y2gpIHtcblx0ICAgICAgcnVuVGVzdCh0aGlzKTtcblx0ICAgICAgcmV0dXJuO1xuXHQgICAgfVxuXG5cdCAgICB0cnkge1xuXHQgICAgICBydW5UZXN0KHRoaXMpO1xuXHQgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICB0aGlzLnB1c2hGYWlsdXJlKFwiRGllZCBvbiB0ZXN0ICNcIiArICh0aGlzLmFzc2VydGlvbnMubGVuZ3RoICsgMSkgKyBcIiBcIiArIHRoaXMuc3RhY2sgKyBcIjogXCIgKyAoZS5tZXNzYWdlIHx8IGUpLCBleHRyYWN0U3RhY2t0cmFjZShlLCAwKSk7IC8vIEVsc2UgbmV4dCB0ZXN0IHdpbGwgY2FycnkgdGhlIHJlc3BvbnNpYmlsaXR5XG5cblx0ICAgICAgc2F2ZUdsb2JhbCgpOyAvLyBSZXN0YXJ0IHRoZSB0ZXN0cyBpZiB0aGV5J3JlIGJsb2NraW5nXG5cblx0ICAgICAgaWYgKGNvbmZpZy5ibG9ja2luZykge1xuXHQgICAgICAgIGludGVybmFsUmVjb3Zlcih0aGlzKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBydW5UZXN0KHRlc3QpIHtcblx0ICAgICAgcHJvbWlzZSA9IHRlc3QuY2FsbGJhY2suY2FsbCh0ZXN0LnRlc3RFbnZpcm9ubWVudCwgdGVzdC5hc3NlcnQpO1xuXHQgICAgICB0ZXN0LnJlc29sdmVQcm9taXNlKHByb21pc2UpOyAvLyBJZiB0aGUgdGVzdCBoYXMgYSBcImxvY2tcIiBvbiBpdCwgYnV0IHRoZSB0aW1lb3V0IGlzIDAsIHRoZW4gd2UgcHVzaCBhXG5cdCAgICAgIC8vIGZhaWx1cmUgYXMgdGhlIHRlc3Qgc2hvdWxkIGJlIHN5bmNocm9ub3VzLlxuXG5cdCAgICAgIGlmICh0ZXN0LnRpbWVvdXQgPT09IDAgJiYgdGVzdC5zZW1hcGhvcmUgIT09IDApIHtcblx0ICAgICAgICBwdXNoRmFpbHVyZShcIlRlc3QgZGlkIG5vdCBmaW5pc2ggc3luY2hyb25vdXNseSBldmVuIHRob3VnaCBhc3NlcnQudGltZW91dCggMCApIHdhcyB1c2VkLlwiLCBzb3VyY2VGcm9tU3RhY2t0cmFjZSgyKSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9LFxuXHQgIGFmdGVyOiBmdW5jdGlvbiBhZnRlcigpIHtcblx0ICAgIGNoZWNrUG9sbHV0aW9uKCk7XG5cdCAgfSxcblx0ICBxdWV1ZUhvb2s6IGZ1bmN0aW9uIHF1ZXVlSG9vayhob29rLCBob29rTmFtZSwgaG9va093bmVyKSB7XG5cdCAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuXHQgICAgdmFyIGNhbGxIb29rID0gZnVuY3Rpb24gY2FsbEhvb2soKSB7XG5cdCAgICAgIHZhciBwcm9taXNlID0gaG9vay5jYWxsKF90aGlzMi50ZXN0RW52aXJvbm1lbnQsIF90aGlzMi5hc3NlcnQpO1xuXG5cdCAgICAgIF90aGlzMi5yZXNvbHZlUHJvbWlzZShwcm9taXNlLCBob29rTmFtZSk7XG5cdCAgICB9O1xuXG5cdCAgICB2YXIgcnVuSG9vayA9IGZ1bmN0aW9uIHJ1bkhvb2soKSB7XG5cdCAgICAgIGlmIChob29rTmFtZSA9PT0gXCJiZWZvcmVcIikge1xuXHQgICAgICAgIGlmIChob29rT3duZXIudW5za2lwcGVkVGVzdHNSdW4gIT09IDApIHtcblx0ICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBfdGhpczIucHJlc2VydmVFbnZpcm9ubWVudCA9IHRydWU7XG5cdCAgICAgIH0gLy8gVGhlICdhZnRlcicgaG9vayBzaG91bGQgb25seSBleGVjdXRlIHdoZW4gdGhlcmUgYXJlIG5vdCB0ZXN0cyBsZWZ0IGFuZFxuXHQgICAgICAvLyB3aGVuIHRoZSAnYWZ0ZXInIGFuZCAnZmluaXNoJyB0YXNrcyBhcmUgdGhlIG9ubHkgdGFza3MgbGVmdCB0byBwcm9jZXNzXG5cblxuXHQgICAgICBpZiAoaG9va05hbWUgPT09IFwiYWZ0ZXJcIiAmJiBob29rT3duZXIudW5za2lwcGVkVGVzdHNSdW4gIT09IG51bWJlck9mVW5za2lwcGVkVGVzdHMoaG9va093bmVyKSAtIDEgJiYgKGNvbmZpZy5xdWV1ZS5sZW5ndGggPiAwIHx8IFByb2Nlc3NpbmdRdWV1ZS50YXNrQ291bnQoKSA+IDIpKSB7XG5cdCAgICAgICAgcmV0dXJuO1xuXHQgICAgICB9XG5cblx0ICAgICAgY29uZmlnLmN1cnJlbnQgPSBfdGhpczI7XG5cblx0ICAgICAgaWYgKGNvbmZpZy5ub3RyeWNhdGNoKSB7XG5cdCAgICAgICAgY2FsbEhvb2soKTtcblx0ICAgICAgICByZXR1cm47XG5cdCAgICAgIH1cblxuXHQgICAgICB0cnkge1xuXHQgICAgICAgIGNhbGxIb29rKCk7XG5cdCAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG5cdCAgICAgICAgX3RoaXMyLnB1c2hGYWlsdXJlKGhvb2tOYW1lICsgXCIgZmFpbGVkIG9uIFwiICsgX3RoaXMyLnRlc3ROYW1lICsgXCI6IFwiICsgKGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpLCBleHRyYWN0U3RhY2t0cmFjZShlcnJvciwgMCkpO1xuXHQgICAgICB9XG5cdCAgICB9O1xuXG5cdCAgICByZXR1cm4gcnVuSG9vaztcblx0ICB9LFxuXHQgIC8vIEN1cnJlbnRseSBvbmx5IHVzZWQgZm9yIG1vZHVsZSBsZXZlbCBob29rcywgY2FuIGJlIHVzZWQgdG8gYWRkIGdsb2JhbCBsZXZlbCBvbmVzXG5cdCAgaG9va3M6IGZ1bmN0aW9uIGhvb2tzKGhhbmRsZXIpIHtcblx0ICAgIHZhciBob29rcyA9IFtdO1xuXG5cdCAgICBmdW5jdGlvbiBwcm9jZXNzSG9va3ModGVzdCwgbW9kdWxlKSB7XG5cdCAgICAgIGlmIChtb2R1bGUucGFyZW50TW9kdWxlKSB7XG5cdCAgICAgICAgcHJvY2Vzc0hvb2tzKHRlc3QsIG1vZHVsZS5wYXJlbnRNb2R1bGUpO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKG1vZHVsZS5ob29rc1toYW5kbGVyXS5sZW5ndGgpIHtcblx0ICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1vZHVsZS5ob29rc1toYW5kbGVyXS5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgaG9va3MucHVzaCh0ZXN0LnF1ZXVlSG9vayhtb2R1bGUuaG9va3NbaGFuZGxlcl1baV0sIGhhbmRsZXIsIG1vZHVsZSkpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfSAvLyBIb29rcyBhcmUgaWdub3JlZCBvbiBza2lwcGVkIHRlc3RzXG5cblxuXHQgICAgaWYgKCF0aGlzLnNraXApIHtcblx0ICAgICAgcHJvY2Vzc0hvb2tzKHRoaXMsIHRoaXMubW9kdWxlKTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGhvb2tzO1xuXHQgIH0sXG5cdCAgZmluaXNoOiBmdW5jdGlvbiBmaW5pc2goKSB7XG5cdCAgICBjb25maWcuY3VycmVudCA9IHRoaXM7IC8vIFJlbGVhc2UgdGhlIHRlc3QgY2FsbGJhY2sgdG8gZW5zdXJlIHRoYXQgYW55dGhpbmcgcmVmZXJlbmNlZCBoYXMgYmVlblxuXHQgICAgLy8gcmVsZWFzZWQgdG8gYmUgZ2FyYmFnZSBjb2xsZWN0ZWQuXG5cblx0ICAgIHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XG5cblx0ICAgIGlmICh0aGlzLnN0ZXBzLmxlbmd0aCkge1xuXHQgICAgICB2YXIgc3RlcHNMaXN0ID0gdGhpcy5zdGVwcy5qb2luKFwiLCBcIik7XG5cdCAgICAgIHRoaXMucHVzaEZhaWx1cmUoXCJFeHBlY3RlZCBhc3NlcnQudmVyaWZ5U3RlcHMoKSB0byBiZSBjYWxsZWQgYmVmb3JlIGVuZCBvZiB0ZXN0IFwiICsgXCJhZnRlciB1c2luZyBhc3NlcnQuc3RlcCgpLiBVbnZlcmlmaWVkIHN0ZXBzOiBcIi5jb25jYXQoc3RlcHNMaXN0KSwgdGhpcy5zdGFjayk7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjb25maWcucmVxdWlyZUV4cGVjdHMgJiYgdGhpcy5leHBlY3RlZCA9PT0gbnVsbCkge1xuXHQgICAgICB0aGlzLnB1c2hGYWlsdXJlKFwiRXhwZWN0ZWQgbnVtYmVyIG9mIGFzc2VydGlvbnMgdG8gYmUgZGVmaW5lZCwgYnV0IGV4cGVjdCgpIHdhcyBcIiArIFwibm90IGNhbGxlZC5cIiwgdGhpcy5zdGFjayk7XG5cdCAgICB9IGVsc2UgaWYgKHRoaXMuZXhwZWN0ZWQgIT09IG51bGwgJiYgdGhpcy5leHBlY3RlZCAhPT0gdGhpcy5hc3NlcnRpb25zLmxlbmd0aCkge1xuXHQgICAgICB0aGlzLnB1c2hGYWlsdXJlKFwiRXhwZWN0ZWQgXCIgKyB0aGlzLmV4cGVjdGVkICsgXCIgYXNzZXJ0aW9ucywgYnV0IFwiICsgdGhpcy5hc3NlcnRpb25zLmxlbmd0aCArIFwiIHdlcmUgcnVuXCIsIHRoaXMuc3RhY2spO1xuXHQgICAgfSBlbHNlIGlmICh0aGlzLmV4cGVjdGVkID09PSBudWxsICYmICF0aGlzLmFzc2VydGlvbnMubGVuZ3RoKSB7XG5cdCAgICAgIHRoaXMucHVzaEZhaWx1cmUoXCJFeHBlY3RlZCBhdCBsZWFzdCBvbmUgYXNzZXJ0aW9uLCBidXQgbm9uZSB3ZXJlIHJ1biAtIGNhbGwgXCIgKyBcImV4cGVjdCgwKSB0byBhY2NlcHQgemVybyBhc3NlcnRpb25zLlwiLCB0aGlzLnN0YWNrKTtcblx0ICAgIH1cblxuXHQgICAgdmFyIGksXG5cdCAgICAgICAgbW9kdWxlID0gdGhpcy5tb2R1bGUsXG5cdCAgICAgICAgbW9kdWxlTmFtZSA9IG1vZHVsZS5uYW1lLFxuXHQgICAgICAgIHRlc3ROYW1lID0gdGhpcy50ZXN0TmFtZSxcblx0ICAgICAgICBza2lwcGVkID0gISF0aGlzLnNraXAsXG5cdCAgICAgICAgdG9kbyA9ICEhdGhpcy50b2RvLFxuXHQgICAgICAgIGJhZCA9IDAsXG5cdCAgICAgICAgc3RvcmFnZSA9IGNvbmZpZy5zdG9yYWdlO1xuXHQgICAgdGhpcy5ydW50aW1lID0gbm93KCkgLSB0aGlzLnN0YXJ0ZWQ7XG5cdCAgICBjb25maWcuc3RhdHMuYWxsICs9IHRoaXMuYXNzZXJ0aW9ucy5sZW5ndGg7XG5cdCAgICBjb25maWcuc3RhdHMudGVzdENvdW50ICs9IDE7XG5cdCAgICBtb2R1bGUuc3RhdHMuYWxsICs9IHRoaXMuYXNzZXJ0aW9ucy5sZW5ndGg7XG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmFzc2VydGlvbnMubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgaWYgKCF0aGlzLmFzc2VydGlvbnNbaV0ucmVzdWx0KSB7XG5cdCAgICAgICAgYmFkKys7XG5cdCAgICAgICAgY29uZmlnLnN0YXRzLmJhZCsrO1xuXHQgICAgICAgIG1vZHVsZS5zdGF0cy5iYWQrKztcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBub3RpZnlUZXN0c1Jhbihtb2R1bGUsIHNraXBwZWQpOyAvLyBTdG9yZSByZXN1bHQgd2hlbiBwb3NzaWJsZVxuXG5cdCAgICBpZiAoc3RvcmFnZSkge1xuXHQgICAgICBpZiAoYmFkKSB7XG5cdCAgICAgICAgc3RvcmFnZS5zZXRJdGVtKFwicXVuaXQtdGVzdC1cIiArIG1vZHVsZU5hbWUgKyBcIi1cIiArIHRlc3ROYW1lLCBiYWQpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHN0b3JhZ2UucmVtb3ZlSXRlbShcInF1bml0LXRlc3QtXCIgKyBtb2R1bGVOYW1lICsgXCItXCIgKyB0ZXN0TmFtZSk7XG5cdCAgICAgIH1cblx0ICAgIH0gLy8gQWZ0ZXIgZW1pdHRpbmcgdGhlIGpzLXJlcG9ydGVycyBldmVudCB3ZSBjbGVhbnVwIHRoZSBhc3NlcnRpb24gZGF0YSB0b1xuXHQgICAgLy8gYXZvaWQgbGVha2luZyBpdC4gSXQgaXMgbm90IHVzZWQgYnkgdGhlIGxlZ2FjeSB0ZXN0RG9uZSBjYWxsYmFja3MuXG5cblxuXHQgICAgZW1pdChcInRlc3RFbmRcIiwgdGhpcy50ZXN0UmVwb3J0LmVuZCh0cnVlKSk7XG5cdCAgICB0aGlzLnRlc3RSZXBvcnQuc2xpbUFzc2VydGlvbnMoKTtcblx0ICAgIHZhciB0ZXN0ID0gdGhpcztcblx0ICAgIHJldHVybiBydW5Mb2dnaW5nQ2FsbGJhY2tzKFwidGVzdERvbmVcIiwge1xuXHQgICAgICBuYW1lOiB0ZXN0TmFtZSxcblx0ICAgICAgbW9kdWxlOiBtb2R1bGVOYW1lLFxuXHQgICAgICBza2lwcGVkOiBza2lwcGVkLFxuXHQgICAgICB0b2RvOiB0b2RvLFxuXHQgICAgICBmYWlsZWQ6IGJhZCxcblx0ICAgICAgcGFzc2VkOiB0aGlzLmFzc2VydGlvbnMubGVuZ3RoIC0gYmFkLFxuXHQgICAgICB0b3RhbDogdGhpcy5hc3NlcnRpb25zLmxlbmd0aCxcblx0ICAgICAgcnVudGltZTogc2tpcHBlZCA/IDAgOiB0aGlzLnJ1bnRpbWUsXG5cdCAgICAgIC8vIEhUTUwgUmVwb3J0ZXIgdXNlXG5cdCAgICAgIGFzc2VydGlvbnM6IHRoaXMuYXNzZXJ0aW9ucyxcblx0ICAgICAgdGVzdElkOiB0aGlzLnRlc3RJZCxcblxuXHQgICAgICAvLyBTb3VyY2Ugb2YgVGVzdFxuXHQgICAgICAvLyBnZW5lcmF0aW5nIHN0YWNrIHRyYWNlIGlzIGV4cGVuc2l2ZSwgc28gdXNpbmcgYSBnZXR0ZXIgd2lsbCBoZWxwIGRlZmVyIHRoaXMgdW50aWwgd2UgbmVlZCBpdFxuXHQgICAgICBnZXQgc291cmNlKCkge1xuXHQgICAgICAgIHJldHVybiB0ZXN0LnN0YWNrO1xuXHQgICAgICB9XG5cblx0ICAgIH0pLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgICBpZiAobW9kdWxlLnRlc3RzUnVuID09PSBudW1iZXJPZlRlc3RzKG1vZHVsZSkpIHtcblx0ICAgICAgICB2YXIgY29tcGxldGVkTW9kdWxlcyA9IFttb2R1bGVdOyAvLyBDaGVjayBpZiB0aGUgcGFyZW50IG1vZHVsZXMsIGl0ZXJhdGl2ZWx5LCBhcmUgZG9uZS4gSWYgdGhhdCB0aGUgY2FzZSxcblx0ICAgICAgICAvLyB3ZSBlbWl0IHRoZSBgc3VpdGVFbmRgIGV2ZW50IGFuZCB0cmlnZ2VyIGBtb2R1bGVEb25lYCBjYWxsYmFjay5cblxuXHQgICAgICAgIHZhciBwYXJlbnQgPSBtb2R1bGUucGFyZW50TW9kdWxlO1xuXG5cdCAgICAgICAgd2hpbGUgKHBhcmVudCAmJiBwYXJlbnQudGVzdHNSdW4gPT09IG51bWJlck9mVGVzdHMocGFyZW50KSkge1xuXHQgICAgICAgICAgY29tcGxldGVkTW9kdWxlcy5wdXNoKHBhcmVudCk7XG5cdCAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50TW9kdWxlO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHJldHVybiBjb21wbGV0ZWRNb2R1bGVzLnJlZHVjZShmdW5jdGlvbiAocHJvbWlzZUNoYWluLCBjb21wbGV0ZWRNb2R1bGUpIHtcblx0ICAgICAgICAgIHJldHVybiBwcm9taXNlQ2hhaW4udGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgIHJldHVybiBsb2dTdWl0ZUVuZChjb21wbGV0ZWRNb2R1bGUpO1xuXHQgICAgICAgICAgfSk7XG5cdCAgICAgICAgfSwgUHJvbWlzZSQxLnJlc29sdmUoW10pKTtcblx0ICAgICAgfVxuXHQgICAgfSkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGNvbmZpZy5jdXJyZW50ID0gdW5kZWZpbmVkO1xuXHQgICAgfSk7XG5cblx0ICAgIGZ1bmN0aW9uIGxvZ1N1aXRlRW5kKG1vZHVsZSkge1xuXHQgICAgICAvLyBSZXNldCBgbW9kdWxlLmhvb2tzYCB0byBlbnN1cmUgdGhhdCBhbnl0aGluZyByZWZlcmVuY2VkIGluIHRoZXNlIGhvb2tzXG5cdCAgICAgIC8vIGhhcyBiZWVuIHJlbGVhc2VkIHRvIGJlIGdhcmJhZ2UgY29sbGVjdGVkLlxuXHQgICAgICBtb2R1bGUuaG9va3MgPSB7fTtcblx0ICAgICAgZW1pdChcInN1aXRlRW5kXCIsIG1vZHVsZS5zdWl0ZVJlcG9ydC5lbmQodHJ1ZSkpO1xuXHQgICAgICByZXR1cm4gcnVuTG9nZ2luZ0NhbGxiYWNrcyhcIm1vZHVsZURvbmVcIiwge1xuXHQgICAgICAgIG5hbWU6IG1vZHVsZS5uYW1lLFxuXHQgICAgICAgIHRlc3RzOiBtb2R1bGUudGVzdHMsXG5cdCAgICAgICAgZmFpbGVkOiBtb2R1bGUuc3RhdHMuYmFkLFxuXHQgICAgICAgIHBhc3NlZDogbW9kdWxlLnN0YXRzLmFsbCAtIG1vZHVsZS5zdGF0cy5iYWQsXG5cdCAgICAgICAgdG90YWw6IG1vZHVsZS5zdGF0cy5hbGwsXG5cdCAgICAgICAgcnVudGltZTogbm93KCkgLSBtb2R1bGUuc3RhdHMuc3RhcnRlZFxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LFxuXHQgIHByZXNlcnZlVGVzdEVudmlyb25tZW50OiBmdW5jdGlvbiBwcmVzZXJ2ZVRlc3RFbnZpcm9ubWVudCgpIHtcblx0ICAgIGlmICh0aGlzLnByZXNlcnZlRW52aXJvbm1lbnQpIHtcblx0ICAgICAgdGhpcy5tb2R1bGUudGVzdEVudmlyb25tZW50ID0gdGhpcy50ZXN0RW52aXJvbm1lbnQ7XG5cdCAgICAgIHRoaXMudGVzdEVudmlyb25tZW50ID0gZXh0ZW5kKHt9LCB0aGlzLm1vZHVsZS50ZXN0RW52aXJvbm1lbnQpO1xuXHQgICAgfVxuXHQgIH0sXG5cdCAgcXVldWU6IGZ1bmN0aW9uIHF1ZXVlKCkge1xuXHQgICAgdmFyIHRlc3QgPSB0aGlzO1xuXG5cdCAgICBpZiAoIXRoaXMudmFsaWQoKSkge1xuXHQgICAgICByZXR1cm47XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHJ1blRlc3QoKSB7XG5cdCAgICAgIHJldHVybiBbZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHJldHVybiB0ZXN0LmJlZm9yZSgpO1xuXHQgICAgICB9XS5jb25jYXQoX3RvQ29uc3VtYWJsZUFycmF5KHRlc3QuaG9va3MoXCJiZWZvcmVcIikpLCBbZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHRlc3QucHJlc2VydmVUZXN0RW52aXJvbm1lbnQoKTtcblx0ICAgICAgfV0sIF90b0NvbnN1bWFibGVBcnJheSh0ZXN0Lmhvb2tzKFwiYmVmb3JlRWFjaFwiKSksIFtmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgdGVzdC5ydW4oKTtcblx0ICAgICAgfV0sIF90b0NvbnN1bWFibGVBcnJheSh0ZXN0Lmhvb2tzKFwiYWZ0ZXJFYWNoXCIpLnJldmVyc2UoKSksIF90b0NvbnN1bWFibGVBcnJheSh0ZXN0Lmhvb2tzKFwiYWZ0ZXJcIikucmV2ZXJzZSgpKSwgW2Z1bmN0aW9uICgpIHtcblx0ICAgICAgICB0ZXN0LmFmdGVyKCk7XG5cdCAgICAgIH0sIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICByZXR1cm4gdGVzdC5maW5pc2goKTtcblx0ICAgICAgfV0pO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgcHJldmlvdXNGYWlsQ291bnQgPSBjb25maWcuc3RvcmFnZSAmJiArY29uZmlnLnN0b3JhZ2UuZ2V0SXRlbShcInF1bml0LXRlc3QtXCIgKyB0aGlzLm1vZHVsZS5uYW1lICsgXCItXCIgKyB0aGlzLnRlc3ROYW1lKTsgLy8gUHJpb3JpdGl6ZSBwcmV2aW91c2x5IGZhaWxlZCB0ZXN0cywgZGV0ZWN0ZWQgZnJvbSBzdG9yYWdlXG5cblx0ICAgIHZhciBwcmlvcml0aXplID0gY29uZmlnLnJlb3JkZXIgJiYgISFwcmV2aW91c0ZhaWxDb3VudDtcblx0ICAgIHRoaXMucHJldmlvdXNGYWlsdXJlID0gISFwcmV2aW91c0ZhaWxDb3VudDtcblx0ICAgIFByb2Nlc3NpbmdRdWV1ZS5hZGQocnVuVGVzdCwgcHJpb3JpdGl6ZSwgY29uZmlnLnNlZWQpOyAvLyBJZiB0aGUgcXVldWUgaGFzIGFscmVhZHkgZmluaXNoZWQsIHdlIG1hbnVhbGx5IHByb2Nlc3MgdGhlIG5ldyB0ZXN0XG5cblx0ICAgIGlmIChQcm9jZXNzaW5nUXVldWUuZmluaXNoZWQpIHtcblx0ICAgICAgUHJvY2Vzc2luZ1F1ZXVlLmFkdmFuY2UoKTtcblx0ICAgIH1cblx0ICB9LFxuXHQgIHB1c2hSZXN1bHQ6IGZ1bmN0aW9uIHB1c2hSZXN1bHQocmVzdWx0SW5mbykge1xuXHQgICAgaWYgKHRoaXMgIT09IGNvbmZpZy5jdXJyZW50KSB7XG5cdCAgICAgIHRocm93IG5ldyBFcnJvcihcIkFzc2VydGlvbiBvY2N1cnJlZCBhZnRlciB0ZXN0IGhhZCBmaW5pc2hlZC5cIik7XG5cdCAgICB9IC8vIERlc3RydWN0dXJlIG9mIHJlc3VsdEluZm8gPSB7IHJlc3VsdCwgYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgbmVnYXRpdmUgfVxuXG5cblx0ICAgIHZhciBzb3VyY2UsXG5cdCAgICAgICAgZGV0YWlscyA9IHtcblx0ICAgICAgbW9kdWxlOiB0aGlzLm1vZHVsZS5uYW1lLFxuXHQgICAgICBuYW1lOiB0aGlzLnRlc3ROYW1lLFxuXHQgICAgICByZXN1bHQ6IHJlc3VsdEluZm8ucmVzdWx0LFxuXHQgICAgICBtZXNzYWdlOiByZXN1bHRJbmZvLm1lc3NhZ2UsXG5cdCAgICAgIGFjdHVhbDogcmVzdWx0SW5mby5hY3R1YWwsXG5cdCAgICAgIHRlc3RJZDogdGhpcy50ZXN0SWQsXG5cdCAgICAgIG5lZ2F0aXZlOiByZXN1bHRJbmZvLm5lZ2F0aXZlIHx8IGZhbHNlLFxuXHQgICAgICBydW50aW1lOiBub3coKSAtIHRoaXMuc3RhcnRlZCxcblx0ICAgICAgdG9kbzogISF0aGlzLnRvZG9cblx0ICAgIH07XG5cblx0ICAgIGlmIChoYXNPd24uY2FsbChyZXN1bHRJbmZvLCBcImV4cGVjdGVkXCIpKSB7XG5cdCAgICAgIGRldGFpbHMuZXhwZWN0ZWQgPSByZXN1bHRJbmZvLmV4cGVjdGVkO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoIXJlc3VsdEluZm8ucmVzdWx0KSB7XG5cdCAgICAgIHNvdXJjZSA9IHJlc3VsdEluZm8uc291cmNlIHx8IHNvdXJjZUZyb21TdGFja3RyYWNlKCk7XG5cblx0ICAgICAgaWYgKHNvdXJjZSkge1xuXHQgICAgICAgIGRldGFpbHMuc291cmNlID0gc291cmNlO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHRoaXMubG9nQXNzZXJ0aW9uKGRldGFpbHMpO1xuXHQgICAgdGhpcy5hc3NlcnRpb25zLnB1c2goe1xuXHQgICAgICByZXN1bHQ6ICEhcmVzdWx0SW5mby5yZXN1bHQsXG5cdCAgICAgIG1lc3NhZ2U6IHJlc3VsdEluZm8ubWVzc2FnZVxuXHQgICAgfSk7XG5cdCAgfSxcblx0ICBwdXNoRmFpbHVyZTogZnVuY3Rpb24gcHVzaEZhaWx1cmUobWVzc2FnZSwgc291cmNlLCBhY3R1YWwpIHtcblx0ICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBUZXN0KSkge1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJwdXNoRmFpbHVyZSgpIGFzc2VydGlvbiBvdXRzaWRlIHRlc3QgY29udGV4dCwgd2FzIFwiICsgc291cmNlRnJvbVN0YWNrdHJhY2UoMikpO1xuXHQgICAgfVxuXG5cdCAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICByZXN1bHQ6IGZhbHNlLFxuXHQgICAgICBtZXNzYWdlOiBtZXNzYWdlIHx8IFwiZXJyb3JcIixcblx0ICAgICAgYWN0dWFsOiBhY3R1YWwgfHwgbnVsbCxcblx0ICAgICAgc291cmNlOiBzb3VyY2Vcblx0ICAgIH0pO1xuXHQgIH0sXG5cblx0ICAvKipcblx0ICAgKiBMb2cgYXNzZXJ0aW9uIGRldGFpbHMgdXNpbmcgYm90aCB0aGUgb2xkIFFVbml0LmxvZyBpbnRlcmZhY2UgYW5kXG5cdCAgICogUVVuaXQub24oIFwiYXNzZXJ0aW9uXCIgKSBpbnRlcmZhY2UuXG5cdCAgICpcblx0ICAgKiBAcHJpdmF0ZVxuXHQgICAqL1xuXHQgIGxvZ0Fzc2VydGlvbjogZnVuY3Rpb24gbG9nQXNzZXJ0aW9uKGRldGFpbHMpIHtcblx0ICAgIHJ1bkxvZ2dpbmdDYWxsYmFja3MoXCJsb2dcIiwgZGV0YWlscyk7XG5cdCAgICB2YXIgYXNzZXJ0aW9uID0ge1xuXHQgICAgICBwYXNzZWQ6IGRldGFpbHMucmVzdWx0LFxuXHQgICAgICBhY3R1YWw6IGRldGFpbHMuYWN0dWFsLFxuXHQgICAgICBleHBlY3RlZDogZGV0YWlscy5leHBlY3RlZCxcblx0ICAgICAgbWVzc2FnZTogZGV0YWlscy5tZXNzYWdlLFxuXHQgICAgICBzdGFjazogZGV0YWlscy5zb3VyY2UsXG5cdCAgICAgIHRvZG86IGRldGFpbHMudG9kb1xuXHQgICAgfTtcblx0ICAgIHRoaXMudGVzdFJlcG9ydC5wdXNoQXNzZXJ0aW9uKGFzc2VydGlvbik7XG5cdCAgICBlbWl0KFwiYXNzZXJ0aW9uXCIsIGFzc2VydGlvbik7XG5cdCAgfSxcblx0ICByZXNvbHZlUHJvbWlzZTogZnVuY3Rpb24gcmVzb2x2ZVByb21pc2UocHJvbWlzZSwgcGhhc2UpIHtcblx0ICAgIHZhciB0aGVuLFxuXHQgICAgICAgIHJlc3VtZSxcblx0ICAgICAgICBtZXNzYWdlLFxuXHQgICAgICAgIHRlc3QgPSB0aGlzO1xuXG5cdCAgICBpZiAocHJvbWlzZSAhPSBudWxsKSB7XG5cdCAgICAgIHRoZW4gPSBwcm9taXNlLnRoZW47XG5cblx0ICAgICAgaWYgKG9iamVjdFR5cGUodGhlbikgPT09IFwiZnVuY3Rpb25cIikge1xuXHQgICAgICAgIHJlc3VtZSA9IGludGVybmFsU3RvcCh0ZXN0KTtcblxuXHQgICAgICAgIGlmIChjb25maWcubm90cnljYXRjaCkge1xuXHQgICAgICAgICAgdGhlbi5jYWxsKHByb21pc2UsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgcmVzdW1lKCk7XG5cdCAgICAgICAgICB9KTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgdGhlbi5jYWxsKHByb21pc2UsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgcmVzdW1lKCk7XG5cdCAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcblx0ICAgICAgICAgICAgbWVzc2FnZSA9IFwiUHJvbWlzZSByZWplY3RlZCBcIiArICghcGhhc2UgPyBcImR1cmluZ1wiIDogcGhhc2UucmVwbGFjZSgvRWFjaCQvLCBcIlwiKSkgKyBcIiBcXFwiXCIgKyB0ZXN0LnRlc3ROYW1lICsgXCJcXFwiOiBcIiArIChlcnJvciAmJiBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcblx0ICAgICAgICAgICAgdGVzdC5wdXNoRmFpbHVyZShtZXNzYWdlLCBleHRyYWN0U3RhY2t0cmFjZShlcnJvciwgMCkpOyAvLyBFbHNlIG5leHQgdGVzdCB3aWxsIGNhcnJ5IHRoZSByZXNwb25zaWJpbGl0eVxuXG5cdCAgICAgICAgICAgIHNhdmVHbG9iYWwoKTsgLy8gVW5ibG9ja1xuXG5cdCAgICAgICAgICAgIGludGVybmFsUmVjb3Zlcih0ZXN0KTtcblx0ICAgICAgICAgIH0pO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH0sXG5cdCAgdmFsaWQ6IGZ1bmN0aW9uIHZhbGlkKCkge1xuXHQgICAgdmFyIGZpbHRlciA9IGNvbmZpZy5maWx0ZXIsXG5cdCAgICAgICAgcmVnZXhGaWx0ZXIgPSAvXighPylcXC8oW1xcd1xcV10qKVxcLyhpPyQpLy5leGVjKGZpbHRlciksXG5cdCAgICAgICAgbW9kdWxlID0gY29uZmlnLm1vZHVsZSAmJiBjb25maWcubW9kdWxlLnRvTG93ZXJDYXNlKCksXG5cdCAgICAgICAgZnVsbE5hbWUgPSB0aGlzLm1vZHVsZS5uYW1lICsgXCI6IFwiICsgdGhpcy50ZXN0TmFtZTtcblxuXHQgICAgZnVuY3Rpb24gbW9kdWxlQ2hhaW5OYW1lTWF0Y2godGVzdE1vZHVsZSkge1xuXHQgICAgICB2YXIgdGVzdE1vZHVsZU5hbWUgPSB0ZXN0TW9kdWxlLm5hbWUgPyB0ZXN0TW9kdWxlLm5hbWUudG9Mb3dlckNhc2UoKSA6IG51bGw7XG5cblx0ICAgICAgaWYgKHRlc3RNb2R1bGVOYW1lID09PSBtb2R1bGUpIHtcblx0ICAgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgICAgfSBlbHNlIGlmICh0ZXN0TW9kdWxlLnBhcmVudE1vZHVsZSkge1xuXHQgICAgICAgIHJldHVybiBtb2R1bGVDaGFpbk5hbWVNYXRjaCh0ZXN0TW9kdWxlLnBhcmVudE1vZHVsZSk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIG1vZHVsZUNoYWluSWRNYXRjaCh0ZXN0TW9kdWxlKSB7XG5cdCAgICAgIHJldHVybiBpbkFycmF5KHRlc3RNb2R1bGUubW9kdWxlSWQsIGNvbmZpZy5tb2R1bGVJZCkgfHwgdGVzdE1vZHVsZS5wYXJlbnRNb2R1bGUgJiYgbW9kdWxlQ2hhaW5JZE1hdGNoKHRlc3RNb2R1bGUucGFyZW50TW9kdWxlKTtcblx0ICAgIH0gLy8gSW50ZXJuYWxseS1nZW5lcmF0ZWQgdGVzdHMgYXJlIGFsd2F5cyB2YWxpZFxuXG5cblx0ICAgIGlmICh0aGlzLmNhbGxiYWNrICYmIHRoaXMuY2FsbGJhY2sudmFsaWRUZXN0KSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY29uZmlnLm1vZHVsZUlkICYmIGNvbmZpZy5tb2R1bGVJZC5sZW5ndGggPiAwICYmICFtb2R1bGVDaGFpbklkTWF0Y2godGhpcy5tb2R1bGUpKSB7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGNvbmZpZy50ZXN0SWQgJiYgY29uZmlnLnRlc3RJZC5sZW5ndGggPiAwICYmICFpbkFycmF5KHRoaXMudGVzdElkLCBjb25maWcudGVzdElkKSkge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cblx0ICAgIGlmIChtb2R1bGUgJiYgIW1vZHVsZUNoYWluTmFtZU1hdGNoKHRoaXMubW9kdWxlKSkge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cblx0ICAgIGlmICghZmlsdGVyKSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gcmVnZXhGaWx0ZXIgPyB0aGlzLnJlZ2V4RmlsdGVyKCEhcmVnZXhGaWx0ZXJbMV0sIHJlZ2V4RmlsdGVyWzJdLCByZWdleEZpbHRlclszXSwgZnVsbE5hbWUpIDogdGhpcy5zdHJpbmdGaWx0ZXIoZmlsdGVyLCBmdWxsTmFtZSk7XG5cdCAgfSxcblx0ICByZWdleEZpbHRlcjogZnVuY3Rpb24gcmVnZXhGaWx0ZXIoZXhjbHVkZSwgcGF0dGVybiwgZmxhZ3MsIGZ1bGxOYW1lKSB7XG5cdCAgICB2YXIgcmVnZXggPSBuZXcgUmVnRXhwKHBhdHRlcm4sIGZsYWdzKTtcblx0ICAgIHZhciBtYXRjaCA9IHJlZ2V4LnRlc3QoZnVsbE5hbWUpO1xuXHQgICAgcmV0dXJuIG1hdGNoICE9PSBleGNsdWRlO1xuXHQgIH0sXG5cdCAgc3RyaW5nRmlsdGVyOiBmdW5jdGlvbiBzdHJpbmdGaWx0ZXIoZmlsdGVyLCBmdWxsTmFtZSkge1xuXHQgICAgZmlsdGVyID0gZmlsdGVyLnRvTG93ZXJDYXNlKCk7XG5cdCAgICBmdWxsTmFtZSA9IGZ1bGxOYW1lLnRvTG93ZXJDYXNlKCk7XG5cdCAgICB2YXIgaW5jbHVkZSA9IGZpbHRlci5jaGFyQXQoMCkgIT09IFwiIVwiO1xuXG5cdCAgICBpZiAoIWluY2x1ZGUpIHtcblx0ICAgICAgZmlsdGVyID0gZmlsdGVyLnNsaWNlKDEpO1xuXHQgICAgfSAvLyBJZiB0aGUgZmlsdGVyIG1hdGNoZXMsIHdlIG5lZWQgdG8gaG9ub3VyIGluY2x1ZGVcblxuXG5cdCAgICBpZiAoZnVsbE5hbWUuaW5kZXhPZihmaWx0ZXIpICE9PSAtMSkge1xuXHQgICAgICByZXR1cm4gaW5jbHVkZTtcblx0ICAgIH0gLy8gT3RoZXJ3aXNlLCBkbyB0aGUgb3Bwb3NpdGVcblxuXG5cdCAgICByZXR1cm4gIWluY2x1ZGU7XG5cdCAgfVxuXHR9O1xuXHRmdW5jdGlvbiBwdXNoRmFpbHVyZSgpIHtcblx0ICBpZiAoIWNvbmZpZy5jdXJyZW50KSB7XG5cdCAgICB0aHJvdyBuZXcgRXJyb3IoXCJwdXNoRmFpbHVyZSgpIGFzc2VydGlvbiBvdXRzaWRlIHRlc3QgY29udGV4dCwgaW4gXCIgKyBzb3VyY2VGcm9tU3RhY2t0cmFjZSgyKSk7XG5cdCAgfSAvLyBHZXRzIGN1cnJlbnQgdGVzdCBvYmpcblxuXG5cdCAgdmFyIGN1cnJlbnRUZXN0ID0gY29uZmlnLmN1cnJlbnQ7XG5cdCAgcmV0dXJuIGN1cnJlbnRUZXN0LnB1c2hGYWlsdXJlLmFwcGx5KGN1cnJlbnRUZXN0LCBhcmd1bWVudHMpO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2F2ZUdsb2JhbCgpIHtcblx0ICBjb25maWcucG9sbHV0aW9uID0gW107XG5cblx0ICBpZiAoY29uZmlnLm5vZ2xvYmFscykge1xuXHQgICAgZm9yICh2YXIga2V5IGluIGdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddKSB7XG5cdCAgICAgIGlmIChoYXNPd24uY2FsbChnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXSwga2V5KSkge1xuXHQgICAgICAgIC8vIEluIE9wZXJhIHNvbWV0aW1lcyBET00gZWxlbWVudCBpZHMgc2hvdyB1cCBoZXJlLCBpZ25vcmUgdGhlbVxuXHQgICAgICAgIGlmICgvXnF1bml0LXRlc3Qtb3V0cHV0Ly50ZXN0KGtleSkpIHtcblx0ICAgICAgICAgIGNvbnRpbnVlO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGNvbmZpZy5wb2xsdXRpb24ucHVzaChrZXkpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfVxuXHR9XG5cblx0ZnVuY3Rpb24gY2hlY2tQb2xsdXRpb24oKSB7XG5cdCAgdmFyIG5ld0dsb2JhbHMsXG5cdCAgICAgIGRlbGV0ZWRHbG9iYWxzLFxuXHQgICAgICBvbGQgPSBjb25maWcucG9sbHV0aW9uO1xuXHQgIHNhdmVHbG9iYWwoKTtcblx0ICBuZXdHbG9iYWxzID0gZGlmZihjb25maWcucG9sbHV0aW9uLCBvbGQpO1xuXG5cdCAgaWYgKG5ld0dsb2JhbHMubGVuZ3RoID4gMCkge1xuXHQgICAgcHVzaEZhaWx1cmUoXCJJbnRyb2R1Y2VkIGdsb2JhbCB2YXJpYWJsZShzKTogXCIgKyBuZXdHbG9iYWxzLmpvaW4oXCIsIFwiKSk7XG5cdCAgfVxuXG5cdCAgZGVsZXRlZEdsb2JhbHMgPSBkaWZmKG9sZCwgY29uZmlnLnBvbGx1dGlvbik7XG5cblx0ICBpZiAoZGVsZXRlZEdsb2JhbHMubGVuZ3RoID4gMCkge1xuXHQgICAgcHVzaEZhaWx1cmUoXCJEZWxldGVkIGdsb2JhbCB2YXJpYWJsZShzKTogXCIgKyBkZWxldGVkR2xvYmFscy5qb2luKFwiLCBcIikpO1xuXHQgIH1cblx0fSAvLyBXaWxsIGJlIGV4cG9zZWQgYXMgUVVuaXQudGVzdFxuXG5cblx0ZnVuY3Rpb24gdGVzdCh0ZXN0TmFtZSwgY2FsbGJhY2spIHtcblx0ICBpZiAoZm9jdXNlZCQxKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgdmFyIG5ld1Rlc3QgPSBuZXcgVGVzdCh7XG5cdCAgICB0ZXN0TmFtZTogdGVzdE5hbWUsXG5cdCAgICBjYWxsYmFjazogY2FsbGJhY2tcblx0ICB9KTtcblx0ICBuZXdUZXN0LnF1ZXVlKCk7XG5cdH1cblx0ZnVuY3Rpb24gdG9kbyh0ZXN0TmFtZSwgY2FsbGJhY2spIHtcblx0ICBpZiAoZm9jdXNlZCQxKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgdmFyIG5ld1Rlc3QgPSBuZXcgVGVzdCh7XG5cdCAgICB0ZXN0TmFtZTogdGVzdE5hbWUsXG5cdCAgICBjYWxsYmFjazogY2FsbGJhY2ssXG5cdCAgICB0b2RvOiB0cnVlXG5cdCAgfSk7XG5cdCAgbmV3VGVzdC5xdWV1ZSgpO1xuXHR9IC8vIFdpbGwgYmUgZXhwb3NlZCBhcyBRVW5pdC5za2lwXG5cblx0ZnVuY3Rpb24gc2tpcCh0ZXN0TmFtZSkge1xuXHQgIGlmIChmb2N1c2VkJDEpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICB2YXIgdGVzdCA9IG5ldyBUZXN0KHtcblx0ICAgIHRlc3ROYW1lOiB0ZXN0TmFtZSxcblx0ICAgIHNraXA6IHRydWVcblx0ICB9KTtcblx0ICB0ZXN0LnF1ZXVlKCk7XG5cdH0gLy8gV2lsbCBiZSBleHBvc2VkIGFzIFFVbml0Lm9ubHlcblxuXHRmdW5jdGlvbiBvbmx5KHRlc3ROYW1lLCBjYWxsYmFjaykge1xuXHQgIGlmICghZm9jdXNlZCQxKSB7XG5cdCAgICBjb25maWcucXVldWUubGVuZ3RoID0gMDtcblx0ICAgIGZvY3VzZWQkMSA9IHRydWU7XG5cdCAgfVxuXG5cdCAgdmFyIG5ld1Rlc3QgPSBuZXcgVGVzdCh7XG5cdCAgICB0ZXN0TmFtZTogdGVzdE5hbWUsXG5cdCAgICBjYWxsYmFjazogY2FsbGJhY2tcblx0ICB9KTtcblx0ICBuZXdUZXN0LnF1ZXVlKCk7XG5cdH0gLy8gUmVzZXRzIGNvbmZpZy50aW1lb3V0IHdpdGggYSBuZXcgdGltZW91dCBkdXJhdGlvbi5cblxuXHRmdW5jdGlvbiByZXNldFRlc3RUaW1lb3V0KHRpbWVvdXREdXJhdGlvbikge1xuXHQgIGNsZWFyVGltZW91dChjb25maWcudGltZW91dCk7XG5cdCAgY29uZmlnLnRpbWVvdXQgPSBzZXRUaW1lb3V0JDEoY29uZmlnLnRpbWVvdXRIYW5kbGVyKHRpbWVvdXREdXJhdGlvbiksIHRpbWVvdXREdXJhdGlvbik7XG5cdH0gLy8gUHV0IGEgaG9sZCBvbiBwcm9jZXNzaW5nIGFuZCByZXR1cm4gYSBmdW5jdGlvbiB0aGF0IHdpbGwgcmVsZWFzZSBpdC5cblxuXHRmdW5jdGlvbiBpbnRlcm5hbFN0b3AodGVzdCkge1xuXHQgIHZhciByZWxlYXNlZCA9IGZhbHNlO1xuXHQgIHRlc3Quc2VtYXBob3JlICs9IDE7XG5cdCAgY29uZmlnLmJsb2NraW5nID0gdHJ1ZTsgLy8gU2V0IGEgcmVjb3ZlcnkgdGltZW91dCwgaWYgc28gY29uZmlndXJlZC5cblxuXHQgIGlmIChkZWZpbmVkLnNldFRpbWVvdXQpIHtcblx0ICAgIHZhciB0aW1lb3V0RHVyYXRpb247XG5cblx0ICAgIGlmICh0eXBlb2YgdGVzdC50aW1lb3V0ID09PSBcIm51bWJlclwiKSB7XG5cdCAgICAgIHRpbWVvdXREdXJhdGlvbiA9IHRlc3QudGltZW91dDtcblx0ICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvbmZpZy50ZXN0VGltZW91dCA9PT0gXCJudW1iZXJcIikge1xuXHQgICAgICB0aW1lb3V0RHVyYXRpb24gPSBjb25maWcudGVzdFRpbWVvdXQ7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0eXBlb2YgdGltZW91dER1cmF0aW9uID09PSBcIm51bWJlclwiICYmIHRpbWVvdXREdXJhdGlvbiA+IDApIHtcblx0ICAgICAgY2xlYXJUaW1lb3V0KGNvbmZpZy50aW1lb3V0KTtcblxuXHQgICAgICBjb25maWcudGltZW91dEhhbmRsZXIgPSBmdW5jdGlvbiAodGltZW91dCkge1xuXHQgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICBwdXNoRmFpbHVyZShcIlRlc3QgdG9vayBsb25nZXIgdGhhbiBcIi5jb25jYXQodGltZW91dCwgXCJtczsgdGVzdCB0aW1lZCBvdXQuXCIpLCBzb3VyY2VGcm9tU3RhY2t0cmFjZSgyKSk7XG5cdCAgICAgICAgICByZWxlYXNlZCA9IHRydWU7XG5cdCAgICAgICAgICBpbnRlcm5hbFJlY292ZXIodGVzdCk7XG5cdCAgICAgICAgfTtcblx0ICAgICAgfTtcblxuXHQgICAgICBjb25maWcudGltZW91dCA9IHNldFRpbWVvdXQkMShjb25maWcudGltZW91dEhhbmRsZXIodGltZW91dER1cmF0aW9uKSwgdGltZW91dER1cmF0aW9uKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gZnVuY3Rpb24gcmVzdW1lKCkge1xuXHQgICAgaWYgKHJlbGVhc2VkKSB7XG5cdCAgICAgIHJldHVybjtcblx0ICAgIH1cblxuXHQgICAgcmVsZWFzZWQgPSB0cnVlO1xuXHQgICAgdGVzdC5zZW1hcGhvcmUgLT0gMTtcblx0ICAgIGludGVybmFsU3RhcnQodGVzdCk7XG5cdCAgfTtcblx0fSAvLyBGb3JjZWZ1bGx5IHJlbGVhc2UgYWxsIHByb2Nlc3NpbmcgaG9sZHMuXG5cblx0ZnVuY3Rpb24gaW50ZXJuYWxSZWNvdmVyKHRlc3QpIHtcblx0ICB0ZXN0LnNlbWFwaG9yZSA9IDA7XG5cdCAgaW50ZXJuYWxTdGFydCh0ZXN0KTtcblx0fSAvLyBSZWxlYXNlIGEgcHJvY2Vzc2luZyBob2xkLCBzY2hlZHVsaW5nIGEgcmVzdW1wdGlvbiBhdHRlbXB0IGlmIG5vIGhvbGRzIHJlbWFpbi5cblxuXG5cdGZ1bmN0aW9uIGludGVybmFsU3RhcnQodGVzdCkge1xuXHQgIC8vIElmIHNlbWFwaG9yZSBpcyBub24tbnVtZXJpYywgdGhyb3cgZXJyb3Jcblx0ICBpZiAoaXNOYU4odGVzdC5zZW1hcGhvcmUpKSB7XG5cdCAgICB0ZXN0LnNlbWFwaG9yZSA9IDA7XG5cdCAgICBwdXNoRmFpbHVyZShcIkludmFsaWQgdmFsdWUgb24gdGVzdC5zZW1hcGhvcmVcIiwgc291cmNlRnJvbVN0YWNrdHJhY2UoMikpO1xuXHQgICAgcmV0dXJuO1xuXHQgIH0gLy8gRG9uJ3Qgc3RhcnQgdW50aWwgZXF1YWwgbnVtYmVyIG9mIHN0b3AtY2FsbHNcblxuXG5cdCAgaWYgKHRlc3Quc2VtYXBob3JlID4gMCkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH0gLy8gVGhyb3cgYW4gRXJyb3IgaWYgc3RhcnQgaXMgY2FsbGVkIG1vcmUgb2Z0ZW4gdGhhbiBzdG9wXG5cblxuXHQgIGlmICh0ZXN0LnNlbWFwaG9yZSA8IDApIHtcblx0ICAgIHRlc3Quc2VtYXBob3JlID0gMDtcblx0ICAgIHB1c2hGYWlsdXJlKFwiVHJpZWQgdG8gcmVzdGFydCB0ZXN0IHdoaWxlIGFscmVhZHkgc3RhcnRlZCAodGVzdCdzIHNlbWFwaG9yZSB3YXMgMCBhbHJlYWR5KVwiLCBzb3VyY2VGcm9tU3RhY2t0cmFjZSgyKSk7XG5cdCAgICByZXR1cm47XG5cdCAgfSAvLyBBZGQgYSBzbGlnaHQgZGVsYXkgdG8gYWxsb3cgbW9yZSBhc3NlcnRpb25zIGV0Yy5cblxuXG5cdCAgaWYgKGRlZmluZWQuc2V0VGltZW91dCkge1xuXHQgICAgaWYgKGNvbmZpZy50aW1lb3V0KSB7XG5cdCAgICAgIGNsZWFyVGltZW91dChjb25maWcudGltZW91dCk7XG5cdCAgICB9XG5cblx0ICAgIGNvbmZpZy50aW1lb3V0ID0gc2V0VGltZW91dCQxKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgaWYgKHRlc3Quc2VtYXBob3JlID4gMCkge1xuXHQgICAgICAgIHJldHVybjtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChjb25maWcudGltZW91dCkge1xuXHQgICAgICAgIGNsZWFyVGltZW91dChjb25maWcudGltZW91dCk7XG5cdCAgICAgIH1cblxuXHQgICAgICBiZWdpbigpO1xuXHQgICAgfSk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIGJlZ2luKCk7XG5cdCAgfVxuXHR9XG5cblx0ZnVuY3Rpb24gY29sbGVjdFRlc3RzKG1vZHVsZSkge1xuXHQgIHZhciB0ZXN0cyA9IFtdLmNvbmNhdChtb2R1bGUudGVzdHMpO1xuXG5cdCAgdmFyIG1vZHVsZXMgPSBfdG9Db25zdW1hYmxlQXJyYXkobW9kdWxlLmNoaWxkTW9kdWxlcyk7IC8vIERvIGEgYnJlYWR0aC1maXJzdCB0cmF2ZXJzYWwgb2YgdGhlIGNoaWxkIG1vZHVsZXNcblxuXG5cdCAgd2hpbGUgKG1vZHVsZXMubGVuZ3RoKSB7XG5cdCAgICB2YXIgbmV4dE1vZHVsZSA9IG1vZHVsZXMuc2hpZnQoKTtcblx0ICAgIHRlc3RzLnB1c2guYXBwbHkodGVzdHMsIG5leHRNb2R1bGUudGVzdHMpO1xuXHQgICAgbW9kdWxlcy5wdXNoLmFwcGx5KG1vZHVsZXMsIF90b0NvbnN1bWFibGVBcnJheShuZXh0TW9kdWxlLmNoaWxkTW9kdWxlcykpO1xuXHQgIH1cblxuXHQgIHJldHVybiB0ZXN0cztcblx0fVxuXG5cdGZ1bmN0aW9uIG51bWJlck9mVGVzdHMobW9kdWxlKSB7XG5cdCAgcmV0dXJuIGNvbGxlY3RUZXN0cyhtb2R1bGUpLmxlbmd0aDtcblx0fVxuXG5cdGZ1bmN0aW9uIG51bWJlck9mVW5za2lwcGVkVGVzdHMobW9kdWxlKSB7XG5cdCAgcmV0dXJuIGNvbGxlY3RUZXN0cyhtb2R1bGUpLmZpbHRlcihmdW5jdGlvbiAodGVzdCkge1xuXHQgICAgcmV0dXJuICF0ZXN0LnNraXA7XG5cdCAgfSkubGVuZ3RoO1xuXHR9XG5cblx0ZnVuY3Rpb24gbm90aWZ5VGVzdHNSYW4obW9kdWxlLCBza2lwcGVkKSB7XG5cdCAgbW9kdWxlLnRlc3RzUnVuKys7XG5cblx0ICBpZiAoIXNraXBwZWQpIHtcblx0ICAgIG1vZHVsZS51bnNraXBwZWRUZXN0c1J1bisrO1xuXHQgIH1cblxuXHQgIHdoaWxlIChtb2R1bGUgPSBtb2R1bGUucGFyZW50TW9kdWxlKSB7XG5cdCAgICBtb2R1bGUudGVzdHNSdW4rKztcblxuXHQgICAgaWYgKCFza2lwcGVkKSB7XG5cdCAgICAgIG1vZHVsZS51bnNraXBwZWRUZXN0c1J1bisrO1xuXHQgICAgfVxuXHQgIH1cblx0fVxuXG5cdHZhciBBc3NlcnQgPSAvKiNfX1BVUkVfXyovZnVuY3Rpb24gKCkge1xuXHQgIGZ1bmN0aW9uIEFzc2VydCh0ZXN0Q29udGV4dCkge1xuXHQgICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEFzc2VydCk7XG5cblx0ICAgIHRoaXMudGVzdCA9IHRlc3RDb250ZXh0O1xuXHQgIH0gLy8gQXNzZXJ0IGhlbHBlcnNcblxuXG5cdCAgX2NyZWF0ZUNsYXNzKEFzc2VydCwgW3tcblx0ICAgIGtleTogXCJ0aW1lb3V0XCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gdGltZW91dChkdXJhdGlvbikge1xuXHQgICAgICBpZiAodHlwZW9mIGR1cmF0aW9uICE9PSBcIm51bWJlclwiKSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiWW91IG11c3QgcGFzcyBhIG51bWJlciBhcyB0aGUgZHVyYXRpb24gdG8gYXNzZXJ0LnRpbWVvdXRcIik7XG5cdCAgICAgIH1cblxuXHQgICAgICB0aGlzLnRlc3QudGltZW91dCA9IGR1cmF0aW9uOyAvLyBJZiBhIHRpbWVvdXQgaGFzIGJlZW4gc2V0LCBjbGVhciBpdCBhbmQgcmVzZXQgd2l0aCB0aGUgbmV3IGR1cmF0aW9uXG5cblx0ICAgICAgaWYgKGNvbmZpZy50aW1lb3V0KSB7XG5cdCAgICAgICAgY2xlYXJUaW1lb3V0KGNvbmZpZy50aW1lb3V0KTtcblxuXHQgICAgICAgIGlmIChjb25maWcudGltZW91dEhhbmRsZXIgJiYgdGhpcy50ZXN0LnRpbWVvdXQgPiAwKSB7XG5cdCAgICAgICAgICByZXNldFRlc3RUaW1lb3V0KHRoaXMudGVzdC50aW1lb3V0KTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH0gLy8gRG9jdW1lbnRzIGEgXCJzdGVwXCIsIHdoaWNoIGlzIGEgc3RyaW5nIHZhbHVlLCBpbiBhIHRlc3QgYXMgYSBwYXNzaW5nIGFzc2VydGlvblxuXG5cdCAgfSwge1xuXHQgICAga2V5OiBcInN0ZXBcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBzdGVwKG1lc3NhZ2UpIHtcblx0ICAgICAgdmFyIGFzc2VydGlvbk1lc3NhZ2UgPSBtZXNzYWdlO1xuXHQgICAgICB2YXIgcmVzdWx0ID0gISFtZXNzYWdlO1xuXHQgICAgICB0aGlzLnRlc3Quc3RlcHMucHVzaChtZXNzYWdlKTtcblxuXHQgICAgICBpZiAob2JqZWN0VHlwZShtZXNzYWdlKSA9PT0gXCJ1bmRlZmluZWRcIiB8fCBtZXNzYWdlID09PSBcIlwiKSB7XG5cdCAgICAgICAgYXNzZXJ0aW9uTWVzc2FnZSA9IFwiWW91IG11c3QgcHJvdmlkZSBhIG1lc3NhZ2UgdG8gYXNzZXJ0LnN0ZXBcIjtcblx0ICAgICAgfSBlbHNlIGlmIChvYmplY3RUeXBlKG1lc3NhZ2UpICE9PSBcInN0cmluZ1wiKSB7XG5cdCAgICAgICAgYXNzZXJ0aW9uTWVzc2FnZSA9IFwiWW91IG11c3QgcHJvdmlkZSBhIHN0cmluZyB2YWx1ZSB0byBhc3NlcnQuc3RlcFwiO1xuXHQgICAgICAgIHJlc3VsdCA9IGZhbHNlO1xuXHQgICAgICB9XG5cblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6IHJlc3VsdCxcblx0ICAgICAgICBtZXNzYWdlOiBhc3NlcnRpb25NZXNzYWdlXG5cdCAgICAgIH0pO1xuXHQgICAgfSAvLyBWZXJpZmllcyB0aGUgc3RlcHMgaW4gYSB0ZXN0IG1hdGNoIGEgZ2l2ZW4gYXJyYXkgb2Ygc3RyaW5nIHZhbHVlc1xuXG5cdCAgfSwge1xuXHQgICAga2V5OiBcInZlcmlmeVN0ZXBzXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gdmVyaWZ5U3RlcHMoc3RlcHMsIG1lc3NhZ2UpIHtcblx0ICAgICAgLy8gU2luY2UgdGhlIHN0ZXBzIGFycmF5IGlzIGp1c3Qgc3RyaW5nIHZhbHVlcywgd2UgY2FuIGNsb25lIHdpdGggc2xpY2Vcblx0ICAgICAgdmFyIGFjdHVhbFN0ZXBzQ2xvbmUgPSB0aGlzLnRlc3Quc3RlcHMuc2xpY2UoKTtcblx0ICAgICAgdGhpcy5kZWVwRXF1YWwoYWN0dWFsU3RlcHNDbG9uZSwgc3RlcHMsIG1lc3NhZ2UpO1xuXHQgICAgICB0aGlzLnRlc3Quc3RlcHMubGVuZ3RoID0gMDtcblx0ICAgIH0gLy8gU3BlY2lmeSB0aGUgbnVtYmVyIG9mIGV4cGVjdGVkIGFzc2VydGlvbnMgdG8gZ3VhcmFudGVlIHRoYXQgZmFpbGVkIHRlc3Rcblx0ICAgIC8vIChubyBhc3NlcnRpb25zIGFyZSBydW4gYXQgYWxsKSBkb24ndCBzbGlwIHRocm91Z2guXG5cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZXhwZWN0XCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZXhwZWN0KGFzc2VydHMpIHtcblx0ICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcblx0ICAgICAgICB0aGlzLnRlc3QuZXhwZWN0ZWQgPSBhc3NlcnRzO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHJldHVybiB0aGlzLnRlc3QuZXhwZWN0ZWQ7XG5cdCAgICAgIH1cblx0ICAgIH0gLy8gUHV0IGEgaG9sZCBvbiBwcm9jZXNzaW5nIGFuZCByZXR1cm4gYSBmdW5jdGlvbiB0aGF0IHdpbGwgcmVsZWFzZSBpdCBhIG1heGltdW0gb2Ygb25jZS5cblxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJhc3luY1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGFzeW5jKGNvdW50KSB7XG5cdCAgICAgIHZhciB0ZXN0ID0gdGhpcy50ZXN0O1xuXHQgICAgICB2YXIgcG9wcGVkID0gZmFsc2UsXG5cdCAgICAgICAgICBhY2NlcHRDYWxsQ291bnQgPSBjb3VudDtcblxuXHQgICAgICBpZiAodHlwZW9mIGFjY2VwdENhbGxDb3VudCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHQgICAgICAgIGFjY2VwdENhbGxDb3VudCA9IDE7XG5cdCAgICAgIH1cblxuXHQgICAgICB2YXIgcmVzdW1lID0gaW50ZXJuYWxTdG9wKHRlc3QpO1xuXHQgICAgICByZXR1cm4gZnVuY3Rpb24gZG9uZSgpIHtcblx0ICAgICAgICBpZiAoY29uZmlnLmN1cnJlbnQgIT09IHRlc3QpIHtcblx0ICAgICAgICAgIHRocm93IEVycm9yKFwiYXNzZXJ0LmFzeW5jIGNhbGxiYWNrIGNhbGxlZCBhZnRlciB0ZXN0IGZpbmlzaGVkLlwiKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBpZiAocG9wcGVkKSB7XG5cdCAgICAgICAgICB0ZXN0LnB1c2hGYWlsdXJlKFwiVG9vIG1hbnkgY2FsbHMgdG8gdGhlIGBhc3NlcnQuYXN5bmNgIGNhbGxiYWNrXCIsIHNvdXJjZUZyb21TdGFja3RyYWNlKDIpKTtcblx0ICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBhY2NlcHRDYWxsQ291bnQgLT0gMTtcblxuXHQgICAgICAgIGlmIChhY2NlcHRDYWxsQ291bnQgPiAwKSB7XG5cdCAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgcG9wcGVkID0gdHJ1ZTtcblx0ICAgICAgICByZXN1bWUoKTtcblx0ICAgICAgfTtcblx0ICAgIH0gLy8gRXhwb3J0cyB0ZXN0LnB1c2goKSB0byB0aGUgdXNlciBBUElcblx0ICAgIC8vIEFsaWFzIG9mIHB1c2hSZXN1bHQuXG5cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwicHVzaFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHB1c2gocmVzdWx0LCBhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCBuZWdhdGl2ZSkge1xuXHQgICAgICBMb2dnZXIud2FybihcImFzc2VydC5wdXNoIGlzIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiBRVW5pdCAzLjAuXCIgKyBcIiBQbGVhc2UgdXNlIGFzc2VydC5wdXNoUmVzdWx0IGluc3RlYWQgKGh0dHBzOi8vYXBpLnF1bml0anMuY29tL2Fzc2VydC9wdXNoUmVzdWx0KS5cIik7XG5cdCAgICAgIHZhciBjdXJyZW50QXNzZXJ0ID0gdGhpcyBpbnN0YW5jZW9mIEFzc2VydCA/IHRoaXMgOiBjb25maWcuY3VycmVudC5hc3NlcnQ7XG5cdCAgICAgIHJldHVybiBjdXJyZW50QXNzZXJ0LnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogcmVzdWx0LFxuXHQgICAgICAgIGFjdHVhbDogYWN0dWFsLFxuXHQgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuXHQgICAgICAgIG5lZ2F0aXZlOiBuZWdhdGl2ZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwicHVzaFJlc3VsdFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHB1c2hSZXN1bHQocmVzdWx0SW5mbykge1xuXHQgICAgICAvLyBEZXN0cnVjdHVyZSBvZiByZXN1bHRJbmZvID0geyByZXN1bHQsIGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsIG5lZ2F0aXZlIH1cblx0ICAgICAgdmFyIGFzc2VydCA9IHRoaXM7XG5cdCAgICAgIHZhciBjdXJyZW50VGVzdCA9IGFzc2VydCBpbnN0YW5jZW9mIEFzc2VydCAmJiBhc3NlcnQudGVzdCB8fCBjb25maWcuY3VycmVudDsgLy8gQmFja3dhcmRzIGNvbXBhdGliaWxpdHkgZml4LlxuXHQgICAgICAvLyBBbGxvd3MgdGhlIGRpcmVjdCB1c2Ugb2YgZ2xvYmFsIGV4cG9ydGVkIGFzc2VydGlvbnMgYW5kIFFVbml0LmFzc2VydC4qXG5cdCAgICAgIC8vIEFsdGhvdWdoLCBpdCdzIHVzZSBpcyBub3QgcmVjb21tZW5kZWQgYXMgaXQgY2FuIGxlYWsgYXNzZXJ0aW9uc1xuXHQgICAgICAvLyB0byBvdGhlciB0ZXN0cyBmcm9tIGFzeW5jIHRlc3RzLCBiZWNhdXNlIHdlIG9ubHkgZ2V0IGEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IHRlc3QsXG5cdCAgICAgIC8vIG5vdCBleGFjdGx5IHRoZSB0ZXN0IHdoZXJlIGFzc2VydGlvbiB3ZXJlIGludGVuZGVkIHRvIGJlIGNhbGxlZC5cblxuXHQgICAgICBpZiAoIWN1cnJlbnRUZXN0KSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiYXNzZXJ0aW9uIG91dHNpZGUgdGVzdCBjb250ZXh0LCBpbiBcIiArIHNvdXJjZUZyb21TdGFja3RyYWNlKDIpKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmICghKGFzc2VydCBpbnN0YW5jZW9mIEFzc2VydCkpIHtcblx0ICAgICAgICBhc3NlcnQgPSBjdXJyZW50VGVzdC5hc3NlcnQ7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gYXNzZXJ0LnRlc3QucHVzaFJlc3VsdChyZXN1bHRJbmZvKTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwib2tcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBvayhyZXN1bHQsIG1lc3NhZ2UpIHtcblx0ICAgICAgaWYgKCFtZXNzYWdlKSB7XG5cdCAgICAgICAgbWVzc2FnZSA9IHJlc3VsdCA/IFwib2theVwiIDogXCJmYWlsZWQsIGV4cGVjdGVkIGFyZ3VtZW50IHRvIGJlIHRydXRoeSwgd2FzOiBcIi5jb25jYXQoZHVtcC5wYXJzZShyZXN1bHQpKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiAhIXJlc3VsdCxcblx0ICAgICAgICBhY3R1YWw6IHJlc3VsdCxcblx0ICAgICAgICBleHBlY3RlZDogdHJ1ZSxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJub3RPa1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIG5vdE9rKHJlc3VsdCwgbWVzc2FnZSkge1xuXHQgICAgICBpZiAoIW1lc3NhZ2UpIHtcblx0ICAgICAgICBtZXNzYWdlID0gIXJlc3VsdCA/IFwib2theVwiIDogXCJmYWlsZWQsIGV4cGVjdGVkIGFyZ3VtZW50IHRvIGJlIGZhbHN5LCB3YXM6IFwiLmNvbmNhdChkdW1wLnBhcnNlKHJlc3VsdCkpO1xuXHQgICAgICB9XG5cblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6ICFyZXN1bHQsXG5cdCAgICAgICAgYWN0dWFsOiByZXN1bHQsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGZhbHNlLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2Vcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcInRydWVcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBfdHJ1ZShyZXN1bHQsIG1lc3NhZ2UpIHtcblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6IHJlc3VsdCA9PT0gdHJ1ZSxcblx0ICAgICAgICBhY3R1YWw6IHJlc3VsdCxcblx0ICAgICAgICBleHBlY3RlZDogdHJ1ZSxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJmYWxzZVwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIF9mYWxzZShyZXN1bHQsIG1lc3NhZ2UpIHtcblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6IHJlc3VsdCA9PT0gZmFsc2UsXG5cdCAgICAgICAgYWN0dWFsOiByZXN1bHQsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGZhbHNlLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2Vcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImVxdWFsXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuXHQgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgZXFlcWVxXG5cdCAgICAgIHZhciByZXN1bHQgPSBleHBlY3RlZCA9PSBhY3R1YWw7XG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiByZXN1bHQsXG5cdCAgICAgICAgYWN0dWFsOiBhY3R1YWwsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2Vcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcIm5vdEVxdWFsXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gbm90RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuXHQgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgZXFlcWVxXG5cdCAgICAgIHZhciByZXN1bHQgPSBleHBlY3RlZCAhPSBhY3R1YWw7XG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiByZXN1bHQsXG5cdCAgICAgICAgYWN0dWFsOiBhY3R1YWwsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG5cdCAgICAgICAgbmVnYXRpdmU6IHRydWVcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcInByb3BFcXVhbFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHByb3BFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG5cdCAgICAgIGFjdHVhbCA9IG9iamVjdFZhbHVlcyhhY3R1YWwpO1xuXHQgICAgICBleHBlY3RlZCA9IG9iamVjdFZhbHVlcyhleHBlY3RlZCk7XG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiBlcXVpdihhY3R1YWwsIGV4cGVjdGVkKSxcblx0ICAgICAgICBhY3R1YWw6IGFjdHVhbCxcblx0ICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwibm90UHJvcEVxdWFsXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gbm90UHJvcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcblx0ICAgICAgYWN0dWFsID0gb2JqZWN0VmFsdWVzKGFjdHVhbCk7XG5cdCAgICAgIGV4cGVjdGVkID0gb2JqZWN0VmFsdWVzKGV4cGVjdGVkKTtcblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6ICFlcXVpdihhY3R1YWwsIGV4cGVjdGVkKSxcblx0ICAgICAgICBhY3R1YWw6IGFjdHVhbCxcblx0ICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcblx0ICAgICAgICBuZWdhdGl2ZTogdHJ1ZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZGVlcEVxdWFsXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6IGVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQpLFxuXHQgICAgICAgIGFjdHVhbDogYWN0dWFsLFxuXHQgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJub3REZWVwRXF1YWxcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBub3REZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogIWVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQpLFxuXHQgICAgICAgIGFjdHVhbDogYWN0dWFsLFxuXHQgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuXHQgICAgICAgIG5lZ2F0aXZlOiB0cnVlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJzdHJpY3RFcXVhbFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6IGV4cGVjdGVkID09PSBhY3R1YWwsXG5cdCAgICAgICAgYWN0dWFsOiBhY3R1YWwsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2Vcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcIm5vdFN0cmljdEVxdWFsXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gbm90U3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogZXhwZWN0ZWQgIT09IGFjdHVhbCxcblx0ICAgICAgICBhY3R1YWw6IGFjdHVhbCxcblx0ICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcblx0ICAgICAgICBuZWdhdGl2ZTogdHJ1ZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwidGhyb3dzXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gdGhyb3dzKGJsb2NrLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuXHQgICAgICB2YXIgYWN0dWFsLFxuXHQgICAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG5cdCAgICAgIHZhciBjdXJyZW50VGVzdCA9IHRoaXMgaW5zdGFuY2VvZiBBc3NlcnQgJiYgdGhpcy50ZXN0IHx8IGNvbmZpZy5jdXJyZW50OyAvLyAnZXhwZWN0ZWQnIGlzIG9wdGlvbmFsIHVubGVzcyBkb2luZyBzdHJpbmcgY29tcGFyaXNvblxuXG5cdCAgICAgIGlmIChvYmplY3RUeXBlKGV4cGVjdGVkKSA9PT0gXCJzdHJpbmdcIikge1xuXHQgICAgICAgIGlmIChtZXNzYWdlID09IG51bGwpIHtcblx0ICAgICAgICAgIG1lc3NhZ2UgPSBleHBlY3RlZDtcblx0ICAgICAgICAgIGV4cGVjdGVkID0gbnVsbDtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwidGhyb3dzL3JhaXNlcyBkb2VzIG5vdCBhY2NlcHQgYSBzdHJpbmcgdmFsdWUgZm9yIHRoZSBleHBlY3RlZCBhcmd1bWVudC5cXG5cIiArIFwiVXNlIGEgbm9uLXN0cmluZyBvYmplY3QgdmFsdWUgKGUuZy4gcmVnRXhwKSBpbnN0ZWFkIGlmIGl0J3MgbmVjZXNzYXJ5LlwiKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBjdXJyZW50VGVzdC5pZ25vcmVHbG9iYWxFcnJvcnMgPSB0cnVlO1xuXG5cdCAgICAgIHRyeSB7XG5cdCAgICAgICAgYmxvY2suY2FsbChjdXJyZW50VGVzdC50ZXN0RW52aXJvbm1lbnQpO1xuXHQgICAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgICAgYWN0dWFsID0gZTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGN1cnJlbnRUZXN0Lmlnbm9yZUdsb2JhbEVycm9ycyA9IGZhbHNlO1xuXG5cdCAgICAgIGlmIChhY3R1YWwpIHtcblx0ICAgICAgICB2YXIgZXhwZWN0ZWRUeXBlID0gb2JqZWN0VHlwZShleHBlY3RlZCk7IC8vIFdlIGRvbid0IHdhbnQgdG8gdmFsaWRhdGUgdGhyb3duIGVycm9yXG5cblx0ICAgICAgICBpZiAoIWV4cGVjdGVkKSB7XG5cdCAgICAgICAgICByZXN1bHQgPSB0cnVlOyAvLyBFeHBlY3RlZCBpcyBhIHJlZ2V4cFxuXHQgICAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWRUeXBlID09PSBcInJlZ2V4cFwiKSB7XG5cdCAgICAgICAgICByZXN1bHQgPSBleHBlY3RlZC50ZXN0KGVycm9yU3RyaW5nKGFjdHVhbCkpOyAvLyBMb2cgdGhlIHN0cmluZyBmb3JtIG9mIHRoZSByZWdleHBcblxuXHQgICAgICAgICAgZXhwZWN0ZWQgPSBTdHJpbmcoZXhwZWN0ZWQpOyAvLyBFeHBlY3RlZCBpcyBhIGNvbnN0cnVjdG9yLCBtYXliZSBhbiBFcnJvciBjb25zdHJ1Y3RvclxuXHQgICAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWRUeXBlID09PSBcImZ1bmN0aW9uXCIgJiYgYWN0dWFsIGluc3RhbmNlb2YgZXhwZWN0ZWQpIHtcblx0ICAgICAgICAgIHJlc3VsdCA9IHRydWU7IC8vIEV4cGVjdGVkIGlzIGFuIEVycm9yIG9iamVjdFxuXHQgICAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWRUeXBlID09PSBcIm9iamVjdFwiKSB7XG5cdCAgICAgICAgICByZXN1bHQgPSBhY3R1YWwgaW5zdGFuY2VvZiBleHBlY3RlZC5jb25zdHJ1Y3RvciAmJiBhY3R1YWwubmFtZSA9PT0gZXhwZWN0ZWQubmFtZSAmJiBhY3R1YWwubWVzc2FnZSA9PT0gZXhwZWN0ZWQubWVzc2FnZTsgLy8gTG9nIHRoZSBzdHJpbmcgZm9ybSBvZiB0aGUgRXJyb3Igb2JqZWN0XG5cblx0ICAgICAgICAgIGV4cGVjdGVkID0gZXJyb3JTdHJpbmcoZXhwZWN0ZWQpOyAvLyBFeHBlY3RlZCBpcyBhIHZhbGlkYXRpb24gZnVuY3Rpb24gd2hpY2ggcmV0dXJucyB0cnVlIGlmIHZhbGlkYXRpb24gcGFzc2VkXG5cdCAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZFR5cGUgPT09IFwiZnVuY3Rpb25cIiAmJiBleHBlY3RlZC5jYWxsKHt9LCBhY3R1YWwpID09PSB0cnVlKSB7XG5cdCAgICAgICAgICBleHBlY3RlZCA9IG51bGw7XG5cdCAgICAgICAgICByZXN1bHQgPSB0cnVlO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIGN1cnJlbnRUZXN0LmFzc2VydC5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6IHJlc3VsdCxcblx0ICAgICAgICAvLyB1bmRlZmluZWQgaWYgaXQgZGlkbid0IHRocm93XG5cdCAgICAgICAgYWN0dWFsOiBhY3R1YWwgJiYgZXJyb3JTdHJpbmcoYWN0dWFsKSxcblx0ICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwicmVqZWN0c1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHJlamVjdHMocHJvbWlzZSwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcblx0ICAgICAgdmFyIHJlc3VsdCA9IGZhbHNlO1xuXHQgICAgICB2YXIgY3VycmVudFRlc3QgPSB0aGlzIGluc3RhbmNlb2YgQXNzZXJ0ICYmIHRoaXMudGVzdCB8fCBjb25maWcuY3VycmVudDsgLy8gJ2V4cGVjdGVkJyBpcyBvcHRpb25hbCB1bmxlc3MgZG9pbmcgc3RyaW5nIGNvbXBhcmlzb25cblxuXHQgICAgICBpZiAob2JqZWN0VHlwZShleHBlY3RlZCkgPT09IFwic3RyaW5nXCIpIHtcblx0ICAgICAgICBpZiAobWVzc2FnZSA9PT0gdW5kZWZpbmVkKSB7XG5cdCAgICAgICAgICBtZXNzYWdlID0gZXhwZWN0ZWQ7XG5cdCAgICAgICAgICBleHBlY3RlZCA9IHVuZGVmaW5lZDtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgbWVzc2FnZSA9IFwiYXNzZXJ0LnJlamVjdHMgZG9lcyBub3QgYWNjZXB0IGEgc3RyaW5nIHZhbHVlIGZvciB0aGUgZXhwZWN0ZWQgXCIgKyBcImFyZ3VtZW50LlxcblVzZSBhIG5vbi1zdHJpbmcgb2JqZWN0IHZhbHVlIChlLmcuIHZhbGlkYXRvciBmdW5jdGlvbikgaW5zdGVhZCBcIiArIFwiaWYgbmVjZXNzYXJ5LlwiO1xuXHQgICAgICAgICAgY3VycmVudFRlc3QuYXNzZXJ0LnB1c2hSZXN1bHQoe1xuXHQgICAgICAgICAgICByZXN1bHQ6IGZhbHNlLFxuXHQgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG5cdCAgICAgICAgICB9KTtcblx0ICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICB2YXIgdGhlbiA9IHByb21pc2UgJiYgcHJvbWlzZS50aGVuO1xuXG5cdCAgICAgIGlmIChvYmplY3RUeXBlKHRoZW4pICE9PSBcImZ1bmN0aW9uXCIpIHtcblx0ICAgICAgICB2YXIgX21lc3NhZ2UgPSBcIlRoZSB2YWx1ZSBwcm92aWRlZCB0byBgYXNzZXJ0LnJlamVjdHNgIGluIFwiICsgXCJcXFwiXCIgKyBjdXJyZW50VGVzdC50ZXN0TmFtZSArIFwiXFxcIiB3YXMgbm90IGEgcHJvbWlzZS5cIjtcblxuXHQgICAgICAgIGN1cnJlbnRUZXN0LmFzc2VydC5wdXNoUmVzdWx0KHtcblx0ICAgICAgICAgIHJlc3VsdDogZmFsc2UsXG5cdCAgICAgICAgICBtZXNzYWdlOiBfbWVzc2FnZSxcblx0ICAgICAgICAgIGFjdHVhbDogcHJvbWlzZVxuXHQgICAgICAgIH0pO1xuXHQgICAgICAgIHJldHVybjtcblx0ICAgICAgfVxuXG5cdCAgICAgIHZhciBkb25lID0gdGhpcy5hc3luYygpO1xuXHQgICAgICByZXR1cm4gdGhlbi5jYWxsKHByb21pc2UsIGZ1bmN0aW9uIGhhbmRsZUZ1bGZpbGxtZW50KCkge1xuXHQgICAgICAgIHZhciBtZXNzYWdlID0gXCJUaGUgcHJvbWlzZSByZXR1cm5lZCBieSB0aGUgYGFzc2VydC5yZWplY3RzYCBjYWxsYmFjayBpbiBcIiArIFwiXFxcIlwiICsgY3VycmVudFRlc3QudGVzdE5hbWUgKyBcIlxcXCIgZGlkIG5vdCByZWplY3QuXCI7XG5cdCAgICAgICAgY3VycmVudFRlc3QuYXNzZXJ0LnB1c2hSZXN1bHQoe1xuXHQgICAgICAgICAgcmVzdWx0OiBmYWxzZSxcblx0ICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG5cdCAgICAgICAgICBhY3R1YWw6IHByb21pc2Vcblx0ICAgICAgICB9KTtcblx0ICAgICAgICBkb25lKCk7XG5cdCAgICAgIH0sIGZ1bmN0aW9uIGhhbmRsZVJlamVjdGlvbihhY3R1YWwpIHtcblx0ICAgICAgICB2YXIgZXhwZWN0ZWRUeXBlID0gb2JqZWN0VHlwZShleHBlY3RlZCk7IC8vIFdlIGRvbid0IHdhbnQgdG8gdmFsaWRhdGVcblxuXHQgICAgICAgIGlmIChleHBlY3RlZCA9PT0gdW5kZWZpbmVkKSB7XG5cdCAgICAgICAgICByZXN1bHQgPSB0cnVlOyAvLyBFeHBlY3RlZCBpcyBhIHJlZ2V4cFxuXHQgICAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWRUeXBlID09PSBcInJlZ2V4cFwiKSB7XG5cdCAgICAgICAgICByZXN1bHQgPSBleHBlY3RlZC50ZXN0KGVycm9yU3RyaW5nKGFjdHVhbCkpOyAvLyBMb2cgdGhlIHN0cmluZyBmb3JtIG9mIHRoZSByZWdleHBcblxuXHQgICAgICAgICAgZXhwZWN0ZWQgPSBTdHJpbmcoZXhwZWN0ZWQpOyAvLyBFeHBlY3RlZCBpcyBhIGNvbnN0cnVjdG9yLCBtYXliZSBhbiBFcnJvciBjb25zdHJ1Y3RvclxuXHQgICAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWRUeXBlID09PSBcImZ1bmN0aW9uXCIgJiYgYWN0dWFsIGluc3RhbmNlb2YgZXhwZWN0ZWQpIHtcblx0ICAgICAgICAgIHJlc3VsdCA9IHRydWU7IC8vIEV4cGVjdGVkIGlzIGFuIEVycm9yIG9iamVjdFxuXHQgICAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWRUeXBlID09PSBcIm9iamVjdFwiKSB7XG5cdCAgICAgICAgICByZXN1bHQgPSBhY3R1YWwgaW5zdGFuY2VvZiBleHBlY3RlZC5jb25zdHJ1Y3RvciAmJiBhY3R1YWwubmFtZSA9PT0gZXhwZWN0ZWQubmFtZSAmJiBhY3R1YWwubWVzc2FnZSA9PT0gZXhwZWN0ZWQubWVzc2FnZTsgLy8gTG9nIHRoZSBzdHJpbmcgZm9ybSBvZiB0aGUgRXJyb3Igb2JqZWN0XG5cblx0ICAgICAgICAgIGV4cGVjdGVkID0gZXJyb3JTdHJpbmcoZXhwZWN0ZWQpOyAvLyBFeHBlY3RlZCBpcyBhIHZhbGlkYXRpb24gZnVuY3Rpb24gd2hpY2ggcmV0dXJucyB0cnVlIGlmIHZhbGlkYXRpb24gcGFzc2VkXG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGlmIChleHBlY3RlZFR5cGUgPT09IFwiZnVuY3Rpb25cIikge1xuXHQgICAgICAgICAgICByZXN1bHQgPSBleHBlY3RlZC5jYWxsKHt9LCBhY3R1YWwpID09PSB0cnVlO1xuXHQgICAgICAgICAgICBleHBlY3RlZCA9IG51bGw7IC8vIEV4cGVjdGVkIGlzIHNvbWUgb3RoZXIgaW52YWxpZCB0eXBlXG5cdCAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICByZXN1bHQgPSBmYWxzZTtcblx0ICAgICAgICAgICAgbWVzc2FnZSA9IFwiaW52YWxpZCBleHBlY3RlZCB2YWx1ZSBwcm92aWRlZCB0byBgYXNzZXJ0LnJlamVjdHNgIFwiICsgXCJjYWxsYmFjayBpbiBcXFwiXCIgKyBjdXJyZW50VGVzdC50ZXN0TmFtZSArIFwiXFxcIjogXCIgKyBleHBlY3RlZFR5cGUgKyBcIi5cIjtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cblx0ICAgICAgICBjdXJyZW50VGVzdC5hc3NlcnQucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgICByZXN1bHQ6IHJlc3VsdCxcblx0ICAgICAgICAgIC8vIGxlYXZlIHJlamVjdGlvbiB2YWx1ZSBvZiB1bmRlZmluZWQgYXMtaXNcblx0ICAgICAgICAgIGFjdHVhbDogYWN0dWFsICYmIGVycm9yU3RyaW5nKGFjdHVhbCksXG5cdCAgICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG5cdCAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG5cdCAgICAgICAgfSk7XG5cdCAgICAgICAgZG9uZSgpO1xuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9XSk7XG5cblx0ICByZXR1cm4gQXNzZXJ0O1xuXHR9KCk7IC8vIFByb3ZpZGUgYW4gYWx0ZXJuYXRpdmUgdG8gYXNzZXJ0LnRocm93cygpLCBmb3IgZW52aXJvbm1lbnRzIHRoYXQgY29uc2lkZXIgdGhyb3dzIGEgcmVzZXJ2ZWQgd29yZFxuXHQvLyBLbm93biB0byB1cyBhcmU6IENsb3N1cmUgQ29tcGlsZXIsIE5hcndoYWxcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGRvdC1ub3RhdGlvblxuXG5cblx0QXNzZXJ0LnByb3RvdHlwZS5yYWlzZXMgPSBBc3NlcnQucHJvdG90eXBlW1widGhyb3dzXCJdO1xuXHQvKipcblx0ICogQ29udmVydHMgYW4gZXJyb3IgaW50byBhIHNpbXBsZSBzdHJpbmcgZm9yIGNvbXBhcmlzb25zLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0Vycm9yfE9iamVjdH0gZXJyb3Jcblx0ICogQHJldHVybiB7U3RyaW5nfVxuXHQgKi9cblxuXHRmdW5jdGlvbiBlcnJvclN0cmluZyhlcnJvcikge1xuXHQgIHZhciByZXN1bHRFcnJvclN0cmluZyA9IGVycm9yLnRvU3RyaW5nKCk7IC8vIElmIHRoZSBlcnJvciB3YXNuJ3QgYSBzdWJjbGFzcyBvZiBFcnJvciBidXQgc29tZXRoaW5nIGxpa2Vcblx0ICAvLyBhbiBvYmplY3QgbGl0ZXJhbCB3aXRoIG5hbWUgYW5kIG1lc3NhZ2UgcHJvcGVydGllcy4uLlxuXG5cdCAgaWYgKHJlc3VsdEVycm9yU3RyaW5nLnN1YnN0cmluZygwLCA3KSA9PT0gXCJbb2JqZWN0XCIpIHtcblx0ICAgIHZhciBuYW1lID0gZXJyb3IubmFtZSA/IGVycm9yLm5hbWUudG9TdHJpbmcoKSA6IFwiRXJyb3JcIjtcblx0ICAgIHZhciBtZXNzYWdlID0gZXJyb3IubWVzc2FnZSA/IGVycm9yLm1lc3NhZ2UudG9TdHJpbmcoKSA6IFwiXCI7XG5cblx0ICAgIGlmIChuYW1lICYmIG1lc3NhZ2UpIHtcblx0ICAgICAgcmV0dXJuIFwiXCIuY29uY2F0KG5hbWUsIFwiOiBcIikuY29uY2F0KG1lc3NhZ2UpO1xuXHQgICAgfSBlbHNlIGlmIChuYW1lKSB7XG5cdCAgICAgIHJldHVybiBuYW1lO1xuXHQgICAgfSBlbHNlIGlmIChtZXNzYWdlKSB7XG5cdCAgICAgIHJldHVybiBtZXNzYWdlO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgcmV0dXJuIFwiRXJyb3JcIjtcblx0ICAgIH1cblx0ICB9IGVsc2Uge1xuXHQgICAgcmV0dXJuIHJlc3VsdEVycm9yU3RyaW5nO1xuXHQgIH1cblx0fVxuXG5cdC8qIGdsb2JhbCBtb2R1bGUsIGV4cG9ydHMsIGRlZmluZSAqL1xuXHRmdW5jdGlvbiBleHBvcnRRVW5pdChRVW5pdCkge1xuXHQgIGlmIChkZWZpbmVkLmRvY3VtZW50KSB7XG5cdCAgICAvLyBRVW5pdCBtYXkgYmUgZGVmaW5lZCB3aGVuIGl0IGlzIHByZWNvbmZpZ3VyZWQgYnV0IHRoZW4gb25seSBRVW5pdCBhbmQgUVVuaXQuY29uZmlnIG1heSBiZSBkZWZpbmVkLlxuXHQgICAgaWYgKHdpbmRvdyQxLlFVbml0ICYmIHdpbmRvdyQxLlFVbml0LnZlcnNpb24pIHtcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUVVuaXQgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkLlwiKTtcblx0ICAgIH1cblxuXHQgICAgd2luZG93JDEuUVVuaXQgPSBRVW5pdDtcblx0ICB9IC8vIEZvciBub2RlanNcblxuXG5cdCAgaWYgKHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdCAgICBtb2R1bGUuZXhwb3J0cyA9IFFVbml0OyAvLyBGb3IgY29uc2lzdGVuY3kgd2l0aCBDb21tb25KUyBlbnZpcm9ubWVudHMnIGV4cG9ydHNcblxuXHQgICAgbW9kdWxlLmV4cG9ydHMuUVVuaXQgPSBRVW5pdDtcblx0ICB9IC8vIEZvciBDb21tb25KUyB3aXRoIGV4cG9ydHMsIGJ1dCB3aXRob3V0IG1vZHVsZS5leHBvcnRzLCBsaWtlIFJoaW5vXG5cblxuXHQgIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBleHBvcnRzKSB7XG5cdCAgICBleHBvcnRzLlFVbml0ID0gUVVuaXQ7XG5cdCAgfVxuXG5cdCAgaWYgKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XG5cdCAgICBkZWZpbmUoZnVuY3Rpb24gKCkge1xuXHQgICAgICByZXR1cm4gUVVuaXQ7XG5cdCAgICB9KTtcblx0ICAgIFFVbml0LmNvbmZpZy5hdXRvc3RhcnQgPSBmYWxzZTtcblx0ICB9IC8vIEZvciBXZWIvU2VydmljZSBXb3JrZXJzXG5cblxuXHQgIGlmIChzZWxmJDEgJiYgc2VsZiQxLldvcmtlckdsb2JhbFNjb3BlICYmIHNlbGYkMSBpbnN0YW5jZW9mIHNlbGYkMS5Xb3JrZXJHbG9iYWxTY29wZSkge1xuXHQgICAgc2VsZiQxLlFVbml0ID0gUVVuaXQ7XG5cdCAgfVxuXHR9XG5cblx0Ly8gZXJyb3IgaGFuZGxpbmcgc2hvdWxkIGJlIHN1cHByZXNzZWQgYW5kIGZhbHNlIG90aGVyd2lzZS5cblx0Ly8gSW4gdGhpcyBjYXNlLCB3ZSB3aWxsIG9ubHkgc3VwcHJlc3MgZnVydGhlciBlcnJvciBoYW5kbGluZyBpZiB0aGVcblx0Ly8gXCJpZ25vcmVHbG9iYWxFcnJvcnNcIiBjb25maWd1cmF0aW9uIG9wdGlvbiBpcyBlbmFibGVkLlxuXG5cdGZ1bmN0aW9uIG9uRXJyb3IoZXJyb3IpIHtcblx0ICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IG5ldyBBcnJheShfbGVuID4gMSA/IF9sZW4gLSAxIDogMCksIF9rZXkgPSAxOyBfa2V5IDwgX2xlbjsgX2tleSsrKSB7XG5cdCAgICBhcmdzW19rZXkgLSAxXSA9IGFyZ3VtZW50c1tfa2V5XTtcblx0ICB9XG5cblx0ICBpZiAoY29uZmlnLmN1cnJlbnQpIHtcblx0ICAgIGlmIChjb25maWcuY3VycmVudC5pZ25vcmVHbG9iYWxFcnJvcnMpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9XG5cblx0ICAgIHB1c2hGYWlsdXJlLmFwcGx5KHZvaWQgMCwgW2Vycm9yLm1lc3NhZ2UsIGVycm9yLnN0YWNrdHJhY2UgfHwgZXJyb3IuZmlsZU5hbWUgKyBcIjpcIiArIGVycm9yLmxpbmVOdW1iZXJdLmNvbmNhdChhcmdzKSk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHRlc3QoXCJnbG9iYWwgZmFpbHVyZVwiLCBleHRlbmQoZnVuY3Rpb24gKCkge1xuXHQgICAgICBwdXNoRmFpbHVyZS5hcHBseSh2b2lkIDAsIFtlcnJvci5tZXNzYWdlLCBlcnJvci5zdGFja3RyYWNlIHx8IGVycm9yLmZpbGVOYW1lICsgXCI6XCIgKyBlcnJvci5saW5lTnVtYmVyXS5jb25jYXQoYXJncykpO1xuXHQgICAgfSwge1xuXHQgICAgICB2YWxpZFRlc3Q6IHRydWVcblx0ICAgIH0pKTtcblx0ICB9XG5cblx0ICByZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRmdW5jdGlvbiBvblVuaGFuZGxlZFJlamVjdGlvbihyZWFzb24pIHtcblx0ICB2YXIgcmVzdWx0SW5mbyA9IHtcblx0ICAgIHJlc3VsdDogZmFsc2UsXG5cdCAgICBtZXNzYWdlOiByZWFzb24ubWVzc2FnZSB8fCBcImVycm9yXCIsXG5cdCAgICBhY3R1YWw6IHJlYXNvbixcblx0ICAgIHNvdXJjZTogcmVhc29uLnN0YWNrIHx8IHNvdXJjZUZyb21TdGFja3RyYWNlKDMpXG5cdCAgfTtcblx0ICB2YXIgY3VycmVudFRlc3QgPSBjb25maWcuY3VycmVudDtcblxuXHQgIGlmIChjdXJyZW50VGVzdCkge1xuXHQgICAgY3VycmVudFRlc3QuYXNzZXJ0LnB1c2hSZXN1bHQocmVzdWx0SW5mbyk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHRlc3QoXCJnbG9iYWwgZmFpbHVyZVwiLCBleHRlbmQoZnVuY3Rpb24gKGFzc2VydCkge1xuXHQgICAgICBhc3NlcnQucHVzaFJlc3VsdChyZXN1bHRJbmZvKTtcblx0ICAgIH0sIHtcblx0ICAgICAgdmFsaWRUZXN0OiB0cnVlXG5cdCAgICB9KSk7XG5cdCAgfVxuXHR9XG5cblx0dmFyIFFVbml0ID0ge307XG5cdHZhciBnbG9iYWxTdWl0ZSA9IG5ldyBTdWl0ZVJlcG9ydCgpOyAvLyBUaGUgaW5pdGlhbCBcImN1cnJlbnRNb2R1bGVcIiByZXByZXNlbnRzIHRoZSBnbG9iYWwgKG9yIHRvcC1sZXZlbCkgbW9kdWxlIHRoYXRcblx0Ly8gaXMgbm90IGV4cGxpY2l0bHkgZGVmaW5lZCBieSB0aGUgdXNlciwgdGhlcmVmb3JlIHdlIGFkZCB0aGUgXCJnbG9iYWxTdWl0ZVwiIHRvXG5cdC8vIGl0IHNpbmNlIGVhY2ggbW9kdWxlIGhhcyBhIHN1aXRlUmVwb3J0IGFzc29jaWF0ZWQgd2l0aCBpdC5cblxuXHRjb25maWcuY3VycmVudE1vZHVsZS5zdWl0ZVJlcG9ydCA9IGdsb2JhbFN1aXRlO1xuXHR2YXIgZ2xvYmFsU3RhcnRDYWxsZWQgPSBmYWxzZTtcblx0dmFyIHJ1blN0YXJ0ZWQgPSBmYWxzZTsgLy8gRmlndXJlIG91dCBpZiB3ZSdyZSBydW5uaW5nIHRoZSB0ZXN0cyBmcm9tIGEgc2VydmVyIG9yIG5vdFxuXG5cdFFVbml0LmlzTG9jYWwgPSAhKGRlZmluZWQuZG9jdW1lbnQgJiYgd2luZG93JDEubG9jYXRpb24ucHJvdG9jb2wgIT09IFwiZmlsZTpcIik7IC8vIEV4cG9zZSB0aGUgY3VycmVudCBRVW5pdCB2ZXJzaW9uXG5cblx0UVVuaXQudmVyc2lvbiA9IFwiMi4xMS4zXCI7XG5cdGV4dGVuZChRVW5pdCwge1xuXHQgIG9uOiBvbixcblx0ICBtb2R1bGU6IG1vZHVsZSQxLFxuXHQgIHRlc3Q6IHRlc3QsXG5cdCAgdG9kbzogdG9kbyxcblx0ICBza2lwOiBza2lwLFxuXHQgIG9ubHk6IG9ubHksXG5cdCAgc3RhcnQ6IGZ1bmN0aW9uIHN0YXJ0KGNvdW50KSB7XG5cdCAgICB2YXIgZ2xvYmFsU3RhcnRBbHJlYWR5Q2FsbGVkID0gZ2xvYmFsU3RhcnRDYWxsZWQ7XG5cblx0ICAgIGlmICghY29uZmlnLmN1cnJlbnQpIHtcblx0ICAgICAgZ2xvYmFsU3RhcnRDYWxsZWQgPSB0cnVlO1xuXG5cdCAgICAgIGlmIChydW5TdGFydGVkKSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGVkIHN0YXJ0KCkgd2hpbGUgdGVzdCBhbHJlYWR5IHN0YXJ0ZWQgcnVubmluZ1wiKTtcblx0ICAgICAgfSBlbHNlIGlmIChnbG9iYWxTdGFydEFscmVhZHlDYWxsZWQgfHwgY291bnQgPiAxKSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGVkIHN0YXJ0KCkgb3V0c2lkZSBvZiBhIHRlc3QgY29udGV4dCB0b28gbWFueSB0aW1lc1wiKTtcblx0ICAgICAgfSBlbHNlIGlmIChjb25maWcuYXV0b3N0YXJ0KSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGVkIHN0YXJ0KCkgb3V0c2lkZSBvZiBhIHRlc3QgY29udGV4dCB3aGVuIFwiICsgXCJRVW5pdC5jb25maWcuYXV0b3N0YXJ0IHdhcyB0cnVlXCIpO1xuXHQgICAgICB9IGVsc2UgaWYgKCFjb25maWcucGFnZUxvYWRlZCkge1xuXHQgICAgICAgIC8vIFRoZSBwYWdlIGlzbid0IGNvbXBsZXRlbHkgbG9hZGVkIHlldCwgc28gd2Ugc2V0IGF1dG9zdGFydCBhbmQgdGhlblxuXHQgICAgICAgIC8vIGxvYWQgaWYgd2UncmUgaW4gTm9kZSBvciB3YWl0IGZvciB0aGUgYnJvd3NlcidzIGxvYWQgZXZlbnQuXG5cdCAgICAgICAgY29uZmlnLmF1dG9zdGFydCA9IHRydWU7IC8vIFN0YXJ0cyBmcm9tIE5vZGUgZXZlbiBpZiAubG9hZCB3YXMgbm90IHByZXZpb3VzbHkgY2FsbGVkLiBXZSBzdGlsbCByZXR1cm5cblx0ICAgICAgICAvLyBlYXJseSBvdGhlcndpc2Ugd2UnbGwgd2luZCB1cCBcImJlZ2lubmluZ1wiIHR3aWNlLlxuXG5cdCAgICAgICAgaWYgKCFkZWZpbmVkLmRvY3VtZW50KSB7XG5cdCAgICAgICAgICBRVW5pdC5sb2FkKCk7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgcmV0dXJuO1xuXHQgICAgICB9XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJRVW5pdC5zdGFydCBjYW5ub3QgYmUgY2FsbGVkIGluc2lkZSBhIHRlc3QgY29udGV4dC5cIik7XG5cdCAgICB9XG5cblx0ICAgIHNjaGVkdWxlQmVnaW4oKTtcblx0ICB9LFxuXHQgIGNvbmZpZzogY29uZmlnLFxuXHQgIGlzOiBpcyxcblx0ICBvYmplY3RUeXBlOiBvYmplY3RUeXBlLFxuXHQgIGV4dGVuZDogZXh0ZW5kLFxuXHQgIGxvYWQ6IGZ1bmN0aW9uIGxvYWQoKSB7XG5cdCAgICBjb25maWcucGFnZUxvYWRlZCA9IHRydWU7IC8vIEluaXRpYWxpemUgdGhlIGNvbmZpZ3VyYXRpb24gb3B0aW9uc1xuXG5cdCAgICBleHRlbmQoY29uZmlnLCB7XG5cdCAgICAgIHN0YXRzOiB7XG5cdCAgICAgICAgYWxsOiAwLFxuXHQgICAgICAgIGJhZDogMCxcblx0ICAgICAgICB0ZXN0Q291bnQ6IDBcblx0ICAgICAgfSxcblx0ICAgICAgc3RhcnRlZDogMCxcblx0ICAgICAgdXBkYXRlUmF0ZTogMTAwMCxcblx0ICAgICAgYXV0b3N0YXJ0OiB0cnVlLFxuXHQgICAgICBmaWx0ZXI6IFwiXCJcblx0ICAgIH0sIHRydWUpO1xuXG5cdCAgICBpZiAoIXJ1blN0YXJ0ZWQpIHtcblx0ICAgICAgY29uZmlnLmJsb2NraW5nID0gZmFsc2U7XG5cblx0ICAgICAgaWYgKGNvbmZpZy5hdXRvc3RhcnQpIHtcblx0ICAgICAgICBzY2hlZHVsZUJlZ2luKCk7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9LFxuXHQgIHN0YWNrOiBmdW5jdGlvbiBzdGFjayhvZmZzZXQpIHtcblx0ICAgIG9mZnNldCA9IChvZmZzZXQgfHwgMCkgKyAyO1xuXHQgICAgcmV0dXJuIHNvdXJjZUZyb21TdGFja3RyYWNlKG9mZnNldCk7XG5cdCAgfSxcblx0ICBvbkVycm9yOiBvbkVycm9yLFxuXHQgIG9uVW5oYW5kbGVkUmVqZWN0aW9uOiBvblVuaGFuZGxlZFJlamVjdGlvblxuXHR9KTtcblx0UVVuaXQucHVzaEZhaWx1cmUgPSBwdXNoRmFpbHVyZTtcblx0UVVuaXQuYXNzZXJ0ID0gQXNzZXJ0LnByb3RvdHlwZTtcblx0UVVuaXQuZXF1aXYgPSBlcXVpdjtcblx0UVVuaXQuZHVtcCA9IGR1bXA7XG5cdHJlZ2lzdGVyTG9nZ2luZ0NhbGxiYWNrcyhRVW5pdCk7XG5cblx0ZnVuY3Rpb24gc2NoZWR1bGVCZWdpbigpIHtcblx0ICBydW5TdGFydGVkID0gdHJ1ZTsgLy8gQWRkIGEgc2xpZ2h0IGRlbGF5IHRvIGFsbG93IGRlZmluaXRpb24gb2YgbW9yZSBtb2R1bGVzIGFuZCB0ZXN0cy5cblxuXHQgIGlmIChkZWZpbmVkLnNldFRpbWVvdXQpIHtcblx0ICAgIHNldFRpbWVvdXQkMShmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGJlZ2luKCk7XG5cdCAgICB9KTtcblx0ICB9IGVsc2Uge1xuXHQgICAgYmVnaW4oKTtcblx0ICB9XG5cdH1cblxuXHRmdW5jdGlvbiB1bmJsb2NrQW5kQWR2YW5jZVF1ZXVlKCkge1xuXHQgIGNvbmZpZy5ibG9ja2luZyA9IGZhbHNlO1xuXHQgIFByb2Nlc3NpbmdRdWV1ZS5hZHZhbmNlKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBiZWdpbigpIHtcblx0ICB2YXIgaSxcblx0ICAgICAgbCxcblx0ICAgICAgbW9kdWxlc0xvZyA9IFtdOyAvLyBJZiB0aGUgdGVzdCBydW4gaGFzbid0IG9mZmljaWFsbHkgYmVndW4geWV0XG5cblx0ICBpZiAoIWNvbmZpZy5zdGFydGVkKSB7XG5cdCAgICAvLyBSZWNvcmQgdGhlIHRpbWUgb2YgdGhlIHRlc3QgcnVuJ3MgYmVnaW5uaW5nXG5cdCAgICBjb25maWcuc3RhcnRlZCA9IG5vdygpOyAvLyBEZWxldGUgdGhlIGxvb3NlIHVubmFtZWQgbW9kdWxlIGlmIHVudXNlZC5cblxuXHQgICAgaWYgKGNvbmZpZy5tb2R1bGVzWzBdLm5hbWUgPT09IFwiXCIgJiYgY29uZmlnLm1vZHVsZXNbMF0udGVzdHMubGVuZ3RoID09PSAwKSB7XG5cdCAgICAgIGNvbmZpZy5tb2R1bGVzLnNoaWZ0KCk7XG5cdCAgICB9IC8vIEF2b2lkIHVubmVjZXNzYXJ5IGluZm9ybWF0aW9uIGJ5IG5vdCBsb2dnaW5nIG1vZHVsZXMnIHRlc3QgZW52aXJvbm1lbnRzXG5cblxuXHQgICAgZm9yIChpID0gMCwgbCA9IGNvbmZpZy5tb2R1bGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHQgICAgICBtb2R1bGVzTG9nLnB1c2goe1xuXHQgICAgICAgIG5hbWU6IGNvbmZpZy5tb2R1bGVzW2ldLm5hbWUsXG5cdCAgICAgICAgdGVzdHM6IGNvbmZpZy5tb2R1bGVzW2ldLnRlc3RzXG5cdCAgICAgIH0pO1xuXHQgICAgfSAvLyBUaGUgdGVzdCBydW4gaXMgb2ZmaWNpYWxseSBiZWdpbm5pbmcgbm93XG5cblxuXHQgICAgZW1pdChcInJ1blN0YXJ0XCIsIGdsb2JhbFN1aXRlLnN0YXJ0KHRydWUpKTtcblx0ICAgIHJ1bkxvZ2dpbmdDYWxsYmFja3MoXCJiZWdpblwiLCB7XG5cdCAgICAgIHRvdGFsVGVzdHM6IFRlc3QuY291bnQsXG5cdCAgICAgIG1vZHVsZXM6IG1vZHVsZXNMb2dcblx0ICAgIH0pLnRoZW4odW5ibG9ja0FuZEFkdmFuY2VRdWV1ZSk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHVuYmxvY2tBbmRBZHZhbmNlUXVldWUoKTtcblx0ICB9XG5cdH1cblx0ZXhwb3J0UVVuaXQoUVVuaXQpO1xuXG5cdChmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKHR5cGVvZiB3aW5kb3ckMSA9PT0gXCJ1bmRlZmluZWRcIiB8fCB0eXBlb2YgZG9jdW1lbnQkMSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHZhciBjb25maWcgPSBRVW5pdC5jb25maWcsXG5cdCAgICAgIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7IC8vIFN0b3JlcyBmaXh0dXJlIEhUTUwgZm9yIHJlc2V0dGluZyBsYXRlclxuXG5cdCAgZnVuY3Rpb24gc3RvcmVGaXh0dXJlKCkge1xuXHQgICAgLy8gQXZvaWQgb3ZlcndyaXRpbmcgdXNlci1kZWZpbmVkIHZhbHVlc1xuXHQgICAgaWYgKGhhc093bi5jYWxsKGNvbmZpZywgXCJmaXh0dXJlXCIpKSB7XG5cdCAgICAgIHJldHVybjtcblx0ICAgIH1cblxuXHQgICAgdmFyIGZpeHR1cmUgPSBkb2N1bWVudCQxLmdldEVsZW1lbnRCeUlkKFwicXVuaXQtZml4dHVyZVwiKTtcblxuXHQgICAgaWYgKGZpeHR1cmUpIHtcblx0ICAgICAgY29uZmlnLmZpeHR1cmUgPSBmaXh0dXJlLmNsb25lTm9kZSh0cnVlKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBRVW5pdC5iZWdpbihzdG9yZUZpeHR1cmUpOyAvLyBSZXNldHMgdGhlIGZpeHR1cmUgRE9NIGVsZW1lbnQgaWYgYXZhaWxhYmxlLlxuXG5cdCAgZnVuY3Rpb24gcmVzZXRGaXh0dXJlKCkge1xuXHQgICAgaWYgKGNvbmZpZy5maXh0dXJlID09IG51bGwpIHtcblx0ICAgICAgcmV0dXJuO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgZml4dHVyZSA9IGRvY3VtZW50JDEuZ2V0RWxlbWVudEJ5SWQoXCJxdW5pdC1maXh0dXJlXCIpO1xuXG5cdCAgICB2YXIgcmVzZXRGaXh0dXJlVHlwZSA9IF90eXBlb2YoY29uZmlnLmZpeHR1cmUpO1xuXG5cdCAgICBpZiAocmVzZXRGaXh0dXJlVHlwZSA9PT0gXCJzdHJpbmdcIikge1xuXHQgICAgICAvLyBzdXBwb3J0IHVzZXIgZGVmaW5lZCB2YWx1ZXMgZm9yIGBjb25maWcuZml4dHVyZWBcblx0ICAgICAgdmFyIG5ld0ZpeHR1cmUgPSBkb2N1bWVudCQxLmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdCAgICAgIG5ld0ZpeHR1cmUuc2V0QXR0cmlidXRlKFwiaWRcIiwgXCJxdW5pdC1maXh0dXJlXCIpO1xuXHQgICAgICBuZXdGaXh0dXJlLmlubmVySFRNTCA9IGNvbmZpZy5maXh0dXJlO1xuXHQgICAgICBmaXh0dXJlLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld0ZpeHR1cmUsIGZpeHR1cmUpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgdmFyIGNsb25lZEZpeHR1cmUgPSBjb25maWcuZml4dHVyZS5jbG9uZU5vZGUodHJ1ZSk7XG5cdCAgICAgIGZpeHR1cmUucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoY2xvbmVkRml4dHVyZSwgZml4dHVyZSk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgUVVuaXQudGVzdFN0YXJ0KHJlc2V0Rml4dHVyZSk7XG5cdH0pKCk7XG5cblx0KGZ1bmN0aW9uICgpIHtcblx0ICAvLyBPbmx5IGludGVyYWN0IHdpdGggVVJMcyB2aWEgd2luZG93LmxvY2F0aW9uXG5cdCAgdmFyIGxvY2F0aW9uID0gdHlwZW9mIHdpbmRvdyQxICE9PSBcInVuZGVmaW5lZFwiICYmIHdpbmRvdyQxLmxvY2F0aW9uO1xuXG5cdCAgaWYgKCFsb2NhdGlvbikge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHZhciB1cmxQYXJhbXMgPSBnZXRVcmxQYXJhbXMoKTtcblx0ICBRVW5pdC51cmxQYXJhbXMgPSB1cmxQYXJhbXM7IC8vIE1hdGNoIG1vZHVsZS90ZXN0IGJ5IGluY2x1c2lvbiBpbiBhbiBhcnJheVxuXG5cdCAgUVVuaXQuY29uZmlnLm1vZHVsZUlkID0gW10uY29uY2F0KHVybFBhcmFtcy5tb2R1bGVJZCB8fCBbXSk7XG5cdCAgUVVuaXQuY29uZmlnLnRlc3RJZCA9IFtdLmNvbmNhdCh1cmxQYXJhbXMudGVzdElkIHx8IFtdKTsgLy8gRXhhY3QgY2FzZS1pbnNlbnNpdGl2ZSBtYXRjaCBvZiB0aGUgbW9kdWxlIG5hbWVcblxuXHQgIFFVbml0LmNvbmZpZy5tb2R1bGUgPSB1cmxQYXJhbXMubW9kdWxlOyAvLyBSZWd1bGFyIGV4cHJlc3Npb24gb3IgY2FzZS1pbnNlbnN0aXZlIHN1YnN0cmluZyBtYXRjaCBhZ2FpbnN0IFwibW9kdWxlTmFtZTogdGVzdE5hbWVcIlxuXG5cdCAgUVVuaXQuY29uZmlnLmZpbHRlciA9IHVybFBhcmFtcy5maWx0ZXI7IC8vIFRlc3Qgb3JkZXIgcmFuZG9taXphdGlvblxuXG5cdCAgaWYgKHVybFBhcmFtcy5zZWVkID09PSB0cnVlKSB7XG5cdCAgICAvLyBHZW5lcmF0ZSBhIHJhbmRvbSBzZWVkIGlmIHRoZSBvcHRpb24gaXMgc3BlY2lmaWVkIHdpdGhvdXQgYSB2YWx1ZVxuXHQgICAgUVVuaXQuY29uZmlnLnNlZWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKTtcblx0ICB9IGVsc2UgaWYgKHVybFBhcmFtcy5zZWVkKSB7XG5cdCAgICBRVW5pdC5jb25maWcuc2VlZCA9IHVybFBhcmFtcy5zZWVkO1xuXHQgIH0gLy8gQWRkIFVSTC1wYXJhbWV0ZXItbWFwcGVkIGNvbmZpZyB2YWx1ZXMgd2l0aCBVSSBmb3JtIHJlbmRlcmluZyBkYXRhXG5cblxuXHQgIFFVbml0LmNvbmZpZy51cmxDb25maWcucHVzaCh7XG5cdCAgICBpZDogXCJoaWRlcGFzc2VkXCIsXG5cdCAgICBsYWJlbDogXCJIaWRlIHBhc3NlZCB0ZXN0c1wiLFxuXHQgICAgdG9vbHRpcDogXCJPbmx5IHNob3cgdGVzdHMgYW5kIGFzc2VydGlvbnMgdGhhdCBmYWlsLiBTdG9yZWQgYXMgcXVlcnktc3RyaW5ncy5cIlxuXHQgIH0sIHtcblx0ICAgIGlkOiBcIm5vZ2xvYmFsc1wiLFxuXHQgICAgbGFiZWw6IFwiQ2hlY2sgZm9yIEdsb2JhbHNcIixcblx0ICAgIHRvb2x0aXA6IFwiRW5hYmxpbmcgdGhpcyB3aWxsIHRlc3QgaWYgYW55IHRlc3QgaW50cm9kdWNlcyBuZXcgcHJvcGVydGllcyBvbiB0aGUgXCIgKyBcImdsb2JhbCBvYmplY3QgKGB3aW5kb3dgIGluIEJyb3dzZXJzKS4gU3RvcmVkIGFzIHF1ZXJ5LXN0cmluZ3MuXCJcblx0ICB9LCB7XG5cdCAgICBpZDogXCJub3RyeWNhdGNoXCIsXG5cdCAgICBsYWJlbDogXCJObyB0cnktY2F0Y2hcIixcblx0ICAgIHRvb2x0aXA6IFwiRW5hYmxpbmcgdGhpcyB3aWxsIHJ1biB0ZXN0cyBvdXRzaWRlIG9mIGEgdHJ5LWNhdGNoIGJsb2NrLiBNYWtlcyBkZWJ1Z2dpbmcgXCIgKyBcImV4Y2VwdGlvbnMgaW4gSUUgcmVhc29uYWJsZS4gU3RvcmVkIGFzIHF1ZXJ5LXN0cmluZ3MuXCJcblx0ICB9KTtcblx0ICBRVW5pdC5iZWdpbihmdW5jdGlvbiAoKSB7XG5cdCAgICB2YXIgaSxcblx0ICAgICAgICBvcHRpb24sXG5cdCAgICAgICAgdXJsQ29uZmlnID0gUVVuaXQuY29uZmlnLnVybENvbmZpZztcblxuXHQgICAgZm9yIChpID0gMDsgaSA8IHVybENvbmZpZy5sZW5ndGg7IGkrKykge1xuXHQgICAgICAvLyBPcHRpb25zIGNhbiBiZSBlaXRoZXIgc3RyaW5ncyBvciBvYmplY3RzIHdpdGggbm9uZW1wdHkgXCJpZFwiIHByb3BlcnRpZXNcblx0ICAgICAgb3B0aW9uID0gUVVuaXQuY29uZmlnLnVybENvbmZpZ1tpXTtcblxuXHQgICAgICBpZiAodHlwZW9mIG9wdGlvbiAhPT0gXCJzdHJpbmdcIikge1xuXHQgICAgICAgIG9wdGlvbiA9IG9wdGlvbi5pZDtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChRVW5pdC5jb25maWdbb3B0aW9uXSA9PT0gdW5kZWZpbmVkKSB7XG5cdCAgICAgICAgUVVuaXQuY29uZmlnW29wdGlvbl0gPSB1cmxQYXJhbXNbb3B0aW9uXTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH0pO1xuXG5cdCAgZnVuY3Rpb24gZ2V0VXJsUGFyYW1zKCkge1xuXHQgICAgdmFyIGksIHBhcmFtLCBuYW1lLCB2YWx1ZTtcblx0ICAgIHZhciB1cmxQYXJhbXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHQgICAgdmFyIHBhcmFtcyA9IGxvY2F0aW9uLnNlYXJjaC5zbGljZSgxKS5zcGxpdChcIiZcIik7XG5cdCAgICB2YXIgbGVuZ3RoID0gcGFyYW1zLmxlbmd0aDtcblxuXHQgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIGlmIChwYXJhbXNbaV0pIHtcblx0ICAgICAgICBwYXJhbSA9IHBhcmFtc1tpXS5zcGxpdChcIj1cIik7XG5cdCAgICAgICAgbmFtZSA9IGRlY29kZVF1ZXJ5UGFyYW0ocGFyYW1bMF0pOyAvLyBBbGxvdyBqdXN0IGEga2V5IHRvIHR1cm4gb24gYSBmbGFnLCBlLmcuLCB0ZXN0Lmh0bWw/bm9nbG9iYWxzXG5cblx0ICAgICAgICB2YWx1ZSA9IHBhcmFtLmxlbmd0aCA9PT0gMSB8fCBkZWNvZGVRdWVyeVBhcmFtKHBhcmFtLnNsaWNlKDEpLmpvaW4oXCI9XCIpKTtcblxuXHQgICAgICAgIGlmIChuYW1lIGluIHVybFBhcmFtcykge1xuXHQgICAgICAgICAgdXJsUGFyYW1zW25hbWVdID0gW10uY29uY2F0KHVybFBhcmFtc1tuYW1lXSwgdmFsdWUpO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICB1cmxQYXJhbXNbbmFtZV0gPSB2YWx1ZTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHVybFBhcmFtcztcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBkZWNvZGVRdWVyeVBhcmFtKHBhcmFtKSB7XG5cdCAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHBhcmFtLnJlcGxhY2UoL1xcKy9nLCBcIiUyMFwiKSk7XG5cdCAgfVxuXHR9KSgpO1xuXG5cdHZhciBmdXp6eXNvcnQgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlKSB7XG5cblx0ICAoZnVuY3Rpb24gKHJvb3QsIFVNRCkge1xuXHQgICAgaWYgKCBtb2R1bGUuZXhwb3J0cykgbW9kdWxlLmV4cG9ydHMgPSBVTUQoKTtlbHNlIHJvb3QuZnV6enlzb3J0ID0gVU1EKCk7XG5cdCAgfSkoY29tbW9uanNHbG9iYWwsIGZ1bmN0aW9uIFVNRCgpIHtcblx0ICAgIGZ1bmN0aW9uIGZ1enp5c29ydE5ldyhpbnN0YW5jZU9wdGlvbnMpIHtcblx0ICAgICAgdmFyIGZ1enp5c29ydCA9IHtcblx0ICAgICAgICBzaW5nbGU6IGZ1bmN0aW9uIChzZWFyY2gsIHRhcmdldCwgb3B0aW9ucykge1xuXHQgICAgICAgICAgaWYgKCFzZWFyY2gpIHJldHVybiBudWxsO1xuXHQgICAgICAgICAgaWYgKCFpc09iaihzZWFyY2gpKSBzZWFyY2ggPSBmdXp6eXNvcnQuZ2V0UHJlcGFyZWRTZWFyY2goc2VhcmNoKTtcblx0ICAgICAgICAgIGlmICghdGFyZ2V0KSByZXR1cm4gbnVsbDtcblx0ICAgICAgICAgIGlmICghaXNPYmoodGFyZ2V0KSkgdGFyZ2V0ID0gZnV6enlzb3J0LmdldFByZXBhcmVkKHRhcmdldCk7XG5cdCAgICAgICAgICB2YXIgYWxsb3dUeXBvID0gb3B0aW9ucyAmJiBvcHRpb25zLmFsbG93VHlwbyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5hbGxvd1R5cG8gOiBpbnN0YW5jZU9wdGlvbnMgJiYgaW5zdGFuY2VPcHRpb25zLmFsbG93VHlwbyAhPT0gdW5kZWZpbmVkID8gaW5zdGFuY2VPcHRpb25zLmFsbG93VHlwbyA6IHRydWU7XG5cdCAgICAgICAgICB2YXIgYWxnb3JpdGhtID0gYWxsb3dUeXBvID8gZnV6enlzb3J0LmFsZ29yaXRobSA6IGZ1enp5c29ydC5hbGdvcml0aG1Ob1R5cG87XG5cdCAgICAgICAgICByZXR1cm4gYWxnb3JpdGhtKHNlYXJjaCwgdGFyZ2V0LCBzZWFyY2hbMF0pOyAvLyB2YXIgdGhyZXNob2xkID0gb3B0aW9ucyAmJiBvcHRpb25zLnRocmVzaG9sZCB8fCBpbnN0YW5jZU9wdGlvbnMgJiYgaW5zdGFuY2VPcHRpb25zLnRocmVzaG9sZCB8fCAtOTAwNzE5OTI1NDc0MDk5MVxuXHQgICAgICAgICAgLy8gdmFyIHJlc3VsdCA9IGFsZ29yaXRobShzZWFyY2gsIHRhcmdldCwgc2VhcmNoWzBdKVxuXHQgICAgICAgICAgLy8gaWYocmVzdWx0ID09PSBudWxsKSByZXR1cm4gbnVsbFxuXHQgICAgICAgICAgLy8gaWYocmVzdWx0LnNjb3JlIDwgdGhyZXNob2xkKSByZXR1cm4gbnVsbFxuXHQgICAgICAgICAgLy8gcmV0dXJuIHJlc3VsdFxuXHQgICAgICAgIH0sXG5cdCAgICAgICAgZ286IGZ1bmN0aW9uIChzZWFyY2gsIHRhcmdldHMsIG9wdGlvbnMpIHtcblx0ICAgICAgICAgIGlmICghc2VhcmNoKSByZXR1cm4gbm9SZXN1bHRzO1xuXHQgICAgICAgICAgc2VhcmNoID0gZnV6enlzb3J0LnByZXBhcmVTZWFyY2goc2VhcmNoKTtcblx0ICAgICAgICAgIHZhciBzZWFyY2hMb3dlckNvZGUgPSBzZWFyY2hbMF07XG5cdCAgICAgICAgICB2YXIgdGhyZXNob2xkID0gb3B0aW9ucyAmJiBvcHRpb25zLnRocmVzaG9sZCB8fCBpbnN0YW5jZU9wdGlvbnMgJiYgaW5zdGFuY2VPcHRpb25zLnRocmVzaG9sZCB8fCAtOTAwNzE5OTI1NDc0MDk5MTtcblx0ICAgICAgICAgIHZhciBsaW1pdCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5saW1pdCB8fCBpbnN0YW5jZU9wdGlvbnMgJiYgaW5zdGFuY2VPcHRpb25zLmxpbWl0IHx8IDkwMDcxOTkyNTQ3NDA5OTE7XG5cdCAgICAgICAgICB2YXIgYWxsb3dUeXBvID0gb3B0aW9ucyAmJiBvcHRpb25zLmFsbG93VHlwbyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5hbGxvd1R5cG8gOiBpbnN0YW5jZU9wdGlvbnMgJiYgaW5zdGFuY2VPcHRpb25zLmFsbG93VHlwbyAhPT0gdW5kZWZpbmVkID8gaW5zdGFuY2VPcHRpb25zLmFsbG93VHlwbyA6IHRydWU7XG5cdCAgICAgICAgICB2YXIgYWxnb3JpdGhtID0gYWxsb3dUeXBvID8gZnV6enlzb3J0LmFsZ29yaXRobSA6IGZ1enp5c29ydC5hbGdvcml0aG1Ob1R5cG87XG5cdCAgICAgICAgICB2YXIgcmVzdWx0c0xlbiA9IDA7XG5cdCAgICAgICAgICB2YXIgbGltaXRlZENvdW50ID0gMDtcblx0ICAgICAgICAgIHZhciB0YXJnZXRzTGVuID0gdGFyZ2V0cy5sZW5ndGg7IC8vIFRoaXMgY29kZSBpcyBjb3B5L3Bhc3RlZCAzIHRpbWVzIGZvciBwZXJmb3JtYW5jZSByZWFzb25zIFtvcHRpb25zLmtleXMsIG9wdGlvbnMua2V5LCBubyBrZXlzXVxuXHQgICAgICAgICAgLy8gb3B0aW9ucy5rZXlzXG5cblx0ICAgICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMua2V5cykge1xuXHQgICAgICAgICAgICB2YXIgc2NvcmVGbiA9IG9wdGlvbnMuc2NvcmVGbiB8fCBkZWZhdWx0U2NvcmVGbjtcblx0ICAgICAgICAgICAgdmFyIGtleXMgPSBvcHRpb25zLmtleXM7XG5cdCAgICAgICAgICAgIHZhciBrZXlzTGVuID0ga2V5cy5sZW5ndGg7XG5cblx0ICAgICAgICAgICAgZm9yICh2YXIgaSA9IHRhcmdldHNMZW4gLSAxOyBpID49IDA7IC0taSkge1xuXHQgICAgICAgICAgICAgIHZhciBvYmogPSB0YXJnZXRzW2ldO1xuXHQgICAgICAgICAgICAgIHZhciBvYmpSZXN1bHRzID0gbmV3IEFycmF5KGtleXNMZW4pO1xuXG5cdCAgICAgICAgICAgICAgZm9yICh2YXIga2V5SSA9IGtleXNMZW4gLSAxOyBrZXlJID49IDA7IC0ta2V5SSkge1xuXHQgICAgICAgICAgICAgICAgdmFyIGtleSA9IGtleXNba2V5SV07XG5cdCAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZ2V0VmFsdWUob2JqLCBrZXkpO1xuXG5cdCAgICAgICAgICAgICAgICBpZiAoIXRhcmdldCkge1xuXHQgICAgICAgICAgICAgICAgICBvYmpSZXN1bHRzW2tleUldID0gbnVsbDtcblx0ICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cdCAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgIGlmICghaXNPYmoodGFyZ2V0KSkgdGFyZ2V0ID0gZnV6enlzb3J0LmdldFByZXBhcmVkKHRhcmdldCk7XG5cdCAgICAgICAgICAgICAgICBvYmpSZXN1bHRzW2tleUldID0gYWxnb3JpdGhtKHNlYXJjaCwgdGFyZ2V0LCBzZWFyY2hMb3dlckNvZGUpO1xuXHQgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgIG9ialJlc3VsdHMub2JqID0gb2JqOyAvLyBiZWZvcmUgc2NvcmVGbiBzbyBzY29yZUZuIGNhbiB1c2UgaXRcblxuXHQgICAgICAgICAgICAgIHZhciBzY29yZSA9IHNjb3JlRm4ob2JqUmVzdWx0cyk7XG5cdCAgICAgICAgICAgICAgaWYgKHNjb3JlID09PSBudWxsKSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICBpZiAoc2NvcmUgPCB0aHJlc2hvbGQpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgIG9ialJlc3VsdHMuc2NvcmUgPSBzY29yZTtcblxuXHQgICAgICAgICAgICAgIGlmIChyZXN1bHRzTGVuIDwgbGltaXQpIHtcblx0ICAgICAgICAgICAgICAgIHEuYWRkKG9ialJlc3VsdHMpO1xuXHQgICAgICAgICAgICAgICAgKytyZXN1bHRzTGVuO1xuXHQgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICArK2xpbWl0ZWRDb3VudDtcblx0ICAgICAgICAgICAgICAgIGlmIChzY29yZSA+IHEucGVlaygpLnNjb3JlKSBxLnJlcGxhY2VUb3Aob2JqUmVzdWx0cyk7XG5cdCAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9IC8vIG9wdGlvbnMua2V5XG5cblx0ICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmtleSkge1xuXHQgICAgICAgICAgICB2YXIga2V5ID0gb3B0aW9ucy5rZXk7XG5cblx0ICAgICAgICAgICAgZm9yICh2YXIgaSA9IHRhcmdldHNMZW4gLSAxOyBpID49IDA7IC0taSkge1xuXHQgICAgICAgICAgICAgIHZhciBvYmogPSB0YXJnZXRzW2ldO1xuXHQgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBnZXRWYWx1ZShvYmosIGtleSk7XG5cdCAgICAgICAgICAgICAgaWYgKCF0YXJnZXQpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgIGlmICghaXNPYmoodGFyZ2V0KSkgdGFyZ2V0ID0gZnV6enlzb3J0LmdldFByZXBhcmVkKHRhcmdldCk7XG5cdCAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IGFsZ29yaXRobShzZWFyY2gsIHRhcmdldCwgc2VhcmNoTG93ZXJDb2RlKTtcblx0ICAgICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICBpZiAocmVzdWx0LnNjb3JlIDwgdGhyZXNob2xkKSBjb250aW51ZTsgLy8gaGF2ZSB0byBjbG9uZSByZXN1bHQgc28gZHVwbGljYXRlIHRhcmdldHMgZnJvbSBkaWZmZXJlbnQgb2JqIGNhbiBlYWNoIHJlZmVyZW5jZSB0aGUgY29ycmVjdCBvYmpcblxuXHQgICAgICAgICAgICAgIHJlc3VsdCA9IHtcblx0ICAgICAgICAgICAgICAgIHRhcmdldDogcmVzdWx0LnRhcmdldCxcblx0ICAgICAgICAgICAgICAgIF90YXJnZXRMb3dlckNvZGVzOiBudWxsLFxuXHQgICAgICAgICAgICAgICAgX25leHRCZWdpbm5pbmdJbmRleGVzOiBudWxsLFxuXHQgICAgICAgICAgICAgICAgc2NvcmU6IHJlc3VsdC5zY29yZSxcblx0ICAgICAgICAgICAgICAgIGluZGV4ZXM6IHJlc3VsdC5pbmRleGVzLFxuXHQgICAgICAgICAgICAgICAgb2JqOiBvYmpcblx0ICAgICAgICAgICAgICB9OyAvLyBoaWRkZW5cblxuXHQgICAgICAgICAgICAgIGlmIChyZXN1bHRzTGVuIDwgbGltaXQpIHtcblx0ICAgICAgICAgICAgICAgIHEuYWRkKHJlc3VsdCk7XG5cdCAgICAgICAgICAgICAgICArK3Jlc3VsdHNMZW47XG5cdCAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgICsrbGltaXRlZENvdW50O1xuXHQgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zY29yZSA+IHEucGVlaygpLnNjb3JlKSBxLnJlcGxhY2VUb3AocmVzdWx0KTtcblx0ICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH0gLy8gbm8ga2V5c1xuXG5cdCAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICBmb3IgKHZhciBpID0gdGFyZ2V0c0xlbiAtIDE7IGkgPj0gMDsgLS1pKSB7XG5cdCAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IHRhcmdldHNbaV07XG5cdCAgICAgICAgICAgICAgaWYgKCF0YXJnZXQpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgIGlmICghaXNPYmoodGFyZ2V0KSkgdGFyZ2V0ID0gZnV6enlzb3J0LmdldFByZXBhcmVkKHRhcmdldCk7XG5cdCAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IGFsZ29yaXRobShzZWFyY2gsIHRhcmdldCwgc2VhcmNoTG93ZXJDb2RlKTtcblx0ICAgICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICBpZiAocmVzdWx0LnNjb3JlIDwgdGhyZXNob2xkKSBjb250aW51ZTtcblxuXHQgICAgICAgICAgICAgIGlmIChyZXN1bHRzTGVuIDwgbGltaXQpIHtcblx0ICAgICAgICAgICAgICAgIHEuYWRkKHJlc3VsdCk7XG5cdCAgICAgICAgICAgICAgICArK3Jlc3VsdHNMZW47XG5cdCAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgICsrbGltaXRlZENvdW50O1xuXHQgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zY29yZSA+IHEucGVlaygpLnNjb3JlKSBxLnJlcGxhY2VUb3AocmVzdWx0KTtcblx0ICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgaWYgKHJlc3VsdHNMZW4gPT09IDApIHJldHVybiBub1Jlc3VsdHM7XG5cdCAgICAgICAgICB2YXIgcmVzdWx0cyA9IG5ldyBBcnJheShyZXN1bHRzTGVuKTtcblxuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IHJlc3VsdHNMZW4gLSAxOyBpID49IDA7IC0taSkgcmVzdWx0c1tpXSA9IHEucG9sbCgpO1xuXG5cdCAgICAgICAgICByZXN1bHRzLnRvdGFsID0gcmVzdWx0c0xlbiArIGxpbWl0ZWRDb3VudDtcblx0ICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuXHQgICAgICAgIH0sXG5cdCAgICAgICAgZ29Bc3luYzogZnVuY3Rpb24gKHNlYXJjaCwgdGFyZ2V0cywgb3B0aW9ucykge1xuXHQgICAgICAgICAgdmFyIGNhbmNlbGVkID0gZmFsc2U7XG5cdCAgICAgICAgICB2YXIgcCA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0ICAgICAgICAgICAgaWYgKCFzZWFyY2gpIHJldHVybiByZXNvbHZlKG5vUmVzdWx0cyk7XG5cdCAgICAgICAgICAgIHNlYXJjaCA9IGZ1enp5c29ydC5wcmVwYXJlU2VhcmNoKHNlYXJjaCk7XG5cdCAgICAgICAgICAgIHZhciBzZWFyY2hMb3dlckNvZGUgPSBzZWFyY2hbMF07XG5cdCAgICAgICAgICAgIHZhciBxID0gZmFzdHByaW9yaXR5cXVldWUoKTtcblx0ICAgICAgICAgICAgdmFyIGlDdXJyZW50ID0gdGFyZ2V0cy5sZW5ndGggLSAxO1xuXHQgICAgICAgICAgICB2YXIgdGhyZXNob2xkID0gb3B0aW9ucyAmJiBvcHRpb25zLnRocmVzaG9sZCB8fCBpbnN0YW5jZU9wdGlvbnMgJiYgaW5zdGFuY2VPcHRpb25zLnRocmVzaG9sZCB8fCAtOTAwNzE5OTI1NDc0MDk5MTtcblx0ICAgICAgICAgICAgdmFyIGxpbWl0ID0gb3B0aW9ucyAmJiBvcHRpb25zLmxpbWl0IHx8IGluc3RhbmNlT3B0aW9ucyAmJiBpbnN0YW5jZU9wdGlvbnMubGltaXQgfHwgOTAwNzE5OTI1NDc0MDk5MTtcblx0ICAgICAgICAgICAgdmFyIGFsbG93VHlwbyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5hbGxvd1R5cG8gIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuYWxsb3dUeXBvIDogaW5zdGFuY2VPcHRpb25zICYmIGluc3RhbmNlT3B0aW9ucy5hbGxvd1R5cG8gIT09IHVuZGVmaW5lZCA/IGluc3RhbmNlT3B0aW9ucy5hbGxvd1R5cG8gOiB0cnVlO1xuXHQgICAgICAgICAgICB2YXIgYWxnb3JpdGhtID0gYWxsb3dUeXBvID8gZnV6enlzb3J0LmFsZ29yaXRobSA6IGZ1enp5c29ydC5hbGdvcml0aG1Ob1R5cG87XG5cdCAgICAgICAgICAgIHZhciByZXN1bHRzTGVuID0gMDtcblx0ICAgICAgICAgICAgdmFyIGxpbWl0ZWRDb3VudCA9IDA7XG5cblx0ICAgICAgICAgICAgZnVuY3Rpb24gc3RlcCgpIHtcblx0ICAgICAgICAgICAgICBpZiAoY2FuY2VsZWQpIHJldHVybiByZWplY3QoJ2NhbmNlbGVkJyk7XG5cdCAgICAgICAgICAgICAgdmFyIHN0YXJ0TXMgPSBEYXRlLm5vdygpOyAvLyBUaGlzIGNvZGUgaXMgY29weS9wYXN0ZWQgMyB0aW1lcyBmb3IgcGVyZm9ybWFuY2UgcmVhc29ucyBbb3B0aW9ucy5rZXlzLCBvcHRpb25zLmtleSwgbm8ga2V5c11cblx0ICAgICAgICAgICAgICAvLyBvcHRpb25zLmtleXNcblxuXHQgICAgICAgICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMua2V5cykge1xuXHQgICAgICAgICAgICAgICAgdmFyIHNjb3JlRm4gPSBvcHRpb25zLnNjb3JlRm4gfHwgZGVmYXVsdFNjb3JlRm47XG5cdCAgICAgICAgICAgICAgICB2YXIga2V5cyA9IG9wdGlvbnMua2V5cztcblx0ICAgICAgICAgICAgICAgIHZhciBrZXlzTGVuID0ga2V5cy5sZW5ndGg7XG5cblx0ICAgICAgICAgICAgICAgIGZvciAoOyBpQ3VycmVudCA+PSAwOyAtLWlDdXJyZW50KSB7XG5cdCAgICAgICAgICAgICAgICAgIHZhciBvYmogPSB0YXJnZXRzW2lDdXJyZW50XTtcblx0ICAgICAgICAgICAgICAgICAgdmFyIG9ialJlc3VsdHMgPSBuZXcgQXJyYXkoa2V5c0xlbik7XG5cblx0ICAgICAgICAgICAgICAgICAgZm9yICh2YXIga2V5SSA9IGtleXNMZW4gLSAxOyBrZXlJID49IDA7IC0ta2V5SSkge1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBrZXlzW2tleUldO1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBnZXRWYWx1ZShvYmosIGtleSk7XG5cblx0ICAgICAgICAgICAgICAgICAgICBpZiAoIXRhcmdldCkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgb2JqUmVzdWx0c1trZXlJXSA9IG51bGw7XG5cdCAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgICAgICBpZiAoIWlzT2JqKHRhcmdldCkpIHRhcmdldCA9IGZ1enp5c29ydC5nZXRQcmVwYXJlZCh0YXJnZXQpO1xuXHQgICAgICAgICAgICAgICAgICAgIG9ialJlc3VsdHNba2V5SV0gPSBhbGdvcml0aG0oc2VhcmNoLCB0YXJnZXQsIHNlYXJjaExvd2VyQ29kZSk7XG5cdCAgICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgICBvYmpSZXN1bHRzLm9iaiA9IG9iajsgLy8gYmVmb3JlIHNjb3JlRm4gc28gc2NvcmVGbiBjYW4gdXNlIGl0XG5cblx0ICAgICAgICAgICAgICAgICAgdmFyIHNjb3JlID0gc2NvcmVGbihvYmpSZXN1bHRzKTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKHNjb3JlID09PSBudWxsKSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKHNjb3JlIDwgdGhyZXNob2xkKSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICAgICAgb2JqUmVzdWx0cy5zY29yZSA9IHNjb3JlO1xuXG5cdCAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHRzTGVuIDwgbGltaXQpIHtcblx0ICAgICAgICAgICAgICAgICAgICBxLmFkZChvYmpSZXN1bHRzKTtcblx0ICAgICAgICAgICAgICAgICAgICArK3Jlc3VsdHNMZW47XG5cdCAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICAgICAgKytsaW1pdGVkQ291bnQ7XG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKHNjb3JlID4gcS5wZWVrKCkuc2NvcmUpIHEucmVwbGFjZVRvcChvYmpSZXN1bHRzKTtcblx0ICAgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICAgIGlmIChpQ3VycmVudCAlIDEwMDBcblx0ICAgICAgICAgICAgICAgICAgLyppdGVtc1BlckNoZWNrKi9cblx0ICAgICAgICAgICAgICAgICAgPT09IDApIHtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAoRGF0ZS5ub3coKSAtIHN0YXJ0TXMgPj0gMTBcblx0ICAgICAgICAgICAgICAgICAgICAvKmFzeW5jSW50ZXJ2YWwqL1xuXHQgICAgICAgICAgICAgICAgICAgICkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBpc05vZGUgPyBzZXRJbW1lZGlhdGUoc3RlcCkgOiBzZXRUaW1lb3V0KHN0ZXApO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgIH0gLy8gb3B0aW9ucy5rZXlcblxuXHQgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmtleSkge1xuXHQgICAgICAgICAgICAgICAgdmFyIGtleSA9IG9wdGlvbnMua2V5O1xuXG5cdCAgICAgICAgICAgICAgICBmb3IgKDsgaUN1cnJlbnQgPj0gMDsgLS1pQ3VycmVudCkge1xuXHQgICAgICAgICAgICAgICAgICB2YXIgb2JqID0gdGFyZ2V0c1tpQ3VycmVudF07XG5cdCAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBnZXRWYWx1ZShvYmosIGtleSk7XG5cdCAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0KSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKCFpc09iaih0YXJnZXQpKSB0YXJnZXQgPSBmdXp6eXNvcnQuZ2V0UHJlcGFyZWQodGFyZ2V0KTtcblx0ICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IGFsZ29yaXRobShzZWFyY2gsIHRhcmdldCwgc2VhcmNoTG93ZXJDb2RlKTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc2NvcmUgPCB0aHJlc2hvbGQpIGNvbnRpbnVlOyAvLyBoYXZlIHRvIGNsb25lIHJlc3VsdCBzbyBkdXBsaWNhdGUgdGFyZ2V0cyBmcm9tIGRpZmZlcmVudCBvYmogY2FuIGVhY2ggcmVmZXJlbmNlIHRoZSBjb3JyZWN0IG9ialxuXG5cdCAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHtcblx0ICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHJlc3VsdC50YXJnZXQsXG5cdCAgICAgICAgICAgICAgICAgICAgX3RhcmdldExvd2VyQ29kZXM6IG51bGwsXG5cdCAgICAgICAgICAgICAgICAgICAgX25leHRCZWdpbm5pbmdJbmRleGVzOiBudWxsLFxuXHQgICAgICAgICAgICAgICAgICAgIHNjb3JlOiByZXN1bHQuc2NvcmUsXG5cdCAgICAgICAgICAgICAgICAgICAgaW5kZXhlczogcmVzdWx0LmluZGV4ZXMsXG5cdCAgICAgICAgICAgICAgICAgICAgb2JqOiBvYmpcblx0ICAgICAgICAgICAgICAgICAgfTsgLy8gaGlkZGVuXG5cblx0ICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdHNMZW4gPCBsaW1pdCkge1xuXHQgICAgICAgICAgICAgICAgICAgIHEuYWRkKHJlc3VsdCk7XG5cdCAgICAgICAgICAgICAgICAgICAgKytyZXN1bHRzTGVuO1xuXHQgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgICAgICsrbGltaXRlZENvdW50O1xuXHQgICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc2NvcmUgPiBxLnBlZWsoKS5zY29yZSkgcS5yZXBsYWNlVG9wKHJlc3VsdCk7XG5cdCAgICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgICBpZiAoaUN1cnJlbnQgJSAxMDAwXG5cdCAgICAgICAgICAgICAgICAgIC8qaXRlbXNQZXJDaGVjayovXG5cdCAgICAgICAgICAgICAgICAgID09PSAwKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKERhdGUubm93KCkgLSBzdGFydE1zID49IDEwXG5cdCAgICAgICAgICAgICAgICAgICAgLyphc3luY0ludGVydmFsKi9cblx0ICAgICAgICAgICAgICAgICAgICApIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgaXNOb2RlID8gc2V0SW1tZWRpYXRlKHN0ZXApIDogc2V0VGltZW91dChzdGVwKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICB9IC8vIG5vIGtleXNcblxuXHQgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICBmb3IgKDsgaUN1cnJlbnQgPj0gMDsgLS1pQ3VycmVudCkge1xuXHQgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gdGFyZ2V0c1tpQ3VycmVudF07XG5cdCAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0KSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKCFpc09iaih0YXJnZXQpKSB0YXJnZXQgPSBmdXp6eXNvcnQuZ2V0UHJlcGFyZWQodGFyZ2V0KTtcblx0ICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IGFsZ29yaXRobShzZWFyY2gsIHRhcmdldCwgc2VhcmNoTG93ZXJDb2RlKTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc2NvcmUgPCB0aHJlc2hvbGQpIGNvbnRpbnVlO1xuXG5cdCAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHRzTGVuIDwgbGltaXQpIHtcblx0ICAgICAgICAgICAgICAgICAgICBxLmFkZChyZXN1bHQpO1xuXHQgICAgICAgICAgICAgICAgICAgICsrcmVzdWx0c0xlbjtcblx0ICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgICAgICArK2xpbWl0ZWRDb3VudDtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnNjb3JlID4gcS5wZWVrKCkuc2NvcmUpIHEucmVwbGFjZVRvcChyZXN1bHQpO1xuXHQgICAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgICAgaWYgKGlDdXJyZW50ICUgMTAwMFxuXHQgICAgICAgICAgICAgICAgICAvKml0ZW1zUGVyQ2hlY2sqL1xuXHQgICAgICAgICAgICAgICAgICA9PT0gMCkge1xuXHQgICAgICAgICAgICAgICAgICAgIGlmIChEYXRlLm5vdygpIC0gc3RhcnRNcyA+PSAxMFxuXHQgICAgICAgICAgICAgICAgICAgIC8qYXN5bmNJbnRlcnZhbCovXG5cdCAgICAgICAgICAgICAgICAgICAgKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGlzTm9kZSA/IHNldEltbWVkaWF0ZShzdGVwKSA6IHNldFRpbWVvdXQoc3RlcCk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgIGlmIChyZXN1bHRzTGVuID09PSAwKSByZXR1cm4gcmVzb2x2ZShub1Jlc3VsdHMpO1xuXHQgICAgICAgICAgICAgIHZhciByZXN1bHRzID0gbmV3IEFycmF5KHJlc3VsdHNMZW4pO1xuXG5cdCAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IHJlc3VsdHNMZW4gLSAxOyBpID49IDA7IC0taSkgcmVzdWx0c1tpXSA9IHEucG9sbCgpO1xuXG5cdCAgICAgICAgICAgICAgcmVzdWx0cy50b3RhbCA9IHJlc3VsdHNMZW4gKyBsaW1pdGVkQ291bnQ7XG5cdCAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHRzKTtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIGlzTm9kZSA/IHNldEltbWVkaWF0ZShzdGVwKSA6IHN0ZXAoKTtcblx0ICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICBwLmNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgY2FuY2VsZWQgPSB0cnVlO1xuXHQgICAgICAgICAgfTtcblxuXHQgICAgICAgICAgcmV0dXJuIHA7XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBoaWdobGlnaHQ6IGZ1bmN0aW9uIChyZXN1bHQsIGhPcGVuLCBoQ2xvc2UpIHtcblx0ICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwpIHJldHVybiBudWxsO1xuXHQgICAgICAgICAgaWYgKGhPcGVuID09PSB1bmRlZmluZWQpIGhPcGVuID0gJzxiPic7XG5cdCAgICAgICAgICBpZiAoaENsb3NlID09PSB1bmRlZmluZWQpIGhDbG9zZSA9ICc8L2I+Jztcblx0ICAgICAgICAgIHZhciBoaWdobGlnaHRlZCA9ICcnO1xuXHQgICAgICAgICAgdmFyIG1hdGNoZXNJbmRleCA9IDA7XG5cdCAgICAgICAgICB2YXIgb3BlbmVkID0gZmFsc2U7XG5cdCAgICAgICAgICB2YXIgdGFyZ2V0ID0gcmVzdWx0LnRhcmdldDtcblx0ICAgICAgICAgIHZhciB0YXJnZXRMZW4gPSB0YXJnZXQubGVuZ3RoO1xuXHQgICAgICAgICAgdmFyIG1hdGNoZXNCZXN0ID0gcmVzdWx0LmluZGV4ZXM7XG5cblx0ICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGFyZ2V0TGVuOyArK2kpIHtcblx0ICAgICAgICAgICAgdmFyIGNoYXIgPSB0YXJnZXRbaV07XG5cblx0ICAgICAgICAgICAgaWYgKG1hdGNoZXNCZXN0W21hdGNoZXNJbmRleF0gPT09IGkpIHtcblx0ICAgICAgICAgICAgICArK21hdGNoZXNJbmRleDtcblxuXHQgICAgICAgICAgICAgIGlmICghb3BlbmVkKSB7XG5cdCAgICAgICAgICAgICAgICBvcGVuZWQgPSB0cnVlO1xuXHQgICAgICAgICAgICAgICAgaGlnaGxpZ2h0ZWQgKz0gaE9wZW47XG5cdCAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgaWYgKG1hdGNoZXNJbmRleCA9PT0gbWF0Y2hlc0Jlc3QubGVuZ3RoKSB7XG5cdCAgICAgICAgICAgICAgICBoaWdobGlnaHRlZCArPSBjaGFyICsgaENsb3NlICsgdGFyZ2V0LnN1YnN0cihpICsgMSk7XG5cdCAgICAgICAgICAgICAgICBicmVhaztcblx0ICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgaWYgKG9wZW5lZCkge1xuXHQgICAgICAgICAgICAgICAgb3BlbmVkID0gZmFsc2U7XG5cdCAgICAgICAgICAgICAgICBoaWdobGlnaHRlZCArPSBoQ2xvc2U7XG5cdCAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgaGlnaGxpZ2h0ZWQgKz0gY2hhcjtcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgcmV0dXJuIGhpZ2hsaWdodGVkO1xuXHQgICAgICAgIH0sXG5cdCAgICAgICAgcHJlcGFyZTogZnVuY3Rpb24gKHRhcmdldCkge1xuXHQgICAgICAgICAgaWYgKCF0YXJnZXQpIHJldHVybjtcblx0ICAgICAgICAgIHJldHVybiB7XG5cdCAgICAgICAgICAgIHRhcmdldDogdGFyZ2V0LFxuXHQgICAgICAgICAgICBfdGFyZ2V0TG93ZXJDb2RlczogZnV6enlzb3J0LnByZXBhcmVMb3dlckNvZGVzKHRhcmdldCksXG5cdCAgICAgICAgICAgIF9uZXh0QmVnaW5uaW5nSW5kZXhlczogbnVsbCxcblx0ICAgICAgICAgICAgc2NvcmU6IG51bGwsXG5cdCAgICAgICAgICAgIGluZGV4ZXM6IG51bGwsXG5cdCAgICAgICAgICAgIG9iajogbnVsbFxuXHQgICAgICAgICAgfTsgLy8gaGlkZGVuXG5cdCAgICAgICAgfSxcblx0ICAgICAgICBwcmVwYXJlU2xvdzogZnVuY3Rpb24gKHRhcmdldCkge1xuXHQgICAgICAgICAgaWYgKCF0YXJnZXQpIHJldHVybjtcblx0ICAgICAgICAgIHJldHVybiB7XG5cdCAgICAgICAgICAgIHRhcmdldDogdGFyZ2V0LFxuXHQgICAgICAgICAgICBfdGFyZ2V0TG93ZXJDb2RlczogZnV6enlzb3J0LnByZXBhcmVMb3dlckNvZGVzKHRhcmdldCksXG5cdCAgICAgICAgICAgIF9uZXh0QmVnaW5uaW5nSW5kZXhlczogZnV6enlzb3J0LnByZXBhcmVOZXh0QmVnaW5uaW5nSW5kZXhlcyh0YXJnZXQpLFxuXHQgICAgICAgICAgICBzY29yZTogbnVsbCxcblx0ICAgICAgICAgICAgaW5kZXhlczogbnVsbCxcblx0ICAgICAgICAgICAgb2JqOiBudWxsXG5cdCAgICAgICAgICB9OyAvLyBoaWRkZW5cblx0ICAgICAgICB9LFxuXHQgICAgICAgIHByZXBhcmVTZWFyY2g6IGZ1bmN0aW9uIChzZWFyY2gpIHtcblx0ICAgICAgICAgIGlmICghc2VhcmNoKSByZXR1cm47XG5cdCAgICAgICAgICByZXR1cm4gZnV6enlzb3J0LnByZXBhcmVMb3dlckNvZGVzKHNlYXJjaCk7XG5cdCAgICAgICAgfSxcblx0ICAgICAgICAvLyBCZWxvdyB0aGlzIHBvaW50IGlzIG9ubHkgaW50ZXJuYWwgY29kZVxuXHQgICAgICAgIC8vIEJlbG93IHRoaXMgcG9pbnQgaXMgb25seSBpbnRlcm5hbCBjb2RlXG5cdCAgICAgICAgLy8gQmVsb3cgdGhpcyBwb2ludCBpcyBvbmx5IGludGVybmFsIGNvZGVcblx0ICAgICAgICAvLyBCZWxvdyB0aGlzIHBvaW50IGlzIG9ubHkgaW50ZXJuYWwgY29kZVxuXHQgICAgICAgIGdldFByZXBhcmVkOiBmdW5jdGlvbiAodGFyZ2V0KSB7XG5cdCAgICAgICAgICBpZiAodGFyZ2V0Lmxlbmd0aCA+IDk5OSkgcmV0dXJuIGZ1enp5c29ydC5wcmVwYXJlKHRhcmdldCk7IC8vIGRvbid0IGNhY2hlIGh1Z2UgdGFyZ2V0c1xuXG5cdCAgICAgICAgICB2YXIgdGFyZ2V0UHJlcGFyZWQgPSBwcmVwYXJlZENhY2hlLmdldCh0YXJnZXQpO1xuXHQgICAgICAgICAgaWYgKHRhcmdldFByZXBhcmVkICE9PSB1bmRlZmluZWQpIHJldHVybiB0YXJnZXRQcmVwYXJlZDtcblx0ICAgICAgICAgIHRhcmdldFByZXBhcmVkID0gZnV6enlzb3J0LnByZXBhcmUodGFyZ2V0KTtcblx0ICAgICAgICAgIHByZXBhcmVkQ2FjaGUuc2V0KHRhcmdldCwgdGFyZ2V0UHJlcGFyZWQpO1xuXHQgICAgICAgICAgcmV0dXJuIHRhcmdldFByZXBhcmVkO1xuXHQgICAgICAgIH0sXG5cdCAgICAgICAgZ2V0UHJlcGFyZWRTZWFyY2g6IGZ1bmN0aW9uIChzZWFyY2gpIHtcblx0ICAgICAgICAgIGlmIChzZWFyY2gubGVuZ3RoID4gOTk5KSByZXR1cm4gZnV6enlzb3J0LnByZXBhcmVTZWFyY2goc2VhcmNoKTsgLy8gZG9uJ3QgY2FjaGUgaHVnZSBzZWFyY2hlc1xuXG5cdCAgICAgICAgICB2YXIgc2VhcmNoUHJlcGFyZWQgPSBwcmVwYXJlZFNlYXJjaENhY2hlLmdldChzZWFyY2gpO1xuXHQgICAgICAgICAgaWYgKHNlYXJjaFByZXBhcmVkICE9PSB1bmRlZmluZWQpIHJldHVybiBzZWFyY2hQcmVwYXJlZDtcblx0ICAgICAgICAgIHNlYXJjaFByZXBhcmVkID0gZnV6enlzb3J0LnByZXBhcmVTZWFyY2goc2VhcmNoKTtcblx0ICAgICAgICAgIHByZXBhcmVkU2VhcmNoQ2FjaGUuc2V0KHNlYXJjaCwgc2VhcmNoUHJlcGFyZWQpO1xuXHQgICAgICAgICAgcmV0dXJuIHNlYXJjaFByZXBhcmVkO1xuXHQgICAgICAgIH0sXG5cdCAgICAgICAgYWxnb3JpdGhtOiBmdW5jdGlvbiAoc2VhcmNoTG93ZXJDb2RlcywgcHJlcGFyZWQsIHNlYXJjaExvd2VyQ29kZSkge1xuXHQgICAgICAgICAgdmFyIHRhcmdldExvd2VyQ29kZXMgPSBwcmVwYXJlZC5fdGFyZ2V0TG93ZXJDb2Rlcztcblx0ICAgICAgICAgIHZhciBzZWFyY2hMZW4gPSBzZWFyY2hMb3dlckNvZGVzLmxlbmd0aDtcblx0ICAgICAgICAgIHZhciB0YXJnZXRMZW4gPSB0YXJnZXRMb3dlckNvZGVzLmxlbmd0aDtcblx0ICAgICAgICAgIHZhciBzZWFyY2hJID0gMDsgLy8gd2hlcmUgd2UgYXRcblxuXHQgICAgICAgICAgdmFyIHRhcmdldEkgPSAwOyAvLyB3aGVyZSB5b3UgYXRcblxuXHQgICAgICAgICAgdmFyIHR5cG9TaW1wbGVJID0gMDtcblx0ICAgICAgICAgIHZhciBtYXRjaGVzU2ltcGxlTGVuID0gMDsgLy8gdmVyeSBiYXNpYyBmdXp6eSBtYXRjaDsgdG8gcmVtb3ZlIG5vbi1tYXRjaGluZyB0YXJnZXRzIEFTQVAhXG5cdCAgICAgICAgICAvLyB3YWxrIHRocm91Z2ggdGFyZ2V0LiBmaW5kIHNlcXVlbnRpYWwgbWF0Y2hlcy5cblx0ICAgICAgICAgIC8vIGlmIGFsbCBjaGFycyBhcmVuJ3QgZm91bmQgdGhlbiBleGl0XG5cblx0ICAgICAgICAgIGZvciAoOzspIHtcblx0ICAgICAgICAgICAgdmFyIGlzTWF0Y2ggPSBzZWFyY2hMb3dlckNvZGUgPT09IHRhcmdldExvd2VyQ29kZXNbdGFyZ2V0SV07XG5cblx0ICAgICAgICAgICAgaWYgKGlzTWF0Y2gpIHtcblx0ICAgICAgICAgICAgICBtYXRjaGVzU2ltcGxlW21hdGNoZXNTaW1wbGVMZW4rK10gPSB0YXJnZXRJO1xuXHQgICAgICAgICAgICAgICsrc2VhcmNoSTtcblx0ICAgICAgICAgICAgICBpZiAoc2VhcmNoSSA9PT0gc2VhcmNoTGVuKSBicmVhaztcblx0ICAgICAgICAgICAgICBzZWFyY2hMb3dlckNvZGUgPSBzZWFyY2hMb3dlckNvZGVzW3R5cG9TaW1wbGVJID09PSAwID8gc2VhcmNoSSA6IHR5cG9TaW1wbGVJID09PSBzZWFyY2hJID8gc2VhcmNoSSArIDEgOiB0eXBvU2ltcGxlSSA9PT0gc2VhcmNoSSAtIDEgPyBzZWFyY2hJIC0gMSA6IHNlYXJjaEldO1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgKyt0YXJnZXRJO1xuXG5cdCAgICAgICAgICAgIGlmICh0YXJnZXRJID49IHRhcmdldExlbikge1xuXHQgICAgICAgICAgICAgIC8vIEZhaWxlZCB0byBmaW5kIHNlYXJjaElcblx0ICAgICAgICAgICAgICAvLyBDaGVjayBmb3IgdHlwbyBvciBleGl0XG5cdCAgICAgICAgICAgICAgLy8gd2UgZ28gYXMgZmFyIGFzIHBvc3NpYmxlIGJlZm9yZSB0cnlpbmcgdG8gdHJhbnNwb3NlXG5cdCAgICAgICAgICAgICAgLy8gdGhlbiB3ZSB0cmFuc3Bvc2UgYmFja3dhcmRzIHVudGlsIHdlIHJlYWNoIHRoZSBiZWdpbm5pbmdcblx0ICAgICAgICAgICAgICBmb3IgKDs7KSB7XG5cdCAgICAgICAgICAgICAgICBpZiAoc2VhcmNoSSA8PSAxKSByZXR1cm4gbnVsbDsgLy8gbm90IGFsbG93ZWQgdG8gdHJhbnNwb3NlIGZpcnN0IGNoYXJcblxuXHQgICAgICAgICAgICAgICAgaWYgKHR5cG9TaW1wbGVJID09PSAwKSB7XG5cdCAgICAgICAgICAgICAgICAgIC8vIHdlIGhhdmVuJ3QgdHJpZWQgdG8gdHJhbnNwb3NlIHlldFxuXHQgICAgICAgICAgICAgICAgICAtLXNlYXJjaEk7XG5cdCAgICAgICAgICAgICAgICAgIHZhciBzZWFyY2hMb3dlckNvZGVOZXcgPSBzZWFyY2hMb3dlckNvZGVzW3NlYXJjaEldO1xuXHQgICAgICAgICAgICAgICAgICBpZiAoc2VhcmNoTG93ZXJDb2RlID09PSBzZWFyY2hMb3dlckNvZGVOZXcpIGNvbnRpbnVlOyAvLyBkb2Vzbid0IG1ha2Ugc2Vuc2UgdG8gdHJhbnNwb3NlIGEgcmVwZWF0IGNoYXJcblxuXHQgICAgICAgICAgICAgICAgICB0eXBvU2ltcGxlSSA9IHNlYXJjaEk7XG5cdCAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgICBpZiAodHlwb1NpbXBsZUkgPT09IDEpIHJldHVybiBudWxsOyAvLyByZWFjaGVkIHRoZSBlbmQgb2YgdGhlIGxpbmUgZm9yIHRyYW5zcG9zaW5nXG5cblx0ICAgICAgICAgICAgICAgICAgLS10eXBvU2ltcGxlSTtcblx0ICAgICAgICAgICAgICAgICAgc2VhcmNoSSA9IHR5cG9TaW1wbGVJO1xuXHQgICAgICAgICAgICAgICAgICBzZWFyY2hMb3dlckNvZGUgPSBzZWFyY2hMb3dlckNvZGVzW3NlYXJjaEkgKyAxXTtcblx0ICAgICAgICAgICAgICAgICAgdmFyIHNlYXJjaExvd2VyQ29kZU5ldyA9IHNlYXJjaExvd2VyQ29kZXNbc2VhcmNoSV07XG5cdCAgICAgICAgICAgICAgICAgIGlmIChzZWFyY2hMb3dlckNvZGUgPT09IHNlYXJjaExvd2VyQ29kZU5ldykgY29udGludWU7IC8vIGRvZXNuJ3QgbWFrZSBzZW5zZSB0byB0cmFuc3Bvc2UgYSByZXBlYXQgY2hhclxuXHQgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICBtYXRjaGVzU2ltcGxlTGVuID0gc2VhcmNoSTtcblx0ICAgICAgICAgICAgICAgIHRhcmdldEkgPSBtYXRjaGVzU2ltcGxlW21hdGNoZXNTaW1wbGVMZW4gLSAxXSArIDE7XG5cdCAgICAgICAgICAgICAgICBicmVhaztcblx0ICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgdmFyIHNlYXJjaEkgPSAwO1xuXHQgICAgICAgICAgdmFyIHR5cG9TdHJpY3RJID0gMDtcblx0ICAgICAgICAgIHZhciBzdWNjZXNzU3RyaWN0ID0gZmFsc2U7XG5cdCAgICAgICAgICB2YXIgbWF0Y2hlc1N0cmljdExlbiA9IDA7XG5cdCAgICAgICAgICB2YXIgbmV4dEJlZ2lubmluZ0luZGV4ZXMgPSBwcmVwYXJlZC5fbmV4dEJlZ2lubmluZ0luZGV4ZXM7XG5cdCAgICAgICAgICBpZiAobmV4dEJlZ2lubmluZ0luZGV4ZXMgPT09IG51bGwpIG5leHRCZWdpbm5pbmdJbmRleGVzID0gcHJlcGFyZWQuX25leHRCZWdpbm5pbmdJbmRleGVzID0gZnV6enlzb3J0LnByZXBhcmVOZXh0QmVnaW5uaW5nSW5kZXhlcyhwcmVwYXJlZC50YXJnZXQpO1xuXHQgICAgICAgICAgdmFyIGZpcnN0UG9zc2libGVJID0gdGFyZ2V0SSA9IG1hdGNoZXNTaW1wbGVbMF0gPT09IDAgPyAwIDogbmV4dEJlZ2lubmluZ0luZGV4ZXNbbWF0Y2hlc1NpbXBsZVswXSAtIDFdOyAvLyBPdXIgdGFyZ2V0IHN0cmluZyBzdWNjZXNzZnVsbHkgbWF0Y2hlZCBhbGwgY2hhcmFjdGVycyBpbiBzZXF1ZW5jZSFcblx0ICAgICAgICAgIC8vIExldCdzIHRyeSBhIG1vcmUgYWR2YW5jZWQgYW5kIHN0cmljdCB0ZXN0IHRvIGltcHJvdmUgdGhlIHNjb3JlXG5cdCAgICAgICAgICAvLyBvbmx5IGNvdW50IGl0IGFzIGEgbWF0Y2ggaWYgaXQncyBjb25zZWN1dGl2ZSBvciBhIGJlZ2lubmluZyBjaGFyYWN0ZXIhXG5cblx0ICAgICAgICAgIGlmICh0YXJnZXRJICE9PSB0YXJnZXRMZW4pIGZvciAoOzspIHtcblx0ICAgICAgICAgICAgaWYgKHRhcmdldEkgPj0gdGFyZ2V0TGVuKSB7XG5cdCAgICAgICAgICAgICAgLy8gV2UgZmFpbGVkIHRvIGZpbmQgYSBnb29kIHNwb3QgZm9yIHRoaXMgc2VhcmNoIGNoYXIsIGdvIGJhY2sgdG8gdGhlIHByZXZpb3VzIHNlYXJjaCBjaGFyIGFuZCBmb3JjZSBpdCBmb3J3YXJkXG5cdCAgICAgICAgICAgICAgaWYgKHNlYXJjaEkgPD0gMCkge1xuXHQgICAgICAgICAgICAgICAgLy8gV2UgZmFpbGVkIHRvIHB1c2ggY2hhcnMgZm9yd2FyZCBmb3IgYSBiZXR0ZXIgbWF0Y2hcblx0ICAgICAgICAgICAgICAgIC8vIHRyYW5zcG9zZSwgc3RhcnRpbmcgZnJvbSB0aGUgYmVnaW5uaW5nXG5cdCAgICAgICAgICAgICAgICArK3R5cG9TdHJpY3RJO1xuXHQgICAgICAgICAgICAgICAgaWYgKHR5cG9TdHJpY3RJID4gc2VhcmNoTGVuIC0gMikgYnJlYWs7XG5cdCAgICAgICAgICAgICAgICBpZiAoc2VhcmNoTG93ZXJDb2Rlc1t0eXBvU3RyaWN0SV0gPT09IHNlYXJjaExvd2VyQ29kZXNbdHlwb1N0cmljdEkgKyAxXSkgY29udGludWU7IC8vIGRvZXNuJ3QgbWFrZSBzZW5zZSB0byB0cmFuc3Bvc2UgYSByZXBlYXQgY2hhclxuXG5cdCAgICAgICAgICAgICAgICB0YXJnZXRJID0gZmlyc3RQb3NzaWJsZUk7XG5cdCAgICAgICAgICAgICAgICBjb250aW51ZTtcblx0ICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAtLXNlYXJjaEk7XG5cdCAgICAgICAgICAgICAgdmFyIGxhc3RNYXRjaCA9IG1hdGNoZXNTdHJpY3RbLS1tYXRjaGVzU3RyaWN0TGVuXTtcblx0ICAgICAgICAgICAgICB0YXJnZXRJID0gbmV4dEJlZ2lubmluZ0luZGV4ZXNbbGFzdE1hdGNoXTtcblx0ICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICB2YXIgaXNNYXRjaCA9IHNlYXJjaExvd2VyQ29kZXNbdHlwb1N0cmljdEkgPT09IDAgPyBzZWFyY2hJIDogdHlwb1N0cmljdEkgPT09IHNlYXJjaEkgPyBzZWFyY2hJICsgMSA6IHR5cG9TdHJpY3RJID09PSBzZWFyY2hJIC0gMSA/IHNlYXJjaEkgLSAxIDogc2VhcmNoSV0gPT09IHRhcmdldExvd2VyQ29kZXNbdGFyZ2V0SV07XG5cblx0ICAgICAgICAgICAgICBpZiAoaXNNYXRjaCkge1xuXHQgICAgICAgICAgICAgICAgbWF0Y2hlc1N0cmljdFttYXRjaGVzU3RyaWN0TGVuKytdID0gdGFyZ2V0STtcblx0ICAgICAgICAgICAgICAgICsrc2VhcmNoSTtcblxuXHQgICAgICAgICAgICAgICAgaWYgKHNlYXJjaEkgPT09IHNlYXJjaExlbikge1xuXHQgICAgICAgICAgICAgICAgICBzdWNjZXNzU3RyaWN0ID0gdHJ1ZTtcblx0ICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cdCAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgICsrdGFyZ2V0STtcblx0ICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgdGFyZ2V0SSA9IG5leHRCZWdpbm5pbmdJbmRleGVzW3RhcmdldEldO1xuXHQgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXHQgICAgICAgICAge1xuXHQgICAgICAgICAgICAvLyB0YWxseSB1cCB0aGUgc2NvcmUgJiBrZWVwIHRyYWNrIG9mIG1hdGNoZXMgZm9yIGhpZ2hsaWdodGluZyBsYXRlclxuXHQgICAgICAgICAgICBpZiAoc3VjY2Vzc1N0cmljdCkge1xuXHQgICAgICAgICAgICAgIHZhciBtYXRjaGVzQmVzdCA9IG1hdGNoZXNTdHJpY3Q7XG5cdCAgICAgICAgICAgICAgdmFyIG1hdGNoZXNCZXN0TGVuID0gbWF0Y2hlc1N0cmljdExlbjtcblx0ICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICB2YXIgbWF0Y2hlc0Jlc3QgPSBtYXRjaGVzU2ltcGxlO1xuXHQgICAgICAgICAgICAgIHZhciBtYXRjaGVzQmVzdExlbiA9IG1hdGNoZXNTaW1wbGVMZW47XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICB2YXIgc2NvcmUgPSAwO1xuXHQgICAgICAgICAgICB2YXIgbGFzdFRhcmdldEkgPSAtMTtcblxuXHQgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlYXJjaExlbjsgKytpKSB7XG5cdCAgICAgICAgICAgICAgdmFyIHRhcmdldEkgPSBtYXRjaGVzQmVzdFtpXTsgLy8gc2NvcmUgb25seSBnb2VzIGRvd24gaWYgdGhleSdyZSBub3QgY29uc2VjdXRpdmVcblxuXHQgICAgICAgICAgICAgIGlmIChsYXN0VGFyZ2V0SSAhPT0gdGFyZ2V0SSAtIDEpIHNjb3JlIC09IHRhcmdldEk7XG5cdCAgICAgICAgICAgICAgbGFzdFRhcmdldEkgPSB0YXJnZXRJO1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgaWYgKCFzdWNjZXNzU3RyaWN0KSB7XG5cdCAgICAgICAgICAgICAgc2NvcmUgKj0gMTAwMDtcblx0ICAgICAgICAgICAgICBpZiAodHlwb1NpbXBsZUkgIT09IDApIHNjb3JlICs9IC0yMDtcblx0ICAgICAgICAgICAgICAvKnR5cG9QZW5hbHR5Ki9cblx0ICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICBpZiAodHlwb1N0cmljdEkgIT09IDApIHNjb3JlICs9IC0yMDtcblx0ICAgICAgICAgICAgICAvKnR5cG9QZW5hbHR5Ki9cblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIHNjb3JlIC09IHRhcmdldExlbiAtIHNlYXJjaExlbjtcblx0ICAgICAgICAgICAgcHJlcGFyZWQuc2NvcmUgPSBzY29yZTtcblx0ICAgICAgICAgICAgcHJlcGFyZWQuaW5kZXhlcyA9IG5ldyBBcnJheShtYXRjaGVzQmVzdExlbik7XG5cblx0ICAgICAgICAgICAgZm9yICh2YXIgaSA9IG1hdGNoZXNCZXN0TGVuIC0gMTsgaSA+PSAwOyAtLWkpIHByZXBhcmVkLmluZGV4ZXNbaV0gPSBtYXRjaGVzQmVzdFtpXTtcblxuXHQgICAgICAgICAgICByZXR1cm4gcHJlcGFyZWQ7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBhbGdvcml0aG1Ob1R5cG86IGZ1bmN0aW9uIChzZWFyY2hMb3dlckNvZGVzLCBwcmVwYXJlZCwgc2VhcmNoTG93ZXJDb2RlKSB7XG5cdCAgICAgICAgICB2YXIgdGFyZ2V0TG93ZXJDb2RlcyA9IHByZXBhcmVkLl90YXJnZXRMb3dlckNvZGVzO1xuXHQgICAgICAgICAgdmFyIHNlYXJjaExlbiA9IHNlYXJjaExvd2VyQ29kZXMubGVuZ3RoO1xuXHQgICAgICAgICAgdmFyIHRhcmdldExlbiA9IHRhcmdldExvd2VyQ29kZXMubGVuZ3RoO1xuXHQgICAgICAgICAgdmFyIHNlYXJjaEkgPSAwOyAvLyB3aGVyZSB3ZSBhdFxuXG5cdCAgICAgICAgICB2YXIgdGFyZ2V0SSA9IDA7IC8vIHdoZXJlIHlvdSBhdFxuXG5cdCAgICAgICAgICB2YXIgbWF0Y2hlc1NpbXBsZUxlbiA9IDA7IC8vIHZlcnkgYmFzaWMgZnV6enkgbWF0Y2g7IHRvIHJlbW92ZSBub24tbWF0Y2hpbmcgdGFyZ2V0cyBBU0FQIVxuXHQgICAgICAgICAgLy8gd2FsayB0aHJvdWdoIHRhcmdldC4gZmluZCBzZXF1ZW50aWFsIG1hdGNoZXMuXG5cdCAgICAgICAgICAvLyBpZiBhbGwgY2hhcnMgYXJlbid0IGZvdW5kIHRoZW4gZXhpdFxuXG5cdCAgICAgICAgICBmb3IgKDs7KSB7XG5cdCAgICAgICAgICAgIHZhciBpc01hdGNoID0gc2VhcmNoTG93ZXJDb2RlID09PSB0YXJnZXRMb3dlckNvZGVzW3RhcmdldEldO1xuXG5cdCAgICAgICAgICAgIGlmIChpc01hdGNoKSB7XG5cdCAgICAgICAgICAgICAgbWF0Y2hlc1NpbXBsZVttYXRjaGVzU2ltcGxlTGVuKytdID0gdGFyZ2V0STtcblx0ICAgICAgICAgICAgICArK3NlYXJjaEk7XG5cdCAgICAgICAgICAgICAgaWYgKHNlYXJjaEkgPT09IHNlYXJjaExlbikgYnJlYWs7XG5cdCAgICAgICAgICAgICAgc2VhcmNoTG93ZXJDb2RlID0gc2VhcmNoTG93ZXJDb2Rlc1tzZWFyY2hJXTtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICsrdGFyZ2V0STtcblx0ICAgICAgICAgICAgaWYgKHRhcmdldEkgPj0gdGFyZ2V0TGVuKSByZXR1cm4gbnVsbDsgLy8gRmFpbGVkIHRvIGZpbmQgc2VhcmNoSVxuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICB2YXIgc2VhcmNoSSA9IDA7XG5cdCAgICAgICAgICB2YXIgc3VjY2Vzc1N0cmljdCA9IGZhbHNlO1xuXHQgICAgICAgICAgdmFyIG1hdGNoZXNTdHJpY3RMZW4gPSAwO1xuXHQgICAgICAgICAgdmFyIG5leHRCZWdpbm5pbmdJbmRleGVzID0gcHJlcGFyZWQuX25leHRCZWdpbm5pbmdJbmRleGVzO1xuXHQgICAgICAgICAgaWYgKG5leHRCZWdpbm5pbmdJbmRleGVzID09PSBudWxsKSBuZXh0QmVnaW5uaW5nSW5kZXhlcyA9IHByZXBhcmVkLl9uZXh0QmVnaW5uaW5nSW5kZXhlcyA9IGZ1enp5c29ydC5wcmVwYXJlTmV4dEJlZ2lubmluZ0luZGV4ZXMocHJlcGFyZWQudGFyZ2V0KTtcblx0ICAgICAgICAgIHZhciBmaXJzdFBvc3NpYmxlSSA9IHRhcmdldEkgPSBtYXRjaGVzU2ltcGxlWzBdID09PSAwID8gMCA6IG5leHRCZWdpbm5pbmdJbmRleGVzW21hdGNoZXNTaW1wbGVbMF0gLSAxXTsgLy8gT3VyIHRhcmdldCBzdHJpbmcgc3VjY2Vzc2Z1bGx5IG1hdGNoZWQgYWxsIGNoYXJhY3RlcnMgaW4gc2VxdWVuY2UhXG5cdCAgICAgICAgICAvLyBMZXQncyB0cnkgYSBtb3JlIGFkdmFuY2VkIGFuZCBzdHJpY3QgdGVzdCB0byBpbXByb3ZlIHRoZSBzY29yZVxuXHQgICAgICAgICAgLy8gb25seSBjb3VudCBpdCBhcyBhIG1hdGNoIGlmIGl0J3MgY29uc2VjdXRpdmUgb3IgYSBiZWdpbm5pbmcgY2hhcmFjdGVyIVxuXG5cdCAgICAgICAgICBpZiAodGFyZ2V0SSAhPT0gdGFyZ2V0TGVuKSBmb3IgKDs7KSB7XG5cdCAgICAgICAgICAgIGlmICh0YXJnZXRJID49IHRhcmdldExlbikge1xuXHQgICAgICAgICAgICAgIC8vIFdlIGZhaWxlZCB0byBmaW5kIGEgZ29vZCBzcG90IGZvciB0aGlzIHNlYXJjaCBjaGFyLCBnbyBiYWNrIHRvIHRoZSBwcmV2aW91cyBzZWFyY2ggY2hhciBhbmQgZm9yY2UgaXQgZm9yd2FyZFxuXHQgICAgICAgICAgICAgIGlmIChzZWFyY2hJIDw9IDApIGJyZWFrOyAvLyBXZSBmYWlsZWQgdG8gcHVzaCBjaGFycyBmb3J3YXJkIGZvciBhIGJldHRlciBtYXRjaFxuXG5cdCAgICAgICAgICAgICAgLS1zZWFyY2hJO1xuXHQgICAgICAgICAgICAgIHZhciBsYXN0TWF0Y2ggPSBtYXRjaGVzU3RyaWN0Wy0tbWF0Y2hlc1N0cmljdExlbl07XG5cdCAgICAgICAgICAgICAgdGFyZ2V0SSA9IG5leHRCZWdpbm5pbmdJbmRleGVzW2xhc3RNYXRjaF07XG5cdCAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgdmFyIGlzTWF0Y2ggPSBzZWFyY2hMb3dlckNvZGVzW3NlYXJjaEldID09PSB0YXJnZXRMb3dlckNvZGVzW3RhcmdldEldO1xuXG5cdCAgICAgICAgICAgICAgaWYgKGlzTWF0Y2gpIHtcblx0ICAgICAgICAgICAgICAgIG1hdGNoZXNTdHJpY3RbbWF0Y2hlc1N0cmljdExlbisrXSA9IHRhcmdldEk7XG5cdCAgICAgICAgICAgICAgICArK3NlYXJjaEk7XG5cblx0ICAgICAgICAgICAgICAgIGlmIChzZWFyY2hJID09PSBzZWFyY2hMZW4pIHtcblx0ICAgICAgICAgICAgICAgICAgc3VjY2Vzc1N0cmljdCA9IHRydWU7XG5cdCAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXHQgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICArK3RhcmdldEk7XG5cdCAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgIHRhcmdldEkgPSBuZXh0QmVnaW5uaW5nSW5kZXhlc1t0YXJnZXRJXTtcblx0ICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblx0ICAgICAgICAgIHtcblx0ICAgICAgICAgICAgLy8gdGFsbHkgdXAgdGhlIHNjb3JlICYga2VlcCB0cmFjayBvZiBtYXRjaGVzIGZvciBoaWdobGlnaHRpbmcgbGF0ZXJcblx0ICAgICAgICAgICAgaWYgKHN1Y2Nlc3NTdHJpY3QpIHtcblx0ICAgICAgICAgICAgICB2YXIgbWF0Y2hlc0Jlc3QgPSBtYXRjaGVzU3RyaWN0O1xuXHQgICAgICAgICAgICAgIHZhciBtYXRjaGVzQmVzdExlbiA9IG1hdGNoZXNTdHJpY3RMZW47XG5cdCAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgdmFyIG1hdGNoZXNCZXN0ID0gbWF0Y2hlc1NpbXBsZTtcblx0ICAgICAgICAgICAgICB2YXIgbWF0Y2hlc0Jlc3RMZW4gPSBtYXRjaGVzU2ltcGxlTGVuO1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgdmFyIHNjb3JlID0gMDtcblx0ICAgICAgICAgICAgdmFyIGxhc3RUYXJnZXRJID0gLTE7XG5cblx0ICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWFyY2hMZW47ICsraSkge1xuXHQgICAgICAgICAgICAgIHZhciB0YXJnZXRJID0gbWF0Y2hlc0Jlc3RbaV07IC8vIHNjb3JlIG9ubHkgZ29lcyBkb3duIGlmIHRoZXkncmUgbm90IGNvbnNlY3V0aXZlXG5cblx0ICAgICAgICAgICAgICBpZiAobGFzdFRhcmdldEkgIT09IHRhcmdldEkgLSAxKSBzY29yZSAtPSB0YXJnZXRJO1xuXHQgICAgICAgICAgICAgIGxhc3RUYXJnZXRJID0gdGFyZ2V0STtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIGlmICghc3VjY2Vzc1N0cmljdCkgc2NvcmUgKj0gMTAwMDtcblx0ICAgICAgICAgICAgc2NvcmUgLT0gdGFyZ2V0TGVuIC0gc2VhcmNoTGVuO1xuXHQgICAgICAgICAgICBwcmVwYXJlZC5zY29yZSA9IHNjb3JlO1xuXHQgICAgICAgICAgICBwcmVwYXJlZC5pbmRleGVzID0gbmV3IEFycmF5KG1hdGNoZXNCZXN0TGVuKTtcblxuXHQgICAgICAgICAgICBmb3IgKHZhciBpID0gbWF0Y2hlc0Jlc3RMZW4gLSAxOyBpID49IDA7IC0taSkgcHJlcGFyZWQuaW5kZXhlc1tpXSA9IG1hdGNoZXNCZXN0W2ldO1xuXG5cdCAgICAgICAgICAgIHJldHVybiBwcmVwYXJlZDtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9LFxuXHQgICAgICAgIHByZXBhcmVMb3dlckNvZGVzOiBmdW5jdGlvbiAoc3RyKSB7XG5cdCAgICAgICAgICB2YXIgc3RyTGVuID0gc3RyLmxlbmd0aDtcblx0ICAgICAgICAgIHZhciBsb3dlckNvZGVzID0gW107IC8vIG5ldyBBcnJheShzdHJMZW4pICAgIHNwYXJzZSBhcnJheSBpcyB0b28gc2xvd1xuXG5cdCAgICAgICAgICB2YXIgbG93ZXIgPSBzdHIudG9Mb3dlckNhc2UoKTtcblxuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHJMZW47ICsraSkgbG93ZXJDb2Rlc1tpXSA9IGxvd2VyLmNoYXJDb2RlQXQoaSk7XG5cblx0ICAgICAgICAgIHJldHVybiBsb3dlckNvZGVzO1xuXHQgICAgICAgIH0sXG5cdCAgICAgICAgcHJlcGFyZUJlZ2lubmluZ0luZGV4ZXM6IGZ1bmN0aW9uICh0YXJnZXQpIHtcblx0ICAgICAgICAgIHZhciB0YXJnZXRMZW4gPSB0YXJnZXQubGVuZ3RoO1xuXHQgICAgICAgICAgdmFyIGJlZ2lubmluZ0luZGV4ZXMgPSBbXTtcblx0ICAgICAgICAgIHZhciBiZWdpbm5pbmdJbmRleGVzTGVuID0gMDtcblx0ICAgICAgICAgIHZhciB3YXNVcHBlciA9IGZhbHNlO1xuXHQgICAgICAgICAgdmFyIHdhc0FscGhhbnVtID0gZmFsc2U7XG5cblx0ICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGFyZ2V0TGVuOyArK2kpIHtcblx0ICAgICAgICAgICAgdmFyIHRhcmdldENvZGUgPSB0YXJnZXQuY2hhckNvZGVBdChpKTtcblx0ICAgICAgICAgICAgdmFyIGlzVXBwZXIgPSB0YXJnZXRDb2RlID49IDY1ICYmIHRhcmdldENvZGUgPD0gOTA7XG5cdCAgICAgICAgICAgIHZhciBpc0FscGhhbnVtID0gaXNVcHBlciB8fCB0YXJnZXRDb2RlID49IDk3ICYmIHRhcmdldENvZGUgPD0gMTIyIHx8IHRhcmdldENvZGUgPj0gNDggJiYgdGFyZ2V0Q29kZSA8PSA1Nztcblx0ICAgICAgICAgICAgdmFyIGlzQmVnaW5uaW5nID0gaXNVcHBlciAmJiAhd2FzVXBwZXIgfHwgIXdhc0FscGhhbnVtIHx8ICFpc0FscGhhbnVtO1xuXHQgICAgICAgICAgICB3YXNVcHBlciA9IGlzVXBwZXI7XG5cdCAgICAgICAgICAgIHdhc0FscGhhbnVtID0gaXNBbHBoYW51bTtcblx0ICAgICAgICAgICAgaWYgKGlzQmVnaW5uaW5nKSBiZWdpbm5pbmdJbmRleGVzW2JlZ2lubmluZ0luZGV4ZXNMZW4rK10gPSBpO1xuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICByZXR1cm4gYmVnaW5uaW5nSW5kZXhlcztcblx0ICAgICAgICB9LFxuXHQgICAgICAgIHByZXBhcmVOZXh0QmVnaW5uaW5nSW5kZXhlczogZnVuY3Rpb24gKHRhcmdldCkge1xuXHQgICAgICAgICAgdmFyIHRhcmdldExlbiA9IHRhcmdldC5sZW5ndGg7XG5cdCAgICAgICAgICB2YXIgYmVnaW5uaW5nSW5kZXhlcyA9IGZ1enp5c29ydC5wcmVwYXJlQmVnaW5uaW5nSW5kZXhlcyh0YXJnZXQpO1xuXHQgICAgICAgICAgdmFyIG5leHRCZWdpbm5pbmdJbmRleGVzID0gW107IC8vIG5ldyBBcnJheSh0YXJnZXRMZW4pICAgICBzcGFyc2UgYXJyYXkgaXMgdG9vIHNsb3dcblxuXHQgICAgICAgICAgdmFyIGxhc3RJc0JlZ2lubmluZyA9IGJlZ2lubmluZ0luZGV4ZXNbMF07XG5cdCAgICAgICAgICB2YXIgbGFzdElzQmVnaW5uaW5nSSA9IDA7XG5cblx0ICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGFyZ2V0TGVuOyArK2kpIHtcblx0ICAgICAgICAgICAgaWYgKGxhc3RJc0JlZ2lubmluZyA+IGkpIHtcblx0ICAgICAgICAgICAgICBuZXh0QmVnaW5uaW5nSW5kZXhlc1tpXSA9IGxhc3RJc0JlZ2lubmluZztcblx0ICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICBsYXN0SXNCZWdpbm5pbmcgPSBiZWdpbm5pbmdJbmRleGVzWysrbGFzdElzQmVnaW5uaW5nSV07XG5cdCAgICAgICAgICAgICAgbmV4dEJlZ2lubmluZ0luZGV4ZXNbaV0gPSBsYXN0SXNCZWdpbm5pbmcgPT09IHVuZGVmaW5lZCA/IHRhcmdldExlbiA6IGxhc3RJc0JlZ2lubmluZztcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICByZXR1cm4gbmV4dEJlZ2lubmluZ0luZGV4ZXM7XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBjbGVhbnVwOiBjbGVhbnVwLFxuXHQgICAgICAgIG5ldzogZnV6enlzb3J0TmV3XG5cdCAgICAgIH07XG5cdCAgICAgIHJldHVybiBmdXp6eXNvcnQ7XG5cdCAgICB9IC8vIGZ1enp5c29ydE5ld1xuXHQgICAgLy8gVGhpcyBzdHVmZiBpcyBvdXRzaWRlIGZ1enp5c29ydE5ldywgYmVjYXVzZSBpdCdzIHNoYXJlZCB3aXRoIGluc3RhbmNlcyBvZiBmdXp6eXNvcnQubmV3KClcblxuXG5cdCAgICB2YXIgaXNOb2RlID0gdHlwZW9mIGNvbW1vbmpzUmVxdWlyZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCc7IC8vIHZhciBNQVhfSU5UID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJcblx0ICAgIC8vIHZhciBNSU5fSU5UID0gTnVtYmVyLk1JTl9WQUxVRVxuXG5cdCAgICB2YXIgcHJlcGFyZWRDYWNoZSA9IG5ldyBNYXAoKTtcblx0ICAgIHZhciBwcmVwYXJlZFNlYXJjaENhY2hlID0gbmV3IE1hcCgpO1xuXHQgICAgdmFyIG5vUmVzdWx0cyA9IFtdO1xuXHQgICAgbm9SZXN1bHRzLnRvdGFsID0gMDtcblx0ICAgIHZhciBtYXRjaGVzU2ltcGxlID0gW107XG5cdCAgICB2YXIgbWF0Y2hlc1N0cmljdCA9IFtdO1xuXG5cdCAgICBmdW5jdGlvbiBjbGVhbnVwKCkge1xuXHQgICAgICBwcmVwYXJlZENhY2hlLmNsZWFyKCk7XG5cdCAgICAgIHByZXBhcmVkU2VhcmNoQ2FjaGUuY2xlYXIoKTtcblx0ICAgICAgbWF0Y2hlc1NpbXBsZSA9IFtdO1xuXHQgICAgICBtYXRjaGVzU3RyaWN0ID0gW107XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGRlZmF1bHRTY29yZUZuKGEpIHtcblx0ICAgICAgdmFyIG1heCA9IC05MDA3MTk5MjU0NzQwOTkxO1xuXG5cdCAgICAgIGZvciAodmFyIGkgPSBhLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG5cdCAgICAgICAgdmFyIHJlc3VsdCA9IGFbaV07XG5cdCAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkgY29udGludWU7XG5cdCAgICAgICAgdmFyIHNjb3JlID0gcmVzdWx0LnNjb3JlO1xuXHQgICAgICAgIGlmIChzY29yZSA+IG1heCkgbWF4ID0gc2NvcmU7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAobWF4ID09PSAtOTAwNzE5OTI1NDc0MDk5MSkgcmV0dXJuIG51bGw7XG5cdCAgICAgIHJldHVybiBtYXg7XG5cdCAgICB9IC8vIHByb3AgPSAna2V5JyAgICAgICAgICAgICAgMi41bXMgb3B0aW1pemVkIGZvciB0aGlzIGNhc2UsIHNlZW1zIHRvIGJlIGFib3V0IGFzIGZhc3QgYXMgZGlyZWN0IG9ialtwcm9wXVxuXHQgICAgLy8gcHJvcCA9ICdrZXkxLmtleTInICAgICAgICAxMG1zXG5cdCAgICAvLyBwcm9wID0gWydrZXkxJywgJ2tleTInXSAgIDI3bXNcblxuXG5cdCAgICBmdW5jdGlvbiBnZXRWYWx1ZShvYmosIHByb3ApIHtcblx0ICAgICAgdmFyIHRtcCA9IG9ialtwcm9wXTtcblx0ICAgICAgaWYgKHRtcCAhPT0gdW5kZWZpbmVkKSByZXR1cm4gdG1wO1xuXHQgICAgICB2YXIgc2VncyA9IHByb3A7XG5cdCAgICAgIGlmICghQXJyYXkuaXNBcnJheShwcm9wKSkgc2VncyA9IHByb3Auc3BsaXQoJy4nKTtcblx0ICAgICAgdmFyIGxlbiA9IHNlZ3MubGVuZ3RoO1xuXHQgICAgICB2YXIgaSA9IC0xO1xuXG5cdCAgICAgIHdoaWxlIChvYmogJiYgKytpIDwgbGVuKSBvYmogPSBvYmpbc2Vnc1tpXV07XG5cblx0ICAgICAgcmV0dXJuIG9iajtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gaXNPYmooeCkge1xuXHQgICAgICByZXR1cm4gdHlwZW9mIHggPT09ICdvYmplY3QnO1xuXHQgICAgfSAvLyBmYXN0ZXIgYXMgYSBmdW5jdGlvblxuXHQgICAgLy8gSGFja2VkIHZlcnNpb24gb2YgaHR0cHM6Ly9naXRodWIuY29tL2xlbWlyZS9GYXN0UHJpb3JpdHlRdWV1ZS5qc1xuXG5cblx0ICAgIHZhciBmYXN0cHJpb3JpdHlxdWV1ZSA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgdmFyIHIgPSBbXSxcblx0ICAgICAgICAgIG8gPSAwLFxuXHQgICAgICAgICAgZSA9IHt9O1xuXG5cdCAgICAgIGZ1bmN0aW9uIG4oKSB7XG5cdCAgICAgICAgZm9yICh2YXIgZSA9IDAsIG4gPSByW2VdLCBjID0gMTsgYyA8IG87KSB7XG5cdCAgICAgICAgICB2YXIgZiA9IGMgKyAxO1xuXHQgICAgICAgICAgZSA9IGMsIGYgPCBvICYmIHJbZl0uc2NvcmUgPCByW2NdLnNjb3JlICYmIChlID0gZiksIHJbZSAtIDEgPj4gMV0gPSByW2VdLCBjID0gMSArIChlIDw8IDEpO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGZvciAodmFyIGEgPSBlIC0gMSA+PiAxOyBlID4gMCAmJiBuLnNjb3JlIDwgclthXS5zY29yZTsgYSA9IChlID0gYSkgLSAxID4+IDEpIHJbZV0gPSByW2FdO1xuXG5cdCAgICAgICAgcltlXSA9IG47XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gZS5hZGQgPSBmdW5jdGlvbiAoZSkge1xuXHQgICAgICAgIHZhciBuID0gbztcblx0ICAgICAgICByW28rK10gPSBlO1xuXG5cdCAgICAgICAgZm9yICh2YXIgYyA9IG4gLSAxID4+IDE7IG4gPiAwICYmIGUuc2NvcmUgPCByW2NdLnNjb3JlOyBjID0gKG4gPSBjKSAtIDEgPj4gMSkgcltuXSA9IHJbY107XG5cblx0ICAgICAgICByW25dID0gZTtcblx0ICAgICAgfSwgZS5wb2xsID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIGlmICgwICE9PSBvKSB7XG5cdCAgICAgICAgICB2YXIgZSA9IHJbMF07XG5cdCAgICAgICAgICByZXR1cm4gclswXSA9IHJbLS1vXSwgbigpLCBlO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSwgZS5wZWVrID0gZnVuY3Rpb24gKGUpIHtcblx0ICAgICAgICBpZiAoMCAhPT0gbykgcmV0dXJuIHJbMF07XG5cdCAgICAgIH0sIGUucmVwbGFjZVRvcCA9IGZ1bmN0aW9uIChvKSB7XG5cdCAgICAgICAgclswXSA9IG8sIG4oKTtcblx0ICAgICAgfSwgZTtcblx0ICAgIH07XG5cblx0ICAgIHZhciBxID0gZmFzdHByaW9yaXR5cXVldWUoKTsgLy8gcmV1c2UgdGhpcywgZXhjZXB0IGZvciBhc3luYywgaXQgbmVlZHMgdG8gbWFrZSBpdHMgb3duXG5cblx0ICAgIHJldHVybiBmdXp6eXNvcnROZXcoKTtcblx0ICB9KTsgLy8gVU1EXG5cdCAgLy8gVE9ETzogKHBlcmZvcm1hbmNlKSB3YXNtIHZlcnNpb24hP1xuXHQgIC8vIFRPRE86IChwZXJmb3JtYW5jZSkgbGF5b3V0IG1lbW9yeSBpbiBhbiBvcHRpbWFsIHdheSB0byBnbyBmYXN0IGJ5IGF2b2lkaW5nIGNhY2hlIG1pc3Nlc1xuXHQgIC8vIFRPRE86IChwZXJmb3JtYW5jZSkgcHJlcGFyZWRDYWNoZSBpcyBhIG1lbW9yeSBsZWFrXG5cdCAgLy8gVE9ETzogKGxpa2Ugc3VibGltZSkgYmFja3NsYXNoID09PSBmb3J3YXJkc2xhc2hcblx0ICAvLyBUT0RPOiAocGVyZm9ybWFuY2UpIGkgaGF2ZSBubyBpZGVhIGhvdyB3ZWxsIG9wdGl6bWllZCB0aGUgYWxsb3dpbmcgdHlwb3MgYWxnb3JpdGhtIGlzXG5cblx0fSk7XG5cblx0dmFyIHN0YXRzID0ge1xuXHQgIHBhc3NlZFRlc3RzOiAwLFxuXHQgIGZhaWxlZFRlc3RzOiAwLFxuXHQgIHNraXBwZWRUZXN0czogMCxcblx0ICB0b2RvVGVzdHM6IDBcblx0fTsgLy8gRXNjYXBlIHRleHQgZm9yIGF0dHJpYnV0ZSBvciB0ZXh0IGNvbnRlbnQuXG5cblx0ZnVuY3Rpb24gZXNjYXBlVGV4dChzKSB7XG5cdCAgaWYgKCFzKSB7XG5cdCAgICByZXR1cm4gXCJcIjtcblx0ICB9XG5cblx0ICBzID0gcyArIFwiXCI7IC8vIEJvdGggc2luZ2xlIHF1b3RlcyBhbmQgZG91YmxlIHF1b3RlcyAoZm9yIGF0dHJpYnV0ZXMpXG5cblx0ICByZXR1cm4gcy5yZXBsYWNlKC9bJ1wiPD4mXS9nLCBmdW5jdGlvbiAocykge1xuXHQgICAgc3dpdGNoIChzKSB7XG5cdCAgICAgIGNhc2UgXCInXCI6XG5cdCAgICAgICAgcmV0dXJuIFwiJiMwMzk7XCI7XG5cblx0ICAgICAgY2FzZSBcIlxcXCJcIjpcblx0ICAgICAgICByZXR1cm4gXCImcXVvdDtcIjtcblxuXHQgICAgICBjYXNlIFwiPFwiOlxuXHQgICAgICAgIHJldHVybiBcIiZsdDtcIjtcblxuXHQgICAgICBjYXNlIFwiPlwiOlxuXHQgICAgICAgIHJldHVybiBcIiZndDtcIjtcblxuXHQgICAgICBjYXNlIFwiJlwiOlxuXHQgICAgICAgIHJldHVybiBcIiZhbXA7XCI7XG5cdCAgICB9XG5cdCAgfSk7XG5cdH1cblxuXHQoZnVuY3Rpb24gKCkge1xuXHQgIC8vIERvbid0IGxvYWQgdGhlIEhUTUwgUmVwb3J0ZXIgb24gbm9uLWJyb3dzZXIgZW52aXJvbm1lbnRzXG5cdCAgaWYgKHR5cGVvZiB3aW5kb3ckMSA9PT0gXCJ1bmRlZmluZWRcIiB8fCAhd2luZG93JDEuZG9jdW1lbnQpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICB2YXIgY29uZmlnID0gUVVuaXQuY29uZmlnLFxuXHQgICAgICBoaWRkZW5UZXN0cyA9IFtdLFxuXHQgICAgICBkb2N1bWVudCA9IHdpbmRvdyQxLmRvY3VtZW50LFxuXHQgICAgICBjb2xsYXBzZU5leHQgPSBmYWxzZSxcblx0ICAgICAgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSxcblx0ICAgICAgdW5maWx0ZXJlZFVybCA9IHNldFVybCh7XG5cdCAgICBmaWx0ZXI6IHVuZGVmaW5lZCxcblx0ICAgIG1vZHVsZTogdW5kZWZpbmVkLFxuXHQgICAgbW9kdWxlSWQ6IHVuZGVmaW5lZCxcblx0ICAgIHRlc3RJZDogdW5kZWZpbmVkXG5cdCAgfSksXG5cdCAgICAgIG1vZHVsZXNMaXN0ID0gW107XG5cblx0ICBmdW5jdGlvbiBhZGRFdmVudChlbGVtLCB0eXBlLCBmbikge1xuXHQgICAgZWxlbS5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGZuLCBmYWxzZSk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gcmVtb3ZlRXZlbnQoZWxlbSwgdHlwZSwgZm4pIHtcblx0ICAgIGVsZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgZmFsc2UpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFkZEV2ZW50cyhlbGVtcywgdHlwZSwgZm4pIHtcblx0ICAgIHZhciBpID0gZWxlbXMubGVuZ3RoO1xuXG5cdCAgICB3aGlsZSAoaS0tKSB7XG5cdCAgICAgIGFkZEV2ZW50KGVsZW1zW2ldLCB0eXBlLCBmbik7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gaGFzQ2xhc3MoZWxlbSwgbmFtZSkge1xuXHQgICAgcmV0dXJuIChcIiBcIiArIGVsZW0uY2xhc3NOYW1lICsgXCIgXCIpLmluZGV4T2YoXCIgXCIgKyBuYW1lICsgXCIgXCIpID49IDA7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYWRkQ2xhc3MoZWxlbSwgbmFtZSkge1xuXHQgICAgaWYgKCFoYXNDbGFzcyhlbGVtLCBuYW1lKSkge1xuXHQgICAgICBlbGVtLmNsYXNzTmFtZSArPSAoZWxlbS5jbGFzc05hbWUgPyBcIiBcIiA6IFwiXCIpICsgbmFtZTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiB0b2dnbGVDbGFzcyhlbGVtLCBuYW1lLCBmb3JjZSkge1xuXHQgICAgaWYgKGZvcmNlIHx8IHR5cGVvZiBmb3JjZSA9PT0gXCJ1bmRlZmluZWRcIiAmJiAhaGFzQ2xhc3MoZWxlbSwgbmFtZSkpIHtcblx0ICAgICAgYWRkQ2xhc3MoZWxlbSwgbmFtZSk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICByZW1vdmVDbGFzcyhlbGVtLCBuYW1lKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiByZW1vdmVDbGFzcyhlbGVtLCBuYW1lKSB7XG5cdCAgICB2YXIgc2V0ID0gXCIgXCIgKyBlbGVtLmNsYXNzTmFtZSArIFwiIFwiOyAvLyBDbGFzcyBuYW1lIG1heSBhcHBlYXIgbXVsdGlwbGUgdGltZXNcblxuXHQgICAgd2hpbGUgKHNldC5pbmRleE9mKFwiIFwiICsgbmFtZSArIFwiIFwiKSA+PSAwKSB7XG5cdCAgICAgIHNldCA9IHNldC5yZXBsYWNlKFwiIFwiICsgbmFtZSArIFwiIFwiLCBcIiBcIik7XG5cdCAgICB9IC8vIFRyaW0gZm9yIHByZXR0aW5lc3NcblxuXG5cdCAgICBlbGVtLmNsYXNzTmFtZSA9IHR5cGVvZiBzZXQudHJpbSA9PT0gXCJmdW5jdGlvblwiID8gc2V0LnRyaW0oKSA6IHNldC5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCBcIlwiKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBpZChuYW1lKSB7XG5cdCAgICByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQgJiYgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobmFtZSk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYWJvcnRUZXN0cygpIHtcblx0ICAgIHZhciBhYm9ydEJ1dHRvbiA9IGlkKFwicXVuaXQtYWJvcnQtdGVzdHMtYnV0dG9uXCIpO1xuXG5cdCAgICBpZiAoYWJvcnRCdXR0b24pIHtcblx0ICAgICAgYWJvcnRCdXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHQgICAgICBhYm9ydEJ1dHRvbi5pbm5lckhUTUwgPSBcIkFib3J0aW5nLi4uXCI7XG5cdCAgICB9XG5cblx0ICAgIFFVbml0LmNvbmZpZy5xdWV1ZS5sZW5ndGggPSAwO1xuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGludGVyY2VwdE5hdmlnYXRpb24oZXYpIHtcblx0ICAgIGFwcGx5VXJsUGFyYW1zKCk7XG5cblx0ICAgIGlmIChldiAmJiBldi5wcmV2ZW50RGVmYXVsdCkge1xuXHQgICAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gZmFsc2U7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gZ2V0VXJsQ29uZmlnSHRtbCgpIHtcblx0ICAgIHZhciBpLFxuXHQgICAgICAgIGosXG5cdCAgICAgICAgdmFsLFxuXHQgICAgICAgIGVzY2FwZWQsXG5cdCAgICAgICAgZXNjYXBlZFRvb2x0aXAsXG5cdCAgICAgICAgc2VsZWN0aW9uID0gZmFsc2UsXG5cdCAgICAgICAgdXJsQ29uZmlnID0gY29uZmlnLnVybENvbmZpZyxcblx0ICAgICAgICB1cmxDb25maWdIdG1sID0gXCJcIjtcblxuXHQgICAgZm9yIChpID0gMDsgaSA8IHVybENvbmZpZy5sZW5ndGg7IGkrKykge1xuXHQgICAgICAvLyBPcHRpb25zIGNhbiBiZSBlaXRoZXIgc3RyaW5ncyBvciBvYmplY3RzIHdpdGggbm9uZW1wdHkgXCJpZFwiIHByb3BlcnRpZXNcblx0ICAgICAgdmFsID0gY29uZmlnLnVybENvbmZpZ1tpXTtcblxuXHQgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gXCJzdHJpbmdcIikge1xuXHQgICAgICAgIHZhbCA9IHtcblx0ICAgICAgICAgIGlkOiB2YWwsXG5cdCAgICAgICAgICBsYWJlbDogdmFsXG5cdCAgICAgICAgfTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGVzY2FwZWQgPSBlc2NhcGVUZXh0KHZhbC5pZCk7XG5cdCAgICAgIGVzY2FwZWRUb29sdGlwID0gZXNjYXBlVGV4dCh2YWwudG9vbHRpcCk7XG5cblx0ICAgICAgaWYgKCF2YWwudmFsdWUgfHwgdHlwZW9mIHZhbC52YWx1ZSA9PT0gXCJzdHJpbmdcIikge1xuXHQgICAgICAgIHVybENvbmZpZ0h0bWwgKz0gXCI8bGFiZWwgZm9yPSdxdW5pdC11cmxjb25maWctXCIgKyBlc2NhcGVkICsgXCInIHRpdGxlPSdcIiArIGVzY2FwZWRUb29sdGlwICsgXCInPjxpbnB1dCBpZD0ncXVuaXQtdXJsY29uZmlnLVwiICsgZXNjYXBlZCArIFwiJyBuYW1lPSdcIiArIGVzY2FwZWQgKyBcIicgdHlwZT0nY2hlY2tib3gnXCIgKyAodmFsLnZhbHVlID8gXCIgdmFsdWU9J1wiICsgZXNjYXBlVGV4dCh2YWwudmFsdWUpICsgXCInXCIgOiBcIlwiKSArIChjb25maWdbdmFsLmlkXSA/IFwiIGNoZWNrZWQ9J2NoZWNrZWQnXCIgOiBcIlwiKSArIFwiIHRpdGxlPSdcIiArIGVzY2FwZWRUb29sdGlwICsgXCInIC8+XCIgKyBlc2NhcGVUZXh0KHZhbC5sYWJlbCkgKyBcIjwvbGFiZWw+XCI7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgdXJsQ29uZmlnSHRtbCArPSBcIjxsYWJlbCBmb3I9J3F1bml0LXVybGNvbmZpZy1cIiArIGVzY2FwZWQgKyBcIicgdGl0bGU9J1wiICsgZXNjYXBlZFRvb2x0aXAgKyBcIic+XCIgKyB2YWwubGFiZWwgKyBcIjogPC9sYWJlbD48c2VsZWN0IGlkPSdxdW5pdC11cmxjb25maWctXCIgKyBlc2NhcGVkICsgXCInIG5hbWU9J1wiICsgZXNjYXBlZCArIFwiJyB0aXRsZT0nXCIgKyBlc2NhcGVkVG9vbHRpcCArIFwiJz48b3B0aW9uPjwvb3B0aW9uPlwiO1xuXG5cdCAgICAgICAgaWYgKFFVbml0LmlzKFwiYXJyYXlcIiwgdmFsLnZhbHVlKSkge1xuXHQgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHZhbC52YWx1ZS5sZW5ndGg7IGorKykge1xuXHQgICAgICAgICAgICBlc2NhcGVkID0gZXNjYXBlVGV4dCh2YWwudmFsdWVbal0pO1xuXHQgICAgICAgICAgICB1cmxDb25maWdIdG1sICs9IFwiPG9wdGlvbiB2YWx1ZT0nXCIgKyBlc2NhcGVkICsgXCInXCIgKyAoY29uZmlnW3ZhbC5pZF0gPT09IHZhbC52YWx1ZVtqXSA/IChzZWxlY3Rpb24gPSB0cnVlKSAmJiBcIiBzZWxlY3RlZD0nc2VsZWN0ZWQnXCIgOiBcIlwiKSArIFwiPlwiICsgZXNjYXBlZCArIFwiPC9vcHRpb24+XCI7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGZvciAoaiBpbiB2YWwudmFsdWUpIHtcblx0ICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHZhbC52YWx1ZSwgaikpIHtcblx0ICAgICAgICAgICAgICB1cmxDb25maWdIdG1sICs9IFwiPG9wdGlvbiB2YWx1ZT0nXCIgKyBlc2NhcGVUZXh0KGopICsgXCInXCIgKyAoY29uZmlnW3ZhbC5pZF0gPT09IGogPyAoc2VsZWN0aW9uID0gdHJ1ZSkgJiYgXCIgc2VsZWN0ZWQ9J3NlbGVjdGVkJ1wiIDogXCJcIikgKyBcIj5cIiArIGVzY2FwZVRleHQodmFsLnZhbHVlW2pdKSArIFwiPC9vcHRpb24+XCI7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cblx0ICAgICAgICBpZiAoY29uZmlnW3ZhbC5pZF0gJiYgIXNlbGVjdGlvbikge1xuXHQgICAgICAgICAgZXNjYXBlZCA9IGVzY2FwZVRleHQoY29uZmlnW3ZhbC5pZF0pO1xuXHQgICAgICAgICAgdXJsQ29uZmlnSHRtbCArPSBcIjxvcHRpb24gdmFsdWU9J1wiICsgZXNjYXBlZCArIFwiJyBzZWxlY3RlZD0nc2VsZWN0ZWQnIGRpc2FibGVkPSdkaXNhYmxlZCc+XCIgKyBlc2NhcGVkICsgXCI8L29wdGlvbj5cIjtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICB1cmxDb25maWdIdG1sICs9IFwiPC9zZWxlY3Q+XCI7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHVybENvbmZpZ0h0bWw7XG5cdCAgfSAvLyBIYW5kbGUgXCJjbGlja1wiIGV2ZW50cyBvbiB0b29sYmFyIGNoZWNrYm94ZXMgYW5kIFwiY2hhbmdlXCIgZm9yIHNlbGVjdCBtZW51cy5cblx0ICAvLyBVcGRhdGVzIHRoZSBVUkwgd2l0aCB0aGUgbmV3IHN0YXRlIG9mIGBjb25maWcudXJsQ29uZmlnYCB2YWx1ZXMuXG5cblxuXHQgIGZ1bmN0aW9uIHRvb2xiYXJDaGFuZ2VkKCkge1xuXHQgICAgdmFyIHVwZGF0ZWRVcmwsXG5cdCAgICAgICAgdmFsdWUsXG5cdCAgICAgICAgdGVzdHMsXG5cdCAgICAgICAgZmllbGQgPSB0aGlzLFxuXHQgICAgICAgIHBhcmFtcyA9IHt9OyAvLyBEZXRlY3QgaWYgZmllbGQgaXMgYSBzZWxlY3QgbWVudSBvciBhIGNoZWNrYm94XG5cblx0ICAgIGlmIChcInNlbGVjdGVkSW5kZXhcIiBpbiBmaWVsZCkge1xuXHQgICAgICB2YWx1ZSA9IGZpZWxkLm9wdGlvbnNbZmllbGQuc2VsZWN0ZWRJbmRleF0udmFsdWUgfHwgdW5kZWZpbmVkO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgdmFsdWUgPSBmaWVsZC5jaGVja2VkID8gZmllbGQuZGVmYXVsdFZhbHVlIHx8IHRydWUgOiB1bmRlZmluZWQ7XG5cdCAgICB9XG5cblx0ICAgIHBhcmFtc1tmaWVsZC5uYW1lXSA9IHZhbHVlO1xuXHQgICAgdXBkYXRlZFVybCA9IHNldFVybChwYXJhbXMpOyAvLyBDaGVjayBpZiB3ZSBjYW4gYXBwbHkgdGhlIGNoYW5nZSB3aXRob3V0IGEgcGFnZSByZWZyZXNoXG5cblx0ICAgIGlmIChcImhpZGVwYXNzZWRcIiA9PT0gZmllbGQubmFtZSAmJiBcInJlcGxhY2VTdGF0ZVwiIGluIHdpbmRvdyQxLmhpc3RvcnkpIHtcblx0ICAgICAgUVVuaXQudXJsUGFyYW1zW2ZpZWxkLm5hbWVdID0gdmFsdWU7XG5cdCAgICAgIGNvbmZpZ1tmaWVsZC5uYW1lXSA9IHZhbHVlIHx8IGZhbHNlO1xuXHQgICAgICB0ZXN0cyA9IGlkKFwicXVuaXQtdGVzdHNcIik7XG5cblx0ICAgICAgaWYgKHRlc3RzKSB7XG5cdCAgICAgICAgdmFyIGxlbmd0aCA9IHRlc3RzLmNoaWxkcmVuLmxlbmd0aDtcblx0ICAgICAgICB2YXIgY2hpbGRyZW4gPSB0ZXN0cy5jaGlsZHJlbjtcblxuXHQgICAgICAgIGlmIChmaWVsZC5jaGVja2VkKSB7XG5cdCAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICAgIHZhciB0ZXN0ID0gY2hpbGRyZW5baV07XG5cdCAgICAgICAgICAgIHZhciBjbGFzc05hbWUgPSB0ZXN0ID8gdGVzdC5jbGFzc05hbWUgOiBcIlwiO1xuXHQgICAgICAgICAgICB2YXIgY2xhc3NOYW1lSGFzUGFzcyA9IGNsYXNzTmFtZS5pbmRleE9mKFwicGFzc1wiKSA+IC0xO1xuXHQgICAgICAgICAgICB2YXIgY2xhc3NOYW1lSGFzU2tpcHBlZCA9IGNsYXNzTmFtZS5pbmRleE9mKFwic2tpcHBlZFwiKSA+IC0xO1xuXG5cdCAgICAgICAgICAgIGlmIChjbGFzc05hbWVIYXNQYXNzIHx8IGNsYXNzTmFtZUhhc1NraXBwZWQpIHtcblx0ICAgICAgICAgICAgICBoaWRkZW5UZXN0cy5wdXNoKHRlc3QpO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIHZhciBfaXRlcmF0b3IgPSBfY3JlYXRlRm9yT2ZJdGVyYXRvckhlbHBlcihoaWRkZW5UZXN0cyksXG5cdCAgICAgICAgICAgICAgX3N0ZXA7XG5cblx0ICAgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICAgIGZvciAoX2l0ZXJhdG9yLnMoKTsgIShfc3RlcCA9IF9pdGVyYXRvci5uKCkpLmRvbmU7KSB7XG5cdCAgICAgICAgICAgICAgdmFyIGhpZGRlblRlc3QgPSBfc3RlcC52YWx1ZTtcblx0ICAgICAgICAgICAgICB0ZXN0cy5yZW1vdmVDaGlsZChoaWRkZW5UZXN0KTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG5cdCAgICAgICAgICAgIF9pdGVyYXRvci5lKGVycik7XG5cdCAgICAgICAgICB9IGZpbmFsbHkge1xuXHQgICAgICAgICAgICBfaXRlcmF0b3IuZigpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICB3aGlsZSAoKHRlc3QgPSBoaWRkZW5UZXN0cy5wb3AoKSkgIT0gbnVsbCkge1xuXHQgICAgICAgICAgICB0ZXN0cy5hcHBlbmRDaGlsZCh0ZXN0KTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICB3aW5kb3ckMS5oaXN0b3J5LnJlcGxhY2VTdGF0ZShudWxsLCBcIlwiLCB1cGRhdGVkVXJsKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHdpbmRvdyQxLmxvY2F0aW9uID0gdXBkYXRlZFVybDtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiBzZXRVcmwocGFyYW1zKSB7XG5cdCAgICB2YXIga2V5LFxuXHQgICAgICAgIGFyclZhbHVlLFxuXHQgICAgICAgIGksXG5cdCAgICAgICAgcXVlcnlzdHJpbmcgPSBcIj9cIixcblx0ICAgICAgICBsb2NhdGlvbiA9IHdpbmRvdyQxLmxvY2F0aW9uO1xuXHQgICAgcGFyYW1zID0gUVVuaXQuZXh0ZW5kKFFVbml0LmV4dGVuZCh7fSwgUVVuaXQudXJsUGFyYW1zKSwgcGFyYW1zKTtcblxuXHQgICAgZm9yIChrZXkgaW4gcGFyYW1zKSB7XG5cdCAgICAgIC8vIFNraXAgaW5oZXJpdGVkIG9yIHVuZGVmaW5lZCBwcm9wZXJ0aWVzXG5cdCAgICAgIGlmIChoYXNPd24uY2FsbChwYXJhbXMsIGtleSkgJiYgcGFyYW1zW2tleV0gIT09IHVuZGVmaW5lZCkge1xuXHQgICAgICAgIC8vIE91dHB1dCBhIHBhcmFtZXRlciBmb3IgZWFjaCB2YWx1ZSBvZiB0aGlzIGtleVxuXHQgICAgICAgIC8vIChidXQgdXN1YWxseSBqdXN0IG9uZSlcblx0ICAgICAgICBhcnJWYWx1ZSA9IFtdLmNvbmNhdChwYXJhbXNba2V5XSk7XG5cblx0ICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYXJyVmFsdWUubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgIHF1ZXJ5c3RyaW5nICs9IGVuY29kZVVSSUNvbXBvbmVudChrZXkpO1xuXG5cdCAgICAgICAgICBpZiAoYXJyVmFsdWVbaV0gIT09IHRydWUpIHtcblx0ICAgICAgICAgICAgcXVlcnlzdHJpbmcgKz0gXCI9XCIgKyBlbmNvZGVVUklDb21wb25lbnQoYXJyVmFsdWVbaV0pO1xuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICBxdWVyeXN0cmluZyArPSBcIiZcIjtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGxvY2F0aW9uLnByb3RvY29sICsgXCIvL1wiICsgbG9jYXRpb24uaG9zdCArIGxvY2F0aW9uLnBhdGhuYW1lICsgcXVlcnlzdHJpbmcuc2xpY2UoMCwgLTEpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFwcGx5VXJsUGFyYW1zKCkge1xuXHQgICAgdmFyIGksXG5cdCAgICAgICAgc2VsZWN0ZWRNb2R1bGVzID0gW10sXG5cdCAgICAgICAgbW9kdWxlc0xpc3QgPSBpZChcInF1bml0LW1vZHVsZWZpbHRlci1kcm9wZG93bi1saXN0XCIpLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiaW5wdXRcIiksXG5cdCAgICAgICAgZmlsdGVyID0gaWQoXCJxdW5pdC1maWx0ZXItaW5wdXRcIikudmFsdWU7XG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCBtb2R1bGVzTGlzdC5sZW5ndGg7IGkrKykge1xuXHQgICAgICBpZiAobW9kdWxlc0xpc3RbaV0uY2hlY2tlZCkge1xuXHQgICAgICAgIHNlbGVjdGVkTW9kdWxlcy5wdXNoKG1vZHVsZXNMaXN0W2ldLnZhbHVlKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICB3aW5kb3ckMS5sb2NhdGlvbiA9IHNldFVybCh7XG5cdCAgICAgIGZpbHRlcjogZmlsdGVyID09PSBcIlwiID8gdW5kZWZpbmVkIDogZmlsdGVyLFxuXHQgICAgICBtb2R1bGVJZDogc2VsZWN0ZWRNb2R1bGVzLmxlbmd0aCA9PT0gMCA/IHVuZGVmaW5lZCA6IHNlbGVjdGVkTW9kdWxlcyxcblx0ICAgICAgLy8gUmVtb3ZlIG1vZHVsZSBhbmQgdGVzdElkIGZpbHRlclxuXHQgICAgICBtb2R1bGU6IHVuZGVmaW5lZCxcblx0ICAgICAgdGVzdElkOiB1bmRlZmluZWRcblx0ICAgIH0pO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHRvb2xiYXJVcmxDb25maWdDb250YWluZXIoKSB7XG5cdCAgICB2YXIgdXJsQ29uZmlnQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG5cdCAgICB1cmxDb25maWdDb250YWluZXIuaW5uZXJIVE1MID0gZ2V0VXJsQ29uZmlnSHRtbCgpO1xuXHQgICAgYWRkQ2xhc3ModXJsQ29uZmlnQ29udGFpbmVyLCBcInF1bml0LXVybC1jb25maWdcIik7XG5cdCAgICBhZGRFdmVudHModXJsQ29uZmlnQ29udGFpbmVyLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiaW5wdXRcIiksIFwiY2hhbmdlXCIsIHRvb2xiYXJDaGFuZ2VkKTtcblx0ICAgIGFkZEV2ZW50cyh1cmxDb25maWdDb250YWluZXIuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJzZWxlY3RcIiksIFwiY2hhbmdlXCIsIHRvb2xiYXJDaGFuZ2VkKTtcblx0ICAgIHJldHVybiB1cmxDb25maWdDb250YWluZXI7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYWJvcnRUZXN0c0J1dHRvbigpIHtcblx0ICAgIHZhciBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuXHQgICAgYnV0dG9uLmlkID0gXCJxdW5pdC1hYm9ydC10ZXN0cy1idXR0b25cIjtcblx0ICAgIGJ1dHRvbi5pbm5lckhUTUwgPSBcIkFib3J0XCI7XG5cdCAgICBhZGRFdmVudChidXR0b24sIFwiY2xpY2tcIiwgYWJvcnRUZXN0cyk7XG5cdCAgICByZXR1cm4gYnV0dG9uO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHRvb2xiYXJMb29zZUZpbHRlcigpIHtcblx0ICAgIHZhciBmaWx0ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZm9ybVwiKSxcblx0ICAgICAgICBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsYWJlbFwiKSxcblx0ICAgICAgICBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKSxcblx0ICAgICAgICBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuXHQgICAgYWRkQ2xhc3MoZmlsdGVyLCBcInF1bml0LWZpbHRlclwiKTtcblx0ICAgIGxhYmVsLmlubmVySFRNTCA9IFwiRmlsdGVyOiBcIjtcblx0ICAgIGlucHV0LnR5cGUgPSBcInRleHRcIjtcblx0ICAgIGlucHV0LnZhbHVlID0gY29uZmlnLmZpbHRlciB8fCBcIlwiO1xuXHQgICAgaW5wdXQubmFtZSA9IFwiZmlsdGVyXCI7XG5cdCAgICBpbnB1dC5pZCA9IFwicXVuaXQtZmlsdGVyLWlucHV0XCI7XG5cdCAgICBidXR0b24uaW5uZXJIVE1MID0gXCJHb1wiO1xuXHQgICAgbGFiZWwuYXBwZW5kQ2hpbGQoaW5wdXQpO1xuXHQgICAgZmlsdGVyLmFwcGVuZENoaWxkKGxhYmVsKTtcblx0ICAgIGZpbHRlci5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIiBcIikpO1xuXHQgICAgZmlsdGVyLmFwcGVuZENoaWxkKGJ1dHRvbik7XG5cdCAgICBhZGRFdmVudChmaWx0ZXIsIFwic3VibWl0XCIsIGludGVyY2VwdE5hdmlnYXRpb24pO1xuXHQgICAgcmV0dXJuIGZpbHRlcjtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBtb2R1bGVMaXN0SHRtbChtb2R1bGVzKSB7XG5cdCAgICB2YXIgaSxcblx0ICAgICAgICBjaGVja2VkLFxuXHQgICAgICAgIGh0bWwgPSBcIlwiO1xuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgbW9kdWxlcy5sZW5ndGg7IGkrKykge1xuXHQgICAgICBpZiAobW9kdWxlc1tpXS5uYW1lICE9PSBcIlwiKSB7XG5cdCAgICAgICAgY2hlY2tlZCA9IGNvbmZpZy5tb2R1bGVJZC5pbmRleE9mKG1vZHVsZXNbaV0ubW9kdWxlSWQpID4gLTE7XG5cdCAgICAgICAgaHRtbCArPSBcIjxsaT48bGFiZWwgY2xhc3M9J2NsaWNrYWJsZVwiICsgKGNoZWNrZWQgPyBcIiBjaGVja2VkXCIgOiBcIlwiKSArIFwiJz48aW5wdXQgdHlwZT0nY2hlY2tib3gnIFwiICsgXCJ2YWx1ZT0nXCIgKyBtb2R1bGVzW2ldLm1vZHVsZUlkICsgXCInXCIgKyAoY2hlY2tlZCA/IFwiIGNoZWNrZWQ9J2NoZWNrZWQnXCIgOiBcIlwiKSArIFwiIC8+XCIgKyBlc2NhcGVUZXh0KG1vZHVsZXNbaV0ubmFtZSkgKyBcIjwvbGFiZWw+PC9saT5cIjtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gaHRtbDtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiB0b29sYmFyTW9kdWxlRmlsdGVyKCkge1xuXHQgICAgdmFyIGNvbW1pdCxcblx0ICAgICAgICByZXNldCxcblx0ICAgICAgICBtb2R1bGVGaWx0ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZm9ybVwiKSxcblx0ICAgICAgICBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsYWJlbFwiKSxcblx0ICAgICAgICBtb2R1bGVTZWFyY2ggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW5wdXRcIiksXG5cdCAgICAgICAgZHJvcERvd24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpLFxuXHQgICAgICAgIGFjdGlvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKSxcblx0ICAgICAgICBhcHBseUJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIiksXG5cdCAgICAgICAgcmVzZXRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpLFxuXHQgICAgICAgIGFsbE1vZHVsZXNMYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsYWJlbFwiKSxcblx0ICAgICAgICBhbGxDaGVja2JveCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKSxcblx0ICAgICAgICBkcm9wRG93bkxpc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidWxcIiksXG5cdCAgICAgICAgZGlydHkgPSBmYWxzZTtcblx0ICAgIG1vZHVsZVNlYXJjaC5pZCA9IFwicXVuaXQtbW9kdWxlZmlsdGVyLXNlYXJjaFwiO1xuXHQgICAgbW9kdWxlU2VhcmNoLmF1dG9jb21wbGV0ZSA9IFwib2ZmXCI7XG5cdCAgICBhZGRFdmVudChtb2R1bGVTZWFyY2gsIFwiaW5wdXRcIiwgc2VhcmNoSW5wdXQpO1xuXHQgICAgYWRkRXZlbnQobW9kdWxlU2VhcmNoLCBcImlucHV0XCIsIHNlYXJjaEZvY3VzKTtcblx0ICAgIGFkZEV2ZW50KG1vZHVsZVNlYXJjaCwgXCJmb2N1c1wiLCBzZWFyY2hGb2N1cyk7XG5cdCAgICBhZGRFdmVudChtb2R1bGVTZWFyY2gsIFwiY2xpY2tcIiwgc2VhcmNoRm9jdXMpO1xuXHQgICAgY29uZmlnLm1vZHVsZXMuZm9yRWFjaChmdW5jdGlvbiAobW9kdWxlKSB7XG5cdCAgICAgIHJldHVybiBtb2R1bGUubmFtZVByZXBhcmVkID0gZnV6enlzb3J0LnByZXBhcmUobW9kdWxlLm5hbWUpO1xuXHQgICAgfSk7XG5cdCAgICBsYWJlbC5pZCA9IFwicXVuaXQtbW9kdWxlZmlsdGVyLXNlYXJjaC1jb250YWluZXJcIjtcblx0ICAgIGxhYmVsLmlubmVySFRNTCA9IFwiTW9kdWxlOiBcIjtcblx0ICAgIGxhYmVsLmFwcGVuZENoaWxkKG1vZHVsZVNlYXJjaCk7XG5cdCAgICBhcHBseUJ1dHRvbi50ZXh0Q29udGVudCA9IFwiQXBwbHlcIjtcblx0ICAgIGFwcGx5QnV0dG9uLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0ICAgIHJlc2V0QnV0dG9uLnRleHRDb250ZW50ID0gXCJSZXNldFwiO1xuXHQgICAgcmVzZXRCdXR0b24udHlwZSA9IFwicmVzZXRcIjtcblx0ICAgIHJlc2V0QnV0dG9uLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0ICAgIGFsbENoZWNrYm94LnR5cGUgPSBcImNoZWNrYm94XCI7XG5cdCAgICBhbGxDaGVja2JveC5jaGVja2VkID0gY29uZmlnLm1vZHVsZUlkLmxlbmd0aCA9PT0gMDtcblx0ICAgIGFsbE1vZHVsZXNMYWJlbC5jbGFzc05hbWUgPSBcImNsaWNrYWJsZVwiO1xuXG5cdCAgICBpZiAoY29uZmlnLm1vZHVsZUlkLmxlbmd0aCkge1xuXHQgICAgICBhbGxNb2R1bGVzTGFiZWwuY2xhc3NOYW1lID0gXCJjaGVja2VkXCI7XG5cdCAgICB9XG5cblx0ICAgIGFsbE1vZHVsZXNMYWJlbC5hcHBlbmRDaGlsZChhbGxDaGVja2JveCk7XG5cdCAgICBhbGxNb2R1bGVzTGFiZWwuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJBbGwgbW9kdWxlc1wiKSk7XG5cdCAgICBhY3Rpb25zLmlkID0gXCJxdW5pdC1tb2R1bGVmaWx0ZXItYWN0aW9uc1wiO1xuXHQgICAgYWN0aW9ucy5hcHBlbmRDaGlsZChhcHBseUJ1dHRvbik7XG5cdCAgICBhY3Rpb25zLmFwcGVuZENoaWxkKHJlc2V0QnV0dG9uKTtcblx0ICAgIGFjdGlvbnMuYXBwZW5kQ2hpbGQoYWxsTW9kdWxlc0xhYmVsKTtcblx0ICAgIGNvbW1pdCA9IGFjdGlvbnMuZmlyc3RDaGlsZDtcblx0ICAgIHJlc2V0ID0gY29tbWl0Lm5leHRTaWJsaW5nO1xuXHQgICAgYWRkRXZlbnQoY29tbWl0LCBcImNsaWNrXCIsIGFwcGx5VXJsUGFyYW1zKTtcblx0ICAgIGRyb3BEb3duTGlzdC5pZCA9IFwicXVuaXQtbW9kdWxlZmlsdGVyLWRyb3Bkb3duLWxpc3RcIjtcblx0ICAgIGRyb3BEb3duTGlzdC5pbm5lckhUTUwgPSBtb2R1bGVMaXN0SHRtbChjb25maWcubW9kdWxlcyk7XG5cdCAgICBkcm9wRG93bi5pZCA9IFwicXVuaXQtbW9kdWxlZmlsdGVyLWRyb3Bkb3duXCI7XG5cdCAgICBkcm9wRG93bi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdCAgICBkcm9wRG93bi5hcHBlbmRDaGlsZChhY3Rpb25zKTtcblx0ICAgIGRyb3BEb3duLmFwcGVuZENoaWxkKGRyb3BEb3duTGlzdCk7XG5cdCAgICBhZGRFdmVudChkcm9wRG93biwgXCJjaGFuZ2VcIiwgc2VsZWN0aW9uQ2hhbmdlKTtcblx0ICAgIHNlbGVjdGlvbkNoYW5nZSgpO1xuXHQgICAgbW9kdWxlRmlsdGVyLmlkID0gXCJxdW5pdC1tb2R1bGVmaWx0ZXJcIjtcblx0ICAgIG1vZHVsZUZpbHRlci5hcHBlbmRDaGlsZChsYWJlbCk7XG5cdCAgICBtb2R1bGVGaWx0ZXIuYXBwZW5kQ2hpbGQoZHJvcERvd24pO1xuXHQgICAgYWRkRXZlbnQobW9kdWxlRmlsdGVyLCBcInN1Ym1pdFwiLCBpbnRlcmNlcHROYXZpZ2F0aW9uKTtcblx0ICAgIGFkZEV2ZW50KG1vZHVsZUZpbHRlciwgXCJyZXNldFwiLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIC8vIExldCB0aGUgcmVzZXQgaGFwcGVuLCB0aGVuIHVwZGF0ZSBzdHlsZXNcblx0ICAgICAgd2luZG93JDEuc2V0VGltZW91dChzZWxlY3Rpb25DaGFuZ2UpO1xuXHQgICAgfSk7IC8vIEVuYWJsZXMgc2hvdy9oaWRlIGZvciB0aGUgZHJvcGRvd25cblxuXHQgICAgZnVuY3Rpb24gc2VhcmNoRm9jdXMoKSB7XG5cdCAgICAgIGlmIChkcm9wRG93bi5zdHlsZS5kaXNwbGF5ICE9PSBcIm5vbmVcIikge1xuXHQgICAgICAgIHJldHVybjtcblx0ICAgICAgfVxuXG5cdCAgICAgIGRyb3BEb3duLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG5cdCAgICAgIGFkZEV2ZW50KGRvY3VtZW50LCBcImNsaWNrXCIsIGhpZGVIYW5kbGVyKTtcblx0ICAgICAgYWRkRXZlbnQoZG9jdW1lbnQsIFwia2V5ZG93blwiLCBoaWRlSGFuZGxlcik7IC8vIEhpZGUgb24gRXNjYXBlIGtleWRvd24gb3Igb3V0c2lkZS1jb250YWluZXIgY2xpY2tcblxuXHQgICAgICBmdW5jdGlvbiBoaWRlSGFuZGxlcihlKSB7XG5cdCAgICAgICAgdmFyIGluQ29udGFpbmVyID0gbW9kdWxlRmlsdGVyLmNvbnRhaW5zKGUudGFyZ2V0KTtcblxuXHQgICAgICAgIGlmIChlLmtleUNvZGUgPT09IDI3IHx8ICFpbkNvbnRhaW5lcikge1xuXHQgICAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMjcgJiYgaW5Db250YWluZXIpIHtcblx0ICAgICAgICAgICAgbW9kdWxlU2VhcmNoLmZvY3VzKCk7XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIGRyb3BEb3duLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0ICAgICAgICAgIHJlbW92ZUV2ZW50KGRvY3VtZW50LCBcImNsaWNrXCIsIGhpZGVIYW5kbGVyKTtcblx0ICAgICAgICAgIHJlbW92ZUV2ZW50KGRvY3VtZW50LCBcImtleWRvd25cIiwgaGlkZUhhbmRsZXIpO1xuXHQgICAgICAgICAgbW9kdWxlU2VhcmNoLnZhbHVlID0gXCJcIjtcblx0ICAgICAgICAgIHNlYXJjaElucHV0KCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGZpbHRlck1vZHVsZXMoc2VhcmNoVGV4dCkge1xuXHQgICAgICBpZiAoc2VhcmNoVGV4dCA9PT0gXCJcIikge1xuXHQgICAgICAgIHJldHVybiBjb25maWcubW9kdWxlcztcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBmdXp6eXNvcnQuZ28oc2VhcmNoVGV4dCwgY29uZmlnLm1vZHVsZXMsIHtcblx0ICAgICAgICBrZXk6IFwibmFtZVByZXBhcmVkXCIsXG5cdCAgICAgICAgdGhyZXNob2xkOiAtMTAwMDBcblx0ICAgICAgfSkubWFwKGZ1bmN0aW9uIChtb2R1bGUpIHtcblx0ICAgICAgICByZXR1cm4gbW9kdWxlLm9iajtcblx0ICAgICAgfSk7XG5cdCAgICB9IC8vIFByb2Nlc3NlcyBtb2R1bGUgc2VhcmNoIGJveCBpbnB1dFxuXG5cblx0ICAgIHZhciBzZWFyY2hJbnB1dFRpbWVvdXQ7XG5cblx0ICAgIGZ1bmN0aW9uIHNlYXJjaElucHV0KCkge1xuXHQgICAgICB3aW5kb3ckMS5jbGVhclRpbWVvdXQoc2VhcmNoSW5wdXRUaW1lb3V0KTtcblx0ICAgICAgc2VhcmNoSW5wdXRUaW1lb3V0ID0gd2luZG93JDEuc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgdmFyIHNlYXJjaFRleHQgPSBtb2R1bGVTZWFyY2gudmFsdWUudG9Mb3dlckNhc2UoKSxcblx0ICAgICAgICAgICAgZmlsdGVyZWRNb2R1bGVzID0gZmlsdGVyTW9kdWxlcyhzZWFyY2hUZXh0KTtcblx0ICAgICAgICBkcm9wRG93bkxpc3QuaW5uZXJIVE1MID0gbW9kdWxlTGlzdEh0bWwoZmlsdGVyZWRNb2R1bGVzKTtcblx0ICAgICAgfSwgMjAwKTtcblx0ICAgIH0gLy8gUHJvY2Vzc2VzIHNlbGVjdGlvbiBjaGFuZ2VzXG5cblxuXHQgICAgZnVuY3Rpb24gc2VsZWN0aW9uQ2hhbmdlKGV2dCkge1xuXHQgICAgICB2YXIgaSxcblx0ICAgICAgICAgIGl0ZW0sXG5cdCAgICAgICAgICBjaGVja2JveCA9IGV2dCAmJiBldnQudGFyZ2V0IHx8IGFsbENoZWNrYm94LFxuXHQgICAgICAgICAgbW9kdWxlc0xpc3QgPSBkcm9wRG93bkxpc3QuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJpbnB1dFwiKSxcblx0ICAgICAgICAgIHNlbGVjdGVkTmFtZXMgPSBbXTtcblx0ICAgICAgdG9nZ2xlQ2xhc3MoY2hlY2tib3gucGFyZW50Tm9kZSwgXCJjaGVja2VkXCIsIGNoZWNrYm94LmNoZWNrZWQpO1xuXHQgICAgICBkaXJ0eSA9IGZhbHNlO1xuXG5cdCAgICAgIGlmIChjaGVja2JveC5jaGVja2VkICYmIGNoZWNrYm94ICE9PSBhbGxDaGVja2JveCkge1xuXHQgICAgICAgIGFsbENoZWNrYm94LmNoZWNrZWQgPSBmYWxzZTtcblx0ICAgICAgICByZW1vdmVDbGFzcyhhbGxDaGVja2JveC5wYXJlbnROb2RlLCBcImNoZWNrZWRcIik7XG5cdCAgICAgIH1cblxuXHQgICAgICBmb3IgKGkgPSAwOyBpIDwgbW9kdWxlc0xpc3QubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICBpdGVtID0gbW9kdWxlc0xpc3RbaV07XG5cblx0ICAgICAgICBpZiAoIWV2dCkge1xuXHQgICAgICAgICAgdG9nZ2xlQ2xhc3MoaXRlbS5wYXJlbnROb2RlLCBcImNoZWNrZWRcIiwgaXRlbS5jaGVja2VkKTtcblx0ICAgICAgICB9IGVsc2UgaWYgKGNoZWNrYm94ID09PSBhbGxDaGVja2JveCAmJiBjaGVja2JveC5jaGVja2VkKSB7XG5cdCAgICAgICAgICBpdGVtLmNoZWNrZWQgPSBmYWxzZTtcblx0ICAgICAgICAgIHJlbW92ZUNsYXNzKGl0ZW0ucGFyZW50Tm9kZSwgXCJjaGVja2VkXCIpO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGRpcnR5ID0gZGlydHkgfHwgaXRlbS5jaGVja2VkICE9PSBpdGVtLmRlZmF1bHRDaGVja2VkO1xuXG5cdCAgICAgICAgaWYgKGl0ZW0uY2hlY2tlZCkge1xuXHQgICAgICAgICAgc2VsZWN0ZWROYW1lcy5wdXNoKGl0ZW0ucGFyZW50Tm9kZS50ZXh0Q29udGVudCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgY29tbWl0LnN0eWxlLmRpc3BsYXkgPSByZXNldC5zdHlsZS5kaXNwbGF5ID0gZGlydHkgPyBcIlwiIDogXCJub25lXCI7XG5cdCAgICAgIG1vZHVsZVNlYXJjaC5wbGFjZWhvbGRlciA9IHNlbGVjdGVkTmFtZXMuam9pbihcIiwgXCIpIHx8IGFsbENoZWNrYm94LnBhcmVudE5vZGUudGV4dENvbnRlbnQ7XG5cdCAgICAgIG1vZHVsZVNlYXJjaC50aXRsZSA9IFwiVHlwZSB0byBmaWx0ZXIgbGlzdC4gQ3VycmVudCBzZWxlY3Rpb246XFxuXCIgKyAoc2VsZWN0ZWROYW1lcy5qb2luKFwiXFxuXCIpIHx8IGFsbENoZWNrYm94LnBhcmVudE5vZGUudGV4dENvbnRlbnQpO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gbW9kdWxlRmlsdGVyO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHRvb2xiYXJGaWx0ZXJzKCkge1xuXHQgICAgdmFyIHRvb2xiYXJGaWx0ZXJzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG5cdCAgICB0b29sYmFyRmlsdGVycy5pZCA9IFwicXVuaXQtdG9vbGJhci1maWx0ZXJzXCI7XG5cdCAgICB0b29sYmFyRmlsdGVycy5hcHBlbmRDaGlsZCh0b29sYmFyTG9vc2VGaWx0ZXIoKSk7XG5cdCAgICB0b29sYmFyRmlsdGVycy5hcHBlbmRDaGlsZCh0b29sYmFyTW9kdWxlRmlsdGVyKCkpO1xuXHQgICAgcmV0dXJuIHRvb2xiYXJGaWx0ZXJzO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFwcGVuZFRvb2xiYXIoKSB7XG5cdCAgICB2YXIgdG9vbGJhciA9IGlkKFwicXVuaXQtdGVzdHJ1bm5lci10b29sYmFyXCIpO1xuXG5cdCAgICBpZiAodG9vbGJhcikge1xuXHQgICAgICB0b29sYmFyLmFwcGVuZENoaWxkKHRvb2xiYXJVcmxDb25maWdDb250YWluZXIoKSk7XG5cdCAgICAgIHRvb2xiYXIuYXBwZW5kQ2hpbGQodG9vbGJhckZpbHRlcnMoKSk7XG5cdCAgICAgIHRvb2xiYXIuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKSkuY2xhc3NOYW1lID0gXCJjbGVhcmZpeFwiO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFwcGVuZEhlYWRlcigpIHtcblx0ICAgIHZhciBoZWFkZXIgPSBpZChcInF1bml0LWhlYWRlclwiKTtcblxuXHQgICAgaWYgKGhlYWRlcikge1xuXHQgICAgICBoZWFkZXIuaW5uZXJIVE1MID0gXCI8YSBocmVmPSdcIiArIGVzY2FwZVRleHQodW5maWx0ZXJlZFVybCkgKyBcIic+XCIgKyBoZWFkZXIuaW5uZXJIVE1MICsgXCI8L2E+IFwiO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFwcGVuZEJhbm5lcigpIHtcblx0ICAgIHZhciBiYW5uZXIgPSBpZChcInF1bml0LWJhbm5lclwiKTtcblxuXHQgICAgaWYgKGJhbm5lcikge1xuXHQgICAgICBiYW5uZXIuY2xhc3NOYW1lID0gXCJcIjtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhcHBlbmRUZXN0UmVzdWx0cygpIHtcblx0ICAgIHZhciB0ZXN0cyA9IGlkKFwicXVuaXQtdGVzdHNcIiksXG5cdCAgICAgICAgcmVzdWx0ID0gaWQoXCJxdW5pdC10ZXN0cmVzdWx0XCIpLFxuXHQgICAgICAgIGNvbnRyb2xzO1xuXG5cdCAgICBpZiAocmVzdWx0KSB7XG5cdCAgICAgIHJlc3VsdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHJlc3VsdCk7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0ZXN0cykge1xuXHQgICAgICB0ZXN0cy5pbm5lckhUTUwgPSBcIlwiO1xuXHQgICAgICByZXN1bHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwicFwiKTtcblx0ICAgICAgcmVzdWx0LmlkID0gXCJxdW5pdC10ZXN0cmVzdWx0XCI7XG5cdCAgICAgIHJlc3VsdC5jbGFzc05hbWUgPSBcInJlc3VsdFwiO1xuXHQgICAgICB0ZXN0cy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZXN1bHQsIHRlc3RzKTtcblx0ICAgICAgcmVzdWx0LmlubmVySFRNTCA9IFwiPGRpdiBpZD1cXFwicXVuaXQtdGVzdHJlc3VsdC1kaXNwbGF5XFxcIj5SdW5uaW5nLi4uPGJyIC8+JiMxNjA7PC9kaXY+XCIgKyBcIjxkaXYgaWQ9XFxcInF1bml0LXRlc3RyZXN1bHQtY29udHJvbHNcXFwiPjwvZGl2PlwiICsgXCI8ZGl2IGNsYXNzPVxcXCJjbGVhcmZpeFxcXCI+PC9kaXY+XCI7XG5cdCAgICAgIGNvbnRyb2xzID0gaWQoXCJxdW5pdC10ZXN0cmVzdWx0LWNvbnRyb2xzXCIpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY29udHJvbHMpIHtcblx0ICAgICAgY29udHJvbHMuYXBwZW5kQ2hpbGQoYWJvcnRUZXN0c0J1dHRvbigpKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhcHBlbmRGaWx0ZXJlZFRlc3QoKSB7XG5cdCAgICB2YXIgdGVzdElkID0gUVVuaXQuY29uZmlnLnRlc3RJZDtcblxuXHQgICAgaWYgKCF0ZXN0SWQgfHwgdGVzdElkLmxlbmd0aCA8PSAwKSB7XG5cdCAgICAgIHJldHVybiBcIlwiO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gXCI8ZGl2IGlkPSdxdW5pdC1maWx0ZXJlZFRlc3QnPlJlcnVubmluZyBzZWxlY3RlZCB0ZXN0czogXCIgKyBlc2NhcGVUZXh0KHRlc3RJZC5qb2luKFwiLCBcIikpICsgXCIgPGEgaWQ9J3F1bml0LWNsZWFyRmlsdGVyJyBocmVmPSdcIiArIGVzY2FwZVRleHQodW5maWx0ZXJlZFVybCkgKyBcIic+UnVuIGFsbCB0ZXN0czwvYT48L2Rpdj5cIjtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhcHBlbmRVc2VyQWdlbnQoKSB7XG5cdCAgICB2YXIgdXNlckFnZW50ID0gaWQoXCJxdW5pdC11c2VyQWdlbnRcIik7XG5cblx0ICAgIGlmICh1c2VyQWdlbnQpIHtcblx0ICAgICAgdXNlckFnZW50LmlubmVySFRNTCA9IFwiXCI7XG5cdCAgICAgIHVzZXJBZ2VudC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlFVbml0IFwiICsgUVVuaXQudmVyc2lvbiArIFwiOyBcIiArIG5hdmlnYXRvci51c2VyQWdlbnQpKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhcHBlbmRJbnRlcmZhY2UoKSB7XG5cdCAgICB2YXIgcXVuaXQgPSBpZChcInF1bml0XCIpOyAvLyBGb3IgY29tcGF0IHdpdGggUVVuaXQgMS4yLCBhbmQgdG8gc3VwcG9ydCBmdWxseSBjdXN0b20gdGhlbWUgSFRNTCxcblx0ICAgIC8vIHdlIHdpbGwgdXNlIGFueSBleGlzdGluZyBlbGVtZW50cyBpZiBubyBpZD1cInF1bml0XCIgZWxlbWVudCBleGlzdHMuXG5cdCAgICAvL1xuXHQgICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IGZhaWwgb3IgZmFsbGJhY2sgdG8gY3JlYXRpbmcgaXQgb3Vyc2VsdmVzLFxuXHQgICAgLy8gYmVjYXVzZSBub3QgaGF2aW5nIGlkPVwicXVuaXRcIiAoYW5kIG5vdCBoYXZpbmcgdGhlIGJlbG93IGVsZW1lbnRzKVxuXHQgICAgLy8gc2ltcGx5IG1lYW5zIFFVbml0IGFjdHMgaGVhZGxlc3MsIGFsbG93aW5nIHVzZXJzIHRvIHVzZSB0aGVpciBvd25cblx0ICAgIC8vIHJlcG9ydGVycywgb3IgZm9yIGEgdGVzdCBydW5uZXIgdG8gbGlzdGVuIGZvciBldmVudHMgZGlyZWN0bHkgd2l0aG91dFxuXHQgICAgLy8gaGF2aW5nIHRoZSBIVE1MIHJlcG9ydGVyIGFjdGl2ZWx5IHJlbmRlciBhbnl0aGluZy5cblxuXHQgICAgaWYgKHF1bml0KSB7XG5cdCAgICAgIC8vIFNpbmNlIFFVbml0IDEuMywgdGhlc2UgYXJlIGNyZWF0ZWQgYXV0b21hdGljYWxseSBpZiB0aGUgcGFnZVxuXHQgICAgICAvLyBjb250YWlucyBpZD1cInF1bml0XCIuXG5cdCAgICAgIHF1bml0LmlubmVySFRNTCA9IFwiPGgxIGlkPSdxdW5pdC1oZWFkZXInPlwiICsgZXNjYXBlVGV4dChkb2N1bWVudC50aXRsZSkgKyBcIjwvaDE+XCIgKyBcIjxoMiBpZD0ncXVuaXQtYmFubmVyJz48L2gyPlwiICsgXCI8ZGl2IGlkPSdxdW5pdC10ZXN0cnVubmVyLXRvb2xiYXInPjwvZGl2PlwiICsgYXBwZW5kRmlsdGVyZWRUZXN0KCkgKyBcIjxoMiBpZD0ncXVuaXQtdXNlckFnZW50Jz48L2gyPlwiICsgXCI8b2wgaWQ9J3F1bml0LXRlc3RzJz48L29sPlwiO1xuXHQgICAgfVxuXG5cdCAgICBhcHBlbmRIZWFkZXIoKTtcblx0ICAgIGFwcGVuZEJhbm5lcigpO1xuXHQgICAgYXBwZW5kVGVzdFJlc3VsdHMoKTtcblx0ICAgIGFwcGVuZFVzZXJBZ2VudCgpO1xuXHQgICAgYXBwZW5kVG9vbGJhcigpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFwcGVuZFRlc3QobmFtZSwgdGVzdElkLCBtb2R1bGVOYW1lKSB7XG5cdCAgICB2YXIgdGl0bGUsXG5cdCAgICAgICAgcmVydW5UcmlnZ2VyLFxuXHQgICAgICAgIHRlc3RCbG9jayxcblx0ICAgICAgICBhc3NlcnRMaXN0LFxuXHQgICAgICAgIHRlc3RzID0gaWQoXCJxdW5pdC10ZXN0c1wiKTtcblxuXHQgICAgaWYgKCF0ZXN0cykge1xuXHQgICAgICByZXR1cm47XG5cdCAgICB9XG5cblx0ICAgIHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0cm9uZ1wiKTtcblx0ICAgIHRpdGxlLmlubmVySFRNTCA9IGdldE5hbWVIdG1sKG5hbWUsIG1vZHVsZU5hbWUpO1xuXHQgICAgcmVydW5UcmlnZ2VyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XG5cdCAgICByZXJ1blRyaWdnZXIuaW5uZXJIVE1MID0gXCJSZXJ1blwiO1xuXHQgICAgcmVydW5UcmlnZ2VyLmhyZWYgPSBzZXRVcmwoe1xuXHQgICAgICB0ZXN0SWQ6IHRlc3RJZFxuXHQgICAgfSk7XG5cdCAgICB0ZXN0QmxvY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG5cdCAgICB0ZXN0QmxvY2suYXBwZW5kQ2hpbGQodGl0bGUpO1xuXHQgICAgdGVzdEJsb2NrLmFwcGVuZENoaWxkKHJlcnVuVHJpZ2dlcik7XG5cdCAgICB0ZXN0QmxvY2suaWQgPSBcInF1bml0LXRlc3Qtb3V0cHV0LVwiICsgdGVzdElkO1xuXHQgICAgYXNzZXJ0TGlzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJvbFwiKTtcblx0ICAgIGFzc2VydExpc3QuY2xhc3NOYW1lID0gXCJxdW5pdC1hc3NlcnQtbGlzdFwiO1xuXHQgICAgdGVzdEJsb2NrLmFwcGVuZENoaWxkKGFzc2VydExpc3QpO1xuXHQgICAgdGVzdHMuYXBwZW5kQ2hpbGQodGVzdEJsb2NrKTtcblx0ICB9IC8vIEhUTUwgUmVwb3J0ZXIgaW5pdGlhbGl6YXRpb24gYW5kIGxvYWRcblxuXG5cdCAgUVVuaXQuYmVnaW4oZnVuY3Rpb24gKGRldGFpbHMpIHtcblx0ICAgIHZhciBpLCBtb2R1bGVPYmo7IC8vIFNvcnQgbW9kdWxlcyBieSBuYW1lIGZvciB0aGUgcGlja2VyXG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCBkZXRhaWxzLm1vZHVsZXMubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgbW9kdWxlT2JqID0gZGV0YWlscy5tb2R1bGVzW2ldO1xuXG5cdCAgICAgIGlmIChtb2R1bGVPYmoubmFtZSkge1xuXHQgICAgICAgIG1vZHVsZXNMaXN0LnB1c2gobW9kdWxlT2JqLm5hbWUpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIG1vZHVsZXNMaXN0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcblx0ICAgICAgcmV0dXJuIGEubG9jYWxlQ29tcGFyZShiKTtcblx0ICAgIH0pOyAvLyBJbml0aWFsaXplIFFVbml0IGVsZW1lbnRzXG5cblx0ICAgIGFwcGVuZEludGVyZmFjZSgpO1xuXHQgIH0pO1xuXHQgIFFVbml0LmRvbmUoZnVuY3Rpb24gKGRldGFpbHMpIHtcblx0ICAgIHZhciBiYW5uZXIgPSBpZChcInF1bml0LWJhbm5lclwiKSxcblx0ICAgICAgICB0ZXN0cyA9IGlkKFwicXVuaXQtdGVzdHNcIiksXG5cdCAgICAgICAgYWJvcnRCdXR0b24gPSBpZChcInF1bml0LWFib3J0LXRlc3RzLWJ1dHRvblwiKSxcblx0ICAgICAgICB0b3RhbFRlc3RzID0gc3RhdHMucGFzc2VkVGVzdHMgKyBzdGF0cy5za2lwcGVkVGVzdHMgKyBzdGF0cy50b2RvVGVzdHMgKyBzdGF0cy5mYWlsZWRUZXN0cyxcblx0ICAgICAgICBodG1sID0gW3RvdGFsVGVzdHMsIFwiIHRlc3RzIGNvbXBsZXRlZCBpbiBcIiwgZGV0YWlscy5ydW50aW1lLCBcIiBtaWxsaXNlY29uZHMsIHdpdGggXCIsIHN0YXRzLmZhaWxlZFRlc3RzLCBcIiBmYWlsZWQsIFwiLCBzdGF0cy5za2lwcGVkVGVzdHMsIFwiIHNraXBwZWQsIGFuZCBcIiwgc3RhdHMudG9kb1Rlc3RzLCBcIiB0b2RvLjxiciAvPlwiLCBcIjxzcGFuIGNsYXNzPSdwYXNzZWQnPlwiLCBkZXRhaWxzLnBhc3NlZCwgXCI8L3NwYW4+IGFzc2VydGlvbnMgb2YgPHNwYW4gY2xhc3M9J3RvdGFsJz5cIiwgZGV0YWlscy50b3RhbCwgXCI8L3NwYW4+IHBhc3NlZCwgPHNwYW4gY2xhc3M9J2ZhaWxlZCc+XCIsIGRldGFpbHMuZmFpbGVkLCBcIjwvc3Bhbj4gZmFpbGVkLlwiXS5qb2luKFwiXCIpLFxuXHQgICAgICAgIHRlc3QsXG5cdCAgICAgICAgYXNzZXJ0TGksXG5cdCAgICAgICAgYXNzZXJ0TGlzdDsgLy8gVXBkYXRlIHJlbWFpbmluZyB0ZXN0cyB0byBhYm9ydGVkXG5cblx0ICAgIGlmIChhYm9ydEJ1dHRvbiAmJiBhYm9ydEJ1dHRvbi5kaXNhYmxlZCkge1xuXHQgICAgICBodG1sID0gXCJUZXN0cyBhYm9ydGVkIGFmdGVyIFwiICsgZGV0YWlscy5ydW50aW1lICsgXCIgbWlsbGlzZWNvbmRzLlwiO1xuXG5cdCAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGVzdHMuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICB0ZXN0ID0gdGVzdHMuY2hpbGRyZW5baV07XG5cblx0ICAgICAgICBpZiAodGVzdC5jbGFzc05hbWUgPT09IFwiXCIgfHwgdGVzdC5jbGFzc05hbWUgPT09IFwicnVubmluZ1wiKSB7XG5cdCAgICAgICAgICB0ZXN0LmNsYXNzTmFtZSA9IFwiYWJvcnRlZFwiO1xuXHQgICAgICAgICAgYXNzZXJ0TGlzdCA9IHRlc3QuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJvbFwiKVswXTtcblx0ICAgICAgICAgIGFzc2VydExpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpO1xuXHQgICAgICAgICAgYXNzZXJ0TGkuY2xhc3NOYW1lID0gXCJmYWlsXCI7XG5cdCAgICAgICAgICBhc3NlcnRMaS5pbm5lckhUTUwgPSBcIlRlc3QgYWJvcnRlZC5cIjtcblx0ICAgICAgICAgIGFzc2VydExpc3QuYXBwZW5kQ2hpbGQoYXNzZXJ0TGkpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBpZiAoYmFubmVyICYmICghYWJvcnRCdXR0b24gfHwgYWJvcnRCdXR0b24uZGlzYWJsZWQgPT09IGZhbHNlKSkge1xuXHQgICAgICBiYW5uZXIuY2xhc3NOYW1lID0gc3RhdHMuZmFpbGVkVGVzdHMgPyBcInF1bml0LWZhaWxcIiA6IFwicXVuaXQtcGFzc1wiO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoYWJvcnRCdXR0b24pIHtcblx0ICAgICAgYWJvcnRCdXR0b24ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhYm9ydEJ1dHRvbik7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0ZXN0cykge1xuXHQgICAgICBpZChcInF1bml0LXRlc3RyZXN1bHQtZGlzcGxheVwiKS5pbm5lckhUTUwgPSBodG1sO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY29uZmlnLmFsdGVydGl0bGUgJiYgZG9jdW1lbnQudGl0bGUpIHtcblx0ICAgICAgLy8gU2hvdyDinJYgZm9yIGdvb2QsIOKclCBmb3IgYmFkIHN1aXRlIHJlc3VsdCBpbiB0aXRsZVxuXHQgICAgICAvLyB1c2UgZXNjYXBlIHNlcXVlbmNlcyBpbiBjYXNlIGZpbGUgZ2V0cyBsb2FkZWQgd2l0aCBub24tdXRmLThcblx0ICAgICAgLy8gY2hhcnNldFxuXHQgICAgICBkb2N1bWVudC50aXRsZSA9IFtzdGF0cy5mYWlsZWRUZXN0cyA/IFwiXFx1MjcxNlwiIDogXCJcXHUyNzE0XCIsIGRvY3VtZW50LnRpdGxlLnJlcGxhY2UoL15bXFx1MjcxNFxcdTI3MTZdIC9pLCBcIlwiKV0uam9pbihcIiBcIik7XG5cdCAgICB9IC8vIFNjcm9sbCBiYWNrIHRvIHRvcCB0byBzaG93IHJlc3VsdHNcblxuXG5cdCAgICBpZiAoY29uZmlnLnNjcm9sbHRvcCAmJiB3aW5kb3ckMS5zY3JvbGxUbykge1xuXHQgICAgICB3aW5kb3ckMS5zY3JvbGxUbygwLCAwKTtcblx0ICAgIH1cblx0ICB9KTtcblxuXHQgIGZ1bmN0aW9uIGdldE5hbWVIdG1sKG5hbWUsIG1vZHVsZSkge1xuXHQgICAgdmFyIG5hbWVIdG1sID0gXCJcIjtcblxuXHQgICAgaWYgKG1vZHVsZSkge1xuXHQgICAgICBuYW1lSHRtbCA9IFwiPHNwYW4gY2xhc3M9J21vZHVsZS1uYW1lJz5cIiArIGVzY2FwZVRleHQobW9kdWxlKSArIFwiPC9zcGFuPjogXCI7XG5cdCAgICB9XG5cblx0ICAgIG5hbWVIdG1sICs9IFwiPHNwYW4gY2xhc3M9J3Rlc3QtbmFtZSc+XCIgKyBlc2NhcGVUZXh0KG5hbWUpICsgXCI8L3NwYW4+XCI7XG5cdCAgICByZXR1cm4gbmFtZUh0bWw7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gZ2V0UHJvZ3Jlc3NIdG1sKHJ1bnRpbWUsIHN0YXRzLCB0b3RhbCkge1xuXHQgICAgdmFyIGNvbXBsZXRlZCA9IHN0YXRzLnBhc3NlZFRlc3RzICsgc3RhdHMuc2tpcHBlZFRlc3RzICsgc3RhdHMudG9kb1Rlc3RzICsgc3RhdHMuZmFpbGVkVGVzdHM7XG5cdCAgICByZXR1cm4gW1wiPGJyIC8+XCIsIGNvbXBsZXRlZCwgXCIgLyBcIiwgdG90YWwsIFwiIHRlc3RzIGNvbXBsZXRlZCBpbiBcIiwgcnVudGltZSwgXCIgbWlsbGlzZWNvbmRzLCB3aXRoIFwiLCBzdGF0cy5mYWlsZWRUZXN0cywgXCIgZmFpbGVkLCBcIiwgc3RhdHMuc2tpcHBlZFRlc3RzLCBcIiBza2lwcGVkLCBhbmQgXCIsIHN0YXRzLnRvZG9UZXN0cywgXCIgdG9kby5cIl0uam9pbihcIlwiKTtcblx0ICB9XG5cblx0ICBRVW5pdC50ZXN0U3RhcnQoZnVuY3Rpb24gKGRldGFpbHMpIHtcblx0ICAgIHZhciBydW5uaW5nLCBiYWQ7XG5cdCAgICBhcHBlbmRUZXN0KGRldGFpbHMubmFtZSwgZGV0YWlscy50ZXN0SWQsIGRldGFpbHMubW9kdWxlKTtcblx0ICAgIHJ1bm5pbmcgPSBpZChcInF1bml0LXRlc3RyZXN1bHQtZGlzcGxheVwiKTtcblxuXHQgICAgaWYgKHJ1bm5pbmcpIHtcblx0ICAgICAgYWRkQ2xhc3MocnVubmluZywgXCJydW5uaW5nXCIpO1xuXHQgICAgICBiYWQgPSBRVW5pdC5jb25maWcucmVvcmRlciAmJiBkZXRhaWxzLnByZXZpb3VzRmFpbHVyZTtcblx0ICAgICAgcnVubmluZy5pbm5lckhUTUwgPSBbYmFkID8gXCJSZXJ1bm5pbmcgcHJldmlvdXNseSBmYWlsZWQgdGVzdDogPGJyIC8+XCIgOiBcIlJ1bm5pbmc6IDxiciAvPlwiLCBnZXROYW1lSHRtbChkZXRhaWxzLm5hbWUsIGRldGFpbHMubW9kdWxlKSwgZ2V0UHJvZ3Jlc3NIdG1sKG5vdygpIC0gY29uZmlnLnN0YXJ0ZWQsIHN0YXRzLCBUZXN0LmNvdW50KV0uam9pbihcIlwiKTtcblx0ICAgIH1cblx0ICB9KTtcblxuXHQgIGZ1bmN0aW9uIHN0cmlwSHRtbChzdHJpbmcpIHtcblx0ICAgIC8vIFN0cmlwIHRhZ3MsIGh0bWwgZW50aXR5IGFuZCB3aGl0ZXNwYWNlc1xuXHQgICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC88XFwvP1tePl0rKD58JCkvZywgXCJcIikucmVwbGFjZSgvJnF1b3Q7L2csIFwiXCIpLnJlcGxhY2UoL1xccysvZywgXCJcIik7XG5cdCAgfVxuXG5cdCAgUVVuaXQubG9nKGZ1bmN0aW9uIChkZXRhaWxzKSB7XG5cdCAgICB2YXIgYXNzZXJ0TGlzdCxcblx0ICAgICAgICBhc3NlcnRMaSxcblx0ICAgICAgICBtZXNzYWdlLFxuXHQgICAgICAgIGV4cGVjdGVkLFxuXHQgICAgICAgIGFjdHVhbCxcblx0ICAgICAgICBkaWZmLFxuXHQgICAgICAgIHNob3dEaWZmID0gZmFsc2UsXG5cdCAgICAgICAgdGVzdEl0ZW0gPSBpZChcInF1bml0LXRlc3Qtb3V0cHV0LVwiICsgZGV0YWlscy50ZXN0SWQpO1xuXG5cdCAgICBpZiAoIXRlc3RJdGVtKSB7XG5cdCAgICAgIHJldHVybjtcblx0ICAgIH1cblxuXHQgICAgbWVzc2FnZSA9IGVzY2FwZVRleHQoZGV0YWlscy5tZXNzYWdlKSB8fCAoZGV0YWlscy5yZXN1bHQgPyBcIm9rYXlcIiA6IFwiZmFpbGVkXCIpO1xuXHQgICAgbWVzc2FnZSA9IFwiPHNwYW4gY2xhc3M9J3Rlc3QtbWVzc2FnZSc+XCIgKyBtZXNzYWdlICsgXCI8L3NwYW4+XCI7XG5cdCAgICBtZXNzYWdlICs9IFwiPHNwYW4gY2xhc3M9J3J1bnRpbWUnPkAgXCIgKyBkZXRhaWxzLnJ1bnRpbWUgKyBcIiBtczwvc3Bhbj5cIjsgLy8gVGhlIHB1c2hGYWlsdXJlIGRvZXNuJ3QgcHJvdmlkZSBkZXRhaWxzLmV4cGVjdGVkXG5cdCAgICAvLyB3aGVuIGl0IGNhbGxzLCBpdCdzIGltcGxpY2l0IHRvIGFsc28gbm90IHNob3cgZXhwZWN0ZWQgYW5kIGRpZmYgc3R1ZmZcblx0ICAgIC8vIEFsc28sIHdlIG5lZWQgdG8gY2hlY2sgZGV0YWlscy5leHBlY3RlZCBleGlzdGVuY2UsIGFzIGl0IGNhbiBleGlzdCBhbmQgYmUgdW5kZWZpbmVkXG5cblx0ICAgIGlmICghZGV0YWlscy5yZXN1bHQgJiYgaGFzT3duLmNhbGwoZGV0YWlscywgXCJleHBlY3RlZFwiKSkge1xuXHQgICAgICBpZiAoZGV0YWlscy5uZWdhdGl2ZSkge1xuXHQgICAgICAgIGV4cGVjdGVkID0gXCJOT1QgXCIgKyBRVW5pdC5kdW1wLnBhcnNlKGRldGFpbHMuZXhwZWN0ZWQpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIGV4cGVjdGVkID0gUVVuaXQuZHVtcC5wYXJzZShkZXRhaWxzLmV4cGVjdGVkKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGFjdHVhbCA9IFFVbml0LmR1bXAucGFyc2UoZGV0YWlscy5hY3R1YWwpO1xuXHQgICAgICBtZXNzYWdlICs9IFwiPHRhYmxlPjx0ciBjbGFzcz0ndGVzdC1leHBlY3RlZCc+PHRoPkV4cGVjdGVkOiA8L3RoPjx0ZD48cHJlPlwiICsgZXNjYXBlVGV4dChleHBlY3RlZCkgKyBcIjwvcHJlPjwvdGQ+PC90cj5cIjtcblxuXHQgICAgICBpZiAoYWN0dWFsICE9PSBleHBlY3RlZCkge1xuXHQgICAgICAgIG1lc3NhZ2UgKz0gXCI8dHIgY2xhc3M9J3Rlc3QtYWN0dWFsJz48dGg+UmVzdWx0OiA8L3RoPjx0ZD48cHJlPlwiICsgZXNjYXBlVGV4dChhY3R1YWwpICsgXCI8L3ByZT48L3RkPjwvdHI+XCI7XG5cblx0ICAgICAgICBpZiAodHlwZW9mIGRldGFpbHMuYWN0dWFsID09PSBcIm51bWJlclwiICYmIHR5cGVvZiBkZXRhaWxzLmV4cGVjdGVkID09PSBcIm51bWJlclwiKSB7XG5cdCAgICAgICAgICBpZiAoIWlzTmFOKGRldGFpbHMuYWN0dWFsKSAmJiAhaXNOYU4oZGV0YWlscy5leHBlY3RlZCkpIHtcblx0ICAgICAgICAgICAgc2hvd0RpZmYgPSB0cnVlO1xuXHQgICAgICAgICAgICBkaWZmID0gZGV0YWlscy5hY3R1YWwgLSBkZXRhaWxzLmV4cGVjdGVkO1xuXHQgICAgICAgICAgICBkaWZmID0gKGRpZmYgPiAwID8gXCIrXCIgOiBcIlwiKSArIGRpZmY7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZGV0YWlscy5hY3R1YWwgIT09IFwiYm9vbGVhblwiICYmIHR5cGVvZiBkZXRhaWxzLmV4cGVjdGVkICE9PSBcImJvb2xlYW5cIikge1xuXHQgICAgICAgICAgZGlmZiA9IFFVbml0LmRpZmYoZXhwZWN0ZWQsIGFjdHVhbCk7IC8vIGRvbid0IHNob3cgZGlmZiBpZiB0aGVyZSBpcyB6ZXJvIG92ZXJsYXBcblxuXHQgICAgICAgICAgc2hvd0RpZmYgPSBzdHJpcEh0bWwoZGlmZikubGVuZ3RoICE9PSBzdHJpcEh0bWwoZXhwZWN0ZWQpLmxlbmd0aCArIHN0cmlwSHRtbChhY3R1YWwpLmxlbmd0aDtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBpZiAoc2hvd0RpZmYpIHtcblx0ICAgICAgICAgIG1lc3NhZ2UgKz0gXCI8dHIgY2xhc3M9J3Rlc3QtZGlmZic+PHRoPkRpZmY6IDwvdGg+PHRkPjxwcmU+XCIgKyBkaWZmICsgXCI8L3ByZT48L3RkPjwvdHI+XCI7XG5cdCAgICAgICAgfVxuXHQgICAgICB9IGVsc2UgaWYgKGV4cGVjdGVkLmluZGV4T2YoXCJbb2JqZWN0IEFycmF5XVwiKSAhPT0gLTEgfHwgZXhwZWN0ZWQuaW5kZXhPZihcIltvYmplY3QgT2JqZWN0XVwiKSAhPT0gLTEpIHtcblx0ICAgICAgICBtZXNzYWdlICs9IFwiPHRyIGNsYXNzPSd0ZXN0LW1lc3NhZ2UnPjx0aD5NZXNzYWdlOiA8L3RoPjx0ZD5cIiArIFwiRGlmZiBzdXBwcmVzc2VkIGFzIHRoZSBkZXB0aCBvZiBvYmplY3QgaXMgbW9yZSB0aGFuIGN1cnJlbnQgbWF4IGRlcHRoIChcIiArIFFVbml0LmNvbmZpZy5tYXhEZXB0aCArIFwiKS48cD5IaW50OiBVc2UgPGNvZGU+UVVuaXQuZHVtcC5tYXhEZXB0aDwvY29kZT4gdG8gXCIgKyBcIiBydW4gd2l0aCBhIGhpZ2hlciBtYXggZGVwdGggb3IgPGEgaHJlZj0nXCIgKyBlc2NhcGVUZXh0KHNldFVybCh7XG5cdCAgICAgICAgICBtYXhEZXB0aDogLTFcblx0ICAgICAgICB9KSkgKyBcIic+XCIgKyBcIlJlcnVuPC9hPiB3aXRob3V0IG1heCBkZXB0aC48L3A+PC90ZD48L3RyPlwiO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIG1lc3NhZ2UgKz0gXCI8dHIgY2xhc3M9J3Rlc3QtbWVzc2FnZSc+PHRoPk1lc3NhZ2U6IDwvdGg+PHRkPlwiICsgXCJEaWZmIHN1cHByZXNzZWQgYXMgdGhlIGV4cGVjdGVkIGFuZCBhY3R1YWwgcmVzdWx0cyBoYXZlIGFuIGVxdWl2YWxlbnRcIiArIFwiIHNlcmlhbGl6YXRpb248L3RkPjwvdHI+XCI7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAoZGV0YWlscy5zb3VyY2UpIHtcblx0ICAgICAgICBtZXNzYWdlICs9IFwiPHRyIGNsYXNzPSd0ZXN0LXNvdXJjZSc+PHRoPlNvdXJjZTogPC90aD48dGQ+PHByZT5cIiArIGVzY2FwZVRleHQoZGV0YWlscy5zb3VyY2UpICsgXCI8L3ByZT48L3RkPjwvdHI+XCI7XG5cdCAgICAgIH1cblxuXHQgICAgICBtZXNzYWdlICs9IFwiPC90YWJsZT5cIjsgLy8gVGhpcyBvY2N1cnMgd2hlbiBwdXNoRmFpbHVyZSBpcyBzZXQgYW5kIHdlIGhhdmUgYW4gZXh0cmFjdGVkIHN0YWNrIHRyYWNlXG5cdCAgICB9IGVsc2UgaWYgKCFkZXRhaWxzLnJlc3VsdCAmJiBkZXRhaWxzLnNvdXJjZSkge1xuXHQgICAgICBtZXNzYWdlICs9IFwiPHRhYmxlPlwiICsgXCI8dHIgY2xhc3M9J3Rlc3Qtc291cmNlJz48dGg+U291cmNlOiA8L3RoPjx0ZD48cHJlPlwiICsgZXNjYXBlVGV4dChkZXRhaWxzLnNvdXJjZSkgKyBcIjwvcHJlPjwvdGQ+PC90cj5cIiArIFwiPC90YWJsZT5cIjtcblx0ICAgIH1cblxuXHQgICAgYXNzZXJ0TGlzdCA9IHRlc3RJdGVtLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwib2xcIilbMF07XG5cdCAgICBhc3NlcnRMaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcblx0ICAgIGFzc2VydExpLmNsYXNzTmFtZSA9IGRldGFpbHMucmVzdWx0ID8gXCJwYXNzXCIgOiBcImZhaWxcIjtcblx0ICAgIGFzc2VydExpLmlubmVySFRNTCA9IG1lc3NhZ2U7XG5cdCAgICBhc3NlcnRMaXN0LmFwcGVuZENoaWxkKGFzc2VydExpKTtcblx0ICB9KTtcblx0ICBRVW5pdC50ZXN0RG9uZShmdW5jdGlvbiAoZGV0YWlscykge1xuXHQgICAgdmFyIHRlc3RUaXRsZSxcblx0ICAgICAgICB0aW1lLFxuXHQgICAgICAgIHRlc3RJdGVtLFxuXHQgICAgICAgIGFzc2VydExpc3QsXG5cdCAgICAgICAgc3RhdHVzLFxuXHQgICAgICAgIGdvb2QsXG5cdCAgICAgICAgYmFkLFxuXHQgICAgICAgIHRlc3RDb3VudHMsXG5cdCAgICAgICAgc2tpcHBlZCxcblx0ICAgICAgICBzb3VyY2VOYW1lLFxuXHQgICAgICAgIHRlc3RzID0gaWQoXCJxdW5pdC10ZXN0c1wiKTtcblxuXHQgICAgaWYgKCF0ZXN0cykge1xuXHQgICAgICByZXR1cm47XG5cdCAgICB9XG5cblx0ICAgIHRlc3RJdGVtID0gaWQoXCJxdW5pdC10ZXN0LW91dHB1dC1cIiArIGRldGFpbHMudGVzdElkKTtcblx0ICAgIHJlbW92ZUNsYXNzKHRlc3RJdGVtLCBcInJ1bm5pbmdcIik7XG5cblx0ICAgIGlmIChkZXRhaWxzLmZhaWxlZCA+IDApIHtcblx0ICAgICAgc3RhdHVzID0gXCJmYWlsZWRcIjtcblx0ICAgIH0gZWxzZSBpZiAoZGV0YWlscy50b2RvKSB7XG5cdCAgICAgIHN0YXR1cyA9IFwidG9kb1wiO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgc3RhdHVzID0gZGV0YWlscy5za2lwcGVkID8gXCJza2lwcGVkXCIgOiBcInBhc3NlZFwiO1xuXHQgICAgfVxuXG5cdCAgICBhc3NlcnRMaXN0ID0gdGVzdEl0ZW0uZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJvbFwiKVswXTtcblx0ICAgIGdvb2QgPSBkZXRhaWxzLnBhc3NlZDtcblx0ICAgIGJhZCA9IGRldGFpbHMuZmFpbGVkOyAvLyBUaGlzIHRlc3QgcGFzc2VkIGlmIGl0IGhhcyBubyB1bmV4cGVjdGVkIGZhaWxlZCBhc3NlcnRpb25zXG5cblx0ICAgIHZhciB0ZXN0UGFzc2VkID0gZGV0YWlscy5mYWlsZWQgPiAwID8gZGV0YWlscy50b2RvIDogIWRldGFpbHMudG9kbztcblxuXHQgICAgaWYgKHRlc3RQYXNzZWQpIHtcblx0ICAgICAgLy8gQ29sbGFwc2UgdGhlIHBhc3NpbmcgdGVzdHNcblx0ICAgICAgYWRkQ2xhc3MoYXNzZXJ0TGlzdCwgXCJxdW5pdC1jb2xsYXBzZWRcIik7XG5cdCAgICB9IGVsc2UgaWYgKGNvbmZpZy5jb2xsYXBzZSkge1xuXHQgICAgICBpZiAoIWNvbGxhcHNlTmV4dCkge1xuXHQgICAgICAgIC8vIFNraXAgY29sbGFwc2luZyB0aGUgZmlyc3QgZmFpbGluZyB0ZXN0XG5cdCAgICAgICAgY29sbGFwc2VOZXh0ID0gdHJ1ZTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAvLyBDb2xsYXBzZSByZW1haW5pbmcgdGVzdHNcblx0ICAgICAgICBhZGRDbGFzcyhhc3NlcnRMaXN0LCBcInF1bml0LWNvbGxhcHNlZFwiKTtcblx0ICAgICAgfVxuXHQgICAgfSAvLyBUaGUgdGVzdEl0ZW0uZmlyc3RDaGlsZCBpcyB0aGUgdGVzdCBuYW1lXG5cblxuXHQgICAgdGVzdFRpdGxlID0gdGVzdEl0ZW0uZmlyc3RDaGlsZDtcblx0ICAgIHRlc3RDb3VudHMgPSBiYWQgPyBcIjxiIGNsYXNzPSdmYWlsZWQnPlwiICsgYmFkICsgXCI8L2I+LCBcIiArIFwiPGIgY2xhc3M9J3Bhc3NlZCc+XCIgKyBnb29kICsgXCI8L2I+LCBcIiA6IFwiXCI7XG5cdCAgICB0ZXN0VGl0bGUuaW5uZXJIVE1MICs9IFwiIDxiIGNsYXNzPSdjb3VudHMnPihcIiArIHRlc3RDb3VudHMgKyBkZXRhaWxzLmFzc2VydGlvbnMubGVuZ3RoICsgXCIpPC9iPlwiO1xuXG5cdCAgICBpZiAoZGV0YWlscy5za2lwcGVkKSB7XG5cdCAgICAgIHN0YXRzLnNraXBwZWRUZXN0cysrO1xuXHQgICAgICB0ZXN0SXRlbS5jbGFzc05hbWUgPSBcInNraXBwZWRcIjtcblx0ICAgICAgc2tpcHBlZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJlbVwiKTtcblx0ICAgICAgc2tpcHBlZC5jbGFzc05hbWUgPSBcInF1bml0LXNraXBwZWQtbGFiZWxcIjtcblx0ICAgICAgc2tpcHBlZC5pbm5lckhUTUwgPSBcInNraXBwZWRcIjtcblx0ICAgICAgdGVzdEl0ZW0uaW5zZXJ0QmVmb3JlKHNraXBwZWQsIHRlc3RUaXRsZSk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBhZGRFdmVudCh0ZXN0VGl0bGUsIFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHRvZ2dsZUNsYXNzKGFzc2VydExpc3QsIFwicXVuaXQtY29sbGFwc2VkXCIpO1xuXHQgICAgICB9KTtcblx0ICAgICAgdGVzdEl0ZW0uY2xhc3NOYW1lID0gdGVzdFBhc3NlZCA/IFwicGFzc1wiIDogXCJmYWlsXCI7XG5cblx0ICAgICAgaWYgKGRldGFpbHMudG9kbykge1xuXHQgICAgICAgIHZhciB0b2RvTGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZW1cIik7XG5cdCAgICAgICAgdG9kb0xhYmVsLmNsYXNzTmFtZSA9IFwicXVuaXQtdG9kby1sYWJlbFwiO1xuXHQgICAgICAgIHRvZG9MYWJlbC5pbm5lckhUTUwgPSBcInRvZG9cIjtcblx0ICAgICAgICB0ZXN0SXRlbS5jbGFzc05hbWUgKz0gXCIgdG9kb1wiO1xuXHQgICAgICAgIHRlc3RJdGVtLmluc2VydEJlZm9yZSh0b2RvTGFiZWwsIHRlc3RUaXRsZSk7XG5cdCAgICAgIH1cblxuXHQgICAgICB0aW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG5cdCAgICAgIHRpbWUuY2xhc3NOYW1lID0gXCJydW50aW1lXCI7XG5cdCAgICAgIHRpbWUuaW5uZXJIVE1MID0gZGV0YWlscy5ydW50aW1lICsgXCIgbXNcIjtcblx0ICAgICAgdGVzdEl0ZW0uaW5zZXJ0QmVmb3JlKHRpbWUsIGFzc2VydExpc3QpO1xuXG5cdCAgICAgIGlmICghdGVzdFBhc3NlZCkge1xuXHQgICAgICAgIHN0YXRzLmZhaWxlZFRlc3RzKys7XG5cdCAgICAgIH0gZWxzZSBpZiAoZGV0YWlscy50b2RvKSB7XG5cdCAgICAgICAgc3RhdHMudG9kb1Rlc3RzKys7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgc3RhdHMucGFzc2VkVGVzdHMrKztcblx0ICAgICAgfVxuXHQgICAgfSAvLyBTaG93IHRoZSBzb3VyY2Ugb2YgdGhlIHRlc3Qgd2hlbiBzaG93aW5nIGFzc2VydGlvbnNcblxuXG5cdCAgICBpZiAoZGV0YWlscy5zb3VyY2UpIHtcblx0ICAgICAgc291cmNlTmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJwXCIpO1xuXHQgICAgICBzb3VyY2VOYW1lLmlubmVySFRNTCA9IFwiPHN0cm9uZz5Tb3VyY2U6IDwvc3Ryb25nPlwiICsgZXNjYXBlVGV4dChkZXRhaWxzLnNvdXJjZSk7XG5cdCAgICAgIGFkZENsYXNzKHNvdXJjZU5hbWUsIFwicXVuaXQtc291cmNlXCIpO1xuXG5cdCAgICAgIGlmICh0ZXN0UGFzc2VkKSB7XG5cdCAgICAgICAgYWRkQ2xhc3Moc291cmNlTmFtZSwgXCJxdW5pdC1jb2xsYXBzZWRcIik7XG5cdCAgICAgIH1cblxuXHQgICAgICBhZGRFdmVudCh0ZXN0VGl0bGUsIFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHRvZ2dsZUNsYXNzKHNvdXJjZU5hbWUsIFwicXVuaXQtY29sbGFwc2VkXCIpO1xuXHQgICAgICB9KTtcblx0ICAgICAgdGVzdEl0ZW0uYXBwZW5kQ2hpbGQoc291cmNlTmFtZSk7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjb25maWcuaGlkZXBhc3NlZCAmJiAoc3RhdHVzID09PSBcInBhc3NlZFwiIHx8IGRldGFpbHMuc2tpcHBlZCkpIHtcblx0ICAgICAgLy8gdXNlIHJlbW92ZUNoaWxkIGluc3RlYWQgb2YgcmVtb3ZlIGJlY2F1c2Ugb2Ygc3VwcG9ydFxuXHQgICAgICBoaWRkZW5UZXN0cy5wdXNoKHRlc3RJdGVtKTtcblx0ICAgICAgdGVzdHMucmVtb3ZlQ2hpbGQodGVzdEl0ZW0pO1xuXHQgICAgfVxuXHQgIH0pOyAvLyBBdm9pZCByZWFkeVN0YXRlIGlzc3VlIHdpdGggcGhhbnRvbWpzXG5cdCAgLy8gUmVmOiAjODE4XG5cblx0ICB2YXIgbm90UGhhbnRvbSA9IGZ1bmN0aW9uIChwKSB7XG5cdCAgICByZXR1cm4gIShwICYmIHAudmVyc2lvbiAmJiBwLnZlcnNpb24ubWFqb3IgPiAwKTtcblx0ICB9KHdpbmRvdyQxLnBoYW50b20pO1xuXG5cdCAgaWYgKG5vdFBoYW50b20gJiYgZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJjb21wbGV0ZVwiKSB7XG5cdCAgICBRVW5pdC5sb2FkKCk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIGFkZEV2ZW50KHdpbmRvdyQxLCBcImxvYWRcIiwgUVVuaXQubG9hZCk7XG5cdCAgfSAvLyBXcmFwIHdpbmRvdy5vbmVycm9yLiBXZSB3aWxsIGNhbGwgdGhlIG9yaWdpbmFsIHdpbmRvdy5vbmVycm9yIHRvIHNlZSBpZlxuXHQgIC8vIHRoZSBleGlzdGluZyBoYW5kbGVyIGZ1bGx5IGhhbmRsZXMgdGhlIGVycm9yOyBpZiBub3QsIHdlIHdpbGwgY2FsbCB0aGVcblx0ICAvLyBRVW5pdC5vbkVycm9yIGZ1bmN0aW9uLlxuXG5cblx0ICB2YXIgb3JpZ2luYWxXaW5kb3dPbkVycm9yID0gd2luZG93JDEub25lcnJvcjsgLy8gQ292ZXIgdW5jYXVnaHQgZXhjZXB0aW9uc1xuXHQgIC8vIFJldHVybmluZyB0cnVlIHdpbGwgc3VwcHJlc3MgdGhlIGRlZmF1bHQgYnJvd3NlciBoYW5kbGVyLFxuXHQgIC8vIHJldHVybmluZyBmYWxzZSB3aWxsIGxldCBpdCBydW4uXG5cblx0ICB3aW5kb3ckMS5vbmVycm9yID0gZnVuY3Rpb24gKG1lc3NhZ2UsIGZpbGVOYW1lLCBsaW5lTnVtYmVyLCBjb2x1bW5OdW1iZXIsIGVycm9yT2JqKSB7XG5cdCAgICB2YXIgcmV0ID0gZmFsc2U7XG5cblx0ICAgIGlmIChvcmlnaW5hbFdpbmRvd09uRXJyb3IpIHtcblx0ICAgICAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBuZXcgQXJyYXkoX2xlbiA+IDUgPyBfbGVuIC0gNSA6IDApLCBfa2V5ID0gNTsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuXHQgICAgICAgIGFyZ3NbX2tleSAtIDVdID0gYXJndW1lbnRzW19rZXldO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0ID0gb3JpZ2luYWxXaW5kb3dPbkVycm9yLmNhbGwuYXBwbHkob3JpZ2luYWxXaW5kb3dPbkVycm9yLCBbdGhpcywgbWVzc2FnZSwgZmlsZU5hbWUsIGxpbmVOdW1iZXIsIGNvbHVtbk51bWJlciwgZXJyb3JPYmpdLmNvbmNhdChhcmdzKSk7XG5cdCAgICB9IC8vIFRyZWF0IHJldHVybiB2YWx1ZSBhcyB3aW5kb3cub25lcnJvciBpdHNlbGYgZG9lcyxcblx0ICAgIC8vIE9ubHkgZG8gb3VyIGhhbmRsaW5nIGlmIG5vdCBzdXBwcmVzc2VkLlxuXG5cblx0ICAgIGlmIChyZXQgIT09IHRydWUpIHtcblx0ICAgICAgdmFyIGVycm9yID0ge1xuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG5cdCAgICAgICAgZmlsZU5hbWU6IGZpbGVOYW1lLFxuXHQgICAgICAgIGxpbmVOdW1iZXI6IGxpbmVOdW1iZXJcblx0ICAgICAgfTsgLy8gQWNjb3JkaW5nIHRvXG5cdCAgICAgIC8vIGh0dHBzOi8vYmxvZy5zZW50cnkuaW8vMjAxNi8wMS8wNC9jbGllbnQtamF2YXNjcmlwdC1yZXBvcnRpbmctd2luZG93LW9uZXJyb3IsXG5cdCAgICAgIC8vIG1vc3QgbW9kZXJuIGJyb3dzZXJzIHN1cHBvcnQgYW4gZXJyb3JPYmogYXJndW1lbnQ7IHVzZSB0aGF0IHRvXG5cdCAgICAgIC8vIGdldCBhIGZ1bGwgc3RhY2sgdHJhY2UgaWYgaXQncyBhdmFpbGFibGUuXG5cblx0ICAgICAgaWYgKGVycm9yT2JqICYmIGVycm9yT2JqLnN0YWNrKSB7XG5cdCAgICAgICAgZXJyb3Iuc3RhY2t0cmFjZSA9IGV4dHJhY3RTdGFja3RyYWNlKGVycm9yT2JqLCAwKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldCA9IFFVbml0Lm9uRXJyb3IoZXJyb3IpO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gcmV0O1xuXHQgIH07IC8vIExpc3RlbiBmb3IgdW5oYW5kbGVkIHJlamVjdGlvbnMsIGFuZCBjYWxsIFFVbml0Lm9uVW5oYW5kbGVkUmVqZWN0aW9uXG5cblxuXHQgIHdpbmRvdyQxLmFkZEV2ZW50TGlzdGVuZXIoXCJ1bmhhbmRsZWRyZWplY3Rpb25cIiwgZnVuY3Rpb24gKGV2ZW50KSB7XG5cdCAgICBRVW5pdC5vblVuaGFuZGxlZFJlamVjdGlvbihldmVudC5yZWFzb24pO1xuXHQgIH0pO1xuXHR9KSgpO1xuXG5cdC8qXG5cdCAqIFRoaXMgZmlsZSBpcyBhIG1vZGlmaWVkIHZlcnNpb24gb2YgZ29vZ2xlLWRpZmYtbWF0Y2gtcGF0Y2gncyBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uXG5cdCAqIChodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2dvb2dsZS1kaWZmLW1hdGNoLXBhdGNoL3NvdXJjZS9icm93c2UvdHJ1bmsvamF2YXNjcmlwdC9kaWZmX21hdGNoX3BhdGNoX3VuY29tcHJlc3NlZC5qcyksXG5cdCAqIG1vZGlmaWNhdGlvbnMgYXJlIGxpY2Vuc2VkIGFzIG1vcmUgZnVsbHkgc2V0IGZvcnRoIGluIExJQ0VOU0UudHh0LlxuXHQgKlxuXHQgKiBUaGUgb3JpZ2luYWwgc291cmNlIG9mIGdvb2dsZS1kaWZmLW1hdGNoLXBhdGNoIGlzIGF0dHJpYnV0YWJsZSBhbmQgbGljZW5zZWQgYXMgZm9sbG93czpcblx0ICpcblx0ICogQ29weXJpZ2h0IDIwMDYgR29vZ2xlIEluYy5cblx0ICogaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9nb29nbGUtZGlmZi1tYXRjaC1wYXRjaC9cblx0ICpcblx0ICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcblx0ICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuXHQgKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblx0ICpcblx0ICogaHR0cHM6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXHQgKlxuXHQgKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5cdCAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcblx0ICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5cdCAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcblx0ICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG5cdCAqXG5cdCAqIE1vcmUgSW5mbzpcblx0ICogIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvZ29vZ2xlLWRpZmYtbWF0Y2gtcGF0Y2gvXG5cdCAqXG5cdCAqIFVzYWdlOiBRVW5pdC5kaWZmKGV4cGVjdGVkLCBhY3R1YWwpXG5cdCAqXG5cdCAqL1xuXG5cdFFVbml0LmRpZmYgPSBmdW5jdGlvbiAoKSB7XG5cdCAgZnVuY3Rpb24gRGlmZk1hdGNoUGF0Y2goKSB7fSAvLyAgRElGRiBGVU5DVElPTlNcblxuXHQgIC8qKlxuXHQgICAqIFRoZSBkYXRhIHN0cnVjdHVyZSByZXByZXNlbnRpbmcgYSBkaWZmIGlzIGFuIGFycmF5IG9mIHR1cGxlczpcblx0ICAgKiBbW0RJRkZfREVMRVRFLCAnSGVsbG8nXSwgW0RJRkZfSU5TRVJULCAnR29vZGJ5ZSddLCBbRElGRl9FUVVBTCwgJyB3b3JsZC4nXV1cblx0ICAgKiB3aGljaCBtZWFuczogZGVsZXRlICdIZWxsbycsIGFkZCAnR29vZGJ5ZScgYW5kIGtlZXAgJyB3b3JsZC4nXG5cdCAgICovXG5cblxuXHQgIHZhciBESUZGX0RFTEVURSA9IC0xLFxuXHQgICAgICBESUZGX0lOU0VSVCA9IDEsXG5cdCAgICAgIERJRkZfRVFVQUwgPSAwLFxuXHQgICAgICBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXHQgIC8qKlxuXHQgICAqIEZpbmQgdGhlIGRpZmZlcmVuY2VzIGJldHdlZW4gdHdvIHRleHRzLiAgU2ltcGxpZmllcyB0aGUgcHJvYmxlbSBieSBzdHJpcHBpbmdcblx0ICAgKiBhbnkgY29tbW9uIHByZWZpeCBvciBzdWZmaXggb2ZmIHRoZSB0ZXh0cyBiZWZvcmUgZGlmZmluZy5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuXHQgICAqIEBwYXJhbSB7Ym9vbGVhbj19IG9wdENoZWNrbGluZXMgT3B0aW9uYWwgc3BlZWR1cCBmbGFnLiBJZiBwcmVzZW50IGFuZCBmYWxzZSxcblx0ICAgKiAgICAgdGhlbiBkb24ndCBydW4gYSBsaW5lLWxldmVsIGRpZmYgZmlyc3QgdG8gaWRlbnRpZnkgdGhlIGNoYW5nZWQgYXJlYXMuXG5cdCAgICogICAgIERlZmF1bHRzIHRvIHRydWUsIHdoaWNoIGRvZXMgYSBmYXN0ZXIsIHNsaWdodGx5IGxlc3Mgb3B0aW1hbCBkaWZmLlxuXHQgICAqIEByZXR1cm4geyFBcnJheS48IURpZmZNYXRjaFBhdGNoLkRpZmY+fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblx0ICAgKi9cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5EaWZmTWFpbiA9IGZ1bmN0aW9uICh0ZXh0MSwgdGV4dDIsIG9wdENoZWNrbGluZXMpIHtcblx0ICAgIHZhciBkZWFkbGluZSwgY2hlY2tsaW5lcywgY29tbW9ubGVuZ3RoLCBjb21tb25wcmVmaXgsIGNvbW1vbnN1ZmZpeCwgZGlmZnM7IC8vIFRoZSBkaWZmIG11c3QgYmUgY29tcGxldGUgaW4gdXAgdG8gMSBzZWNvbmQuXG5cblx0ICAgIGRlYWRsaW5lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgKyAxMDAwOyAvLyBDaGVjayBmb3IgbnVsbCBpbnB1dHMuXG5cblx0ICAgIGlmICh0ZXh0MSA9PT0gbnVsbCB8fCB0ZXh0MiA9PT0gbnVsbCkge1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOdWxsIGlucHV0LiAoRGlmZk1haW4pXCIpO1xuXHQgICAgfSAvLyBDaGVjayBmb3IgZXF1YWxpdHkgKHNwZWVkdXApLlxuXG5cblx0ICAgIGlmICh0ZXh0MSA9PT0gdGV4dDIpIHtcblx0ICAgICAgaWYgKHRleHQxKSB7XG5cdCAgICAgICAgcmV0dXJuIFtbRElGRl9FUVVBTCwgdGV4dDFdXTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBbXTtcblx0ICAgIH1cblxuXHQgICAgaWYgKHR5cGVvZiBvcHRDaGVja2xpbmVzID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdCAgICAgIG9wdENoZWNrbGluZXMgPSB0cnVlO1xuXHQgICAgfVxuXG5cdCAgICBjaGVja2xpbmVzID0gb3B0Q2hlY2tsaW5lczsgLy8gVHJpbSBvZmYgY29tbW9uIHByZWZpeCAoc3BlZWR1cCkuXG5cblx0ICAgIGNvbW1vbmxlbmd0aCA9IHRoaXMuZGlmZkNvbW1vblByZWZpeCh0ZXh0MSwgdGV4dDIpO1xuXHQgICAgY29tbW9ucHJlZml4ID0gdGV4dDEuc3Vic3RyaW5nKDAsIGNvbW1vbmxlbmd0aCk7XG5cdCAgICB0ZXh0MSA9IHRleHQxLnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuXHQgICAgdGV4dDIgPSB0ZXh0Mi5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTsgLy8gVHJpbSBvZmYgY29tbW9uIHN1ZmZpeCAoc3BlZWR1cCkuXG5cblx0ICAgIGNvbW1vbmxlbmd0aCA9IHRoaXMuZGlmZkNvbW1vblN1ZmZpeCh0ZXh0MSwgdGV4dDIpO1xuXHQgICAgY29tbW9uc3VmZml4ID0gdGV4dDEuc3Vic3RyaW5nKHRleHQxLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XG5cdCAgICB0ZXh0MSA9IHRleHQxLnN1YnN0cmluZygwLCB0ZXh0MS5sZW5ndGggLSBjb21tb25sZW5ndGgpO1xuXHQgICAgdGV4dDIgPSB0ZXh0Mi5zdWJzdHJpbmcoMCwgdGV4dDIubGVuZ3RoIC0gY29tbW9ubGVuZ3RoKTsgLy8gQ29tcHV0ZSB0aGUgZGlmZiBvbiB0aGUgbWlkZGxlIGJsb2NrLlxuXG5cdCAgICBkaWZmcyA9IHRoaXMuZGlmZkNvbXB1dGUodGV4dDEsIHRleHQyLCBjaGVja2xpbmVzLCBkZWFkbGluZSk7IC8vIFJlc3RvcmUgdGhlIHByZWZpeCBhbmQgc3VmZml4LlxuXG5cdCAgICBpZiAoY29tbW9ucHJlZml4KSB7XG5cdCAgICAgIGRpZmZzLnVuc2hpZnQoW0RJRkZfRVFVQUwsIGNvbW1vbnByZWZpeF0pO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY29tbW9uc3VmZml4KSB7XG5cdCAgICAgIGRpZmZzLnB1c2goW0RJRkZfRVFVQUwsIGNvbW1vbnN1ZmZpeF0pO1xuXHQgICAgfVxuXG5cdCAgICB0aGlzLmRpZmZDbGVhbnVwTWVyZ2UoZGlmZnMpO1xuXHQgICAgcmV0dXJuIGRpZmZzO1xuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogUmVkdWNlIHRoZSBudW1iZXIgb2YgZWRpdHMgYnkgZWxpbWluYXRpbmcgb3BlcmF0aW9uYWxseSB0cml2aWFsIGVxdWFsaXRpZXMuXG5cdCAgICogQHBhcmFtIHshQXJyYXkuPCFEaWZmTWF0Y2hQYXRjaC5EaWZmPn0gZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmQ2xlYW51cEVmZmljaWVuY3kgPSBmdW5jdGlvbiAoZGlmZnMpIHtcblx0ICAgIHZhciBjaGFuZ2VzLCBlcXVhbGl0aWVzLCBlcXVhbGl0aWVzTGVuZ3RoLCBsYXN0ZXF1YWxpdHksIHBvaW50ZXIsIHByZUlucywgcHJlRGVsLCBwb3N0SW5zLCBwb3N0RGVsO1xuXHQgICAgY2hhbmdlcyA9IGZhbHNlO1xuXHQgICAgZXF1YWxpdGllcyA9IFtdOyAvLyBTdGFjayBvZiBpbmRpY2VzIHdoZXJlIGVxdWFsaXRpZXMgYXJlIGZvdW5kLlxuXG5cdCAgICBlcXVhbGl0aWVzTGVuZ3RoID0gMDsgLy8gS2VlcGluZyBvdXIgb3duIGxlbmd0aCB2YXIgaXMgZmFzdGVyIGluIEpTLlxuXG5cdCAgICAvKiogQHR5cGUgez9zdHJpbmd9ICovXG5cblx0ICAgIGxhc3RlcXVhbGl0eSA9IG51bGw7IC8vIEFsd2F5cyBlcXVhbCB0byBkaWZmc1tlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGggLSAxXV1bMV1cblxuXHQgICAgcG9pbnRlciA9IDA7IC8vIEluZGV4IG9mIGN1cnJlbnQgcG9zaXRpb24uXG5cdCAgICAvLyBJcyB0aGVyZSBhbiBpbnNlcnRpb24gb3BlcmF0aW9uIGJlZm9yZSB0aGUgbGFzdCBlcXVhbGl0eS5cblxuXHQgICAgcHJlSW5zID0gZmFsc2U7IC8vIElzIHRoZXJlIGEgZGVsZXRpb24gb3BlcmF0aW9uIGJlZm9yZSB0aGUgbGFzdCBlcXVhbGl0eS5cblxuXHQgICAgcHJlRGVsID0gZmFsc2U7IC8vIElzIHRoZXJlIGFuIGluc2VydGlvbiBvcGVyYXRpb24gYWZ0ZXIgdGhlIGxhc3QgZXF1YWxpdHkuXG5cblx0ICAgIHBvc3RJbnMgPSBmYWxzZTsgLy8gSXMgdGhlcmUgYSBkZWxldGlvbiBvcGVyYXRpb24gYWZ0ZXIgdGhlIGxhc3QgZXF1YWxpdHkuXG5cblx0ICAgIHBvc3REZWwgPSBmYWxzZTtcblxuXHQgICAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGgpIHtcblx0ICAgICAgLy8gRXF1YWxpdHkgZm91bmQuXG5cdCAgICAgIGlmIChkaWZmc1twb2ludGVyXVswXSA9PT0gRElGRl9FUVVBTCkge1xuXHQgICAgICAgIGlmIChkaWZmc1twb2ludGVyXVsxXS5sZW5ndGggPCA0ICYmIChwb3N0SW5zIHx8IHBvc3REZWwpKSB7XG5cdCAgICAgICAgICAvLyBDYW5kaWRhdGUgZm91bmQuXG5cdCAgICAgICAgICBlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGgrK10gPSBwb2ludGVyO1xuXHQgICAgICAgICAgcHJlSW5zID0gcG9zdElucztcblx0ICAgICAgICAgIHByZURlbCA9IHBvc3REZWw7XG5cdCAgICAgICAgICBsYXN0ZXF1YWxpdHkgPSBkaWZmc1twb2ludGVyXVsxXTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgLy8gTm90IGEgY2FuZGlkYXRlLCBhbmQgY2FuIG5ldmVyIGJlY29tZSBvbmUuXG5cdCAgICAgICAgICBlcXVhbGl0aWVzTGVuZ3RoID0gMDtcblx0ICAgICAgICAgIGxhc3RlcXVhbGl0eSA9IG51bGw7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgcG9zdElucyA9IHBvc3REZWwgPSBmYWxzZTsgLy8gQW4gaW5zZXJ0aW9uIG9yIGRlbGV0aW9uLlxuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIGlmIChkaWZmc1twb2ludGVyXVswXSA9PT0gRElGRl9ERUxFVEUpIHtcblx0ICAgICAgICAgIHBvc3REZWwgPSB0cnVlO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBwb3N0SW5zID0gdHJ1ZTtcblx0ICAgICAgICB9XG5cdCAgICAgICAgLypcblx0ICAgICAgICAgKiBGaXZlIHR5cGVzIHRvIGJlIHNwbGl0OlxuXHQgICAgICAgICAqIDxpbnM+QTwvaW5zPjxkZWw+QjwvZGVsPlhZPGlucz5DPC9pbnM+PGRlbD5EPC9kZWw+XG5cdCAgICAgICAgICogPGlucz5BPC9pbnM+WDxpbnM+QzwvaW5zPjxkZWw+RDwvZGVsPlxuXHQgICAgICAgICAqIDxpbnM+QTwvaW5zPjxkZWw+QjwvZGVsPlg8aW5zPkM8L2lucz5cblx0ICAgICAgICAgKiA8aW5zPkE8L2RlbD5YPGlucz5DPC9pbnM+PGRlbD5EPC9kZWw+XG5cdCAgICAgICAgICogPGlucz5BPC9pbnM+PGRlbD5CPC9kZWw+WDxkZWw+QzwvZGVsPlxuXHQgICAgICAgICAqL1xuXG5cblx0ICAgICAgICBpZiAobGFzdGVxdWFsaXR5ICYmIChwcmVJbnMgJiYgcHJlRGVsICYmIHBvc3RJbnMgJiYgcG9zdERlbCB8fCBsYXN0ZXF1YWxpdHkubGVuZ3RoIDwgMiAmJiBwcmVJbnMgKyBwcmVEZWwgKyBwb3N0SW5zICsgcG9zdERlbCA9PT0gMykpIHtcblx0ICAgICAgICAgIC8vIER1cGxpY2F0ZSByZWNvcmQuXG5cdCAgICAgICAgICBkaWZmcy5zcGxpY2UoZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV0sIDAsIFtESUZGX0RFTEVURSwgbGFzdGVxdWFsaXR5XSk7IC8vIENoYW5nZSBzZWNvbmQgY29weSB0byBpbnNlcnQuXG5cblx0ICAgICAgICAgIGRpZmZzW2VxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdICsgMV1bMF0gPSBESUZGX0lOU0VSVDtcblx0ICAgICAgICAgIGVxdWFsaXRpZXNMZW5ndGgtLTsgLy8gVGhyb3cgYXdheSB0aGUgZXF1YWxpdHkgd2UganVzdCBkZWxldGVkO1xuXG5cdCAgICAgICAgICBsYXN0ZXF1YWxpdHkgPSBudWxsO1xuXG5cdCAgICAgICAgICBpZiAocHJlSW5zICYmIHByZURlbCkge1xuXHQgICAgICAgICAgICAvLyBObyBjaGFuZ2VzIG1hZGUgd2hpY2ggY291bGQgYWZmZWN0IHByZXZpb3VzIGVudHJ5LCBrZWVwIGdvaW5nLlxuXHQgICAgICAgICAgICBwb3N0SW5zID0gcG9zdERlbCA9IHRydWU7XG5cdCAgICAgICAgICAgIGVxdWFsaXRpZXNMZW5ndGggPSAwO1xuXHQgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgZXF1YWxpdGllc0xlbmd0aC0tOyAvLyBUaHJvdyBhd2F5IHRoZSBwcmV2aW91cyBlcXVhbGl0eS5cblxuXHQgICAgICAgICAgICBwb2ludGVyID0gZXF1YWxpdGllc0xlbmd0aCA+IDAgPyBlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGggLSAxXSA6IC0xO1xuXHQgICAgICAgICAgICBwb3N0SW5zID0gcG9zdERlbCA9IGZhbHNlO1xuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICBjaGFuZ2VzID0gdHJ1ZTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBwb2ludGVyKys7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjaGFuZ2VzKSB7XG5cdCAgICAgIHRoaXMuZGlmZkNsZWFudXBNZXJnZShkaWZmcyk7XG5cdCAgICB9XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBDb252ZXJ0IGEgZGlmZiBhcnJheSBpbnRvIGEgcHJldHR5IEhUTUwgcmVwb3J0LlxuXHQgICAqIEBwYXJhbSB7IUFycmF5LjwhRGlmZk1hdGNoUGF0Y2guRGlmZj59IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuXHQgICAqIEBwYXJhbSB7aW50ZWdlcn0gc3RyaW5nIHRvIGJlIGJlYXV0aWZpZWQuXG5cdCAgICogQHJldHVybiB7c3RyaW5nfSBIVE1MIHJlcHJlc2VudGF0aW9uLlxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZlByZXR0eUh0bWwgPSBmdW5jdGlvbiAoZGlmZnMpIHtcblx0ICAgIHZhciBvcCxcblx0ICAgICAgICBkYXRhLFxuXHQgICAgICAgIHgsXG5cdCAgICAgICAgaHRtbCA9IFtdO1xuXG5cdCAgICBmb3IgKHggPSAwOyB4IDwgZGlmZnMubGVuZ3RoOyB4KyspIHtcblx0ICAgICAgb3AgPSBkaWZmc1t4XVswXTsgLy8gT3BlcmF0aW9uIChpbnNlcnQsIGRlbGV0ZSwgZXF1YWwpXG5cblx0ICAgICAgZGF0YSA9IGRpZmZzW3hdWzFdOyAvLyBUZXh0IG9mIGNoYW5nZS5cblxuXHQgICAgICBzd2l0Y2ggKG9wKSB7XG5cdCAgICAgICAgY2FzZSBESUZGX0lOU0VSVDpcblx0ICAgICAgICAgIGh0bWxbeF0gPSBcIjxpbnM+XCIgKyBlc2NhcGVUZXh0KGRhdGEpICsgXCI8L2lucz5cIjtcblx0ICAgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgICAgY2FzZSBESUZGX0RFTEVURTpcblx0ICAgICAgICAgIGh0bWxbeF0gPSBcIjxkZWw+XCIgKyBlc2NhcGVUZXh0KGRhdGEpICsgXCI8L2RlbD5cIjtcblx0ICAgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgICAgY2FzZSBESUZGX0VRVUFMOlxuXHQgICAgICAgICAgaHRtbFt4XSA9IFwiPHNwYW4+XCIgKyBlc2NhcGVUZXh0KGRhdGEpICsgXCI8L3NwYW4+XCI7XG5cdCAgICAgICAgICBicmVhaztcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gaHRtbC5qb2luKFwiXCIpO1xuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogRGV0ZXJtaW5lIHRoZSBjb21tb24gcHJlZml4IG9mIHR3byBzdHJpbmdzLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIFNlY29uZCBzdHJpbmcuXG5cdCAgICogQHJldHVybiB7bnVtYmVyfSBUaGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgY29tbW9uIHRvIHRoZSBzdGFydCBvZiBlYWNoXG5cdCAgICogICAgIHN0cmluZy5cblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZDb21tb25QcmVmaXggPSBmdW5jdGlvbiAodGV4dDEsIHRleHQyKSB7XG5cdCAgICB2YXIgcG9pbnRlcm1pZCwgcG9pbnRlcm1heCwgcG9pbnRlcm1pbiwgcG9pbnRlcnN0YXJ0OyAvLyBRdWljayBjaGVjayBmb3IgY29tbW9uIG51bGwgY2FzZXMuXG5cblx0ICAgIGlmICghdGV4dDEgfHwgIXRleHQyIHx8IHRleHQxLmNoYXJBdCgwKSAhPT0gdGV4dDIuY2hhckF0KDApKSB7XG5cdCAgICAgIHJldHVybiAwO1xuXHQgICAgfSAvLyBCaW5hcnkgc2VhcmNoLlxuXHQgICAgLy8gUGVyZm9ybWFuY2UgYW5hbHlzaXM6IGh0dHBzOi8vbmVpbC5mcmFzZXIubmFtZS9uZXdzLzIwMDcvMTAvMDkvXG5cblxuXHQgICAgcG9pbnRlcm1pbiA9IDA7XG5cdCAgICBwb2ludGVybWF4ID0gTWF0aC5taW4odGV4dDEubGVuZ3RoLCB0ZXh0Mi5sZW5ndGgpO1xuXHQgICAgcG9pbnRlcm1pZCA9IHBvaW50ZXJtYXg7XG5cdCAgICBwb2ludGVyc3RhcnQgPSAwO1xuXG5cdCAgICB3aGlsZSAocG9pbnRlcm1pbiA8IHBvaW50ZXJtaWQpIHtcblx0ICAgICAgaWYgKHRleHQxLnN1YnN0cmluZyhwb2ludGVyc3RhcnQsIHBvaW50ZXJtaWQpID09PSB0ZXh0Mi5zdWJzdHJpbmcocG9pbnRlcnN0YXJ0LCBwb2ludGVybWlkKSkge1xuXHQgICAgICAgIHBvaW50ZXJtaW4gPSBwb2ludGVybWlkO1xuXHQgICAgICAgIHBvaW50ZXJzdGFydCA9IHBvaW50ZXJtaW47XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcG9pbnRlcm1heCA9IHBvaW50ZXJtaWQ7XG5cdCAgICAgIH1cblxuXHQgICAgICBwb2ludGVybWlkID0gTWF0aC5mbG9vcigocG9pbnRlcm1heCAtIHBvaW50ZXJtaW4pIC8gMiArIHBvaW50ZXJtaW4pO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gcG9pbnRlcm1pZDtcblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIERldGVybWluZSB0aGUgY29tbW9uIHN1ZmZpeCBvZiB0d28gc3RyaW5ncy5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgRmlyc3Qgc3RyaW5nLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBTZWNvbmQgc3RyaW5nLlxuXHQgICAqIEByZXR1cm4ge251bWJlcn0gVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGNvbW1vbiB0byB0aGUgZW5kIG9mIGVhY2ggc3RyaW5nLlxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkNvbW1vblN1ZmZpeCA9IGZ1bmN0aW9uICh0ZXh0MSwgdGV4dDIpIHtcblx0ICAgIHZhciBwb2ludGVybWlkLCBwb2ludGVybWF4LCBwb2ludGVybWluLCBwb2ludGVyZW5kOyAvLyBRdWljayBjaGVjayBmb3IgY29tbW9uIG51bGwgY2FzZXMuXG5cblx0ICAgIGlmICghdGV4dDEgfHwgIXRleHQyIHx8IHRleHQxLmNoYXJBdCh0ZXh0MS5sZW5ndGggLSAxKSAhPT0gdGV4dDIuY2hhckF0KHRleHQyLmxlbmd0aCAtIDEpKSB7XG5cdCAgICAgIHJldHVybiAwO1xuXHQgICAgfSAvLyBCaW5hcnkgc2VhcmNoLlxuXHQgICAgLy8gUGVyZm9ybWFuY2UgYW5hbHlzaXM6IGh0dHBzOi8vbmVpbC5mcmFzZXIubmFtZS9uZXdzLzIwMDcvMTAvMDkvXG5cblxuXHQgICAgcG9pbnRlcm1pbiA9IDA7XG5cdCAgICBwb2ludGVybWF4ID0gTWF0aC5taW4odGV4dDEubGVuZ3RoLCB0ZXh0Mi5sZW5ndGgpO1xuXHQgICAgcG9pbnRlcm1pZCA9IHBvaW50ZXJtYXg7XG5cdCAgICBwb2ludGVyZW5kID0gMDtcblxuXHQgICAgd2hpbGUgKHBvaW50ZXJtaW4gPCBwb2ludGVybWlkKSB7XG5cdCAgICAgIGlmICh0ZXh0MS5zdWJzdHJpbmcodGV4dDEubGVuZ3RoIC0gcG9pbnRlcm1pZCwgdGV4dDEubGVuZ3RoIC0gcG9pbnRlcmVuZCkgPT09IHRleHQyLnN1YnN0cmluZyh0ZXh0Mi5sZW5ndGggLSBwb2ludGVybWlkLCB0ZXh0Mi5sZW5ndGggLSBwb2ludGVyZW5kKSkge1xuXHQgICAgICAgIHBvaW50ZXJtaW4gPSBwb2ludGVybWlkO1xuXHQgICAgICAgIHBvaW50ZXJlbmQgPSBwb2ludGVybWluO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHBvaW50ZXJtYXggPSBwb2ludGVybWlkO1xuXHQgICAgICB9XG5cblx0ICAgICAgcG9pbnRlcm1pZCA9IE1hdGguZmxvb3IoKHBvaW50ZXJtYXggLSBwb2ludGVybWluKSAvIDIgKyBwb2ludGVybWluKTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHBvaW50ZXJtaWQ7XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBGaW5kIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHR3byB0ZXh0cy4gIEFzc3VtZXMgdGhhdCB0aGUgdGV4dHMgZG8gbm90XG5cdCAgICogaGF2ZSBhbnkgY29tbW9uIHByZWZpeCBvciBzdWZmaXguXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cblx0ICAgKiBAcGFyYW0ge2Jvb2xlYW59IGNoZWNrbGluZXMgU3BlZWR1cCBmbGFnLiAgSWYgZmFsc2UsIHRoZW4gZG9uJ3QgcnVuIGFcblx0ICAgKiAgICAgbGluZS1sZXZlbCBkaWZmIGZpcnN0IHRvIGlkZW50aWZ5IHRoZSBjaGFuZ2VkIGFyZWFzLlxuXHQgICAqICAgICBJZiB0cnVlLCB0aGVuIHJ1biBhIGZhc3Rlciwgc2xpZ2h0bHkgbGVzcyBvcHRpbWFsIGRpZmYuXG5cdCAgICogQHBhcmFtIHtudW1iZXJ9IGRlYWRsaW5lIFRpbWUgd2hlbiB0aGUgZGlmZiBzaG91bGQgYmUgY29tcGxldGUgYnkuXG5cdCAgICogQHJldHVybiB7IUFycmF5LjwhRGlmZk1hdGNoUGF0Y2guRGlmZj59IEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuXHQgICAqIEBwcml2YXRlXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmQ29tcHV0ZSA9IGZ1bmN0aW9uICh0ZXh0MSwgdGV4dDIsIGNoZWNrbGluZXMsIGRlYWRsaW5lKSB7XG5cdCAgICB2YXIgZGlmZnMsIGxvbmd0ZXh0LCBzaG9ydHRleHQsIGksIGhtLCB0ZXh0MUEsIHRleHQyQSwgdGV4dDFCLCB0ZXh0MkIsIG1pZENvbW1vbiwgZGlmZnNBLCBkaWZmc0I7XG5cblx0ICAgIGlmICghdGV4dDEpIHtcblx0ICAgICAgLy8gSnVzdCBhZGQgc29tZSB0ZXh0IChzcGVlZHVwKS5cblx0ICAgICAgcmV0dXJuIFtbRElGRl9JTlNFUlQsIHRleHQyXV07XG5cdCAgICB9XG5cblx0ICAgIGlmICghdGV4dDIpIHtcblx0ICAgICAgLy8gSnVzdCBkZWxldGUgc29tZSB0ZXh0IChzcGVlZHVwKS5cblx0ICAgICAgcmV0dXJuIFtbRElGRl9ERUxFVEUsIHRleHQxXV07XG5cdCAgICB9XG5cblx0ICAgIGxvbmd0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDEgOiB0ZXh0Mjtcblx0ICAgIHNob3J0dGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQyIDogdGV4dDE7XG5cdCAgICBpID0gbG9uZ3RleHQuaW5kZXhPZihzaG9ydHRleHQpO1xuXG5cdCAgICBpZiAoaSAhPT0gLTEpIHtcblx0ICAgICAgLy8gU2hvcnRlciB0ZXh0IGlzIGluc2lkZSB0aGUgbG9uZ2VyIHRleHQgKHNwZWVkdXApLlxuXHQgICAgICBkaWZmcyA9IFtbRElGRl9JTlNFUlQsIGxvbmd0ZXh0LnN1YnN0cmluZygwLCBpKV0sIFtESUZGX0VRVUFMLCBzaG9ydHRleHRdLCBbRElGRl9JTlNFUlQsIGxvbmd0ZXh0LnN1YnN0cmluZyhpICsgc2hvcnR0ZXh0Lmxlbmd0aCldXTsgLy8gU3dhcCBpbnNlcnRpb25zIGZvciBkZWxldGlvbnMgaWYgZGlmZiBpcyByZXZlcnNlZC5cblxuXHQgICAgICBpZiAodGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoKSB7XG5cdCAgICAgICAgZGlmZnNbMF1bMF0gPSBkaWZmc1syXVswXSA9IERJRkZfREVMRVRFO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIGRpZmZzO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoc2hvcnR0ZXh0Lmxlbmd0aCA9PT0gMSkge1xuXHQgICAgICAvLyBTaW5nbGUgY2hhcmFjdGVyIHN0cmluZy5cblx0ICAgICAgLy8gQWZ0ZXIgdGhlIHByZXZpb3VzIHNwZWVkdXAsIHRoZSBjaGFyYWN0ZXIgY2FuJ3QgYmUgYW4gZXF1YWxpdHkuXG5cdCAgICAgIHJldHVybiBbW0RJRkZfREVMRVRFLCB0ZXh0MV0sIFtESUZGX0lOU0VSVCwgdGV4dDJdXTtcblx0ICAgIH0gLy8gQ2hlY2sgdG8gc2VlIGlmIHRoZSBwcm9ibGVtIGNhbiBiZSBzcGxpdCBpbiB0d28uXG5cblxuXHQgICAgaG0gPSB0aGlzLmRpZmZIYWxmTWF0Y2godGV4dDEsIHRleHQyKTtcblxuXHQgICAgaWYgKGhtKSB7XG5cdCAgICAgIC8vIEEgaGFsZi1tYXRjaCB3YXMgZm91bmQsIHNvcnQgb3V0IHRoZSByZXR1cm4gZGF0YS5cblx0ICAgICAgdGV4dDFBID0gaG1bMF07XG5cdCAgICAgIHRleHQxQiA9IGhtWzFdO1xuXHQgICAgICB0ZXh0MkEgPSBobVsyXTtcblx0ICAgICAgdGV4dDJCID0gaG1bM107XG5cdCAgICAgIG1pZENvbW1vbiA9IGhtWzRdOyAvLyBTZW5kIGJvdGggcGFpcnMgb2ZmIGZvciBzZXBhcmF0ZSBwcm9jZXNzaW5nLlxuXG5cdCAgICAgIGRpZmZzQSA9IHRoaXMuRGlmZk1haW4odGV4dDFBLCB0ZXh0MkEsIGNoZWNrbGluZXMsIGRlYWRsaW5lKTtcblx0ICAgICAgZGlmZnNCID0gdGhpcy5EaWZmTWFpbih0ZXh0MUIsIHRleHQyQiwgY2hlY2tsaW5lcywgZGVhZGxpbmUpOyAvLyBNZXJnZSB0aGUgcmVzdWx0cy5cblxuXHQgICAgICByZXR1cm4gZGlmZnNBLmNvbmNhdChbW0RJRkZfRVFVQUwsIG1pZENvbW1vbl1dLCBkaWZmc0IpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY2hlY2tsaW5lcyAmJiB0ZXh0MS5sZW5ndGggPiAxMDAgJiYgdGV4dDIubGVuZ3RoID4gMTAwKSB7XG5cdCAgICAgIHJldHVybiB0aGlzLmRpZmZMaW5lTW9kZSh0ZXh0MSwgdGV4dDIsIGRlYWRsaW5lKTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHRoaXMuZGlmZkJpc2VjdCh0ZXh0MSwgdGV4dDIsIGRlYWRsaW5lKTtcblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIERvIHRoZSB0d28gdGV4dHMgc2hhcmUgYSBzdWJzdHJpbmcgd2hpY2ggaXMgYXQgbGVhc3QgaGFsZiB0aGUgbGVuZ3RoIG9mIHRoZVxuXHQgICAqIGxvbmdlciB0ZXh0P1xuXHQgICAqIFRoaXMgc3BlZWR1cCBjYW4gcHJvZHVjZSBub24tbWluaW1hbCBkaWZmcy5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgRmlyc3Qgc3RyaW5nLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBTZWNvbmQgc3RyaW5nLlxuXHQgICAqIEByZXR1cm4ge0FycmF5LjxzdHJpbmc+fSBGaXZlIGVsZW1lbnQgQXJyYXksIGNvbnRhaW5pbmcgdGhlIHByZWZpeCBvZlxuXHQgICAqICAgICB0ZXh0MSwgdGhlIHN1ZmZpeCBvZiB0ZXh0MSwgdGhlIHByZWZpeCBvZiB0ZXh0MiwgdGhlIHN1ZmZpeCBvZlxuXHQgICAqICAgICB0ZXh0MiBhbmQgdGhlIGNvbW1vbiBtaWRkbGUuICBPciBudWxsIGlmIHRoZXJlIHdhcyBubyBtYXRjaC5cblx0ICAgKiBAcHJpdmF0ZVxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkhhbGZNYXRjaCA9IGZ1bmN0aW9uICh0ZXh0MSwgdGV4dDIpIHtcblx0ICAgIHZhciBsb25ndGV4dCwgc2hvcnR0ZXh0LCBkbXAsIHRleHQxQSwgdGV4dDJCLCB0ZXh0MkEsIHRleHQxQiwgbWlkQ29tbW9uLCBobTEsIGhtMiwgaG07XG5cdCAgICBsb25ndGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQxIDogdGV4dDI7XG5cdCAgICBzaG9ydHRleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MiA6IHRleHQxO1xuXG5cdCAgICBpZiAobG9uZ3RleHQubGVuZ3RoIDwgNCB8fCBzaG9ydHRleHQubGVuZ3RoICogMiA8IGxvbmd0ZXh0Lmxlbmd0aCkge1xuXHQgICAgICByZXR1cm4gbnVsbDsgLy8gUG9pbnRsZXNzLlxuXHQgICAgfVxuXG5cdCAgICBkbXAgPSB0aGlzOyAvLyAndGhpcycgYmVjb21lcyAnd2luZG93JyBpbiBhIGNsb3N1cmUuXG5cblx0ICAgIC8qKlxuXHQgICAgICogRG9lcyBhIHN1YnN0cmluZyBvZiBzaG9ydHRleHQgZXhpc3Qgd2l0aGluIGxvbmd0ZXh0IHN1Y2ggdGhhdCB0aGUgc3Vic3RyaW5nXG5cdCAgICAgKiBpcyBhdCBsZWFzdCBoYWxmIHRoZSBsZW5ndGggb2YgbG9uZ3RleHQ/XG5cdCAgICAgKiBDbG9zdXJlLCBidXQgZG9lcyBub3QgcmVmZXJlbmNlIGFueSBleHRlcm5hbCB2YXJpYWJsZXMuXG5cdCAgICAgKiBAcGFyYW0ge3N0cmluZ30gbG9uZ3RleHQgTG9uZ2VyIHN0cmluZy5cblx0ICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzaG9ydHRleHQgU2hvcnRlciBzdHJpbmcuXG5cdCAgICAgKiBAcGFyYW0ge251bWJlcn0gaSBTdGFydCBpbmRleCBvZiBxdWFydGVyIGxlbmd0aCBzdWJzdHJpbmcgd2l0aGluIGxvbmd0ZXh0LlxuXHQgICAgICogQHJldHVybiB7QXJyYXkuPHN0cmluZz59IEZpdmUgZWxlbWVudCBBcnJheSwgY29udGFpbmluZyB0aGUgcHJlZml4IG9mXG5cdCAgICAgKiAgICAgbG9uZ3RleHQsIHRoZSBzdWZmaXggb2YgbG9uZ3RleHQsIHRoZSBwcmVmaXggb2Ygc2hvcnR0ZXh0LCB0aGUgc3VmZml4XG5cdCAgICAgKiAgICAgb2Ygc2hvcnR0ZXh0IGFuZCB0aGUgY29tbW9uIG1pZGRsZS4gIE9yIG51bGwgaWYgdGhlcmUgd2FzIG5vIG1hdGNoLlxuXHQgICAgICogQHByaXZhdGVcblx0ICAgICAqL1xuXG5cdCAgICBmdW5jdGlvbiBkaWZmSGFsZk1hdGNoSShsb25ndGV4dCwgc2hvcnR0ZXh0LCBpKSB7XG5cdCAgICAgIHZhciBzZWVkLCBqLCBiZXN0Q29tbW9uLCBwcmVmaXhMZW5ndGgsIHN1ZmZpeExlbmd0aCwgYmVzdExvbmd0ZXh0QSwgYmVzdExvbmd0ZXh0QiwgYmVzdFNob3J0dGV4dEEsIGJlc3RTaG9ydHRleHRCOyAvLyBTdGFydCB3aXRoIGEgMS80IGxlbmd0aCBzdWJzdHJpbmcgYXQgcG9zaXRpb24gaSBhcyBhIHNlZWQuXG5cblx0ICAgICAgc2VlZCA9IGxvbmd0ZXh0LnN1YnN0cmluZyhpLCBpICsgTWF0aC5mbG9vcihsb25ndGV4dC5sZW5ndGggLyA0KSk7XG5cdCAgICAgIGogPSAtMTtcblx0ICAgICAgYmVzdENvbW1vbiA9IFwiXCI7XG5cblx0ICAgICAgd2hpbGUgKChqID0gc2hvcnR0ZXh0LmluZGV4T2Yoc2VlZCwgaiArIDEpKSAhPT0gLTEpIHtcblx0ICAgICAgICBwcmVmaXhMZW5ndGggPSBkbXAuZGlmZkNvbW1vblByZWZpeChsb25ndGV4dC5zdWJzdHJpbmcoaSksIHNob3J0dGV4dC5zdWJzdHJpbmcoaikpO1xuXHQgICAgICAgIHN1ZmZpeExlbmd0aCA9IGRtcC5kaWZmQ29tbW9uU3VmZml4KGxvbmd0ZXh0LnN1YnN0cmluZygwLCBpKSwgc2hvcnR0ZXh0LnN1YnN0cmluZygwLCBqKSk7XG5cblx0ICAgICAgICBpZiAoYmVzdENvbW1vbi5sZW5ndGggPCBzdWZmaXhMZW5ndGggKyBwcmVmaXhMZW5ndGgpIHtcblx0ICAgICAgICAgIGJlc3RDb21tb24gPSBzaG9ydHRleHQuc3Vic3RyaW5nKGogLSBzdWZmaXhMZW5ndGgsIGopICsgc2hvcnR0ZXh0LnN1YnN0cmluZyhqLCBqICsgcHJlZml4TGVuZ3RoKTtcblx0ICAgICAgICAgIGJlc3RMb25ndGV4dEEgPSBsb25ndGV4dC5zdWJzdHJpbmcoMCwgaSAtIHN1ZmZpeExlbmd0aCk7XG5cdCAgICAgICAgICBiZXN0TG9uZ3RleHRCID0gbG9uZ3RleHQuc3Vic3RyaW5nKGkgKyBwcmVmaXhMZW5ndGgpO1xuXHQgICAgICAgICAgYmVzdFNob3J0dGV4dEEgPSBzaG9ydHRleHQuc3Vic3RyaW5nKDAsIGogLSBzdWZmaXhMZW5ndGgpO1xuXHQgICAgICAgICAgYmVzdFNob3J0dGV4dEIgPSBzaG9ydHRleHQuc3Vic3RyaW5nKGogKyBwcmVmaXhMZW5ndGgpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChiZXN0Q29tbW9uLmxlbmd0aCAqIDIgPj0gbG9uZ3RleHQubGVuZ3RoKSB7XG5cdCAgICAgICAgcmV0dXJuIFtiZXN0TG9uZ3RleHRBLCBiZXN0TG9uZ3RleHRCLCBiZXN0U2hvcnR0ZXh0QSwgYmVzdFNob3J0dGV4dEIsIGJlc3RDb21tb25dO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHJldHVybiBudWxsO1xuXHQgICAgICB9XG5cdCAgICB9IC8vIEZpcnN0IGNoZWNrIGlmIHRoZSBzZWNvbmQgcXVhcnRlciBpcyB0aGUgc2VlZCBmb3IgYSBoYWxmLW1hdGNoLlxuXG5cblx0ICAgIGhtMSA9IGRpZmZIYWxmTWF0Y2hJKGxvbmd0ZXh0LCBzaG9ydHRleHQsIE1hdGguY2VpbChsb25ndGV4dC5sZW5ndGggLyA0KSk7IC8vIENoZWNrIGFnYWluIGJhc2VkIG9uIHRoZSB0aGlyZCBxdWFydGVyLlxuXG5cdCAgICBobTIgPSBkaWZmSGFsZk1hdGNoSShsb25ndGV4dCwgc2hvcnR0ZXh0LCBNYXRoLmNlaWwobG9uZ3RleHQubGVuZ3RoIC8gMikpO1xuXG5cdCAgICBpZiAoIWhtMSAmJiAhaG0yKSB7XG5cdCAgICAgIHJldHVybiBudWxsO1xuXHQgICAgfSBlbHNlIGlmICghaG0yKSB7XG5cdCAgICAgIGhtID0gaG0xO1xuXHQgICAgfSBlbHNlIGlmICghaG0xKSB7XG5cdCAgICAgIGhtID0gaG0yO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgLy8gQm90aCBtYXRjaGVkLiAgU2VsZWN0IHRoZSBsb25nZXN0LlxuXHQgICAgICBobSA9IGhtMVs0XS5sZW5ndGggPiBobTJbNF0ubGVuZ3RoID8gaG0xIDogaG0yO1xuXHQgICAgfSAvLyBBIGhhbGYtbWF0Y2ggd2FzIGZvdW5kLCBzb3J0IG91dCB0aGUgcmV0dXJuIGRhdGEuXG5cblxuXHQgICAgaWYgKHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCkge1xuXHQgICAgICB0ZXh0MUEgPSBobVswXTtcblx0ICAgICAgdGV4dDFCID0gaG1bMV07XG5cdCAgICAgIHRleHQyQSA9IGhtWzJdO1xuXHQgICAgICB0ZXh0MkIgPSBobVszXTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHRleHQyQSA9IGhtWzBdO1xuXHQgICAgICB0ZXh0MkIgPSBobVsxXTtcblx0ICAgICAgdGV4dDFBID0gaG1bMl07XG5cdCAgICAgIHRleHQxQiA9IGhtWzNdO1xuXHQgICAgfVxuXG5cdCAgICBtaWRDb21tb24gPSBobVs0XTtcblx0ICAgIHJldHVybiBbdGV4dDFBLCB0ZXh0MUIsIHRleHQyQSwgdGV4dDJCLCBtaWRDb21tb25dO1xuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogRG8gYSBxdWljayBsaW5lLWxldmVsIGRpZmYgb24gYm90aCBzdHJpbmdzLCB0aGVuIHJlZGlmZiB0aGUgcGFydHMgZm9yXG5cdCAgICogZ3JlYXRlciBhY2N1cmFjeS5cblx0ICAgKiBUaGlzIHNwZWVkdXAgY2FuIHByb2R1Y2Ugbm9uLW1pbmltYWwgZGlmZnMuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cblx0ICAgKiBAcGFyYW0ge251bWJlcn0gZGVhZGxpbmUgVGltZSB3aGVuIHRoZSBkaWZmIHNob3VsZCBiZSBjb21wbGV0ZSBieS5cblx0ICAgKiBAcmV0dXJuIHshQXJyYXkuPCFEaWZmTWF0Y2hQYXRjaC5EaWZmPn0gQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG5cdCAgICogQHByaXZhdGVcblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZMaW5lTW9kZSA9IGZ1bmN0aW9uICh0ZXh0MSwgdGV4dDIsIGRlYWRsaW5lKSB7XG5cdCAgICB2YXIgYSwgZGlmZnMsIGxpbmVhcnJheSwgcG9pbnRlciwgY291bnRJbnNlcnQsIGNvdW50RGVsZXRlLCB0ZXh0SW5zZXJ0LCB0ZXh0RGVsZXRlLCBqOyAvLyBTY2FuIHRoZSB0ZXh0IG9uIGEgbGluZS1ieS1saW5lIGJhc2lzIGZpcnN0LlxuXG5cdCAgICBhID0gdGhpcy5kaWZmTGluZXNUb0NoYXJzKHRleHQxLCB0ZXh0Mik7XG5cdCAgICB0ZXh0MSA9IGEuY2hhcnMxO1xuXHQgICAgdGV4dDIgPSBhLmNoYXJzMjtcblx0ICAgIGxpbmVhcnJheSA9IGEubGluZUFycmF5O1xuXHQgICAgZGlmZnMgPSB0aGlzLkRpZmZNYWluKHRleHQxLCB0ZXh0MiwgZmFsc2UsIGRlYWRsaW5lKTsgLy8gQ29udmVydCB0aGUgZGlmZiBiYWNrIHRvIG9yaWdpbmFsIHRleHQuXG5cblx0ICAgIHRoaXMuZGlmZkNoYXJzVG9MaW5lcyhkaWZmcywgbGluZWFycmF5KTsgLy8gRWxpbWluYXRlIGZyZWFrIG1hdGNoZXMgKGUuZy4gYmxhbmsgbGluZXMpXG5cblx0ICAgIHRoaXMuZGlmZkNsZWFudXBTZW1hbnRpYyhkaWZmcyk7IC8vIFJlZGlmZiBhbnkgcmVwbGFjZW1lbnQgYmxvY2tzLCB0aGlzIHRpbWUgY2hhcmFjdGVyLWJ5LWNoYXJhY3Rlci5cblx0ICAgIC8vIEFkZCBhIGR1bW15IGVudHJ5IGF0IHRoZSBlbmQuXG5cblx0ICAgIGRpZmZzLnB1c2goW0RJRkZfRVFVQUwsIFwiXCJdKTtcblx0ICAgIHBvaW50ZXIgPSAwO1xuXHQgICAgY291bnREZWxldGUgPSAwO1xuXHQgICAgY291bnRJbnNlcnQgPSAwO1xuXHQgICAgdGV4dERlbGV0ZSA9IFwiXCI7XG5cdCAgICB0ZXh0SW5zZXJ0ID0gXCJcIjtcblxuXHQgICAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGgpIHtcblx0ICAgICAgc3dpdGNoIChkaWZmc1twb2ludGVyXVswXSkge1xuXHQgICAgICAgIGNhc2UgRElGRl9JTlNFUlQ6XG5cdCAgICAgICAgICBjb3VudEluc2VydCsrO1xuXHQgICAgICAgICAgdGV4dEluc2VydCArPSBkaWZmc1twb2ludGVyXVsxXTtcblx0ICAgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgICAgY2FzZSBESUZGX0RFTEVURTpcblx0ICAgICAgICAgIGNvdW50RGVsZXRlKys7XG5cdCAgICAgICAgICB0ZXh0RGVsZXRlICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuXHQgICAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgICBjYXNlIERJRkZfRVFVQUw6XG5cdCAgICAgICAgICAvLyBVcG9uIHJlYWNoaW5nIGFuIGVxdWFsaXR5LCBjaGVjayBmb3IgcHJpb3IgcmVkdW5kYW5jaWVzLlxuXHQgICAgICAgICAgaWYgKGNvdW50RGVsZXRlID49IDEgJiYgY291bnRJbnNlcnQgPj0gMSkge1xuXHQgICAgICAgICAgICAvLyBEZWxldGUgdGhlIG9mZmVuZGluZyByZWNvcmRzIGFuZCBhZGQgdGhlIG1lcmdlZCBvbmVzLlxuXHQgICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIGNvdW50RGVsZXRlIC0gY291bnRJbnNlcnQsIGNvdW50RGVsZXRlICsgY291bnRJbnNlcnQpO1xuXHQgICAgICAgICAgICBwb2ludGVyID0gcG9pbnRlciAtIGNvdW50RGVsZXRlIC0gY291bnRJbnNlcnQ7XG5cdCAgICAgICAgICAgIGEgPSB0aGlzLkRpZmZNYWluKHRleHREZWxldGUsIHRleHRJbnNlcnQsIGZhbHNlLCBkZWFkbGluZSk7XG5cblx0ICAgICAgICAgICAgZm9yIChqID0gYS5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xuXHQgICAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyLCAwLCBhW2pdKTtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIHBvaW50ZXIgPSBwb2ludGVyICsgYS5sZW5ndGg7XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIGNvdW50SW5zZXJ0ID0gMDtcblx0ICAgICAgICAgIGNvdW50RGVsZXRlID0gMDtcblx0ICAgICAgICAgIHRleHREZWxldGUgPSBcIlwiO1xuXHQgICAgICAgICAgdGV4dEluc2VydCA9IFwiXCI7XG5cdCAgICAgICAgICBicmVhaztcblx0ICAgICAgfVxuXG5cdCAgICAgIHBvaW50ZXIrKztcblx0ICAgIH1cblxuXHQgICAgZGlmZnMucG9wKCk7IC8vIFJlbW92ZSB0aGUgZHVtbXkgZW50cnkgYXQgdGhlIGVuZC5cblxuXHQgICAgcmV0dXJuIGRpZmZzO1xuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogRmluZCB0aGUgJ21pZGRsZSBzbmFrZScgb2YgYSBkaWZmLCBzcGxpdCB0aGUgcHJvYmxlbSBpbiB0d29cblx0ICAgKiBhbmQgcmV0dXJuIHRoZSByZWN1cnNpdmVseSBjb25zdHJ1Y3RlZCBkaWZmLlxuXHQgICAqIFNlZSBNeWVycyAxOTg2IHBhcGVyOiBBbiBPKE5EKSBEaWZmZXJlbmNlIEFsZ29yaXRobSBhbmQgSXRzIFZhcmlhdGlvbnMuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cblx0ICAgKiBAcGFyYW0ge251bWJlcn0gZGVhZGxpbmUgVGltZSBhdCB3aGljaCB0byBiYWlsIGlmIG5vdCB5ZXQgY29tcGxldGUuXG5cdCAgICogQHJldHVybiB7IUFycmF5LjwhRGlmZk1hdGNoUGF0Y2guRGlmZj59IEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuXHQgICAqIEBwcml2YXRlXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmQmlzZWN0ID0gZnVuY3Rpb24gKHRleHQxLCB0ZXh0MiwgZGVhZGxpbmUpIHtcblx0ICAgIHZhciB0ZXh0MUxlbmd0aCwgdGV4dDJMZW5ndGgsIG1heEQsIHZPZmZzZXQsIHZMZW5ndGgsIHYxLCB2MiwgeCwgZGVsdGEsIGZyb250LCBrMXN0YXJ0LCBrMWVuZCwgazJzdGFydCwgazJlbmQsIGsyT2Zmc2V0LCBrMU9mZnNldCwgeDEsIHgyLCB5MSwgeTIsIGQsIGsxLCBrMjsgLy8gQ2FjaGUgdGhlIHRleHQgbGVuZ3RocyB0byBwcmV2ZW50IG11bHRpcGxlIGNhbGxzLlxuXG5cdCAgICB0ZXh0MUxlbmd0aCA9IHRleHQxLmxlbmd0aDtcblx0ICAgIHRleHQyTGVuZ3RoID0gdGV4dDIubGVuZ3RoO1xuXHQgICAgbWF4RCA9IE1hdGguY2VpbCgodGV4dDFMZW5ndGggKyB0ZXh0Mkxlbmd0aCkgLyAyKTtcblx0ICAgIHZPZmZzZXQgPSBtYXhEO1xuXHQgICAgdkxlbmd0aCA9IDIgKiBtYXhEO1xuXHQgICAgdjEgPSBuZXcgQXJyYXkodkxlbmd0aCk7XG5cdCAgICB2MiA9IG5ldyBBcnJheSh2TGVuZ3RoKTsgLy8gU2V0dGluZyBhbGwgZWxlbWVudHMgdG8gLTEgaXMgZmFzdGVyIGluIENocm9tZSAmIEZpcmVmb3ggdGhhbiBtaXhpbmdcblx0ICAgIC8vIGludGVnZXJzIGFuZCB1bmRlZmluZWQuXG5cblx0ICAgIGZvciAoeCA9IDA7IHggPCB2TGVuZ3RoOyB4KyspIHtcblx0ICAgICAgdjFbeF0gPSAtMTtcblx0ICAgICAgdjJbeF0gPSAtMTtcblx0ICAgIH1cblxuXHQgICAgdjFbdk9mZnNldCArIDFdID0gMDtcblx0ICAgIHYyW3ZPZmZzZXQgKyAxXSA9IDA7XG5cdCAgICBkZWx0YSA9IHRleHQxTGVuZ3RoIC0gdGV4dDJMZW5ndGg7IC8vIElmIHRoZSB0b3RhbCBudW1iZXIgb2YgY2hhcmFjdGVycyBpcyBvZGQsIHRoZW4gdGhlIGZyb250IHBhdGggd2lsbCBjb2xsaWRlXG5cdCAgICAvLyB3aXRoIHRoZSByZXZlcnNlIHBhdGguXG5cblx0ICAgIGZyb250ID0gZGVsdGEgJSAyICE9PSAwOyAvLyBPZmZzZXRzIGZvciBzdGFydCBhbmQgZW5kIG9mIGsgbG9vcC5cblx0ICAgIC8vIFByZXZlbnRzIG1hcHBpbmcgb2Ygc3BhY2UgYmV5b25kIHRoZSBncmlkLlxuXG5cdCAgICBrMXN0YXJ0ID0gMDtcblx0ICAgIGsxZW5kID0gMDtcblx0ICAgIGsyc3RhcnQgPSAwO1xuXHQgICAgazJlbmQgPSAwO1xuXG5cdCAgICBmb3IgKGQgPSAwOyBkIDwgbWF4RDsgZCsrKSB7XG5cdCAgICAgIC8vIEJhaWwgb3V0IGlmIGRlYWRsaW5lIGlzIHJlYWNoZWQuXG5cdCAgICAgIGlmIChuZXcgRGF0ZSgpLmdldFRpbWUoKSA+IGRlYWRsaW5lKSB7XG5cdCAgICAgICAgYnJlYWs7XG5cdCAgICAgIH0gLy8gV2FsayB0aGUgZnJvbnQgcGF0aCBvbmUgc3RlcC5cblxuXG5cdCAgICAgIGZvciAoazEgPSAtZCArIGsxc3RhcnQ7IGsxIDw9IGQgLSBrMWVuZDsgazEgKz0gMikge1xuXHQgICAgICAgIGsxT2Zmc2V0ID0gdk9mZnNldCArIGsxO1xuXG5cdCAgICAgICAgaWYgKGsxID09PSAtZCB8fCBrMSAhPT0gZCAmJiB2MVtrMU9mZnNldCAtIDFdIDwgdjFbazFPZmZzZXQgKyAxXSkge1xuXHQgICAgICAgICAgeDEgPSB2MVtrMU9mZnNldCArIDFdO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICB4MSA9IHYxW2sxT2Zmc2V0IC0gMV0gKyAxO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHkxID0geDEgLSBrMTtcblxuXHQgICAgICAgIHdoaWxlICh4MSA8IHRleHQxTGVuZ3RoICYmIHkxIDwgdGV4dDJMZW5ndGggJiYgdGV4dDEuY2hhckF0KHgxKSA9PT0gdGV4dDIuY2hhckF0KHkxKSkge1xuXHQgICAgICAgICAgeDErKztcblx0ICAgICAgICAgIHkxKys7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgdjFbazFPZmZzZXRdID0geDE7XG5cblx0ICAgICAgICBpZiAoeDEgPiB0ZXh0MUxlbmd0aCkge1xuXHQgICAgICAgICAgLy8gUmFuIG9mZiB0aGUgcmlnaHQgb2YgdGhlIGdyYXBoLlxuXHQgICAgICAgICAgazFlbmQgKz0gMjtcblx0ICAgICAgICB9IGVsc2UgaWYgKHkxID4gdGV4dDJMZW5ndGgpIHtcblx0ICAgICAgICAgIC8vIFJhbiBvZmYgdGhlIGJvdHRvbSBvZiB0aGUgZ3JhcGguXG5cdCAgICAgICAgICBrMXN0YXJ0ICs9IDI7XG5cdCAgICAgICAgfSBlbHNlIGlmIChmcm9udCkge1xuXHQgICAgICAgICAgazJPZmZzZXQgPSB2T2Zmc2V0ICsgZGVsdGEgLSBrMTtcblxuXHQgICAgICAgICAgaWYgKGsyT2Zmc2V0ID49IDAgJiYgazJPZmZzZXQgPCB2TGVuZ3RoICYmIHYyW2syT2Zmc2V0XSAhPT0gLTEpIHtcblx0ICAgICAgICAgICAgLy8gTWlycm9yIHgyIG9udG8gdG9wLWxlZnQgY29vcmRpbmF0ZSBzeXN0ZW0uXG5cdCAgICAgICAgICAgIHgyID0gdGV4dDFMZW5ndGggLSB2MltrMk9mZnNldF07XG5cblx0ICAgICAgICAgICAgaWYgKHgxID49IHgyKSB7XG5cdCAgICAgICAgICAgICAgLy8gT3ZlcmxhcCBkZXRlY3RlZC5cblx0ICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kaWZmQmlzZWN0U3BsaXQodGV4dDEsIHRleHQyLCB4MSwgeTEsIGRlYWRsaW5lKTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblx0ICAgICAgfSAvLyBXYWxrIHRoZSByZXZlcnNlIHBhdGggb25lIHN0ZXAuXG5cblxuXHQgICAgICBmb3IgKGsyID0gLWQgKyBrMnN0YXJ0OyBrMiA8PSBkIC0gazJlbmQ7IGsyICs9IDIpIHtcblx0ICAgICAgICBrMk9mZnNldCA9IHZPZmZzZXQgKyBrMjtcblxuXHQgICAgICAgIGlmIChrMiA9PT0gLWQgfHwgazIgIT09IGQgJiYgdjJbazJPZmZzZXQgLSAxXSA8IHYyW2syT2Zmc2V0ICsgMV0pIHtcblx0ICAgICAgICAgIHgyID0gdjJbazJPZmZzZXQgKyAxXTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgeDIgPSB2MltrMk9mZnNldCAtIDFdICsgMTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICB5MiA9IHgyIC0gazI7XG5cblx0ICAgICAgICB3aGlsZSAoeDIgPCB0ZXh0MUxlbmd0aCAmJiB5MiA8IHRleHQyTGVuZ3RoICYmIHRleHQxLmNoYXJBdCh0ZXh0MUxlbmd0aCAtIHgyIC0gMSkgPT09IHRleHQyLmNoYXJBdCh0ZXh0Mkxlbmd0aCAtIHkyIC0gMSkpIHtcblx0ICAgICAgICAgIHgyKys7XG5cdCAgICAgICAgICB5MisrO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHYyW2syT2Zmc2V0XSA9IHgyO1xuXG5cdCAgICAgICAgaWYgKHgyID4gdGV4dDFMZW5ndGgpIHtcblx0ICAgICAgICAgIC8vIFJhbiBvZmYgdGhlIGxlZnQgb2YgdGhlIGdyYXBoLlxuXHQgICAgICAgICAgazJlbmQgKz0gMjtcblx0ICAgICAgICB9IGVsc2UgaWYgKHkyID4gdGV4dDJMZW5ndGgpIHtcblx0ICAgICAgICAgIC8vIFJhbiBvZmYgdGhlIHRvcCBvZiB0aGUgZ3JhcGguXG5cdCAgICAgICAgICBrMnN0YXJ0ICs9IDI7XG5cdCAgICAgICAgfSBlbHNlIGlmICghZnJvbnQpIHtcblx0ICAgICAgICAgIGsxT2Zmc2V0ID0gdk9mZnNldCArIGRlbHRhIC0gazI7XG5cblx0ICAgICAgICAgIGlmIChrMU9mZnNldCA+PSAwICYmIGsxT2Zmc2V0IDwgdkxlbmd0aCAmJiB2MVtrMU9mZnNldF0gIT09IC0xKSB7XG5cdCAgICAgICAgICAgIHgxID0gdjFbazFPZmZzZXRdO1xuXHQgICAgICAgICAgICB5MSA9IHZPZmZzZXQgKyB4MSAtIGsxT2Zmc2V0OyAvLyBNaXJyb3IgeDIgb250byB0b3AtbGVmdCBjb29yZGluYXRlIHN5c3RlbS5cblxuXHQgICAgICAgICAgICB4MiA9IHRleHQxTGVuZ3RoIC0geDI7XG5cblx0ICAgICAgICAgICAgaWYgKHgxID49IHgyKSB7XG5cdCAgICAgICAgICAgICAgLy8gT3ZlcmxhcCBkZXRlY3RlZC5cblx0ICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kaWZmQmlzZWN0U3BsaXQodGV4dDEsIHRleHQyLCB4MSwgeTEsIGRlYWRsaW5lKTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfSAvLyBEaWZmIHRvb2sgdG9vIGxvbmcgYW5kIGhpdCB0aGUgZGVhZGxpbmUgb3Jcblx0ICAgIC8vIG51bWJlciBvZiBkaWZmcyBlcXVhbHMgbnVtYmVyIG9mIGNoYXJhY3RlcnMsIG5vIGNvbW1vbmFsaXR5IGF0IGFsbC5cblxuXG5cdCAgICByZXR1cm4gW1tESUZGX0RFTEVURSwgdGV4dDFdLCBbRElGRl9JTlNFUlQsIHRleHQyXV07XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBHaXZlbiB0aGUgbG9jYXRpb24gb2YgdGhlICdtaWRkbGUgc25ha2UnLCBzcGxpdCB0aGUgZGlmZiBpbiB0d28gcGFydHNcblx0ICAgKiBhbmQgcmVjdXJzZS5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuXHQgICAqIEBwYXJhbSB7bnVtYmVyfSB4IEluZGV4IG9mIHNwbGl0IHBvaW50IGluIHRleHQxLlxuXHQgICAqIEBwYXJhbSB7bnVtYmVyfSB5IEluZGV4IG9mIHNwbGl0IHBvaW50IGluIHRleHQyLlxuXHQgICAqIEBwYXJhbSB7bnVtYmVyfSBkZWFkbGluZSBUaW1lIGF0IHdoaWNoIHRvIGJhaWwgaWYgbm90IHlldCBjb21wbGV0ZS5cblx0ICAgKiBAcmV0dXJuIHshQXJyYXkuPCFEaWZmTWF0Y2hQYXRjaC5EaWZmPn0gQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG5cdCAgICogQHByaXZhdGVcblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZCaXNlY3RTcGxpdCA9IGZ1bmN0aW9uICh0ZXh0MSwgdGV4dDIsIHgsIHksIGRlYWRsaW5lKSB7XG5cdCAgICB2YXIgdGV4dDFhLCB0ZXh0MWIsIHRleHQyYSwgdGV4dDJiLCBkaWZmcywgZGlmZnNiO1xuXHQgICAgdGV4dDFhID0gdGV4dDEuc3Vic3RyaW5nKDAsIHgpO1xuXHQgICAgdGV4dDJhID0gdGV4dDIuc3Vic3RyaW5nKDAsIHkpO1xuXHQgICAgdGV4dDFiID0gdGV4dDEuc3Vic3RyaW5nKHgpO1xuXHQgICAgdGV4dDJiID0gdGV4dDIuc3Vic3RyaW5nKHkpOyAvLyBDb21wdXRlIGJvdGggZGlmZnMgc2VyaWFsbHkuXG5cblx0ICAgIGRpZmZzID0gdGhpcy5EaWZmTWFpbih0ZXh0MWEsIHRleHQyYSwgZmFsc2UsIGRlYWRsaW5lKTtcblx0ICAgIGRpZmZzYiA9IHRoaXMuRGlmZk1haW4odGV4dDFiLCB0ZXh0MmIsIGZhbHNlLCBkZWFkbGluZSk7XG5cdCAgICByZXR1cm4gZGlmZnMuY29uY2F0KGRpZmZzYik7XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBSZWR1Y2UgdGhlIG51bWJlciBvZiBlZGl0cyBieSBlbGltaW5hdGluZyBzZW1hbnRpY2FsbHkgdHJpdmlhbCBlcXVhbGl0aWVzLlxuXHQgICAqIEBwYXJhbSB7IUFycmF5LjwhRGlmZk1hdGNoUGF0Y2guRGlmZj59IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkNsZWFudXBTZW1hbnRpYyA9IGZ1bmN0aW9uIChkaWZmcykge1xuXHQgICAgdmFyIGNoYW5nZXMsIGVxdWFsaXRpZXMsIGVxdWFsaXRpZXNMZW5ndGgsIGxhc3RlcXVhbGl0eSwgcG9pbnRlciwgbGVuZ3RoSW5zZXJ0aW9uczIsIGxlbmd0aERlbGV0aW9uczIsIGxlbmd0aEluc2VydGlvbnMxLCBsZW5ndGhEZWxldGlvbnMxLCBkZWxldGlvbiwgaW5zZXJ0aW9uLCBvdmVybGFwTGVuZ3RoMSwgb3ZlcmxhcExlbmd0aDI7XG5cdCAgICBjaGFuZ2VzID0gZmFsc2U7XG5cdCAgICBlcXVhbGl0aWVzID0gW107IC8vIFN0YWNrIG9mIGluZGljZXMgd2hlcmUgZXF1YWxpdGllcyBhcmUgZm91bmQuXG5cblx0ICAgIGVxdWFsaXRpZXNMZW5ndGggPSAwOyAvLyBLZWVwaW5nIG91ciBvd24gbGVuZ3RoIHZhciBpcyBmYXN0ZXIgaW4gSlMuXG5cblx0ICAgIC8qKiBAdHlwZSB7P3N0cmluZ30gKi9cblxuXHQgICAgbGFzdGVxdWFsaXR5ID0gbnVsbDsgLy8gQWx3YXlzIGVxdWFsIHRvIGRpZmZzW2VxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdXVsxXVxuXG5cdCAgICBwb2ludGVyID0gMDsgLy8gSW5kZXggb2YgY3VycmVudCBwb3NpdGlvbi5cblx0ICAgIC8vIE51bWJlciBvZiBjaGFyYWN0ZXJzIHRoYXQgY2hhbmdlZCBwcmlvciB0byB0aGUgZXF1YWxpdHkuXG5cblx0ICAgIGxlbmd0aEluc2VydGlvbnMxID0gMDtcblx0ICAgIGxlbmd0aERlbGV0aW9uczEgPSAwOyAvLyBOdW1iZXIgb2YgY2hhcmFjdGVycyB0aGF0IGNoYW5nZWQgYWZ0ZXIgdGhlIGVxdWFsaXR5LlxuXG5cdCAgICBsZW5ndGhJbnNlcnRpb25zMiA9IDA7XG5cdCAgICBsZW5ndGhEZWxldGlvbnMyID0gMDtcblxuXHQgICAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGgpIHtcblx0ICAgICAgaWYgKGRpZmZzW3BvaW50ZXJdWzBdID09PSBESUZGX0VRVUFMKSB7XG5cdCAgICAgICAgLy8gRXF1YWxpdHkgZm91bmQuXG5cdCAgICAgICAgZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoKytdID0gcG9pbnRlcjtcblx0ICAgICAgICBsZW5ndGhJbnNlcnRpb25zMSA9IGxlbmd0aEluc2VydGlvbnMyO1xuXHQgICAgICAgIGxlbmd0aERlbGV0aW9uczEgPSBsZW5ndGhEZWxldGlvbnMyO1xuXHQgICAgICAgIGxlbmd0aEluc2VydGlvbnMyID0gMDtcblx0ICAgICAgICBsZW5ndGhEZWxldGlvbnMyID0gMDtcblx0ICAgICAgICBsYXN0ZXF1YWxpdHkgPSBkaWZmc1twb2ludGVyXVsxXTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAvLyBBbiBpbnNlcnRpb24gb3IgZGVsZXRpb24uXG5cdCAgICAgICAgaWYgKGRpZmZzW3BvaW50ZXJdWzBdID09PSBESUZGX0lOU0VSVCkge1xuXHQgICAgICAgICAgbGVuZ3RoSW5zZXJ0aW9uczIgKz0gZGlmZnNbcG9pbnRlcl1bMV0ubGVuZ3RoO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBsZW5ndGhEZWxldGlvbnMyICs9IGRpZmZzW3BvaW50ZXJdWzFdLmxlbmd0aDtcblx0ICAgICAgICB9IC8vIEVsaW1pbmF0ZSBhbiBlcXVhbGl0eSB0aGF0IGlzIHNtYWxsZXIgb3IgZXF1YWwgdG8gdGhlIGVkaXRzIG9uIGJvdGhcblx0ICAgICAgICAvLyBzaWRlcyBvZiBpdC5cblxuXG5cdCAgICAgICAgaWYgKGxhc3RlcXVhbGl0eSAmJiBsYXN0ZXF1YWxpdHkubGVuZ3RoIDw9IE1hdGgubWF4KGxlbmd0aEluc2VydGlvbnMxLCBsZW5ndGhEZWxldGlvbnMxKSAmJiBsYXN0ZXF1YWxpdHkubGVuZ3RoIDw9IE1hdGgubWF4KGxlbmd0aEluc2VydGlvbnMyLCBsZW5ndGhEZWxldGlvbnMyKSkge1xuXHQgICAgICAgICAgLy8gRHVwbGljYXRlIHJlY29yZC5cblx0ICAgICAgICAgIGRpZmZzLnNwbGljZShlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGggLSAxXSwgMCwgW0RJRkZfREVMRVRFLCBsYXN0ZXF1YWxpdHldKTsgLy8gQ2hhbmdlIHNlY29uZCBjb3B5IHRvIGluc2VydC5cblxuXHQgICAgICAgICAgZGlmZnNbZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV0gKyAxXVswXSA9IERJRkZfSU5TRVJUOyAvLyBUaHJvdyBhd2F5IHRoZSBlcXVhbGl0eSB3ZSBqdXN0IGRlbGV0ZWQuXG5cblx0ICAgICAgICAgIGVxdWFsaXRpZXNMZW5ndGgtLTsgLy8gVGhyb3cgYXdheSB0aGUgcHJldmlvdXMgZXF1YWxpdHkgKGl0IG5lZWRzIHRvIGJlIHJlZXZhbHVhdGVkKS5cblxuXHQgICAgICAgICAgZXF1YWxpdGllc0xlbmd0aC0tO1xuXHQgICAgICAgICAgcG9pbnRlciA9IGVxdWFsaXRpZXNMZW5ndGggPiAwID8gZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV0gOiAtMTsgLy8gUmVzZXQgdGhlIGNvdW50ZXJzLlxuXG5cdCAgICAgICAgICBsZW5ndGhJbnNlcnRpb25zMSA9IDA7XG5cdCAgICAgICAgICBsZW5ndGhEZWxldGlvbnMxID0gMDtcblx0ICAgICAgICAgIGxlbmd0aEluc2VydGlvbnMyID0gMDtcblx0ICAgICAgICAgIGxlbmd0aERlbGV0aW9uczIgPSAwO1xuXHQgICAgICAgICAgbGFzdGVxdWFsaXR5ID0gbnVsbDtcblx0ICAgICAgICAgIGNoYW5nZXMgPSB0cnVlO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHBvaW50ZXIrKztcblx0ICAgIH0gLy8gTm9ybWFsaXplIHRoZSBkaWZmLlxuXG5cblx0ICAgIGlmIChjaGFuZ2VzKSB7XG5cdCAgICAgIHRoaXMuZGlmZkNsZWFudXBNZXJnZShkaWZmcyk7XG5cdCAgICB9IC8vIEZpbmQgYW55IG92ZXJsYXBzIGJldHdlZW4gZGVsZXRpb25zIGFuZCBpbnNlcnRpb25zLlxuXHQgICAgLy8gZS5nOiA8ZGVsPmFiY3h4eDwvZGVsPjxpbnM+eHh4ZGVmPC9pbnM+XG5cdCAgICAvLyAgIC0+IDxkZWw+YWJjPC9kZWw+eHh4PGlucz5kZWY8L2lucz5cblx0ICAgIC8vIGUuZzogPGRlbD54eHhhYmM8L2RlbD48aW5zPmRlZnh4eDwvaW5zPlxuXHQgICAgLy8gICAtPiA8aW5zPmRlZjwvaW5zPnh4eDxkZWw+YWJjPC9kZWw+XG5cdCAgICAvLyBPbmx5IGV4dHJhY3QgYW4gb3ZlcmxhcCBpZiBpdCBpcyBhcyBiaWcgYXMgdGhlIGVkaXQgYWhlYWQgb3IgYmVoaW5kIGl0LlxuXG5cblx0ICAgIHBvaW50ZXIgPSAxO1xuXG5cdCAgICB3aGlsZSAocG9pbnRlciA8IGRpZmZzLmxlbmd0aCkge1xuXHQgICAgICBpZiAoZGlmZnNbcG9pbnRlciAtIDFdWzBdID09PSBESUZGX0RFTEVURSAmJiBkaWZmc1twb2ludGVyXVswXSA9PT0gRElGRl9JTlNFUlQpIHtcblx0ICAgICAgICBkZWxldGlvbiA9IGRpZmZzW3BvaW50ZXIgLSAxXVsxXTtcblx0ICAgICAgICBpbnNlcnRpb24gPSBkaWZmc1twb2ludGVyXVsxXTtcblx0ICAgICAgICBvdmVybGFwTGVuZ3RoMSA9IHRoaXMuZGlmZkNvbW1vbk92ZXJsYXAoZGVsZXRpb24sIGluc2VydGlvbik7XG5cdCAgICAgICAgb3ZlcmxhcExlbmd0aDIgPSB0aGlzLmRpZmZDb21tb25PdmVybGFwKGluc2VydGlvbiwgZGVsZXRpb24pO1xuXG5cdCAgICAgICAgaWYgKG92ZXJsYXBMZW5ndGgxID49IG92ZXJsYXBMZW5ndGgyKSB7XG5cdCAgICAgICAgICBpZiAob3ZlcmxhcExlbmd0aDEgPj0gZGVsZXRpb24ubGVuZ3RoIC8gMiB8fCBvdmVybGFwTGVuZ3RoMSA+PSBpbnNlcnRpb24ubGVuZ3RoIC8gMikge1xuXHQgICAgICAgICAgICAvLyBPdmVybGFwIGZvdW5kLiAgSW5zZXJ0IGFuIGVxdWFsaXR5IGFuZCB0cmltIHRoZSBzdXJyb3VuZGluZyBlZGl0cy5cblx0ICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIsIDAsIFtESUZGX0VRVUFMLCBpbnNlcnRpb24uc3Vic3RyaW5nKDAsIG92ZXJsYXBMZW5ndGgxKV0pO1xuXHQgICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0gPSBkZWxldGlvbi5zdWJzdHJpbmcoMCwgZGVsZXRpb24ubGVuZ3RoIC0gb3ZlcmxhcExlbmd0aDEpO1xuXHQgICAgICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMV0gPSBpbnNlcnRpb24uc3Vic3RyaW5nKG92ZXJsYXBMZW5ndGgxKTtcblx0ICAgICAgICAgICAgcG9pbnRlcisrO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBpZiAob3ZlcmxhcExlbmd0aDIgPj0gZGVsZXRpb24ubGVuZ3RoIC8gMiB8fCBvdmVybGFwTGVuZ3RoMiA+PSBpbnNlcnRpb24ubGVuZ3RoIC8gMikge1xuXHQgICAgICAgICAgICAvLyBSZXZlcnNlIG92ZXJsYXAgZm91bmQuXG5cdCAgICAgICAgICAgIC8vIEluc2VydCBhbiBlcXVhbGl0eSBhbmQgc3dhcCBhbmQgdHJpbSB0aGUgc3Vycm91bmRpbmcgZWRpdHMuXG5cdCAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyLCAwLCBbRElGRl9FUVVBTCwgZGVsZXRpb24uc3Vic3RyaW5nKDAsIG92ZXJsYXBMZW5ndGgyKV0pO1xuXHQgICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMF0gPSBESUZGX0lOU0VSVDtcblx0ICAgICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdID0gaW5zZXJ0aW9uLnN1YnN0cmluZygwLCBpbnNlcnRpb24ubGVuZ3RoIC0gb3ZlcmxhcExlbmd0aDIpO1xuXHQgICAgICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMF0gPSBESUZGX0RFTEVURTtcblx0ICAgICAgICAgICAgZGlmZnNbcG9pbnRlciArIDFdWzFdID0gZGVsZXRpb24uc3Vic3RyaW5nKG92ZXJsYXBMZW5ndGgyKTtcblx0ICAgICAgICAgICAgcG9pbnRlcisrO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHBvaW50ZXIrKztcblx0ICAgICAgfVxuXG5cdCAgICAgIHBvaW50ZXIrKztcblx0ICAgIH1cblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIERldGVybWluZSBpZiB0aGUgc3VmZml4IG9mIG9uZSBzdHJpbmcgaXMgdGhlIHByZWZpeCBvZiBhbm90aGVyLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIFNlY29uZCBzdHJpbmcuXG5cdCAgICogQHJldHVybiB7bnVtYmVyfSBUaGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgY29tbW9uIHRvIHRoZSBlbmQgb2YgdGhlIGZpcnN0XG5cdCAgICogICAgIHN0cmluZyBhbmQgdGhlIHN0YXJ0IG9mIHRoZSBzZWNvbmQgc3RyaW5nLlxuXHQgICAqIEBwcml2YXRlXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmQ29tbW9uT3ZlcmxhcCA9IGZ1bmN0aW9uICh0ZXh0MSwgdGV4dDIpIHtcblx0ICAgIHZhciB0ZXh0MUxlbmd0aCwgdGV4dDJMZW5ndGgsIHRleHRMZW5ndGgsIGJlc3QsIGxlbmd0aCwgcGF0dGVybiwgZm91bmQ7IC8vIENhY2hlIHRoZSB0ZXh0IGxlbmd0aHMgdG8gcHJldmVudCBtdWx0aXBsZSBjYWxscy5cblxuXHQgICAgdGV4dDFMZW5ndGggPSB0ZXh0MS5sZW5ndGg7XG5cdCAgICB0ZXh0Mkxlbmd0aCA9IHRleHQyLmxlbmd0aDsgLy8gRWxpbWluYXRlIHRoZSBudWxsIGNhc2UuXG5cblx0ICAgIGlmICh0ZXh0MUxlbmd0aCA9PT0gMCB8fCB0ZXh0Mkxlbmd0aCA9PT0gMCkge1xuXHQgICAgICByZXR1cm4gMDtcblx0ICAgIH0gLy8gVHJ1bmNhdGUgdGhlIGxvbmdlciBzdHJpbmcuXG5cblxuXHQgICAgaWYgKHRleHQxTGVuZ3RoID4gdGV4dDJMZW5ndGgpIHtcblx0ICAgICAgdGV4dDEgPSB0ZXh0MS5zdWJzdHJpbmcodGV4dDFMZW5ndGggLSB0ZXh0Mkxlbmd0aCk7XG5cdCAgICB9IGVsc2UgaWYgKHRleHQxTGVuZ3RoIDwgdGV4dDJMZW5ndGgpIHtcblx0ICAgICAgdGV4dDIgPSB0ZXh0Mi5zdWJzdHJpbmcoMCwgdGV4dDFMZW5ndGgpO1xuXHQgICAgfVxuXG5cdCAgICB0ZXh0TGVuZ3RoID0gTWF0aC5taW4odGV4dDFMZW5ndGgsIHRleHQyTGVuZ3RoKTsgLy8gUXVpY2sgY2hlY2sgZm9yIHRoZSB3b3JzdCBjYXNlLlxuXG5cdCAgICBpZiAodGV4dDEgPT09IHRleHQyKSB7XG5cdCAgICAgIHJldHVybiB0ZXh0TGVuZ3RoO1xuXHQgICAgfSAvLyBTdGFydCBieSBsb29raW5nIGZvciBhIHNpbmdsZSBjaGFyYWN0ZXIgbWF0Y2hcblx0ICAgIC8vIGFuZCBpbmNyZWFzZSBsZW5ndGggdW50aWwgbm8gbWF0Y2ggaXMgZm91bmQuXG5cdCAgICAvLyBQZXJmb3JtYW5jZSBhbmFseXNpczogaHR0cHM6Ly9uZWlsLmZyYXNlci5uYW1lL25ld3MvMjAxMC8xMS8wNC9cblxuXG5cdCAgICBiZXN0ID0gMDtcblx0ICAgIGxlbmd0aCA9IDE7XG5cblx0ICAgIHdoaWxlICh0cnVlKSB7XG5cdCAgICAgIHBhdHRlcm4gPSB0ZXh0MS5zdWJzdHJpbmcodGV4dExlbmd0aCAtIGxlbmd0aCk7XG5cdCAgICAgIGZvdW5kID0gdGV4dDIuaW5kZXhPZihwYXR0ZXJuKTtcblxuXHQgICAgICBpZiAoZm91bmQgPT09IC0xKSB7XG5cdCAgICAgICAgcmV0dXJuIGJlc3Q7XG5cdCAgICAgIH1cblxuXHQgICAgICBsZW5ndGggKz0gZm91bmQ7XG5cblx0ICAgICAgaWYgKGZvdW5kID09PSAwIHx8IHRleHQxLnN1YnN0cmluZyh0ZXh0TGVuZ3RoIC0gbGVuZ3RoKSA9PT0gdGV4dDIuc3Vic3RyaW5nKDAsIGxlbmd0aCkpIHtcblx0ICAgICAgICBiZXN0ID0gbGVuZ3RoO1xuXHQgICAgICAgIGxlbmd0aCsrO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBTcGxpdCB0d28gdGV4dHMgaW50byBhbiBhcnJheSBvZiBzdHJpbmdzLiAgUmVkdWNlIHRoZSB0ZXh0cyB0byBhIHN0cmluZyBvZlxuXHQgICAqIGhhc2hlcyB3aGVyZSBlYWNoIFVuaWNvZGUgY2hhcmFjdGVyIHJlcHJlc2VudHMgb25lIGxpbmUuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIEZpcnN0IHN0cmluZy5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cblx0ICAgKiBAcmV0dXJuIHt7Y2hhcnMxOiBzdHJpbmcsIGNoYXJzMjogc3RyaW5nLCBsaW5lQXJyYXk6ICFBcnJheS48c3RyaW5nPn19XG5cdCAgICogICAgIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBlbmNvZGVkIHRleHQxLCB0aGUgZW5jb2RlZCB0ZXh0MiBhbmRcblx0ICAgKiAgICAgdGhlIGFycmF5IG9mIHVuaXF1ZSBzdHJpbmdzLlxuXHQgICAqICAgICBUaGUgemVyb3RoIGVsZW1lbnQgb2YgdGhlIGFycmF5IG9mIHVuaXF1ZSBzdHJpbmdzIGlzIGludGVudGlvbmFsbHkgYmxhbmsuXG5cdCAgICogQHByaXZhdGVcblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZMaW5lc1RvQ2hhcnMgPSBmdW5jdGlvbiAodGV4dDEsIHRleHQyKSB7XG5cdCAgICB2YXIgbGluZUFycmF5LCBsaW5lSGFzaCwgY2hhcnMxLCBjaGFyczI7XG5cdCAgICBsaW5lQXJyYXkgPSBbXTsgLy8gRS5nLiBsaW5lQXJyYXlbNF0gPT09ICdIZWxsb1xcbidcblxuXHQgICAgbGluZUhhc2ggPSB7fTsgLy8gRS5nLiBsaW5lSGFzaFsnSGVsbG9cXG4nXSA9PT0gNFxuXHQgICAgLy8gJ1xceDAwJyBpcyBhIHZhbGlkIGNoYXJhY3RlciwgYnV0IHZhcmlvdXMgZGVidWdnZXJzIGRvbid0IGxpa2UgaXQuXG5cdCAgICAvLyBTbyB3ZSdsbCBpbnNlcnQgYSBqdW5rIGVudHJ5IHRvIGF2b2lkIGdlbmVyYXRpbmcgYSBudWxsIGNoYXJhY3Rlci5cblxuXHQgICAgbGluZUFycmF5WzBdID0gXCJcIjtcblx0ICAgIC8qKlxuXHQgICAgICogU3BsaXQgYSB0ZXh0IGludG8gYW4gYXJyYXkgb2Ygc3RyaW5ncy4gIFJlZHVjZSB0aGUgdGV4dHMgdG8gYSBzdHJpbmcgb2Zcblx0ICAgICAqIGhhc2hlcyB3aGVyZSBlYWNoIFVuaWNvZGUgY2hhcmFjdGVyIHJlcHJlc2VudHMgb25lIGxpbmUuXG5cdCAgICAgKiBNb2RpZmllcyBsaW5lYXJyYXkgYW5kIGxpbmVoYXNoIHRocm91Z2ggYmVpbmcgYSBjbG9zdXJlLlxuXHQgICAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgU3RyaW5nIHRvIGVuY29kZS5cblx0ICAgICAqIEByZXR1cm4ge3N0cmluZ30gRW5jb2RlZCBzdHJpbmcuXG5cdCAgICAgKiBAcHJpdmF0ZVxuXHQgICAgICovXG5cblx0ICAgIGZ1bmN0aW9uIGRpZmZMaW5lc1RvQ2hhcnNNdW5nZSh0ZXh0KSB7XG5cdCAgICAgIHZhciBjaGFycywgbGluZVN0YXJ0LCBsaW5lRW5kLCBsaW5lQXJyYXlMZW5ndGgsIGxpbmU7XG5cdCAgICAgIGNoYXJzID0gXCJcIjsgLy8gV2FsayB0aGUgdGV4dCwgcHVsbGluZyBvdXQgYSBzdWJzdHJpbmcgZm9yIGVhY2ggbGluZS5cblx0ICAgICAgLy8gdGV4dC5zcGxpdCgnXFxuJykgd291bGQgd291bGQgdGVtcG9yYXJpbHkgZG91YmxlIG91ciBtZW1vcnkgZm9vdHByaW50LlxuXHQgICAgICAvLyBNb2RpZnlpbmcgdGV4dCB3b3VsZCBjcmVhdGUgbWFueSBsYXJnZSBzdHJpbmdzIHRvIGdhcmJhZ2UgY29sbGVjdC5cblxuXHQgICAgICBsaW5lU3RhcnQgPSAwO1xuXHQgICAgICBsaW5lRW5kID0gLTE7IC8vIEtlZXBpbmcgb3VyIG93biBsZW5ndGggdmFyaWFibGUgaXMgZmFzdGVyIHRoYW4gbG9va2luZyBpdCB1cC5cblxuXHQgICAgICBsaW5lQXJyYXlMZW5ndGggPSBsaW5lQXJyYXkubGVuZ3RoO1xuXG5cdCAgICAgIHdoaWxlIChsaW5lRW5kIDwgdGV4dC5sZW5ndGggLSAxKSB7XG5cdCAgICAgICAgbGluZUVuZCA9IHRleHQuaW5kZXhPZihcIlxcblwiLCBsaW5lU3RhcnQpO1xuXG5cdCAgICAgICAgaWYgKGxpbmVFbmQgPT09IC0xKSB7XG5cdCAgICAgICAgICBsaW5lRW5kID0gdGV4dC5sZW5ndGggLSAxO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGxpbmUgPSB0ZXh0LnN1YnN0cmluZyhsaW5lU3RhcnQsIGxpbmVFbmQgKyAxKTtcblx0ICAgICAgICBsaW5lU3RhcnQgPSBsaW5lRW5kICsgMTtcblxuXHQgICAgICAgIGlmIChoYXNPd24uY2FsbChsaW5lSGFzaCwgbGluZSkpIHtcblx0ICAgICAgICAgIGNoYXJzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUobGluZUhhc2hbbGluZV0pO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBjaGFycyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGxpbmVBcnJheUxlbmd0aCk7XG5cdCAgICAgICAgICBsaW5lSGFzaFtsaW5lXSA9IGxpbmVBcnJheUxlbmd0aDtcblx0ICAgICAgICAgIGxpbmVBcnJheVtsaW5lQXJyYXlMZW5ndGgrK10gPSBsaW5lO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBjaGFycztcblx0ICAgIH1cblxuXHQgICAgY2hhcnMxID0gZGlmZkxpbmVzVG9DaGFyc011bmdlKHRleHQxKTtcblx0ICAgIGNoYXJzMiA9IGRpZmZMaW5lc1RvQ2hhcnNNdW5nZSh0ZXh0Mik7XG5cdCAgICByZXR1cm4ge1xuXHQgICAgICBjaGFyczE6IGNoYXJzMSxcblx0ICAgICAgY2hhcnMyOiBjaGFyczIsXG5cdCAgICAgIGxpbmVBcnJheTogbGluZUFycmF5XG5cdCAgICB9O1xuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogUmVoeWRyYXRlIHRoZSB0ZXh0IGluIGEgZGlmZiBmcm9tIGEgc3RyaW5nIG9mIGxpbmUgaGFzaGVzIHRvIHJlYWwgbGluZXMgb2Zcblx0ICAgKiB0ZXh0LlxuXHQgICAqIEBwYXJhbSB7IUFycmF5LjwhRGlmZk1hdGNoUGF0Y2guRGlmZj59IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuXHQgICAqIEBwYXJhbSB7IUFycmF5LjxzdHJpbmc+fSBsaW5lQXJyYXkgQXJyYXkgb2YgdW5pcXVlIHN0cmluZ3MuXG5cdCAgICogQHByaXZhdGVcblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZDaGFyc1RvTGluZXMgPSBmdW5jdGlvbiAoZGlmZnMsIGxpbmVBcnJheSkge1xuXHQgICAgdmFyIHgsIGNoYXJzLCB0ZXh0LCB5O1xuXG5cdCAgICBmb3IgKHggPSAwOyB4IDwgZGlmZnMubGVuZ3RoOyB4KyspIHtcblx0ICAgICAgY2hhcnMgPSBkaWZmc1t4XVsxXTtcblx0ICAgICAgdGV4dCA9IFtdO1xuXG5cdCAgICAgIGZvciAoeSA9IDA7IHkgPCBjaGFycy5sZW5ndGg7IHkrKykge1xuXHQgICAgICAgIHRleHRbeV0gPSBsaW5lQXJyYXlbY2hhcnMuY2hhckNvZGVBdCh5KV07XG5cdCAgICAgIH1cblxuXHQgICAgICBkaWZmc1t4XVsxXSA9IHRleHQuam9pbihcIlwiKTtcblx0ICAgIH1cblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIFJlb3JkZXIgYW5kIG1lcmdlIGxpa2UgZWRpdCBzZWN0aW9ucy4gIE1lcmdlIGVxdWFsaXRpZXMuXG5cdCAgICogQW55IGVkaXQgc2VjdGlvbiBjYW4gbW92ZSBhcyBsb25nIGFzIGl0IGRvZXNuJ3QgY3Jvc3MgYW4gZXF1YWxpdHkuXG5cdCAgICogQHBhcmFtIHshQXJyYXkuPCFEaWZmTWF0Y2hQYXRjaC5EaWZmPn0gZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmQ2xlYW51cE1lcmdlID0gZnVuY3Rpb24gKGRpZmZzKSB7XG5cdCAgICB2YXIgcG9pbnRlciwgY291bnREZWxldGUsIGNvdW50SW5zZXJ0LCB0ZXh0SW5zZXJ0LCB0ZXh0RGVsZXRlLCBjb21tb25sZW5ndGgsIGNoYW5nZXMsIGRpZmZQb2ludGVyLCBwb3NpdGlvbjtcblx0ICAgIGRpZmZzLnB1c2goW0RJRkZfRVFVQUwsIFwiXCJdKTsgLy8gQWRkIGEgZHVtbXkgZW50cnkgYXQgdGhlIGVuZC5cblxuXHQgICAgcG9pbnRlciA9IDA7XG5cdCAgICBjb3VudERlbGV0ZSA9IDA7XG5cdCAgICBjb3VudEluc2VydCA9IDA7XG5cdCAgICB0ZXh0RGVsZXRlID0gXCJcIjtcblx0ICAgIHRleHRJbnNlcnQgPSBcIlwiO1xuXG5cdCAgICB3aGlsZSAocG9pbnRlciA8IGRpZmZzLmxlbmd0aCkge1xuXHQgICAgICBzd2l0Y2ggKGRpZmZzW3BvaW50ZXJdWzBdKSB7XG5cdCAgICAgICAgY2FzZSBESUZGX0lOU0VSVDpcblx0ICAgICAgICAgIGNvdW50SW5zZXJ0Kys7XG5cdCAgICAgICAgICB0ZXh0SW5zZXJ0ICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuXHQgICAgICAgICAgcG9pbnRlcisrO1xuXHQgICAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgICBjYXNlIERJRkZfREVMRVRFOlxuXHQgICAgICAgICAgY291bnREZWxldGUrKztcblx0ICAgICAgICAgIHRleHREZWxldGUgKz0gZGlmZnNbcG9pbnRlcl1bMV07XG5cdCAgICAgICAgICBwb2ludGVyKys7XG5cdCAgICAgICAgICBicmVhaztcblxuXHQgICAgICAgIGNhc2UgRElGRl9FUVVBTDpcblx0ICAgICAgICAgIC8vIFVwb24gcmVhY2hpbmcgYW4gZXF1YWxpdHksIGNoZWNrIGZvciBwcmlvciByZWR1bmRhbmNpZXMuXG5cdCAgICAgICAgICBpZiAoY291bnREZWxldGUgKyBjb3VudEluc2VydCA+IDEpIHtcblx0ICAgICAgICAgICAgaWYgKGNvdW50RGVsZXRlICE9PSAwICYmIGNvdW50SW5zZXJ0ICE9PSAwKSB7XG5cdCAgICAgICAgICAgICAgLy8gRmFjdG9yIG91dCBhbnkgY29tbW9uIHByZWZpeGVzLlxuXHQgICAgICAgICAgICAgIGNvbW1vbmxlbmd0aCA9IHRoaXMuZGlmZkNvbW1vblByZWZpeCh0ZXh0SW5zZXJ0LCB0ZXh0RGVsZXRlKTtcblxuXHQgICAgICAgICAgICAgIGlmIChjb21tb25sZW5ndGggIT09IDApIHtcblx0ICAgICAgICAgICAgICAgIGlmIChwb2ludGVyIC0gY291bnREZWxldGUgLSBjb3VudEluc2VydCA+IDAgJiYgZGlmZnNbcG9pbnRlciAtIGNvdW50RGVsZXRlIC0gY291bnRJbnNlcnQgLSAxXVswXSA9PT0gRElGRl9FUVVBTCkge1xuXHQgICAgICAgICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gY291bnREZWxldGUgLSBjb3VudEluc2VydCAtIDFdWzFdICs9IHRleHRJbnNlcnQuc3Vic3RyaW5nKDAsIGNvbW1vbmxlbmd0aCk7XG5cdCAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgICBkaWZmcy5zcGxpY2UoMCwgMCwgW0RJRkZfRVFVQUwsIHRleHRJbnNlcnQuc3Vic3RyaW5nKDAsIGNvbW1vbmxlbmd0aCldKTtcblx0ICAgICAgICAgICAgICAgICAgcG9pbnRlcisrO1xuXHQgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICB0ZXh0SW5zZXJ0ID0gdGV4dEluc2VydC5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcblx0ICAgICAgICAgICAgICAgIHRleHREZWxldGUgPSB0ZXh0RGVsZXRlLnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuXHQgICAgICAgICAgICAgIH0gLy8gRmFjdG9yIG91dCBhbnkgY29tbW9uIHN1ZmZpeGllcy5cblxuXG5cdCAgICAgICAgICAgICAgY29tbW9ubGVuZ3RoID0gdGhpcy5kaWZmQ29tbW9uU3VmZml4KHRleHRJbnNlcnQsIHRleHREZWxldGUpO1xuXG5cdCAgICAgICAgICAgICAgaWYgKGNvbW1vbmxlbmd0aCAhPT0gMCkge1xuXHQgICAgICAgICAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0gPSB0ZXh0SW5zZXJ0LnN1YnN0cmluZyh0ZXh0SW5zZXJ0Lmxlbmd0aCAtIGNvbW1vbmxlbmd0aCkgKyBkaWZmc1twb2ludGVyXVsxXTtcblx0ICAgICAgICAgICAgICAgIHRleHRJbnNlcnQgPSB0ZXh0SW5zZXJ0LnN1YnN0cmluZygwLCB0ZXh0SW5zZXJ0Lmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XG5cdCAgICAgICAgICAgICAgICB0ZXh0RGVsZXRlID0gdGV4dERlbGV0ZS5zdWJzdHJpbmcoMCwgdGV4dERlbGV0ZS5sZW5ndGggLSBjb21tb25sZW5ndGgpO1xuXHQgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfSAvLyBEZWxldGUgdGhlIG9mZmVuZGluZyByZWNvcmRzIGFuZCBhZGQgdGhlIG1lcmdlZCBvbmVzLlxuXG5cblx0ICAgICAgICAgICAgaWYgKGNvdW50RGVsZXRlID09PSAwKSB7XG5cdCAgICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSBjb3VudEluc2VydCwgY291bnREZWxldGUgKyBjb3VudEluc2VydCwgW0RJRkZfSU5TRVJULCB0ZXh0SW5zZXJ0XSk7XG5cdCAgICAgICAgICAgIH0gZWxzZSBpZiAoY291bnRJbnNlcnQgPT09IDApIHtcblx0ICAgICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIGNvdW50RGVsZXRlLCBjb3VudERlbGV0ZSArIGNvdW50SW5zZXJ0LCBbRElGRl9ERUxFVEUsIHRleHREZWxldGVdKTtcblx0ICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIGNvdW50RGVsZXRlIC0gY291bnRJbnNlcnQsIGNvdW50RGVsZXRlICsgY291bnRJbnNlcnQsIFtESUZGX0RFTEVURSwgdGV4dERlbGV0ZV0sIFtESUZGX0lOU0VSVCwgdGV4dEluc2VydF0pO1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgcG9pbnRlciA9IHBvaW50ZXIgLSBjb3VudERlbGV0ZSAtIGNvdW50SW5zZXJ0ICsgKGNvdW50RGVsZXRlID8gMSA6IDApICsgKGNvdW50SW5zZXJ0ID8gMSA6IDApICsgMTtcblx0ICAgICAgICAgIH0gZWxzZSBpZiAocG9pbnRlciAhPT0gMCAmJiBkaWZmc1twb2ludGVyIC0gMV1bMF0gPT09IERJRkZfRVFVQUwpIHtcblx0ICAgICAgICAgICAgLy8gTWVyZ2UgdGhpcyBlcXVhbGl0eSB3aXRoIHRoZSBwcmV2aW91cyBvbmUuXG5cdCAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXSArPSBkaWZmc1twb2ludGVyXVsxXTtcblx0ICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIsIDEpO1xuXHQgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgcG9pbnRlcisrO1xuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICBjb3VudEluc2VydCA9IDA7XG5cdCAgICAgICAgICBjb3VudERlbGV0ZSA9IDA7XG5cdCAgICAgICAgICB0ZXh0RGVsZXRlID0gXCJcIjtcblx0ICAgICAgICAgIHRleHRJbnNlcnQgPSBcIlwiO1xuXHQgICAgICAgICAgYnJlYWs7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgaWYgKGRpZmZzW2RpZmZzLmxlbmd0aCAtIDFdWzFdID09PSBcIlwiKSB7XG5cdCAgICAgIGRpZmZzLnBvcCgpOyAvLyBSZW1vdmUgdGhlIGR1bW15IGVudHJ5IGF0IHRoZSBlbmQuXG5cdCAgICB9IC8vIFNlY29uZCBwYXNzOiBsb29rIGZvciBzaW5nbGUgZWRpdHMgc3Vycm91bmRlZCBvbiBib3RoIHNpZGVzIGJ5IGVxdWFsaXRpZXNcblx0ICAgIC8vIHdoaWNoIGNhbiBiZSBzaGlmdGVkIHNpZGV3YXlzIHRvIGVsaW1pbmF0ZSBhbiBlcXVhbGl0eS5cblx0ICAgIC8vIGUuZzogQTxpbnM+QkE8L2lucz5DIC0+IDxpbnM+QUI8L2lucz5BQ1xuXG5cblx0ICAgIGNoYW5nZXMgPSBmYWxzZTtcblx0ICAgIHBvaW50ZXIgPSAxOyAvLyBJbnRlbnRpb25hbGx5IGlnbm9yZSB0aGUgZmlyc3QgYW5kIGxhc3QgZWxlbWVudCAoZG9uJ3QgbmVlZCBjaGVja2luZykuXG5cblx0ICAgIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoIC0gMSkge1xuXHQgICAgICBpZiAoZGlmZnNbcG9pbnRlciAtIDFdWzBdID09PSBESUZGX0VRVUFMICYmIGRpZmZzW3BvaW50ZXIgKyAxXVswXSA9PT0gRElGRl9FUVVBTCkge1xuXHQgICAgICAgIGRpZmZQb2ludGVyID0gZGlmZnNbcG9pbnRlcl1bMV07XG5cdCAgICAgICAgcG9zaXRpb24gPSBkaWZmUG9pbnRlci5zdWJzdHJpbmcoZGlmZlBvaW50ZXIubGVuZ3RoIC0gZGlmZnNbcG9pbnRlciAtIDFdWzFdLmxlbmd0aCk7IC8vIFRoaXMgaXMgYSBzaW5nbGUgZWRpdCBzdXJyb3VuZGVkIGJ5IGVxdWFsaXRpZXMuXG5cblx0ICAgICAgICBpZiAocG9zaXRpb24gPT09IGRpZmZzW3BvaW50ZXIgLSAxXVsxXSkge1xuXHQgICAgICAgICAgLy8gU2hpZnQgdGhlIGVkaXQgb3ZlciB0aGUgcHJldmlvdXMgZXF1YWxpdHkuXG5cdCAgICAgICAgICBkaWZmc1twb2ludGVyXVsxXSA9IGRpZmZzW3BvaW50ZXIgLSAxXVsxXSArIGRpZmZzW3BvaW50ZXJdWzFdLnN1YnN0cmluZygwLCBkaWZmc1twb2ludGVyXVsxXS5sZW5ndGggLSBkaWZmc1twb2ludGVyIC0gMV1bMV0ubGVuZ3RoKTtcblx0ICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSA9IGRpZmZzW3BvaW50ZXIgLSAxXVsxXSArIGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcblx0ICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gMSwgMSk7XG5cdCAgICAgICAgICBjaGFuZ2VzID0gdHJ1ZTtcblx0ICAgICAgICB9IGVsc2UgaWYgKGRpZmZQb2ludGVyLnN1YnN0cmluZygwLCBkaWZmc1twb2ludGVyICsgMV1bMV0ubGVuZ3RoKSA9PT0gZGlmZnNbcG9pbnRlciArIDFdWzFdKSB7XG5cdCAgICAgICAgICAvLyBTaGlmdCB0aGUgZWRpdCBvdmVyIHRoZSBuZXh0IGVxdWFsaXR5LlxuXHQgICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdICs9IGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcblx0ICAgICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdID0gZGlmZnNbcG9pbnRlcl1bMV0uc3Vic3RyaW5nKGRpZmZzW3BvaW50ZXIgKyAxXVsxXS5sZW5ndGgpICsgZGlmZnNbcG9pbnRlciArIDFdWzFdO1xuXHQgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgKyAxLCAxKTtcblx0ICAgICAgICAgIGNoYW5nZXMgPSB0cnVlO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHBvaW50ZXIrKztcblx0ICAgIH0gLy8gSWYgc2hpZnRzIHdlcmUgbWFkZSwgdGhlIGRpZmYgbmVlZHMgcmVvcmRlcmluZyBhbmQgYW5vdGhlciBzaGlmdCBzd2VlcC5cblxuXG5cdCAgICBpZiAoY2hhbmdlcykge1xuXHQgICAgICB0aGlzLmRpZmZDbGVhbnVwTWVyZ2UoZGlmZnMpO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICByZXR1cm4gZnVuY3Rpb24gKG8sIG4pIHtcblx0ICAgIHZhciBkaWZmLCBvdXRwdXQsIHRleHQ7XG5cdCAgICBkaWZmID0gbmV3IERpZmZNYXRjaFBhdGNoKCk7XG5cdCAgICBvdXRwdXQgPSBkaWZmLkRpZmZNYWluKG8sIG4pO1xuXHQgICAgZGlmZi5kaWZmQ2xlYW51cEVmZmljaWVuY3kob3V0cHV0KTtcblx0ICAgIHRleHQgPSBkaWZmLmRpZmZQcmV0dHlIdG1sKG91dHB1dCk7XG5cdCAgICByZXR1cm4gdGV4dDtcblx0ICB9O1xuXHR9KCk7XG5cbn0oKGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSgpKSkpO1xuIiwidmFyIG5leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy9icm93c2VyLmpzJykubmV4dFRpY2s7XG52YXIgYXBwbHkgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHk7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgaW1tZWRpYXRlSWRzID0ge307XG52YXIgbmV4dEltbWVkaWF0ZUlkID0gMDtcblxuLy8gRE9NIEFQSXMsIGZvciBjb21wbGV0ZW5lc3NcblxuZXhwb3J0cy5zZXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldFRpbWVvdXQsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJUaW1lb3V0KTtcbn07XG5leHBvcnRzLnNldEludGVydmFsID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldEludGVydmFsLCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFySW50ZXJ2YWwpO1xufTtcbmV4cG9ydHMuY2xlYXJUaW1lb3V0ID1cbmV4cG9ydHMuY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uKHRpbWVvdXQpIHsgdGltZW91dC5jbG9zZSgpOyB9O1xuXG5mdW5jdGlvbiBUaW1lb3V0KGlkLCBjbGVhckZuKSB7XG4gIHRoaXMuX2lkID0gaWQ7XG4gIHRoaXMuX2NsZWFyRm4gPSBjbGVhckZuO1xufVxuVGltZW91dC5wcm90b3R5cGUudW5yZWYgPSBUaW1lb3V0LnByb3RvdHlwZS5yZWYgPSBmdW5jdGlvbigpIHt9O1xuVGltZW91dC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5fY2xlYXJGbi5jYWxsKHdpbmRvdywgdGhpcy5faWQpO1xufTtcblxuLy8gRG9lcyBub3Qgc3RhcnQgdGhlIHRpbWUsIGp1c3Qgc2V0cyB1cCB0aGUgbWVtYmVycyBuZWVkZWQuXG5leHBvcnRzLmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0sIG1zZWNzKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSBtc2Vjcztcbn07XG5cbmV4cG9ydHMudW5lbnJvbGwgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSAtMTtcbn07XG5cbmV4cG9ydHMuX3VucmVmQWN0aXZlID0gZXhwb3J0cy5hY3RpdmUgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcblxuICB2YXIgbXNlY3MgPSBpdGVtLl9pZGxlVGltZW91dDtcbiAgaWYgKG1zZWNzID49IDApIHtcbiAgICBpdGVtLl9pZGxlVGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiBvblRpbWVvdXQoKSB7XG4gICAgICBpZiAoaXRlbS5fb25UaW1lb3V0KVxuICAgICAgICBpdGVtLl9vblRpbWVvdXQoKTtcbiAgICB9LCBtc2Vjcyk7XG4gIH1cbn07XG5cbi8vIFRoYXQncyBub3QgaG93IG5vZGUuanMgaW1wbGVtZW50cyBpdCBidXQgdGhlIGV4cG9zZWQgYXBpIGlzIHRoZSBzYW1lLlxuZXhwb3J0cy5zZXRJbW1lZGlhdGUgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBzZXRJbW1lZGlhdGUgOiBmdW5jdGlvbihmbikge1xuICB2YXIgaWQgPSBuZXh0SW1tZWRpYXRlSWQrKztcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHMubGVuZ3RoIDwgMiA/IGZhbHNlIDogc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gIGltbWVkaWF0ZUlkc1tpZF0gPSB0cnVlO1xuXG4gIG5leHRUaWNrKGZ1bmN0aW9uIG9uTmV4dFRpY2soKSB7XG4gICAgaWYgKGltbWVkaWF0ZUlkc1tpZF0pIHtcbiAgICAgIC8vIGZuLmNhbGwoKSBpcyBmYXN0ZXIgc28gd2Ugb3B0aW1pemUgZm9yIHRoZSBjb21tb24gdXNlLWNhc2VcbiAgICAgIC8vIEBzZWUgaHR0cDovL2pzcGVyZi5jb20vY2FsbC1hcHBseS1zZWd1XG4gICAgICBpZiAoYXJncykge1xuICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZuLmNhbGwobnVsbCk7XG4gICAgICB9XG4gICAgICAvLyBQcmV2ZW50IGlkcyBmcm9tIGxlYWtpbmdcbiAgICAgIGV4cG9ydHMuY2xlYXJJbW1lZGlhdGUoaWQpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGlkO1xufTtcblxuZXhwb3J0cy5jbGVhckltbWVkaWF0ZSA9IHR5cGVvZiBjbGVhckltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gY2xlYXJJbW1lZGlhdGUgOiBmdW5jdGlvbihpZCkge1xuICBkZWxldGUgaW1tZWRpYXRlSWRzW2lkXTtcbn07IiwiLyohIHp6ZG9tIC0gdjAuMi4wIC0gMjAyMC0xMS0xMiAxMzozMjo1MSAqL1xuLyoqXG4gKiBBIG5hbWVzcGFjZS5cbiAqIEBjb25zdFxuICovXG52YXIgenpET00gPSB7fTtcblxuLypcbiAgICB6eiBmdW5jdGlvblxuICAgIFxuICAgIHp6KCAnIycsICdpZCcgKTtcbiAgICB6eiggJy4nLCAnY2xhc3NOYW1lJyApO1xuICAgIHp6KCAndCcsICd0YWdOYW1lJyApO1xuICAgIHp6KCAndG4nLCAnbmFtZXNwYWNlJywgJ3RhZ05hbWUnICk7XG4gICAgenooICduJywgJ25hbWUnICk7XG4gICAgenooICdzJywgJ3N0cmluZyBzZWxlY3RvcicgKTtcbiAgICB6eiggZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdpZCcgKSApOyAvLyBFbGVtZW50XG4gICAgenooIGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoICdjbGFzc05hbWUnICkgKTsgLy8gSFRNTENvbGxlY3Rpb25cbiAgICB6eiggZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoICduYW1lJyApICk7IC8vIE5vZGVMaXN0XG4gICAgenooICd0YWJsZS5jbGFzc05hbWUgdHIgdGQnICk7IC8vIFN0cmluZyBzZWxlY3RvclxuICAgIHp6KCAnPGRpdj5OZXcgZGl2PC9kaXY+JyApOyAvLyBIVE1MIGNvZGUgaW4gc3RyaW5nXG4qL1xuLyoqXG4gKiBAcGFyYW0ge3N0cmluZ3xFbGVtZW50fEhUTUxDb2xsZWN0aW9ufE5vZGVMaXN0fSB4XG4gKiBAcGFyYW0ge3N0cmluZz19IHMxXG4gKiBAcGFyYW0ge3N0cmluZz19IHMyIFxuICovXG56ekRPTS56eiA9IGZ1bmN0aW9uKCB4LCBzMSwgczIgKXtcbiAgICBcbiAgICAvLyBSZWRlZmluZSB4IGlmIGEgc2VsZWN0b3IgaWQgaXMgZm91bmRcbiAgICBpZiAoIHMxICl7XG4gICAgICAgIHN3aXRjaCAoIHggKXtcbiAgICAgICAgY2FzZSAnIyc6XG4gICAgICAgICAgICB4ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIHMxICk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnLic6XG4gICAgICAgICAgICB4ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSggczEgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0JzpcbiAgICAgICAgICAgIHggPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSggczEgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd0bic6XG4gICAgICAgICAgICB4ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWVOUyggczEsIHMyIHx8ICcnICk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbic6XG4gICAgICAgICAgICB4ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoIHMxICk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAncyc6XG4gICAgICAgICAgICB4ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggczEgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgJ1Vuc3VwcG9ydGVkIHNlbGVjdG9yIGlkIGZvdW5kIHJ1bm5pbmcgenogZnVuY3Rpb246ICcgKyB4O1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIElzIGl0IGFuIEVsZW1lbnQ/XG4gICAgaWYgKCB4IGluc3RhbmNlb2YgRWxlbWVudCApe1xuICAgICAgICByZXR1cm4gbmV3IHp6RE9NLlNTKCB4ICk7XG4gICAgfVxuICAgIFxuICAgIC8vIElzIGl0IGFuIEhUTUxDb2xsZWN0aW9uIG9yIGEgTm9kZUxpc3Q/XG4gICAgaWYgKCB4IGluc3RhbmNlb2YgSFRNTENvbGxlY3Rpb24gfHwgeCBpbnN0YW5jZW9mIE5vZGVMaXN0ICl7XG4gICAgICAgIHJldHVybiB6ekRPTS5fYnVpbGQoIHggKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKCB0eXBlb2YgeCA9PT0gJ3N0cmluZycgKXtcbiAgICAgICAgeCA9IHgudHJpbSgpO1xuICAgICAgICByZXR1cm4genpET00uX2J1aWxkKFxuICAgICAgICAgICAgeC5jaGFyQXQoIDAgKSA9PT0gJzwnPyAvLyBJcyBpdCBIVE1MIGNvZGU/XG4gICAgICAgICAgICAgICAgenpET00uX2h0bWxUb0VsZW1lbnQoIHggKTpcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCB4ICkgLy8gTXVzdCBiZSBhIHN0YW5kYXJkIHNlbGVjdG9yXG4gICAgICAgICk7XG4gICAgfVxuICAgIFxuICAgIHRocm93ICdVbnN1cHBvcnRlZCBzZWxlY3RvciB0eXBlIGZvdW5kIHJ1bm5pbmcgenogZnVuY3Rpb24uJztcbn07XG5cbi8vIEJ1aWxkIGFyZ3MgYXJyYXkgd2l0aCB0b0luc2VydCBhcyBmaXJzdCBwb3NpdGlvbiBhbmQgdGhlbiB0aGUgYXJndW1lbnRzIG9mIHRoaXMgZnVuY3Rpb25cbnp6RE9NLl9hcmdzID0gZnVuY3Rpb24oIHByZXZpb3VzQXJncywgdG9JbnNlcnQgKXtcbiAgICB2YXIgcmVzdWx0ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIHByZXZpb3VzQXJncyApO1xuICAgIHJlc3VsdC5wdXNoKCB0b0luc2VydCApO1xuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG56ekRPTS5fYnVpbGQgPSBmdW5jdGlvbiAoIHggKSB7XG4gICAgaWYgKCB4IGluc3RhbmNlb2YgRWxlbWVudCApe1xuICAgICAgICByZXR1cm4gbmV3IHp6RE9NLlNTKCB4ICk7XG4gICAgfVxuICAgIGlmICggeCBpbnN0YW5jZW9mIEhUTUxDb2xsZWN0aW9uIHx8IHggaW5zdGFuY2VvZiBOb2RlTGlzdCApe1xuICAgICAgICB4ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIHggKTtcbiAgICB9XG4gICAgcmV0dXJuIHgubGVuZ3RoID09PSAxPyBuZXcgenpET00uU1MoIHhbIDAgXSApOiBuZXcgenpET00uTU0oIHggKTtcbn07XG5cbnp6RE9NLl9nZXRFcnJvciA9IGZ1bmN0aW9uICggbWV0aG9kICkge1xuICAgIHJldHVybiAnTWV0aG9kIFwiJyArIG1ldGhvZCArICdcIiBub3QgcmVhZHkgZm9yIHRoYXQgdHlwZSEnO1xufTtcblxuenpET00uX2h0bWxUb0VsZW1lbnQgPSBmdW5jdGlvbiAoIGh0bWwgKSB7XG4gICAgdmFyIHRlbXBsYXRlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3RlbXBsYXRlJyApO1xuICAgIHRlbXBsYXRlLmlubmVySFRNTCA9IGh0bWwudHJpbSgpO1xuICAgIHJldHVybiB0ZW1wbGF0ZS5jb250ZW50LmNoaWxkRWxlbWVudENvdW50ID09PSAxP1xuICAgICAgICB0ZW1wbGF0ZS5jb250ZW50LmZpcnN0Q2hpbGQ6XG4gICAgICAgIHRlbXBsYXRlLmNvbnRlbnQuY2hpbGROb2Rlcztcbn07XG5cbi8vIFJlZ2lzdGVyIHp6IGZ1bmN0aW9uXG52YXIgeno7XG4oZnVuY3Rpb24oKSB7IFxuICAgIHp6ID0genpET00ueno7IFxufSkoKTtcblxuenpET00uX2V2ZW50cyA9IHt9O1xuXG56ekRPTS5fYWRkRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKCBzcywgZXZlbnROYW1lLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSApe1xuICAgIHZhciBlbCA9IHNzLmVsO1xuICAgIHZhciBlbElkID0gc3MuX2dldEVsSWQoKTtcbiAgICB2YXIgdGhpc0V2ZW50cyA9IHp6RE9NLl9ldmVudHNbIGVsSWQgXTtcbiAgICBpZiAoICEgdGhpc0V2ZW50cyApe1xuICAgICAgICB0aGlzRXZlbnRzID0ge307XG4gICAgICAgIHp6RE9NLl9ldmVudHNbIGVsSWQgXSA9IHRoaXNFdmVudHM7XG4gICAgfVxuICAgIHZhciB0aGlzTGlzdGVuZXJzID0gdGhpc0V2ZW50c1sgZXZlbnROYW1lIF07XG4gICAgaWYgKCAhIHRoaXNMaXN0ZW5lcnMgKXtcbiAgICAgICAgdGhpc0xpc3RlbmVycyA9IFtdO1xuICAgICAgICB0aGlzRXZlbnRzWyBldmVudE5hbWUgXSA9IHRoaXNMaXN0ZW5lcnM7XG4gICAgfVxuICAgIHRoaXNMaXN0ZW5lcnMucHVzaCggbGlzdGVuZXIgKTtcbiAgICBcbiAgICAvLyBhZGRFdmVudExpc3RlbmVyXG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lciggZXZlbnROYW1lLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSApO1xufTtcblxuLy9UT0RPIG11c3QgcmVtb3ZlIGFsbCBsaXN0ZW5lcnMgd2hlbiBhbiBlbGVtZW50IGlzIHJlbW92ZWRcbnp6RE9NLl9yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oIHNzLCBldmVudE5hbWUsIGxpc3RlbmVyLCB1c2VDYXB0dXJlICl7XG4gICAgdmFyIGVsID0gc3MuZWw7XG4gICAgdmFyIGVsSWQgPSBzcy5fZ2V0RWxJZCgpO1xuICAgIHZhciB0aGlzRXZlbnRzID0genpET00uX2V2ZW50c1sgZWxJZCBdO1xuICAgIGlmICggISB0aGlzRXZlbnRzICl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgaWYgKCAhIGV2ZW50TmFtZSApeyBcbiAgICAgICAgLy8gTXVzdCByZW1vdmUgYWxsIGV2ZW50c1xuICAgICAgICBmb3IgKCB2YXIgY3VycmVudEV2ZW50TmFtZSBpbiB0aGlzRXZlbnRzICl7XG4gICAgICAgICAgICB2YXIgY3VycmVudExpc3RlbmVycyA9IHRoaXNFdmVudHNbIGN1cnJlbnRFdmVudE5hbWUgXTtcbiAgICAgICAgICAgIHp6RE9NLl9yZW1vdmVMaXN0ZW5lcnMoIGVsLCBjdXJyZW50TGlzdGVuZXJzLCBudWxsLCB1c2VDYXB0dXJlLCBjdXJyZW50RXZlbnROYW1lICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICAvLyBNdXN0IHJlbW92ZSBsaXN0ZW5lcnMgb2Ygb25seSBvbmUgZXZlbnRcbiAgICB2YXIgdGhpc0xpc3RlbmVycyA9IHRoaXNFdmVudHNbIGV2ZW50TmFtZSBdO1xuICAgIHp6RE9NLl9yZW1vdmVMaXN0ZW5lcnMoIGVsLCB0aGlzTGlzdGVuZXJzLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSwgZXZlbnROYW1lICk7XG59O1xuXG4vL1RPRE8gdGVzdCBhbGwgdGhlIGxpc3RlbmVycyBhcmUgcmVtb3ZlZFxuenpET00uX3JlbW92ZUxpc3RlbmVycyA9IGZ1bmN0aW9uKCBlbCwgdGhpc0xpc3RlbmVycywgbGlzdGVuZXIsIHVzZUNhcHR1cmUsIGV2ZW50TmFtZSApe1xuICAgIGlmICggISB0aGlzTGlzdGVuZXJzICl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgdGhpc0xpc3RlbmVycy5sZW5ndGg7ICsraSApe1xuICAgICAgICB2YXIgY3VycmVudExpc3RlbmVyID0gdGhpc0xpc3RlbmVyc1sgaSBdO1xuICAgICAgICBpZiAoICEgbGlzdGVuZXIgfHwgY3VycmVudExpc3RlbmVyID09PSBsaXN0ZW5lciApe1xuICAgICAgICAgICAgdGhpc0xpc3RlbmVycy5zcGxpY2UoIGksIDEgKTsgLy8gRGVsZXRlIGxpc3RlbmVyIGF0IGkgcG9zaXRpb25cbiAgICAgICAgICAgIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoIGV2ZW50TmFtZSwgY3VycmVudExpc3RlbmVyLCB1c2VDYXB0dXJlICk7XG4gICAgICAgICAgICBpZiAoIGxpc3RlbmVyICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBcbn07XG4vKiBFbmQgb2YgZXZlbnRzICovXG5cbnp6RE9NLl9kZCA9IHt9O1xuXG56ekRPTS5fZ2V0RGVmYXVsdERpc3BsYXkgPSBmdW5jdGlvbiggZWwgKSB7XG4gICAgdmFyIG5vZGVOYW1lID0gZWwubm9kZU5hbWU7XG4gICAgdmFyIGRpc3BsYXkgPSB6ekRPTS5fZGRbIG5vZGVOYW1lIF07XG5cbiAgICBpZiAoIGRpc3BsYXkgKSB7XG4gICAgICAgIHJldHVybiBkaXNwbGF5O1xuICAgIH1cblxuICAgIHZhciBkb2MgPSBlbC5vd25lckRvY3VtZW50O1xuICAgIHZhciB0ZW1wID0gZG9jLmJvZHkuYXBwZW5kQ2hpbGQoIGRvYy5jcmVhdGVFbGVtZW50KCBub2RlTmFtZSApICk7XG4gICAgZGlzcGxheSA9IGdldENvbXB1dGVkU3R5bGUoIHRlbXAgKVsgJ2Rpc3BsYXknIF07XG5cbiAgICB0ZW1wLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIHRlbXAgKTtcblxuICAgIGlmICggZGlzcGxheSA9PT0gJ25vbmUnICkge1xuICAgICAgICBkaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICB9XG4gICAgenpET00uX2RkWyBub2RlTmFtZSBdID0gZGlzcGxheTtcblxuICAgIHJldHVybiBkaXNwbGF5O1xufTtcbi8qIEVuZCBvZiB2aXNpYmxlICovXG5cbi8qIEl0IGRlcGVuZHMgb24gZm9ybXMgcGx1Z2luISAqL1xuLy8gU2VyaWFsaXplIGEgc3MgaW5zdGFuY2UsIGEgbW0gaW5zdGFuY2Ugb3IgYW4gb2JqZWN0IGludG8gYSBxdWVyeSBzdHJpbmdcbnp6RE9NLl9wYXJhbUl0ZW0gPSBmdW5jdGlvbiggciwga2V5LCB2YWx1ZSApIHtcbiAgICByLnB1c2goIFxuICAgICAgICBlbmNvZGVVUklDb21wb25lbnQoIGtleSApICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KCB2YWx1ZSA9PSBudWxsPyAnJzogdmFsdWUgKVxuICAgICk7XG59O1xuLyoqIEBub2NvbGxhcHNlICovXG56ekRPTS5wYXJhbSA9IGZ1bmN0aW9uKCB4ICkge1xuXHRcbiAgICBpZiAoIHggPT0gbnVsbCApIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIHZhciByID0gW107XG4gICAgXG4gICAgaWYgKCB4IGluc3RhbmNlb2YgenpET00uU1MgKXtcbiAgICAgICAgenpET00uX3BhcmFtSXRlbSggciwgeC5hdHRyKCAnbmFtZScgKSwgeC52YWwoKSApO1xuICAgIH0gZWxzZSBpZiAoIHggaW5zdGFuY2VvZiB6ekRPTS5NTSApe1xuICAgICAgICBmb3IgKCB2YXIgYyA9IDA7IGMgPCB4Lmxpc3QubGVuZ3RoOyArK2MgKXtcbiAgICAgICAgICAgIHZhciBzcyA9IHgubGlzdFsgYyBdO1xuICAgICAgICAgICAgenpET00uX3BhcmFtSXRlbSggciwgc3MuYXR0ciggJ25hbWUnICksIHNzLnZhbCgpICk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCB0eXBlb2YgeCA9PT0gJ29iamVjdCcgKXsgIFxuICAgICAgICBmb3IgKCB2YXIgaSBpbiB4ICkge1xuICAgICAgICAgICAgenpET00uX3BhcmFtSXRlbSggciwgaSwgeFsgaSBdICk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyB6ekRPTS5fZ2V0RXJyb3IoICdwYXJhbScgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gci5qb2luKCAnJicgKTtcbn07XG4vKiBlbmQgb2YgdXRpbHMgKi9cblxuLyoqIEBjb25zdHJ1Y3RvciAqL1xuenpET00uU1MgPSBmdW5jdGlvbiAoIF9lbCApIHtcbiAgICB0aGlzLmVsID0gX2VsO1xuICAgIHRoaXMubm9kZXMgPSBbIF9lbCBdO1xuICAgIFxuICAgIC8vIEFycmF5IGxpa2VcbiAgICB0aGlzLmxlbmd0aCA9IDE7XG4gICAgdGhpc1sgMCBdID0gX2VsO1xufTtcblxuLyogTWV0aG9kcyBOT1QgaW5jbHVkZWQgaW4ganF1ZXJ5ICovXG56ekRPTS5TUy5wcm90b3R5cGUuX2djcyA9IGZ1bmN0aW9uICggc2VsZiwgcHJvcGVydHkgKSB7XG4gICAgdmFyIHggPSBnZXRDb21wdXRlZFN0eWxlKCBzZWxmLmVsLCBudWxsIClbIHByb3BlcnR5IF0ucmVwbGFjZSggJ3B4JywgJycgKTtcbiAgICByZXR1cm4gaXNOYU4oIHggKT8geDogcGFyc2VGbG9hdCggeCApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLl9nZXRFbElkID0gZnVuY3Rpb24oKXtcbiAgICB2YXIgZWxJZCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1lbElkJyApO1xuICAgIGlmICggISBlbElkICl7XG4gICAgICAgIC8vIEdlbmVyYXRlIGEgcmFuZG9tIHN0cmluZyB3aXRoIDQgY2hhcnNcbiAgICAgICAgZWxJZCA9IE1hdGguZmxvb3IoICggMSArIE1hdGgucmFuZG9tKCkgKSAqIDB4MTAwMDAgKVxuICAgICAgICAgICAgLnRvU3RyaW5nKCAxNiApXG4gICAgICAgICAgICAuc3Vic3RyaW5nKCAxICk7XG4gICAgICAgIHRoaXMuZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1lbElkJywgZWxJZCApO1xuICAgIH1cbiAgICByZXR1cm4gZWxJZDtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5faW5zZXJ0SGVscGVyID0gZnVuY3Rpb24gKCBwb3NpdGlvbiwgeCApIHtcbiAgICBpZiAoIHggaW5zdGFuY2VvZiBFbGVtZW50ICl7XG4gICAgICAgIHRoaXMuZWwuaW5zZXJ0QWRqYWNlbnRFbGVtZW50KCBwb3NpdGlvbiwgeCApO1xuICAgIH0gZWxzZSBpZiAoIHggaW5zdGFuY2VvZiB6ekRPTS5TUyApe1xuICAgICAgICB0aGlzLmVsLmluc2VydEFkamFjZW50RWxlbWVudCggcG9zaXRpb24sIHguZWwgKTtcbiAgICB9IGVsc2UgaWYgKCB0eXBlb2YgeCA9PT0gJ3N0cmluZycgKSB7XG4gICAgICAgIHRoaXMuZWwuaW5zZXJ0QWRqYWNlbnRIVE1MKCBwb3NpdGlvbiwgeCApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93ICdJbnNlcnQgb3BlcmF0aW9uIG5vdCByZWFkeSBmb3IgdGhhdCB0eXBlISc7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLl9pdGVyYXRlID0gZnVuY3Rpb24oIHZhbHVlLCBmbiApe1xuICAgIGlmICggQXJyYXkuaXNBcnJheSggdmFsdWUgKSApe1xuICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7ICsraSApe1xuICAgICAgICAgICAgZm4oIHRoaXMsIHZhbHVlWyBpIF0gKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGZuKCB0aGlzLCB2YWx1ZSApOyAgIFxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5fb3V0ZXIgPSBmdW5jdGlvbiAoIHByb3BlcnR5LCBsaW5rZWQxLCBsaW5rZWQyLCB3aXRoTWFyZ2luICkge1xuICAgIGlmICggdGhpcy5lbFsgJ29mZnNldCcgKyBwcm9wZXJ0eSBdICkge1xuICAgICAgICByZXR1cm4genpET00uU1MuX291dGVyQ2FsYyggdGhpcywgcHJvcGVydHksIGxpbmtlZDEsIGxpbmtlZDIsIHdpdGhNYXJnaW4gKTtcbiAgICB9XG4gICAgXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiB0aGlzLl9zd2FwKCBcbiAgICAgICAgdGhpcy5lbCwgXG4gICAgICAgIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICByZXR1cm4genpET00uU1MuX291dGVyQ2FsYyggc2VsZiwgcHJvcGVydHksIGxpbmtlZDEsIGxpbmtlZDIsIHdpdGhNYXJnaW4gKTtcbiAgICAgICAgfSBcbiAgICApO1xufTtcblxuenpET00uU1MuX291dGVyQ2FsYyA9IGZ1bmN0aW9uICggc3MsIHByb3BlcnR5LCBsaW5rZWQxLCBsaW5rZWQyLCB3aXRoTWFyZ2luICkge1xuICAgIHZhciB2YWx1ZSA9IHNzLl9nY3MoIHNzLCBwcm9wZXJ0eS50b0xvd2VyQ2FzZSgpICk7XG4gICAgdmFyIHBhZGRpbmcgPSBzcy5fZ2NzKCBzcywgJ3BhZGRpbmcnICsgbGlua2VkMSApICsgc3MuX2djcyggc3MsICdwYWRkaW5nJyArIGxpbmtlZDIgKTtcbiAgICB2YXIgYm9yZGVyID0gc3MuX2djcyggc3MsICdib3JkZXInICsgbGlua2VkMSArICdXaWR0aCcgKSArIHNzLl9nY3MoIHNzLCAnYm9yZGVyJyArIGxpbmtlZDIgKyAnV2lkdGgnICk7XG4gICAgXG4gICAgdmFyIHRvdGFsID0gdmFsdWUgKyBwYWRkaW5nICsgYm9yZGVyO1xuICAgIFxuICAgIC8vIE5vIG1hcmdpblxuICAgIGlmICggISB3aXRoTWFyZ2luICl7XG4gICAgICAgIHJldHVybiB0b3RhbDtcbiAgICB9XG4gICAgXG4gICAgdmFyIG1hcmdpbiA9IHNzLl9nY3MoIHNzLCAnbWFyZ2luJyArIGxpbmtlZDEgKSArIHNzLl9nY3MoIHNzLCAnbWFyZ2luJyArIGxpbmtlZDIgKTtcbiAgICByZXR1cm4gdG90YWwgKyBtYXJnaW47XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuX3NldENzc1VzaW5nS2V5VmFsdWUgPSBmdW5jdGlvbiAoIGtleSwgdmFsdWUgKSB7XG4gICAgaWYgKCB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUuY2FsbCggdGhpcy5lbCwgdGhpcy5faSA9PT0gdW5kZWZpbmVkPyAwOiB0aGlzLl9pLCB0aGlzICk7XG4gICAgfVxuICAgIHRoaXMuZWwuc3R5bGVbIGtleSBdID0gXG4gICAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgISAvXi0/XFxkK1xcLj9cXGQqJC8udGVzdCggdmFsdWUgKT8gLy8gaWYgaXQgaXMgYSBzdHJpbmcgYW5kIGlzIG5vdCBhIGZsb2F0IG51bWJlclxuICAgICAgICAgICAgdmFsdWU6IFxuICAgICAgICAgICAgdmFsdWUgKyAncHgnO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLl9zZXRDc3NVc2luZ09iamVjdCA9IGZ1bmN0aW9uICggb2JqZWN0ICkge1xuICAgIGZvciAoIHZhciBrZXkgaW4gb2JqZWN0ICkge1xuICAgICAgICB0aGlzLl9zZXRDc3NVc2luZ0tleVZhbHVlKCBrZXksIG9iamVjdFsga2V5IF0gKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eVxuICogQHBhcmFtIHtzdHJpbmd8RnVuY3Rpb249fSB2YWx1ZVxuICovXG56ekRPTS5TUy5wcm90b3R5cGUuX3N0eWxlUHJvcGVydHkgPSBmdW5jdGlvbiAoIHByb3BlcnR5LCB2YWx1ZSApIHtcbiAgICAvLyBnZXRcbiAgICBpZiAoIHZhbHVlID09PSB1bmRlZmluZWQgKXtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YWx1ZSA9IHRoaXMuX2djcyggdGhpcywgcHJvcGVydHkgKTtcbiAgICAgICAgcmV0dXJuIHBhcnNlRmxvYXQoIFxuICAgICAgICAgICAgdmFsdWUgIT09ICdhdXRvJz8gXG4gICAgICAgICAgICAgICAgdmFsdWU6IFxuICAgICAgICAgICAgICAgIHRoaXMuX3N3YXAoIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVsLCBcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9nY3MoIHNlbGYsIHByb3BlcnR5ICk7XG4gICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgIH1cblxuICAgIC8vIHNldFxuICAgIHRoaXMuX3NldENzc1VzaW5nS2V5VmFsdWUoIHByb3BlcnR5LCB2YWx1ZSApO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLl9zd2FwID0gZnVuY3Rpb24oIF9lbCwgY2FsbGJhY2sgKSB7XG4gICAgdmFyIG9sZCA9IHt9O1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICBkaXNwbGF5OiAnYmxvY2snLFxuICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcbiAgICAgICAgdmlzaWJpbGl0eTogJ2hpZGRlbidcbiAgICB9O1xuXG4gICAgLy8gUmVtZW1iZXIgdGhlIG9sZCB2YWx1ZXMgYW5kIGluc2VydCB0aGUgbmV3IG9uZXNcbiAgICBmb3IgKCB2YXIgbmFtZSBpbiBvcHRpb25zICkge1xuICAgICAgICBvbGRbIG5hbWUgXSA9IF9lbC5zdHlsZVsgbmFtZSBdO1xuICAgICAgICBfZWwuc3R5bGVbIG5hbWUgXSA9IG9wdGlvbnNbIG5hbWUgXTtcbiAgICB9XG5cbiAgICB2YXIgdmFsID0gY2FsbGJhY2suY2FsbCggX2VsICk7XG5cbiAgICAvLyBSZXZlcnQgdGhlIG9sZCB2YWx1ZXNcbiAgICBmb3IgKCBuYW1lIGluIG9wdGlvbnMgKSB7XG4gICAgICAgIF9lbC5zdHlsZVsgbmFtZSBdID0gb2xkWyBuYW1lIF07XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbDtcbn07XG5cbi8qIE1ldGhvZHMgaW5jbHVkZWQgaW4ganF1ZXJ5ICovXG56ekRPTS5TUy5wcm90b3R5cGUuYWRkQ2xhc3MgPSBmdW5jdGlvbiAoIG5hbWUgKSB7XG4gICAgcmV0dXJuIHRoaXMuX2l0ZXJhdGUoXG4gICAgICAgIG5hbWUsXG4gICAgICAgIGZ1bmN0aW9uKCBzZWxmLCB2ICl7XG4gICAgICAgICAgICBzZWxmLmVsLmNsYXNzTGlzdC5hZGQoIHYgKTsgXG4gICAgICAgIH1cbiAgICApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmFmdGVyID0gZnVuY3Rpb24gKCB4ICkge1xuICAgIHJldHVybiB0aGlzLl9pbnNlcnRIZWxwZXIoICdhZnRlcmVuZCcsIHggKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbiAoIHggKSB7XG4gICAgaWYgKCB4IGluc3RhbmNlb2YgRWxlbWVudCApe1xuICAgICAgICB0aGlzLmVsLmFwcGVuZENoaWxkKCB4ICk7XG4gICAgfSBlbHNlIGlmICggeCBpbnN0YW5jZW9mIHp6RE9NLlNTICl7XG4gICAgICAgIHRoaXMuZWwuYXBwZW5kQ2hpbGQoIHguZWwgKTtcbiAgICB9IGVsc2UgaWYgKCB0eXBlb2YgeCA9PT0gJ3N0cmluZycgKSB7XG4gICAgICAgIHRoaXMuZWwuaW5zZXJ0QWRqYWNlbnRIVE1MKCAnYmVmb3JlZW5kJywgeCApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IHp6RE9NLl9nZXRFcnJvciggJ2FwcGVuZCcgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuYXBwZW5kVG8gPSBmdW5jdGlvbiAoIHggKSB7XG4gICAgLy8gRG8gbm90aGluZyBhbmQgcmV0dXJuIHRoaXMgaWYgaXQgaXMgbnVsbFxuICAgIGlmICggeCA9PSBudWxsICl7XG4gICAgICAgIHJldHVybiB0aGlzOyAgICBcbiAgICB9XG4gICAgXG4gICAgLy8gSXMgaXQgYSBFbGVtZW50P1xuICAgIGlmICggeCBpbnN0YW5jZW9mIEVsZW1lbnQgKXtcbiAgICAgICAgeC5hcHBlbmRDaGlsZCggdGhpcy5lbCApO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgXG4gICAgLy8gSXMgaXQgYSBzdHJpbmc/XG4gICAgaWYgKCB0eXBlb2YgeCA9PT0gJ3N0cmluZycgKXtcbiAgICAgICAgeCA9IHp6RE9NLl9idWlsZChcbiAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIHggKVxuICAgICAgICApO1xuICAgIH1cbiAgICBcbiAgICAvLyBJcyBpdCBhIHp6RE9NLlNTP1xuICAgIGlmICggeCBpbnN0YW5jZW9mIHp6RE9NLlNTICkge1xuICAgICAgICB4LmVsLmFwcGVuZENoaWxkKCB0aGlzLmVsICk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBcbiAgICAvLyBJcyBpdCBhIHp6RE9NLk1NP1xuICAgIGlmICggeCBpbnN0YW5jZW9mIHp6RE9NLk1NICkge1xuICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCB4Lm5vZGVzLmxlbmd0aDsgKytpICl7XG4gICAgICAgICAgICB4Lm5vZGVzWyBpIF0uYXBwZW5kQ2hpbGQoIHRoaXMuZWwuY2xvbmVOb2RlKCB0cnVlICkgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9IFxuICAgIFxuICAgIHRocm93IHp6RE9NLl9nZXRFcnJvciggJ2lzJyApO1xufTtcblxuLy9UT0RPIGFkZCBzdXBwb3J0IG9mIGZ1bmN0aW9uIHR5cGUgaW4gdmFsdWVcbi8qKlxuICogQHBhcmFtIHtzdHJpbmd8T2JqZWN0fSB4XG4gKiBAcGFyYW0ge3N0cmluZz19IHZhbHVlXG4gKi9cbnp6RE9NLlNTLnByb3RvdHlwZS5hdHRyID0gZnVuY3Rpb24gKCB4LCB2YWx1ZSApIHtcbiAgICAvLyBzZXQgdXNpbmcgb2JqZWN0XG4gICAgaWYgKCB0eXBlb2YgeCA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgZm9yICggdmFyIGtleSBpbiB4ICkge1xuICAgICAgICAgICAgdGhpcy5hdHRyKCBrZXksIHhbIGtleSBdICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIFxuICAgIC8vIGdldFxuICAgIGlmICggdmFsdWUgPT09IHVuZGVmaW5lZCApe1xuICAgICAgICByZXR1cm4gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoIHggKTtcbiAgICB9XG4gICAgXG4gICAgLy8gcmVtb3ZlIGF0dHJcbiAgICBpZiAoIHZhbHVlID09PSBudWxsICl7XG4gICAgICAgIHJldHVybiB0aGlzLnJlbW92ZUF0dHIoIHggKTsgICAgXG4gICAgfVxuICAgIFxuICAgIC8vIHNldFxuICAgIHRoaXMuZWwuc2V0QXR0cmlidXRlKCB4LCB2YWx1ZSApO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmJlZm9yZSA9IGZ1bmN0aW9uICggeCApIHtcbiAgICByZXR1cm4gdGhpcy5faW5zZXJ0SGVscGVyKCAnYmVmb3JlYmVnaW4nLCB4ICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuY2hpbGRyZW4gPSBmdW5jdGlvbiAoIHNlbGVjdG9yICkge1xuICAgIHJldHVybiB6ekRPTS5fYnVpbGQoIFxuICAgICAgICBzZWxlY3Rvcj9cbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5maWx0ZXIuY2FsbChcbiAgICAgICAgICAgICAgICB0aGlzLmVsLmNoaWxkcmVuLCBcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiggY2hpbGQgKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNoaWxkLm1hdGNoZXMoIHNlbGVjdG9yICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTpcbiAgICAgICAgICAgIHRoaXMuZWwuY2hpbGRyZW4gXG4gICAgKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uICggICkge1xuICAgIHJldHVybiBuZXcgenpET00uU1MoIHRoaXMuZWwuY2xvbmVOb2RlKCB0cnVlICkgKTtcbn07XG5cbi8vVE9ETyBhZGQgc3VwcG9ydCBvZiBmdW5jdGlvbiB0eXBlIGluIHZhbHVlXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfE9iamVjdH0geDFcbiAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcj19IHgyXG4gKi9cbnp6RE9NLlNTLnByb3RvdHlwZS5jc3MgPSBmdW5jdGlvbiAoIHgxLCB4MiApIHtcbiAgICB2YXIgbnVtYmVyID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBcbiAgICBpZiAoIG51bWJlciA9PT0gMSApe1xuICAgICAgICBpZiAoICEgeDEgKXtcbiAgICAgICAgICAgIHRocm93ICdOdWxsIHZhbHVlIG5vdCBhbGxvd2VkIGluIGNzcyBtZXRob2QhJztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gZ2V0XG4gICAgICAgIGlmICggdHlwZW9mIHgxID09PSAnc3RyaW5nJyApIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRDb21wdXRlZFN0eWxlKCB0aGlzLmVsIClbIHgxIF07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIHNldCB1c2luZyBvYmplY3RcbiAgICAgICAgaWYgKCB0eXBlb2YgeDEgPT09ICdvYmplY3QnICl7XG4gICAgICAgICAgICB0aGlzLl9zZXRDc3NVc2luZ09iamVjdCggeDEgKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB0aHJvdyAnV3JvbmcgdHlwZSBvciBhcmd1bWVudCBpbiBjc3MgbWV0aG9kISc7XG4gICAgfVxuICAgIFxuICAgIC8vIHNldCB1c2luZyBrZXkgdmFsdWUgcGFpclxuICAgIGlmICggbnVtYmVyID09PSAyICl7XG4gICAgICAgIHRoaXMuX3NldENzc1VzaW5nS2V5VmFsdWUoIHgxLCB4MiApO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgXG4gICAgdGhyb3cgJ1dyb25nIG51bWJlciBvZiBhcmd1bWVudHMgaW4gY3NzIG1ldGhvZCEnO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmVhY2ggPSBmdW5jdGlvbiAoIGVhY2hGbiApIHtcbiAgICBlYWNoRm4uY2FsbCggdGhpcy5lbCwgMCwgdGhpcywgdGhpcy5ub2RlcyApO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmVtcHR5ID0gZnVuY3Rpb24gKCAgKSB7XG4gICAgd2hpbGUoIHRoaXMuZWwuZmlyc3RDaGlsZCApe1xuICAgICAgICB0aGlzLmVsLnJlbW92ZUNoaWxkKCB0aGlzLmVsLmZpcnN0Q2hpbGQgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuZmlsdGVyID0gZnVuY3Rpb24gKCB4ICkge1xuICAgIGlmICggdHlwZW9mIHggPT09ICdzdHJpbmcnICl7IC8vIElzIGEgc3RyaW5nIHNlbGVjdG9yXG4gICAgICAgIHJldHVybiB6ekRPTS5fYnVpbGQoIFxuICAgICAgICAgICAgdGhpcy5lbC5tYXRjaGVzKCB4ICk/IFsgdGhpcy5lbCBdOiBbXVxuICAgICAgICApO1xuICAgIH1cbiAgICBcbiAgICBpZiAoIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nICl7IC8vIElzIGEgZnVuY3Rpb25cbiAgICAgICAgcmV0dXJuIHp6RE9NLl9idWlsZChcbiAgICAgICAgICAgIHguY2FsbCggdGhpcy5lbCwgdGhpcy5faSA9PT0gdW5kZWZpbmVkPyAwOiB0aGlzLl9pLCB0aGlzICk/IFsgdGhpcy5lbCBdOiBbXVxuICAgICAgICApO1xuICAgIH0gIFxuICAgIFxuICAgIHRocm93IHp6RE9NLl9nZXRFcnJvciggJ2ZpbHRlcicgKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24gKCBzZWxlY3RvciApIHtcbiAgICByZXR1cm4genpET00uX2J1aWxkKCBcbiAgICAgICAgdGhpcy5lbC5xdWVyeVNlbGVjdG9yQWxsKCBzZWxlY3RvciApXG4gICAgKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5oYXNDbGFzcyA9IGZ1bmN0aW9uICggbmFtZSApIHtcbiAgICByZXR1cm4gdGhpcy5lbC5jbGFzc0xpc3QuY29udGFpbnMoIG5hbWUgKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5oZWlnaHQgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuICAgIHJldHVybiB0aGlzLl9zdHlsZVByb3BlcnR5KCAnaGVpZ2h0JywgdmFsdWUgKTtcbn07XG5cbi8vVE9ETyBhZGQgc3VwcG9ydCBvZiBmdW5jdGlvbiB0eXBlIGluIHZhbHVlXG56ekRPTS5TUy5wcm90b3R5cGUuaHRtbCA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG4gICAgLy8gZ2V0XG4gICAgaWYgKCB2YWx1ZSA9PT0gdW5kZWZpbmVkICl7XG4gICAgICAgIHJldHVybiB0aGlzLmVsLmlubmVySFRNTDtcbiAgICB9XG5cbiAgICAvLyBzZXRcbiAgICB0aGlzLmVsLmlubmVySFRNTCA9IHZhbHVlO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmluZGV4ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICggISB0aGlzLmVsICl7XG4gICAgICAgIHJldHVybiAtMTtcbiAgICB9XG4gICAgXG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBjdXJyZW50RWwgPSB0aGlzLmVsO1xuICAgIGRvIHtcbiAgICAgICAgaSsrO1xuICAgIH0gd2hpbGUgKCBjdXJyZW50RWwgPSBjdXJyZW50RWwucHJldmlvdXNFbGVtZW50U2libGluZyApO1xuICAgIFxuICAgIHJldHVybiBpO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmlzID0gZnVuY3Rpb24gKCB4ICkge1xuICAgIGlmICggeCA9PSBudWxsICl7XG4gICAgICAgIHJldHVybiBmYWxzZTsgICAgXG4gICAgfVxuICAgIFxuICAgIGlmICggeCBpbnN0YW5jZW9mIEVsZW1lbnQgKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuZWwgPT09IHg7XG4gICAgfVxuICAgIFxuICAgIGlmICggeCBpbnN0YW5jZW9mIHp6RE9NLlNTICkge1xuICAgICAgICByZXR1cm4gdGhpcy5lbCA9PT0geC5lbDtcbiAgICB9IFxuXG4gICAgaWYgKCB4IGluc3RhbmNlb2YgenpET00uTU0gKSB7XG4gICAgICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHgubm9kZXMubGVuZ3RoOyArK2kgKXtcbiAgICAgICAgICAgIGlmICggdGhpcy5lbCA9PT0geC5ub2Rlc1sgaSBdICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gXG5cbiAgICBpZiAoIHR5cGVvZiB4ID09PSAnc3RyaW5nJyApe1xuICAgICAgICByZXR1cm4gdGhpcy5lbC5tYXRjaGVzKCB4ICk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgenpET00uU1MoIHRoaXMuZWwubmV4dEVsZW1lbnRTaWJsaW5nICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUub2Zmc2V0ID0gZnVuY3Rpb24gKCBjICkge1xuICAgIFxuICAgIC8vIHNldCB0b3AgYW5kIGxlZnQgdXNpbmcgY3NzXG4gICAgaWYgKCBjICl7XG4gICAgICAgIHRoaXMuX3N0eWxlUHJvcGVydHkoICd0b3AnLCBjLnRvcCApO1xuICAgICAgICB0aGlzLl9zdHlsZVByb3BlcnR5KCAnbGVmdCcsIGMubGVmdCApO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgXG4gICAgLy8gZ2V0XG4gICAgdmFyIHJlY3QgPSB0aGlzLmVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogcmVjdC50b3AgKyBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCxcbiAgICAgICAgbGVmdDogcmVjdC5sZWZ0ICsgZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0XG4gICAgfTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5vZmZzZXRQYXJlbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG9mZnNldFBhcmVudCA9IHRoaXMuZWwub2Zmc2V0UGFyZW50O1xuICAgIHJldHVybiBvZmZzZXRQYXJlbnQ/IG5ldyB6ekRPTS5TUyggb2Zmc2V0UGFyZW50ICk6IHRoaXM7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7Ym9vbGVhbj19IHdpdGhNYXJnaW5cbiAqL1xuenpET00uU1MucHJvdG90eXBlLm91dGVySGVpZ2h0ID0gZnVuY3Rpb24gKCB3aXRoTWFyZ2luICkge1xuICAgIHJldHVybiB0aGlzLl9vdXRlciggJ0hlaWdodCcsICdUb3AnLCAnQm90dG9tJywgd2l0aE1hcmdpbiApO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge2Jvb2xlYW49fSB3aXRoTWFyZ2luXG4gKi9cbnp6RE9NLlNTLnByb3RvdHlwZS5vdXRlcldpZHRoID0gZnVuY3Rpb24gKCB3aXRoTWFyZ2luICkge1xuICAgIHJldHVybiB0aGlzLl9vdXRlciggJ1dpZHRoJywgJ0xlZnQnLCAnUmlnaHQnLCB3aXRoTWFyZ2luICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUucGFyZW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgenpET00uU1MoIHRoaXMuZWwucGFyZW50Tm9kZSApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnBvc2l0aW9uID0gZnVuY3Rpb24gKCByZWxhdGl2ZVRvVmlld3BvcnQgKSB7XG4gICAgcmV0dXJuIHJlbGF0aXZlVG9WaWV3cG9ydD9cbiAgICAgICAgdGhpcy5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTpcbiAgICAgICAgeyBcbiAgICAgICAgICAgIGxlZnQ6IHRoaXMuZWwub2Zmc2V0TGVmdCwgXG4gICAgICAgICAgICB0b3A6IHRoaXMuZWwub2Zmc2V0VG9wXG4gICAgICAgIH07XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUucHJlcGVuZCA9IGZ1bmN0aW9uICggeCApIHtcbiAgICBpZiAoIHggaW5zdGFuY2VvZiBFbGVtZW50ICl7XG4gICAgICAgIHRoaXMuZWwuaW5zZXJ0QmVmb3JlKCB4LCB0aGlzLmVsLmZpcnN0Q2hpbGQgKTtcbiAgICB9IGVsc2UgaWYgKCB4IGluc3RhbmNlb2YgenpET00uU1MgKXtcbiAgICAgICAgdGhpcy5lbC5pbnNlcnRCZWZvcmUoIHguZWwsIHRoaXMuZWwuZmlyc3RDaGlsZCApO1xuICAgIH0gZWxzZSBpZiAoIHR5cGVvZiB4ID09PSAnc3RyaW5nJyApe1xuICAgICAgICB0aGlzLmVsLmluc2VydEFkamFjZW50SFRNTCggJ2FmdGVyYmVnaW4nLCB4ICk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgenpET00uX2dldEVycm9yKCAncHJlcGVuZCcgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUucHJldiA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IHp6RE9NLlNTKCB0aGlzLmVsLnByZXZpb3VzRWxlbWVudFNpYmxpbmcgKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5lbC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCB0aGlzLmVsICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUucmVtb3ZlQXR0ciA9IGZ1bmN0aW9uICggbmFtZSApIHtcbiAgICB0aGlzLmVsLnJlbW92ZUF0dHJpYnV0ZSggbmFtZSApO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnJlbW92ZUNsYXNzID0gZnVuY3Rpb24gKCBuYW1lICkge1xuICAgIGlmICggISBuYW1lICl7XG4gICAgICAgIHRoaXMuZWwuY2xhc3NOYW1lID0gJyc7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gdGhpcy5faXRlcmF0ZShcbiAgICAgICAgbmFtZSxcbiAgICAgICAgZnVuY3Rpb24oIHNlbGYsIHYgKXtcbiAgICAgICAgICAgIHNlbGYuZWwuY2xhc3NMaXN0LnJlbW92ZSggdiApO1xuICAgICAgICB9XG4gICAgKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5yZXBsYWNlV2l0aCA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG4gICAgdGhpcy5lbC5vdXRlckhUTUwgPSB2YWx1ZTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5zaWJsaW5ncyA9IGZ1bmN0aW9uICggc2VsZWN0b3IgKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBub2RlcyA9IEFycmF5LnByb3RvdHlwZS5maWx0ZXIuY2FsbCggXG4gICAgICAgIHRoaXMuZWwucGFyZW50Tm9kZS5jaGlsZHJlbiwgXG4gICAgICAgIHNlbGVjdG9yP1xuICAgICAgICAgICAgZnVuY3Rpb24oIGNoaWxkICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoaWxkICE9PSBzZWxmLmVsICYmIGNoaWxkLm1hdGNoZXMoIHNlbGVjdG9yICk7XG4gICAgICAgICAgICB9OlxuICAgICAgICAgICAgZnVuY3Rpb24oIGNoaWxkICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoaWxkICE9PSBzZWxmLmVsO1xuICAgICAgICAgICAgfVxuICAgICk7XG4gICAgcmV0dXJuIHp6RE9NLl9idWlsZCggbm9kZXMgKTtcbn07XG5cbi8vVE9ETyBhZGQgc3VwcG9ydCBvZiBmdW5jdGlvbiB0eXBlIGluIHZhbHVlXG56ekRPTS5TUy5wcm90b3R5cGUudGV4dCA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG4gICAgLy8gZ2V0XG4gICAgaWYgKCB2YWx1ZSA9PT0gdW5kZWZpbmVkICl7XG4gICAgICAgIHJldHVybiB0aGlzLmVsLnRleHRDb250ZW50O1xuICAgIH1cblxuICAgIC8vIHNldFxuICAgIHRoaXMuZWwudGV4dENvbnRlbnQgPSB2YWx1ZTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS50b2dnbGVDbGFzcyA9IGZ1bmN0aW9uICggbmFtZSwgc3RhdGUgKSB7XG4gICAgcmV0dXJuIHRoaXMuX2l0ZXJhdGUoXG4gICAgICAgIG5hbWUsXG4gICAgICAgIHN0YXRlID09PSB1bmRlZmluZWQ/XG4gICAgICAgICAgICBmdW5jdGlvbiggc2VsZiwgdiApe1xuICAgICAgICAgICAgICAgIHNlbGYuZWwuY2xhc3NMaXN0LnRvZ2dsZSggdiApO1xuICAgICAgICAgICAgfTpcbiAgICAgICAgICAgIGZ1bmN0aW9uKCBzZWxmLCB2ICl7XG4gICAgICAgICAgICAgICAgc2VsZi5lbC5jbGFzc0xpc3QudG9nZ2xlKCB2LCBzdGF0ZSApO1xuICAgICAgICAgICAgfVxuICAgICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUud2lkdGggPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuICAgIHJldHVybiB0aGlzLl9zdHlsZVByb3BlcnR5KCAnd2lkdGgnLCB2YWx1ZSApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uICggZXZlbnROYW1lLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSApIHtcbiAgICB6ekRPTS5fcmVtb3ZlRXZlbnRMaXN0ZW5lciggdGhpcywgZXZlbnROYW1lLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSApO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gKCBldmVudE5hbWUsIGxpc3RlbmVyLCBkYXRhLCB1c2VDYXB0dXJlICkge1xuICAgIHp6RE9NLl9hZGRFdmVudExpc3RlbmVyKCBcbiAgICAgICAgdGhpcywgXG4gICAgICAgIGV2ZW50TmFtZSwgXG4gICAgICAgIGRhdGE/IFxuICAgICAgICAgICAgZnVuY3Rpb24oIGUgKXtcbiAgICAgICAgICAgICAgICBlLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lci5jYWxsKCBlLmN1cnJlbnRUYXJnZXQsIGUgKTtcbiAgICAgICAgICAgIH06XG4gICAgICAgICAgICBsaXN0ZW5lciwgXG4gICAgICAgIHVzZUNhcHR1cmUgXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24gKCBldmVudE5hbWUgKSB7XG4gICAgdmFyIGV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoICdIVE1MRXZlbnRzJyApO1xuICAgIGV2ZW50LmluaXRFdmVudCggZXZlbnROYW1lLCB0cnVlLCBmYWxzZSApO1xuICAgIHRoaXMuZWwuZGlzcGF0Y2hFdmVudCggZXZlbnQgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG4vKiBFbmQgb2YgZXZlbnRzICovXG5cbnp6RE9NLlNTLnByb3RvdHlwZS5oaWRlID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICggdGhpcy5pc1Zpc2libGUoKSApe1xuICAgICAgICB0aGlzLmF0dHIoIFxuICAgICAgICAgICAgJ2RhdGEtZGlzcGxheScsIFxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSggdGhpcy5lbCwgbnVsbCApWyAnZGlzcGxheScgXVxuICAgICAgICApO1xuICAgICAgICB0aGlzLmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmlzVmlzaWJsZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gISEgdGhpcy5lbC5vZmZzZXRQYXJlbnQ7XG4gICAgLy9yZXR1cm4gZ2V0Q29tcHV0ZWRTdHlsZSggdGhpcy5lbCwgbnVsbCApLmdldFByb3BlcnR5VmFsdWUoICdkaXNwbGF5JyApICE9PSAnbm9uZSc7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoICEgdGhpcy5pc1Zpc2libGUoKSApe1xuICAgICAgICB2YXIgZGlzcGxheSA9IHRoaXMuYXR0ciggJ2RhdGEtZGlzcGxheScgKTtcbiAgICAgICAgdGhpcy5lbC5zdHlsZS5kaXNwbGF5ID0gZGlzcGxheT8gZGlzcGxheTogenpET00uX2dldERlZmF1bHREaXNwbGF5KCB0aGlzLmVsICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uICggc3RhdGUgKSB7XG4gICAgdmFyIHZhbHVlID0gc3RhdGUgIT09IHVuZGVmaW5lZD8gISBzdGF0ZTogdGhpcy5pc1Zpc2libGUoKTtcbiAgICByZXR1cm4gdmFsdWU/IHRoaXMuaGlkZSgpOiB0aGlzLnNob3coKTtcbn07XG4vKiBFbmQgb2YgdmlzaWJsZSAqL1xuXG56ekRPTS5TUy5wcm90b3R5cGUuY2hlY2tlZCA9IGZ1bmN0aW9uICggY2hlY2sgKSB7XG4gICAgaWYgKCB0aGlzLmVsLm5vZGVOYW1lICE9PSAnSU5QVVQnIHx8ICggdGhpcy5lbC50eXBlICE9PSAnY2hlY2tib3gnICYmIHRoaXMuZWwudHlwZSAhPT0gJ3JhZGlvJykgKSB7XG4gICAgICAgIHRocm93IHp6RE9NLl9nZXRFcnJvciggJ2NoZWNrZWQnICk7XG4gICAgfVxuICAgIFxuICAgIC8vIGdldFxuICAgIGlmICggY2hlY2sgPT09IHVuZGVmaW5lZCApe1xuICAgICAgICByZXR1cm4gISEgdGhpcy5lbC5jaGVja2VkO1xuICAgIH1cbiAgICBcbiAgICAvLyBzZXRcbiAgICB0aGlzLmVsLmNoZWNrZWQgPSBjaGVjaztcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQHBhcmFtIHtBcnJheTw/PnxTdHJpbmc9fSB2YWx1ZVxuICovXG56ekRPTS5TUy5wcm90b3R5cGUudmFsID0gZnVuY3Rpb24gKCB2YWx1ZSApIHtcbiAgICAvLyBnZXRcbiAgICBpZiAoIHZhbHVlID09PSB1bmRlZmluZWQgKXtcbiAgICAgICAgc3dpdGNoICggdGhpcy5lbC5ub2RlTmFtZSApIHtcbiAgICAgICAgY2FzZSAnSU5QVVQnOlxuICAgICAgICBjYXNlICdURVhUQVJFQSc6XG4gICAgICAgIGNhc2UgJ0JVVFRPTic6XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5lbC52YWx1ZTtcbiAgICAgICAgY2FzZSAnU0VMRUNUJzpcbiAgICAgICAgICAgIHZhciB2YWx1ZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHRoaXMuZWwubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgICAgICAgICAgaWYgKCB0aGlzLmVsWyBpIF0uc2VsZWN0ZWQgKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlcy5wdXNoKCB0aGlzLmVsWyBpIF0udmFsdWUgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFsdWVzLmxlbmd0aCA+IDE/IHZhbHVlczogdmFsdWVzWyAwIF07XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aHJvdyB6ekRPTS5fZ2V0RXJyb3IoICd2YWwnICk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gc2V0XG4gICAgc3dpdGNoICggdGhpcy5lbC5ub2RlTmFtZSApIHtcbiAgICBjYXNlICdJTlBVVCc6XG4gICAgY2FzZSAnVEVYVEFSRUEnOlxuICAgIGNhc2UgJ0JVVFRPTic6XG4gICAgICAgIHRoaXMuZWwudmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgY2FzZSAnU0VMRUNUJzpcbiAgICAgICAgaWYgKCB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IFsgdmFsdWUgXTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKCBpID0gMDsgaSA8IHRoaXMuZWwubGVuZ3RoOyArK2kgKSB7XG4gICAgICAgICAgICBmb3IgKCB2YXIgaiA9IDA7IGogPCB2YWx1ZS5sZW5ndGg7ICsraiApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVsWyBpIF0uc2VsZWN0ZWQgPSAnJztcbiAgICAgICAgICAgICAgICBpZiAoIHRoaXMuZWxbIGkgXS52YWx1ZSA9PT0gdmFsdWVbIGogXSApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbFsgaSBdLnNlbGVjdGVkID0gJ3NlbGVjdGVkJztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IHp6RE9NLl9nZXRFcnJvciggJ3ZhbCcgKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuLyogRW5kIG9mIGZvcm1zICovXG5cbnp6RE9NLlNTLnByb3RvdHlwZS5nZXRYQ2VudGVyID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICggZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoIC0gdGhpcy5vdXRlcldpZHRoKCkgKSAvIDI7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuZ2V0WUNlbnRlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQgLSB0aGlzLm91dGVySGVpZ2h0KCkgKSAvIDI7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuZ2V0Q2VudGVyID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbGVmdDogdGhpcy5nZXRYQ2VudGVyKCksXG4gICAgICAgIHRvcDogdGhpcy5nZXRZQ2VudGVyKClcbiAgICB9O1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmNlbnRlciA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub2Zmc2V0KCBcbiAgICAgICAgdGhpcy5nZXRDZW50ZXIoKSBcbiAgICApO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmNlbnRlclggPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNzcyggJ2xlZnQnLCB0aGlzLmdldFhDZW50ZXIoKSApO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmNlbnRlclkgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNzcyggJ3RvcCcsIHRoaXMuZ2V0WUNlbnRlcigpICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuLyogRW5kIG9mIGNlbnRlciAqL1xuXG4vKiogQGNvbnN0cnVjdG9yICovXG56ekRPTS5NTSA9IGZ1bmN0aW9uICggX25vZGVzICkgeyAgICBcbiAgICB0aGlzLmxpc3QgPSBbXTtcbiAgICB0aGlzLm5vZGVzID0gX25vZGVzO1xuICAgIHRoaXMubGVuZ3RoID0gX25vZGVzLmxlbmd0aDtcbiAgICBcbiAgICAvLyBJbml0IG5vZGVzXG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgdmFyIGVsID0gdGhpcy5ub2Rlc1sgaSBdO1xuICAgICAgICB0aGlzWyBpIF0gPSBlbDsgLy8gZm9yIGFycmF5IGxpa2VcbiAgICAgICAgdmFyIHNzID0gbmV3IHp6RE9NLlNTKCBlbCApO1xuICAgICAgICB0aGlzLmxpc3QucHVzaCggc3MgKTtcbiAgICAgICAgc3MuX2kgPSBpOyAvLyBmb3IgaW5kZXggaW4gZnVuY3Rpb25zXG4gICAgfVxufTtcblxuLypcblVuaWZ5IHRoZSBkZWZpbml0aW9uIG9mIGEgZnVuY3Rpb24gb2YgenpET00uU1MucHJvdG90eXBlIGFuZCBhIGRlZmluaXRpb24gb2YgenpET00uTU0ucHJvdG90eXBlLiBFeGFtcGxlOlxuXG4gICAgenpET00uYWRkKCBcbiAgICAgICAgenpET00uU1MucHJvdG90eXBlLm15Q3VzdG9tRnVuY3Rpb24gPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgLi4uXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcbiAgICAgICAgenpET00uTU0uY29uc3RydWN0b3JzLmNvbmNhdFxuICAgICk7XG4pO1xuKi9cbi8qKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gc3NQcm90b3R5cGVcbiAqIEBwYXJhbSB7RnVuY3Rpb249fSBjb25zdHJ1Y3RvclxuICovXG56ekRPTS5hZGQgPSBmdW5jdGlvbiggc3NQcm90b3R5cGUsIGNvbnN0cnVjdG9yICl7XG4gICAgZm9yICggdmFyIGlkIGluIHp6RE9NLlNTLnByb3RvdHlwZSApe1xuICAgICAgICB2YXIgY3VycmVudCA9IHp6RE9NLlNTLnByb3RvdHlwZVsgaWQgXTtcbiAgICAgICAgaWYgKCBzc1Byb3RvdHlwZSA9PT0gY3VycmVudCApe1xuICAgICAgICAgICAgdmFyIGNsb3N1cmUgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIHZhciBmdW5jdGlvbklkID0gaWQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnN0cnVjdG9yPyBjb25zdHJ1Y3RvciggZnVuY3Rpb25JZCApOiB6ekRPTS5NTS5jb25zdHJ1Y3RvcnMuZGVmYXVsdCggZnVuY3Rpb25JZCApO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHp6RE9NLk1NLnByb3RvdHlwZVsgaWQgXSA9IGNsb3N1cmUoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICB0aHJvdyAnRXJyb3IgcmVnaXN0ZXJpbmcgenpET00uTU06IHp6RE9NLlNTIG5vdCBmb3VuZC4nO1xufTtcblxuenpET00uTU0uY29uc3RydWN0b3JzID0ge307XG56ekRPTS5NTS5jb25zdHJ1Y3RvcnMuYm9vbGVhbk9yID0gZnVuY3Rpb24oIGZ1bmN0aW9uSWQgKXtcbiAgICByZXR1cm4gZnVuY3Rpb24oKXtcbiAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgdGhpcy5saXN0Lmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgICAgdmFyIHNzID0gdGhpcy5saXN0WyBpIF07XG4gICAgICAgICAgICB2YXIgeCA9IHNzWyBmdW5jdGlvbklkIF0uYXBwbHkoIHNzLCBhcmd1bWVudHMgKTtcbiAgICAgICAgICAgIGlmICggeCApe1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xufTtcbnp6RE9NLk1NLmNvbnN0cnVjdG9ycy5jb25jYXQgPSBmdW5jdGlvbiggZnVuY3Rpb25JZCApe1xuICAgIHJldHVybiBmdW5jdGlvbigpe1xuICAgICAgICB2YXIgbmV3Tm9kZXMgPSBbXTtcbiAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgdGhpcy5saXN0Lmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgICAgdmFyIHNzID0gdGhpcy5saXN0WyBpIF07XG4gICAgICAgICAgICB2YXIgeCA9IHNzWyBmdW5jdGlvbklkIF0uYXBwbHkoIHNzLCBhcmd1bWVudHMgKTtcbiAgICAgICAgICAgIG5ld05vZGVzID0gbmV3Tm9kZXMuY29uY2F0KCB4Lm5vZGVzICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHp6RE9NLl9idWlsZCggbmV3Tm9kZXMgKTtcbiAgICB9O1xufTtcbnp6RE9NLk1NLmNvbnN0cnVjdG9ycy5kZWZhdWx0ID0gZnVuY3Rpb24oIGZ1bmN0aW9uSWQgKXtcbiAgICByZXR1cm4gZnVuY3Rpb24oKXtcbiAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgdGhpcy5saXN0Lmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgICAgdmFyIHNzID0gdGhpcy5saXN0WyBpIF07XG4gICAgICAgICAgICB2YXIgciA9IHNzWyBmdW5jdGlvbklkIF0uYXBwbHkoIHNzLCBhcmd1bWVudHMgKTtcbiAgICAgICAgICAgIGlmICggaSA9PT0gMCAmJiAhICggciBpbnN0YW5jZW9mIHp6RE9NLlNTICkgKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xufTtcblxuLy8gSW5pdCBwcm90b3R5cGUgZnVuY3Rpb25zIGZyb20genpET00uU1Ncbnp6RE9NLk1NLmluaXQgPSBmdW5jdGlvbigpe1xuICAgIC8vIENvbmNhdCBmdW5jdGlvbnNcbiAgICB2YXIgY29uY2F0RiA9IFtcbiAgICAgICAgJ2NoaWxkcmVuJyxcbiAgICAgICAgJ2Nsb25lJyxcbiAgICAgICAgJ2ZpbHRlcicsXG4gICAgICAgICdmaW5kJyxcbiAgICAgICAgJ25leHQnLFxuICAgICAgICAnb2Zmc2V0UGFyZW50JyxcbiAgICAgICAgJ3BhcmVudCcsXG4gICAgICAgICdwcmV2JyxcbiAgICAgICAgJ3NpYmxpbmdzJ1xuICAgIF07XG4gICAgLy8gQm9vbGVhbiBmdW5jdGlvbnNcbiAgICB2YXIgYm9vbGVhbk9yRiA9IFtcbiAgICAgICAgJ2hhc0NsYXNzJyxcbiAgICAgICAgJ2lzJ1xuICAgIF07XG4gICAgZm9yICggdmFyIGlkIGluIHp6RE9NLlNTLnByb3RvdHlwZSApe1xuICAgICAgICB2YXIgY2xvc3VyZSA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICB2YXIgZnVuY3Rpb25JZCA9IGlkO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIGNvbmNhdEYuaW5kZXhPZiggZnVuY3Rpb25JZCApICE9PSAtMSApe1xuICAgICAgICAgICAgICAgIHJldHVybiB6ekRPTS5NTS5jb25zdHJ1Y3RvcnMuY29uY2F0KCBmdW5jdGlvbklkICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIGJvb2xlYW5PckYuaW5kZXhPZiggZnVuY3Rpb25JZCApICE9PSAtMSApe1xuICAgICAgICAgICAgICAgIHJldHVybiB6ekRPTS5NTS5jb25zdHJ1Y3RvcnMuYm9vbGVhbk9yKCBmdW5jdGlvbklkICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4genpET00uTU0uY29uc3RydWN0b3JzLmRlZmF1bHQoIGZ1bmN0aW9uSWQgKTtcbiAgICAgICAgfTtcbiAgICAgICAgenpET00uTU0ucHJvdG90eXBlWyBpZCBdID0gY2xvc3VyZSgpO1xuICAgIH1cbn0oKTtcblxuLyogTWV0aG9kcyBpbmNsdWRlZCBpbiBqcXVlcnkgKi9cbnp6RE9NLk1NLnByb3RvdHlwZS5lYWNoID0gZnVuY3Rpb24gKCBlYWNoRm4gKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIFxuICAgICAgICB0aGlzLmxpc3QsIFxuICAgICAgICBmdW5jdGlvbiggY3VycmVudFZhbHVlLCBpbmRleCApe1xuICAgICAgICAgICAgZWFjaEZuLmNhbGwoIGN1cnJlbnRWYWx1ZS5lbCwgaW5kZXgsIGN1cnJlbnRWYWx1ZSwgc2VsZi5ub2RlcyApO1xuICAgICAgICB9XG4gICAgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8vIFJlZ2lzdGVyIHp6RE9NIGlmIHdlIGFyZSB1c2luZyBOb2RlXG5pZiAoIHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzICkge1xuICAgIG1vZHVsZS5leHBvcnRzID0genpET007XG59XG4iLCJ2YXIgenpET00gPSByZXF1aXJlKCcuL2J1aWxkL3p6RE9NLWNsb3N1cmVzLWZ1bGwuanMnKTtcbm1vZHVsZS5leHBvcnRzID0genpET00ueno7XG4iLCIvLyBUZXN0cyBmb3IgbmF2aWdhdGlvbiwgYm90aCB0cmFuc2l0aW9uc1xuXG52YXIgUXVuaXQgPSByZXF1aXJlKCAncXVuaXQnICk7XG52YXIgYmx1ZVJvdXRlciA9IHJlcXVpcmUoICcuLi8uLi9idWlsZC9ibHVlUm91dGVyLmpzJyApO1xuXG4vLyBJbml0IHJvdXRlclxuY29uc3QgaW5pdFJvdXRlciA9ICgpID0+IHtcbiAgICAvLyBJbml0aWFsaXplIHBhZ2VzXG4gICAgY29uc3QgcGFnZXMgPSB7fTtcblxuICAgIC8vIEluaXRpYWxpemUgb3B0aW9uczogaW4gYW5pbWF0aW9uc1xuICAgIGxldCBvcHRpb25zID0ge1xuICAgICAgICBldmVudHNCeVBhZ2U6IHBhZ2VzLFxuICAgICAgICBhbmltYXRpb25PdXQ6IGZhbHNlLFxuICAgICAgICByb3V0ZXM6IHJlcXVpcmUoICcuL3JvdXRlc0lubGluZUZvck5hdmlnYXRpb24uanMnIClcbiAgICB9O1xuXG4gICAgLy8gQ3JlYXRlIG5ldyByb3V0ZXIgaW5zdGFuY2VcbiAgICByZXR1cm4gbmV3IGJsdWVSb3V0ZXIucm91dGVyKCBvcHRpb25zICk7XG59O1xuXG4vLyBJbml0IHJvdXRlclxuY29uc3Qgcm91dGVyID0gaW5pdFJvdXRlcigpO1xuXG4vLyBVbml0IHRlc3RzXG5yZXF1aXJlKCAnLi9uYXZpZ2F0aW9uLmpzJyApKCk7XG5cblxuIiwiY29uc3QgbmF2aWdhdGlvbiA9IHt9O1xuXG52YXIgenogPSByZXF1aXJlKCAnenpkb20nICk7XG52YXIgdXRpbHMgPSByZXF1aXJlKCAnLi91dGlscy5qcycgKTtcblxuLy8gVW5pdCB0ZXN0c1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICBRVW5pdC50ZXN0KCBcIlNpbXBsZSBuYXZpZ2F0aW9uIHRlc3RcIiwgYXN5bmMgZnVuY3Rpb24oIGFzc2VydCApIHtcbiAgICAgICAgXG4gICAgICAgIC8vIEdldCBhIHJlZmVyZW5jZSB0byBmaW5pc2ggdGhlIHF1bml0IHRlc3QgbGF0ZXJcbiAgICAgICAgdmFyIGRvbmUgPSBhc3NlcnQuYXN5bmMoKTtcbiAgICAgICAgZGVidWdnZXI7XG5cbiAgICAgICAgLy8gU3RhcnQgdGVzdGluZ1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjaG9tZV9wYWdlMUxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMVwiICk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNob21lX3BhZ2UyTGluaycpLmh0bWwoKSAsIFwiUGFnZSAyXCIgKTtcblxuICAgICAgICAvLyBHbyB0byBwYWdlIDFcbiAgICAgICAgenooJyNob21lX3BhZ2UxTGluaycpLmVsLmNsaWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTFfcGFnZTExTGluaycpLmh0bWwoKSAsIFwiUGFnZSAxMVwiICk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNwYWdlMV9wYWdlMTJMaW5rJykuaHRtbCgpICwgXCJQYWdlIDEyXCIgKTtcblxuICAgICAgICAvLyBHbyB0byBwYWdlIDExXG4gICAgICAgIHp6KCcjcGFnZTFfcGFnZTExTGluaycpLmVsLmNsaWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTExX3AnKS50ZXh0KCkudHJpbSgpICwgXCJUaGlzIGlzIFBhZ2UgMTFcIiApO1xuXG4gICAgICAgIC8vIEdvIHRvIGhvbWVcbiAgICAgICAgenooJyNwYWdlMTFfaG9tZUxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI2hvbWVfcGFnZTFMaW5rJykuaHRtbCgpICwgXCJQYWdlIDFcIiApO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjaG9tZV9wYWdlMkxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMlwiICk7XG5cbiAgICAgICAgLy8gR28gdG8gcGFnZSAyXG4gICAgICAgIHp6KCcjaG9tZV9wYWdlMkxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UyX3BhZ2UyMUxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMjFcIiApO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTJfcGFnZTIyTGluaycpLmh0bWwoKSAsIFwiUGFnZSAyMlwiICk7XG5cbiAgICAgICAgLy8gR28gdG8gcGFnZSAyMlxuICAgICAgICB6eignI3BhZ2UyX3BhZ2UyMkxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UyMl9wJykudGV4dCgpLnRyaW0oKSAsIFwiVGhpcyBpcyBQYWdlIDIyXCIgKTtcblxuICAgICAgICAvLyBHbyB0byBob21lXG4gICAgICAgIHp6KCcjcGFnZTIyX2hvbWVMaW5rJykuZWwuY2xpY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG5cbiAgICAgICAgLy8gRmluaXNoIHF1bml0IHRlc3RcbiAgICAgICAgZG9uZSgpO1xuICAgIH0pO1xuXG4gICAgUVVuaXQudGVzdCggXCJIaXN0b3J5IG5hdmlnYXRpb24gdGVzdFwiLCBhc3luYyBmdW5jdGlvbiggYXNzZXJ0ICkge1xuICAgICAgICBcbiAgICAgICAgLy8gR2V0IGEgcmVmZXJlbmNlIHRvIGZpbmlzaCB0aGUgcXVuaXQgdGVzdCBsYXRlclxuICAgICAgICB2YXIgZG9uZSA9IGFzc2VydC5hc3luYygpO1xuXG4gICAgICAgIC8vIFN0YXJ0IHRlc3RpbmdcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI2hvbWVfcGFnZTFMaW5rJykuaHRtbCgpICwgXCJQYWdlIDFcIiApO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjaG9tZV9wYWdlMkxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMlwiICk7XG5cbiAgICAgICAgLy8gR28gdG8gcGFnZSAxXG4gICAgICAgIHp6KCcjaG9tZV9wYWdlMUxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UxX3BhZ2UxMUxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMTFcIiApO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTFfcGFnZTEyTGluaycpLmh0bWwoKSAsIFwiUGFnZSAxMlwiICk7XG5cbiAgICAgICAgLy8gR28gdG8gcGFnZSAxMVxuICAgICAgICB6eignI3BhZ2UxX3BhZ2UxMUxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UxMV9wJykudGV4dCgpLnRyaW0oKSAsIFwiVGhpcyBpcyBQYWdlIDExXCIgKTtcblxuICAgICAgICAvLyBUZXN0IGZpcnN0IGJhY2stZm9yd2FyZC1iYWNrXG5cbiAgICAgICAgLy8gR28gYmFjayB0byBwYWdlIDFcbiAgICAgICAgaGlzdG9yeS5iYWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTFfcGFnZTExTGluaycpLmh0bWwoKSAsIFwiUGFnZSAxMVwiICk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNwYWdlMV9wYWdlMTJMaW5rJykuaHRtbCgpICwgXCJQYWdlIDEyXCIgKTtcblxuICAgICAgICAvLyBHbyBmb3J3YXJkIHRvIHBhZ2UgMTFcbiAgICAgICAgaGlzdG9yeS5mb3J3YXJkKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTExX3AnKS50ZXh0KCkudHJpbSgpICwgXCJUaGlzIGlzIFBhZ2UgMTFcIiApO1xuXG4gICAgICAgIC8vIEdvIGJhY2sgdG8gcGFnZSAxXG4gICAgICAgIGhpc3RvcnkuYmFjaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UxX3BhZ2UxMUxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMTFcIiApO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTFfcGFnZTEyTGluaycpLmh0bWwoKSAsIFwiUGFnZSAxMlwiICk7XG5cbiAgICAgICAgLy8gR28gdG8gaG9tZTogY2FuIG5vdCB1c2UgZ28gYmFjayBiZWNhdXNlIG9mIHF1bml0IHN0cmFuZ2UgYmVoYXZpb3VyXG4gICAgICAgIHp6KCcjcGFnZTFfaG9tZUxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI2hvbWVfcGFnZTFMaW5rJykuaHRtbCgpICwgXCJQYWdlIDFcIiApO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjaG9tZV9wYWdlMkxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMlwiICk7XG4gICAgICAgIFxuICAgICAgICAvLyBHbyB0byBwYWdlIDJcbiAgICAgICAgenooJyNob21lX3BhZ2UyTGluaycpLmVsLmNsaWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTJfcGFnZTIxTGluaycpLmh0bWwoKSAsIFwiUGFnZSAyMVwiICk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNwYWdlMl9wYWdlMjJMaW5rJykuaHRtbCgpICwgXCJQYWdlIDIyXCIgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEdvIHRvIHBhZ2UgMjJcbiAgICAgICAgenooJyNwYWdlMl9wYWdlMjJMaW5rJykuZWwuY2xpY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNwYWdlMjJfcCcpLnRleHQoKS50cmltKCkgLCBcIlRoaXMgaXMgUGFnZSAyMlwiICk7XG4gICAgICAgIFxuICAgICAgICAvLyBHbyB0byBwYWdlIDIyMVxuICAgICAgICB6eignI3BhZ2UyMl9wYWdlMjIxTGluaycpLmVsLmNsaWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTIyMV9wJykudGV4dCgpLnRyaW0oKSAsIFwiVGhpcyBpcyBQYWdlIDIyMVwiICk7XG4gICAgICAgIFxuICAgICAgICAvLyBUZXN0IHNlY29uZCBiYWNrLWJhY2stZm9yd2FyZC1mb3J3YXJkXG4gICAgICAgIFxuICAgICAgICAvLyBHbyBiYWNrIHRvIHBhZ2UgMjJcbiAgICAgICAgaGlzdG9yeS5iYWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTIyX3AnKS50ZXh0KCkudHJpbSgpICwgXCJUaGlzIGlzIFBhZ2UgMjJcIiApO1xuICAgICAgICBcbiAgICAgICAgLy8gR28gYmFjayB0byBwYWdlIDJcbiAgICAgICAgaGlzdG9yeS5iYWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTJfcGFnZTIxTGluaycpLmh0bWwoKSAsIFwiUGFnZSAyMVwiICk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNwYWdlMl9wYWdlMjJMaW5rJykuaHRtbCgpICwgXCJQYWdlIDIyXCIgKTtcblxuICAgICAgICAvLyBHbyBmb3J3YXJkIHRvIHBhZ2UgMjJcbiAgICAgICAgaGlzdG9yeS5mb3J3YXJkKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTIyX3AnKS50ZXh0KCkudHJpbSgpICwgXCJUaGlzIGlzIFBhZ2UgMjJcIiApO1xuXG4gICAgICAgIC8vIEdvIGZvcndhcmQgdG8gcGFnZSAyMjFcbiAgICAgICAgaGlzdG9yeS5mb3J3YXJkKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTIyMV9wJykudGV4dCgpLnRyaW0oKSAsIFwiVGhpcyBpcyBQYWdlIDIyMVwiICk7XG5cbiAgICAgICAgLy8gRmluaXNoIHF1bml0IHRlc3RcbiAgICAgICAgZG9uZSgpO1xuICAgIH0pO1xuXG4gICAgUVVuaXQudGVzdCggXCI0MDQgZXJyb3IgdGVzdFwiLCBhc3luYyBmdW5jdGlvbiggYXNzZXJ0ICkge1xuICAgICAgICBcbiAgICAgICAgLy9sZXQgdGhpc1VybCA9IFwiL3Rlc3QvYm90aFRyYW5zaXRpb25OYXZpZ2F0aW9uLmh0bWxcIjtcbiAgICAgICAgbGV0IHRoaXNVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcblxuICAgICAgICAvLyBHZXQgYSByZWZlcmVuY2UgdG8gZmluaXNoIHRoZSBxdW5pdCB0ZXN0IGxhdGVyXG4gICAgICAgIHZhciBkb25lID0gYXNzZXJ0LmFzeW5jKCk7XG5cbiAgICAgICAgLy8gVHJ5IHRvIGdvIHRvIDQwNCBlcnJvciBwYWdlXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gdGhpc1VybCArIFwiIyFub3RGb3VuZFwiO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcblxuICAgICAgICAvLyBUZXN0IDQwNCBwYWdlXG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNlNDA0X3AnKS50ZXh0KCkudHJpbSgpICwgXCJSZXF1ZXN0ZWQgY29udGVudCBub3QgZm91bmQuXCIgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEdvIHRvIGhvbWVcbiAgICAgICAgenooJyNlNDA0X2hvbWVMaW5rJykuZWwuY2xpY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG5cbiAgICAgICAgLy8gR28gdG8gYm9rZW5QYWdlOiBwYWdlIHdpdGggbm8gY29udGVudCBkZWZpbmVkXG4gICAgICAgIHp6KCcjaG9tZV9icm9rZW5QYWdlTGluaycpLmVsLmNsaWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQub2soIHp6KCcjZXJyb3InKS50ZXh0KCkuc3RhcnRzV2l0aCggXCJObyBjb250ZW50IGZvdW5kIGZvciByb3V0ZSBmcm9tIHBhdGhcIiApICk7XG5cbiAgICAgICAgLy8gR28gdG8gaG9tZVxuICAgICAgICAvL3dpbmRvdy5sb2NhdGlvbi5ocmVmID0gdGhpc1VybDtcbiAgICAgICAgLy9hd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcblxuICAgICAgICAvLyBGaW5pc2ggcXVuaXQgdGVzdFxuICAgICAgICBkb25lKCk7XG4gICAgfSk7XG5cbn07XG5cblxuIiwiLy8gUm91dGVzIGZvciBpbmxpbmUgY29udGVudCBmb3IgbmF2aWdhdGlvbiB0ZXN0c1xuY29uc3Qgcm91dGVzID0gW1xuICAgIC8vIEhvbWUgcGFnZVxuICAgIHtcbiAgICAgICAgaWQ6ICdbaG9tZV0nLFxuICAgICAgICBjb250ZW50OiBgXG48aDE+Qmx1ZSByb3V0ZXIgdGVzdDwvaDE+XG5cbjxkaXYgY2xhc3M9XCJwYWdlLWNvbnRlbnRcIj5cbiAgICA8aDM+SG9tZSBwYWdlPC9oMz5cbiAgICA8cD5cbiAgICAgICAgVGhpcyBpcyBIb21lIHBhZ2VcbiAgICA8L3A+XG5cbiAgICA8dWwgaWQ9XCJob21lX2xpbmtzXCI+XG4gICAgICAgIDxsaT5cbiAgICAgICAgICAgIDxhIGhyZWY9XCIhcGFnZTFcIiBpZD1cImhvbWVfcGFnZTFMaW5rXCI+UGFnZSAxPC9hPi4gR28gdG8gcGFnZSAxLlxuICAgICAgICA8L2xpPlxuICAgICAgICA8bGk+XG4gICAgICAgICAgICA8YSBocmVmPVwiIXBhZ2UyXCIgaWQ9XCJob21lX3BhZ2UyTGlua1wiPlBhZ2UgMjwvYT4uIEdvIHRvIHBhZ2UgMi5cbiAgICAgICAgPC9saT5cbiAgICAgICAgPGxpPlxuICAgICAgICAgICAgPGEgaHJlZj1cIiFicm9rZW5QYWdlXCIgaWQ9XCJob21lX2Jyb2tlblBhZ2VMaW5rXCI+QnJva2VuIHBhZ2U8L2E+LiBHbyB0byBicm9rZW4gcGFnZS5cbiAgICAgICAgPC9saT5cbiAgICA8L3VsPlxuPC9kaXY+XG5gXG4gICAgfSxcbiAgICAvLyBwYWdlMVxuICAgIHtcbiAgICBpZDogJ3BhZ2UxJyxcbiAgICBjb250ZW50OiBgXG48aDE+Qmx1ZSByb3V0ZXIgdGVzdDwvaDE+XG5cbjxkaXY+XG4gICAgPGEgaHJlZj1cIiFcIiBpZD1cInBhZ2UxX2hvbWVMaW5rXCI+SG9tZTwvYT5cbjwvZGl2PlxuXG48ZGl2IGNsYXNzPVwicGFnZS1jb250ZW50XCI+XG4gICAgPGgzPlBhZ2UgMTwvaDM+XG4gICAgPHA+XG4gICAgICAgIFRoaXMgaXMgUGFnZSAxXG4gICAgPC9wPlxuXG4gICAgPHVsIGlkPVwicGFnZTFfbGlua3NcIj5cbiAgICAgICAgPGxpPlxuICAgICAgICAgICAgPGEgaHJlZj1cIiFwYWdlMTFcIiBpZD1cInBhZ2UxX3BhZ2UxMUxpbmtcIj5QYWdlIDExPC9hPi4gR28gdG8gcGFnZSAxMS5cbiAgICAgICAgPC9saT5cbiAgICAgICAgPGxpPlxuICAgICAgICAgICAgPGEgaHJlZj1cIiFwYWdlMTJcIiBpZD1cInBhZ2UxX3BhZ2UxMkxpbmtcIj5QYWdlIDEyPC9hPi4gR28gdG8gcGFnZSAxMi5cbiAgICAgICAgPC9saT5cbiAgICA8L3VsPlxuPC9kaXY+XG5gXG4gICAgfSxcbiAgICAvLyBwYWdlMTFcbiAgICB7XG4gICAgICAgIGlkOiAncGFnZTExJyxcbiAgICAgICAgY29udGVudDogYFxuPGgxPkJsdWUgcm91dGVyIHRlc3Q8L2gxPlxuXG48ZGl2PlxuICAgIDxhIGhyZWY9XCIhXCIgaWQ9XCJwYWdlMTFfaG9tZUxpbmtcIj5Ib21lPC9hPlxuPC9kaXY+XG5cbjxkaXYgY2xhc3M9XCJwYWdlLWNvbnRlbnRcIj5cbiAgICA8aDM+UGFnZSAxMTwvaDM+XG4gICAgPHAgaWQ9XCJwYWdlMTFfcFwiPlxuICAgICAgICBUaGlzIGlzIFBhZ2UgMTFcbiAgICA8L3A+XG48L2Rpdj5cbmBcbiAgICB9LFxuICAgIC8vIHBhZ2UxMlxuICAgIHtcbiAgICAgICAgaWQ6ICdwYWdlMTInLFxuICAgICAgICBjb250ZW50OiBgXG48aDE+Qmx1ZSByb3V0ZXIgdGVzdDwvaDE+XG5cbjxkaXY+XG4gICAgPGEgaHJlZj1cIiFcIiBpZD1cInBhZ2UxMl9ob21lTGlua1wiPkhvbWU8L2E+XG48L2Rpdj5cblxuPGRpdiBjbGFzcz1cInBhZ2UtY29udGVudFwiPlxuICAgIDxoMz5QYWdlIDEyPC9oMz5cbiAgICA8cCBpZD1cInBhZ2UxMl9wXCI+XG4gICAgICAgIFRoaXMgaXMgUGFnZSAxMlxuICAgIDwvcD5cbjwvZGl2PlxuYFxuICAgIH0sXG4gICAgLy8gcGFnZTJcbiAgICB7XG4gICAgICAgIGlkOiAncGFnZTInLFxuICAgICAgICBjb250ZW50OiBgXG48aDE+Qmx1ZSByb3V0ZXIgdGVzdDwvaDE+XG5cbjxkaXY+XG4gICAgPGEgaHJlZj1cIiFcIiBpZD1cInBhZ2UyX2hvbWVMaW5rXCI+SG9tZTwvYT5cbjwvZGl2PlxuXG48ZGl2IGNsYXNzPVwicGFnZS1jb250ZW50XCI+XG4gICAgPGgzPlBhZ2UgMjwvaDM+XG4gICAgPHA+XG4gICAgICAgIFRoaXMgaXMgUGFnZSAyXG4gICAgPC9wPlxuXG4gICAgPHVsIGlkPVwicGFnZTJfbGlua3NcIj5cbiAgICAgICAgPGxpPlxuICAgICAgICAgICAgPGEgaHJlZj1cIiFwYWdlMjFcIiBpZD1cInBhZ2UyX3BhZ2UyMUxpbmtcIj5QYWdlIDIxPC9hPi4gR28gdG8gcGFnZSAyMS5cbiAgICAgICAgPC9saT5cbiAgICAgICAgPGxpPlxuICAgICAgICAgICAgPGEgaHJlZj1cIiFwYWdlMjJcIiBpZD1cInBhZ2UyX3BhZ2UyMkxpbmtcIj5QYWdlIDIyPC9hPi4gR28gdG8gcGFnZSAyMi5cbiAgICAgICAgPC9saT5cbiAgICA8L3VsPlxuPC9kaXY+XG5gXG4gICAgfSxcbiAgICAvLyBwYWdlMjFcbiAgICB7XG4gICAgICAgIGlkOiAncGFnZTIxJyxcbiAgICAgICAgY29udGVudDogYFxuPGgxPkJsdWUgcm91dGVyIHRlc3Q8L2gxPlxuXG48ZGl2PlxuICAgIDxhIGhyZWY9XCIhXCIgaWQ9XCJwYWdlMjFfaG9tZUxpbmtcIj5Ib21lPC9hPlxuPC9kaXY+XG5cbjxkaXYgY2xhc3M9XCJwYWdlLWNvbnRlbnRcIj5cbiAgICA8aDM+UGFnZSAyMTwvaDM+XG4gICAgPHAgaWQ9XCJwYWdlMjFfcFwiPlxuICAgICAgICBUaGlzIGlzIFBhZ2UgMjFcbiAgICA8L3A+XG48L2Rpdj5cbmBcbiAgICB9LFxuICAgIC8vIHBhZ2UyMlxuICAgIHtcbiAgICAgICAgaWQ6ICdwYWdlMjInLFxuICAgICAgICBjb250ZW50OiBgXG48aDE+Qmx1ZSByb3V0ZXIgdGVzdDwvaDE+XG5cbjxkaXY+XG4gICAgPGEgaHJlZj1cIiFcIiBpZD1cInBhZ2UyMl9ob21lTGlua1wiPkhvbWU8L2E+XG48L2Rpdj5cblxuPGRpdiBjbGFzcz1cInBhZ2UtY29udGVudFwiPlxuICAgIDxoMz5QYWdlIDIyPC9oMz5cbiAgICA8cCBpZD1cInBhZ2UyMl9wXCI+XG4gICAgICAgIFRoaXMgaXMgUGFnZSAyMlxuICAgIDwvcD5cblxuICAgIDx1bCBpZD1cInBhZ2UyMl9saW5rc1wiPlxuICAgICAgICA8bGk+XG4gICAgICAgICAgICA8YSBocmVmPVwiIXBhZ2UyMjFcIiBpZD1cInBhZ2UyMl9wYWdlMjIxTGlua1wiPlBhZ2UgMjIxPC9hPi4gR28gdG8gcGFnZSAyMjEuXG4gICAgICAgIDwvbGk+XG4gICAgPC91bD5cbjwvZGl2PlxuYFxuICAgIH0sXG4gICAgLy8gcGFnZTIyMVxuICAgIHtcbiAgICAgICAgaWQ6ICdwYWdlMjIxJyxcbiAgICAgICAgY29udGVudDogYFxuPGgxPkJsdWUgcm91dGVyIHRlc3Q8L2gxPlxuXG48ZGl2PlxuICAgIDxhIGhyZWY9XCIhXCIgaWQ9XCJwYWdlMjIxX2hvbWVMaW5rXCI+SG9tZTwvYT5cbjwvZGl2PlxuXG48ZGl2IGNsYXNzPVwicGFnZS1jb250ZW50XCI+XG4gICAgPGgzPlBhZ2UgMjIxPC9oMz5cbiAgICA8cCBpZD1cInBhZ2UyMjFfcFwiPlxuICAgICAgICBUaGlzIGlzIFBhZ2UgMjIxXG4gICAgPC9wPlxuPC9kaXY+XG5gXG4gICAgfSxcbiAgICAvLyBicm9rZW5QYWdlXG4gICAge1xuICAgICAgICBpZDogJ2Jyb2tlblBhZ2UnXG4gICAgfSxcbiAgICAvLyBEZWZhdWx0IHJvdXRlICg0MDQgcGFnZSlcbiAgICB7XG4gICAgICAgIGlkOiAnWzQwNF0nLFxuICAgICAgICBjb250ZW50OiBgXG48aDE+Qmx1ZSByb3V0ZXIgdGVzdDwvaDE+XG5cbjxkaXY+XG4gICAgPGEgaHJlZj1cIiFcIiBpZD1cImU0MDRfaG9tZUxpbmtcIj5Ib21lPC9hPlxuPC9kaXY+XG5cbjxkaXYgY2xhc3M9XCJwYWdlLWNvbnRlbnRcIj5cbiAgICA8aDM+NDA0IHBhZ2U8L2gzPlxuICAgIDxwPlxuICAgICAgICBTb3JyeVxuICAgIDwvcD5cbiAgICA8cCBpZD1cImU0MDRfcFwiPlxuICAgICAgICBSZXF1ZXN0ZWQgY29udGVudCBub3QgZm91bmQuXG4gICAgPC9wPlxuPC9kaXY+XG5gXG4gICAgfVxuXTtcblxubW9kdWxlLmV4cG9ydHMgPSByb3V0ZXM7XG5cblxuIiwiY29uc3QgdXRpbHMgPSB7fTtcblxudXRpbHMud2FpdFNob3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHV0aWxzLndhaXQoIDEwMDAgKTtcbn07XG5cbnV0aWxzLndhaXQgPSBmdW5jdGlvbiggdGltZW91dCApIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoIHJlc29sdmUgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KCByZXNvbHZlLCB0aW1lb3V0ICk7XG4gICAgfSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHV0aWxzO1xuXG4iXX0=
