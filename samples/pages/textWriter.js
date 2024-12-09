/* textWriter page */
pages[ 'textWriter' ] = {};

pages[ 'textWriter' ][ blueRouter.defaultOptions.EVENT_INIT ] = function( event ){
    //alert( 'EVENT_INIT' );

    document.getElementById( 'textWriter_addTextButton' ).addEventListener( 'click', function( event ){
        let text = document.getElementById( 'textWriter_textToAdd' ).value;
        //alert( 'text: ' + text );
        document.getElementById( 'textWriter_history' ).innerHTML += text + '<br>';
        document.getElementById( 'textWriter_textToAdd' ).value = '';
    });
};

pages[ 'textWriter' ][ blueRouter.defaultOptions.EVENT_REINIT ] = function(){
    //alert( 'EVENT_REINIT' );
};

pages[ 'textWriter' ][ blueRouter.defaultOptions.EVENT_MOUNTED ] = function(){
    //alert( 'EVENT_MOUNTED' );
};

pages[ 'textWriter' ][ blueRouter.defaultOptions.EVENT_BEFORE_OUT ] = function(){
    //alert( 'EVENT_BEFORE_OUT' );
};

pages[ 'textWriter' ][ blueRouter.defaultOptions.EVENT_AFTER_OUT ] = function(){
    //alert( 'EVENT_AFTER_OUT' );
};


