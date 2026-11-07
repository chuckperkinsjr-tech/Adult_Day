const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  list: () => ipcRenderer.invoke('patients:list'),
  save: (record) => ipcRenderer.invoke('patients:save', record),
  remove: (id) => ipcRenderer.invoke('patients:delete', id),
  print: (id) => ipcRenderer.invoke('patients:print', id),
  pdf: (id) => ipcRenderer.invoke('patients:pdf', id),
  backup: () => ipcRenderer.invoke('data:backup'),
  restore: () => ipcRenderer.invoke('data:restore'),
});
