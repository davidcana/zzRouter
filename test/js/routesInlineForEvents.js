// Routes for inline content for event tests
export const routes = [
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
        <a href="!textWriter" id="page1_textWriterLink">Text writer</a>. Go to Text writer page.
    </li>
</ul>
</div>
`
    },
    // textWriter
    {
        id: 'textWriter',
        content: `
<h1>zzRouter test</h1>

<div>
<a href="!" id="textWriter_homeLink">Home</a>
</div>

<div class="page-content">
<h3>Text writer page</h3>
<p>
    This is the text writer page. Write text and click 'Add text' button or press 'Enter' to add text.
</p>

<div class="field">
    <div>Text</div>
    <div>
        <input type="text" id="textWriter_textToAdd" name="textWriter_textToAdd" required>
        <button id="textWriter_addTextButton">Add text</button>
    </div>
</div>

<div class="field">
    <div>History</div>
    <div id="textWriter_history"></div>
</div>
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
</div>
`
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


