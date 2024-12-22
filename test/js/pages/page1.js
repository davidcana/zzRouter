/* page1 page */
const page = {};

page[ 'init' ] = function( event ){
    alert( 'EVENT_INIT' );
};

page[ 'reinit' ] = function( event ){
    alert( 'EVENT_REINIT' );
};

page[ 'mounted' ] = function( event ){
    alert( 'EVENT_MOUNTED' );
};

page[ 'beforeOut' ] = function( event ){
    alert( 'EVENT_BEFORE_OUT' );
};

page[ 'afterOut' ] = function( event ){
    alert( 'EVENT_AFTER_OUT' );
};

module.exports = page;
