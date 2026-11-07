const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { recordHtml, safeFileName } = require('./record-html');

// All data is stored on this computer only:
//   ~/Library/Application Support/Adult Day Care/patients.json
const dataFile = () => path.join(app.getPath('userData'), 'patients.json');

const TEXT_FIELDS = [
  'firstName', 'lastName', 'dob', 'phone', 'email', 'address',
  'ecName', 'ecRelationship', 'ecPhone', 'history',
];
const LIST_FIELDS = {
  allergies: ['allergen', 'reaction'],
  medications: ['name', 'dose', 'schedule'],
  log: ['date', 'entry'],
};

function readData() {
  let raw;
  try {
    raw = fs.readFileSync(dataFile(), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { patients: [] };
    throw err;
  }
  try {
    const data = JSON.parse(raw);
    return { patients: Array.isArray(data.patients) ? data.patients : [] };
  } catch {
    // Never silently overwrite a damaged file: move it aside so nothing is lost.
    const aside = `${dataFile()}.damaged-${Date.now()}`;
    fs.renameSync(dataFile(), aside);
    dialog.showErrorBox(
      'The data file could not be read',
      `It was moved to:\n${aside}\n\nThe app will start empty. The previous version may also be in patients.json.bak in the same folder.`
    );
    return { patients: [] };
  }
}

function writeData(data) {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`); // keep the previous version
  fs.renameSync(tmp, file); // atomic swap
}

// Keep only known fields, as trimmed strings; drop blank list rows.
function clean(rec) {
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const out = {};
  for (const f of TEXT_FIELDS) out[f] = str(rec[f]);
  for (const [list, keys] of Object.entries(LIST_FIELDS)) {
    const items = Array.isArray(rec[list]) ? rec[list] : [];
    out[list] = items
      .map((item) => Object.fromEntries(keys.map((k) => [k, str(item && item[k])])))
      .filter((item) => Object.values(item).some(Boolean));
  }
  return out;
}

const findPatient = (id) => {
  const p = readData().patients.find((x) => x.id === id);
  if (!p) throw new Error('Patient not found.');
  return p;
};

ipcMain.handle('patients:list', () => readData().patients);

ipcMain.handle('patients:save', (_e, rec) => {
  const fields = clean(rec || {});
  if (!fields.firstName || !fields.lastName) throw new Error('First and last name are required.');
  const data = readData();
  const now = new Date().toISOString();
  const idx = rec.id ? data.patients.findIndex((p) => p.id === rec.id) : -1;
  let saved;
  if (idx >= 0) {
    saved = { ...data.patients[idx], ...fields, updatedAt: now };
    data.patients[idx] = saved;
  } else {
    saved = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...fields };
    data.patients.push(saved);
  }
  writeData(data);
  return saved;
});

ipcMain.handle('patients:delete', (_e, id) => {
  const data = readData();
  data.patients = data.patients.filter((p) => p.id !== id);
  writeData(data);
  return true;
});

// Render a record in a hidden, script-free window for printing or PDF.
async function loadOffscreen(patient) {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(recordHtml(patient)));
  return win;
}

ipcMain.handle('patients:print', async (_e, id) => {
  const win = await loadOffscreen(findPatient(id));
  return new Promise((resolve) => {
    win.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
      win.destroy();
      resolve({ success, reason });
    });
  });
});

ipcMain.handle('patients:pdf', async (e, id) => {
  const p = findPatient(id);
  const parent = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    defaultPath: path.join(app.getPath('documents'), `${safeFileName(p)}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { canceled: true };
  const win = await loadOffscreen(p);
  try {
    const pdf = await win.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(filePath, pdf);
  } finally {
    win.destroy();
  }
  shell.showItemInFolder(filePath);
  return { canceled: false, filePath };
});

ipcMain.handle('data:backup', async (e) => {
  const parent = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    defaultPath: path.join(app.getPath('documents'), `AdultDayCare-backup-${new Date().toISOString().slice(0, 10)}.json`),
    filters: [{ name: 'Backup file', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { canceled: true };
  fs.writeFileSync(filePath, JSON.stringify(readData(), null, 2));
  return { canceled: false, filePath };
});

ipcMain.handle('data:restore', async (e) => {
  const parent = BrowserWindow.fromWebContents(e.sender);
  const open = await dialog.showOpenDialog(parent, { properties: ['openFile'], filters: [{ name: 'Backup file', extensions: ['json'] }] });
  if (open.canceled || !open.filePaths[0]) return { canceled: true };

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(open.filePaths[0], 'utf8'));
  } catch {
    throw new Error('That file is not a valid backup.');
  }
  if (!parsed || !Array.isArray(parsed.patients)) throw new Error('That file is not a valid backup.');

  const current = readData().patients.length;
  const { response } = await dialog.showMessageBox(parent, {
    type: 'warning',
    message: `Replace all ${current} current patient${current === 1 ? '' : 's'} with ${parsed.patients.length} from this backup?`,
    detail: 'This cannot be undone. Back up first if you are not sure.',
    buttons: ['Replace current data', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
  });
  if (response !== 0) return { canceled: true };

  const now = new Date().toISOString();
  const patients = parsed.patients
    .filter((p) => p && typeof p === 'object')
    .map((p) => ({
      id: typeof p.id === 'string' && p.id ? p.id : crypto.randomUUID(),
      createdAt: p.createdAt || now,
      updatedAt: p.updatedAt || now,
      ...clean(p),
    }));
  writeData({ patients });
  return { canceled: false, patients };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // The page blocks closing while a form has unsaved edits; ask the person what to do.
  win.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      message: 'You have unsaved changes.',
      detail: 'Leave now and lose them, or go back and save?',
      buttons: ['Leave without saving', 'Go back'],
      defaultId: 1,
      cancelId: 1,
    });
    if (choice === 0) event.preventDefault(); // ignore the block and close
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
