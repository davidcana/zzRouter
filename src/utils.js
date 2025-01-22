/* utils */
zzRouter.utils = {};

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
zzRouter.utils.analizeUrl = function( url, options ) {
    
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

zzRouter.utils.addEventListenerOnList = function( list, event, fn ) {

    for ( let i = 0, len = list.length; i < len; i++ ) {
        list[ i ].addEventListener( event, fn, false );
    }
};

zzRouter.utils.extend = function( out, from1, from2 ) {
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

zzRouter.utils.isFunction = function isFunction( obj ) {

    // Support: Chrome <=57, Firefox <=52
    // In some browsers, typeof returns "function" for HTML <object> elements
    // (i.e., `typeof document.createElement( "object" ) === "function"`).
    // We don't want to classify *any* DOM node as a function.
    return typeof obj === "function" && typeof obj.nodeType !== "number";
};
/* end of utils */
