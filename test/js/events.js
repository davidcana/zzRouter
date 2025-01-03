// Tests for events

var zz = require( 'zzdom' );
var utils = require( './utils.js' );
var Qunit = require( 'qunit' );

// Unit tests
module.exports = function ( router, eventList ) {

    // Invoked from Simple events test and Simple events keepAlive test
    const simpleEventTest = async function( assert, initEventAgain ){
        // Get a reference to finish the qunit test later
        var done = assert.async();
        
        // Wait in case lazy Url
        await utils.waitShort();

        // Start testing, eventList and expectedEventList must be empty at first
        eventList.length = 0;
        const expectedEventList = [];
        assert.deepEqual( eventList , expectedEventList );

        // Go to page 1
        zz('#home_page1Link').el.click();
        await utils.waitShort();
        expectedEventList.push( 'page1_init' );
        expectedEventList.push( 'page1_mounted' );
        assert.deepEqual( eventList , expectedEventList );

        // Go to home using link
        zz('#page1_homeLink').el.click();
        await utils.waitShort();
        expectedEventList.push( 'page1_beforeOut' );
        expectedEventList.push( 'page1_afterOut' );
        assert.deepEqual( eventList , expectedEventList );

        // Go to page 1 again
        zz('#home_page1Link').el.click();
        await utils.waitShort();
        expectedEventList.push( initEventAgain );
        expectedEventList.push( 'page1_mounted' );
        assert.deepEqual( eventList , expectedEventList );

        // Go to home using back
        history.back();
        await utils.waitShort();
        expectedEventList.push( 'page1_beforeOut' );
        expectedEventList.push( 'page1_afterOut' );
        assert.deepEqual( eventList , expectedEventList );
        
        // Go to page 1 again using forward
        history.forward();
        await utils.waitShort();
        expectedEventList.push( initEventAgain );
        expectedEventList.push( 'page1_mounted' );
        assert.deepEqual( eventList , expectedEventList );
        
        // Go to home using link
        zz('#page1_homeLink').el.click();
        await utils.waitShort();

        // Finish qunit test
        done();
    };

    // Check that all init events are page1_init
    QUnit.test( "Simple events test", async function( assert ) {
        simpleEventTest( assert, 'page1_init' );
    });

    // Check that all the init events except the first one are page1_reinit
    QUnit.test( "Simple events keepAlive test", async function( assert ) {

        // Set keepAlive of page1 to true
        router.routesMap[ 'page1' ].keepAlive = true;

        simpleEventTest( assert, 'page1_reinit' );
    });

    // Invoked from No keep alive in edited page test and Keep alive in edited page
    const editedPageTest = async function( assert, textContent1, textContent2, textContent3, textContent4 ){
        // Get a reference to finish the qunit test later
        var done = assert.async();

        // Go to page 1 and then to textWriter page
        zz('#home_page1Link').el.click();
        await utils.waitShort();
        zz('#page1_textWriterLink').el.click();
        await utils.waitShort();
        assert.equal( zz('#textWriter_history').text(), '' );

        // Add some text and check it is added to textWriter_history
        zz('#textWriter_textToAdd').val( 'First line added' );
        zz('#textWriter_addTextButton').el.click();
        assert.equal( zz('#textWriter_history').text(), textContent1 );

        // Go back to page1, go forward to textWriter page
        history.back();
        await utils.waitShort();
        history.forward();
        await utils.waitShort();
        assert.equal( zz('#textWriter_history').text(), textContent2 );

        // Add some text and check it is added to textWriter_history
        zz('#textWriter_textToAdd').val( 'Second line added' );
        zz('#textWriter_addTextButton').el.click();
        assert.equal( zz('#textWriter_history').text(), textContent3 );

        // Go back to page1, go forward to textWriter page
        history.back();
        await utils.waitShort();
        history.forward();
        await utils.waitShort();
        assert.equal( zz('#textWriter_history').text(), textContent4 );
        
        // Go to home using link
        zz('#textWriter_homeLink').el.click();
        await utils.waitShort();

        // Finish qunit test
        done();
    };

    QUnit.test( "No keep alive in edited page test", async function( assert ) {

        editedPageTest(
            assert,
            'First line added',
            '',
            'Second line added',
            ''
        );
    });

    QUnit.test( "Keep alive in edited page test", async function( assert ) {
        // Set keepAlive of page1 to true
        router.routesMap[ 'textWriter' ].keepAlive = true;
        
        editedPageTest(
            assert,
            'First line added',
            'First line added',
            'First line addedSecond line added',
            'First line addedSecond line added'
        );
    });

};
