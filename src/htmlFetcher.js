/* 
    htmlFetcher singleton class
*/

blueRouter.htmlFetcher = {};

blueRouter.htmlFetcher.loadAllRouteItems = function( router, callback ){

    const routes = router.options.routes || [];

    // Filter routeItems with url
    /*
    let urlRoutes = routes.filter( routeItem => {
        return routeItem[ 'url' ];
    });
    */
    // Get the number ot urls to get
    //let pending = urlRoutes.length;

    // Iterate urlRoutes and load each routeItem
    routes.map( routeItem => {
        blueRouter.htmlFetcher.loadRouteItem( routeItem )
    });
    /*
    urlRoutes.map( routeItem => {
        blueRouter.htmlFetcher.loadRouteItem(
            routeItem,
            function(){
                if ( --pending == 0 && callback && blueRouter.utils.isFunction( callback ) ){
                    callback();
                }
            }
        );
    });
    */
};

blueRouter.htmlFetcher.loadRouteItem = function( routeItem ){

    let url = routeItem[ 'url' ];
    if ( ! url ){
        return;
    }
    
    routeItem[ 'content' ] = blueRouter.htmlFetcher.get( url );
};
/*
blueRouter.htmlFetcher.loadRouteItem = function( routeItem, callback ){

    blueRouter.htmlFetcher.get(
        routeItem[ 'url' ],
        function( text ){
            // Add data from server to content element of routeItem
            routeItem[ 'content' ] = text;

            if ( callback && blueRouter.utils.isFunction( callback ) ){
                callback();
            }
        }
    );
};
*/

/**
 * @param {string} url
 * 
 */
blueRouter.htmlFetcher.get = async function( url ){

    const response = await fetch( url );

    if ( ! response.ok ) {
        const message = `Error fetching ${url} has occured: ${response.status}`;
        alert ( message );
        throw new Error( message );
    }
  
    const text = await response.text();
    return text;
};
/*
blueRouter.htmlFetcher.get = function( url, successCallback, errorCallback ){

    fetch( url )
        .then(
            function( response ){
                if ( ! response.text() ){
                    //errorCallback( response );
                    blueRouter.htmlFetcher.runErrorCallback( errorCallback, response );
                    return;
                }
                return response? response.text(): undefined;
            }
        ).then(
            function( data ){
                if ( data ){
                    if ( data ){
                        successCallback( data );
                    } else {
                        //errorCallback( undefined, undefined, data[ 'error' ] );
                        blueRouter.htmlFetcher.runErrorCallback( errorCallback, undefined, undefined, data[ 'error' ] );
                    }
                }
            }
        ).catch(
            function( error ){
                //errorCallback( undefined, error );
                blueRouter.htmlFetcher.runErrorCallback( errorCallback, undefined, error );
            }
        );
};
*/

blueRouter.htmlFetcher.xhrError = function( response, errorInstance, stringError ){
    
    //simplePreloader.hide( true );

    // Get the message
    var message;
    if ( response ){
        message = blueRouter.utils.formatString(
            'A status {0} has been found trying to retrieve data from {1}',
            response.status,
            response.url
        );
    } else if ( errorInstance ){
        message = errorInstance.message;
    } else if ( stringError ){
        message = stringError;
    } else {
        message = 'Unknown error found in xhrError function.';
    }

    // Show it
    alert( message );
};

/**
 * @param {Function|undefined} errorCallbackNullable
 * @param {Object|undefined} response
 * @param {*=} errorInstance
 * @param {string=} stringError
 * 
 */
blueRouter.htmlFetcher.runErrorCallback = function( errorCallbackNullable, response, errorInstance, stringError ){

    const errorCallback = errorCallbackNullable || blueRouter.htmlFetcher.xhrError;
    errorCallback( response, errorInstance, stringError );
};

