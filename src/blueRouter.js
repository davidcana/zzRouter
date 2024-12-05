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
            browserHistoryOnLoad: true,
            pagePrefix: '!',
            externalClass: 'external'
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
