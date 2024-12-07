/* blueRouter object */
/**
 * A namespace.
 * @const
 */
var blueRouter = {};

/*
    build function
    
    buildBlueRouter(
        {
            routes: routes,
            pages: pages
        }
    );
*/
/**
 * @param {Object} options
 */
blueRouter.build = function( options ){
    return new blueRouter.router( options );
};

// Register blueBlueRouter function
var buildBlueRouter;
(function() { 
    buildBlueRouter = blueRouter.build; 
})();
