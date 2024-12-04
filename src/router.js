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
    this.urlBase = window.location.href;

    //alert( 'pathname: ' + this.pathname + '\nurlBase:' + this.urlBase );

    window.onload = () => {
        this.navigatePath( "" );
    }
    window.onpopstate = () => {
        this.navigateUrl( window.location.href );
    }

    // Add event listeners for a elements
    let self = this;
    this.addEventListenerOnList(
        document.getElementsByTagName( "a" ),
        "click", 
        (e) => {
            e.preventDefault();
            const href = e.target.getAttribute( "href" );
            history.pushState(
                {
                    page: href
                },
                "page " + href,
                "?page=" + href
            );
            self.navigatePath( href );
        }
    );
};

blueRouter.router.prototype.navigateUrl = function( url ) {
    //alert( 'navigateUrl\nurl: ' + url );

    // Extract the page name (the string after = character); if undefined it must be the home page
    this.navigatePath( url.split('=')[1] || "" );
};

blueRouter.router.prototype.navigatePath = function( path ) {
    //alert( 'navigatePath\npath: ' + path );

    let content;
    switch( path ) {
        case "":
        //case "home":
            content = "<h3>Home Page</h3>";
            break;
        case "about":
            content = "<h3>About Page</h3>";
            break;
        case "links":
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

