import { contextBridge, ipcRenderer } from "electron";

// API historique pour le système de coffre
contextBridge.exposeInMainWorld("vaultAPI", {
  getFolder: () => ipcRenderer.invoke("vault:getFolder"),
  setFolder: (folderPath) => ipcRenderer.invoke("vault:setFolder", folderPath),
  selectFolder: () => ipcRenderer.invoke("vault:selectFolder"),
  readCategories: () => ipcRenderer.invoke("vault:readCategories"),
  writeCategories: (categories) => ipcRenderer.invoke("vault:writeCategories", categories),
});

// API simple demandée : window.api.selectFolder()
contextBridge.exposeInMainWorld("api", {
  selectFolder: () => ipcRenderer.invoke("vault:selectFolder"),
});

