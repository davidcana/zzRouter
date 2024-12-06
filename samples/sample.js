// Sample

// Initialize options
let options = {
    browserHistoryOnLoad: true,
    pagePrefix: '!'
};

// Add routes to options
options.routes = [
    // Home page
    {
        'path': '',
        'content': `
<h1>Blue router sample</h1>

<nav>
    <a href="!">Home</a> |
    <a href="!about">About</a> |
    <a href="!links">Links</a> |
    <a href="https://www.wikipedia.org">Wikipedia</a>
</nav>

<div class="page" id="homePage">
    <h3>Home page</h3>
    This is the Home page
</div>
`
    },
    // About page
    {
        'path': 'about',
        'content': `
<h1>Blue router sample</h1>

<nav>
    <a href="!">Home</a> |
    <a href="!about">About</a> |
    <a href="!links">Links</a> |
    <a href="https://www.wikipedia.org">Wikipedia</a>
</nav>

<div class="page" id="aboutPage">
    <h3>About page</h3>
    This is the about page
</div>
`
    },
    // Links page
    {
        'path': 'links',
        'content': `
<h1>Blue router sample</h1>

<nav>
    <a href="!">Home</a> |
    <a href="!about">About</a> |
    <a href="!links">Links</a> |
    <a href="https://www.wikipedia.org">Wikipedia</a>
</nav>

<div class="page" id="linksPage">
    <h3>Links page</h3>
    This is the links page
</div>
`
    },
    // Default route (404 page)
    {
        'path': '(404)',
        'content': `
<h1>Blue router sample</h1>

<nav>
    <a href="!">Home</a> |
    <a href="!about">About</a> |
    <a href="!links">Links</a> |
    <a href="https://www.wikipedia.org">Wikipedia</a>
</nav>

<div class="page" id="404Page">
    <h3>404 page</h3>
    <p>Sorry</p>
    <p>Requested content not found.</p>
</div>
`
    }
];

// Create new router instance
let router = buildBlueRouter( options );

