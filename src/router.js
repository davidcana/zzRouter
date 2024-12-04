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

        this.navigatePath( '' );
    }

    window.onpopstate = () => {
        this.navigateUrl( window.location.href );
    }

    // Add event listeners for a elements
    this.addEventListenerOnList(
        document.getElementsByTagName( 'a' ),
        'click', 
        (e) => {
            e.preventDefault();
            const href = e.target.getAttribute( 'href' );
            history.pushState(
                {
                    'page': href
                },
                'page ' + href,
                '?' + 'page' + '=' + href
            );
            self.navigatePath( href );
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

    // Extract the page name (the string after = character); if undefined it must be the home page
    this.navigatePath( url.split('=')[1] || '' );
};

blueRouter.router.prototype.navigatePath = function( path ) {
    //alert( 'navigatePath\npath: ' + path );

    let content = this.getContentForPath( path );

    document.getElementById( 'currentPage' ).innerHTML = content;
};

blueRouter.router.prototype.getContentForPath = function( path ) {

    let route = this.routesMap[ path ];

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
    return '<h3>404 - Page Not Found: ' + path + '</h3>';
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

