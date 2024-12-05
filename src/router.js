/*
 * blueRouter.router class
 */
/** @constructor */
blueRouter.router = function ( _options ) {
    this.options = _options;

    this.initialize();
};

/* Methods */
blueRouter.router.prototype.initialize = function () {
    //alert( 'initialize');
    
    this.pathname = window.location.pathname;
    this.urlBase = window.location.href;
    this.routesMap = this.createRoutesMap();

    let self = this;

    //alert( 'pathname: ' + this.pathname + '\nurlBase:' + this.urlBase );

    window.onload = () => {
        if ( this.options.browserHistoryOnLoad ){
            this.navigateUrl( window.location.href );
            return;
        }

        this.navigateUrl( '' );
    }

    window.onpopstate = () => {
        this.navigateUrl( window.location.href );
    }

    // Add event listeners for a elements
    this.addEventListenerOnList(
        document.getElementsByTagName( 'a' ),
        'click', 
        (e) => {
            const href = e.target.getAttribute( 'href' );

            // Follow the link if it is external (if it is marked as external in the class list)
            if ( e.target.classList.contains ( self.options.externalClass ) ){
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

    // Get the content
    let content = this.getContentForPage( urlObject.page );

    // Update current page
    document.getElementById( 'currentPage' ).innerHTML = content;
};

blueRouter.router.prototype.getContentForPage = function( page ) {

    let route = this.routesMap[ page ];

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
    return '<h3>404 - Page not found: ' + page + '</h3>';
};

blueRouter.router.prototype.getContentForRoute = function( route ) {

    let content = route[ 'content' ];
    return content? content: 'No content found for route from path ' + route[ 'path' ];
};

blueRouter.router.prototype.addEventListenerOnList = function( list, event, fn ) {

    for ( let i = 0, len = list.length; i < len; i++ ) {
        list[ i ].addEventListener( event, fn, false );
    }
};

