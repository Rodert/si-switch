import type { Configuration, ToolId } from '../types'

const CONFIG_KEY = 'si-switch:configurations'
const ACTIVE_KEY = 'si-switch:active'

export const loadConfigurations = (seed: Configuration[]): Configuration[] => {
  try {
    const saved = localStorage.getItem(CONFIG_KEY)
    return saved ? (JSON.parse(saved) as Configuration[]) : seed
  } catch {
    return seed
  }
}

export const saveConfigurations = (configurations: Configuration[]) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(configurations))
}

export const loadActiveIds = (seed: Record<ToolId, string>): Record<ToolId, string> => {
  try {
    const saved = localStorage.getItem(ACTIVE_KEY)
    return saved ? { ...seed, ...(JSON.parse(saved) as Record<ToolId, string>) } : seed
  } catch {
    return seed
  }
}

export const saveActiveIds = (activeIds: Record<ToolId, string>) => {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeIds))
}
