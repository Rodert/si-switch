import type { Configuration, Provider } from './types'

export const sampleConfigurations: Configuration[] = [
  {
    id: 'codex-openai-sample',
    tool: 'codex',
    name: '示例 · OpenAI 个人密钥',
    provider: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-••••••••••••••••••••',
    model: 'gpt-5-codex',
    updatedAt: '刚刚',
    status: 'ready',
    source: 'sample',
  },
  {
    id: 'codex-router-sample',
    tool: 'codex',
    name: '示例 · OpenRouter 备用',
    provider: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-or-••••••••••••••••',
    model: 'openai/gpt-4.1-mini',
    updatedAt: '昨天 18:42',
    status: 'untested',
    source: 'sample',
  },
  {
    id: 'claude-anthropic-sample',
    tool: 'claude-code',
    name: '示例 · Anthropic 工作区',
    provider: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKey: 'sk-ant-••••••••••••••••',
    model: 'claude-sonnet-4-5',
    updatedAt: '刚刚',
    status: 'ready',
    source: 'sample',
  },
  {
    id: 'claude-router-sample',
    tool: 'claude-code',
    name: '示例 · 自定义代理',
    provider: '自定义服务商',
    baseUrl: 'https://your-endpoint.example/v1',
    apiKey: '••••••••••••••••',
    model: 'claude-3-7-sonnet',
    updatedAt: '3 天前',
    status: 'untested',
    source: 'sample',
  },
]

export const providers: Provider[] = [
  { id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', modelsSupported: true, balanceSupported: true },
  { id: 'openrouter', name: 'OpenRouter', protocol: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', modelsSupported: true, balanceSupported: true },
  { id: 'anthropic', name: 'Anthropic', protocol: 'anthropic-compatible', baseUrl: 'https://api.anthropic.com', modelsSupported: true, balanceSupported: true },
  { id: 'custom', name: '自定义服务商', protocol: 'openai-compatible', baseUrl: '', modelsSupported: false, balanceSupported: false },
]
