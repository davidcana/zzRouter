// Routes for inline content for navigation tests
const routes = [
    // Home page
    {
        id: '[home]',
        content: `
<h1>zzRouter test</h1>

<div class="page-content">
    <h3>Home page</h3>
    <p>
        This is Home page
    </p>

    <ul id="home_links">
        <li>
            <a href="!page1" id="home_page1Link">Page 1</a>. Go to page 1.
        </li>
        <li>
            <a href="!page2" id="home_page2Link">Page 2</a>. Go to page 2.
        </li>
        <li>
            <a href="!brokenPage" id="home_brokenPageLink">Broken page</a>. Go to broken page.
        </li>
    </ul>
</div>
`
    },
    // page1
    {
    id: 'page1',
    content: `
<h1>zzRouter test</h1>

<div>
    <a href="!" id="page1_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 1</h3>
    <p>
        This is Page 1
    </p>

    <ul id="page1_links">
        <li>
            <a href="!page11" id="page1_page11Link">Page 11</a>. Go to page 11.
        </li>
        <li>
            <a href="!page12" id="page1_page12Link">Page 12</a>. Go to page 12.
        </li>
    </ul>
</div>
`
    },
    // page11
    {
        id: 'page11',
        content: `
<h1>zzRouter test</h1>

<div>
    <a href="!" id="page11_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 11</h3>
    <p id="page11_p">
        This is Page 11
    </p>
</div>
`
    },
    // page12
    {
        id: 'page12',
        content: `
<h1>zzRouter test</h1>

<div>
    <a href="!" id="page12_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 12</h3>
    <p id="page12_p">
        This is Page 12
    </p>
</div>
`
    },
    // page2
    {
        id: 'page2',
        content: `
<h1>zzRouter test</h1>

<div>
    <a href="!" id="page2_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 2</h3>
    <p>
        This is Page 2
    </p>

    <ul id="page2_links">
        <li>
            <a href="!page21" id="page2_page21Link">Page 21</a>. Go to page 21.
        </li>
        <li>
            <a href="!page22" id="page2_page22Link">Page 22</a>. Go to page 22.
        </li>
    </ul>
</div>
`
    },
    // page21
    {
        id: 'page21',
        content: `
<h1>zzRouter test</h1>

<div>
    <a href="!" id="page21_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 21</h3>
    <p id="page21_p">
        This is Page 21
    </p>
</div>
`
    },
    // page22
    {
        id: 'page22',
        content: `
<h1>zzRouter test</h1>

<div>
    <a href="!" id="page22_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 22</h3>
    <p id="page22_p">
        This is Page 22
    </p>

    <ul id="page22_links">
        <li>
            <a href="!page221" id="page22_page221Link">Page 221</a>. Go to page 221.
        </li>
    </ul>
</div>
`
    },
    // page221
    {
        id: 'page221',
        content: `
<h1>zzRouter test</h1>

<div>
    <a href="!" id="page221_homeLink">Home</a>
</div>

<div class="page-content">
    <h3>Page 221</h3>
    <p id="page221_p">
        This is Page 221
    </p>
</div>
`
    },
    // brokenPage
    {
        id: 'brokenPage'
    },
    // Default route (404 page)
    {
        id: '[404]',
        content: `
<h1>zzRouter test</h1>

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


