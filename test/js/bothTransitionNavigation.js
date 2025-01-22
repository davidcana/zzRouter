// Tests for navigation, both transitions

var Qunit = require( 'qunit' );
var zzRouter = require( '../../index.js' );

// Init router
const initRouter = (() => {
    // Initialize pages
    const pages = {};

    // Initialize options: both animations
    let options = {
        eventsByPage: pages,
        routes: require( './routesInlineForNavigation.js' )
    };

    // Start router
    zzRouter.start( options );
})();

// Unit tests
require( './navigation.js' )();


