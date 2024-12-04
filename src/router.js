/*
 * blueRouter.router class
 */
/** @constructor */
blueRouter.router = function ( _options ) {
    this.options = _options;

    this.initialize();
};

/* Methods */
blueRouter.router.prototype.initialize = function () {
    //alert( 'initialize');
    
    this.pathname = window.location.pathname;

    window.onload = () => {
        //this.navigate( '/' );
        this.navigate( window.location.pathname );
    }
    window.onpopstate = () => {
        this.navigate( window.location.pathname );
    }

    // Add event listeners for a elements
    let self = this;
    this.addEventListenerOnList(
        document.getElementsByTagName( "a" ),
        "click", 
        (e) => {
            e.preventDefault();
            const href = e.target.getAttribute( "href" );
            history.pushState( null, "", href );
            self.navigate( href );
        }
    );
};

blueRouter.router.prototype.navigate = function( path ) {

    let content;
    switch( path ) {
        case this.pathname:
        case "/":
            content = "<h3>Home Page</h3>";
            break;
        case "/about":
            content = "<h3>About Page</h3>";
            break;
        case "/links":
            content = "<h3>Links Page</h3>";
            break;
        default:
            content = "<h3>404 - Page Not Found: " + path + "</h3>";
    }

    document.getElementById( "currentPage" ).innerHTML = content;
};

blueRouter.router.prototype.addEventListenerOnList = function( list, event, fn ) {
    for ( let i = 0, len = list.length; i < len; i++ ) {
        list[ i ].addEventListener( event, fn, false );
    }
};

