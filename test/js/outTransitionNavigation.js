// Tests for navigation, out transitions

var Qunit = require( 'qunit' );
//var blueRouter = require( '../../dist/blueRouter.js' );
var blueRouter = require( '../../index.js' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Initialize options: out animations
    let options = {
        eventsByPage: pages,
        animationIn: false,
        routes: require( './routesInlineForNavigation.js' )
    };

    // Create new router instance
    return new blueRouter( options );
};

// Init router
const router = initRouter();

// Unit tests
require( './navigation.js' )();


