import type { Category } from "../types/Category"

const STORAGE_KEY = "second-brain.categories.v1"

type RawCategory = Omit<Category, "createdAt" | "updatedAt" | "notes"> & {
  createdAt: string
  updatedAt: string
  notes: Array<
    Omit<Category["notes"][number], "createdAt" | "updatedAt"> & {
      createdAt: string
      updatedAt: string
    }
  >
}

function deserializeCategories(rawCategories: RawCategory[]): Category[] {
  return rawCategories.map((c) => ({
    ...c,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
    notes: c.notes.map((n) => ({
      ...n,
      createdAt: new Date(n.createdAt),
      updatedAt: new Date(n.updatedAt),
    })),
  }))
}

function serializeCategories(categories: Category[]): RawCategory[] {
  return categories.map((category) => ({
    ...category,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    notes: category.notes.map((note) => ({
      ...note,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
  }))
}

function loadCategoriesFromLocal(): Category[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as RawCategory[]
    return deserializeCategories(parsed)
  } catch {
    return []
  }
}

function saveCategoriesToLocal(categories: Category[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
}

export async function loadCategories(): Promise<Category[]> {
  const localCategories = loadCategoriesFromLocal()

  if (typeof window === "undefined" || !window.vaultAPI) {
    return localCategories
  }

  try {
    const vaultFolder = await window.vaultAPI.getFolder()
    if (!vaultFolder) {
      return localCategories
    }

    const vaultRaw = (await window.vaultAPI.readCategories()) as RawCategory[]
    const vaultCategories = Array.isArray(vaultRaw)
      ? deserializeCategories(vaultRaw)
      : []

    if (vaultCategories.length === 0 && localCategories.length > 0) {
      await window.vaultAPI.writeCategories(serializeCategories(localCategories))
      return localCategories
    }

    return vaultCategories
  } catch {
    return localCategories
  }
}

export async function saveCategories(categories: Category[]) {
  if (typeof window === "undefined") return

  if (window.vaultAPI) {
    try {
      const vaultFolder = await window.vaultAPI.getFolder()
      if (vaultFolder) {
        await window.vaultAPI.writeCategories(serializeCategories(categories))
        return
      }
    } catch {
      saveCategoriesToLocal(categories)
      return
    }
  }

  saveCategoriesToLocal(categories)
}