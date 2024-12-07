// Sample

// Initialize pages
const pages = {};

// Initialize options
let options = {
    pages: pages
};

// Add routes to options
options.routes = [
    // Home page
    {
        'path': '',
        'content': `
<div class="page" id="links">
    <h1>Blue router sample</h1>

    <nav>
        <a href="!">Home</a> |
        <a href="!links">Links</a> |
        <a href="!textWriter">Text writer</a>
    </nav>

    <div class="page-content">
        <h3>Home page</h3>
        <p>
            This is the Home page
        </p>
    </div>
</div>
`
    },
    // Links page
    {
        'path': 'links',
        'content': `
<div class="page" id="links">
    <h1>Blue router sample</h1>

    <nav>
        <a href="!">Home</a> |
        <a href="!links">Links</a> |
        <a href="!textWriter">Text writer</a>
    </nav>

    <div class="page-content">
        <h3>Links page</h3>
        <p>
            This is the links page
        </p>

        <ul>
            <li>
                <a href="https://github.com/davidcana/blueRouter">Blue router</a>.
                A simple router component to make it easy build Single Page Applications.
            </li>
            <li>
                <a href="https://davidcana.github.io/ZPT-JS/">ZPT-JS</a>.
                Zenon Page Templates - JS (ZPT-JS) is a Javascript implementation of Zope Page Templates (ZPT).
            </li>
            <li>
                <a href="https://github.com/davidcana/ZPT-Java">ZPT-Java</a>.
                JPT is a Java implementation of Zope Page Templates (ZPT).
            </li>
            <li>
                <a href="https://github.com/davidcana/zzDOM">zzDOM</a>.
                A tiny javascript API that implements only the DOM functions of jquery including chaining.
            </li>
        </ul>
    </div>
</div>
`
    },
    // Text writer page
    {
        'path': 'textWriter',
        'content': `
<div class="page" id="textWriter">
    <h1>Blue router sample</h1>

    <nav>
        <a href="!">Home</a> |
        <a href="!links">Links</a> |
        <a href="!textWriter">Text writer</a>
    </nav>

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
</div>
`
    },
    // Default route (404 page)
    {
        'path': '(404)',
        'content': `
<div class="page" id="404page">
    <h1>Blue router sample</h1>

    <nav>
        <a href="!">Home</a> |
        <a href="!links">Links</a> |
        <a href="!textWriter">Text writer</a>
    </nav>

    <div class="page-content">
        <h3>404 page</h3>
        <p>
            Sorry
        </p>
        <p>
            Requested content not found.
        </p>
    </div>
</div>
`
    }
];

// Create new router instance
let router = buildBlueRouter( options );

