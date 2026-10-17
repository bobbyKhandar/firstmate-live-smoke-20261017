# Firstmate Swarm Smoke Test
Results: alpha=todo; beta=todo; gamma=todo

## Taskboard

A small, dependency-free Kanban board for organizing work across **To do**, **In progress**, and **Done**.

### Run locally

Open index.html in a modern browser, or serve this directory with Python:

    python3 -m http.server 8123

Then visit <http://localhost:8123>. The app uses classic scripts, so opening the file directly works too.

### Use the board

- Select **Add task** to create a task. Open a card's **Edit** button to change its title, notes, or status.
- **Delete** asks for confirmation. Use the left and right move buttons to move a task between columns; dragging a card is an optional mouse shortcut.
- Search checks task titles and notes as you type. Press Escape in the search field to clear it.
- The board saves tasks in this browser's local storage. A notice appears if storage is unavailable, saved data needs repair, or a change could not be saved.
- An empty board stays empty after a refresh. It is not repopulated with starter tasks after you delete everything.

The interface supports keyboard navigation, visible focus indicators, labeled controls, a skip link, and dialog focus restoration. Move buttons make every column transition available without dragging.

### Checks

Node 26 or a compatible release with the built-in test runner is enough; there are no package dependencies:

    node --test
    npm test

The tests cover task state and persistence behavior plus the HTML contract shared by the board and its controller.

### Scope

This is a local, single-browser board. It has no accounts, cross-device sync, tags, due dates, undo, or import/export. Browser storage can be cleared by the user or browser, and changes made while storage is unavailable last only until the page is refreshed.
