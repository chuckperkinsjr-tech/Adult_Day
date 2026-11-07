// ---------- Setup ----------
const LISTS = {
  allergies: [
    { key: 'allergen', label: 'Allergen', width: '1fr' },
    { key: 'reaction', label: 'Reaction or severity', width: '1.5fr' },
  ],
  medications: [
    { key: 'name', label: 'Medication', width: '1.4fr' },
    { key: 'dose', label: 'Dose', width: '1fr' },
    { key: 'schedule', label: 'Schedule', width: '1.4fr' },
  ],
  log: [
    { key: 'date', label: 'Date', width: '150px', type: 'date' },
    { key: 'entry', label: 'Entry', width: '1fr', type: 'textarea' },
  ],
};
const TEXT_FIELDS = ['firstName', 'lastName', 'dob', 'phone', 'email', 'address', 'ecName', 'ecRelationship', 'ecPhone', 'history'];

const $ = (s) => document.querySelector(s);
const form = $('#editor');
const statusEl = $('#status');

let patients = [];
let selectedId = null; // id of the saved patient being shown
let isNew = false;     // true while filling in a patient that has not been saved yet
let dirty = false;

// ---------- Helpers ----------
const cmp = (x, y) => String(x || '').localeCompare(String(y || ''), undefined, { sensitivity: 'base' });

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}
function ageOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const now = new Date();
  let age = now.getFullYear() - +m[1];
  if (now.getMonth() + 1 < +m[2] || (now.getMonth() + 1 === +m[2] && now.getDate() < +m[3])) age--;
  return age >= 0 ? age : null;
}

const byDob = (dir) => (a, b) => {
  if (!a.dob || !b.dob) return !a.dob - !b.dob; // patients without a date of birth go last
  return dir * cmp(a.dob, b.dob);
};
const SORTS = {
  lastAsc: (a, b) => cmp(a.lastName, b.lastName) || cmp(a.firstName, b.firstName),
  lastDesc: (a, b) => cmp(b.lastName, a.lastName) || cmp(b.firstName, a.firstName),
  firstAsc: (a, b) => cmp(a.firstName, b.firstName) || cmp(a.lastName, b.lastName),
  oldest: byDob(1),
  youngest: byDob(-1),
  updated: (a, b) => cmp(b.updatedAt, a.updatedAt),
  added: (a, b) => cmp(b.createdAt, a.createdAt),
};

let statusTimer;
function say(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
  clearTimeout(statusTimer);
  if (!isError) statusTimer = setTimeout(() => (statusEl.textContent = ''), 6000);
}

function confirmDiscard() {
  return !dirty || confirm('You have unsaved changes. Discard them?');
}

// ---------- Patient list ----------
function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const shown = patients
    .filter((p) => !q || `${p.firstName} ${p.lastName} ${p.phone} ${p.email}`.toLowerCase().includes(q))
    .sort(SORTS[$('#sort').value]);

  $('#count').textContent = `${shown.length} of ${patients.length} patient${patients.length === 1 ? '' : 's'}`;

  const ul = $('#patient-list');
  ul.replaceChildren();
  if (!shown.length) {
    const li = document.createElement('li');
    li.className = 'none';
    li.textContent = patients.length ? 'No patients match your search.' : 'No patients yet. Select New patient to add one.';
    ul.append(li);
    return;
  }
  for (const p of shown) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'patient';
    if (p.id === selectedId) btn.setAttribute('aria-current', 'true');

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = `${p.lastName}, ${p.firstName}`;
    const sub = document.createElement('div');
    sub.className = 'sub';
    const age = ageOf(p.dob);
    sub.textContent = p.dob ? `Born ${fmtDate(p.dob)}${age !== null ? ` (age ${age})` : ''}` : 'Date of birth not recorded';

    btn.append(name, sub);
    btn.addEventListener('click', () => openPatient(p.id));
    li.append(btn);
    ul.append(li);
  }
}

// ---------- Repeating rows (allergies, medications, log) ----------
function listParts(name) {
  const root = document.querySelector(`[data-list="${name}"]`);
  return { head: root.querySelector('.head'), body: root.querySelector('.body') };
}

function syncHead(name) {
  const { head, body } = listParts(name);
  head.hidden = body.children.length === 0;
}

function addRow(name, values = {}, markDirty = true) {
  const cols = LISTS[name];
  const { body } = listParts(name);
  const row = document.createElement('div');
  row.className = 'row';
  row.style.gridTemplateColumns = `${cols.map((c) => c.width).join(' ')} auto`;

  for (const c of cols) {
    const input = document.createElement(c.type === 'textarea' ? 'textarea' : 'input');
    if (c.type === 'textarea') input.rows = 2;
    else input.type = c.type || 'text';
    input.dataset.key = c.key;
    input.value = values[c.key] || '';
    input.setAttribute('aria-label', c.label);
    row.append(input);
  }
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Remove';
  remove.addEventListener('click', () => {
    row.remove();
    syncHead(name);
    setDirty(true);
  });
  row.append(remove);
  body.append(row);
  syncHead(name);
  if (markDirty) {
    setDirty(true);
    row.querySelector('input, textarea').focus();
  }
}

function setRows(name, items) {
  listParts(name).body.replaceChildren();
  (items || []).forEach((item) => addRow(name, item, false));
  syncHead(name);
}

function collectRows(name) {
  return [...listParts(name).body.children]
    .map((row) => Object.fromEntries([...row.querySelectorAll('[data-key]')].map((el) => [el.dataset.key, el.value])))
    .filter((item) => Object.values(item).some((v) => v.trim()));
}

for (const [name, cols] of Object.entries(LISTS)) {
  const root = document.querySelector(`[data-list="${name}"]`);
  const head = document.createElement('div');
  head.className = 'head';
  head.hidden = true;
  head.style.gridTemplateColumns = `${cols.map((c) => c.width).join(' ')} auto`;
  for (const c of cols) {
    const s = document.createElement('span');
    s.textContent = c.label;
    head.append(s);
  }
  const spacer = document.createElement('span');
  spacer.style.visibility = 'hidden';
  spacer.textContent = 'Remove';
  head.append(spacer);
  const body = document.createElement('div');
  body.className = 'body';
  root.append(head, body);
}
document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addRow(b.dataset.add)));

// ---------- Editor ----------
function setDirty(value) {
  dirty = value;
  $('#dirty').hidden = !value;
}

function showEditor(p) {
  $('#empty').hidden = true;
  form.hidden = false;
  for (const f of TEXT_FIELDS) form.elements[f].value = p[f] || '';
  for (const name of Object.keys(LISTS)) setRows(name, p[name]);
  setDirty(false);
  updateHeader(p);
  form.closest('.main').scrollTop = 0;
}

function updateHeader(p) {
  $('#title').textContent = isNew ? 'New patient' : `${p.firstName} ${p.lastName}`;
  $('#updated').textContent = isNew ? 'Not saved yet' : `Last updated ${new Date(p.updatedAt).toLocaleString()}`;
  $('#delete').disabled = isNew;
}

function showEmpty() {
  selectedId = null;
  isNew = false;
  setDirty(false);
  form.hidden = true;
  $('#empty').hidden = false;
  renderList();
}

function openPatient(id) {
  if (id === selectedId && !isNew) return;
  if (!confirmDiscard()) return;
  const p = patients.find((x) => x.id === id);
  if (!p) return;
  selectedId = id;
  isNew = false;
  showEditor(p);
  renderList();
}

function newPatient() {
  if (!confirmDiscard()) return;
  selectedId = null;
  isNew = true;
  showEditor({});
  renderList();
  form.elements.firstName.focus();
}

function collect() {
  const rec = { id: selectedId };
  for (const f of TEXT_FIELDS) rec[f] = form.elements[f].value;
  for (const name of Object.keys(LISTS)) rec[name] = collectRows(name);
  return rec;
}

async function save() {
  if (!form.reportValidity()) return null;
  try {
    const saved = await window.api.save(collect());
    const i = patients.findIndex((p) => p.id === saved.id);
    if (i >= 0) patients[i] = saved;
    else patients.push(saved);
    selectedId = saved.id;
    isNew = false;
    setDirty(false);
    updateHeader(saved);
    renderList();
    say(`Saved ${saved.firstName} ${saved.lastName}.`);
    return saved;
  } catch (err) {
    say('Could not save. ' + (err.message || ''), true);
    return null;
  }
}

async function ensureSaved() {
  if (!dirty && !isNew) return true;
  return Boolean(await save());
}

// ---------- Actions ----------
form.addEventListener('submit', (e) => {
  e.preventDefault();
  save();
});
form.addEventListener('input', () => setDirty(true));

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && !form.hidden) {
    e.preventDefault();
    save();
  }
});

$('#print').addEventListener('click', async () => {
  if (!(await ensureSaved())) return;
  try {
    const r = await window.api.print(selectedId);
    if (!r.success && r.reason !== 'cancelled' && r.reason !== 'Print job canceled') say('Could not print: ' + r.reason, true);
  } catch (err) {
    say('Could not print. ' + (err.message || ''), true);
  }
});

$('#pdf').addEventListener('click', async () => {
  if (!(await ensureSaved())) return;
  try {
    const r = await window.api.pdf(selectedId);
    if (!r.canceled) say(`PDF saved: ${r.filePath}`);
  } catch (err) {
    say('Could not create the PDF. ' + (err.message || ''), true);
  }
});

$('#delete').addEventListener('click', async () => {
  const p = patients.find((x) => x.id === selectedId);
  if (!p) return;
  if (!confirm(`Delete ${p.firstName} ${p.lastName}? This cannot be undone.`)) return;
  try {
    await window.api.remove(p.id);
    patients = patients.filter((x) => x.id !== p.id);
    showEmpty();
    say(`Deleted ${p.firstName} ${p.lastName}.`);
  } catch (err) {
    say('Could not delete. ' + (err.message || ''), true);
  }
});

$('#new').addEventListener('click', newPatient);
$('#search').addEventListener('input', renderList);
$('#sort').addEventListener('change', () => {
  try { localStorage.setItem('sort', $('#sort').value); } catch {}
  renderList();
});

$('#backup').addEventListener('click', async () => {
  try {
    const r = await window.api.backup();
    if (!r.canceled) say(`Backup saved: ${r.filePath}`);
  } catch (err) {
    say('Could not create the backup. ' + (err.message || ''), true);
  }
});

$('#restore').addEventListener('click', async () => {
  if (!confirmDiscard()) return;
  try {
    const r = await window.api.restore();
    if (r.canceled) return;
    patients = r.patients;
    showEmpty();
    say(`Restored ${patients.length} patient${patients.length === 1 ? '' : 's'} from backup.`);
  } catch (err) {
    say(err.message.replace(/^Error invoking remote method '[^']+': Error: /, ''), true);
  }
});

// Block closing the window while there are unsaved edits (main process asks what to do).
window.addEventListener('beforeunload', (e) => {
  if (dirty) e.returnValue = false;
});

// ---------- Start ----------
(async function init() {
  // window.api only exists inside the Adult Day Care app. If this page was opened
  // in a web browser (for example by double-clicking index.html), nothing can be saved.
  if (!window.api) {
    document.body.replaceChildren();
    const box = document.createElement('div');
    box.style.cssText = 'max-width:560px;margin:15vh auto;padding:0 24px;font:16px/1.5 -apple-system,system-ui,sans-serif';
    const h = document.createElement('h1');
    h.textContent = 'Open this from the Adult Day Care app';
    h.style.fontSize = '22px';
    const p = document.createElement('p');
    p.textContent =
      'This page is only part of the program. It cannot save anything when opened in a web browser. ' +
      'Start the app instead: run "npm start" in the project folder, or open Adult Day Care from the Applications folder after installing it.';
    box.append(h, p);
    document.body.append(box);
    return;
  }
  try {
    const saved = localStorage.getItem('sort');
    if (saved && SORTS[saved]) $('#sort').value = saved;
  } catch {}
  try {
    patients = await window.api.list();
  } catch (err) {
    say('Could not load saved patients. ' + (err.message || ''), true);
  }
  renderList();
})();
