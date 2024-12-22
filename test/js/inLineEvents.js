"use strict";

var Qunit = require( 'qunit' );
var zz = require( 'zzdom' );
var blueRouter = require( '../../build/blueRouter.standalone.concat.js' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Load js of pages
    pages[ 'page1' ] = require( './pages/page1.js' )( eventList );

    // Initialize options: no animations
    let options = {
        pages: pages,
        animationOut: false,
        animationIn: false
    };

    // Add routes to options
    options.routes = [
        // Home page
        {
            'path': '[home]',
            'content': `
<h1>Blue router test</h1>

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
`
        },
        // page1
        {
            'path': 'page1',
            'content': `
<h1>Blue router test</h1>

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
`
        },
        // textWriter
        {
            'path': 'textWriter',
            'content': `
<h1>Blue router test</h1>

<div>
    <a href="!" id="textWriter_homeLink">Home</a>
</div>

<div class="page-content">

</div>
`
        },
        // page2
        {
            'path': 'page2',
            'content': `
<h1>Blue router test</h1>

<div>
    <a href="!" id="page2_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 2</h3>
    <p>
        This is Page 2
    </p>
</div>
`
        },
        // Default route (404 page)
        {
            'path': '[404]',
            'content': `
<h1>Blue router test</h1>

<div>
    <a href="!" id="e404_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>404 page</h3>
    <p>
        Sorry
    </p>
    <p id="e404_p">
        Requested content not found.
    </p>
</div>
`
        }
    ];

    // Create new router instance
    return new blueRouter.router( options );
};

// Init router
const eventList = [];
const router = initRouter();

// Unit tests
QUnit.test( "Simple events test", async function( assert ) {
    
    // Get a reference to finish the qunit test later
    var done = assert.async();

    // Start testing
    const expectedEventList = [];
    assert.deepEqual( eventList , expectedEventList );

    // Go to page 1
    zz('#home_page1Link').el.click();
    expectedEventList.push( 'page1_init' );
    expectedEventList.push( 'page1_mounted' );
    assert.deepEqual( eventList , expectedEventList );

    // Go to home using link
    zz('#page1_homeLink').el.click();
    expectedEventList.push( 'page1_beforeOut' );
    expectedEventList.push( 'page1_afterOut' );
    assert.deepEqual( eventList , expectedEventList );

    // Go to page 1 again
    zz('#home_page1Link').el.click();
    expectedEventList.push( 'page1_init' );
    expectedEventList.push( 'page1_mounted' );
    assert.deepEqual( eventList , expectedEventList );

    // Go to home using back
    history.back();
    await wait( 500 );
    expectedEventList.push( 'page1_beforeOut' );
    expectedEventList.push( 'page1_afterOut' );
    assert.deepEqual( eventList , expectedEventList );
    
    // Go to page 1 again using forward
    history.forward();
    await wait( 500 );
    expectedEventList.push( 'page1_init' );
    expectedEventList.push( 'page1_mounted' );
    assert.deepEqual( eventList , expectedEventList );

    // Finish qunit test
    done();
});

const wait = function( timeout ) {
    return new Promise( resolve => {
        setTimeout( resolve, timeout );
    });
};

