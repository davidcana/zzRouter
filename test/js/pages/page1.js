/* page1 page */

export const page = {};

page[ 'setEventList' ] = function( _eventList ){
    this.eventList = _eventList;
};

page[ 'init' ] = function( event ){
    //alert( 'EVENT_INIT' );
    this.eventList.push( 'page1_init' );
};

page[ 'reinit' ] = function( event ){
    //alert( 'EVENT_REINIT' );
    this.eventList.push( 'page1_reinit' );
};

page[ 'mounted' ] = function( event ){
    //alert( 'EVENT_MOUNTED' );
    this.eventList.push( 'page1_mounted' );
};

page[ 'beforeOut' ] = function( event ){
    //alert( 'EVENT_BEFORE_OUT' );
    this.eventList.push( 'page1_beforeOut' );
};

page[ 'afterOut' ] = function( event ){
    //alert( 'EVENT_AFTER_OUT' );
    this.eventList.push( 'page1_afterOut' );
};

