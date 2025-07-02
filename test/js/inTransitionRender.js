// Tests for render, both transitions

import { zzRouter } from '/src/zzRouter.js';
import { page as renderWithoutWaitingPage } from './pages/renderWithoutWaiting.js';
import { page as renderWaitingForServerPage } from './pages/renderWaitingForServer.js';
import { routes } from './routesInlineForRender.js';
import { runTests } from './render.js';
import { zpt } from '/samples/deps/zpt.module.js';
import { context } from './context.js';
import { zzDOM } from '/samples/deps/zzDOM-closures-full.module.js';

const zz = zzDOM.zz;

// Init router
const initRouter = (() => {
    // Initialize pages
    const pages = {
        renderWithoutWaiting: renderWithoutWaitingPage,
        renderWaitingForServer: renderWaitingForServerPage
    };

    // Initialize options: no animations
    let initializeZPT = true;
    let options = {
        eventsByPage: pages,
        animationOut: false,
        routes: routes
    };

    // Add renderFunction
    options.renderFunction = ( page ) => {
        if ( initializeZPT ){
            zpt.run({
                'root': document.body,
                'dictionary': context.getDictionary()
            });
            initializeZPT = false;
        } else {
            zpt.run({
                'command': 'partialRender',
                'target': page[ 'el' ]
            });
        }
    };

    // Start router
    zzRouter.start( options );
})();

// Unit tests
runTests();

