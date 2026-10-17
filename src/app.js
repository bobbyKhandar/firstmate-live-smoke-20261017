(function () {
  'use strict';

  function start() {
    const store = window.TaskStore;
    if (!store) return;

    const byId = (id) => document.getElementById(id);
    const board = byId('board');
    const columns = byId('columns');
    const taskTemplate = byId('task-template');
    const search = byId('search');
    const addButton = byId('add-task');
    const emptyAddButton = byId('empty-add');
    const boardEmpty = byId('board-empty');
    const storageNotice = byId('storage-notice');
    const announcer = byId('announcer');
    const taskDialog = byId('task-dialog');
    const taskForm = byId('task-form');
    const taskIdInput = byId('task-id');
    const taskTitleInput = byId('task-title');
    const taskNotesInput = byId('task-notes');
    const taskStatusInput = byId('task-status');
    const taskError = byId('task-error');
    const taskDialogTitle = byId('dialog-title');
    const confirmDialog = byId('confirm-dialog');
    const confirmMessage = byId('confirm-message');
    const confirmCancel = byId('confirm-cancel');
    const confirmDelete = byId('confirm-delete');

    if (!board || !columns || !taskTemplate || !search || !taskDialog || !confirmDialog) {
      return;
    }

    let storage;
    try {
      storage = window.localStorage;
    } catch (error) {
      storage = undefined;
    }

    const loaded = store.loadState(storage);
    let state = loaded.state;
    let searchQuery = '';
    let editorReturn = null;
    let pendingDelete = null;
    let restoreDeleteTarget = null;
    let draggedId = null;

    const labelForStatus = (status) => {
      const column = store.COLUMNS.find((item) => item.id === status);
      return column ? column.label : status;
    };

    function setStorageNotice(kind) {
      if (!storageNotice) return;
      const messages = {
        unavailable: 'Storage is unavailable. Changes will be lost when you refresh.',
        corrupt: 'Saved data could not be read. A fresh board has been loaded.',
        repaired: 'Some saved tasks were invalid and have been removed.',
        failed: "Changes can't be saved in this browser and will be lost on refresh."
      };
      storageNotice.textContent = messages[kind] || '';
      storageNotice.hidden = !messages[kind];
    }

    setStorageNotice(loaded.warning);

    function allTaskCards() {
      return Array.from(columns.querySelectorAll('.task[data-id]'));
    }

    function findTaskCard(id) {
      return allTaskCards().find((card) => card.dataset.id === String(id)) || null;
    }

    function focusControl(element) {
      if (!element || !element.isConnected || element.disabled) return false;
      if (element.closest('[hidden]')) return false;
      element.focus({ preventScroll: true });
      return document.activeElement === element;
    }

    function focusCardEdit(id) {
      const card = findTaskCard(id);
      return card ? focusControl(card.querySelector('.js-edit')) : false;
    }

    function announce(message) {
      if (announcer) announcer.textContent = message;
    }

    function persist(nextState) {
      state = nextState;
      const result = store.saveState(storage, state);
      if (result.ok) setStorageNotice(null);
      else setStorageNotice('failed');
    }

    function createTaskCard(task) {
      const fragment = taskTemplate.content.cloneNode(true);
      const card = fragment.querySelector('.task');
      const title = fragment.querySelector('.task-title');
      const notes = fragment.querySelector('.task-notes');
      const previous = fragment.querySelector('.js-move-prev');
      const next = fragment.querySelector('.js-move-next');
      const edit = fragment.querySelector('.js-edit');
      const remove = fragment.querySelector('.js-delete');

      card.dataset.id = task.id;
      card.tabIndex = -1;
      card.draggable = true;
      title.textContent = task.title;
      notes.textContent = task.notes || '';
      notes.hidden = !task.notes;

      const previousStatus = store.adjacentStatus(task.status, -1);
      previous.hidden = !previousStatus;
      if (previousStatus) {
        previous.textContent = '← ' + labelForStatus(previousStatus);
        previous.setAttribute('aria-label', 'Move “' + task.title + '” to ' + labelForStatus(previousStatus));
        previous.dataset.direction = '-1';
      }

      const nextStatus = store.adjacentStatus(task.status, 1);
      next.hidden = !nextStatus;
      if (nextStatus) {
        next.textContent = labelForStatus(nextStatus) + ' →';
        next.setAttribute('aria-label', 'Move “' + task.title + '” to ' + labelForStatus(nextStatus));
        next.dataset.direction = '1';
      }

      edit.setAttribute('aria-label', 'Edit “' + task.title + '”');
      remove.setAttribute('aria-label', 'Delete “' + task.title + '”');
      return fragment;
    }

    function render() {
      const trimmedQuery = searchQuery.trim();
      const visibleByStatus = store.tasksByStatus(state, trimmedQuery);
      const totalByStatus = store.tasksByStatus(state);
      const hasTasks = state.tasks.length > 0;
      const isSearching = trimmedQuery.length > 0;

      if (boardEmpty) boardEmpty.hidden = hasTasks || isSearching;
      columns.hidden = !hasTasks && !isSearching;

      for (const status of store.COLUMNS.map((column) => column.id)) {
        const list = columns.querySelector('[data-list="' + status + '"]');
        const count = columns.querySelector('[data-count="' + status + '"]');
        const empty = columns.querySelector('[data-empty="' + status + '"]');
        if (!list || !count || !empty) continue;

        const visible = visibleByStatus[status] || [];
        const total = (totalByStatus[status] || []).length;
        count.textContent = isSearching ? visible.length + ' of ' + total : String(total);
        list.replaceChildren(...visible.map(createTaskCard));

        if (visible.length === 0) {
          empty.textContent = isSearching
            ? 'No matches for “' + trimmedQuery + '”'
            : 'Nothing here yet — add a task or move one over.';
          empty.hidden = false;
        } else {
          empty.textContent = '';
          empty.hidden = true;
        }
      }
    }

    function openEditor(task, opener) {
      editorReturn = task
        ? { taskId: task.id, opener: opener || null }
        : { taskId: null, opener: opener || addButton };
      taskForm.reset();
      taskIdInput.value = task ? task.id : '';
      taskTitleInput.value = task ? task.title : '';
      taskNotesInput.value = task ? task.notes : '';
      taskStatusInput.value = task ? task.status : 'todo';
      taskDialogTitle.textContent = task ? 'Edit task' : 'Add task';
      taskError.textContent = '';
      taskError.hidden = true;
      taskDialog.showModal();
      taskTitleInput.focus();
    }

    function openDelete(task, opener) {
      pendingDelete = {
        id: task.id,
        title: task.title,
        status: task.status,
        index: state.tasks.filter((item) => item.status === task.status).findIndex((item) => item.id === task.id),
        opener: opener
      };
      confirmMessage.textContent = "Delete “" + task.title + "”? This action can't be undone.";
      confirmDialog.showModal();
      confirmCancel.focus();
    }

    function nearestTaskControl(deleted) {
      const inColumn = state.tasks
        .filter((task) => task.status === deleted.status)
        .map((task) => task.id);
      const nearbyId = inColumn[Math.min(deleted.index, inColumn.length - 1)];
      if (nearbyId && focusCardEdit(nearbyId)) return true;
      if (focusControl(addButton)) return true;
      return focusControl(search);
    }

    function moveWithButton(task, direction) {
      const destination = store.adjacentStatus(task.status, direction);
      if (!destination) return;
      persist(store.moveTask(state, task.id, destination));
      render();
      announce('Moved “' + task.title + '” to ' + labelForStatus(destination));

      const card = findTaskCard(task.id);
      if (card) {
        const action = card.querySelector(direction < 0 ? '.js-move-prev' : '.js-move-next');
        if (!focusControl(action)) focusControl(card);
      } else {
        focusControl(search) || focusControl(addButton);
      }
    }

    addButton && addButton.addEventListener('click', () => openEditor(null, addButton));
    emptyAddButton && emptyAddButton.addEventListener('click', () => openEditor(null, emptyAddButton));

    search.addEventListener('input', () => {
      searchQuery = search.value;
      render();
    });

    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && search.value) {
        event.preventDefault();
        search.value = '';
        searchQuery = '';
        render();
      }
    });

    columns.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      const card = event.target.closest('.task[data-id]');
      if (!button || !card) return;
      const task = state.tasks.find((item) => item.id === card.dataset.id);
      if (!task) return;

      if (button.classList.contains('js-move-prev')) {
        moveWithButton(task, -1);
      } else if (button.classList.contains('js-move-next')) {
        moveWithButton(task, 1);
      } else if (button.classList.contains('js-edit')) {
        openEditor(task, button);
      } else if (button.classList.contains('js-delete')) {
        openDelete(task, button);
      }
    });

    taskForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = taskTitleInput.value.trim();
      if (!title) {
        taskError.textContent = 'Enter a title';
        taskError.hidden = false;
        taskTitleInput.focus();
        return;
      }

      try {
        const id = taskIdInput.value;
        if (id) {
          persist(store.updateTask(state, id, {
            title: title,
            notes: taskNotesInput.value,
            status: taskStatusInput.value
          }));
        } else {
          const result = store.addTask(state, {
            title: title,
            notes: taskNotesInput.value,
            status: taskStatusInput.value
          });
          persist(result.state);
        }
        render();
        taskDialog.close();
      } catch (error) {
        taskError.textContent = error && error.code === 'EMPTY_TITLE' ? 'Enter a title' : 'This task could not be saved.';
        taskError.hidden = false;
        taskTitleInput.focus();
      }
    });

    byId('task-cancel').addEventListener('click', () => taskDialog.close());

    taskDialog.addEventListener('close', () => {
      const returning = editorReturn;
      editorReturn = null;
      if (returning && returning.taskId && focusCardEdit(returning.taskId)) return;
      if (returning && focusControl(returning.opener)) return;
      focusControl(addButton) || focusControl(search);
    });

    confirmCancel.addEventListener('click', () => confirmDialog.close());
    confirmDelete.addEventListener('click', () => {
      if (!pendingDelete) {
        confirmDialog.close();
        return;
      }
      const deleted = pendingDelete;
      const task = state.tasks.find((item) => item.id === deleted.id);
      pendingDelete = null;
      if (task) {
        persist(store.deleteTask(state, deleted.id));
        render();
        announce('Deleted “' + deleted.title + '”');
        restoreDeleteTarget = deleted;
      }
      confirmDialog.close();
    });

    confirmDialog.addEventListener('close', () => {
      const deleted = restoreDeleteTarget;
      const cancelled = pendingDelete;
      restoreDeleteTarget = null;
      pendingDelete = null;
      if (deleted && !state.tasks.some((task) => task.id === deleted.id)) {
        nearestTaskControl(deleted);
        return;
      }
      const returnTo = deleted || cancelled;
      if (returnTo && focusControl(returnTo.opener)) return;
      focusControl(addButton) || focusControl(search);
    });

    function targetDropIndex(list, sourceId, clientY) {
      const cards = Array.from(list.querySelectorAll(':scope > .task[data-id]'))
        .filter((card) => card.dataset.id !== sourceId);
      let index = 0;
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return index;
        index += 1;
      }
      return index;
    }

    columns.addEventListener('dragstart', (event) => {
      const card = event.target.closest('.task[data-id]');
      if (!card || !event.dataTransfer) return;
      draggedId = card.dataset.id;
      event.dataTransfer.setData('text/plain', draggedId);
      event.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });

    columns.addEventListener('dragover', (event) => {
      const column = event.target.closest('.column[data-status]');
      if (!column || !draggedId) return;
      event.preventDefault();
      event.dataTransfer && (event.dataTransfer.dropEffect = 'move');
      columns.querySelectorAll('.column.is-drop-target').forEach((item) => item.classList.remove('is-drop-target'));
      column.classList.add('is-drop-target');
    });

    columns.addEventListener('drop', (event) => {
      const column = event.target.closest('.column[data-status]');
      if (!column) return;
      event.preventDefault();
      const sourceId = (event.dataTransfer && event.dataTransfer.getData('text/plain')) || draggedId;
      const task = state.tasks.find((item) => item.id === sourceId);
      if (!task) return;

      const destination = column.dataset.status;
      const list = column.querySelector('.task-list');
      let index;
      if (searchQuery.trim()) {
        index = state.tasks.filter((item) => item.status === destination && item.id !== sourceId).length;
      } else {
        index = targetDropIndex(list, sourceId, event.clientY);
      }
      persist(store.moveTask(state, sourceId, destination, index));
      render();
      if (task.status !== destination) {
        announce('Moved “' + task.title + '” to ' + labelForStatus(destination));
      } else {
        announce('Reordered “' + task.title + '” in ' + labelForStatus(destination));
      }
      const movedCard = findTaskCard(sourceId);
      if (movedCard) {
        focusControl(movedCard.querySelector('.js-edit')) || focusControl(movedCard);
      } else {
        focusControl(search) || focusControl(addButton);
      }
      draggedId = null;
    });

    columns.addEventListener('dragend', () => {
      draggedId = null;
      columns.querySelectorAll('.is-dragging').forEach((item) => item.classList.remove('is-dragging'));
      columns.querySelectorAll('.is-drop-target').forEach((item) => item.classList.remove('is-drop-target'));
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
