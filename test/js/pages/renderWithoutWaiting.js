/* renderWithoutWaiting page */

module.exports = function ( dictionary ) {

    const page = {};

    page[ 'preInit' ] = function( event ){
        //alert( 'EVENT_PRE_INIT' );

        dictionary[ 'successMessage' ] = 'It works!';
    };

    return page;
};
