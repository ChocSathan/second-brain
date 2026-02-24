export {}

declare global {
  interface AppAPI {
    selectFolder(): Promise<string | null>
  }

  interface VaultAPI {
    getFolder(): Promise<string | null>
    setFolder(path: string | null): Promise<string | null>
    selectFolder(): Promise<string | null>
    readCategories(): Promise<unknown[]>
    writeCategories(categories: unknown[]): Promise<boolean>
  }

  interface Window {
    api?: AppAPI
    vaultAPI?: VaultAPI
  }
}

