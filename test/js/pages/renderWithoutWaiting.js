/* renderWithoutWaiting page */

import { context } from '../context.js';

export const page = {};

page[ 'preInit' ] = function( event ){
    //alert( 'EVENT_PRE_INIT' );
    const dictionary = context.getDictionary();
    dictionary[ 'successMessage' ] = 'It works!';
};


