/* renderWithoutWaiting page */
pages[ 'renderWithoutWaiting' ] = {};

pages[ 'renderWithoutWaiting' ][ blueRouter.defaultOptions.EVENT_PRE_INIT ] = function( event ){
    //alert( 'EVENT_PRE_INIT' );

    dictionary[ 'successMessage' ] = 'It works!';
};



