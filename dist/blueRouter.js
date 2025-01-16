/*! bluerouter - v0.1.0 - 2025-01-16 13:55:36 */
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
