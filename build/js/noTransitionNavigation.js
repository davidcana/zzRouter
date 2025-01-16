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



},{"./utils.js":10,"zzdom":6}],8:[function(require,module,exports){
// Tests for navigation, no transitions

var Qunit = require( 'qunit' );
var blueRouter = require( '../../build/blueRouter.js' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Initialize options: no animations
    let options = {
        eventsByPage: pages,
        animationOut: false,
        animationIn: false,
        routes: require( './routesInlineForNavigation.js' )
    };

    // Create new router instance
    return new blueRouter.router( options );
};

// Init router
const router = initRouter();

// Unit tests
require( './navigation.js' )();



},{"../../build/blueRouter.js":1,"./navigation.js":7,"./routesInlineForNavigation.js":9,"qunit":3}],9:[function(require,module,exports){
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


},{}]},{},[8])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJidWlsZC9ibHVlUm91dGVyLmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9xdW5pdC9xdW5pdC9xdW5pdC5qcyIsIm5vZGVfbW9kdWxlcy90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzIiwibm9kZV9tb2R1bGVzL3p6ZG9tL2J1aWxkL3p6RE9NLWNsb3N1cmVzLWZ1bGwuanMiLCJub2RlX21vZHVsZXMvenpkb20vaW5kZXguanMiLCJ0ZXN0L2pzL25hdmlnYXRpb24uanMiLCJ0ZXN0L2pzL25vVHJhbnNpdGlvbk5hdmlnYXRpb24uanMiLCJ0ZXN0L2pzL3JvdXRlc0lubGluZUZvck5hdmlnYXRpb24uanMiLCJ0ZXN0L2pzL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RtQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3RvT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxaUNBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvKiEgYmx1ZXJvdXRlciAtIHYwLjEuMCAtIDIwMjUtMDEtMTYgMTM6MzE6MjggKi9cbi8qKlxuICogQSBuYW1lc3BhY2UuXG4gKiBAY29uc3RcbiAqL1xuY29uc3QgYmx1ZVJvdXRlciA9IHt9O1xuXG5cbi8qKiBAY29uc3RydWN0b3IgKi9cbmJsdWVSb3V0ZXIucm91dGVyID0gZnVuY3Rpb24gKCB1c2VyT3B0aW9ucyApIHtcblxuICAgIC8vIEluaXQgb3B0aW9uc1xuICAgIHRoaXMub3B0aW9ucyA9IHt9O1xuICAgIGJsdWVSb3V0ZXIudXRpbHMuZXh0ZW5kKCB0aGlzLm9wdGlvbnMsIGJsdWVSb3V0ZXIuZGVmYXVsdE9wdGlvbnMsIHVzZXJPcHRpb25zICk7XG4gICAgdGhpcy5jaGVja09wdGlvbnMoKTtcblxuICAgIC8vIFByZWxvYWQgcGFnZXMgaWYgbmVlZGVkXG4gICAgaWYgKCB0aGlzLm9wdGlvbnMucHJlbG9hZFBhZ2VzT25Mb2FkICl7XG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcbiAgICAgICAgYmx1ZVJvdXRlci5odG1sRmV0Y2hlci5sb2FkQWxsVXJscyhcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2VsZi5pbml0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBEbyBub3QgcHJlbG9hZCBwYWdlcywgcnVuIGluaXRcbiAgICB0aGlzLmluaXQoKTtcbn07XG5cbi8qIE1ldGhvZHMgKi9cblxuLyoqIEBzdXBwcmVzcyB7bWlzc2luZ1Byb3BlcnRpZXN9ICovXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgLy8gSW5pdCBzb21lIG90aGVyIHZhcnNcbiAgICB0aGlzLnJvdXRlc01hcCA9IHRoaXMuY3JlYXRlUm91dGVzTWFwKCk7XG4gICAgdGhpcy5zdGFjayA9IFtdO1xuXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVyc1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnNGb3JXaW5kb3coKTtcblxuICAgIC8vIE5hdmlnYXRlIHRvIHdpbmRvdy5sb2NhdGlvbi5ocmVmIG9yIGhvbWVcbiAgICB0aGlzLm5hdmlnYXRlVXJsKFxuICAgICAgICB0aGlzLm9wdGlvbnMudXBkYXRlT25Mb2FkPyB3aW5kb3cubG9jYXRpb24uaHJlZjogJycsXG4gICAgICAgIHRoaXMub3B0aW9ucy5hbmltYXRlVHJhbnNpdGlvbnNPbkxvYWRcbiAgICApO1xufTtcblxuLy8gQ2hlY2sgdGhhdCBtYW5kYXRvcnkgdXNlciBkZWZpbmVkIHByb3BlcnRpZXMgYXJlIGRlZmluZWRcbi8qKiBAc3VwcHJlc3Mge21pc3NpbmdQcm9wZXJ0aWVzfSAqL1xuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmNoZWNrT3B0aW9ucyA9IGZ1bmN0aW9uKCkge1xuXG4gICAgbGV0IGVycm9ycyA9IDA7XG4gICAgbGV0IGVycm9yTWVzc2FnZXMgPSAnJztcblxuICAgIGlmICggISB0aGlzLm9wdGlvbnMucm91dGVzICl7XG4gICAgICAgICsrZXJyb3JzO1xuICAgICAgICBlcnJvck1lc3NhZ2VzICs9ICdyb3V0ZXMgbXVzdCBiZSBkZWZpbmVkLiAnO1xuICAgIH1cblxuICAgIGlmICggISB0aGlzLm9wdGlvbnMuZXZlbnRzQnlQYWdlICl7XG4gICAgICAgICsrZXJyb3JzO1xuICAgICAgICBlcnJvck1lc3NhZ2VzICs9ICdldmVudHNCeVBhZ2UgbXVzdCBiZSBkZWZpbmVkLiAnO1xuICAgIH1cblxuICAgIGlmICggZXJyb3JzICl7XG4gICAgICAgIHRoaXMuYWxlcnRFcnJvciggJ1VuYWJsZSB0byBpbml0YWxpemUgQmx1ZSByb3V0ZXIuICcgKyBlcnJvcnMgKyAnIGVycm9ycyBmb3VuZDogJyArIGVycm9yTWVzc2FnZXMgKTtcbiAgICB9XG59O1xuXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuYWxlcnRFcnJvciA9IGZ1bmN0aW9uKCBtZXNzYWdlICl7XG4gICAgYWxlcnQoIG1lc3NhZ2UgKTtcbiAgICB0aHJvdyBtZXNzYWdlO1xufTtcblxuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXJzRm9yV2luZG93ID0gZnVuY3Rpb24oKSB7XG4gICAgLypcbiAgICB3aW5kb3cub25sb2FkID0gKCkgPT4ge1xuICAgICAgICB0aGlzLm5hdmlnYXRlVXJsKCB0aGlzLm9wdGlvbnMudXBkYXRlT25Mb2FkPyB3aW5kb3cubG9jYXRpb24uaHJlZjogJycsIHRydWUgKTtcbiAgICB9XG4gICAgKi9cbiAgICB3aW5kb3cub25wb3BzdGF0ZSA9ICggZSApID0+IHtcbiAgICAgICAgdGhpcy5uYXZpZ2F0ZVVybCggd2luZG93LmxvY2F0aW9uLmhyZWYsIHRydWUgKTtcbiAgICAgICAgLy90aGlzLm5hdmlnYXRlVXJsKCBlLnN0YXRlWyAncGFnZScgXSwgdHJ1ZSApO1xuICAgIH07XG59O1xuXG4vKiogQHN1cHByZXNzIHttaXNzaW5nUHJvcGVydGllc30gKi9cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyc0ZvckxpbmtzID0gZnVuY3Rpb24oIHBhZ2VJZCApIHtcbiAgICBcbiAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzIGZvciBhIGVsZW1lbnRzXG4gICAgYmx1ZVJvdXRlci51dGlscy5hZGRFdmVudExpc3RlbmVyT25MaXN0KFxuICAgICAgICAvL2RvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCAnYScgKSxcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIHBhZ2VJZCApLmdldEVsZW1lbnRzQnlUYWdOYW1lKCAnYScgKSxcbiAgICAgICAgJ2NsaWNrJywgXG4gICAgICAgIChlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBocmVmID0gZS50YXJnZXQuZ2V0QXR0cmlidXRlKCAnaHJlZicgKTtcblxuICAgICAgICAgICAgLy8gRm9sbG93IHRoZSBsaW5rIGlmIGl0IGlzIGV4dGVybmFsIChpZiBpdCBpcyBtYXJrZWQgYXMgZXh0ZXJuYWwgaW4gdGhlIGNsYXNzIGxpc3QpXG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgaWYgKCBlLnRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMgKCBzZWxmLm9wdGlvbnMuZXh0ZXJuYWxDbGFzcyApICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIC8vIEZvbGxvdyB0aGUgbGluayBpZiBpdCBpcyBleHRlcm5hbCAoaWYgaXQgZG9lcyBub3Qgc3RhcnQgYnkgISlcbiAgICAgICAgICAgIGlmICggISBocmVmLnN0YXJ0c1dpdGgoIHNlbGYub3B0aW9ucy5QQUdFX1BSRUZJWCApICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICBoaXN0b3J5LnB1c2hTdGF0ZShcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICdwYWdlJzogaHJlZlxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgJ3BhZ2UgJyArIGhyZWYsXG4gICAgICAgICAgICAgICAgJyMnICsgaHJlZlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHNlbGYubmF2aWdhdGVVcmwoIGhyZWYsIHRydWUgKTtcbiAgICAgICAgfVxuICAgICk7XG59O1xuXG4vLyBDcmVhdGUgYSBtYXAgd2l0aCB0aGUgZGF0YSBpbiByb3V0ZXMsIHVzaW5nIHRoZSBwYXRoIGFzIHRoZSBrZXlcbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5jcmVhdGVSb3V0ZXNNYXAgPSBmdW5jdGlvbigpIHtcblxuICAgIGNvbnN0IHJvdXRlck1hcCA9IHt9O1xuICAgIGNvbnN0IHJvdXRlcyA9IHRoaXMub3B0aW9ucy5yb3V0ZXMgfHwgW107XG5cbiAgICByb3V0ZXMubWFwKCByb3V0ZUl0ZW0gPT4ge1xuICAgICAgICByb3V0ZXJNYXBbIHJvdXRlSXRlbS5pZCBdID0gcm91dGVJdGVtO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJvdXRlck1hcDtcbn07XG5cbi8qKiBAc3VwcHJlc3Mge21pc3NpbmdQcm9wZXJ0aWVzfSAqL1xuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmdldFJvdXRlSXRlbSA9IGZ1bmN0aW9uKCBwYWdlSWQgKSB7XG5cbiAgICAvLyBMb29rIGZvciB0aGUgcm91dGVcbiAgICBsZXQgcm91dGVJdGVtID0gdGhpcy5yb3V0ZXNNYXBbIHBhZ2VJZCBdO1xuICAgIGlmICggcm91dGVJdGVtICl7XG4gICAgICAgIHJldHVybiByb3V0ZUl0ZW07XG4gICAgfVxuXG4gICAgLy8gTm8gcm91dGUgZm91bmQsIDQwNCBlcnJvclxuICAgIHJvdXRlSXRlbSA9IHRoaXMucm91dGVzTWFwWyB0aGlzLm9wdGlvbnMuUEFHRV9JRF80MDRfRVJST1IgXTtcbiAgICBpZiAoIHJvdXRlSXRlbSApe1xuICAgICAgICByZXR1cm4gcm91dGVJdGVtO1xuICAgIH1cblxuICAgIC8vIE5vIDQwNCBwYWdlLCBidWlsZCBhIDQwNCByb3V0ZVxuICAgIHJldHVybiB7XG4gICAgICAgIGlkOiB0aGlzLm9wdGlvbnMuUEFHRV9JRF80MDRfRVJST1IsXG4gICAgICAgIGNvbnRlbnQ6ICc8aDM+NDA0IC0gUGFnZSBub3QgZm91bmQ6ICcgKyBwYWdlSWQgKyAnPC9oMz4nXG4gICAgfTtcbiAgICAvL3RoaXMuYWxlcnRFcnJvciggJ05vIHJvdXRlIGZvdW5kIHdpdGggaWQgJyArIHBhZ2VJZCArICcgYW5kIG5vIDQwNCBwYWdlIGZvdW5kLicgKTtcbn07XG5cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5uYXZpZ2F0ZVVybCA9IGZ1bmN0aW9uKCB1cmwsIG11c3RBbmltYXRlQnlDb2RlICkge1xuICAgIC8vYWxlcnQoICduYXZpZ2F0ZVVybFxcbnVybDogJyArIHVybCApO1xuXG4gICAgLy8gQ3JlYXRlIGFuIHVybCBvYmplY3QgdG8gbWFrZSBpdCBlYXN5IGV2ZXJ5dGhpbmdcbiAgICBsZXQgdXJsT2JqZWN0ID0gYmx1ZVJvdXRlci51dGlscy5hbmFsaXplVXJsKCB1cmwsIHRoaXMub3B0aW9ucyApO1xuXG4gICAgLy8gVXBkYXRlIHN0YWNrIGFuZCBnZXQgY3VycmVudFBhZ2VJZFxuICAgIGxldCBjdXJyZW50UGFnZUlkID0gdGhpcy51cGRhdGVTdGFjayggdXJsT2JqZWN0LnBhZ2UgKTtcblxuICAgIC8vIEV4aXQgaWYgdHJ5aW5nIHRvIG5hdmlnYXRlIHRvIGN1cnJlbnQgcGFnZVxuICAgIGlmICggY3VycmVudFBhZ2VJZCA9PSB1cmxPYmplY3QucGFnZSApe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gR2V0IHRoZSBjb250ZW50XG4gICAgbGV0IGNvbnRlbnQgPSB0aGlzLmdldENvbnRlbnRGb3JQYWdlKCB1cmxPYmplY3QucGFnZSApO1xuICAgIFxuICAgIC8vIElmIGNvbnRlbnQgaXMgYSBQcm9taXNlIHdhaXQgYW5kIHJlc29sdmUgaXRcbiAgICBsZXQgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCBjb250ZW50IGluc3RhbmNlb2YgUHJvbWlzZSApe1xuICAgICAgICBjb250ZW50LnRoZW4oIGZ1bmN0aW9uKCB0ZXh0ICl7XG4gICAgICAgICAgICAvLyBVcGRhdGUgY29udGVudCBvZiByb3V0ZVxuICAgICAgICAgICAgbGV0IHJvdXRlSXRlbSA9IHNlbGYuZ2V0Um91dGVJdGVtKCB1cmxPYmplY3QucGFnZSApO1xuICAgICAgICAgICAgcm91dGVJdGVtLmNvbnRlbnQgPSB0ZXh0O1xuXG4gICAgICAgICAgICAvLyBSdW4gZG9QYWdlVHJhbnNpdGlvblxuICAgICAgICAgICAgc2VsZi5kb1BhZ2VUcmFuc2l0aW9uKCB0ZXh0LCB1cmxPYmplY3QucGFnZSwgY3VycmVudFBhZ2VJZCwgdXJsT2JqZWN0LCBtdXN0QW5pbWF0ZUJ5Q29kZSApO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGNvbnRlbnQgaXMgTk9UIGEgUHJvbWlzZTogdXBkYXRlIGN1cnJlbnQgcGFnZVxuICAgIHRoaXMuZG9QYWdlVHJhbnNpdGlvbiggY29udGVudCwgdXJsT2JqZWN0LnBhZ2UsIGN1cnJlbnRQYWdlSWQsIHVybE9iamVjdCwgbXVzdEFuaW1hdGVCeUNvZGUgKTtcbn07XG5cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS51cGRhdGVTdGFjayA9IGZ1bmN0aW9uKCBwYWdlSWQgKSB7XG4gICAgXG4gICAgLy8gSWYgdGhlIHBlbnVsdGltYXRlIGVsZW1lbnQgaXMgdGhlIHBhZ2VJZCB0aGVuIHdlIGFyZSBnb2luZyBiYWNrd2FyZHM7IG90aGVyd2lzZSB3ZSBhcmUgZ29pbmcgZm9yd2FyZFxuICAgIGxldCBpc0JhY2t3YXJkID0gdGhpcy5zdGFja1sgdGhpcy5zdGFjay5sZW5ndGggLSAyIF0gPT0gcGFnZUlkO1xuXG4gICAgaWYgKCBpc0JhY2t3YXJkICl7XG4gICAgICAgIC8vIElzIGJhY2t3YXJkXG4gICAgICAgIHJldHVybiB0aGlzLnN0YWNrLnBvcCgpO1xuICAgIH1cblxuICAgIC8vIElzIGZvcndhcmRcbiAgICB2YXIgY3VycmVudFBhZ2VJZCA9IHRoaXMuc3RhY2tbIHRoaXMuc3RhY2subGVuZ3RoIC0gMSBdO1xuICAgIHRoaXMuc3RhY2sucHVzaCggcGFnZUlkICk7XG4gICAgcmV0dXJuIGN1cnJlbnRQYWdlSWQ7XG59O1xuXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuZ2V0Q29udGVudEZvclBhZ2UgPSBmdW5jdGlvbiggcGFnZUlkICkge1xuXG4gICAgLy8gR2V0IHRoZSByb3V0ZUl0ZW0gZnJvbSB0aGUgcm91dGVzTWFwXG4gICAgbGV0IHJvdXRlSXRlbSA9IHRoaXMuZ2V0Um91dGVJdGVtKCBwYWdlSWQgKTtcblxuICAgIC8vIEdldCB0aGUgY29udGVudCBvZiB0aGF0IHJvdXRlXG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29udGVudEZvclJvdXRlKCByb3V0ZUl0ZW0gKTtcbn07XG5cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5nZXRDb250ZW50Rm9yUm91dGUgPSBmdW5jdGlvbiggcm91dGVJdGVtICkge1xuICAgIFxuICAgIC8vIENoZWNrIGtlZXBBbGl2ZVxuICAgIGlmICggcm91dGVJdGVtLmtlZXBBbGl2ZSApe1xuICAgICAgICBsZXQgYWxpdmVQYWdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIHJvdXRlSXRlbS5pZCApO1xuICAgICAgICBpZiAoIGFsaXZlUGFnZSApe1xuICAgICAgICAgICAgcmV0dXJuIGFsaXZlUGFnZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENoZWNrIGNvbnRlbnRcbiAgICBsZXQgY29udGVudCA9IHJvdXRlSXRlbS5jb250ZW50O1xuICAgIGlmICggY29udGVudCApe1xuICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICB9XG5cbiAgICAvLyBDaGVjayB1cmxcbiAgICBsZXQgdXJsID0gcm91dGVJdGVtLnVybDtcbiAgICBpZiAoIHVybCApe1xuICAgICAgICByZXR1cm4gYmx1ZVJvdXRlci5odG1sRmV0Y2hlci5sb2FkVXJsKCB1cmwgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gJzxkaXYgaWQ9XCJlcnJvclwiPk5vIGNvbnRlbnQgZm91bmQgZm9yIHJvdXRlIGZyb20gcGF0aCAnICsgcm91dGVJdGVtLmlkICsgJzwvZGl2Pic7XG59O1xuXG4vKiogQHN1cHByZXNzIHttaXNzaW5nUHJvcGVydGllc30gKi9cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5kb1BhZ2VUcmFuc2l0aW9uID0gZnVuY3Rpb24oIGNvbnRlbnQsIG5leHRQYWdlSWQsIGN1cnJlbnRQYWdlSWQsIHVybE9iamVjdCwgbXVzdEFuaW1hdGVCeUNvZGUgKSB7XG5cbiAgICAvLyBHZXQgbXVzdEFuaW1hdGVPdXQgYW5kIG11c3RBbmltYXRlSW5cbiAgICBjb25zdCBtdXN0QW5pbWF0ZU91dCA9IG11c3RBbmltYXRlQnlDb2RlICYmICEhdGhpcy5vcHRpb25zLmFuaW1hdGlvbk91dDtcbiAgICBjb25zdCBtdXN0QW5pbWF0ZUluID0gbXVzdEFuaW1hdGVCeUNvZGUgJiYgISF0aGlzLm9wdGlvbnMuYW5pbWF0aW9uSW47XG5cbiAgICAvLyBHZXQgdGhlIGluaXRFdmVudFxuICAgIGNvbnN0IGluaXRFdmVudCA9IGNvbnRlbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudD8gYmx1ZVJvdXRlci5kZWZhdWx0T3B0aW9ucy5FVkVOVF9SRUlOSVQ6IGJsdWVSb3V0ZXIuZGVmYXVsdE9wdGlvbnMuRVZFTlRfSU5JVDtcblxuICAgIC8vIFJ1biBldmVudHNcbiAgICB0aGlzLnJ1bkV2ZW50KCBibHVlUm91dGVyLmRlZmF1bHRPcHRpb25zLkVWRU5UX0JFRk9SRV9PVVQsIGN1cnJlbnRQYWdlSWQsIHt9ICk7XG5cbiAgICAvLyBHZXQgdGhlIGN1cnJlbnRQYWdlIGFuZCBhZGQgbmV4dCBwYWdlXG4gICAgbGV0IGN1cnJlbnRQYWdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSggJ2N1cnJlbnRQYWdlJyApWzBdO1xuICAgIGxldCBuZXdQYWdlID0gdGhpcy5hZGROZXh0UGFnZSggY3VycmVudFBhZ2UsIGNvbnRlbnQsIG5leHRQYWdlSWQgKTtcblxuICAgIC8vIFJlbmRlciBuZXh0IHBhZ2VcbiAgICB0aGlzLnJ1blJlbmRlclJlbGF0ZWQoIGluaXRFdmVudCwgbmV4dFBhZ2VJZCwgdXJsT2JqZWN0ICk7XG5cbiAgICAvLyBEZWZpbmUgY3VycmVudFBhZ2VBbmltYXRpb25lbmRMaXN0ZW5lciBhbmQgbmV3UGFnZUFuaW1hdGlvbmVuZExpc3RlbmVyXG4gICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgIGxldCBjdXJyZW50UGFnZUFuaW1hdGlvbmVuZExpc3RlbmVyID0gKCkgPT4ge1xuICAgICAgICBjdXJyZW50UGFnZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnYW5pbWF0aW9uZW5kJywgY3VycmVudFBhZ2VBbmltYXRpb25lbmRMaXN0ZW5lciApO1xuICAgICAgICBcbiAgICAgICAgLy8gUmVtb3ZlIGhpZGRlbiBjbGFzcywgYWRkIGFuaW1hdGlvbkluIGNsYXNzXG4gICAgICAgIG5ld1BhZ2UuY2xhc3NMaXN0LnJlbW92ZSggJ2hpZGRlbicgKTtcbiAgICAgICAgaWYgKCBtdXN0QW5pbWF0ZUluICl7XG4gICAgICAgICAgICBuZXdQYWdlLmNsYXNzTGlzdC5hZGQoIHRoaXMub3B0aW9ucy5hbmltYXRpb25JbiApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmV0aXJlIGN1cnJlbnQgcGFnZTogc2F2ZSBpdCBhcyBhbiBhbGl2ZSBwYWdlIG9yIHJlbW92ZSBpdFxuICAgICAgICB0aGlzLnJldGlyZUN1cnJlbnRQYWdlKCBjdXJyZW50UGFnZUlkLCBjdXJyZW50UGFnZSApO1xuICAgICAgICBzZWxmLnJ1bkV2ZW50KCBibHVlUm91dGVyLmRlZmF1bHRPcHRpb25zLkVWRU5UX0FGVEVSX09VVCwgY3VycmVudFBhZ2VJZCwge30gKTtcblxuICAgICAgICAvLyAgUnVuIG5ld1BhZ2VBbmltYXRpb25lbmRMaXN0ZW5lciBpZiBsaXN0ZW5lciBvZiBhbWltYXRpb25lbmQgb24gbmV3UGFnZSB3YXMgbm90IGFkZGVkXG4gICAgICAgIGlmICggISBtdXN0QW5pbWF0ZUluICkge1xuICAgICAgICAgICAgbmV3UGFnZUFuaW1hdGlvbmVuZExpc3RlbmVyKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgbGV0IG5ld1BhZ2VBbmltYXRpb25lbmRMaXN0ZW5lciA9ICgpID0+IHtcbiAgICAgICAgbmV3UGFnZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnYW5pbWF0aW9uZW5kJywgbmV3UGFnZUFuaW1hdGlvbmVuZExpc3RlbmVyICk7XG5cbiAgICAgICAgLy8gUmVtb3ZlIG5leHRQYWdlIGNsYXNzLCBhZGQgY3VycmVudFBhZ2UgY2xhc3MsIHJlbW92ZSBhbmltYXRpb25JbiBjbGFzc1xuICAgICAgICBuZXdQYWdlLmNsYXNzTGlzdC5yZW1vdmUoICduZXh0UGFnZScgKTtcbiAgICAgICAgbmV3UGFnZS5jbGFzc0xpc3QuYWRkKCAnY3VycmVudFBhZ2UnICk7XG4gICAgICAgIGlmICggbXVzdEFuaW1hdGVJbiApe1xuICAgICAgICAgICAgbmV3UGFnZS5jbGFzc0xpc3QucmVtb3ZlKCB0aGlzLm9wdGlvbnMuYW5pbWF0aW9uSW4gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJ1biBFVkVOVF9JTklUIG9yIEVWRU5UX1JFSU5JVFxuICAgICAgICBzZWxmLnJ1bkV2ZW50KCBpbml0RXZlbnQsIG5leHRQYWdlSWQsIHVybE9iamVjdCApO1xuXG4gICAgICAgIC8vIFJ1biBFVkVOVF9NT1VOVEVEXG4gICAgICAgIHNlbGYucnVuRXZlbnQoIGJsdWVSb3V0ZXIuZGVmYXVsdE9wdGlvbnMuRVZFTlRfTU9VTlRFRCwgbmV4dFBhZ2VJZCwgdXJsT2JqZWN0ICk7XG4gICAgfTtcblxuICAgIC8vIEFkZCBldmVudCBsaXN0ZW5lcnNcbiAgICBpZiAoIG11c3RBbmltYXRlT3V0ICl7XG4gICAgICAgIGN1cnJlbnRQYWdlLmFkZEV2ZW50TGlzdGVuZXIoICdhbmltYXRpb25lbmQnLCBjdXJyZW50UGFnZUFuaW1hdGlvbmVuZExpc3RlbmVyICk7XG4gICAgfVxuICAgIGlmICggbXVzdEFuaW1hdGVJbiApe1xuICAgICAgICBuZXdQYWdlLmFkZEV2ZW50TGlzdGVuZXIoICdhbmltYXRpb25lbmQnLCBuZXdQYWdlQW5pbWF0aW9uZW5kTGlzdGVuZXIgKTtcbiAgICB9XG5cbiAgICAvLyBBbmltYXRlIVxuICAgIGlmICggbXVzdEFuaW1hdGVPdXQgKXtcbiAgICAgICAgY3VycmVudFBhZ2UuY2xhc3NMaXN0LmFkZCggdGhpcy5vcHRpb25zLmFuaW1hdGlvbk91dCApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGN1cnJlbnRQYWdlQW5pbWF0aW9uZW5kTGlzdGVuZXIoKTtcbiAgICB9XG59O1xuXG4vKiogQHN1cHByZXNzIHttaXNzaW5nUHJvcGVydGllc30gKi9cbmJsdWVSb3V0ZXIucm91dGVyLnByb3RvdHlwZS5ydW5SZW5kZXJSZWxhdGVkID0gZnVuY3Rpb24oIGluaXRFdmVudCwgbmV4dFBhZ2VJZCwgdXJsT2JqZWN0ICl7XG5cbiAgICAvLyBSdW4gcHJlRXZlbnQgKEVWRU5UX1BSRV9JTklUIG9yIEVWRU5UX1BSRV9SRUlOSVQpXG4gICAgY29uc3QgcHJlRXZlbnQgPSBpbml0RXZlbnQgPT09ICB0aGlzLm9wdGlvbnMuRVZFTlRfSU5JVD9cbiAgICAgICAgdGhpcy5vcHRpb25zLkVWRU5UX1BSRV9JTklUOlxuICAgICAgICB0aGlzLm9wdGlvbnMuRVZFTlRfUFJFX1JFSU5JVFxuXG4gICAgdGhpcy5ydW5FdmVudCggcHJlRXZlbnQsIG5leHRQYWdlSWQsIHVybE9iamVjdCApO1xuXG4gICAgLy8gUnVuIHJlbmRlciBpZiBuZWVkZWRcbiAgICBjb25zdCByb3V0ZUl0ZW0gPSB0aGlzLmdldFJvdXRlSXRlbSggbmV4dFBhZ2VJZCApO1xuICAgIGNvbnN0IHJlbmRlck9wdGlvbiA9IGluaXRFdmVudCA9PT0gIHRoaXMub3B0aW9ucy5FVkVOVF9JTklUP1xuICAgICAgICB0aGlzLm9wdGlvbnMuUlVOX1JFTkRFUl9CRUZPUkVfRVZFTlRfSU5JVDpcbiAgICAgICAgdGhpcy5vcHRpb25zLlJVTl9SRU5ERVJfQkVGT1JFX0VWRU5UX1JFSU5JVDtcbiAgICBjb25zdCByb3V0ZVByb3BlcnR5ID0gaW5pdEV2ZW50ID09PSAgdGhpcy5vcHRpb25zLkVWRU5UX0lOSVQ/XG4gICAgICAgICdydW5SZW5kZXJCZWZvcmVJbml0JzpcbiAgICAgICAgJ3J1blJlbmRlckJlZm9yZVJlaW5pdCc7XG4gICAgY29uc3QgbXVzdFJ1blJlbmRlciA9IHJvdXRlSXRlbVsgcm91dGVQcm9wZXJ0eSBdID09PSB1bmRlZmluZWQ/XG4gICAgICAgIHJlbmRlck9wdGlvbjpcbiAgICAgICAgcm91dGVJdGVtWyByb3V0ZVByb3BlcnR5IF07XG5cbiAgICBpZiAoIG11c3RSdW5SZW5kZXIgJiYgdGhpcy5vcHRpb25zLnJlbmRlckZ1bmN0aW9uICYmIGJsdWVSb3V0ZXIudXRpbHMuaXNGdW5jdGlvbiggdGhpcy5vcHRpb25zLnJlbmRlckZ1bmN0aW9uICkgKXtcbiAgICAgICAgdGhpcy5vcHRpb25zLnJlbmRlckZ1bmN0aW9uKFxuICAgICAgICAgICAgdGhpcy5idWlsZFBhZ2VJbnN0YW5jZSggbmV4dFBhZ2VJZCApXG4gICAgICAgICk7XG4gICAgfVxufTtcblxuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLmJ1aWxkUGFnZUluc3RhbmNlID0gZnVuY3Rpb24oIHBhZ2VJZCApe1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgICdpZCc6IHBhZ2VJZCxcbiAgICAgICAgICdlbCc6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBwYWdlSWQgKVxuICAgIH07XG59O1xuXG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUuYWRkTmV4dFBhZ2UgPSBmdW5jdGlvbiggY3VycmVudFBhZ2UsIGNvbnRlbnQsIG5leHRQYWdlSWQgKXtcblxuICAgIGlmICggY29udGVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ICl7XG4gICAgICAgIC8vIGNvbnRlbnQgaXMgSFRNTEVsZW1lbnRcbiAgICAgICAgY3VycmVudFBhZ2UuaW5zZXJ0QWRqYWNlbnRFbGVtZW50KFxuICAgICAgICAgICAgJ2FmdGVyZW5kJyxcbiAgICAgICAgICAgIGNvbnRlbnRcbiAgICAgICAgKTtcbiAgICAgICAgY29udGVudC5jbGFzc0xpc3QuYWRkKCAnbmV4dFBhZ2UnICk7XG4gICAgICAgIGNvbnRlbnQuY2xhc3NMaXN0LmFkZCggJ2hpZGRlbicgKTtcbiAgICAgICAgY29udGVudC5jbGFzc0xpc3QucmVtb3ZlKCAnYWxpdmUnICk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjb250ZW50IG11c3QgYmUgdGV4dFxuICAgICAgICBjdXJyZW50UGFnZS5pbnNlcnRBZGphY2VudEhUTUwoXG4gICAgICAgICAgICAnYWZ0ZXJlbmQnLFxuICAgICAgICAgICAgJzxkaXYgY2xhc3M9XCJuZXh0UGFnZSBoaWRkZW4gcGFnZVwiIGlkPVwiJyArIG5leHRQYWdlSWQgKyAnXCI+J1xuICAgICAgICAgICAgKyBjb250ZW50XG4gICAgICAgICAgICArICc8L2Rpdj4nXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBuZXh0UGFnZUlkICk7XG59O1xuXG4vLyBSZXRpcmUgY3VycmVudCBwYWdlOiBzYXZlIGl0IGFzIGFuIGFsaXZlIHBhZ2Ugb3IgcmVtb3ZlIGl0XG5ibHVlUm91dGVyLnJvdXRlci5wcm90b3R5cGUucmV0aXJlQ3VycmVudFBhZ2UgPSBmdW5jdGlvbiggY3VycmVudFBhZ2VJZCwgY3VycmVudFBhZ2UgKXtcblxuICAgIGxldCBjdXJyZW50Um91dGUgPSB0aGlzLmdldFJvdXRlSXRlbSggY3VycmVudFBhZ2VJZCApO1xuXG4gICAgLy8gSWYgbXVzdCBrZWVwIGFsaXZlIGN1cnJlbnQgcGFnZSwgc2V0IHBhZ2UgYW5kIGFsaXZlIGFzIGNsYXNzZXMgcmVtb3ZpbmcgdGhlIHJlc3RcbiAgICBpZiAoIGN1cnJlbnRSb3V0ZSAmJiBjdXJyZW50Um91dGUua2VlcEFsaXZlKXtcbiAgICAgICAgY3VycmVudFBhZ2UucmVtb3ZlQXR0cmlidXRlKCAnY2xhc3MnICk7XG4gICAgICAgIGN1cnJlbnRQYWdlLmNsYXNzTGlzdC5hZGQoICdwYWdlJyApO1xuICAgICAgICBjdXJyZW50UGFnZS5jbGFzc0xpc3QuYWRkKCAnYWxpdmUnICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBEbyBub3Qga2VlcCBhbGl2ZSBjdXJyZW50IHBhZ2UsIHNvIHJlbW92ZSBpdFxuICAgIGN1cnJlbnRQYWdlLnJlbW92ZSgpO1xufTtcblxuYmx1ZVJvdXRlci5yb3V0ZXIucHJvdG90eXBlLnJ1bkV2ZW50ID0gZnVuY3Rpb24oIGV2ZW50SWQsIHBhZ2VJZCwgdXJsT2JqZWN0ICkge1xuXG4gICAgaWYgKCBldmVudElkID09IGJsdWVSb3V0ZXIuZGVmYXVsdE9wdGlvbnMuRVZFTlRfSU5JVCApe1xuICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXJzRm9yTGlua3MoIHBhZ2VJZCApO1xuICAgIH1cblxuICAgIC8vIEdldCB0aGUgcGFnZSBvYmplY3QgZnJvbSBvcHRpb25zXG4gICAgLyoqIEBzdXBwcmVzcyB7bWlzc2luZ1Byb3BlcnRpZXN9ICovXG4gICAgbGV0IHBhZ2UgPSB0aGlzLm9wdGlvbnMuZXZlbnRzQnlQYWdlWyBwYWdlSWQgXTtcblxuICAgIC8vIElmIGEgcGFnZSBpcyBmb3VuZCwgcnVuIHRoZSBldmVudCBoYW5kbGVyXG4gICAgaWYgKCBwYWdlICl7XG4gICAgICAgIGxldCBldmVudCA9IHtcbiAgICAgICAgICAgIHBhcmFtczogdXJsT2JqZWN0LnBhcmFtcyB8fCB7fVxuICAgICAgICB9O1xuICAgICAgICBpZiAoIHBhZ2VbIGV2ZW50SWQgXSAmJiBibHVlUm91dGVyLnV0aWxzLmlzRnVuY3Rpb24oIHBhZ2VbIGV2ZW50SWQgXSApICl7XG4gICAgICAgICAgICBwYWdlWyBldmVudElkIF0oIGV2ZW50ICk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5cbi8vIERlZmF1bHQgb3B0aW9uc1xuXG5ibHVlUm91dGVyLmRlZmF1bHRPcHRpb25zID0ge1xuICAgIHVwZGF0ZU9uTG9hZDogdHJ1ZSxcbiAgICBwcmVsb2FkUGFnZXNPbkxvYWQ6IGZhbHNlLFxuXG4gICAgLy8gQW5pbWF0aW9uc1xuICAgIGFuaW1hdGlvbk91dDogJ3NsaWRlLW91dC10b3AnLFxuICAgIC8vYW5pbWF0aW9uT3V0OiBmYWxzZSxcbiAgICBhbmltYXRpb25JbjogJ3NjYWxlLWluLWNlbnRlcicsXG4gICAgLy9hbmltYXRpb25JbjogZmFsc2UsXG4gICAgYW5pbWF0ZVRyYW5zaXRpb25zT25Mb2FkOiBmYWxzZSxcbiAgICBcbiAgICAvLyBNaXNjXG4gICAgUEFHRV9QUkVGSVg6ICchJyxcblxuICAgIC8vIFNwZWNpYWwgcGFnZXMgaWRzXG4gICAgUEFHRV9JRF9IT01FOiAnW2hvbWVdJyxcbiAgICBQQUdFX0lEXzQwNF9FUlJPUjogJ1s0MDRdJyxcblxuICAgIC8vIEV2ZW50c1xuICAgIEVWRU5UX1BSRV9JTklUOiAncHJlSW5pdCcsXG4gICAgRVZFTlRfSU5JVDogJ2luaXQnLFxuICAgIEVWRU5UX1BSRV9SRUlOSVQ6ICdwcmVSZWluaXQnLFxuICAgIEVWRU5UX1JFSU5JVDogJ3JlaW5pdCcsXG4gICAgRVZFTlRfTU9VTlRFRDogJ21vdW50ZWQnLFxuICAgIEVWRU5UX0JFRk9SRV9PVVQ6ICdiZWZvcmVPdXQnLFxuICAgIEVWRU5UX0FGVEVSX09VVDogJ2FmdGVyT3V0JyxcblxuICAgIFJVTl9SRU5ERVJfQkVGT1JFX0VWRU5UX0lOSVQ6IHRydWUsXG4gICAgUlVOX1JFTkRFUl9CRUZPUkVfRVZFTlRfUkVJTklUOiBmYWxzZVxuXG59O1xuXG5cbmJsdWVSb3V0ZXIuaHRtbEZldGNoZXIgPSB7fTtcblxuYmx1ZVJvdXRlci5odG1sRmV0Y2hlci5sb2FkQWxsVXJscyA9IGZ1bmN0aW9uKCByb3V0ZXIsIGNhbGxiYWNrICl7XG5cbiAgICAvLyBHZXQgdGhlIHJvdXRlcyB0byB1c2VcbiAgICBjb25zdCByb3V0ZXMgPSByb3V0ZXIub3B0aW9ucy5yb3V0ZXMgfHwgW107XG5cbiAgICAvLyBJbml0IHRoZSBudW1iZXIgb3QgdXJscyB0byBnZXRcbiAgICBsZXQgcGVuZGluZyA9IDA7XG5cbiAgICAvLyBJdGVyYXRlIHVybFJvdXRlcyBhbmQgbG9hZCBlYWNoIHJvdXRlSXRlbSBpZiBuZWVkZWRcbiAgICByb3V0ZXMubWFwKCByb3V0ZUl0ZW0gPT4ge1xuICAgICAgICBsZXQgdXJsID0gcm91dGVJdGVtLnVybDtcbiAgICAgICAgaWYgKCB1cmwgKXtcbiAgICAgICAgICAgICsrcGVuZGluZztcbiAgICAgICAgICAgIGJsdWVSb3V0ZXIuaHRtbEZldGNoZXIubG9hZFVybCggdXJsICkudGhlbihcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiggdGV4dCApe1xuICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgY29udGVudCBvZiByb3V0ZVxuICAgICAgICAgICAgICAgICAgICByb3V0ZUl0ZW0uY29udGVudCA9IHRleHQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUnVuIGNhbGxiYWNrIHdoZW4gYWxsIGZpbGVzIGhhdmUgYmVlbiBsb2FkZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCAtLXBlbmRpbmcgPT0gMCAmJiBjYWxsYmFjayAmJiBibHVlUm91dGVyLnV0aWxzLmlzRnVuY3Rpb24oIGNhbGxiYWNrICkgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmxcbiAqIFxuICovXG5ibHVlUm91dGVyLmh0bWxGZXRjaGVyLmxvYWRVcmwgPSBhc3luYyBmdW5jdGlvbiggdXJsICl7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCB1cmwgKTtcblxuICAgIGlmICggISByZXNwb25zZS5vayApIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBFcnJvciBmZXRjaGluZyAke3VybH0gaGFzIG9jY3VyZWQ6ICR7cmVzcG9uc2Uuc3RhdHVzfWA7XG4gICAgICAgIGFsZXJ0ICggbWVzc2FnZSApO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoIG1lc3NhZ2UgKTtcbiAgICB9XG4gIFxuICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG4gICAgcmV0dXJuIHRleHQ7XG59O1xuXG5ibHVlUm91dGVyLnV0aWxzID0ge307XG5cbi8qXG4gICAgQnVpbGRzIGFuIG9iamVjdCB3aXRoIGRhdGEgYWJvdXQgdGhlIHVybC4gQW4gZXhhbXBsZTpcblxuICAgIHVybCA6IGh0dHA6Ly8xMjcuMC4wLjE6OTAwMC9zYW1wbGVzL3NhbXBsZS5odG1sIyFhYm91dD9wYXJhbTE9YSZwYXJhbTI9YlwiXG5cbiAgICBwcmVwYWdlOiBodHRwOi8vMTI3LjAuMC4xOjkwMDAvc2FtcGxlcy9zYW1wbGUuaHRtbFxuICAgIHBhZ2U6IGFib3V0XG4gICAgcGFyYW1zOiB7XG4gICAgICAgIHBhcmFtMTogYVxuICAgICAgICBwYXJhbTI6IGJcbiAgICB9XG4qL1xuYmx1ZVJvdXRlci51dGlscy5hbmFsaXplVXJsID0gZnVuY3Rpb24oIHVybCwgb3B0aW9ucyApIHtcbiAgICBcbiAgICBsZXQgcmVzdWx0ID0ge307XG5cbiAgICAvLyBFeHRyYWN0IHRoZSBwYXJ0cyBiZWZvcmUgYW5kIGFmdGVyIFBBR0VfUFJFRklYXG4gICAgbGV0IHVybFBhcnRzID0gdXJsLnNwbGl0KCBvcHRpb25zLlBBR0VfUFJFRklYICk7XG4gICAgcmVzdWx0LnByZXBhZ2UgPSB1cmxQYXJ0c1sgMCBdO1xuICAgIGxldCBwb3N0UGF0aCA9IHVybFBhcnRzWyAxIF0gfHwgJyc7XG5cbiAgICAvLyBSZW1vdmUgIyBpZiBwcmVzZW50XG4gICAgaWYgKCByZXN1bHQucHJlcGFnZS5lbmRzV2l0aCggJyMnICkgKXtcbiAgICAgICAgcmVzdWx0LnByZXBhZ2UgPSByZXN1bHQucHJlcGFnZS5zbGljZSggMCwgLTEgKTtcbiAgICB9XG5cbiAgICAvLyBFeHRyYWN0IHRoZSBwYXJ0cyBiZWZvcmUgYW5kIGFmdGVyID9cbiAgICBsZXQgcGF0aFBhcnRzID0gcG9zdFBhdGguc3BsaXQoICc/JyApO1xuICAgIHJlc3VsdC5wYWdlID0gcGF0aFBhcnRzWyAwIF07XG5cbiAgICAvLyBGaXggaG9tZSBwYWdlXG4gICAgaWYgKCByZXN1bHQucGFnZSA9PSAnJykge1xuICAgICAgICByZXN1bHQucGFnZSA9IG9wdGlvbnMuUEFHRV9JRF9IT01FO1xuICAgIH1cblxuICAgIGxldCBwYXJhbXNTdHJpbmcgPSBwYXRoUGFydHNbIDEgXSB8fCAnJztcblxuICAgIC8vIEFkZCBwYXJhbXNcbiAgICByZXN1bHQucGFyYW1zID0ge307XG4gICAgaWYgKCBwYXJhbXNTdHJpbmcgPT0gJycgKXtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgbGV0IHZhcnMgPSBwYXJhbXNTdHJpbmcuc3BsaXQoICcmJyApO1xuICAgIGZvciAoIGxldCBpID0gMDsgaSA8IHZhcnMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIGxldCBwYWlyID0gdmFyc1sgaSBdLnNwbGl0KCAnPScgKTtcbiAgICAgICAgbGV0IHBhcmFtTmFtZSA9IHBhaXJbIDAgXTtcbiAgICAgICAgbGV0IHBhcmFtVmFsdWUgPSBwYWlyWyAxIF07XG4gICAgICAgIHJlc3VsdC5wYXJhbXNbIHBhcmFtTmFtZSBdID0gcGFyYW1WYWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuYmx1ZVJvdXRlci51dGlscy5hZGRFdmVudExpc3RlbmVyT25MaXN0ID0gZnVuY3Rpb24oIGxpc3QsIGV2ZW50LCBmbiApIHtcblxuICAgIGZvciAoIGxldCBpID0gMCwgbGVuID0gbGlzdC5sZW5ndGg7IGkgPCBsZW47IGkrKyApIHtcbiAgICAgICAgbGlzdFsgaSBdLmFkZEV2ZW50TGlzdGVuZXIoIGV2ZW50LCBmbiwgZmFsc2UgKTtcbiAgICB9XG59O1xuXG5ibHVlUm91dGVyLnV0aWxzLmV4dGVuZCA9IGZ1bmN0aW9uKCBvdXQsIGZyb20xLCBmcm9tMiApIHtcbiAgICBvdXQgPSBvdXQgfHwge307XG5cbiAgICBmb3IgKCB2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIGlmICggISBhcmd1bWVudHNbIGkgXSApe1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKCB2YXIga2V5IGluIGFyZ3VtZW50c1sgaSBdICkge1xuICAgICAgICAgICAgaWYgKCBhcmd1bWVudHNbIGkgXS5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgKXtcbiAgICAgICAgICAgICAgICBvdXRbIGtleSBdID0gYXJndW1lbnRzWyBpIF1bIGtleSBdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dDtcbn07XG5cbi8qIGZvcm1hdFN0cmluZyAqL1xuLy8gRXhhbXBsZTogaXRpbHMuZm9ybWF0U3RyaW5nKCAnezB9IGlzIGRlYWQsIGJ1dCB7MX0gaXMgYWxpdmUhJywgJ0FTUCcsICdBU1AuTkVUJyApXG4vKipcbiAqIFRha2VzIDEgb3IgbW9yZSBzdHJpbmdzIGFuZCBkbyBzb21ldGhpbmcgY29vbCB3aXRoIHRoZW0uXG4gKiBAcGFyYW0gey4uLnN0cmluZ3xudW1iZXJ9IGZvcm1hdFxuICovXG5ibHVlUm91dGVyLnV0aWxzLmZvcm1hdFN0cmluZyA9IGZ1bmN0aW9uKCBmb3JtYXQgKSB7XG4gICAgXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggYXJndW1lbnRzLCAxICk7XG4gICAgcmV0dXJuIGZvcm1hdC5yZXBsYWNlKC97KFxcZCspfS9nLCBmdW5jdGlvbiAoIG1hdGNoLCBudW1iZXIgKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgYXJnc1sgbnVtYmVyIF0gIT0gJ3VuZGVmaW5lZCc/IGFyZ3NbIG51bWJlciBdIDogbWF0Y2g7XG4gICAgfSk7XG59O1xuXG5ibHVlUm91dGVyLnV0aWxzLmlzRnVuY3Rpb24gPSBmdW5jdGlvbiBpc0Z1bmN0aW9uKCBvYmogKSB7XG5cbiAgICAvLyBTdXBwb3J0OiBDaHJvbWUgPD01NywgRmlyZWZveCA8PTUyXG4gICAgLy8gSW4gc29tZSBicm93c2VycywgdHlwZW9mIHJldHVybnMgXCJmdW5jdGlvblwiIGZvciBIVE1MIDxvYmplY3Q+IGVsZW1lbnRzXG4gICAgLy8gKGkuZS4sIGB0eXBlb2YgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggXCJvYmplY3RcIiApID09PSBcImZ1bmN0aW9uXCJgKS5cbiAgICAvLyBXZSBkb24ndCB3YW50IHRvIGNsYXNzaWZ5ICphbnkqIERPTSBub2RlIGFzIGEgZnVuY3Rpb24uXG4gICAgcmV0dXJuIHR5cGVvZiBvYmogPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2Ygb2JqLm5vZGVUeXBlICE9PSBcIm51bWJlclwiO1xufTtcbi8qIGVuZCBvZiB1dGlscyAqL1xuXG4vLyBSZWdpc3RlciBibHVlUm91dGVyIGlmIHdlIGFyZSB1c2luZyBOb2RlXG5pZiAoIHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzICkge1xuICAgIG1vZHVsZS5leHBvcnRzID0gYmx1ZVJvdXRlcjtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKiFcbiAqIFFVbml0IDIuMTEuM1xuICogaHR0cHM6Ly9xdW5pdGpzLmNvbS9cbiAqXG4gKiBDb3B5cmlnaHQgT3BlbkpTIEZvdW5kYXRpb24gYW5kIG90aGVyIGNvbnRyaWJ1dG9yc1xuICogUmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlXG4gKiBodHRwczovL2pxdWVyeS5vcmcvbGljZW5zZVxuICpcbiAqIERhdGU6IDIwMjAtMTAtMDVUMDE6MzRaXG4gKi9cbihmdW5jdGlvbiAoZ2xvYmFsJDEpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdGZ1bmN0aW9uIF9pbnRlcm9wRGVmYXVsdExlZ2FjeSAoZSkgeyByZXR1cm4gZSAmJiB0eXBlb2YgZSA9PT0gJ29iamVjdCcgJiYgJ2RlZmF1bHQnIGluIGUgPyBlIDogeyAnZGVmYXVsdCc6IGUgfTsgfVxuXG5cdHZhciBnbG9iYWxfX2RlZmF1bHQgPSAvKiNfX1BVUkVfXyovX2ludGVyb3BEZWZhdWx0TGVnYWN5KGdsb2JhbCQxKTtcblxuXHR2YXIgd2luZG93JDEgPSBnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXS53aW5kb3c7XG5cdHZhciBzZWxmJDEgPSBnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXS5zZWxmO1xuXHR2YXIgY29uc29sZSA9IGdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddLmNvbnNvbGU7XG5cdHZhciBzZXRUaW1lb3V0JDEgPSBnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXS5zZXRUaW1lb3V0O1xuXHR2YXIgY2xlYXJUaW1lb3V0ID0gZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10uY2xlYXJUaW1lb3V0O1xuXHR2YXIgZG9jdW1lbnQkMSA9IHdpbmRvdyQxICYmIHdpbmRvdyQxLmRvY3VtZW50O1xuXHR2YXIgbmF2aWdhdG9yID0gd2luZG93JDEgJiYgd2luZG93JDEubmF2aWdhdG9yO1xuXHR2YXIgbG9jYWxTZXNzaW9uU3RvcmFnZSA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgeCA9IFwicXVuaXQtdGVzdC1zdHJpbmdcIjtcblxuXHQgIHRyeSB7XG5cdCAgICBnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXS5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKHgsIHgpO1xuXHQgICAgZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10uc2Vzc2lvblN0b3JhZ2UucmVtb3ZlSXRlbSh4KTtcblx0ICAgIHJldHVybiBnbG9iYWxfX2RlZmF1bHRbJ2RlZmF1bHQnXS5zZXNzaW9uU3RvcmFnZTtcblx0ICB9IGNhdGNoIChlKSB7XG5cdCAgICByZXR1cm4gdW5kZWZpbmVkO1xuXHQgIH1cblx0fSgpOyAvLyBTdXBwb3J0IElFIDktMTA6IEZhbGxiYWNrIGZvciBmdXp6eXNvcnQuanMgdXNlZCBieSAvcmVwb3J0ZXIvaHRtbC5qc1xuXG5cdGlmICghZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10uTWFwKSB7XG5cdCAgZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10uTWFwID0gZnVuY3Rpb24gU3RyaW5nTWFwKCkge1xuXHQgICAgdmFyIHN0b3JlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuXHQgICAgdGhpcy5nZXQgPSBmdW5jdGlvbiAoc3RyS2V5KSB7XG5cdCAgICAgIHJldHVybiBzdG9yZVtzdHJLZXldO1xuXHQgICAgfTtcblxuXHQgICAgdGhpcy5zZXQgPSBmdW5jdGlvbiAoc3RyS2V5LCB2YWwpIHtcblx0ICAgICAgc3RvcmVbc3RyS2V5XSA9IHZhbDtcblx0ICAgICAgcmV0dXJuIHRoaXM7XG5cdCAgICB9O1xuXG5cdCAgICB0aGlzLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICBzdG9yZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdCAgICB9O1xuXHQgIH07XG5cdH1cblxuXHRmdW5jdGlvbiBfdHlwZW9mKG9iaikge1xuXHQgIFwiQGJhYmVsL2hlbHBlcnMgLSB0eXBlb2ZcIjtcblxuXHQgIGlmICh0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIFN5bWJvbC5pdGVyYXRvciA9PT0gXCJzeW1ib2xcIikge1xuXHQgICAgX3R5cGVvZiA9IGZ1bmN0aW9uIChvYmopIHtcblx0ICAgICAgcmV0dXJuIHR5cGVvZiBvYmo7XG5cdCAgICB9O1xuXHQgIH0gZWxzZSB7XG5cdCAgICBfdHlwZW9mID0gZnVuY3Rpb24gKG9iaikge1xuXHQgICAgICByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCAmJiBvYmogIT09IFN5bWJvbC5wcm90b3R5cGUgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajtcblx0ICAgIH07XG5cdCAgfVxuXG5cdCAgcmV0dXJuIF90eXBlb2Yob2JqKTtcblx0fVxuXG5cdGZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHtcblx0ICBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkge1xuXHQgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKTtcblx0ICB9XG5cdH1cblxuXHRmdW5jdGlvbiBfZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7XG5cdCAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykge1xuXHQgICAgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTtcblx0ICAgIGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTtcblx0ICAgIGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTtcblx0ICAgIGlmIChcInZhbHVlXCIgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7XG5cdCAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7XG5cdCAgfVxuXHR9XG5cblx0ZnVuY3Rpb24gX2NyZWF0ZUNsYXNzKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykge1xuXHQgIGlmIChwcm90b1Byb3BzKSBfZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpO1xuXHQgIGlmIChzdGF0aWNQcm9wcykgX2RlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTtcblx0ICByZXR1cm4gQ29uc3RydWN0b3I7XG5cdH1cblxuXHRmdW5jdGlvbiBfdG9Db25zdW1hYmxlQXJyYXkoYXJyKSB7XG5cdCAgcmV0dXJuIF9hcnJheVdpdGhvdXRIb2xlcyhhcnIpIHx8IF9pdGVyYWJsZVRvQXJyYXkoYXJyKSB8fCBfdW5zdXBwb3J0ZWRJdGVyYWJsZVRvQXJyYXkoYXJyKSB8fCBfbm9uSXRlcmFibGVTcHJlYWQoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIF9hcnJheVdpdGhvdXRIb2xlcyhhcnIpIHtcblx0ICBpZiAoQXJyYXkuaXNBcnJheShhcnIpKSByZXR1cm4gX2FycmF5TGlrZVRvQXJyYXkoYXJyKTtcblx0fVxuXG5cdGZ1bmN0aW9uIF9pdGVyYWJsZVRvQXJyYXkoaXRlcikge1xuXHQgIGlmICh0eXBlb2YgU3ltYm9sICE9PSBcInVuZGVmaW5lZFwiICYmIFN5bWJvbC5pdGVyYXRvciBpbiBPYmplY3QoaXRlcikpIHJldHVybiBBcnJheS5mcm9tKGl0ZXIpO1xuXHR9XG5cblx0ZnVuY3Rpb24gX3Vuc3VwcG9ydGVkSXRlcmFibGVUb0FycmF5KG8sIG1pbkxlbikge1xuXHQgIGlmICghbykgcmV0dXJuO1xuXHQgIGlmICh0eXBlb2YgbyA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIF9hcnJheUxpa2VUb0FycmF5KG8sIG1pbkxlbik7XG5cdCAgdmFyIG4gPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobykuc2xpY2UoOCwgLTEpO1xuXHQgIGlmIChuID09PSBcIk9iamVjdFwiICYmIG8uY29uc3RydWN0b3IpIG4gPSBvLmNvbnN0cnVjdG9yLm5hbWU7XG5cdCAgaWYgKG4gPT09IFwiTWFwXCIgfHwgbiA9PT0gXCJTZXRcIikgcmV0dXJuIEFycmF5LmZyb20obyk7XG5cdCAgaWYgKG4gPT09IFwiQXJndW1lbnRzXCIgfHwgL14oPzpVaXxJKW50KD86OHwxNnwzMikoPzpDbGFtcGVkKT9BcnJheSQvLnRlc3QobikpIHJldHVybiBfYXJyYXlMaWtlVG9BcnJheShvLCBtaW5MZW4pO1xuXHR9XG5cblx0ZnVuY3Rpb24gX2FycmF5TGlrZVRvQXJyYXkoYXJyLCBsZW4pIHtcblx0ICBpZiAobGVuID09IG51bGwgfHwgbGVuID4gYXJyLmxlbmd0aCkgbGVuID0gYXJyLmxlbmd0aDtcblxuXHQgIGZvciAodmFyIGkgPSAwLCBhcnIyID0gbmV3IEFycmF5KGxlbik7IGkgPCBsZW47IGkrKykgYXJyMltpXSA9IGFycltpXTtcblxuXHQgIHJldHVybiBhcnIyO1xuXHR9XG5cblx0ZnVuY3Rpb24gX25vbkl0ZXJhYmxlU3ByZWFkKCkge1xuXHQgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGF0dGVtcHQgdG8gc3ByZWFkIG5vbi1pdGVyYWJsZSBpbnN0YW5jZS5cXG5JbiBvcmRlciB0byBiZSBpdGVyYWJsZSwgbm9uLWFycmF5IG9iamVjdHMgbXVzdCBoYXZlIGEgW1N5bWJvbC5pdGVyYXRvcl0oKSBtZXRob2QuXCIpO1xuXHR9XG5cblx0ZnVuY3Rpb24gX2NyZWF0ZUZvck9mSXRlcmF0b3JIZWxwZXIobywgYWxsb3dBcnJheUxpa2UpIHtcblx0ICB2YXIgaXQ7XG5cblx0ICBpZiAodHlwZW9mIFN5bWJvbCA9PT0gXCJ1bmRlZmluZWRcIiB8fCBvW1N5bWJvbC5pdGVyYXRvcl0gPT0gbnVsbCkge1xuXHQgICAgaWYgKEFycmF5LmlzQXJyYXkobykgfHwgKGl0ID0gX3Vuc3VwcG9ydGVkSXRlcmFibGVUb0FycmF5KG8pKSB8fCBhbGxvd0FycmF5TGlrZSAmJiBvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikge1xuXHQgICAgICBpZiAoaXQpIG8gPSBpdDtcblx0ICAgICAgdmFyIGkgPSAwO1xuXG5cdCAgICAgIHZhciBGID0gZnVuY3Rpb24gKCkge307XG5cblx0ICAgICAgcmV0dXJuIHtcblx0ICAgICAgICBzOiBGLFxuXHQgICAgICAgIG46IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgIGlmIChpID49IG8ubGVuZ3RoKSByZXR1cm4ge1xuXHQgICAgICAgICAgICBkb25lOiB0cnVlXG5cdCAgICAgICAgICB9O1xuXHQgICAgICAgICAgcmV0dXJuIHtcblx0ICAgICAgICAgICAgZG9uZTogZmFsc2UsXG5cdCAgICAgICAgICAgIHZhbHVlOiBvW2krK11cblx0ICAgICAgICAgIH07XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBlOiBmdW5jdGlvbiAoZSkge1xuXHQgICAgICAgICAgdGhyb3cgZTtcblx0ICAgICAgICB9LFxuXHQgICAgICAgIGY6IEZcblx0ICAgICAgfTtcblx0ICAgIH1cblxuXHQgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgYXR0ZW1wdCB0byBpdGVyYXRlIG5vbi1pdGVyYWJsZSBpbnN0YW5jZS5cXG5JbiBvcmRlciB0byBiZSBpdGVyYWJsZSwgbm9uLWFycmF5IG9iamVjdHMgbXVzdCBoYXZlIGEgW1N5bWJvbC5pdGVyYXRvcl0oKSBtZXRob2QuXCIpO1xuXHQgIH1cblxuXHQgIHZhciBub3JtYWxDb21wbGV0aW9uID0gdHJ1ZSxcblx0ICAgICAgZGlkRXJyID0gZmFsc2UsXG5cdCAgICAgIGVycjtcblx0ICByZXR1cm4ge1xuXHQgICAgczogZnVuY3Rpb24gKCkge1xuXHQgICAgICBpdCA9IG9bU3ltYm9sLml0ZXJhdG9yXSgpO1xuXHQgICAgfSxcblx0ICAgIG46IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgdmFyIHN0ZXAgPSBpdC5uZXh0KCk7XG5cdCAgICAgIG5vcm1hbENvbXBsZXRpb24gPSBzdGVwLmRvbmU7XG5cdCAgICAgIHJldHVybiBzdGVwO1xuXHQgICAgfSxcblx0ICAgIGU6IGZ1bmN0aW9uIChlKSB7XG5cdCAgICAgIGRpZEVyciA9IHRydWU7XG5cdCAgICAgIGVyciA9IGU7XG5cdCAgICB9LFxuXHQgICAgZjogZnVuY3Rpb24gKCkge1xuXHQgICAgICB0cnkge1xuXHQgICAgICAgIGlmICghbm9ybWFsQ29tcGxldGlvbiAmJiBpdC5yZXR1cm4gIT0gbnVsbCkgaXQucmV0dXJuKCk7XG5cdCAgICAgIH0gZmluYWxseSB7XG5cdCAgICAgICAgaWYgKGRpZEVycikgdGhyb3cgZXJyO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfTtcblx0fVxuXG5cdC8vIFRoaXMgYWxsb3dzIHN1cHBvcnQgZm9yIElFIDksIHdoaWNoIGRvZXNuJ3QgaGF2ZSBhIGNvbnNvbGVcblx0Ly8gb2JqZWN0IGlmIHRoZSBkZXZlbG9wZXIgdG9vbHMgYXJlIG5vdCBvcGVuLlxuXG5cdHZhciBMb2dnZXIgPSB7XG5cdCAgd2FybjogY29uc29sZSA/IGNvbnNvbGUud2Fybi5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkge31cblx0fTtcblxuXHR2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXHR2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblx0dmFyIG5vdyA9IERhdGUubm93IHx8IGZ1bmN0aW9uICgpIHtcblx0ICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cdH07XG5cdHZhciBoYXNQZXJmb3JtYW5jZUFwaSA9IGRldGVjdFBlcmZvcm1hbmNlQXBpKCk7XG5cdHZhciBwZXJmb3JtYW5jZSA9IGhhc1BlcmZvcm1hbmNlQXBpID8gd2luZG93JDEucGVyZm9ybWFuY2UgOiB1bmRlZmluZWQ7XG5cdHZhciBwZXJmb3JtYW5jZU5vdyA9IGhhc1BlcmZvcm1hbmNlQXBpID8gcGVyZm9ybWFuY2Uubm93LmJpbmQocGVyZm9ybWFuY2UpIDogbm93O1xuXG5cdGZ1bmN0aW9uIGRldGVjdFBlcmZvcm1hbmNlQXBpKCkge1xuXHQgIHJldHVybiB3aW5kb3ckMSAmJiB0eXBlb2Ygd2luZG93JDEucGVyZm9ybWFuY2UgIT09IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mIHdpbmRvdyQxLnBlcmZvcm1hbmNlLm1hcmsgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2Ygd2luZG93JDEucGVyZm9ybWFuY2UubWVhc3VyZSA9PT0gXCJmdW5jdGlvblwiO1xuXHR9XG5cblx0ZnVuY3Rpb24gbWVhc3VyZShjb21tZW50LCBzdGFydE1hcmssIGVuZE1hcmspIHtcblx0ICAvLyBgcGVyZm9ybWFuY2UubWVhc3VyZWAgbWF5IGZhaWwgaWYgdGhlIG1hcmsgY291bGQgbm90IGJlIGZvdW5kLlxuXHQgIC8vIHJlYXNvbnMgYSBzcGVjaWZpYyBtYXJrIGNvdWxkIG5vdCBiZSBmb3VuZCBpbmNsdWRlOiBvdXRzaWRlIGNvZGUgaW52b2tpbmcgYHBlcmZvcm1hbmNlLmNsZWFyTWFya3MoKWBcblx0ICB0cnkge1xuXHQgICAgcGVyZm9ybWFuY2UubWVhc3VyZShjb21tZW50LCBzdGFydE1hcmssIGVuZE1hcmspO1xuXHQgIH0gY2F0Y2ggKGV4KSB7XG5cdCAgICBMb2dnZXIud2FybihcInBlcmZvcm1hbmNlLm1lYXN1cmUgY291bGQgbm90IGJlIGV4ZWN1dGVkIGJlY2F1c2Ugb2YgXCIsIGV4Lm1lc3NhZ2UpO1xuXHQgIH1cblx0fVxuXHR2YXIgZGVmaW5lZCA9IHtcblx0ICBkb2N1bWVudDogd2luZG93JDEgJiYgd2luZG93JDEuZG9jdW1lbnQgIT09IHVuZGVmaW5lZCxcblx0ICBzZXRUaW1lb3V0OiBzZXRUaW1lb3V0JDEgIT09IHVuZGVmaW5lZFxuXHR9OyAvLyBSZXR1cm5zIGEgbmV3IEFycmF5IHdpdGggdGhlIGVsZW1lbnRzIHRoYXQgYXJlIGluIGEgYnV0IG5vdCBpbiBiXG5cblx0ZnVuY3Rpb24gZGlmZihhLCBiKSB7XG5cdCAgdmFyIGksXG5cdCAgICAgIGosXG5cdCAgICAgIHJlc3VsdCA9IGEuc2xpY2UoKTtcblxuXHQgIGZvciAoaSA9IDA7IGkgPCByZXN1bHQubGVuZ3RoOyBpKyspIHtcblx0ICAgIGZvciAoaiA9IDA7IGogPCBiLmxlbmd0aDsgaisrKSB7XG5cdCAgICAgIGlmIChyZXN1bHRbaV0gPT09IGJbal0pIHtcblx0ICAgICAgICByZXN1bHQuc3BsaWNlKGksIDEpO1xuXHQgICAgICAgIGktLTtcblx0ICAgICAgICBicmVhaztcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiByZXN1bHQ7XG5cdH1cblx0LyoqXG5cdCAqIERldGVybWluZXMgd2hldGhlciBhbiBlbGVtZW50IGV4aXN0cyBpbiBhIGdpdmVuIGFycmF5IG9yIG5vdC5cblx0ICpcblx0ICogQG1ldGhvZCBpbkFycmF5XG5cdCAqIEBwYXJhbSB7QW55fSBlbGVtXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGFycmF5XG5cdCAqIEByZXR1cm4ge0Jvb2xlYW59XG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGluQXJyYXkoZWxlbSwgYXJyYXkpIHtcblx0ICByZXR1cm4gYXJyYXkuaW5kZXhPZihlbGVtKSAhPT0gLTE7XG5cdH1cblx0LyoqXG5cdCAqIE1ha2VzIGEgY2xvbmUgb2YgYW4gb2JqZWN0IHVzaW5nIG9ubHkgQXJyYXkgb3IgT2JqZWN0IGFzIGJhc2UsXG5cdCAqIGFuZCBjb3BpZXMgb3ZlciB0aGUgb3duIGVudW1lcmFibGUgcHJvcGVydGllcy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9ialxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IE5ldyBvYmplY3Qgd2l0aCBvbmx5IHRoZSBvd24gcHJvcGVydGllcyAocmVjdXJzaXZlbHkpLlxuXHQgKi9cblxuXHRmdW5jdGlvbiBvYmplY3RWYWx1ZXMob2JqKSB7XG5cdCAgdmFyIGtleSxcblx0ICAgICAgdmFsLFxuXHQgICAgICB2YWxzID0gaXMoXCJhcnJheVwiLCBvYmopID8gW10gOiB7fTtcblxuXHQgIGZvciAoa2V5IGluIG9iaikge1xuXHQgICAgaWYgKGhhc093bi5jYWxsKG9iaiwga2V5KSkge1xuXHQgICAgICB2YWwgPSBvYmpba2V5XTtcblx0ICAgICAgdmFsc1trZXldID0gdmFsID09PSBPYmplY3QodmFsKSA/IG9iamVjdFZhbHVlcyh2YWwpIDogdmFsO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiB2YWxzO1xuXHR9XG5cdGZ1bmN0aW9uIGV4dGVuZChhLCBiLCB1bmRlZk9ubHkpIHtcblx0ICBmb3IgKHZhciBwcm9wIGluIGIpIHtcblx0ICAgIGlmIChoYXNPd24uY2FsbChiLCBwcm9wKSkge1xuXHQgICAgICBpZiAoYltwcm9wXSA9PT0gdW5kZWZpbmVkKSB7XG5cdCAgICAgICAgZGVsZXRlIGFbcHJvcF07XG5cdCAgICAgIH0gZWxzZSBpZiAoISh1bmRlZk9ubHkgJiYgdHlwZW9mIGFbcHJvcF0gIT09IFwidW5kZWZpbmVkXCIpKSB7XG5cdCAgICAgICAgYVtwcm9wXSA9IGJbcHJvcF07XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gYTtcblx0fVxuXHRmdW5jdGlvbiBvYmplY3RUeXBlKG9iaikge1xuXHQgIGlmICh0eXBlb2Ygb2JqID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdCAgICByZXR1cm4gXCJ1bmRlZmluZWRcIjtcblx0ICB9IC8vIENvbnNpZGVyOiB0eXBlb2YgbnVsbCA9PT0gb2JqZWN0XG5cblxuXHQgIGlmIChvYmogPT09IG51bGwpIHtcblx0ICAgIHJldHVybiBcIm51bGxcIjtcblx0ICB9XG5cblx0ICB2YXIgbWF0Y2ggPSB0b1N0cmluZy5jYWxsKG9iaikubWF0Y2goL15cXFtvYmplY3RcXHMoLiopXFxdJC8pLFxuXHQgICAgICB0eXBlID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG5cblx0ICBzd2l0Y2ggKHR5cGUpIHtcblx0ICAgIGNhc2UgXCJOdW1iZXJcIjpcblx0ICAgICAgaWYgKGlzTmFOKG9iaikpIHtcblx0ICAgICAgICByZXR1cm4gXCJuYW5cIjtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBcIm51bWJlclwiO1xuXG5cdCAgICBjYXNlIFwiU3RyaW5nXCI6XG5cdCAgICBjYXNlIFwiQm9vbGVhblwiOlxuXHQgICAgY2FzZSBcIkFycmF5XCI6XG5cdCAgICBjYXNlIFwiU2V0XCI6XG5cdCAgICBjYXNlIFwiTWFwXCI6XG5cdCAgICBjYXNlIFwiRGF0ZVwiOlxuXHQgICAgY2FzZSBcIlJlZ0V4cFwiOlxuXHQgICAgY2FzZSBcIkZ1bmN0aW9uXCI6XG5cdCAgICBjYXNlIFwiU3ltYm9sXCI6XG5cdCAgICAgIHJldHVybiB0eXBlLnRvTG93ZXJDYXNlKCk7XG5cblx0ICAgIGRlZmF1bHQ6XG5cdCAgICAgIHJldHVybiBfdHlwZW9mKG9iaik7XG5cdCAgfVxuXHR9IC8vIFNhZmUgb2JqZWN0IHR5cGUgY2hlY2tpbmdcblxuXHRmdW5jdGlvbiBpcyh0eXBlLCBvYmopIHtcblx0ICByZXR1cm4gb2JqZWN0VHlwZShvYmopID09PSB0eXBlO1xuXHR9IC8vIEJhc2VkIG9uIEphdmEncyBTdHJpbmcuaGFzaENvZGUsIGEgc2ltcGxlIGJ1dCBub3Rcblx0Ly8gcmlnb3JvdXNseSBjb2xsaXNpb24gcmVzaXN0YW50IGhhc2hpbmcgZnVuY3Rpb25cblxuXHRmdW5jdGlvbiBnZW5lcmF0ZUhhc2gobW9kdWxlLCB0ZXN0TmFtZSkge1xuXHQgIHZhciBzdHIgPSBtb2R1bGUgKyBcIlxceDFDXCIgKyB0ZXN0TmFtZTtcblx0ICB2YXIgaGFzaCA9IDA7XG5cblx0ICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuXHQgICAgaGFzaCA9IChoYXNoIDw8IDUpIC0gaGFzaCArIHN0ci5jaGFyQ29kZUF0KGkpO1xuXHQgICAgaGFzaCB8PSAwO1xuXHQgIH0gLy8gQ29udmVydCB0aGUgcG9zc2libHkgbmVnYXRpdmUgaW50ZWdlciBoYXNoIGNvZGUgaW50byBhbiA4IGNoYXJhY3RlciBoZXggc3RyaW5nLCB3aGljaCBpc24ndFxuXHQgIC8vIHN0cmljdGx5IG5lY2Vzc2FyeSBidXQgaW5jcmVhc2VzIHVzZXIgdW5kZXJzdGFuZGluZyB0aGF0IHRoZSBpZCBpcyBhIFNIQS1saWtlIGhhc2hcblxuXG5cdCAgdmFyIGhleCA9ICgweDEwMDAwMDAwMCArIGhhc2gpLnRvU3RyaW5nKDE2KTtcblxuXHQgIGlmIChoZXgubGVuZ3RoIDwgOCkge1xuXHQgICAgaGV4ID0gXCIwMDAwMDAwXCIgKyBoZXg7XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGhleC5zbGljZSgtOCk7XG5cdH1cblxuXHQvLyBBdXRob3JzOiBQaGlsaXBwZSBSYXRow6kgPHByYXRoZUBnbWFpbC5jb20+LCBEYXZpZCBDaGFuIDxkYXZpZEB0cm9pLm9yZz5cblxuXHR2YXIgZXF1aXYgPSAoZnVuY3Rpb24gKCkge1xuXHQgIC8vIFZhbHVlIHBhaXJzIHF1ZXVlZCBmb3IgY29tcGFyaXNvbi4gVXNlZCBmb3IgYnJlYWR0aC1maXJzdCBwcm9jZXNzaW5nIG9yZGVyLCByZWN1cnNpb25cblx0ICAvLyBkZXRlY3Rpb24gYW5kIGF2b2lkaW5nIHJlcGVhdGVkIGNvbXBhcmlzb24gKHNlZSBiZWxvdyBmb3IgZGV0YWlscykuXG5cdCAgLy8gRWxlbWVudHMgYXJlIHsgYTogdmFsLCBiOiB2YWwgfS5cblx0ICB2YXIgcGFpcnMgPSBbXTtcblxuXHQgIHZhciBnZXRQcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZiB8fCBmdW5jdGlvbiAob2JqKSB7XG5cdCAgICByZXR1cm4gb2JqLl9fcHJvdG9fXztcblx0ICB9O1xuXG5cdCAgZnVuY3Rpb24gdXNlU3RyaWN0RXF1YWxpdHkoYSwgYikge1xuXHQgICAgLy8gVGhpcyBvbmx5IGdldHMgY2FsbGVkIGlmIGEgYW5kIGIgYXJlIG5vdCBzdHJpY3QgZXF1YWwsIGFuZCBpcyB1c2VkIHRvIGNvbXBhcmUgb25cblx0ICAgIC8vIHRoZSBwcmltaXRpdmUgdmFsdWVzIGluc2lkZSBvYmplY3Qgd3JhcHBlcnMuIEZvciBleGFtcGxlOlxuXHQgICAgLy8gYHZhciBpID0gMTtgXG5cdCAgICAvLyBgdmFyIGogPSBuZXcgTnVtYmVyKDEpO2Bcblx0ICAgIC8vIE5laXRoZXIgYSBub3IgYiBjYW4gYmUgbnVsbCwgYXMgYSAhPT0gYiBhbmQgdGhleSBoYXZlIHRoZSBzYW1lIHR5cGUuXG5cdCAgICBpZiAoX3R5cGVvZihhKSA9PT0gXCJvYmplY3RcIikge1xuXHQgICAgICBhID0gYS52YWx1ZU9mKCk7XG5cdCAgICB9XG5cblx0ICAgIGlmIChfdHlwZW9mKGIpID09PSBcIm9iamVjdFwiKSB7XG5cdCAgICAgIGIgPSBiLnZhbHVlT2YoKTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGEgPT09IGI7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gY29tcGFyZUNvbnN0cnVjdG9ycyhhLCBiKSB7XG5cdCAgICB2YXIgcHJvdG9BID0gZ2V0UHJvdG8oYSk7XG5cdCAgICB2YXIgcHJvdG9CID0gZ2V0UHJvdG8oYik7IC8vIENvbXBhcmluZyBjb25zdHJ1Y3RvcnMgaXMgbW9yZSBzdHJpY3QgdGhhbiB1c2luZyBgaW5zdGFuY2VvZmBcblxuXHQgICAgaWYgKGEuY29uc3RydWN0b3IgPT09IGIuY29uc3RydWN0b3IpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9IC8vIFJlZiAjODUxXG5cdCAgICAvLyBJZiB0aGUgb2JqIHByb3RvdHlwZSBkZXNjZW5kcyBmcm9tIGEgbnVsbCBjb25zdHJ1Y3RvciwgdHJlYXQgaXRcblx0ICAgIC8vIGFzIGEgbnVsbCBwcm90b3R5cGUuXG5cblxuXHQgICAgaWYgKHByb3RvQSAmJiBwcm90b0EuY29uc3RydWN0b3IgPT09IG51bGwpIHtcblx0ICAgICAgcHJvdG9BID0gbnVsbDtcblx0ICAgIH1cblxuXHQgICAgaWYgKHByb3RvQiAmJiBwcm90b0IuY29uc3RydWN0b3IgPT09IG51bGwpIHtcblx0ICAgICAgcHJvdG9CID0gbnVsbDtcblx0ICAgIH0gLy8gQWxsb3cgb2JqZWN0cyB3aXRoIG5vIHByb3RvdHlwZSB0byBiZSBlcXVpdmFsZW50IHRvXG5cdCAgICAvLyBvYmplY3RzIHdpdGggT2JqZWN0IGFzIHRoZWlyIGNvbnN0cnVjdG9yLlxuXG5cblx0ICAgIGlmIChwcm90b0EgPT09IG51bGwgJiYgcHJvdG9CID09PSBPYmplY3QucHJvdG90eXBlIHx8IHByb3RvQiA9PT0gbnVsbCAmJiBwcm90b0EgPT09IE9iamVjdC5wcm90b3R5cGUpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBmYWxzZTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBnZXRSZWdFeHBGbGFncyhyZWdleHApIHtcblx0ICAgIHJldHVybiBcImZsYWdzXCIgaW4gcmVnZXhwID8gcmVnZXhwLmZsYWdzIDogcmVnZXhwLnRvU3RyaW5nKCkubWF0Y2goL1tnaW11eV0qJC8pWzBdO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGlzQ29udGFpbmVyKHZhbCkge1xuXHQgICAgcmV0dXJuIFtcIm9iamVjdFwiLCBcImFycmF5XCIsIFwibWFwXCIsIFwic2V0XCJdLmluZGV4T2Yob2JqZWN0VHlwZSh2YWwpKSAhPT0gLTE7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYnJlYWR0aEZpcnN0Q29tcGFyZUNoaWxkKGEsIGIpIHtcblx0ICAgIC8vIElmIGEgaXMgYSBjb250YWluZXIgbm90IHJlZmVyZW5jZS1lcXVhbCB0byBiLCBwb3N0cG9uZSB0aGUgY29tcGFyaXNvbiB0byB0aGVcblx0ICAgIC8vIGVuZCBvZiB0aGUgcGFpcnMgcXVldWUgLS0gdW5sZXNzIChhLCBiKSBoYXMgYmVlbiBzZWVuIGJlZm9yZSwgaW4gd2hpY2ggY2FzZSBza2lwXG5cdCAgICAvLyBvdmVyIHRoZSBwYWlyLlxuXHQgICAgaWYgKGEgPT09IGIpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9XG5cblx0ICAgIGlmICghaXNDb250YWluZXIoYSkpIHtcblx0ICAgICAgcmV0dXJuIHR5cGVFcXVpdihhLCBiKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKHBhaXJzLmV2ZXJ5KGZ1bmN0aW9uIChwYWlyKSB7XG5cdCAgICAgIHJldHVybiBwYWlyLmEgIT09IGEgfHwgcGFpci5iICE9PSBiO1xuXHQgICAgfSkpIHtcblx0ICAgICAgLy8gTm90IHlldCBzdGFydGVkIGNvbXBhcmluZyB0aGlzIHBhaXJcblx0ICAgICAgcGFpcnMucHVzaCh7XG5cdCAgICAgICAgYTogYSxcblx0ICAgICAgICBiOiBiXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gdHJ1ZTtcblx0ICB9XG5cblx0ICB2YXIgY2FsbGJhY2tzID0ge1xuXHQgICAgXCJzdHJpbmdcIjogdXNlU3RyaWN0RXF1YWxpdHksXG5cdCAgICBcImJvb2xlYW5cIjogdXNlU3RyaWN0RXF1YWxpdHksXG5cdCAgICBcIm51bWJlclwiOiB1c2VTdHJpY3RFcXVhbGl0eSxcblx0ICAgIFwibnVsbFwiOiB1c2VTdHJpY3RFcXVhbGl0eSxcblx0ICAgIFwidW5kZWZpbmVkXCI6IHVzZVN0cmljdEVxdWFsaXR5LFxuXHQgICAgXCJzeW1ib2xcIjogdXNlU3RyaWN0RXF1YWxpdHksXG5cdCAgICBcImRhdGVcIjogdXNlU3RyaWN0RXF1YWxpdHksXG5cdCAgICBcIm5hblwiOiBmdW5jdGlvbiBuYW4oKSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfSxcblx0ICAgIFwicmVnZXhwXCI6IGZ1bmN0aW9uIHJlZ2V4cChhLCBiKSB7XG5cdCAgICAgIHJldHVybiBhLnNvdXJjZSA9PT0gYi5zb3VyY2UgJiYgLy8gSW5jbHVkZSBmbGFncyBpbiB0aGUgY29tcGFyaXNvblxuXHQgICAgICBnZXRSZWdFeHBGbGFncyhhKSA9PT0gZ2V0UmVnRXhwRmxhZ3MoYik7XG5cdCAgICB9LFxuXHQgICAgLy8gYWJvcnQgKGlkZW50aWNhbCByZWZlcmVuY2VzIC8gaW5zdGFuY2UgbWV0aG9kcyB3ZXJlIHNraXBwZWQgZWFybGllcilcblx0ICAgIFwiZnVuY3Rpb25cIjogZnVuY3Rpb24gX2Z1bmN0aW9uKCkge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9LFxuXHQgICAgXCJhcnJheVwiOiBmdW5jdGlvbiBhcnJheShhLCBiKSB7XG5cdCAgICAgIHZhciBpLCBsZW47XG5cdCAgICAgIGxlbiA9IGEubGVuZ3RoO1xuXG5cdCAgICAgIGlmIChsZW4gIT09IGIubGVuZ3RoKSB7XG5cdCAgICAgICAgLy8gU2FmZSBhbmQgZmFzdGVyXG5cdCAgICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgICB9XG5cblx0ICAgICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG5cdCAgICAgICAgLy8gQ29tcGFyZSBub24tY29udGFpbmVyczsgcXVldWUgbm9uLXJlZmVyZW5jZS1lcXVhbCBjb250YWluZXJzXG5cdCAgICAgICAgaWYgKCFicmVhZHRoRmlyc3RDb21wYXJlQ2hpbGQoYVtpXSwgYltpXSkpIHtcblx0ICAgICAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH0sXG5cdCAgICAvLyBEZWZpbmUgc2V0cyBhIGFuZCBiIHRvIGJlIGVxdWl2YWxlbnQgaWYgZm9yIGVhY2ggZWxlbWVudCBhVmFsIGluIGEsIHRoZXJlXG5cdCAgICAvLyBpcyBzb21lIGVsZW1lbnQgYlZhbCBpbiBiIHN1Y2ggdGhhdCBhVmFsIGFuZCBiVmFsIGFyZSBlcXVpdmFsZW50LiBFbGVtZW50XG5cdCAgICAvLyByZXBldGl0aW9ucyBhcmUgbm90IGNvdW50ZWQsIHNvIHRoZXNlIGFyZSBlcXVpdmFsZW50OlxuXHQgICAgLy8gYSA9IG5ldyBTZXQoIFsge30sIFtdLCBbXSBdICk7XG5cdCAgICAvLyBiID0gbmV3IFNldCggWyB7fSwge30sIFtdIF0gKTtcblx0ICAgIFwic2V0XCI6IGZ1bmN0aW9uIHNldChhLCBiKSB7XG5cdCAgICAgIHZhciBpbm5lckVxLFxuXHQgICAgICAgICAgb3V0ZXJFcSA9IHRydWU7XG5cblx0ICAgICAgaWYgKGEuc2l6ZSAhPT0gYi5zaXplKSB7XG5cdCAgICAgICAgLy8gVGhpcyBvcHRpbWl6YXRpb24gaGFzIGNlcnRhaW4gcXVpcmtzIGJlY2F1c2Ugb2YgdGhlIGxhY2sgb2Zcblx0ICAgICAgICAvLyByZXBldGl0aW9uIGNvdW50aW5nLiBGb3IgaW5zdGFuY2UsIGFkZGluZyB0aGUgc2FtZVxuXHQgICAgICAgIC8vIChyZWZlcmVuY2UtaWRlbnRpY2FsKSBlbGVtZW50IHRvIHR3byBlcXVpdmFsZW50IHNldHMgY2FuXG5cdCAgICAgICAgLy8gbWFrZSB0aGVtIG5vbi1lcXVpdmFsZW50LlxuXHQgICAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGEuZm9yRWFjaChmdW5jdGlvbiAoYVZhbCkge1xuXHQgICAgICAgIC8vIFNob3J0LWNpcmN1aXQgaWYgdGhlIHJlc3VsdCBpcyBhbHJlYWR5IGtub3duLiAoVXNpbmcgZm9yLi4ub2Zcblx0ICAgICAgICAvLyB3aXRoIGEgYnJlYWsgY2xhdXNlIHdvdWxkIGJlIGNsZWFuZXIgaGVyZSwgYnV0IGl0IHdvdWxkIGNhdXNlXG5cdCAgICAgICAgLy8gYSBzeW50YXggZXJyb3Igb24gb2xkZXIgSmF2YXNjcmlwdCBpbXBsZW1lbnRhdGlvbnMgZXZlbiBpZlxuXHQgICAgICAgIC8vIFNldCBpcyB1bnVzZWQpXG5cdCAgICAgICAgaWYgKCFvdXRlckVxKSB7XG5cdCAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaW5uZXJFcSA9IGZhbHNlO1xuXHQgICAgICAgIGIuZm9yRWFjaChmdW5jdGlvbiAoYlZhbCkge1xuXHQgICAgICAgICAgdmFyIHBhcmVudFBhaXJzOyAvLyBMaWtld2lzZSwgc2hvcnQtY2lyY3VpdCBpZiB0aGUgcmVzdWx0IGlzIGFscmVhZHkga25vd25cblxuXHQgICAgICAgICAgaWYgKGlubmVyRXEpIHtcblx0ICAgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgICAgfSAvLyBTd2FwIG91dCB0aGUgZ2xvYmFsIHBhaXJzIGxpc3QsIGFzIHRoZSBuZXN0ZWQgY2FsbCB0b1xuXHQgICAgICAgICAgLy8gaW5uZXJFcXVpdiB3aWxsIGNsb2JiZXIgaXRzIGNvbnRlbnRzXG5cblxuXHQgICAgICAgICAgcGFyZW50UGFpcnMgPSBwYWlycztcblxuXHQgICAgICAgICAgaWYgKGlubmVyRXF1aXYoYlZhbCwgYVZhbCkpIHtcblx0ICAgICAgICAgICAgaW5uZXJFcSA9IHRydWU7XG5cdCAgICAgICAgICB9IC8vIFJlcGxhY2UgdGhlIGdsb2JhbCBwYWlycyBsaXN0XG5cblxuXHQgICAgICAgICAgcGFpcnMgPSBwYXJlbnRQYWlycztcblx0ICAgICAgICB9KTtcblxuXHQgICAgICAgIGlmICghaW5uZXJFcSkge1xuXHQgICAgICAgICAgb3V0ZXJFcSA9IGZhbHNlO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cdCAgICAgIHJldHVybiBvdXRlckVxO1xuXHQgICAgfSxcblx0ICAgIC8vIERlZmluZSBtYXBzIGEgYW5kIGIgdG8gYmUgZXF1aXZhbGVudCBpZiBmb3IgZWFjaCBrZXktdmFsdWUgcGFpciAoYUtleSwgYVZhbClcblx0ICAgIC8vIGluIGEsIHRoZXJlIGlzIHNvbWUga2V5LXZhbHVlIHBhaXIgKGJLZXksIGJWYWwpIGluIGIgc3VjaCB0aGF0XG5cdCAgICAvLyBbIGFLZXksIGFWYWwgXSBhbmQgWyBiS2V5LCBiVmFsIF0gYXJlIGVxdWl2YWxlbnQuIEtleSByZXBldGl0aW9ucyBhcmUgbm90XG5cdCAgICAvLyBjb3VudGVkLCBzbyB0aGVzZSBhcmUgZXF1aXZhbGVudDpcblx0ICAgIC8vIGEgPSBuZXcgTWFwKCBbIFsge30sIDEgXSwgWyB7fSwgMSBdLCBbIFtdLCAxIF0gXSApO1xuXHQgICAgLy8gYiA9IG5ldyBNYXAoIFsgWyB7fSwgMSBdLCBbIFtdLCAxIF0sIFsgW10sIDEgXSBdICk7XG5cdCAgICBcIm1hcFwiOiBmdW5jdGlvbiBtYXAoYSwgYikge1xuXHQgICAgICB2YXIgaW5uZXJFcSxcblx0ICAgICAgICAgIG91dGVyRXEgPSB0cnVlO1xuXG5cdCAgICAgIGlmIChhLnNpemUgIT09IGIuc2l6ZSkge1xuXHQgICAgICAgIC8vIFRoaXMgb3B0aW1pemF0aW9uIGhhcyBjZXJ0YWluIHF1aXJrcyBiZWNhdXNlIG9mIHRoZSBsYWNrIG9mXG5cdCAgICAgICAgLy8gcmVwZXRpdGlvbiBjb3VudGluZy4gRm9yIGluc3RhbmNlLCBhZGRpbmcgdGhlIHNhbWVcblx0ICAgICAgICAvLyAocmVmZXJlbmNlLWlkZW50aWNhbCkga2V5LXZhbHVlIHBhaXIgdG8gdHdvIGVxdWl2YWxlbnQgbWFwc1xuXHQgICAgICAgIC8vIGNhbiBtYWtlIHRoZW0gbm9uLWVxdWl2YWxlbnQuXG5cdCAgICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgICB9XG5cblx0ICAgICAgYS5mb3JFYWNoKGZ1bmN0aW9uIChhVmFsLCBhS2V5KSB7XG5cdCAgICAgICAgLy8gU2hvcnQtY2lyY3VpdCBpZiB0aGUgcmVzdWx0IGlzIGFscmVhZHkga25vd24uIChVc2luZyBmb3IuLi5vZlxuXHQgICAgICAgIC8vIHdpdGggYSBicmVhayBjbGF1c2Ugd291bGQgYmUgY2xlYW5lciBoZXJlLCBidXQgaXQgd291bGQgY2F1c2Vcblx0ICAgICAgICAvLyBhIHN5bnRheCBlcnJvciBvbiBvbGRlciBKYXZhc2NyaXB0IGltcGxlbWVudGF0aW9ucyBldmVuIGlmXG5cdCAgICAgICAgLy8gTWFwIGlzIHVudXNlZClcblx0ICAgICAgICBpZiAoIW91dGVyRXEpIHtcblx0ICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBpbm5lckVxID0gZmFsc2U7XG5cdCAgICAgICAgYi5mb3JFYWNoKGZ1bmN0aW9uIChiVmFsLCBiS2V5KSB7XG5cdCAgICAgICAgICB2YXIgcGFyZW50UGFpcnM7IC8vIExpa2V3aXNlLCBzaG9ydC1jaXJjdWl0IGlmIHRoZSByZXN1bHQgaXMgYWxyZWFkeSBrbm93blxuXG5cdCAgICAgICAgICBpZiAoaW5uZXJFcSkge1xuXHQgICAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgICB9IC8vIFN3YXAgb3V0IHRoZSBnbG9iYWwgcGFpcnMgbGlzdCwgYXMgdGhlIG5lc3RlZCBjYWxsIHRvXG5cdCAgICAgICAgICAvLyBpbm5lckVxdWl2IHdpbGwgY2xvYmJlciBpdHMgY29udGVudHNcblxuXG5cdCAgICAgICAgICBwYXJlbnRQYWlycyA9IHBhaXJzO1xuXG5cdCAgICAgICAgICBpZiAoaW5uZXJFcXVpdihbYlZhbCwgYktleV0sIFthVmFsLCBhS2V5XSkpIHtcblx0ICAgICAgICAgICAgaW5uZXJFcSA9IHRydWU7XG5cdCAgICAgICAgICB9IC8vIFJlcGxhY2UgdGhlIGdsb2JhbCBwYWlycyBsaXN0XG5cblxuXHQgICAgICAgICAgcGFpcnMgPSBwYXJlbnRQYWlycztcblx0ICAgICAgICB9KTtcblxuXHQgICAgICAgIGlmICghaW5uZXJFcSkge1xuXHQgICAgICAgICAgb3V0ZXJFcSA9IGZhbHNlO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cdCAgICAgIHJldHVybiBvdXRlckVxO1xuXHQgICAgfSxcblx0ICAgIFwib2JqZWN0XCI6IGZ1bmN0aW9uIG9iamVjdChhLCBiKSB7XG5cdCAgICAgIHZhciBpLFxuXHQgICAgICAgICAgYVByb3BlcnRpZXMgPSBbXSxcblx0ICAgICAgICAgIGJQcm9wZXJ0aWVzID0gW107XG5cblx0ICAgICAgaWYgKGNvbXBhcmVDb25zdHJ1Y3RvcnMoYSwgYikgPT09IGZhbHNlKSB7XG5cdCAgICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgICB9IC8vIEJlIHN0cmljdDogZG9uJ3QgZW5zdXJlIGhhc093blByb3BlcnR5IGFuZCBnbyBkZWVwXG5cblxuXHQgICAgICBmb3IgKGkgaW4gYSkge1xuXHQgICAgICAgIC8vIENvbGxlY3QgYSdzIHByb3BlcnRpZXNcblx0ICAgICAgICBhUHJvcGVydGllcy5wdXNoKGkpOyAvLyBTa2lwIE9PUCBtZXRob2RzIHRoYXQgbG9vayB0aGUgc2FtZVxuXG5cdCAgICAgICAgaWYgKGEuY29uc3RydWN0b3IgIT09IE9iamVjdCAmJiB0eXBlb2YgYS5jb25zdHJ1Y3RvciAhPT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2YgYVtpXSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBiW2ldID09PSBcImZ1bmN0aW9uXCIgJiYgYVtpXS50b1N0cmluZygpID09PSBiW2ldLnRvU3RyaW5nKCkpIHtcblx0ICAgICAgICAgIGNvbnRpbnVlO1xuXHQgICAgICAgIH0gLy8gQ29tcGFyZSBub24tY29udGFpbmVyczsgcXVldWUgbm9uLXJlZmVyZW5jZS1lcXVhbCBjb250YWluZXJzXG5cblxuXHQgICAgICAgIGlmICghYnJlYWR0aEZpcnN0Q29tcGFyZUNoaWxkKGFbaV0sIGJbaV0pKSB7XG5cdCAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgZm9yIChpIGluIGIpIHtcblx0ICAgICAgICAvLyBDb2xsZWN0IGIncyBwcm9wZXJ0aWVzXG5cdCAgICAgICAgYlByb3BlcnRpZXMucHVzaChpKTtcblx0ICAgICAgfSAvLyBFbnN1cmVzIGlkZW50aWNhbCBwcm9wZXJ0aWVzIG5hbWVcblxuXG5cdCAgICAgIHJldHVybiB0eXBlRXF1aXYoYVByb3BlcnRpZXMuc29ydCgpLCBiUHJvcGVydGllcy5zb3J0KCkpO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICBmdW5jdGlvbiB0eXBlRXF1aXYoYSwgYikge1xuXHQgICAgdmFyIHR5cGUgPSBvYmplY3RUeXBlKGEpOyAvLyBDYWxsYmFja3MgZm9yIGNvbnRhaW5lcnMgd2lsbCBhcHBlbmQgdG8gdGhlIHBhaXJzIHF1ZXVlIHRvIGFjaGlldmUgYnJlYWR0aC1maXJzdFxuXHQgICAgLy8gc2VhcmNoIG9yZGVyLiBUaGUgcGFpcnMgcXVldWUgaXMgYWxzbyB1c2VkIHRvIGF2b2lkIHJlcHJvY2Vzc2luZyBhbnkgcGFpciBvZlxuXHQgICAgLy8gY29udGFpbmVycyB0aGF0IGFyZSByZWZlcmVuY2UtZXF1YWwgdG8gYSBwcmV2aW91c2x5IHZpc2l0ZWQgcGFpciAoYSBzcGVjaWFsIGNhc2Vcblx0ICAgIC8vIHRoaXMgYmVpbmcgcmVjdXJzaW9uIGRldGVjdGlvbikuXG5cdCAgICAvL1xuXHQgICAgLy8gQmVjYXVzZSBvZiB0aGlzIGFwcHJvYWNoLCBvbmNlIHR5cGVFcXVpdiByZXR1cm5zIGEgZmFsc2UgdmFsdWUsIGl0IHNob3VsZCBub3QgYmVcblx0ICAgIC8vIGNhbGxlZCBhZ2FpbiB3aXRob3V0IGNsZWFyaW5nIHRoZSBwYWlyIHF1ZXVlIGVsc2UgaXQgbWF5IHdyb25nbHkgcmVwb3J0IGEgdmlzaXRlZFxuXHQgICAgLy8gcGFpciBhcyBiZWluZyBlcXVpdmFsZW50LlxuXG5cdCAgICByZXR1cm4gb2JqZWN0VHlwZShiKSA9PT0gdHlwZSAmJiBjYWxsYmFja3NbdHlwZV0oYSwgYik7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gaW5uZXJFcXVpdihhLCBiKSB7XG5cdCAgICB2YXIgaSwgcGFpcjsgLy8gV2UncmUgZG9uZSB3aGVuIHRoZXJlJ3Mgbm90aGluZyBtb3JlIHRvIGNvbXBhcmVcblxuXHQgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfSAvLyBDbGVhciB0aGUgZ2xvYmFsIHBhaXIgcXVldWUgYW5kIGFkZCB0aGUgdG9wLWxldmVsIHZhbHVlcyBiZWluZyBjb21wYXJlZFxuXG5cblx0ICAgIHBhaXJzID0gW3tcblx0ICAgICAgYTogYSxcblx0ICAgICAgYjogYlxuXHQgICAgfV07XG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCBwYWlycy5sZW5ndGg7IGkrKykge1xuXHQgICAgICBwYWlyID0gcGFpcnNbaV07IC8vIFBlcmZvcm0gdHlwZS1zcGVjaWZpYyBjb21wYXJpc29uIG9uIGFueSBwYWlycyB0aGF0IGFyZSBub3Qgc3RyaWN0bHlcblx0ICAgICAgLy8gZXF1YWwuIEZvciBjb250YWluZXIgdHlwZXMsIHRoYXQgY29tcGFyaXNvbiB3aWxsIHBvc3Rwb25lIGNvbXBhcmlzb25cblx0ICAgICAgLy8gb2YgYW55IHN1Yi1jb250YWluZXIgcGFpciB0byB0aGUgZW5kIG9mIHRoZSBwYWlyIHF1ZXVlLiBUaGlzIGdpdmVzXG5cdCAgICAgIC8vIGJyZWFkdGgtZmlyc3Qgc2VhcmNoIG9yZGVyLiBJdCBhbHNvIGF2b2lkcyB0aGUgcmVwcm9jZXNzaW5nIG9mXG5cdCAgICAgIC8vIHJlZmVyZW5jZS1lcXVhbCBzaWJsaW5ncywgY291c2lucyBldGMsIHdoaWNoIGNhbiBoYXZlIGEgc2lnbmlmaWNhbnQgc3BlZWRcblx0ICAgICAgLy8gaW1wYWN0IHdoZW4gY29tcGFyaW5nIGEgY29udGFpbmVyIG9mIHNtYWxsIG9iamVjdHMgZWFjaCBvZiB3aGljaCBoYXMgYVxuXHQgICAgICAvLyByZWZlcmVuY2UgdG8gdGhlIHNhbWUgKHNpbmdsZXRvbikgbGFyZ2Ugb2JqZWN0LlxuXG5cdCAgICAgIGlmIChwYWlyLmEgIT09IHBhaXIuYiAmJiAhdHlwZUVxdWl2KHBhaXIuYSwgcGFpci5iKSkge1xuXHQgICAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgICAgfVxuXHQgICAgfSAvLyAuLi5hY3Jvc3MgYWxsIGNvbnNlY3V0aXZlIGFyZ3VtZW50IHBhaXJzXG5cblxuXHQgICAgcmV0dXJuIGFyZ3VtZW50cy5sZW5ndGggPT09IDIgfHwgaW5uZXJFcXVpdi5hcHBseSh0aGlzLCBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuXHQgIH1cblxuXHQgIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdCAgICB2YXIgcmVzdWx0ID0gaW5uZXJFcXVpdi5hcHBseSh2b2lkIDAsIGFyZ3VtZW50cyk7IC8vIFJlbGVhc2UgYW55IHJldGFpbmVkIG9iamVjdHNcblxuXHQgICAgcGFpcnMubGVuZ3RoID0gMDtcblx0ICAgIHJldHVybiByZXN1bHQ7XG5cdCAgfTtcblx0fSkoKTtcblxuXHQvKipcblx0ICogQ29uZmlnIG9iamVjdDogTWFpbnRhaW4gaW50ZXJuYWwgc3RhdGVcblx0ICogTGF0ZXIgZXhwb3NlZCBhcyBRVW5pdC5jb25maWdcblx0ICogYGNvbmZpZ2AgaW5pdGlhbGl6ZWQgYXQgdG9wIG9mIHNjb3BlXG5cdCAqL1xuXG5cdHZhciBjb25maWcgPSB7XG5cdCAgLy8gVGhlIHF1ZXVlIG9mIHRlc3RzIHRvIHJ1blxuXHQgIHF1ZXVlOiBbXSxcblx0ICAvLyBCbG9jayB1bnRpbCBkb2N1bWVudCByZWFkeVxuXHQgIGJsb2NraW5nOiB0cnVlLFxuXHQgIC8vIEJ5IGRlZmF1bHQsIHJ1biBwcmV2aW91c2x5IGZhaWxlZCB0ZXN0cyBmaXJzdFxuXHQgIC8vIHZlcnkgdXNlZnVsIGluIGNvbWJpbmF0aW9uIHdpdGggXCJIaWRlIHBhc3NlZCB0ZXN0c1wiIGNoZWNrZWRcblx0ICByZW9yZGVyOiB0cnVlLFxuXHQgIC8vIEJ5IGRlZmF1bHQsIG1vZGlmeSBkb2N1bWVudC50aXRsZSB3aGVuIHN1aXRlIGlzIGRvbmVcblx0ICBhbHRlcnRpdGxlOiB0cnVlLFxuXHQgIC8vIEhUTUwgUmVwb3J0ZXI6IGNvbGxhcHNlIGV2ZXJ5IHRlc3QgZXhjZXB0IHRoZSBmaXJzdCBmYWlsaW5nIHRlc3Rcblx0ICAvLyBJZiBmYWxzZSwgYWxsIGZhaWxpbmcgdGVzdHMgd2lsbCBiZSBleHBhbmRlZFxuXHQgIGNvbGxhcHNlOiB0cnVlLFxuXHQgIC8vIEJ5IGRlZmF1bHQsIHNjcm9sbCB0byB0b3Agb2YgdGhlIHBhZ2Ugd2hlbiBzdWl0ZSBpcyBkb25lXG5cdCAgc2Nyb2xsdG9wOiB0cnVlLFxuXHQgIC8vIERlcHRoIHVwLXRvIHdoaWNoIG9iamVjdCB3aWxsIGJlIGR1bXBlZFxuXHQgIG1heERlcHRoOiA1LFxuXHQgIC8vIFdoZW4gZW5hYmxlZCwgYWxsIHRlc3RzIG11c3QgY2FsbCBleHBlY3QoKVxuXHQgIHJlcXVpcmVFeHBlY3RzOiBmYWxzZSxcblx0ICAvLyBQbGFjZWhvbGRlciBmb3IgdXNlci1jb25maWd1cmFibGUgZm9ybS1leHBvc2VkIFVSTCBwYXJhbWV0ZXJzXG5cdCAgdXJsQ29uZmlnOiBbXSxcblx0ICAvLyBTZXQgb2YgYWxsIG1vZHVsZXMuXG5cdCAgbW9kdWxlczogW10sXG5cdCAgLy8gVGhlIGZpcnN0IHVubmFtZWQgbW9kdWxlXG5cdCAgY3VycmVudE1vZHVsZToge1xuXHQgICAgbmFtZTogXCJcIixcblx0ICAgIHRlc3RzOiBbXSxcblx0ICAgIGNoaWxkTW9kdWxlczogW10sXG5cdCAgICB0ZXN0c1J1bjogMCxcblx0ICAgIHVuc2tpcHBlZFRlc3RzUnVuOiAwLFxuXHQgICAgaG9va3M6IHtcblx0ICAgICAgYmVmb3JlOiBbXSxcblx0ICAgICAgYmVmb3JlRWFjaDogW10sXG5cdCAgICAgIGFmdGVyRWFjaDogW10sXG5cdCAgICAgIGFmdGVyOiBbXVxuXHQgICAgfVxuXHQgIH0sXG5cdCAgY2FsbGJhY2tzOiB7fSxcblx0ICAvLyBUaGUgc3RvcmFnZSBtb2R1bGUgdG8gdXNlIGZvciByZW9yZGVyaW5nIHRlc3RzXG5cdCAgc3RvcmFnZTogbG9jYWxTZXNzaW9uU3RvcmFnZVxuXHR9OyAvLyB0YWtlIGEgcHJlZGVmaW5lZCBRVW5pdC5jb25maWcgYW5kIGV4dGVuZCB0aGUgZGVmYXVsdHNcblxuXHR2YXIgZ2xvYmFsQ29uZmlnID0gd2luZG93JDEgJiYgd2luZG93JDEuUVVuaXQgJiYgd2luZG93JDEuUVVuaXQuY29uZmlnOyAvLyBvbmx5IGV4dGVuZCB0aGUgZ2xvYmFsIGNvbmZpZyBpZiB0aGVyZSBpcyBubyBRVW5pdCBvdmVybG9hZFxuXG5cdGlmICh3aW5kb3ckMSAmJiB3aW5kb3ckMS5RVW5pdCAmJiAhd2luZG93JDEuUVVuaXQudmVyc2lvbikge1xuXHQgIGV4dGVuZChjb25maWcsIGdsb2JhbENvbmZpZyk7XG5cdH0gLy8gUHVzaCBhIGxvb3NlIHVubmFtZWQgbW9kdWxlIHRvIHRoZSBtb2R1bGVzIGNvbGxlY3Rpb25cblxuXG5cdGNvbmZpZy5tb2R1bGVzLnB1c2goY29uZmlnLmN1cnJlbnRNb2R1bGUpO1xuXG5cdC8vIGh0dHBzOi8vZmxlc2xlci5ibG9nc3BvdC5jb20vMjAwOC8wNS9qc2R1bXAtcHJldHR5LWR1bXAtb2YtYW55LWphdmFzY3JpcHQuaHRtbFxuXG5cdHZhciBkdW1wID0gKGZ1bmN0aW9uICgpIHtcblx0ICBmdW5jdGlvbiBxdW90ZShzdHIpIHtcblx0ICAgIHJldHVybiBcIlxcXCJcIiArIHN0ci50b1N0cmluZygpLnJlcGxhY2UoL1xcXFwvZywgXCJcXFxcXFxcXFwiKS5yZXBsYWNlKC9cIi9nLCBcIlxcXFxcXFwiXCIpICsgXCJcXFwiXCI7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gbGl0ZXJhbChvKSB7XG5cdCAgICByZXR1cm4gbyArIFwiXCI7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gam9pbihwcmUsIGFyciwgcG9zdCkge1xuXHQgICAgdmFyIHMgPSBkdW1wLnNlcGFyYXRvcigpLFxuXHQgICAgICAgIGJhc2UgPSBkdW1wLmluZGVudCgpLFxuXHQgICAgICAgIGlubmVyID0gZHVtcC5pbmRlbnQoMSk7XG5cblx0ICAgIGlmIChhcnIuam9pbikge1xuXHQgICAgICBhcnIgPSBhcnIuam9pbihcIixcIiArIHMgKyBpbm5lcik7XG5cdCAgICB9XG5cblx0ICAgIGlmICghYXJyKSB7XG5cdCAgICAgIHJldHVybiBwcmUgKyBwb3N0O1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gW3ByZSwgaW5uZXIgKyBhcnIsIGJhc2UgKyBwb3N0XS5qb2luKHMpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFycmF5KGFyciwgc3RhY2spIHtcblx0ICAgIHZhciBpID0gYXJyLmxlbmd0aCxcblx0ICAgICAgICByZXQgPSBuZXcgQXJyYXkoaSk7XG5cblx0ICAgIGlmIChkdW1wLm1heERlcHRoICYmIGR1bXAuZGVwdGggPiBkdW1wLm1heERlcHRoKSB7XG5cdCAgICAgIHJldHVybiBcIltvYmplY3QgQXJyYXldXCI7XG5cdCAgICB9XG5cblx0ICAgIHRoaXMudXAoKTtcblxuXHQgICAgd2hpbGUgKGktLSkge1xuXHQgICAgICByZXRbaV0gPSB0aGlzLnBhcnNlKGFycltpXSwgdW5kZWZpbmVkLCBzdGFjayk7XG5cdCAgICB9XG5cblx0ICAgIHRoaXMuZG93bigpO1xuXHQgICAgcmV0dXJuIGpvaW4oXCJbXCIsIHJldCwgXCJdXCIpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGlzQXJyYXkob2JqKSB7XG5cdCAgICByZXR1cm4gKC8vTmF0aXZlIEFycmF5c1xuXHQgICAgICB0b1N0cmluZy5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIiB8fCAvLyBOb2RlTGlzdCBvYmplY3RzXG5cdCAgICAgIHR5cGVvZiBvYmoubGVuZ3RoID09PSBcIm51bWJlclwiICYmIG9iai5pdGVtICE9PSB1bmRlZmluZWQgJiYgKG9iai5sZW5ndGggPyBvYmouaXRlbSgwKSA9PT0gb2JqWzBdIDogb2JqLml0ZW0oMCkgPT09IG51bGwgJiYgb2JqWzBdID09PSB1bmRlZmluZWQpXG5cdCAgICApO1xuXHQgIH1cblxuXHQgIHZhciByZU5hbWUgPSAvXmZ1bmN0aW9uIChcXHcrKS8sXG5cdCAgICAgIGR1bXAgPSB7XG5cdCAgICAvLyBUaGUgb2JqVHlwZSBpcyB1c2VkIG1vc3RseSBpbnRlcm5hbGx5LCB5b3UgY2FuIGZpeCBhIChjdXN0b20pIHR5cGUgaW4gYWR2YW5jZVxuXHQgICAgcGFyc2U6IGZ1bmN0aW9uIHBhcnNlKG9iaiwgb2JqVHlwZSwgc3RhY2spIHtcblx0ICAgICAgc3RhY2sgPSBzdGFjayB8fCBbXTtcblx0ICAgICAgdmFyIHJlcyxcblx0ICAgICAgICAgIHBhcnNlcixcblx0ICAgICAgICAgIHBhcnNlclR5cGUsXG5cdCAgICAgICAgICBvYmpJbmRleCA9IHN0YWNrLmluZGV4T2Yob2JqKTtcblxuXHQgICAgICBpZiAob2JqSW5kZXggIT09IC0xKSB7XG5cdCAgICAgICAgcmV0dXJuIFwicmVjdXJzaW9uKFwiLmNvbmNhdChvYmpJbmRleCAtIHN0YWNrLmxlbmd0aCwgXCIpXCIpO1xuXHQgICAgICB9XG5cblx0ICAgICAgb2JqVHlwZSA9IG9ialR5cGUgfHwgdGhpcy50eXBlT2Yob2JqKTtcblx0ICAgICAgcGFyc2VyID0gdGhpcy5wYXJzZXJzW29ialR5cGVdO1xuXHQgICAgICBwYXJzZXJUeXBlID0gX3R5cGVvZihwYXJzZXIpO1xuXG5cdCAgICAgIGlmIChwYXJzZXJUeXBlID09PSBcImZ1bmN0aW9uXCIpIHtcblx0ICAgICAgICBzdGFjay5wdXNoKG9iaik7XG5cdCAgICAgICAgcmVzID0gcGFyc2VyLmNhbGwodGhpcywgb2JqLCBzdGFjayk7XG5cdCAgICAgICAgc3RhY2sucG9wKCk7XG5cdCAgICAgICAgcmV0dXJuIHJlcztcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBwYXJzZXJUeXBlID09PSBcInN0cmluZ1wiID8gcGFyc2VyIDogdGhpcy5wYXJzZXJzLmVycm9yO1xuXHQgICAgfSxcblx0ICAgIHR5cGVPZjogZnVuY3Rpb24gdHlwZU9mKG9iaikge1xuXHQgICAgICB2YXIgdHlwZTtcblxuXHQgICAgICBpZiAob2JqID09PSBudWxsKSB7XG5cdCAgICAgICAgdHlwZSA9IFwibnVsbFwiO1xuXHQgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBvYmogPT09IFwidW5kZWZpbmVkXCIpIHtcblx0ICAgICAgICB0eXBlID0gXCJ1bmRlZmluZWRcIjtcblx0ICAgICAgfSBlbHNlIGlmIChpcyhcInJlZ2V4cFwiLCBvYmopKSB7XG5cdCAgICAgICAgdHlwZSA9IFwicmVnZXhwXCI7XG5cdCAgICAgIH0gZWxzZSBpZiAoaXMoXCJkYXRlXCIsIG9iaikpIHtcblx0ICAgICAgICB0eXBlID0gXCJkYXRlXCI7XG5cdCAgICAgIH0gZWxzZSBpZiAoaXMoXCJmdW5jdGlvblwiLCBvYmopKSB7XG5cdCAgICAgICAgdHlwZSA9IFwiZnVuY3Rpb25cIjtcblx0ICAgICAgfSBlbHNlIGlmIChvYmouc2V0SW50ZXJ2YWwgIT09IHVuZGVmaW5lZCAmJiBvYmouZG9jdW1lbnQgIT09IHVuZGVmaW5lZCAmJiBvYmoubm9kZVR5cGUgPT09IHVuZGVmaW5lZCkge1xuXHQgICAgICAgIHR5cGUgPSBcIndpbmRvd1wiO1xuXHQgICAgICB9IGVsc2UgaWYgKG9iai5ub2RlVHlwZSA9PT0gOSkge1xuXHQgICAgICAgIHR5cGUgPSBcImRvY3VtZW50XCI7XG5cdCAgICAgIH0gZWxzZSBpZiAob2JqLm5vZGVUeXBlKSB7XG5cdCAgICAgICAgdHlwZSA9IFwibm9kZVwiO1xuXHQgICAgICB9IGVsc2UgaWYgKGlzQXJyYXkob2JqKSkge1xuXHQgICAgICAgIHR5cGUgPSBcImFycmF5XCI7XG5cdCAgICAgIH0gZWxzZSBpZiAob2JqLmNvbnN0cnVjdG9yID09PSBFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IpIHtcblx0ICAgICAgICB0eXBlID0gXCJlcnJvclwiO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHR5cGUgPSBfdHlwZW9mKG9iaik7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gdHlwZTtcblx0ICAgIH0sXG5cdCAgICBzZXBhcmF0b3I6IGZ1bmN0aW9uIHNlcGFyYXRvcigpIHtcblx0ICAgICAgaWYgKHRoaXMubXVsdGlsaW5lKSB7XG5cdCAgICAgICAgcmV0dXJuIHRoaXMuSFRNTCA/IFwiPGJyIC8+XCIgOiBcIlxcblwiO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHJldHVybiB0aGlzLkhUTUwgPyBcIiYjMTYwO1wiIDogXCIgXCI7XG5cdCAgICAgIH1cblx0ICAgIH0sXG5cdCAgICAvLyBFeHRyYSBjYW4gYmUgYSBudW1iZXIsIHNob3J0Y3V0IGZvciBpbmNyZWFzaW5nLWNhbGxpbmctZGVjcmVhc2luZ1xuXHQgICAgaW5kZW50OiBmdW5jdGlvbiBpbmRlbnQoZXh0cmEpIHtcblx0ICAgICAgaWYgKCF0aGlzLm11bHRpbGluZSkge1xuXHQgICAgICAgIHJldHVybiBcIlwiO1xuXHQgICAgICB9XG5cblx0ICAgICAgdmFyIGNociA9IHRoaXMuaW5kZW50Q2hhcjtcblxuXHQgICAgICBpZiAodGhpcy5IVE1MKSB7XG5cdCAgICAgICAgY2hyID0gY2hyLnJlcGxhY2UoL1xcdC9nLCBcIiAgIFwiKS5yZXBsYWNlKC8gL2csIFwiJiMxNjA7XCIpO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIG5ldyBBcnJheSh0aGlzLmRlcHRoICsgKGV4dHJhIHx8IDApKS5qb2luKGNocik7XG5cdCAgICB9LFxuXHQgICAgdXA6IGZ1bmN0aW9uIHVwKGEpIHtcblx0ICAgICAgdGhpcy5kZXB0aCArPSBhIHx8IDE7XG5cdCAgICB9LFxuXHQgICAgZG93bjogZnVuY3Rpb24gZG93bihhKSB7XG5cdCAgICAgIHRoaXMuZGVwdGggLT0gYSB8fCAxO1xuXHQgICAgfSxcblx0ICAgIHNldFBhcnNlcjogZnVuY3Rpb24gc2V0UGFyc2VyKG5hbWUsIHBhcnNlcikge1xuXHQgICAgICB0aGlzLnBhcnNlcnNbbmFtZV0gPSBwYXJzZXI7XG5cdCAgICB9LFxuXHQgICAgLy8gVGhlIG5leHQgMyBhcmUgZXhwb3NlZCBzbyB5b3UgY2FuIHVzZSB0aGVtXG5cdCAgICBxdW90ZTogcXVvdGUsXG5cdCAgICBsaXRlcmFsOiBsaXRlcmFsLFxuXHQgICAgam9pbjogam9pbixcblx0ICAgIGRlcHRoOiAxLFxuXHQgICAgbWF4RGVwdGg6IGNvbmZpZy5tYXhEZXB0aCxcblx0ICAgIC8vIFRoaXMgaXMgdGhlIGxpc3Qgb2YgcGFyc2VycywgdG8gbW9kaWZ5IHRoZW0sIHVzZSBkdW1wLnNldFBhcnNlclxuXHQgICAgcGFyc2Vyczoge1xuXHQgICAgICB3aW5kb3c6IFwiW1dpbmRvd11cIixcblx0ICAgICAgZG9jdW1lbnQ6IFwiW0RvY3VtZW50XVwiLFxuXHQgICAgICBlcnJvcjogZnVuY3Rpb24gZXJyb3IoX2Vycm9yKSB7XG5cdCAgICAgICAgcmV0dXJuIFwiRXJyb3IoXFxcIlwiICsgX2Vycm9yLm1lc3NhZ2UgKyBcIlxcXCIpXCI7XG5cdCAgICAgIH0sXG5cdCAgICAgIHVua25vd246IFwiW1Vua25vd25dXCIsXG5cdCAgICAgIFwibnVsbFwiOiBcIm51bGxcIixcblx0ICAgICAgXCJ1bmRlZmluZWRcIjogXCJ1bmRlZmluZWRcIixcblx0ICAgICAgXCJmdW5jdGlvblwiOiBmdW5jdGlvbiBfZnVuY3Rpb24oZm4pIHtcblx0ICAgICAgICB2YXIgcmV0ID0gXCJmdW5jdGlvblwiLFxuXHQgICAgICAgICAgICAvLyBGdW5jdGlvbnMgbmV2ZXIgaGF2ZSBuYW1lIGluIElFXG5cdCAgICAgICAgbmFtZSA9IFwibmFtZVwiIGluIGZuID8gZm4ubmFtZSA6IChyZU5hbWUuZXhlYyhmbikgfHwgW10pWzFdO1xuXG5cdCAgICAgICAgaWYgKG5hbWUpIHtcblx0ICAgICAgICAgIHJldCArPSBcIiBcIiArIG5hbWU7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgcmV0ICs9IFwiKFwiO1xuXHQgICAgICAgIHJldCA9IFtyZXQsIGR1bXAucGFyc2UoZm4sIFwiZnVuY3Rpb25BcmdzXCIpLCBcIil7XCJdLmpvaW4oXCJcIik7XG5cdCAgICAgICAgcmV0dXJuIGpvaW4ocmV0LCBkdW1wLnBhcnNlKGZuLCBcImZ1bmN0aW9uQ29kZVwiKSwgXCJ9XCIpO1xuXHQgICAgICB9LFxuXHQgICAgICBhcnJheTogYXJyYXksXG5cdCAgICAgIG5vZGVsaXN0OiBhcnJheSxcblx0ICAgICAgXCJhcmd1bWVudHNcIjogYXJyYXksXG5cdCAgICAgIG9iamVjdDogZnVuY3Rpb24gb2JqZWN0KG1hcCwgc3RhY2spIHtcblx0ICAgICAgICB2YXIga2V5cyxcblx0ICAgICAgICAgICAga2V5LFxuXHQgICAgICAgICAgICB2YWwsXG5cdCAgICAgICAgICAgIGksXG5cdCAgICAgICAgICAgIG5vbkVudW1lcmFibGVQcm9wZXJ0aWVzLFxuXHQgICAgICAgICAgICByZXQgPSBbXTtcblxuXHQgICAgICAgIGlmIChkdW1wLm1heERlcHRoICYmIGR1bXAuZGVwdGggPiBkdW1wLm1heERlcHRoKSB7XG5cdCAgICAgICAgICByZXR1cm4gXCJbb2JqZWN0IE9iamVjdF1cIjtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBkdW1wLnVwKCk7XG5cdCAgICAgICAga2V5cyA9IFtdO1xuXG5cdCAgICAgICAgZm9yIChrZXkgaW4gbWFwKSB7XG5cdCAgICAgICAgICBrZXlzLnB1c2goa2V5KTtcblx0ICAgICAgICB9IC8vIFNvbWUgcHJvcGVydGllcyBhcmUgbm90IGFsd2F5cyBlbnVtZXJhYmxlIG9uIEVycm9yIG9iamVjdHMuXG5cblxuXHQgICAgICAgIG5vbkVudW1lcmFibGVQcm9wZXJ0aWVzID0gW1wibWVzc2FnZVwiLCBcIm5hbWVcIl07XG5cblx0ICAgICAgICBmb3IgKGkgaW4gbm9uRW51bWVyYWJsZVByb3BlcnRpZXMpIHtcblx0ICAgICAgICAgIGtleSA9IG5vbkVudW1lcmFibGVQcm9wZXJ0aWVzW2ldO1xuXG5cdCAgICAgICAgICBpZiAoa2V5IGluIG1hcCAmJiAhaW5BcnJheShrZXksIGtleXMpKSB7XG5cdCAgICAgICAgICAgIGtleXMucHVzaChrZXkpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGtleXMuc29ydCgpO1xuXG5cdCAgICAgICAgZm9yIChpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgIGtleSA9IGtleXNbaV07XG5cdCAgICAgICAgICB2YWwgPSBtYXBba2V5XTtcblx0ICAgICAgICAgIHJldC5wdXNoKGR1bXAucGFyc2Uoa2V5LCBcImtleVwiKSArIFwiOiBcIiArIGR1bXAucGFyc2UodmFsLCB1bmRlZmluZWQsIHN0YWNrKSk7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgZHVtcC5kb3duKCk7XG5cdCAgICAgICAgcmV0dXJuIGpvaW4oXCJ7XCIsIHJldCwgXCJ9XCIpO1xuXHQgICAgICB9LFxuXHQgICAgICBub2RlOiBmdW5jdGlvbiBub2RlKF9ub2RlKSB7XG5cdCAgICAgICAgdmFyIGxlbixcblx0ICAgICAgICAgICAgaSxcblx0ICAgICAgICAgICAgdmFsLFxuXHQgICAgICAgICAgICBvcGVuID0gZHVtcC5IVE1MID8gXCImbHQ7XCIgOiBcIjxcIixcblx0ICAgICAgICAgICAgY2xvc2UgPSBkdW1wLkhUTUwgPyBcIiZndDtcIiA6IFwiPlwiLFxuXHQgICAgICAgICAgICB0YWcgPSBfbm9kZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpLFxuXHQgICAgICAgICAgICByZXQgPSBvcGVuICsgdGFnLFxuXHQgICAgICAgICAgICBhdHRycyA9IF9ub2RlLmF0dHJpYnV0ZXM7XG5cblx0ICAgICAgICBpZiAoYXR0cnMpIHtcblx0ICAgICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGF0dHJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdCAgICAgICAgICAgIHZhbCA9IGF0dHJzW2ldLm5vZGVWYWx1ZTsgLy8gSUU2IGluY2x1ZGVzIGFsbCBhdHRyaWJ1dGVzIGluIC5hdHRyaWJ1dGVzLCBldmVuIG9uZXMgbm90IGV4cGxpY2l0bHlcblx0ICAgICAgICAgICAgLy8gc2V0LiBUaG9zZSBoYXZlIHZhbHVlcyBsaWtlIHVuZGVmaW5lZCwgbnVsbCwgMCwgZmFsc2UsIFwiXCIgb3Jcblx0ICAgICAgICAgICAgLy8gXCJpbmhlcml0XCIuXG5cblx0ICAgICAgICAgICAgaWYgKHZhbCAmJiB2YWwgIT09IFwiaW5oZXJpdFwiKSB7XG5cdCAgICAgICAgICAgICAgcmV0ICs9IFwiIFwiICsgYXR0cnNbaV0ubm9kZU5hbWUgKyBcIj1cIiArIGR1bXAucGFyc2UodmFsLCBcImF0dHJpYnV0ZVwiKTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHJldCArPSBjbG9zZTsgLy8gU2hvdyBjb250ZW50IG9mIFRleHROb2RlIG9yIENEQVRBU2VjdGlvblxuXG5cdCAgICAgICAgaWYgKF9ub2RlLm5vZGVUeXBlID09PSAzIHx8IF9ub2RlLm5vZGVUeXBlID09PSA0KSB7XG5cdCAgICAgICAgICByZXQgKz0gX25vZGUubm9kZVZhbHVlO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHJldHVybiByZXQgKyBvcGVuICsgXCIvXCIgKyB0YWcgKyBjbG9zZTtcblx0ICAgICAgfSxcblx0ICAgICAgLy8gRnVuY3Rpb24gY2FsbHMgaXQgaW50ZXJuYWxseSwgaXQncyB0aGUgYXJndW1lbnRzIHBhcnQgb2YgdGhlIGZ1bmN0aW9uXG5cdCAgICAgIGZ1bmN0aW9uQXJnczogZnVuY3Rpb24gZnVuY3Rpb25BcmdzKGZuKSB7XG5cdCAgICAgICAgdmFyIGFyZ3MsXG5cdCAgICAgICAgICAgIGwgPSBmbi5sZW5ndGg7XG5cblx0ICAgICAgICBpZiAoIWwpIHtcblx0ICAgICAgICAgIHJldHVybiBcIlwiO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobCk7XG5cblx0ICAgICAgICB3aGlsZSAobC0tKSB7XG5cdCAgICAgICAgICAvLyA5NyBpcyAnYSdcblx0ICAgICAgICAgIGFyZ3NbbF0gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDk3ICsgbCk7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgcmV0dXJuIFwiIFwiICsgYXJncy5qb2luKFwiLCBcIikgKyBcIiBcIjtcblx0ICAgICAgfSxcblx0ICAgICAgLy8gT2JqZWN0IGNhbGxzIGl0IGludGVybmFsbHksIHRoZSBrZXkgcGFydCBvZiBhbiBpdGVtIGluIGEgbWFwXG5cdCAgICAgIGtleTogcXVvdGUsXG5cdCAgICAgIC8vIEZ1bmN0aW9uIGNhbGxzIGl0IGludGVybmFsbHksIGl0J3MgdGhlIGNvbnRlbnQgb2YgdGhlIGZ1bmN0aW9uXG5cdCAgICAgIGZ1bmN0aW9uQ29kZTogXCJbY29kZV1cIixcblx0ICAgICAgLy8gTm9kZSBjYWxscyBpdCBpbnRlcm5hbGx5LCBpdCdzIGEgaHRtbCBhdHRyaWJ1dGUgdmFsdWVcblx0ICAgICAgYXR0cmlidXRlOiBxdW90ZSxcblx0ICAgICAgc3RyaW5nOiBxdW90ZSxcblx0ICAgICAgZGF0ZTogcXVvdGUsXG5cdCAgICAgIHJlZ2V4cDogbGl0ZXJhbCxcblx0ICAgICAgbnVtYmVyOiBsaXRlcmFsLFxuXHQgICAgICBcImJvb2xlYW5cIjogbGl0ZXJhbCxcblx0ICAgICAgc3ltYm9sOiBmdW5jdGlvbiBzeW1ib2woc3ltKSB7XG5cdCAgICAgICAgcmV0dXJuIHN5bS50b1N0cmluZygpO1xuXHQgICAgICB9XG5cdCAgICB9LFxuXHQgICAgLy8gSWYgdHJ1ZSwgZW50aXRpZXMgYXJlIGVzY2FwZWQgKCA8LCA+LCBcXHQsIHNwYWNlIGFuZCBcXG4gKVxuXHQgICAgSFRNTDogZmFsc2UsXG5cdCAgICAvLyBJbmRlbnRhdGlvbiB1bml0XG5cdCAgICBpbmRlbnRDaGFyOiBcIiAgXCIsXG5cdCAgICAvLyBJZiB0cnVlLCBpdGVtcyBpbiBhIGNvbGxlY3Rpb24sIGFyZSBzZXBhcmF0ZWQgYnkgYSBcXG4sIGVsc2UganVzdCBhIHNwYWNlLlxuXHQgICAgbXVsdGlsaW5lOiB0cnVlXG5cdCAgfTtcblx0ICByZXR1cm4gZHVtcDtcblx0fSkoKTtcblxuXHR2YXIgU3VpdGVSZXBvcnQgPSAvKiNfX1BVUkVfXyovZnVuY3Rpb24gKCkge1xuXHQgIGZ1bmN0aW9uIFN1aXRlUmVwb3J0KG5hbWUsIHBhcmVudFN1aXRlKSB7XG5cdCAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgU3VpdGVSZXBvcnQpO1xuXG5cdCAgICB0aGlzLm5hbWUgPSBuYW1lO1xuXHQgICAgdGhpcy5mdWxsTmFtZSA9IHBhcmVudFN1aXRlID8gcGFyZW50U3VpdGUuZnVsbE5hbWUuY29uY2F0KG5hbWUpIDogW107XG5cdCAgICB0aGlzLnRlc3RzID0gW107XG5cdCAgICB0aGlzLmNoaWxkU3VpdGVzID0gW107XG5cblx0ICAgIGlmIChwYXJlbnRTdWl0ZSkge1xuXHQgICAgICBwYXJlbnRTdWl0ZS5wdXNoQ2hpbGRTdWl0ZSh0aGlzKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBfY3JlYXRlQ2xhc3MoU3VpdGVSZXBvcnQsIFt7XG5cdCAgICBrZXk6IFwic3RhcnRcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBzdGFydChyZWNvcmRUaW1lKSB7XG5cdCAgICAgIGlmIChyZWNvcmRUaW1lKSB7XG5cdCAgICAgICAgdGhpcy5fc3RhcnRUaW1lID0gcGVyZm9ybWFuY2VOb3coKTtcblxuXHQgICAgICAgIGlmIChwZXJmb3JtYW5jZSkge1xuXHQgICAgICAgICAgdmFyIHN1aXRlTGV2ZWwgPSB0aGlzLmZ1bGxOYW1lLmxlbmd0aDtcblx0ICAgICAgICAgIHBlcmZvcm1hbmNlLm1hcmsoXCJxdW5pdF9zdWl0ZV9cIi5jb25jYXQoc3VpdGVMZXZlbCwgXCJfc3RhcnRcIikpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiB7XG5cdCAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxuXHQgICAgICAgIGZ1bGxOYW1lOiB0aGlzLmZ1bGxOYW1lLnNsaWNlKCksXG5cdCAgICAgICAgdGVzdHM6IHRoaXMudGVzdHMubWFwKGZ1bmN0aW9uICh0ZXN0KSB7XG5cdCAgICAgICAgICByZXR1cm4gdGVzdC5zdGFydCgpO1xuXHQgICAgICAgIH0pLFxuXHQgICAgICAgIGNoaWxkU3VpdGVzOiB0aGlzLmNoaWxkU3VpdGVzLm1hcChmdW5jdGlvbiAoc3VpdGUpIHtcblx0ICAgICAgICAgIHJldHVybiBzdWl0ZS5zdGFydCgpO1xuXHQgICAgICAgIH0pLFxuXHQgICAgICAgIHRlc3RDb3VudHM6IHtcblx0ICAgICAgICAgIHRvdGFsOiB0aGlzLmdldFRlc3RDb3VudHMoKS50b3RhbFxuXHQgICAgICAgIH1cblx0ICAgICAgfTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZW5kXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZW5kKHJlY29yZFRpbWUpIHtcblx0ICAgICAgaWYgKHJlY29yZFRpbWUpIHtcblx0ICAgICAgICB0aGlzLl9lbmRUaW1lID0gcGVyZm9ybWFuY2VOb3coKTtcblxuXHQgICAgICAgIGlmIChwZXJmb3JtYW5jZSkge1xuXHQgICAgICAgICAgdmFyIHN1aXRlTGV2ZWwgPSB0aGlzLmZ1bGxOYW1lLmxlbmd0aDtcblx0ICAgICAgICAgIHBlcmZvcm1hbmNlLm1hcmsoXCJxdW5pdF9zdWl0ZV9cIi5jb25jYXQoc3VpdGVMZXZlbCwgXCJfZW5kXCIpKTtcblx0ICAgICAgICAgIHZhciBzdWl0ZU5hbWUgPSB0aGlzLmZ1bGxOYW1lLmpvaW4oXCIg4oCTIFwiKTtcblx0ICAgICAgICAgIG1lYXN1cmUoc3VpdGVMZXZlbCA9PT0gMCA/IFwiUVVuaXQgVGVzdCBSdW5cIiA6IFwiUVVuaXQgVGVzdCBTdWl0ZTogXCIuY29uY2F0KHN1aXRlTmFtZSksIFwicXVuaXRfc3VpdGVfXCIuY29uY2F0KHN1aXRlTGV2ZWwsIFwiX3N0YXJ0XCIpLCBcInF1bml0X3N1aXRlX1wiLmNvbmNhdChzdWl0ZUxldmVsLCBcIl9lbmRcIikpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiB7XG5cdCAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxuXHQgICAgICAgIGZ1bGxOYW1lOiB0aGlzLmZ1bGxOYW1lLnNsaWNlKCksXG5cdCAgICAgICAgdGVzdHM6IHRoaXMudGVzdHMubWFwKGZ1bmN0aW9uICh0ZXN0KSB7XG5cdCAgICAgICAgICByZXR1cm4gdGVzdC5lbmQoKTtcblx0ICAgICAgICB9KSxcblx0ICAgICAgICBjaGlsZFN1aXRlczogdGhpcy5jaGlsZFN1aXRlcy5tYXAoZnVuY3Rpb24gKHN1aXRlKSB7XG5cdCAgICAgICAgICByZXR1cm4gc3VpdGUuZW5kKCk7XG5cdCAgICAgICAgfSksXG5cdCAgICAgICAgdGVzdENvdW50czogdGhpcy5nZXRUZXN0Q291bnRzKCksXG5cdCAgICAgICAgcnVudGltZTogdGhpcy5nZXRSdW50aW1lKCksXG5cdCAgICAgICAgc3RhdHVzOiB0aGlzLmdldFN0YXR1cygpXG5cdCAgICAgIH07XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcInB1c2hDaGlsZFN1aXRlXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gcHVzaENoaWxkU3VpdGUoc3VpdGUpIHtcblx0ICAgICAgdGhpcy5jaGlsZFN1aXRlcy5wdXNoKHN1aXRlKTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwicHVzaFRlc3RcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBwdXNoVGVzdCh0ZXN0KSB7XG5cdCAgICAgIHRoaXMudGVzdHMucHVzaCh0ZXN0KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZ2V0UnVudGltZVwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGdldFJ1bnRpbWUoKSB7XG5cdCAgICAgIHJldHVybiB0aGlzLl9lbmRUaW1lIC0gdGhpcy5fc3RhcnRUaW1lO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJnZXRUZXN0Q291bnRzXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0VGVzdENvdW50cygpIHtcblx0ICAgICAgdmFyIGNvdW50cyA9IGFyZ3VtZW50cy5sZW5ndGggPiAwICYmIGFyZ3VtZW50c1swXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzBdIDoge1xuXHQgICAgICAgIHBhc3NlZDogMCxcblx0ICAgICAgICBmYWlsZWQ6IDAsXG5cdCAgICAgICAgc2tpcHBlZDogMCxcblx0ICAgICAgICB0b2RvOiAwLFxuXHQgICAgICAgIHRvdGFsOiAwXG5cdCAgICAgIH07XG5cdCAgICAgIGNvdW50cyA9IHRoaXMudGVzdHMucmVkdWNlKGZ1bmN0aW9uIChjb3VudHMsIHRlc3QpIHtcblx0ICAgICAgICBpZiAodGVzdC52YWxpZCkge1xuXHQgICAgICAgICAgY291bnRzW3Rlc3QuZ2V0U3RhdHVzKCldKys7XG5cdCAgICAgICAgICBjb3VudHMudG90YWwrKztcblx0ICAgICAgICB9XG5cblx0ICAgICAgICByZXR1cm4gY291bnRzO1xuXHQgICAgICB9LCBjb3VudHMpO1xuXHQgICAgICByZXR1cm4gdGhpcy5jaGlsZFN1aXRlcy5yZWR1Y2UoZnVuY3Rpb24gKGNvdW50cywgc3VpdGUpIHtcblx0ICAgICAgICByZXR1cm4gc3VpdGUuZ2V0VGVzdENvdW50cyhjb3VudHMpO1xuXHQgICAgICB9LCBjb3VudHMpO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJnZXRTdGF0dXNcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRTdGF0dXMoKSB7XG5cdCAgICAgIHZhciBfdGhpcyRnZXRUZXN0Q291bnRzID0gdGhpcy5nZXRUZXN0Q291bnRzKCksXG5cdCAgICAgICAgICB0b3RhbCA9IF90aGlzJGdldFRlc3RDb3VudHMudG90YWwsXG5cdCAgICAgICAgICBmYWlsZWQgPSBfdGhpcyRnZXRUZXN0Q291bnRzLmZhaWxlZCxcblx0ICAgICAgICAgIHNraXBwZWQgPSBfdGhpcyRnZXRUZXN0Q291bnRzLnNraXBwZWQsXG5cdCAgICAgICAgICB0b2RvID0gX3RoaXMkZ2V0VGVzdENvdW50cy50b2RvO1xuXG5cdCAgICAgIGlmIChmYWlsZWQpIHtcblx0ICAgICAgICByZXR1cm4gXCJmYWlsZWRcIjtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBpZiAoc2tpcHBlZCA9PT0gdG90YWwpIHtcblx0ICAgICAgICAgIHJldHVybiBcInNraXBwZWRcIjtcblx0ICAgICAgICB9IGVsc2UgaWYgKHRvZG8gPT09IHRvdGFsKSB7XG5cdCAgICAgICAgICByZXR1cm4gXCJ0b2RvXCI7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHJldHVybiBcInBhc3NlZFwiO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH1dKTtcblxuXHQgIHJldHVybiBTdWl0ZVJlcG9ydDtcblx0fSgpO1xuXG5cdHZhciBmb2N1c2VkID0gZmFsc2U7XG5cdHZhciBtb2R1bGVTdGFjayA9IFtdO1xuXG5cdGZ1bmN0aW9uIGlzUGFyZW50TW9kdWxlSW5RdWV1ZSgpIHtcblx0ICB2YXIgbW9kdWxlc0luUXVldWUgPSBjb25maWcubW9kdWxlcy5tYXAoZnVuY3Rpb24gKG1vZHVsZSkge1xuXHQgICAgcmV0dXJuIG1vZHVsZS5tb2R1bGVJZDtcblx0ICB9KTtcblx0ICByZXR1cm4gbW9kdWxlU3RhY2suc29tZShmdW5jdGlvbiAobW9kdWxlKSB7XG5cdCAgICByZXR1cm4gbW9kdWxlc0luUXVldWUuaW5jbHVkZXMobW9kdWxlLm1vZHVsZUlkKTtcblx0ICB9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIGNyZWF0ZU1vZHVsZShuYW1lLCB0ZXN0RW52aXJvbm1lbnQsIG1vZGlmaWVycykge1xuXHQgIHZhciBwYXJlbnRNb2R1bGUgPSBtb2R1bGVTdGFjay5sZW5ndGggPyBtb2R1bGVTdGFjay5zbGljZSgtMSlbMF0gOiBudWxsO1xuXHQgIHZhciBtb2R1bGVOYW1lID0gcGFyZW50TW9kdWxlICE9PSBudWxsID8gW3BhcmVudE1vZHVsZS5uYW1lLCBuYW1lXS5qb2luKFwiID4gXCIpIDogbmFtZTtcblx0ICB2YXIgcGFyZW50U3VpdGUgPSBwYXJlbnRNb2R1bGUgPyBwYXJlbnRNb2R1bGUuc3VpdGVSZXBvcnQgOiBnbG9iYWxTdWl0ZTtcblx0ICB2YXIgc2tpcCA9IHBhcmVudE1vZHVsZSAhPT0gbnVsbCAmJiBwYXJlbnRNb2R1bGUuc2tpcCB8fCBtb2RpZmllcnMuc2tpcDtcblx0ICB2YXIgdG9kbyA9IHBhcmVudE1vZHVsZSAhPT0gbnVsbCAmJiBwYXJlbnRNb2R1bGUudG9kbyB8fCBtb2RpZmllcnMudG9kbztcblx0ICB2YXIgbW9kdWxlID0ge1xuXHQgICAgbmFtZTogbW9kdWxlTmFtZSxcblx0ICAgIHBhcmVudE1vZHVsZTogcGFyZW50TW9kdWxlLFxuXHQgICAgdGVzdHM6IFtdLFxuXHQgICAgbW9kdWxlSWQ6IGdlbmVyYXRlSGFzaChtb2R1bGVOYW1lKSxcblx0ICAgIHRlc3RzUnVuOiAwLFxuXHQgICAgdW5za2lwcGVkVGVzdHNSdW46IDAsXG5cdCAgICBjaGlsZE1vZHVsZXM6IFtdLFxuXHQgICAgc3VpdGVSZXBvcnQ6IG5ldyBTdWl0ZVJlcG9ydChuYW1lLCBwYXJlbnRTdWl0ZSksXG5cdCAgICAvLyBQYXNzIGFsb25nIGBza2lwYCBhbmQgYHRvZG9gIHByb3BlcnRpZXMgZnJvbSBwYXJlbnQgbW9kdWxlLCBpbiBjYXNlXG5cdCAgICAvLyB0aGVyZSBpcyBvbmUsIHRvIGNoaWxkcy4gQW5kIHVzZSBvd24gb3RoZXJ3aXNlLlxuXHQgICAgLy8gVGhpcyBwcm9wZXJ0eSB3aWxsIGJlIHVzZWQgdG8gbWFyayBvd24gdGVzdHMgYW5kIHRlc3RzIG9mIGNoaWxkIHN1aXRlc1xuXHQgICAgLy8gYXMgZWl0aGVyIGBza2lwcGVkYCBvciBgdG9kb2AuXG5cdCAgICBza2lwOiBza2lwLFxuXHQgICAgdG9kbzogc2tpcCA/IGZhbHNlIDogdG9kb1xuXHQgIH07XG5cdCAgdmFyIGVudiA9IHt9O1xuXG5cdCAgaWYgKHBhcmVudE1vZHVsZSkge1xuXHQgICAgcGFyZW50TW9kdWxlLmNoaWxkTW9kdWxlcy5wdXNoKG1vZHVsZSk7XG5cdCAgICBleHRlbmQoZW52LCBwYXJlbnRNb2R1bGUudGVzdEVudmlyb25tZW50KTtcblx0ICB9XG5cblx0ICBleHRlbmQoZW52LCB0ZXN0RW52aXJvbm1lbnQpO1xuXHQgIG1vZHVsZS50ZXN0RW52aXJvbm1lbnQgPSBlbnY7XG5cdCAgY29uZmlnLm1vZHVsZXMucHVzaChtb2R1bGUpO1xuXHQgIHJldHVybiBtb2R1bGU7XG5cdH1cblxuXHRmdW5jdGlvbiBwcm9jZXNzTW9kdWxlKG5hbWUsIG9wdGlvbnMsIGV4ZWN1dGVOb3cpIHtcblx0ICB2YXIgbW9kaWZpZXJzID0gYXJndW1lbnRzLmxlbmd0aCA+IDMgJiYgYXJndW1lbnRzWzNdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbM10gOiB7fTtcblxuXHQgIGlmIChvYmplY3RUeXBlKG9wdGlvbnMpID09PSBcImZ1bmN0aW9uXCIpIHtcblx0ICAgIGV4ZWN1dGVOb3cgPSBvcHRpb25zO1xuXHQgICAgb3B0aW9ucyA9IHVuZGVmaW5lZDtcblx0ICB9XG5cblx0ICB2YXIgbW9kdWxlID0gY3JlYXRlTW9kdWxlKG5hbWUsIG9wdGlvbnMsIG1vZGlmaWVycyk7IC8vIE1vdmUgYW55IGhvb2tzIHRvIGEgJ2hvb2tzJyBvYmplY3RcblxuXHQgIHZhciB0ZXN0RW52aXJvbm1lbnQgPSBtb2R1bGUudGVzdEVudmlyb25tZW50O1xuXHQgIHZhciBob29rcyA9IG1vZHVsZS5ob29rcyA9IHt9O1xuXHQgIHNldEhvb2tGcm9tRW52aXJvbm1lbnQoaG9va3MsIHRlc3RFbnZpcm9ubWVudCwgXCJiZWZvcmVcIik7XG5cdCAgc2V0SG9va0Zyb21FbnZpcm9ubWVudChob29rcywgdGVzdEVudmlyb25tZW50LCBcImJlZm9yZUVhY2hcIik7XG5cdCAgc2V0SG9va0Zyb21FbnZpcm9ubWVudChob29rcywgdGVzdEVudmlyb25tZW50LCBcImFmdGVyRWFjaFwiKTtcblx0ICBzZXRIb29rRnJvbUVudmlyb25tZW50KGhvb2tzLCB0ZXN0RW52aXJvbm1lbnQsIFwiYWZ0ZXJcIik7XG5cdCAgdmFyIG1vZHVsZUZucyA9IHtcblx0ICAgIGJlZm9yZTogc2V0SG9va0Z1bmN0aW9uKG1vZHVsZSwgXCJiZWZvcmVcIiksXG5cdCAgICBiZWZvcmVFYWNoOiBzZXRIb29rRnVuY3Rpb24obW9kdWxlLCBcImJlZm9yZUVhY2hcIiksXG5cdCAgICBhZnRlckVhY2g6IHNldEhvb2tGdW5jdGlvbihtb2R1bGUsIFwiYWZ0ZXJFYWNoXCIpLFxuXHQgICAgYWZ0ZXI6IHNldEhvb2tGdW5jdGlvbihtb2R1bGUsIFwiYWZ0ZXJcIilcblx0ICB9O1xuXHQgIHZhciBjdXJyZW50TW9kdWxlID0gY29uZmlnLmN1cnJlbnRNb2R1bGU7XG5cblx0ICBpZiAob2JqZWN0VHlwZShleGVjdXRlTm93KSA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdCAgICBtb2R1bGVTdGFjay5wdXNoKG1vZHVsZSk7XG5cdCAgICBjb25maWcuY3VycmVudE1vZHVsZSA9IG1vZHVsZTtcblx0ICAgIGV4ZWN1dGVOb3cuY2FsbChtb2R1bGUudGVzdEVudmlyb25tZW50LCBtb2R1bGVGbnMpO1xuXHQgICAgbW9kdWxlU3RhY2sucG9wKCk7XG5cdCAgICBtb2R1bGUgPSBtb2R1bGUucGFyZW50TW9kdWxlIHx8IGN1cnJlbnRNb2R1bGU7XG5cdCAgfVxuXG5cdCAgY29uZmlnLmN1cnJlbnRNb2R1bGUgPSBtb2R1bGU7XG5cblx0ICBmdW5jdGlvbiBzZXRIb29rRnJvbUVudmlyb25tZW50KGhvb2tzLCBlbnZpcm9ubWVudCwgbmFtZSkge1xuXHQgICAgdmFyIHBvdGVudGlhbEhvb2sgPSBlbnZpcm9ubWVudFtuYW1lXTtcblx0ICAgIGhvb2tzW25hbWVdID0gdHlwZW9mIHBvdGVudGlhbEhvb2sgPT09IFwiZnVuY3Rpb25cIiA/IFtwb3RlbnRpYWxIb29rXSA6IFtdO1xuXHQgICAgZGVsZXRlIGVudmlyb25tZW50W25hbWVdO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHNldEhvb2tGdW5jdGlvbihtb2R1bGUsIGhvb2tOYW1lKSB7XG5cdCAgICByZXR1cm4gZnVuY3Rpb24gc2V0SG9vayhjYWxsYmFjaykge1xuXHQgICAgICBtb2R1bGUuaG9va3NbaG9va05hbWVdLnB1c2goY2FsbGJhY2spO1xuXHQgICAgfTtcblx0ICB9XG5cdH1cblxuXHRmdW5jdGlvbiBtb2R1bGUkMShuYW1lLCBvcHRpb25zLCBleGVjdXRlTm93KSB7XG5cdCAgaWYgKGZvY3VzZWQgJiYgIWlzUGFyZW50TW9kdWxlSW5RdWV1ZSgpKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgcHJvY2Vzc01vZHVsZShuYW1lLCBvcHRpb25zLCBleGVjdXRlTm93KTtcblx0fVxuXG5cdG1vZHVsZSQxLm9ubHkgPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKCFmb2N1c2VkKSB7XG5cdCAgICBjb25maWcubW9kdWxlcy5sZW5ndGggPSAwO1xuXHQgICAgY29uZmlnLnF1ZXVlLmxlbmd0aCA9IDA7XG5cdCAgfVxuXG5cdCAgcHJvY2Vzc01vZHVsZS5hcHBseSh2b2lkIDAsIGFyZ3VtZW50cyk7XG5cdCAgZm9jdXNlZCA9IHRydWU7XG5cdH07XG5cblx0bW9kdWxlJDEuc2tpcCA9IGZ1bmN0aW9uIChuYW1lLCBvcHRpb25zLCBleGVjdXRlTm93KSB7XG5cdCAgaWYgKGZvY3VzZWQpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICBwcm9jZXNzTW9kdWxlKG5hbWUsIG9wdGlvbnMsIGV4ZWN1dGVOb3csIHtcblx0ICAgIHNraXA6IHRydWVcblx0ICB9KTtcblx0fTtcblxuXHRtb2R1bGUkMS50b2RvID0gZnVuY3Rpb24gKG5hbWUsIG9wdGlvbnMsIGV4ZWN1dGVOb3cpIHtcblx0ICBpZiAoZm9jdXNlZCkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHByb2Nlc3NNb2R1bGUobmFtZSwgb3B0aW9ucywgZXhlY3V0ZU5vdywge1xuXHQgICAgdG9kbzogdHJ1ZVxuXHQgIH0pO1xuXHR9O1xuXG5cdHZhciBMSVNURU5FUlMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHR2YXIgU1VQUE9SVEVEX0VWRU5UUyA9IFtcInJ1blN0YXJ0XCIsIFwic3VpdGVTdGFydFwiLCBcInRlc3RTdGFydFwiLCBcImFzc2VydGlvblwiLCBcInRlc3RFbmRcIiwgXCJzdWl0ZUVuZFwiLCBcInJ1bkVuZFwiXTtcblx0LyoqXG5cdCAqIEVtaXRzIGFuIGV2ZW50IHdpdGggdGhlIHNwZWNpZmllZCBkYXRhIHRvIGFsbCBjdXJyZW50bHkgcmVnaXN0ZXJlZCBsaXN0ZW5lcnMuXG5cdCAqIENhbGxiYWNrcyB3aWxsIGZpcmUgaW4gdGhlIG9yZGVyIGluIHdoaWNoIHRoZXkgYXJlIHJlZ2lzdGVyZWQgKEZJRk8pLiBUaGlzXG5cdCAqIGZ1bmN0aW9uIGlzIG5vdCBleHBvc2VkIHB1YmxpY2x5OyBpdCBpcyB1c2VkIGJ5IFFVbml0IGludGVybmFscyB0byBlbWl0XG5cdCAqIGxvZ2dpbmcgZXZlbnRzLlxuXHQgKlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAbWV0aG9kIGVtaXRcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZVxuXHQgKiBAcGFyYW0ge09iamVjdH0gZGF0YVxuXHQgKiBAcmV0dXJuIHtWb2lkfVxuXHQgKi9cblxuXHRmdW5jdGlvbiBlbWl0KGV2ZW50TmFtZSwgZGF0YSkge1xuXHQgIGlmIChvYmplY3RUeXBlKGV2ZW50TmFtZSkgIT09IFwic3RyaW5nXCIpIHtcblx0ICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJldmVudE5hbWUgbXVzdCBiZSBhIHN0cmluZyB3aGVuIGVtaXR0aW5nIGFuIGV2ZW50XCIpO1xuXHQgIH0gLy8gQ2xvbmUgdGhlIGNhbGxiYWNrcyBpbiBjYXNlIG9uZSBvZiB0aGVtIHJlZ2lzdGVycyBhIG5ldyBjYWxsYmFja1xuXG5cblx0ICB2YXIgb3JpZ2luYWxDYWxsYmFja3MgPSBMSVNURU5FUlNbZXZlbnROYW1lXTtcblx0ICB2YXIgY2FsbGJhY2tzID0gb3JpZ2luYWxDYWxsYmFja3MgPyBfdG9Db25zdW1hYmxlQXJyYXkob3JpZ2luYWxDYWxsYmFja3MpIDogW107XG5cblx0ICBmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xuXHQgICAgY2FsbGJhY2tzW2ldKGRhdGEpO1xuXHQgIH1cblx0fVxuXHQvKipcblx0ICogUmVnaXN0ZXJzIGEgY2FsbGJhY2sgYXMgYSBsaXN0ZW5lciB0byB0aGUgc3BlY2lmaWVkIGV2ZW50LlxuXHQgKlxuXHQgKiBAcHVibGljXG5cdCAqIEBtZXRob2Qgb25cblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZVxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuXHQgKiBAcmV0dXJuIHtWb2lkfVxuXHQgKi9cblxuXHRmdW5jdGlvbiBvbihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG5cdCAgaWYgKG9iamVjdFR5cGUoZXZlbnROYW1lKSAhPT0gXCJzdHJpbmdcIikge1xuXHQgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImV2ZW50TmFtZSBtdXN0IGJlIGEgc3RyaW5nIHdoZW4gcmVnaXN0ZXJpbmcgYSBsaXN0ZW5lclwiKTtcblx0ICB9IGVsc2UgaWYgKCFpbkFycmF5KGV2ZW50TmFtZSwgU1VQUE9SVEVEX0VWRU5UUykpIHtcblx0ICAgIHZhciBldmVudHMgPSBTVVBQT1JURURfRVZFTlRTLmpvaW4oXCIsIFwiKTtcblx0ICAgIHRocm93IG5ldyBFcnJvcihcIlxcXCJcIi5jb25jYXQoZXZlbnROYW1lLCBcIlxcXCIgaXMgbm90IGEgdmFsaWQgZXZlbnQ7IG11c3QgYmUgb25lIG9mOiBcIikuY29uY2F0KGV2ZW50cywgXCIuXCIpKTtcblx0ICB9IGVsc2UgaWYgKG9iamVjdFR5cGUoY2FsbGJhY2spICE9PSBcImZ1bmN0aW9uXCIpIHtcblx0ICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYWxsYmFjayBtdXN0IGJlIGEgZnVuY3Rpb24gd2hlbiByZWdpc3RlcmluZyBhIGxpc3RlbmVyXCIpO1xuXHQgIH1cblxuXHQgIGlmICghTElTVEVORVJTW2V2ZW50TmFtZV0pIHtcblx0ICAgIExJU1RFTkVSU1tldmVudE5hbWVdID0gW107XG5cdCAgfSAvLyBEb24ndCByZWdpc3RlciB0aGUgc2FtZSBjYWxsYmFjayBtb3JlIHRoYW4gb25jZVxuXG5cblx0ICBpZiAoIWluQXJyYXkoY2FsbGJhY2ssIExJU1RFTkVSU1tldmVudE5hbWVdKSkge1xuXHQgICAgTElTVEVORVJTW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG5cdCAgfVxuXHR9XG5cblx0dmFyIGNvbW1vbmpzR2xvYmFsID0gdHlwZW9mIGdsb2JhbFRoaXMgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsVGhpcyA6IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcgPyBzZWxmIDoge307XG5cblx0ZnVuY3Rpb24gY3JlYXRlQ29tbW9uanNNb2R1bGUoZm4sIGJhc2VkaXIsIG1vZHVsZSkge1xuXHRcdHJldHVybiBtb2R1bGUgPSB7XG5cdFx0ICBwYXRoOiBiYXNlZGlyLFxuXHRcdCAgZXhwb3J0czoge30sXG5cdFx0ICByZXF1aXJlOiBmdW5jdGlvbiAocGF0aCwgYmFzZSkge1xuXHQgICAgICByZXR1cm4gY29tbW9uanNSZXF1aXJlKHBhdGgsIChiYXNlID09PSB1bmRlZmluZWQgfHwgYmFzZSA9PT0gbnVsbCkgPyBtb2R1bGUucGF0aCA6IGJhc2UpO1xuXHQgICAgfVxuXHRcdH0sIGZuKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMpLCBtb2R1bGUuZXhwb3J0cztcblx0fVxuXG5cdGZ1bmN0aW9uIGNvbW1vbmpzUmVxdWlyZSAoKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdEeW5hbWljIHJlcXVpcmVzIGFyZSBub3QgY3VycmVudGx5IHN1cHBvcnRlZCBieSBAcm9sbHVwL3BsdWdpbi1jb21tb25qcycpO1xuXHR9XG5cblx0dmFyIGVzNlByb21pc2UgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdCAgLyohXG5cdCAgICogQG92ZXJ2aWV3IGVzNi1wcm9taXNlIC0gYSB0aW55IGltcGxlbWVudGF0aW9uIG9mIFByb21pc2VzL0ErLlxuXHQgICAqIEBjb3B5cmlnaHQgQ29weXJpZ2h0IChjKSAyMDE0IFllaHVkYSBLYXR6LCBUb20gRGFsZSwgU3RlZmFuIFBlbm5lciBhbmQgY29udHJpYnV0b3JzIChDb252ZXJzaW9uIHRvIEVTNiBBUEkgYnkgSmFrZSBBcmNoaWJhbGQpXG5cdCAgICogQGxpY2Vuc2UgICBMaWNlbnNlZCB1bmRlciBNSVQgbGljZW5zZVxuXHQgICAqICAgICAgICAgICAgU2VlIGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9zdGVmYW5wZW5uZXIvZXM2LXByb21pc2UvbWFzdGVyL0xJQ0VOU0Vcblx0ICAgKiBAdmVyc2lvbiAgIHY0LjIuOCsxZTY4ZGNlNlxuXHQgICAqL1xuXHQgIChmdW5jdGlvbiAoZ2xvYmFsLCBmYWN0b3J5KSB7XG5cdCAgICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgO1xuXHQgIH0pKGNvbW1vbmpzR2xvYmFsLCBmdW5jdGlvbiAoKSB7XG5cblx0ICAgIGZ1bmN0aW9uIG9iamVjdE9yRnVuY3Rpb24oeCkge1xuXHQgICAgICB2YXIgdHlwZSA9IHR5cGVvZiB4O1xuXHQgICAgICByZXR1cm4geCAhPT0gbnVsbCAmJiAodHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJyk7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGlzRnVuY3Rpb24oeCkge1xuXHQgICAgICByZXR1cm4gdHlwZW9mIHggPT09ICdmdW5jdGlvbic7XG5cdCAgICB9XG5cblx0ICAgIHZhciBfaXNBcnJheSA9IHZvaWQgMDtcblxuXHQgICAgaWYgKEFycmF5LmlzQXJyYXkpIHtcblx0ICAgICAgX2lzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgX2lzQXJyYXkgPSBmdW5jdGlvbiAoeCkge1xuXHQgICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG5cdCAgICAgIH07XG5cdCAgICB9XG5cblx0ICAgIHZhciBpc0FycmF5ID0gX2lzQXJyYXk7XG5cdCAgICB2YXIgbGVuID0gMDtcblx0ICAgIHZhciB2ZXJ0eE5leHQgPSB2b2lkIDA7XG5cdCAgICB2YXIgY3VzdG9tU2NoZWR1bGVyRm4gPSB2b2lkIDA7XG5cblx0ICAgIHZhciBhc2FwID0gZnVuY3Rpb24gYXNhcChjYWxsYmFjaywgYXJnKSB7XG5cdCAgICAgIHF1ZXVlW2xlbl0gPSBjYWxsYmFjaztcblx0ICAgICAgcXVldWVbbGVuICsgMV0gPSBhcmc7XG5cdCAgICAgIGxlbiArPSAyO1xuXG5cdCAgICAgIGlmIChsZW4gPT09IDIpIHtcblx0ICAgICAgICAvLyBJZiBsZW4gaXMgMiwgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gc2NoZWR1bGUgYW4gYXN5bmMgZmx1c2guXG5cdCAgICAgICAgLy8gSWYgYWRkaXRpb25hbCBjYWxsYmFja3MgYXJlIHF1ZXVlZCBiZWZvcmUgdGhlIHF1ZXVlIGlzIGZsdXNoZWQsIHRoZXlcblx0ICAgICAgICAvLyB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGlzIGZsdXNoIHRoYXQgd2UgYXJlIHNjaGVkdWxpbmcuXG5cdCAgICAgICAgaWYgKGN1c3RvbVNjaGVkdWxlckZuKSB7XG5cdCAgICAgICAgICBjdXN0b21TY2hlZHVsZXJGbihmbHVzaCk7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHNjaGVkdWxlRmx1c2goKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH07XG5cblx0ICAgIGZ1bmN0aW9uIHNldFNjaGVkdWxlcihzY2hlZHVsZUZuKSB7XG5cdCAgICAgIGN1c3RvbVNjaGVkdWxlckZuID0gc2NoZWR1bGVGbjtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gc2V0QXNhcChhc2FwRm4pIHtcblx0ICAgICAgYXNhcCA9IGFzYXBGbjtcblx0ICAgIH1cblxuXHQgICAgdmFyIGJyb3dzZXJXaW5kb3cgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHVuZGVmaW5lZDtcblx0ICAgIHZhciBicm93c2VyR2xvYmFsID0gYnJvd3NlcldpbmRvdyB8fCB7fTtcblx0ICAgIHZhciBCcm93c2VyTXV0YXRpb25PYnNlcnZlciA9IGJyb3dzZXJHbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBicm93c2VyR2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG5cdCAgICB2YXIgaXNOb2RlID0gdHlwZW9mIHNlbGYgPT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiB7fS50b1N0cmluZy5jYWxsKHByb2Nlc3MpID09PSAnW29iamVjdCBwcm9jZXNzXSc7IC8vIHRlc3QgZm9yIHdlYiB3b3JrZXIgYnV0IG5vdCBpbiBJRTEwXG5cblx0ICAgIHZhciBpc1dvcmtlciA9IHR5cGVvZiBVaW50OENsYW1wZWRBcnJheSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGltcG9ydFNjcmlwdHMgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCAhPT0gJ3VuZGVmaW5lZCc7IC8vIG5vZGVcblxuXHQgICAgZnVuY3Rpb24gdXNlTmV4dFRpY2soKSB7XG5cdCAgICAgIC8vIG5vZGUgdmVyc2lvbiAwLjEwLnggZGlzcGxheXMgYSBkZXByZWNhdGlvbiB3YXJuaW5nIHdoZW4gbmV4dFRpY2sgaXMgdXNlZCByZWN1cnNpdmVseVxuXHQgICAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2N1am9qcy93aGVuL2lzc3Vlcy80MTAgZm9yIGRldGFpbHNcblx0ICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICByZXR1cm4gcHJvY2Vzcy5uZXh0VGljayhmbHVzaCk7XG5cdCAgICAgIH07XG5cdCAgICB9IC8vIHZlcnR4XG5cblxuXHQgICAgZnVuY3Rpb24gdXNlVmVydHhUaW1lcigpIHtcblx0ICAgICAgaWYgKHR5cGVvZiB2ZXJ0eE5leHQgIT09ICd1bmRlZmluZWQnKSB7XG5cdCAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgIHZlcnR4TmV4dChmbHVzaCk7XG5cdCAgICAgICAgfTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiB1c2VTZXRUaW1lb3V0KCk7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHVzZU11dGF0aW9uT2JzZXJ2ZXIoKSB7XG5cdCAgICAgIHZhciBpdGVyYXRpb25zID0gMDtcblx0ICAgICAgdmFyIG9ic2VydmVyID0gbmV3IEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKGZsdXNoKTtcblx0ICAgICAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG5cdCAgICAgIG9ic2VydmVyLm9ic2VydmUobm9kZSwge1xuXHQgICAgICAgIGNoYXJhY3RlckRhdGE6IHRydWVcblx0ICAgICAgfSk7XG5cdCAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgbm9kZS5kYXRhID0gaXRlcmF0aW9ucyA9ICsraXRlcmF0aW9ucyAlIDI7XG5cdCAgICAgIH07XG5cdCAgICB9IC8vIHdlYiB3b3JrZXJcblxuXG5cdCAgICBmdW5jdGlvbiB1c2VNZXNzYWdlQ2hhbm5lbCgpIHtcblx0ICAgICAgdmFyIGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcblx0ICAgICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBmbHVzaDtcblx0ICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICByZXR1cm4gY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTtcblx0ICAgICAgfTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gdXNlU2V0VGltZW91dCgpIHtcblx0ICAgICAgLy8gU3RvcmUgc2V0VGltZW91dCByZWZlcmVuY2Ugc28gZXM2LXByb21pc2Ugd2lsbCBiZSB1bmFmZmVjdGVkIGJ5XG5cdCAgICAgIC8vIG90aGVyIGNvZGUgbW9kaWZ5aW5nIHNldFRpbWVvdXQgKGxpa2Ugc2lub24udXNlRmFrZVRpbWVycygpKVxuXHQgICAgICB2YXIgZ2xvYmFsU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG5cdCAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgcmV0dXJuIGdsb2JhbFNldFRpbWVvdXQoZmx1c2gsIDEpO1xuXHQgICAgICB9O1xuXHQgICAgfVxuXG5cdCAgICB2YXIgcXVldWUgPSBuZXcgQXJyYXkoMTAwMCk7XG5cblx0ICAgIGZ1bmN0aW9uIGZsdXNoKCkge1xuXHQgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSAyKSB7XG5cdCAgICAgICAgdmFyIGNhbGxiYWNrID0gcXVldWVbaV07XG5cdCAgICAgICAgdmFyIGFyZyA9IHF1ZXVlW2kgKyAxXTtcblx0ICAgICAgICBjYWxsYmFjayhhcmcpO1xuXHQgICAgICAgIHF1ZXVlW2ldID0gdW5kZWZpbmVkO1xuXHQgICAgICAgIHF1ZXVlW2kgKyAxXSA9IHVuZGVmaW5lZDtcblx0ICAgICAgfVxuXG5cdCAgICAgIGxlbiA9IDA7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGF0dGVtcHRWZXJ0eCgpIHtcblx0ICAgICAgdHJ5IHtcblx0ICAgICAgICB2YXIgdmVydHggPSBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpLnJlcXVpcmUoJ3ZlcnR4Jyk7XG5cblx0ICAgICAgICB2ZXJ0eE5leHQgPSB2ZXJ0eC5ydW5Pbkxvb3AgfHwgdmVydHgucnVuT25Db250ZXh0O1xuXHQgICAgICAgIHJldHVybiB1c2VWZXJ0eFRpbWVyKCk7XG5cdCAgICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgICByZXR1cm4gdXNlU2V0VGltZW91dCgpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHZhciBzY2hlZHVsZUZsdXNoID0gdm9pZCAwOyAvLyBEZWNpZGUgd2hhdCBhc3luYyBtZXRob2QgdG8gdXNlIHRvIHRyaWdnZXJpbmcgcHJvY2Vzc2luZyBvZiBxdWV1ZWQgY2FsbGJhY2tzOlxuXG5cdCAgICBpZiAoaXNOb2RlKSB7XG5cdCAgICAgIHNjaGVkdWxlRmx1c2ggPSB1c2VOZXh0VGljaygpO1xuXHQgICAgfSBlbHNlIGlmIChCcm93c2VyTXV0YXRpb25PYnNlcnZlcikge1xuXHQgICAgICBzY2hlZHVsZUZsdXNoID0gdXNlTXV0YXRpb25PYnNlcnZlcigpO1xuXHQgICAgfSBlbHNlIGlmIChpc1dvcmtlcikge1xuXHQgICAgICBzY2hlZHVsZUZsdXNoID0gdXNlTWVzc2FnZUNoYW5uZWwoKTtcblx0ICAgIH0gZWxzZSBpZiAoYnJvd3NlcldpbmRvdyA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBjb21tb25qc1JlcXVpcmUgPT09ICdmdW5jdGlvbicpIHtcblx0ICAgICAgc2NoZWR1bGVGbHVzaCA9IGF0dGVtcHRWZXJ0eCgpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgc2NoZWR1bGVGbHVzaCA9IHVzZVNldFRpbWVvdXQoKTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gdGhlbihvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuXHQgICAgICB2YXIgcGFyZW50ID0gdGhpcztcblx0ICAgICAgdmFyIGNoaWxkID0gbmV3IHRoaXMuY29uc3RydWN0b3Iobm9vcCk7XG5cblx0ICAgICAgaWYgKGNoaWxkW1BST01JU0VfSURdID09PSB1bmRlZmluZWQpIHtcblx0ICAgICAgICBtYWtlUHJvbWlzZShjaGlsZCk7XG5cdCAgICAgIH1cblxuXHQgICAgICB2YXIgX3N0YXRlID0gcGFyZW50Ll9zdGF0ZTtcblxuXHQgICAgICBpZiAoX3N0YXRlKSB7XG5cdCAgICAgICAgdmFyIGNhbGxiYWNrID0gYXJndW1lbnRzW19zdGF0ZSAtIDFdO1xuXHQgICAgICAgIGFzYXAoZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgcmV0dXJuIGludm9rZUNhbGxiYWNrKF9zdGF0ZSwgY2hpbGQsIGNhbGxiYWNrLCBwYXJlbnQuX3Jlc3VsdCk7XG5cdCAgICAgICAgfSk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBjaGlsZDtcblx0ICAgIH1cblx0ICAgIC8qKlxuXHQgICAgICBgUHJvbWlzZS5yZXNvbHZlYCByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIHJlc29sdmVkIHdpdGggdGhlXG5cdCAgICAgIHBhc3NlZCBgdmFsdWVgLiBJdCBpcyBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cdCAgICBcblx0ICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBsZXQgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdCAgICAgICAgcmVzb2x2ZSgxKTtcblx0ICAgICAgfSk7XG5cdCAgICBcblx0ICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcblx0ICAgICAgICAvLyB2YWx1ZSA9PT0gMVxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgSW5zdGVhZCBvZiB3cml0aW5nIHRoZSBhYm92ZSwgeW91ciBjb2RlIG5vdyBzaW1wbHkgYmVjb21lcyB0aGUgZm9sbG93aW5nOlxuXHQgICAgXG5cdCAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoMSk7XG5cdCAgICBcblx0ICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcblx0ICAgICAgICAvLyB2YWx1ZSA9PT0gMVxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgQG1ldGhvZCByZXNvbHZlXG5cdCAgICAgIEBzdGF0aWNcblx0ICAgICAgQHBhcmFtIHtBbnl9IHZhbHVlIHZhbHVlIHRoYXQgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZXNvbHZlZCB3aXRoXG5cdCAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cblx0ICAgICAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgZnVsZmlsbGVkIHdpdGggdGhlIGdpdmVuXG5cdCAgICAgIGB2YWx1ZWBcblx0ICAgICovXG5cblxuXHQgICAgZnVuY3Rpb24gcmVzb2x2ZSQxKG9iamVjdCkge1xuXHQgICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuXHQgICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG5cdCAgICAgIGlmIChvYmplY3QgJiYgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiYgb2JqZWN0LmNvbnN0cnVjdG9yID09PSBDb25zdHJ1Y3Rvcikge1xuXHQgICAgICAgIHJldHVybiBvYmplY3Q7XG5cdCAgICAgIH1cblxuXHQgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3Rvcihub29wKTtcblx0ICAgICAgcmVzb2x2ZShwcm9taXNlLCBvYmplY3QpO1xuXHQgICAgICByZXR1cm4gcHJvbWlzZTtcblx0ICAgIH1cblxuXHQgICAgdmFyIFBST01JU0VfSUQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoMik7XG5cblx0ICAgIGZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5cdCAgICB2YXIgUEVORElORyA9IHZvaWQgMDtcblx0ICAgIHZhciBGVUxGSUxMRUQgPSAxO1xuXHQgICAgdmFyIFJFSkVDVEVEID0gMjtcblxuXHQgICAgZnVuY3Rpb24gc2VsZkZ1bGZpbGxtZW50KCkge1xuXHQgICAgICByZXR1cm4gbmV3IFR5cGVFcnJvcihcIllvdSBjYW5ub3QgcmVzb2x2ZSBhIHByb21pc2Ugd2l0aCBpdHNlbGZcIik7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGNhbm5vdFJldHVybk93bigpIHtcblx0ICAgICAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoJ0EgcHJvbWlzZXMgY2FsbGJhY2sgY2Fubm90IHJldHVybiB0aGF0IHNhbWUgcHJvbWlzZS4nKTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gdHJ5VGhlbih0aGVuJCQxLCB2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKSB7XG5cdCAgICAgIHRyeSB7XG5cdCAgICAgICAgdGhlbiQkMS5jYWxsKHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpO1xuXHQgICAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgICAgcmV0dXJuIGU7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlLCB0aGVuJCQxKSB7XG5cdCAgICAgIGFzYXAoZnVuY3Rpb24gKHByb21pc2UpIHtcblx0ICAgICAgICB2YXIgc2VhbGVkID0gZmFsc2U7XG5cdCAgICAgICAgdmFyIGVycm9yID0gdHJ5VGhlbih0aGVuJCQxLCB0aGVuYWJsZSwgZnVuY3Rpb24gKHZhbHVlKSB7XG5cdCAgICAgICAgICBpZiAoc2VhbGVkKSB7XG5cdCAgICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgc2VhbGVkID0gdHJ1ZTtcblxuXHQgICAgICAgICAgaWYgKHRoZW5hYmxlICE9PSB2YWx1ZSkge1xuXHQgICAgICAgICAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcblx0ICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcblx0ICAgICAgICAgIGlmIChzZWFsZWQpIHtcblx0ICAgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuXHQgICAgICAgICAgcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG5cdCAgICAgICAgfSwgJ1NldHRsZTogJyArIChwcm9taXNlLl9sYWJlbCB8fCAnIHVua25vd24gcHJvbWlzZScpKTtcblxuXHQgICAgICAgIGlmICghc2VhbGVkICYmIGVycm9yKSB7XG5cdCAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuXHQgICAgICAgICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0sIHByb21pc2UpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBoYW5kbGVPd25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSkge1xuXHQgICAgICBpZiAodGhlbmFibGUuX3N0YXRlID09PSBGVUxGSUxMRUQpIHtcblx0ICAgICAgICBmdWxmaWxsKHByb21pc2UsIHRoZW5hYmxlLl9yZXN1bHQpO1xuXHQgICAgICB9IGVsc2UgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gUkVKRUNURUQpIHtcblx0ICAgICAgICByZWplY3QocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgc3Vic2NyaWJlKHRoZW5hYmxlLCB1bmRlZmluZWQsIGZ1bmN0aW9uICh2YWx1ZSkge1xuXHQgICAgICAgICAgcmV0dXJuIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuXHQgICAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcblx0ICAgICAgICAgIHJldHVybiByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcblx0ICAgICAgICB9KTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4kJDEpIHtcblx0ICAgICAgaWYgKG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IgPT09IHByb21pc2UuY29uc3RydWN0b3IgJiYgdGhlbiQkMSA9PT0gdGhlbiAmJiBtYXliZVRoZW5hYmxlLmNvbnN0cnVjdG9yLnJlc29sdmUgPT09IHJlc29sdmUkMSkge1xuXHQgICAgICAgIGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIGlmICh0aGVuJCQxID09PSB1bmRlZmluZWQpIHtcblx0ICAgICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG5cdCAgICAgICAgfSBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoZW4kJDEpKSB7XG5cdCAgICAgICAgICBoYW5kbGVGb3JlaWduVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSwgdGhlbiQkMSk7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpIHtcblx0ICAgICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG5cdCAgICAgICAgcmVqZWN0KHByb21pc2UsIHNlbGZGdWxmaWxsbWVudCgpKTtcblx0ICAgICAgfSBlbHNlIGlmIChvYmplY3RPckZ1bmN0aW9uKHZhbHVlKSkge1xuXHQgICAgICAgIHZhciB0aGVuJCQxID0gdm9pZCAwO1xuXG5cdCAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgIHRoZW4kJDEgPSB2YWx1ZS50aGVuO1xuXHQgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG5cdCAgICAgICAgICByZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuXHQgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgdmFsdWUsIHRoZW4kJDEpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHB1Ymxpc2hSZWplY3Rpb24ocHJvbWlzZSkge1xuXHQgICAgICBpZiAocHJvbWlzZS5fb25lcnJvcikge1xuXHQgICAgICAgIHByb21pc2UuX29uZXJyb3IocHJvbWlzZS5fcmVzdWx0KTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHB1Ymxpc2gocHJvbWlzZSk7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpIHtcblx0ICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG5cdCAgICAgICAgcmV0dXJuO1xuXHQgICAgICB9XG5cblx0ICAgICAgcHJvbWlzZS5fcmVzdWx0ID0gdmFsdWU7XG5cdCAgICAgIHByb21pc2UuX3N0YXRlID0gRlVMRklMTEVEO1xuXG5cdCAgICAgIGlmIChwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggIT09IDApIHtcblx0ICAgICAgICBhc2FwKHB1Ymxpc2gsIHByb21pc2UpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHJlamVjdChwcm9taXNlLCByZWFzb24pIHtcblx0ICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG5cdCAgICAgICAgcmV0dXJuO1xuXHQgICAgICB9XG5cblx0ICAgICAgcHJvbWlzZS5fc3RhdGUgPSBSRUpFQ1RFRDtcblx0ICAgICAgcHJvbWlzZS5fcmVzdWx0ID0gcmVhc29uO1xuXHQgICAgICBhc2FwKHB1Ymxpc2hSZWplY3Rpb24sIHByb21pc2UpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcblx0ICAgICAgdmFyIF9zdWJzY3JpYmVycyA9IHBhcmVudC5fc3Vic2NyaWJlcnM7XG5cdCAgICAgIHZhciBsZW5ndGggPSBfc3Vic2NyaWJlcnMubGVuZ3RoO1xuXHQgICAgICBwYXJlbnQuX29uZXJyb3IgPSBudWxsO1xuXHQgICAgICBfc3Vic2NyaWJlcnNbbGVuZ3RoXSA9IGNoaWxkO1xuXHQgICAgICBfc3Vic2NyaWJlcnNbbGVuZ3RoICsgRlVMRklMTEVEXSA9IG9uRnVsZmlsbG1lbnQ7XG5cdCAgICAgIF9zdWJzY3JpYmVyc1tsZW5ndGggKyBSRUpFQ1RFRF0gPSBvblJlamVjdGlvbjtcblxuXHQgICAgICBpZiAobGVuZ3RoID09PSAwICYmIHBhcmVudC5fc3RhdGUpIHtcblx0ICAgICAgICBhc2FwKHB1Ymxpc2gsIHBhcmVudCk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gcHVibGlzaChwcm9taXNlKSB7XG5cdCAgICAgIHZhciBzdWJzY3JpYmVycyA9IHByb21pc2UuX3N1YnNjcmliZXJzO1xuXHQgICAgICB2YXIgc2V0dGxlZCA9IHByb21pc2UuX3N0YXRlO1xuXG5cdCAgICAgIGlmIChzdWJzY3JpYmVycy5sZW5ndGggPT09IDApIHtcblx0ICAgICAgICByZXR1cm47XG5cdCAgICAgIH1cblxuXHQgICAgICB2YXIgY2hpbGQgPSB2b2lkIDAsXG5cdCAgICAgICAgICBjYWxsYmFjayA9IHZvaWQgMCxcblx0ICAgICAgICAgIGRldGFpbCA9IHByb21pc2UuX3Jlc3VsdDtcblxuXHQgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YnNjcmliZXJzLmxlbmd0aDsgaSArPSAzKSB7XG5cdCAgICAgICAgY2hpbGQgPSBzdWJzY3JpYmVyc1tpXTtcblx0ICAgICAgICBjYWxsYmFjayA9IHN1YnNjcmliZXJzW2kgKyBzZXR0bGVkXTtcblxuXHQgICAgICAgIGlmIChjaGlsZCkge1xuXHQgICAgICAgICAgaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwpO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBjYWxsYmFjayhkZXRhaWwpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCA9IDA7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIHByb21pc2UsIGNhbGxiYWNrLCBkZXRhaWwpIHtcblx0ICAgICAgdmFyIGhhc0NhbGxiYWNrID0gaXNGdW5jdGlvbihjYWxsYmFjayksXG5cdCAgICAgICAgICB2YWx1ZSA9IHZvaWQgMCxcblx0ICAgICAgICAgIGVycm9yID0gdm9pZCAwLFxuXHQgICAgICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcblxuXHQgICAgICBpZiAoaGFzQ2FsbGJhY2spIHtcblx0ICAgICAgICB0cnkge1xuXHQgICAgICAgICAgdmFsdWUgPSBjYWxsYmFjayhkZXRhaWwpO1xuXHQgICAgICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgICAgIHN1Y2NlZWRlZCA9IGZhbHNlO1xuXHQgICAgICAgICAgZXJyb3IgPSBlO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuXHQgICAgICAgICAgcmVqZWN0KHByb21pc2UsIGNhbm5vdFJldHVybk93bigpKTtcblx0ICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICB9XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgdmFsdWUgPSBkZXRhaWw7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIDsgZWxzZSBpZiAoaGFzQ2FsbGJhY2sgJiYgc3VjY2VlZGVkKSB7XG5cdCAgICAgICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG5cdCAgICAgIH0gZWxzZSBpZiAoc3VjY2VlZGVkID09PSBmYWxzZSkge1xuXHQgICAgICAgIHJlamVjdChwcm9taXNlLCBlcnJvcik7XG5cdCAgICAgIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gRlVMRklMTEVEKSB7XG5cdCAgICAgICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG5cdCAgICAgIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gUkVKRUNURUQpIHtcblx0ICAgICAgICByZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGluaXRpYWxpemVQcm9taXNlKHByb21pc2UsIHJlc29sdmVyKSB7XG5cdCAgICAgIHRyeSB7XG5cdCAgICAgICAgcmVzb2x2ZXIoZnVuY3Rpb24gcmVzb2x2ZVByb21pc2UodmFsdWUpIHtcblx0ICAgICAgICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuXHQgICAgICAgIH0sIGZ1bmN0aW9uIHJlamVjdFByb21pc2UocmVhc29uKSB7XG5cdCAgICAgICAgICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcblx0ICAgICAgICB9KTtcblx0ICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgIHJlamVjdChwcm9taXNlLCBlKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICB2YXIgaWQgPSAwO1xuXG5cdCAgICBmdW5jdGlvbiBuZXh0SWQoKSB7XG5cdCAgICAgIHJldHVybiBpZCsrO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBtYWtlUHJvbWlzZShwcm9taXNlKSB7XG5cdCAgICAgIHByb21pc2VbUFJPTUlTRV9JRF0gPSBpZCsrO1xuXHQgICAgICBwcm9taXNlLl9zdGF0ZSA9IHVuZGVmaW5lZDtcblx0ICAgICAgcHJvbWlzZS5fcmVzdWx0ID0gdW5kZWZpbmVkO1xuXHQgICAgICBwcm9taXNlLl9zdWJzY3JpYmVycyA9IFtdO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiB2YWxpZGF0aW9uRXJyb3IoKSB7XG5cdCAgICAgIHJldHVybiBuZXcgRXJyb3IoJ0FycmF5IE1ldGhvZHMgbXVzdCBiZSBwcm92aWRlZCBhbiBBcnJheScpO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgRW51bWVyYXRvciA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgZnVuY3Rpb24gRW51bWVyYXRvcihDb25zdHJ1Y3RvciwgaW5wdXQpIHtcblx0ICAgICAgICB0aGlzLl9pbnN0YW5jZUNvbnN0cnVjdG9yID0gQ29uc3RydWN0b3I7XG5cdCAgICAgICAgdGhpcy5wcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKG5vb3ApO1xuXG5cdCAgICAgICAgaWYgKCF0aGlzLnByb21pc2VbUFJPTUlTRV9JRF0pIHtcblx0ICAgICAgICAgIG1ha2VQcm9taXNlKHRoaXMucHJvbWlzZSk7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaWYgKGlzQXJyYXkoaW5wdXQpKSB7XG5cdCAgICAgICAgICB0aGlzLmxlbmd0aCA9IGlucHV0Lmxlbmd0aDtcblx0ICAgICAgICAgIHRoaXMuX3JlbWFpbmluZyA9IGlucHV0Lmxlbmd0aDtcblx0ICAgICAgICAgIHRoaXMuX3Jlc3VsdCA9IG5ldyBBcnJheSh0aGlzLmxlbmd0aCk7XG5cblx0ICAgICAgICAgIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkge1xuXHQgICAgICAgICAgICBmdWxmaWxsKHRoaXMucHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcblx0ICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgIHRoaXMubGVuZ3RoID0gdGhpcy5sZW5ndGggfHwgMDtcblxuXHQgICAgICAgICAgICB0aGlzLl9lbnVtZXJhdGUoaW5wdXQpO1xuXG5cdCAgICAgICAgICAgIGlmICh0aGlzLl9yZW1haW5pbmcgPT09IDApIHtcblx0ICAgICAgICAgICAgICBmdWxmaWxsKHRoaXMucHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICByZWplY3QodGhpcy5wcm9taXNlLCB2YWxpZGF0aW9uRXJyb3IoKSk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgRW51bWVyYXRvci5wcm90b3R5cGUuX2VudW1lcmF0ZSA9IGZ1bmN0aW9uIF9lbnVtZXJhdGUoaW5wdXQpIHtcblx0ICAgICAgICBmb3IgKHZhciBpID0gMDsgdGhpcy5fc3RhdGUgPT09IFBFTkRJTkcgJiYgaSA8IGlucHV0Lmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICB0aGlzLl9lYWNoRW50cnkoaW5wdXRbaV0sIGkpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfTtcblxuXHQgICAgICBFbnVtZXJhdG9yLnByb3RvdHlwZS5fZWFjaEVudHJ5ID0gZnVuY3Rpb24gX2VhY2hFbnRyeShlbnRyeSwgaSkge1xuXHQgICAgICAgIHZhciBjID0gdGhpcy5faW5zdGFuY2VDb25zdHJ1Y3Rvcjtcblx0ICAgICAgICB2YXIgcmVzb2x2ZSQkMSA9IGMucmVzb2x2ZTtcblxuXHQgICAgICAgIGlmIChyZXNvbHZlJCQxID09PSByZXNvbHZlJDEpIHtcblx0ICAgICAgICAgIHZhciBfdGhlbiA9IHZvaWQgMDtcblxuXHQgICAgICAgICAgdmFyIGVycm9yID0gdm9pZCAwO1xuXHQgICAgICAgICAgdmFyIGRpZEVycm9yID0gZmFsc2U7XG5cblx0ICAgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICAgIF90aGVuID0gZW50cnkudGhlbjtcblx0ICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgICAgICAgZGlkRXJyb3IgPSB0cnVlO1xuXHQgICAgICAgICAgICBlcnJvciA9IGU7XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIGlmIChfdGhlbiA9PT0gdGhlbiAmJiBlbnRyeS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcblx0ICAgICAgICAgICAgdGhpcy5fc2V0dGxlZEF0KGVudHJ5Ll9zdGF0ZSwgaSwgZW50cnkuX3Jlc3VsdCk7XG5cdCAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBfdGhlbiAhPT0gJ2Z1bmN0aW9uJykge1xuXHQgICAgICAgICAgICB0aGlzLl9yZW1haW5pbmctLTtcblx0ICAgICAgICAgICAgdGhpcy5fcmVzdWx0W2ldID0gZW50cnk7XG5cdCAgICAgICAgICB9IGVsc2UgaWYgKGMgPT09IFByb21pc2UkMSkge1xuXHQgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBjKG5vb3ApO1xuXG5cdCAgICAgICAgICAgIGlmIChkaWRFcnJvcikge1xuXHQgICAgICAgICAgICAgIHJlamVjdChwcm9taXNlLCBlcnJvcik7XG5cdCAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCBlbnRyeSwgX3RoZW4pO1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KHByb21pc2UsIGkpO1xuXHQgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KG5ldyBjKGZ1bmN0aW9uIChyZXNvbHZlJCQxKSB7XG5cdCAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUkJDEoZW50cnkpO1xuXHQgICAgICAgICAgICB9KSwgaSk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChyZXNvbHZlJCQxKGVudHJ5KSwgaSk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9O1xuXG5cdCAgICAgIEVudW1lcmF0b3IucHJvdG90eXBlLl9zZXR0bGVkQXQgPSBmdW5jdGlvbiBfc2V0dGxlZEF0KHN0YXRlLCBpLCB2YWx1ZSkge1xuXHQgICAgICAgIHZhciBwcm9taXNlID0gdGhpcy5wcm9taXNlO1xuXG5cdCAgICAgICAgaWYgKHByb21pc2UuX3N0YXRlID09PSBQRU5ESU5HKSB7XG5cdCAgICAgICAgICB0aGlzLl9yZW1haW5pbmctLTtcblxuXHQgICAgICAgICAgaWYgKHN0YXRlID09PSBSRUpFQ1RFRCkge1xuXHQgICAgICAgICAgICByZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuXHQgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgdGhpcy5fcmVzdWx0W2ldID0gdmFsdWU7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaWYgKHRoaXMuX3JlbWFpbmluZyA9PT0gMCkge1xuXHQgICAgICAgICAgZnVsZmlsbChwcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfTtcblxuXHQgICAgICBFbnVtZXJhdG9yLnByb3RvdHlwZS5fd2lsbFNldHRsZUF0ID0gZnVuY3Rpb24gX3dpbGxTZXR0bGVBdChwcm9taXNlLCBpKSB7XG5cdCAgICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuXHQgICAgICAgIHN1YnNjcmliZShwcm9taXNlLCB1bmRlZmluZWQsIGZ1bmN0aW9uICh2YWx1ZSkge1xuXHQgICAgICAgICAgcmV0dXJuIGVudW1lcmF0b3IuX3NldHRsZWRBdChGVUxGSUxMRUQsIGksIHZhbHVlKTtcblx0ICAgICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgICAgICAgICByZXR1cm4gZW51bWVyYXRvci5fc2V0dGxlZEF0KFJFSkVDVEVELCBpLCByZWFzb24pO1xuXHQgICAgICAgIH0pO1xuXHQgICAgICB9O1xuXG5cdCAgICAgIHJldHVybiBFbnVtZXJhdG9yO1xuXHQgICAgfSgpO1xuXHQgICAgLyoqXG5cdCAgICAgIGBQcm9taXNlLmFsbGAgYWNjZXB0cyBhbiBhcnJheSBvZiBwcm9taXNlcywgYW5kIHJldHVybnMgYSBuZXcgcHJvbWlzZSB3aGljaFxuXHQgICAgICBpcyBmdWxmaWxsZWQgd2l0aCBhbiBhcnJheSBvZiBmdWxmaWxsbWVudCB2YWx1ZXMgZm9yIHRoZSBwYXNzZWQgcHJvbWlzZXMsIG9yXG5cdCAgICAgIHJlamVjdGVkIHdpdGggdGhlIHJlYXNvbiBvZiB0aGUgZmlyc3QgcGFzc2VkIHByb21pc2UgdG8gYmUgcmVqZWN0ZWQuIEl0IGNhc3RzIGFsbFxuXHQgICAgICBlbGVtZW50cyBvZiB0aGUgcGFzc2VkIGl0ZXJhYmxlIHRvIHByb21pc2VzIGFzIGl0IHJ1bnMgdGhpcyBhbGdvcml0aG0uXG5cdCAgICBcblx0ICAgICAgRXhhbXBsZTpcblx0ICAgIFxuXHQgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGxldCBwcm9taXNlMSA9IHJlc29sdmUoMSk7XG5cdCAgICAgIGxldCBwcm9taXNlMiA9IHJlc29sdmUoMik7XG5cdCAgICAgIGxldCBwcm9taXNlMyA9IHJlc29sdmUoMyk7XG5cdCAgICAgIGxldCBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXHQgICAgXG5cdCAgICAgIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcblx0ICAgICAgICAvLyBUaGUgYXJyYXkgaGVyZSB3b3VsZCBiZSBbIDEsIDIsIDMgXTtcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIElmIGFueSBvZiB0aGUgYHByb21pc2VzYCBnaXZlbiB0byBgYWxsYCBhcmUgcmVqZWN0ZWQsIHRoZSBmaXJzdCBwcm9taXNlXG5cdCAgICAgIHRoYXQgaXMgcmVqZWN0ZWQgd2lsbCBiZSBnaXZlbiBhcyBhbiBhcmd1bWVudCB0byB0aGUgcmV0dXJuZWQgcHJvbWlzZXMnc1xuXHQgICAgICByZWplY3Rpb24gaGFuZGxlci4gRm9yIGV4YW1wbGU6XG5cdCAgICBcblx0ICAgICAgRXhhbXBsZTpcblx0ICAgIFxuXHQgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGxldCBwcm9taXNlMSA9IHJlc29sdmUoMSk7XG5cdCAgICAgIGxldCBwcm9taXNlMiA9IHJlamVjdChuZXcgRXJyb3IoXCIyXCIpKTtcblx0ICAgICAgbGV0IHByb21pc2UzID0gcmVqZWN0KG5ldyBFcnJvcihcIjNcIikpO1xuXHQgICAgICBsZXQgcHJvbWlzZXMgPSBbIHByb21pc2UxLCBwcm9taXNlMiwgcHJvbWlzZTMgXTtcblx0ICAgIFxuXHQgICAgICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbihhcnJheSl7XG5cdCAgICAgICAgLy8gQ29kZSBoZXJlIG5ldmVyIHJ1bnMgYmVjYXVzZSB0aGVyZSBhcmUgcmVqZWN0ZWQgcHJvbWlzZXMhXG5cdCAgICAgIH0sIGZ1bmN0aW9uKGVycm9yKSB7XG5cdCAgICAgICAgLy8gZXJyb3IubWVzc2FnZSA9PT0gXCIyXCJcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgXG5cdCAgICAgIEBtZXRob2QgYWxsXG5cdCAgICAgIEBzdGF0aWNcblx0ICAgICAgQHBhcmFtIHtBcnJheX0gZW50cmllcyBhcnJheSBvZiBwcm9taXNlc1xuXHQgICAgICBAcGFyYW0ge1N0cmluZ30gbGFiZWwgb3B0aW9uYWwgc3RyaW5nIGZvciBsYWJlbGluZyB0aGUgcHJvbWlzZS5cblx0ICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuXHQgICAgICBAcmV0dXJuIHtQcm9taXNlfSBwcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdoZW4gYWxsIGBwcm9taXNlc2AgaGF2ZSBiZWVuXG5cdCAgICAgIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgaWYgYW55IG9mIHRoZW0gYmVjb21lIHJlamVjdGVkLlxuXHQgICAgICBAc3RhdGljXG5cdCAgICAqL1xuXG5cblx0ICAgIGZ1bmN0aW9uIGFsbChlbnRyaWVzKSB7XG5cdCAgICAgIHJldHVybiBuZXcgRW51bWVyYXRvcih0aGlzLCBlbnRyaWVzKS5wcm9taXNlO1xuXHQgICAgfVxuXHQgICAgLyoqXG5cdCAgICAgIGBQcm9taXNlLnJhY2VgIHJldHVybnMgYSBuZXcgcHJvbWlzZSB3aGljaCBpcyBzZXR0bGVkIGluIHRoZSBzYW1lIHdheSBhcyB0aGVcblx0ICAgICAgZmlyc3QgcGFzc2VkIHByb21pc2UgdG8gc2V0dGxlLlxuXHQgICAgXG5cdCAgICAgIEV4YW1wbGU6XG5cdCAgICBcblx0ICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBsZXQgcHJvbWlzZTEgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHQgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcblx0ICAgICAgICAgIHJlc29sdmUoJ3Byb21pc2UgMScpO1xuXHQgICAgICAgIH0sIDIwMCk7XG5cdCAgICAgIH0pO1xuXHQgICAgXG5cdCAgICAgIGxldCBwcm9taXNlMiA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdCAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuXHQgICAgICAgICAgcmVzb2x2ZSgncHJvbWlzZSAyJyk7XG5cdCAgICAgICAgfSwgMTAwKTtcblx0ICAgICAgfSk7XG5cdCAgICBcblx0ICAgICAgUHJvbWlzZS5yYWNlKFtwcm9taXNlMSwgcHJvbWlzZTJdKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG5cdCAgICAgICAgLy8gcmVzdWx0ID09PSAncHJvbWlzZSAyJyBiZWNhdXNlIGl0IHdhcyByZXNvbHZlZCBiZWZvcmUgcHJvbWlzZTFcblx0ICAgICAgICAvLyB3YXMgcmVzb2x2ZWQuXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBgUHJvbWlzZS5yYWNlYCBpcyBkZXRlcm1pbmlzdGljIGluIHRoYXQgb25seSB0aGUgc3RhdGUgb2YgdGhlIGZpcnN0XG5cdCAgICAgIHNldHRsZWQgcHJvbWlzZSBtYXR0ZXJzLiBGb3IgZXhhbXBsZSwgZXZlbiBpZiBvdGhlciBwcm9taXNlcyBnaXZlbiB0byB0aGVcblx0ICAgICAgYHByb21pc2VzYCBhcnJheSBhcmd1bWVudCBhcmUgcmVzb2x2ZWQsIGJ1dCB0aGUgZmlyc3Qgc2V0dGxlZCBwcm9taXNlIGhhc1xuXHQgICAgICBiZWNvbWUgcmVqZWN0ZWQgYmVmb3JlIHRoZSBvdGhlciBwcm9taXNlcyBiZWNhbWUgZnVsZmlsbGVkLCB0aGUgcmV0dXJuZWRcblx0ICAgICAgcHJvbWlzZSB3aWxsIGJlY29tZSByZWplY3RlZDpcblx0ICAgIFxuXHQgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGxldCBwcm9taXNlMSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdCAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuXHQgICAgICAgICAgcmVzb2x2ZSgncHJvbWlzZSAxJyk7XG5cdCAgICAgICAgfSwgMjAwKTtcblx0ICAgICAgfSk7XG5cdCAgICBcblx0ICAgICAgbGV0IHByb21pc2UyID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0ICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG5cdCAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdwcm9taXNlIDInKSk7XG5cdCAgICAgICAgfSwgMTAwKTtcblx0ICAgICAgfSk7XG5cdCAgICBcblx0ICAgICAgUHJvbWlzZS5yYWNlKFtwcm9taXNlMSwgcHJvbWlzZTJdKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG5cdCAgICAgICAgLy8gQ29kZSBoZXJlIG5ldmVyIHJ1bnNcblx0ICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcblx0ICAgICAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ3Byb21pc2UgMicgYmVjYXVzZSBwcm9taXNlIDIgYmVjYW1lIHJlamVjdGVkIGJlZm9yZVxuXHQgICAgICAgIC8vIHByb21pc2UgMSBiZWNhbWUgZnVsZmlsbGVkXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBBbiBleGFtcGxlIHJlYWwtd29ybGQgdXNlIGNhc2UgaXMgaW1wbGVtZW50aW5nIHRpbWVvdXRzOlxuXHQgICAgXG5cdCAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgUHJvbWlzZS5yYWNlKFthamF4KCdmb28uanNvbicpLCB0aW1lb3V0KDUwMDApXSlcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgQG1ldGhvZCByYWNlXG5cdCAgICAgIEBzdGF0aWNcblx0ICAgICAgQHBhcmFtIHtBcnJheX0gcHJvbWlzZXMgYXJyYXkgb2YgcHJvbWlzZXMgdG8gb2JzZXJ2ZVxuXHQgICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG5cdCAgICAgIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB3aGljaCBzZXR0bGVzIGluIHRoZSBzYW1lIHdheSBhcyB0aGUgZmlyc3QgcGFzc2VkXG5cdCAgICAgIHByb21pc2UgdG8gc2V0dGxlLlxuXHQgICAgKi9cblxuXG5cdCAgICBmdW5jdGlvbiByYWNlKGVudHJpZXMpIHtcblx0ICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cblx0ICAgICAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuXHQgICAgICBpZiAoIWlzQXJyYXkoZW50cmllcykpIHtcblx0ICAgICAgICByZXR1cm4gbmV3IENvbnN0cnVjdG9yKGZ1bmN0aW9uIChfLCByZWplY3QpIHtcblx0ICAgICAgICAgIHJldHVybiByZWplY3QobmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhbiBhcnJheSB0byByYWNlLicpKTtcblx0ICAgICAgICB9KTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICByZXR1cm4gbmV3IENvbnN0cnVjdG9yKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0ICAgICAgICAgIHZhciBsZW5ndGggPSBlbnRyaWVzLmxlbmd0aDtcblxuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgICBDb25zdHJ1Y3Rvci5yZXNvbHZlKGVudHJpZXNbaV0pLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9KTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgICAgLyoqXG5cdCAgICAgIGBQcm9taXNlLnJlamVjdGAgcmV0dXJucyBhIHByb21pc2UgcmVqZWN0ZWQgd2l0aCB0aGUgcGFzc2VkIGByZWFzb25gLlxuXHQgICAgICBJdCBpcyBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cdCAgICBcblx0ICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBsZXQgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdCAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignV0hPT1BTJykpO1xuXHQgICAgICB9KTtcblx0ICAgIFxuXHQgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuXHQgICAgICAgIC8vIENvZGUgaGVyZSBkb2Vzbid0IHJ1biBiZWNhdXNlIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkIVxuXHQgICAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuXHQgICAgICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSAnV0hPT1BTJ1xuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgSW5zdGVhZCBvZiB3cml0aW5nIHRoZSBhYm92ZSwgeW91ciBjb2RlIG5vdyBzaW1wbHkgYmVjb21lcyB0aGUgZm9sbG93aW5nOlxuXHQgICAgXG5cdCAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ1dIT09QUycpKTtcblx0ICAgIFxuXHQgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuXHQgICAgICAgIC8vIENvZGUgaGVyZSBkb2Vzbid0IHJ1biBiZWNhdXNlIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkIVxuXHQgICAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuXHQgICAgICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSAnV0hPT1BTJ1xuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgQG1ldGhvZCByZWplY3Rcblx0ICAgICAgQHN0YXRpY1xuXHQgICAgICBAcGFyYW0ge0FueX0gcmVhc29uIHZhbHVlIHRoYXQgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZCB3aXRoLlxuXHQgICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG5cdCAgICAgIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSByZWplY3RlZCB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cblx0ICAgICovXG5cblxuXHQgICAgZnVuY3Rpb24gcmVqZWN0JDEocmVhc29uKSB7XG5cdCAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG5cdCAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cdCAgICAgIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKG5vb3ApO1xuXHQgICAgICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcblx0ICAgICAgcmV0dXJuIHByb21pc2U7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIG5lZWRzUmVzb2x2ZXIoKSB7XG5cdCAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYSByZXNvbHZlciBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlIHByb21pc2UgY29uc3RydWN0b3InKTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gbmVlZHNOZXcoKSB7XG5cdCAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGYWlsZWQgdG8gY29uc3RydWN0ICdQcm9taXNlJzogUGxlYXNlIHVzZSB0aGUgJ25ldycgb3BlcmF0b3IsIHRoaXMgb2JqZWN0IGNvbnN0cnVjdG9yIGNhbm5vdCBiZSBjYWxsZWQgYXMgYSBmdW5jdGlvbi5cIik7XG5cdCAgICB9XG5cdCAgICAvKipcblx0ICAgICAgUHJvbWlzZSBvYmplY3RzIHJlcHJlc2VudCB0aGUgZXZlbnR1YWwgcmVzdWx0IG9mIGFuIGFzeW5jaHJvbm91cyBvcGVyYXRpb24uIFRoZVxuXHQgICAgICBwcmltYXJ5IHdheSBvZiBpbnRlcmFjdGluZyB3aXRoIGEgcHJvbWlzZSBpcyB0aHJvdWdoIGl0cyBgdGhlbmAgbWV0aG9kLCB3aGljaFxuXHQgICAgICByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZSByZWFzb25cblx0ICAgICAgd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG5cdCAgICBcblx0ICAgICAgVGVybWlub2xvZ3lcblx0ICAgICAgLS0tLS0tLS0tLS1cblx0ICAgIFxuXHQgICAgICAtIGBwcm9taXNlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gd2l0aCBhIGB0aGVuYCBtZXRob2Qgd2hvc2UgYmVoYXZpb3IgY29uZm9ybXMgdG8gdGhpcyBzcGVjaWZpY2F0aW9uLlxuXHQgICAgICAtIGB0aGVuYWJsZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHRoYXQgZGVmaW5lcyBhIGB0aGVuYCBtZXRob2QuXG5cdCAgICAgIC0gYHZhbHVlYCBpcyBhbnkgbGVnYWwgSmF2YVNjcmlwdCB2YWx1ZSAoaW5jbHVkaW5nIHVuZGVmaW5lZCwgYSB0aGVuYWJsZSwgb3IgYSBwcm9taXNlKS5cblx0ICAgICAgLSBgZXhjZXB0aW9uYCBpcyBhIHZhbHVlIHRoYXQgaXMgdGhyb3duIHVzaW5nIHRoZSB0aHJvdyBzdGF0ZW1lbnQuXG5cdCAgICAgIC0gYHJlYXNvbmAgaXMgYSB2YWx1ZSB0aGF0IGluZGljYXRlcyB3aHkgYSBwcm9taXNlIHdhcyByZWplY3RlZC5cblx0ICAgICAgLSBgc2V0dGxlZGAgdGhlIGZpbmFsIHJlc3Rpbmcgc3RhdGUgb2YgYSBwcm9taXNlLCBmdWxmaWxsZWQgb3IgcmVqZWN0ZWQuXG5cdCAgICBcblx0ICAgICAgQSBwcm9taXNlIGNhbiBiZSBpbiBvbmUgb2YgdGhyZWUgc3RhdGVzOiBwZW5kaW5nLCBmdWxmaWxsZWQsIG9yIHJlamVjdGVkLlxuXHQgICAgXG5cdCAgICAgIFByb21pc2VzIHRoYXQgYXJlIGZ1bGZpbGxlZCBoYXZlIGEgZnVsZmlsbG1lbnQgdmFsdWUgYW5kIGFyZSBpbiB0aGUgZnVsZmlsbGVkXG5cdCAgICAgIHN0YXRlLiAgUHJvbWlzZXMgdGhhdCBhcmUgcmVqZWN0ZWQgaGF2ZSBhIHJlamVjdGlvbiByZWFzb24gYW5kIGFyZSBpbiB0aGVcblx0ICAgICAgcmVqZWN0ZWQgc3RhdGUuICBBIGZ1bGZpbGxtZW50IHZhbHVlIGlzIG5ldmVyIGEgdGhlbmFibGUuXG5cdCAgICBcblx0ICAgICAgUHJvbWlzZXMgY2FuIGFsc28gYmUgc2FpZCB0byAqcmVzb2x2ZSogYSB2YWx1ZS4gIElmIHRoaXMgdmFsdWUgaXMgYWxzbyBhXG5cdCAgICAgIHByb21pc2UsIHRoZW4gdGhlIG9yaWdpbmFsIHByb21pc2UncyBzZXR0bGVkIHN0YXRlIHdpbGwgbWF0Y2ggdGhlIHZhbHVlJ3Ncblx0ICAgICAgc2V0dGxlZCBzdGF0ZS4gIFNvIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgcmVqZWN0cyB3aWxsXG5cdCAgICAgIGl0c2VsZiByZWplY3QsIGFuZCBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIHdpbGxcblx0ICAgICAgaXRzZWxmIGZ1bGZpbGwuXG5cdCAgICBcblx0ICAgIFxuXHQgICAgICBCYXNpYyBVc2FnZTpcblx0ICAgICAgLS0tLS0tLS0tLS0tXG5cdCAgICBcblx0ICAgICAgYGBganNcblx0ICAgICAgbGV0IHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblx0ICAgICAgICAvLyBvbiBzdWNjZXNzXG5cdCAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG5cdCAgICBcblx0ICAgICAgICAvLyBvbiBmYWlsdXJlXG5cdCAgICAgICAgcmVqZWN0KHJlYXNvbik7XG5cdCAgICAgIH0pO1xuXHQgICAgXG5cdCAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuXHQgICAgICAgIC8vIG9uIGZ1bGZpbGxtZW50XG5cdCAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuXHQgICAgICAgIC8vIG9uIHJlamVjdGlvblxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICBcblx0ICAgICAgQWR2YW5jZWQgVXNhZ2U6XG5cdCAgICAgIC0tLS0tLS0tLS0tLS0tLVxuXHQgICAgXG5cdCAgICAgIFByb21pc2VzIHNoaW5lIHdoZW4gYWJzdHJhY3RpbmcgYXdheSBhc3luY2hyb25vdXMgaW50ZXJhY3Rpb25zIHN1Y2ggYXNcblx0ICAgICAgYFhNTEh0dHBSZXF1ZXN0YHMuXG5cdCAgICBcblx0ICAgICAgYGBganNcblx0ICAgICAgZnVuY3Rpb24gZ2V0SlNPTih1cmwpIHtcblx0ICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0ICAgICAgICAgIGxldCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblx0ICAgIFxuXHQgICAgICAgICAgeGhyLm9wZW4oJ0dFVCcsIHVybCk7XG5cdCAgICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gaGFuZGxlcjtcblx0ICAgICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnanNvbic7XG5cdCAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcblx0ICAgICAgICAgIHhoci5zZW5kKCk7XG5cdCAgICBcblx0ICAgICAgICAgIGZ1bmN0aW9uIGhhbmRsZXIoKSB7XG5cdCAgICAgICAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IHRoaXMuRE9ORSkge1xuXHQgICAgICAgICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gMjAwKSB7XG5cdCAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMucmVzcG9uc2UpO1xuXHQgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdnZXRKU09OOiBgJyArIHVybCArICdgIGZhaWxlZCB3aXRoIHN0YXR1czogWycgKyB0aGlzLnN0YXR1cyArICddJykpO1xuXHQgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfTtcblx0ICAgICAgICB9KTtcblx0ICAgICAgfVxuXHQgICAgXG5cdCAgICAgIGdldEpTT04oJy9wb3N0cy5qc29uJykudGhlbihmdW5jdGlvbihqc29uKSB7XG5cdCAgICAgICAgLy8gb24gZnVsZmlsbG1lbnRcblx0ICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG5cdCAgICAgICAgLy8gb24gcmVqZWN0aW9uXG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBVbmxpa2UgY2FsbGJhY2tzLCBwcm9taXNlcyBhcmUgZ3JlYXQgY29tcG9zYWJsZSBwcmltaXRpdmVzLlxuXHQgICAgXG5cdCAgICAgIGBgYGpzXG5cdCAgICAgIFByb21pc2UuYWxsKFtcblx0ICAgICAgICBnZXRKU09OKCcvcG9zdHMnKSxcblx0ICAgICAgICBnZXRKU09OKCcvY29tbWVudHMnKVxuXHQgICAgICBdKS50aGVuKGZ1bmN0aW9uKHZhbHVlcyl7XG5cdCAgICAgICAgdmFsdWVzWzBdIC8vID0+IHBvc3RzSlNPTlxuXHQgICAgICAgIHZhbHVlc1sxXSAvLyA9PiBjb21tZW50c0pTT05cblx0ICAgIFxuXHQgICAgICAgIHJldHVybiB2YWx1ZXM7XG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgIFxuXHQgICAgICBAY2xhc3MgUHJvbWlzZVxuXHQgICAgICBAcGFyYW0ge0Z1bmN0aW9ufSByZXNvbHZlclxuXHQgICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG5cdCAgICAgIEBjb25zdHJ1Y3RvclxuXHQgICAgKi9cblxuXG5cdCAgICB2YXIgUHJvbWlzZSQxID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICBmdW5jdGlvbiBQcm9taXNlKHJlc29sdmVyKSB7XG5cdCAgICAgICAgdGhpc1tQUk9NSVNFX0lEXSA9IG5leHRJZCgpO1xuXHQgICAgICAgIHRoaXMuX3Jlc3VsdCA9IHRoaXMuX3N0YXRlID0gdW5kZWZpbmVkO1xuXHQgICAgICAgIHRoaXMuX3N1YnNjcmliZXJzID0gW107XG5cblx0ICAgICAgICBpZiAobm9vcCAhPT0gcmVzb2x2ZXIpIHtcblx0ICAgICAgICAgIHR5cGVvZiByZXNvbHZlciAhPT0gJ2Z1bmN0aW9uJyAmJiBuZWVkc1Jlc29sdmVyKCk7XG5cdCAgICAgICAgICB0aGlzIGluc3RhbmNlb2YgUHJvbWlzZSA/IGluaXRpYWxpemVQcm9taXNlKHRoaXMsIHJlc29sdmVyKSA6IG5lZWRzTmV3KCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICAgIC8qKlxuXHQgICAgICBUaGUgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCxcblx0ICAgICAgd2hpY2ggcmVnaXN0ZXJzIGNhbGxiYWNrcyB0byByZWNlaXZlIGVpdGhlciBhIHByb21pc2UncyBldmVudHVhbCB2YWx1ZSBvciB0aGVcblx0ICAgICAgcmVhc29uIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXHQgICAgICAgYGBganNcblx0ICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuXHQgICAgICAgIC8vIHVzZXIgaXMgYXZhaWxhYmxlXG5cdCAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG5cdCAgICAgICAgLy8gdXNlciBpcyB1bmF2YWlsYWJsZSwgYW5kIHlvdSBhcmUgZ2l2ZW4gdGhlIHJlYXNvbiB3aHlcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgICAgQ2hhaW5pbmdcblx0ICAgICAgLS0tLS0tLS1cblx0ICAgICAgIFRoZSByZXR1cm4gdmFsdWUgb2YgYHRoZW5gIGlzIGl0c2VsZiBhIHByb21pc2UuICBUaGlzIHNlY29uZCwgJ2Rvd25zdHJlYW0nXG5cdCAgICAgIHByb21pc2UgaXMgcmVzb2x2ZWQgd2l0aCB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmaXJzdCBwcm9taXNlJ3MgZnVsZmlsbG1lbnRcblx0ICAgICAgb3IgcmVqZWN0aW9uIGhhbmRsZXIsIG9yIHJlamVjdGVkIGlmIHRoZSBoYW5kbGVyIHRocm93cyBhbiBleGNlcHRpb24uXG5cdCAgICAgICBgYGBqc1xuXHQgICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcblx0ICAgICAgICByZXR1cm4gdXNlci5uYW1lO1xuXHQgICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgICAgICAgcmV0dXJuICdkZWZhdWx0IG5hbWUnO1xuXHQgICAgICB9KS50aGVuKGZ1bmN0aW9uICh1c2VyTmFtZSkge1xuXHQgICAgICAgIC8vIElmIGBmaW5kVXNlcmAgZnVsZmlsbGVkLCBgdXNlck5hbWVgIHdpbGwgYmUgdGhlIHVzZXIncyBuYW1lLCBvdGhlcndpc2UgaXRcblx0ICAgICAgICAvLyB3aWxsIGJlIGAnZGVmYXVsdCBuYW1lJ2Bcblx0ICAgICAgfSk7XG5cdCAgICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcblx0ICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jyk7XG5cdCAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcblx0ICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2BmaW5kVXNlcmAgcmVqZWN0ZWQgYW5kIHdlJ3JlIHVuaGFwcHknKTtcblx0ICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcblx0ICAgICAgICAvLyBuZXZlciByZWFjaGVkXG5cdCAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcblx0ICAgICAgICAvLyBpZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHJlYXNvbmAgd2lsbCBiZSAnRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknLlxuXHQgICAgICAgIC8vIElmIGBmaW5kVXNlcmAgcmVqZWN0ZWQsIGByZWFzb25gIHdpbGwgYmUgJ2BmaW5kVXNlcmAgcmVqZWN0ZWQgYW5kIHdlJ3JlIHVuaGFwcHknLlxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICAgIElmIHRoZSBkb3duc3RyZWFtIHByb21pc2UgZG9lcyBub3Qgc3BlY2lmeSBhIHJlamVjdGlvbiBoYW5kbGVyLCByZWplY3Rpb24gcmVhc29ucyB3aWxsIGJlIHByb3BhZ2F0ZWQgZnVydGhlciBkb3duc3RyZWFtLlxuXHQgICAgICAgYGBganNcblx0ICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IFBlZGFnb2dpY2FsRXhjZXB0aW9uKCdVcHN0cmVhbSBlcnJvcicpO1xuXHQgICAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuXHQgICAgICAgIC8vIG5ldmVyIHJlYWNoZWRcblx0ICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcblx0ICAgICAgICAvLyBuZXZlciByZWFjaGVkXG5cdCAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcblx0ICAgICAgICAvLyBUaGUgYFBlZGdhZ29jaWFsRXhjZXB0aW9uYCBpcyBwcm9wYWdhdGVkIGFsbCB0aGUgd2F5IGRvd24gdG8gaGVyZVxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICAgICBBc3NpbWlsYXRpb25cblx0ICAgICAgLS0tLS0tLS0tLS0tXG5cdCAgICAgICBTb21ldGltZXMgdGhlIHZhbHVlIHlvdSB3YW50IHRvIHByb3BhZ2F0ZSB0byBhIGRvd25zdHJlYW0gcHJvbWlzZSBjYW4gb25seSBiZVxuXHQgICAgICByZXRyaWV2ZWQgYXN5bmNocm9ub3VzbHkuIFRoaXMgY2FuIGJlIGFjaGlldmVkIGJ5IHJldHVybmluZyBhIHByb21pc2UgaW4gdGhlXG5cdCAgICAgIGZ1bGZpbGxtZW50IG9yIHJlamVjdGlvbiBoYW5kbGVyLiBUaGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgdGhlbiBiZSBwZW5kaW5nXG5cdCAgICAgIHVudGlsIHRoZSByZXR1cm5lZCBwcm9taXNlIGlzIHNldHRsZWQuIFRoaXMgaXMgY2FsbGVkICphc3NpbWlsYXRpb24qLlxuXHQgICAgICAgYGBganNcblx0ICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG5cdCAgICAgICAgcmV0dXJuIGZpbmRDb21tZW50c0J5QXV0aG9yKHVzZXIpO1xuXHQgICAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuXHQgICAgICAgIC8vIFRoZSB1c2VyJ3MgY29tbWVudHMgYXJlIG5vdyBhdmFpbGFibGVcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgICAgSWYgdGhlIGFzc2ltbGlhdGVkIHByb21pc2UgcmVqZWN0cywgdGhlbiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgYWxzbyByZWplY3QuXG5cdCAgICAgICBgYGBqc1xuXHQgICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcblx0ICAgICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG5cdCAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG5cdCAgICAgICAgLy8gSWYgYGZpbmRDb21tZW50c0J5QXV0aG9yYCBmdWxmaWxscywgd2UnbGwgaGF2ZSB0aGUgdmFsdWUgaGVyZVxuXHQgICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgICAgICAgLy8gSWYgYGZpbmRDb21tZW50c0J5QXV0aG9yYCByZWplY3RzLCB3ZSdsbCBoYXZlIHRoZSByZWFzb24gaGVyZVxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICAgICBTaW1wbGUgRXhhbXBsZVxuXHQgICAgICAtLS0tLS0tLS0tLS0tLVxuXHQgICAgICAgU3luY2hyb25vdXMgRXhhbXBsZVxuXHQgICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBsZXQgcmVzdWx0O1xuXHQgICAgICAgdHJ5IHtcblx0ICAgICAgICByZXN1bHQgPSBmaW5kUmVzdWx0KCk7XG5cdCAgICAgICAgLy8gc3VjY2Vzc1xuXHQgICAgICB9IGNhdGNoKHJlYXNvbikge1xuXHQgICAgICAgIC8vIGZhaWx1cmVcblx0ICAgICAgfVxuXHQgICAgICBgYGBcblx0ICAgICAgIEVycmJhY2sgRXhhbXBsZVxuXHQgICAgICAgYGBganNcblx0ICAgICAgZmluZFJlc3VsdChmdW5jdGlvbihyZXN1bHQsIGVycil7XG5cdCAgICAgICAgaWYgKGVycikge1xuXHQgICAgICAgICAgLy8gZmFpbHVyZVxuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAvLyBzdWNjZXNzXG5cdCAgICAgICAgfVxuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICAgICBQcm9taXNlIEV4YW1wbGU7XG5cdCAgICAgICBgYGBqYXZhc2NyaXB0XG5cdCAgICAgIGZpbmRSZXN1bHQoKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG5cdCAgICAgICAgLy8gc3VjY2Vzc1xuXHQgICAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuXHQgICAgICAgIC8vIGZhaWx1cmVcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgICAgQWR2YW5jZWQgRXhhbXBsZVxuXHQgICAgICAtLS0tLS0tLS0tLS0tLVxuXHQgICAgICAgU3luY2hyb25vdXMgRXhhbXBsZVxuXHQgICAgICAgYGBgamF2YXNjcmlwdFxuXHQgICAgICBsZXQgYXV0aG9yLCBib29rcztcblx0ICAgICAgIHRyeSB7XG5cdCAgICAgICAgYXV0aG9yID0gZmluZEF1dGhvcigpO1xuXHQgICAgICAgIGJvb2tzICA9IGZpbmRCb29rc0J5QXV0aG9yKGF1dGhvcik7XG5cdCAgICAgICAgLy8gc3VjY2Vzc1xuXHQgICAgICB9IGNhdGNoKHJlYXNvbikge1xuXHQgICAgICAgIC8vIGZhaWx1cmVcblx0ICAgICAgfVxuXHQgICAgICBgYGBcblx0ICAgICAgIEVycmJhY2sgRXhhbXBsZVxuXHQgICAgICAgYGBganNcblx0ICAgICAgIGZ1bmN0aW9uIGZvdW5kQm9va3MoYm9va3MpIHtcblx0ICAgICAgIH1cblx0ICAgICAgIGZ1bmN0aW9uIGZhaWx1cmUocmVhc29uKSB7XG5cdCAgICAgICB9XG5cdCAgICAgICBmaW5kQXV0aG9yKGZ1bmN0aW9uKGF1dGhvciwgZXJyKXtcblx0ICAgICAgICBpZiAoZXJyKSB7XG5cdCAgICAgICAgICBmYWlsdXJlKGVycik7XG5cdCAgICAgICAgICAvLyBmYWlsdXJlXG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICAgIGZpbmRCb29va3NCeUF1dGhvcihhdXRob3IsIGZ1bmN0aW9uKGJvb2tzLCBlcnIpIHtcblx0ICAgICAgICAgICAgICBpZiAoZXJyKSB7XG5cdCAgICAgICAgICAgICAgICBmYWlsdXJlKGVycik7XG5cdCAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICAgICAgICAgIGZvdW5kQm9va3MoYm9va3MpO1xuXHQgICAgICAgICAgICAgICAgfSBjYXRjaChyZWFzb24pIHtcblx0ICAgICAgICAgICAgICAgICAgZmFpbHVyZShyZWFzb24pO1xuXHQgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XG5cdCAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICAgIC8vIHN1Y2Nlc3Ncblx0ICAgICAgICB9XG5cdCAgICAgIH0pO1xuXHQgICAgICBgYGBcblx0ICAgICAgIFByb21pc2UgRXhhbXBsZTtcblx0ICAgICAgIGBgYGphdmFzY3JpcHRcblx0ICAgICAgZmluZEF1dGhvcigpLlxuXHQgICAgICAgIHRoZW4oZmluZEJvb2tzQnlBdXRob3IpLlxuXHQgICAgICAgIHRoZW4oZnVuY3Rpb24oYm9va3Mpe1xuXHQgICAgICAgICAgLy8gZm91bmQgYm9va3Ncblx0ICAgICAgfSkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcblx0ICAgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuXHQgICAgICB9KTtcblx0ICAgICAgYGBgXG5cdCAgICAgICBAbWV0aG9kIHRoZW5cblx0ICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gb25GdWxmaWxsZWRcblx0ICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZFxuXHQgICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG5cdCAgICAgIEByZXR1cm4ge1Byb21pc2V9XG5cdCAgICAgICovXG5cblx0ICAgICAgLyoqXG5cdCAgICAgIGBjYXRjaGAgaXMgc2ltcGx5IHN1Z2FyIGZvciBgdGhlbih1bmRlZmluZWQsIG9uUmVqZWN0aW9uKWAgd2hpY2ggbWFrZXMgaXQgdGhlIHNhbWVcblx0ICAgICAgYXMgdGhlIGNhdGNoIGJsb2NrIG9mIGEgdHJ5L2NhdGNoIHN0YXRlbWVudC5cblx0ICAgICAgYGBganNcblx0ICAgICAgZnVuY3Rpb24gZmluZEF1dGhvcigpe1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvdWxkbid0IGZpbmQgdGhhdCBhdXRob3InKTtcblx0ICAgICAgfVxuXHQgICAgICAvLyBzeW5jaHJvbm91c1xuXHQgICAgICB0cnkge1xuXHQgICAgICBmaW5kQXV0aG9yKCk7XG5cdCAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG5cdCAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG5cdCAgICAgIH1cblx0ICAgICAgLy8gYXN5bmMgd2l0aCBwcm9taXNlc1xuXHQgICAgICBmaW5kQXV0aG9yKCkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcblx0ICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3Jvbmdcblx0ICAgICAgfSk7XG5cdCAgICAgIGBgYFxuXHQgICAgICBAbWV0aG9kIGNhdGNoXG5cdCAgICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0aW9uXG5cdCAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cblx0ICAgICAgQHJldHVybiB7UHJvbWlzZX1cblx0ICAgICAgKi9cblxuXG5cdCAgICAgIFByb21pc2UucHJvdG90eXBlLmNhdGNoID0gZnVuY3Rpb24gX2NhdGNoKG9uUmVqZWN0aW9uKSB7XG5cdCAgICAgICAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGlvbik7XG5cdCAgICAgIH07XG5cdCAgICAgIC8qKlxuXHQgICAgICAgIGBmaW5hbGx5YCB3aWxsIGJlIGludm9rZWQgcmVnYXJkbGVzcyBvZiB0aGUgcHJvbWlzZSdzIGZhdGUganVzdCBhcyBuYXRpdmVcblx0ICAgICAgICB0cnkvY2F0Y2gvZmluYWxseSBiZWhhdmVzXG5cdCAgICAgIFxuXHQgICAgICAgIFN5bmNocm9ub3VzIGV4YW1wbGU6XG5cdCAgICAgIFxuXHQgICAgICAgIGBgYGpzXG5cdCAgICAgICAgZmluZEF1dGhvcigpIHtcblx0ICAgICAgICAgIGlmIChNYXRoLnJhbmRvbSgpID4gMC41KSB7XG5cdCAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgICAgcmV0dXJuIG5ldyBBdXRob3IoKTtcblx0ICAgICAgICB9XG5cdCAgICAgIFxuXHQgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICByZXR1cm4gZmluZEF1dGhvcigpOyAvLyBzdWNjZWVkIG9yIGZhaWxcblx0ICAgICAgICB9IGNhdGNoKGVycm9yKSB7XG5cdCAgICAgICAgICByZXR1cm4gZmluZE90aGVyQXV0aGVyKCk7XG5cdCAgICAgICAgfSBmaW5hbGx5IHtcblx0ICAgICAgICAgIC8vIGFsd2F5cyBydW5zXG5cdCAgICAgICAgICAvLyBkb2Vzbid0IGFmZmVjdCB0aGUgcmV0dXJuIHZhbHVlXG5cdCAgICAgICAgfVxuXHQgICAgICAgIGBgYFxuXHQgICAgICBcblx0ICAgICAgICBBc3luY2hyb25vdXMgZXhhbXBsZTpcblx0ICAgICAgXG5cdCAgICAgICAgYGBganNcblx0ICAgICAgICBmaW5kQXV0aG9yKCkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcblx0ICAgICAgICAgIHJldHVybiBmaW5kT3RoZXJBdXRoZXIoKTtcblx0ICAgICAgICB9KS5maW5hbGx5KGZ1bmN0aW9uKCl7XG5cdCAgICAgICAgICAvLyBhdXRob3Igd2FzIGVpdGhlciBmb3VuZCwgb3Igbm90XG5cdCAgICAgICAgfSk7XG5cdCAgICAgICAgYGBgXG5cdCAgICAgIFxuXHQgICAgICAgIEBtZXRob2QgZmluYWxseVxuXHQgICAgICAgIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG5cdCAgICAgICAgQHJldHVybiB7UHJvbWlzZX1cblx0ICAgICAgKi9cblxuXG5cdCAgICAgIFByb21pc2UucHJvdG90eXBlLmZpbmFsbHkgPSBmdW5jdGlvbiBfZmluYWxseShjYWxsYmFjaykge1xuXHQgICAgICAgIHZhciBwcm9taXNlID0gdGhpcztcblx0ICAgICAgICB2YXIgY29uc3RydWN0b3IgPSBwcm9taXNlLmNvbnN0cnVjdG9yO1xuXG5cdCAgICAgICAgaWYgKGlzRnVuY3Rpb24oY2FsbGJhY2spKSB7XG5cdCAgICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuXHQgICAgICAgICAgICByZXR1cm4gY29uc3RydWN0b3IucmVzb2x2ZShjYWxsYmFjaygpKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XG5cdCAgICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuXHQgICAgICAgICAgICByZXR1cm4gY29uc3RydWN0b3IucmVzb2x2ZShjYWxsYmFjaygpKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgICB0aHJvdyByZWFzb247XG5cdCAgICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgfSk7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgcmV0dXJuIHByb21pc2UudGhlbihjYWxsYmFjaywgY2FsbGJhY2spO1xuXHQgICAgICB9O1xuXG5cdCAgICAgIHJldHVybiBQcm9taXNlO1xuXHQgICAgfSgpO1xuXG5cdCAgICBQcm9taXNlJDEucHJvdG90eXBlLnRoZW4gPSB0aGVuO1xuXHQgICAgUHJvbWlzZSQxLmFsbCA9IGFsbDtcblx0ICAgIFByb21pc2UkMS5yYWNlID0gcmFjZTtcblx0ICAgIFByb21pc2UkMS5yZXNvbHZlID0gcmVzb2x2ZSQxO1xuXHQgICAgUHJvbWlzZSQxLnJlamVjdCA9IHJlamVjdCQxO1xuXHQgICAgUHJvbWlzZSQxLl9zZXRTY2hlZHVsZXIgPSBzZXRTY2hlZHVsZXI7XG5cdCAgICBQcm9taXNlJDEuX3NldEFzYXAgPSBzZXRBc2FwO1xuXHQgICAgUHJvbWlzZSQxLl9hc2FwID0gYXNhcDtcblx0ICAgIC8qZ2xvYmFsIHNlbGYqL1xuXG5cdCAgICBmdW5jdGlvbiBwb2x5ZmlsbCgpIHtcblx0ICAgICAgdmFyIGxvY2FsID0gdm9pZCAwO1xuXG5cdCAgICAgIGlmICh0eXBlb2YgY29tbW9uanNHbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG5cdCAgICAgICAgbG9jYWwgPSBjb21tb25qc0dsb2JhbDtcblx0ICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0ICAgICAgICBsb2NhbCA9IHNlbGY7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgIGxvY2FsID0gRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcblx0ICAgICAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHlmaWxsIGZhaWxlZCBiZWNhdXNlIGdsb2JhbCBvYmplY3QgaXMgdW5hdmFpbGFibGUgaW4gdGhpcyBlbnZpcm9ubWVudCcpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHZhciBQID0gbG9jYWwuUHJvbWlzZTtcblxuXHQgICAgICBpZiAoUCkge1xuXHQgICAgICAgIHZhciBwcm9taXNlVG9TdHJpbmcgPSBudWxsO1xuXG5cdCAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgIHByb21pc2VUb1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChQLnJlc29sdmUoKSk7XG5cdCAgICAgICAgfSBjYXRjaCAoZSkgey8vIHNpbGVudGx5IGlnbm9yZWRcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBpZiAocHJvbWlzZVRvU3RyaW5nID09PSAnW29iamVjdCBQcm9taXNlXScgJiYgIVAuY2FzdCkge1xuXHQgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIGxvY2FsLlByb21pc2UgPSBQcm9taXNlJDE7XG5cdCAgICB9IC8vIFN0cmFuZ2UgY29tcGF0Li5cblxuXG5cdCAgICBQcm9taXNlJDEucG9seWZpbGwgPSBwb2x5ZmlsbDtcblx0ICAgIFByb21pc2UkMS5Qcm9taXNlID0gUHJvbWlzZSQxO1xuXHQgICAgcmV0dXJuIFByb21pc2UkMTtcblx0ICB9KTtcblx0fSk7XG5cblx0dmFyIFByb21pc2UkMSA9IHR5cGVvZiBQcm9taXNlICE9PSBcInVuZGVmaW5lZFwiID8gUHJvbWlzZSA6IGVzNlByb21pc2U7XG5cblx0ZnVuY3Rpb24gcmVnaXN0ZXJMb2dnaW5nQ2FsbGJhY2tzKG9iaikge1xuXHQgIHZhciBpLFxuXHQgICAgICBsLFxuXHQgICAgICBrZXksXG5cdCAgICAgIGNhbGxiYWNrTmFtZXMgPSBbXCJiZWdpblwiLCBcImRvbmVcIiwgXCJsb2dcIiwgXCJ0ZXN0U3RhcnRcIiwgXCJ0ZXN0RG9uZVwiLCBcIm1vZHVsZVN0YXJ0XCIsIFwibW9kdWxlRG9uZVwiXTtcblxuXHQgIGZ1bmN0aW9uIHJlZ2lzdGVyTG9nZ2luZ0NhbGxiYWNrKGtleSkge1xuXHQgICAgdmFyIGxvZ2dpbmdDYWxsYmFjayA9IGZ1bmN0aW9uIGxvZ2dpbmdDYWxsYmFjayhjYWxsYmFjaykge1xuXHQgICAgICBpZiAob2JqZWN0VHlwZShjYWxsYmFjaykgIT09IFwiZnVuY3Rpb25cIikge1xuXHQgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlFVbml0IGxvZ2dpbmcgbWV0aG9kcyByZXF1aXJlIGEgY2FsbGJhY2sgZnVuY3Rpb24gYXMgdGhlaXIgZmlyc3QgcGFyYW1ldGVycy5cIik7XG5cdCAgICAgIH1cblxuXHQgICAgICBjb25maWcuY2FsbGJhY2tzW2tleV0ucHVzaChjYWxsYmFjayk7XG5cdCAgICB9O1xuXG5cdCAgICByZXR1cm4gbG9nZ2luZ0NhbGxiYWNrO1xuXHQgIH1cblxuXHQgIGZvciAoaSA9IDAsIGwgPSBjYWxsYmFja05hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHQgICAga2V5ID0gY2FsbGJhY2tOYW1lc1tpXTsgLy8gSW5pdGlhbGl6ZSBrZXkgY29sbGVjdGlvbiBvZiBsb2dnaW5nIGNhbGxiYWNrXG5cblx0ICAgIGlmIChvYmplY3RUeXBlKGNvbmZpZy5jYWxsYmFja3Nba2V5XSkgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0ICAgICAgY29uZmlnLmNhbGxiYWNrc1trZXldID0gW107XG5cdCAgICB9XG5cblx0ICAgIG9ialtrZXldID0gcmVnaXN0ZXJMb2dnaW5nQ2FsbGJhY2soa2V5KTtcblx0ICB9XG5cdH1cblx0ZnVuY3Rpb24gcnVuTG9nZ2luZ0NhbGxiYWNrcyhrZXksIGFyZ3MpIHtcblx0ICB2YXIgY2FsbGJhY2tzID0gY29uZmlnLmNhbGxiYWNrc1trZXldOyAvLyBIYW5kbGluZyAnbG9nJyBjYWxsYmFja3Mgc2VwYXJhdGVseS4gVW5saWtlIHRoZSBvdGhlciBjYWxsYmFja3MsXG5cdCAgLy8gdGhlIGxvZyBjYWxsYmFjayBpcyBub3QgY29udHJvbGxlZCBieSB0aGUgcHJvY2Vzc2luZyBxdWV1ZSxcblx0ICAvLyBidXQgcmF0aGVyIHVzZWQgYnkgYXNzZXJ0cy4gSGVuY2UgdG8gcHJvbWlzZnkgdGhlICdsb2cnIGNhbGxiYWNrXG5cdCAgLy8gd291bGQgbWVhbiBwcm9taXNmeWluZyBlYWNoIHN0ZXAgb2YgYSB0ZXN0XG5cblx0ICBpZiAoa2V5ID09PSBcImxvZ1wiKSB7XG5cdCAgICBjYWxsYmFja3MubWFwKGZ1bmN0aW9uIChjYWxsYmFjaykge1xuXHQgICAgICByZXR1cm4gY2FsbGJhY2soYXJncyk7XG5cdCAgICB9KTtcblx0ICAgIHJldHVybjtcblx0ICB9IC8vIGVuc3VyZSB0aGF0IGVhY2ggY2FsbGJhY2sgaXMgZXhlY3V0ZWQgc2VyaWFsbHlcblxuXG5cdCAgcmV0dXJuIGNhbGxiYWNrcy5yZWR1Y2UoZnVuY3Rpb24gKHByb21pc2VDaGFpbiwgY2FsbGJhY2spIHtcblx0ICAgIHJldHVybiBwcm9taXNlQ2hhaW4udGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHJldHVybiBQcm9taXNlJDEucmVzb2x2ZShjYWxsYmFjayhhcmdzKSk7XG5cdCAgICB9KTtcblx0ICB9LCBQcm9taXNlJDEucmVzb2x2ZShbXSkpO1xuXHR9XG5cblx0Ly8gRG9lc24ndCBzdXBwb3J0IElFOSwgaXQgd2lsbCByZXR1cm4gdW5kZWZpbmVkIG9uIHRoZXNlIGJyb3dzZXJzXG5cdC8vIFNlZSBhbHNvIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0Vycm9yL1N0YWNrXG5cdHZhciBmaWxlTmFtZSA9IChzb3VyY2VGcm9tU3RhY2t0cmFjZSgwKSB8fCBcIlwiKS5yZXBsYWNlKC8oOlxcZCspK1xcKT8vLCBcIlwiKS5yZXBsYWNlKC8uK1xcLy8sIFwiXCIpO1xuXHRmdW5jdGlvbiBleHRyYWN0U3RhY2t0cmFjZShlLCBvZmZzZXQpIHtcblx0ICBvZmZzZXQgPSBvZmZzZXQgPT09IHVuZGVmaW5lZCA/IDQgOiBvZmZzZXQ7XG5cdCAgdmFyIHN0YWNrLCBpbmNsdWRlLCBpO1xuXG5cdCAgaWYgKGUgJiYgZS5zdGFjaykge1xuXHQgICAgc3RhY2sgPSBlLnN0YWNrLnNwbGl0KFwiXFxuXCIpO1xuXG5cdCAgICBpZiAoL15lcnJvciQvaS50ZXN0KHN0YWNrWzBdKSkge1xuXHQgICAgICBzdGFjay5zaGlmdCgpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoZmlsZU5hbWUpIHtcblx0ICAgICAgaW5jbHVkZSA9IFtdO1xuXG5cdCAgICAgIGZvciAoaSA9IG9mZnNldDsgaSA8IHN0YWNrLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgaWYgKHN0YWNrW2ldLmluZGV4T2YoZmlsZU5hbWUpICE9PSAtMSkge1xuXHQgICAgICAgICAgYnJlYWs7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaW5jbHVkZS5wdXNoKHN0YWNrW2ldKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChpbmNsdWRlLmxlbmd0aCkge1xuXHQgICAgICAgIHJldHVybiBpbmNsdWRlLmpvaW4oXCJcXG5cIik7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHN0YWNrW29mZnNldF07XG5cdCAgfVxuXHR9XG5cdGZ1bmN0aW9uIHNvdXJjZUZyb21TdGFja3RyYWNlKG9mZnNldCkge1xuXHQgIHZhciBlcnJvciA9IG5ldyBFcnJvcigpOyAvLyBTdXBwb3J0OiBTYWZhcmkgPD03IG9ubHksIElFIDw9MTAgLSAxMSBvbmx5XG5cdCAgLy8gTm90IGFsbCBicm93c2VycyBnZW5lcmF0ZSB0aGUgYHN0YWNrYCBwcm9wZXJ0eSBmb3IgYG5ldyBFcnJvcigpYCwgc2VlIGFsc28gIzYzNlxuXG5cdCAgaWYgKCFlcnJvci5zdGFjaykge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgdGhyb3cgZXJyb3I7XG5cdCAgICB9IGNhdGNoIChlcnIpIHtcblx0ICAgICAgZXJyb3IgPSBlcnI7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGV4dHJhY3RTdGFja3RyYWNlKGVycm9yLCBvZmZzZXQpO1xuXHR9XG5cblx0dmFyIHByaW9yaXR5Q291bnQgPSAwO1xuXHR2YXIgdW5pdFNhbXBsZXI7IC8vIFRoaXMgaXMgYSBxdWV1ZSBvZiBmdW5jdGlvbnMgdGhhdCBhcmUgdGFza3Mgd2l0aGluIGEgc2luZ2xlIHRlc3QuXG5cdC8vIEFmdGVyIHRlc3RzIGFyZSBkZXF1ZXVlZCBmcm9tIGNvbmZpZy5xdWV1ZSB0aGV5IGFyZSBleHBhbmRlZCBpbnRvXG5cdC8vIGEgc2V0IG9mIHRhc2tzIGluIHRoaXMgcXVldWUuXG5cblx0dmFyIHRhc2tRdWV1ZSA9IFtdO1xuXHQvKipcblx0ICogQWR2YW5jZXMgdGhlIHRhc2tRdWV1ZSB0byB0aGUgbmV4dCB0YXNrLiBJZiB0aGUgdGFza1F1ZXVlIGlzIGVtcHR5LFxuXHQgKiBwcm9jZXNzIHRoZSB0ZXN0UXVldWVcblx0ICovXG5cblx0ZnVuY3Rpb24gYWR2YW5jZSgpIHtcblx0ICBhZHZhbmNlVGFza1F1ZXVlKCk7XG5cblx0ICBpZiAoIXRhc2tRdWV1ZS5sZW5ndGggJiYgIWNvbmZpZy5ibG9ja2luZyAmJiAhY29uZmlnLmN1cnJlbnQpIHtcblx0ICAgIGFkdmFuY2VUZXN0UXVldWUoKTtcblx0ICB9XG5cdH1cblx0LyoqXG5cdCAqIEFkdmFuY2VzIHRoZSB0YXNrUXVldWUgd2l0aCBhbiBpbmNyZWFzZWQgZGVwdGhcblx0ICovXG5cblxuXHRmdW5jdGlvbiBhZHZhbmNlVGFza1F1ZXVlKCkge1xuXHQgIHZhciBzdGFydCA9IG5vdygpO1xuXHQgIGNvbmZpZy5kZXB0aCA9IChjb25maWcuZGVwdGggfHwgMCkgKyAxO1xuXHQgIHByb2Nlc3NUYXNrUXVldWUoc3RhcnQpO1xuXHQgIGNvbmZpZy5kZXB0aC0tO1xuXHR9XG5cdC8qKlxuXHQgKiBQcm9jZXNzIHRoZSBmaXJzdCB0YXNrIG9uIHRoZSB0YXNrUXVldWUgYXMgYSBwcm9taXNlLlxuXHQgKiBFYWNoIHRhc2sgaXMgYSBmdW5jdGlvbiByZXR1cm5lZCBieSBodHRwczovL2dpdGh1Yi5jb20vcXVuaXRqcy9xdW5pdC9ibG9iL21hc3Rlci9zcmMvdGVzdC5qcyNMMzgxXG5cdCAqL1xuXG5cblx0ZnVuY3Rpb24gcHJvY2Vzc1Rhc2tRdWV1ZShzdGFydCkge1xuXHQgIGlmICh0YXNrUXVldWUubGVuZ3RoICYmICFjb25maWcuYmxvY2tpbmcpIHtcblx0ICAgIHZhciBlbGFwc2VkVGltZSA9IG5vdygpIC0gc3RhcnQ7XG5cblx0ICAgIGlmICghZGVmaW5lZC5zZXRUaW1lb3V0IHx8IGNvbmZpZy51cGRhdGVSYXRlIDw9IDAgfHwgZWxhcHNlZFRpbWUgPCBjb25maWcudXBkYXRlUmF0ZSkge1xuXHQgICAgICB2YXIgdGFzayA9IHRhc2tRdWV1ZS5zaGlmdCgpO1xuXHQgICAgICBQcm9taXNlJDEucmVzb2x2ZSh0YXNrKCkpLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIGlmICghdGFza1F1ZXVlLmxlbmd0aCkge1xuXHQgICAgICAgICAgYWR2YW5jZSgpO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBwcm9jZXNzVGFza1F1ZXVlKHN0YXJ0KTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0pO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgc2V0VGltZW91dCQxKGFkdmFuY2UpO1xuXHQgICAgfVxuXHQgIH1cblx0fVxuXHQvKipcblx0ICogQWR2YW5jZSB0aGUgdGVzdFF1ZXVlIHRvIHRoZSBuZXh0IHRlc3QgdG8gcHJvY2Vzcy4gQ2FsbCBkb25lKCkgaWYgdGVzdFF1ZXVlIGNvbXBsZXRlcy5cblx0ICovXG5cblxuXHRmdW5jdGlvbiBhZHZhbmNlVGVzdFF1ZXVlKCkge1xuXHQgIGlmICghY29uZmlnLmJsb2NraW5nICYmICFjb25maWcucXVldWUubGVuZ3RoICYmIGNvbmZpZy5kZXB0aCA9PT0gMCkge1xuXHQgICAgZG9uZSgpO1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHZhciB0ZXN0VGFza3MgPSBjb25maWcucXVldWUuc2hpZnQoKTtcblx0ICBhZGRUb1Rhc2tRdWV1ZSh0ZXN0VGFza3MoKSk7XG5cblx0ICBpZiAocHJpb3JpdHlDb3VudCA+IDApIHtcblx0ICAgIHByaW9yaXR5Q291bnQtLTtcblx0ICB9XG5cblx0ICBhZHZhbmNlKCk7XG5cdH1cblx0LyoqXG5cdCAqIEVucXVldWUgdGhlIHRhc2tzIGZvciBhIHRlc3QgaW50byB0aGUgdGFzayBxdWV1ZS5cblx0ICogQHBhcmFtIHtBcnJheX0gdGFza3NBcnJheVxuXHQgKi9cblxuXG5cdGZ1bmN0aW9uIGFkZFRvVGFza1F1ZXVlKHRhc2tzQXJyYXkpIHtcblx0ICB0YXNrUXVldWUucHVzaC5hcHBseSh0YXNrUXVldWUsIF90b0NvbnN1bWFibGVBcnJheSh0YXNrc0FycmF5KSk7XG5cdH1cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgbnVtYmVyIG9mIHRhc2tzIHJlbWFpbmluZyBpbiB0aGUgdGFzayBxdWV1ZSB0byBiZSBwcm9jZXNzZWQuXG5cdCAqIEByZXR1cm4ge051bWJlcn1cblx0ICovXG5cblxuXHRmdW5jdGlvbiB0YXNrUXVldWVMZW5ndGgoKSB7XG5cdCAgcmV0dXJuIHRhc2tRdWV1ZS5sZW5ndGg7XG5cdH1cblx0LyoqXG5cdCAqIEFkZHMgYSB0ZXN0IHRvIHRoZSBUZXN0UXVldWUgZm9yIGV4ZWN1dGlvbi5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gdGVzdFRhc2tzRnVuY1xuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IHByaW9yaXRpemVcblx0ICogQHBhcmFtIHtTdHJpbmd9IHNlZWRcblx0ICovXG5cblxuXHRmdW5jdGlvbiBhZGRUb1Rlc3RRdWV1ZSh0ZXN0VGFza3NGdW5jLCBwcmlvcml0aXplLCBzZWVkKSB7XG5cdCAgaWYgKHByaW9yaXRpemUpIHtcblx0ICAgIGNvbmZpZy5xdWV1ZS5zcGxpY2UocHJpb3JpdHlDb3VudCsrLCAwLCB0ZXN0VGFza3NGdW5jKTtcblx0ICB9IGVsc2UgaWYgKHNlZWQpIHtcblx0ICAgIGlmICghdW5pdFNhbXBsZXIpIHtcblx0ICAgICAgdW5pdFNhbXBsZXIgPSB1bml0U2FtcGxlckdlbmVyYXRvcihzZWVkKTtcblx0ICAgIH0gLy8gSW5zZXJ0IGludG8gYSByYW5kb20gcG9zaXRpb24gYWZ0ZXIgYWxsIHByaW9yaXRpemVkIGl0ZW1zXG5cblxuXHQgICAgdmFyIGluZGV4ID0gTWF0aC5mbG9vcih1bml0U2FtcGxlcigpICogKGNvbmZpZy5xdWV1ZS5sZW5ndGggLSBwcmlvcml0eUNvdW50ICsgMSkpO1xuXHQgICAgY29uZmlnLnF1ZXVlLnNwbGljZShwcmlvcml0eUNvdW50ICsgaW5kZXgsIDAsIHRlc3RUYXNrc0Z1bmMpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICBjb25maWcucXVldWUucHVzaCh0ZXN0VGFza3NGdW5jKTtcblx0ICB9XG5cdH1cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBzZWVkZWQgXCJzYW1wbGVcIiBnZW5lcmF0b3Igd2hpY2ggaXMgdXNlZCBmb3IgcmFuZG9taXppbmcgdGVzdHMuXG5cdCAqL1xuXG5cblx0ZnVuY3Rpb24gdW5pdFNhbXBsZXJHZW5lcmF0b3Ioc2VlZCkge1xuXHQgIC8vIDMyLWJpdCB4b3JzaGlmdCwgcmVxdWlyZXMgb25seSBhIG5vbnplcm8gc2VlZFxuXHQgIC8vIGh0dHBzOi8vZXhjYW1lcmEuY29tL3NwaGlueC9hcnRpY2xlLXhvcnNoaWZ0Lmh0bWxcblx0ICB2YXIgc2FtcGxlID0gcGFyc2VJbnQoZ2VuZXJhdGVIYXNoKHNlZWQpLCAxNikgfHwgLTE7XG5cdCAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0ICAgIHNhbXBsZSBePSBzYW1wbGUgPDwgMTM7XG5cdCAgICBzYW1wbGUgXj0gc2FtcGxlID4+PiAxNztcblx0ICAgIHNhbXBsZSBePSBzYW1wbGUgPDwgNTsgLy8gRUNNQVNjcmlwdCBoYXMgbm8gdW5zaWduZWQgbnVtYmVyIHR5cGVcblxuXHQgICAgaWYgKHNhbXBsZSA8IDApIHtcblx0ICAgICAgc2FtcGxlICs9IDB4MTAwMDAwMDAwO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gc2FtcGxlIC8gMHgxMDAwMDAwMDA7XG5cdCAgfTtcblx0fVxuXHQvKipcblx0ICogVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2hlbiB0aGUgUHJvY2Vzc2luZ1F1ZXVlIGlzIGRvbmUgcHJvY2Vzc2luZyBhbGxcblx0ICogaXRlbXMuIEl0IGhhbmRsZXMgZW1pdHRpbmcgdGhlIGZpbmFsIHJ1biBldmVudHMuXG5cdCAqL1xuXG5cblx0ZnVuY3Rpb24gZG9uZSgpIHtcblx0ICB2YXIgc3RvcmFnZSA9IGNvbmZpZy5zdG9yYWdlO1xuXHQgIFByb2Nlc3NpbmdRdWV1ZS5maW5pc2hlZCA9IHRydWU7XG5cdCAgdmFyIHJ1bnRpbWUgPSBub3coKSAtIGNvbmZpZy5zdGFydGVkO1xuXHQgIHZhciBwYXNzZWQgPSBjb25maWcuc3RhdHMuYWxsIC0gY29uZmlnLnN0YXRzLmJhZDtcblxuXHQgIGlmIChjb25maWcuc3RhdHMudGVzdENvdW50ID09PSAwKSB7XG5cdCAgICBpZiAoY29uZmlnLmZpbHRlciAmJiBjb25maWcuZmlsdGVyLmxlbmd0aCkge1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyB0ZXN0cyBtYXRjaGVkIHRoZSBmaWx0ZXIgXFxcIlwiLmNvbmNhdChjb25maWcuZmlsdGVyLCBcIlxcXCIuXCIpKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGNvbmZpZy5tb2R1bGUgJiYgY29uZmlnLm1vZHVsZS5sZW5ndGgpIHtcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gdGVzdHMgbWF0Y2hlZCB0aGUgbW9kdWxlIFxcXCJcIi5jb25jYXQoY29uZmlnLm1vZHVsZSwgXCJcXFwiLlwiKSk7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjb25maWcubW9kdWxlSWQgJiYgY29uZmlnLm1vZHVsZUlkLmxlbmd0aCkge1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyB0ZXN0cyBtYXRjaGVkIHRoZSBtb2R1bGVJZCBcXFwiXCIuY29uY2F0KGNvbmZpZy5tb2R1bGVJZCwgXCJcXFwiLlwiKSk7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjb25maWcudGVzdElkICYmIGNvbmZpZy50ZXN0SWQubGVuZ3RoKSB7XG5cdCAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHRlc3RzIG1hdGNoZWQgdGhlIHRlc3RJZCBcXFwiXCIuY29uY2F0KGNvbmZpZy50ZXN0SWQsIFwiXFxcIi5cIikpO1xuXHQgICAgfVxuXG5cdCAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyB0ZXN0cyB3ZXJlIHJ1bi5cIik7XG5cdCAgfVxuXG5cdCAgZW1pdChcInJ1bkVuZFwiLCBnbG9iYWxTdWl0ZS5lbmQodHJ1ZSkpO1xuXHQgIHJ1bkxvZ2dpbmdDYWxsYmFja3MoXCJkb25lXCIsIHtcblx0ICAgIHBhc3NlZDogcGFzc2VkLFxuXHQgICAgZmFpbGVkOiBjb25maWcuc3RhdHMuYmFkLFxuXHQgICAgdG90YWw6IGNvbmZpZy5zdGF0cy5hbGwsXG5cdCAgICBydW50aW1lOiBydW50aW1lXG5cdCAgfSkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICAvLyBDbGVhciBvd24gc3RvcmFnZSBpdGVtcyBpZiBhbGwgdGVzdHMgcGFzc2VkXG5cdCAgICBpZiAoc3RvcmFnZSAmJiBjb25maWcuc3RhdHMuYmFkID09PSAwKSB7XG5cdCAgICAgIGZvciAodmFyIGkgPSBzdG9yYWdlLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdCAgICAgICAgdmFyIGtleSA9IHN0b3JhZ2Uua2V5KGkpO1xuXG5cdCAgICAgICAgaWYgKGtleS5pbmRleE9mKFwicXVuaXQtdGVzdC1cIikgPT09IDApIHtcblx0ICAgICAgICAgIHN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH0pO1xuXHR9XG5cblx0dmFyIFByb2Nlc3NpbmdRdWV1ZSA9IHtcblx0ICBmaW5pc2hlZDogZmFsc2UsXG5cdCAgYWRkOiBhZGRUb1Rlc3RRdWV1ZSxcblx0ICBhZHZhbmNlOiBhZHZhbmNlLFxuXHQgIHRhc2tDb3VudDogdGFza1F1ZXVlTGVuZ3RoXG5cdH07XG5cblx0dmFyIFRlc3RSZXBvcnQgPSAvKiNfX1BVUkVfXyovZnVuY3Rpb24gKCkge1xuXHQgIGZ1bmN0aW9uIFRlc3RSZXBvcnQobmFtZSwgc3VpdGUsIG9wdGlvbnMpIHtcblx0ICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBUZXN0UmVwb3J0KTtcblxuXHQgICAgdGhpcy5uYW1lID0gbmFtZTtcblx0ICAgIHRoaXMuc3VpdGVOYW1lID0gc3VpdGUubmFtZTtcblx0ICAgIHRoaXMuZnVsbE5hbWUgPSBzdWl0ZS5mdWxsTmFtZS5jb25jYXQobmFtZSk7XG5cdCAgICB0aGlzLnJ1bnRpbWUgPSAwO1xuXHQgICAgdGhpcy5hc3NlcnRpb25zID0gW107XG5cdCAgICB0aGlzLnNraXBwZWQgPSAhIW9wdGlvbnMuc2tpcDtcblx0ICAgIHRoaXMudG9kbyA9ICEhb3B0aW9ucy50b2RvO1xuXHQgICAgdGhpcy52YWxpZCA9IG9wdGlvbnMudmFsaWQ7XG5cdCAgICB0aGlzLl9zdGFydFRpbWUgPSAwO1xuXHQgICAgdGhpcy5fZW5kVGltZSA9IDA7XG5cdCAgICBzdWl0ZS5wdXNoVGVzdCh0aGlzKTtcblx0ICB9XG5cblx0ICBfY3JlYXRlQ2xhc3MoVGVzdFJlcG9ydCwgW3tcblx0ICAgIGtleTogXCJzdGFydFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHN0YXJ0KHJlY29yZFRpbWUpIHtcblx0ICAgICAgaWYgKHJlY29yZFRpbWUpIHtcblx0ICAgICAgICB0aGlzLl9zdGFydFRpbWUgPSBwZXJmb3JtYW5jZU5vdygpO1xuXG5cdCAgICAgICAgaWYgKHBlcmZvcm1hbmNlKSB7XG5cdCAgICAgICAgICBwZXJmb3JtYW5jZS5tYXJrKFwicXVuaXRfdGVzdF9zdGFydFwiKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4ge1xuXHQgICAgICAgIG5hbWU6IHRoaXMubmFtZSxcblx0ICAgICAgICBzdWl0ZU5hbWU6IHRoaXMuc3VpdGVOYW1lLFxuXHQgICAgICAgIGZ1bGxOYW1lOiB0aGlzLmZ1bGxOYW1lLnNsaWNlKClcblx0ICAgICAgfTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZW5kXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZW5kKHJlY29yZFRpbWUpIHtcblx0ICAgICAgaWYgKHJlY29yZFRpbWUpIHtcblx0ICAgICAgICB0aGlzLl9lbmRUaW1lID0gcGVyZm9ybWFuY2VOb3coKTtcblxuXHQgICAgICAgIGlmIChwZXJmb3JtYW5jZSkge1xuXHQgICAgICAgICAgcGVyZm9ybWFuY2UubWFyayhcInF1bml0X3Rlc3RfZW5kXCIpO1xuXHQgICAgICAgICAgdmFyIHRlc3ROYW1lID0gdGhpcy5mdWxsTmFtZS5qb2luKFwiIOKAkyBcIik7XG5cdCAgICAgICAgICBtZWFzdXJlKFwiUVVuaXQgVGVzdDogXCIuY29uY2F0KHRlc3ROYW1lKSwgXCJxdW5pdF90ZXN0X3N0YXJ0XCIsIFwicXVuaXRfdGVzdF9lbmRcIik7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIGV4dGVuZCh0aGlzLnN0YXJ0KCksIHtcblx0ICAgICAgICBydW50aW1lOiB0aGlzLmdldFJ1bnRpbWUoKSxcblx0ICAgICAgICBzdGF0dXM6IHRoaXMuZ2V0U3RhdHVzKCksXG5cdCAgICAgICAgZXJyb3JzOiB0aGlzLmdldEZhaWxlZEFzc2VydGlvbnMoKSxcblx0ICAgICAgICBhc3NlcnRpb25zOiB0aGlzLmdldEFzc2VydGlvbnMoKVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwicHVzaEFzc2VydGlvblwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHB1c2hBc3NlcnRpb24oYXNzZXJ0aW9uKSB7XG5cdCAgICAgIHRoaXMuYXNzZXJ0aW9ucy5wdXNoKGFzc2VydGlvbik7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImdldFJ1bnRpbWVcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRSdW50aW1lKCkge1xuXHQgICAgICByZXR1cm4gdGhpcy5fZW5kVGltZSAtIHRoaXMuX3N0YXJ0VGltZTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZ2V0U3RhdHVzXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0U3RhdHVzKCkge1xuXHQgICAgICBpZiAodGhpcy5za2lwcGVkKSB7XG5cdCAgICAgICAgcmV0dXJuIFwic2tpcHBlZFwiO1xuXHQgICAgICB9XG5cblx0ICAgICAgdmFyIHRlc3RQYXNzZWQgPSB0aGlzLmdldEZhaWxlZEFzc2VydGlvbnMoKS5sZW5ndGggPiAwID8gdGhpcy50b2RvIDogIXRoaXMudG9kbztcblxuXHQgICAgICBpZiAoIXRlc3RQYXNzZWQpIHtcblx0ICAgICAgICByZXR1cm4gXCJmYWlsZWRcIjtcblx0ICAgICAgfSBlbHNlIGlmICh0aGlzLnRvZG8pIHtcblx0ICAgICAgICByZXR1cm4gXCJ0b2RvXCI7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmV0dXJuIFwicGFzc2VkXCI7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZ2V0RmFpbGVkQXNzZXJ0aW9uc1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIGdldEZhaWxlZEFzc2VydGlvbnMoKSB7XG5cdCAgICAgIHJldHVybiB0aGlzLmFzc2VydGlvbnMuZmlsdGVyKGZ1bmN0aW9uIChhc3NlcnRpb24pIHtcblx0ICAgICAgICByZXR1cm4gIWFzc2VydGlvbi5wYXNzZWQ7XG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJnZXRBc3NlcnRpb25zXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0QXNzZXJ0aW9ucygpIHtcblx0ICAgICAgcmV0dXJuIHRoaXMuYXNzZXJ0aW9ucy5zbGljZSgpO1xuXHQgICAgfSAvLyBSZW1vdmUgYWN0dWFsIGFuZCBleHBlY3RlZCB2YWx1ZXMgZnJvbSBhc3NlcnRpb25zLiBUaGlzIGlzIHRvIHByZXZlbnRcblx0ICAgIC8vIGxlYWtpbmcgbWVtb3J5IHRocm91Z2hvdXQgYSB0ZXN0IHN1aXRlLlxuXG5cdCAgfSwge1xuXHQgICAga2V5OiBcInNsaW1Bc3NlcnRpb25zXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gc2xpbUFzc2VydGlvbnMoKSB7XG5cdCAgICAgIHRoaXMuYXNzZXJ0aW9ucyA9IHRoaXMuYXNzZXJ0aW9ucy5tYXAoZnVuY3Rpb24gKGFzc2VydGlvbikge1xuXHQgICAgICAgIGRlbGV0ZSBhc3NlcnRpb24uYWN0dWFsO1xuXHQgICAgICAgIGRlbGV0ZSBhc3NlcnRpb24uZXhwZWN0ZWQ7XG5cdCAgICAgICAgcmV0dXJuIGFzc2VydGlvbjtcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfV0pO1xuXG5cdCAgcmV0dXJuIFRlc3RSZXBvcnQ7XG5cdH0oKTtcblxuXHR2YXIgZm9jdXNlZCQxID0gZmFsc2U7XG5cdGZ1bmN0aW9uIFRlc3Qoc2V0dGluZ3MpIHtcblx0ICB2YXIgaSwgbDtcblx0ICArK1Rlc3QuY291bnQ7XG5cdCAgdGhpcy5leHBlY3RlZCA9IG51bGw7XG5cdCAgdGhpcy5hc3NlcnRpb25zID0gW107XG5cdCAgdGhpcy5zZW1hcGhvcmUgPSAwO1xuXHQgIHRoaXMubW9kdWxlID0gY29uZmlnLmN1cnJlbnRNb2R1bGU7XG5cdCAgdGhpcy5zdGVwcyA9IFtdO1xuXHQgIHRoaXMudGltZW91dCA9IHVuZGVmaW5lZDtcblx0ICB0aGlzLmVycm9yRm9yU3RhY2sgPSBuZXcgRXJyb3IoKTsgLy8gSWYgYSBtb2R1bGUgaXMgc2tpcHBlZCwgYWxsIGl0cyB0ZXN0cyBhbmQgdGhlIHRlc3RzIG9mIHRoZSBjaGlsZCBzdWl0ZXNcblx0ICAvLyBzaG91bGQgYmUgdHJlYXRlZCBhcyBza2lwcGVkIGV2ZW4gaWYgdGhleSBhcmUgZGVmaW5lZCBhcyBgb25seWAgb3IgYHRvZG9gLlxuXHQgIC8vIEFzIGZvciBgdG9kb2AgbW9kdWxlLCBhbGwgaXRzIHRlc3RzIHdpbGwgYmUgdHJlYXRlZCBhcyBgdG9kb2AgZXhjZXB0IGZvclxuXHQgIC8vIHRlc3RzIGRlZmluZWQgYXMgYHNraXBgIHdoaWNoIHdpbGwgYmUgbGVmdCBpbnRhY3QuXG5cdCAgLy9cblx0ICAvLyBTbywgaWYgYSB0ZXN0IGlzIGRlZmluZWQgYXMgYHRvZG9gIGFuZCBpcyBpbnNpZGUgYSBza2lwcGVkIG1vZHVsZSwgd2Ugc2hvdWxkXG5cdCAgLy8gdGhlbiB0cmVhdCB0aGF0IHRlc3QgYXMgaWYgd2FzIGRlZmluZWQgYXMgYHNraXBgLlxuXG5cdCAgaWYgKHRoaXMubW9kdWxlLnNraXApIHtcblx0ICAgIHNldHRpbmdzLnNraXAgPSB0cnVlO1xuXHQgICAgc2V0dGluZ3MudG9kbyA9IGZhbHNlOyAvLyBTa2lwcGVkIHRlc3RzIHNob3VsZCBiZSBsZWZ0IGludGFjdFxuXHQgIH0gZWxzZSBpZiAodGhpcy5tb2R1bGUudG9kbyAmJiAhc2V0dGluZ3Muc2tpcCkge1xuXHQgICAgc2V0dGluZ3MudG9kbyA9IHRydWU7XG5cdCAgfVxuXG5cdCAgZXh0ZW5kKHRoaXMsIHNldHRpbmdzKTtcblx0ICB0aGlzLnRlc3RSZXBvcnQgPSBuZXcgVGVzdFJlcG9ydChzZXR0aW5ncy50ZXN0TmFtZSwgdGhpcy5tb2R1bGUuc3VpdGVSZXBvcnQsIHtcblx0ICAgIHRvZG86IHNldHRpbmdzLnRvZG8sXG5cdCAgICBza2lwOiBzZXR0aW5ncy5za2lwLFxuXHQgICAgdmFsaWQ6IHRoaXMudmFsaWQoKVxuXHQgIH0pOyAvLyBSZWdpc3RlciB1bmlxdWUgc3RyaW5nc1xuXG5cdCAgZm9yIChpID0gMCwgbCA9IHRoaXMubW9kdWxlLnRlc3RzOyBpIDwgbC5sZW5ndGg7IGkrKykge1xuXHQgICAgaWYgKHRoaXMubW9kdWxlLnRlc3RzW2ldLm5hbWUgPT09IHRoaXMudGVzdE5hbWUpIHtcblx0ICAgICAgdGhpcy50ZXN0TmFtZSArPSBcIiBcIjtcblx0ICAgIH1cblx0ICB9XG5cblx0ICB0aGlzLnRlc3RJZCA9IGdlbmVyYXRlSGFzaCh0aGlzLm1vZHVsZS5uYW1lLCB0aGlzLnRlc3ROYW1lKTtcblx0ICB0aGlzLm1vZHVsZS50ZXN0cy5wdXNoKHtcblx0ICAgIG5hbWU6IHRoaXMudGVzdE5hbWUsXG5cdCAgICB0ZXN0SWQ6IHRoaXMudGVzdElkLFxuXHQgICAgc2tpcDogISFzZXR0aW5ncy5za2lwXG5cdCAgfSk7XG5cblx0ICBpZiAoc2V0dGluZ3Muc2tpcCkge1xuXHQgICAgLy8gU2tpcHBlZCB0ZXN0cyB3aWxsIGZ1bGx5IGlnbm9yZSBhbnkgc2VudCBjYWxsYmFja1xuXHQgICAgdGhpcy5jYWxsYmFjayA9IGZ1bmN0aW9uICgpIHt9O1xuXG5cdCAgICB0aGlzLmFzeW5jID0gZmFsc2U7XG5cdCAgICB0aGlzLmV4cGVjdGVkID0gMDtcblx0ICB9IGVsc2Uge1xuXHQgICAgaWYgKHR5cGVvZiB0aGlzLmNhbGxiYWNrICE9PSBcImZ1bmN0aW9uXCIpIHtcblx0ICAgICAgdmFyIG1ldGhvZCA9IHRoaXMudG9kbyA/IFwidG9kb1wiIDogXCJ0ZXN0XCI7IC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGVuXG5cblx0ICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIllvdSBtdXN0IHByb3ZpZGUgYSBmdW5jdGlvbiBhcyBhIHRlc3QgY2FsbGJhY2sgdG8gUVVuaXQuXCIuY29uY2F0KG1ldGhvZCwgXCIoXFxcIlwiKS5jb25jYXQoc2V0dGluZ3MudGVzdE5hbWUsIFwiXFxcIilcIikpO1xuXHQgICAgfVxuXG5cdCAgICB0aGlzLmFzc2VydCA9IG5ldyBBc3NlcnQodGhpcyk7XG5cdCAgfVxuXHR9XG5cdFRlc3QuY291bnQgPSAwO1xuXG5cdGZ1bmN0aW9uIGdldE5vdFN0YXJ0ZWRNb2R1bGVzKHN0YXJ0TW9kdWxlKSB7XG5cdCAgdmFyIG1vZHVsZSA9IHN0YXJ0TW9kdWxlLFxuXHQgICAgICBtb2R1bGVzID0gW107XG5cblx0ICB3aGlsZSAobW9kdWxlICYmIG1vZHVsZS50ZXN0c1J1biA9PT0gMCkge1xuXHQgICAgbW9kdWxlcy5wdXNoKG1vZHVsZSk7XG5cdCAgICBtb2R1bGUgPSBtb2R1bGUucGFyZW50TW9kdWxlO1xuXHQgIH0gLy8gVGhlIGFib3ZlIHB1c2ggbW9kdWxlcyBmcm9tIHRoZSBjaGlsZCB0byB0aGUgcGFyZW50XG5cdCAgLy8gcmV0dXJuIGEgcmV2ZXJzZWQgb3JkZXIgd2l0aCB0aGUgdG9wIGJlaW5nIHRoZSB0b3AgbW9zdCBwYXJlbnQgbW9kdWxlXG5cblxuXHQgIHJldHVybiBtb2R1bGVzLnJldmVyc2UoKTtcblx0fVxuXG5cdFRlc3QucHJvdG90eXBlID0ge1xuXHQgIC8vIGdlbmVyYXRpbmcgYSBzdGFjayB0cmFjZSBjYW4gYmUgZXhwZW5zaXZlLCBzbyB1c2luZyBhIGdldHRlciBkZWZlcnMgdGhpcyB1bnRpbCB3ZSBuZWVkIGl0XG5cdCAgZ2V0IHN0YWNrKCkge1xuXHQgICAgcmV0dXJuIGV4dHJhY3RTdGFja3RyYWNlKHRoaXMuZXJyb3JGb3JTdGFjaywgMik7XG5cdCAgfSxcblxuXHQgIGJlZm9yZTogZnVuY3Rpb24gYmVmb3JlKCkge1xuXHQgICAgdmFyIF90aGlzID0gdGhpcztcblxuXHQgICAgdmFyIG1vZHVsZSA9IHRoaXMubW9kdWxlLFxuXHQgICAgICAgIG5vdFN0YXJ0ZWRNb2R1bGVzID0gZ2V0Tm90U3RhcnRlZE1vZHVsZXMobW9kdWxlKTsgLy8gZW5zdXJlIHRoZSBjYWxsYmFja3MgYXJlIGV4ZWN1dGVkIHNlcmlhbGx5IGZvciBlYWNoIG1vZHVsZVxuXG5cdCAgICB2YXIgY2FsbGJhY2tQcm9taXNlcyA9IG5vdFN0YXJ0ZWRNb2R1bGVzLnJlZHVjZShmdW5jdGlvbiAocHJvbWlzZUNoYWluLCBzdGFydE1vZHVsZSkge1xuXHQgICAgICByZXR1cm4gcHJvbWlzZUNoYWluLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHN0YXJ0TW9kdWxlLnN0YXRzID0ge1xuXHQgICAgICAgICAgYWxsOiAwLFxuXHQgICAgICAgICAgYmFkOiAwLFxuXHQgICAgICAgICAgc3RhcnRlZDogbm93KClcblx0ICAgICAgICB9O1xuXHQgICAgICAgIGVtaXQoXCJzdWl0ZVN0YXJ0XCIsIHN0YXJ0TW9kdWxlLnN1aXRlUmVwb3J0LnN0YXJ0KHRydWUpKTtcblx0ICAgICAgICByZXR1cm4gcnVuTG9nZ2luZ0NhbGxiYWNrcyhcIm1vZHVsZVN0YXJ0XCIsIHtcblx0ICAgICAgICAgIG5hbWU6IHN0YXJ0TW9kdWxlLm5hbWUsXG5cdCAgICAgICAgICB0ZXN0czogc3RhcnRNb2R1bGUudGVzdHNcblx0ICAgICAgICB9KTtcblx0ICAgICAgfSk7XG5cdCAgICB9LCBQcm9taXNlJDEucmVzb2x2ZShbXSkpO1xuXHQgICAgcmV0dXJuIGNhbGxiYWNrUHJvbWlzZXMudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGNvbmZpZy5jdXJyZW50ID0gX3RoaXM7XG5cdCAgICAgIF90aGlzLnRlc3RFbnZpcm9ubWVudCA9IGV4dGVuZCh7fSwgbW9kdWxlLnRlc3RFbnZpcm9ubWVudCk7XG5cdCAgICAgIF90aGlzLnN0YXJ0ZWQgPSBub3coKTtcblx0ICAgICAgZW1pdChcInRlc3RTdGFydFwiLCBfdGhpcy50ZXN0UmVwb3J0LnN0YXJ0KHRydWUpKTtcblx0ICAgICAgcmV0dXJuIHJ1bkxvZ2dpbmdDYWxsYmFja3MoXCJ0ZXN0U3RhcnRcIiwge1xuXHQgICAgICAgIG5hbWU6IF90aGlzLnRlc3ROYW1lLFxuXHQgICAgICAgIG1vZHVsZTogbW9kdWxlLm5hbWUsXG5cdCAgICAgICAgdGVzdElkOiBfdGhpcy50ZXN0SWQsXG5cdCAgICAgICAgcHJldmlvdXNGYWlsdXJlOiBfdGhpcy5wcmV2aW91c0ZhaWx1cmVcblx0ICAgICAgfSkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgaWYgKCFjb25maWcucG9sbHV0aW9uKSB7XG5cdCAgICAgICAgICBzYXZlR2xvYmFsKCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9KTtcblx0ICAgIH0pO1xuXHQgIH0sXG5cdCAgcnVuOiBmdW5jdGlvbiBydW4oKSB7XG5cdCAgICB2YXIgcHJvbWlzZTtcblx0ICAgIGNvbmZpZy5jdXJyZW50ID0gdGhpcztcblx0ICAgIHRoaXMuY2FsbGJhY2tTdGFydGVkID0gbm93KCk7XG5cblx0ICAgIGlmIChjb25maWcubm90cnljYXRjaCkge1xuXHQgICAgICBydW5UZXN0KHRoaXMpO1xuXHQgICAgICByZXR1cm47XG5cdCAgICB9XG5cblx0ICAgIHRyeSB7XG5cdCAgICAgIHJ1blRlc3QodGhpcyk7XG5cdCAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgIHRoaXMucHVzaEZhaWx1cmUoXCJEaWVkIG9uIHRlc3QgI1wiICsgKHRoaXMuYXNzZXJ0aW9ucy5sZW5ndGggKyAxKSArIFwiIFwiICsgdGhpcy5zdGFjayArIFwiOiBcIiArIChlLm1lc3NhZ2UgfHwgZSksIGV4dHJhY3RTdGFja3RyYWNlKGUsIDApKTsgLy8gRWxzZSBuZXh0IHRlc3Qgd2lsbCBjYXJyeSB0aGUgcmVzcG9uc2liaWxpdHlcblxuXHQgICAgICBzYXZlR2xvYmFsKCk7IC8vIFJlc3RhcnQgdGhlIHRlc3RzIGlmIHRoZXkncmUgYmxvY2tpbmdcblxuXHQgICAgICBpZiAoY29uZmlnLmJsb2NraW5nKSB7XG5cdCAgICAgICAgaW50ZXJuYWxSZWNvdmVyKHRoaXMpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHJ1blRlc3QodGVzdCkge1xuXHQgICAgICBwcm9taXNlID0gdGVzdC5jYWxsYmFjay5jYWxsKHRlc3QudGVzdEVudmlyb25tZW50LCB0ZXN0LmFzc2VydCk7XG5cdCAgICAgIHRlc3QucmVzb2x2ZVByb21pc2UocHJvbWlzZSk7IC8vIElmIHRoZSB0ZXN0IGhhcyBhIFwibG9ja1wiIG9uIGl0LCBidXQgdGhlIHRpbWVvdXQgaXMgMCwgdGhlbiB3ZSBwdXNoIGFcblx0ICAgICAgLy8gZmFpbHVyZSBhcyB0aGUgdGVzdCBzaG91bGQgYmUgc3luY2hyb25vdXMuXG5cblx0ICAgICAgaWYgKHRlc3QudGltZW91dCA9PT0gMCAmJiB0ZXN0LnNlbWFwaG9yZSAhPT0gMCkge1xuXHQgICAgICAgIHB1c2hGYWlsdXJlKFwiVGVzdCBkaWQgbm90IGZpbmlzaCBzeW5jaHJvbm91c2x5IGV2ZW4gdGhvdWdoIGFzc2VydC50aW1lb3V0KCAwICkgd2FzIHVzZWQuXCIsIHNvdXJjZUZyb21TdGFja3RyYWNlKDIpKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH0sXG5cdCAgYWZ0ZXI6IGZ1bmN0aW9uIGFmdGVyKCkge1xuXHQgICAgY2hlY2tQb2xsdXRpb24oKTtcblx0ICB9LFxuXHQgIHF1ZXVlSG9vazogZnVuY3Rpb24gcXVldWVIb29rKGhvb2ssIGhvb2tOYW1lLCBob29rT3duZXIpIHtcblx0ICAgIHZhciBfdGhpczIgPSB0aGlzO1xuXG5cdCAgICB2YXIgY2FsbEhvb2sgPSBmdW5jdGlvbiBjYWxsSG9vaygpIHtcblx0ICAgICAgdmFyIHByb21pc2UgPSBob29rLmNhbGwoX3RoaXMyLnRlc3RFbnZpcm9ubWVudCwgX3RoaXMyLmFzc2VydCk7XG5cblx0ICAgICAgX3RoaXMyLnJlc29sdmVQcm9taXNlKHByb21pc2UsIGhvb2tOYW1lKTtcblx0ICAgIH07XG5cblx0ICAgIHZhciBydW5Ib29rID0gZnVuY3Rpb24gcnVuSG9vaygpIHtcblx0ICAgICAgaWYgKGhvb2tOYW1lID09PSBcImJlZm9yZVwiKSB7XG5cdCAgICAgICAgaWYgKGhvb2tPd25lci51bnNraXBwZWRUZXN0c1J1biAhPT0gMCkge1xuXHQgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIF90aGlzMi5wcmVzZXJ2ZUVudmlyb25tZW50ID0gdHJ1ZTtcblx0ICAgICAgfSAvLyBUaGUgJ2FmdGVyJyBob29rIHNob3VsZCBvbmx5IGV4ZWN1dGUgd2hlbiB0aGVyZSBhcmUgbm90IHRlc3RzIGxlZnQgYW5kXG5cdCAgICAgIC8vIHdoZW4gdGhlICdhZnRlcicgYW5kICdmaW5pc2gnIHRhc2tzIGFyZSB0aGUgb25seSB0YXNrcyBsZWZ0IHRvIHByb2Nlc3NcblxuXG5cdCAgICAgIGlmIChob29rTmFtZSA9PT0gXCJhZnRlclwiICYmIGhvb2tPd25lci51bnNraXBwZWRUZXN0c1J1biAhPT0gbnVtYmVyT2ZVbnNraXBwZWRUZXN0cyhob29rT3duZXIpIC0gMSAmJiAoY29uZmlnLnF1ZXVlLmxlbmd0aCA+IDAgfHwgUHJvY2Vzc2luZ1F1ZXVlLnRhc2tDb3VudCgpID4gMikpIHtcblx0ICAgICAgICByZXR1cm47XG5cdCAgICAgIH1cblxuXHQgICAgICBjb25maWcuY3VycmVudCA9IF90aGlzMjtcblxuXHQgICAgICBpZiAoY29uZmlnLm5vdHJ5Y2F0Y2gpIHtcblx0ICAgICAgICBjYWxsSG9vaygpO1xuXHQgICAgICAgIHJldHVybjtcblx0ICAgICAgfVxuXG5cdCAgICAgIHRyeSB7XG5cdCAgICAgICAgY2FsbEhvb2soKTtcblx0ICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcblx0ICAgICAgICBfdGhpczIucHVzaEZhaWx1cmUoaG9va05hbWUgKyBcIiBmYWlsZWQgb24gXCIgKyBfdGhpczIudGVzdE5hbWUgKyBcIjogXCIgKyAoZXJyb3IubWVzc2FnZSB8fCBlcnJvciksIGV4dHJhY3RTdGFja3RyYWNlKGVycm9yLCAwKSk7XG5cdCAgICAgIH1cblx0ICAgIH07XG5cblx0ICAgIHJldHVybiBydW5Ib29rO1xuXHQgIH0sXG5cdCAgLy8gQ3VycmVudGx5IG9ubHkgdXNlZCBmb3IgbW9kdWxlIGxldmVsIGhvb2tzLCBjYW4gYmUgdXNlZCB0byBhZGQgZ2xvYmFsIGxldmVsIG9uZXNcblx0ICBob29rczogZnVuY3Rpb24gaG9va3MoaGFuZGxlcikge1xuXHQgICAgdmFyIGhvb2tzID0gW107XG5cblx0ICAgIGZ1bmN0aW9uIHByb2Nlc3NIb29rcyh0ZXN0LCBtb2R1bGUpIHtcblx0ICAgICAgaWYgKG1vZHVsZS5wYXJlbnRNb2R1bGUpIHtcblx0ICAgICAgICBwcm9jZXNzSG9va3ModGVzdCwgbW9kdWxlLnBhcmVudE1vZHVsZSk7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAobW9kdWxlLmhvb2tzW2hhbmRsZXJdLmxlbmd0aCkge1xuXHQgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW9kdWxlLmhvb2tzW2hhbmRsZXJdLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICBob29rcy5wdXNoKHRlc3QucXVldWVIb29rKG1vZHVsZS5ob29rc1toYW5kbGVyXVtpXSwgaGFuZGxlciwgbW9kdWxlKSk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9IC8vIEhvb2tzIGFyZSBpZ25vcmVkIG9uIHNraXBwZWQgdGVzdHNcblxuXG5cdCAgICBpZiAoIXRoaXMuc2tpcCkge1xuXHQgICAgICBwcm9jZXNzSG9va3ModGhpcywgdGhpcy5tb2R1bGUpO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gaG9va3M7XG5cdCAgfSxcblx0ICBmaW5pc2g6IGZ1bmN0aW9uIGZpbmlzaCgpIHtcblx0ICAgIGNvbmZpZy5jdXJyZW50ID0gdGhpczsgLy8gUmVsZWFzZSB0aGUgdGVzdCBjYWxsYmFjayB0byBlbnN1cmUgdGhhdCBhbnl0aGluZyByZWZlcmVuY2VkIGhhcyBiZWVuXG5cdCAgICAvLyByZWxlYXNlZCB0byBiZSBnYXJiYWdlIGNvbGxlY3RlZC5cblxuXHQgICAgdGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcblxuXHQgICAgaWYgKHRoaXMuc3RlcHMubGVuZ3RoKSB7XG5cdCAgICAgIHZhciBzdGVwc0xpc3QgPSB0aGlzLnN0ZXBzLmpvaW4oXCIsIFwiKTtcblx0ICAgICAgdGhpcy5wdXNoRmFpbHVyZShcIkV4cGVjdGVkIGFzc2VydC52ZXJpZnlTdGVwcygpIHRvIGJlIGNhbGxlZCBiZWZvcmUgZW5kIG9mIHRlc3QgXCIgKyBcImFmdGVyIHVzaW5nIGFzc2VydC5zdGVwKCkuIFVudmVyaWZpZWQgc3RlcHM6IFwiLmNvbmNhdChzdGVwc0xpc3QpLCB0aGlzLnN0YWNrKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGNvbmZpZy5yZXF1aXJlRXhwZWN0cyAmJiB0aGlzLmV4cGVjdGVkID09PSBudWxsKSB7XG5cdCAgICAgIHRoaXMucHVzaEZhaWx1cmUoXCJFeHBlY3RlZCBudW1iZXIgb2YgYXNzZXJ0aW9ucyB0byBiZSBkZWZpbmVkLCBidXQgZXhwZWN0KCkgd2FzIFwiICsgXCJub3QgY2FsbGVkLlwiLCB0aGlzLnN0YWNrKTtcblx0ICAgIH0gZWxzZSBpZiAodGhpcy5leHBlY3RlZCAhPT0gbnVsbCAmJiB0aGlzLmV4cGVjdGVkICE9PSB0aGlzLmFzc2VydGlvbnMubGVuZ3RoKSB7XG5cdCAgICAgIHRoaXMucHVzaEZhaWx1cmUoXCJFeHBlY3RlZCBcIiArIHRoaXMuZXhwZWN0ZWQgKyBcIiBhc3NlcnRpb25zLCBidXQgXCIgKyB0aGlzLmFzc2VydGlvbnMubGVuZ3RoICsgXCIgd2VyZSBydW5cIiwgdGhpcy5zdGFjayk7XG5cdCAgICB9IGVsc2UgaWYgKHRoaXMuZXhwZWN0ZWQgPT09IG51bGwgJiYgIXRoaXMuYXNzZXJ0aW9ucy5sZW5ndGgpIHtcblx0ICAgICAgdGhpcy5wdXNoRmFpbHVyZShcIkV4cGVjdGVkIGF0IGxlYXN0IG9uZSBhc3NlcnRpb24sIGJ1dCBub25lIHdlcmUgcnVuIC0gY2FsbCBcIiArIFwiZXhwZWN0KDApIHRvIGFjY2VwdCB6ZXJvIGFzc2VydGlvbnMuXCIsIHRoaXMuc3RhY2spO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgaSxcblx0ICAgICAgICBtb2R1bGUgPSB0aGlzLm1vZHVsZSxcblx0ICAgICAgICBtb2R1bGVOYW1lID0gbW9kdWxlLm5hbWUsXG5cdCAgICAgICAgdGVzdE5hbWUgPSB0aGlzLnRlc3ROYW1lLFxuXHQgICAgICAgIHNraXBwZWQgPSAhIXRoaXMuc2tpcCxcblx0ICAgICAgICB0b2RvID0gISF0aGlzLnRvZG8sXG5cdCAgICAgICAgYmFkID0gMCxcblx0ICAgICAgICBzdG9yYWdlID0gY29uZmlnLnN0b3JhZ2U7XG5cdCAgICB0aGlzLnJ1bnRpbWUgPSBub3coKSAtIHRoaXMuc3RhcnRlZDtcblx0ICAgIGNvbmZpZy5zdGF0cy5hbGwgKz0gdGhpcy5hc3NlcnRpb25zLmxlbmd0aDtcblx0ICAgIGNvbmZpZy5zdGF0cy50ZXN0Q291bnQgKz0gMTtcblx0ICAgIG1vZHVsZS5zdGF0cy5hbGwgKz0gdGhpcy5hc3NlcnRpb25zLmxlbmd0aDtcblxuXHQgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuYXNzZXJ0aW9ucy5sZW5ndGg7IGkrKykge1xuXHQgICAgICBpZiAoIXRoaXMuYXNzZXJ0aW9uc1tpXS5yZXN1bHQpIHtcblx0ICAgICAgICBiYWQrKztcblx0ICAgICAgICBjb25maWcuc3RhdHMuYmFkKys7XG5cdCAgICAgICAgbW9kdWxlLnN0YXRzLmJhZCsrO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIG5vdGlmeVRlc3RzUmFuKG1vZHVsZSwgc2tpcHBlZCk7IC8vIFN0b3JlIHJlc3VsdCB3aGVuIHBvc3NpYmxlXG5cblx0ICAgIGlmIChzdG9yYWdlKSB7XG5cdCAgICAgIGlmIChiYWQpIHtcblx0ICAgICAgICBzdG9yYWdlLnNldEl0ZW0oXCJxdW5pdC10ZXN0LVwiICsgbW9kdWxlTmFtZSArIFwiLVwiICsgdGVzdE5hbWUsIGJhZCk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgc3RvcmFnZS5yZW1vdmVJdGVtKFwicXVuaXQtdGVzdC1cIiArIG1vZHVsZU5hbWUgKyBcIi1cIiArIHRlc3ROYW1lKTtcblx0ICAgICAgfVxuXHQgICAgfSAvLyBBZnRlciBlbWl0dGluZyB0aGUganMtcmVwb3J0ZXJzIGV2ZW50IHdlIGNsZWFudXAgdGhlIGFzc2VydGlvbiBkYXRhIHRvXG5cdCAgICAvLyBhdm9pZCBsZWFraW5nIGl0LiBJdCBpcyBub3QgdXNlZCBieSB0aGUgbGVnYWN5IHRlc3REb25lIGNhbGxiYWNrcy5cblxuXG5cdCAgICBlbWl0KFwidGVzdEVuZFwiLCB0aGlzLnRlc3RSZXBvcnQuZW5kKHRydWUpKTtcblx0ICAgIHRoaXMudGVzdFJlcG9ydC5zbGltQXNzZXJ0aW9ucygpO1xuXHQgICAgdmFyIHRlc3QgPSB0aGlzO1xuXHQgICAgcmV0dXJuIHJ1bkxvZ2dpbmdDYWxsYmFja3MoXCJ0ZXN0RG9uZVwiLCB7XG5cdCAgICAgIG5hbWU6IHRlc3ROYW1lLFxuXHQgICAgICBtb2R1bGU6IG1vZHVsZU5hbWUsXG5cdCAgICAgIHNraXBwZWQ6IHNraXBwZWQsXG5cdCAgICAgIHRvZG86IHRvZG8sXG5cdCAgICAgIGZhaWxlZDogYmFkLFxuXHQgICAgICBwYXNzZWQ6IHRoaXMuYXNzZXJ0aW9ucy5sZW5ndGggLSBiYWQsXG5cdCAgICAgIHRvdGFsOiB0aGlzLmFzc2VydGlvbnMubGVuZ3RoLFxuXHQgICAgICBydW50aW1lOiBza2lwcGVkID8gMCA6IHRoaXMucnVudGltZSxcblx0ICAgICAgLy8gSFRNTCBSZXBvcnRlciB1c2Vcblx0ICAgICAgYXNzZXJ0aW9uczogdGhpcy5hc3NlcnRpb25zLFxuXHQgICAgICB0ZXN0SWQ6IHRoaXMudGVzdElkLFxuXG5cdCAgICAgIC8vIFNvdXJjZSBvZiBUZXN0XG5cdCAgICAgIC8vIGdlbmVyYXRpbmcgc3RhY2sgdHJhY2UgaXMgZXhwZW5zaXZlLCBzbyB1c2luZyBhIGdldHRlciB3aWxsIGhlbHAgZGVmZXIgdGhpcyB1bnRpbCB3ZSBuZWVkIGl0XG5cdCAgICAgIGdldCBzb3VyY2UoKSB7XG5cdCAgICAgICAgcmV0dXJuIHRlc3Quc3RhY2s7XG5cdCAgICAgIH1cblxuXHQgICAgfSkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGlmIChtb2R1bGUudGVzdHNSdW4gPT09IG51bWJlck9mVGVzdHMobW9kdWxlKSkge1xuXHQgICAgICAgIHZhciBjb21wbGV0ZWRNb2R1bGVzID0gW21vZHVsZV07IC8vIENoZWNrIGlmIHRoZSBwYXJlbnQgbW9kdWxlcywgaXRlcmF0aXZlbHksIGFyZSBkb25lLiBJZiB0aGF0IHRoZSBjYXNlLFxuXHQgICAgICAgIC8vIHdlIGVtaXQgdGhlIGBzdWl0ZUVuZGAgZXZlbnQgYW5kIHRyaWdnZXIgYG1vZHVsZURvbmVgIGNhbGxiYWNrLlxuXG5cdCAgICAgICAgdmFyIHBhcmVudCA9IG1vZHVsZS5wYXJlbnRNb2R1bGU7XG5cblx0ICAgICAgICB3aGlsZSAocGFyZW50ICYmIHBhcmVudC50ZXN0c1J1biA9PT0gbnVtYmVyT2ZUZXN0cyhwYXJlbnQpKSB7XG5cdCAgICAgICAgICBjb21wbGV0ZWRNb2R1bGVzLnB1c2gocGFyZW50KTtcblx0ICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnRNb2R1bGU7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgcmV0dXJuIGNvbXBsZXRlZE1vZHVsZXMucmVkdWNlKGZ1bmN0aW9uIChwcm9taXNlQ2hhaW4sIGNvbXBsZXRlZE1vZHVsZSkge1xuXHQgICAgICAgICAgcmV0dXJuIHByb21pc2VDaGFpbi50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgcmV0dXJuIGxvZ1N1aXRlRW5kKGNvbXBsZXRlZE1vZHVsZSk7XG5cdCAgICAgICAgICB9KTtcblx0ICAgICAgICB9LCBQcm9taXNlJDEucmVzb2x2ZShbXSkpO1xuXHQgICAgICB9XG5cdCAgICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgY29uZmlnLmN1cnJlbnQgPSB1bmRlZmluZWQ7XG5cdCAgICB9KTtcblxuXHQgICAgZnVuY3Rpb24gbG9nU3VpdGVFbmQobW9kdWxlKSB7XG5cdCAgICAgIC8vIFJlc2V0IGBtb2R1bGUuaG9va3NgIHRvIGVuc3VyZSB0aGF0IGFueXRoaW5nIHJlZmVyZW5jZWQgaW4gdGhlc2UgaG9va3Ncblx0ICAgICAgLy8gaGFzIGJlZW4gcmVsZWFzZWQgdG8gYmUgZ2FyYmFnZSBjb2xsZWN0ZWQuXG5cdCAgICAgIG1vZHVsZS5ob29rcyA9IHt9O1xuXHQgICAgICBlbWl0KFwic3VpdGVFbmRcIiwgbW9kdWxlLnN1aXRlUmVwb3J0LmVuZCh0cnVlKSk7XG5cdCAgICAgIHJldHVybiBydW5Mb2dnaW5nQ2FsbGJhY2tzKFwibW9kdWxlRG9uZVwiLCB7XG5cdCAgICAgICAgbmFtZTogbW9kdWxlLm5hbWUsXG5cdCAgICAgICAgdGVzdHM6IG1vZHVsZS50ZXN0cyxcblx0ICAgICAgICBmYWlsZWQ6IG1vZHVsZS5zdGF0cy5iYWQsXG5cdCAgICAgICAgcGFzc2VkOiBtb2R1bGUuc3RhdHMuYWxsIC0gbW9kdWxlLnN0YXRzLmJhZCxcblx0ICAgICAgICB0b3RhbDogbW9kdWxlLnN0YXRzLmFsbCxcblx0ICAgICAgICBydW50aW1lOiBub3coKSAtIG1vZHVsZS5zdGF0cy5zdGFydGVkXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sXG5cdCAgcHJlc2VydmVUZXN0RW52aXJvbm1lbnQ6IGZ1bmN0aW9uIHByZXNlcnZlVGVzdEVudmlyb25tZW50KCkge1xuXHQgICAgaWYgKHRoaXMucHJlc2VydmVFbnZpcm9ubWVudCkge1xuXHQgICAgICB0aGlzLm1vZHVsZS50ZXN0RW52aXJvbm1lbnQgPSB0aGlzLnRlc3RFbnZpcm9ubWVudDtcblx0ICAgICAgdGhpcy50ZXN0RW52aXJvbm1lbnQgPSBleHRlbmQoe30sIHRoaXMubW9kdWxlLnRlc3RFbnZpcm9ubWVudCk7XG5cdCAgICB9XG5cdCAgfSxcblx0ICBxdWV1ZTogZnVuY3Rpb24gcXVldWUoKSB7XG5cdCAgICB2YXIgdGVzdCA9IHRoaXM7XG5cblx0ICAgIGlmICghdGhpcy52YWxpZCgpKSB7XG5cdCAgICAgIHJldHVybjtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gcnVuVGVzdCgpIHtcblx0ICAgICAgcmV0dXJuIFtmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgcmV0dXJuIHRlc3QuYmVmb3JlKCk7XG5cdCAgICAgIH1dLmNvbmNhdChfdG9Db25zdW1hYmxlQXJyYXkodGVzdC5ob29rcyhcImJlZm9yZVwiKSksIFtmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgdGVzdC5wcmVzZXJ2ZVRlc3RFbnZpcm9ubWVudCgpO1xuXHQgICAgICB9XSwgX3RvQ29uc3VtYWJsZUFycmF5KHRlc3QuaG9va3MoXCJiZWZvcmVFYWNoXCIpKSwgW2Z1bmN0aW9uICgpIHtcblx0ICAgICAgICB0ZXN0LnJ1bigpO1xuXHQgICAgICB9XSwgX3RvQ29uc3VtYWJsZUFycmF5KHRlc3QuaG9va3MoXCJhZnRlckVhY2hcIikucmV2ZXJzZSgpKSwgX3RvQ29uc3VtYWJsZUFycmF5KHRlc3QuaG9va3MoXCJhZnRlclwiKS5yZXZlcnNlKCkpLCBbZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHRlc3QuYWZ0ZXIoKTtcblx0ICAgICAgfSwgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHJldHVybiB0ZXN0LmZpbmlzaCgpO1xuXHQgICAgICB9XSk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBwcmV2aW91c0ZhaWxDb3VudCA9IGNvbmZpZy5zdG9yYWdlICYmICtjb25maWcuc3RvcmFnZS5nZXRJdGVtKFwicXVuaXQtdGVzdC1cIiArIHRoaXMubW9kdWxlLm5hbWUgKyBcIi1cIiArIHRoaXMudGVzdE5hbWUpOyAvLyBQcmlvcml0aXplIHByZXZpb3VzbHkgZmFpbGVkIHRlc3RzLCBkZXRlY3RlZCBmcm9tIHN0b3JhZ2VcblxuXHQgICAgdmFyIHByaW9yaXRpemUgPSBjb25maWcucmVvcmRlciAmJiAhIXByZXZpb3VzRmFpbENvdW50O1xuXHQgICAgdGhpcy5wcmV2aW91c0ZhaWx1cmUgPSAhIXByZXZpb3VzRmFpbENvdW50O1xuXHQgICAgUHJvY2Vzc2luZ1F1ZXVlLmFkZChydW5UZXN0LCBwcmlvcml0aXplLCBjb25maWcuc2VlZCk7IC8vIElmIHRoZSBxdWV1ZSBoYXMgYWxyZWFkeSBmaW5pc2hlZCwgd2UgbWFudWFsbHkgcHJvY2VzcyB0aGUgbmV3IHRlc3RcblxuXHQgICAgaWYgKFByb2Nlc3NpbmdRdWV1ZS5maW5pc2hlZCkge1xuXHQgICAgICBQcm9jZXNzaW5nUXVldWUuYWR2YW5jZSgpO1xuXHQgICAgfVxuXHQgIH0sXG5cdCAgcHVzaFJlc3VsdDogZnVuY3Rpb24gcHVzaFJlc3VsdChyZXN1bHRJbmZvKSB7XG5cdCAgICBpZiAodGhpcyAhPT0gY29uZmlnLmN1cnJlbnQpIHtcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQXNzZXJ0aW9uIG9jY3VycmVkIGFmdGVyIHRlc3QgaGFkIGZpbmlzaGVkLlwiKTtcblx0ICAgIH0gLy8gRGVzdHJ1Y3R1cmUgb2YgcmVzdWx0SW5mbyA9IHsgcmVzdWx0LCBhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCBuZWdhdGl2ZSB9XG5cblxuXHQgICAgdmFyIHNvdXJjZSxcblx0ICAgICAgICBkZXRhaWxzID0ge1xuXHQgICAgICBtb2R1bGU6IHRoaXMubW9kdWxlLm5hbWUsXG5cdCAgICAgIG5hbWU6IHRoaXMudGVzdE5hbWUsXG5cdCAgICAgIHJlc3VsdDogcmVzdWx0SW5mby5yZXN1bHQsXG5cdCAgICAgIG1lc3NhZ2U6IHJlc3VsdEluZm8ubWVzc2FnZSxcblx0ICAgICAgYWN0dWFsOiByZXN1bHRJbmZvLmFjdHVhbCxcblx0ICAgICAgdGVzdElkOiB0aGlzLnRlc3RJZCxcblx0ICAgICAgbmVnYXRpdmU6IHJlc3VsdEluZm8ubmVnYXRpdmUgfHwgZmFsc2UsXG5cdCAgICAgIHJ1bnRpbWU6IG5vdygpIC0gdGhpcy5zdGFydGVkLFxuXHQgICAgICB0b2RvOiAhIXRoaXMudG9kb1xuXHQgICAgfTtcblxuXHQgICAgaWYgKGhhc093bi5jYWxsKHJlc3VsdEluZm8sIFwiZXhwZWN0ZWRcIikpIHtcblx0ICAgICAgZGV0YWlscy5leHBlY3RlZCA9IHJlc3VsdEluZm8uZXhwZWN0ZWQ7XG5cdCAgICB9XG5cblx0ICAgIGlmICghcmVzdWx0SW5mby5yZXN1bHQpIHtcblx0ICAgICAgc291cmNlID0gcmVzdWx0SW5mby5zb3VyY2UgfHwgc291cmNlRnJvbVN0YWNrdHJhY2UoKTtcblxuXHQgICAgICBpZiAoc291cmNlKSB7XG5cdCAgICAgICAgZGV0YWlscy5zb3VyY2UgPSBzb3VyY2U7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgdGhpcy5sb2dBc3NlcnRpb24oZGV0YWlscyk7XG5cdCAgICB0aGlzLmFzc2VydGlvbnMucHVzaCh7XG5cdCAgICAgIHJlc3VsdDogISFyZXN1bHRJbmZvLnJlc3VsdCxcblx0ICAgICAgbWVzc2FnZTogcmVzdWx0SW5mby5tZXNzYWdlXG5cdCAgICB9KTtcblx0ICB9LFxuXHQgIHB1c2hGYWlsdXJlOiBmdW5jdGlvbiBwdXNoRmFpbHVyZShtZXNzYWdlLCBzb3VyY2UsIGFjdHVhbCkge1xuXHQgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFRlc3QpKSB7XG5cdCAgICAgIHRocm93IG5ldyBFcnJvcihcInB1c2hGYWlsdXJlKCkgYXNzZXJ0aW9uIG91dHNpZGUgdGVzdCBjb250ZXh0LCB3YXMgXCIgKyBzb3VyY2VGcm9tU3RhY2t0cmFjZSgyKSk7XG5cdCAgICB9XG5cblx0ICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgIHJlc3VsdDogZmFsc2UsXG5cdCAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UgfHwgXCJlcnJvclwiLFxuXHQgICAgICBhY3R1YWw6IGFjdHVhbCB8fCBudWxsLFxuXHQgICAgICBzb3VyY2U6IHNvdXJjZVxuXHQgICAgfSk7XG5cdCAgfSxcblxuXHQgIC8qKlxuXHQgICAqIExvZyBhc3NlcnRpb24gZGV0YWlscyB1c2luZyBib3RoIHRoZSBvbGQgUVVuaXQubG9nIGludGVyZmFjZSBhbmRcblx0ICAgKiBRVW5pdC5vbiggXCJhc3NlcnRpb25cIiApIGludGVyZmFjZS5cblx0ICAgKlxuXHQgICAqIEBwcml2YXRlXG5cdCAgICovXG5cdCAgbG9nQXNzZXJ0aW9uOiBmdW5jdGlvbiBsb2dBc3NlcnRpb24oZGV0YWlscykge1xuXHQgICAgcnVuTG9nZ2luZ0NhbGxiYWNrcyhcImxvZ1wiLCBkZXRhaWxzKTtcblx0ICAgIHZhciBhc3NlcnRpb24gPSB7XG5cdCAgICAgIHBhc3NlZDogZGV0YWlscy5yZXN1bHQsXG5cdCAgICAgIGFjdHVhbDogZGV0YWlscy5hY3R1YWwsXG5cdCAgICAgIGV4cGVjdGVkOiBkZXRhaWxzLmV4cGVjdGVkLFxuXHQgICAgICBtZXNzYWdlOiBkZXRhaWxzLm1lc3NhZ2UsXG5cdCAgICAgIHN0YWNrOiBkZXRhaWxzLnNvdXJjZSxcblx0ICAgICAgdG9kbzogZGV0YWlscy50b2RvXG5cdCAgICB9O1xuXHQgICAgdGhpcy50ZXN0UmVwb3J0LnB1c2hBc3NlcnRpb24oYXNzZXJ0aW9uKTtcblx0ICAgIGVtaXQoXCJhc3NlcnRpb25cIiwgYXNzZXJ0aW9uKTtcblx0ICB9LFxuXHQgIHJlc29sdmVQcm9taXNlOiBmdW5jdGlvbiByZXNvbHZlUHJvbWlzZShwcm9taXNlLCBwaGFzZSkge1xuXHQgICAgdmFyIHRoZW4sXG5cdCAgICAgICAgcmVzdW1lLFxuXHQgICAgICAgIG1lc3NhZ2UsXG5cdCAgICAgICAgdGVzdCA9IHRoaXM7XG5cblx0ICAgIGlmIChwcm9taXNlICE9IG51bGwpIHtcblx0ICAgICAgdGhlbiA9IHByb21pc2UudGhlbjtcblxuXHQgICAgICBpZiAob2JqZWN0VHlwZSh0aGVuKSA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdCAgICAgICAgcmVzdW1lID0gaW50ZXJuYWxTdG9wKHRlc3QpO1xuXG5cdCAgICAgICAgaWYgKGNvbmZpZy5ub3RyeWNhdGNoKSB7XG5cdCAgICAgICAgICB0aGVuLmNhbGwocHJvbWlzZSwgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICByZXN1bWUoKTtcblx0ICAgICAgICAgIH0pO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICB0aGVuLmNhbGwocHJvbWlzZSwgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICByZXN1bWUoKTtcblx0ICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuXHQgICAgICAgICAgICBtZXNzYWdlID0gXCJQcm9taXNlIHJlamVjdGVkIFwiICsgKCFwaGFzZSA/IFwiZHVyaW5nXCIgOiBwaGFzZS5yZXBsYWNlKC9FYWNoJC8sIFwiXCIpKSArIFwiIFxcXCJcIiArIHRlc3QudGVzdE5hbWUgKyBcIlxcXCI6IFwiICsgKGVycm9yICYmIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuXHQgICAgICAgICAgICB0ZXN0LnB1c2hGYWlsdXJlKG1lc3NhZ2UsIGV4dHJhY3RTdGFja3RyYWNlKGVycm9yLCAwKSk7IC8vIEVsc2UgbmV4dCB0ZXN0IHdpbGwgY2FycnkgdGhlIHJlc3BvbnNpYmlsaXR5XG5cblx0ICAgICAgICAgICAgc2F2ZUdsb2JhbCgpOyAvLyBVbmJsb2NrXG5cblx0ICAgICAgICAgICAgaW50ZXJuYWxSZWNvdmVyKHRlc3QpO1xuXHQgICAgICAgICAgfSk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfSxcblx0ICB2YWxpZDogZnVuY3Rpb24gdmFsaWQoKSB7XG5cdCAgICB2YXIgZmlsdGVyID0gY29uZmlnLmZpbHRlcixcblx0ICAgICAgICByZWdleEZpbHRlciA9IC9eKCE/KVxcLyhbXFx3XFxXXSopXFwvKGk/JCkvLmV4ZWMoZmlsdGVyKSxcblx0ICAgICAgICBtb2R1bGUgPSBjb25maWcubW9kdWxlICYmIGNvbmZpZy5tb2R1bGUudG9Mb3dlckNhc2UoKSxcblx0ICAgICAgICBmdWxsTmFtZSA9IHRoaXMubW9kdWxlLm5hbWUgKyBcIjogXCIgKyB0aGlzLnRlc3ROYW1lO1xuXG5cdCAgICBmdW5jdGlvbiBtb2R1bGVDaGFpbk5hbWVNYXRjaCh0ZXN0TW9kdWxlKSB7XG5cdCAgICAgIHZhciB0ZXN0TW9kdWxlTmFtZSA9IHRlc3RNb2R1bGUubmFtZSA/IHRlc3RNb2R1bGUubmFtZS50b0xvd2VyQ2FzZSgpIDogbnVsbDtcblxuXHQgICAgICBpZiAodGVzdE1vZHVsZU5hbWUgPT09IG1vZHVsZSkge1xuXHQgICAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgICB9IGVsc2UgaWYgKHRlc3RNb2R1bGUucGFyZW50TW9kdWxlKSB7XG5cdCAgICAgICAgcmV0dXJuIG1vZHVsZUNoYWluTmFtZU1hdGNoKHRlc3RNb2R1bGUucGFyZW50TW9kdWxlKTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gbW9kdWxlQ2hhaW5JZE1hdGNoKHRlc3RNb2R1bGUpIHtcblx0ICAgICAgcmV0dXJuIGluQXJyYXkodGVzdE1vZHVsZS5tb2R1bGVJZCwgY29uZmlnLm1vZHVsZUlkKSB8fCB0ZXN0TW9kdWxlLnBhcmVudE1vZHVsZSAmJiBtb2R1bGVDaGFpbklkTWF0Y2godGVzdE1vZHVsZS5wYXJlbnRNb2R1bGUpO1xuXHQgICAgfSAvLyBJbnRlcm5hbGx5LWdlbmVyYXRlZCB0ZXN0cyBhcmUgYWx3YXlzIHZhbGlkXG5cblxuXHQgICAgaWYgKHRoaXMuY2FsbGJhY2sgJiYgdGhpcy5jYWxsYmFjay52YWxpZFRlc3QpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjb25maWcubW9kdWxlSWQgJiYgY29uZmlnLm1vZHVsZUlkLmxlbmd0aCA+IDAgJiYgIW1vZHVsZUNoYWluSWRNYXRjaCh0aGlzLm1vZHVsZSkpIHtcblx0ICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoY29uZmlnLnRlc3RJZCAmJiBjb25maWcudGVzdElkLmxlbmd0aCA+IDAgJiYgIWluQXJyYXkodGhpcy50ZXN0SWQsIGNvbmZpZy50ZXN0SWQpKSB7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH1cblxuXHQgICAgaWYgKG1vZHVsZSAmJiAhbW9kdWxlQ2hhaW5OYW1lTWF0Y2godGhpcy5tb2R1bGUpKSB7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH1cblxuXHQgICAgaWYgKCFmaWx0ZXIpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiByZWdleEZpbHRlciA/IHRoaXMucmVnZXhGaWx0ZXIoISFyZWdleEZpbHRlclsxXSwgcmVnZXhGaWx0ZXJbMl0sIHJlZ2V4RmlsdGVyWzNdLCBmdWxsTmFtZSkgOiB0aGlzLnN0cmluZ0ZpbHRlcihmaWx0ZXIsIGZ1bGxOYW1lKTtcblx0ICB9LFxuXHQgIHJlZ2V4RmlsdGVyOiBmdW5jdGlvbiByZWdleEZpbHRlcihleGNsdWRlLCBwYXR0ZXJuLCBmbGFncywgZnVsbE5hbWUpIHtcblx0ICAgIHZhciByZWdleCA9IG5ldyBSZWdFeHAocGF0dGVybiwgZmxhZ3MpO1xuXHQgICAgdmFyIG1hdGNoID0gcmVnZXgudGVzdChmdWxsTmFtZSk7XG5cdCAgICByZXR1cm4gbWF0Y2ggIT09IGV4Y2x1ZGU7XG5cdCAgfSxcblx0ICBzdHJpbmdGaWx0ZXI6IGZ1bmN0aW9uIHN0cmluZ0ZpbHRlcihmaWx0ZXIsIGZ1bGxOYW1lKSB7XG5cdCAgICBmaWx0ZXIgPSBmaWx0ZXIudG9Mb3dlckNhc2UoKTtcblx0ICAgIGZ1bGxOYW1lID0gZnVsbE5hbWUudG9Mb3dlckNhc2UoKTtcblx0ICAgIHZhciBpbmNsdWRlID0gZmlsdGVyLmNoYXJBdCgwKSAhPT0gXCIhXCI7XG5cblx0ICAgIGlmICghaW5jbHVkZSkge1xuXHQgICAgICBmaWx0ZXIgPSBmaWx0ZXIuc2xpY2UoMSk7XG5cdCAgICB9IC8vIElmIHRoZSBmaWx0ZXIgbWF0Y2hlcywgd2UgbmVlZCB0byBob25vdXIgaW5jbHVkZVxuXG5cblx0ICAgIGlmIChmdWxsTmFtZS5pbmRleE9mKGZpbHRlcikgIT09IC0xKSB7XG5cdCAgICAgIHJldHVybiBpbmNsdWRlO1xuXHQgICAgfSAvLyBPdGhlcndpc2UsIGRvIHRoZSBvcHBvc2l0ZVxuXG5cblx0ICAgIHJldHVybiAhaW5jbHVkZTtcblx0ICB9XG5cdH07XG5cdGZ1bmN0aW9uIHB1c2hGYWlsdXJlKCkge1xuXHQgIGlmICghY29uZmlnLmN1cnJlbnQpIHtcblx0ICAgIHRocm93IG5ldyBFcnJvcihcInB1c2hGYWlsdXJlKCkgYXNzZXJ0aW9uIG91dHNpZGUgdGVzdCBjb250ZXh0LCBpbiBcIiArIHNvdXJjZUZyb21TdGFja3RyYWNlKDIpKTtcblx0ICB9IC8vIEdldHMgY3VycmVudCB0ZXN0IG9ialxuXG5cblx0ICB2YXIgY3VycmVudFRlc3QgPSBjb25maWcuY3VycmVudDtcblx0ICByZXR1cm4gY3VycmVudFRlc3QucHVzaEZhaWx1cmUuYXBwbHkoY3VycmVudFRlc3QsIGFyZ3VtZW50cyk7XG5cdH1cblxuXHRmdW5jdGlvbiBzYXZlR2xvYmFsKCkge1xuXHQgIGNvbmZpZy5wb2xsdXRpb24gPSBbXTtcblxuXHQgIGlmIChjb25maWcubm9nbG9iYWxzKSB7XG5cdCAgICBmb3IgKHZhciBrZXkgaW4gZ2xvYmFsX19kZWZhdWx0WydkZWZhdWx0J10pIHtcblx0ICAgICAgaWYgKGhhc093bi5jYWxsKGdsb2JhbF9fZGVmYXVsdFsnZGVmYXVsdCddLCBrZXkpKSB7XG5cdCAgICAgICAgLy8gSW4gT3BlcmEgc29tZXRpbWVzIERPTSBlbGVtZW50IGlkcyBzaG93IHVwIGhlcmUsIGlnbm9yZSB0aGVtXG5cdCAgICAgICAgaWYgKC9ecXVuaXQtdGVzdC1vdXRwdXQvLnRlc3Qoa2V5KSkge1xuXHQgICAgICAgICAgY29udGludWU7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgY29uZmlnLnBvbGx1dGlvbi5wdXNoKGtleSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9XG5cdH1cblxuXHRmdW5jdGlvbiBjaGVja1BvbGx1dGlvbigpIHtcblx0ICB2YXIgbmV3R2xvYmFscyxcblx0ICAgICAgZGVsZXRlZEdsb2JhbHMsXG5cdCAgICAgIG9sZCA9IGNvbmZpZy5wb2xsdXRpb247XG5cdCAgc2F2ZUdsb2JhbCgpO1xuXHQgIG5ld0dsb2JhbHMgPSBkaWZmKGNvbmZpZy5wb2xsdXRpb24sIG9sZCk7XG5cblx0ICBpZiAobmV3R2xvYmFscy5sZW5ndGggPiAwKSB7XG5cdCAgICBwdXNoRmFpbHVyZShcIkludHJvZHVjZWQgZ2xvYmFsIHZhcmlhYmxlKHMpOiBcIiArIG5ld0dsb2JhbHMuam9pbihcIiwgXCIpKTtcblx0ICB9XG5cblx0ICBkZWxldGVkR2xvYmFscyA9IGRpZmYob2xkLCBjb25maWcucG9sbHV0aW9uKTtcblxuXHQgIGlmIChkZWxldGVkR2xvYmFscy5sZW5ndGggPiAwKSB7XG5cdCAgICBwdXNoRmFpbHVyZShcIkRlbGV0ZWQgZ2xvYmFsIHZhcmlhYmxlKHMpOiBcIiArIGRlbGV0ZWRHbG9iYWxzLmpvaW4oXCIsIFwiKSk7XG5cdCAgfVxuXHR9IC8vIFdpbGwgYmUgZXhwb3NlZCBhcyBRVW5pdC50ZXN0XG5cblxuXHRmdW5jdGlvbiB0ZXN0KHRlc3ROYW1lLCBjYWxsYmFjaykge1xuXHQgIGlmIChmb2N1c2VkJDEpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICB2YXIgbmV3VGVzdCA9IG5ldyBUZXN0KHtcblx0ICAgIHRlc3ROYW1lOiB0ZXN0TmFtZSxcblx0ICAgIGNhbGxiYWNrOiBjYWxsYmFja1xuXHQgIH0pO1xuXHQgIG5ld1Rlc3QucXVldWUoKTtcblx0fVxuXHRmdW5jdGlvbiB0b2RvKHRlc3ROYW1lLCBjYWxsYmFjaykge1xuXHQgIGlmIChmb2N1c2VkJDEpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICB2YXIgbmV3VGVzdCA9IG5ldyBUZXN0KHtcblx0ICAgIHRlc3ROYW1lOiB0ZXN0TmFtZSxcblx0ICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcblx0ICAgIHRvZG86IHRydWVcblx0ICB9KTtcblx0ICBuZXdUZXN0LnF1ZXVlKCk7XG5cdH0gLy8gV2lsbCBiZSBleHBvc2VkIGFzIFFVbml0LnNraXBcblxuXHRmdW5jdGlvbiBza2lwKHRlc3ROYW1lKSB7XG5cdCAgaWYgKGZvY3VzZWQkMSkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHZhciB0ZXN0ID0gbmV3IFRlc3Qoe1xuXHQgICAgdGVzdE5hbWU6IHRlc3ROYW1lLFxuXHQgICAgc2tpcDogdHJ1ZVxuXHQgIH0pO1xuXHQgIHRlc3QucXVldWUoKTtcblx0fSAvLyBXaWxsIGJlIGV4cG9zZWQgYXMgUVVuaXQub25seVxuXG5cdGZ1bmN0aW9uIG9ubHkodGVzdE5hbWUsIGNhbGxiYWNrKSB7XG5cdCAgaWYgKCFmb2N1c2VkJDEpIHtcblx0ICAgIGNvbmZpZy5xdWV1ZS5sZW5ndGggPSAwO1xuXHQgICAgZm9jdXNlZCQxID0gdHJ1ZTtcblx0ICB9XG5cblx0ICB2YXIgbmV3VGVzdCA9IG5ldyBUZXN0KHtcblx0ICAgIHRlc3ROYW1lOiB0ZXN0TmFtZSxcblx0ICAgIGNhbGxiYWNrOiBjYWxsYmFja1xuXHQgIH0pO1xuXHQgIG5ld1Rlc3QucXVldWUoKTtcblx0fSAvLyBSZXNldHMgY29uZmlnLnRpbWVvdXQgd2l0aCBhIG5ldyB0aW1lb3V0IGR1cmF0aW9uLlxuXG5cdGZ1bmN0aW9uIHJlc2V0VGVzdFRpbWVvdXQodGltZW91dER1cmF0aW9uKSB7XG5cdCAgY2xlYXJUaW1lb3V0KGNvbmZpZy50aW1lb3V0KTtcblx0ICBjb25maWcudGltZW91dCA9IHNldFRpbWVvdXQkMShjb25maWcudGltZW91dEhhbmRsZXIodGltZW91dER1cmF0aW9uKSwgdGltZW91dER1cmF0aW9uKTtcblx0fSAvLyBQdXQgYSBob2xkIG9uIHByb2Nlc3NpbmcgYW5kIHJldHVybiBhIGZ1bmN0aW9uIHRoYXQgd2lsbCByZWxlYXNlIGl0LlxuXG5cdGZ1bmN0aW9uIGludGVybmFsU3RvcCh0ZXN0KSB7XG5cdCAgdmFyIHJlbGVhc2VkID0gZmFsc2U7XG5cdCAgdGVzdC5zZW1hcGhvcmUgKz0gMTtcblx0ICBjb25maWcuYmxvY2tpbmcgPSB0cnVlOyAvLyBTZXQgYSByZWNvdmVyeSB0aW1lb3V0LCBpZiBzbyBjb25maWd1cmVkLlxuXG5cdCAgaWYgKGRlZmluZWQuc2V0VGltZW91dCkge1xuXHQgICAgdmFyIHRpbWVvdXREdXJhdGlvbjtcblxuXHQgICAgaWYgKHR5cGVvZiB0ZXN0LnRpbWVvdXQgPT09IFwibnVtYmVyXCIpIHtcblx0ICAgICAgdGltZW91dER1cmF0aW9uID0gdGVzdC50aW1lb3V0O1xuXHQgICAgfSBlbHNlIGlmICh0eXBlb2YgY29uZmlnLnRlc3RUaW1lb3V0ID09PSBcIm51bWJlclwiKSB7XG5cdCAgICAgIHRpbWVvdXREdXJhdGlvbiA9IGNvbmZpZy50ZXN0VGltZW91dDtcblx0ICAgIH1cblxuXHQgICAgaWYgKHR5cGVvZiB0aW1lb3V0RHVyYXRpb24gPT09IFwibnVtYmVyXCIgJiYgdGltZW91dER1cmF0aW9uID4gMCkge1xuXHQgICAgICBjbGVhclRpbWVvdXQoY29uZmlnLnRpbWVvdXQpO1xuXG5cdCAgICAgIGNvbmZpZy50aW1lb3V0SGFuZGxlciA9IGZ1bmN0aW9uICh0aW1lb3V0KSB7XG5cdCAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgIHB1c2hGYWlsdXJlKFwiVGVzdCB0b29rIGxvbmdlciB0aGFuIFwiLmNvbmNhdCh0aW1lb3V0LCBcIm1zOyB0ZXN0IHRpbWVkIG91dC5cIiksIHNvdXJjZUZyb21TdGFja3RyYWNlKDIpKTtcblx0ICAgICAgICAgIHJlbGVhc2VkID0gdHJ1ZTtcblx0ICAgICAgICAgIGludGVybmFsUmVjb3Zlcih0ZXN0KTtcblx0ICAgICAgICB9O1xuXHQgICAgICB9O1xuXG5cdCAgICAgIGNvbmZpZy50aW1lb3V0ID0gc2V0VGltZW91dCQxKGNvbmZpZy50aW1lb3V0SGFuZGxlcih0aW1lb3V0RHVyYXRpb24pLCB0aW1lb3V0RHVyYXRpb24pO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiBmdW5jdGlvbiByZXN1bWUoKSB7XG5cdCAgICBpZiAocmVsZWFzZWQpIHtcblx0ICAgICAgcmV0dXJuO1xuXHQgICAgfVxuXG5cdCAgICByZWxlYXNlZCA9IHRydWU7XG5cdCAgICB0ZXN0LnNlbWFwaG9yZSAtPSAxO1xuXHQgICAgaW50ZXJuYWxTdGFydCh0ZXN0KTtcblx0ICB9O1xuXHR9IC8vIEZvcmNlZnVsbHkgcmVsZWFzZSBhbGwgcHJvY2Vzc2luZyBob2xkcy5cblxuXHRmdW5jdGlvbiBpbnRlcm5hbFJlY292ZXIodGVzdCkge1xuXHQgIHRlc3Quc2VtYXBob3JlID0gMDtcblx0ICBpbnRlcm5hbFN0YXJ0KHRlc3QpO1xuXHR9IC8vIFJlbGVhc2UgYSBwcm9jZXNzaW5nIGhvbGQsIHNjaGVkdWxpbmcgYSByZXN1bXB0aW9uIGF0dGVtcHQgaWYgbm8gaG9sZHMgcmVtYWluLlxuXG5cblx0ZnVuY3Rpb24gaW50ZXJuYWxTdGFydCh0ZXN0KSB7XG5cdCAgLy8gSWYgc2VtYXBob3JlIGlzIG5vbi1udW1lcmljLCB0aHJvdyBlcnJvclxuXHQgIGlmIChpc05hTih0ZXN0LnNlbWFwaG9yZSkpIHtcblx0ICAgIHRlc3Quc2VtYXBob3JlID0gMDtcblx0ICAgIHB1c2hGYWlsdXJlKFwiSW52YWxpZCB2YWx1ZSBvbiB0ZXN0LnNlbWFwaG9yZVwiLCBzb3VyY2VGcm9tU3RhY2t0cmFjZSgyKSk7XG5cdCAgICByZXR1cm47XG5cdCAgfSAvLyBEb24ndCBzdGFydCB1bnRpbCBlcXVhbCBudW1iZXIgb2Ygc3RvcC1jYWxsc1xuXG5cblx0ICBpZiAodGVzdC5zZW1hcGhvcmUgPiAwKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfSAvLyBUaHJvdyBhbiBFcnJvciBpZiBzdGFydCBpcyBjYWxsZWQgbW9yZSBvZnRlbiB0aGFuIHN0b3BcblxuXG5cdCAgaWYgKHRlc3Quc2VtYXBob3JlIDwgMCkge1xuXHQgICAgdGVzdC5zZW1hcGhvcmUgPSAwO1xuXHQgICAgcHVzaEZhaWx1cmUoXCJUcmllZCB0byByZXN0YXJ0IHRlc3Qgd2hpbGUgYWxyZWFkeSBzdGFydGVkICh0ZXN0J3Mgc2VtYXBob3JlIHdhcyAwIGFscmVhZHkpXCIsIHNvdXJjZUZyb21TdGFja3RyYWNlKDIpKTtcblx0ICAgIHJldHVybjtcblx0ICB9IC8vIEFkZCBhIHNsaWdodCBkZWxheSB0byBhbGxvdyBtb3JlIGFzc2VydGlvbnMgZXRjLlxuXG5cblx0ICBpZiAoZGVmaW5lZC5zZXRUaW1lb3V0KSB7XG5cdCAgICBpZiAoY29uZmlnLnRpbWVvdXQpIHtcblx0ICAgICAgY2xlYXJUaW1lb3V0KGNvbmZpZy50aW1lb3V0KTtcblx0ICAgIH1cblxuXHQgICAgY29uZmlnLnRpbWVvdXQgPSBzZXRUaW1lb3V0JDEoZnVuY3Rpb24gKCkge1xuXHQgICAgICBpZiAodGVzdC5zZW1hcGhvcmUgPiAwKSB7XG5cdCAgICAgICAgcmV0dXJuO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKGNvbmZpZy50aW1lb3V0KSB7XG5cdCAgICAgICAgY2xlYXJUaW1lb3V0KGNvbmZpZy50aW1lb3V0KTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGJlZ2luKCk7XG5cdCAgICB9KTtcblx0ICB9IGVsc2Uge1xuXHQgICAgYmVnaW4oKTtcblx0ICB9XG5cdH1cblxuXHRmdW5jdGlvbiBjb2xsZWN0VGVzdHMobW9kdWxlKSB7XG5cdCAgdmFyIHRlc3RzID0gW10uY29uY2F0KG1vZHVsZS50ZXN0cyk7XG5cblx0ICB2YXIgbW9kdWxlcyA9IF90b0NvbnN1bWFibGVBcnJheShtb2R1bGUuY2hpbGRNb2R1bGVzKTsgLy8gRG8gYSBicmVhZHRoLWZpcnN0IHRyYXZlcnNhbCBvZiB0aGUgY2hpbGQgbW9kdWxlc1xuXG5cblx0ICB3aGlsZSAobW9kdWxlcy5sZW5ndGgpIHtcblx0ICAgIHZhciBuZXh0TW9kdWxlID0gbW9kdWxlcy5zaGlmdCgpO1xuXHQgICAgdGVzdHMucHVzaC5hcHBseSh0ZXN0cywgbmV4dE1vZHVsZS50ZXN0cyk7XG5cdCAgICBtb2R1bGVzLnB1c2guYXBwbHkobW9kdWxlcywgX3RvQ29uc3VtYWJsZUFycmF5KG5leHRNb2R1bGUuY2hpbGRNb2R1bGVzKSk7XG5cdCAgfVxuXG5cdCAgcmV0dXJuIHRlc3RzO1xuXHR9XG5cblx0ZnVuY3Rpb24gbnVtYmVyT2ZUZXN0cyhtb2R1bGUpIHtcblx0ICByZXR1cm4gY29sbGVjdFRlc3RzKG1vZHVsZSkubGVuZ3RoO1xuXHR9XG5cblx0ZnVuY3Rpb24gbnVtYmVyT2ZVbnNraXBwZWRUZXN0cyhtb2R1bGUpIHtcblx0ICByZXR1cm4gY29sbGVjdFRlc3RzKG1vZHVsZSkuZmlsdGVyKGZ1bmN0aW9uICh0ZXN0KSB7XG5cdCAgICByZXR1cm4gIXRlc3Quc2tpcDtcblx0ICB9KS5sZW5ndGg7XG5cdH1cblxuXHRmdW5jdGlvbiBub3RpZnlUZXN0c1Jhbihtb2R1bGUsIHNraXBwZWQpIHtcblx0ICBtb2R1bGUudGVzdHNSdW4rKztcblxuXHQgIGlmICghc2tpcHBlZCkge1xuXHQgICAgbW9kdWxlLnVuc2tpcHBlZFRlc3RzUnVuKys7XG5cdCAgfVxuXG5cdCAgd2hpbGUgKG1vZHVsZSA9IG1vZHVsZS5wYXJlbnRNb2R1bGUpIHtcblx0ICAgIG1vZHVsZS50ZXN0c1J1bisrO1xuXG5cdCAgICBpZiAoIXNraXBwZWQpIHtcblx0ICAgICAgbW9kdWxlLnVuc2tpcHBlZFRlc3RzUnVuKys7XG5cdCAgICB9XG5cdCAgfVxuXHR9XG5cblx0dmFyIEFzc2VydCA9IC8qI19fUFVSRV9fKi9mdW5jdGlvbiAoKSB7XG5cdCAgZnVuY3Rpb24gQXNzZXJ0KHRlc3RDb250ZXh0KSB7XG5cdCAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgQXNzZXJ0KTtcblxuXHQgICAgdGhpcy50ZXN0ID0gdGVzdENvbnRleHQ7XG5cdCAgfSAvLyBBc3NlcnQgaGVscGVyc1xuXG5cblx0ICBfY3JlYXRlQ2xhc3MoQXNzZXJ0LCBbe1xuXHQgICAga2V5OiBcInRpbWVvdXRcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiB0aW1lb3V0KGR1cmF0aW9uKSB7XG5cdCAgICAgIGlmICh0eXBlb2YgZHVyYXRpb24gIT09IFwibnVtYmVyXCIpIHtcblx0ICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJZb3UgbXVzdCBwYXNzIGEgbnVtYmVyIGFzIHRoZSBkdXJhdGlvbiB0byBhc3NlcnQudGltZW91dFwiKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHRoaXMudGVzdC50aW1lb3V0ID0gZHVyYXRpb247IC8vIElmIGEgdGltZW91dCBoYXMgYmVlbiBzZXQsIGNsZWFyIGl0IGFuZCByZXNldCB3aXRoIHRoZSBuZXcgZHVyYXRpb25cblxuXHQgICAgICBpZiAoY29uZmlnLnRpbWVvdXQpIHtcblx0ICAgICAgICBjbGVhclRpbWVvdXQoY29uZmlnLnRpbWVvdXQpO1xuXG5cdCAgICAgICAgaWYgKGNvbmZpZy50aW1lb3V0SGFuZGxlciAmJiB0aGlzLnRlc3QudGltZW91dCA+IDApIHtcblx0ICAgICAgICAgIHJlc2V0VGVzdFRpbWVvdXQodGhpcy50ZXN0LnRpbWVvdXQpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfSAvLyBEb2N1bWVudHMgYSBcInN0ZXBcIiwgd2hpY2ggaXMgYSBzdHJpbmcgdmFsdWUsIGluIGEgdGVzdCBhcyBhIHBhc3NpbmcgYXNzZXJ0aW9uXG5cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwic3RlcFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIHN0ZXAobWVzc2FnZSkge1xuXHQgICAgICB2YXIgYXNzZXJ0aW9uTWVzc2FnZSA9IG1lc3NhZ2U7XG5cdCAgICAgIHZhciByZXN1bHQgPSAhIW1lc3NhZ2U7XG5cdCAgICAgIHRoaXMudGVzdC5zdGVwcy5wdXNoKG1lc3NhZ2UpO1xuXG5cdCAgICAgIGlmIChvYmplY3RUeXBlKG1lc3NhZ2UpID09PSBcInVuZGVmaW5lZFwiIHx8IG1lc3NhZ2UgPT09IFwiXCIpIHtcblx0ICAgICAgICBhc3NlcnRpb25NZXNzYWdlID0gXCJZb3UgbXVzdCBwcm92aWRlIGEgbWVzc2FnZSB0byBhc3NlcnQuc3RlcFwiO1xuXHQgICAgICB9IGVsc2UgaWYgKG9iamVjdFR5cGUobWVzc2FnZSkgIT09IFwic3RyaW5nXCIpIHtcblx0ICAgICAgICBhc3NlcnRpb25NZXNzYWdlID0gXCJZb3UgbXVzdCBwcm92aWRlIGEgc3RyaW5nIHZhbHVlIHRvIGFzc2VydC5zdGVwXCI7XG5cdCAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG5cdCAgICAgIH1cblxuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogcmVzdWx0LFxuXHQgICAgICAgIG1lc3NhZ2U6IGFzc2VydGlvbk1lc3NhZ2Vcblx0ICAgICAgfSk7XG5cdCAgICB9IC8vIFZlcmlmaWVzIHRoZSBzdGVwcyBpbiBhIHRlc3QgbWF0Y2ggYSBnaXZlbiBhcnJheSBvZiBzdHJpbmcgdmFsdWVzXG5cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwidmVyaWZ5U3RlcHNcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiB2ZXJpZnlTdGVwcyhzdGVwcywgbWVzc2FnZSkge1xuXHQgICAgICAvLyBTaW5jZSB0aGUgc3RlcHMgYXJyYXkgaXMganVzdCBzdHJpbmcgdmFsdWVzLCB3ZSBjYW4gY2xvbmUgd2l0aCBzbGljZVxuXHQgICAgICB2YXIgYWN0dWFsU3RlcHNDbG9uZSA9IHRoaXMudGVzdC5zdGVwcy5zbGljZSgpO1xuXHQgICAgICB0aGlzLmRlZXBFcXVhbChhY3R1YWxTdGVwc0Nsb25lLCBzdGVwcywgbWVzc2FnZSk7XG5cdCAgICAgIHRoaXMudGVzdC5zdGVwcy5sZW5ndGggPSAwO1xuXHQgICAgfSAvLyBTcGVjaWZ5IHRoZSBudW1iZXIgb2YgZXhwZWN0ZWQgYXNzZXJ0aW9ucyB0byBndWFyYW50ZWUgdGhhdCBmYWlsZWQgdGVzdFxuXHQgICAgLy8gKG5vIGFzc2VydGlvbnMgYXJlIHJ1biBhdCBhbGwpIGRvbid0IHNsaXAgdGhyb3VnaC5cblxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJleHBlY3RcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBleHBlY3QoYXNzZXJ0cykge1xuXHQgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuXHQgICAgICAgIHRoaXMudGVzdC5leHBlY3RlZCA9IGFzc2VydHM7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmV0dXJuIHRoaXMudGVzdC5leHBlY3RlZDtcblx0ICAgICAgfVxuXHQgICAgfSAvLyBQdXQgYSBob2xkIG9uIHByb2Nlc3NpbmcgYW5kIHJldHVybiBhIGZ1bmN0aW9uIHRoYXQgd2lsbCByZWxlYXNlIGl0IGEgbWF4aW11bSBvZiBvbmNlLlxuXG5cdCAgfSwge1xuXHQgICAga2V5OiBcImFzeW5jXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gYXN5bmMoY291bnQpIHtcblx0ICAgICAgdmFyIHRlc3QgPSB0aGlzLnRlc3Q7XG5cdCAgICAgIHZhciBwb3BwZWQgPSBmYWxzZSxcblx0ICAgICAgICAgIGFjY2VwdENhbGxDb3VudCA9IGNvdW50O1xuXG5cdCAgICAgIGlmICh0eXBlb2YgYWNjZXB0Q2FsbENvdW50ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdCAgICAgICAgYWNjZXB0Q2FsbENvdW50ID0gMTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHZhciByZXN1bWUgPSBpbnRlcm5hbFN0b3AodGVzdCk7XG5cdCAgICAgIHJldHVybiBmdW5jdGlvbiBkb25lKCkge1xuXHQgICAgICAgIGlmIChjb25maWcuY3VycmVudCAhPT0gdGVzdCkge1xuXHQgICAgICAgICAgdGhyb3cgRXJyb3IoXCJhc3NlcnQuYXN5bmMgY2FsbGJhY2sgY2FsbGVkIGFmdGVyIHRlc3QgZmluaXNoZWQuXCIpO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGlmIChwb3BwZWQpIHtcblx0ICAgICAgICAgIHRlc3QucHVzaEZhaWx1cmUoXCJUb28gbWFueSBjYWxscyB0byB0aGUgYGFzc2VydC5hc3luY2AgY2FsbGJhY2tcIiwgc291cmNlRnJvbVN0YWNrdHJhY2UoMikpO1xuXHQgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGFjY2VwdENhbGxDb3VudCAtPSAxO1xuXG5cdCAgICAgICAgaWYgKGFjY2VwdENhbGxDb3VudCA+IDApIHtcblx0ICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBwb3BwZWQgPSB0cnVlO1xuXHQgICAgICAgIHJlc3VtZSgpO1xuXHQgICAgICB9O1xuXHQgICAgfSAvLyBFeHBvcnRzIHRlc3QucHVzaCgpIHRvIHRoZSB1c2VyIEFQSVxuXHQgICAgLy8gQWxpYXMgb2YgcHVzaFJlc3VsdC5cblxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJwdXNoXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gcHVzaChyZXN1bHQsIGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsIG5lZ2F0aXZlKSB7XG5cdCAgICAgIExvZ2dlci53YXJuKFwiYXNzZXJ0LnB1c2ggaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIFFVbml0IDMuMC5cIiArIFwiIFBsZWFzZSB1c2UgYXNzZXJ0LnB1c2hSZXN1bHQgaW5zdGVhZCAoaHR0cHM6Ly9hcGkucXVuaXRqcy5jb20vYXNzZXJ0L3B1c2hSZXN1bHQpLlwiKTtcblx0ICAgICAgdmFyIGN1cnJlbnRBc3NlcnQgPSB0aGlzIGluc3RhbmNlb2YgQXNzZXJ0ID8gdGhpcyA6IGNvbmZpZy5jdXJyZW50LmFzc2VydDtcblx0ICAgICAgcmV0dXJuIGN1cnJlbnRBc3NlcnQucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiByZXN1bHQsXG5cdCAgICAgICAgYWN0dWFsOiBhY3R1YWwsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG5cdCAgICAgICAgbmVnYXRpdmU6IG5lZ2F0aXZlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJwdXNoUmVzdWx0XCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gcHVzaFJlc3VsdChyZXN1bHRJbmZvKSB7XG5cdCAgICAgIC8vIERlc3RydWN0dXJlIG9mIHJlc3VsdEluZm8gPSB7IHJlc3VsdCwgYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgbmVnYXRpdmUgfVxuXHQgICAgICB2YXIgYXNzZXJ0ID0gdGhpcztcblx0ICAgICAgdmFyIGN1cnJlbnRUZXN0ID0gYXNzZXJ0IGluc3RhbmNlb2YgQXNzZXJ0ICYmIGFzc2VydC50ZXN0IHx8IGNvbmZpZy5jdXJyZW50OyAvLyBCYWNrd2FyZHMgY29tcGF0aWJpbGl0eSBmaXguXG5cdCAgICAgIC8vIEFsbG93cyB0aGUgZGlyZWN0IHVzZSBvZiBnbG9iYWwgZXhwb3J0ZWQgYXNzZXJ0aW9ucyBhbmQgUVVuaXQuYXNzZXJ0Lipcblx0ICAgICAgLy8gQWx0aG91Z2gsIGl0J3MgdXNlIGlzIG5vdCByZWNvbW1lbmRlZCBhcyBpdCBjYW4gbGVhayBhc3NlcnRpb25zXG5cdCAgICAgIC8vIHRvIG90aGVyIHRlc3RzIGZyb20gYXN5bmMgdGVzdHMsIGJlY2F1c2Ugd2Ugb25seSBnZXQgYSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgdGVzdCxcblx0ICAgICAgLy8gbm90IGV4YWN0bHkgdGhlIHRlc3Qgd2hlcmUgYXNzZXJ0aW9uIHdlcmUgaW50ZW5kZWQgdG8gYmUgY2FsbGVkLlxuXG5cdCAgICAgIGlmICghY3VycmVudFRlc3QpIHtcblx0ICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJhc3NlcnRpb24gb3V0c2lkZSB0ZXN0IGNvbnRleHQsIGluIFwiICsgc291cmNlRnJvbVN0YWNrdHJhY2UoMikpO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKCEoYXNzZXJ0IGluc3RhbmNlb2YgQXNzZXJ0KSkge1xuXHQgICAgICAgIGFzc2VydCA9IGN1cnJlbnRUZXN0LmFzc2VydDtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBhc3NlcnQudGVzdC5wdXNoUmVzdWx0KHJlc3VsdEluZm8pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJva1wiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIG9rKHJlc3VsdCwgbWVzc2FnZSkge1xuXHQgICAgICBpZiAoIW1lc3NhZ2UpIHtcblx0ICAgICAgICBtZXNzYWdlID0gcmVzdWx0ID8gXCJva2F5XCIgOiBcImZhaWxlZCwgZXhwZWN0ZWQgYXJndW1lbnQgdG8gYmUgdHJ1dGh5LCB3YXM6IFwiLmNvbmNhdChkdW1wLnBhcnNlKHJlc3VsdCkpO1xuXHQgICAgICB9XG5cblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6ICEhcmVzdWx0LFxuXHQgICAgICAgIGFjdHVhbDogcmVzdWx0LFxuXHQgICAgICAgIGV4cGVjdGVkOiB0cnVlLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2Vcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcIm5vdE9rXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gbm90T2socmVzdWx0LCBtZXNzYWdlKSB7XG5cdCAgICAgIGlmICghbWVzc2FnZSkge1xuXHQgICAgICAgIG1lc3NhZ2UgPSAhcmVzdWx0ID8gXCJva2F5XCIgOiBcImZhaWxlZCwgZXhwZWN0ZWQgYXJndW1lbnQgdG8gYmUgZmFsc3ksIHdhczogXCIuY29uY2F0KGR1bXAucGFyc2UocmVzdWx0KSk7XG5cdCAgICAgIH1cblxuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogIXJlc3VsdCxcblx0ICAgICAgICBhY3R1YWw6IHJlc3VsdCxcblx0ICAgICAgICBleHBlY3RlZDogZmFsc2UsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwidHJ1ZVwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIF90cnVlKHJlc3VsdCwgbWVzc2FnZSkge1xuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogcmVzdWx0ID09PSB0cnVlLFxuXHQgICAgICAgIGFjdHVhbDogcmVzdWx0LFxuXHQgICAgICAgIGV4cGVjdGVkOiB0cnVlLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2Vcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcImZhbHNlXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gX2ZhbHNlKHJlc3VsdCwgbWVzc2FnZSkge1xuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogcmVzdWx0ID09PSBmYWxzZSxcblx0ICAgICAgICBhY3R1YWw6IHJlc3VsdCxcblx0ICAgICAgICBleHBlY3RlZDogZmFsc2UsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwiZXF1YWxcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBlcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG5cdCAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBlcWVxZXFcblx0ICAgICAgdmFyIHJlc3VsdCA9IGV4cGVjdGVkID09IGFjdHVhbDtcblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6IHJlc3VsdCxcblx0ICAgICAgICBhY3R1YWw6IGFjdHVhbCxcblx0ICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwibm90RXF1YWxcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBub3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG5cdCAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBlcWVxZXFcblx0ICAgICAgdmFyIHJlc3VsdCA9IGV4cGVjdGVkICE9IGFjdHVhbDtcblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6IHJlc3VsdCxcblx0ICAgICAgICBhY3R1YWw6IGFjdHVhbCxcblx0ICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcblx0ICAgICAgICBuZWdhdGl2ZTogdHJ1ZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwicHJvcEVxdWFsXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gcHJvcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcblx0ICAgICAgYWN0dWFsID0gb2JqZWN0VmFsdWVzKGFjdHVhbCk7XG5cdCAgICAgIGV4cGVjdGVkID0gb2JqZWN0VmFsdWVzKGV4cGVjdGVkKTtcblx0ICAgICAgdGhpcy5wdXNoUmVzdWx0KHtcblx0ICAgICAgICByZXN1bHQ6IGVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQpLFxuXHQgICAgICAgIGFjdHVhbDogYWN0dWFsLFxuXHQgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJub3RQcm9wRXF1YWxcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBub3RQcm9wRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuXHQgICAgICBhY3R1YWwgPSBvYmplY3RWYWx1ZXMoYWN0dWFsKTtcblx0ICAgICAgZXhwZWN0ZWQgPSBvYmplY3RWYWx1ZXMoZXhwZWN0ZWQpO1xuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogIWVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQpLFxuXHQgICAgICAgIGFjdHVhbDogYWN0dWFsLFxuXHQgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuXHQgICAgICAgIG5lZ2F0aXZlOiB0cnVlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJkZWVwRXF1YWxcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBkZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogZXF1aXYoYWN0dWFsLCBleHBlY3RlZCksXG5cdCAgICAgICAgYWN0dWFsOiBhY3R1YWwsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2Vcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcIm5vdERlZXBFcXVhbFwiLFxuXHQgICAgdmFsdWU6IGZ1bmN0aW9uIG5vdERlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiAhZXF1aXYoYWN0dWFsLCBleHBlY3RlZCksXG5cdCAgICAgICAgYWN0dWFsOiBhY3R1YWwsXG5cdCAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuXHQgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG5cdCAgICAgICAgbmVnYXRpdmU6IHRydWVcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSwge1xuXHQgICAga2V5OiBcInN0cmljdEVxdWFsXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuXHQgICAgICB0aGlzLnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogZXhwZWN0ZWQgPT09IGFjdHVhbCxcblx0ICAgICAgICBhY3R1YWw6IGFjdHVhbCxcblx0ICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9LCB7XG5cdCAgICBrZXk6IFwibm90U3RyaWN0RXF1YWxcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiBub3RTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG5cdCAgICAgIHRoaXMucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgcmVzdWx0OiBleHBlY3RlZCAhPT0gYWN0dWFsLFxuXHQgICAgICAgIGFjdHVhbDogYWN0dWFsLFxuXHQgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuXHQgICAgICAgIG5lZ2F0aXZlOiB0cnVlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJ0aHJvd3NcIixcblx0ICAgIHZhbHVlOiBmdW5jdGlvbiB0aHJvd3MoYmxvY2ssIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG5cdCAgICAgIHZhciBhY3R1YWwsXG5cdCAgICAgICAgICByZXN1bHQgPSBmYWxzZTtcblx0ICAgICAgdmFyIGN1cnJlbnRUZXN0ID0gdGhpcyBpbnN0YW5jZW9mIEFzc2VydCAmJiB0aGlzLnRlc3QgfHwgY29uZmlnLmN1cnJlbnQ7IC8vICdleHBlY3RlZCcgaXMgb3B0aW9uYWwgdW5sZXNzIGRvaW5nIHN0cmluZyBjb21wYXJpc29uXG5cblx0ICAgICAgaWYgKG9iamVjdFR5cGUoZXhwZWN0ZWQpID09PSBcInN0cmluZ1wiKSB7XG5cdCAgICAgICAgaWYgKG1lc3NhZ2UgPT0gbnVsbCkge1xuXHQgICAgICAgICAgbWVzc2FnZSA9IGV4cGVjdGVkO1xuXHQgICAgICAgICAgZXhwZWN0ZWQgPSBudWxsO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0aHJvd3MvcmFpc2VzIGRvZXMgbm90IGFjY2VwdCBhIHN0cmluZyB2YWx1ZSBmb3IgdGhlIGV4cGVjdGVkIGFyZ3VtZW50LlxcblwiICsgXCJVc2UgYSBub24tc3RyaW5nIG9iamVjdCB2YWx1ZSAoZS5nLiByZWdFeHApIGluc3RlYWQgaWYgaXQncyBuZWNlc3NhcnkuXCIpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIGN1cnJlbnRUZXN0Lmlnbm9yZUdsb2JhbEVycm9ycyA9IHRydWU7XG5cblx0ICAgICAgdHJ5IHtcblx0ICAgICAgICBibG9jay5jYWxsKGN1cnJlbnRUZXN0LnRlc3RFbnZpcm9ubWVudCk7XG5cdCAgICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgICBhY3R1YWwgPSBlO1xuXHQgICAgICB9XG5cblx0ICAgICAgY3VycmVudFRlc3QuaWdub3JlR2xvYmFsRXJyb3JzID0gZmFsc2U7XG5cblx0ICAgICAgaWYgKGFjdHVhbCkge1xuXHQgICAgICAgIHZhciBleHBlY3RlZFR5cGUgPSBvYmplY3RUeXBlKGV4cGVjdGVkKTsgLy8gV2UgZG9uJ3Qgd2FudCB0byB2YWxpZGF0ZSB0aHJvd24gZXJyb3JcblxuXHQgICAgICAgIGlmICghZXhwZWN0ZWQpIHtcblx0ICAgICAgICAgIHJlc3VsdCA9IHRydWU7IC8vIEV4cGVjdGVkIGlzIGEgcmVnZXhwXG5cdCAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZFR5cGUgPT09IFwicmVnZXhwXCIpIHtcblx0ICAgICAgICAgIHJlc3VsdCA9IGV4cGVjdGVkLnRlc3QoZXJyb3JTdHJpbmcoYWN0dWFsKSk7IC8vIExvZyB0aGUgc3RyaW5nIGZvcm0gb2YgdGhlIHJlZ2V4cFxuXG5cdCAgICAgICAgICBleHBlY3RlZCA9IFN0cmluZyhleHBlY3RlZCk7IC8vIEV4cGVjdGVkIGlzIGEgY29uc3RydWN0b3IsIG1heWJlIGFuIEVycm9yIGNvbnN0cnVjdG9yXG5cdCAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZFR5cGUgPT09IFwiZnVuY3Rpb25cIiAmJiBhY3R1YWwgaW5zdGFuY2VvZiBleHBlY3RlZCkge1xuXHQgICAgICAgICAgcmVzdWx0ID0gdHJ1ZTsgLy8gRXhwZWN0ZWQgaXMgYW4gRXJyb3Igb2JqZWN0XG5cdCAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZFR5cGUgPT09IFwib2JqZWN0XCIpIHtcblx0ICAgICAgICAgIHJlc3VsdCA9IGFjdHVhbCBpbnN0YW5jZW9mIGV4cGVjdGVkLmNvbnN0cnVjdG9yICYmIGFjdHVhbC5uYW1lID09PSBleHBlY3RlZC5uYW1lICYmIGFjdHVhbC5tZXNzYWdlID09PSBleHBlY3RlZC5tZXNzYWdlOyAvLyBMb2cgdGhlIHN0cmluZyBmb3JtIG9mIHRoZSBFcnJvciBvYmplY3RcblxuXHQgICAgICAgICAgZXhwZWN0ZWQgPSBlcnJvclN0cmluZyhleHBlY3RlZCk7IC8vIEV4cGVjdGVkIGlzIGEgdmFsaWRhdGlvbiBmdW5jdGlvbiB3aGljaCByZXR1cm5zIHRydWUgaWYgdmFsaWRhdGlvbiBwYXNzZWRcblx0ICAgICAgICB9IGVsc2UgaWYgKGV4cGVjdGVkVHlwZSA9PT0gXCJmdW5jdGlvblwiICYmIGV4cGVjdGVkLmNhbGwoe30sIGFjdHVhbCkgPT09IHRydWUpIHtcblx0ICAgICAgICAgIGV4cGVjdGVkID0gbnVsbDtcblx0ICAgICAgICAgIHJlc3VsdCA9IHRydWU7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgY3VycmVudFRlc3QuYXNzZXJ0LnB1c2hSZXN1bHQoe1xuXHQgICAgICAgIHJlc3VsdDogcmVzdWx0LFxuXHQgICAgICAgIC8vIHVuZGVmaW5lZCBpZiBpdCBkaWRuJ3QgdGhyb3dcblx0ICAgICAgICBhY3R1YWw6IGFjdHVhbCAmJiBlcnJvclN0cmluZyhhY3R1YWwpLFxuXHQgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcblx0ICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0sIHtcblx0ICAgIGtleTogXCJyZWplY3RzXCIsXG5cdCAgICB2YWx1ZTogZnVuY3Rpb24gcmVqZWN0cyhwcm9taXNlLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuXHQgICAgICB2YXIgcmVzdWx0ID0gZmFsc2U7XG5cdCAgICAgIHZhciBjdXJyZW50VGVzdCA9IHRoaXMgaW5zdGFuY2VvZiBBc3NlcnQgJiYgdGhpcy50ZXN0IHx8IGNvbmZpZy5jdXJyZW50OyAvLyAnZXhwZWN0ZWQnIGlzIG9wdGlvbmFsIHVubGVzcyBkb2luZyBzdHJpbmcgY29tcGFyaXNvblxuXG5cdCAgICAgIGlmIChvYmplY3RUeXBlKGV4cGVjdGVkKSA9PT0gXCJzdHJpbmdcIikge1xuXHQgICAgICAgIGlmIChtZXNzYWdlID09PSB1bmRlZmluZWQpIHtcblx0ICAgICAgICAgIG1lc3NhZ2UgPSBleHBlY3RlZDtcblx0ICAgICAgICAgIGV4cGVjdGVkID0gdW5kZWZpbmVkO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBtZXNzYWdlID0gXCJhc3NlcnQucmVqZWN0cyBkb2VzIG5vdCBhY2NlcHQgYSBzdHJpbmcgdmFsdWUgZm9yIHRoZSBleHBlY3RlZCBcIiArIFwiYXJndW1lbnQuXFxuVXNlIGEgbm9uLXN0cmluZyBvYmplY3QgdmFsdWUgKGUuZy4gdmFsaWRhdG9yIGZ1bmN0aW9uKSBpbnN0ZWFkIFwiICsgXCJpZiBuZWNlc3NhcnkuXCI7XG5cdCAgICAgICAgICBjdXJyZW50VGVzdC5hc3NlcnQucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgICAgIHJlc3VsdDogZmFsc2UsXG5cdCAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2Vcblx0ICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHZhciB0aGVuID0gcHJvbWlzZSAmJiBwcm9taXNlLnRoZW47XG5cblx0ICAgICAgaWYgKG9iamVjdFR5cGUodGhlbikgIT09IFwiZnVuY3Rpb25cIikge1xuXHQgICAgICAgIHZhciBfbWVzc2FnZSA9IFwiVGhlIHZhbHVlIHByb3ZpZGVkIHRvIGBhc3NlcnQucmVqZWN0c2AgaW4gXCIgKyBcIlxcXCJcIiArIGN1cnJlbnRUZXN0LnRlc3ROYW1lICsgXCJcXFwiIHdhcyBub3QgYSBwcm9taXNlLlwiO1xuXG5cdCAgICAgICAgY3VycmVudFRlc3QuYXNzZXJ0LnB1c2hSZXN1bHQoe1xuXHQgICAgICAgICAgcmVzdWx0OiBmYWxzZSxcblx0ICAgICAgICAgIG1lc3NhZ2U6IF9tZXNzYWdlLFxuXHQgICAgICAgICAgYWN0dWFsOiBwcm9taXNlXG5cdCAgICAgICAgfSk7XG5cdCAgICAgICAgcmV0dXJuO1xuXHQgICAgICB9XG5cblx0ICAgICAgdmFyIGRvbmUgPSB0aGlzLmFzeW5jKCk7XG5cdCAgICAgIHJldHVybiB0aGVuLmNhbGwocHJvbWlzZSwgZnVuY3Rpb24gaGFuZGxlRnVsZmlsbG1lbnQoKSB7XG5cdCAgICAgICAgdmFyIG1lc3NhZ2UgPSBcIlRoZSBwcm9taXNlIHJldHVybmVkIGJ5IHRoZSBgYXNzZXJ0LnJlamVjdHNgIGNhbGxiYWNrIGluIFwiICsgXCJcXFwiXCIgKyBjdXJyZW50VGVzdC50ZXN0TmFtZSArIFwiXFxcIiBkaWQgbm90IHJlamVjdC5cIjtcblx0ICAgICAgICBjdXJyZW50VGVzdC5hc3NlcnQucHVzaFJlc3VsdCh7XG5cdCAgICAgICAgICByZXN1bHQ6IGZhbHNlLFxuXHQgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcblx0ICAgICAgICAgIGFjdHVhbDogcHJvbWlzZVxuXHQgICAgICAgIH0pO1xuXHQgICAgICAgIGRvbmUoKTtcblx0ICAgICAgfSwgZnVuY3Rpb24gaGFuZGxlUmVqZWN0aW9uKGFjdHVhbCkge1xuXHQgICAgICAgIHZhciBleHBlY3RlZFR5cGUgPSBvYmplY3RUeXBlKGV4cGVjdGVkKTsgLy8gV2UgZG9uJ3Qgd2FudCB0byB2YWxpZGF0ZVxuXG5cdCAgICAgICAgaWYgKGV4cGVjdGVkID09PSB1bmRlZmluZWQpIHtcblx0ICAgICAgICAgIHJlc3VsdCA9IHRydWU7IC8vIEV4cGVjdGVkIGlzIGEgcmVnZXhwXG5cdCAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZFR5cGUgPT09IFwicmVnZXhwXCIpIHtcblx0ICAgICAgICAgIHJlc3VsdCA9IGV4cGVjdGVkLnRlc3QoZXJyb3JTdHJpbmcoYWN0dWFsKSk7IC8vIExvZyB0aGUgc3RyaW5nIGZvcm0gb2YgdGhlIHJlZ2V4cFxuXG5cdCAgICAgICAgICBleHBlY3RlZCA9IFN0cmluZyhleHBlY3RlZCk7IC8vIEV4cGVjdGVkIGlzIGEgY29uc3RydWN0b3IsIG1heWJlIGFuIEVycm9yIGNvbnN0cnVjdG9yXG5cdCAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZFR5cGUgPT09IFwiZnVuY3Rpb25cIiAmJiBhY3R1YWwgaW5zdGFuY2VvZiBleHBlY3RlZCkge1xuXHQgICAgICAgICAgcmVzdWx0ID0gdHJ1ZTsgLy8gRXhwZWN0ZWQgaXMgYW4gRXJyb3Igb2JqZWN0XG5cdCAgICAgICAgfSBlbHNlIGlmIChleHBlY3RlZFR5cGUgPT09IFwib2JqZWN0XCIpIHtcblx0ICAgICAgICAgIHJlc3VsdCA9IGFjdHVhbCBpbnN0YW5jZW9mIGV4cGVjdGVkLmNvbnN0cnVjdG9yICYmIGFjdHVhbC5uYW1lID09PSBleHBlY3RlZC5uYW1lICYmIGFjdHVhbC5tZXNzYWdlID09PSBleHBlY3RlZC5tZXNzYWdlOyAvLyBMb2cgdGhlIHN0cmluZyBmb3JtIG9mIHRoZSBFcnJvciBvYmplY3RcblxuXHQgICAgICAgICAgZXhwZWN0ZWQgPSBlcnJvclN0cmluZyhleHBlY3RlZCk7IC8vIEV4cGVjdGVkIGlzIGEgdmFsaWRhdGlvbiBmdW5jdGlvbiB3aGljaCByZXR1cm5zIHRydWUgaWYgdmFsaWRhdGlvbiBwYXNzZWRcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgaWYgKGV4cGVjdGVkVHlwZSA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdCAgICAgICAgICAgIHJlc3VsdCA9IGV4cGVjdGVkLmNhbGwoe30sIGFjdHVhbCkgPT09IHRydWU7XG5cdCAgICAgICAgICAgIGV4cGVjdGVkID0gbnVsbDsgLy8gRXhwZWN0ZWQgaXMgc29tZSBvdGhlciBpbnZhbGlkIHR5cGVcblx0ICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgIHJlc3VsdCA9IGZhbHNlO1xuXHQgICAgICAgICAgICBtZXNzYWdlID0gXCJpbnZhbGlkIGV4cGVjdGVkIHZhbHVlIHByb3ZpZGVkIHRvIGBhc3NlcnQucmVqZWN0c2AgXCIgKyBcImNhbGxiYWNrIGluIFxcXCJcIiArIGN1cnJlbnRUZXN0LnRlc3ROYW1lICsgXCJcXFwiOiBcIiArIGV4cGVjdGVkVHlwZSArIFwiLlwiO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGN1cnJlbnRUZXN0LmFzc2VydC5wdXNoUmVzdWx0KHtcblx0ICAgICAgICAgIHJlc3VsdDogcmVzdWx0LFxuXHQgICAgICAgICAgLy8gbGVhdmUgcmVqZWN0aW9uIHZhbHVlIG9mIHVuZGVmaW5lZCBhcy1pc1xuXHQgICAgICAgICAgYWN0dWFsOiBhY3R1YWwgJiYgZXJyb3JTdHJpbmcoYWN0dWFsKSxcblx0ICAgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcblx0ICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2Vcblx0ICAgICAgICB9KTtcblx0ICAgICAgICBkb25lKCk7XG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH1dKTtcblxuXHQgIHJldHVybiBBc3NlcnQ7XG5cdH0oKTsgLy8gUHJvdmlkZSBhbiBhbHRlcm5hdGl2ZSB0byBhc3NlcnQudGhyb3dzKCksIGZvciBlbnZpcm9ubWVudHMgdGhhdCBjb25zaWRlciB0aHJvd3MgYSByZXNlcnZlZCB3b3JkXG5cdC8vIEtub3duIHRvIHVzIGFyZTogQ2xvc3VyZSBDb21waWxlciwgTmFyd2hhbFxuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgZG90LW5vdGF0aW9uXG5cblxuXHRBc3NlcnQucHJvdG90eXBlLnJhaXNlcyA9IEFzc2VydC5wcm90b3R5cGVbXCJ0aHJvd3NcIl07XG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhbiBlcnJvciBpbnRvIGEgc2ltcGxlIHN0cmluZyBmb3IgY29tcGFyaXNvbnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXJyb3J8T2JqZWN0fSBlcnJvclxuXHQgKiBAcmV0dXJuIHtTdHJpbmd9XG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGVycm9yU3RyaW5nKGVycm9yKSB7XG5cdCAgdmFyIHJlc3VsdEVycm9yU3RyaW5nID0gZXJyb3IudG9TdHJpbmcoKTsgLy8gSWYgdGhlIGVycm9yIHdhc24ndCBhIHN1YmNsYXNzIG9mIEVycm9yIGJ1dCBzb21ldGhpbmcgbGlrZVxuXHQgIC8vIGFuIG9iamVjdCBsaXRlcmFsIHdpdGggbmFtZSBhbmQgbWVzc2FnZSBwcm9wZXJ0aWVzLi4uXG5cblx0ICBpZiAocmVzdWx0RXJyb3JTdHJpbmcuc3Vic3RyaW5nKDAsIDcpID09PSBcIltvYmplY3RcIikge1xuXHQgICAgdmFyIG5hbWUgPSBlcnJvci5uYW1lID8gZXJyb3IubmFtZS50b1N0cmluZygpIDogXCJFcnJvclwiO1xuXHQgICAgdmFyIG1lc3NhZ2UgPSBlcnJvci5tZXNzYWdlID8gZXJyb3IubWVzc2FnZS50b1N0cmluZygpIDogXCJcIjtcblxuXHQgICAgaWYgKG5hbWUgJiYgbWVzc2FnZSkge1xuXHQgICAgICByZXR1cm4gXCJcIi5jb25jYXQobmFtZSwgXCI6IFwiKS5jb25jYXQobWVzc2FnZSk7XG5cdCAgICB9IGVsc2UgaWYgKG5hbWUpIHtcblx0ICAgICAgcmV0dXJuIG5hbWU7XG5cdCAgICB9IGVsc2UgaWYgKG1lc3NhZ2UpIHtcblx0ICAgICAgcmV0dXJuIG1lc3NhZ2U7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICByZXR1cm4gXCJFcnJvclwiO1xuXHQgICAgfVxuXHQgIH0gZWxzZSB7XG5cdCAgICByZXR1cm4gcmVzdWx0RXJyb3JTdHJpbmc7XG5cdCAgfVxuXHR9XG5cblx0LyogZ2xvYmFsIG1vZHVsZSwgZXhwb3J0cywgZGVmaW5lICovXG5cdGZ1bmN0aW9uIGV4cG9ydFFVbml0KFFVbml0KSB7XG5cdCAgaWYgKGRlZmluZWQuZG9jdW1lbnQpIHtcblx0ICAgIC8vIFFVbml0IG1heSBiZSBkZWZpbmVkIHdoZW4gaXQgaXMgcHJlY29uZmlndXJlZCBidXQgdGhlbiBvbmx5IFFVbml0IGFuZCBRVW5pdC5jb25maWcgbWF5IGJlIGRlZmluZWQuXG5cdCAgICBpZiAod2luZG93JDEuUVVuaXQgJiYgd2luZG93JDEuUVVuaXQudmVyc2lvbikge1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJRVW5pdCBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWQuXCIpO1xuXHQgICAgfVxuXG5cdCAgICB3aW5kb3ckMS5RVW5pdCA9IFFVbml0O1xuXHQgIH0gLy8gRm9yIG5vZGVqc1xuXG5cblx0ICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUgJiYgbW9kdWxlLmV4cG9ydHMpIHtcblx0ICAgIG1vZHVsZS5leHBvcnRzID0gUVVuaXQ7IC8vIEZvciBjb25zaXN0ZW5jeSB3aXRoIENvbW1vbkpTIGVudmlyb25tZW50cycgZXhwb3J0c1xuXG5cdCAgICBtb2R1bGUuZXhwb3J0cy5RVW5pdCA9IFFVbml0O1xuXHQgIH0gLy8gRm9yIENvbW1vbkpTIHdpdGggZXhwb3J0cywgYnV0IHdpdGhvdXQgbW9kdWxlLmV4cG9ydHMsIGxpa2UgUmhpbm9cblxuXG5cdCAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiICYmIGV4cG9ydHMpIHtcblx0ICAgIGV4cG9ydHMuUVVuaXQgPSBRVW5pdDtcblx0ICB9XG5cblx0ICBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHtcblx0ICAgIGRlZmluZShmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHJldHVybiBRVW5pdDtcblx0ICAgIH0pO1xuXHQgICAgUVVuaXQuY29uZmlnLmF1dG9zdGFydCA9IGZhbHNlO1xuXHQgIH0gLy8gRm9yIFdlYi9TZXJ2aWNlIFdvcmtlcnNcblxuXG5cdCAgaWYgKHNlbGYkMSAmJiBzZWxmJDEuV29ya2VyR2xvYmFsU2NvcGUgJiYgc2VsZiQxIGluc3RhbmNlb2Ygc2VsZiQxLldvcmtlckdsb2JhbFNjb3BlKSB7XG5cdCAgICBzZWxmJDEuUVVuaXQgPSBRVW5pdDtcblx0ICB9XG5cdH1cblxuXHQvLyBlcnJvciBoYW5kbGluZyBzaG91bGQgYmUgc3VwcHJlc3NlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuXHQvLyBJbiB0aGlzIGNhc2UsIHdlIHdpbGwgb25seSBzdXBwcmVzcyBmdXJ0aGVyIGVycm9yIGhhbmRsaW5nIGlmIHRoZVxuXHQvLyBcImlnbm9yZUdsb2JhbEVycm9yc1wiIGNvbmZpZ3VyYXRpb24gb3B0aW9uIGlzIGVuYWJsZWQuXG5cblx0ZnVuY3Rpb24gb25FcnJvcihlcnJvcikge1xuXHQgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gbmV3IEFycmF5KF9sZW4gPiAxID8gX2xlbiAtIDEgOiAwKSwgX2tleSA9IDE7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcblx0ICAgIGFyZ3NbX2tleSAtIDFdID0gYXJndW1lbnRzW19rZXldO1xuXHQgIH1cblxuXHQgIGlmIChjb25maWcuY3VycmVudCkge1xuXHQgICAgaWYgKGNvbmZpZy5jdXJyZW50Lmlnbm9yZUdsb2JhbEVycm9ycykge1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH1cblxuXHQgICAgcHVzaEZhaWx1cmUuYXBwbHkodm9pZCAwLCBbZXJyb3IubWVzc2FnZSwgZXJyb3Iuc3RhY2t0cmFjZSB8fCBlcnJvci5maWxlTmFtZSArIFwiOlwiICsgZXJyb3IubGluZU51bWJlcl0uY29uY2F0KGFyZ3MpKTtcblx0ICB9IGVsc2Uge1xuXHQgICAgdGVzdChcImdsb2JhbCBmYWlsdXJlXCIsIGV4dGVuZChmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHB1c2hGYWlsdXJlLmFwcGx5KHZvaWQgMCwgW2Vycm9yLm1lc3NhZ2UsIGVycm9yLnN0YWNrdHJhY2UgfHwgZXJyb3IuZmlsZU5hbWUgKyBcIjpcIiArIGVycm9yLmxpbmVOdW1iZXJdLmNvbmNhdChhcmdzKSk7XG5cdCAgICB9LCB7XG5cdCAgICAgIHZhbGlkVGVzdDogdHJ1ZVxuXHQgICAgfSkpO1xuXHQgIH1cblxuXHQgIHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGZ1bmN0aW9uIG9uVW5oYW5kbGVkUmVqZWN0aW9uKHJlYXNvbikge1xuXHQgIHZhciByZXN1bHRJbmZvID0ge1xuXHQgICAgcmVzdWx0OiBmYWxzZSxcblx0ICAgIG1lc3NhZ2U6IHJlYXNvbi5tZXNzYWdlIHx8IFwiZXJyb3JcIixcblx0ICAgIGFjdHVhbDogcmVhc29uLFxuXHQgICAgc291cmNlOiByZWFzb24uc3RhY2sgfHwgc291cmNlRnJvbVN0YWNrdHJhY2UoMylcblx0ICB9O1xuXHQgIHZhciBjdXJyZW50VGVzdCA9IGNvbmZpZy5jdXJyZW50O1xuXG5cdCAgaWYgKGN1cnJlbnRUZXN0KSB7XG5cdCAgICBjdXJyZW50VGVzdC5hc3NlcnQucHVzaFJlc3VsdChyZXN1bHRJbmZvKTtcblx0ICB9IGVsc2Uge1xuXHQgICAgdGVzdChcImdsb2JhbCBmYWlsdXJlXCIsIGV4dGVuZChmdW5jdGlvbiAoYXNzZXJ0KSB7XG5cdCAgICAgIGFzc2VydC5wdXNoUmVzdWx0KHJlc3VsdEluZm8pO1xuXHQgICAgfSwge1xuXHQgICAgICB2YWxpZFRlc3Q6IHRydWVcblx0ICAgIH0pKTtcblx0ICB9XG5cdH1cblxuXHR2YXIgUVVuaXQgPSB7fTtcblx0dmFyIGdsb2JhbFN1aXRlID0gbmV3IFN1aXRlUmVwb3J0KCk7IC8vIFRoZSBpbml0aWFsIFwiY3VycmVudE1vZHVsZVwiIHJlcHJlc2VudHMgdGhlIGdsb2JhbCAob3IgdG9wLWxldmVsKSBtb2R1bGUgdGhhdFxuXHQvLyBpcyBub3QgZXhwbGljaXRseSBkZWZpbmVkIGJ5IHRoZSB1c2VyLCB0aGVyZWZvcmUgd2UgYWRkIHRoZSBcImdsb2JhbFN1aXRlXCIgdG9cblx0Ly8gaXQgc2luY2UgZWFjaCBtb2R1bGUgaGFzIGEgc3VpdGVSZXBvcnQgYXNzb2NpYXRlZCB3aXRoIGl0LlxuXG5cdGNvbmZpZy5jdXJyZW50TW9kdWxlLnN1aXRlUmVwb3J0ID0gZ2xvYmFsU3VpdGU7XG5cdHZhciBnbG9iYWxTdGFydENhbGxlZCA9IGZhbHNlO1xuXHR2YXIgcnVuU3RhcnRlZCA9IGZhbHNlOyAvLyBGaWd1cmUgb3V0IGlmIHdlJ3JlIHJ1bm5pbmcgdGhlIHRlc3RzIGZyb20gYSBzZXJ2ZXIgb3Igbm90XG5cblx0UVVuaXQuaXNMb2NhbCA9ICEoZGVmaW5lZC5kb2N1bWVudCAmJiB3aW5kb3ckMS5sb2NhdGlvbi5wcm90b2NvbCAhPT0gXCJmaWxlOlwiKTsgLy8gRXhwb3NlIHRoZSBjdXJyZW50IFFVbml0IHZlcnNpb25cblxuXHRRVW5pdC52ZXJzaW9uID0gXCIyLjExLjNcIjtcblx0ZXh0ZW5kKFFVbml0LCB7XG5cdCAgb246IG9uLFxuXHQgIG1vZHVsZTogbW9kdWxlJDEsXG5cdCAgdGVzdDogdGVzdCxcblx0ICB0b2RvOiB0b2RvLFxuXHQgIHNraXA6IHNraXAsXG5cdCAgb25seTogb25seSxcblx0ICBzdGFydDogZnVuY3Rpb24gc3RhcnQoY291bnQpIHtcblx0ICAgIHZhciBnbG9iYWxTdGFydEFscmVhZHlDYWxsZWQgPSBnbG9iYWxTdGFydENhbGxlZDtcblxuXHQgICAgaWYgKCFjb25maWcuY3VycmVudCkge1xuXHQgICAgICBnbG9iYWxTdGFydENhbGxlZCA9IHRydWU7XG5cblx0ICAgICAgaWYgKHJ1blN0YXJ0ZWQpIHtcblx0ICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsZWQgc3RhcnQoKSB3aGlsZSB0ZXN0IGFscmVhZHkgc3RhcnRlZCBydW5uaW5nXCIpO1xuXHQgICAgICB9IGVsc2UgaWYgKGdsb2JhbFN0YXJ0QWxyZWFkeUNhbGxlZCB8fCBjb3VudCA+IDEpIHtcblx0ICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsZWQgc3RhcnQoKSBvdXRzaWRlIG9mIGEgdGVzdCBjb250ZXh0IHRvbyBtYW55IHRpbWVzXCIpO1xuXHQgICAgICB9IGVsc2UgaWYgKGNvbmZpZy5hdXRvc3RhcnQpIHtcblx0ICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsZWQgc3RhcnQoKSBvdXRzaWRlIG9mIGEgdGVzdCBjb250ZXh0IHdoZW4gXCIgKyBcIlFVbml0LmNvbmZpZy5hdXRvc3RhcnQgd2FzIHRydWVcIik7XG5cdCAgICAgIH0gZWxzZSBpZiAoIWNvbmZpZy5wYWdlTG9hZGVkKSB7XG5cdCAgICAgICAgLy8gVGhlIHBhZ2UgaXNuJ3QgY29tcGxldGVseSBsb2FkZWQgeWV0LCBzbyB3ZSBzZXQgYXV0b3N0YXJ0IGFuZCB0aGVuXG5cdCAgICAgICAgLy8gbG9hZCBpZiB3ZSdyZSBpbiBOb2RlIG9yIHdhaXQgZm9yIHRoZSBicm93c2VyJ3MgbG9hZCBldmVudC5cblx0ICAgICAgICBjb25maWcuYXV0b3N0YXJ0ID0gdHJ1ZTsgLy8gU3RhcnRzIGZyb20gTm9kZSBldmVuIGlmIC5sb2FkIHdhcyBub3QgcHJldmlvdXNseSBjYWxsZWQuIFdlIHN0aWxsIHJldHVyblxuXHQgICAgICAgIC8vIGVhcmx5IG90aGVyd2lzZSB3ZSdsbCB3aW5kIHVwIFwiYmVnaW5uaW5nXCIgdHdpY2UuXG5cblx0ICAgICAgICBpZiAoIWRlZmluZWQuZG9jdW1lbnQpIHtcblx0ICAgICAgICAgIFFVbml0LmxvYWQoKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICByZXR1cm47XG5cdCAgICAgIH1cblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHRocm93IG5ldyBFcnJvcihcIlFVbml0LnN0YXJ0IGNhbm5vdCBiZSBjYWxsZWQgaW5zaWRlIGEgdGVzdCBjb250ZXh0LlwiKTtcblx0ICAgIH1cblxuXHQgICAgc2NoZWR1bGVCZWdpbigpO1xuXHQgIH0sXG5cdCAgY29uZmlnOiBjb25maWcsXG5cdCAgaXM6IGlzLFxuXHQgIG9iamVjdFR5cGU6IG9iamVjdFR5cGUsXG5cdCAgZXh0ZW5kOiBleHRlbmQsXG5cdCAgbG9hZDogZnVuY3Rpb24gbG9hZCgpIHtcblx0ICAgIGNvbmZpZy5wYWdlTG9hZGVkID0gdHJ1ZTsgLy8gSW5pdGlhbGl6ZSB0aGUgY29uZmlndXJhdGlvbiBvcHRpb25zXG5cblx0ICAgIGV4dGVuZChjb25maWcsIHtcblx0ICAgICAgc3RhdHM6IHtcblx0ICAgICAgICBhbGw6IDAsXG5cdCAgICAgICAgYmFkOiAwLFxuXHQgICAgICAgIHRlc3RDb3VudDogMFxuXHQgICAgICB9LFxuXHQgICAgICBzdGFydGVkOiAwLFxuXHQgICAgICB1cGRhdGVSYXRlOiAxMDAwLFxuXHQgICAgICBhdXRvc3RhcnQ6IHRydWUsXG5cdCAgICAgIGZpbHRlcjogXCJcIlxuXHQgICAgfSwgdHJ1ZSk7XG5cblx0ICAgIGlmICghcnVuU3RhcnRlZCkge1xuXHQgICAgICBjb25maWcuYmxvY2tpbmcgPSBmYWxzZTtcblxuXHQgICAgICBpZiAoY29uZmlnLmF1dG9zdGFydCkge1xuXHQgICAgICAgIHNjaGVkdWxlQmVnaW4oKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH0sXG5cdCAgc3RhY2s6IGZ1bmN0aW9uIHN0YWNrKG9mZnNldCkge1xuXHQgICAgb2Zmc2V0ID0gKG9mZnNldCB8fCAwKSArIDI7XG5cdCAgICByZXR1cm4gc291cmNlRnJvbVN0YWNrdHJhY2Uob2Zmc2V0KTtcblx0ICB9LFxuXHQgIG9uRXJyb3I6IG9uRXJyb3IsXG5cdCAgb25VbmhhbmRsZWRSZWplY3Rpb246IG9uVW5oYW5kbGVkUmVqZWN0aW9uXG5cdH0pO1xuXHRRVW5pdC5wdXNoRmFpbHVyZSA9IHB1c2hGYWlsdXJlO1xuXHRRVW5pdC5hc3NlcnQgPSBBc3NlcnQucHJvdG90eXBlO1xuXHRRVW5pdC5lcXVpdiA9IGVxdWl2O1xuXHRRVW5pdC5kdW1wID0gZHVtcDtcblx0cmVnaXN0ZXJMb2dnaW5nQ2FsbGJhY2tzKFFVbml0KTtcblxuXHRmdW5jdGlvbiBzY2hlZHVsZUJlZ2luKCkge1xuXHQgIHJ1blN0YXJ0ZWQgPSB0cnVlOyAvLyBBZGQgYSBzbGlnaHQgZGVsYXkgdG8gYWxsb3cgZGVmaW5pdGlvbiBvZiBtb3JlIG1vZHVsZXMgYW5kIHRlc3RzLlxuXG5cdCAgaWYgKGRlZmluZWQuc2V0VGltZW91dCkge1xuXHQgICAgc2V0VGltZW91dCQxKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgYmVnaW4oKTtcblx0ICAgIH0pO1xuXHQgIH0gZWxzZSB7XG5cdCAgICBiZWdpbigpO1xuXHQgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIHVuYmxvY2tBbmRBZHZhbmNlUXVldWUoKSB7XG5cdCAgY29uZmlnLmJsb2NraW5nID0gZmFsc2U7XG5cdCAgUHJvY2Vzc2luZ1F1ZXVlLmFkdmFuY2UoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGJlZ2luKCkge1xuXHQgIHZhciBpLFxuXHQgICAgICBsLFxuXHQgICAgICBtb2R1bGVzTG9nID0gW107IC8vIElmIHRoZSB0ZXN0IHJ1biBoYXNuJ3Qgb2ZmaWNpYWxseSBiZWd1biB5ZXRcblxuXHQgIGlmICghY29uZmlnLnN0YXJ0ZWQpIHtcblx0ICAgIC8vIFJlY29yZCB0aGUgdGltZSBvZiB0aGUgdGVzdCBydW4ncyBiZWdpbm5pbmdcblx0ICAgIGNvbmZpZy5zdGFydGVkID0gbm93KCk7IC8vIERlbGV0ZSB0aGUgbG9vc2UgdW5uYW1lZCBtb2R1bGUgaWYgdW51c2VkLlxuXG5cdCAgICBpZiAoY29uZmlnLm1vZHVsZXNbMF0ubmFtZSA9PT0gXCJcIiAmJiBjb25maWcubW9kdWxlc1swXS50ZXN0cy5sZW5ndGggPT09IDApIHtcblx0ICAgICAgY29uZmlnLm1vZHVsZXMuc2hpZnQoKTtcblx0ICAgIH0gLy8gQXZvaWQgdW5uZWNlc3NhcnkgaW5mb3JtYXRpb24gYnkgbm90IGxvZ2dpbmcgbW9kdWxlcycgdGVzdCBlbnZpcm9ubWVudHNcblxuXG5cdCAgICBmb3IgKGkgPSAwLCBsID0gY29uZmlnLm1vZHVsZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdCAgICAgIG1vZHVsZXNMb2cucHVzaCh7XG5cdCAgICAgICAgbmFtZTogY29uZmlnLm1vZHVsZXNbaV0ubmFtZSxcblx0ICAgICAgICB0ZXN0czogY29uZmlnLm1vZHVsZXNbaV0udGVzdHNcblx0ICAgICAgfSk7XG5cdCAgICB9IC8vIFRoZSB0ZXN0IHJ1biBpcyBvZmZpY2lhbGx5IGJlZ2lubmluZyBub3dcblxuXG5cdCAgICBlbWl0KFwicnVuU3RhcnRcIiwgZ2xvYmFsU3VpdGUuc3RhcnQodHJ1ZSkpO1xuXHQgICAgcnVuTG9nZ2luZ0NhbGxiYWNrcyhcImJlZ2luXCIsIHtcblx0ICAgICAgdG90YWxUZXN0czogVGVzdC5jb3VudCxcblx0ICAgICAgbW9kdWxlczogbW9kdWxlc0xvZ1xuXHQgICAgfSkudGhlbih1bmJsb2NrQW5kQWR2YW5jZVF1ZXVlKTtcblx0ICB9IGVsc2Uge1xuXHQgICAgdW5ibG9ja0FuZEFkdmFuY2VRdWV1ZSgpO1xuXHQgIH1cblx0fVxuXHRleHBvcnRRVW5pdChRVW5pdCk7XG5cblx0KGZ1bmN0aW9uICgpIHtcblx0ICBpZiAodHlwZW9mIHdpbmRvdyQxID09PSBcInVuZGVmaW5lZFwiIHx8IHR5cGVvZiBkb2N1bWVudCQxID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgdmFyIGNvbmZpZyA9IFFVbml0LmNvbmZpZyxcblx0ICAgICAgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTsgLy8gU3RvcmVzIGZpeHR1cmUgSFRNTCBmb3IgcmVzZXR0aW5nIGxhdGVyXG5cblx0ICBmdW5jdGlvbiBzdG9yZUZpeHR1cmUoKSB7XG5cdCAgICAvLyBBdm9pZCBvdmVyd3JpdGluZyB1c2VyLWRlZmluZWQgdmFsdWVzXG5cdCAgICBpZiAoaGFzT3duLmNhbGwoY29uZmlnLCBcImZpeHR1cmVcIikpIHtcblx0ICAgICAgcmV0dXJuO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgZml4dHVyZSA9IGRvY3VtZW50JDEuZ2V0RWxlbWVudEJ5SWQoXCJxdW5pdC1maXh0dXJlXCIpO1xuXG5cdCAgICBpZiAoZml4dHVyZSkge1xuXHQgICAgICBjb25maWcuZml4dHVyZSA9IGZpeHR1cmUuY2xvbmVOb2RlKHRydWUpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIFFVbml0LmJlZ2luKHN0b3JlRml4dHVyZSk7IC8vIFJlc2V0cyB0aGUgZml4dHVyZSBET00gZWxlbWVudCBpZiBhdmFpbGFibGUuXG5cblx0ICBmdW5jdGlvbiByZXNldEZpeHR1cmUoKSB7XG5cdCAgICBpZiAoY29uZmlnLmZpeHR1cmUgPT0gbnVsbCkge1xuXHQgICAgICByZXR1cm47XG5cdCAgICB9XG5cblx0ICAgIHZhciBmaXh0dXJlID0gZG9jdW1lbnQkMS5nZXRFbGVtZW50QnlJZChcInF1bml0LWZpeHR1cmVcIik7XG5cblx0ICAgIHZhciByZXNldEZpeHR1cmVUeXBlID0gX3R5cGVvZihjb25maWcuZml4dHVyZSk7XG5cblx0ICAgIGlmIChyZXNldEZpeHR1cmVUeXBlID09PSBcInN0cmluZ1wiKSB7XG5cdCAgICAgIC8vIHN1cHBvcnQgdXNlciBkZWZpbmVkIHZhbHVlcyBmb3IgYGNvbmZpZy5maXh0dXJlYFxuXHQgICAgICB2YXIgbmV3Rml4dHVyZSA9IGRvY3VtZW50JDEuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0ICAgICAgbmV3Rml4dHVyZS5zZXRBdHRyaWJ1dGUoXCJpZFwiLCBcInF1bml0LWZpeHR1cmVcIik7XG5cdCAgICAgIG5ld0ZpeHR1cmUuaW5uZXJIVE1MID0gY29uZmlnLmZpeHR1cmU7XG5cdCAgICAgIGZpeHR1cmUucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Rml4dHVyZSwgZml4dHVyZSk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB2YXIgY2xvbmVkRml4dHVyZSA9IGNvbmZpZy5maXh0dXJlLmNsb25lTm9kZSh0cnVlKTtcblx0ICAgICAgZml4dHVyZS5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChjbG9uZWRGaXh0dXJlLCBmaXh0dXJlKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBRVW5pdC50ZXN0U3RhcnQocmVzZXRGaXh0dXJlKTtcblx0fSkoKTtcblxuXHQoZnVuY3Rpb24gKCkge1xuXHQgIC8vIE9ubHkgaW50ZXJhY3Qgd2l0aCBVUkxzIHZpYSB3aW5kb3cubG9jYXRpb25cblx0ICB2YXIgbG9jYXRpb24gPSB0eXBlb2Ygd2luZG93JDEgIT09IFwidW5kZWZpbmVkXCIgJiYgd2luZG93JDEubG9jYXRpb247XG5cblx0ICBpZiAoIWxvY2F0aW9uKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgdmFyIHVybFBhcmFtcyA9IGdldFVybFBhcmFtcygpO1xuXHQgIFFVbml0LnVybFBhcmFtcyA9IHVybFBhcmFtczsgLy8gTWF0Y2ggbW9kdWxlL3Rlc3QgYnkgaW5jbHVzaW9uIGluIGFuIGFycmF5XG5cblx0ICBRVW5pdC5jb25maWcubW9kdWxlSWQgPSBbXS5jb25jYXQodXJsUGFyYW1zLm1vZHVsZUlkIHx8IFtdKTtcblx0ICBRVW5pdC5jb25maWcudGVzdElkID0gW10uY29uY2F0KHVybFBhcmFtcy50ZXN0SWQgfHwgW10pOyAvLyBFeGFjdCBjYXNlLWluc2Vuc2l0aXZlIG1hdGNoIG9mIHRoZSBtb2R1bGUgbmFtZVxuXG5cdCAgUVVuaXQuY29uZmlnLm1vZHVsZSA9IHVybFBhcmFtcy5tb2R1bGU7IC8vIFJlZ3VsYXIgZXhwcmVzc2lvbiBvciBjYXNlLWluc2Vuc3RpdmUgc3Vic3RyaW5nIG1hdGNoIGFnYWluc3QgXCJtb2R1bGVOYW1lOiB0ZXN0TmFtZVwiXG5cblx0ICBRVW5pdC5jb25maWcuZmlsdGVyID0gdXJsUGFyYW1zLmZpbHRlcjsgLy8gVGVzdCBvcmRlciByYW5kb21pemF0aW9uXG5cblx0ICBpZiAodXJsUGFyYW1zLnNlZWQgPT09IHRydWUpIHtcblx0ICAgIC8vIEdlbmVyYXRlIGEgcmFuZG9tIHNlZWQgaWYgdGhlIG9wdGlvbiBpcyBzcGVjaWZpZWQgd2l0aG91dCBhIHZhbHVlXG5cdCAgICBRVW5pdC5jb25maWcuc2VlZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpO1xuXHQgIH0gZWxzZSBpZiAodXJsUGFyYW1zLnNlZWQpIHtcblx0ICAgIFFVbml0LmNvbmZpZy5zZWVkID0gdXJsUGFyYW1zLnNlZWQ7XG5cdCAgfSAvLyBBZGQgVVJMLXBhcmFtZXRlci1tYXBwZWQgY29uZmlnIHZhbHVlcyB3aXRoIFVJIGZvcm0gcmVuZGVyaW5nIGRhdGFcblxuXG5cdCAgUVVuaXQuY29uZmlnLnVybENvbmZpZy5wdXNoKHtcblx0ICAgIGlkOiBcImhpZGVwYXNzZWRcIixcblx0ICAgIGxhYmVsOiBcIkhpZGUgcGFzc2VkIHRlc3RzXCIsXG5cdCAgICB0b29sdGlwOiBcIk9ubHkgc2hvdyB0ZXN0cyBhbmQgYXNzZXJ0aW9ucyB0aGF0IGZhaWwuIFN0b3JlZCBhcyBxdWVyeS1zdHJpbmdzLlwiXG5cdCAgfSwge1xuXHQgICAgaWQ6IFwibm9nbG9iYWxzXCIsXG5cdCAgICBsYWJlbDogXCJDaGVjayBmb3IgR2xvYmFsc1wiLFxuXHQgICAgdG9vbHRpcDogXCJFbmFibGluZyB0aGlzIHdpbGwgdGVzdCBpZiBhbnkgdGVzdCBpbnRyb2R1Y2VzIG5ldyBwcm9wZXJ0aWVzIG9uIHRoZSBcIiArIFwiZ2xvYmFsIG9iamVjdCAoYHdpbmRvd2AgaW4gQnJvd3NlcnMpLiBTdG9yZWQgYXMgcXVlcnktc3RyaW5ncy5cIlxuXHQgIH0sIHtcblx0ICAgIGlkOiBcIm5vdHJ5Y2F0Y2hcIixcblx0ICAgIGxhYmVsOiBcIk5vIHRyeS1jYXRjaFwiLFxuXHQgICAgdG9vbHRpcDogXCJFbmFibGluZyB0aGlzIHdpbGwgcnVuIHRlc3RzIG91dHNpZGUgb2YgYSB0cnktY2F0Y2ggYmxvY2suIE1ha2VzIGRlYnVnZ2luZyBcIiArIFwiZXhjZXB0aW9ucyBpbiBJRSByZWFzb25hYmxlLiBTdG9yZWQgYXMgcXVlcnktc3RyaW5ncy5cIlxuXHQgIH0pO1xuXHQgIFFVbml0LmJlZ2luKGZ1bmN0aW9uICgpIHtcblx0ICAgIHZhciBpLFxuXHQgICAgICAgIG9wdGlvbixcblx0ICAgICAgICB1cmxDb25maWcgPSBRVW5pdC5jb25maWcudXJsQ29uZmlnO1xuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgdXJsQ29uZmlnLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIC8vIE9wdGlvbnMgY2FuIGJlIGVpdGhlciBzdHJpbmdzIG9yIG9iamVjdHMgd2l0aCBub25lbXB0eSBcImlkXCIgcHJvcGVydGllc1xuXHQgICAgICBvcHRpb24gPSBRVW5pdC5jb25maWcudXJsQ29uZmlnW2ldO1xuXG5cdCAgICAgIGlmICh0eXBlb2Ygb3B0aW9uICE9PSBcInN0cmluZ1wiKSB7XG5cdCAgICAgICAgb3B0aW9uID0gb3B0aW9uLmlkO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKFFVbml0LmNvbmZpZ1tvcHRpb25dID09PSB1bmRlZmluZWQpIHtcblx0ICAgICAgICBRVW5pdC5jb25maWdbb3B0aW9uXSA9IHVybFBhcmFtc1tvcHRpb25dO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfSk7XG5cblx0ICBmdW5jdGlvbiBnZXRVcmxQYXJhbXMoKSB7XG5cdCAgICB2YXIgaSwgcGFyYW0sIG5hbWUsIHZhbHVlO1xuXHQgICAgdmFyIHVybFBhcmFtcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdCAgICB2YXIgcGFyYW1zID0gbG9jYXRpb24uc2VhcmNoLnNsaWNlKDEpLnNwbGl0KFwiJlwiKTtcblx0ICAgIHZhciBsZW5ndGggPSBwYXJhbXMubGVuZ3RoO1xuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0ICAgICAgaWYgKHBhcmFtc1tpXSkge1xuXHQgICAgICAgIHBhcmFtID0gcGFyYW1zW2ldLnNwbGl0KFwiPVwiKTtcblx0ICAgICAgICBuYW1lID0gZGVjb2RlUXVlcnlQYXJhbShwYXJhbVswXSk7IC8vIEFsbG93IGp1c3QgYSBrZXkgdG8gdHVybiBvbiBhIGZsYWcsIGUuZy4sIHRlc3QuaHRtbD9ub2dsb2JhbHNcblxuXHQgICAgICAgIHZhbHVlID0gcGFyYW0ubGVuZ3RoID09PSAxIHx8IGRlY29kZVF1ZXJ5UGFyYW0ocGFyYW0uc2xpY2UoMSkuam9pbihcIj1cIikpO1xuXG5cdCAgICAgICAgaWYgKG5hbWUgaW4gdXJsUGFyYW1zKSB7XG5cdCAgICAgICAgICB1cmxQYXJhbXNbbmFtZV0gPSBbXS5jb25jYXQodXJsUGFyYW1zW25hbWVdLCB2YWx1ZSk7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHVybFBhcmFtc1tuYW1lXSA9IHZhbHVlO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gdXJsUGFyYW1zO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGRlY29kZVF1ZXJ5UGFyYW0ocGFyYW0pIHtcblx0ICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQocGFyYW0ucmVwbGFjZSgvXFwrL2csIFwiJTIwXCIpKTtcblx0ICB9XG5cdH0pKCk7XG5cblx0dmFyIGZ1enp5c29ydCA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUpIHtcblxuXHQgIChmdW5jdGlvbiAocm9vdCwgVU1EKSB7XG5cdCAgICBpZiAoIG1vZHVsZS5leHBvcnRzKSBtb2R1bGUuZXhwb3J0cyA9IFVNRCgpO2Vsc2Ugcm9vdC5mdXp6eXNvcnQgPSBVTUQoKTtcblx0ICB9KShjb21tb25qc0dsb2JhbCwgZnVuY3Rpb24gVU1EKCkge1xuXHQgICAgZnVuY3Rpb24gZnV6enlzb3J0TmV3KGluc3RhbmNlT3B0aW9ucykge1xuXHQgICAgICB2YXIgZnV6enlzb3J0ID0ge1xuXHQgICAgICAgIHNpbmdsZTogZnVuY3Rpb24gKHNlYXJjaCwgdGFyZ2V0LCBvcHRpb25zKSB7XG5cdCAgICAgICAgICBpZiAoIXNlYXJjaCkgcmV0dXJuIG51bGw7XG5cdCAgICAgICAgICBpZiAoIWlzT2JqKHNlYXJjaCkpIHNlYXJjaCA9IGZ1enp5c29ydC5nZXRQcmVwYXJlZFNlYXJjaChzZWFyY2gpO1xuXHQgICAgICAgICAgaWYgKCF0YXJnZXQpIHJldHVybiBudWxsO1xuXHQgICAgICAgICAgaWYgKCFpc09iaih0YXJnZXQpKSB0YXJnZXQgPSBmdXp6eXNvcnQuZ2V0UHJlcGFyZWQodGFyZ2V0KTtcblx0ICAgICAgICAgIHZhciBhbGxvd1R5cG8gPSBvcHRpb25zICYmIG9wdGlvbnMuYWxsb3dUeXBvICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmFsbG93VHlwbyA6IGluc3RhbmNlT3B0aW9ucyAmJiBpbnN0YW5jZU9wdGlvbnMuYWxsb3dUeXBvICE9PSB1bmRlZmluZWQgPyBpbnN0YW5jZU9wdGlvbnMuYWxsb3dUeXBvIDogdHJ1ZTtcblx0ICAgICAgICAgIHZhciBhbGdvcml0aG0gPSBhbGxvd1R5cG8gPyBmdXp6eXNvcnQuYWxnb3JpdGhtIDogZnV6enlzb3J0LmFsZ29yaXRobU5vVHlwbztcblx0ICAgICAgICAgIHJldHVybiBhbGdvcml0aG0oc2VhcmNoLCB0YXJnZXQsIHNlYXJjaFswXSk7IC8vIHZhciB0aHJlc2hvbGQgPSBvcHRpb25zICYmIG9wdGlvbnMudGhyZXNob2xkIHx8IGluc3RhbmNlT3B0aW9ucyAmJiBpbnN0YW5jZU9wdGlvbnMudGhyZXNob2xkIHx8IC05MDA3MTk5MjU0NzQwOTkxXG5cdCAgICAgICAgICAvLyB2YXIgcmVzdWx0ID0gYWxnb3JpdGhtKHNlYXJjaCwgdGFyZ2V0LCBzZWFyY2hbMF0pXG5cdCAgICAgICAgICAvLyBpZihyZXN1bHQgPT09IG51bGwpIHJldHVybiBudWxsXG5cdCAgICAgICAgICAvLyBpZihyZXN1bHQuc2NvcmUgPCB0aHJlc2hvbGQpIHJldHVybiBudWxsXG5cdCAgICAgICAgICAvLyByZXR1cm4gcmVzdWx0XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBnbzogZnVuY3Rpb24gKHNlYXJjaCwgdGFyZ2V0cywgb3B0aW9ucykge1xuXHQgICAgICAgICAgaWYgKCFzZWFyY2gpIHJldHVybiBub1Jlc3VsdHM7XG5cdCAgICAgICAgICBzZWFyY2ggPSBmdXp6eXNvcnQucHJlcGFyZVNlYXJjaChzZWFyY2gpO1xuXHQgICAgICAgICAgdmFyIHNlYXJjaExvd2VyQ29kZSA9IHNlYXJjaFswXTtcblx0ICAgICAgICAgIHZhciB0aHJlc2hvbGQgPSBvcHRpb25zICYmIG9wdGlvbnMudGhyZXNob2xkIHx8IGluc3RhbmNlT3B0aW9ucyAmJiBpbnN0YW5jZU9wdGlvbnMudGhyZXNob2xkIHx8IC05MDA3MTk5MjU0NzQwOTkxO1xuXHQgICAgICAgICAgdmFyIGxpbWl0ID0gb3B0aW9ucyAmJiBvcHRpb25zLmxpbWl0IHx8IGluc3RhbmNlT3B0aW9ucyAmJiBpbnN0YW5jZU9wdGlvbnMubGltaXQgfHwgOTAwNzE5OTI1NDc0MDk5MTtcblx0ICAgICAgICAgIHZhciBhbGxvd1R5cG8gPSBvcHRpb25zICYmIG9wdGlvbnMuYWxsb3dUeXBvICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmFsbG93VHlwbyA6IGluc3RhbmNlT3B0aW9ucyAmJiBpbnN0YW5jZU9wdGlvbnMuYWxsb3dUeXBvICE9PSB1bmRlZmluZWQgPyBpbnN0YW5jZU9wdGlvbnMuYWxsb3dUeXBvIDogdHJ1ZTtcblx0ICAgICAgICAgIHZhciBhbGdvcml0aG0gPSBhbGxvd1R5cG8gPyBmdXp6eXNvcnQuYWxnb3JpdGhtIDogZnV6enlzb3J0LmFsZ29yaXRobU5vVHlwbztcblx0ICAgICAgICAgIHZhciByZXN1bHRzTGVuID0gMDtcblx0ICAgICAgICAgIHZhciBsaW1pdGVkQ291bnQgPSAwO1xuXHQgICAgICAgICAgdmFyIHRhcmdldHNMZW4gPSB0YXJnZXRzLmxlbmd0aDsgLy8gVGhpcyBjb2RlIGlzIGNvcHkvcGFzdGVkIDMgdGltZXMgZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnMgW29wdGlvbnMua2V5cywgb3B0aW9ucy5rZXksIG5vIGtleXNdXG5cdCAgICAgICAgICAvLyBvcHRpb25zLmtleXNcblxuXHQgICAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5rZXlzKSB7XG5cdCAgICAgICAgICAgIHZhciBzY29yZUZuID0gb3B0aW9ucy5zY29yZUZuIHx8IGRlZmF1bHRTY29yZUZuO1xuXHQgICAgICAgICAgICB2YXIga2V5cyA9IG9wdGlvbnMua2V5cztcblx0ICAgICAgICAgICAgdmFyIGtleXNMZW4gPSBrZXlzLmxlbmd0aDtcblxuXHQgICAgICAgICAgICBmb3IgKHZhciBpID0gdGFyZ2V0c0xlbiAtIDE7IGkgPj0gMDsgLS1pKSB7XG5cdCAgICAgICAgICAgICAgdmFyIG9iaiA9IHRhcmdldHNbaV07XG5cdCAgICAgICAgICAgICAgdmFyIG9ialJlc3VsdHMgPSBuZXcgQXJyYXkoa2V5c0xlbik7XG5cblx0ICAgICAgICAgICAgICBmb3IgKHZhciBrZXlJID0ga2V5c0xlbiAtIDE7IGtleUkgPj0gMDsgLS1rZXlJKSB7XG5cdCAgICAgICAgICAgICAgICB2YXIga2V5ID0ga2V5c1trZXlJXTtcblx0ICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBnZXRWYWx1ZShvYmosIGtleSk7XG5cblx0ICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0KSB7XG5cdCAgICAgICAgICAgICAgICAgIG9ialJlc3VsdHNba2V5SV0gPSBudWxsO1xuXHQgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblx0ICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgaWYgKCFpc09iaih0YXJnZXQpKSB0YXJnZXQgPSBmdXp6eXNvcnQuZ2V0UHJlcGFyZWQodGFyZ2V0KTtcblx0ICAgICAgICAgICAgICAgIG9ialJlc3VsdHNba2V5SV0gPSBhbGdvcml0aG0oc2VhcmNoLCB0YXJnZXQsIHNlYXJjaExvd2VyQ29kZSk7XG5cdCAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgb2JqUmVzdWx0cy5vYmogPSBvYmo7IC8vIGJlZm9yZSBzY29yZUZuIHNvIHNjb3JlRm4gY2FuIHVzZSBpdFxuXG5cdCAgICAgICAgICAgICAgdmFyIHNjb3JlID0gc2NvcmVGbihvYmpSZXN1bHRzKTtcblx0ICAgICAgICAgICAgICBpZiAoc2NvcmUgPT09IG51bGwpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgIGlmIChzY29yZSA8IHRocmVzaG9sZCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgb2JqUmVzdWx0cy5zY29yZSA9IHNjb3JlO1xuXG5cdCAgICAgICAgICAgICAgaWYgKHJlc3VsdHNMZW4gPCBsaW1pdCkge1xuXHQgICAgICAgICAgICAgICAgcS5hZGQob2JqUmVzdWx0cyk7XG5cdCAgICAgICAgICAgICAgICArK3Jlc3VsdHNMZW47XG5cdCAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgICsrbGltaXRlZENvdW50O1xuXHQgICAgICAgICAgICAgICAgaWYgKHNjb3JlID4gcS5wZWVrKCkuc2NvcmUpIHEucmVwbGFjZVRvcChvYmpSZXN1bHRzKTtcblx0ICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH0gLy8gb3B0aW9ucy5rZXlcblxuXHQgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zICYmIG9wdGlvbnMua2V5KSB7XG5cdCAgICAgICAgICAgIHZhciBrZXkgPSBvcHRpb25zLmtleTtcblxuXHQgICAgICAgICAgICBmb3IgKHZhciBpID0gdGFyZ2V0c0xlbiAtIDE7IGkgPj0gMDsgLS1pKSB7XG5cdCAgICAgICAgICAgICAgdmFyIG9iaiA9IHRhcmdldHNbaV07XG5cdCAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IGdldFZhbHVlKG9iaiwga2V5KTtcblx0ICAgICAgICAgICAgICBpZiAoIXRhcmdldCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgaWYgKCFpc09iaih0YXJnZXQpKSB0YXJnZXQgPSBmdXp6eXNvcnQuZ2V0UHJlcGFyZWQodGFyZ2V0KTtcblx0ICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gYWxnb3JpdGhtKHNlYXJjaCwgdGFyZ2V0LCBzZWFyY2hMb3dlckNvZGUpO1xuXHQgICAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgIGlmIChyZXN1bHQuc2NvcmUgPCB0aHJlc2hvbGQpIGNvbnRpbnVlOyAvLyBoYXZlIHRvIGNsb25lIHJlc3VsdCBzbyBkdXBsaWNhdGUgdGFyZ2V0cyBmcm9tIGRpZmZlcmVudCBvYmogY2FuIGVhY2ggcmVmZXJlbmNlIHRoZSBjb3JyZWN0IG9ialxuXG5cdCAgICAgICAgICAgICAgcmVzdWx0ID0ge1xuXHQgICAgICAgICAgICAgICAgdGFyZ2V0OiByZXN1bHQudGFyZ2V0LFxuXHQgICAgICAgICAgICAgICAgX3RhcmdldExvd2VyQ29kZXM6IG51bGwsXG5cdCAgICAgICAgICAgICAgICBfbmV4dEJlZ2lubmluZ0luZGV4ZXM6IG51bGwsXG5cdCAgICAgICAgICAgICAgICBzY29yZTogcmVzdWx0LnNjb3JlLFxuXHQgICAgICAgICAgICAgICAgaW5kZXhlczogcmVzdWx0LmluZGV4ZXMsXG5cdCAgICAgICAgICAgICAgICBvYmo6IG9ialxuXHQgICAgICAgICAgICAgIH07IC8vIGhpZGRlblxuXG5cdCAgICAgICAgICAgICAgaWYgKHJlc3VsdHNMZW4gPCBsaW1pdCkge1xuXHQgICAgICAgICAgICAgICAgcS5hZGQocmVzdWx0KTtcblx0ICAgICAgICAgICAgICAgICsrcmVzdWx0c0xlbjtcblx0ICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgKytsaW1pdGVkQ291bnQ7XG5cdCAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnNjb3JlID4gcS5wZWVrKCkuc2NvcmUpIHEucmVwbGFjZVRvcChyZXN1bHQpO1xuXHQgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfSAvLyBubyBrZXlzXG5cblx0ICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgIGZvciAodmFyIGkgPSB0YXJnZXRzTGVuIC0gMTsgaSA+PSAwOyAtLWkpIHtcblx0ICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gdGFyZ2V0c1tpXTtcblx0ICAgICAgICAgICAgICBpZiAoIXRhcmdldCkgY29udGludWU7XG5cdCAgICAgICAgICAgICAgaWYgKCFpc09iaih0YXJnZXQpKSB0YXJnZXQgPSBmdXp6eXNvcnQuZ2V0UHJlcGFyZWQodGFyZ2V0KTtcblx0ICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gYWxnb3JpdGhtKHNlYXJjaCwgdGFyZ2V0LCBzZWFyY2hMb3dlckNvZGUpO1xuXHQgICAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgIGlmIChyZXN1bHQuc2NvcmUgPCB0aHJlc2hvbGQpIGNvbnRpbnVlO1xuXG5cdCAgICAgICAgICAgICAgaWYgKHJlc3VsdHNMZW4gPCBsaW1pdCkge1xuXHQgICAgICAgICAgICAgICAgcS5hZGQocmVzdWx0KTtcblx0ICAgICAgICAgICAgICAgICsrcmVzdWx0c0xlbjtcblx0ICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgKytsaW1pdGVkQ291bnQ7XG5cdCAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnNjb3JlID4gcS5wZWVrKCkuc2NvcmUpIHEucmVwbGFjZVRvcChyZXN1bHQpO1xuXHQgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICBpZiAocmVzdWx0c0xlbiA9PT0gMCkgcmV0dXJuIG5vUmVzdWx0cztcblx0ICAgICAgICAgIHZhciByZXN1bHRzID0gbmV3IEFycmF5KHJlc3VsdHNMZW4pO1xuXG5cdCAgICAgICAgICBmb3IgKHZhciBpID0gcmVzdWx0c0xlbiAtIDE7IGkgPj0gMDsgLS1pKSByZXN1bHRzW2ldID0gcS5wb2xsKCk7XG5cblx0ICAgICAgICAgIHJlc3VsdHMudG90YWwgPSByZXN1bHRzTGVuICsgbGltaXRlZENvdW50O1xuXHQgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBnb0FzeW5jOiBmdW5jdGlvbiAoc2VhcmNoLCB0YXJnZXRzLCBvcHRpb25zKSB7XG5cdCAgICAgICAgICB2YXIgY2FuY2VsZWQgPSBmYWxzZTtcblx0ICAgICAgICAgIHZhciBwID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHQgICAgICAgICAgICBpZiAoIXNlYXJjaCkgcmV0dXJuIHJlc29sdmUobm9SZXN1bHRzKTtcblx0ICAgICAgICAgICAgc2VhcmNoID0gZnV6enlzb3J0LnByZXBhcmVTZWFyY2goc2VhcmNoKTtcblx0ICAgICAgICAgICAgdmFyIHNlYXJjaExvd2VyQ29kZSA9IHNlYXJjaFswXTtcblx0ICAgICAgICAgICAgdmFyIHEgPSBmYXN0cHJpb3JpdHlxdWV1ZSgpO1xuXHQgICAgICAgICAgICB2YXIgaUN1cnJlbnQgPSB0YXJnZXRzLmxlbmd0aCAtIDE7XG5cdCAgICAgICAgICAgIHZhciB0aHJlc2hvbGQgPSBvcHRpb25zICYmIG9wdGlvbnMudGhyZXNob2xkIHx8IGluc3RhbmNlT3B0aW9ucyAmJiBpbnN0YW5jZU9wdGlvbnMudGhyZXNob2xkIHx8IC05MDA3MTk5MjU0NzQwOTkxO1xuXHQgICAgICAgICAgICB2YXIgbGltaXQgPSBvcHRpb25zICYmIG9wdGlvbnMubGltaXQgfHwgaW5zdGFuY2VPcHRpb25zICYmIGluc3RhbmNlT3B0aW9ucy5saW1pdCB8fCA5MDA3MTk5MjU0NzQwOTkxO1xuXHQgICAgICAgICAgICB2YXIgYWxsb3dUeXBvID0gb3B0aW9ucyAmJiBvcHRpb25zLmFsbG93VHlwbyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5hbGxvd1R5cG8gOiBpbnN0YW5jZU9wdGlvbnMgJiYgaW5zdGFuY2VPcHRpb25zLmFsbG93VHlwbyAhPT0gdW5kZWZpbmVkID8gaW5zdGFuY2VPcHRpb25zLmFsbG93VHlwbyA6IHRydWU7XG5cdCAgICAgICAgICAgIHZhciBhbGdvcml0aG0gPSBhbGxvd1R5cG8gPyBmdXp6eXNvcnQuYWxnb3JpdGhtIDogZnV6enlzb3J0LmFsZ29yaXRobU5vVHlwbztcblx0ICAgICAgICAgICAgdmFyIHJlc3VsdHNMZW4gPSAwO1xuXHQgICAgICAgICAgICB2YXIgbGltaXRlZENvdW50ID0gMDtcblxuXHQgICAgICAgICAgICBmdW5jdGlvbiBzdGVwKCkge1xuXHQgICAgICAgICAgICAgIGlmIChjYW5jZWxlZCkgcmV0dXJuIHJlamVjdCgnY2FuY2VsZWQnKTtcblx0ICAgICAgICAgICAgICB2YXIgc3RhcnRNcyA9IERhdGUubm93KCk7IC8vIFRoaXMgY29kZSBpcyBjb3B5L3Bhc3RlZCAzIHRpbWVzIGZvciBwZXJmb3JtYW5jZSByZWFzb25zIFtvcHRpb25zLmtleXMsIG9wdGlvbnMua2V5LCBubyBrZXlzXVxuXHQgICAgICAgICAgICAgIC8vIG9wdGlvbnMua2V5c1xuXG5cdCAgICAgICAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5rZXlzKSB7XG5cdCAgICAgICAgICAgICAgICB2YXIgc2NvcmVGbiA9IG9wdGlvbnMuc2NvcmVGbiB8fCBkZWZhdWx0U2NvcmVGbjtcblx0ICAgICAgICAgICAgICAgIHZhciBrZXlzID0gb3B0aW9ucy5rZXlzO1xuXHQgICAgICAgICAgICAgICAgdmFyIGtleXNMZW4gPSBrZXlzLmxlbmd0aDtcblxuXHQgICAgICAgICAgICAgICAgZm9yICg7IGlDdXJyZW50ID49IDA7IC0taUN1cnJlbnQpIHtcblx0ICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IHRhcmdldHNbaUN1cnJlbnRdO1xuXHQgICAgICAgICAgICAgICAgICB2YXIgb2JqUmVzdWx0cyA9IG5ldyBBcnJheShrZXlzTGVuKTtcblxuXHQgICAgICAgICAgICAgICAgICBmb3IgKHZhciBrZXlJID0ga2V5c0xlbiAtIDE7IGtleUkgPj0gMDsgLS1rZXlJKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIGtleSA9IGtleXNba2V5SV07XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IGdldFZhbHVlKG9iaiwga2V5KTtcblxuXHQgICAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0KSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICBvYmpSZXN1bHRzW2tleUldID0gbnVsbDtcblx0ICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgICAgIGlmICghaXNPYmoodGFyZ2V0KSkgdGFyZ2V0ID0gZnV6enlzb3J0LmdldFByZXBhcmVkKHRhcmdldCk7XG5cdCAgICAgICAgICAgICAgICAgICAgb2JqUmVzdWx0c1trZXlJXSA9IGFsZ29yaXRobShzZWFyY2gsIHRhcmdldCwgc2VhcmNoTG93ZXJDb2RlKTtcblx0ICAgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICAgIG9ialJlc3VsdHMub2JqID0gb2JqOyAvLyBiZWZvcmUgc2NvcmVGbiBzbyBzY29yZUZuIGNhbiB1c2UgaXRcblxuXHQgICAgICAgICAgICAgICAgICB2YXIgc2NvcmUgPSBzY29yZUZuKG9ialJlc3VsdHMpO1xuXHQgICAgICAgICAgICAgICAgICBpZiAoc2NvcmUgPT09IG51bGwpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgICAgICBpZiAoc2NvcmUgPCB0aHJlc2hvbGQpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgICAgICBvYmpSZXN1bHRzLnNjb3JlID0gc2NvcmU7XG5cblx0ICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdHNMZW4gPCBsaW1pdCkge1xuXHQgICAgICAgICAgICAgICAgICAgIHEuYWRkKG9ialJlc3VsdHMpO1xuXHQgICAgICAgICAgICAgICAgICAgICsrcmVzdWx0c0xlbjtcblx0ICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgICAgICArK2xpbWl0ZWRDb3VudDtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAoc2NvcmUgPiBxLnBlZWsoKS5zY29yZSkgcS5yZXBsYWNlVG9wKG9ialJlc3VsdHMpO1xuXHQgICAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgICAgaWYgKGlDdXJyZW50ICUgMTAwMFxuXHQgICAgICAgICAgICAgICAgICAvKml0ZW1zUGVyQ2hlY2sqL1xuXHQgICAgICAgICAgICAgICAgICA9PT0gMCkge1xuXHQgICAgICAgICAgICAgICAgICAgIGlmIChEYXRlLm5vdygpIC0gc3RhcnRNcyA+PSAxMFxuXHQgICAgICAgICAgICAgICAgICAgIC8qYXN5bmNJbnRlcnZhbCovXG5cdCAgICAgICAgICAgICAgICAgICAgKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGlzTm9kZSA/IHNldEltbWVkaWF0ZShzdGVwKSA6IHNldFRpbWVvdXQoc3RlcCk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgfSAvLyBvcHRpb25zLmtleVxuXG5cdCAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zICYmIG9wdGlvbnMua2V5KSB7XG5cdCAgICAgICAgICAgICAgICB2YXIga2V5ID0gb3B0aW9ucy5rZXk7XG5cblx0ICAgICAgICAgICAgICAgIGZvciAoOyBpQ3VycmVudCA+PSAwOyAtLWlDdXJyZW50KSB7XG5cdCAgICAgICAgICAgICAgICAgIHZhciBvYmogPSB0YXJnZXRzW2lDdXJyZW50XTtcblx0ICAgICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IGdldFZhbHVlKG9iaiwga2V5KTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKCF0YXJnZXQpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgICAgICBpZiAoIWlzT2JqKHRhcmdldCkpIHRhcmdldCA9IGZ1enp5c29ydC5nZXRQcmVwYXJlZCh0YXJnZXQpO1xuXHQgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gYWxnb3JpdGhtKHNlYXJjaCwgdGFyZ2V0LCBzZWFyY2hMb3dlckNvZGUpO1xuXHQgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zY29yZSA8IHRocmVzaG9sZCkgY29udGludWU7IC8vIGhhdmUgdG8gY2xvbmUgcmVzdWx0IHNvIGR1cGxpY2F0ZSB0YXJnZXRzIGZyb20gZGlmZmVyZW50IG9iaiBjYW4gZWFjaCByZWZlcmVuY2UgdGhlIGNvcnJlY3Qgb2JqXG5cblx0ICAgICAgICAgICAgICAgICAgcmVzdWx0ID0ge1xuXHQgICAgICAgICAgICAgICAgICAgIHRhcmdldDogcmVzdWx0LnRhcmdldCxcblx0ICAgICAgICAgICAgICAgICAgICBfdGFyZ2V0TG93ZXJDb2RlczogbnVsbCxcblx0ICAgICAgICAgICAgICAgICAgICBfbmV4dEJlZ2lubmluZ0luZGV4ZXM6IG51bGwsXG5cdCAgICAgICAgICAgICAgICAgICAgc2NvcmU6IHJlc3VsdC5zY29yZSxcblx0ICAgICAgICAgICAgICAgICAgICBpbmRleGVzOiByZXN1bHQuaW5kZXhlcyxcblx0ICAgICAgICAgICAgICAgICAgICBvYmo6IG9ialxuXHQgICAgICAgICAgICAgICAgICB9OyAvLyBoaWRkZW5cblxuXHQgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0c0xlbiA8IGxpbWl0KSB7XG5cdCAgICAgICAgICAgICAgICAgICAgcS5hZGQocmVzdWx0KTtcblx0ICAgICAgICAgICAgICAgICAgICArK3Jlc3VsdHNMZW47XG5cdCAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICAgICAgKytsaW1pdGVkQ291bnQ7XG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zY29yZSA+IHEucGVlaygpLnNjb3JlKSBxLnJlcGxhY2VUb3AocmVzdWx0KTtcblx0ICAgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICAgIGlmIChpQ3VycmVudCAlIDEwMDBcblx0ICAgICAgICAgICAgICAgICAgLyppdGVtc1BlckNoZWNrKi9cblx0ICAgICAgICAgICAgICAgICAgPT09IDApIHtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAoRGF0ZS5ub3coKSAtIHN0YXJ0TXMgPj0gMTBcblx0ICAgICAgICAgICAgICAgICAgICAvKmFzeW5jSW50ZXJ2YWwqL1xuXHQgICAgICAgICAgICAgICAgICAgICkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBpc05vZGUgPyBzZXRJbW1lZGlhdGUoc3RlcCkgOiBzZXRUaW1lb3V0KHN0ZXApO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgIH0gLy8gbm8ga2V5c1xuXG5cdCAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgIGZvciAoOyBpQ3VycmVudCA+PSAwOyAtLWlDdXJyZW50KSB7XG5cdCAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSB0YXJnZXRzW2lDdXJyZW50XTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKCF0YXJnZXQpIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgICAgICBpZiAoIWlzT2JqKHRhcmdldCkpIHRhcmdldCA9IGZ1enp5c29ydC5nZXRQcmVwYXJlZCh0YXJnZXQpO1xuXHQgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gYWxnb3JpdGhtKHNlYXJjaCwgdGFyZ2V0LCBzZWFyY2hMb3dlckNvZGUpO1xuXHQgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKSBjb250aW51ZTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zY29yZSA8IHRocmVzaG9sZCkgY29udGludWU7XG5cblx0ICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdHNMZW4gPCBsaW1pdCkge1xuXHQgICAgICAgICAgICAgICAgICAgIHEuYWRkKHJlc3VsdCk7XG5cdCAgICAgICAgICAgICAgICAgICAgKytyZXN1bHRzTGVuO1xuXHQgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgICAgICsrbGltaXRlZENvdW50O1xuXHQgICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc2NvcmUgPiBxLnBlZWsoKS5zY29yZSkgcS5yZXBsYWNlVG9wKHJlc3VsdCk7XG5cdCAgICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgICBpZiAoaUN1cnJlbnQgJSAxMDAwXG5cdCAgICAgICAgICAgICAgICAgIC8qaXRlbXNQZXJDaGVjayovXG5cdCAgICAgICAgICAgICAgICAgID09PSAwKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKERhdGUubm93KCkgLSBzdGFydE1zID49IDEwXG5cdCAgICAgICAgICAgICAgICAgICAgLyphc3luY0ludGVydmFsKi9cblx0ICAgICAgICAgICAgICAgICAgICApIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgaXNOb2RlID8gc2V0SW1tZWRpYXRlKHN0ZXApIDogc2V0VGltZW91dChzdGVwKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgaWYgKHJlc3VsdHNMZW4gPT09IDApIHJldHVybiByZXNvbHZlKG5vUmVzdWx0cyk7XG5cdCAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSBuZXcgQXJyYXkocmVzdWx0c0xlbik7XG5cblx0ICAgICAgICAgICAgICBmb3IgKHZhciBpID0gcmVzdWx0c0xlbiAtIDE7IGkgPj0gMDsgLS1pKSByZXN1bHRzW2ldID0gcS5wb2xsKCk7XG5cblx0ICAgICAgICAgICAgICByZXN1bHRzLnRvdGFsID0gcmVzdWx0c0xlbiArIGxpbWl0ZWRDb3VudDtcblx0ICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdHMpO1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgaXNOb2RlID8gc2V0SW1tZWRpYXRlKHN0ZXApIDogc3RlcCgpO1xuXHQgICAgICAgICAgfSk7XG5cblx0ICAgICAgICAgIHAuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICBjYW5jZWxlZCA9IHRydWU7XG5cdCAgICAgICAgICB9O1xuXG5cdCAgICAgICAgICByZXR1cm4gcDtcblx0ICAgICAgICB9LFxuXHQgICAgICAgIGhpZ2hsaWdodDogZnVuY3Rpb24gKHJlc3VsdCwgaE9wZW4sIGhDbG9zZSkge1xuXHQgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkgcmV0dXJuIG51bGw7XG5cdCAgICAgICAgICBpZiAoaE9wZW4gPT09IHVuZGVmaW5lZCkgaE9wZW4gPSAnPGI+Jztcblx0ICAgICAgICAgIGlmIChoQ2xvc2UgPT09IHVuZGVmaW5lZCkgaENsb3NlID0gJzwvYj4nO1xuXHQgICAgICAgICAgdmFyIGhpZ2hsaWdodGVkID0gJyc7XG5cdCAgICAgICAgICB2YXIgbWF0Y2hlc0luZGV4ID0gMDtcblx0ICAgICAgICAgIHZhciBvcGVuZWQgPSBmYWxzZTtcblx0ICAgICAgICAgIHZhciB0YXJnZXQgPSByZXN1bHQudGFyZ2V0O1xuXHQgICAgICAgICAgdmFyIHRhcmdldExlbiA9IHRhcmdldC5sZW5ndGg7XG5cdCAgICAgICAgICB2YXIgbWF0Y2hlc0Jlc3QgPSByZXN1bHQuaW5kZXhlcztcblxuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0YXJnZXRMZW47ICsraSkge1xuXHQgICAgICAgICAgICB2YXIgY2hhciA9IHRhcmdldFtpXTtcblxuXHQgICAgICAgICAgICBpZiAobWF0Y2hlc0Jlc3RbbWF0Y2hlc0luZGV4XSA9PT0gaSkge1xuXHQgICAgICAgICAgICAgICsrbWF0Y2hlc0luZGV4O1xuXG5cdCAgICAgICAgICAgICAgaWYgKCFvcGVuZWQpIHtcblx0ICAgICAgICAgICAgICAgIG9wZW5lZCA9IHRydWU7XG5cdCAgICAgICAgICAgICAgICBoaWdobGlnaHRlZCArPSBoT3Blbjtcblx0ICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICBpZiAobWF0Y2hlc0luZGV4ID09PSBtYXRjaGVzQmVzdC5sZW5ndGgpIHtcblx0ICAgICAgICAgICAgICAgIGhpZ2hsaWdodGVkICs9IGNoYXIgKyBoQ2xvc2UgKyB0YXJnZXQuc3Vic3RyKGkgKyAxKTtcblx0ICAgICAgICAgICAgICAgIGJyZWFrO1xuXHQgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICBpZiAob3BlbmVkKSB7XG5cdCAgICAgICAgICAgICAgICBvcGVuZWQgPSBmYWxzZTtcblx0ICAgICAgICAgICAgICAgIGhpZ2hsaWdodGVkICs9IGhDbG9zZTtcblx0ICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICBoaWdobGlnaHRlZCArPSBjaGFyO1xuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICByZXR1cm4gaGlnaGxpZ2h0ZWQ7XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBwcmVwYXJlOiBmdW5jdGlvbiAodGFyZ2V0KSB7XG5cdCAgICAgICAgICBpZiAoIXRhcmdldCkgcmV0dXJuO1xuXHQgICAgICAgICAgcmV0dXJuIHtcblx0ICAgICAgICAgICAgdGFyZ2V0OiB0YXJnZXQsXG5cdCAgICAgICAgICAgIF90YXJnZXRMb3dlckNvZGVzOiBmdXp6eXNvcnQucHJlcGFyZUxvd2VyQ29kZXModGFyZ2V0KSxcblx0ICAgICAgICAgICAgX25leHRCZWdpbm5pbmdJbmRleGVzOiBudWxsLFxuXHQgICAgICAgICAgICBzY29yZTogbnVsbCxcblx0ICAgICAgICAgICAgaW5kZXhlczogbnVsbCxcblx0ICAgICAgICAgICAgb2JqOiBudWxsXG5cdCAgICAgICAgICB9OyAvLyBoaWRkZW5cblx0ICAgICAgICB9LFxuXHQgICAgICAgIHByZXBhcmVTbG93OiBmdW5jdGlvbiAodGFyZ2V0KSB7XG5cdCAgICAgICAgICBpZiAoIXRhcmdldCkgcmV0dXJuO1xuXHQgICAgICAgICAgcmV0dXJuIHtcblx0ICAgICAgICAgICAgdGFyZ2V0OiB0YXJnZXQsXG5cdCAgICAgICAgICAgIF90YXJnZXRMb3dlckNvZGVzOiBmdXp6eXNvcnQucHJlcGFyZUxvd2VyQ29kZXModGFyZ2V0KSxcblx0ICAgICAgICAgICAgX25leHRCZWdpbm5pbmdJbmRleGVzOiBmdXp6eXNvcnQucHJlcGFyZU5leHRCZWdpbm5pbmdJbmRleGVzKHRhcmdldCksXG5cdCAgICAgICAgICAgIHNjb3JlOiBudWxsLFxuXHQgICAgICAgICAgICBpbmRleGVzOiBudWxsLFxuXHQgICAgICAgICAgICBvYmo6IG51bGxcblx0ICAgICAgICAgIH07IC8vIGhpZGRlblxuXHQgICAgICAgIH0sXG5cdCAgICAgICAgcHJlcGFyZVNlYXJjaDogZnVuY3Rpb24gKHNlYXJjaCkge1xuXHQgICAgICAgICAgaWYgKCFzZWFyY2gpIHJldHVybjtcblx0ICAgICAgICAgIHJldHVybiBmdXp6eXNvcnQucHJlcGFyZUxvd2VyQ29kZXMoc2VhcmNoKTtcblx0ICAgICAgICB9LFxuXHQgICAgICAgIC8vIEJlbG93IHRoaXMgcG9pbnQgaXMgb25seSBpbnRlcm5hbCBjb2RlXG5cdCAgICAgICAgLy8gQmVsb3cgdGhpcyBwb2ludCBpcyBvbmx5IGludGVybmFsIGNvZGVcblx0ICAgICAgICAvLyBCZWxvdyB0aGlzIHBvaW50IGlzIG9ubHkgaW50ZXJuYWwgY29kZVxuXHQgICAgICAgIC8vIEJlbG93IHRoaXMgcG9pbnQgaXMgb25seSBpbnRlcm5hbCBjb2RlXG5cdCAgICAgICAgZ2V0UHJlcGFyZWQ6IGZ1bmN0aW9uICh0YXJnZXQpIHtcblx0ICAgICAgICAgIGlmICh0YXJnZXQubGVuZ3RoID4gOTk5KSByZXR1cm4gZnV6enlzb3J0LnByZXBhcmUodGFyZ2V0KTsgLy8gZG9uJ3QgY2FjaGUgaHVnZSB0YXJnZXRzXG5cblx0ICAgICAgICAgIHZhciB0YXJnZXRQcmVwYXJlZCA9IHByZXBhcmVkQ2FjaGUuZ2V0KHRhcmdldCk7XG5cdCAgICAgICAgICBpZiAodGFyZ2V0UHJlcGFyZWQgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHRhcmdldFByZXBhcmVkO1xuXHQgICAgICAgICAgdGFyZ2V0UHJlcGFyZWQgPSBmdXp6eXNvcnQucHJlcGFyZSh0YXJnZXQpO1xuXHQgICAgICAgICAgcHJlcGFyZWRDYWNoZS5zZXQodGFyZ2V0LCB0YXJnZXRQcmVwYXJlZCk7XG5cdCAgICAgICAgICByZXR1cm4gdGFyZ2V0UHJlcGFyZWQ7XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBnZXRQcmVwYXJlZFNlYXJjaDogZnVuY3Rpb24gKHNlYXJjaCkge1xuXHQgICAgICAgICAgaWYgKHNlYXJjaC5sZW5ndGggPiA5OTkpIHJldHVybiBmdXp6eXNvcnQucHJlcGFyZVNlYXJjaChzZWFyY2gpOyAvLyBkb24ndCBjYWNoZSBodWdlIHNlYXJjaGVzXG5cblx0ICAgICAgICAgIHZhciBzZWFyY2hQcmVwYXJlZCA9IHByZXBhcmVkU2VhcmNoQ2FjaGUuZ2V0KHNlYXJjaCk7XG5cdCAgICAgICAgICBpZiAoc2VhcmNoUHJlcGFyZWQgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHNlYXJjaFByZXBhcmVkO1xuXHQgICAgICAgICAgc2VhcmNoUHJlcGFyZWQgPSBmdXp6eXNvcnQucHJlcGFyZVNlYXJjaChzZWFyY2gpO1xuXHQgICAgICAgICAgcHJlcGFyZWRTZWFyY2hDYWNoZS5zZXQoc2VhcmNoLCBzZWFyY2hQcmVwYXJlZCk7XG5cdCAgICAgICAgICByZXR1cm4gc2VhcmNoUHJlcGFyZWQ7XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBhbGdvcml0aG06IGZ1bmN0aW9uIChzZWFyY2hMb3dlckNvZGVzLCBwcmVwYXJlZCwgc2VhcmNoTG93ZXJDb2RlKSB7XG5cdCAgICAgICAgICB2YXIgdGFyZ2V0TG93ZXJDb2RlcyA9IHByZXBhcmVkLl90YXJnZXRMb3dlckNvZGVzO1xuXHQgICAgICAgICAgdmFyIHNlYXJjaExlbiA9IHNlYXJjaExvd2VyQ29kZXMubGVuZ3RoO1xuXHQgICAgICAgICAgdmFyIHRhcmdldExlbiA9IHRhcmdldExvd2VyQ29kZXMubGVuZ3RoO1xuXHQgICAgICAgICAgdmFyIHNlYXJjaEkgPSAwOyAvLyB3aGVyZSB3ZSBhdFxuXG5cdCAgICAgICAgICB2YXIgdGFyZ2V0SSA9IDA7IC8vIHdoZXJlIHlvdSBhdFxuXG5cdCAgICAgICAgICB2YXIgdHlwb1NpbXBsZUkgPSAwO1xuXHQgICAgICAgICAgdmFyIG1hdGNoZXNTaW1wbGVMZW4gPSAwOyAvLyB2ZXJ5IGJhc2ljIGZ1enp5IG1hdGNoOyB0byByZW1vdmUgbm9uLW1hdGNoaW5nIHRhcmdldHMgQVNBUCFcblx0ICAgICAgICAgIC8vIHdhbGsgdGhyb3VnaCB0YXJnZXQuIGZpbmQgc2VxdWVudGlhbCBtYXRjaGVzLlxuXHQgICAgICAgICAgLy8gaWYgYWxsIGNoYXJzIGFyZW4ndCBmb3VuZCB0aGVuIGV4aXRcblxuXHQgICAgICAgICAgZm9yICg7Oykge1xuXHQgICAgICAgICAgICB2YXIgaXNNYXRjaCA9IHNlYXJjaExvd2VyQ29kZSA9PT0gdGFyZ2V0TG93ZXJDb2Rlc1t0YXJnZXRJXTtcblxuXHQgICAgICAgICAgICBpZiAoaXNNYXRjaCkge1xuXHQgICAgICAgICAgICAgIG1hdGNoZXNTaW1wbGVbbWF0Y2hlc1NpbXBsZUxlbisrXSA9IHRhcmdldEk7XG5cdCAgICAgICAgICAgICAgKytzZWFyY2hJO1xuXHQgICAgICAgICAgICAgIGlmIChzZWFyY2hJID09PSBzZWFyY2hMZW4pIGJyZWFrO1xuXHQgICAgICAgICAgICAgIHNlYXJjaExvd2VyQ29kZSA9IHNlYXJjaExvd2VyQ29kZXNbdHlwb1NpbXBsZUkgPT09IDAgPyBzZWFyY2hJIDogdHlwb1NpbXBsZUkgPT09IHNlYXJjaEkgPyBzZWFyY2hJICsgMSA6IHR5cG9TaW1wbGVJID09PSBzZWFyY2hJIC0gMSA/IHNlYXJjaEkgLSAxIDogc2VhcmNoSV07XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICArK3RhcmdldEk7XG5cblx0ICAgICAgICAgICAgaWYgKHRhcmdldEkgPj0gdGFyZ2V0TGVuKSB7XG5cdCAgICAgICAgICAgICAgLy8gRmFpbGVkIHRvIGZpbmQgc2VhcmNoSVxuXHQgICAgICAgICAgICAgIC8vIENoZWNrIGZvciB0eXBvIG9yIGV4aXRcblx0ICAgICAgICAgICAgICAvLyB3ZSBnbyBhcyBmYXIgYXMgcG9zc2libGUgYmVmb3JlIHRyeWluZyB0byB0cmFuc3Bvc2Vcblx0ICAgICAgICAgICAgICAvLyB0aGVuIHdlIHRyYW5zcG9zZSBiYWNrd2FyZHMgdW50aWwgd2UgcmVhY2ggdGhlIGJlZ2lubmluZ1xuXHQgICAgICAgICAgICAgIGZvciAoOzspIHtcblx0ICAgICAgICAgICAgICAgIGlmIChzZWFyY2hJIDw9IDEpIHJldHVybiBudWxsOyAvLyBub3QgYWxsb3dlZCB0byB0cmFuc3Bvc2UgZmlyc3QgY2hhclxuXG5cdCAgICAgICAgICAgICAgICBpZiAodHlwb1NpbXBsZUkgPT09IDApIHtcblx0ICAgICAgICAgICAgICAgICAgLy8gd2UgaGF2ZW4ndCB0cmllZCB0byB0cmFuc3Bvc2UgeWV0XG5cdCAgICAgICAgICAgICAgICAgIC0tc2VhcmNoSTtcblx0ICAgICAgICAgICAgICAgICAgdmFyIHNlYXJjaExvd2VyQ29kZU5ldyA9IHNlYXJjaExvd2VyQ29kZXNbc2VhcmNoSV07XG5cdCAgICAgICAgICAgICAgICAgIGlmIChzZWFyY2hMb3dlckNvZGUgPT09IHNlYXJjaExvd2VyQ29kZU5ldykgY29udGludWU7IC8vIGRvZXNuJ3QgbWFrZSBzZW5zZSB0byB0cmFuc3Bvc2UgYSByZXBlYXQgY2hhclxuXG5cdCAgICAgICAgICAgICAgICAgIHR5cG9TaW1wbGVJID0gc2VhcmNoSTtcblx0ICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICAgIGlmICh0eXBvU2ltcGxlSSA9PT0gMSkgcmV0dXJuIG51bGw7IC8vIHJlYWNoZWQgdGhlIGVuZCBvZiB0aGUgbGluZSBmb3IgdHJhbnNwb3NpbmdcblxuXHQgICAgICAgICAgICAgICAgICAtLXR5cG9TaW1wbGVJO1xuXHQgICAgICAgICAgICAgICAgICBzZWFyY2hJID0gdHlwb1NpbXBsZUk7XG5cdCAgICAgICAgICAgICAgICAgIHNlYXJjaExvd2VyQ29kZSA9IHNlYXJjaExvd2VyQ29kZXNbc2VhcmNoSSArIDFdO1xuXHQgICAgICAgICAgICAgICAgICB2YXIgc2VhcmNoTG93ZXJDb2RlTmV3ID0gc2VhcmNoTG93ZXJDb2Rlc1tzZWFyY2hJXTtcblx0ICAgICAgICAgICAgICAgICAgaWYgKHNlYXJjaExvd2VyQ29kZSA9PT0gc2VhcmNoTG93ZXJDb2RlTmV3KSBjb250aW51ZTsgLy8gZG9lc24ndCBtYWtlIHNlbnNlIHRvIHRyYW5zcG9zZSBhIHJlcGVhdCBjaGFyXG5cdCAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgIG1hdGNoZXNTaW1wbGVMZW4gPSBzZWFyY2hJO1xuXHQgICAgICAgICAgICAgICAgdGFyZ2V0SSA9IG1hdGNoZXNTaW1wbGVbbWF0Y2hlc1NpbXBsZUxlbiAtIDFdICsgMTtcblx0ICAgICAgICAgICAgICAgIGJyZWFrO1xuXHQgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICB2YXIgc2VhcmNoSSA9IDA7XG5cdCAgICAgICAgICB2YXIgdHlwb1N0cmljdEkgPSAwO1xuXHQgICAgICAgICAgdmFyIHN1Y2Nlc3NTdHJpY3QgPSBmYWxzZTtcblx0ICAgICAgICAgIHZhciBtYXRjaGVzU3RyaWN0TGVuID0gMDtcblx0ICAgICAgICAgIHZhciBuZXh0QmVnaW5uaW5nSW5kZXhlcyA9IHByZXBhcmVkLl9uZXh0QmVnaW5uaW5nSW5kZXhlcztcblx0ICAgICAgICAgIGlmIChuZXh0QmVnaW5uaW5nSW5kZXhlcyA9PT0gbnVsbCkgbmV4dEJlZ2lubmluZ0luZGV4ZXMgPSBwcmVwYXJlZC5fbmV4dEJlZ2lubmluZ0luZGV4ZXMgPSBmdXp6eXNvcnQucHJlcGFyZU5leHRCZWdpbm5pbmdJbmRleGVzKHByZXBhcmVkLnRhcmdldCk7XG5cdCAgICAgICAgICB2YXIgZmlyc3RQb3NzaWJsZUkgPSB0YXJnZXRJID0gbWF0Y2hlc1NpbXBsZVswXSA9PT0gMCA/IDAgOiBuZXh0QmVnaW5uaW5nSW5kZXhlc1ttYXRjaGVzU2ltcGxlWzBdIC0gMV07IC8vIE91ciB0YXJnZXQgc3RyaW5nIHN1Y2Nlc3NmdWxseSBtYXRjaGVkIGFsbCBjaGFyYWN0ZXJzIGluIHNlcXVlbmNlIVxuXHQgICAgICAgICAgLy8gTGV0J3MgdHJ5IGEgbW9yZSBhZHZhbmNlZCBhbmQgc3RyaWN0IHRlc3QgdG8gaW1wcm92ZSB0aGUgc2NvcmVcblx0ICAgICAgICAgIC8vIG9ubHkgY291bnQgaXQgYXMgYSBtYXRjaCBpZiBpdCdzIGNvbnNlY3V0aXZlIG9yIGEgYmVnaW5uaW5nIGNoYXJhY3RlciFcblxuXHQgICAgICAgICAgaWYgKHRhcmdldEkgIT09IHRhcmdldExlbikgZm9yICg7Oykge1xuXHQgICAgICAgICAgICBpZiAodGFyZ2V0SSA+PSB0YXJnZXRMZW4pIHtcblx0ICAgICAgICAgICAgICAvLyBXZSBmYWlsZWQgdG8gZmluZCBhIGdvb2Qgc3BvdCBmb3IgdGhpcyBzZWFyY2ggY2hhciwgZ28gYmFjayB0byB0aGUgcHJldmlvdXMgc2VhcmNoIGNoYXIgYW5kIGZvcmNlIGl0IGZvcndhcmRcblx0ICAgICAgICAgICAgICBpZiAoc2VhcmNoSSA8PSAwKSB7XG5cdCAgICAgICAgICAgICAgICAvLyBXZSBmYWlsZWQgdG8gcHVzaCBjaGFycyBmb3J3YXJkIGZvciBhIGJldHRlciBtYXRjaFxuXHQgICAgICAgICAgICAgICAgLy8gdHJhbnNwb3NlLCBzdGFydGluZyBmcm9tIHRoZSBiZWdpbm5pbmdcblx0ICAgICAgICAgICAgICAgICsrdHlwb1N0cmljdEk7XG5cdCAgICAgICAgICAgICAgICBpZiAodHlwb1N0cmljdEkgPiBzZWFyY2hMZW4gLSAyKSBicmVhaztcblx0ICAgICAgICAgICAgICAgIGlmIChzZWFyY2hMb3dlckNvZGVzW3R5cG9TdHJpY3RJXSA9PT0gc2VhcmNoTG93ZXJDb2Rlc1t0eXBvU3RyaWN0SSArIDFdKSBjb250aW51ZTsgLy8gZG9lc24ndCBtYWtlIHNlbnNlIHRvIHRyYW5zcG9zZSBhIHJlcGVhdCBjaGFyXG5cblx0ICAgICAgICAgICAgICAgIHRhcmdldEkgPSBmaXJzdFBvc3NpYmxlSTtcblx0ICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXHQgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgIC0tc2VhcmNoSTtcblx0ICAgICAgICAgICAgICB2YXIgbGFzdE1hdGNoID0gbWF0Y2hlc1N0cmljdFstLW1hdGNoZXNTdHJpY3RMZW5dO1xuXHQgICAgICAgICAgICAgIHRhcmdldEkgPSBuZXh0QmVnaW5uaW5nSW5kZXhlc1tsYXN0TWF0Y2hdO1xuXHQgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgIHZhciBpc01hdGNoID0gc2VhcmNoTG93ZXJDb2Rlc1t0eXBvU3RyaWN0SSA9PT0gMCA/IHNlYXJjaEkgOiB0eXBvU3RyaWN0SSA9PT0gc2VhcmNoSSA/IHNlYXJjaEkgKyAxIDogdHlwb1N0cmljdEkgPT09IHNlYXJjaEkgLSAxID8gc2VhcmNoSSAtIDEgOiBzZWFyY2hJXSA9PT0gdGFyZ2V0TG93ZXJDb2Rlc1t0YXJnZXRJXTtcblxuXHQgICAgICAgICAgICAgIGlmIChpc01hdGNoKSB7XG5cdCAgICAgICAgICAgICAgICBtYXRjaGVzU3RyaWN0W21hdGNoZXNTdHJpY3RMZW4rK10gPSB0YXJnZXRJO1xuXHQgICAgICAgICAgICAgICAgKytzZWFyY2hJO1xuXG5cdCAgICAgICAgICAgICAgICBpZiAoc2VhcmNoSSA9PT0gc2VhcmNoTGVuKSB7XG5cdCAgICAgICAgICAgICAgICAgIHN1Y2Nlc3NTdHJpY3QgPSB0cnVlO1xuXHQgICAgICAgICAgICAgICAgICBicmVhaztcblx0ICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgKyt0YXJnZXRJO1xuXHQgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICB0YXJnZXRJID0gbmV4dEJlZ2lubmluZ0luZGV4ZXNbdGFyZ2V0SV07XG5cdCAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgICB7XG5cdCAgICAgICAgICAgIC8vIHRhbGx5IHVwIHRoZSBzY29yZSAmIGtlZXAgdHJhY2sgb2YgbWF0Y2hlcyBmb3IgaGlnaGxpZ2h0aW5nIGxhdGVyXG5cdCAgICAgICAgICAgIGlmIChzdWNjZXNzU3RyaWN0KSB7XG5cdCAgICAgICAgICAgICAgdmFyIG1hdGNoZXNCZXN0ID0gbWF0Y2hlc1N0cmljdDtcblx0ICAgICAgICAgICAgICB2YXIgbWF0Y2hlc0Jlc3RMZW4gPSBtYXRjaGVzU3RyaWN0TGVuO1xuXHQgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgIHZhciBtYXRjaGVzQmVzdCA9IG1hdGNoZXNTaW1wbGU7XG5cdCAgICAgICAgICAgICAgdmFyIG1hdGNoZXNCZXN0TGVuID0gbWF0Y2hlc1NpbXBsZUxlbjtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIHZhciBzY29yZSA9IDA7XG5cdCAgICAgICAgICAgIHZhciBsYXN0VGFyZ2V0SSA9IC0xO1xuXG5cdCAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VhcmNoTGVuOyArK2kpIHtcblx0ICAgICAgICAgICAgICB2YXIgdGFyZ2V0SSA9IG1hdGNoZXNCZXN0W2ldOyAvLyBzY29yZSBvbmx5IGdvZXMgZG93biBpZiB0aGV5J3JlIG5vdCBjb25zZWN1dGl2ZVxuXG5cdCAgICAgICAgICAgICAgaWYgKGxhc3RUYXJnZXRJICE9PSB0YXJnZXRJIC0gMSkgc2NvcmUgLT0gdGFyZ2V0STtcblx0ICAgICAgICAgICAgICBsYXN0VGFyZ2V0SSA9IHRhcmdldEk7XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICBpZiAoIXN1Y2Nlc3NTdHJpY3QpIHtcblx0ICAgICAgICAgICAgICBzY29yZSAqPSAxMDAwO1xuXHQgICAgICAgICAgICAgIGlmICh0eXBvU2ltcGxlSSAhPT0gMCkgc2NvcmUgKz0gLTIwO1xuXHQgICAgICAgICAgICAgIC8qdHlwb1BlbmFsdHkqL1xuXHQgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgIGlmICh0eXBvU3RyaWN0SSAhPT0gMCkgc2NvcmUgKz0gLTIwO1xuXHQgICAgICAgICAgICAgIC8qdHlwb1BlbmFsdHkqL1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgc2NvcmUgLT0gdGFyZ2V0TGVuIC0gc2VhcmNoTGVuO1xuXHQgICAgICAgICAgICBwcmVwYXJlZC5zY29yZSA9IHNjb3JlO1xuXHQgICAgICAgICAgICBwcmVwYXJlZC5pbmRleGVzID0gbmV3IEFycmF5KG1hdGNoZXNCZXN0TGVuKTtcblxuXHQgICAgICAgICAgICBmb3IgKHZhciBpID0gbWF0Y2hlc0Jlc3RMZW4gLSAxOyBpID49IDA7IC0taSkgcHJlcGFyZWQuaW5kZXhlc1tpXSA9IG1hdGNoZXNCZXN0W2ldO1xuXG5cdCAgICAgICAgICAgIHJldHVybiBwcmVwYXJlZDtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9LFxuXHQgICAgICAgIGFsZ29yaXRobU5vVHlwbzogZnVuY3Rpb24gKHNlYXJjaExvd2VyQ29kZXMsIHByZXBhcmVkLCBzZWFyY2hMb3dlckNvZGUpIHtcblx0ICAgICAgICAgIHZhciB0YXJnZXRMb3dlckNvZGVzID0gcHJlcGFyZWQuX3RhcmdldExvd2VyQ29kZXM7XG5cdCAgICAgICAgICB2YXIgc2VhcmNoTGVuID0gc2VhcmNoTG93ZXJDb2Rlcy5sZW5ndGg7XG5cdCAgICAgICAgICB2YXIgdGFyZ2V0TGVuID0gdGFyZ2V0TG93ZXJDb2Rlcy5sZW5ndGg7XG5cdCAgICAgICAgICB2YXIgc2VhcmNoSSA9IDA7IC8vIHdoZXJlIHdlIGF0XG5cblx0ICAgICAgICAgIHZhciB0YXJnZXRJID0gMDsgLy8gd2hlcmUgeW91IGF0XG5cblx0ICAgICAgICAgIHZhciBtYXRjaGVzU2ltcGxlTGVuID0gMDsgLy8gdmVyeSBiYXNpYyBmdXp6eSBtYXRjaDsgdG8gcmVtb3ZlIG5vbi1tYXRjaGluZyB0YXJnZXRzIEFTQVAhXG5cdCAgICAgICAgICAvLyB3YWxrIHRocm91Z2ggdGFyZ2V0LiBmaW5kIHNlcXVlbnRpYWwgbWF0Y2hlcy5cblx0ICAgICAgICAgIC8vIGlmIGFsbCBjaGFycyBhcmVuJ3QgZm91bmQgdGhlbiBleGl0XG5cblx0ICAgICAgICAgIGZvciAoOzspIHtcblx0ICAgICAgICAgICAgdmFyIGlzTWF0Y2ggPSBzZWFyY2hMb3dlckNvZGUgPT09IHRhcmdldExvd2VyQ29kZXNbdGFyZ2V0SV07XG5cblx0ICAgICAgICAgICAgaWYgKGlzTWF0Y2gpIHtcblx0ICAgICAgICAgICAgICBtYXRjaGVzU2ltcGxlW21hdGNoZXNTaW1wbGVMZW4rK10gPSB0YXJnZXRJO1xuXHQgICAgICAgICAgICAgICsrc2VhcmNoSTtcblx0ICAgICAgICAgICAgICBpZiAoc2VhcmNoSSA9PT0gc2VhcmNoTGVuKSBicmVhaztcblx0ICAgICAgICAgICAgICBzZWFyY2hMb3dlckNvZGUgPSBzZWFyY2hMb3dlckNvZGVzW3NlYXJjaEldO1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgKyt0YXJnZXRJO1xuXHQgICAgICAgICAgICBpZiAodGFyZ2V0SSA+PSB0YXJnZXRMZW4pIHJldHVybiBudWxsOyAvLyBGYWlsZWQgdG8gZmluZCBzZWFyY2hJXG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIHZhciBzZWFyY2hJID0gMDtcblx0ICAgICAgICAgIHZhciBzdWNjZXNzU3RyaWN0ID0gZmFsc2U7XG5cdCAgICAgICAgICB2YXIgbWF0Y2hlc1N0cmljdExlbiA9IDA7XG5cdCAgICAgICAgICB2YXIgbmV4dEJlZ2lubmluZ0luZGV4ZXMgPSBwcmVwYXJlZC5fbmV4dEJlZ2lubmluZ0luZGV4ZXM7XG5cdCAgICAgICAgICBpZiAobmV4dEJlZ2lubmluZ0luZGV4ZXMgPT09IG51bGwpIG5leHRCZWdpbm5pbmdJbmRleGVzID0gcHJlcGFyZWQuX25leHRCZWdpbm5pbmdJbmRleGVzID0gZnV6enlzb3J0LnByZXBhcmVOZXh0QmVnaW5uaW5nSW5kZXhlcyhwcmVwYXJlZC50YXJnZXQpO1xuXHQgICAgICAgICAgdmFyIGZpcnN0UG9zc2libGVJID0gdGFyZ2V0SSA9IG1hdGNoZXNTaW1wbGVbMF0gPT09IDAgPyAwIDogbmV4dEJlZ2lubmluZ0luZGV4ZXNbbWF0Y2hlc1NpbXBsZVswXSAtIDFdOyAvLyBPdXIgdGFyZ2V0IHN0cmluZyBzdWNjZXNzZnVsbHkgbWF0Y2hlZCBhbGwgY2hhcmFjdGVycyBpbiBzZXF1ZW5jZSFcblx0ICAgICAgICAgIC8vIExldCdzIHRyeSBhIG1vcmUgYWR2YW5jZWQgYW5kIHN0cmljdCB0ZXN0IHRvIGltcHJvdmUgdGhlIHNjb3JlXG5cdCAgICAgICAgICAvLyBvbmx5IGNvdW50IGl0IGFzIGEgbWF0Y2ggaWYgaXQncyBjb25zZWN1dGl2ZSBvciBhIGJlZ2lubmluZyBjaGFyYWN0ZXIhXG5cblx0ICAgICAgICAgIGlmICh0YXJnZXRJICE9PSB0YXJnZXRMZW4pIGZvciAoOzspIHtcblx0ICAgICAgICAgICAgaWYgKHRhcmdldEkgPj0gdGFyZ2V0TGVuKSB7XG5cdCAgICAgICAgICAgICAgLy8gV2UgZmFpbGVkIHRvIGZpbmQgYSBnb29kIHNwb3QgZm9yIHRoaXMgc2VhcmNoIGNoYXIsIGdvIGJhY2sgdG8gdGhlIHByZXZpb3VzIHNlYXJjaCBjaGFyIGFuZCBmb3JjZSBpdCBmb3J3YXJkXG5cdCAgICAgICAgICAgICAgaWYgKHNlYXJjaEkgPD0gMCkgYnJlYWs7IC8vIFdlIGZhaWxlZCB0byBwdXNoIGNoYXJzIGZvcndhcmQgZm9yIGEgYmV0dGVyIG1hdGNoXG5cblx0ICAgICAgICAgICAgICAtLXNlYXJjaEk7XG5cdCAgICAgICAgICAgICAgdmFyIGxhc3RNYXRjaCA9IG1hdGNoZXNTdHJpY3RbLS1tYXRjaGVzU3RyaWN0TGVuXTtcblx0ICAgICAgICAgICAgICB0YXJnZXRJID0gbmV4dEJlZ2lubmluZ0luZGV4ZXNbbGFzdE1hdGNoXTtcblx0ICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICB2YXIgaXNNYXRjaCA9IHNlYXJjaExvd2VyQ29kZXNbc2VhcmNoSV0gPT09IHRhcmdldExvd2VyQ29kZXNbdGFyZ2V0SV07XG5cblx0ICAgICAgICAgICAgICBpZiAoaXNNYXRjaCkge1xuXHQgICAgICAgICAgICAgICAgbWF0Y2hlc1N0cmljdFttYXRjaGVzU3RyaWN0TGVuKytdID0gdGFyZ2V0STtcblx0ICAgICAgICAgICAgICAgICsrc2VhcmNoSTtcblxuXHQgICAgICAgICAgICAgICAgaWYgKHNlYXJjaEkgPT09IHNlYXJjaExlbikge1xuXHQgICAgICAgICAgICAgICAgICBzdWNjZXNzU3RyaWN0ID0gdHJ1ZTtcblx0ICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cdCAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgICsrdGFyZ2V0STtcblx0ICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgdGFyZ2V0SSA9IG5leHRCZWdpbm5pbmdJbmRleGVzW3RhcmdldEldO1xuXHQgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXHQgICAgICAgICAge1xuXHQgICAgICAgICAgICAvLyB0YWxseSB1cCB0aGUgc2NvcmUgJiBrZWVwIHRyYWNrIG9mIG1hdGNoZXMgZm9yIGhpZ2hsaWdodGluZyBsYXRlclxuXHQgICAgICAgICAgICBpZiAoc3VjY2Vzc1N0cmljdCkge1xuXHQgICAgICAgICAgICAgIHZhciBtYXRjaGVzQmVzdCA9IG1hdGNoZXNTdHJpY3Q7XG5cdCAgICAgICAgICAgICAgdmFyIG1hdGNoZXNCZXN0TGVuID0gbWF0Y2hlc1N0cmljdExlbjtcblx0ICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICB2YXIgbWF0Y2hlc0Jlc3QgPSBtYXRjaGVzU2ltcGxlO1xuXHQgICAgICAgICAgICAgIHZhciBtYXRjaGVzQmVzdExlbiA9IG1hdGNoZXNTaW1wbGVMZW47XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICB2YXIgc2NvcmUgPSAwO1xuXHQgICAgICAgICAgICB2YXIgbGFzdFRhcmdldEkgPSAtMTtcblxuXHQgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlYXJjaExlbjsgKytpKSB7XG5cdCAgICAgICAgICAgICAgdmFyIHRhcmdldEkgPSBtYXRjaGVzQmVzdFtpXTsgLy8gc2NvcmUgb25seSBnb2VzIGRvd24gaWYgdGhleSdyZSBub3QgY29uc2VjdXRpdmVcblxuXHQgICAgICAgICAgICAgIGlmIChsYXN0VGFyZ2V0SSAhPT0gdGFyZ2V0SSAtIDEpIHNjb3JlIC09IHRhcmdldEk7XG5cdCAgICAgICAgICAgICAgbGFzdFRhcmdldEkgPSB0YXJnZXRJO1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgaWYgKCFzdWNjZXNzU3RyaWN0KSBzY29yZSAqPSAxMDAwO1xuXHQgICAgICAgICAgICBzY29yZSAtPSB0YXJnZXRMZW4gLSBzZWFyY2hMZW47XG5cdCAgICAgICAgICAgIHByZXBhcmVkLnNjb3JlID0gc2NvcmU7XG5cdCAgICAgICAgICAgIHByZXBhcmVkLmluZGV4ZXMgPSBuZXcgQXJyYXkobWF0Y2hlc0Jlc3RMZW4pO1xuXG5cdCAgICAgICAgICAgIGZvciAodmFyIGkgPSBtYXRjaGVzQmVzdExlbiAtIDE7IGkgPj0gMDsgLS1pKSBwcmVwYXJlZC5pbmRleGVzW2ldID0gbWF0Y2hlc0Jlc3RbaV07XG5cblx0ICAgICAgICAgICAgcmV0dXJuIHByZXBhcmVkO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0sXG5cdCAgICAgICAgcHJlcGFyZUxvd2VyQ29kZXM6IGZ1bmN0aW9uIChzdHIpIHtcblx0ICAgICAgICAgIHZhciBzdHJMZW4gPSBzdHIubGVuZ3RoO1xuXHQgICAgICAgICAgdmFyIGxvd2VyQ29kZXMgPSBbXTsgLy8gbmV3IEFycmF5KHN0ckxlbikgICAgc3BhcnNlIGFycmF5IGlzIHRvbyBzbG93XG5cblx0ICAgICAgICAgIHZhciBsb3dlciA9IHN0ci50b0xvd2VyQ2FzZSgpO1xuXG5cdCAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ckxlbjsgKytpKSBsb3dlckNvZGVzW2ldID0gbG93ZXIuY2hhckNvZGVBdChpKTtcblxuXHQgICAgICAgICAgcmV0dXJuIGxvd2VyQ29kZXM7XG5cdCAgICAgICAgfSxcblx0ICAgICAgICBwcmVwYXJlQmVnaW5uaW5nSW5kZXhlczogZnVuY3Rpb24gKHRhcmdldCkge1xuXHQgICAgICAgICAgdmFyIHRhcmdldExlbiA9IHRhcmdldC5sZW5ndGg7XG5cdCAgICAgICAgICB2YXIgYmVnaW5uaW5nSW5kZXhlcyA9IFtdO1xuXHQgICAgICAgICAgdmFyIGJlZ2lubmluZ0luZGV4ZXNMZW4gPSAwO1xuXHQgICAgICAgICAgdmFyIHdhc1VwcGVyID0gZmFsc2U7XG5cdCAgICAgICAgICB2YXIgd2FzQWxwaGFudW0gPSBmYWxzZTtcblxuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0YXJnZXRMZW47ICsraSkge1xuXHQgICAgICAgICAgICB2YXIgdGFyZ2V0Q29kZSA9IHRhcmdldC5jaGFyQ29kZUF0KGkpO1xuXHQgICAgICAgICAgICB2YXIgaXNVcHBlciA9IHRhcmdldENvZGUgPj0gNjUgJiYgdGFyZ2V0Q29kZSA8PSA5MDtcblx0ICAgICAgICAgICAgdmFyIGlzQWxwaGFudW0gPSBpc1VwcGVyIHx8IHRhcmdldENvZGUgPj0gOTcgJiYgdGFyZ2V0Q29kZSA8PSAxMjIgfHwgdGFyZ2V0Q29kZSA+PSA0OCAmJiB0YXJnZXRDb2RlIDw9IDU3O1xuXHQgICAgICAgICAgICB2YXIgaXNCZWdpbm5pbmcgPSBpc1VwcGVyICYmICF3YXNVcHBlciB8fCAhd2FzQWxwaGFudW0gfHwgIWlzQWxwaGFudW07XG5cdCAgICAgICAgICAgIHdhc1VwcGVyID0gaXNVcHBlcjtcblx0ICAgICAgICAgICAgd2FzQWxwaGFudW0gPSBpc0FscGhhbnVtO1xuXHQgICAgICAgICAgICBpZiAoaXNCZWdpbm5pbmcpIGJlZ2lubmluZ0luZGV4ZXNbYmVnaW5uaW5nSW5kZXhlc0xlbisrXSA9IGk7XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIHJldHVybiBiZWdpbm5pbmdJbmRleGVzO1xuXHQgICAgICAgIH0sXG5cdCAgICAgICAgcHJlcGFyZU5leHRCZWdpbm5pbmdJbmRleGVzOiBmdW5jdGlvbiAodGFyZ2V0KSB7XG5cdCAgICAgICAgICB2YXIgdGFyZ2V0TGVuID0gdGFyZ2V0Lmxlbmd0aDtcblx0ICAgICAgICAgIHZhciBiZWdpbm5pbmdJbmRleGVzID0gZnV6enlzb3J0LnByZXBhcmVCZWdpbm5pbmdJbmRleGVzKHRhcmdldCk7XG5cdCAgICAgICAgICB2YXIgbmV4dEJlZ2lubmluZ0luZGV4ZXMgPSBbXTsgLy8gbmV3IEFycmF5KHRhcmdldExlbikgICAgIHNwYXJzZSBhcnJheSBpcyB0b28gc2xvd1xuXG5cdCAgICAgICAgICB2YXIgbGFzdElzQmVnaW5uaW5nID0gYmVnaW5uaW5nSW5kZXhlc1swXTtcblx0ICAgICAgICAgIHZhciBsYXN0SXNCZWdpbm5pbmdJID0gMDtcblxuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0YXJnZXRMZW47ICsraSkge1xuXHQgICAgICAgICAgICBpZiAobGFzdElzQmVnaW5uaW5nID4gaSkge1xuXHQgICAgICAgICAgICAgIG5leHRCZWdpbm5pbmdJbmRleGVzW2ldID0gbGFzdElzQmVnaW5uaW5nO1xuXHQgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgIGxhc3RJc0JlZ2lubmluZyA9IGJlZ2lubmluZ0luZGV4ZXNbKytsYXN0SXNCZWdpbm5pbmdJXTtcblx0ICAgICAgICAgICAgICBuZXh0QmVnaW5uaW5nSW5kZXhlc1tpXSA9IGxhc3RJc0JlZ2lubmluZyA9PT0gdW5kZWZpbmVkID8gdGFyZ2V0TGVuIDogbGFzdElzQmVnaW5uaW5nO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIHJldHVybiBuZXh0QmVnaW5uaW5nSW5kZXhlcztcblx0ICAgICAgICB9LFxuXHQgICAgICAgIGNsZWFudXA6IGNsZWFudXAsXG5cdCAgICAgICAgbmV3OiBmdXp6eXNvcnROZXdcblx0ICAgICAgfTtcblx0ICAgICAgcmV0dXJuIGZ1enp5c29ydDtcblx0ICAgIH0gLy8gZnV6enlzb3J0TmV3XG5cdCAgICAvLyBUaGlzIHN0dWZmIGlzIG91dHNpZGUgZnV6enlzb3J0TmV3LCBiZWNhdXNlIGl0J3Mgc2hhcmVkIHdpdGggaW5zdGFuY2VzIG9mIGZ1enp5c29ydC5uZXcoKVxuXG5cblx0ICAgIHZhciBpc05vZGUgPSB0eXBlb2YgY29tbW9uanNSZXF1aXJlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJzsgLy8gdmFyIE1BWF9JTlQgPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUlxuXHQgICAgLy8gdmFyIE1JTl9JTlQgPSBOdW1iZXIuTUlOX1ZBTFVFXG5cblx0ICAgIHZhciBwcmVwYXJlZENhY2hlID0gbmV3IE1hcCgpO1xuXHQgICAgdmFyIHByZXBhcmVkU2VhcmNoQ2FjaGUgPSBuZXcgTWFwKCk7XG5cdCAgICB2YXIgbm9SZXN1bHRzID0gW107XG5cdCAgICBub1Jlc3VsdHMudG90YWwgPSAwO1xuXHQgICAgdmFyIG1hdGNoZXNTaW1wbGUgPSBbXTtcblx0ICAgIHZhciBtYXRjaGVzU3RyaWN0ID0gW107XG5cblx0ICAgIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG5cdCAgICAgIHByZXBhcmVkQ2FjaGUuY2xlYXIoKTtcblx0ICAgICAgcHJlcGFyZWRTZWFyY2hDYWNoZS5jbGVhcigpO1xuXHQgICAgICBtYXRjaGVzU2ltcGxlID0gW107XG5cdCAgICAgIG1hdGNoZXNTdHJpY3QgPSBbXTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gZGVmYXVsdFNjb3JlRm4oYSkge1xuXHQgICAgICB2YXIgbWF4ID0gLTkwMDcxOTkyNTQ3NDA5OTE7XG5cblx0ICAgICAgZm9yICh2YXIgaSA9IGEubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcblx0ICAgICAgICB2YXIgcmVzdWx0ID0gYVtpXTtcblx0ICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKSBjb250aW51ZTtcblx0ICAgICAgICB2YXIgc2NvcmUgPSByZXN1bHQuc2NvcmU7XG5cdCAgICAgICAgaWYgKHNjb3JlID4gbWF4KSBtYXggPSBzY29yZTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChtYXggPT09IC05MDA3MTk5MjU0NzQwOTkxKSByZXR1cm4gbnVsbDtcblx0ICAgICAgcmV0dXJuIG1heDtcblx0ICAgIH0gLy8gcHJvcCA9ICdrZXknICAgICAgICAgICAgICAyLjVtcyBvcHRpbWl6ZWQgZm9yIHRoaXMgY2FzZSwgc2VlbXMgdG8gYmUgYWJvdXQgYXMgZmFzdCBhcyBkaXJlY3Qgb2JqW3Byb3BdXG5cdCAgICAvLyBwcm9wID0gJ2tleTEua2V5MicgICAgICAgIDEwbXNcblx0ICAgIC8vIHByb3AgPSBbJ2tleTEnLCAna2V5MiddICAgMjdtc1xuXG5cblx0ICAgIGZ1bmN0aW9uIGdldFZhbHVlKG9iaiwgcHJvcCkge1xuXHQgICAgICB2YXIgdG1wID0gb2JqW3Byb3BdO1xuXHQgICAgICBpZiAodG1wICE9PSB1bmRlZmluZWQpIHJldHVybiB0bXA7XG5cdCAgICAgIHZhciBzZWdzID0gcHJvcDtcblx0ICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByb3ApKSBzZWdzID0gcHJvcC5zcGxpdCgnLicpO1xuXHQgICAgICB2YXIgbGVuID0gc2Vncy5sZW5ndGg7XG5cdCAgICAgIHZhciBpID0gLTE7XG5cblx0ICAgICAgd2hpbGUgKG9iaiAmJiArK2kgPCBsZW4pIG9iaiA9IG9ialtzZWdzW2ldXTtcblxuXHQgICAgICByZXR1cm4gb2JqO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBpc09iaih4KSB7XG5cdCAgICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ29iamVjdCc7XG5cdCAgICB9IC8vIGZhc3RlciBhcyBhIGZ1bmN0aW9uXG5cdCAgICAvLyBIYWNrZWQgdmVyc2lvbiBvZiBodHRwczovL2dpdGh1Yi5jb20vbGVtaXJlL0Zhc3RQcmlvcml0eVF1ZXVlLmpzXG5cblxuXHQgICAgdmFyIGZhc3Rwcmlvcml0eXF1ZXVlID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICB2YXIgciA9IFtdLFxuXHQgICAgICAgICAgbyA9IDAsXG5cdCAgICAgICAgICBlID0ge307XG5cblx0ICAgICAgZnVuY3Rpb24gbigpIHtcblx0ICAgICAgICBmb3IgKHZhciBlID0gMCwgbiA9IHJbZV0sIGMgPSAxOyBjIDwgbzspIHtcblx0ICAgICAgICAgIHZhciBmID0gYyArIDE7XG5cdCAgICAgICAgICBlID0gYywgZiA8IG8gJiYgcltmXS5zY29yZSA8IHJbY10uc2NvcmUgJiYgKGUgPSBmKSwgcltlIC0gMSA+PiAxXSA9IHJbZV0sIGMgPSAxICsgKGUgPDwgMSk7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgZm9yICh2YXIgYSA9IGUgLSAxID4+IDE7IGUgPiAwICYmIG4uc2NvcmUgPCByW2FdLnNjb3JlOyBhID0gKGUgPSBhKSAtIDEgPj4gMSkgcltlXSA9IHJbYV07XG5cblx0ICAgICAgICByW2VdID0gbjtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBlLmFkZCA9IGZ1bmN0aW9uIChlKSB7XG5cdCAgICAgICAgdmFyIG4gPSBvO1xuXHQgICAgICAgIHJbbysrXSA9IGU7XG5cblx0ICAgICAgICBmb3IgKHZhciBjID0gbiAtIDEgPj4gMTsgbiA+IDAgJiYgZS5zY29yZSA8IHJbY10uc2NvcmU7IGMgPSAobiA9IGMpIC0gMSA+PiAxKSByW25dID0gcltjXTtcblxuXHQgICAgICAgIHJbbl0gPSBlO1xuXHQgICAgICB9LCBlLnBvbGwgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgaWYgKDAgIT09IG8pIHtcblx0ICAgICAgICAgIHZhciBlID0gclswXTtcblx0ICAgICAgICAgIHJldHVybiByWzBdID0gclstLW9dLCBuKCksIGU7XG5cdCAgICAgICAgfVxuXHQgICAgICB9LCBlLnBlZWsgPSBmdW5jdGlvbiAoZSkge1xuXHQgICAgICAgIGlmICgwICE9PSBvKSByZXR1cm4gclswXTtcblx0ICAgICAgfSwgZS5yZXBsYWNlVG9wID0gZnVuY3Rpb24gKG8pIHtcblx0ICAgICAgICByWzBdID0gbywgbigpO1xuXHQgICAgICB9LCBlO1xuXHQgICAgfTtcblxuXHQgICAgdmFyIHEgPSBmYXN0cHJpb3JpdHlxdWV1ZSgpOyAvLyByZXVzZSB0aGlzLCBleGNlcHQgZm9yIGFzeW5jLCBpdCBuZWVkcyB0byBtYWtlIGl0cyBvd25cblxuXHQgICAgcmV0dXJuIGZ1enp5c29ydE5ldygpO1xuXHQgIH0pOyAvLyBVTURcblx0ICAvLyBUT0RPOiAocGVyZm9ybWFuY2UpIHdhc20gdmVyc2lvbiE/XG5cdCAgLy8gVE9ETzogKHBlcmZvcm1hbmNlKSBsYXlvdXQgbWVtb3J5IGluIGFuIG9wdGltYWwgd2F5IHRvIGdvIGZhc3QgYnkgYXZvaWRpbmcgY2FjaGUgbWlzc2VzXG5cdCAgLy8gVE9ETzogKHBlcmZvcm1hbmNlKSBwcmVwYXJlZENhY2hlIGlzIGEgbWVtb3J5IGxlYWtcblx0ICAvLyBUT0RPOiAobGlrZSBzdWJsaW1lKSBiYWNrc2xhc2ggPT09IGZvcndhcmRzbGFzaFxuXHQgIC8vIFRPRE86IChwZXJmb3JtYW5jZSkgaSBoYXZlIG5vIGlkZWEgaG93IHdlbGwgb3B0aXptaWVkIHRoZSBhbGxvd2luZyB0eXBvcyBhbGdvcml0aG0gaXNcblxuXHR9KTtcblxuXHR2YXIgc3RhdHMgPSB7XG5cdCAgcGFzc2VkVGVzdHM6IDAsXG5cdCAgZmFpbGVkVGVzdHM6IDAsXG5cdCAgc2tpcHBlZFRlc3RzOiAwLFxuXHQgIHRvZG9UZXN0czogMFxuXHR9OyAvLyBFc2NhcGUgdGV4dCBmb3IgYXR0cmlidXRlIG9yIHRleHQgY29udGVudC5cblxuXHRmdW5jdGlvbiBlc2NhcGVUZXh0KHMpIHtcblx0ICBpZiAoIXMpIHtcblx0ICAgIHJldHVybiBcIlwiO1xuXHQgIH1cblxuXHQgIHMgPSBzICsgXCJcIjsgLy8gQm90aCBzaW5nbGUgcXVvdGVzIGFuZCBkb3VibGUgcXVvdGVzIChmb3IgYXR0cmlidXRlcylcblxuXHQgIHJldHVybiBzLnJlcGxhY2UoL1snXCI8PiZdL2csIGZ1bmN0aW9uIChzKSB7XG5cdCAgICBzd2l0Y2ggKHMpIHtcblx0ICAgICAgY2FzZSBcIidcIjpcblx0ICAgICAgICByZXR1cm4gXCImIzAzOTtcIjtcblxuXHQgICAgICBjYXNlIFwiXFxcIlwiOlxuXHQgICAgICAgIHJldHVybiBcIiZxdW90O1wiO1xuXG5cdCAgICAgIGNhc2UgXCI8XCI6XG5cdCAgICAgICAgcmV0dXJuIFwiJmx0O1wiO1xuXG5cdCAgICAgIGNhc2UgXCI+XCI6XG5cdCAgICAgICAgcmV0dXJuIFwiJmd0O1wiO1xuXG5cdCAgICAgIGNhc2UgXCImXCI6XG5cdCAgICAgICAgcmV0dXJuIFwiJmFtcDtcIjtcblx0ICAgIH1cblx0ICB9KTtcblx0fVxuXG5cdChmdW5jdGlvbiAoKSB7XG5cdCAgLy8gRG9uJ3QgbG9hZCB0aGUgSFRNTCBSZXBvcnRlciBvbiBub24tYnJvd3NlciBlbnZpcm9ubWVudHNcblx0ICBpZiAodHlwZW9mIHdpbmRvdyQxID09PSBcInVuZGVmaW5lZFwiIHx8ICF3aW5kb3ckMS5kb2N1bWVudCkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHZhciBjb25maWcgPSBRVW5pdC5jb25maWcsXG5cdCAgICAgIGhpZGRlblRlc3RzID0gW10sXG5cdCAgICAgIGRvY3VtZW50ID0gd2luZG93JDEuZG9jdW1lbnQsXG5cdCAgICAgIGNvbGxhcHNlTmV4dCA9IGZhbHNlLFxuXHQgICAgICBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LFxuXHQgICAgICB1bmZpbHRlcmVkVXJsID0gc2V0VXJsKHtcblx0ICAgIGZpbHRlcjogdW5kZWZpbmVkLFxuXHQgICAgbW9kdWxlOiB1bmRlZmluZWQsXG5cdCAgICBtb2R1bGVJZDogdW5kZWZpbmVkLFxuXHQgICAgdGVzdElkOiB1bmRlZmluZWRcblx0ICB9KSxcblx0ICAgICAgbW9kdWxlc0xpc3QgPSBbXTtcblxuXHQgIGZ1bmN0aW9uIGFkZEV2ZW50KGVsZW0sIHR5cGUsIGZuKSB7XG5cdCAgICBlbGVtLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZm4sIGZhbHNlKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiByZW1vdmVFdmVudChlbGVtLCB0eXBlLCBmbikge1xuXHQgICAgZWxlbS5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGZuLCBmYWxzZSk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYWRkRXZlbnRzKGVsZW1zLCB0eXBlLCBmbikge1xuXHQgICAgdmFyIGkgPSBlbGVtcy5sZW5ndGg7XG5cblx0ICAgIHdoaWxlIChpLS0pIHtcblx0ICAgICAgYWRkRXZlbnQoZWxlbXNbaV0sIHR5cGUsIGZuKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiBoYXNDbGFzcyhlbGVtLCBuYW1lKSB7XG5cdCAgICByZXR1cm4gKFwiIFwiICsgZWxlbS5jbGFzc05hbWUgKyBcIiBcIikuaW5kZXhPZihcIiBcIiArIG5hbWUgKyBcIiBcIikgPj0gMDtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhZGRDbGFzcyhlbGVtLCBuYW1lKSB7XG5cdCAgICBpZiAoIWhhc0NsYXNzKGVsZW0sIG5hbWUpKSB7XG5cdCAgICAgIGVsZW0uY2xhc3NOYW1lICs9IChlbGVtLmNsYXNzTmFtZSA/IFwiIFwiIDogXCJcIikgKyBuYW1lO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHRvZ2dsZUNsYXNzKGVsZW0sIG5hbWUsIGZvcmNlKSB7XG5cdCAgICBpZiAoZm9yY2UgfHwgdHlwZW9mIGZvcmNlID09PSBcInVuZGVmaW5lZFwiICYmICFoYXNDbGFzcyhlbGVtLCBuYW1lKSkge1xuXHQgICAgICBhZGRDbGFzcyhlbGVtLCBuYW1lKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHJlbW92ZUNsYXNzKGVsZW0sIG5hbWUpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHJlbW92ZUNsYXNzKGVsZW0sIG5hbWUpIHtcblx0ICAgIHZhciBzZXQgPSBcIiBcIiArIGVsZW0uY2xhc3NOYW1lICsgXCIgXCI7IC8vIENsYXNzIG5hbWUgbWF5IGFwcGVhciBtdWx0aXBsZSB0aW1lc1xuXG5cdCAgICB3aGlsZSAoc2V0LmluZGV4T2YoXCIgXCIgKyBuYW1lICsgXCIgXCIpID49IDApIHtcblx0ICAgICAgc2V0ID0gc2V0LnJlcGxhY2UoXCIgXCIgKyBuYW1lICsgXCIgXCIsIFwiIFwiKTtcblx0ICAgIH0gLy8gVHJpbSBmb3IgcHJldHRpbmVzc1xuXG5cblx0ICAgIGVsZW0uY2xhc3NOYW1lID0gdHlwZW9mIHNldC50cmltID09PSBcImZ1bmN0aW9uXCIgPyBzZXQudHJpbSgpIDogc2V0LnJlcGxhY2UoL15cXHMrfFxccyskL2csIFwiXCIpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGlkKG5hbWUpIHtcblx0ICAgIHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCAmJiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChuYW1lKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhYm9ydFRlc3RzKCkge1xuXHQgICAgdmFyIGFib3J0QnV0dG9uID0gaWQoXCJxdW5pdC1hYm9ydC10ZXN0cy1idXR0b25cIik7XG5cblx0ICAgIGlmIChhYm9ydEJ1dHRvbikge1xuXHQgICAgICBhYm9ydEJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG5cdCAgICAgIGFib3J0QnV0dG9uLmlubmVySFRNTCA9IFwiQWJvcnRpbmcuLi5cIjtcblx0ICAgIH1cblxuXHQgICAgUVVuaXQuY29uZmlnLnF1ZXVlLmxlbmd0aCA9IDA7XG5cdCAgICByZXR1cm4gZmFsc2U7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gaW50ZXJjZXB0TmF2aWdhdGlvbihldikge1xuXHQgICAgYXBwbHlVcmxQYXJhbXMoKTtcblxuXHQgICAgaWYgKGV2ICYmIGV2LnByZXZlbnREZWZhdWx0KSB7XG5cdCAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBmYWxzZTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBnZXRVcmxDb25maWdIdG1sKCkge1xuXHQgICAgdmFyIGksXG5cdCAgICAgICAgaixcblx0ICAgICAgICB2YWwsXG5cdCAgICAgICAgZXNjYXBlZCxcblx0ICAgICAgICBlc2NhcGVkVG9vbHRpcCxcblx0ICAgICAgICBzZWxlY3Rpb24gPSBmYWxzZSxcblx0ICAgICAgICB1cmxDb25maWcgPSBjb25maWcudXJsQ29uZmlnLFxuXHQgICAgICAgIHVybENvbmZpZ0h0bWwgPSBcIlwiO1xuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgdXJsQ29uZmlnLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIC8vIE9wdGlvbnMgY2FuIGJlIGVpdGhlciBzdHJpbmdzIG9yIG9iamVjdHMgd2l0aCBub25lbXB0eSBcImlkXCIgcHJvcGVydGllc1xuXHQgICAgICB2YWwgPSBjb25maWcudXJsQ29uZmlnW2ldO1xuXG5cdCAgICAgIGlmICh0eXBlb2YgdmFsID09PSBcInN0cmluZ1wiKSB7XG5cdCAgICAgICAgdmFsID0ge1xuXHQgICAgICAgICAgaWQ6IHZhbCxcblx0ICAgICAgICAgIGxhYmVsOiB2YWxcblx0ICAgICAgICB9O1xuXHQgICAgICB9XG5cblx0ICAgICAgZXNjYXBlZCA9IGVzY2FwZVRleHQodmFsLmlkKTtcblx0ICAgICAgZXNjYXBlZFRvb2x0aXAgPSBlc2NhcGVUZXh0KHZhbC50b29sdGlwKTtcblxuXHQgICAgICBpZiAoIXZhbC52YWx1ZSB8fCB0eXBlb2YgdmFsLnZhbHVlID09PSBcInN0cmluZ1wiKSB7XG5cdCAgICAgICAgdXJsQ29uZmlnSHRtbCArPSBcIjxsYWJlbCBmb3I9J3F1bml0LXVybGNvbmZpZy1cIiArIGVzY2FwZWQgKyBcIicgdGl0bGU9J1wiICsgZXNjYXBlZFRvb2x0aXAgKyBcIic+PGlucHV0IGlkPSdxdW5pdC11cmxjb25maWctXCIgKyBlc2NhcGVkICsgXCInIG5hbWU9J1wiICsgZXNjYXBlZCArIFwiJyB0eXBlPSdjaGVja2JveCdcIiArICh2YWwudmFsdWUgPyBcIiB2YWx1ZT0nXCIgKyBlc2NhcGVUZXh0KHZhbC52YWx1ZSkgKyBcIidcIiA6IFwiXCIpICsgKGNvbmZpZ1t2YWwuaWRdID8gXCIgY2hlY2tlZD0nY2hlY2tlZCdcIiA6IFwiXCIpICsgXCIgdGl0bGU9J1wiICsgZXNjYXBlZFRvb2x0aXAgKyBcIicgLz5cIiArIGVzY2FwZVRleHQodmFsLmxhYmVsKSArIFwiPC9sYWJlbD5cIjtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICB1cmxDb25maWdIdG1sICs9IFwiPGxhYmVsIGZvcj0ncXVuaXQtdXJsY29uZmlnLVwiICsgZXNjYXBlZCArIFwiJyB0aXRsZT0nXCIgKyBlc2NhcGVkVG9vbHRpcCArIFwiJz5cIiArIHZhbC5sYWJlbCArIFwiOiA8L2xhYmVsPjxzZWxlY3QgaWQ9J3F1bml0LXVybGNvbmZpZy1cIiArIGVzY2FwZWQgKyBcIicgbmFtZT0nXCIgKyBlc2NhcGVkICsgXCInIHRpdGxlPSdcIiArIGVzY2FwZWRUb29sdGlwICsgXCInPjxvcHRpb24+PC9vcHRpb24+XCI7XG5cblx0ICAgICAgICBpZiAoUVVuaXQuaXMoXCJhcnJheVwiLCB2YWwudmFsdWUpKSB7XG5cdCAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgdmFsLnZhbHVlLmxlbmd0aDsgaisrKSB7XG5cdCAgICAgICAgICAgIGVzY2FwZWQgPSBlc2NhcGVUZXh0KHZhbC52YWx1ZVtqXSk7XG5cdCAgICAgICAgICAgIHVybENvbmZpZ0h0bWwgKz0gXCI8b3B0aW9uIHZhbHVlPSdcIiArIGVzY2FwZWQgKyBcIidcIiArIChjb25maWdbdmFsLmlkXSA9PT0gdmFsLnZhbHVlW2pdID8gKHNlbGVjdGlvbiA9IHRydWUpICYmIFwiIHNlbGVjdGVkPSdzZWxlY3RlZCdcIiA6IFwiXCIpICsgXCI+XCIgKyBlc2NhcGVkICsgXCI8L29wdGlvbj5cIjtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgZm9yIChqIGluIHZhbC52YWx1ZSkge1xuXHQgICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwodmFsLnZhbHVlLCBqKSkge1xuXHQgICAgICAgICAgICAgIHVybENvbmZpZ0h0bWwgKz0gXCI8b3B0aW9uIHZhbHVlPSdcIiArIGVzY2FwZVRleHQoaikgKyBcIidcIiArIChjb25maWdbdmFsLmlkXSA9PT0gaiA/IChzZWxlY3Rpb24gPSB0cnVlKSAmJiBcIiBzZWxlY3RlZD0nc2VsZWN0ZWQnXCIgOiBcIlwiKSArIFwiPlwiICsgZXNjYXBlVGV4dCh2YWwudmFsdWVbal0pICsgXCI8L29wdGlvbj5cIjtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGlmIChjb25maWdbdmFsLmlkXSAmJiAhc2VsZWN0aW9uKSB7XG5cdCAgICAgICAgICBlc2NhcGVkID0gZXNjYXBlVGV4dChjb25maWdbdmFsLmlkXSk7XG5cdCAgICAgICAgICB1cmxDb25maWdIdG1sICs9IFwiPG9wdGlvbiB2YWx1ZT0nXCIgKyBlc2NhcGVkICsgXCInIHNlbGVjdGVkPSdzZWxlY3RlZCcgZGlzYWJsZWQ9J2Rpc2FibGVkJz5cIiArIGVzY2FwZWQgKyBcIjwvb3B0aW9uPlwiO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHVybENvbmZpZ0h0bWwgKz0gXCI8L3NlbGVjdD5cIjtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gdXJsQ29uZmlnSHRtbDtcblx0ICB9IC8vIEhhbmRsZSBcImNsaWNrXCIgZXZlbnRzIG9uIHRvb2xiYXIgY2hlY2tib3hlcyBhbmQgXCJjaGFuZ2VcIiBmb3Igc2VsZWN0IG1lbnVzLlxuXHQgIC8vIFVwZGF0ZXMgdGhlIFVSTCB3aXRoIHRoZSBuZXcgc3RhdGUgb2YgYGNvbmZpZy51cmxDb25maWdgIHZhbHVlcy5cblxuXG5cdCAgZnVuY3Rpb24gdG9vbGJhckNoYW5nZWQoKSB7XG5cdCAgICB2YXIgdXBkYXRlZFVybCxcblx0ICAgICAgICB2YWx1ZSxcblx0ICAgICAgICB0ZXN0cyxcblx0ICAgICAgICBmaWVsZCA9IHRoaXMsXG5cdCAgICAgICAgcGFyYW1zID0ge307IC8vIERldGVjdCBpZiBmaWVsZCBpcyBhIHNlbGVjdCBtZW51IG9yIGEgY2hlY2tib3hcblxuXHQgICAgaWYgKFwic2VsZWN0ZWRJbmRleFwiIGluIGZpZWxkKSB7XG5cdCAgICAgIHZhbHVlID0gZmllbGQub3B0aW9uc1tmaWVsZC5zZWxlY3RlZEluZGV4XS52YWx1ZSB8fCB1bmRlZmluZWQ7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB2YWx1ZSA9IGZpZWxkLmNoZWNrZWQgPyBmaWVsZC5kZWZhdWx0VmFsdWUgfHwgdHJ1ZSA6IHVuZGVmaW5lZDtcblx0ICAgIH1cblxuXHQgICAgcGFyYW1zW2ZpZWxkLm5hbWVdID0gdmFsdWU7XG5cdCAgICB1cGRhdGVkVXJsID0gc2V0VXJsKHBhcmFtcyk7IC8vIENoZWNrIGlmIHdlIGNhbiBhcHBseSB0aGUgY2hhbmdlIHdpdGhvdXQgYSBwYWdlIHJlZnJlc2hcblxuXHQgICAgaWYgKFwiaGlkZXBhc3NlZFwiID09PSBmaWVsZC5uYW1lICYmIFwicmVwbGFjZVN0YXRlXCIgaW4gd2luZG93JDEuaGlzdG9yeSkge1xuXHQgICAgICBRVW5pdC51cmxQYXJhbXNbZmllbGQubmFtZV0gPSB2YWx1ZTtcblx0ICAgICAgY29uZmlnW2ZpZWxkLm5hbWVdID0gdmFsdWUgfHwgZmFsc2U7XG5cdCAgICAgIHRlc3RzID0gaWQoXCJxdW5pdC10ZXN0c1wiKTtcblxuXHQgICAgICBpZiAodGVzdHMpIHtcblx0ICAgICAgICB2YXIgbGVuZ3RoID0gdGVzdHMuY2hpbGRyZW4ubGVuZ3RoO1xuXHQgICAgICAgIHZhciBjaGlsZHJlbiA9IHRlc3RzLmNoaWxkcmVuO1xuXG5cdCAgICAgICAgaWYgKGZpZWxkLmNoZWNrZWQpIHtcblx0ICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgICAgdmFyIHRlc3QgPSBjaGlsZHJlbltpXTtcblx0ICAgICAgICAgICAgdmFyIGNsYXNzTmFtZSA9IHRlc3QgPyB0ZXN0LmNsYXNzTmFtZSA6IFwiXCI7XG5cdCAgICAgICAgICAgIHZhciBjbGFzc05hbWVIYXNQYXNzID0gY2xhc3NOYW1lLmluZGV4T2YoXCJwYXNzXCIpID4gLTE7XG5cdCAgICAgICAgICAgIHZhciBjbGFzc05hbWVIYXNTa2lwcGVkID0gY2xhc3NOYW1lLmluZGV4T2YoXCJza2lwcGVkXCIpID4gLTE7XG5cblx0ICAgICAgICAgICAgaWYgKGNsYXNzTmFtZUhhc1Bhc3MgfHwgY2xhc3NOYW1lSGFzU2tpcHBlZCkge1xuXHQgICAgICAgICAgICAgIGhpZGRlblRlc3RzLnB1c2godGVzdCk7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgdmFyIF9pdGVyYXRvciA9IF9jcmVhdGVGb3JPZkl0ZXJhdG9ySGVscGVyKGhpZGRlblRlc3RzKSxcblx0ICAgICAgICAgICAgICBfc3RlcDtcblxuXHQgICAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgICAgZm9yIChfaXRlcmF0b3IucygpOyAhKF9zdGVwID0gX2l0ZXJhdG9yLm4oKSkuZG9uZTspIHtcblx0ICAgICAgICAgICAgICB2YXIgaGlkZGVuVGVzdCA9IF9zdGVwLnZhbHVlO1xuXHQgICAgICAgICAgICAgIHRlc3RzLnJlbW92ZUNoaWxkKGhpZGRlblRlc3QpO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcblx0ICAgICAgICAgICAgX2l0ZXJhdG9yLmUoZXJyKTtcblx0ICAgICAgICAgIH0gZmluYWxseSB7XG5cdCAgICAgICAgICAgIF9pdGVyYXRvci5mKCk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHdoaWxlICgodGVzdCA9IGhpZGRlblRlc3RzLnBvcCgpKSAhPSBudWxsKSB7XG5cdCAgICAgICAgICAgIHRlc3RzLmFwcGVuZENoaWxkKHRlc3QpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHdpbmRvdyQxLmhpc3RvcnkucmVwbGFjZVN0YXRlKG51bGwsIFwiXCIsIHVwZGF0ZWRVcmwpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgd2luZG93JDEubG9jYXRpb24gPSB1cGRhdGVkVXJsO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHNldFVybChwYXJhbXMpIHtcblx0ICAgIHZhciBrZXksXG5cdCAgICAgICAgYXJyVmFsdWUsXG5cdCAgICAgICAgaSxcblx0ICAgICAgICBxdWVyeXN0cmluZyA9IFwiP1wiLFxuXHQgICAgICAgIGxvY2F0aW9uID0gd2luZG93JDEubG9jYXRpb247XG5cdCAgICBwYXJhbXMgPSBRVW5pdC5leHRlbmQoUVVuaXQuZXh0ZW5kKHt9LCBRVW5pdC51cmxQYXJhbXMpLCBwYXJhbXMpO1xuXG5cdCAgICBmb3IgKGtleSBpbiBwYXJhbXMpIHtcblx0ICAgICAgLy8gU2tpcCBpbmhlcml0ZWQgb3IgdW5kZWZpbmVkIHByb3BlcnRpZXNcblx0ICAgICAgaWYgKGhhc093bi5jYWxsKHBhcmFtcywga2V5KSAmJiBwYXJhbXNba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG5cdCAgICAgICAgLy8gT3V0cHV0IGEgcGFyYW1ldGVyIGZvciBlYWNoIHZhbHVlIG9mIHRoaXMga2V5XG5cdCAgICAgICAgLy8gKGJ1dCB1c3VhbGx5IGp1c3Qgb25lKVxuXHQgICAgICAgIGFyclZhbHVlID0gW10uY29uY2F0KHBhcmFtc1trZXldKTtcblxuXHQgICAgICAgIGZvciAoaSA9IDA7IGkgPCBhcnJWYWx1ZS5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgcXVlcnlzdHJpbmcgKz0gZW5jb2RlVVJJQ29tcG9uZW50KGtleSk7XG5cblx0ICAgICAgICAgIGlmIChhcnJWYWx1ZVtpXSAhPT0gdHJ1ZSkge1xuXHQgICAgICAgICAgICBxdWVyeXN0cmluZyArPSBcIj1cIiArIGVuY29kZVVSSUNvbXBvbmVudChhcnJWYWx1ZVtpXSk7XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIHF1ZXJ5c3RyaW5nICs9IFwiJlwiO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gbG9jYXRpb24ucHJvdG9jb2wgKyBcIi8vXCIgKyBsb2NhdGlvbi5ob3N0ICsgbG9jYXRpb24ucGF0aG5hbWUgKyBxdWVyeXN0cmluZy5zbGljZSgwLCAtMSk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYXBwbHlVcmxQYXJhbXMoKSB7XG5cdCAgICB2YXIgaSxcblx0ICAgICAgICBzZWxlY3RlZE1vZHVsZXMgPSBbXSxcblx0ICAgICAgICBtb2R1bGVzTGlzdCA9IGlkKFwicXVuaXQtbW9kdWxlZmlsdGVyLWRyb3Bkb3duLWxpc3RcIikuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJpbnB1dFwiKSxcblx0ICAgICAgICBmaWx0ZXIgPSBpZChcInF1bml0LWZpbHRlci1pbnB1dFwiKS52YWx1ZTtcblxuXHQgICAgZm9yIChpID0gMDsgaSA8IG1vZHVsZXNMaXN0Lmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIGlmIChtb2R1bGVzTGlzdFtpXS5jaGVja2VkKSB7XG5cdCAgICAgICAgc2VsZWN0ZWRNb2R1bGVzLnB1c2gobW9kdWxlc0xpc3RbaV0udmFsdWUpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHdpbmRvdyQxLmxvY2F0aW9uID0gc2V0VXJsKHtcblx0ICAgICAgZmlsdGVyOiBmaWx0ZXIgPT09IFwiXCIgPyB1bmRlZmluZWQgOiBmaWx0ZXIsXG5cdCAgICAgIG1vZHVsZUlkOiBzZWxlY3RlZE1vZHVsZXMubGVuZ3RoID09PSAwID8gdW5kZWZpbmVkIDogc2VsZWN0ZWRNb2R1bGVzLFxuXHQgICAgICAvLyBSZW1vdmUgbW9kdWxlIGFuZCB0ZXN0SWQgZmlsdGVyXG5cdCAgICAgIG1vZHVsZTogdW5kZWZpbmVkLFxuXHQgICAgICB0ZXN0SWQ6IHVuZGVmaW5lZFxuXHQgICAgfSk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gdG9vbGJhclVybENvbmZpZ0NvbnRhaW5lcigpIHtcblx0ICAgIHZhciB1cmxDb25maWdDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0ICAgIHVybENvbmZpZ0NvbnRhaW5lci5pbm5lckhUTUwgPSBnZXRVcmxDb25maWdIdG1sKCk7XG5cdCAgICBhZGRDbGFzcyh1cmxDb25maWdDb250YWluZXIsIFwicXVuaXQtdXJsLWNvbmZpZ1wiKTtcblx0ICAgIGFkZEV2ZW50cyh1cmxDb25maWdDb250YWluZXIuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJpbnB1dFwiKSwgXCJjaGFuZ2VcIiwgdG9vbGJhckNoYW5nZWQpO1xuXHQgICAgYWRkRXZlbnRzKHVybENvbmZpZ0NvbnRhaW5lci5nZXRFbGVtZW50c0J5VGFnTmFtZShcInNlbGVjdFwiKSwgXCJjaGFuZ2VcIiwgdG9vbGJhckNoYW5nZWQpO1xuXHQgICAgcmV0dXJuIHVybENvbmZpZ0NvbnRhaW5lcjtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBhYm9ydFRlc3RzQnV0dG9uKCkge1xuXHQgICAgdmFyIGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG5cdCAgICBidXR0b24uaWQgPSBcInF1bml0LWFib3J0LXRlc3RzLWJ1dHRvblwiO1xuXHQgICAgYnV0dG9uLmlubmVySFRNTCA9IFwiQWJvcnRcIjtcblx0ICAgIGFkZEV2ZW50KGJ1dHRvbiwgXCJjbGlja1wiLCBhYm9ydFRlc3RzKTtcblx0ICAgIHJldHVybiBidXR0b247XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gdG9vbGJhckxvb3NlRmlsdGVyKCkge1xuXHQgICAgdmFyIGZpbHRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJmb3JtXCIpLFxuXHQgICAgICAgIGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxhYmVsXCIpLFxuXHQgICAgICAgIGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlucHV0XCIpLFxuXHQgICAgICAgIGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG5cdCAgICBhZGRDbGFzcyhmaWx0ZXIsIFwicXVuaXQtZmlsdGVyXCIpO1xuXHQgICAgbGFiZWwuaW5uZXJIVE1MID0gXCJGaWx0ZXI6IFwiO1xuXHQgICAgaW5wdXQudHlwZSA9IFwidGV4dFwiO1xuXHQgICAgaW5wdXQudmFsdWUgPSBjb25maWcuZmlsdGVyIHx8IFwiXCI7XG5cdCAgICBpbnB1dC5uYW1lID0gXCJmaWx0ZXJcIjtcblx0ICAgIGlucHV0LmlkID0gXCJxdW5pdC1maWx0ZXItaW5wdXRcIjtcblx0ICAgIGJ1dHRvbi5pbm5lckhUTUwgPSBcIkdvXCI7XG5cdCAgICBsYWJlbC5hcHBlbmRDaGlsZChpbnB1dCk7XG5cdCAgICBmaWx0ZXIuYXBwZW5kQ2hpbGQobGFiZWwpO1xuXHQgICAgZmlsdGVyLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiIFwiKSk7XG5cdCAgICBmaWx0ZXIuYXBwZW5kQ2hpbGQoYnV0dG9uKTtcblx0ICAgIGFkZEV2ZW50KGZpbHRlciwgXCJzdWJtaXRcIiwgaW50ZXJjZXB0TmF2aWdhdGlvbik7XG5cdCAgICByZXR1cm4gZmlsdGVyO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIG1vZHVsZUxpc3RIdG1sKG1vZHVsZXMpIHtcblx0ICAgIHZhciBpLFxuXHQgICAgICAgIGNoZWNrZWQsXG5cdCAgICAgICAgaHRtbCA9IFwiXCI7XG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCBtb2R1bGVzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIGlmIChtb2R1bGVzW2ldLm5hbWUgIT09IFwiXCIpIHtcblx0ICAgICAgICBjaGVja2VkID0gY29uZmlnLm1vZHVsZUlkLmluZGV4T2YobW9kdWxlc1tpXS5tb2R1bGVJZCkgPiAtMTtcblx0ICAgICAgICBodG1sICs9IFwiPGxpPjxsYWJlbCBjbGFzcz0nY2xpY2thYmxlXCIgKyAoY2hlY2tlZCA/IFwiIGNoZWNrZWRcIiA6IFwiXCIpICsgXCInPjxpbnB1dCB0eXBlPSdjaGVja2JveCcgXCIgKyBcInZhbHVlPSdcIiArIG1vZHVsZXNbaV0ubW9kdWxlSWQgKyBcIidcIiArIChjaGVja2VkID8gXCIgY2hlY2tlZD0nY2hlY2tlZCdcIiA6IFwiXCIpICsgXCIgLz5cIiArIGVzY2FwZVRleHQobW9kdWxlc1tpXS5uYW1lKSArIFwiPC9sYWJlbD48L2xpPlwiO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBodG1sO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHRvb2xiYXJNb2R1bGVGaWx0ZXIoKSB7XG5cdCAgICB2YXIgY29tbWl0LFxuXHQgICAgICAgIHJlc2V0LFxuXHQgICAgICAgIG1vZHVsZUZpbHRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJmb3JtXCIpLFxuXHQgICAgICAgIGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxhYmVsXCIpLFxuXHQgICAgICAgIG1vZHVsZVNlYXJjaCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKSxcblx0ICAgICAgICBkcm9wRG93biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiksXG5cdCAgICAgICAgYWN0aW9ucyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpLFxuXHQgICAgICAgIGFwcGx5QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKSxcblx0ICAgICAgICByZXNldEJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIiksXG5cdCAgICAgICAgYWxsTW9kdWxlc0xhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxhYmVsXCIpLFxuXHQgICAgICAgIGFsbENoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlucHV0XCIpLFxuXHQgICAgICAgIGRyb3BEb3duTGlzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ1bFwiKSxcblx0ICAgICAgICBkaXJ0eSA9IGZhbHNlO1xuXHQgICAgbW9kdWxlU2VhcmNoLmlkID0gXCJxdW5pdC1tb2R1bGVmaWx0ZXItc2VhcmNoXCI7XG5cdCAgICBtb2R1bGVTZWFyY2guYXV0b2NvbXBsZXRlID0gXCJvZmZcIjtcblx0ICAgIGFkZEV2ZW50KG1vZHVsZVNlYXJjaCwgXCJpbnB1dFwiLCBzZWFyY2hJbnB1dCk7XG5cdCAgICBhZGRFdmVudChtb2R1bGVTZWFyY2gsIFwiaW5wdXRcIiwgc2VhcmNoRm9jdXMpO1xuXHQgICAgYWRkRXZlbnQobW9kdWxlU2VhcmNoLCBcImZvY3VzXCIsIHNlYXJjaEZvY3VzKTtcblx0ICAgIGFkZEV2ZW50KG1vZHVsZVNlYXJjaCwgXCJjbGlja1wiLCBzZWFyY2hGb2N1cyk7XG5cdCAgICBjb25maWcubW9kdWxlcy5mb3JFYWNoKGZ1bmN0aW9uIChtb2R1bGUpIHtcblx0ICAgICAgcmV0dXJuIG1vZHVsZS5uYW1lUHJlcGFyZWQgPSBmdXp6eXNvcnQucHJlcGFyZShtb2R1bGUubmFtZSk7XG5cdCAgICB9KTtcblx0ICAgIGxhYmVsLmlkID0gXCJxdW5pdC1tb2R1bGVmaWx0ZXItc2VhcmNoLWNvbnRhaW5lclwiO1xuXHQgICAgbGFiZWwuaW5uZXJIVE1MID0gXCJNb2R1bGU6IFwiO1xuXHQgICAgbGFiZWwuYXBwZW5kQ2hpbGQobW9kdWxlU2VhcmNoKTtcblx0ICAgIGFwcGx5QnV0dG9uLnRleHRDb250ZW50ID0gXCJBcHBseVwiO1xuXHQgICAgYXBwbHlCdXR0b24uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHQgICAgcmVzZXRCdXR0b24udGV4dENvbnRlbnQgPSBcIlJlc2V0XCI7XG5cdCAgICByZXNldEJ1dHRvbi50eXBlID0gXCJyZXNldFwiO1xuXHQgICAgcmVzZXRCdXR0b24uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHQgICAgYWxsQ2hlY2tib3gudHlwZSA9IFwiY2hlY2tib3hcIjtcblx0ICAgIGFsbENoZWNrYm94LmNoZWNrZWQgPSBjb25maWcubW9kdWxlSWQubGVuZ3RoID09PSAwO1xuXHQgICAgYWxsTW9kdWxlc0xhYmVsLmNsYXNzTmFtZSA9IFwiY2xpY2thYmxlXCI7XG5cblx0ICAgIGlmIChjb25maWcubW9kdWxlSWQubGVuZ3RoKSB7XG5cdCAgICAgIGFsbE1vZHVsZXNMYWJlbC5jbGFzc05hbWUgPSBcImNoZWNrZWRcIjtcblx0ICAgIH1cblxuXHQgICAgYWxsTW9kdWxlc0xhYmVsLmFwcGVuZENoaWxkKGFsbENoZWNrYm94KTtcblx0ICAgIGFsbE1vZHVsZXNMYWJlbC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIkFsbCBtb2R1bGVzXCIpKTtcblx0ICAgIGFjdGlvbnMuaWQgPSBcInF1bml0LW1vZHVsZWZpbHRlci1hY3Rpb25zXCI7XG5cdCAgICBhY3Rpb25zLmFwcGVuZENoaWxkKGFwcGx5QnV0dG9uKTtcblx0ICAgIGFjdGlvbnMuYXBwZW5kQ2hpbGQocmVzZXRCdXR0b24pO1xuXHQgICAgYWN0aW9ucy5hcHBlbmRDaGlsZChhbGxNb2R1bGVzTGFiZWwpO1xuXHQgICAgY29tbWl0ID0gYWN0aW9ucy5maXJzdENoaWxkO1xuXHQgICAgcmVzZXQgPSBjb21taXQubmV4dFNpYmxpbmc7XG5cdCAgICBhZGRFdmVudChjb21taXQsIFwiY2xpY2tcIiwgYXBwbHlVcmxQYXJhbXMpO1xuXHQgICAgZHJvcERvd25MaXN0LmlkID0gXCJxdW5pdC1tb2R1bGVmaWx0ZXItZHJvcGRvd24tbGlzdFwiO1xuXHQgICAgZHJvcERvd25MaXN0LmlubmVySFRNTCA9IG1vZHVsZUxpc3RIdG1sKGNvbmZpZy5tb2R1bGVzKTtcblx0ICAgIGRyb3BEb3duLmlkID0gXCJxdW5pdC1tb2R1bGVmaWx0ZXItZHJvcGRvd25cIjtcblx0ICAgIGRyb3BEb3duLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0ICAgIGRyb3BEb3duLmFwcGVuZENoaWxkKGFjdGlvbnMpO1xuXHQgICAgZHJvcERvd24uYXBwZW5kQ2hpbGQoZHJvcERvd25MaXN0KTtcblx0ICAgIGFkZEV2ZW50KGRyb3BEb3duLCBcImNoYW5nZVwiLCBzZWxlY3Rpb25DaGFuZ2UpO1xuXHQgICAgc2VsZWN0aW9uQ2hhbmdlKCk7XG5cdCAgICBtb2R1bGVGaWx0ZXIuaWQgPSBcInF1bml0LW1vZHVsZWZpbHRlclwiO1xuXHQgICAgbW9kdWxlRmlsdGVyLmFwcGVuZENoaWxkKGxhYmVsKTtcblx0ICAgIG1vZHVsZUZpbHRlci5hcHBlbmRDaGlsZChkcm9wRG93bik7XG5cdCAgICBhZGRFdmVudChtb2R1bGVGaWx0ZXIsIFwic3VibWl0XCIsIGludGVyY2VwdE5hdmlnYXRpb24pO1xuXHQgICAgYWRkRXZlbnQobW9kdWxlRmlsdGVyLCBcInJlc2V0XCIsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgLy8gTGV0IHRoZSByZXNldCBoYXBwZW4sIHRoZW4gdXBkYXRlIHN0eWxlc1xuXHQgICAgICB3aW5kb3ckMS5zZXRUaW1lb3V0KHNlbGVjdGlvbkNoYW5nZSk7XG5cdCAgICB9KTsgLy8gRW5hYmxlcyBzaG93L2hpZGUgZm9yIHRoZSBkcm9wZG93blxuXG5cdCAgICBmdW5jdGlvbiBzZWFyY2hGb2N1cygpIHtcblx0ICAgICAgaWYgKGRyb3BEb3duLnN0eWxlLmRpc3BsYXkgIT09IFwibm9uZVwiKSB7XG5cdCAgICAgICAgcmV0dXJuO1xuXHQgICAgICB9XG5cblx0ICAgICAgZHJvcERvd24uc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcblx0ICAgICAgYWRkRXZlbnQoZG9jdW1lbnQsIFwiY2xpY2tcIiwgaGlkZUhhbmRsZXIpO1xuXHQgICAgICBhZGRFdmVudChkb2N1bWVudCwgXCJrZXlkb3duXCIsIGhpZGVIYW5kbGVyKTsgLy8gSGlkZSBvbiBFc2NhcGUga2V5ZG93biBvciBvdXRzaWRlLWNvbnRhaW5lciBjbGlja1xuXG5cdCAgICAgIGZ1bmN0aW9uIGhpZGVIYW5kbGVyKGUpIHtcblx0ICAgICAgICB2YXIgaW5Db250YWluZXIgPSBtb2R1bGVGaWx0ZXIuY29udGFpbnMoZS50YXJnZXQpO1xuXG5cdCAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMjcgfHwgIWluQ29udGFpbmVyKSB7XG5cdCAgICAgICAgICBpZiAoZS5rZXlDb2RlID09PSAyNyAmJiBpbkNvbnRhaW5lcikge1xuXHQgICAgICAgICAgICBtb2R1bGVTZWFyY2guZm9jdXMoKTtcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgZHJvcERvd24uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHQgICAgICAgICAgcmVtb3ZlRXZlbnQoZG9jdW1lbnQsIFwiY2xpY2tcIiwgaGlkZUhhbmRsZXIpO1xuXHQgICAgICAgICAgcmVtb3ZlRXZlbnQoZG9jdW1lbnQsIFwia2V5ZG93blwiLCBoaWRlSGFuZGxlcik7XG5cdCAgICAgICAgICBtb2R1bGVTZWFyY2gudmFsdWUgPSBcIlwiO1xuXHQgICAgICAgICAgc2VhcmNoSW5wdXQoKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gZmlsdGVyTW9kdWxlcyhzZWFyY2hUZXh0KSB7XG5cdCAgICAgIGlmIChzZWFyY2hUZXh0ID09PSBcIlwiKSB7XG5cdCAgICAgICAgcmV0dXJuIGNvbmZpZy5tb2R1bGVzO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIGZ1enp5c29ydC5nbyhzZWFyY2hUZXh0LCBjb25maWcubW9kdWxlcywge1xuXHQgICAgICAgIGtleTogXCJuYW1lUHJlcGFyZWRcIixcblx0ICAgICAgICB0aHJlc2hvbGQ6IC0xMDAwMFxuXHQgICAgICB9KS5tYXAoZnVuY3Rpb24gKG1vZHVsZSkge1xuXHQgICAgICAgIHJldHVybiBtb2R1bGUub2JqO1xuXHQgICAgICB9KTtcblx0ICAgIH0gLy8gUHJvY2Vzc2VzIG1vZHVsZSBzZWFyY2ggYm94IGlucHV0XG5cblxuXHQgICAgdmFyIHNlYXJjaElucHV0VGltZW91dDtcblxuXHQgICAgZnVuY3Rpb24gc2VhcmNoSW5wdXQoKSB7XG5cdCAgICAgIHdpbmRvdyQxLmNsZWFyVGltZW91dChzZWFyY2hJbnB1dFRpbWVvdXQpO1xuXHQgICAgICBzZWFyY2hJbnB1dFRpbWVvdXQgPSB3aW5kb3ckMS5zZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICB2YXIgc2VhcmNoVGV4dCA9IG1vZHVsZVNlYXJjaC52YWx1ZS50b0xvd2VyQ2FzZSgpLFxuXHQgICAgICAgICAgICBmaWx0ZXJlZE1vZHVsZXMgPSBmaWx0ZXJNb2R1bGVzKHNlYXJjaFRleHQpO1xuXHQgICAgICAgIGRyb3BEb3duTGlzdC5pbm5lckhUTUwgPSBtb2R1bGVMaXN0SHRtbChmaWx0ZXJlZE1vZHVsZXMpO1xuXHQgICAgICB9LCAyMDApO1xuXHQgICAgfSAvLyBQcm9jZXNzZXMgc2VsZWN0aW9uIGNoYW5nZXNcblxuXG5cdCAgICBmdW5jdGlvbiBzZWxlY3Rpb25DaGFuZ2UoZXZ0KSB7XG5cdCAgICAgIHZhciBpLFxuXHQgICAgICAgICAgaXRlbSxcblx0ICAgICAgICAgIGNoZWNrYm94ID0gZXZ0ICYmIGV2dC50YXJnZXQgfHwgYWxsQ2hlY2tib3gsXG5cdCAgICAgICAgICBtb2R1bGVzTGlzdCA9IGRyb3BEb3duTGlzdC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImlucHV0XCIpLFxuXHQgICAgICAgICAgc2VsZWN0ZWROYW1lcyA9IFtdO1xuXHQgICAgICB0b2dnbGVDbGFzcyhjaGVja2JveC5wYXJlbnROb2RlLCBcImNoZWNrZWRcIiwgY2hlY2tib3guY2hlY2tlZCk7XG5cdCAgICAgIGRpcnR5ID0gZmFsc2U7XG5cblx0ICAgICAgaWYgKGNoZWNrYm94LmNoZWNrZWQgJiYgY2hlY2tib3ggIT09IGFsbENoZWNrYm94KSB7XG5cdCAgICAgICAgYWxsQ2hlY2tib3guY2hlY2tlZCA9IGZhbHNlO1xuXHQgICAgICAgIHJlbW92ZUNsYXNzKGFsbENoZWNrYm94LnBhcmVudE5vZGUsIFwiY2hlY2tlZFwiKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGZvciAoaSA9IDA7IGkgPCBtb2R1bGVzTGlzdC5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgIGl0ZW0gPSBtb2R1bGVzTGlzdFtpXTtcblxuXHQgICAgICAgIGlmICghZXZ0KSB7XG5cdCAgICAgICAgICB0b2dnbGVDbGFzcyhpdGVtLnBhcmVudE5vZGUsIFwiY2hlY2tlZFwiLCBpdGVtLmNoZWNrZWQpO1xuXHQgICAgICAgIH0gZWxzZSBpZiAoY2hlY2tib3ggPT09IGFsbENoZWNrYm94ICYmIGNoZWNrYm94LmNoZWNrZWQpIHtcblx0ICAgICAgICAgIGl0ZW0uY2hlY2tlZCA9IGZhbHNlO1xuXHQgICAgICAgICAgcmVtb3ZlQ2xhc3MoaXRlbS5wYXJlbnROb2RlLCBcImNoZWNrZWRcIik7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgZGlydHkgPSBkaXJ0eSB8fCBpdGVtLmNoZWNrZWQgIT09IGl0ZW0uZGVmYXVsdENoZWNrZWQ7XG5cblx0ICAgICAgICBpZiAoaXRlbS5jaGVja2VkKSB7XG5cdCAgICAgICAgICBzZWxlY3RlZE5hbWVzLnB1c2goaXRlbS5wYXJlbnROb2RlLnRleHRDb250ZW50KTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBjb21taXQuc3R5bGUuZGlzcGxheSA9IHJlc2V0LnN0eWxlLmRpc3BsYXkgPSBkaXJ0eSA/IFwiXCIgOiBcIm5vbmVcIjtcblx0ICAgICAgbW9kdWxlU2VhcmNoLnBsYWNlaG9sZGVyID0gc2VsZWN0ZWROYW1lcy5qb2luKFwiLCBcIikgfHwgYWxsQ2hlY2tib3gucGFyZW50Tm9kZS50ZXh0Q29udGVudDtcblx0ICAgICAgbW9kdWxlU2VhcmNoLnRpdGxlID0gXCJUeXBlIHRvIGZpbHRlciBsaXN0LiBDdXJyZW50IHNlbGVjdGlvbjpcXG5cIiArIChzZWxlY3RlZE5hbWVzLmpvaW4oXCJcXG5cIikgfHwgYWxsQ2hlY2tib3gucGFyZW50Tm9kZS50ZXh0Q29udGVudCk7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBtb2R1bGVGaWx0ZXI7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gdG9vbGJhckZpbHRlcnMoKSB7XG5cdCAgICB2YXIgdG9vbGJhckZpbHRlcnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0ICAgIHRvb2xiYXJGaWx0ZXJzLmlkID0gXCJxdW5pdC10b29sYmFyLWZpbHRlcnNcIjtcblx0ICAgIHRvb2xiYXJGaWx0ZXJzLmFwcGVuZENoaWxkKHRvb2xiYXJMb29zZUZpbHRlcigpKTtcblx0ICAgIHRvb2xiYXJGaWx0ZXJzLmFwcGVuZENoaWxkKHRvb2xiYXJNb2R1bGVGaWx0ZXIoKSk7XG5cdCAgICByZXR1cm4gdG9vbGJhckZpbHRlcnM7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYXBwZW5kVG9vbGJhcigpIHtcblx0ICAgIHZhciB0b29sYmFyID0gaWQoXCJxdW5pdC10ZXN0cnVubmVyLXRvb2xiYXJcIik7XG5cblx0ICAgIGlmICh0b29sYmFyKSB7XG5cdCAgICAgIHRvb2xiYXIuYXBwZW5kQ2hpbGQodG9vbGJhclVybENvbmZpZ0NvbnRhaW5lcigpKTtcblx0ICAgICAgdG9vbGJhci5hcHBlbmRDaGlsZCh0b29sYmFyRmlsdGVycygpKTtcblx0ICAgICAgdG9vbGJhci5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpKS5jbGFzc05hbWUgPSBcImNsZWFyZml4XCI7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYXBwZW5kSGVhZGVyKCkge1xuXHQgICAgdmFyIGhlYWRlciA9IGlkKFwicXVuaXQtaGVhZGVyXCIpO1xuXG5cdCAgICBpZiAoaGVhZGVyKSB7XG5cdCAgICAgIGhlYWRlci5pbm5lckhUTUwgPSBcIjxhIGhyZWY9J1wiICsgZXNjYXBlVGV4dCh1bmZpbHRlcmVkVXJsKSArIFwiJz5cIiArIGhlYWRlci5pbm5lckhUTUwgKyBcIjwvYT4gXCI7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYXBwZW5kQmFubmVyKCkge1xuXHQgICAgdmFyIGJhbm5lciA9IGlkKFwicXVuaXQtYmFubmVyXCIpO1xuXG5cdCAgICBpZiAoYmFubmVyKSB7XG5cdCAgICAgIGJhbm5lci5jbGFzc05hbWUgPSBcIlwiO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFwcGVuZFRlc3RSZXN1bHRzKCkge1xuXHQgICAgdmFyIHRlc3RzID0gaWQoXCJxdW5pdC10ZXN0c1wiKSxcblx0ICAgICAgICByZXN1bHQgPSBpZChcInF1bml0LXRlc3RyZXN1bHRcIiksXG5cdCAgICAgICAgY29udHJvbHM7XG5cblx0ICAgIGlmIChyZXN1bHQpIHtcblx0ICAgICAgcmVzdWx0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQocmVzdWx0KTtcblx0ICAgIH1cblxuXHQgICAgaWYgKHRlc3RzKSB7XG5cdCAgICAgIHRlc3RzLmlubmVySFRNTCA9IFwiXCI7XG5cdCAgICAgIHJlc3VsdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJwXCIpO1xuXHQgICAgICByZXN1bHQuaWQgPSBcInF1bml0LXRlc3RyZXN1bHRcIjtcblx0ICAgICAgcmVzdWx0LmNsYXNzTmFtZSA9IFwicmVzdWx0XCI7XG5cdCAgICAgIHRlc3RzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlc3VsdCwgdGVzdHMpO1xuXHQgICAgICByZXN1bHQuaW5uZXJIVE1MID0gXCI8ZGl2IGlkPVxcXCJxdW5pdC10ZXN0cmVzdWx0LWRpc3BsYXlcXFwiPlJ1bm5pbmcuLi48YnIgLz4mIzE2MDs8L2Rpdj5cIiArIFwiPGRpdiBpZD1cXFwicXVuaXQtdGVzdHJlc3VsdC1jb250cm9sc1xcXCI+PC9kaXY+XCIgKyBcIjxkaXYgY2xhc3M9XFxcImNsZWFyZml4XFxcIj48L2Rpdj5cIjtcblx0ICAgICAgY29udHJvbHMgPSBpZChcInF1bml0LXRlc3RyZXN1bHQtY29udHJvbHNcIik7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjb250cm9scykge1xuXHQgICAgICBjb250cm9scy5hcHBlbmRDaGlsZChhYm9ydFRlc3RzQnV0dG9uKCkpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFwcGVuZEZpbHRlcmVkVGVzdCgpIHtcblx0ICAgIHZhciB0ZXN0SWQgPSBRVW5pdC5jb25maWcudGVzdElkO1xuXG5cdCAgICBpZiAoIXRlc3RJZCB8fCB0ZXN0SWQubGVuZ3RoIDw9IDApIHtcblx0ICAgICAgcmV0dXJuIFwiXCI7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBcIjxkaXYgaWQ9J3F1bml0LWZpbHRlcmVkVGVzdCc+UmVydW5uaW5nIHNlbGVjdGVkIHRlc3RzOiBcIiArIGVzY2FwZVRleHQodGVzdElkLmpvaW4oXCIsIFwiKSkgKyBcIiA8YSBpZD0ncXVuaXQtY2xlYXJGaWx0ZXInIGhyZWY9J1wiICsgZXNjYXBlVGV4dCh1bmZpbHRlcmVkVXJsKSArIFwiJz5SdW4gYWxsIHRlc3RzPC9hPjwvZGl2PlwiO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFwcGVuZFVzZXJBZ2VudCgpIHtcblx0ICAgIHZhciB1c2VyQWdlbnQgPSBpZChcInF1bml0LXVzZXJBZ2VudFwiKTtcblxuXHQgICAgaWYgKHVzZXJBZ2VudCkge1xuXHQgICAgICB1c2VyQWdlbnQuaW5uZXJIVE1MID0gXCJcIjtcblx0ICAgICAgdXNlckFnZW50LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiUVVuaXQgXCIgKyBRVW5pdC52ZXJzaW9uICsgXCI7IFwiICsgbmF2aWdhdG9yLnVzZXJBZ2VudCkpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGFwcGVuZEludGVyZmFjZSgpIHtcblx0ICAgIHZhciBxdW5pdCA9IGlkKFwicXVuaXRcIik7IC8vIEZvciBjb21wYXQgd2l0aCBRVW5pdCAxLjIsIGFuZCB0byBzdXBwb3J0IGZ1bGx5IGN1c3RvbSB0aGVtZSBIVE1MLFxuXHQgICAgLy8gd2Ugd2lsbCB1c2UgYW55IGV4aXN0aW5nIGVsZW1lbnRzIGlmIG5vIGlkPVwicXVuaXRcIiBlbGVtZW50IGV4aXN0cy5cblx0ICAgIC8vXG5cdCAgICAvLyBOb3RlIHRoYXQgd2UgZG9uJ3QgZmFpbCBvciBmYWxsYmFjayB0byBjcmVhdGluZyBpdCBvdXJzZWx2ZXMsXG5cdCAgICAvLyBiZWNhdXNlIG5vdCBoYXZpbmcgaWQ9XCJxdW5pdFwiIChhbmQgbm90IGhhdmluZyB0aGUgYmVsb3cgZWxlbWVudHMpXG5cdCAgICAvLyBzaW1wbHkgbWVhbnMgUVVuaXQgYWN0cyBoZWFkbGVzcywgYWxsb3dpbmcgdXNlcnMgdG8gdXNlIHRoZWlyIG93blxuXHQgICAgLy8gcmVwb3J0ZXJzLCBvciBmb3IgYSB0ZXN0IHJ1bm5lciB0byBsaXN0ZW4gZm9yIGV2ZW50cyBkaXJlY3RseSB3aXRob3V0XG5cdCAgICAvLyBoYXZpbmcgdGhlIEhUTUwgcmVwb3J0ZXIgYWN0aXZlbHkgcmVuZGVyIGFueXRoaW5nLlxuXG5cdCAgICBpZiAocXVuaXQpIHtcblx0ICAgICAgLy8gU2luY2UgUVVuaXQgMS4zLCB0aGVzZSBhcmUgY3JlYXRlZCBhdXRvbWF0aWNhbGx5IGlmIHRoZSBwYWdlXG5cdCAgICAgIC8vIGNvbnRhaW5zIGlkPVwicXVuaXRcIi5cblx0ICAgICAgcXVuaXQuaW5uZXJIVE1MID0gXCI8aDEgaWQ9J3F1bml0LWhlYWRlcic+XCIgKyBlc2NhcGVUZXh0KGRvY3VtZW50LnRpdGxlKSArIFwiPC9oMT5cIiArIFwiPGgyIGlkPSdxdW5pdC1iYW5uZXInPjwvaDI+XCIgKyBcIjxkaXYgaWQ9J3F1bml0LXRlc3RydW5uZXItdG9vbGJhcic+PC9kaXY+XCIgKyBhcHBlbmRGaWx0ZXJlZFRlc3QoKSArIFwiPGgyIGlkPSdxdW5pdC11c2VyQWdlbnQnPjwvaDI+XCIgKyBcIjxvbCBpZD0ncXVuaXQtdGVzdHMnPjwvb2w+XCI7XG5cdCAgICB9XG5cblx0ICAgIGFwcGVuZEhlYWRlcigpO1xuXHQgICAgYXBwZW5kQmFubmVyKCk7XG5cdCAgICBhcHBlbmRUZXN0UmVzdWx0cygpO1xuXHQgICAgYXBwZW5kVXNlckFnZW50KCk7XG5cdCAgICBhcHBlbmRUb29sYmFyKCk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gYXBwZW5kVGVzdChuYW1lLCB0ZXN0SWQsIG1vZHVsZU5hbWUpIHtcblx0ICAgIHZhciB0aXRsZSxcblx0ICAgICAgICByZXJ1blRyaWdnZXIsXG5cdCAgICAgICAgdGVzdEJsb2NrLFxuXHQgICAgICAgIGFzc2VydExpc3QsXG5cdCAgICAgICAgdGVzdHMgPSBpZChcInF1bml0LXRlc3RzXCIpO1xuXG5cdCAgICBpZiAoIXRlc3RzKSB7XG5cdCAgICAgIHJldHVybjtcblx0ICAgIH1cblxuXHQgICAgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3Ryb25nXCIpO1xuXHQgICAgdGl0bGUuaW5uZXJIVE1MID0gZ2V0TmFtZUh0bWwobmFtZSwgbW9kdWxlTmFtZSk7XG5cdCAgICByZXJ1blRyaWdnZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcblx0ICAgIHJlcnVuVHJpZ2dlci5pbm5lckhUTUwgPSBcIlJlcnVuXCI7XG5cdCAgICByZXJ1blRyaWdnZXIuaHJlZiA9IHNldFVybCh7XG5cdCAgICAgIHRlc3RJZDogdGVzdElkXG5cdCAgICB9KTtcblx0ICAgIHRlc3RCbG9jayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcblx0ICAgIHRlc3RCbG9jay5hcHBlbmRDaGlsZCh0aXRsZSk7XG5cdCAgICB0ZXN0QmxvY2suYXBwZW5kQ2hpbGQocmVydW5UcmlnZ2VyKTtcblx0ICAgIHRlc3RCbG9jay5pZCA9IFwicXVuaXQtdGVzdC1vdXRwdXQtXCIgKyB0ZXN0SWQ7XG5cdCAgICBhc3NlcnRMaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIm9sXCIpO1xuXHQgICAgYXNzZXJ0TGlzdC5jbGFzc05hbWUgPSBcInF1bml0LWFzc2VydC1saXN0XCI7XG5cdCAgICB0ZXN0QmxvY2suYXBwZW5kQ2hpbGQoYXNzZXJ0TGlzdCk7XG5cdCAgICB0ZXN0cy5hcHBlbmRDaGlsZCh0ZXN0QmxvY2spO1xuXHQgIH0gLy8gSFRNTCBSZXBvcnRlciBpbml0aWFsaXphdGlvbiBhbmQgbG9hZFxuXG5cblx0ICBRVW5pdC5iZWdpbihmdW5jdGlvbiAoZGV0YWlscykge1xuXHQgICAgdmFyIGksIG1vZHVsZU9iajsgLy8gU29ydCBtb2R1bGVzIGJ5IG5hbWUgZm9yIHRoZSBwaWNrZXJcblxuXHQgICAgZm9yIChpID0gMDsgaSA8IGRldGFpbHMubW9kdWxlcy5sZW5ndGg7IGkrKykge1xuXHQgICAgICBtb2R1bGVPYmogPSBkZXRhaWxzLm1vZHVsZXNbaV07XG5cblx0ICAgICAgaWYgKG1vZHVsZU9iai5uYW1lKSB7XG5cdCAgICAgICAgbW9kdWxlc0xpc3QucHVzaChtb2R1bGVPYmoubmFtZSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgbW9kdWxlc0xpc3Quc29ydChmdW5jdGlvbiAoYSwgYikge1xuXHQgICAgICByZXR1cm4gYS5sb2NhbGVDb21wYXJlKGIpO1xuXHQgICAgfSk7IC8vIEluaXRpYWxpemUgUVVuaXQgZWxlbWVudHNcblxuXHQgICAgYXBwZW5kSW50ZXJmYWNlKCk7XG5cdCAgfSk7XG5cdCAgUVVuaXQuZG9uZShmdW5jdGlvbiAoZGV0YWlscykge1xuXHQgICAgdmFyIGJhbm5lciA9IGlkKFwicXVuaXQtYmFubmVyXCIpLFxuXHQgICAgICAgIHRlc3RzID0gaWQoXCJxdW5pdC10ZXN0c1wiKSxcblx0ICAgICAgICBhYm9ydEJ1dHRvbiA9IGlkKFwicXVuaXQtYWJvcnQtdGVzdHMtYnV0dG9uXCIpLFxuXHQgICAgICAgIHRvdGFsVGVzdHMgPSBzdGF0cy5wYXNzZWRUZXN0cyArIHN0YXRzLnNraXBwZWRUZXN0cyArIHN0YXRzLnRvZG9UZXN0cyArIHN0YXRzLmZhaWxlZFRlc3RzLFxuXHQgICAgICAgIGh0bWwgPSBbdG90YWxUZXN0cywgXCIgdGVzdHMgY29tcGxldGVkIGluIFwiLCBkZXRhaWxzLnJ1bnRpbWUsIFwiIG1pbGxpc2Vjb25kcywgd2l0aCBcIiwgc3RhdHMuZmFpbGVkVGVzdHMsIFwiIGZhaWxlZCwgXCIsIHN0YXRzLnNraXBwZWRUZXN0cywgXCIgc2tpcHBlZCwgYW5kIFwiLCBzdGF0cy50b2RvVGVzdHMsIFwiIHRvZG8uPGJyIC8+XCIsIFwiPHNwYW4gY2xhc3M9J3Bhc3NlZCc+XCIsIGRldGFpbHMucGFzc2VkLCBcIjwvc3Bhbj4gYXNzZXJ0aW9ucyBvZiA8c3BhbiBjbGFzcz0ndG90YWwnPlwiLCBkZXRhaWxzLnRvdGFsLCBcIjwvc3Bhbj4gcGFzc2VkLCA8c3BhbiBjbGFzcz0nZmFpbGVkJz5cIiwgZGV0YWlscy5mYWlsZWQsIFwiPC9zcGFuPiBmYWlsZWQuXCJdLmpvaW4oXCJcIiksXG5cdCAgICAgICAgdGVzdCxcblx0ICAgICAgICBhc3NlcnRMaSxcblx0ICAgICAgICBhc3NlcnRMaXN0OyAvLyBVcGRhdGUgcmVtYWluaW5nIHRlc3RzIHRvIGFib3J0ZWRcblxuXHQgICAgaWYgKGFib3J0QnV0dG9uICYmIGFib3J0QnV0dG9uLmRpc2FibGVkKSB7XG5cdCAgICAgIGh0bWwgPSBcIlRlc3RzIGFib3J0ZWQgYWZ0ZXIgXCIgKyBkZXRhaWxzLnJ1bnRpbWUgKyBcIiBtaWxsaXNlY29uZHMuXCI7XG5cblx0ICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0ZXN0cy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgIHRlc3QgPSB0ZXN0cy5jaGlsZHJlbltpXTtcblxuXHQgICAgICAgIGlmICh0ZXN0LmNsYXNzTmFtZSA9PT0gXCJcIiB8fCB0ZXN0LmNsYXNzTmFtZSA9PT0gXCJydW5uaW5nXCIpIHtcblx0ICAgICAgICAgIHRlc3QuY2xhc3NOYW1lID0gXCJhYm9ydGVkXCI7XG5cdCAgICAgICAgICBhc3NlcnRMaXN0ID0gdGVzdC5nZXRFbGVtZW50c0J5VGFnTmFtZShcIm9sXCIpWzBdO1xuXHQgICAgICAgICAgYXNzZXJ0TGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG5cdCAgICAgICAgICBhc3NlcnRMaS5jbGFzc05hbWUgPSBcImZhaWxcIjtcblx0ICAgICAgICAgIGFzc2VydExpLmlubmVySFRNTCA9IFwiVGVzdCBhYm9ydGVkLlwiO1xuXHQgICAgICAgICAgYXNzZXJ0TGlzdC5hcHBlbmRDaGlsZChhc3NlcnRMaSk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGlmIChiYW5uZXIgJiYgKCFhYm9ydEJ1dHRvbiB8fCBhYm9ydEJ1dHRvbi5kaXNhYmxlZCA9PT0gZmFsc2UpKSB7XG5cdCAgICAgIGJhbm5lci5jbGFzc05hbWUgPSBzdGF0cy5mYWlsZWRUZXN0cyA/IFwicXVuaXQtZmFpbFwiIDogXCJxdW5pdC1wYXNzXCI7XG5cdCAgICB9XG5cblx0ICAgIGlmIChhYm9ydEJ1dHRvbikge1xuXHQgICAgICBhYm9ydEJ1dHRvbi5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFib3J0QnV0dG9uKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKHRlc3RzKSB7XG5cdCAgICAgIGlkKFwicXVuaXQtdGVzdHJlc3VsdC1kaXNwbGF5XCIpLmlubmVySFRNTCA9IGh0bWw7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjb25maWcuYWx0ZXJ0aXRsZSAmJiBkb2N1bWVudC50aXRsZSkge1xuXHQgICAgICAvLyBTaG93IOKcliBmb3IgZ29vZCwg4pyUIGZvciBiYWQgc3VpdGUgcmVzdWx0IGluIHRpdGxlXG5cdCAgICAgIC8vIHVzZSBlc2NhcGUgc2VxdWVuY2VzIGluIGNhc2UgZmlsZSBnZXRzIGxvYWRlZCB3aXRoIG5vbi11dGYtOFxuXHQgICAgICAvLyBjaGFyc2V0XG5cdCAgICAgIGRvY3VtZW50LnRpdGxlID0gW3N0YXRzLmZhaWxlZFRlc3RzID8gXCJcXHUyNzE2XCIgOiBcIlxcdTI3MTRcIiwgZG9jdW1lbnQudGl0bGUucmVwbGFjZSgvXltcXHUyNzE0XFx1MjcxNl0gL2ksIFwiXCIpXS5qb2luKFwiIFwiKTtcblx0ICAgIH0gLy8gU2Nyb2xsIGJhY2sgdG8gdG9wIHRvIHNob3cgcmVzdWx0c1xuXG5cblx0ICAgIGlmIChjb25maWcuc2Nyb2xsdG9wICYmIHdpbmRvdyQxLnNjcm9sbFRvKSB7XG5cdCAgICAgIHdpbmRvdyQxLnNjcm9sbFRvKDAsIDApO1xuXHQgICAgfVxuXHQgIH0pO1xuXG5cdCAgZnVuY3Rpb24gZ2V0TmFtZUh0bWwobmFtZSwgbW9kdWxlKSB7XG5cdCAgICB2YXIgbmFtZUh0bWwgPSBcIlwiO1xuXG5cdCAgICBpZiAobW9kdWxlKSB7XG5cdCAgICAgIG5hbWVIdG1sID0gXCI8c3BhbiBjbGFzcz0nbW9kdWxlLW5hbWUnPlwiICsgZXNjYXBlVGV4dChtb2R1bGUpICsgXCI8L3NwYW4+OiBcIjtcblx0ICAgIH1cblxuXHQgICAgbmFtZUh0bWwgKz0gXCI8c3BhbiBjbGFzcz0ndGVzdC1uYW1lJz5cIiArIGVzY2FwZVRleHQobmFtZSkgKyBcIjwvc3Bhbj5cIjtcblx0ICAgIHJldHVybiBuYW1lSHRtbDtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBnZXRQcm9ncmVzc0h0bWwocnVudGltZSwgc3RhdHMsIHRvdGFsKSB7XG5cdCAgICB2YXIgY29tcGxldGVkID0gc3RhdHMucGFzc2VkVGVzdHMgKyBzdGF0cy5za2lwcGVkVGVzdHMgKyBzdGF0cy50b2RvVGVzdHMgKyBzdGF0cy5mYWlsZWRUZXN0cztcblx0ICAgIHJldHVybiBbXCI8YnIgLz5cIiwgY29tcGxldGVkLCBcIiAvIFwiLCB0b3RhbCwgXCIgdGVzdHMgY29tcGxldGVkIGluIFwiLCBydW50aW1lLCBcIiBtaWxsaXNlY29uZHMsIHdpdGggXCIsIHN0YXRzLmZhaWxlZFRlc3RzLCBcIiBmYWlsZWQsIFwiLCBzdGF0cy5za2lwcGVkVGVzdHMsIFwiIHNraXBwZWQsIGFuZCBcIiwgc3RhdHMudG9kb1Rlc3RzLCBcIiB0b2RvLlwiXS5qb2luKFwiXCIpO1xuXHQgIH1cblxuXHQgIFFVbml0LnRlc3RTdGFydChmdW5jdGlvbiAoZGV0YWlscykge1xuXHQgICAgdmFyIHJ1bm5pbmcsIGJhZDtcblx0ICAgIGFwcGVuZFRlc3QoZGV0YWlscy5uYW1lLCBkZXRhaWxzLnRlc3RJZCwgZGV0YWlscy5tb2R1bGUpO1xuXHQgICAgcnVubmluZyA9IGlkKFwicXVuaXQtdGVzdHJlc3VsdC1kaXNwbGF5XCIpO1xuXG5cdCAgICBpZiAocnVubmluZykge1xuXHQgICAgICBhZGRDbGFzcyhydW5uaW5nLCBcInJ1bm5pbmdcIik7XG5cdCAgICAgIGJhZCA9IFFVbml0LmNvbmZpZy5yZW9yZGVyICYmIGRldGFpbHMucHJldmlvdXNGYWlsdXJlO1xuXHQgICAgICBydW5uaW5nLmlubmVySFRNTCA9IFtiYWQgPyBcIlJlcnVubmluZyBwcmV2aW91c2x5IGZhaWxlZCB0ZXN0OiA8YnIgLz5cIiA6IFwiUnVubmluZzogPGJyIC8+XCIsIGdldE5hbWVIdG1sKGRldGFpbHMubmFtZSwgZGV0YWlscy5tb2R1bGUpLCBnZXRQcm9ncmVzc0h0bWwobm93KCkgLSBjb25maWcuc3RhcnRlZCwgc3RhdHMsIFRlc3QuY291bnQpXS5qb2luKFwiXCIpO1xuXHQgICAgfVxuXHQgIH0pO1xuXG5cdCAgZnVuY3Rpb24gc3RyaXBIdG1sKHN0cmluZykge1xuXHQgICAgLy8gU3RyaXAgdGFncywgaHRtbCBlbnRpdHkgYW5kIHdoaXRlc3BhY2VzXG5cdCAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoLzxcXC8/W14+XSsoPnwkKS9nLCBcIlwiKS5yZXBsYWNlKC8mcXVvdDsvZywgXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIlwiKTtcblx0ICB9XG5cblx0ICBRVW5pdC5sb2coZnVuY3Rpb24gKGRldGFpbHMpIHtcblx0ICAgIHZhciBhc3NlcnRMaXN0LFxuXHQgICAgICAgIGFzc2VydExpLFxuXHQgICAgICAgIG1lc3NhZ2UsXG5cdCAgICAgICAgZXhwZWN0ZWQsXG5cdCAgICAgICAgYWN0dWFsLFxuXHQgICAgICAgIGRpZmYsXG5cdCAgICAgICAgc2hvd0RpZmYgPSBmYWxzZSxcblx0ICAgICAgICB0ZXN0SXRlbSA9IGlkKFwicXVuaXQtdGVzdC1vdXRwdXQtXCIgKyBkZXRhaWxzLnRlc3RJZCk7XG5cblx0ICAgIGlmICghdGVzdEl0ZW0pIHtcblx0ICAgICAgcmV0dXJuO1xuXHQgICAgfVxuXG5cdCAgICBtZXNzYWdlID0gZXNjYXBlVGV4dChkZXRhaWxzLm1lc3NhZ2UpIHx8IChkZXRhaWxzLnJlc3VsdCA/IFwib2theVwiIDogXCJmYWlsZWRcIik7XG5cdCAgICBtZXNzYWdlID0gXCI8c3BhbiBjbGFzcz0ndGVzdC1tZXNzYWdlJz5cIiArIG1lc3NhZ2UgKyBcIjwvc3Bhbj5cIjtcblx0ICAgIG1lc3NhZ2UgKz0gXCI8c3BhbiBjbGFzcz0ncnVudGltZSc+QCBcIiArIGRldGFpbHMucnVudGltZSArIFwiIG1zPC9zcGFuPlwiOyAvLyBUaGUgcHVzaEZhaWx1cmUgZG9lc24ndCBwcm92aWRlIGRldGFpbHMuZXhwZWN0ZWRcblx0ICAgIC8vIHdoZW4gaXQgY2FsbHMsIGl0J3MgaW1wbGljaXQgdG8gYWxzbyBub3Qgc2hvdyBleHBlY3RlZCBhbmQgZGlmZiBzdHVmZlxuXHQgICAgLy8gQWxzbywgd2UgbmVlZCB0byBjaGVjayBkZXRhaWxzLmV4cGVjdGVkIGV4aXN0ZW5jZSwgYXMgaXQgY2FuIGV4aXN0IGFuZCBiZSB1bmRlZmluZWRcblxuXHQgICAgaWYgKCFkZXRhaWxzLnJlc3VsdCAmJiBoYXNPd24uY2FsbChkZXRhaWxzLCBcImV4cGVjdGVkXCIpKSB7XG5cdCAgICAgIGlmIChkZXRhaWxzLm5lZ2F0aXZlKSB7XG5cdCAgICAgICAgZXhwZWN0ZWQgPSBcIk5PVCBcIiArIFFVbml0LmR1bXAucGFyc2UoZGV0YWlscy5leHBlY3RlZCk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgZXhwZWN0ZWQgPSBRVW5pdC5kdW1wLnBhcnNlKGRldGFpbHMuZXhwZWN0ZWQpO1xuXHQgICAgICB9XG5cblx0ICAgICAgYWN0dWFsID0gUVVuaXQuZHVtcC5wYXJzZShkZXRhaWxzLmFjdHVhbCk7XG5cdCAgICAgIG1lc3NhZ2UgKz0gXCI8dGFibGU+PHRyIGNsYXNzPSd0ZXN0LWV4cGVjdGVkJz48dGg+RXhwZWN0ZWQ6IDwvdGg+PHRkPjxwcmU+XCIgKyBlc2NhcGVUZXh0KGV4cGVjdGVkKSArIFwiPC9wcmU+PC90ZD48L3RyPlwiO1xuXG5cdCAgICAgIGlmIChhY3R1YWwgIT09IGV4cGVjdGVkKSB7XG5cdCAgICAgICAgbWVzc2FnZSArPSBcIjx0ciBjbGFzcz0ndGVzdC1hY3R1YWwnPjx0aD5SZXN1bHQ6IDwvdGg+PHRkPjxwcmU+XCIgKyBlc2NhcGVUZXh0KGFjdHVhbCkgKyBcIjwvcHJlPjwvdGQ+PC90cj5cIjtcblxuXHQgICAgICAgIGlmICh0eXBlb2YgZGV0YWlscy5hY3R1YWwgPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mIGRldGFpbHMuZXhwZWN0ZWQgPT09IFwibnVtYmVyXCIpIHtcblx0ICAgICAgICAgIGlmICghaXNOYU4oZGV0YWlscy5hY3R1YWwpICYmICFpc05hTihkZXRhaWxzLmV4cGVjdGVkKSkge1xuXHQgICAgICAgICAgICBzaG93RGlmZiA9IHRydWU7XG5cdCAgICAgICAgICAgIGRpZmYgPSBkZXRhaWxzLmFjdHVhbCAtIGRldGFpbHMuZXhwZWN0ZWQ7XG5cdCAgICAgICAgICAgIGRpZmYgPSAoZGlmZiA+IDAgPyBcIitcIiA6IFwiXCIpICsgZGlmZjtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkZXRhaWxzLmFjdHVhbCAhPT0gXCJib29sZWFuXCIgJiYgdHlwZW9mIGRldGFpbHMuZXhwZWN0ZWQgIT09IFwiYm9vbGVhblwiKSB7XG5cdCAgICAgICAgICBkaWZmID0gUVVuaXQuZGlmZihleHBlY3RlZCwgYWN0dWFsKTsgLy8gZG9uJ3Qgc2hvdyBkaWZmIGlmIHRoZXJlIGlzIHplcm8gb3ZlcmxhcFxuXG5cdCAgICAgICAgICBzaG93RGlmZiA9IHN0cmlwSHRtbChkaWZmKS5sZW5ndGggIT09IHN0cmlwSHRtbChleHBlY3RlZCkubGVuZ3RoICsgc3RyaXBIdG1sKGFjdHVhbCkubGVuZ3RoO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGlmIChzaG93RGlmZikge1xuXHQgICAgICAgICAgbWVzc2FnZSArPSBcIjx0ciBjbGFzcz0ndGVzdC1kaWZmJz48dGg+RGlmZjogPC90aD48dGQ+PHByZT5cIiArIGRpZmYgKyBcIjwvcHJlPjwvdGQ+PC90cj5cIjtcblx0ICAgICAgICB9XG5cdCAgICAgIH0gZWxzZSBpZiAoZXhwZWN0ZWQuaW5kZXhPZihcIltvYmplY3QgQXJyYXldXCIpICE9PSAtMSB8fCBleHBlY3RlZC5pbmRleE9mKFwiW29iamVjdCBPYmplY3RdXCIpICE9PSAtMSkge1xuXHQgICAgICAgIG1lc3NhZ2UgKz0gXCI8dHIgY2xhc3M9J3Rlc3QtbWVzc2FnZSc+PHRoPk1lc3NhZ2U6IDwvdGg+PHRkPlwiICsgXCJEaWZmIHN1cHByZXNzZWQgYXMgdGhlIGRlcHRoIG9mIG9iamVjdCBpcyBtb3JlIHRoYW4gY3VycmVudCBtYXggZGVwdGggKFwiICsgUVVuaXQuY29uZmlnLm1heERlcHRoICsgXCIpLjxwPkhpbnQ6IFVzZSA8Y29kZT5RVW5pdC5kdW1wLm1heERlcHRoPC9jb2RlPiB0byBcIiArIFwiIHJ1biB3aXRoIGEgaGlnaGVyIG1heCBkZXB0aCBvciA8YSBocmVmPSdcIiArIGVzY2FwZVRleHQoc2V0VXJsKHtcblx0ICAgICAgICAgIG1heERlcHRoOiAtMVxuXHQgICAgICAgIH0pKSArIFwiJz5cIiArIFwiUmVydW48L2E+IHdpdGhvdXQgbWF4IGRlcHRoLjwvcD48L3RkPjwvdHI+XCI7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgbWVzc2FnZSArPSBcIjx0ciBjbGFzcz0ndGVzdC1tZXNzYWdlJz48dGg+TWVzc2FnZTogPC90aD48dGQ+XCIgKyBcIkRpZmYgc3VwcHJlc3NlZCBhcyB0aGUgZXhwZWN0ZWQgYW5kIGFjdHVhbCByZXN1bHRzIGhhdmUgYW4gZXF1aXZhbGVudFwiICsgXCIgc2VyaWFsaXphdGlvbjwvdGQ+PC90cj5cIjtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChkZXRhaWxzLnNvdXJjZSkge1xuXHQgICAgICAgIG1lc3NhZ2UgKz0gXCI8dHIgY2xhc3M9J3Rlc3Qtc291cmNlJz48dGg+U291cmNlOiA8L3RoPjx0ZD48cHJlPlwiICsgZXNjYXBlVGV4dChkZXRhaWxzLnNvdXJjZSkgKyBcIjwvcHJlPjwvdGQ+PC90cj5cIjtcblx0ICAgICAgfVxuXG5cdCAgICAgIG1lc3NhZ2UgKz0gXCI8L3RhYmxlPlwiOyAvLyBUaGlzIG9jY3VycyB3aGVuIHB1c2hGYWlsdXJlIGlzIHNldCBhbmQgd2UgaGF2ZSBhbiBleHRyYWN0ZWQgc3RhY2sgdHJhY2Vcblx0ICAgIH0gZWxzZSBpZiAoIWRldGFpbHMucmVzdWx0ICYmIGRldGFpbHMuc291cmNlKSB7XG5cdCAgICAgIG1lc3NhZ2UgKz0gXCI8dGFibGU+XCIgKyBcIjx0ciBjbGFzcz0ndGVzdC1zb3VyY2UnPjx0aD5Tb3VyY2U6IDwvdGg+PHRkPjxwcmU+XCIgKyBlc2NhcGVUZXh0KGRldGFpbHMuc291cmNlKSArIFwiPC9wcmU+PC90ZD48L3RyPlwiICsgXCI8L3RhYmxlPlwiO1xuXHQgICAgfVxuXG5cdCAgICBhc3NlcnRMaXN0ID0gdGVzdEl0ZW0uZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJvbFwiKVswXTtcblx0ICAgIGFzc2VydExpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpO1xuXHQgICAgYXNzZXJ0TGkuY2xhc3NOYW1lID0gZGV0YWlscy5yZXN1bHQgPyBcInBhc3NcIiA6IFwiZmFpbFwiO1xuXHQgICAgYXNzZXJ0TGkuaW5uZXJIVE1MID0gbWVzc2FnZTtcblx0ICAgIGFzc2VydExpc3QuYXBwZW5kQ2hpbGQoYXNzZXJ0TGkpO1xuXHQgIH0pO1xuXHQgIFFVbml0LnRlc3REb25lKGZ1bmN0aW9uIChkZXRhaWxzKSB7XG5cdCAgICB2YXIgdGVzdFRpdGxlLFxuXHQgICAgICAgIHRpbWUsXG5cdCAgICAgICAgdGVzdEl0ZW0sXG5cdCAgICAgICAgYXNzZXJ0TGlzdCxcblx0ICAgICAgICBzdGF0dXMsXG5cdCAgICAgICAgZ29vZCxcblx0ICAgICAgICBiYWQsXG5cdCAgICAgICAgdGVzdENvdW50cyxcblx0ICAgICAgICBza2lwcGVkLFxuXHQgICAgICAgIHNvdXJjZU5hbWUsXG5cdCAgICAgICAgdGVzdHMgPSBpZChcInF1bml0LXRlc3RzXCIpO1xuXG5cdCAgICBpZiAoIXRlc3RzKSB7XG5cdCAgICAgIHJldHVybjtcblx0ICAgIH1cblxuXHQgICAgdGVzdEl0ZW0gPSBpZChcInF1bml0LXRlc3Qtb3V0cHV0LVwiICsgZGV0YWlscy50ZXN0SWQpO1xuXHQgICAgcmVtb3ZlQ2xhc3ModGVzdEl0ZW0sIFwicnVubmluZ1wiKTtcblxuXHQgICAgaWYgKGRldGFpbHMuZmFpbGVkID4gMCkge1xuXHQgICAgICBzdGF0dXMgPSBcImZhaWxlZFwiO1xuXHQgICAgfSBlbHNlIGlmIChkZXRhaWxzLnRvZG8pIHtcblx0ICAgICAgc3RhdHVzID0gXCJ0b2RvXCI7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBzdGF0dXMgPSBkZXRhaWxzLnNraXBwZWQgPyBcInNraXBwZWRcIiA6IFwicGFzc2VkXCI7XG5cdCAgICB9XG5cblx0ICAgIGFzc2VydExpc3QgPSB0ZXN0SXRlbS5nZXRFbGVtZW50c0J5VGFnTmFtZShcIm9sXCIpWzBdO1xuXHQgICAgZ29vZCA9IGRldGFpbHMucGFzc2VkO1xuXHQgICAgYmFkID0gZGV0YWlscy5mYWlsZWQ7IC8vIFRoaXMgdGVzdCBwYXNzZWQgaWYgaXQgaGFzIG5vIHVuZXhwZWN0ZWQgZmFpbGVkIGFzc2VydGlvbnNcblxuXHQgICAgdmFyIHRlc3RQYXNzZWQgPSBkZXRhaWxzLmZhaWxlZCA+IDAgPyBkZXRhaWxzLnRvZG8gOiAhZGV0YWlscy50b2RvO1xuXG5cdCAgICBpZiAodGVzdFBhc3NlZCkge1xuXHQgICAgICAvLyBDb2xsYXBzZSB0aGUgcGFzc2luZyB0ZXN0c1xuXHQgICAgICBhZGRDbGFzcyhhc3NlcnRMaXN0LCBcInF1bml0LWNvbGxhcHNlZFwiKTtcblx0ICAgIH0gZWxzZSBpZiAoY29uZmlnLmNvbGxhcHNlKSB7XG5cdCAgICAgIGlmICghY29sbGFwc2VOZXh0KSB7XG5cdCAgICAgICAgLy8gU2tpcCBjb2xsYXBzaW5nIHRoZSBmaXJzdCBmYWlsaW5nIHRlc3Rcblx0ICAgICAgICBjb2xsYXBzZU5leHQgPSB0cnVlO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIC8vIENvbGxhcHNlIHJlbWFpbmluZyB0ZXN0c1xuXHQgICAgICAgIGFkZENsYXNzKGFzc2VydExpc3QsIFwicXVuaXQtY29sbGFwc2VkXCIpO1xuXHQgICAgICB9XG5cdCAgICB9IC8vIFRoZSB0ZXN0SXRlbS5maXJzdENoaWxkIGlzIHRoZSB0ZXN0IG5hbWVcblxuXG5cdCAgICB0ZXN0VGl0bGUgPSB0ZXN0SXRlbS5maXJzdENoaWxkO1xuXHQgICAgdGVzdENvdW50cyA9IGJhZCA/IFwiPGIgY2xhc3M9J2ZhaWxlZCc+XCIgKyBiYWQgKyBcIjwvYj4sIFwiICsgXCI8YiBjbGFzcz0ncGFzc2VkJz5cIiArIGdvb2QgKyBcIjwvYj4sIFwiIDogXCJcIjtcblx0ICAgIHRlc3RUaXRsZS5pbm5lckhUTUwgKz0gXCIgPGIgY2xhc3M9J2NvdW50cyc+KFwiICsgdGVzdENvdW50cyArIGRldGFpbHMuYXNzZXJ0aW9ucy5sZW5ndGggKyBcIik8L2I+XCI7XG5cblx0ICAgIGlmIChkZXRhaWxzLnNraXBwZWQpIHtcblx0ICAgICAgc3RhdHMuc2tpcHBlZFRlc3RzKys7XG5cdCAgICAgIHRlc3RJdGVtLmNsYXNzTmFtZSA9IFwic2tpcHBlZFwiO1xuXHQgICAgICBza2lwcGVkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImVtXCIpO1xuXHQgICAgICBza2lwcGVkLmNsYXNzTmFtZSA9IFwicXVuaXQtc2tpcHBlZC1sYWJlbFwiO1xuXHQgICAgICBza2lwcGVkLmlubmVySFRNTCA9IFwic2tpcHBlZFwiO1xuXHQgICAgICB0ZXN0SXRlbS5pbnNlcnRCZWZvcmUoc2tpcHBlZCwgdGVzdFRpdGxlKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIGFkZEV2ZW50KHRlc3RUaXRsZSwgXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgdG9nZ2xlQ2xhc3MoYXNzZXJ0TGlzdCwgXCJxdW5pdC1jb2xsYXBzZWRcIik7XG5cdCAgICAgIH0pO1xuXHQgICAgICB0ZXN0SXRlbS5jbGFzc05hbWUgPSB0ZXN0UGFzc2VkID8gXCJwYXNzXCIgOiBcImZhaWxcIjtcblxuXHQgICAgICBpZiAoZGV0YWlscy50b2RvKSB7XG5cdCAgICAgICAgdmFyIHRvZG9MYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJlbVwiKTtcblx0ICAgICAgICB0b2RvTGFiZWwuY2xhc3NOYW1lID0gXCJxdW5pdC10b2RvLWxhYmVsXCI7XG5cdCAgICAgICAgdG9kb0xhYmVsLmlubmVySFRNTCA9IFwidG9kb1wiO1xuXHQgICAgICAgIHRlc3RJdGVtLmNsYXNzTmFtZSArPSBcIiB0b2RvXCI7XG5cdCAgICAgICAgdGVzdEl0ZW0uaW5zZXJ0QmVmb3JlKHRvZG9MYWJlbCwgdGVzdFRpdGxlKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHRpbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0ICAgICAgdGltZS5jbGFzc05hbWUgPSBcInJ1bnRpbWVcIjtcblx0ICAgICAgdGltZS5pbm5lckhUTUwgPSBkZXRhaWxzLnJ1bnRpbWUgKyBcIiBtc1wiO1xuXHQgICAgICB0ZXN0SXRlbS5pbnNlcnRCZWZvcmUodGltZSwgYXNzZXJ0TGlzdCk7XG5cblx0ICAgICAgaWYgKCF0ZXN0UGFzc2VkKSB7XG5cdCAgICAgICAgc3RhdHMuZmFpbGVkVGVzdHMrKztcblx0ICAgICAgfSBlbHNlIGlmIChkZXRhaWxzLnRvZG8pIHtcblx0ICAgICAgICBzdGF0cy50b2RvVGVzdHMrKztcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBzdGF0cy5wYXNzZWRUZXN0cysrO1xuXHQgICAgICB9XG5cdCAgICB9IC8vIFNob3cgdGhlIHNvdXJjZSBvZiB0aGUgdGVzdCB3aGVuIHNob3dpbmcgYXNzZXJ0aW9uc1xuXG5cblx0ICAgIGlmIChkZXRhaWxzLnNvdXJjZSkge1xuXHQgICAgICBzb3VyY2VOYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInBcIik7XG5cdCAgICAgIHNvdXJjZU5hbWUuaW5uZXJIVE1MID0gXCI8c3Ryb25nPlNvdXJjZTogPC9zdHJvbmc+XCIgKyBlc2NhcGVUZXh0KGRldGFpbHMuc291cmNlKTtcblx0ICAgICAgYWRkQ2xhc3Moc291cmNlTmFtZSwgXCJxdW5pdC1zb3VyY2VcIik7XG5cblx0ICAgICAgaWYgKHRlc3RQYXNzZWQpIHtcblx0ICAgICAgICBhZGRDbGFzcyhzb3VyY2VOYW1lLCBcInF1bml0LWNvbGxhcHNlZFwiKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGFkZEV2ZW50KHRlc3RUaXRsZSwgXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgdG9nZ2xlQ2xhc3Moc291cmNlTmFtZSwgXCJxdW5pdC1jb2xsYXBzZWRcIik7XG5cdCAgICAgIH0pO1xuXHQgICAgICB0ZXN0SXRlbS5hcHBlbmRDaGlsZChzb3VyY2VOYW1lKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGNvbmZpZy5oaWRlcGFzc2VkICYmIChzdGF0dXMgPT09IFwicGFzc2VkXCIgfHwgZGV0YWlscy5za2lwcGVkKSkge1xuXHQgICAgICAvLyB1c2UgcmVtb3ZlQ2hpbGQgaW5zdGVhZCBvZiByZW1vdmUgYmVjYXVzZSBvZiBzdXBwb3J0XG5cdCAgICAgIGhpZGRlblRlc3RzLnB1c2godGVzdEl0ZW0pO1xuXHQgICAgICB0ZXN0cy5yZW1vdmVDaGlsZCh0ZXN0SXRlbSk7XG5cdCAgICB9XG5cdCAgfSk7IC8vIEF2b2lkIHJlYWR5U3RhdGUgaXNzdWUgd2l0aCBwaGFudG9tanNcblx0ICAvLyBSZWY6ICM4MThcblxuXHQgIHZhciBub3RQaGFudG9tID0gZnVuY3Rpb24gKHApIHtcblx0ICAgIHJldHVybiAhKHAgJiYgcC52ZXJzaW9uICYmIHAudmVyc2lvbi5tYWpvciA+IDApO1xuXHQgIH0od2luZG93JDEucGhhbnRvbSk7XG5cblx0ICBpZiAobm90UGhhbnRvbSAmJiBkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImNvbXBsZXRlXCIpIHtcblx0ICAgIFFVbml0LmxvYWQoKTtcblx0ICB9IGVsc2Uge1xuXHQgICAgYWRkRXZlbnQod2luZG93JDEsIFwibG9hZFwiLCBRVW5pdC5sb2FkKTtcblx0ICB9IC8vIFdyYXAgd2luZG93Lm9uZXJyb3IuIFdlIHdpbGwgY2FsbCB0aGUgb3JpZ2luYWwgd2luZG93Lm9uZXJyb3IgdG8gc2VlIGlmXG5cdCAgLy8gdGhlIGV4aXN0aW5nIGhhbmRsZXIgZnVsbHkgaGFuZGxlcyB0aGUgZXJyb3I7IGlmIG5vdCwgd2Ugd2lsbCBjYWxsIHRoZVxuXHQgIC8vIFFVbml0Lm9uRXJyb3IgZnVuY3Rpb24uXG5cblxuXHQgIHZhciBvcmlnaW5hbFdpbmRvd09uRXJyb3IgPSB3aW5kb3ckMS5vbmVycm9yOyAvLyBDb3ZlciB1bmNhdWdodCBleGNlcHRpb25zXG5cdCAgLy8gUmV0dXJuaW5nIHRydWUgd2lsbCBzdXBwcmVzcyB0aGUgZGVmYXVsdCBicm93c2VyIGhhbmRsZXIsXG5cdCAgLy8gcmV0dXJuaW5nIGZhbHNlIHdpbGwgbGV0IGl0IHJ1bi5cblxuXHQgIHdpbmRvdyQxLm9uZXJyb3IgPSBmdW5jdGlvbiAobWVzc2FnZSwgZmlsZU5hbWUsIGxpbmVOdW1iZXIsIGNvbHVtbk51bWJlciwgZXJyb3JPYmopIHtcblx0ICAgIHZhciByZXQgPSBmYWxzZTtcblxuXHQgICAgaWYgKG9yaWdpbmFsV2luZG93T25FcnJvcikge1xuXHQgICAgICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IG5ldyBBcnJheShfbGVuID4gNSA/IF9sZW4gLSA1IDogMCksIF9rZXkgPSA1OyBfa2V5IDwgX2xlbjsgX2tleSsrKSB7XG5cdCAgICAgICAgYXJnc1tfa2V5IC0gNV0gPSBhcmd1bWVudHNbX2tleV07XG5cdCAgICAgIH1cblxuXHQgICAgICByZXQgPSBvcmlnaW5hbFdpbmRvd09uRXJyb3IuY2FsbC5hcHBseShvcmlnaW5hbFdpbmRvd09uRXJyb3IsIFt0aGlzLCBtZXNzYWdlLCBmaWxlTmFtZSwgbGluZU51bWJlciwgY29sdW1uTnVtYmVyLCBlcnJvck9ial0uY29uY2F0KGFyZ3MpKTtcblx0ICAgIH0gLy8gVHJlYXQgcmV0dXJuIHZhbHVlIGFzIHdpbmRvdy5vbmVycm9yIGl0c2VsZiBkb2VzLFxuXHQgICAgLy8gT25seSBkbyBvdXIgaGFuZGxpbmcgaWYgbm90IHN1cHByZXNzZWQuXG5cblxuXHQgICAgaWYgKHJldCAhPT0gdHJ1ZSkge1xuXHQgICAgICB2YXIgZXJyb3IgPSB7XG5cdCAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcblx0ICAgICAgICBmaWxlTmFtZTogZmlsZU5hbWUsXG5cdCAgICAgICAgbGluZU51bWJlcjogbGluZU51bWJlclxuXHQgICAgICB9OyAvLyBBY2NvcmRpbmcgdG9cblx0ICAgICAgLy8gaHR0cHM6Ly9ibG9nLnNlbnRyeS5pby8yMDE2LzAxLzA0L2NsaWVudC1qYXZhc2NyaXB0LXJlcG9ydGluZy13aW5kb3ctb25lcnJvcixcblx0ICAgICAgLy8gbW9zdCBtb2Rlcm4gYnJvd3NlcnMgc3VwcG9ydCBhbiBlcnJvck9iaiBhcmd1bWVudDsgdXNlIHRoYXQgdG9cblx0ICAgICAgLy8gZ2V0IGEgZnVsbCBzdGFjayB0cmFjZSBpZiBpdCdzIGF2YWlsYWJsZS5cblxuXHQgICAgICBpZiAoZXJyb3JPYmogJiYgZXJyb3JPYmouc3RhY2spIHtcblx0ICAgICAgICBlcnJvci5zdGFja3RyYWNlID0gZXh0cmFjdFN0YWNrdHJhY2UoZXJyb3JPYmosIDApO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0ID0gUVVuaXQub25FcnJvcihlcnJvcik7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiByZXQ7XG5cdCAgfTsgLy8gTGlzdGVuIGZvciB1bmhhbmRsZWQgcmVqZWN0aW9ucywgYW5kIGNhbGwgUVVuaXQub25VbmhhbmRsZWRSZWplY3Rpb25cblxuXG5cdCAgd2luZG93JDEuYWRkRXZlbnRMaXN0ZW5lcihcInVuaGFuZGxlZHJlamVjdGlvblwiLCBmdW5jdGlvbiAoZXZlbnQpIHtcblx0ICAgIFFVbml0Lm9uVW5oYW5kbGVkUmVqZWN0aW9uKGV2ZW50LnJlYXNvbik7XG5cdCAgfSk7XG5cdH0pKCk7XG5cblx0Lypcblx0ICogVGhpcyBmaWxlIGlzIGEgbW9kaWZpZWQgdmVyc2lvbiBvZiBnb29nbGUtZGlmZi1tYXRjaC1wYXRjaCdzIEphdmFTY3JpcHQgaW1wbGVtZW50YXRpb25cblx0ICogKGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvZ29vZ2xlLWRpZmYtbWF0Y2gtcGF0Y2gvc291cmNlL2Jyb3dzZS90cnVuay9qYXZhc2NyaXB0L2RpZmZfbWF0Y2hfcGF0Y2hfdW5jb21wcmVzc2VkLmpzKSxcblx0ICogbW9kaWZpY2F0aW9ucyBhcmUgbGljZW5zZWQgYXMgbW9yZSBmdWxseSBzZXQgZm9ydGggaW4gTElDRU5TRS50eHQuXG5cdCAqXG5cdCAqIFRoZSBvcmlnaW5hbCBzb3VyY2Ugb2YgZ29vZ2xlLWRpZmYtbWF0Y2gtcGF0Y2ggaXMgYXR0cmlidXRhYmxlIGFuZCBsaWNlbnNlZCBhcyBmb2xsb3dzOlxuXHQgKlxuXHQgKiBDb3B5cmlnaHQgMjAwNiBHb29nbGUgSW5jLlxuXHQgKiBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2dvb2dsZS1kaWZmLW1hdGNoLXBhdGNoL1xuXHQgKlxuXHQgKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuXHQgKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5cdCAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXHQgKlxuXHQgKiBodHRwczovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cdCAqXG5cdCAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcblx0ICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuXHQgKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblx0ICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuXHQgKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cblx0ICpcblx0ICogTW9yZSBJbmZvOlxuXHQgKiAgaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9nb29nbGUtZGlmZi1tYXRjaC1wYXRjaC9cblx0ICpcblx0ICogVXNhZ2U6IFFVbml0LmRpZmYoZXhwZWN0ZWQsIGFjdHVhbClcblx0ICpcblx0ICovXG5cblx0UVVuaXQuZGlmZiA9IGZ1bmN0aW9uICgpIHtcblx0ICBmdW5jdGlvbiBEaWZmTWF0Y2hQYXRjaCgpIHt9IC8vICBESUZGIEZVTkNUSU9OU1xuXG5cdCAgLyoqXG5cdCAgICogVGhlIGRhdGEgc3RydWN0dXJlIHJlcHJlc2VudGluZyBhIGRpZmYgaXMgYW4gYXJyYXkgb2YgdHVwbGVzOlxuXHQgICAqIFtbRElGRl9ERUxFVEUsICdIZWxsbyddLCBbRElGRl9JTlNFUlQsICdHb29kYnllJ10sIFtESUZGX0VRVUFMLCAnIHdvcmxkLiddXVxuXHQgICAqIHdoaWNoIG1lYW5zOiBkZWxldGUgJ0hlbGxvJywgYWRkICdHb29kYnllJyBhbmQga2VlcCAnIHdvcmxkLidcblx0ICAgKi9cblxuXG5cdCAgdmFyIERJRkZfREVMRVRFID0gLTEsXG5cdCAgICAgIERJRkZfSU5TRVJUID0gMSxcblx0ICAgICAgRElGRl9FUVVBTCA9IDAsXG5cdCAgICAgIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cdCAgLyoqXG5cdCAgICogRmluZCB0aGUgZGlmZmVyZW5jZXMgYmV0d2VlbiB0d28gdGV4dHMuICBTaW1wbGlmaWVzIHRoZSBwcm9ibGVtIGJ5IHN0cmlwcGluZ1xuXHQgICAqIGFueSBjb21tb24gcHJlZml4IG9yIHN1ZmZpeCBvZmYgdGhlIHRleHRzIGJlZm9yZSBkaWZmaW5nLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgTmV3IHN0cmluZyB0byBiZSBkaWZmZWQuXG5cdCAgICogQHBhcmFtIHtib29sZWFuPX0gb3B0Q2hlY2tsaW5lcyBPcHRpb25hbCBzcGVlZHVwIGZsYWcuIElmIHByZXNlbnQgYW5kIGZhbHNlLFxuXHQgICAqICAgICB0aGVuIGRvbid0IHJ1biBhIGxpbmUtbGV2ZWwgZGlmZiBmaXJzdCB0byBpZGVudGlmeSB0aGUgY2hhbmdlZCBhcmVhcy5cblx0ICAgKiAgICAgRGVmYXVsdHMgdG8gdHJ1ZSwgd2hpY2ggZG9lcyBhIGZhc3Rlciwgc2xpZ2h0bHkgbGVzcyBvcHRpbWFsIGRpZmYuXG5cdCAgICogQHJldHVybiB7IUFycmF5LjwhRGlmZk1hdGNoUGF0Y2guRGlmZj59IEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuXHQgICAqL1xuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLkRpZmZNYWluID0gZnVuY3Rpb24gKHRleHQxLCB0ZXh0Miwgb3B0Q2hlY2tsaW5lcykge1xuXHQgICAgdmFyIGRlYWRsaW5lLCBjaGVja2xpbmVzLCBjb21tb25sZW5ndGgsIGNvbW1vbnByZWZpeCwgY29tbW9uc3VmZml4LCBkaWZmczsgLy8gVGhlIGRpZmYgbXVzdCBiZSBjb21wbGV0ZSBpbiB1cCB0byAxIHNlY29uZC5cblxuXHQgICAgZGVhZGxpbmUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSArIDEwMDA7IC8vIENoZWNrIGZvciBudWxsIGlucHV0cy5cblxuXHQgICAgaWYgKHRleHQxID09PSBudWxsIHx8IHRleHQyID09PSBudWxsKSB7XG5cdCAgICAgIHRocm93IG5ldyBFcnJvcihcIk51bGwgaW5wdXQuIChEaWZmTWFpbilcIik7XG5cdCAgICB9IC8vIENoZWNrIGZvciBlcXVhbGl0eSAoc3BlZWR1cCkuXG5cblxuXHQgICAgaWYgKHRleHQxID09PSB0ZXh0Mikge1xuXHQgICAgICBpZiAodGV4dDEpIHtcblx0ICAgICAgICByZXR1cm4gW1tESUZGX0VRVUFMLCB0ZXh0MV1dO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIFtdO1xuXHQgICAgfVxuXG5cdCAgICBpZiAodHlwZW9mIG9wdENoZWNrbGluZXMgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0ICAgICAgb3B0Q2hlY2tsaW5lcyA9IHRydWU7XG5cdCAgICB9XG5cblx0ICAgIGNoZWNrbGluZXMgPSBvcHRDaGVja2xpbmVzOyAvLyBUcmltIG9mZiBjb21tb24gcHJlZml4IChzcGVlZHVwKS5cblxuXHQgICAgY29tbW9ubGVuZ3RoID0gdGhpcy5kaWZmQ29tbW9uUHJlZml4KHRleHQxLCB0ZXh0Mik7XG5cdCAgICBjb21tb25wcmVmaXggPSB0ZXh0MS5zdWJzdHJpbmcoMCwgY29tbW9ubGVuZ3RoKTtcblx0ICAgIHRleHQxID0gdGV4dDEuc3Vic3RyaW5nKGNvbW1vbmxlbmd0aCk7XG5cdCAgICB0ZXh0MiA9IHRleHQyLnN1YnN0cmluZyhjb21tb25sZW5ndGgpOyAvLyBUcmltIG9mZiBjb21tb24gc3VmZml4IChzcGVlZHVwKS5cblxuXHQgICAgY29tbW9ubGVuZ3RoID0gdGhpcy5kaWZmQ29tbW9uU3VmZml4KHRleHQxLCB0ZXh0Mik7XG5cdCAgICBjb21tb25zdWZmaXggPSB0ZXh0MS5zdWJzdHJpbmcodGV4dDEubGVuZ3RoIC0gY29tbW9ubGVuZ3RoKTtcblx0ICAgIHRleHQxID0gdGV4dDEuc3Vic3RyaW5nKDAsIHRleHQxLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XG5cdCAgICB0ZXh0MiA9IHRleHQyLnN1YnN0cmluZygwLCB0ZXh0Mi5sZW5ndGggLSBjb21tb25sZW5ndGgpOyAvLyBDb21wdXRlIHRoZSBkaWZmIG9uIHRoZSBtaWRkbGUgYmxvY2suXG5cblx0ICAgIGRpZmZzID0gdGhpcy5kaWZmQ29tcHV0ZSh0ZXh0MSwgdGV4dDIsIGNoZWNrbGluZXMsIGRlYWRsaW5lKTsgLy8gUmVzdG9yZSB0aGUgcHJlZml4IGFuZCBzdWZmaXguXG5cblx0ICAgIGlmIChjb21tb25wcmVmaXgpIHtcblx0ICAgICAgZGlmZnMudW5zaGlmdChbRElGRl9FUVVBTCwgY29tbW9ucHJlZml4XSk7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjb21tb25zdWZmaXgpIHtcblx0ICAgICAgZGlmZnMucHVzaChbRElGRl9FUVVBTCwgY29tbW9uc3VmZml4XSk7XG5cdCAgICB9XG5cblx0ICAgIHRoaXMuZGlmZkNsZWFudXBNZXJnZShkaWZmcyk7XG5cdCAgICByZXR1cm4gZGlmZnM7XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBSZWR1Y2UgdGhlIG51bWJlciBvZiBlZGl0cyBieSBlbGltaW5hdGluZyBvcGVyYXRpb25hbGx5IHRyaXZpYWwgZXF1YWxpdGllcy5cblx0ICAgKiBAcGFyYW0geyFBcnJheS48IURpZmZNYXRjaFBhdGNoLkRpZmY+fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZDbGVhbnVwRWZmaWNpZW5jeSA9IGZ1bmN0aW9uIChkaWZmcykge1xuXHQgICAgdmFyIGNoYW5nZXMsIGVxdWFsaXRpZXMsIGVxdWFsaXRpZXNMZW5ndGgsIGxhc3RlcXVhbGl0eSwgcG9pbnRlciwgcHJlSW5zLCBwcmVEZWwsIHBvc3RJbnMsIHBvc3REZWw7XG5cdCAgICBjaGFuZ2VzID0gZmFsc2U7XG5cdCAgICBlcXVhbGl0aWVzID0gW107IC8vIFN0YWNrIG9mIGluZGljZXMgd2hlcmUgZXF1YWxpdGllcyBhcmUgZm91bmQuXG5cblx0ICAgIGVxdWFsaXRpZXNMZW5ndGggPSAwOyAvLyBLZWVwaW5nIG91ciBvd24gbGVuZ3RoIHZhciBpcyBmYXN0ZXIgaW4gSlMuXG5cblx0ICAgIC8qKiBAdHlwZSB7P3N0cmluZ30gKi9cblxuXHQgICAgbGFzdGVxdWFsaXR5ID0gbnVsbDsgLy8gQWx3YXlzIGVxdWFsIHRvIGRpZmZzW2VxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdXVsxXVxuXG5cdCAgICBwb2ludGVyID0gMDsgLy8gSW5kZXggb2YgY3VycmVudCBwb3NpdGlvbi5cblx0ICAgIC8vIElzIHRoZXJlIGFuIGluc2VydGlvbiBvcGVyYXRpb24gYmVmb3JlIHRoZSBsYXN0IGVxdWFsaXR5LlxuXG5cdCAgICBwcmVJbnMgPSBmYWxzZTsgLy8gSXMgdGhlcmUgYSBkZWxldGlvbiBvcGVyYXRpb24gYmVmb3JlIHRoZSBsYXN0IGVxdWFsaXR5LlxuXG5cdCAgICBwcmVEZWwgPSBmYWxzZTsgLy8gSXMgdGhlcmUgYW4gaW5zZXJ0aW9uIG9wZXJhdGlvbiBhZnRlciB0aGUgbGFzdCBlcXVhbGl0eS5cblxuXHQgICAgcG9zdElucyA9IGZhbHNlOyAvLyBJcyB0aGVyZSBhIGRlbGV0aW9uIG9wZXJhdGlvbiBhZnRlciB0aGUgbGFzdCBlcXVhbGl0eS5cblxuXHQgICAgcG9zdERlbCA9IGZhbHNlO1xuXG5cdCAgICB3aGlsZSAocG9pbnRlciA8IGRpZmZzLmxlbmd0aCkge1xuXHQgICAgICAvLyBFcXVhbGl0eSBmb3VuZC5cblx0ICAgICAgaWYgKGRpZmZzW3BvaW50ZXJdWzBdID09PSBESUZGX0VRVUFMKSB7XG5cdCAgICAgICAgaWYgKGRpZmZzW3BvaW50ZXJdWzFdLmxlbmd0aCA8IDQgJiYgKHBvc3RJbnMgfHwgcG9zdERlbCkpIHtcblx0ICAgICAgICAgIC8vIENhbmRpZGF0ZSBmb3VuZC5cblx0ICAgICAgICAgIGVxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCsrXSA9IHBvaW50ZXI7XG5cdCAgICAgICAgICBwcmVJbnMgPSBwb3N0SW5zO1xuXHQgICAgICAgICAgcHJlRGVsID0gcG9zdERlbDtcblx0ICAgICAgICAgIGxhc3RlcXVhbGl0eSA9IGRpZmZzW3BvaW50ZXJdWzFdO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAvLyBOb3QgYSBjYW5kaWRhdGUsIGFuZCBjYW4gbmV2ZXIgYmVjb21lIG9uZS5cblx0ICAgICAgICAgIGVxdWFsaXRpZXNMZW5ndGggPSAwO1xuXHQgICAgICAgICAgbGFzdGVxdWFsaXR5ID0gbnVsbDtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBwb3N0SW5zID0gcG9zdERlbCA9IGZhbHNlOyAvLyBBbiBpbnNlcnRpb24gb3IgZGVsZXRpb24uXG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgaWYgKGRpZmZzW3BvaW50ZXJdWzBdID09PSBESUZGX0RFTEVURSkge1xuXHQgICAgICAgICAgcG9zdERlbCA9IHRydWU7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHBvc3RJbnMgPSB0cnVlO1xuXHQgICAgICAgIH1cblx0ICAgICAgICAvKlxuXHQgICAgICAgICAqIEZpdmUgdHlwZXMgdG8gYmUgc3BsaXQ6XG5cdCAgICAgICAgICogPGlucz5BPC9pbnM+PGRlbD5CPC9kZWw+WFk8aW5zPkM8L2lucz48ZGVsPkQ8L2RlbD5cblx0ICAgICAgICAgKiA8aW5zPkE8L2lucz5YPGlucz5DPC9pbnM+PGRlbD5EPC9kZWw+XG5cdCAgICAgICAgICogPGlucz5BPC9pbnM+PGRlbD5CPC9kZWw+WDxpbnM+QzwvaW5zPlxuXHQgICAgICAgICAqIDxpbnM+QTwvZGVsPlg8aW5zPkM8L2lucz48ZGVsPkQ8L2RlbD5cblx0ICAgICAgICAgKiA8aW5zPkE8L2lucz48ZGVsPkI8L2RlbD5YPGRlbD5DPC9kZWw+XG5cdCAgICAgICAgICovXG5cblxuXHQgICAgICAgIGlmIChsYXN0ZXF1YWxpdHkgJiYgKHByZUlucyAmJiBwcmVEZWwgJiYgcG9zdElucyAmJiBwb3N0RGVsIHx8IGxhc3RlcXVhbGl0eS5sZW5ndGggPCAyICYmIHByZUlucyArIHByZURlbCArIHBvc3RJbnMgKyBwb3N0RGVsID09PSAzKSkge1xuXHQgICAgICAgICAgLy8gRHVwbGljYXRlIHJlY29yZC5cblx0ICAgICAgICAgIGRpZmZzLnNwbGljZShlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGggLSAxXSwgMCwgW0RJRkZfREVMRVRFLCBsYXN0ZXF1YWxpdHldKTsgLy8gQ2hhbmdlIHNlY29uZCBjb3B5IHRvIGluc2VydC5cblxuXHQgICAgICAgICAgZGlmZnNbZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV0gKyAxXVswXSA9IERJRkZfSU5TRVJUO1xuXHQgICAgICAgICAgZXF1YWxpdGllc0xlbmd0aC0tOyAvLyBUaHJvdyBhd2F5IHRoZSBlcXVhbGl0eSB3ZSBqdXN0IGRlbGV0ZWQ7XG5cblx0ICAgICAgICAgIGxhc3RlcXVhbGl0eSA9IG51bGw7XG5cblx0ICAgICAgICAgIGlmIChwcmVJbnMgJiYgcHJlRGVsKSB7XG5cdCAgICAgICAgICAgIC8vIE5vIGNoYW5nZXMgbWFkZSB3aGljaCBjb3VsZCBhZmZlY3QgcHJldmlvdXMgZW50cnksIGtlZXAgZ29pbmcuXG5cdCAgICAgICAgICAgIHBvc3RJbnMgPSBwb3N0RGVsID0gdHJ1ZTtcblx0ICAgICAgICAgICAgZXF1YWxpdGllc0xlbmd0aCA9IDA7XG5cdCAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICBlcXVhbGl0aWVzTGVuZ3RoLS07IC8vIFRocm93IGF3YXkgdGhlIHByZXZpb3VzIGVxdWFsaXR5LlxuXG5cdCAgICAgICAgICAgIHBvaW50ZXIgPSBlcXVhbGl0aWVzTGVuZ3RoID4gMCA/IGVxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdIDogLTE7XG5cdCAgICAgICAgICAgIHBvc3RJbnMgPSBwb3N0RGVsID0gZmFsc2U7XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIGNoYW5nZXMgPSB0cnVlO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHBvaW50ZXIrKztcblx0ICAgIH1cblxuXHQgICAgaWYgKGNoYW5nZXMpIHtcblx0ICAgICAgdGhpcy5kaWZmQ2xlYW51cE1lcmdlKGRpZmZzKTtcblx0ICAgIH1cblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIENvbnZlcnQgYSBkaWZmIGFycmF5IGludG8gYSBwcmV0dHkgSFRNTCByZXBvcnQuXG5cdCAgICogQHBhcmFtIHshQXJyYXkuPCFEaWZmTWF0Y2hQYXRjaC5EaWZmPn0gZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG5cdCAgICogQHBhcmFtIHtpbnRlZ2VyfSBzdHJpbmcgdG8gYmUgYmVhdXRpZmllZC5cblx0ICAgKiBAcmV0dXJuIHtzdHJpbmd9IEhUTUwgcmVwcmVzZW50YXRpb24uXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmUHJldHR5SHRtbCA9IGZ1bmN0aW9uIChkaWZmcykge1xuXHQgICAgdmFyIG9wLFxuXHQgICAgICAgIGRhdGEsXG5cdCAgICAgICAgeCxcblx0ICAgICAgICBodG1sID0gW107XG5cblx0ICAgIGZvciAoeCA9IDA7IHggPCBkaWZmcy5sZW5ndGg7IHgrKykge1xuXHQgICAgICBvcCA9IGRpZmZzW3hdWzBdOyAvLyBPcGVyYXRpb24gKGluc2VydCwgZGVsZXRlLCBlcXVhbClcblxuXHQgICAgICBkYXRhID0gZGlmZnNbeF1bMV07IC8vIFRleHQgb2YgY2hhbmdlLlxuXG5cdCAgICAgIHN3aXRjaCAob3ApIHtcblx0ICAgICAgICBjYXNlIERJRkZfSU5TRVJUOlxuXHQgICAgICAgICAgaHRtbFt4XSA9IFwiPGlucz5cIiArIGVzY2FwZVRleHQoZGF0YSkgKyBcIjwvaW5zPlwiO1xuXHQgICAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgICBjYXNlIERJRkZfREVMRVRFOlxuXHQgICAgICAgICAgaHRtbFt4XSA9IFwiPGRlbD5cIiArIGVzY2FwZVRleHQoZGF0YSkgKyBcIjwvZGVsPlwiO1xuXHQgICAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgICBjYXNlIERJRkZfRVFVQUw6XG5cdCAgICAgICAgICBodG1sW3hdID0gXCI8c3Bhbj5cIiArIGVzY2FwZVRleHQoZGF0YSkgKyBcIjwvc3Bhbj5cIjtcblx0ICAgICAgICAgIGJyZWFrO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBodG1sLmpvaW4oXCJcIik7XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBEZXRlcm1pbmUgdGhlIGNvbW1vbiBwcmVmaXggb2YgdHdvIHN0cmluZ3MuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIEZpcnN0IHN0cmluZy5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cblx0ICAgKiBAcmV0dXJuIHtudW1iZXJ9IFRoZSBudW1iZXIgb2YgY2hhcmFjdGVycyBjb21tb24gdG8gdGhlIHN0YXJ0IG9mIGVhY2hcblx0ICAgKiAgICAgc3RyaW5nLlxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkNvbW1vblByZWZpeCA9IGZ1bmN0aW9uICh0ZXh0MSwgdGV4dDIpIHtcblx0ICAgIHZhciBwb2ludGVybWlkLCBwb2ludGVybWF4LCBwb2ludGVybWluLCBwb2ludGVyc3RhcnQ7IC8vIFF1aWNrIGNoZWNrIGZvciBjb21tb24gbnVsbCBjYXNlcy5cblxuXHQgICAgaWYgKCF0ZXh0MSB8fCAhdGV4dDIgfHwgdGV4dDEuY2hhckF0KDApICE9PSB0ZXh0Mi5jaGFyQXQoMCkpIHtcblx0ICAgICAgcmV0dXJuIDA7XG5cdCAgICB9IC8vIEJpbmFyeSBzZWFyY2guXG5cdCAgICAvLyBQZXJmb3JtYW5jZSBhbmFseXNpczogaHR0cHM6Ly9uZWlsLmZyYXNlci5uYW1lL25ld3MvMjAwNy8xMC8wOS9cblxuXG5cdCAgICBwb2ludGVybWluID0gMDtcblx0ICAgIHBvaW50ZXJtYXggPSBNYXRoLm1pbih0ZXh0MS5sZW5ndGgsIHRleHQyLmxlbmd0aCk7XG5cdCAgICBwb2ludGVybWlkID0gcG9pbnRlcm1heDtcblx0ICAgIHBvaW50ZXJzdGFydCA9IDA7XG5cblx0ICAgIHdoaWxlIChwb2ludGVybWluIDwgcG9pbnRlcm1pZCkge1xuXHQgICAgICBpZiAodGV4dDEuc3Vic3RyaW5nKHBvaW50ZXJzdGFydCwgcG9pbnRlcm1pZCkgPT09IHRleHQyLnN1YnN0cmluZyhwb2ludGVyc3RhcnQsIHBvaW50ZXJtaWQpKSB7XG5cdCAgICAgICAgcG9pbnRlcm1pbiA9IHBvaW50ZXJtaWQ7XG5cdCAgICAgICAgcG9pbnRlcnN0YXJ0ID0gcG9pbnRlcm1pbjtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBwb2ludGVybWF4ID0gcG9pbnRlcm1pZDtcblx0ICAgICAgfVxuXG5cdCAgICAgIHBvaW50ZXJtaWQgPSBNYXRoLmZsb29yKChwb2ludGVybWF4IC0gcG9pbnRlcm1pbikgLyAyICsgcG9pbnRlcm1pbik7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBwb2ludGVybWlkO1xuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogRGV0ZXJtaW5lIHRoZSBjb21tb24gc3VmZml4IG9mIHR3byBzdHJpbmdzLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIFNlY29uZCBzdHJpbmcuXG5cdCAgICogQHJldHVybiB7bnVtYmVyfSBUaGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgY29tbW9uIHRvIHRoZSBlbmQgb2YgZWFjaCBzdHJpbmcuXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmQ29tbW9uU3VmZml4ID0gZnVuY3Rpb24gKHRleHQxLCB0ZXh0Mikge1xuXHQgICAgdmFyIHBvaW50ZXJtaWQsIHBvaW50ZXJtYXgsIHBvaW50ZXJtaW4sIHBvaW50ZXJlbmQ7IC8vIFF1aWNrIGNoZWNrIGZvciBjb21tb24gbnVsbCBjYXNlcy5cblxuXHQgICAgaWYgKCF0ZXh0MSB8fCAhdGV4dDIgfHwgdGV4dDEuY2hhckF0KHRleHQxLmxlbmd0aCAtIDEpICE9PSB0ZXh0Mi5jaGFyQXQodGV4dDIubGVuZ3RoIC0gMSkpIHtcblx0ICAgICAgcmV0dXJuIDA7XG5cdCAgICB9IC8vIEJpbmFyeSBzZWFyY2guXG5cdCAgICAvLyBQZXJmb3JtYW5jZSBhbmFseXNpczogaHR0cHM6Ly9uZWlsLmZyYXNlci5uYW1lL25ld3MvMjAwNy8xMC8wOS9cblxuXG5cdCAgICBwb2ludGVybWluID0gMDtcblx0ICAgIHBvaW50ZXJtYXggPSBNYXRoLm1pbih0ZXh0MS5sZW5ndGgsIHRleHQyLmxlbmd0aCk7XG5cdCAgICBwb2ludGVybWlkID0gcG9pbnRlcm1heDtcblx0ICAgIHBvaW50ZXJlbmQgPSAwO1xuXG5cdCAgICB3aGlsZSAocG9pbnRlcm1pbiA8IHBvaW50ZXJtaWQpIHtcblx0ICAgICAgaWYgKHRleHQxLnN1YnN0cmluZyh0ZXh0MS5sZW5ndGggLSBwb2ludGVybWlkLCB0ZXh0MS5sZW5ndGggLSBwb2ludGVyZW5kKSA9PT0gdGV4dDIuc3Vic3RyaW5nKHRleHQyLmxlbmd0aCAtIHBvaW50ZXJtaWQsIHRleHQyLmxlbmd0aCAtIHBvaW50ZXJlbmQpKSB7XG5cdCAgICAgICAgcG9pbnRlcm1pbiA9IHBvaW50ZXJtaWQ7XG5cdCAgICAgICAgcG9pbnRlcmVuZCA9IHBvaW50ZXJtaW47XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcG9pbnRlcm1heCA9IHBvaW50ZXJtaWQ7XG5cdCAgICAgIH1cblxuXHQgICAgICBwb2ludGVybWlkID0gTWF0aC5mbG9vcigocG9pbnRlcm1heCAtIHBvaW50ZXJtaW4pIC8gMiArIHBvaW50ZXJtaW4pO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gcG9pbnRlcm1pZDtcblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIEZpbmQgdGhlIGRpZmZlcmVuY2VzIGJldHdlZW4gdHdvIHRleHRzLiAgQXNzdW1lcyB0aGF0IHRoZSB0ZXh0cyBkbyBub3Rcblx0ICAgKiBoYXZlIGFueSBjb21tb24gcHJlZml4IG9yIHN1ZmZpeC5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuXHQgICAqIEBwYXJhbSB7Ym9vbGVhbn0gY2hlY2tsaW5lcyBTcGVlZHVwIGZsYWcuICBJZiBmYWxzZSwgdGhlbiBkb24ndCBydW4gYVxuXHQgICAqICAgICBsaW5lLWxldmVsIGRpZmYgZmlyc3QgdG8gaWRlbnRpZnkgdGhlIGNoYW5nZWQgYXJlYXMuXG5cdCAgICogICAgIElmIHRydWUsIHRoZW4gcnVuIGEgZmFzdGVyLCBzbGlnaHRseSBsZXNzIG9wdGltYWwgZGlmZi5cblx0ICAgKiBAcGFyYW0ge251bWJlcn0gZGVhZGxpbmUgVGltZSB3aGVuIHRoZSBkaWZmIHNob3VsZCBiZSBjb21wbGV0ZSBieS5cblx0ICAgKiBAcmV0dXJuIHshQXJyYXkuPCFEaWZmTWF0Y2hQYXRjaC5EaWZmPn0gQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG5cdCAgICogQHByaXZhdGVcblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZDb21wdXRlID0gZnVuY3Rpb24gKHRleHQxLCB0ZXh0MiwgY2hlY2tsaW5lcywgZGVhZGxpbmUpIHtcblx0ICAgIHZhciBkaWZmcywgbG9uZ3RleHQsIHNob3J0dGV4dCwgaSwgaG0sIHRleHQxQSwgdGV4dDJBLCB0ZXh0MUIsIHRleHQyQiwgbWlkQ29tbW9uLCBkaWZmc0EsIGRpZmZzQjtcblxuXHQgICAgaWYgKCF0ZXh0MSkge1xuXHQgICAgICAvLyBKdXN0IGFkZCBzb21lIHRleHQgKHNwZWVkdXApLlxuXHQgICAgICByZXR1cm4gW1tESUZGX0lOU0VSVCwgdGV4dDJdXTtcblx0ICAgIH1cblxuXHQgICAgaWYgKCF0ZXh0Mikge1xuXHQgICAgICAvLyBKdXN0IGRlbGV0ZSBzb21lIHRleHQgKHNwZWVkdXApLlxuXHQgICAgICByZXR1cm4gW1tESUZGX0RFTEVURSwgdGV4dDFdXTtcblx0ICAgIH1cblxuXHQgICAgbG9uZ3RleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MSA6IHRleHQyO1xuXHQgICAgc2hvcnR0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDIgOiB0ZXh0MTtcblx0ICAgIGkgPSBsb25ndGV4dC5pbmRleE9mKHNob3J0dGV4dCk7XG5cblx0ICAgIGlmIChpICE9PSAtMSkge1xuXHQgICAgICAvLyBTaG9ydGVyIHRleHQgaXMgaW5zaWRlIHRoZSBsb25nZXIgdGV4dCAoc3BlZWR1cCkuXG5cdCAgICAgIGRpZmZzID0gW1tESUZGX0lOU0VSVCwgbG9uZ3RleHQuc3Vic3RyaW5nKDAsIGkpXSwgW0RJRkZfRVFVQUwsIHNob3J0dGV4dF0sIFtESUZGX0lOU0VSVCwgbG9uZ3RleHQuc3Vic3RyaW5nKGkgKyBzaG9ydHRleHQubGVuZ3RoKV1dOyAvLyBTd2FwIGluc2VydGlvbnMgZm9yIGRlbGV0aW9ucyBpZiBkaWZmIGlzIHJldmVyc2VkLlxuXG5cdCAgICAgIGlmICh0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGgpIHtcblx0ICAgICAgICBkaWZmc1swXVswXSA9IGRpZmZzWzJdWzBdID0gRElGRl9ERUxFVEU7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gZGlmZnM7XG5cdCAgICB9XG5cblx0ICAgIGlmIChzaG9ydHRleHQubGVuZ3RoID09PSAxKSB7XG5cdCAgICAgIC8vIFNpbmdsZSBjaGFyYWN0ZXIgc3RyaW5nLlxuXHQgICAgICAvLyBBZnRlciB0aGUgcHJldmlvdXMgc3BlZWR1cCwgdGhlIGNoYXJhY3RlciBjYW4ndCBiZSBhbiBlcXVhbGl0eS5cblx0ICAgICAgcmV0dXJuIFtbRElGRl9ERUxFVEUsIHRleHQxXSwgW0RJRkZfSU5TRVJULCB0ZXh0Ml1dO1xuXHQgICAgfSAvLyBDaGVjayB0byBzZWUgaWYgdGhlIHByb2JsZW0gY2FuIGJlIHNwbGl0IGluIHR3by5cblxuXG5cdCAgICBobSA9IHRoaXMuZGlmZkhhbGZNYXRjaCh0ZXh0MSwgdGV4dDIpO1xuXG5cdCAgICBpZiAoaG0pIHtcblx0ICAgICAgLy8gQSBoYWxmLW1hdGNoIHdhcyBmb3VuZCwgc29ydCBvdXQgdGhlIHJldHVybiBkYXRhLlxuXHQgICAgICB0ZXh0MUEgPSBobVswXTtcblx0ICAgICAgdGV4dDFCID0gaG1bMV07XG5cdCAgICAgIHRleHQyQSA9IGhtWzJdO1xuXHQgICAgICB0ZXh0MkIgPSBobVszXTtcblx0ICAgICAgbWlkQ29tbW9uID0gaG1bNF07IC8vIFNlbmQgYm90aCBwYWlycyBvZmYgZm9yIHNlcGFyYXRlIHByb2Nlc3NpbmcuXG5cblx0ICAgICAgZGlmZnNBID0gdGhpcy5EaWZmTWFpbih0ZXh0MUEsIHRleHQyQSwgY2hlY2tsaW5lcywgZGVhZGxpbmUpO1xuXHQgICAgICBkaWZmc0IgPSB0aGlzLkRpZmZNYWluKHRleHQxQiwgdGV4dDJCLCBjaGVja2xpbmVzLCBkZWFkbGluZSk7IC8vIE1lcmdlIHRoZSByZXN1bHRzLlxuXG5cdCAgICAgIHJldHVybiBkaWZmc0EuY29uY2F0KFtbRElGRl9FUVVBTCwgbWlkQ29tbW9uXV0sIGRpZmZzQik7XG5cdCAgICB9XG5cblx0ICAgIGlmIChjaGVja2xpbmVzICYmIHRleHQxLmxlbmd0aCA+IDEwMCAmJiB0ZXh0Mi5sZW5ndGggPiAxMDApIHtcblx0ICAgICAgcmV0dXJuIHRoaXMuZGlmZkxpbmVNb2RlKHRleHQxLCB0ZXh0MiwgZGVhZGxpbmUpO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gdGhpcy5kaWZmQmlzZWN0KHRleHQxLCB0ZXh0MiwgZGVhZGxpbmUpO1xuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogRG8gdGhlIHR3byB0ZXh0cyBzaGFyZSBhIHN1YnN0cmluZyB3aGljaCBpcyBhdCBsZWFzdCBoYWxmIHRoZSBsZW5ndGggb2YgdGhlXG5cdCAgICogbG9uZ2VyIHRleHQ/XG5cdCAgICogVGhpcyBzcGVlZHVwIGNhbiBwcm9kdWNlIG5vbi1taW5pbWFsIGRpZmZzLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIFNlY29uZCBzdHJpbmcuXG5cdCAgICogQHJldHVybiB7QXJyYXkuPHN0cmluZz59IEZpdmUgZWxlbWVudCBBcnJheSwgY29udGFpbmluZyB0aGUgcHJlZml4IG9mXG5cdCAgICogICAgIHRleHQxLCB0aGUgc3VmZml4IG9mIHRleHQxLCB0aGUgcHJlZml4IG9mIHRleHQyLCB0aGUgc3VmZml4IG9mXG5cdCAgICogICAgIHRleHQyIGFuZCB0aGUgY29tbW9uIG1pZGRsZS4gIE9yIG51bGwgaWYgdGhlcmUgd2FzIG5vIG1hdGNoLlxuXHQgICAqIEBwcml2YXRlXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmSGFsZk1hdGNoID0gZnVuY3Rpb24gKHRleHQxLCB0ZXh0Mikge1xuXHQgICAgdmFyIGxvbmd0ZXh0LCBzaG9ydHRleHQsIGRtcCwgdGV4dDFBLCB0ZXh0MkIsIHRleHQyQSwgdGV4dDFCLCBtaWRDb21tb24sIGhtMSwgaG0yLCBobTtcblx0ICAgIGxvbmd0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDEgOiB0ZXh0Mjtcblx0ICAgIHNob3J0dGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQyIDogdGV4dDE7XG5cblx0ICAgIGlmIChsb25ndGV4dC5sZW5ndGggPCA0IHx8IHNob3J0dGV4dC5sZW5ndGggKiAyIDwgbG9uZ3RleHQubGVuZ3RoKSB7XG5cdCAgICAgIHJldHVybiBudWxsOyAvLyBQb2ludGxlc3MuXG5cdCAgICB9XG5cblx0ICAgIGRtcCA9IHRoaXM7IC8vICd0aGlzJyBiZWNvbWVzICd3aW5kb3cnIGluIGEgY2xvc3VyZS5cblxuXHQgICAgLyoqXG5cdCAgICAgKiBEb2VzIGEgc3Vic3RyaW5nIG9mIHNob3J0dGV4dCBleGlzdCB3aXRoaW4gbG9uZ3RleHQgc3VjaCB0aGF0IHRoZSBzdWJzdHJpbmdcblx0ICAgICAqIGlzIGF0IGxlYXN0IGhhbGYgdGhlIGxlbmd0aCBvZiBsb25ndGV4dD9cblx0ICAgICAqIENsb3N1cmUsIGJ1dCBkb2VzIG5vdCByZWZlcmVuY2UgYW55IGV4dGVybmFsIHZhcmlhYmxlcy5cblx0ICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb25ndGV4dCBMb25nZXIgc3RyaW5nLlxuXHQgICAgICogQHBhcmFtIHtzdHJpbmd9IHNob3J0dGV4dCBTaG9ydGVyIHN0cmluZy5cblx0ICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpIFN0YXJ0IGluZGV4IG9mIHF1YXJ0ZXIgbGVuZ3RoIHN1YnN0cmluZyB3aXRoaW4gbG9uZ3RleHQuXG5cdCAgICAgKiBAcmV0dXJuIHtBcnJheS48c3RyaW5nPn0gRml2ZSBlbGVtZW50IEFycmF5LCBjb250YWluaW5nIHRoZSBwcmVmaXggb2Zcblx0ICAgICAqICAgICBsb25ndGV4dCwgdGhlIHN1ZmZpeCBvZiBsb25ndGV4dCwgdGhlIHByZWZpeCBvZiBzaG9ydHRleHQsIHRoZSBzdWZmaXhcblx0ICAgICAqICAgICBvZiBzaG9ydHRleHQgYW5kIHRoZSBjb21tb24gbWlkZGxlLiAgT3IgbnVsbCBpZiB0aGVyZSB3YXMgbm8gbWF0Y2guXG5cdCAgICAgKiBAcHJpdmF0ZVxuXHQgICAgICovXG5cblx0ICAgIGZ1bmN0aW9uIGRpZmZIYWxmTWF0Y2hJKGxvbmd0ZXh0LCBzaG9ydHRleHQsIGkpIHtcblx0ICAgICAgdmFyIHNlZWQsIGosIGJlc3RDb21tb24sIHByZWZpeExlbmd0aCwgc3VmZml4TGVuZ3RoLCBiZXN0TG9uZ3RleHRBLCBiZXN0TG9uZ3RleHRCLCBiZXN0U2hvcnR0ZXh0QSwgYmVzdFNob3J0dGV4dEI7IC8vIFN0YXJ0IHdpdGggYSAxLzQgbGVuZ3RoIHN1YnN0cmluZyBhdCBwb3NpdGlvbiBpIGFzIGEgc2VlZC5cblxuXHQgICAgICBzZWVkID0gbG9uZ3RleHQuc3Vic3RyaW5nKGksIGkgKyBNYXRoLmZsb29yKGxvbmd0ZXh0Lmxlbmd0aCAvIDQpKTtcblx0ICAgICAgaiA9IC0xO1xuXHQgICAgICBiZXN0Q29tbW9uID0gXCJcIjtcblxuXHQgICAgICB3aGlsZSAoKGogPSBzaG9ydHRleHQuaW5kZXhPZihzZWVkLCBqICsgMSkpICE9PSAtMSkge1xuXHQgICAgICAgIHByZWZpeExlbmd0aCA9IGRtcC5kaWZmQ29tbW9uUHJlZml4KGxvbmd0ZXh0LnN1YnN0cmluZyhpKSwgc2hvcnR0ZXh0LnN1YnN0cmluZyhqKSk7XG5cdCAgICAgICAgc3VmZml4TGVuZ3RoID0gZG1wLmRpZmZDb21tb25TdWZmaXgobG9uZ3RleHQuc3Vic3RyaW5nKDAsIGkpLCBzaG9ydHRleHQuc3Vic3RyaW5nKDAsIGopKTtcblxuXHQgICAgICAgIGlmIChiZXN0Q29tbW9uLmxlbmd0aCA8IHN1ZmZpeExlbmd0aCArIHByZWZpeExlbmd0aCkge1xuXHQgICAgICAgICAgYmVzdENvbW1vbiA9IHNob3J0dGV4dC5zdWJzdHJpbmcoaiAtIHN1ZmZpeExlbmd0aCwgaikgKyBzaG9ydHRleHQuc3Vic3RyaW5nKGosIGogKyBwcmVmaXhMZW5ndGgpO1xuXHQgICAgICAgICAgYmVzdExvbmd0ZXh0QSA9IGxvbmd0ZXh0LnN1YnN0cmluZygwLCBpIC0gc3VmZml4TGVuZ3RoKTtcblx0ICAgICAgICAgIGJlc3RMb25ndGV4dEIgPSBsb25ndGV4dC5zdWJzdHJpbmcoaSArIHByZWZpeExlbmd0aCk7XG5cdCAgICAgICAgICBiZXN0U2hvcnR0ZXh0QSA9IHNob3J0dGV4dC5zdWJzdHJpbmcoMCwgaiAtIHN1ZmZpeExlbmd0aCk7XG5cdCAgICAgICAgICBiZXN0U2hvcnR0ZXh0QiA9IHNob3J0dGV4dC5zdWJzdHJpbmcoaiArIHByZWZpeExlbmd0aCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKGJlc3RDb21tb24ubGVuZ3RoICogMiA+PSBsb25ndGV4dC5sZW5ndGgpIHtcblx0ICAgICAgICByZXR1cm4gW2Jlc3RMb25ndGV4dEEsIGJlc3RMb25ndGV4dEIsIGJlc3RTaG9ydHRleHRBLCBiZXN0U2hvcnR0ZXh0QiwgYmVzdENvbW1vbl07XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmV0dXJuIG51bGw7XG5cdCAgICAgIH1cblx0ICAgIH0gLy8gRmlyc3QgY2hlY2sgaWYgdGhlIHNlY29uZCBxdWFydGVyIGlzIHRoZSBzZWVkIGZvciBhIGhhbGYtbWF0Y2guXG5cblxuXHQgICAgaG0xID0gZGlmZkhhbGZNYXRjaEkobG9uZ3RleHQsIHNob3J0dGV4dCwgTWF0aC5jZWlsKGxvbmd0ZXh0Lmxlbmd0aCAvIDQpKTsgLy8gQ2hlY2sgYWdhaW4gYmFzZWQgb24gdGhlIHRoaXJkIHF1YXJ0ZXIuXG5cblx0ICAgIGhtMiA9IGRpZmZIYWxmTWF0Y2hJKGxvbmd0ZXh0LCBzaG9ydHRleHQsIE1hdGguY2VpbChsb25ndGV4dC5sZW5ndGggLyAyKSk7XG5cblx0ICAgIGlmICghaG0xICYmICFobTIpIHtcblx0ICAgICAgcmV0dXJuIG51bGw7XG5cdCAgICB9IGVsc2UgaWYgKCFobTIpIHtcblx0ICAgICAgaG0gPSBobTE7XG5cdCAgICB9IGVsc2UgaWYgKCFobTEpIHtcblx0ICAgICAgaG0gPSBobTI7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICAvLyBCb3RoIG1hdGNoZWQuICBTZWxlY3QgdGhlIGxvbmdlc3QuXG5cdCAgICAgIGhtID0gaG0xWzRdLmxlbmd0aCA+IGhtMls0XS5sZW5ndGggPyBobTEgOiBobTI7XG5cdCAgICB9IC8vIEEgaGFsZi1tYXRjaCB3YXMgZm91bmQsIHNvcnQgb3V0IHRoZSByZXR1cm4gZGF0YS5cblxuXG5cdCAgICBpZiAodGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoKSB7XG5cdCAgICAgIHRleHQxQSA9IGhtWzBdO1xuXHQgICAgICB0ZXh0MUIgPSBobVsxXTtcblx0ICAgICAgdGV4dDJBID0gaG1bMl07XG5cdCAgICAgIHRleHQyQiA9IGhtWzNdO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgdGV4dDJBID0gaG1bMF07XG5cdCAgICAgIHRleHQyQiA9IGhtWzFdO1xuXHQgICAgICB0ZXh0MUEgPSBobVsyXTtcblx0ICAgICAgdGV4dDFCID0gaG1bM107XG5cdCAgICB9XG5cblx0ICAgIG1pZENvbW1vbiA9IGhtWzRdO1xuXHQgICAgcmV0dXJuIFt0ZXh0MUEsIHRleHQxQiwgdGV4dDJBLCB0ZXh0MkIsIG1pZENvbW1vbl07XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBEbyBhIHF1aWNrIGxpbmUtbGV2ZWwgZGlmZiBvbiBib3RoIHN0cmluZ3MsIHRoZW4gcmVkaWZmIHRoZSBwYXJ0cyBmb3Jcblx0ICAgKiBncmVhdGVyIGFjY3VyYWN5LlxuXHQgICAqIFRoaXMgc3BlZWR1cCBjYW4gcHJvZHVjZSBub24tbWluaW1hbCBkaWZmcy5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuXHQgICAqIEBwYXJhbSB7bnVtYmVyfSBkZWFkbGluZSBUaW1lIHdoZW4gdGhlIGRpZmYgc2hvdWxkIGJlIGNvbXBsZXRlIGJ5LlxuXHQgICAqIEByZXR1cm4geyFBcnJheS48IURpZmZNYXRjaFBhdGNoLkRpZmY+fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblx0ICAgKiBAcHJpdmF0ZVxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkxpbmVNb2RlID0gZnVuY3Rpb24gKHRleHQxLCB0ZXh0MiwgZGVhZGxpbmUpIHtcblx0ICAgIHZhciBhLCBkaWZmcywgbGluZWFycmF5LCBwb2ludGVyLCBjb3VudEluc2VydCwgY291bnREZWxldGUsIHRleHRJbnNlcnQsIHRleHREZWxldGUsIGo7IC8vIFNjYW4gdGhlIHRleHQgb24gYSBsaW5lLWJ5LWxpbmUgYmFzaXMgZmlyc3QuXG5cblx0ICAgIGEgPSB0aGlzLmRpZmZMaW5lc1RvQ2hhcnModGV4dDEsIHRleHQyKTtcblx0ICAgIHRleHQxID0gYS5jaGFyczE7XG5cdCAgICB0ZXh0MiA9IGEuY2hhcnMyO1xuXHQgICAgbGluZWFycmF5ID0gYS5saW5lQXJyYXk7XG5cdCAgICBkaWZmcyA9IHRoaXMuRGlmZk1haW4odGV4dDEsIHRleHQyLCBmYWxzZSwgZGVhZGxpbmUpOyAvLyBDb252ZXJ0IHRoZSBkaWZmIGJhY2sgdG8gb3JpZ2luYWwgdGV4dC5cblxuXHQgICAgdGhpcy5kaWZmQ2hhcnNUb0xpbmVzKGRpZmZzLCBsaW5lYXJyYXkpOyAvLyBFbGltaW5hdGUgZnJlYWsgbWF0Y2hlcyAoZS5nLiBibGFuayBsaW5lcylcblxuXHQgICAgdGhpcy5kaWZmQ2xlYW51cFNlbWFudGljKGRpZmZzKTsgLy8gUmVkaWZmIGFueSByZXBsYWNlbWVudCBibG9ja3MsIHRoaXMgdGltZSBjaGFyYWN0ZXItYnktY2hhcmFjdGVyLlxuXHQgICAgLy8gQWRkIGEgZHVtbXkgZW50cnkgYXQgdGhlIGVuZC5cblxuXHQgICAgZGlmZnMucHVzaChbRElGRl9FUVVBTCwgXCJcIl0pO1xuXHQgICAgcG9pbnRlciA9IDA7XG5cdCAgICBjb3VudERlbGV0ZSA9IDA7XG5cdCAgICBjb3VudEluc2VydCA9IDA7XG5cdCAgICB0ZXh0RGVsZXRlID0gXCJcIjtcblx0ICAgIHRleHRJbnNlcnQgPSBcIlwiO1xuXG5cdCAgICB3aGlsZSAocG9pbnRlciA8IGRpZmZzLmxlbmd0aCkge1xuXHQgICAgICBzd2l0Y2ggKGRpZmZzW3BvaW50ZXJdWzBdKSB7XG5cdCAgICAgICAgY2FzZSBESUZGX0lOU0VSVDpcblx0ICAgICAgICAgIGNvdW50SW5zZXJ0Kys7XG5cdCAgICAgICAgICB0ZXh0SW5zZXJ0ICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuXHQgICAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgICBjYXNlIERJRkZfREVMRVRFOlxuXHQgICAgICAgICAgY291bnREZWxldGUrKztcblx0ICAgICAgICAgIHRleHREZWxldGUgKz0gZGlmZnNbcG9pbnRlcl1bMV07XG5cdCAgICAgICAgICBicmVhaztcblxuXHQgICAgICAgIGNhc2UgRElGRl9FUVVBTDpcblx0ICAgICAgICAgIC8vIFVwb24gcmVhY2hpbmcgYW4gZXF1YWxpdHksIGNoZWNrIGZvciBwcmlvciByZWR1bmRhbmNpZXMuXG5cdCAgICAgICAgICBpZiAoY291bnREZWxldGUgPj0gMSAmJiBjb3VudEluc2VydCA+PSAxKSB7XG5cdCAgICAgICAgICAgIC8vIERlbGV0ZSB0aGUgb2ZmZW5kaW5nIHJlY29yZHMgYW5kIGFkZCB0aGUgbWVyZ2VkIG9uZXMuXG5cdCAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnREZWxldGUgLSBjb3VudEluc2VydCwgY291bnREZWxldGUgKyBjb3VudEluc2VydCk7XG5cdCAgICAgICAgICAgIHBvaW50ZXIgPSBwb2ludGVyIC0gY291bnREZWxldGUgLSBjb3VudEluc2VydDtcblx0ICAgICAgICAgICAgYSA9IHRoaXMuRGlmZk1haW4odGV4dERlbGV0ZSwgdGV4dEluc2VydCwgZmFsc2UsIGRlYWRsaW5lKTtcblxuXHQgICAgICAgICAgICBmb3IgKGogPSBhLmxlbmd0aCAtIDE7IGogPj0gMDsgai0tKSB7XG5cdCAgICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIsIDAsIGFbal0pO1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgcG9pbnRlciA9IHBvaW50ZXIgKyBhLmxlbmd0aDtcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgY291bnRJbnNlcnQgPSAwO1xuXHQgICAgICAgICAgY291bnREZWxldGUgPSAwO1xuXHQgICAgICAgICAgdGV4dERlbGV0ZSA9IFwiXCI7XG5cdCAgICAgICAgICB0ZXh0SW5zZXJ0ID0gXCJcIjtcblx0ICAgICAgICAgIGJyZWFrO1xuXHQgICAgICB9XG5cblx0ICAgICAgcG9pbnRlcisrO1xuXHQgICAgfVxuXG5cdCAgICBkaWZmcy5wb3AoKTsgLy8gUmVtb3ZlIHRoZSBkdW1teSBlbnRyeSBhdCB0aGUgZW5kLlxuXG5cdCAgICByZXR1cm4gZGlmZnM7XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBGaW5kIHRoZSAnbWlkZGxlIHNuYWtlJyBvZiBhIGRpZmYsIHNwbGl0IHRoZSBwcm9ibGVtIGluIHR3b1xuXHQgICAqIGFuZCByZXR1cm4gdGhlIHJlY3Vyc2l2ZWx5IGNvbnN0cnVjdGVkIGRpZmYuXG5cdCAgICogU2VlIE15ZXJzIDE5ODYgcGFwZXI6IEFuIE8oTkQpIERpZmZlcmVuY2UgQWxnb3JpdGhtIGFuZCBJdHMgVmFyaWF0aW9ucy5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuXHQgICAqIEBwYXJhbSB7bnVtYmVyfSBkZWFkbGluZSBUaW1lIGF0IHdoaWNoIHRvIGJhaWwgaWYgbm90IHlldCBjb21wbGV0ZS5cblx0ICAgKiBAcmV0dXJuIHshQXJyYXkuPCFEaWZmTWF0Y2hQYXRjaC5EaWZmPn0gQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG5cdCAgICogQHByaXZhdGVcblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZCaXNlY3QgPSBmdW5jdGlvbiAodGV4dDEsIHRleHQyLCBkZWFkbGluZSkge1xuXHQgICAgdmFyIHRleHQxTGVuZ3RoLCB0ZXh0Mkxlbmd0aCwgbWF4RCwgdk9mZnNldCwgdkxlbmd0aCwgdjEsIHYyLCB4LCBkZWx0YSwgZnJvbnQsIGsxc3RhcnQsIGsxZW5kLCBrMnN0YXJ0LCBrMmVuZCwgazJPZmZzZXQsIGsxT2Zmc2V0LCB4MSwgeDIsIHkxLCB5MiwgZCwgazEsIGsyOyAvLyBDYWNoZSB0aGUgdGV4dCBsZW5ndGhzIHRvIHByZXZlbnQgbXVsdGlwbGUgY2FsbHMuXG5cblx0ICAgIHRleHQxTGVuZ3RoID0gdGV4dDEubGVuZ3RoO1xuXHQgICAgdGV4dDJMZW5ndGggPSB0ZXh0Mi5sZW5ndGg7XG5cdCAgICBtYXhEID0gTWF0aC5jZWlsKCh0ZXh0MUxlbmd0aCArIHRleHQyTGVuZ3RoKSAvIDIpO1xuXHQgICAgdk9mZnNldCA9IG1heEQ7XG5cdCAgICB2TGVuZ3RoID0gMiAqIG1heEQ7XG5cdCAgICB2MSA9IG5ldyBBcnJheSh2TGVuZ3RoKTtcblx0ICAgIHYyID0gbmV3IEFycmF5KHZMZW5ndGgpOyAvLyBTZXR0aW5nIGFsbCBlbGVtZW50cyB0byAtMSBpcyBmYXN0ZXIgaW4gQ2hyb21lICYgRmlyZWZveCB0aGFuIG1peGluZ1xuXHQgICAgLy8gaW50ZWdlcnMgYW5kIHVuZGVmaW5lZC5cblxuXHQgICAgZm9yICh4ID0gMDsgeCA8IHZMZW5ndGg7IHgrKykge1xuXHQgICAgICB2MVt4XSA9IC0xO1xuXHQgICAgICB2Mlt4XSA9IC0xO1xuXHQgICAgfVxuXG5cdCAgICB2MVt2T2Zmc2V0ICsgMV0gPSAwO1xuXHQgICAgdjJbdk9mZnNldCArIDFdID0gMDtcblx0ICAgIGRlbHRhID0gdGV4dDFMZW5ndGggLSB0ZXh0Mkxlbmd0aDsgLy8gSWYgdGhlIHRvdGFsIG51bWJlciBvZiBjaGFyYWN0ZXJzIGlzIG9kZCwgdGhlbiB0aGUgZnJvbnQgcGF0aCB3aWxsIGNvbGxpZGVcblx0ICAgIC8vIHdpdGggdGhlIHJldmVyc2UgcGF0aC5cblxuXHQgICAgZnJvbnQgPSBkZWx0YSAlIDIgIT09IDA7IC8vIE9mZnNldHMgZm9yIHN0YXJ0IGFuZCBlbmQgb2YgayBsb29wLlxuXHQgICAgLy8gUHJldmVudHMgbWFwcGluZyBvZiBzcGFjZSBiZXlvbmQgdGhlIGdyaWQuXG5cblx0ICAgIGsxc3RhcnQgPSAwO1xuXHQgICAgazFlbmQgPSAwO1xuXHQgICAgazJzdGFydCA9IDA7XG5cdCAgICBrMmVuZCA9IDA7XG5cblx0ICAgIGZvciAoZCA9IDA7IGQgPCBtYXhEOyBkKyspIHtcblx0ICAgICAgLy8gQmFpbCBvdXQgaWYgZGVhZGxpbmUgaXMgcmVhY2hlZC5cblx0ICAgICAgaWYgKG5ldyBEYXRlKCkuZ2V0VGltZSgpID4gZGVhZGxpbmUpIHtcblx0ICAgICAgICBicmVhaztcblx0ICAgICAgfSAvLyBXYWxrIHRoZSBmcm9udCBwYXRoIG9uZSBzdGVwLlxuXG5cblx0ICAgICAgZm9yIChrMSA9IC1kICsgazFzdGFydDsgazEgPD0gZCAtIGsxZW5kOyBrMSArPSAyKSB7XG5cdCAgICAgICAgazFPZmZzZXQgPSB2T2Zmc2V0ICsgazE7XG5cblx0ICAgICAgICBpZiAoazEgPT09IC1kIHx8IGsxICE9PSBkICYmIHYxW2sxT2Zmc2V0IC0gMV0gPCB2MVtrMU9mZnNldCArIDFdKSB7XG5cdCAgICAgICAgICB4MSA9IHYxW2sxT2Zmc2V0ICsgMV07XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHgxID0gdjFbazFPZmZzZXQgLSAxXSArIDE7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgeTEgPSB4MSAtIGsxO1xuXG5cdCAgICAgICAgd2hpbGUgKHgxIDwgdGV4dDFMZW5ndGggJiYgeTEgPCB0ZXh0Mkxlbmd0aCAmJiB0ZXh0MS5jaGFyQXQoeDEpID09PSB0ZXh0Mi5jaGFyQXQoeTEpKSB7XG5cdCAgICAgICAgICB4MSsrO1xuXHQgICAgICAgICAgeTErKztcblx0ICAgICAgICB9XG5cblx0ICAgICAgICB2MVtrMU9mZnNldF0gPSB4MTtcblxuXHQgICAgICAgIGlmICh4MSA+IHRleHQxTGVuZ3RoKSB7XG5cdCAgICAgICAgICAvLyBSYW4gb2ZmIHRoZSByaWdodCBvZiB0aGUgZ3JhcGguXG5cdCAgICAgICAgICBrMWVuZCArPSAyO1xuXHQgICAgICAgIH0gZWxzZSBpZiAoeTEgPiB0ZXh0Mkxlbmd0aCkge1xuXHQgICAgICAgICAgLy8gUmFuIG9mZiB0aGUgYm90dG9tIG9mIHRoZSBncmFwaC5cblx0ICAgICAgICAgIGsxc3RhcnQgKz0gMjtcblx0ICAgICAgICB9IGVsc2UgaWYgKGZyb250KSB7XG5cdCAgICAgICAgICBrMk9mZnNldCA9IHZPZmZzZXQgKyBkZWx0YSAtIGsxO1xuXG5cdCAgICAgICAgICBpZiAoazJPZmZzZXQgPj0gMCAmJiBrMk9mZnNldCA8IHZMZW5ndGggJiYgdjJbazJPZmZzZXRdICE9PSAtMSkge1xuXHQgICAgICAgICAgICAvLyBNaXJyb3IgeDIgb250byB0b3AtbGVmdCBjb29yZGluYXRlIHN5c3RlbS5cblx0ICAgICAgICAgICAgeDIgPSB0ZXh0MUxlbmd0aCAtIHYyW2syT2Zmc2V0XTtcblxuXHQgICAgICAgICAgICBpZiAoeDEgPj0geDIpIHtcblx0ICAgICAgICAgICAgICAvLyBPdmVybGFwIGRldGVjdGVkLlxuXHQgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRpZmZCaXNlY3RTcGxpdCh0ZXh0MSwgdGV4dDIsIHgxLCB5MSwgZGVhZGxpbmUpO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXHQgICAgICB9IC8vIFdhbGsgdGhlIHJldmVyc2UgcGF0aCBvbmUgc3RlcC5cblxuXG5cdCAgICAgIGZvciAoazIgPSAtZCArIGsyc3RhcnQ7IGsyIDw9IGQgLSBrMmVuZDsgazIgKz0gMikge1xuXHQgICAgICAgIGsyT2Zmc2V0ID0gdk9mZnNldCArIGsyO1xuXG5cdCAgICAgICAgaWYgKGsyID09PSAtZCB8fCBrMiAhPT0gZCAmJiB2MltrMk9mZnNldCAtIDFdIDwgdjJbazJPZmZzZXQgKyAxXSkge1xuXHQgICAgICAgICAgeDIgPSB2MltrMk9mZnNldCArIDFdO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICB4MiA9IHYyW2syT2Zmc2V0IC0gMV0gKyAxO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHkyID0geDIgLSBrMjtcblxuXHQgICAgICAgIHdoaWxlICh4MiA8IHRleHQxTGVuZ3RoICYmIHkyIDwgdGV4dDJMZW5ndGggJiYgdGV4dDEuY2hhckF0KHRleHQxTGVuZ3RoIC0geDIgLSAxKSA9PT0gdGV4dDIuY2hhckF0KHRleHQyTGVuZ3RoIC0geTIgLSAxKSkge1xuXHQgICAgICAgICAgeDIrKztcblx0ICAgICAgICAgIHkyKys7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgdjJbazJPZmZzZXRdID0geDI7XG5cblx0ICAgICAgICBpZiAoeDIgPiB0ZXh0MUxlbmd0aCkge1xuXHQgICAgICAgICAgLy8gUmFuIG9mZiB0aGUgbGVmdCBvZiB0aGUgZ3JhcGguXG5cdCAgICAgICAgICBrMmVuZCArPSAyO1xuXHQgICAgICAgIH0gZWxzZSBpZiAoeTIgPiB0ZXh0Mkxlbmd0aCkge1xuXHQgICAgICAgICAgLy8gUmFuIG9mZiB0aGUgdG9wIG9mIHRoZSBncmFwaC5cblx0ICAgICAgICAgIGsyc3RhcnQgKz0gMjtcblx0ICAgICAgICB9IGVsc2UgaWYgKCFmcm9udCkge1xuXHQgICAgICAgICAgazFPZmZzZXQgPSB2T2Zmc2V0ICsgZGVsdGEgLSBrMjtcblxuXHQgICAgICAgICAgaWYgKGsxT2Zmc2V0ID49IDAgJiYgazFPZmZzZXQgPCB2TGVuZ3RoICYmIHYxW2sxT2Zmc2V0XSAhPT0gLTEpIHtcblx0ICAgICAgICAgICAgeDEgPSB2MVtrMU9mZnNldF07XG5cdCAgICAgICAgICAgIHkxID0gdk9mZnNldCArIHgxIC0gazFPZmZzZXQ7IC8vIE1pcnJvciB4MiBvbnRvIHRvcC1sZWZ0IGNvb3JkaW5hdGUgc3lzdGVtLlxuXG5cdCAgICAgICAgICAgIHgyID0gdGV4dDFMZW5ndGggLSB4MjtcblxuXHQgICAgICAgICAgICBpZiAoeDEgPj0geDIpIHtcblx0ICAgICAgICAgICAgICAvLyBPdmVybGFwIGRldGVjdGVkLlxuXHQgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRpZmZCaXNlY3RTcGxpdCh0ZXh0MSwgdGV4dDIsIHgxLCB5MSwgZGVhZGxpbmUpO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9IC8vIERpZmYgdG9vayB0b28gbG9uZyBhbmQgaGl0IHRoZSBkZWFkbGluZSBvclxuXHQgICAgLy8gbnVtYmVyIG9mIGRpZmZzIGVxdWFscyBudW1iZXIgb2YgY2hhcmFjdGVycywgbm8gY29tbW9uYWxpdHkgYXQgYWxsLlxuXG5cblx0ICAgIHJldHVybiBbW0RJRkZfREVMRVRFLCB0ZXh0MV0sIFtESUZGX0lOU0VSVCwgdGV4dDJdXTtcblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIEdpdmVuIHRoZSBsb2NhdGlvbiBvZiB0aGUgJ21pZGRsZSBzbmFrZScsIHNwbGl0IHRoZSBkaWZmIGluIHR3byBwYXJ0c1xuXHQgICAqIGFuZCByZWN1cnNlLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgTmV3IHN0cmluZyB0byBiZSBkaWZmZWQuXG5cdCAgICogQHBhcmFtIHtudW1iZXJ9IHggSW5kZXggb2Ygc3BsaXQgcG9pbnQgaW4gdGV4dDEuXG5cdCAgICogQHBhcmFtIHtudW1iZXJ9IHkgSW5kZXggb2Ygc3BsaXQgcG9pbnQgaW4gdGV4dDIuXG5cdCAgICogQHBhcmFtIHtudW1iZXJ9IGRlYWRsaW5lIFRpbWUgYXQgd2hpY2ggdG8gYmFpbCBpZiBub3QgeWV0IGNvbXBsZXRlLlxuXHQgICAqIEByZXR1cm4geyFBcnJheS48IURpZmZNYXRjaFBhdGNoLkRpZmY+fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblx0ICAgKiBAcHJpdmF0ZVxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkJpc2VjdFNwbGl0ID0gZnVuY3Rpb24gKHRleHQxLCB0ZXh0MiwgeCwgeSwgZGVhZGxpbmUpIHtcblx0ICAgIHZhciB0ZXh0MWEsIHRleHQxYiwgdGV4dDJhLCB0ZXh0MmIsIGRpZmZzLCBkaWZmc2I7XG5cdCAgICB0ZXh0MWEgPSB0ZXh0MS5zdWJzdHJpbmcoMCwgeCk7XG5cdCAgICB0ZXh0MmEgPSB0ZXh0Mi5zdWJzdHJpbmcoMCwgeSk7XG5cdCAgICB0ZXh0MWIgPSB0ZXh0MS5zdWJzdHJpbmcoeCk7XG5cdCAgICB0ZXh0MmIgPSB0ZXh0Mi5zdWJzdHJpbmcoeSk7IC8vIENvbXB1dGUgYm90aCBkaWZmcyBzZXJpYWxseS5cblxuXHQgICAgZGlmZnMgPSB0aGlzLkRpZmZNYWluKHRleHQxYSwgdGV4dDJhLCBmYWxzZSwgZGVhZGxpbmUpO1xuXHQgICAgZGlmZnNiID0gdGhpcy5EaWZmTWFpbih0ZXh0MWIsIHRleHQyYiwgZmFsc2UsIGRlYWRsaW5lKTtcblx0ICAgIHJldHVybiBkaWZmcy5jb25jYXQoZGlmZnNiKTtcblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIFJlZHVjZSB0aGUgbnVtYmVyIG9mIGVkaXRzIGJ5IGVsaW1pbmF0aW5nIHNlbWFudGljYWxseSB0cml2aWFsIGVxdWFsaXRpZXMuXG5cdCAgICogQHBhcmFtIHshQXJyYXkuPCFEaWZmTWF0Y2hQYXRjaC5EaWZmPn0gZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG5cdCAgICovXG5cblxuXHQgIERpZmZNYXRjaFBhdGNoLnByb3RvdHlwZS5kaWZmQ2xlYW51cFNlbWFudGljID0gZnVuY3Rpb24gKGRpZmZzKSB7XG5cdCAgICB2YXIgY2hhbmdlcywgZXF1YWxpdGllcywgZXF1YWxpdGllc0xlbmd0aCwgbGFzdGVxdWFsaXR5LCBwb2ludGVyLCBsZW5ndGhJbnNlcnRpb25zMiwgbGVuZ3RoRGVsZXRpb25zMiwgbGVuZ3RoSW5zZXJ0aW9uczEsIGxlbmd0aERlbGV0aW9uczEsIGRlbGV0aW9uLCBpbnNlcnRpb24sIG92ZXJsYXBMZW5ndGgxLCBvdmVybGFwTGVuZ3RoMjtcblx0ICAgIGNoYW5nZXMgPSBmYWxzZTtcblx0ICAgIGVxdWFsaXRpZXMgPSBbXTsgLy8gU3RhY2sgb2YgaW5kaWNlcyB3aGVyZSBlcXVhbGl0aWVzIGFyZSBmb3VuZC5cblxuXHQgICAgZXF1YWxpdGllc0xlbmd0aCA9IDA7IC8vIEtlZXBpbmcgb3VyIG93biBsZW5ndGggdmFyIGlzIGZhc3RlciBpbiBKUy5cblxuXHQgICAgLyoqIEB0eXBlIHs/c3RyaW5nfSAqL1xuXG5cdCAgICBsYXN0ZXF1YWxpdHkgPSBudWxsOyAvLyBBbHdheXMgZXF1YWwgdG8gZGlmZnNbZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV1dWzFdXG5cblx0ICAgIHBvaW50ZXIgPSAwOyAvLyBJbmRleCBvZiBjdXJyZW50IHBvc2l0aW9uLlxuXHQgICAgLy8gTnVtYmVyIG9mIGNoYXJhY3RlcnMgdGhhdCBjaGFuZ2VkIHByaW9yIHRvIHRoZSBlcXVhbGl0eS5cblxuXHQgICAgbGVuZ3RoSW5zZXJ0aW9uczEgPSAwO1xuXHQgICAgbGVuZ3RoRGVsZXRpb25zMSA9IDA7IC8vIE51bWJlciBvZiBjaGFyYWN0ZXJzIHRoYXQgY2hhbmdlZCBhZnRlciB0aGUgZXF1YWxpdHkuXG5cblx0ICAgIGxlbmd0aEluc2VydGlvbnMyID0gMDtcblx0ICAgIGxlbmd0aERlbGV0aW9uczIgPSAwO1xuXG5cdCAgICB3aGlsZSAocG9pbnRlciA8IGRpZmZzLmxlbmd0aCkge1xuXHQgICAgICBpZiAoZGlmZnNbcG9pbnRlcl1bMF0gPT09IERJRkZfRVFVQUwpIHtcblx0ICAgICAgICAvLyBFcXVhbGl0eSBmb3VuZC5cblx0ICAgICAgICBlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGgrK10gPSBwb2ludGVyO1xuXHQgICAgICAgIGxlbmd0aEluc2VydGlvbnMxID0gbGVuZ3RoSW5zZXJ0aW9uczI7XG5cdCAgICAgICAgbGVuZ3RoRGVsZXRpb25zMSA9IGxlbmd0aERlbGV0aW9uczI7XG5cdCAgICAgICAgbGVuZ3RoSW5zZXJ0aW9uczIgPSAwO1xuXHQgICAgICAgIGxlbmd0aERlbGV0aW9uczIgPSAwO1xuXHQgICAgICAgIGxhc3RlcXVhbGl0eSA9IGRpZmZzW3BvaW50ZXJdWzFdO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIC8vIEFuIGluc2VydGlvbiBvciBkZWxldGlvbi5cblx0ICAgICAgICBpZiAoZGlmZnNbcG9pbnRlcl1bMF0gPT09IERJRkZfSU5TRVJUKSB7XG5cdCAgICAgICAgICBsZW5ndGhJbnNlcnRpb25zMiArPSBkaWZmc1twb2ludGVyXVsxXS5sZW5ndGg7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGxlbmd0aERlbGV0aW9uczIgKz0gZGlmZnNbcG9pbnRlcl1bMV0ubGVuZ3RoO1xuXHQgICAgICAgIH0gLy8gRWxpbWluYXRlIGFuIGVxdWFsaXR5IHRoYXQgaXMgc21hbGxlciBvciBlcXVhbCB0byB0aGUgZWRpdHMgb24gYm90aFxuXHQgICAgICAgIC8vIHNpZGVzIG9mIGl0LlxuXG5cblx0ICAgICAgICBpZiAobGFzdGVxdWFsaXR5ICYmIGxhc3RlcXVhbGl0eS5sZW5ndGggPD0gTWF0aC5tYXgobGVuZ3RoSW5zZXJ0aW9uczEsIGxlbmd0aERlbGV0aW9uczEpICYmIGxhc3RlcXVhbGl0eS5sZW5ndGggPD0gTWF0aC5tYXgobGVuZ3RoSW5zZXJ0aW9uczIsIGxlbmd0aERlbGV0aW9uczIpKSB7XG5cdCAgICAgICAgICAvLyBEdXBsaWNhdGUgcmVjb3JkLlxuXHQgICAgICAgICAgZGlmZnMuc3BsaWNlKGVxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdLCAwLCBbRElGRl9ERUxFVEUsIGxhc3RlcXVhbGl0eV0pOyAvLyBDaGFuZ2Ugc2Vjb25kIGNvcHkgdG8gaW5zZXJ0LlxuXG5cdCAgICAgICAgICBkaWZmc1tlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGggLSAxXSArIDFdWzBdID0gRElGRl9JTlNFUlQ7IC8vIFRocm93IGF3YXkgdGhlIGVxdWFsaXR5IHdlIGp1c3QgZGVsZXRlZC5cblxuXHQgICAgICAgICAgZXF1YWxpdGllc0xlbmd0aC0tOyAvLyBUaHJvdyBhd2F5IHRoZSBwcmV2aW91cyBlcXVhbGl0eSAoaXQgbmVlZHMgdG8gYmUgcmVldmFsdWF0ZWQpLlxuXG5cdCAgICAgICAgICBlcXVhbGl0aWVzTGVuZ3RoLS07XG5cdCAgICAgICAgICBwb2ludGVyID0gZXF1YWxpdGllc0xlbmd0aCA+IDAgPyBlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGggLSAxXSA6IC0xOyAvLyBSZXNldCB0aGUgY291bnRlcnMuXG5cblx0ICAgICAgICAgIGxlbmd0aEluc2VydGlvbnMxID0gMDtcblx0ICAgICAgICAgIGxlbmd0aERlbGV0aW9uczEgPSAwO1xuXHQgICAgICAgICAgbGVuZ3RoSW5zZXJ0aW9uczIgPSAwO1xuXHQgICAgICAgICAgbGVuZ3RoRGVsZXRpb25zMiA9IDA7XG5cdCAgICAgICAgICBsYXN0ZXF1YWxpdHkgPSBudWxsO1xuXHQgICAgICAgICAgY2hhbmdlcyA9IHRydWU7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgcG9pbnRlcisrO1xuXHQgICAgfSAvLyBOb3JtYWxpemUgdGhlIGRpZmYuXG5cblxuXHQgICAgaWYgKGNoYW5nZXMpIHtcblx0ICAgICAgdGhpcy5kaWZmQ2xlYW51cE1lcmdlKGRpZmZzKTtcblx0ICAgIH0gLy8gRmluZCBhbnkgb3ZlcmxhcHMgYmV0d2VlbiBkZWxldGlvbnMgYW5kIGluc2VydGlvbnMuXG5cdCAgICAvLyBlLmc6IDxkZWw+YWJjeHh4PC9kZWw+PGlucz54eHhkZWY8L2lucz5cblx0ICAgIC8vICAgLT4gPGRlbD5hYmM8L2RlbD54eHg8aW5zPmRlZjwvaW5zPlxuXHQgICAgLy8gZS5nOiA8ZGVsPnh4eGFiYzwvZGVsPjxpbnM+ZGVmeHh4PC9pbnM+XG5cdCAgICAvLyAgIC0+IDxpbnM+ZGVmPC9pbnM+eHh4PGRlbD5hYmM8L2RlbD5cblx0ICAgIC8vIE9ubHkgZXh0cmFjdCBhbiBvdmVybGFwIGlmIGl0IGlzIGFzIGJpZyBhcyB0aGUgZWRpdCBhaGVhZCBvciBiZWhpbmQgaXQuXG5cblxuXHQgICAgcG9pbnRlciA9IDE7XG5cblx0ICAgIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoKSB7XG5cdCAgICAgIGlmIChkaWZmc1twb2ludGVyIC0gMV1bMF0gPT09IERJRkZfREVMRVRFICYmIGRpZmZzW3BvaW50ZXJdWzBdID09PSBESUZGX0lOU0VSVCkge1xuXHQgICAgICAgIGRlbGV0aW9uID0gZGlmZnNbcG9pbnRlciAtIDFdWzFdO1xuXHQgICAgICAgIGluc2VydGlvbiA9IGRpZmZzW3BvaW50ZXJdWzFdO1xuXHQgICAgICAgIG92ZXJsYXBMZW5ndGgxID0gdGhpcy5kaWZmQ29tbW9uT3ZlcmxhcChkZWxldGlvbiwgaW5zZXJ0aW9uKTtcblx0ICAgICAgICBvdmVybGFwTGVuZ3RoMiA9IHRoaXMuZGlmZkNvbW1vbk92ZXJsYXAoaW5zZXJ0aW9uLCBkZWxldGlvbik7XG5cblx0ICAgICAgICBpZiAob3ZlcmxhcExlbmd0aDEgPj0gb3ZlcmxhcExlbmd0aDIpIHtcblx0ICAgICAgICAgIGlmIChvdmVybGFwTGVuZ3RoMSA+PSBkZWxldGlvbi5sZW5ndGggLyAyIHx8IG92ZXJsYXBMZW5ndGgxID49IGluc2VydGlvbi5sZW5ndGggLyAyKSB7XG5cdCAgICAgICAgICAgIC8vIE92ZXJsYXAgZm91bmQuICBJbnNlcnQgYW4gZXF1YWxpdHkgYW5kIHRyaW0gdGhlIHN1cnJvdW5kaW5nIGVkaXRzLlxuXHQgICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciwgMCwgW0RJRkZfRVFVQUwsIGluc2VydGlvbi5zdWJzdHJpbmcoMCwgb3ZlcmxhcExlbmd0aDEpXSk7XG5cdCAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXSA9IGRlbGV0aW9uLnN1YnN0cmluZygwLCBkZWxldGlvbi5sZW5ndGggLSBvdmVybGFwTGVuZ3RoMSk7XG5cdCAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSA9IGluc2VydGlvbi5zdWJzdHJpbmcob3ZlcmxhcExlbmd0aDEpO1xuXHQgICAgICAgICAgICBwb2ludGVyKys7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGlmIChvdmVybGFwTGVuZ3RoMiA+PSBkZWxldGlvbi5sZW5ndGggLyAyIHx8IG92ZXJsYXBMZW5ndGgyID49IGluc2VydGlvbi5sZW5ndGggLyAyKSB7XG5cdCAgICAgICAgICAgIC8vIFJldmVyc2Ugb3ZlcmxhcCBmb3VuZC5cblx0ICAgICAgICAgICAgLy8gSW5zZXJ0IGFuIGVxdWFsaXR5IGFuZCBzd2FwIGFuZCB0cmltIHRoZSBzdXJyb3VuZGluZyBlZGl0cy5cblx0ICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIsIDAsIFtESUZGX0VRVUFMLCBkZWxldGlvbi5zdWJzdHJpbmcoMCwgb3ZlcmxhcExlbmd0aDIpXSk7XG5cdCAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVswXSA9IERJRkZfSU5TRVJUO1xuXHQgICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0gPSBpbnNlcnRpb24uc3Vic3RyaW5nKDAsIGluc2VydGlvbi5sZW5ndGggLSBvdmVybGFwTGVuZ3RoMik7XG5cdCAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVswXSA9IERJRkZfREVMRVRFO1xuXHQgICAgICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMV0gPSBkZWxldGlvbi5zdWJzdHJpbmcob3ZlcmxhcExlbmd0aDIpO1xuXHQgICAgICAgICAgICBwb2ludGVyKys7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgcG9pbnRlcisrO1xuXHQgICAgICB9XG5cblx0ICAgICAgcG9pbnRlcisrO1xuXHQgICAgfVxuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogRGV0ZXJtaW5lIGlmIHRoZSBzdWZmaXggb2Ygb25lIHN0cmluZyBpcyB0aGUgcHJlZml4IG9mIGFub3RoZXIuXG5cdCAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIEZpcnN0IHN0cmluZy5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cblx0ICAgKiBAcmV0dXJuIHtudW1iZXJ9IFRoZSBudW1iZXIgb2YgY2hhcmFjdGVycyBjb21tb24gdG8gdGhlIGVuZCBvZiB0aGUgZmlyc3Rcblx0ICAgKiAgICAgc3RyaW5nIGFuZCB0aGUgc3RhcnQgb2YgdGhlIHNlY29uZCBzdHJpbmcuXG5cdCAgICogQHByaXZhdGVcblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZDb21tb25PdmVybGFwID0gZnVuY3Rpb24gKHRleHQxLCB0ZXh0Mikge1xuXHQgICAgdmFyIHRleHQxTGVuZ3RoLCB0ZXh0Mkxlbmd0aCwgdGV4dExlbmd0aCwgYmVzdCwgbGVuZ3RoLCBwYXR0ZXJuLCBmb3VuZDsgLy8gQ2FjaGUgdGhlIHRleHQgbGVuZ3RocyB0byBwcmV2ZW50IG11bHRpcGxlIGNhbGxzLlxuXG5cdCAgICB0ZXh0MUxlbmd0aCA9IHRleHQxLmxlbmd0aDtcblx0ICAgIHRleHQyTGVuZ3RoID0gdGV4dDIubGVuZ3RoOyAvLyBFbGltaW5hdGUgdGhlIG51bGwgY2FzZS5cblxuXHQgICAgaWYgKHRleHQxTGVuZ3RoID09PSAwIHx8IHRleHQyTGVuZ3RoID09PSAwKSB7XG5cdCAgICAgIHJldHVybiAwO1xuXHQgICAgfSAvLyBUcnVuY2F0ZSB0aGUgbG9uZ2VyIHN0cmluZy5cblxuXG5cdCAgICBpZiAodGV4dDFMZW5ndGggPiB0ZXh0Mkxlbmd0aCkge1xuXHQgICAgICB0ZXh0MSA9IHRleHQxLnN1YnN0cmluZyh0ZXh0MUxlbmd0aCAtIHRleHQyTGVuZ3RoKTtcblx0ICAgIH0gZWxzZSBpZiAodGV4dDFMZW5ndGggPCB0ZXh0Mkxlbmd0aCkge1xuXHQgICAgICB0ZXh0MiA9IHRleHQyLnN1YnN0cmluZygwLCB0ZXh0MUxlbmd0aCk7XG5cdCAgICB9XG5cblx0ICAgIHRleHRMZW5ndGggPSBNYXRoLm1pbih0ZXh0MUxlbmd0aCwgdGV4dDJMZW5ndGgpOyAvLyBRdWljayBjaGVjayBmb3IgdGhlIHdvcnN0IGNhc2UuXG5cblx0ICAgIGlmICh0ZXh0MSA9PT0gdGV4dDIpIHtcblx0ICAgICAgcmV0dXJuIHRleHRMZW5ndGg7XG5cdCAgICB9IC8vIFN0YXJ0IGJ5IGxvb2tpbmcgZm9yIGEgc2luZ2xlIGNoYXJhY3RlciBtYXRjaFxuXHQgICAgLy8gYW5kIGluY3JlYXNlIGxlbmd0aCB1bnRpbCBubyBtYXRjaCBpcyBmb3VuZC5cblx0ICAgIC8vIFBlcmZvcm1hbmNlIGFuYWx5c2lzOiBodHRwczovL25laWwuZnJhc2VyLm5hbWUvbmV3cy8yMDEwLzExLzA0L1xuXG5cblx0ICAgIGJlc3QgPSAwO1xuXHQgICAgbGVuZ3RoID0gMTtcblxuXHQgICAgd2hpbGUgKHRydWUpIHtcblx0ICAgICAgcGF0dGVybiA9IHRleHQxLnN1YnN0cmluZyh0ZXh0TGVuZ3RoIC0gbGVuZ3RoKTtcblx0ICAgICAgZm91bmQgPSB0ZXh0Mi5pbmRleE9mKHBhdHRlcm4pO1xuXG5cdCAgICAgIGlmIChmb3VuZCA9PT0gLTEpIHtcblx0ICAgICAgICByZXR1cm4gYmVzdDtcblx0ICAgICAgfVxuXG5cdCAgICAgIGxlbmd0aCArPSBmb3VuZDtcblxuXHQgICAgICBpZiAoZm91bmQgPT09IDAgfHwgdGV4dDEuc3Vic3RyaW5nKHRleHRMZW5ndGggLSBsZW5ndGgpID09PSB0ZXh0Mi5zdWJzdHJpbmcoMCwgbGVuZ3RoKSkge1xuXHQgICAgICAgIGJlc3QgPSBsZW5ndGg7XG5cdCAgICAgICAgbGVuZ3RoKys7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9O1xuXHQgIC8qKlxuXHQgICAqIFNwbGl0IHR3byB0ZXh0cyBpbnRvIGFuIGFycmF5IG9mIHN0cmluZ3MuICBSZWR1Y2UgdGhlIHRleHRzIHRvIGEgc3RyaW5nIG9mXG5cdCAgICogaGFzaGVzIHdoZXJlIGVhY2ggVW5pY29kZSBjaGFyYWN0ZXIgcmVwcmVzZW50cyBvbmUgbGluZS5cblx0ICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgRmlyc3Qgc3RyaW5nLlxuXHQgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBTZWNvbmQgc3RyaW5nLlxuXHQgICAqIEByZXR1cm4ge3tjaGFyczE6IHN0cmluZywgY2hhcnMyOiBzdHJpbmcsIGxpbmVBcnJheTogIUFycmF5LjxzdHJpbmc+fX1cblx0ICAgKiAgICAgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGVuY29kZWQgdGV4dDEsIHRoZSBlbmNvZGVkIHRleHQyIGFuZFxuXHQgICAqICAgICB0aGUgYXJyYXkgb2YgdW5pcXVlIHN0cmluZ3MuXG5cdCAgICogICAgIFRoZSB6ZXJvdGggZWxlbWVudCBvZiB0aGUgYXJyYXkgb2YgdW5pcXVlIHN0cmluZ3MgaXMgaW50ZW50aW9uYWxseSBibGFuay5cblx0ICAgKiBAcHJpdmF0ZVxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkxpbmVzVG9DaGFycyA9IGZ1bmN0aW9uICh0ZXh0MSwgdGV4dDIpIHtcblx0ICAgIHZhciBsaW5lQXJyYXksIGxpbmVIYXNoLCBjaGFyczEsIGNoYXJzMjtcblx0ICAgIGxpbmVBcnJheSA9IFtdOyAvLyBFLmcuIGxpbmVBcnJheVs0XSA9PT0gJ0hlbGxvXFxuJ1xuXG5cdCAgICBsaW5lSGFzaCA9IHt9OyAvLyBFLmcuIGxpbmVIYXNoWydIZWxsb1xcbiddID09PSA0XG5cdCAgICAvLyAnXFx4MDAnIGlzIGEgdmFsaWQgY2hhcmFjdGVyLCBidXQgdmFyaW91cyBkZWJ1Z2dlcnMgZG9uJ3QgbGlrZSBpdC5cblx0ICAgIC8vIFNvIHdlJ2xsIGluc2VydCBhIGp1bmsgZW50cnkgdG8gYXZvaWQgZ2VuZXJhdGluZyBhIG51bGwgY2hhcmFjdGVyLlxuXG5cdCAgICBsaW5lQXJyYXlbMF0gPSBcIlwiO1xuXHQgICAgLyoqXG5cdCAgICAgKiBTcGxpdCBhIHRleHQgaW50byBhbiBhcnJheSBvZiBzdHJpbmdzLiAgUmVkdWNlIHRoZSB0ZXh0cyB0byBhIHN0cmluZyBvZlxuXHQgICAgICogaGFzaGVzIHdoZXJlIGVhY2ggVW5pY29kZSBjaGFyYWN0ZXIgcmVwcmVzZW50cyBvbmUgbGluZS5cblx0ICAgICAqIE1vZGlmaWVzIGxpbmVhcnJheSBhbmQgbGluZWhhc2ggdGhyb3VnaCBiZWluZyBhIGNsb3N1cmUuXG5cdCAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCBTdHJpbmcgdG8gZW5jb2RlLlxuXHQgICAgICogQHJldHVybiB7c3RyaW5nfSBFbmNvZGVkIHN0cmluZy5cblx0ICAgICAqIEBwcml2YXRlXG5cdCAgICAgKi9cblxuXHQgICAgZnVuY3Rpb24gZGlmZkxpbmVzVG9DaGFyc011bmdlKHRleHQpIHtcblx0ICAgICAgdmFyIGNoYXJzLCBsaW5lU3RhcnQsIGxpbmVFbmQsIGxpbmVBcnJheUxlbmd0aCwgbGluZTtcblx0ICAgICAgY2hhcnMgPSBcIlwiOyAvLyBXYWxrIHRoZSB0ZXh0LCBwdWxsaW5nIG91dCBhIHN1YnN0cmluZyBmb3IgZWFjaCBsaW5lLlxuXHQgICAgICAvLyB0ZXh0LnNwbGl0KCdcXG4nKSB3b3VsZCB3b3VsZCB0ZW1wb3JhcmlseSBkb3VibGUgb3VyIG1lbW9yeSBmb290cHJpbnQuXG5cdCAgICAgIC8vIE1vZGlmeWluZyB0ZXh0IHdvdWxkIGNyZWF0ZSBtYW55IGxhcmdlIHN0cmluZ3MgdG8gZ2FyYmFnZSBjb2xsZWN0LlxuXG5cdCAgICAgIGxpbmVTdGFydCA9IDA7XG5cdCAgICAgIGxpbmVFbmQgPSAtMTsgLy8gS2VlcGluZyBvdXIgb3duIGxlbmd0aCB2YXJpYWJsZSBpcyBmYXN0ZXIgdGhhbiBsb29raW5nIGl0IHVwLlxuXG5cdCAgICAgIGxpbmVBcnJheUxlbmd0aCA9IGxpbmVBcnJheS5sZW5ndGg7XG5cblx0ICAgICAgd2hpbGUgKGxpbmVFbmQgPCB0ZXh0Lmxlbmd0aCAtIDEpIHtcblx0ICAgICAgICBsaW5lRW5kID0gdGV4dC5pbmRleE9mKFwiXFxuXCIsIGxpbmVTdGFydCk7XG5cblx0ICAgICAgICBpZiAobGluZUVuZCA9PT0gLTEpIHtcblx0ICAgICAgICAgIGxpbmVFbmQgPSB0ZXh0Lmxlbmd0aCAtIDE7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgbGluZSA9IHRleHQuc3Vic3RyaW5nKGxpbmVTdGFydCwgbGluZUVuZCArIDEpO1xuXHQgICAgICAgIGxpbmVTdGFydCA9IGxpbmVFbmQgKyAxO1xuXG5cdCAgICAgICAgaWYgKGhhc093bi5jYWxsKGxpbmVIYXNoLCBsaW5lKSkge1xuXHQgICAgICAgICAgY2hhcnMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShsaW5lSGFzaFtsaW5lXSk7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGNoYXJzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUobGluZUFycmF5TGVuZ3RoKTtcblx0ICAgICAgICAgIGxpbmVIYXNoW2xpbmVdID0gbGluZUFycmF5TGVuZ3RoO1xuXHQgICAgICAgICAgbGluZUFycmF5W2xpbmVBcnJheUxlbmd0aCsrXSA9IGxpbmU7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIGNoYXJzO1xuXHQgICAgfVxuXG5cdCAgICBjaGFyczEgPSBkaWZmTGluZXNUb0NoYXJzTXVuZ2UodGV4dDEpO1xuXHQgICAgY2hhcnMyID0gZGlmZkxpbmVzVG9DaGFyc011bmdlKHRleHQyKTtcblx0ICAgIHJldHVybiB7XG5cdCAgICAgIGNoYXJzMTogY2hhcnMxLFxuXHQgICAgICBjaGFyczI6IGNoYXJzMixcblx0ICAgICAgbGluZUFycmF5OiBsaW5lQXJyYXlcblx0ICAgIH07XG5cdCAgfTtcblx0ICAvKipcblx0ICAgKiBSZWh5ZHJhdGUgdGhlIHRleHQgaW4gYSBkaWZmIGZyb20gYSBzdHJpbmcgb2YgbGluZSBoYXNoZXMgdG8gcmVhbCBsaW5lcyBvZlxuXHQgICAqIHRleHQuXG5cdCAgICogQHBhcmFtIHshQXJyYXkuPCFEaWZmTWF0Y2hQYXRjaC5EaWZmPn0gZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG5cdCAgICogQHBhcmFtIHshQXJyYXkuPHN0cmluZz59IGxpbmVBcnJheSBBcnJheSBvZiB1bmlxdWUgc3RyaW5ncy5cblx0ICAgKiBAcHJpdmF0ZVxuXHQgICAqL1xuXG5cblx0ICBEaWZmTWF0Y2hQYXRjaC5wcm90b3R5cGUuZGlmZkNoYXJzVG9MaW5lcyA9IGZ1bmN0aW9uIChkaWZmcywgbGluZUFycmF5KSB7XG5cdCAgICB2YXIgeCwgY2hhcnMsIHRleHQsIHk7XG5cblx0ICAgIGZvciAoeCA9IDA7IHggPCBkaWZmcy5sZW5ndGg7IHgrKykge1xuXHQgICAgICBjaGFycyA9IGRpZmZzW3hdWzFdO1xuXHQgICAgICB0ZXh0ID0gW107XG5cblx0ICAgICAgZm9yICh5ID0gMDsgeSA8IGNoYXJzLmxlbmd0aDsgeSsrKSB7XG5cdCAgICAgICAgdGV4dFt5XSA9IGxpbmVBcnJheVtjaGFycy5jaGFyQ29kZUF0KHkpXTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGRpZmZzW3hdWzFdID0gdGV4dC5qb2luKFwiXCIpO1xuXHQgICAgfVxuXHQgIH07XG5cdCAgLyoqXG5cdCAgICogUmVvcmRlciBhbmQgbWVyZ2UgbGlrZSBlZGl0IHNlY3Rpb25zLiAgTWVyZ2UgZXF1YWxpdGllcy5cblx0ICAgKiBBbnkgZWRpdCBzZWN0aW9uIGNhbiBtb3ZlIGFzIGxvbmcgYXMgaXQgZG9lc24ndCBjcm9zcyBhbiBlcXVhbGl0eS5cblx0ICAgKiBAcGFyYW0geyFBcnJheS48IURpZmZNYXRjaFBhdGNoLkRpZmY+fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblx0ICAgKi9cblxuXG5cdCAgRGlmZk1hdGNoUGF0Y2gucHJvdG90eXBlLmRpZmZDbGVhbnVwTWVyZ2UgPSBmdW5jdGlvbiAoZGlmZnMpIHtcblx0ICAgIHZhciBwb2ludGVyLCBjb3VudERlbGV0ZSwgY291bnRJbnNlcnQsIHRleHRJbnNlcnQsIHRleHREZWxldGUsIGNvbW1vbmxlbmd0aCwgY2hhbmdlcywgZGlmZlBvaW50ZXIsIHBvc2l0aW9uO1xuXHQgICAgZGlmZnMucHVzaChbRElGRl9FUVVBTCwgXCJcIl0pOyAvLyBBZGQgYSBkdW1teSBlbnRyeSBhdCB0aGUgZW5kLlxuXG5cdCAgICBwb2ludGVyID0gMDtcblx0ICAgIGNvdW50RGVsZXRlID0gMDtcblx0ICAgIGNvdW50SW5zZXJ0ID0gMDtcblx0ICAgIHRleHREZWxldGUgPSBcIlwiO1xuXHQgICAgdGV4dEluc2VydCA9IFwiXCI7XG5cblx0ICAgIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoKSB7XG5cdCAgICAgIHN3aXRjaCAoZGlmZnNbcG9pbnRlcl1bMF0pIHtcblx0ICAgICAgICBjYXNlIERJRkZfSU5TRVJUOlxuXHQgICAgICAgICAgY291bnRJbnNlcnQrKztcblx0ICAgICAgICAgIHRleHRJbnNlcnQgKz0gZGlmZnNbcG9pbnRlcl1bMV07XG5cdCAgICAgICAgICBwb2ludGVyKys7XG5cdCAgICAgICAgICBicmVhaztcblxuXHQgICAgICAgIGNhc2UgRElGRl9ERUxFVEU6XG5cdCAgICAgICAgICBjb3VudERlbGV0ZSsrO1xuXHQgICAgICAgICAgdGV4dERlbGV0ZSArPSBkaWZmc1twb2ludGVyXVsxXTtcblx0ICAgICAgICAgIHBvaW50ZXIrKztcblx0ICAgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgICAgY2FzZSBESUZGX0VRVUFMOlxuXHQgICAgICAgICAgLy8gVXBvbiByZWFjaGluZyBhbiBlcXVhbGl0eSwgY2hlY2sgZm9yIHByaW9yIHJlZHVuZGFuY2llcy5cblx0ICAgICAgICAgIGlmIChjb3VudERlbGV0ZSArIGNvdW50SW5zZXJ0ID4gMSkge1xuXHQgICAgICAgICAgICBpZiAoY291bnREZWxldGUgIT09IDAgJiYgY291bnRJbnNlcnQgIT09IDApIHtcblx0ICAgICAgICAgICAgICAvLyBGYWN0b3Igb3V0IGFueSBjb21tb24gcHJlZml4ZXMuXG5cdCAgICAgICAgICAgICAgY29tbW9ubGVuZ3RoID0gdGhpcy5kaWZmQ29tbW9uUHJlZml4KHRleHRJbnNlcnQsIHRleHREZWxldGUpO1xuXG5cdCAgICAgICAgICAgICAgaWYgKGNvbW1vbmxlbmd0aCAhPT0gMCkge1xuXHQgICAgICAgICAgICAgICAgaWYgKHBvaW50ZXIgLSBjb3VudERlbGV0ZSAtIGNvdW50SW5zZXJ0ID4gMCAmJiBkaWZmc1twb2ludGVyIC0gY291bnREZWxldGUgLSBjb3VudEluc2VydCAtIDFdWzBdID09PSBESUZGX0VRVUFMKSB7XG5cdCAgICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSBjb3VudERlbGV0ZSAtIGNvdW50SW5zZXJ0IC0gMV1bMV0gKz0gdGV4dEluc2VydC5zdWJzdHJpbmcoMCwgY29tbW9ubGVuZ3RoKTtcblx0ICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICAgIGRpZmZzLnNwbGljZSgwLCAwLCBbRElGRl9FUVVBTCwgdGV4dEluc2VydC5zdWJzdHJpbmcoMCwgY29tbW9ubGVuZ3RoKV0pO1xuXHQgICAgICAgICAgICAgICAgICBwb2ludGVyKys7XG5cdCAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgIHRleHRJbnNlcnQgPSB0ZXh0SW5zZXJ0LnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuXHQgICAgICAgICAgICAgICAgdGV4dERlbGV0ZSA9IHRleHREZWxldGUuc3Vic3RyaW5nKGNvbW1vbmxlbmd0aCk7XG5cdCAgICAgICAgICAgICAgfSAvLyBGYWN0b3Igb3V0IGFueSBjb21tb24gc3VmZml4aWVzLlxuXG5cblx0ICAgICAgICAgICAgICBjb21tb25sZW5ndGggPSB0aGlzLmRpZmZDb21tb25TdWZmaXgodGV4dEluc2VydCwgdGV4dERlbGV0ZSk7XG5cblx0ICAgICAgICAgICAgICBpZiAoY29tbW9ubGVuZ3RoICE9PSAwKSB7XG5cdCAgICAgICAgICAgICAgICBkaWZmc1twb2ludGVyXVsxXSA9IHRleHRJbnNlcnQuc3Vic3RyaW5nKHRleHRJbnNlcnQubGVuZ3RoIC0gY29tbW9ubGVuZ3RoKSArIGRpZmZzW3BvaW50ZXJdWzFdO1xuXHQgICAgICAgICAgICAgICAgdGV4dEluc2VydCA9IHRleHRJbnNlcnQuc3Vic3RyaW5nKDAsIHRleHRJbnNlcnQubGVuZ3RoIC0gY29tbW9ubGVuZ3RoKTtcblx0ICAgICAgICAgICAgICAgIHRleHREZWxldGUgPSB0ZXh0RGVsZXRlLnN1YnN0cmluZygwLCB0ZXh0RGVsZXRlLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XG5cdCAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9IC8vIERlbGV0ZSB0aGUgb2ZmZW5kaW5nIHJlY29yZHMgYW5kIGFkZCB0aGUgbWVyZ2VkIG9uZXMuXG5cblxuXHQgICAgICAgICAgICBpZiAoY291bnREZWxldGUgPT09IDApIHtcblx0ICAgICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIGNvdW50SW5zZXJ0LCBjb3VudERlbGV0ZSArIGNvdW50SW5zZXJ0LCBbRElGRl9JTlNFUlQsIHRleHRJbnNlcnRdKTtcblx0ICAgICAgICAgICAgfSBlbHNlIGlmIChjb3VudEluc2VydCA9PT0gMCkge1xuXHQgICAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnREZWxldGUsIGNvdW50RGVsZXRlICsgY291bnRJbnNlcnQsIFtESUZGX0RFTEVURSwgdGV4dERlbGV0ZV0pO1xuXHQgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnREZWxldGUgLSBjb3VudEluc2VydCwgY291bnREZWxldGUgKyBjb3VudEluc2VydCwgW0RJRkZfREVMRVRFLCB0ZXh0RGVsZXRlXSwgW0RJRkZfSU5TRVJULCB0ZXh0SW5zZXJ0XSk7XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICBwb2ludGVyID0gcG9pbnRlciAtIGNvdW50RGVsZXRlIC0gY291bnRJbnNlcnQgKyAoY291bnREZWxldGUgPyAxIDogMCkgKyAoY291bnRJbnNlcnQgPyAxIDogMCkgKyAxO1xuXHQgICAgICAgICAgfSBlbHNlIGlmIChwb2ludGVyICE9PSAwICYmIGRpZmZzW3BvaW50ZXIgLSAxXVswXSA9PT0gRElGRl9FUVVBTCkge1xuXHQgICAgICAgICAgICAvLyBNZXJnZSB0aGlzIGVxdWFsaXR5IHdpdGggdGhlIHByZXZpb3VzIG9uZS5cblx0ICAgICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuXHQgICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciwgMSk7XG5cdCAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICBwb2ludGVyKys7XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIGNvdW50SW5zZXJ0ID0gMDtcblx0ICAgICAgICAgIGNvdW50RGVsZXRlID0gMDtcblx0ICAgICAgICAgIHRleHREZWxldGUgPSBcIlwiO1xuXHQgICAgICAgICAgdGV4dEluc2VydCA9IFwiXCI7XG5cdCAgICAgICAgICBicmVhaztcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBpZiAoZGlmZnNbZGlmZnMubGVuZ3RoIC0gMV1bMV0gPT09IFwiXCIpIHtcblx0ICAgICAgZGlmZnMucG9wKCk7IC8vIFJlbW92ZSB0aGUgZHVtbXkgZW50cnkgYXQgdGhlIGVuZC5cblx0ICAgIH0gLy8gU2Vjb25kIHBhc3M6IGxvb2sgZm9yIHNpbmdsZSBlZGl0cyBzdXJyb3VuZGVkIG9uIGJvdGggc2lkZXMgYnkgZXF1YWxpdGllc1xuXHQgICAgLy8gd2hpY2ggY2FuIGJlIHNoaWZ0ZWQgc2lkZXdheXMgdG8gZWxpbWluYXRlIGFuIGVxdWFsaXR5LlxuXHQgICAgLy8gZS5nOiBBPGlucz5CQTwvaW5zPkMgLT4gPGlucz5BQjwvaW5zPkFDXG5cblxuXHQgICAgY2hhbmdlcyA9IGZhbHNlO1xuXHQgICAgcG9pbnRlciA9IDE7IC8vIEludGVudGlvbmFsbHkgaWdub3JlIHRoZSBmaXJzdCBhbmQgbGFzdCBlbGVtZW50IChkb24ndCBuZWVkIGNoZWNraW5nKS5cblxuXHQgICAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGggLSAxKSB7XG5cdCAgICAgIGlmIChkaWZmc1twb2ludGVyIC0gMV1bMF0gPT09IERJRkZfRVFVQUwgJiYgZGlmZnNbcG9pbnRlciArIDFdWzBdID09PSBESUZGX0VRVUFMKSB7XG5cdCAgICAgICAgZGlmZlBvaW50ZXIgPSBkaWZmc1twb2ludGVyXVsxXTtcblx0ICAgICAgICBwb3NpdGlvbiA9IGRpZmZQb2ludGVyLnN1YnN0cmluZyhkaWZmUG9pbnRlci5sZW5ndGggLSBkaWZmc1twb2ludGVyIC0gMV1bMV0ubGVuZ3RoKTsgLy8gVGhpcyBpcyBhIHNpbmdsZSBlZGl0IHN1cnJvdW5kZWQgYnkgZXF1YWxpdGllcy5cblxuXHQgICAgICAgIGlmIChwb3NpdGlvbiA9PT0gZGlmZnNbcG9pbnRlciAtIDFdWzFdKSB7XG5cdCAgICAgICAgICAvLyBTaGlmdCB0aGUgZWRpdCBvdmVyIHRoZSBwcmV2aW91cyBlcXVhbGl0eS5cblx0ICAgICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdID0gZGlmZnNbcG9pbnRlciAtIDFdWzFdICsgZGlmZnNbcG9pbnRlcl1bMV0uc3Vic3RyaW5nKDAsIGRpZmZzW3BvaW50ZXJdWzFdLmxlbmd0aCAtIGRpZmZzW3BvaW50ZXIgLSAxXVsxXS5sZW5ndGgpO1xuXHQgICAgICAgICAgZGlmZnNbcG9pbnRlciArIDFdWzFdID0gZGlmZnNbcG9pbnRlciAtIDFdWzFdICsgZGlmZnNbcG9pbnRlciArIDFdWzFdO1xuXHQgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSAxLCAxKTtcblx0ICAgICAgICAgIGNoYW5nZXMgPSB0cnVlO1xuXHQgICAgICAgIH0gZWxzZSBpZiAoZGlmZlBvaW50ZXIuc3Vic3RyaW5nKDAsIGRpZmZzW3BvaW50ZXIgKyAxXVsxXS5sZW5ndGgpID09PSBkaWZmc1twb2ludGVyICsgMV1bMV0pIHtcblx0ICAgICAgICAgIC8vIFNoaWZ0IHRoZSBlZGl0IG92ZXIgdGhlIG5leHQgZXF1YWxpdHkuXG5cdCAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0gKz0gZGlmZnNbcG9pbnRlciArIDFdWzFdO1xuXHQgICAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0gPSBkaWZmc1twb2ludGVyXVsxXS5zdWJzdHJpbmcoZGlmZnNbcG9pbnRlciArIDFdWzFdLmxlbmd0aCkgKyBkaWZmc1twb2ludGVyICsgMV1bMV07XG5cdCAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciArIDEsIDEpO1xuXHQgICAgICAgICAgY2hhbmdlcyA9IHRydWU7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgcG9pbnRlcisrO1xuXHQgICAgfSAvLyBJZiBzaGlmdHMgd2VyZSBtYWRlLCB0aGUgZGlmZiBuZWVkcyByZW9yZGVyaW5nIGFuZCBhbm90aGVyIHNoaWZ0IHN3ZWVwLlxuXG5cblx0ICAgIGlmIChjaGFuZ2VzKSB7XG5cdCAgICAgIHRoaXMuZGlmZkNsZWFudXBNZXJnZShkaWZmcyk7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIHJldHVybiBmdW5jdGlvbiAobywgbikge1xuXHQgICAgdmFyIGRpZmYsIG91dHB1dCwgdGV4dDtcblx0ICAgIGRpZmYgPSBuZXcgRGlmZk1hdGNoUGF0Y2goKTtcblx0ICAgIG91dHB1dCA9IGRpZmYuRGlmZk1haW4obywgbik7XG5cdCAgICBkaWZmLmRpZmZDbGVhbnVwRWZmaWNpZW5jeShvdXRwdXQpO1xuXHQgICAgdGV4dCA9IGRpZmYuZGlmZlByZXR0eUh0bWwob3V0cHV0KTtcblx0ICAgIHJldHVybiB0ZXh0O1xuXHQgIH07XG5cdH0oKTtcblxufSgoZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KCkpKSk7XG4iLCJ2YXIgbmV4dFRpY2sgPSByZXF1aXJlKCdwcm9jZXNzL2Jyb3dzZXIuanMnKS5uZXh0VGljaztcbnZhciBhcHBseSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseTtcbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbnZhciBpbW1lZGlhdGVJZHMgPSB7fTtcbnZhciBuZXh0SW1tZWRpYXRlSWQgPSAwO1xuXG4vLyBET00gQVBJcywgZm9yIGNvbXBsZXRlbmVzc1xuXG5leHBvcnRzLnNldFRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBUaW1lb3V0KGFwcGx5LmNhbGwoc2V0VGltZW91dCwgd2luZG93LCBhcmd1bWVudHMpLCBjbGVhclRpbWVvdXQpO1xufTtcbmV4cG9ydHMuc2V0SW50ZXJ2YWwgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBUaW1lb3V0KGFwcGx5LmNhbGwoc2V0SW50ZXJ2YWwsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJJbnRlcnZhbCk7XG59O1xuZXhwb3J0cy5jbGVhclRpbWVvdXQgPVxuZXhwb3J0cy5jbGVhckludGVydmFsID0gZnVuY3Rpb24odGltZW91dCkgeyB0aW1lb3V0LmNsb3NlKCk7IH07XG5cbmZ1bmN0aW9uIFRpbWVvdXQoaWQsIGNsZWFyRm4pIHtcbiAgdGhpcy5faWQgPSBpZDtcbiAgdGhpcy5fY2xlYXJGbiA9IGNsZWFyRm47XG59XG5UaW1lb3V0LnByb3RvdHlwZS51bnJlZiA9IFRpbWVvdXQucHJvdG90eXBlLnJlZiA9IGZ1bmN0aW9uKCkge307XG5UaW1lb3V0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9jbGVhckZuLmNhbGwod2luZG93LCB0aGlzLl9pZCk7XG59O1xuXG4vLyBEb2VzIG5vdCBzdGFydCB0aGUgdGltZSwganVzdCBzZXRzIHVwIHRoZSBtZW1iZXJzIG5lZWRlZC5cbmV4cG9ydHMuZW5yb2xsID0gZnVuY3Rpb24oaXRlbSwgbXNlY3MpIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuICBpdGVtLl9pZGxlVGltZW91dCA9IG1zZWNzO1xufTtcblxuZXhwb3J0cy51bmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuICBpdGVtLl9pZGxlVGltZW91dCA9IC0xO1xufTtcblxuZXhwb3J0cy5fdW5yZWZBY3RpdmUgPSBleHBvcnRzLmFjdGl2ZSA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuXG4gIHZhciBtc2VjcyA9IGl0ZW0uX2lkbGVUaW1lb3V0O1xuICBpZiAobXNlY3MgPj0gMCkge1xuICAgIGl0ZW0uX2lkbGVUaW1lb3V0SWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uIG9uVGltZW91dCgpIHtcbiAgICAgIGlmIChpdGVtLl9vblRpbWVvdXQpXG4gICAgICAgIGl0ZW0uX29uVGltZW91dCgpO1xuICAgIH0sIG1zZWNzKTtcbiAgfVxufTtcblxuLy8gVGhhdCdzIG5vdCBob3cgbm9kZS5qcyBpbXBsZW1lbnRzIGl0IGJ1dCB0aGUgZXhwb3NlZCBhcGkgaXMgdGhlIHNhbWUuXG5leHBvcnRzLnNldEltbWVkaWF0ZSA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHNldEltbWVkaWF0ZSA6IGZ1bmN0aW9uKGZuKSB7XG4gIHZhciBpZCA9IG5leHRJbW1lZGlhdGVJZCsrO1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cy5sZW5ndGggPCAyID8gZmFsc2UgOiBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgaW1tZWRpYXRlSWRzW2lkXSA9IHRydWU7XG5cbiAgbmV4dFRpY2soZnVuY3Rpb24gb25OZXh0VGljaygpIHtcbiAgICBpZiAoaW1tZWRpYXRlSWRzW2lkXSkge1xuICAgICAgLy8gZm4uY2FsbCgpIGlzIGZhc3RlciBzbyB3ZSBvcHRpbWl6ZSBmb3IgdGhlIGNvbW1vbiB1c2UtY2FzZVxuICAgICAgLy8gQHNlZSBodHRwOi8vanNwZXJmLmNvbS9jYWxsLWFwcGx5LXNlZ3VcbiAgICAgIGlmIChhcmdzKSB7XG4gICAgICAgIGZuLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm4uY2FsbChudWxsKTtcbiAgICAgIH1cbiAgICAgIC8vIFByZXZlbnQgaWRzIGZyb20gbGVha2luZ1xuICAgICAgZXhwb3J0cy5jbGVhckltbWVkaWF0ZShpZCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gaWQ7XG59O1xuXG5leHBvcnRzLmNsZWFySW1tZWRpYXRlID0gdHlwZW9mIGNsZWFySW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBjbGVhckltbWVkaWF0ZSA6IGZ1bmN0aW9uKGlkKSB7XG4gIGRlbGV0ZSBpbW1lZGlhdGVJZHNbaWRdO1xufTsiLCIvKiEgenpkb20gLSB2MC4yLjAgLSAyMDIwLTExLTEyIDEzOjMyOjUxICovXG4vKipcbiAqIEEgbmFtZXNwYWNlLlxuICogQGNvbnN0XG4gKi9cbnZhciB6ekRPTSA9IHt9O1xuXG4vKlxuICAgIHp6IGZ1bmN0aW9uXG4gICAgXG4gICAgenooICcjJywgJ2lkJyApO1xuICAgIHp6KCAnLicsICdjbGFzc05hbWUnICk7XG4gICAgenooICd0JywgJ3RhZ05hbWUnICk7XG4gICAgenooICd0bicsICduYW1lc3BhY2UnLCAndGFnTmFtZScgKTtcbiAgICB6eiggJ24nLCAnbmFtZScgKTtcbiAgICB6eiggJ3MnLCAnc3RyaW5nIHNlbGVjdG9yJyApO1xuICAgIHp6KCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2lkJyApICk7IC8vIEVsZW1lbnRcbiAgICB6eiggZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSggJ2NsYXNzTmFtZScgKSApOyAvLyBIVE1MQ29sbGVjdGlvblxuICAgIHp6KCBkb2N1bWVudC5nZXRFbGVtZW50c0J5TmFtZSggJ25hbWUnICkgKTsgLy8gTm9kZUxpc3RcbiAgICB6eiggJ3RhYmxlLmNsYXNzTmFtZSB0ciB0ZCcgKTsgLy8gU3RyaW5nIHNlbGVjdG9yXG4gICAgenooICc8ZGl2Pk5ldyBkaXY8L2Rpdj4nICk7IC8vIEhUTUwgY29kZSBpbiBzdHJpbmdcbiovXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfEVsZW1lbnR8SFRNTENvbGxlY3Rpb258Tm9kZUxpc3R9IHhcbiAqIEBwYXJhbSB7c3RyaW5nPX0gczFcbiAqIEBwYXJhbSB7c3RyaW5nPX0gczIgXG4gKi9cbnp6RE9NLnp6ID0gZnVuY3Rpb24oIHgsIHMxLCBzMiApe1xuICAgIFxuICAgIC8vIFJlZGVmaW5lIHggaWYgYSBzZWxlY3RvciBpZCBpcyBmb3VuZFxuICAgIGlmICggczEgKXtcbiAgICAgICAgc3dpdGNoICggeCApe1xuICAgICAgICBjYXNlICcjJzpcbiAgICAgICAgICAgIHggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggczEgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICcuJzpcbiAgICAgICAgICAgIHggPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCBzMSApO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3QnOlxuICAgICAgICAgICAgeCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCBzMSApO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RuJzpcbiAgICAgICAgICAgIHggPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZU5TKCBzMSwgczIgfHwgJycgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICduJzpcbiAgICAgICAgICAgIHggPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5TmFtZSggczEgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdzJzpcbiAgICAgICAgICAgIHggPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCBzMSApO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aHJvdyAnVW5zdXBwb3J0ZWQgc2VsZWN0b3IgaWQgZm91bmQgcnVubmluZyB6eiBmdW5jdGlvbjogJyArIHg7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gSXMgaXQgYW4gRWxlbWVudD9cbiAgICBpZiAoIHggaW5zdGFuY2VvZiBFbGVtZW50ICl7XG4gICAgICAgIHJldHVybiBuZXcgenpET00uU1MoIHggKTtcbiAgICB9XG4gICAgXG4gICAgLy8gSXMgaXQgYW4gSFRNTENvbGxlY3Rpb24gb3IgYSBOb2RlTGlzdD9cbiAgICBpZiAoIHggaW5zdGFuY2VvZiBIVE1MQ29sbGVjdGlvbiB8fCB4IGluc3RhbmNlb2YgTm9kZUxpc3QgKXtcbiAgICAgICAgcmV0dXJuIHp6RE9NLl9idWlsZCggeCApO1xuICAgIH1cbiAgICBcbiAgICBpZiAoIHR5cGVvZiB4ID09PSAnc3RyaW5nJyApe1xuICAgICAgICB4ID0geC50cmltKCk7XG4gICAgICAgIHJldHVybiB6ekRPTS5fYnVpbGQoXG4gICAgICAgICAgICB4LmNoYXJBdCggMCApID09PSAnPCc/IC8vIElzIGl0IEhUTUwgY29kZT9cbiAgICAgICAgICAgICAgICB6ekRPTS5faHRtbFRvRWxlbWVudCggeCApOlxuICAgICAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIHggKSAvLyBNdXN0IGJlIGEgc3RhbmRhcmQgc2VsZWN0b3JcbiAgICAgICAgKTtcbiAgICB9XG4gICAgXG4gICAgdGhyb3cgJ1Vuc3VwcG9ydGVkIHNlbGVjdG9yIHR5cGUgZm91bmQgcnVubmluZyB6eiBmdW5jdGlvbi4nO1xufTtcblxuLy8gQnVpbGQgYXJncyBhcnJheSB3aXRoIHRvSW5zZXJ0IGFzIGZpcnN0IHBvc2l0aW9uIGFuZCB0aGVuIHRoZSBhcmd1bWVudHMgb2YgdGhpcyBmdW5jdGlvblxuenpET00uX2FyZ3MgPSBmdW5jdGlvbiggcHJldmlvdXNBcmdzLCB0b0luc2VydCApe1xuICAgIHZhciByZXN1bHQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggcHJldmlvdXNBcmdzICk7XG4gICAgcmVzdWx0LnB1c2goIHRvSW5zZXJ0ICk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbnp6RE9NLl9idWlsZCA9IGZ1bmN0aW9uICggeCApIHtcbiAgICBpZiAoIHggaW5zdGFuY2VvZiBFbGVtZW50ICl7XG4gICAgICAgIHJldHVybiBuZXcgenpET00uU1MoIHggKTtcbiAgICB9XG4gICAgaWYgKCB4IGluc3RhbmNlb2YgSFRNTENvbGxlY3Rpb24gfHwgeCBpbnN0YW5jZW9mIE5vZGVMaXN0ICl7XG4gICAgICAgIHggPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggeCApO1xuICAgIH1cbiAgICByZXR1cm4geC5sZW5ndGggPT09IDE/IG5ldyB6ekRPTS5TUyggeFsgMCBdICk6IG5ldyB6ekRPTS5NTSggeCApO1xufTtcblxuenpET00uX2dldEVycm9yID0gZnVuY3Rpb24gKCBtZXRob2QgKSB7XG4gICAgcmV0dXJuICdNZXRob2QgXCInICsgbWV0aG9kICsgJ1wiIG5vdCByZWFkeSBmb3IgdGhhdCB0eXBlISc7XG59O1xuXG56ekRPTS5faHRtbFRvRWxlbWVudCA9IGZ1bmN0aW9uICggaHRtbCApIHtcbiAgICB2YXIgdGVtcGxhdGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAndGVtcGxhdGUnICk7XG4gICAgdGVtcGxhdGUuaW5uZXJIVE1MID0gaHRtbC50cmltKCk7XG4gICAgcmV0dXJuIHRlbXBsYXRlLmNvbnRlbnQuY2hpbGRFbGVtZW50Q291bnQgPT09IDE/XG4gICAgICAgIHRlbXBsYXRlLmNvbnRlbnQuZmlyc3RDaGlsZDpcbiAgICAgICAgdGVtcGxhdGUuY29udGVudC5jaGlsZE5vZGVzO1xufTtcblxuLy8gUmVnaXN0ZXIgenogZnVuY3Rpb25cbnZhciB6ejtcbihmdW5jdGlvbigpIHsgXG4gICAgenogPSB6ekRPTS56ejsgXG59KSgpO1xuXG56ekRPTS5fZXZlbnRzID0ge307XG5cbnp6RE9NLl9hZGRFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oIHNzLCBldmVudE5hbWUsIGxpc3RlbmVyLCB1c2VDYXB0dXJlICl7XG4gICAgdmFyIGVsID0gc3MuZWw7XG4gICAgdmFyIGVsSWQgPSBzcy5fZ2V0RWxJZCgpO1xuICAgIHZhciB0aGlzRXZlbnRzID0genpET00uX2V2ZW50c1sgZWxJZCBdO1xuICAgIGlmICggISB0aGlzRXZlbnRzICl7XG4gICAgICAgIHRoaXNFdmVudHMgPSB7fTtcbiAgICAgICAgenpET00uX2V2ZW50c1sgZWxJZCBdID0gdGhpc0V2ZW50cztcbiAgICB9XG4gICAgdmFyIHRoaXNMaXN0ZW5lcnMgPSB0aGlzRXZlbnRzWyBldmVudE5hbWUgXTtcbiAgICBpZiAoICEgdGhpc0xpc3RlbmVycyApe1xuICAgICAgICB0aGlzTGlzdGVuZXJzID0gW107XG4gICAgICAgIHRoaXNFdmVudHNbIGV2ZW50TmFtZSBdID0gdGhpc0xpc3RlbmVycztcbiAgICB9XG4gICAgdGhpc0xpc3RlbmVycy5wdXNoKCBsaXN0ZW5lciApO1xuICAgIFxuICAgIC8vIGFkZEV2ZW50TGlzdGVuZXJcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCBldmVudE5hbWUsIGxpc3RlbmVyLCB1c2VDYXB0dXJlICk7XG59O1xuXG4vL1RPRE8gbXVzdCByZW1vdmUgYWxsIGxpc3RlbmVycyB3aGVuIGFuIGVsZW1lbnQgaXMgcmVtb3ZlZFxuenpET00uX3JlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbiggc3MsIGV2ZW50TmFtZSwgbGlzdGVuZXIsIHVzZUNhcHR1cmUgKXtcbiAgICB2YXIgZWwgPSBzcy5lbDtcbiAgICB2YXIgZWxJZCA9IHNzLl9nZXRFbElkKCk7XG4gICAgdmFyIHRoaXNFdmVudHMgPSB6ekRPTS5fZXZlbnRzWyBlbElkIF07XG4gICAgaWYgKCAhIHRoaXNFdmVudHMgKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBpZiAoICEgZXZlbnROYW1lICl7IFxuICAgICAgICAvLyBNdXN0IHJlbW92ZSBhbGwgZXZlbnRzXG4gICAgICAgIGZvciAoIHZhciBjdXJyZW50RXZlbnROYW1lIGluIHRoaXNFdmVudHMgKXtcbiAgICAgICAgICAgIHZhciBjdXJyZW50TGlzdGVuZXJzID0gdGhpc0V2ZW50c1sgY3VycmVudEV2ZW50TmFtZSBdO1xuICAgICAgICAgICAgenpET00uX3JlbW92ZUxpc3RlbmVycyggZWwsIGN1cnJlbnRMaXN0ZW5lcnMsIG51bGwsIHVzZUNhcHR1cmUsIGN1cnJlbnRFdmVudE5hbWUgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIC8vIE11c3QgcmVtb3ZlIGxpc3RlbmVycyBvZiBvbmx5IG9uZSBldmVudFxuICAgIHZhciB0aGlzTGlzdGVuZXJzID0gdGhpc0V2ZW50c1sgZXZlbnROYW1lIF07XG4gICAgenpET00uX3JlbW92ZUxpc3RlbmVycyggZWwsIHRoaXNMaXN0ZW5lcnMsIGxpc3RlbmVyLCB1c2VDYXB0dXJlLCBldmVudE5hbWUgKTtcbn07XG5cbi8vVE9ETyB0ZXN0IGFsbCB0aGUgbGlzdGVuZXJzIGFyZSByZW1vdmVkXG56ekRPTS5fcmVtb3ZlTGlzdGVuZXJzID0gZnVuY3Rpb24oIGVsLCB0aGlzTGlzdGVuZXJzLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSwgZXZlbnROYW1lICl7XG4gICAgaWYgKCAhIHRoaXNMaXN0ZW5lcnMgKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCB0aGlzTGlzdGVuZXJzLmxlbmd0aDsgKytpICl7XG4gICAgICAgIHZhciBjdXJyZW50TGlzdGVuZXIgPSB0aGlzTGlzdGVuZXJzWyBpIF07XG4gICAgICAgIGlmICggISBsaXN0ZW5lciB8fCBjdXJyZW50TGlzdGVuZXIgPT09IGxpc3RlbmVyICl7XG4gICAgICAgICAgICB0aGlzTGlzdGVuZXJzLnNwbGljZSggaSwgMSApOyAvLyBEZWxldGUgbGlzdGVuZXIgYXQgaSBwb3NpdGlvblxuICAgICAgICAgICAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lciggZXZlbnROYW1lLCBjdXJyZW50TGlzdGVuZXIsIHVzZUNhcHR1cmUgKTtcbiAgICAgICAgICAgIGlmICggbGlzdGVuZXIgKXtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IFxufTtcbi8qIEVuZCBvZiBldmVudHMgKi9cblxuenpET00uX2RkID0ge307XG5cbnp6RE9NLl9nZXREZWZhdWx0RGlzcGxheSA9IGZ1bmN0aW9uKCBlbCApIHtcbiAgICB2YXIgbm9kZU5hbWUgPSBlbC5ub2RlTmFtZTtcbiAgICB2YXIgZGlzcGxheSA9IHp6RE9NLl9kZFsgbm9kZU5hbWUgXTtcblxuICAgIGlmICggZGlzcGxheSApIHtcbiAgICAgICAgcmV0dXJuIGRpc3BsYXk7XG4gICAgfVxuXG4gICAgdmFyIGRvYyA9IGVsLm93bmVyRG9jdW1lbnQ7XG4gICAgdmFyIHRlbXAgPSBkb2MuYm9keS5hcHBlbmRDaGlsZCggZG9jLmNyZWF0ZUVsZW1lbnQoIG5vZGVOYW1lICkgKTtcbiAgICBkaXNwbGF5ID0gZ2V0Q29tcHV0ZWRTdHlsZSggdGVtcCApWyAnZGlzcGxheScgXTtcblxuICAgIHRlbXAucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggdGVtcCApO1xuXG4gICAgaWYgKCBkaXNwbGF5ID09PSAnbm9uZScgKSB7XG4gICAgICAgIGRpc3BsYXkgPSAnYmxvY2snO1xuICAgIH1cbiAgICB6ekRPTS5fZGRbIG5vZGVOYW1lIF0gPSBkaXNwbGF5O1xuXG4gICAgcmV0dXJuIGRpc3BsYXk7XG59O1xuLyogRW5kIG9mIHZpc2libGUgKi9cblxuLyogSXQgZGVwZW5kcyBvbiBmb3JtcyBwbHVnaW4hICovXG4vLyBTZXJpYWxpemUgYSBzcyBpbnN0YW5jZSwgYSBtbSBpbnN0YW5jZSBvciBhbiBvYmplY3QgaW50byBhIHF1ZXJ5IHN0cmluZ1xuenpET00uX3BhcmFtSXRlbSA9IGZ1bmN0aW9uKCByLCBrZXksIHZhbHVlICkge1xuICAgIHIucHVzaCggXG4gICAgICAgIGVuY29kZVVSSUNvbXBvbmVudCgga2V5ICkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQoIHZhbHVlID09IG51bGw/ICcnOiB2YWx1ZSApXG4gICAgKTtcbn07XG4vKiogQG5vY29sbGFwc2UgKi9cbnp6RE9NLnBhcmFtID0gZnVuY3Rpb24oIHggKSB7XG5cdFxuICAgIGlmICggeCA9PSBudWxsICkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuXG4gICAgdmFyIHIgPSBbXTtcbiAgICBcbiAgICBpZiAoIHggaW5zdGFuY2VvZiB6ekRPTS5TUyApe1xuICAgICAgICB6ekRPTS5fcGFyYW1JdGVtKCByLCB4LmF0dHIoICduYW1lJyApLCB4LnZhbCgpICk7XG4gICAgfSBlbHNlIGlmICggeCBpbnN0YW5jZW9mIHp6RE9NLk1NICl7XG4gICAgICAgIGZvciAoIHZhciBjID0gMDsgYyA8IHgubGlzdC5sZW5ndGg7ICsrYyApe1xuICAgICAgICAgICAgdmFyIHNzID0geC5saXN0WyBjIF07XG4gICAgICAgICAgICB6ekRPTS5fcGFyYW1JdGVtKCByLCBzcy5hdHRyKCAnbmFtZScgKSwgc3MudmFsKCkgKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIHR5cGVvZiB4ID09PSAnb2JqZWN0JyApeyAgXG4gICAgICAgIGZvciAoIHZhciBpIGluIHggKSB7XG4gICAgICAgICAgICB6ekRPTS5fcGFyYW1JdGVtKCByLCBpLCB4WyBpIF0gKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IHp6RE9NLl9nZXRFcnJvciggJ3BhcmFtJyApO1xuICAgIH1cblxuICAgIHJldHVybiByLmpvaW4oICcmJyApO1xufTtcbi8qIGVuZCBvZiB1dGlscyAqL1xuXG4vKiogQGNvbnN0cnVjdG9yICovXG56ekRPTS5TUyA9IGZ1bmN0aW9uICggX2VsICkge1xuICAgIHRoaXMuZWwgPSBfZWw7XG4gICAgdGhpcy5ub2RlcyA9IFsgX2VsIF07XG4gICAgXG4gICAgLy8gQXJyYXkgbGlrZVxuICAgIHRoaXMubGVuZ3RoID0gMTtcbiAgICB0aGlzWyAwIF0gPSBfZWw7XG59O1xuXG4vKiBNZXRob2RzIE5PVCBpbmNsdWRlZCBpbiBqcXVlcnkgKi9cbnp6RE9NLlNTLnByb3RvdHlwZS5fZ2NzID0gZnVuY3Rpb24gKCBzZWxmLCBwcm9wZXJ0eSApIHtcbiAgICB2YXIgeCA9IGdldENvbXB1dGVkU3R5bGUoIHNlbGYuZWwsIG51bGwgKVsgcHJvcGVydHkgXS5yZXBsYWNlKCAncHgnLCAnJyApO1xuICAgIHJldHVybiBpc05hTiggeCApPyB4OiBwYXJzZUZsb2F0KCB4ICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuX2dldEVsSWQgPSBmdW5jdGlvbigpe1xuICAgIHZhciBlbElkID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWVsSWQnICk7XG4gICAgaWYgKCAhIGVsSWQgKXtcbiAgICAgICAgLy8gR2VuZXJhdGUgYSByYW5kb20gc3RyaW5nIHdpdGggNCBjaGFyc1xuICAgICAgICBlbElkID0gTWF0aC5mbG9vciggKCAxICsgTWF0aC5yYW5kb20oKSApICogMHgxMDAwMCApXG4gICAgICAgICAgICAudG9TdHJpbmcoIDE2IClcbiAgICAgICAgICAgIC5zdWJzdHJpbmcoIDEgKTtcbiAgICAgICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWVsSWQnLCBlbElkICk7XG4gICAgfVxuICAgIHJldHVybiBlbElkO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLl9pbnNlcnRIZWxwZXIgPSBmdW5jdGlvbiAoIHBvc2l0aW9uLCB4ICkge1xuICAgIGlmICggeCBpbnN0YW5jZW9mIEVsZW1lbnQgKXtcbiAgICAgICAgdGhpcy5lbC5pbnNlcnRBZGphY2VudEVsZW1lbnQoIHBvc2l0aW9uLCB4ICk7XG4gICAgfSBlbHNlIGlmICggeCBpbnN0YW5jZW9mIHp6RE9NLlNTICl7XG4gICAgICAgIHRoaXMuZWwuaW5zZXJ0QWRqYWNlbnRFbGVtZW50KCBwb3NpdGlvbiwgeC5lbCApO1xuICAgIH0gZWxzZSBpZiAoIHR5cGVvZiB4ID09PSAnc3RyaW5nJyApIHtcbiAgICAgICAgdGhpcy5lbC5pbnNlcnRBZGphY2VudEhUTUwoIHBvc2l0aW9uLCB4ICk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgJ0luc2VydCBvcGVyYXRpb24gbm90IHJlYWR5IGZvciB0aGF0IHR5cGUhJztcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuX2l0ZXJhdGUgPSBmdW5jdGlvbiggdmFsdWUsIGZuICl7XG4gICAgaWYgKCBBcnJheS5pc0FycmF5KCB2YWx1ZSApICl7XG4gICAgICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgKytpICl7XG4gICAgICAgICAgICBmbiggdGhpcywgdmFsdWVbIGkgXSApO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZm4oIHRoaXMsIHZhbHVlICk7ICAgXG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLl9vdXRlciA9IGZ1bmN0aW9uICggcHJvcGVydHksIGxpbmtlZDEsIGxpbmtlZDIsIHdpdGhNYXJnaW4gKSB7XG4gICAgaWYgKCB0aGlzLmVsWyAnb2Zmc2V0JyArIHByb3BlcnR5IF0gKSB7XG4gICAgICAgIHJldHVybiB6ekRPTS5TUy5fb3V0ZXJDYWxjKCB0aGlzLCBwcm9wZXJ0eSwgbGlua2VkMSwgbGlua2VkMiwgd2l0aE1hcmdpbiApO1xuICAgIH1cbiAgICBcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIHRoaXMuX3N3YXAoIFxuICAgICAgICB0aGlzLmVsLCBcbiAgICAgICAgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHJldHVybiB6ekRPTS5TUy5fb3V0ZXJDYWxjKCBzZWxmLCBwcm9wZXJ0eSwgbGlua2VkMSwgbGlua2VkMiwgd2l0aE1hcmdpbiApO1xuICAgICAgICB9IFxuICAgICk7XG59O1xuXG56ekRPTS5TUy5fb3V0ZXJDYWxjID0gZnVuY3Rpb24gKCBzcywgcHJvcGVydHksIGxpbmtlZDEsIGxpbmtlZDIsIHdpdGhNYXJnaW4gKSB7XG4gICAgdmFyIHZhbHVlID0gc3MuX2djcyggc3MsIHByb3BlcnR5LnRvTG93ZXJDYXNlKCkgKTtcbiAgICB2YXIgcGFkZGluZyA9IHNzLl9nY3MoIHNzLCAncGFkZGluZycgKyBsaW5rZWQxICkgKyBzcy5fZ2NzKCBzcywgJ3BhZGRpbmcnICsgbGlua2VkMiApO1xuICAgIHZhciBib3JkZXIgPSBzcy5fZ2NzKCBzcywgJ2JvcmRlcicgKyBsaW5rZWQxICsgJ1dpZHRoJyApICsgc3MuX2djcyggc3MsICdib3JkZXInICsgbGlua2VkMiArICdXaWR0aCcgKTtcbiAgICBcbiAgICB2YXIgdG90YWwgPSB2YWx1ZSArIHBhZGRpbmcgKyBib3JkZXI7XG4gICAgXG4gICAgLy8gTm8gbWFyZ2luXG4gICAgaWYgKCAhIHdpdGhNYXJnaW4gKXtcbiAgICAgICAgcmV0dXJuIHRvdGFsO1xuICAgIH1cbiAgICBcbiAgICB2YXIgbWFyZ2luID0gc3MuX2djcyggc3MsICdtYXJnaW4nICsgbGlua2VkMSApICsgc3MuX2djcyggc3MsICdtYXJnaW4nICsgbGlua2VkMiApO1xuICAgIHJldHVybiB0b3RhbCArIG1hcmdpbjtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5fc2V0Q3NzVXNpbmdLZXlWYWx1ZSA9IGZ1bmN0aW9uICgga2V5LCB2YWx1ZSApIHtcbiAgICBpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZS5jYWxsKCB0aGlzLmVsLCB0aGlzLl9pID09PSB1bmRlZmluZWQ/IDA6IHRoaXMuX2ksIHRoaXMgKTtcbiAgICB9XG4gICAgdGhpcy5lbC5zdHlsZVsga2V5IF0gPSBcbiAgICAgICAgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiAhIC9eLT9cXGQrXFwuP1xcZCokLy50ZXN0KCB2YWx1ZSApPyAvLyBpZiBpdCBpcyBhIHN0cmluZyBhbmQgaXMgbm90IGEgZmxvYXQgbnVtYmVyXG4gICAgICAgICAgICB2YWx1ZTogXG4gICAgICAgICAgICB2YWx1ZSArICdweCc7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuX3NldENzc1VzaW5nT2JqZWN0ID0gZnVuY3Rpb24gKCBvYmplY3QgKSB7XG4gICAgZm9yICggdmFyIGtleSBpbiBvYmplY3QgKSB7XG4gICAgICAgIHRoaXMuX3NldENzc1VzaW5nS2V5VmFsdWUoIGtleSwgb2JqZWN0WyBrZXkgXSApO1xuICAgIH1cbn07XG5cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd9IHByb3BlcnR5XG4gKiBAcGFyYW0ge3N0cmluZ3xGdW5jdGlvbj19IHZhbHVlXG4gKi9cbnp6RE9NLlNTLnByb3RvdHlwZS5fc3R5bGVQcm9wZXJ0eSA9IGZ1bmN0aW9uICggcHJvcGVydHksIHZhbHVlICkge1xuICAgIC8vIGdldFxuICAgIGlmICggdmFsdWUgPT09IHVuZGVmaW5lZCApe1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhbHVlID0gdGhpcy5fZ2NzKCB0aGlzLCBwcm9wZXJ0eSApO1xuICAgICAgICByZXR1cm4gcGFyc2VGbG9hdCggXG4gICAgICAgICAgICB2YWx1ZSAhPT0gJ2F1dG8nPyBcbiAgICAgICAgICAgICAgICB2YWx1ZTogXG4gICAgICAgICAgICAgICAgdGhpcy5fc3dhcCggXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZWwsIFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2djcyggc2VsZiwgcHJvcGVydHkgKTtcbiAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gc2V0XG4gICAgdGhpcy5fc2V0Q3NzVXNpbmdLZXlWYWx1ZSggcHJvcGVydHksIHZhbHVlICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuX3N3YXAgPSBmdW5jdGlvbiggX2VsLCBjYWxsYmFjayApIHtcbiAgICB2YXIgb2xkID0ge307XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgIGRpc3BsYXk6ICdibG9jaycsXG4gICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuICAgICAgICB2aXNpYmlsaXR5OiAnaGlkZGVuJ1xuICAgIH07XG5cbiAgICAvLyBSZW1lbWJlciB0aGUgb2xkIHZhbHVlcyBhbmQgaW5zZXJ0IHRoZSBuZXcgb25lc1xuICAgIGZvciAoIHZhciBuYW1lIGluIG9wdGlvbnMgKSB7XG4gICAgICAgIG9sZFsgbmFtZSBdID0gX2VsLnN0eWxlWyBuYW1lIF07XG4gICAgICAgIF9lbC5zdHlsZVsgbmFtZSBdID0gb3B0aW9uc1sgbmFtZSBdO1xuICAgIH1cblxuICAgIHZhciB2YWwgPSBjYWxsYmFjay5jYWxsKCBfZWwgKTtcblxuICAgIC8vIFJldmVydCB0aGUgb2xkIHZhbHVlc1xuICAgIGZvciAoIG5hbWUgaW4gb3B0aW9ucyApIHtcbiAgICAgICAgX2VsLnN0eWxlWyBuYW1lIF0gPSBvbGRbIG5hbWUgXTtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsO1xufTtcblxuLyogTWV0aG9kcyBpbmNsdWRlZCBpbiBqcXVlcnkgKi9cbnp6RE9NLlNTLnByb3RvdHlwZS5hZGRDbGFzcyA9IGZ1bmN0aW9uICggbmFtZSApIHtcbiAgICByZXR1cm4gdGhpcy5faXRlcmF0ZShcbiAgICAgICAgbmFtZSxcbiAgICAgICAgZnVuY3Rpb24oIHNlbGYsIHYgKXtcbiAgICAgICAgICAgIHNlbGYuZWwuY2xhc3NMaXN0LmFkZCggdiApOyBcbiAgICAgICAgfVxuICAgICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuYWZ0ZXIgPSBmdW5jdGlvbiAoIHggKSB7XG4gICAgcmV0dXJuIHRoaXMuX2luc2VydEhlbHBlciggJ2FmdGVyZW5kJywgeCApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmFwcGVuZCA9IGZ1bmN0aW9uICggeCApIHtcbiAgICBpZiAoIHggaW5zdGFuY2VvZiBFbGVtZW50ICl7XG4gICAgICAgIHRoaXMuZWwuYXBwZW5kQ2hpbGQoIHggKTtcbiAgICB9IGVsc2UgaWYgKCB4IGluc3RhbmNlb2YgenpET00uU1MgKXtcbiAgICAgICAgdGhpcy5lbC5hcHBlbmRDaGlsZCggeC5lbCApO1xuICAgIH0gZWxzZSBpZiAoIHR5cGVvZiB4ID09PSAnc3RyaW5nJyApIHtcbiAgICAgICAgdGhpcy5lbC5pbnNlcnRBZGphY2VudEhUTUwoICdiZWZvcmVlbmQnLCB4ICk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgenpET00uX2dldEVycm9yKCAnYXBwZW5kJyApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5hcHBlbmRUbyA9IGZ1bmN0aW9uICggeCApIHtcbiAgICAvLyBEbyBub3RoaW5nIGFuZCByZXR1cm4gdGhpcyBpZiBpdCBpcyBudWxsXG4gICAgaWYgKCB4ID09IG51bGwgKXtcbiAgICAgICAgcmV0dXJuIHRoaXM7ICAgIFxuICAgIH1cbiAgICBcbiAgICAvLyBJcyBpdCBhIEVsZW1lbnQ/XG4gICAgaWYgKCB4IGluc3RhbmNlb2YgRWxlbWVudCApe1xuICAgICAgICB4LmFwcGVuZENoaWxkKCB0aGlzLmVsICk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBcbiAgICAvLyBJcyBpdCBhIHN0cmluZz9cbiAgICBpZiAoIHR5cGVvZiB4ID09PSAnc3RyaW5nJyApe1xuICAgICAgICB4ID0genpET00uX2J1aWxkKFxuICAgICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggeCApXG4gICAgICAgICk7XG4gICAgfVxuICAgIFxuICAgIC8vIElzIGl0IGEgenpET00uU1M/XG4gICAgaWYgKCB4IGluc3RhbmNlb2YgenpET00uU1MgKSB7XG4gICAgICAgIHguZWwuYXBwZW5kQ2hpbGQoIHRoaXMuZWwgKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIFxuICAgIC8vIElzIGl0IGEgenpET00uTU0/XG4gICAgaWYgKCB4IGluc3RhbmNlb2YgenpET00uTU0gKSB7XG4gICAgICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHgubm9kZXMubGVuZ3RoOyArK2kgKXtcbiAgICAgICAgICAgIHgubm9kZXNbIGkgXS5hcHBlbmRDaGlsZCggdGhpcy5lbC5jbG9uZU5vZGUoIHRydWUgKSApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gXG4gICAgXG4gICAgdGhyb3cgenpET00uX2dldEVycm9yKCAnaXMnICk7XG59O1xuXG4vL1RPRE8gYWRkIHN1cHBvcnQgb2YgZnVuY3Rpb24gdHlwZSBpbiB2YWx1ZVxuLyoqXG4gKiBAcGFyYW0ge3N0cmluZ3xPYmplY3R9IHhcbiAqIEBwYXJhbSB7c3RyaW5nPX0gdmFsdWVcbiAqL1xuenpET00uU1MucHJvdG90eXBlLmF0dHIgPSBmdW5jdGlvbiAoIHgsIHZhbHVlICkge1xuICAgIC8vIHNldCB1c2luZyBvYmplY3RcbiAgICBpZiAoIHR5cGVvZiB4ID09PSAnb2JqZWN0JyApe1xuICAgICAgICBmb3IgKCB2YXIga2V5IGluIHggKSB7XG4gICAgICAgICAgICB0aGlzLmF0dHIoIGtleSwgeFsga2V5IF0gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgXG4gICAgLy8gZ2V0XG4gICAgaWYgKCB2YWx1ZSA9PT0gdW5kZWZpbmVkICl7XG4gICAgICAgIHJldHVybiB0aGlzLmVsLmdldEF0dHJpYnV0ZSggeCApO1xuICAgIH1cbiAgICBcbiAgICAvLyByZW1vdmUgYXR0clxuICAgIGlmICggdmFsdWUgPT09IG51bGwgKXtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVtb3ZlQXR0ciggeCApOyAgICBcbiAgICB9XG4gICAgXG4gICAgLy8gc2V0XG4gICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGUoIHgsIHZhbHVlICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuYmVmb3JlID0gZnVuY3Rpb24gKCB4ICkge1xuICAgIHJldHVybiB0aGlzLl9pbnNlcnRIZWxwZXIoICdiZWZvcmViZWdpbicsIHggKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5jaGlsZHJlbiA9IGZ1bmN0aW9uICggc2VsZWN0b3IgKSB7XG4gICAgcmV0dXJuIHp6RE9NLl9idWlsZCggXG4gICAgICAgIHNlbGVjdG9yP1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLmZpbHRlci5jYWxsKFxuICAgICAgICAgICAgICAgIHRoaXMuZWwuY2hpbGRyZW4sIFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCBjaGlsZCApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2hpbGQubWF0Y2hlcyggc2VsZWN0b3IgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApOlxuICAgICAgICAgICAgdGhpcy5lbC5jaGlsZHJlbiBcbiAgICApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCAgKSB7XG4gICAgcmV0dXJuIG5ldyB6ekRPTS5TUyggdGhpcy5lbC5jbG9uZU5vZGUoIHRydWUgKSApO1xufTtcblxuLy9UT0RPIGFkZCBzdXBwb3J0IG9mIGZ1bmN0aW9uIHR5cGUgaW4gdmFsdWVcbi8qKlxuICogQHBhcmFtIHtzdHJpbmd8T2JqZWN0fSB4MVxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyPX0geDJcbiAqL1xuenpET00uU1MucHJvdG90eXBlLmNzcyA9IGZ1bmN0aW9uICggeDEsIHgyICkge1xuICAgIHZhciBudW1iZXIgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIFxuICAgIGlmICggbnVtYmVyID09PSAxICl7XG4gICAgICAgIGlmICggISB4MSApe1xuICAgICAgICAgICAgdGhyb3cgJ051bGwgdmFsdWUgbm90IGFsbG93ZWQgaW4gY3NzIG1ldGhvZCEnO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBnZXRcbiAgICAgICAgaWYgKCB0eXBlb2YgeDEgPT09ICdzdHJpbmcnICkge1xuICAgICAgICAgICAgcmV0dXJuIGdldENvbXB1dGVkU3R5bGUoIHRoaXMuZWwgKVsgeDEgXTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gc2V0IHVzaW5nIG9iamVjdFxuICAgICAgICBpZiAoIHR5cGVvZiB4MSA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgICAgIHRoaXMuX3NldENzc1VzaW5nT2JqZWN0KCB4MSApO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRocm93ICdXcm9uZyB0eXBlIG9yIGFyZ3VtZW50IGluIGNzcyBtZXRob2QhJztcbiAgICB9XG4gICAgXG4gICAgLy8gc2V0IHVzaW5nIGtleSB2YWx1ZSBwYWlyXG4gICAgaWYgKCBudW1iZXIgPT09IDIgKXtcbiAgICAgICAgdGhpcy5fc2V0Q3NzVXNpbmdLZXlWYWx1ZSggeDEsIHgyICk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBcbiAgICB0aHJvdyAnV3JvbmcgbnVtYmVyIG9mIGFyZ3VtZW50cyBpbiBjc3MgbWV0aG9kISc7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuZWFjaCA9IGZ1bmN0aW9uICggZWFjaEZuICkge1xuICAgIGVhY2hGbi5jYWxsKCB0aGlzLmVsLCAwLCB0aGlzLCB0aGlzLm5vZGVzICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuZW1wdHkgPSBmdW5jdGlvbiAoICApIHtcbiAgICB3aGlsZSggdGhpcy5lbC5maXJzdENoaWxkICl7XG4gICAgICAgIHRoaXMuZWwucmVtb3ZlQ2hpbGQoIHRoaXMuZWwuZmlyc3RDaGlsZCApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5maWx0ZXIgPSBmdW5jdGlvbiAoIHggKSB7XG4gICAgaWYgKCB0eXBlb2YgeCA9PT0gJ3N0cmluZycgKXsgLy8gSXMgYSBzdHJpbmcgc2VsZWN0b3JcbiAgICAgICAgcmV0dXJuIHp6RE9NLl9idWlsZCggXG4gICAgICAgICAgICB0aGlzLmVsLm1hdGNoZXMoIHggKT8gWyB0aGlzLmVsIF06IFtdXG4gICAgICAgICk7XG4gICAgfVxuICAgIFxuICAgIGlmICggdHlwZW9mIHggPT09ICdmdW5jdGlvbicgKXsgLy8gSXMgYSBmdW5jdGlvblxuICAgICAgICByZXR1cm4genpET00uX2J1aWxkKFxuICAgICAgICAgICAgeC5jYWxsKCB0aGlzLmVsLCB0aGlzLl9pID09PSB1bmRlZmluZWQ/IDA6IHRoaXMuX2ksIHRoaXMgKT8gWyB0aGlzLmVsIF06IFtdXG4gICAgICAgICk7XG4gICAgfSAgXG4gICAgXG4gICAgdGhyb3cgenpET00uX2dldEVycm9yKCAnZmlsdGVyJyApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbiAoIHNlbGVjdG9yICkge1xuICAgIHJldHVybiB6ekRPTS5fYnVpbGQoIFxuICAgICAgICB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoIHNlbGVjdG9yIClcbiAgICApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmhhc0NsYXNzID0gZnVuY3Rpb24gKCBuYW1lICkge1xuICAgIHJldHVybiB0aGlzLmVsLmNsYXNzTGlzdC5jb250YWlucyggbmFtZSApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLmhlaWdodCA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0eWxlUHJvcGVydHkoICdoZWlnaHQnLCB2YWx1ZSApO1xufTtcblxuLy9UT0RPIGFkZCBzdXBwb3J0IG9mIGZ1bmN0aW9uIHR5cGUgaW4gdmFsdWVcbnp6RE9NLlNTLnByb3RvdHlwZS5odG1sID0gZnVuY3Rpb24gKCB2YWx1ZSApIHtcbiAgICAvLyBnZXRcbiAgICBpZiAoIHZhbHVlID09PSB1bmRlZmluZWQgKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuZWwuaW5uZXJIVE1MO1xuICAgIH1cblxuICAgIC8vIHNldFxuICAgIHRoaXMuZWwuaW5uZXJIVE1MID0gdmFsdWU7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuaW5kZXggPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCAhIHRoaXMuZWwgKXtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgICBcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIGN1cnJlbnRFbCA9IHRoaXMuZWw7XG4gICAgZG8ge1xuICAgICAgICBpKys7XG4gICAgfSB3aGlsZSAoIGN1cnJlbnRFbCA9IGN1cnJlbnRFbC5wcmV2aW91c0VsZW1lbnRTaWJsaW5nICk7XG4gICAgXG4gICAgcmV0dXJuIGk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuaXMgPSBmdW5jdGlvbiAoIHggKSB7XG4gICAgaWYgKCB4ID09IG51bGwgKXtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAgICBcbiAgICB9XG4gICAgXG4gICAgaWYgKCB4IGluc3RhbmNlb2YgRWxlbWVudCApe1xuICAgICAgICByZXR1cm4gdGhpcy5lbCA9PT0geDtcbiAgICB9XG4gICAgXG4gICAgaWYgKCB4IGluc3RhbmNlb2YgenpET00uU1MgKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmVsID09PSB4LmVsO1xuICAgIH0gXG5cbiAgICBpZiAoIHggaW5zdGFuY2VvZiB6ekRPTS5NTSApIHtcbiAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgeC5ub2Rlcy5sZW5ndGg7ICsraSApe1xuICAgICAgICAgICAgaWYgKCB0aGlzLmVsID09PSB4Lm5vZGVzWyBpIF0gKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBcblxuICAgIGlmICggdHlwZW9mIHggPT09ICdzdHJpbmcnICl7XG4gICAgICAgIHJldHVybiB0aGlzLmVsLm1hdGNoZXMoIHggKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLm5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyB6ekRPTS5TUyggdGhpcy5lbC5uZXh0RWxlbWVudFNpYmxpbmcgKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5vZmZzZXQgPSBmdW5jdGlvbiAoIGMgKSB7XG4gICAgXG4gICAgLy8gc2V0IHRvcCBhbmQgbGVmdCB1c2luZyBjc3NcbiAgICBpZiAoIGMgKXtcbiAgICAgICAgdGhpcy5fc3R5bGVQcm9wZXJ0eSggJ3RvcCcsIGMudG9wICk7XG4gICAgICAgIHRoaXMuX3N0eWxlUHJvcGVydHkoICdsZWZ0JywgYy5sZWZ0ICk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBcbiAgICAvLyBnZXRcbiAgICB2YXIgcmVjdCA9IHRoaXMuZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiByZWN0LnRvcCArIGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wLFxuICAgICAgICBsZWZ0OiByZWN0LmxlZnQgKyBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnRcbiAgICB9O1xufTtcblxuenpET00uU1MucHJvdG90eXBlLm9mZnNldFBhcmVudCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgb2Zmc2V0UGFyZW50ID0gdGhpcy5lbC5vZmZzZXRQYXJlbnQ7XG4gICAgcmV0dXJuIG9mZnNldFBhcmVudD8gbmV3IHp6RE9NLlNTKCBvZmZzZXRQYXJlbnQgKTogdGhpcztcbn07XG5cbi8qKlxuICogQHBhcmFtIHtib29sZWFuPX0gd2l0aE1hcmdpblxuICovXG56ekRPTS5TUy5wcm90b3R5cGUub3V0ZXJIZWlnaHQgPSBmdW5jdGlvbiAoIHdpdGhNYXJnaW4gKSB7XG4gICAgcmV0dXJuIHRoaXMuX291dGVyKCAnSGVpZ2h0JywgJ1RvcCcsICdCb3R0b20nLCB3aXRoTWFyZ2luICk7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7Ym9vbGVhbj19IHdpdGhNYXJnaW5cbiAqL1xuenpET00uU1MucHJvdG90eXBlLm91dGVyV2lkdGggPSBmdW5jdGlvbiAoIHdpdGhNYXJnaW4gKSB7XG4gICAgcmV0dXJuIHRoaXMuX291dGVyKCAnV2lkdGgnLCAnTGVmdCcsICdSaWdodCcsIHdpdGhNYXJnaW4gKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5wYXJlbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyB6ekRPTS5TUyggdGhpcy5lbC5wYXJlbnROb2RlICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUucG9zaXRpb24gPSBmdW5jdGlvbiAoIHJlbGF0aXZlVG9WaWV3cG9ydCApIHtcbiAgICByZXR1cm4gcmVsYXRpdmVUb1ZpZXdwb3J0P1xuICAgICAgICB0aGlzLmVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpOlxuICAgICAgICB7IFxuICAgICAgICAgICAgbGVmdDogdGhpcy5lbC5vZmZzZXRMZWZ0LCBcbiAgICAgICAgICAgIHRvcDogdGhpcy5lbC5vZmZzZXRUb3BcbiAgICAgICAgfTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5wcmVwZW5kID0gZnVuY3Rpb24gKCB4ICkge1xuICAgIGlmICggeCBpbnN0YW5jZW9mIEVsZW1lbnQgKXtcbiAgICAgICAgdGhpcy5lbC5pbnNlcnRCZWZvcmUoIHgsIHRoaXMuZWwuZmlyc3RDaGlsZCApO1xuICAgIH0gZWxzZSBpZiAoIHggaW5zdGFuY2VvZiB6ekRPTS5TUyApe1xuICAgICAgICB0aGlzLmVsLmluc2VydEJlZm9yZSggeC5lbCwgdGhpcy5lbC5maXJzdENoaWxkICk7XG4gICAgfSBlbHNlIGlmICggdHlwZW9mIHggPT09ICdzdHJpbmcnICl7XG4gICAgICAgIHRoaXMuZWwuaW5zZXJ0QWRqYWNlbnRIVE1MKCAnYWZ0ZXJiZWdpbicsIHggKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyB6ekRPTS5fZ2V0RXJyb3IoICdwcmVwZW5kJyApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5wcmV2ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgenpET00uU1MoIHRoaXMuZWwucHJldmlvdXNFbGVtZW50U2libGluZyApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIHRoaXMuZWwgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5yZW1vdmVBdHRyID0gZnVuY3Rpb24gKCBuYW1lICkge1xuICAgIHRoaXMuZWwucmVtb3ZlQXR0cmlidXRlKCBuYW1lICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUucmVtb3ZlQ2xhc3MgPSBmdW5jdGlvbiAoIG5hbWUgKSB7XG4gICAgaWYgKCAhIG5hbWUgKXtcbiAgICAgICAgdGhpcy5lbC5jbGFzc05hbWUgPSAnJztcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB0aGlzLl9pdGVyYXRlKFxuICAgICAgICBuYW1lLFxuICAgICAgICBmdW5jdGlvbiggc2VsZiwgdiApe1xuICAgICAgICAgICAgc2VsZi5lbC5jbGFzc0xpc3QucmVtb3ZlKCB2ICk7XG4gICAgICAgIH1cbiAgICApO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnJlcGxhY2VXaXRoID0gZnVuY3Rpb24gKCB2YWx1ZSApIHtcbiAgICB0aGlzLmVsLm91dGVySFRNTCA9IHZhbHVlO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnNpYmxpbmdzID0gZnVuY3Rpb24gKCBzZWxlY3RvciApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIG5vZGVzID0gQXJyYXkucHJvdG90eXBlLmZpbHRlci5jYWxsKCBcbiAgICAgICAgdGhpcy5lbC5wYXJlbnROb2RlLmNoaWxkcmVuLCBcbiAgICAgICAgc2VsZWN0b3I/XG4gICAgICAgICAgICBmdW5jdGlvbiggY2hpbGQgKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hpbGQgIT09IHNlbGYuZWwgJiYgY2hpbGQubWF0Y2hlcyggc2VsZWN0b3IgKTtcbiAgICAgICAgICAgIH06XG4gICAgICAgICAgICBmdW5jdGlvbiggY2hpbGQgKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hpbGQgIT09IHNlbGYuZWw7XG4gICAgICAgICAgICB9XG4gICAgKTtcbiAgICByZXR1cm4genpET00uX2J1aWxkKCBub2RlcyApO1xufTtcblxuLy9UT0RPIGFkZCBzdXBwb3J0IG9mIGZ1bmN0aW9uIHR5cGUgaW4gdmFsdWVcbnp6RE9NLlNTLnByb3RvdHlwZS50ZXh0ID0gZnVuY3Rpb24gKCB2YWx1ZSApIHtcbiAgICAvLyBnZXRcbiAgICBpZiAoIHZhbHVlID09PSB1bmRlZmluZWQgKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuZWwudGV4dENvbnRlbnQ7XG4gICAgfVxuXG4gICAgLy8gc2V0XG4gICAgdGhpcy5lbC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnRvZ2dsZUNsYXNzID0gZnVuY3Rpb24gKCBuYW1lLCBzdGF0ZSApIHtcbiAgICByZXR1cm4gdGhpcy5faXRlcmF0ZShcbiAgICAgICAgbmFtZSxcbiAgICAgICAgc3RhdGUgPT09IHVuZGVmaW5lZD9cbiAgICAgICAgICAgIGZ1bmN0aW9uKCBzZWxmLCB2ICl7XG4gICAgICAgICAgICAgICAgc2VsZi5lbC5jbGFzc0xpc3QudG9nZ2xlKCB2ICk7XG4gICAgICAgICAgICB9OlxuICAgICAgICAgICAgZnVuY3Rpb24oIHNlbGYsIHYgKXtcbiAgICAgICAgICAgICAgICBzZWxmLmVsLmNsYXNzTGlzdC50b2dnbGUoIHYsIHN0YXRlICk7XG4gICAgICAgICAgICB9XG4gICAgKTtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS53aWR0aCA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0eWxlUHJvcGVydHkoICd3aWR0aCcsIHZhbHVlICk7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24gKCBldmVudE5hbWUsIGxpc3RlbmVyLCB1c2VDYXB0dXJlICkge1xuICAgIHp6RE9NLl9yZW1vdmVFdmVudExpc3RlbmVyKCB0aGlzLCBldmVudE5hbWUsIGxpc3RlbmVyLCB1c2VDYXB0dXJlICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUub24gPSBmdW5jdGlvbiAoIGV2ZW50TmFtZSwgbGlzdGVuZXIsIGRhdGEsIHVzZUNhcHR1cmUgKSB7XG4gICAgenpET00uX2FkZEV2ZW50TGlzdGVuZXIoIFxuICAgICAgICB0aGlzLCBcbiAgICAgICAgZXZlbnROYW1lLCBcbiAgICAgICAgZGF0YT8gXG4gICAgICAgICAgICBmdW5jdGlvbiggZSApe1xuICAgICAgICAgICAgICAgIGUuZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxpc3RlbmVyLmNhbGwoIGUuY3VycmVudFRhcmdldCwgZSApO1xuICAgICAgICAgICAgfTpcbiAgICAgICAgICAgIGxpc3RlbmVyLCBcbiAgICAgICAgdXNlQ2FwdHVyZSBcbiAgICApO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuenpET00uU1MucHJvdG90eXBlLnRyaWdnZXIgPSBmdW5jdGlvbiAoIGV2ZW50TmFtZSApIHtcbiAgICB2YXIgZXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0hUTUxFdmVudHMnICk7XG4gICAgZXZlbnQuaW5pdEV2ZW50KCBldmVudE5hbWUsIHRydWUsIGZhbHNlICk7XG4gICAgdGhpcy5lbC5kaXNwYXRjaEV2ZW50KCBldmVudCApO1xuICAgIHJldHVybiB0aGlzO1xufTtcbi8qIEVuZCBvZiBldmVudHMgKi9cblxuenpET00uU1MucHJvdG90eXBlLmhpZGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCB0aGlzLmlzVmlzaWJsZSgpICl7XG4gICAgICAgIHRoaXMuYXR0ciggXG4gICAgICAgICAgICAnZGF0YS1kaXNwbGF5JywgXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKCB0aGlzLmVsLCBudWxsIClbICdkaXNwbGF5JyBdXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuaXNWaXNpYmxlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAhISB0aGlzLmVsLm9mZnNldFBhcmVudDtcbiAgICAvL3JldHVybiBnZXRDb21wdXRlZFN0eWxlKCB0aGlzLmVsLCBudWxsICkuZ2V0UHJvcGVydHlWYWx1ZSggJ2Rpc3BsYXknICkgIT09ICdub25lJztcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5zaG93ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICggISB0aGlzLmlzVmlzaWJsZSgpICl7XG4gICAgICAgIHZhciBkaXNwbGF5ID0gdGhpcy5hdHRyKCAnZGF0YS1kaXNwbGF5JyApO1xuICAgICAgICB0aGlzLmVsLnN0eWxlLmRpc3BsYXkgPSBkaXNwbGF5PyBkaXNwbGF5OiB6ekRPTS5fZ2V0RGVmYXVsdERpc3BsYXkoIHRoaXMuZWwgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUudG9nZ2xlID0gZnVuY3Rpb24gKCBzdGF0ZSApIHtcbiAgICB2YXIgdmFsdWUgPSBzdGF0ZSAhPT0gdW5kZWZpbmVkPyAhIHN0YXRlOiB0aGlzLmlzVmlzaWJsZSgpO1xuICAgIHJldHVybiB2YWx1ZT8gdGhpcy5oaWRlKCk6IHRoaXMuc2hvdygpO1xufTtcbi8qIEVuZCBvZiB2aXNpYmxlICovXG5cbnp6RE9NLlNTLnByb3RvdHlwZS5jaGVja2VkID0gZnVuY3Rpb24gKCBjaGVjayApIHtcbiAgICBpZiAoIHRoaXMuZWwubm9kZU5hbWUgIT09ICdJTlBVVCcgfHwgKCB0aGlzLmVsLnR5cGUgIT09ICdjaGVja2JveCcgJiYgdGhpcy5lbC50eXBlICE9PSAncmFkaW8nKSApIHtcbiAgICAgICAgdGhyb3cgenpET00uX2dldEVycm9yKCAnY2hlY2tlZCcgKTtcbiAgICB9XG4gICAgXG4gICAgLy8gZ2V0XG4gICAgaWYgKCBjaGVjayA9PT0gdW5kZWZpbmVkICl7XG4gICAgICAgIHJldHVybiAhISB0aGlzLmVsLmNoZWNrZWQ7XG4gICAgfVxuICAgIFxuICAgIC8vIHNldFxuICAgIHRoaXMuZWwuY2hlY2tlZCA9IGNoZWNrO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge0FycmF5PD8+fFN0cmluZz19IHZhbHVlXG4gKi9cbnp6RE9NLlNTLnByb3RvdHlwZS52YWwgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuICAgIC8vIGdldFxuICAgIGlmICggdmFsdWUgPT09IHVuZGVmaW5lZCApe1xuICAgICAgICBzd2l0Y2ggKCB0aGlzLmVsLm5vZGVOYW1lICkge1xuICAgICAgICBjYXNlICdJTlBVVCc6XG4gICAgICAgIGNhc2UgJ1RFWFRBUkVBJzpcbiAgICAgICAgY2FzZSAnQlVUVE9OJzpcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmVsLnZhbHVlO1xuICAgICAgICBjYXNlICdTRUxFQ1QnOlxuICAgICAgICAgICAgdmFyIHZhbHVlcyA9IFtdO1xuICAgICAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgdGhpcy5lbC5sZW5ndGg7ICsraSApIHtcbiAgICAgICAgICAgICAgICBpZiAoIHRoaXMuZWxbIGkgXS5zZWxlY3RlZCApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzLnB1c2goIHRoaXMuZWxbIGkgXS52YWx1ZSApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB2YWx1ZXMubGVuZ3RoID4gMT8gdmFsdWVzOiB2YWx1ZXNbIDAgXTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRocm93IHp6RE9NLl9nZXRFcnJvciggJ3ZhbCcgKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBzZXRcbiAgICBzd2l0Y2ggKCB0aGlzLmVsLm5vZGVOYW1lICkge1xuICAgIGNhc2UgJ0lOUFVUJzpcbiAgICBjYXNlICdURVhUQVJFQSc6XG4gICAgY2FzZSAnQlVUVE9OJzpcbiAgICAgICAgdGhpcy5lbC52YWx1ZSA9IHZhbHVlO1xuICAgICAgICBicmVhaztcbiAgICBjYXNlICdTRUxFQ1QnOlxuICAgICAgICBpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyApIHtcbiAgICAgICAgICAgIHZhbHVlID0gWyB2YWx1ZSBdO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoIGkgPSAwOyBpIDwgdGhpcy5lbC5sZW5ndGg7ICsraSApIHtcbiAgICAgICAgICAgIGZvciAoIHZhciBqID0gMDsgaiA8IHZhbHVlLmxlbmd0aDsgKytqICkge1xuICAgICAgICAgICAgICAgIHRoaXMuZWxbIGkgXS5zZWxlY3RlZCA9ICcnO1xuICAgICAgICAgICAgICAgIGlmICggdGhpcy5lbFsgaSBdLnZhbHVlID09PSB2YWx1ZVsgaiBdICkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVsWyBpIF0uc2VsZWN0ZWQgPSAnc2VsZWN0ZWQnO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgenpET00uX2dldEVycm9yKCAndmFsJyApO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gdGhpcztcbn07XG4vKiBFbmQgb2YgZm9ybXMgKi9cblxuenpET00uU1MucHJvdG90eXBlLmdldFhDZW50ZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGggLSB0aGlzLm91dGVyV2lkdGgoKSApIC8gMjtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5nZXRZQ2VudGVyID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICggZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodCAtIHRoaXMub3V0ZXJIZWlnaHQoKSApIC8gMjtcbn07XG5cbnp6RE9NLlNTLnByb3RvdHlwZS5nZXRDZW50ZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBsZWZ0OiB0aGlzLmdldFhDZW50ZXIoKSxcbiAgICAgICAgdG9wOiB0aGlzLmdldFlDZW50ZXIoKVxuICAgIH07XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuY2VudGVyID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5vZmZzZXQoIFxuICAgICAgICB0aGlzLmdldENlbnRlcigpIFxuICAgICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuY2VudGVyWCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY3NzKCAnbGVmdCcsIHRoaXMuZ2V0WENlbnRlcigpICk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG56ekRPTS5TUy5wcm90b3R5cGUuY2VudGVyWSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY3NzKCAndG9wJywgdGhpcy5nZXRZQ2VudGVyKCkgKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG4vKiBFbmQgb2YgY2VudGVyICovXG5cbi8qKiBAY29uc3RydWN0b3IgKi9cbnp6RE9NLk1NID0gZnVuY3Rpb24gKCBfbm9kZXMgKSB7ICAgIFxuICAgIHRoaXMubGlzdCA9IFtdO1xuICAgIHRoaXMubm9kZXMgPSBfbm9kZXM7XG4gICAgdGhpcy5sZW5ndGggPSBfbm9kZXMubGVuZ3RoO1xuICAgIFxuICAgIC8vIEluaXQgbm9kZXNcbiAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICB2YXIgZWwgPSB0aGlzLm5vZGVzWyBpIF07XG4gICAgICAgIHRoaXNbIGkgXSA9IGVsOyAvLyBmb3IgYXJyYXkgbGlrZVxuICAgICAgICB2YXIgc3MgPSBuZXcgenpET00uU1MoIGVsICk7XG4gICAgICAgIHRoaXMubGlzdC5wdXNoKCBzcyApO1xuICAgICAgICBzcy5faSA9IGk7IC8vIGZvciBpbmRleCBpbiBmdW5jdGlvbnNcbiAgICB9XG59O1xuXG4vKlxuVW5pZnkgdGhlIGRlZmluaXRpb24gb2YgYSBmdW5jdGlvbiBvZiB6ekRPTS5TUy5wcm90b3R5cGUgYW5kIGEgZGVmaW5pdGlvbiBvZiB6ekRPTS5NTS5wcm90b3R5cGUuIEV4YW1wbGU6XG5cbiAgICB6ekRPTS5hZGQoIFxuICAgICAgICB6ekRPTS5TUy5wcm90b3R5cGUubXlDdXN0b21GdW5jdGlvbiA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAuLi5cbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuICAgICAgICB6ekRPTS5NTS5jb25zdHJ1Y3RvcnMuY29uY2F0XG4gICAgKTtcbik7XG4qL1xuLyoqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBzc1Byb3RvdHlwZVxuICogQHBhcmFtIHtGdW5jdGlvbj19IGNvbnN0cnVjdG9yXG4gKi9cbnp6RE9NLmFkZCA9IGZ1bmN0aW9uKCBzc1Byb3RvdHlwZSwgY29uc3RydWN0b3IgKXtcbiAgICBmb3IgKCB2YXIgaWQgaW4genpET00uU1MucHJvdG90eXBlICl7XG4gICAgICAgIHZhciBjdXJyZW50ID0genpET00uU1MucHJvdG90eXBlWyBpZCBdO1xuICAgICAgICBpZiAoIHNzUHJvdG90eXBlID09PSBjdXJyZW50ICl7XG4gICAgICAgICAgICB2YXIgY2xvc3VyZSA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgdmFyIGZ1bmN0aW9uSWQgPSBpZDtcbiAgICAgICAgICAgICAgICByZXR1cm4gY29uc3RydWN0b3I/IGNvbnN0cnVjdG9yKCBmdW5jdGlvbklkICk6IHp6RE9NLk1NLmNvbnN0cnVjdG9ycy5kZWZhdWx0KCBmdW5jdGlvbklkICk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgenpET00uTU0ucHJvdG90eXBlWyBpZCBdID0gY2xvc3VyZSgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIHRocm93ICdFcnJvciByZWdpc3RlcmluZyB6ekRPTS5NTTogenpET00uU1Mgbm90IGZvdW5kLic7XG59O1xuXG56ekRPTS5NTS5jb25zdHJ1Y3RvcnMgPSB7fTtcbnp6RE9NLk1NLmNvbnN0cnVjdG9ycy5ib29sZWFuT3IgPSBmdW5jdGlvbiggZnVuY3Rpb25JZCApe1xuICAgIHJldHVybiBmdW5jdGlvbigpe1xuICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmxpc3QubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgICAgICB2YXIgc3MgPSB0aGlzLmxpc3RbIGkgXTtcbiAgICAgICAgICAgIHZhciB4ID0gc3NbIGZ1bmN0aW9uSWQgXS5hcHBseSggc3MsIGFyZ3VtZW50cyApO1xuICAgICAgICAgICAgaWYgKCB4ICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG59O1xuenpET00uTU0uY29uc3RydWN0b3JzLmNvbmNhdCA9IGZ1bmN0aW9uKCBmdW5jdGlvbklkICl7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBuZXdOb2RlcyA9IFtdO1xuICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmxpc3QubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgICAgICB2YXIgc3MgPSB0aGlzLmxpc3RbIGkgXTtcbiAgICAgICAgICAgIHZhciB4ID0gc3NbIGZ1bmN0aW9uSWQgXS5hcHBseSggc3MsIGFyZ3VtZW50cyApO1xuICAgICAgICAgICAgbmV3Tm9kZXMgPSBuZXdOb2Rlcy5jb25jYXQoIHgubm9kZXMgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4genpET00uX2J1aWxkKCBuZXdOb2RlcyApO1xuICAgIH07XG59O1xuenpET00uTU0uY29uc3RydWN0b3JzLmRlZmF1bHQgPSBmdW5jdGlvbiggZnVuY3Rpb25JZCApe1xuICAgIHJldHVybiBmdW5jdGlvbigpe1xuICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCB0aGlzLmxpc3QubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgICAgICB2YXIgc3MgPSB0aGlzLmxpc3RbIGkgXTtcbiAgICAgICAgICAgIHZhciByID0gc3NbIGZ1bmN0aW9uSWQgXS5hcHBseSggc3MsIGFyZ3VtZW50cyApO1xuICAgICAgICAgICAgaWYgKCBpID09PSAwICYmICEgKCByIGluc3RhbmNlb2YgenpET00uU1MgKSApe1xuICAgICAgICAgICAgICAgIHJldHVybiByO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG59O1xuXG4vLyBJbml0IHByb3RvdHlwZSBmdW5jdGlvbnMgZnJvbSB6ekRPTS5TU1xuenpET00uTU0uaW5pdCA9IGZ1bmN0aW9uKCl7XG4gICAgLy8gQ29uY2F0IGZ1bmN0aW9uc1xuICAgIHZhciBjb25jYXRGID0gW1xuICAgICAgICAnY2hpbGRyZW4nLFxuICAgICAgICAnY2xvbmUnLFxuICAgICAgICAnZmlsdGVyJyxcbiAgICAgICAgJ2ZpbmQnLFxuICAgICAgICAnbmV4dCcsXG4gICAgICAgICdvZmZzZXRQYXJlbnQnLFxuICAgICAgICAncGFyZW50JyxcbiAgICAgICAgJ3ByZXYnLFxuICAgICAgICAnc2libGluZ3MnXG4gICAgXTtcbiAgICAvLyBCb29sZWFuIGZ1bmN0aW9uc1xuICAgIHZhciBib29sZWFuT3JGID0gW1xuICAgICAgICAnaGFzQ2xhc3MnLFxuICAgICAgICAnaXMnXG4gICAgXTtcbiAgICBmb3IgKCB2YXIgaWQgaW4genpET00uU1MucHJvdG90eXBlICl7XG4gICAgICAgIHZhciBjbG9zdXJlID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHZhciBmdW5jdGlvbklkID0gaWQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICggY29uY2F0Ri5pbmRleE9mKCBmdW5jdGlvbklkICkgIT09IC0xICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHp6RE9NLk1NLmNvbnN0cnVjdG9ycy5jb25jYXQoIGZ1bmN0aW9uSWQgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICggYm9vbGVhbk9yRi5pbmRleE9mKCBmdW5jdGlvbklkICkgIT09IC0xICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHp6RE9NLk1NLmNvbnN0cnVjdG9ycy5ib29sZWFuT3IoIGZ1bmN0aW9uSWQgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB6ekRPTS5NTS5jb25zdHJ1Y3RvcnMuZGVmYXVsdCggZnVuY3Rpb25JZCApO1xuICAgICAgICB9O1xuICAgICAgICB6ekRPTS5NTS5wcm90b3R5cGVbIGlkIF0gPSBjbG9zdXJlKCk7XG4gICAgfVxufSgpO1xuXG4vKiBNZXRob2RzIGluY2x1ZGVkIGluIGpxdWVyeSAqL1xuenpET00uTU0ucHJvdG90eXBlLmVhY2ggPSBmdW5jdGlvbiAoIGVhY2hGbiApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggXG4gICAgICAgIHRoaXMubGlzdCwgXG4gICAgICAgIGZ1bmN0aW9uKCBjdXJyZW50VmFsdWUsIGluZGV4ICl7XG4gICAgICAgICAgICBlYWNoRm4uY2FsbCggY3VycmVudFZhbHVlLmVsLCBpbmRleCwgY3VycmVudFZhbHVlLCBzZWxmLm5vZGVzICk7XG4gICAgICAgIH1cbiAgICApO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuLy8gUmVnaXN0ZXIgenpET00gaWYgd2UgYXJlIHVzaW5nIE5vZGVcbmlmICggdHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMgKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB6ekRPTTtcbn1cbiIsInZhciB6ekRPTSA9IHJlcXVpcmUoJy4vYnVpbGQvenpET00tY2xvc3VyZXMtZnVsbC5qcycpO1xubW9kdWxlLmV4cG9ydHMgPSB6ekRPTS56ejtcbiIsImNvbnN0IG5hdmlnYXRpb24gPSB7fTtcblxudmFyIHp6ID0gcmVxdWlyZSggJ3p6ZG9tJyApO1xudmFyIHV0aWxzID0gcmVxdWlyZSggJy4vdXRpbHMuanMnICk7XG5cbi8vIFVuaXQgdGVzdHNcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuXG4gICAgUVVuaXQudGVzdCggXCJTaW1wbGUgbmF2aWdhdGlvbiB0ZXN0XCIsIGFzeW5jIGZ1bmN0aW9uKCBhc3NlcnQgKSB7XG4gICAgICAgIFxuICAgICAgICAvLyBHZXQgYSByZWZlcmVuY2UgdG8gZmluaXNoIHRoZSBxdW5pdCB0ZXN0IGxhdGVyXG4gICAgICAgIHZhciBkb25lID0gYXNzZXJ0LmFzeW5jKCk7XG4gICAgICAgIGRlYnVnZ2VyO1xuXG4gICAgICAgIC8vIFN0YXJ0IHRlc3RpbmdcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI2hvbWVfcGFnZTFMaW5rJykuaHRtbCgpICwgXCJQYWdlIDFcIiApO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjaG9tZV9wYWdlMkxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMlwiICk7XG5cbiAgICAgICAgLy8gR28gdG8gcGFnZSAxXG4gICAgICAgIHp6KCcjaG9tZV9wYWdlMUxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UxX3BhZ2UxMUxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMTFcIiApO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTFfcGFnZTEyTGluaycpLmh0bWwoKSAsIFwiUGFnZSAxMlwiICk7XG5cbiAgICAgICAgLy8gR28gdG8gcGFnZSAxMVxuICAgICAgICB6eignI3BhZ2UxX3BhZ2UxMUxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UxMV9wJykudGV4dCgpLnRyaW0oKSAsIFwiVGhpcyBpcyBQYWdlIDExXCIgKTtcblxuICAgICAgICAvLyBHbyB0byBob21lXG4gICAgICAgIHp6KCcjcGFnZTExX2hvbWVMaW5rJykuZWwuY2xpY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNob21lX3BhZ2UxTGluaycpLmh0bWwoKSAsIFwiUGFnZSAxXCIgKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI2hvbWVfcGFnZTJMaW5rJykuaHRtbCgpICwgXCJQYWdlIDJcIiApO1xuXG4gICAgICAgIC8vIEdvIHRvIHBhZ2UgMlxuICAgICAgICB6eignI2hvbWVfcGFnZTJMaW5rJykuZWwuY2xpY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNwYWdlMl9wYWdlMjFMaW5rJykuaHRtbCgpICwgXCJQYWdlIDIxXCIgKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UyX3BhZ2UyMkxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMjJcIiApO1xuXG4gICAgICAgIC8vIEdvIHRvIHBhZ2UgMjJcbiAgICAgICAgenooJyNwYWdlMl9wYWdlMjJMaW5rJykuZWwuY2xpY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNwYWdlMjJfcCcpLnRleHQoKS50cmltKCkgLCBcIlRoaXMgaXMgUGFnZSAyMlwiICk7XG5cbiAgICAgICAgLy8gR28gdG8gaG9tZVxuICAgICAgICB6eignI3BhZ2UyMl9ob21lTGluaycpLmVsLmNsaWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuXG4gICAgICAgIC8vIEZpbmlzaCBxdW5pdCB0ZXN0XG4gICAgICAgIGRvbmUoKTtcbiAgICB9KTtcblxuICAgIFFVbml0LnRlc3QoIFwiSGlzdG9yeSBuYXZpZ2F0aW9uIHRlc3RcIiwgYXN5bmMgZnVuY3Rpb24oIGFzc2VydCApIHtcbiAgICAgICAgXG4gICAgICAgIC8vIEdldCBhIHJlZmVyZW5jZSB0byBmaW5pc2ggdGhlIHF1bml0IHRlc3QgbGF0ZXJcbiAgICAgICAgdmFyIGRvbmUgPSBhc3NlcnQuYXN5bmMoKTtcblxuICAgICAgICAvLyBTdGFydCB0ZXN0aW5nXG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNob21lX3BhZ2UxTGluaycpLmh0bWwoKSAsIFwiUGFnZSAxXCIgKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI2hvbWVfcGFnZTJMaW5rJykuaHRtbCgpICwgXCJQYWdlIDJcIiApO1xuXG4gICAgICAgIC8vIEdvIHRvIHBhZ2UgMVxuICAgICAgICB6eignI2hvbWVfcGFnZTFMaW5rJykuZWwuY2xpY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNwYWdlMV9wYWdlMTFMaW5rJykuaHRtbCgpICwgXCJQYWdlIDExXCIgKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UxX3BhZ2UxMkxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMTJcIiApO1xuXG4gICAgICAgIC8vIEdvIHRvIHBhZ2UgMTFcbiAgICAgICAgenooJyNwYWdlMV9wYWdlMTFMaW5rJykuZWwuY2xpY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNwYWdlMTFfcCcpLnRleHQoKS50cmltKCkgLCBcIlRoaXMgaXMgUGFnZSAxMVwiICk7XG5cbiAgICAgICAgLy8gVGVzdCBmaXJzdCBiYWNrLWZvcndhcmQtYmFja1xuXG4gICAgICAgIC8vIEdvIGJhY2sgdG8gcGFnZSAxXG4gICAgICAgIGhpc3RvcnkuYmFjaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UxX3BhZ2UxMUxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMTFcIiApO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTFfcGFnZTEyTGluaycpLmh0bWwoKSAsIFwiUGFnZSAxMlwiICk7XG5cbiAgICAgICAgLy8gR28gZm9yd2FyZCB0byBwYWdlIDExXG4gICAgICAgIGhpc3RvcnkuZm9yd2FyZCgpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UxMV9wJykudGV4dCgpLnRyaW0oKSAsIFwiVGhpcyBpcyBQYWdlIDExXCIgKTtcblxuICAgICAgICAvLyBHbyBiYWNrIHRvIHBhZ2UgMVxuICAgICAgICBoaXN0b3J5LmJhY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNwYWdlMV9wYWdlMTFMaW5rJykuaHRtbCgpICwgXCJQYWdlIDExXCIgKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UxX3BhZ2UxMkxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMTJcIiApO1xuXG4gICAgICAgIC8vIEdvIHRvIGhvbWU6IGNhbiBub3QgdXNlIGdvIGJhY2sgYmVjYXVzZSBvZiBxdW5pdCBzdHJhbmdlIGJlaGF2aW91clxuICAgICAgICB6eignI3BhZ2UxX2hvbWVMaW5rJykuZWwuY2xpY2soKTtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG4gICAgICAgIGFzc2VydC5lcXVhbCggenooJyNob21lX3BhZ2UxTGluaycpLmh0bWwoKSAsIFwiUGFnZSAxXCIgKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI2hvbWVfcGFnZTJMaW5rJykuaHRtbCgpICwgXCJQYWdlIDJcIiApO1xuICAgICAgICBcbiAgICAgICAgLy8gR28gdG8gcGFnZSAyXG4gICAgICAgIHp6KCcjaG9tZV9wYWdlMkxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UyX3BhZ2UyMUxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMjFcIiApO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTJfcGFnZTIyTGluaycpLmh0bWwoKSAsIFwiUGFnZSAyMlwiICk7XG4gICAgICAgIFxuICAgICAgICAvLyBHbyB0byBwYWdlIDIyXG4gICAgICAgIHp6KCcjcGFnZTJfcGFnZTIyTGluaycpLmVsLmNsaWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTIyX3AnKS50ZXh0KCkudHJpbSgpICwgXCJUaGlzIGlzIFBhZ2UgMjJcIiApO1xuICAgICAgICBcbiAgICAgICAgLy8gR28gdG8gcGFnZSAyMjFcbiAgICAgICAgenooJyNwYWdlMjJfcGFnZTIyMUxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UyMjFfcCcpLnRleHQoKS50cmltKCkgLCBcIlRoaXMgaXMgUGFnZSAyMjFcIiApO1xuICAgICAgICBcbiAgICAgICAgLy8gVGVzdCBzZWNvbmQgYmFjay1iYWNrLWZvcndhcmQtZm9yd2FyZFxuICAgICAgICBcbiAgICAgICAgLy8gR28gYmFjayB0byBwYWdlIDIyXG4gICAgICAgIGhpc3RvcnkuYmFjaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UyMl9wJykudGV4dCgpLnRyaW0oKSAsIFwiVGhpcyBpcyBQYWdlIDIyXCIgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEdvIGJhY2sgdG8gcGFnZSAyXG4gICAgICAgIGhpc3RvcnkuYmFjaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UyX3BhZ2UyMUxpbmsnKS5odG1sKCkgLCBcIlBhZ2UgMjFcIiApO1xuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjcGFnZTJfcGFnZTIyTGluaycpLmh0bWwoKSAsIFwiUGFnZSAyMlwiICk7XG5cbiAgICAgICAgLy8gR28gZm9yd2FyZCB0byBwYWdlIDIyXG4gICAgICAgIGhpc3RvcnkuZm9yd2FyZCgpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UyMl9wJykudGV4dCgpLnRyaW0oKSAsIFwiVGhpcyBpcyBQYWdlIDIyXCIgKTtcblxuICAgICAgICAvLyBHbyBmb3J3YXJkIHRvIHBhZ2UgMjIxXG4gICAgICAgIGhpc3RvcnkuZm9yd2FyZCgpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0LmVxdWFsKCB6eignI3BhZ2UyMjFfcCcpLnRleHQoKS50cmltKCkgLCBcIlRoaXMgaXMgUGFnZSAyMjFcIiApO1xuXG4gICAgICAgIC8vIEZpbmlzaCBxdW5pdCB0ZXN0XG4gICAgICAgIGRvbmUoKTtcbiAgICB9KTtcblxuICAgIFFVbml0LnRlc3QoIFwiNDA0IGVycm9yIHRlc3RcIiwgYXN5bmMgZnVuY3Rpb24oIGFzc2VydCApIHtcbiAgICAgICAgXG4gICAgICAgIC8vbGV0IHRoaXNVcmwgPSBcIi90ZXN0L2JvdGhUcmFuc2l0aW9uTmF2aWdhdGlvbi5odG1sXCI7XG4gICAgICAgIGxldCB0aGlzVXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG5cbiAgICAgICAgLy8gR2V0IGEgcmVmZXJlbmNlIHRvIGZpbmlzaCB0aGUgcXVuaXQgdGVzdCBsYXRlclxuICAgICAgICB2YXIgZG9uZSA9IGFzc2VydC5hc3luYygpO1xuXG4gICAgICAgIC8vIFRyeSB0byBnbyB0byA0MDQgZXJyb3IgcGFnZVxuICAgICAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IHRoaXNVcmwgKyBcIiMhbm90Rm91bmRcIjtcbiAgICAgICAgYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG5cbiAgICAgICAgLy8gVGVzdCA0MDQgcGFnZVxuICAgICAgICBhc3NlcnQuZXF1YWwoIHp6KCcjZTQwNF9wJykudGV4dCgpLnRyaW0oKSAsIFwiUmVxdWVzdGVkIGNvbnRlbnQgbm90IGZvdW5kLlwiICk7XG4gICAgICAgIFxuICAgICAgICAvLyBHbyB0byBob21lXG4gICAgICAgIHp6KCcjZTQwNF9ob21lTGluaycpLmVsLmNsaWNrKCk7XG4gICAgICAgIGF3YWl0IHV0aWxzLndhaXRTaG9ydCgpO1xuXG4gICAgICAgIC8vIEdvIHRvIGJva2VuUGFnZTogcGFnZSB3aXRoIG5vIGNvbnRlbnQgZGVmaW5lZFxuICAgICAgICB6eignI2hvbWVfYnJva2VuUGFnZUxpbmsnKS5lbC5jbGljaygpO1xuICAgICAgICBhd2FpdCB1dGlscy53YWl0U2hvcnQoKTtcbiAgICAgICAgYXNzZXJ0Lm9rKCB6eignI2Vycm9yJykudGV4dCgpLnN0YXJ0c1dpdGgoIFwiTm8gY29udGVudCBmb3VuZCBmb3Igcm91dGUgZnJvbSBwYXRoXCIgKSApO1xuXG4gICAgICAgIC8vIEdvIHRvIGhvbWVcbiAgICAgICAgLy93aW5kb3cubG9jYXRpb24uaHJlZiA9IHRoaXNVcmw7XG4gICAgICAgIC8vYXdhaXQgdXRpbHMud2FpdFNob3J0KCk7XG5cbiAgICAgICAgLy8gRmluaXNoIHF1bml0IHRlc3RcbiAgICAgICAgZG9uZSgpO1xuICAgIH0pO1xuXG59O1xuXG5cbiIsIi8vIFRlc3RzIGZvciBuYXZpZ2F0aW9uLCBubyB0cmFuc2l0aW9uc1xuXG52YXIgUXVuaXQgPSByZXF1aXJlKCAncXVuaXQnICk7XG52YXIgYmx1ZVJvdXRlciA9IHJlcXVpcmUoICcuLi8uLi9idWlsZC9ibHVlUm91dGVyLmpzJyApO1xuXG4vLyBJbml0IHJvdXRlclxuY29uc3QgaW5pdFJvdXRlciA9ICgpID0+IHtcbiAgICAvLyBJbml0aWFsaXplIHBhZ2VzXG4gICAgY29uc3QgcGFnZXMgPSB7fTtcblxuICAgIC8vIEluaXRpYWxpemUgb3B0aW9uczogbm8gYW5pbWF0aW9uc1xuICAgIGxldCBvcHRpb25zID0ge1xuICAgICAgICBldmVudHNCeVBhZ2U6IHBhZ2VzLFxuICAgICAgICBhbmltYXRpb25PdXQ6IGZhbHNlLFxuICAgICAgICBhbmltYXRpb25JbjogZmFsc2UsXG4gICAgICAgIHJvdXRlczogcmVxdWlyZSggJy4vcm91dGVzSW5saW5lRm9yTmF2aWdhdGlvbi5qcycgKVxuICAgIH07XG5cbiAgICAvLyBDcmVhdGUgbmV3IHJvdXRlciBpbnN0YW5jZVxuICAgIHJldHVybiBuZXcgYmx1ZVJvdXRlci5yb3V0ZXIoIG9wdGlvbnMgKTtcbn07XG5cbi8vIEluaXQgcm91dGVyXG5jb25zdCByb3V0ZXIgPSBpbml0Um91dGVyKCk7XG5cbi8vIFVuaXQgdGVzdHNcbnJlcXVpcmUoICcuL25hdmlnYXRpb24uanMnICkoKTtcblxuXG4iLCIvLyBSb3V0ZXMgZm9yIGlubGluZSBjb250ZW50IGZvciBuYXZpZ2F0aW9uIHRlc3RzXG5jb25zdCByb3V0ZXMgPSBbXG4gICAgLy8gSG9tZSBwYWdlXG4gICAge1xuICAgICAgICBpZDogJ1tob21lXScsXG4gICAgICAgIGNvbnRlbnQ6IGBcbjxoMT5CbHVlIHJvdXRlciB0ZXN0PC9oMT5cblxuPGRpdiBjbGFzcz1cInBhZ2UtY29udGVudFwiPlxuICAgIDxoMz5Ib21lIHBhZ2U8L2gzPlxuICAgIDxwPlxuICAgICAgICBUaGlzIGlzIEhvbWUgcGFnZVxuICAgIDwvcD5cblxuICAgIDx1bCBpZD1cImhvbWVfbGlua3NcIj5cbiAgICAgICAgPGxpPlxuICAgICAgICAgICAgPGEgaHJlZj1cIiFwYWdlMVwiIGlkPVwiaG9tZV9wYWdlMUxpbmtcIj5QYWdlIDE8L2E+LiBHbyB0byBwYWdlIDEuXG4gICAgICAgIDwvbGk+XG4gICAgICAgIDxsaT5cbiAgICAgICAgICAgIDxhIGhyZWY9XCIhcGFnZTJcIiBpZD1cImhvbWVfcGFnZTJMaW5rXCI+UGFnZSAyPC9hPi4gR28gdG8gcGFnZSAyLlxuICAgICAgICA8L2xpPlxuICAgICAgICA8bGk+XG4gICAgICAgICAgICA8YSBocmVmPVwiIWJyb2tlblBhZ2VcIiBpZD1cImhvbWVfYnJva2VuUGFnZUxpbmtcIj5Ccm9rZW4gcGFnZTwvYT4uIEdvIHRvIGJyb2tlbiBwYWdlLlxuICAgICAgICA8L2xpPlxuICAgIDwvdWw+XG48L2Rpdj5cbmBcbiAgICB9LFxuICAgIC8vIHBhZ2UxXG4gICAge1xuICAgIGlkOiAncGFnZTEnLFxuICAgIGNvbnRlbnQ6IGBcbjxoMT5CbHVlIHJvdXRlciB0ZXN0PC9oMT5cblxuPGRpdj5cbiAgICA8YSBocmVmPVwiIVwiIGlkPVwicGFnZTFfaG9tZUxpbmtcIj5Ib21lPC9hPlxuPC9kaXY+XG5cbjxkaXYgY2xhc3M9XCJwYWdlLWNvbnRlbnRcIj5cbiAgICA8aDM+UGFnZSAxPC9oMz5cbiAgICA8cD5cbiAgICAgICAgVGhpcyBpcyBQYWdlIDFcbiAgICA8L3A+XG5cbiAgICA8dWwgaWQ9XCJwYWdlMV9saW5rc1wiPlxuICAgICAgICA8bGk+XG4gICAgICAgICAgICA8YSBocmVmPVwiIXBhZ2UxMVwiIGlkPVwicGFnZTFfcGFnZTExTGlua1wiPlBhZ2UgMTE8L2E+LiBHbyB0byBwYWdlIDExLlxuICAgICAgICA8L2xpPlxuICAgICAgICA8bGk+XG4gICAgICAgICAgICA8YSBocmVmPVwiIXBhZ2UxMlwiIGlkPVwicGFnZTFfcGFnZTEyTGlua1wiPlBhZ2UgMTI8L2E+LiBHbyB0byBwYWdlIDEyLlxuICAgICAgICA8L2xpPlxuICAgIDwvdWw+XG48L2Rpdj5cbmBcbiAgICB9LFxuICAgIC8vIHBhZ2UxMVxuICAgIHtcbiAgICAgICAgaWQ6ICdwYWdlMTEnLFxuICAgICAgICBjb250ZW50OiBgXG48aDE+Qmx1ZSByb3V0ZXIgdGVzdDwvaDE+XG5cbjxkaXY+XG4gICAgPGEgaHJlZj1cIiFcIiBpZD1cInBhZ2UxMV9ob21lTGlua1wiPkhvbWU8L2E+XG48L2Rpdj5cblxuPGRpdiBjbGFzcz1cInBhZ2UtY29udGVudFwiPlxuICAgIDxoMz5QYWdlIDExPC9oMz5cbiAgICA8cCBpZD1cInBhZ2UxMV9wXCI+XG4gICAgICAgIFRoaXMgaXMgUGFnZSAxMVxuICAgIDwvcD5cbjwvZGl2PlxuYFxuICAgIH0sXG4gICAgLy8gcGFnZTEyXG4gICAge1xuICAgICAgICBpZDogJ3BhZ2UxMicsXG4gICAgICAgIGNvbnRlbnQ6IGBcbjxoMT5CbHVlIHJvdXRlciB0ZXN0PC9oMT5cblxuPGRpdj5cbiAgICA8YSBocmVmPVwiIVwiIGlkPVwicGFnZTEyX2hvbWVMaW5rXCI+SG9tZTwvYT5cbjwvZGl2PlxuXG48ZGl2IGNsYXNzPVwicGFnZS1jb250ZW50XCI+XG4gICAgPGgzPlBhZ2UgMTI8L2gzPlxuICAgIDxwIGlkPVwicGFnZTEyX3BcIj5cbiAgICAgICAgVGhpcyBpcyBQYWdlIDEyXG4gICAgPC9wPlxuPC9kaXY+XG5gXG4gICAgfSxcbiAgICAvLyBwYWdlMlxuICAgIHtcbiAgICAgICAgaWQ6ICdwYWdlMicsXG4gICAgICAgIGNvbnRlbnQ6IGBcbjxoMT5CbHVlIHJvdXRlciB0ZXN0PC9oMT5cblxuPGRpdj5cbiAgICA8YSBocmVmPVwiIVwiIGlkPVwicGFnZTJfaG9tZUxpbmtcIj5Ib21lPC9hPlxuPC9kaXY+XG5cbjxkaXYgY2xhc3M9XCJwYWdlLWNvbnRlbnRcIj5cbiAgICA8aDM+UGFnZSAyPC9oMz5cbiAgICA8cD5cbiAgICAgICAgVGhpcyBpcyBQYWdlIDJcbiAgICA8L3A+XG5cbiAgICA8dWwgaWQ9XCJwYWdlMl9saW5rc1wiPlxuICAgICAgICA8bGk+XG4gICAgICAgICAgICA8YSBocmVmPVwiIXBhZ2UyMVwiIGlkPVwicGFnZTJfcGFnZTIxTGlua1wiPlBhZ2UgMjE8L2E+LiBHbyB0byBwYWdlIDIxLlxuICAgICAgICA8L2xpPlxuICAgICAgICA8bGk+XG4gICAgICAgICAgICA8YSBocmVmPVwiIXBhZ2UyMlwiIGlkPVwicGFnZTJfcGFnZTIyTGlua1wiPlBhZ2UgMjI8L2E+LiBHbyB0byBwYWdlIDIyLlxuICAgICAgICA8L2xpPlxuICAgIDwvdWw+XG48L2Rpdj5cbmBcbiAgICB9LFxuICAgIC8vIHBhZ2UyMVxuICAgIHtcbiAgICAgICAgaWQ6ICdwYWdlMjEnLFxuICAgICAgICBjb250ZW50OiBgXG48aDE+Qmx1ZSByb3V0ZXIgdGVzdDwvaDE+XG5cbjxkaXY+XG4gICAgPGEgaHJlZj1cIiFcIiBpZD1cInBhZ2UyMV9ob21lTGlua1wiPkhvbWU8L2E+XG48L2Rpdj5cblxuPGRpdiBjbGFzcz1cInBhZ2UtY29udGVudFwiPlxuICAgIDxoMz5QYWdlIDIxPC9oMz5cbiAgICA8cCBpZD1cInBhZ2UyMV9wXCI+XG4gICAgICAgIFRoaXMgaXMgUGFnZSAyMVxuICAgIDwvcD5cbjwvZGl2PlxuYFxuICAgIH0sXG4gICAgLy8gcGFnZTIyXG4gICAge1xuICAgICAgICBpZDogJ3BhZ2UyMicsXG4gICAgICAgIGNvbnRlbnQ6IGBcbjxoMT5CbHVlIHJvdXRlciB0ZXN0PC9oMT5cblxuPGRpdj5cbiAgICA8YSBocmVmPVwiIVwiIGlkPVwicGFnZTIyX2hvbWVMaW5rXCI+SG9tZTwvYT5cbjwvZGl2PlxuXG48ZGl2IGNsYXNzPVwicGFnZS1jb250ZW50XCI+XG4gICAgPGgzPlBhZ2UgMjI8L2gzPlxuICAgIDxwIGlkPVwicGFnZTIyX3BcIj5cbiAgICAgICAgVGhpcyBpcyBQYWdlIDIyXG4gICAgPC9wPlxuXG4gICAgPHVsIGlkPVwicGFnZTIyX2xpbmtzXCI+XG4gICAgICAgIDxsaT5cbiAgICAgICAgICAgIDxhIGhyZWY9XCIhcGFnZTIyMVwiIGlkPVwicGFnZTIyX3BhZ2UyMjFMaW5rXCI+UGFnZSAyMjE8L2E+LiBHbyB0byBwYWdlIDIyMS5cbiAgICAgICAgPC9saT5cbiAgICA8L3VsPlxuPC9kaXY+XG5gXG4gICAgfSxcbiAgICAvLyBwYWdlMjIxXG4gICAge1xuICAgICAgICBpZDogJ3BhZ2UyMjEnLFxuICAgICAgICBjb250ZW50OiBgXG48aDE+Qmx1ZSByb3V0ZXIgdGVzdDwvaDE+XG5cbjxkaXY+XG4gICAgPGEgaHJlZj1cIiFcIiBpZD1cInBhZ2UyMjFfaG9tZUxpbmtcIj5Ib21lPC9hPlxuPC9kaXY+XG5cbjxkaXYgY2xhc3M9XCJwYWdlLWNvbnRlbnRcIj5cbiAgICA8aDM+UGFnZSAyMjE8L2gzPlxuICAgIDxwIGlkPVwicGFnZTIyMV9wXCI+XG4gICAgICAgIFRoaXMgaXMgUGFnZSAyMjFcbiAgICA8L3A+XG48L2Rpdj5cbmBcbiAgICB9LFxuICAgIC8vIGJyb2tlblBhZ2VcbiAgICB7XG4gICAgICAgIGlkOiAnYnJva2VuUGFnZSdcbiAgICB9LFxuICAgIC8vIERlZmF1bHQgcm91dGUgKDQwNCBwYWdlKVxuICAgIHtcbiAgICAgICAgaWQ6ICdbNDA0XScsXG4gICAgICAgIGNvbnRlbnQ6IGBcbjxoMT5CbHVlIHJvdXRlciB0ZXN0PC9oMT5cblxuPGRpdj5cbiAgICA8YSBocmVmPVwiIVwiIGlkPVwiZTQwNF9ob21lTGlua1wiPkhvbWU8L2E+XG48L2Rpdj5cblxuPGRpdiBjbGFzcz1cInBhZ2UtY29udGVudFwiPlxuICAgIDxoMz40MDQgcGFnZTwvaDM+XG4gICAgPHA+XG4gICAgICAgIFNvcnJ5XG4gICAgPC9wPlxuICAgIDxwIGlkPVwiZTQwNF9wXCI+XG4gICAgICAgIFJlcXVlc3RlZCBjb250ZW50IG5vdCBmb3VuZC5cbiAgICA8L3A+XG48L2Rpdj5cbmBcbiAgICB9XG5dO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJvdXRlcztcblxuXG4iLCJjb25zdCB1dGlscyA9IHt9O1xuXG51dGlscy53YWl0U2hvcnQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdXRpbHMud2FpdCggMTAwMCApO1xufTtcblxudXRpbHMud2FpdCA9IGZ1bmN0aW9uKCB0aW1lb3V0ICkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSggcmVzb2x2ZSA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoIHJlc29sdmUsIHRpbWVvdXQgKTtcbiAgICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gdXRpbHM7XG5cbiJdfQ==
