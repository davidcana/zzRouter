# Blue router

**Blue router** is a tiny javascript router component to make it easy build [Single Page Applications](https://en.wikipedia.org/wiki/Single-page_application).

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
    * 7KB minified, 3KB gzipped.

## Why use Blue router
Use it if you want to build a SPA using vanilla Javascript and if you don't want to use any heavy javascript framework. You can also use CSS directly or your favourite CSS framework.

## Browser Support
No support for very old browsers. No polyfills. **Blue router** should work with any not too old browser. It should work with any browser that supports:

* [Fetch API](https://caniuse.com/mdn-api_fetch).
* [Async functions](https://caniuse.com/async-functions).
* [Promises](https://caniuse.com/promises).
* [History API](https://caniuse.com/mdn-api_history).

## Using Blue router
Let's see some examples.

First of all, an example of routes with content defined as string literals. This SPA consist of a home page, a links page and a 404 error page:

```javascript
    const routes = {
        // Home page
        {
        'path': '[home]',
        'content': `
<h1>Blue router sample</h1>

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
            'path': 'links',
            'content': `
<h1>Blue router sample</h1>

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
            <a href="https://github.com/davidcana/blueRouter">Blue router</a>.
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
            'path': '[404]',
            'content': `
<h1>Blue router sample</h1>

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

    // Create new router instance
    const router = new blueRouter.router({
        routes: routes
    });
```

An example of lazy loading of HTML from URLs. Providing **pages/home.html**, **pages/links.html** and **pages/404error.html** contain the previuosly defined HTML:

```javascript
    const routes = {
        // Home page
        {
            'path': '[home]',
            'url': 'pages/home.html'
        },
        // Links page
        {
            'path': 'links',
            'url': 'pages/links.html'
        },
        // Default route (404 page)
        {
            'path': '[404]',
            'url': 'pages/404error.html'
        }
    };

    // Create new router instance
    const router = new blueRouter.router({
        routes: routes
    });
```

If we prefer to preload pages use the **preloadPages** option:

```javascript
    // Create new router instance
    const router = new blueRouter.router({
        routes: routes,
        preloadPages: true
    });
```

## Configuration options reference

The list of available configuration options (default values in brackets).

The only required configuration option is:

* routes (undefined):

Options in lower case are recommended to be customized:

* pages (undefined):
* renderFunction (undefined):
* browserHistoryOnLoad (true):
* preloadPages (false):
* animationOut ('slide-out-top'):
* animationIn ('scale-in-center'):
* animateFirstTransition (false):

Options in upper case are not recommended to be customized, but do it if you know what you are doing:

* pagePrefix ('!'):
* PAGE_ID_HOME ('[home]'):
* PAGE_ID_404_ERROR ('[404]'):
* EVENT_PRE_INIT ('preInit'):
* EVENT_INIT ('init'):
* EVENT_PRE_REINIT ('preReinit'):
* EVENT_REINIT ('reinit'):
* EVENT_MOUNTED ('mounted'):
* EVENT_BEFORE_OUT ('beforeOut'):
* EVENT_AFTER_OUT ('afterOut'):
* RUN_RENDER_BEFORE_EVENT_INIT (true):
* RUN_RENDER_BEFORE_EVENT_REINIT (false):


