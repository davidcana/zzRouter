// Tests for events, both transitions

var blueRouter = require( '../../build/blueRouter.standalone.concat.js' );
var utils = require( './utils.js' );
var Qunit = require( 'qunit' );
var zz = require( 'zzdom' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Load js of pages
    pages[ 'page1' ] = require( './pages/page1.js' )( eventList );
    pages[ 'textWriter' ] = require( './pages/textWriter.js' );

    // Initialize options: both animations
    let options = {
        pages: pages,
        routes: require( './routesUrlForEvents.js' )
    };
    
    // Create new router instance
    return new blueRouter.router( options );
};

// Init router
let eventList = [];
const router = initRouter();

// Unit tests
QUnit.test( "Lazy URLs test", async function( assert ) {

    // Get a reference to finish the qunit test later
    var done = assert.async();

    // Wait for animations
    await utils.waitShort();

    // Test urls and that contents are undefined yet
    assert.equal( router.routesMap[ 'page1' ][ 'url' ] , 'pages/page1.html' );
    assert.equal( router.routesMap[ 'page1' ][ 'content' ] , undefined );
    assert.equal( router.routesMap[ 'textWriter' ][ 'url' ] , 'pages/textWriter.html' );
    assert.equal( router.routesMap[ 'textWriter' ][ 'content' ] , undefined );
    assert.equal( router.routesMap[ 'page2' ][ 'url' ] , 'pages/page2.html' );
    assert.equal( router.routesMap[ 'page2' ][ 'content' ] , undefined );
    assert.equal( router.routesMap[ '[404]' ][ 'url' ] , 'pages/404.html' );
    assert.equal( router.routesMap[ '[404]' ][ 'content' ] , undefined );

    // Test home, content must have been already loaded
    assert.equal( router.routesMap[ '[home]' ][ 'url' ] , 'pages/home.html' );
    assert.ok( router.routesMap[ '[home]' ][ 'content' ].startsWith( '<h1>Blue router test</h1>' ) );

    // Go to page 1
    zz('#home_page1Link').el.click();
    await utils.waitShort();
    assert.equal( zz('#page1_textWriterLink').html() , "Text writer" );
    
    // Test urls and that contents are undefined yet
    assert.equal( router.routesMap[ 'textWriter' ][ 'url' ] , 'pages/textWriter.html' );
    assert.equal( router.routesMap[ 'textWriter' ][ 'content' ] , undefined );
    assert.equal( router.routesMap[ 'page2' ][ 'url' ] , 'pages/page2.html' );
    assert.equal( router.routesMap[ 'page2' ][ 'content' ] , undefined );
    assert.equal( router.routesMap[ '[404]' ][ 'url' ] , 'pages/404.html' );
    assert.equal( router.routesMap[ '[404]' ][ 'content' ] , undefined );
    
    // Test home and page1, content must have been already loaded
    assert.equal( router.routesMap[ '[home]' ][ 'url' ] , 'pages/home.html' );
    assert.ok( router.routesMap[ '[home]' ][ 'content' ].startsWith( '<h1>Blue router test</h1>' ) );
    assert.equal( router.routesMap[ 'page1' ][ 'url' ] , 'pages/page1.html' );
    assert.ok( router.routesMap[ 'page1' ][ 'content' ].startsWith( '<h1>Blue router test</h1>' ) );

    // Go to home
    zz('#page1_homeLink').el.click();
    await utils.waitShort();

    // Finish qunit test
    done();
});

require( './events.js' )( router, eventList );


