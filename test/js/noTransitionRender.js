var Qunit = require( 'qunit' );
var zz = require( 'zzdom' );
var zpt = require( 'zpt' );
var blueRouter = require( '../../build/blueRouter.standalone.concat.js' );

// Init router
const initRouter = () => {
    // Initialize pages
    const pages = {};

    // Load js of pages
    const dictionary = {};
    pages[ 'renderWithoutWaiting' ] = require( './pages/renderWithoutWaiting.js' )( dictionary );
    pages[ 'renderWaitingForServer' ] = require( './pages/renderWaitingForServer.js' )( dictionary );

    // Initialize options: no animations
    let initializeZPT = true;
    let options = {
        pages: pages,
        animationOut: false,
        animationIn: false
    };

    // Add renderFunction
    options.renderFunction = ( page ) => {
        if ( initializeZPT ){
            zpt.run({
                'root': document.body,
                'dictionary': dictionary
            });
            initializeZPT = false;
        } else {
            zpt.run({
                'command': 'partialRender',
                'target': page[ 'el' ]
            });
        }
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
            <a href="!renderWithoutWaiting" id="home_renderWithoutWaitingLink">Page render without waiting</a>. Go to page render without waiting.
        </li>
        <li>
            <a href="!renderWaitingForServer" id="home_renderWaitingForServerLink">Page render waiting for server</a>. Go to page render waiting for server.
        </li>
    </ul>
</div>
`
        },
        // page render without waiting
        {
            'path': 'renderWithoutWaiting',
            'content': `
<h1>Blue router test</h1>

<div>
    <a href="!" id="renderWithoutWaiting_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page render</h3>
    <p id="renderWithoutWaiting_p">
        This is Page render without waiting
    </p>
    
    <h2 id="renderWithoutWaiting_message" data-content="successMessage">
        Not working!
    </h2>
</div>
`
        },
        // page render waiting for server
        {
            'path': 'renderWaitingForServer',
            'content': `
<h1>Blue router test</h1>

<div>
    <a href="!" id="renderWaitingForServer_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page render</h3>
    <p id="renderWaitingForServer_p">
        This is Page render waiting for server
    </p>
    
    <h2 id="renderWaitingForServer_message" data-content="successMessageFromServer">
        Not working!
    </h2>
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
const router = initRouter();

// Unit tests

// Non waiting render test
QUnit.test( "Non waiting render test", async function( assert ) {

    // Go to page renderWithoutWaiting
    zz('#home_renderWithoutWaitingLink').el.click();
    assert.equal( zz('#renderWithoutWaiting_p').text().trim() , "This is Page render without waiting" );

    // Check that render is ok
    assert.equal( zz('#renderWithoutWaiting_message').text().trim() , "It works!" );

    // Go to home page
    zz('#renderWithoutWaiting_homeLink').el.click();
});

// Waiting for server render test
QUnit.test( "Waiting for server render test", async function( assert ) {
    
    // Get a reference to finish the qunit test later
    var done = assert.async();

    // Go to page renderWithoutWaiting
    zz('#home_renderWaitingForServerLink').el.click();
    assert.equal( zz('#renderWaitingForServer_p').text().trim() , "This is Page render waiting for server" );
    await wait( 500 );
    
    // Check that render is ok
    assert.equal( zz('#renderWaitingForServer_message').text().trim() , "It works!" );

    // Go to home page
    zz('#renderWaitingForServer_homeLink').el.click();
    
    // Finish qunit test
    done();
});

const wait = function( timeout ) {
    return new Promise( resolve => {
        setTimeout( resolve, timeout );
    });
};
