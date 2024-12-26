// Tests for navigation, both transitions

var Qunit = require( 'qunit' );
var blueRouter = require( '../../build/blueRouter.standalone.concat.js' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Initialize options: both animations
    let options = {
        pages: pages,
        routes: require( './routesInlineForNavigation.js' )
    };

    // Create new router instance
    return new blueRouter.router( options );
};

// Init router
const router = initRouter();

// Import navigation tests
var navigation = require( './navigation.js' );

// Unit tests
QUnit.test( "Simple navigation test", async function( assert ) {
    return navigation.simpleNavigationTest( assert );
});

QUnit.test( "History navigation test", async function( assert ) {
    return navigation.historyNavigationTest( assert );
});

QUnit.test( "404 error test", async function( assert ) {
    return navigation._404ErrorTest( assert );
});


