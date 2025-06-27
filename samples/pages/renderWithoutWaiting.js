/* renderWithoutWaiting page */

// Import modules
import { zpt } from '../deps/zpt.module.js';

export const page = {};

page[ 'preInit' ] = function( event ){
    //alert( 'EVENT_PRE_INIT' );

    const dictionary = zpt.getOptions().dictionary;
    dictionary[ 'successMessage' ] = 'It works!';
};



