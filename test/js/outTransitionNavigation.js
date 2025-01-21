// Tests for navigation, out transitions

var Qunit = require( 'qunit' );
var blueRouter = require( '../../index.js' );

// Init router
const initRouter = (() => {
    // Initialize pages
    const pages = {};

    // Initialize options: out animations
    let options = {
        eventsByPage: pages,
        animationIn: false,
        routes: require( './routesInlineForNavigation.js' )
    };

    // Start router
    blueRouter.start( options );
})();

// Unit tests
require( './navigation.js' )();


