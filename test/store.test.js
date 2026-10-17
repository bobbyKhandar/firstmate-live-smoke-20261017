const test = require('node:test');
const assert = require('node:assert/strict');

let TaskStore;
try {
  TaskStore = require('../src/store.js');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  TaskStore = {};
}

function api(name) {
  assert.equal(typeof TaskStore[name], 'function', `TaskStore.${name} must be exported`);
  return TaskStore[name];
}

function makeTask(id, title, status, createdAt = 1, notes = '') {
  return { id, title, notes, status, createdAt, updatedAt: createdAt };
}

function makeState(tasks = []) {
  return { version: 1, tasks };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test('exports the TaskStore API and frozen board constants', () => {
  for (const name of [
    'seedState', 'addTask', 'updateTask', 'deleteTask', 'moveTask',
    'adjacentStatus', 'filterTasks', 'tasksByStatus', 'loadState', 'saveState',
  ]) {
    assert.equal(typeof TaskStore[name], 'function', `TaskStore.${name} must be exported`);
  }
  assert.deepEqual(TaskStore.COLUMNS, [
    { id: 'todo', label: 'To do' },
    { id: 'doing', label: 'In progress' },
    { id: 'done', label: 'Done' },
  ]);
  assert.deepEqual(TaskStore.LIMITS, { title: 120, notes: 500 });
  assert.equal(TaskStore.STORAGE_KEY, 'firstmate-taskboard:v1');
  assert.ok(Object.isFrozen(TaskStore.COLUMNS));
  assert.ok(Object.isFrozen(TaskStore.COLUMNS[0]));
  assert.ok(Object.isFrozen(TaskStore.LIMITS));
});

test('seedState makes realistic tasks with unique ids in every column', () => {
  const state = api('seedState')(1234);
  assert.equal(state.version, 1);
  assert.ok(state.tasks.length >= 7);
  assert.deepEqual(new Set(state.tasks.map((task) => task.status)), new Set(['todo', 'doing', 'done']));
  assert.equal(new Set(state.tasks.map((task) => task.id)).size, state.tasks.length);
  for (const task of state.tasks) {
    assert.equal(typeof task.id, 'string');
    assert.equal(typeof task.title, 'string');
    assert.ok(task.title.trim());
    assert.equal(typeof task.notes, 'string');
    assert.ok(Number.isFinite(task.createdAt));
    assert.ok(Number.isFinite(task.updatedAt));
  }
});

test('addTask trims and clamps fields, appends in the column, and leaves its input untouched', () => {
  const addTask = api('addTask');
  const original = makeState([
    makeTask('first', 'First', 'todo'),
    makeTask('other', 'Other', 'doing'),
  ]);
  const before = structuredClone(original);
  const result = addTask(original, {
    title: `  ${'T'.repeat(125)}  `,
    notes: `  ${'N'.repeat(510)}  `,
    status: 'todo',
  }, { now: 50, id: 'new-task' });

  assert.deepEqual(original, before);
  assert.equal(result.task.id, 'new-task');
  assert.equal(result.task.title, 'T'.repeat(120));
  assert.equal(result.task.notes, 'N'.repeat(500));
  assert.equal(result.task.status, 'todo');
  assert.equal(result.task.createdAt, 50);
  assert.equal(result.task.updatedAt, 50);
  assert.deepEqual(api('tasksByStatus')(result.state).todo.map((task) => task.id), ['first', 'new-task']);
  assert.deepEqual(api('tasksByStatus')(result.state).doing.map((task) => task.id), ['other']);
});

test('addTask defaults optional fields and keeps supplied ids unique', () => {
  const addTask = api('addTask');
  const state = makeState([
    makeTask('repeat', 'Existing', 'todo'),
    makeTask('repeat-2', 'Also existing', 'done'),
  ]);
  const first = addTask(state, { title: '  New task  ' }, { now: 20, id: 'repeat' });
  const second = addTask(first.state, { title: 'Another task' }, { now: 21, id: 'repeat' });

  assert.equal(first.task.notes, '');
  assert.equal(first.task.status, 'todo');
  assert.equal(first.task.title, 'New task');
  assert.equal(new Set(second.state.tasks.map((task) => task.id)).size, second.state.tasks.length);
  assert.equal(second.task.id, 'repeat-4');
});

test('addTask rejects blank titles and unknown statuses with stable error codes', () => {
  const addTask = api('addTask');
  assert.throws(() => addTask(makeState(), { title: '   ' }), (error) => error.code === 'EMPTY_TITLE');
  assert.throws(() => addTask(makeState(), { title: 'Valid', status: 'blocked' }), (error) => error.code === 'BAD_STATUS');
});

test('updateTask changes fields and moves a status change to the target column end', () => {
  const state = makeState([
    makeTask('a', 'A', 'todo', 1),
    makeTask('b', 'B', 'doing', 2),
    makeTask('c', 'C', 'done', 3),
  ]);
  const updated = api('updateTask')(state, 'a', {
    title: '  A revised  ', notes: '  detail  ', status: 'doing',
  }, { now: 10 });

  assert.deepEqual(api('tasksByStatus')(updated).todo, []);
  assert.deepEqual(api('tasksByStatus')(updated).doing.map((task) => task.id), ['b', 'a']);
  assert.equal(updated.tasks.find((task) => task.id === 'a').title, 'A revised');
  assert.equal(updated.tasks.find((task) => task.id === 'a').notes, 'detail');
  assert.equal(updated.tasks.find((task) => task.id === 'a').updatedAt, 10);
  assert.equal(state.tasks[0].status, 'todo');
  assert.equal(state.tasks[0].title, 'A');
});

test('updateTask rejects invalid values and leaves an unknown task unchanged', () => {
  const updateTask = api('updateTask');
  const state = makeState([makeTask('a', 'A', 'todo')]);
  assert.throws(() => updateTask(state, 'a', { title: ' ' }), (error) => error.code === 'EMPTY_TITLE');
  assert.throws(() => updateTask(state, 'a', { status: 'blocked' }), (error) => error.code === 'BAD_STATUS');
  assert.equal(updateTask(state, 'missing', { title: ' ' }), state);
});

test('deleteTask removes only the requested task and preserves identity for an unknown id', () => {
  const state = makeState([
    makeTask('a', 'A', 'todo'),
    makeTask('b', 'B', 'doing'),
    makeTask('c', 'C', 'done'),
  ]);
  const deleted = api('deleteTask')(state, 'b');
  assert.deepEqual(deleted.tasks.map((task) => task.id), ['a', 'c']);
  assert.deepEqual(state.tasks.map((task) => task.id), ['a', 'b', 'c']);
  assert.equal(api('deleteTask')(state, 'missing'), state);
});

test('moveTask inserts across columns at the requested index and clamps indexes', () => {
  const moveTask = api('moveTask');
  const state = makeState([
    makeTask('a', 'A', 'todo'),
    makeTask('b', 'B', 'doing'),
    makeTask('c', 'C', 'doing'),
    makeTask('d', 'D', 'done'),
  ]);
  const middle = moveTask(state, 'a', 'doing', 1);
  assert.deepEqual(api('tasksByStatus')(middle).doing.map((task) => task.id), ['b', 'a', 'c']);
  const atStart = moveTask(middle, 'd', 'doing', -5);
  assert.deepEqual(api('tasksByStatus')(atStart).doing.map((task) => task.id), ['d', 'b', 'a', 'c']);
  const atEnd = moveTask(atStart, 'b', 'done', 99);
  assert.deepEqual(api('tasksByStatus')(atEnd).done.map((task) => task.id), ['b']);
  assert.deepEqual(state.tasks.map((task) => task.status), ['todo', 'doing', 'doing', 'done']);
  assert.throws(() => moveTask(state, 'a', 'blocked'), (error) => error.code === 'BAD_STATUS');
});

test('moveTask reorders a column while preserving the other tasks order', () => {
  const state = makeState([
    makeTask('a', 'A', 'todo'),
    makeTask('x', 'X', 'done'),
    makeTask('b', 'B', 'todo'),
    makeTask('y', 'Y', 'doing'),
    makeTask('c', 'C', 'todo'),
  ]);
  const moved = api('moveTask')(state, 'c', 'todo', 0);
  assert.deepEqual(api('tasksByStatus')(moved).todo.map((task) => task.id), ['c', 'a', 'b']);
  assert.deepEqual(api('tasksByStatus')(moved).done.map((task) => task.id), ['x']);
  assert.deepEqual(api('tasksByStatus')(moved).doing.map((task) => task.id), ['y']);
});

test('adjacentStatus returns neighboring columns and null at the edges', () => {
  const adjacentStatus = api('adjacentStatus');
  assert.equal(adjacentStatus('todo', -1), null);
  assert.equal(adjacentStatus('todo', 1), 'doing');
  assert.equal(adjacentStatus('doing', -1), 'todo');
  assert.equal(adjacentStatus('doing', 1), 'done');
  assert.equal(adjacentStatus('done', 1), null);
});

test('filterTasks searches title and notes with case-insensitive AND terms', () => {
  const state = makeState([
    makeTask('a', 'Draft Q4 launch checklist', 'todo', 1, 'Includes stakeholder reviews'),
    makeTask('b', 'Review onboarding copy', 'doing', 2, 'Check the launch checklist'),
    makeTask('c', 'Book design review', 'done', 3, 'Confirm attendees'),
  ]);
  const filterTasks = api('filterTasks');
  assert.deepEqual(filterTasks(state, '  DRAFT  ' ).map((task) => task.id), ['a']);
  assert.deepEqual(filterTasks(state, 'STAKEHOLDER reviews').map((task) => task.id), ['a']);
  assert.deepEqual(filterTasks(state, 'launch CHECKLIST').map((task) => task.id), ['a', 'b']);
  assert.deepEqual(filterTasks(state, '   ').map((task) => task.id), ['a', 'b', 'c']);
  assert.deepEqual(filterTasks(state, 'missing term'), []);
  assert.deepEqual(state.tasks.map((task) => task.id), ['a', 'b', 'c']);
});

test('tasksByStatus filters without changing the display order', () => {
  const state = makeState([
    makeTask('a', 'Alpha', 'todo', 1, 'shared note'),
    makeTask('x', 'Unrelated', 'done'),
    makeTask('b', 'Beta', 'todo', 2, 'shared note'),
    makeTask('c', 'Charlie', 'doing', 3, 'shared note'),
  ]);
  const grouped = api('tasksByStatus')(state, 'shared note');
  assert.deepEqual(Object.keys(grouped), ['todo', 'doing', 'done']);
  assert.deepEqual(grouped.todo.map((task) => task.id), ['a', 'b']);
  assert.deepEqual(grouped.doing.map((task) => task.id), ['c']);
  assert.deepEqual(grouped.done, []);
});

test('loadState seeds and persists only when the storage key is absent', () => {
  const storage = memoryStorage();
  const loaded = api('loadState')(storage);
  assert.equal(loaded.warning, null);
  assert.ok(loaded.state.tasks.length >= 7);
  assert.equal(typeof storage.values.get(TaskStore.STORAGE_KEY), 'string');
});

test('saveState and loadState round-trip tasks and preserve a valid empty board', () => {
  const storage = memoryStorage();
  const state = makeState([makeTask('a', 'A', 'todo')]);
  assert.deepEqual(api('saveState')(storage, state), { ok: true });
  assert.deepEqual(api('loadState')(storage), { state, warning: null });

  const empty = makeState([]);
  assert.deepEqual(api('saveState')(storage, empty), { ok: true });
  assert.deepEqual(api('loadState')(storage), { state: empty, warning: null });
});

test('deleting every task, saving, and reloading keeps the board empty', () => {
  const storage = memoryStorage();
  const state = makeState([makeTask('only', 'Only task', 'todo')]);
  const empty = api('deleteTask')(state, 'only');
  assert.deepEqual(api('saveState')(storage, empty), { ok: true });
  assert.deepEqual(api('loadState')(storage), { state: empty, warning: null });
});

test('corrupt JSON seeds a board, backs up the raw value, and leaves the original untouched', () => {
  const raw = '{not valid json';
  const storage = memoryStorage({ 'firstmate-taskboard:v1': raw });
  const loaded = api('loadState')(storage);
  assert.equal(loaded.warning, 'corrupt');
  assert.ok(loaded.state.tasks.length >= 7);
  assert.equal(storage.values.get(TaskStore.STORAGE_KEY), raw);
  assert.equal(storage.values.get(`${TaskStore.STORAGE_KEY}:corrupt-backup`), raw);
});

test('wrong storage versions are corrupt and do not replace the saved value', () => {
  const raw = JSON.stringify({ version: 2, tasks: [] });
  const storage = memoryStorage({ 'firstmate-taskboard:v1': raw });
  const loaded = api('loadState')(storage);
  assert.equal(loaded.warning, 'corrupt');
  assert.ok(loaded.state.tasks.length >= 7);
  assert.equal(storage.values.get(TaskStore.STORAGE_KEY), raw);
  assert.equal(storage.values.get(`${TaskStore.STORAGE_KEY}:corrupt-backup`), raw);
});

test('valid task collections drop invalid and duplicate tasks and repair the rest', () => {
  const rawState = {
    version: 1,
    tasks: [
      makeTask('good', `  ${'G'.repeat(125)}  `, 'todo', 1, ` ${'N'.repeat(505)} `),
      makeTask('good', 'Duplicate id', 'doing', 2),
      { ...makeTask('bad-id', 'Bad id', 'todo'), id: 17 },
      { ...makeTask('bad-title', 'Bad title', 'todo'), title: 17 },
      makeTask('bad-status', 'Bad status', 'blocked', 5),
    ],
  };
  const storage = memoryStorage({ 'firstmate-taskboard:v1': JSON.stringify(rawState) });
  const loaded = api('loadState')(storage);
  assert.equal(loaded.warning, 'repaired');
  assert.equal(loaded.state.tasks.length, 1);
  assert.equal(loaded.state.tasks[0].id, 'good');
  assert.equal(loaded.state.tasks[0].title, 'G'.repeat(120));
  assert.equal(loaded.state.tasks[0].notes, 'N'.repeat(500));
  assert.equal(storage.values.get(TaskStore.STORAGE_KEY), JSON.stringify(rawState));
});

test('wrong storage shapes are corrupt and backed up', () => {
  const raw = JSON.stringify({ version: 1, tasks: {} });
  const storage = memoryStorage({ 'firstmate-taskboard:v1': raw });
  assert.equal(api('loadState')(storage).warning, 'corrupt');
  assert.equal(storage.values.get(`${TaskStore.STORAGE_KEY}:corrupt-backup`), raw);
  assert.equal(storage.values.get(TaskStore.STORAGE_KEY), raw);
});

test('missing or unreadable storage returns an in-memory seed with an unavailable warning', () => {
  const loadState = api('loadState');
  assert.equal(loadState(null).warning, 'unavailable');
  const unreadable = { getItem() { throw new Error('blocked'); } };
  assert.equal(loadState(unreadable).warning, 'unavailable');
});

test('saveState reports quota and missing-storage failures without throwing', () => {
  const state = makeState([]);
  const quotaStorage = { setItem() { throw new Error('quota exceeded'); } };
  assert.deepEqual(api('saveState')(quotaStorage, state), { ok: false, error: 'quota exceeded' });
  assert.equal(api('saveState')(undefined, state).ok, false);
});
