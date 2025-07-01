export const utils = {};

utils.waitShort = function() {
    return utils.wait( 1000 );
};

utils.wait = function( timeout ) {
    return new Promise( resolve => {
        setTimeout( resolve, timeout );
    });
};

