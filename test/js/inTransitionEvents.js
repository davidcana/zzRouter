// Tests for events, both transitions

import { zzRouter } from '/src/zzRouter.js';
import { page as page1 } from './pages/page1.js';
import { page as textWriterPage } from './pages/textWriter.js';
import { routes } from './routesInlineForEvents.js';
import { runTests } from './events.js';

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
        animationOut: false,
        routes: routes
    };
    
    // Start router
    zzRouter.start( options );
})();

// Unit tests
runTests( zzRouter, eventList );

