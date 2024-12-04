// Sample

// Initialize options
let options = {
    browserHistoryOnLoad: true
};

// Add routes to options
options.routes = [
    // Home page
    {
        'path': '',
        'content': `
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

