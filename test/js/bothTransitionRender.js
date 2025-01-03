var Qunit = require( 'qunit' );
var zz = require( 'zzdom' );
var zpt = require( 'zpt' );
var blueRouter = require( '../../build/blueRouter.standalone.concat.js' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Load js of pages
    const dictionary = {};
    pages[ 'renderWithoutWaiting' ] = require( './pages/renderWithoutWaiting.js' )( dictionary );
    pages[ 'renderWaitingForServer' ] = require( './pages/renderWaitingForServer.js' )( dictionary );

    // Initialize options: no animations
    let initializeZPT = true;
    let options = {
        eventsByPage: pages,
        routes: require( './routesInlineForRender.js' )
    };

    // Add renderFunction
    options.renderFunction = ( page ) => {
        if ( initializeZPT ){
            zpt.run({
                'root': document.body,
                'dictionary': dictionary
            });
            initializeZPT = false;
        } else {
            zpt.run({
                'command': 'partialRender',
                'target': page[ 'el' ]
            });
        }
    };

    // Create new router instance
    return new blueRouter.router( options );
};

// Init router
const router = initRouter();

// Unit tests
require( './render.js' )();

