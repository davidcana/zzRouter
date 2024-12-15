/* renderWithoutWaiting page */
pages[ 'renderWaitingForServer' ] = {};

pages[ 'renderWaitingForServer' ][ blueRouter.defaultOptions.EVENT_PRE_INIT ] = function( event ){

    dictionary[ 'successMessageFromServer' ] = 'Loading...';
};

pages[ 'renderWaitingForServer' ][ blueRouter.defaultOptions.EVENT_INIT ] = function( event ){

    setTimeout(
        function(){
            dictionary[ 'successMessageFromServer' ] = 'It works!';
            zpt.run({
                'command': 'partialRender',
                'target': document.getElementById( 'renderWaitingForServer_message' )
            });
        },
        1000
    );
};

