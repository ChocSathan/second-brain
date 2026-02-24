export async function getVaultFolder(): Promise<string | null> {
  if (typeof window === "undefined" || !window.vaultAPI) return null
  return window.vaultAPI.getFolder()
}

export async function setVaultFolder(path: string | null): Promise<string | null> {
  if (typeof window === "undefined" || !window.vaultAPI) return null
  return window.vaultAPI.setFolder(path)
}

export async function selectVaultFolder(): Promise<string | null> {
  if (typeof window === "undefined" || !window.vaultAPI) {
    if (typeof window !== "undefined") {
      console.warn("Vault API is not available. Cannot select vault folder.")      
    }
    return null
  }
  return window.vaultAPI.selectFolder()
}

export async function ensureVaultFolder(): Promise<string | null> {
  const current = await getVaultFolder()
  if (current) return current
  return selectVaultFolder()
}

export async function changeVaultFolder(): Promise<string | null> {
  return selectVaultFolder()
}

