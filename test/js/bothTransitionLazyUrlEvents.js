// Tests for events, both transitions

//var blueRouter = require( '../../dist/blueRouter.js' );
var blueRouter = require( '../../index.js' );
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
        eventsByPage: pages,
        routes: require( './routesUrlForEvents.js' )
    };
    
    // Create new router instance
    return new blueRouter( options );
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

    // Define some page contents
    const homeContent =`<h1>Blue router test</h1>

<div class="page-content">
    <h3>Home page</h3>
    <p>
        This is Home page
    </p>

    <ul id="home_links">
        <li>
            <a href="!page1" id="home_page1Link">Page 1</a>. Go to page 1.
        </li>
        <li>
            <a href="!page2" id="home_page2Link">Page 2</a>. Go to page 2.
        </li>
    </ul>
</div>
`;

    const page1Content =`<h1>Blue router test</h1>

<div>
    <a href="!" id="page1_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 1</h3>
    <p>
        This is Page 1
    </p>

    <ul id="page1_links">
        <li>
            <a href="!textWriter" id="page1_textWriterLink">Text writer</a>. Go to Text writer page.
        </li>
    </ul>
</div>
`;
    
    // Test urls and that contents are undefined yet
    assert.equal( router.routesMap[ 'page1' ].url , 'pages/page1.html' );
    assert.equal( router.routesMap[ 'page1' ].content , undefined );
    assert.equal( router.routesMap[ 'textWriter' ].url , 'pages/textWriter.html' );
    assert.equal( router.routesMap[ 'textWriter' ].content , undefined );
    assert.equal( router.routesMap[ 'page2' ].url , 'pages/page2.html' );
    assert.equal( router.routesMap[ 'page2' ].content , undefined );
    assert.equal( router.routesMap[ '[404]' ].url , 'pages/404.html' );
    assert.equal( router.routesMap[ '[404]' ].content , undefined );

    // Test home, content must have been already loaded
    assert.equal( router.routesMap[ '[home]' ].url , 'pages/home.html' );
    //assert.ok( router.routesMap[ '[home]' ].content.startsWith( '<h1>Blue router test</h1>' ) );
    assert.equal( router.routesMap[ '[home]' ].content , homeContent );

    // Go to page 1
    zz('#home_page1Link').el.click();
    await utils.waitShort();
    assert.equal( zz('#page1_textWriterLink').html() , "Text writer" );
    
    // Test urls and that contents are undefined yet
    assert.equal( router.routesMap[ 'textWriter' ].url , 'pages/textWriter.html' );
    assert.equal( router.routesMap[ 'textWriter' ].content , undefined );
    assert.equal( router.routesMap[ 'page2' ].url , 'pages/page2.html' );
    assert.equal( router.routesMap[ 'page2' ].content , undefined );
    assert.equal( router.routesMap[ '[404]' ].url , 'pages/404.html' );
    assert.equal( router.routesMap[ '[404]' ].content , undefined );
    
    // Test home and page1, content must have been already loaded
    assert.equal( router.routesMap[ '[home]' ].url , 'pages/home.html' );
    assert.ok( router.routesMap[ '[home]' ].content.startsWith( '<h1>Blue router test</h1>' ) );
    assert.equal( router.routesMap[ 'page1' ].url , 'pages/page1.html' );
    //assert.ok( router.routesMap[ 'page1' ].content.startsWith( '<h1>Blue router test</h1>' ) );
    assert.equal( router.routesMap[ 'page1' ].content , page1Content );

    // Go to home
    zz('#page1_homeLink').el.click();
    await utils.waitShort();

    // Finish qunit test
    done();
});

require( './events.js' )( router, eventList );


