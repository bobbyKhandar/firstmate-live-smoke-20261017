const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const documentPath = path.join(__dirname, '..', 'index.html');
const html = fs.existsSync(documentPath) ? fs.readFileSync(documentPath, 'utf8') : '';

function assertMarkup(pattern, message) {
  assert.match(html, pattern, message);
}

test('document exposes the language, viewport, skip link, and global controls', () => {
  assertMarkup(/<html\b[^>]*\blang=["'][^"']+["']/i, 'document declares its language');
  assertMarkup(/<meta\b[^>]*name=["']viewport["'][^>]*content=["'][^"']*width=device-width[^"']*/i, 'document includes a responsive viewport');
  assertMarkup(/<a\b[^>]*class=["']skip-link["'][^>]*href=["']#board["'][^>]*>\s*Skip to board\s*<\/a>/i, 'skip link targets the board');
  assertMarkup(/<h1\b[^>]*>\s*Taskboard\s*<\/h1>/i, 'page has the Taskboard heading');
  assertMarkup(/<label\b[^>]*for=["']search["'][^>]*>\s*Search tasks\s*<\/label>/i, 'search has a visible label');
  assertMarkup(/<input\b(?=[^>]*\bid=["']search["'])(?=[^>]*\btype=["']search["'])(?=[^>]*\bautocomplete=["']off["'])(?=[^>]*\bplaceholder=["']Search title or notes["'])[^>]*>/i, 'search input has its controller attributes');
  assertMarkup(/<button\b(?=[^>]*\bid=["']add-task["'])(?=[^>]*\btype=["']button["'])[^>]*>\s*Add task\s*<\/button>/i, 'global add button is available');
  assertMarkup(/<p\b(?=[^>]*\bid=["']storage-notice["'])(?=[^>]*\brole=["']status["'])(?=[^>]*\bhidden(?:\s|>|=))[^>]*><\/p>/i, 'storage notice is a hidden status region');
  assertMarkup(/<div\b(?=[^>]*\bid=["']announcer["'])(?=[^>]*\bclass=["']sr-only["'])(?=[^>]*\baria-live=["']polite["'])[^>]*><\/div>/i, 'announcer is a polite live region');
});

test('board has an empty state and three labelled, data-bound columns', () => {
  assertMarkup(/<main\b(?=[^>]*\bid=["']board["'])(?=[^>]*\btabindex=["']-1["'])[^>]*>/i, 'board main landmark is focusable');
  assertMarkup(/<div\b(?=[^>]*\bid=["']board-empty["'])(?=[^>]*\bhidden(?:\s|>|=))[^>]*>[\s\S]*?<h2[^>]*>\s*Your board is empty\s*<\/h2>[\s\S]*?<p[^>]*>\s*Add a task to get started\.\s*<\/p>[\s\S]*?<button\b(?=[^>]*\bid=["']empty-add["'])(?=[^>]*\btype=["']button["'])[^>]*>\s*Add your first task\s*<\/button>/i, 'empty board has useful text and an add action');
  assertMarkup(/<div\b[^>]*\bid=["']columns["']/i, 'columns container has the controller id');

  const columns = [
    { status: 'todo', titleId: 'col-todo-title', title: 'To do' },
    { status: 'doing', titleId: 'col-doing-title', title: 'In progress' },
    { status: 'done', titleId: 'col-done-title', title: 'Done' },
  ];

  for (const column of columns) {
    const section = new RegExp(`<section\\b(?=[^>]*\\bclass=["'][^"']*\\bcolumn\\b[^"']*["'])(?=[^>]*\\bdata-status=["']${column.status}["'])(?=[^>]*\\baria-labelledby=["']${column.titleId}["'])[^>]*>[\\s\\S]*?<h2\\b[^>]*\\bid=["']${column.titleId}["'][^>]*>\\s*${column.title}\\s*<\\/h2>[\\s\\S]*?<span\\b(?=[^>]*\\bclass=["']count["'])(?=[^>]*\\bdata-count=["']${column.status}["'])[^>]*>\\s*0\\s*<\\/span>[\\s\\S]*?<ul\\b(?=[^>]*\\bclass=["']task-list["'])(?=[^>]*\\bdata-list=["']${column.status}["'])(?=[^>]*\\baria-labelledby=["']${column.titleId}["'])[^>]*><\\/ul>[\\s\\S]*?<p\\b(?=[^>]*\\bclass=["']empty["'])(?=[^>]*\\bdata-empty=["']${column.status}["'])(?=[^>]*\\bhidden(?:\\s|>|=))[^>]*><\\/p>[\\s\\S]*?<\\/section>`, 'i');
    assertMarkup(section, `${column.title} column has matching labels, count, list, and empty state`);
  }
});

test('task template contains the controller hooks for card content and actions', () => {
  assertMarkup(/<template\b[^>]*\bid=["']task-template["'][^>]*>[\s\S]*?<li\b(?=[^>]*\bclass=["']task["'])(?=[^>]*\bdata-id=["']["'])(?=[^>]*\bdraggable=["']true["'])[^>]*>[\s\S]*?<h3\b[^>]*class=["']task-title["'][^>]*><\/h3>[\s\S]*?<p\b[^>]*class=["']task-notes["'][^>]*><\/p>[\s\S]*?<div\b[^>]*class=["']task-actions["'][^>]*>[\s\S]*?<button\b(?=[^>]*\btype=["']button["'])(?=[^>]*\bclass=["'][^"']*\bjs-move-prev\b)[^>]*><\/button>[\s\S]*?<button\b(?=[^>]*\btype=["']button["'])(?=[^>]*\bclass=["'][^"']*\bjs-move-next\b)[^>]*><\/button>[\s\S]*?<button\b(?=[^>]*\btype=["']button["'])(?=[^>]*\bclass=["'][^"']*\bjs-edit\b)[^>]*>\s*Edit\s*<\/button>[\s\S]*?<button\b(?=[^>]*\btype=["']button["'])(?=[^>]*\bclass=["'][^"']*\bjs-delete\b)[^>]*>\s*Delete\s*<\/button>/i, 'task template supports drag, content, and explicit action buttons');
});

test('add/edit and delete dialogs expose the labelled form and confirmation controls', () => {
  assertMarkup(/<dialog\b(?=[^>]*\bid=["']task-dialog["'])(?=[^>]*\baria-labelledby=["']dialog-title["'])[^>]*>[\s\S]*?<form\b(?=[^>]*\bid=["']task-form["'])(?=[^>]*\bmethod=["']dialog["'])(?=[^>]*\bnovalidate(?:\s|>|=))[^>]*>[\s\S]*?<h2\b[^>]*\bid=["']dialog-title["'][^>]*><\/h2>[\s\S]*?<input\b(?=[^>]*\bid=["']task-id["'])(?=[^>]*\btype=["']hidden["'])[^>]*>/i, 'task dialog exposes a method=dialog form');
  assertMarkup(/<label\b[^>]*for=["']task-title["'][^>]*>\s*Title\s*<\/label>[\s\S]*?<input\b(?=[^>]*\bid=["']task-title["'])(?=[^>]*\bname=["']title["'])(?=[^>]*\bmaxlength=["']120["'])(?=[^>]*\brequired(?:\s|>|=))(?=[^>]*\baria-describedby=["']task-error["'])[^>]*>/i, 'title field is labelled, required, and described by its error');
  assertMarkup(/<label\b[^>]*for=["']task-notes["'][^>]*>\s*Notes \(optional\)\s*<\/label>[\s\S]*?<textarea\b(?=[^>]*\bid=["']task-notes["'])(?=[^>]*\bname=["']notes["'])(?=[^>]*\bmaxlength=["']500["'])(?=[^>]*\brows=["']4["'])[^>]*><\/textarea>/i, 'notes field has its label and limit');
  assertMarkup(/<label\b[^>]*for=["']task-status["'][^>]*>\s*Status\s*<\/label>[\s\S]*?<select\b(?=[^>]*\bid=["']task-status["'])(?=[^>]*\bname=["']status["'])[^>]*>[\s\S]*?<option\b[^>]*value=["']todo["'][^>]*>\s*To do\s*<\/option>[\s\S]*?<option\b[^>]*value=["']doing["'][^>]*>\s*In progress\s*<\/option>[\s\S]*?<option\b[^>]*value=["']done["'][^>]*>\s*Done\s*<\/option>/i, 'status select includes all three board columns');
  assertMarkup(/<p\b(?=[^>]*\bid=["']task-error["'])(?=[^>]*\brole=["']alert["'])(?=[^>]*\bhidden(?:\s|>|=))[^>]*><\/p>[\s\S]*?<button\b(?=[^>]*\bid=["']task-cancel["'])(?=[^>]*\btype=["']button["'])[^>]*>\s*Cancel\s*<\/button>[\s\S]*?<button\b(?=[^>]*\bid=["']task-save["'])(?=[^>]*\btype=["']submit["'])[^>]*>\s*Save\s*<\/button>/i, 'task dialog includes errors and named actions');
  assertMarkup(/<dialog\b(?=[^>]*\bid=["']confirm-dialog["'])(?=[^>]*\baria-labelledby=["']confirm-title["'])[^>]*>[\s\S]*?<h2\b[^>]*\bid=["']confirm-title["'][^>]*>\s*Delete task\?\s*<\/h2>[\s\S]*?<p\b[^>]*\bid=["']confirm-message["'][^>]*><\/p>[\s\S]*?<button\b(?=[^>]*\bid=["']confirm-cancel["'])(?=[^>]*\btype=["']button["'])[^>]*>\s*Cancel\s*<\/button>[\s\S]*?<button\b(?=[^>]*\bid=["']confirm-delete["'])(?=[^>]*\btype=["']button["'])[^>]*>\s*Delete\s*<\/button>/i, 'delete confirmation is labelled and has cancel/delete actions');
});

test('styles and classic scripts load in the controller-compatible order', () => {
  assertMarkup(/<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']src\/styles\.css["'])[^>]*>/i, 'local stylesheet is loaded');
  const storeScript = html.indexOf('<script src="src/store.js"></script>');
  const appScript = html.indexOf('<script src="src/app.js"></script>');
  assert.ok(storeScript >= 0, 'store.js is loaded as a classic script');
  assert.ok(appScript > storeScript, 'app.js follows store.js');
  assert.equal([...html.matchAll(/\btabindex=["'](\d+)["']/gi)].some(([, value]) => Number(value) > 0), false, 'no positive tabindex overrides natural keyboard order');
});
