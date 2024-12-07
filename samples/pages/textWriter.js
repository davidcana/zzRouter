/* textWriter page */
pages[ 'textWriter' ] = {};

pages[ 'textWriter' ][ blueRouter.defaultOptions.EVENT_INIT ] = function(){
    alert( 'EVENT_INIT' );


    
};

pages[ 'textWriter' ][ blueRouter.defaultOptions.EVENT_REINIT ] = function(){
    alert( 'EVENT_REINIT' );
};

pages[ 'textWriter' ][ blueRouter.defaultOptions.EVENT_MOUNTED ] = function(){
    alert( 'EVENT_MOUNTED' );
};

pages[ 'textWriter' ][ blueRouter.defaultOptions.EVENT_BEFORE_OUT ] = function(){
    alert( 'EVENT_BEFORE_OUT' );
};

pages[ 'textWriter' ][ blueRouter.defaultOptions.EVENT_AFTER_OUT ] = function(){
    alert( 'EVENT_AFTER_OUT' );
};


