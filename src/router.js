/*
 * blueRouter.router class
 */
/** @constructor */
blueRouter.router = function ( userOptions ) {

    // Init options
    this.options = {};
    this.extend( this.options, blueRouter.defaultOptions, userOptions );
    this.checkOptions();

    // Init some other vars
    //this.pathname = window.location.pathname;
    //this.urlBase = window.location.href;
    this.routesMap = this.createRoutesMap();
    this.stack = [];

    //alert( 'pathname: ' + this.pathname + '\nurlBase:' + this.urlBase );

    // Add event listeners
    this.addEventListenersForWindow();
    this.addEventListenersForLinks();
};

/* Methods */

// Check that mandatory user defined properties are defined
blueRouter.router.prototype.checkOptions = function() {

    let errors = 0;
    let errorMessages = '';

    if ( ! this.options.routes ){
        ++errors;
        errorMessages += 'Routes must be defined. ';
    }

    if ( ! this.options.pages ){
        ++errors;
        errorMessages += 'Pages must be defined. ';
    }

    if ( errors ){
        let fullErrorMessage = 'Unable to initalize Blue router. ' + errors + ' errors found: ' + errorMessages;
        alert( fullErrorMessage );
        throw fullErrorMessage;
    }
};

blueRouter.router.prototype.addEventListenersForWindow = function() {

    window.onload = () => {
        if ( this.options.browserHistoryOnLoad ){
            this.navigateUrl( window.location.href );
            return;
        }

        this.navigateUrl( '' );
    }

    window.onpopstate = ( e ) => {
        this.navigateUrl( window.location.href );
        //this.navigateUrl( e.state[ 'page' ] );
    }
};

blueRouter.router.prototype.addEventListenersForLinks = function() {
    
    let self = this;

    // Add event listeners for a elements
    this.addEventListenerOnList(
        document.getElementsByTagName( 'a' ),
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
            if ( ! href.startsWith( self.options.pagePrefix ) ){
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
            self.navigateUrl( href );
        }
    );
};

// Create a map with the data in routes, using the path as the key
blueRouter.router.prototype.createRoutesMap = function() {

    const routerMap = {};
    const routes = this.options.routes || [];

    routes.map(routeItem => {
        routerMap[ routeItem[ 'path' ] ] = routeItem;
    });

    return routerMap;
};

blueRouter.router.prototype.navigateUrl = function( url ) {
    //alert( 'navigateUrl\nurl: ' + url );

    // Create an url object to make it easy everything
    let urlObject = blueRouter.urlManager.analize( url, this.options );

    // Update stack and get currentPageId
    let currentPageId = this.updateStack( urlObject.page );

    // Get the content
    let content = this.getContentForPage( urlObject.page );

    // Update current page
    this.doPageTransition( content, urlObject.page, currentPageId, urlObject );
};

blueRouter.router.prototype.updateStack = function( pageId ) {
    
    // If the penultimate element is the pageId then we are going backwards; otherwise we are going forward
    let isBackward = this.stack[ this.stack.length - 2 ] == pageId;

    if ( isBackward ){
        // isBackward
        return this.stack.pop();
    }

    // isForward
    var currentPageId = this.stack[ this.stack.length - 1 ];
    this.stack.push( pageId );
    return currentPageId;
};

blueRouter.router.prototype.getContentForPage = function( pageId ) {

    let route = this.routesMap[ pageId ];

    // Check if there is a route for this path
    if ( route ){
        return this.getContentForRoute( route );
    }

    // No route found, 404 error
    route = this.routesMap[ '(404)' ];
    if ( route ){
        return this.getContentForRoute( route );
    }

    // No 404 page found
    return '<h3>404 - Page not found: ' + pageId + '</h3>';
};

blueRouter.router.prototype.getContentForRoute = function( route ) {

    let content = route[ 'content' ];
    return content? content: 'No content found for route from path ' + route[ 'path' ];
};

/*
EVENT_INIT: 'init',
EVENT_REINIT: 'reinit',
EVENT_MOUNTED: 'mounted',
EVENT_BEFORE_OUT: 'beforeOut',
EVENT_AFTER_OUT: 'afterOut',
*/
blueRouter.router.prototype.doPageTransition = function( content, nextPageId, currentPageId, urlObject ) {

    // Update current page
    document.getElementById( 'currentPage' ).innerHTML = content;
    
    // Run events
    this.runEvent( blueRouter.defaultOptions.EVENT_BEFORE_OUT, currentPageId, undefined );
    this.runEvent( blueRouter.defaultOptions.EVENT_AFTER_OUT, currentPageId, undefined );
    this.runEvent( blueRouter.defaultOptions.EVENT_INIT, nextPageId, urlObject );
    this.runEvent( blueRouter.defaultOptions.EVENT_MOUNTED, nextPageId, urlObject );
};

blueRouter.router.prototype.runEvent = function( eventId, pageId, urlObject ) {

    if ( eventId == blueRouter.defaultOptions.EVENT_INIT ){
        this.addEventListenersForLinks();
    }

    // Get the page object from options
    let page = this.options.pages[ pageId ];

    // If a page is found, run the event handler
    if ( page ){
        let event = {
            params: urlObject.params || {}
        };
        page[ eventId ]( event );
    }
};

// Move to utils.js
blueRouter.router.prototype.addEventListenerOnList = function( list, event, fn ) {

    for ( let i = 0, len = list.length; i < len; i++ ) {
        list[ i ].addEventListener( event, fn, false );
    }
};

blueRouter.router.prototype.extend = function( out, from1, from2 ) {
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

// End Move to utils.js
