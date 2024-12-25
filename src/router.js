/*
 * blueRouter.router class
 */
/** @constructor */
blueRouter.router = function ( userOptions ) {

    // Init options
    this.options = {};
    blueRouter.utils.extend( this.options, blueRouter.defaultOptions, userOptions );
    this.checkOptions();

    // Preload pages if needed
    if ( this.options.preloadPages ){
        let self = this;
        blueRouter.htmlFetcher.loadAllUrls(
            this,
            () => {
                self.init();
            }
        );
        return;
    }

    // Do not preload pages: run init
    this.init();
};

/* Methods */

/** @suppress {missingProperties} */
blueRouter.router.prototype.init = function() {

    // Init some other vars
    //this.pathname = window.location.pathname;
    //this.urlBase = window.location.href;
    this.routesMap = this.createRoutesMap();
    this.stack = [];

    //alert( 'pathname: ' + this.pathname + '\nurlBase:' + this.urlBase );

    // Add event listeners
    this.addEventListenersForWindow();

    // Navigate to window.location.href or home
    this.navigateUrl(
        this.options.browserHistoryOnLoad? window.location.href: '',
        this.options.animateFirstTransition
    );
};

// Check that mandatory user defined properties are defined
/** @suppress {missingProperties} */
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
        this.navigateUrl( this.options.browserHistoryOnLoad? window.location.href: '', true );
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
            self.navigateUrl( href, true );
        }
    );
};

// Create a map with the data in routes, using the path as the key
blueRouter.router.prototype.createRoutesMap = function() {

    const routerMap = {};
    const routes = this.options.routes || [];

    routes.map( routeItem => {
        routerMap[ routeItem[ 'path' ] ] = routeItem;
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
        'path': this.options.PAGE_ID_404_ERROR,
        'content': '<h3>404 - Page not found: ' + pageId + '</h3>'
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
            routeItem[ 'content' ] = text;

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
    if ( routeItem[ 'keepAlive' ] ){
        let alivePage = document.getElementById( routeItem[ 'path' ] );
        if ( alivePage ){
            return alivePage;
        }
    }

    // Check content
    let content = routeItem[ 'content' ];
    if ( content ){
        return content;
    }

    // Check url
    let url = routeItem[ 'url' ];
    if ( url ){
        return blueRouter.htmlFetcher.loadUrl( url );
    }

    return '<div id="error">No content found for route from path ' + routeItem[ 'path' ] + '</div>';
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
    if ( currentRoute && currentRoute[ 'keepAlive' ]){
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
    let page = this.options.pages[ pageId ];

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

