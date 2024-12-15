// Sample

// Initialize pages
const pages = {};

// Initialize options
let initializeZPT = true;
const dictionary = {};
let options = {
    pages: pages,
    renderFunction: ( page ) => {
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
    }
};

// Add routes to options
options.routes = [
    // Home page
    {
        'path': '[home]',
        'url': 'pages/homeRender.html'
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
let router = buildBlueRouter( options );

