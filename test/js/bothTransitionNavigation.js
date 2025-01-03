// Tests for navigation, both transitions

var Qunit = require( 'qunit' );
var blueRouter = require( '../../build/blueRouter.standalone.concat.js' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Initialize options: both animations
    let options = {
        eventsByPage: pages,
        routes: require( './routesInlineForNavigation.js' )
    };

    // Create new router instance
    return new blueRouter.router( options );
};

// Init router
const router = initRouter();

// Unit tests
require( './navigation.js' )();


