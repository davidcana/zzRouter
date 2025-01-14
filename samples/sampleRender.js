// Sample

// Initialize pages
const pages = {};

// Initialize options
let initializeZPT = true;
let options = {
    eventsByPage: pages
};

// Add renderFunction
const dictionary = {};
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
        id: '[home]',
        url: 'pages/homeRender.html'
    },
    // Links page
    {
        id: 'links',
        url: 'pages/links.html'
    },
    // Text writer page
    {
        id: 'textWriter',
        keepAlive: true,
        url: 'pages/textWriter.html'
    },
    // Render without waiting page
    {
        id: 'renderWithoutWaiting',
        url: 'pages/renderWithoutWaiting.html'
    },
    // Render waiting for server page
    {
        id: 'renderWaitingForServer',
        url: 'pages/renderWaitingForServer.html'
    },
    // Default route (404 page)
    {
        id: '[404]',
        url: 'pages/404error.html'
    }
];

// Create new router instance
const router = new blueRouter.router( options );

