// Tests for events, both transitions and preloadPagesOnStart

import { zzRouter } from '/src/zzRouter.js';
import { page as page1 } from './pages/page1.js';
import { page as textWriterPage } from './pages/textWriter.js';
import { routes } from './routesUrlForEvents.js';
import { runTests } from './events.js';
import { utils } from './utils.js';
import { zzDOM } from '/samples/deps/zzDOM-closures-full.module.js';

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

    // Initialize options: both animations and preloadPagesOnStart
    let options = {
        eventsByPage: pages,
        routes: routes,
        preloadPagesOnStart: true
    };
    
    // Start router
    zzRouter.start( options );
})();

// Unit tests
QUnit.test( "Preload URLs test", async function( assert ) {

    // Get a reference to finish the qunit test later
    var done = assert.async();

    // Wait for animations
    await utils.waitShort();

    // Define some page contents
    const homeContent = `<h1>zzRouter test</h1>

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

    const page1Content = `<h1>zzRouter test</h1>

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

    const textWriterContent = `<h1>zzRouter test</h1>

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
`;

    const page2Content = `<h1>zzRouter test</h1>

<div>
    <a href="!" id="page2_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 2</h3>
    <p>
        This is Page 2
    </p>
</div>
`;

    const _404Content = `<h1>zzRouter test</h1>

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
`;

    // Test all pages, content must have been already loaded
    assert.equal( zzRouter.routesMap[ '[home]' ].url , 'pages/home.html' );
    assert.equal( zzRouter.routesMap[ '[home]' ].content , homeContent );
    assert.equal( zzRouter.routesMap[ 'page1' ].url , 'pages/page1.html' );
    assert.equal( zzRouter.routesMap[ 'page1' ].content , page1Content );
    assert.equal( zzRouter.routesMap[ 'textWriter' ].url , 'pages/textWriter.html' );
    assert.equal( zzRouter.routesMap[ 'textWriter' ].content , textWriterContent );
    assert.equal( zzRouter.routesMap[ 'page2' ].url , 'pages/page2.html' );
    assert.equal( zzRouter.routesMap[ 'page2' ].content , page2Content );
    assert.equal( zzRouter.routesMap[ '[404]' ].url , 'pages/404.html' );
    assert.equal( zzRouter.routesMap[ '[404]' ].content , _404Content );

    // Finish qunit test
    done();
});

// More unit tests
runTests( zzRouter, eventList );

