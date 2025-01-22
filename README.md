# zzRouter

**zzRouter** is a tiny javascript router component to make it easy build [Single Page Applications](https://en.wikipedia.org/wiki/Single-page_application).

* Fast and simple.
    * Define your internal pages using javascript objects.
    * Page content:
        * Lazy loading from URLs support.
        * Preloading of all pages from URLs supported.
        * Can be defined as strings to optimize load time.
    * Support of browser history using [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API). Use back and forward buttons to navigate through internal pages.
    * Life cycle events support:
        * Events includes events before page is ready (preInit, init, preReinit, reinit and mounted) and events before page is removed (beforeOut and afterOut).
    * Support of alive pages. Some pages can be cached before being removed, so they are recovered from the cache afterwards.
* Easy to customize and to extend. Clear and simple code: [KISS](https://en.wikipedia.org/wiki/KISS_principle).
* Support of [CSS transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions/Using_CSS_transitions).
    * Select your page-in transition; select your page-out transition. Transitions can be disabled too.
    * Includes some simple CSS transitions.
    * Use your custom CSS transitions easily.
* Small size:
    * 17.2KB, 6.1KB minified, 2.4KB gzipped.

## Why use zzRouter

Use it if you want to build a SPA using vanilla Javascript and if you don't want to use any heavy javascript framework. You can also use CSS directly or your favourite CSS framework.

## Browser Support

No support for very old browsers. No polyfills. **zzRouter** should work with any not too old browser. It should work with any browser that supports:

* [Fetch API](https://caniuse.com/mdn-api_fetch).
* [Async functions](https://caniuse.com/async-functions).
* [Promises](https://caniuse.com/promises).
* [History API](https://caniuse.com/mdn-api_history).

## Using zzRouter

Let's see some examples.

First of all, 2 files are needed to be added to the HTML page, a JS file and a CSS file:

```html
    <script src="zzRouter.js" defer></script>
    <link href="zzRouter.css" rel="stylesheet">
```

An example of routes with content defined as string literals. This SPA consist of a home page, a links page and a 404 error page:

```javascript
    const routes = {
        // Home page
        {
        id: '[home]',
        content: `
<h1>zzRouter sample</h1>

<div class="page-content">
    <h3>Home page</h3>
    <p>
        This is the Home page
    </p>

    <ul id="home_links">
        <li>
            <a href="!links">Links</a>. Go to links page.
        </li>
    </ul>
</div>
`
        },
        // Links page
        {
            id: 'links',
            content: `
<h1>zzRouter sample</h1>

<div>
    <a href="!">Home</a>
</div>

<div class="page-content">
    <h3>Links page</h3>
    <p>
        This is the links page
    </p>

    <ul>
        <li>
            <a href="https://github.com/davidcana/zzRouter">zzRouter</a>.
            A simple router component to make it easy build Single Page Applications.
        </li>
        <li>
            <a href="https://davidcana.github.io/ZPT-JS/">ZPT-JS</a>.
            Zenon Page Templates - JS (ZPT-JS) is a Javascript implementation of Zope Page Templates (ZPT).
        </li>
        <li>
            <a href="https://github.com/davidcana/ZPT-Java">ZPT-Java</a>.
            JPT is a Java implementation of Zope Page Templates (ZPT).
        </li>
        <li>
            <a href="https://github.com/davidcana/zzDOM">zzDOM</a>.
            A tiny javascript API that implements only the DOM functions of jquery including chaining.
        </li>
    </ul>
</div>
`
        },
        // Default route (404 page)
        {
            id: '[404]',
            content: `
<h1>zzRouter sample</h1>

<div>
    <a href="!">Home</a>
</div>

<div class="page-content">
    <h3>404 page</h3>
    <p>
        Sorry
    </p>
    <p>
        Requested content not found.
    </p>
</div>
`
        }
    };

    // Start router
    zzRouter.start({
        routes: routes
    });
```

An example of lazy loading of HTML from URLs. Providing **pages/home.html**, **pages/links.html** and **pages/404error.html** contain the previuosly defined HTML:

```javascript
    const routes = {
        // Home page
        {
            id: '[home]',
            url: 'pages/home.html'
        },
        // Links page
        {
            id: 'links',
            url: 'pages/links.html'
        },
        // Default route (404 page)
        {
            id: '[404]',
            url: 'pages/404error.html'
        }
    };

    // Start router
    zzRouter.start({
        routes: routes
    });
```

If we prefer to preload pages use the **preloadPagesOnStart** option:

```javascript
    // Start router
    zzRouter.start({
        routes: routes,
        preloadPagesOnStart: true
    });
```

## Page loading process

Let's see what happens when an internal link is clicked:

* **EVENT_BEFORE_OUT** event of current page is triggered.
* Next page is added to DOM. Some classes are added to that page: **nextPage**, **hidden** and **page**. The page is not visible yet.
* Trigger preinitialization event of next page. It will usually be **EVENT_PRE_INIT**, but if the related route item is defined as **keepAlive*** and the page has been initialized before then the event to trigger would be **EVENT_PRE_REINIT**.
* Run render function if needed. That optional function can be defined in configuration options.
* If out animation must to be done, start it. Anyway current page must be removed from DOM; wait for out animation if needed. If the related route item is defined as **keepAlive*** then do not remove it, add remove previous classes and add some classes to it: **alive** and **page**.
* **EVENT_AFTER_OUT** event of current page is triggered.
* If in animation must to be done, start it. Remove **nextPage** and add **currentPage** to the next page.
* Trigger initialization event of next page. It will usually be **EVENT_INIT**, but if the related route item is defined as **keepAlive*** and the page has been initialized before then the event to trigger would be **EVENT_REINIT**.
* Trigger **EVENT_MOUNTED** event of next page.

## CSS animations

**zzRouter** includes a short list of CSS animations to use in **animationOut** and **animationIn** configuration options. They have been generated by [Animista](http://animista.net). The list of animations is:

* fade-in
* fade-out
* scale-in-center
* scale-out-center
* flip-out-hor-top
* slide-out-top

You can use your custom CSS animations too.

## Events reference

The list of events:

* EVENT_PRE_INIT ('preInit')
* EVENT_INIT ('init')
* EVENT_PRE_REINIT ('preReinit')
* EVENT_REINIT ('reinit')
* EVENT_MOUNTED ('mounted')
* EVENT_BEFORE_OUT ('beforeOut')
* EVENT_AFTER_OUT ('afterOut')

## Configuration options reference

The list of available configuration options (default values in brackets).

The only required configuration option is:

* routes (undefined). An array of array items. Each array items defines an internal page and might have the next configuration options:
    * id (undefined). Required. You can't have more than one route item with the same **id**. It is also the path of the page.
    * content (undefined). Optional. A string containing the HTML of the page.
    * url (undefined). Optional. The relative URL of the content of the page. A **content** or an **url** value must be set.
    * keepAlive (false). Optional. Set to **true** if you want to cache this page to recover its content the next time it is shown.

Options in lower case are recommended to be customized:

* pages (undefined). An object with all the event listeners.
* renderFunction (undefined). A function that will be executed after preinit event and before init event, depending on the value of **RUN_RENDER_BEFORE_EVENT_INIT**. It also can be executed after prereinit event and before reinit event, depending on the value of **RUN_RENDER_BEFORE_EVENT_REINIT**.
* preloadPagesOnStart (false). Set to **true** if you want to preload all the pages defined in routes with the **url** configuration option. Default value is **false**.
* updateOnStart (true). Set to **true** if you want to go the page in the URL on load page event. For example, if current URL is https://mySpaApp.org/sample.html#!links and **updateOnStart** is **true**, **zzRouter** will show **link** page; otherwise  **zzRouter** will show **[home]** page.
* animateTransitionsOnStart (false). Set to **true** if you want to animate transition just after loading the web page. Default value is **false**.
* animationOut ('slide-out-top'). The name of the CSS animation used just before the current page is replaced by the new one. Set it to **false** to disable it.
* animationIn ('scale-in-center'). The name of the CSS animation used just before the new page is shown. Set it to **false** to disable it.

Options in upper case are not recommended to be customized, but do it if you know what you are doing:

* PAGE_PREFIX ('!'). The prefix used in the URL for an internal page preceded by **#**. So if a page URL is https://mySpaApp.org/sample.html then the URL for an internal page **links** would be https://mySpaApp.org/sample.html#!links.
* PAGE_ID_HOME ('[home]'). The id/path used for the home page.
* PAGE_ID_404_ERROR ('[404]'). The id/path used for the 404 error page.
* EVENT_PRE_INIT ('preInit'). The name of the preInit event.
* EVENT_INIT ('init'). The name of the init event.
* EVENT_PRE_REINIT ('preReinit'). The name of the preReinit event.
* EVENT_REINIT ('reinit'). The name of the reinit event.
* EVENT_MOUNTED ('mounted'). The name of the mounted event.
* EVENT_BEFORE_OUT ('beforeOut'). The name of the beforeOut event.
* EVENT_AFTER_OUT ('afterOut'). The name of the afterOut event.
* RUN_RENDER_BEFORE_EVENT_INIT (true). Set to **true** if you want to run the render function before init event. Default value is **true**.
* RUN_RENDER_BEFORE_EVENT_REINIT (false). Set to **true** if you want to run the render function before reinit event. Default value is **false**.


