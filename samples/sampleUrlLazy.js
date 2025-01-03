// Sample

// Initialize pages
const pages = {};

// Initialize options
let options = {
    eventsByPage: pages
};

// Add routes to options
options.routes = [
    // Home page
    {
        'path': '[home]',
        'url': 'pages/home.html'
    },
    // Links page
    {
        'path': 'links',
        'url': 'pages/links.html'
    },
    // Text writer page
    {
        'path': 'textWriter',
        'keepAlive': true,
        'url': 'pages/textWriter.html'
    },
    // Default route (404 page)
    {
        'path': '[404]',
        'url': 'pages/404error.html'
    }
];

// Create new router instance
const router = new blueRouter.router( options );

