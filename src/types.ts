export type ToolId = 'codex' | 'claude-code'

export type ViewId = ToolId | 'providers' | 'import' | 'guide' | 'settings'

export type Configuration = {
  id: string
  tool: ToolId
  name: string
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  updatedAt: string
  status: 'ready' | 'untested'
  source?: 'sample' | 'local'
}

export type Provider = {
  id: string
  name: string
  protocol: 'openai-compatible' | 'anthropic-compatible'
  baseUrl: string
  modelsSupported: boolean
  balanceSupported: boolean
}

export type UpdateCheckResult = {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string
  updateType: 'optional' | 'forced'
  downloadUrl: string
  releaseUrl: string
  publishedAt: string | null
  releaseNotes: string
  message: string
}
