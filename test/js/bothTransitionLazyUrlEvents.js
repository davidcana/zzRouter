// Tests for events, both transitions

import { zzRouter } from '/src/zzRouter.js';
import { page as page1 } from './pages/page1.js';
import { page as textWriterPage } from './pages/textWriter.js';
import { routes } from './routesUrlForEvents.js';
import { utils } from './utils.js';
import { zzDOM } from '/samples/deps/zzDOM-closures-full.module.js';
import { runTests } from './events.js';

const zz = zzDOM.zz;

// Init router
let eventList = [];
const initRouter = (() => {
    // Initialize pages
    const pages = {
        page1: page1,
        textWriter: textWriterPage
    };
    
    // Init eventList in page 1
    page1[ 'setEventList' ]( eventList );

    // Initialize options: both animations
    let options = {
        eventsByPage: pages,
        routes: routes
    };
    
    // Start router
    zzRouter.start( options );
})();

// Unit tests
QUnit.test( "Lazy URLs test", async function( assert ) {

    // Get a reference to finish the qunit test later
    var done = assert.async();

    // Wait for animations
    await utils.waitShort();

    // Define some page contents
    const homeContent =`<h1>zzRouter test</h1>

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

    const page1Content =`<h1>zzRouter test</h1>

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
    assert.equal( zzRouter.routesMap[ 'page1' ].url , 'pages/page1.html' );
    assert.equal( zzRouter.routesMap[ 'page1' ].content , undefined );
    assert.equal( zzRouter.routesMap[ 'textWriter' ].url , 'pages/textWriter.html' );
    assert.equal( zzRouter.routesMap[ 'textWriter' ].content , undefined );
    assert.equal( zzRouter.routesMap[ 'page2' ].url , 'pages/page2.html' );
    assert.equal( zzRouter.routesMap[ 'page2' ].content , undefined );
    assert.equal( zzRouter.routesMap[ '[404]' ].url , 'pages/404.html' );
    assert.equal( zzRouter.routesMap[ '[404]' ].content , undefined );

    // Test home, content must have been already loaded
    assert.equal( zzRouter.routesMap[ '[home]' ].url , 'pages/home.html' );
    //assert.ok( zzRouter.routesMap[ '[home]' ].content.startsWith( '<h1>zzRouter test</h1>' ) );
    assert.equal( zzRouter.routesMap[ '[home]' ].content , homeContent );

    // Go to page 1
    zz('#home_page1Link').el.click();
    await utils.waitShort();
    assert.equal( zz('#page1_textWriterLink').html() , "Text writer" );
    
    // Test urls and that contents are undefined yet
    assert.equal( zzRouter.routesMap[ 'textWriter' ].url , 'pages/textWriter.html' );
    assert.equal( zzRouter.routesMap[ 'textWriter' ].content , undefined );
    assert.equal( zzRouter.routesMap[ 'page2' ].url , 'pages/page2.html' );
    assert.equal( zzRouter.routesMap[ 'page2' ].content , undefined );
    assert.equal( zzRouter.routesMap[ '[404]' ].url , 'pages/404.html' );
    assert.equal( zzRouter.routesMap[ '[404]' ].content , undefined );
    
    // Test home and page1, content must have been already loaded
    assert.equal( zzRouter.routesMap[ '[home]' ].url , 'pages/home.html' );
    assert.ok( zzRouter.routesMap[ '[home]' ].content.startsWith( '<h1>zzRouter test</h1>' ) );
    assert.equal( zzRouter.routesMap[ 'page1' ].url , 'pages/page1.html' );
    //assert.ok( zzRouter.routesMap[ 'page1' ].content.startsWith( '<h1>zzRouter test</h1>' ) );
    assert.equal( zzRouter.routesMap[ 'page1' ].content , page1Content );

    // Go to home
    zz('#page1_homeLink').el.click();
    await utils.waitShort();

    // Finish qunit test
    done();
});

runTests( zzRouter, eventList );

