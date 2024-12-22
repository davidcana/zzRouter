/* page1 page */


//module.exports = page;
module.exports = function ( eventList ) {

    const page = {};

    page[ 'init' ] = function( event ){
        //alert( 'EVENT_INIT' );
        eventList.push( 'page1_init' );
    };
    
    page[ 'reinit' ] = function( event ){
        //alert( 'EVENT_REINIT' );
        eventList.push( 'page1_reinit' );
    };
    
    page[ 'mounted' ] = function( event ){
        //alert( 'EVENT_MOUNTED' );
        eventList.push( 'page1_mounted' );
    };
    
    page[ 'beforeOut' ] = function( event ){
        //alert( 'EVENT_BEFORE_OUT' );
        eventList.push( 'page1_beforeOut' );
    };
    
    page[ 'afterOut' ] = function( event ){
        //alert( 'EVENT_AFTER_OUT' );
        eventList.push( 'page1_afterOut' );
    };

    return page;
};
