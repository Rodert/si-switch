import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'

export const callNative = async <T>(command: string, args?: Record<string, unknown>): Promise<T | null> => {
  try {
    return await invoke<T>(command, args)
  } catch {
    // The Vite browser preview intentionally works without the Tauri runtime.
    return null
  }
}

export const openExternal = async (url: string): Promise<void> => {
  try {
    await openUrl(url)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
