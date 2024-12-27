// Tests for events

var zz = require( 'zzdom' );
var utils = require( './utils.js' );
var Qunit = require( 'qunit' );

// Unit tests
module.exports = function () {

    // Non waiting render test
    QUnit.test( "Non waiting render test", async function( assert ) {
        
        // Get a reference to finish the qunit test later
        var done = assert.async();

        // Go to page renderWithoutWaiting
        zz('#home_renderWithoutWaitingLink').el.click();
        await utils.waitShort();
        assert.equal( zz('#renderWithoutWaiting_p').text().trim() , "This is Page render without waiting" );

        // Check that render is ok
        assert.equal( zz('#renderWithoutWaiting_message').text().trim() , "It works!" );

        // Go to home page
        zz('#renderWithoutWaiting_homeLink').el.click();
        await utils.waitShort();

        // Finish qunit test
        done();
    });

    // Waiting for server render test
    QUnit.test( "Waiting for server render test", async function( assert ) {
        
        // Get a reference to finish the qunit test later
        var done = assert.async();

        // Go to page renderWithoutWaiting
        zz('#home_renderWaitingForServerLink').el.click();
        await utils.waitShort();
        assert.equal( zz('#renderWaitingForServer_p').text().trim() , "This is Page render waiting for server" );
        await utils.waitShort();
        
        // Check that render is ok
        assert.equal( zz('#renderWaitingForServer_message').text().trim() , "It works!" );

        // Go to home page
        zz('#renderWaitingForServer_homeLink').el.click();
        await utils.waitShort();

        // Finish qunit test
        done();
    });

};
