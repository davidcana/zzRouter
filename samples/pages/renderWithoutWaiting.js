/* renderWithoutWaiting page */

// Import modules
//import { zpt } from '../deps/zpt.module.js';
import { context } from '../context.js';

export const page = {};

page[ 'preInit' ] = function( event ){
    //alert( 'EVENT_PRE_INIT' );

    //const dictionary = zpt.getOptions().dictionary;
    const dictionary = context.getDictionary();
    dictionary[ 'successMessage' ] = 'It works!';
};



