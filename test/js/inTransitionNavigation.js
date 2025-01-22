// Tests for navigation, both transitions

var Qunit = require( 'qunit' );
var zzRouter = require( '../../index.js' );

// Init router
const initRouter = (() => {
    // Initialize pages
    const pages = {};

    // Initialize options: in animations
    let options = {
        eventsByPage: pages,
        animationOut: false,
        routes: require( './routesInlineForNavigation.js' )
    };

    // Start router
    zzRouter.start( options );
})();

// Unit tests
require( './navigation.js' )();


