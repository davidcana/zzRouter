/* renderWithoutWaiting page */
module.exports = function ( dictionary ) {
    
    var zpt = require( 'zpt' );

    const page = {};

    page[ 'preInit' ] = function( event ){

        dictionary[ 'successMessageFromServer' ] = 'Loading...';
    };

    page[ 'init' ] = function( event ){

        setTimeout(
            function(){
                dictionary[ 'successMessageFromServer' ] = 'It works!';
                zpt.run({
                    'command': 'partialRender',
                    'target': document.getElementById( 'renderWaitingForServer_message' )
                });
            },
            300
        );
    };

    return page;
};
