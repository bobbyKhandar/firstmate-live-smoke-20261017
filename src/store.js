(function attachTaskStore(root, createTaskStore) {
  const TaskStore = createTaskStore();

  if (typeof module === 'object' && module.exports) {
    module.exports = TaskStore;
  }
  if (root) {
    root.TaskStore = TaskStore;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTaskStore() {
  const COLUMNS = Object.freeze([
    Object.freeze({ id: 'todo', label: 'To do' }),
    Object.freeze({ id: 'doing', label: 'In progress' }),
    Object.freeze({ id: 'done', label: 'Done' }),
  ]);
  const LIMITS = Object.freeze({ title: 120, notes: 500 });
  const STORAGE_KEY = 'firstmate-taskboard:v1';
  const STATUSES = new Set(COLUMNS.map((column) => column.id));
  const TASK_FIELDS = new Set(['id', 'title', 'notes', 'status', 'createdAt', 'updatedAt']);

  function codedError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function isStatus(status) {
    return typeof status === 'string' && STATUSES.has(status);
  }

  function assertStatus(status) {
    if (!isStatus(status)) {
      throw codedError(`Unknown task status: ${String(status)}`, 'BAD_STATUS');
    }
  }

  function asText(value) {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : String(value);
  }

  function normalizeTitle(value) {
    return asText(value).trim().slice(0, LIMITS.title);
  }

  function normalizeNotes(value) {
    return asText(value).trim().slice(0, LIMITS.notes);
  }

  function timestamp(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
  }

  function uniqueId(state, requestedId) {
    let base = requestedId === undefined || requestedId === null ? '' : String(requestedId).trim();
    if (!base) {
      try {
        const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
        if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
          base = cryptoApi.randomUUID();
        }
      } catch (_error) {
        // Use the local fallback when the browser or runtime blocks crypto access.
      }
    }
    if (!base) {
      base = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    const used = new Set((state.tasks || []).map((task) => String(task.id)));
    if (!used.has(base)) return base;

    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  function seedState(now) {
    const createdAt = timestamp(now);
    const starters = [
      {
        id: 'seed-launch-checklist',
        title: 'Draft Q4 launch checklist',
        notes: 'Gather owners, rollout steps, and the final go/no-go checks.',
        status: 'todo',
      },
      {
        id: 'seed-design-review',
        title: 'Book design review',
        notes: 'Find a 30-minute slot with product and engineering.',
        status: 'todo',
      },
      {
        id: 'seed-release-demo',
        title: 'Prepare release demo',
        notes: 'Choose a short path through the new onboarding flow.',
        status: 'todo',
      },
      {
        id: 'seed-onboarding-copy',
        title: 'Review onboarding copy',
        notes: 'Check the welcome steps for clarity and consistent tone.',
        status: 'doing',
      },
      {
        id: 'seed-flaky-ci',
        title: 'Fix flaky CI on main',
        notes: 'Trace the intermittent browser test timeout and rerun the suite.',
        status: 'doing',
      },
      {
        id: 'seed-analytics-events',
        title: 'Verify analytics events',
        notes: 'Confirm signup and activation events in the staging dashboard.',
        status: 'doing',
      },
      {
        id: 'seed-release-notes',
        title: 'Publish release notes',
        notes: 'Share the shipped improvements with support and customers.',
        status: 'done',
      },
      {
        id: 'seed-support-handoff',
        title: 'Update support handoff',
        notes: 'Add the new troubleshooting steps to the internal guide.',
        status: 'done',
      },
    ];

    return {
      version: 1,
      tasks: starters.map((starter) => ({ ...starter, createdAt, updatedAt: createdAt })),
    };
  }

  function addTask(state, input, opts) {
    const values = input && typeof input === 'object' ? input : {};
    const title = normalizeTitle(values.title);
    if (!title) throw codedError('Task title is required', 'EMPTY_TITLE');

    const status = values.status === undefined ? 'todo' : values.status;
    assertStatus(status);

    const options = opts && typeof opts === 'object' ? opts : {};
    const now = timestamp(options.now);
    const task = {
      id: uniqueId(state, options.id),
      title,
      notes: normalizeNotes(values.notes),
      status,
      createdAt: now,
      updatedAt: now,
    };
    return { state: { ...state, tasks: [...state.tasks, task] }, task };
  }

  function indexInColumn(tasks, id, status) {
    let index = 0;
    for (const task of tasks) {
      if (task.status !== status) continue;
      if (task.id === id) return index;
      index += 1;
    }
    return -1;
  }

  function columnIndex(value, count) {
    if (value === undefined) return count;
    const number = Number(value);
    if (Number.isNaN(number)) return count;
    return Math.max(0, Math.min(count, Math.trunc(number)));
  }

  function insertIntoColumn(tasks, task, status, requestedIndex) {
    const targetIndexes = [];
    for (let index = 0; index < tasks.length; index += 1) {
      if (tasks[index].status === status) targetIndexes.push(index);
    }

    const insertionIndex = columnIndex(requestedIndex, targetIndexes.length);
    let arrayIndex;
    if (targetIndexes.length === 0) {
      arrayIndex = tasks.length;
    } else if (insertionIndex === targetIndexes.length) {
      arrayIndex = targetIndexes[targetIndexes.length - 1] + 1;
    } else {
      arrayIndex = targetIndexes[insertionIndex];
    }

    return [...tasks.slice(0, arrayIndex), task, ...tasks.slice(arrayIndex)];
  }

  function updateTask(state, id, changes, opts) {
    const taskIndex = state.tasks.findIndex((task) => task.id === id);
    if (taskIndex === -1) return state;

    const current = state.tasks[taskIndex];
    const patch = changes && typeof changes === 'object' ? changes : {};
    const title = patch.title === undefined ? current.title : normalizeTitle(patch.title);
    if (!title) throw codedError('Task title is required', 'EMPTY_TITLE');
    const notes = patch.notes === undefined ? current.notes : normalizeNotes(patch.notes);
    const status = patch.status === undefined ? current.status : patch.status;
    assertStatus(status);

    const options = opts && typeof opts === 'object' ? opts : {};
    const now = timestamp(options.now);
    const updatedAt = Math.max(now, Number.isFinite(current.updatedAt) ? current.updatedAt + 1 : now);
    const updated = { ...current, title, notes, status, updatedAt };

    if (status === current.status) {
      const tasks = state.tasks.slice();
      tasks[taskIndex] = updated;
      return { ...state, tasks };
    }

    const withoutCurrent = state.tasks.filter((task) => task.id !== id);
    return {
      ...state,
      tasks: insertIntoColumn(withoutCurrent, updated, status),
    };
  }

  function deleteTask(state, id) {
    const index = state.tasks.findIndex((task) => task.id === id);
    if (index === -1) return state;
    return {
      ...state,
      tasks: [...state.tasks.slice(0, index), ...state.tasks.slice(index + 1)],
    };
  }

  function moveTask(state, id, toStatus, toIndex) {
    assertStatus(toStatus);
    const current = state.tasks.find((task) => task.id === id);
    if (!current) return state;

    const withoutCurrent = state.tasks.filter((task) => task.id !== id);
    const targetCount = withoutCurrent.filter((task) => task.status === toStatus).length;
    const desiredIndex = columnIndex(toIndex, targetCount);
    if (current.status === toStatus && indexInColumn(state.tasks, id, toStatus) === desiredIndex) {
      return state;
    }

    const moved = current.status === toStatus ? current : { ...current, status: toStatus };
    return {
      ...state,
      tasks: insertIntoColumn(withoutCurrent, moved, toStatus, desiredIndex),
    };
  }

  function adjacentStatus(status, dir) {
    const index = COLUMNS.findIndex((column) => column.id === status);
    if (index === -1 || (dir !== -1 && dir !== 1)) return null;
    return COLUMNS[index + dir] ? COLUMNS[index + dir].id : null;
  }

  function filterTasks(state, query) {
    const terms = asText(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return state.tasks.slice();

    return state.tasks.filter((task) => {
      const text = `${task.title || ''} ${task.notes || ''}`.toLowerCase();
      return terms.every((term) => text.includes(term));
    });
  }

  function tasksByStatus(state, query) {
    const visible = filterTasks(state, query);
    return COLUMNS.reduce((grouped, column) => {
      grouped[column.id] = visible.filter((task) => task.status === column.id);
      return grouped;
    }, {});
  }

  function errorMessage(error) {
    if (error && typeof error.message === 'string' && error.message) return error.message;
    return String(error);
  }

  function saveState(storage, state) {
    try {
      if (!storage || typeof storage.setItem !== 'function') {
        throw new Error('Storage is unavailable');
      }
      const serialized = JSON.stringify(state);
      if (typeof serialized !== 'string') throw new Error('State could not be serialized');
      storage.setItem(STORAGE_KEY, serialized);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  }

  function repairedState(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (parsed.version !== 1 || !Array.isArray(parsed.tasks)) return null;

    let repaired = Object.keys(parsed).some((key) => key !== 'version' && key !== 'tasks');
    const ids = new Set();
    const tasks = [];

    for (const task of parsed.tasks) {
      if (!task || typeof task !== 'object' || Array.isArray(task)) {
        repaired = true;
        continue;
      }
      if (typeof task.id !== 'string' || !task.id.trim() || typeof task.title !== 'string' || !isStatus(task.status)) {
        repaired = true;
        continue;
      }
      if (ids.has(task.id)) {
        repaired = true;
        continue;
      }

      const title = normalizeTitle(task.title);
      if (!title) {
        repaired = true;
        continue;
      }
      const notes = normalizeNotes(task.notes);
      const createdAt = Number.isFinite(task.createdAt) ? task.createdAt : 0;
      const updatedAt = Number.isFinite(task.updatedAt) ? task.updatedAt : createdAt;
      if (
        title !== task.title || notes !== task.notes ||
        createdAt !== task.createdAt || updatedAt !== task.updatedAt ||
        Object.keys(task).some((key) => !TASK_FIELDS.has(key)) ||
        !Object.prototype.hasOwnProperty.call(task, 'notes')
      ) {
        repaired = true;
      }

      ids.add(task.id);
      tasks.push({
        id: task.id,
        title,
        notes,
        status: task.status,
        createdAt,
        updatedAt,
      });
    }

    return { state: { version: 1, tasks }, repaired };
  }

  function loadState(storage) {
    if (!storage || typeof storage.getItem !== 'function') {
      return { state: seedState(), warning: 'unavailable' };
    }

    let raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (_error) {
      return { state: seedState(), warning: 'unavailable' };
    }

    if (raw === null || raw === undefined) {
      const state = seedState();
      saveState(storage, state);
      return { state, warning: null };
    }

    let parsed;
    try {
      if (typeof raw !== 'string') throw new Error('Stored board is not text');
      parsed = JSON.parse(raw);
    } catch (_error) {
      try {
        storage.setItem(`${STORAGE_KEY}:corrupt-backup`, String(raw));
      } catch (_backupError) {
        // The corrupt copy is best effort; keep the original untouched.
      }
      return { state: seedState(), warning: 'corrupt' };
    }

    const result = repairedState(parsed);
    if (!result) {
      try {
        storage.setItem(`${STORAGE_KEY}:corrupt-backup`, raw);
      } catch (_backupError) {
        // The corrupt copy is best effort; keep the original untouched.
      }
      return { state: seedState(), warning: 'corrupt' };
    }

    return { state: result.state, warning: result.repaired ? 'repaired' : null };
  }

  return Object.freeze({
    COLUMNS,
    LIMITS,
    STORAGE_KEY,
    seedState,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    adjacentStatus,
    filterTasks,
    tasksByStatus,
    loadState,
    saveState,
  });
});
