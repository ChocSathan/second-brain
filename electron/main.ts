import { app, BrowserWindow, dialog, ipcMain, session } from "electron"
import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type AppSettings = {
  vaultFolder?: string
}

type StoredNote = {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

type StoredCategory = {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  notes: StoredNote[]
}

type CategoryIndexEntry = {
  id: string
  name: string
  desc: string
  createdAt: string
  modifiedAt: string
  numberOfNotes: number
  noteIds: string[]
}

const VAULT_INDEX_FILE = "second-brain.index.json"
const LEGACY_VAULT_DATA_FILE = "second-brain.categories.json"
const CATEGORY_FOLDER_PREFIX = "category-"

const fsp = fs.promises

async function loadSettings(configPath: string): Promise<AppSettings> {
  try {
    const data = await fsp.readFile(configPath, "utf-8")
    return JSON.parse(data) as AppSettings
  } catch {
    return {}
  }
}

async function saveSettings(configPath: string, settings: AppSettings) {
  await fsp.mkdir(path.dirname(configPath), { recursive: true })
  await fsp.writeFile(configPath, JSON.stringify(settings, null, 2), "utf-8")
}

function getVaultDataPath(vaultFolder: string) {
  return path.join(vaultFolder, VAULT_INDEX_FILE)
}

function getLegacyVaultDataPath(vaultFolder: string) {
  return path.join(vaultFolder, LEGACY_VAULT_DATA_FILE)
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function buildNameId(baseName: string, id: string) {
  const safeId = String(id ?? "").trim()
  const slug = slugify(String(baseName ?? ""))
  return slug ? `${slug}-${safeId}` : safeId
}

function getCategoryFolderPath(vaultFolder: string, categoryId: string) {
  return path.join(vaultFolder, `${CATEGORY_FOLDER_PREFIX}${categoryId}`)
}

function getCategoryFolderPathNameId(vaultFolder: string, categoryName: string, categoryId: string) {
  return path.join(vaultFolder, buildNameId(categoryName, categoryId))
}

function getNoteFilePath(categoryFolder: string, noteId: string) {
  return path.join(categoryFolder, `${noteId}.md`)
}

function getNoteFilePathNameId(categoryFolder: string, noteTitle: string, noteId: string) {
  return path.join(categoryFolder, `${buildNameId(noteTitle, noteId)}.md`)
}

async function findCategoryFolderPath(vaultFolder: string, categoryName: string, categoryId: string) {
  const preferred = getCategoryFolderPathNameId(vaultFolder, categoryName, categoryId)
  if (fs.existsSync(preferred)) {
    return preferred
  }

  const legacy = getCategoryFolderPath(vaultFolder, categoryId)
  if (fs.existsSync(legacy)) {
    return legacy
  }

  try {
    const entries = await fsp.readdir(vaultFolder, { withFileTypes: true })
    const fallback = entries.find((entry) => {
      if (!entry.isDirectory()) return false
      return entry.name.endsWith(`-${categoryId}`)
    })
    if (fallback) {
      return path.join(vaultFolder, fallback.name)
    }
  } catch {
    return preferred
  }

  return preferred
}

async function findNoteFilePath(categoryFolder: string, noteId: string) {
  const legacy = getNoteFilePath(categoryFolder, noteId)
  if (fs.existsSync(legacy)) {
    return legacy
  }

  try {
    const entries = await fsp.readdir(categoryFolder, { withFileTypes: true })
    const fallback = entries.find((entry) => {
      if (!entry.isFile() || !entry.name.endsWith(".md")) return false
      return entry.name.endsWith(`-${noteId}.md`)
    })
    if (fallback) {
      return path.join(categoryFolder, fallback.name)
    }
  } catch {
    return legacy
  }

  return legacy
}

function parseMaybeQuotedValue(value: string) {
  const trimmed = value.trim()
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      return JSON.parse(trimmed.replace(/^'/, '"').replace(/'$/, '"')) as string
    } catch {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

function parseFrontmatter(frontmatter: string) {
  const metadata: Record<string, string> = {}

  for (const line of frontmatter.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":")
    if (separatorIndex <= 0) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    if (!key) continue
    metadata[key] = parseMaybeQuotedValue(value)
  }

  return metadata
}

function parseNoteMarkdown(markdown: string) {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
    return { metadata: {}, body: markdown }
  }

  const lines = markdown.split(/\r?\n/)
  if (lines[0] !== "---") {
    return { metadata: {}, body: markdown }
  }

  let closingIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === "---") {
      closingIndex = index
      break
    }
  }

  if (closingIndex === -1) {
    return { metadata: {}, body: markdown }
  }

  const frontmatter = lines.slice(1, closingIndex).join("\n")
  const body = lines.slice(closingIndex + 1).join("\n")
  return {
    metadata: parseFrontmatter(frontmatter),
    body,
  }
}

function toNoteMarkdown(note: StoredNote) {
  const frontmatter = [
    "---",
    `id: ${JSON.stringify(note.id)}`,
    `title: ${JSON.stringify(note.title)}`,
    `createdAt: ${JSON.stringify(note.createdAt)}`,
    `updatedAt: ${JSON.stringify(note.updatedAt)}`,
    "---",
    "",
  ].join("\n")

  return `${frontmatter}${note.content ?? ""}`
}

function toIndexEntry(category: StoredCategory): CategoryIndexEntry {
  return {
    id: category.id,
    name: category.name,
    desc: category.description,
    createdAt: category.createdAt,
    modifiedAt: category.updatedAt,
    numberOfNotes: category.notes.length,
    noteIds: category.notes.map((note) => note.id),
  }
}

async function readVaultCategories(vaultFolder: string) {
  const indexPath = getVaultDataPath(vaultFolder)

  try {
    const indexContent = await fsp.readFile(indexPath, "utf-8")
    const indexEntries = JSON.parse(indexContent) as CategoryIndexEntry[]

    const categories: StoredCategory[] = []

    for (const entry of indexEntries) {
      const categoryFolder = await findCategoryFolderPath(vaultFolder, entry.name, entry.id)
      const notes: StoredNote[] = []

      for (const noteId of entry.noteIds ?? []) {
        const notePath = await findNoteFilePath(categoryFolder, noteId)
        try {
          const markdown = await fsp.readFile(notePath, "utf-8")
          const { metadata, body } = parseNoteMarkdown(markdown)
          notes.push({
            id: metadata.id || noteId,
            title: metadata.title || noteId,
            content: body,
            createdAt: metadata.createdAt || entry.createdAt,
            updatedAt: metadata.updatedAt || entry.modifiedAt,
          })
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error
          }
        }
      }

      categories.push({
        id: entry.id,
        name: entry.name,
        description: entry.desc,
        createdAt: entry.createdAt,
        updatedAt: entry.modifiedAt,
        notes,
      })
    }

    return categories
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const legacyPath = getLegacyVaultDataPath(vaultFolder)
      try {
        const legacyContent = await fsp.readFile(legacyPath, "utf-8")
        return JSON.parse(legacyContent)
      } catch (legacyError) {
        if ((legacyError as NodeJS.ErrnoException).code === "ENOENT") {
          return []
        }
        throw legacyError
      }
    }
    throw error
  }
}

async function writeVaultCategories(vaultFolder: string, categories: unknown) {
  const storedCategories = (Array.isArray(categories) ? categories : []) as StoredCategory[]
  const indexPath = getVaultDataPath(vaultFolder)
  const legacyPath = getLegacyVaultDataPath(vaultFolder)

  await fsp.mkdir(vaultFolder, { recursive: true })

  const activeCategoryFolders = new Set<string>()
  const indexEntries: CategoryIndexEntry[] = []

  for (const category of storedCategories) {
    const normalizedCategory: StoredCategory = {
      id: String(category.id ?? ""),
      name: String(category.name ?? ""),
      description: String(category.description ?? ""),
      createdAt: String(category.createdAt ?? new Date().toISOString()),
      updatedAt: String(category.updatedAt ?? new Date().toISOString()),
      notes: Array.isArray(category.notes)
        ? category.notes.map((note) => ({
            id: String(note.id ?? ""),
            title: String(note.title ?? ""),
            content: String(note.content ?? ""),
            createdAt: String(note.createdAt ?? new Date().toISOString()),
            updatedAt: String(note.updatedAt ?? new Date().toISOString()),
          }))
        : [],
    }

    if (!normalizedCategory.id) {
      continue
    }

    const categoryFolder = getCategoryFolderPathNameId(
      vaultFolder,
      normalizedCategory.name,
      normalizedCategory.id,
    )
    activeCategoryFolders.add(path.basename(categoryFolder))
    await fsp.mkdir(categoryFolder, { recursive: true })

    const activeNoteFiles = new Set<string>()

    for (const note of normalizedCategory.notes) {
      if (!note.id) continue
      const fileName = `${buildNameId(note.title, note.id)}.md`
      activeNoteFiles.add(fileName)
      const notePath = getNoteFilePathNameId(categoryFolder, note.title, note.id)
      await fsp.writeFile(notePath, toNoteMarkdown(note), "utf-8")
    }

    const existingCategoryItems = await fsp.readdir(categoryFolder, { withFileTypes: true })
    for (const item of existingCategoryItems) {
      if (!item.isFile() || !item.name.endsWith(".md")) continue
      if (activeNoteFiles.has(item.name)) continue
      await fsp.unlink(path.join(categoryFolder, item.name))
    }

    indexEntries.push(toIndexEntry(normalizedCategory))
  }

  const vaultItems = await fsp.readdir(vaultFolder, { withFileTypes: true })
  for (const item of vaultItems) {
    if (!item.isDirectory()) continue
    const isLegacyFolder = item.name.startsWith(CATEGORY_FOLDER_PREFIX)
    const isNameIdFolder = /-[a-f0-9-]{8,}$/.test(item.name)
    if (!isLegacyFolder && !isNameIdFolder) continue
    if (activeCategoryFolders.has(item.name)) continue
    await fsp.rm(path.join(vaultFolder, item.name), { recursive: true, force: true })
  }

  await fsp.writeFile(indexPath, JSON.stringify(indexEntries, null, 2), "utf-8")

  try {
    await fsp.unlink(legacyPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error
    }
  }
}

function createWindow() {
  // Preload: same folder as main, or project/electron/preload.cjs if main is compiled elsewhere
  const nextToMain = path.join(__dirname, "preload.cjs")
  const fromAppRoot = path.join(app.getAppPath(), "electron", "preload.cjs")
  const preloadPath = fs.existsSync(nextToMain) ? nextToMain : fromAppRoot
  const preloadExists = fs.existsSync(preloadPath)
  console.log("[Electron] preload path:", preloadPath, "| exists:", preloadExists)

  const mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
    },
  })

  const connectSources = app.isPackaged
    ? "'self' file: data:"
    : "'self' http://localhost:5173 ws://localhost:5173"

  const scriptSources = app.isPackaged
    ? "'self' 'unsafe-inline' file:"
    : "'self' 'unsafe-inline'"

  const csp = [
    "default-src 'self' file: data: blob:",
    `script-src ${scriptSources}`,
    "style-src 'self' 'unsafe-inline' file:",
    "img-src 'self' data: blob: file:",
    "font-src 'self' data: file:",
    `connect-src ${connectSources}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ")

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    })
  })

  mainWindow.setMenu(null)

  if (app.isPackaged) {
    const packagedIndexPath = path.join(app.getAppPath(), "dist", "index.html")
    console.log("[Electron] packaged index path:", packagedIndexPath, "| exists:", fs.existsSync(packagedIndexPath))
    mainWindow.loadFile(packagedIndexPath)
  } else {
    mainWindow.loadURL("http://localhost:5173")
  }

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("[Electron] did-fail-load", { errorCode, errorDescription, validatedURL })
  })

  // Open DevTools in development so you can use Ctrl+Shift+I (or F12)
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools()
  }
}

app.whenReady().then(async () => {
  const userData = app.getPath("userData")
  const configPath = path.join(userData, "settings.json")

  const settings = await loadSettings(configPath)

  ipcMain.handle("vault:getFolder", () => {
    return settings.vaultFolder ?? null
  })

  ipcMain.handle("vault:setFolder", async (_event, folderPath: string | null) => {
    settings.vaultFolder = folderPath ?? undefined
    await saveSettings(configPath, settings)
    return settings.vaultFolder ?? null
  })

  ipcMain.handle("vault:selectFolder", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: "Choisir le dossier du coffre (vault)",
          properties: ["openDirectory"],
        })
      : await dialog.showOpenDialog({
          title: "Choisir le dossier du coffre (vault)",
          properties: ["openDirectory"],
        })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const selected = result.filePaths[0]
    settings.vaultFolder = selected
    await saveSettings(configPath, settings)
    return selected
  })

  ipcMain.handle("vault:readCategories", async () => {
    if (!settings.vaultFolder) {
      return []
    }
    return readVaultCategories(settings.vaultFolder)
  })

  ipcMain.handle("vault:writeCategories", async (_event, categories: unknown) => {
    if (!settings.vaultFolder) {
      throw new Error("Vault folder is not configured")
    }
    await writeVaultCategories(settings.vaultFolder, categories)
    return true
  })

  createWindow()
})
