// Tests for navigation, both transitions

import { zzRouter } from '/src/zzRouter.js';
import { routes } from './routesInlineForNavigation.js';
import { runTests } from './navigation.js';

// Init router
const initRouter = (() => {
    // Initialize pages
    const pages = {};

    // Initialize options: in animations
    let options = {
        eventsByPage: pages,
        animationOut: false,
        routes: routes
    };

    // Start router
    zzRouter.start( options );
})();

// Unit tests
runTests();


