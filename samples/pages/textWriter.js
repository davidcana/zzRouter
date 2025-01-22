/* textWriter page */
pages[ 'textWriter' ] = {};

pages[ 'textWriter' ][ zzRouter.defaultOptions.EVENT_INIT ] = function( event ){
    //alert( 'EVENT_INIT' );

    document.getElementById( 'textWriter_addTextButton' ).addEventListener( 'click', function( event ){
        let text = document.getElementById( 'textWriter_textToAdd' ).value;
        //alert( 'text: ' + text );
        document.getElementById( 'textWriter_history' ).innerHTML += text + '<br>';
        document.getElementById( 'textWriter_textToAdd' ).value = '';
    });
};

pages[ 'textWriter' ][ zzRouter.defaultOptions.EVENT_REINIT ] = function( event ){
    //alert( 'EVENT_REINIT' );
};

pages[ 'textWriter' ][ zzRouter.defaultOptions.EVENT_MOUNTED ] = function( event ){
    //alert( 'EVENT_MOUNTED' );

    // Add text1 and text2 parameters to textWriter_history
    if ( event.params ){
        if ( event.params.text1 ){
            document.getElementById( 'textWriter_history' ).innerHTML += event.params.text1 + '<br>';
        }
        if ( event.params.text2 ){
            document.getElementById( 'textWriter_history' ).innerHTML += event.params.text2 + '<br>';
        }
    }
};

pages[ 'textWriter' ][ zzRouter.defaultOptions.EVENT_BEFORE_OUT ] = function( event ){
    //alert( 'EVENT_BEFORE_OUT' );
};

pages[ 'textWriter' ][ zzRouter.defaultOptions.EVENT_AFTER_OUT ] = function( event ){
    //alert( 'EVENT_AFTER_OUT' );
};


