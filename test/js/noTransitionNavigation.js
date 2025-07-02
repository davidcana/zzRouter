// Tests for navigation, no transitions

import { zzRouter } from '/src/zzRouter.js';
import { routes } from './routesInlineForNavigation.js';
import { runTests } from './navigation.js';

// Init router
const initRouter = (() => {
    // Initialize pages
    const pages = {};

    // Initialize options: no animations
    let options = {
        eventsByPage: pages,
        animationOut: false,
        animationIn: false,
        routes: routes
    };

    // Start router
    zzRouter.start( options );
})();

// Unit tests
runTests();


