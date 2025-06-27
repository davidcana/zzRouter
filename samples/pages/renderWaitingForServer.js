/* renderWaitingForServer page */

// Import modules
import { zpt } from '../deps/zpt.module.js';

export const page = {};

page[ 'preInit' ] = function( event ){
    const dictionary = zpt.getOptions().dictionary;
    dictionary[ 'successMessageFromServer' ] = 'Loading...';
};

page[ 'init' ] = function( event ){

    setTimeout(
        function(){
            const dictionary = zpt.getOptions().dictionary;
            dictionary[ 'successMessageFromServer' ] = 'It works!';
            zpt.run({
                'command': 'partialRender',
                'target': document.getElementById( 'renderWaitingForServer_message' )
            });
        },
        1000
    );
};

