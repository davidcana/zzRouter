// Tests for navigation, both transitions

var Qunit = require( 'qunit' );
//var blueRouter = require( '../../dist/blueRouter.js' );
var blueRouter = require( '../../index.js' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Initialize options: in animations
    let options = {
        eventsByPage: pages,
        animationOut: false,
        routes: require( './routesInlineForNavigation.js' )
    };

    // Create new router instance
    return new blueRouter( options );
};

// Init router
const router = initRouter();

// Unit tests
require( './navigation.js' )();


