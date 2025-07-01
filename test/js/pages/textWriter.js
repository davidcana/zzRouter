/* textWriter page */
export const page = {};

page[ 'init' ] = function( event ){
    //alert( 'EVENT_INIT' );

    document.getElementById( 'textWriter_addTextButton' ).addEventListener( 'click', function( event ){
        let text = document.getElementById( 'textWriter_textToAdd' ).value;
        //alert( 'text: ' + text );
        document.getElementById( 'textWriter_history' ).innerHTML += text + '<br>';
        document.getElementById( 'textWriter_textToAdd' ).value = '';
    });
};

page[ 'mounted' ] = function( event ){
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

