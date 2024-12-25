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
    pages[ 'textWriter' ] = require( './pages/textWriter.js' );

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
    <h3>Text writer page</h3>
    <p>
        This is the text writer page. Write text and click 'Add text' button or press 'Enter' to add text.
    </p>

    <div class="field">
        <div>Text</div>
        <div>
            <input type="text" id="textWriter_textToAdd" name="textWriter_textToAdd" required>
            <button id="textWriter_addTextButton">Add text</button>
        </div>
    </div>

    <div class="field">
        <div>History</div>
        <div id="textWriter_history"></div>
    </div>
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
let eventList = [];
const router = initRouter();

// Unit tests

// Invoked from Simple events test and Simple events keepAlive test
const simpleEventTest = async function( assert, initEventAgain ){
    // Get a reference to finish the qunit test later
    var done = assert.async();

    // Start testing, eventList and expectedEventList must be empty at first
    eventList.length = 0;
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
    expectedEventList.push( initEventAgain );
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
    expectedEventList.push( initEventAgain );
    expectedEventList.push( 'page1_mounted' );
    assert.deepEqual( eventList , expectedEventList );
    
    // Go to home using link
    zz('#page1_homeLink').el.click();

    // Finish qunit test
    done();
};

// Check that all init events are page1_init
QUnit.test( "Simple events test", async function( assert ) {
    simpleEventTest( assert, 'page1_init' );
});

// Check that all the init events except the first one are page1_reinit
QUnit.test( "Simple events keepAlive test", async function( assert ) {

    // Set keepAlive of page1 to true
    router.routesMap[ 'page1' ][ 'keepAlive' ] = true;

    simpleEventTest( assert, 'page1_reinit' );
});

// Invoked from No keep alive in edited page test and Keep alive in edited page
const editedPageTest = async function( assert, textContent1, textContent2, textContent3, textContent4 ){
    // Get a reference to finish the qunit test later
    var done = assert.async();

    // Go to page 1 and then to textWriter page
    zz('#home_page1Link').el.click();
    zz('#page1_textWriterLink').el.click();
    assert.equal( zz('#textWriter_history').text(), '' );

    // Add some text and check it is added to textWriter_history
    zz('#textWriter_textToAdd').val( 'First line added' );
    zz('#textWriter_addTextButton').el.click();
    assert.equal( zz('#textWriter_history').text(), textContent1 );

    // Go back to page1, go forward to textWriter page
    history.back();
    await wait( 500 );
    history.forward();
    await wait( 500 );
    assert.equal( zz('#textWriter_history').text(), textContent2 );

    // Add some text and check it is added to textWriter_history
    zz('#textWriter_textToAdd').val( 'Second line added' );
    zz('#textWriter_addTextButton').el.click();
    assert.equal( zz('#textWriter_history').text(), textContent3 );

    // Go back to page1, go forward to textWriter page
    history.back();
    await wait( 500 );
    history.forward();
    await wait( 500 );
    assert.equal( zz('#textWriter_history').text(), textContent4 );
    
    // Go to home using link
    zz('#textWriter_homeLink').el.click();

    // Finish qunit test
    done();
};

QUnit.test( "No keep alive in edited page test", async function( assert ) {

    editedPageTest(
        assert,
        'First line added',
        '',
        'Second line added',
        ''
    );
});

QUnit.test( "Keep alive in edited page test", async function( assert ) {
    // Set keepAlive of page1 to true
    router.routesMap[ 'textWriter' ][ 'keepAlive' ] = true;
    
    editedPageTest(
        assert,
        'First line added',
        'First line added',
        'First line addedSecond line added',
        'First line addedSecond line added'
    );
});

const wait = function( timeout ) {
    return new Promise( resolve => {
        setTimeout( resolve, timeout );
    });
};

