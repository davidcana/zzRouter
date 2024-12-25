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
            <a href="!page2" id="home_page2Link">Page 2</a>. Go to page 2.
        </li>
    </ul>
</div>
`
        },
        // page render
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
const router = initRouter();

// Unit tests

// 
QUnit.test( "Non waiting render test", async function( assert ) {

    // Go to page renderWithoutWaiting
    zz('#home_renderWithoutWaitingLink').el.click();
    assert.equal( zz('#renderWithoutWaiting_p').text().trim() , "This is Page render without waiting" );

    // Check that render is ok
    assert.equal( zz('#renderWithoutWaiting_message').text().trim() , "It works!" );

    // Go to home page
    zz('#renderWithoutWaiting_homeLink').el.click();
});
