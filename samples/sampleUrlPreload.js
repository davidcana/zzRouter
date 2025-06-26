// Sample

// Import modules
import { zzRouter } from '../src/zzRouter.js';
import { page as textWriterPage } from './pages/textWriter.js';

// Initialize pages
const pages = {
    textWriter: textWriterPage
};

// Initialize options
let options = {
    eventsByPage: pages,
    preloadPagesOnStart: true
};

// Add routes to options
options.routes = [
    // Home page
    {
        id: '[home]',
        url: 'pages/home.html'
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
    // Default route (404 page)
    {
        id: '[404]',
        url: 'pages/404error.html'
    }
];

// Start router
zzRouter.start( options );

