// Routes for inline content for render tests

const routes = [
    // Home page
    {
        path: '[home]',
        content: `
<h1>Blue router test</h1>

<div class="page-content">
<h3>Home page</h3>
<p>
    This is Home page
</p>

<ul id="home_links">
    <li>
        <a href="!renderWithoutWaiting" id="home_renderWithoutWaitingLink">Page render without waiting</a>. Go to page render without waiting.
    </li>
    <li>
        <a href="!renderWaitingForServer" id="home_renderWaitingForServerLink">Page render waiting for server</a>. Go to page render waiting for server.
    </li>
</ul>
</div>
`
    },
    // page render without waiting
    {
        path: 'renderWithoutWaiting',
        content: `
<h1>Blue router test</h1>

<div>
<a href="!" id="renderWithoutWaiting_homeLink">Home</a>
</div>

<div class="page-content">
<h3>Page render</h3>
<p id="renderWithoutWaiting_p">
    This is Page render without waiting
</p>

<h2 id="renderWithoutWaiting_message" data-content="successMessage">
    Not working!
</h2>
</div>
`
    },
    // page render waiting for server
    {
        path: 'renderWaitingForServer',
        content: `
<h1>Blue router test</h1>

<div>
<a href="!" id="renderWaitingForServer_homeLink">Home</a>
</div>

<div class="page-content">
<h3>Page render</h3>
<p id="renderWaitingForServer_p">
    This is Page render waiting for server
</p>

<h2 id="renderWaitingForServer_message" data-content="successMessageFromServer">
    Not working!
</h2>
</div>
`
    },
    // Default route (404 page)
    {
        path: '[404]',
        content: `
<h1>Blue router test</h1>

<div>
<a href="!" id="e404_homeLink">Home</a>
</div>

<div class="page-content">
<h3>404 page</h3>
<p>
    Sorry
</p>
<p id="e404_p">
    Requested content not found.
</p>
</div>
`
    }
];

module.exports = routes;


