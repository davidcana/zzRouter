// Tests for navigation, no transitions

var Qunit = require( 'qunit' );
var blueRouter = require( '../../index.js' );

// Init router
const initRouter = (() => {
    // Initialize pages
    const pages = {};

    // Initialize options: no animations
    let options = {
        eventsByPage: pages,
        animationOut: false,
        animationIn: false,
        routes: require( './routesInlineForNavigation.js' )
    };

    // Start router
    blueRouter.start( options );
})();

// Unit tests
require( './navigation.js' )();


