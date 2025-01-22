/* 
    htmlFetcher singleton class
*/

zzRouter.htmlFetcher = {};

zzRouter.htmlFetcher.loadAllUrls = function( router, callback ){

    // Get the routes to use
    const routes = router.options.routes || [];

    // Init the number ot urls to get
    let pending = 0;

    // Iterate urlRoutes and load each routeItem if needed
    routes.map( routeItem => {
        let url = routeItem.url;
        if ( url ){
            ++pending;
            zzRouter.htmlFetcher.loadUrl( url ).then(
                function( text ){
                    // Update content of route
                    routeItem.content = text;

                    // Run callback when all files have been loaded
                    if ( --pending == 0 && callback && zzRouter.utils.isFunction( callback ) ){
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
zzRouter.htmlFetcher.loadUrl = async function( url ){

    const response = await fetch( url );

    if ( ! response.ok ) {
        const message = `Error fetching ${url} has occured: ${response.status}`;
        alert ( message );
        throw new Error( message );
    }
  
    const text = await response.text();
    return text;
};
