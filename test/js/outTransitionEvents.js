// Tests for events, both transitions

var zzRouter = require( '../../index.js' );

// Init router
let eventList = [];
const initRouter = (() => {
    // Initialize pages
    const pages = {};

    // Load js of pages
    pages[ 'page1' ] = require( './pages/page1.js' )( eventList );
    pages[ 'textWriter' ] = require( './pages/textWriter.js' );

    // Initialize options: both animations
    let options = {
        eventsByPage: pages,
        animationIn: false,
        routes: require( './routesInlineForEvents.js' )
    };
    
    // Start router
    zzRouter.start( options );
})();

// Unit tests
require( './events.js' )( zzRouter, eventList );


