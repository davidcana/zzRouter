// Tests for events, both transitions

//var blueRouter = require( '../../dist/blueRouter.js' );
var blueRouter = require( '../../index.js' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Load js of pages
    pages[ 'page1' ] = require( './pages/page1.js' )( eventList );
    pages[ 'textWriter' ] = require( './pages/textWriter.js' );

    // Initialize options: both animations
    let options = {
        eventsByPage: pages,
        routes: require( './routesInlineForEvents.js' )
    };
    
    // Create new router instance
    return new blueRouter( options );
};

// Init router
let eventList = [];
const router = initRouter();

// Unit tests
require( './events.js' )( router, eventList );


