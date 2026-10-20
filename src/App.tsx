import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowDownUp,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCog,
  FolderOpen,
  KeyRound,
  Layers3,
  LayoutGrid,
  Minus,
  MoreHorizontal,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TerminalSquare,
  Trash2,
  Upload,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { providers, sampleConfigurations } from './data'
import { callNative, openExternal } from './lib/tauri'
import { loadActiveIds, loadConfigurations, saveActiveIds, saveConfigurations } from './lib/storage'
import type { Configuration, ToolId, UpdateCheckResult, ViewId } from './types'

const toolMeta: Record<ToolId, { label: string; short: string; description: string }> = {
  codex: { label: 'Codex', short: 'CX', description: 'OpenAI 编程代理的 API 配置' },
  'claude-code': { label: 'Claude Code', short: 'CC', description: 'Anthropic 编程代理的 API 配置' },
}

const navItems: Array<{ id: ViewId; label: string; icon: typeof TerminalSquare }> = [
  { id: 'codex', label: 'Codex', icon: TerminalSquare },
  { id: 'claude-code', label: 'Claude Code', icon: Layers3 },
  { id: 'providers', label: '服务商管理', icon: Server },
  { id: 'import', label: '配置导入', icon: Upload },
  { id: 'guide', label: '使用说明', icon: BookOpen },
  { id: 'settings', label: '设置', icon: Settings2 },
]

const initialActive = { codex: 'codex-openai-sample', 'claude-code': 'claude-anthropic-sample' }
const buildVersion = import.meta.env.VITE_BUILD_VERSION || '0.1.0'
const buildTimestamp = import.meta.env.VITE_BUILD_STAMP
  ? import.meta.env.VITE_BUILD_STAMP.replace(/_(\d{2})-(\d{2})-CST$/, ' $1:$2 CST')
  : '本地预览'

function App() {
  const [view, setView] = useState<ViewId>('codex')
  const [configurations, setConfigurations] = useState<Configuration[]>(() => loadConfigurations(sampleConfigurations))
  const [activeIds, setActiveIds] = useState<Record<ToolId, string>>(() => loadActiveIds(initialActive))
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'updated' | 'name'>('updated')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [toast, setToast] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'current' | 'available' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)

  const notify = (message: string) => setToast(message)

  const checkForUpdates = async (manual: boolean) => {
    setUpdateStatus('checking')
    const result = await callNative<UpdateCheckResult>('check_for_updates')
    if (!result) {
      setUpdateStatus('error')
      if (manual) notify('暂时无法检查更新，请稍后重试')
      return
    }
    setUpdateInfo(result)
    if (result.updateAvailable) {
      setUpdateStatus('available')
      setUpdateDialogOpen(true)
    } else {
      setUpdateStatus('current')
      if (manual) notify('当前已经是最新版本')
    }
  }

  useEffect(() => saveConfigurations(configurations), [configurations])
  useEffect(() => saveActiveIds(activeIds), [activeIds])
  useEffect(() => { void checkForUpdates(false) }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const currentTool = view === 'codex' || view === 'claude-code' ? view : null
  const visibleConfigurations = useMemo(() => {
    if (!currentTool) return []
    return configurations
      .filter((config) => config.tool === currentTool)
      .filter((config) => `${config.name} ${config.provider} ${config.model}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : a.updatedAt.localeCompare(b.updatedAt))
  }, [configurations, currentTool, query, sort])

  const selected = editingId ? configurations.find((config) => config.id === editingId) : undefined

  const createConfiguration = () => {
    setEditingId(null)
    setEditorOpen(true)
  }

  const editConfiguration = (config: Configuration) => {
    setEditingId(config.id)
    setEditorOpen(true)
  }

  const saveConfiguration = async (draft: Omit<Configuration, 'id' | 'updatedAt' | 'status'> & { id?: string }) => {
    const id = draft.id ?? `${draft.tool}-${crypto.randomUUID()}`
    const next: Configuration = { ...draft, id, updatedAt: '刚刚', status: 'untested', source: 'local' }
    setConfigurations((items) => draft.id ? items.map((item) => item.id === draft.id ? next : item) : [next, ...items])
    setEditorOpen(false)
    setEditingId(null)
    notify(draft.id ? '配置已保存' : '配置已添加')
    setActiveIds((items) => ({ ...items, [draft.tool]: id }))
    await callNative('save_configuration', { configuration: next })
  }

  const setActive = async (config: Configuration) => {
    setActiveIds((items) => ({ ...items, [config.tool]: config.id }))
    notify(`${toolMeta[config.tool].label} 已切换为「${config.name.replace('示例 · ', '')}」`)
    await callNative('set_active_configuration', { tool: config.tool, configurationId: config.id })
  }

  const duplicateConfiguration = (config: Configuration) => {
    const copy: Configuration = { ...config, id: `${config.tool}-${crypto.randomUUID()}`, name: `${config.name} · 副本`, source: 'local', updatedAt: '刚刚' }
    setConfigurations((items) => [copy, ...items])
    notify('已创建配置副本')
  }

  const deleteConfiguration = (config: Configuration) => {
    if (activeIds[config.tool] === config.id) {
      notify('当前启用配置不能直接删除，请先切换到其他配置')
      return
    }
    setConfigurations((items) => items.filter((item) => item.id !== config.id))
    notify('配置已删除')
  }

  return (
    <div className={`app-shell ${theme}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Zap size={15} strokeWidth={2.5} /></div>
          <div>
            <div className="brand-name">Si Switch</div>
            <div className="brand-meta">LOCAL CONFIG HUB</div>
          </div>
        </div>

        <div className="sidebar-section-label">工具</div>
        <nav className="nav-list">
          {navItems.slice(0, 2).map((item) => <NavItem key={item.id} item={item} active={view === item.id} onClick={() => { setView(item.id); setQuery('') }} />)}
        </nav>

        <div className="sidebar-section-label section-gap">工作区</div>
        <nav className="nav-list">
          {navItems.slice(2, 4).map((item) => <NavItem key={item.id} item={item} active={view === item.id} onClick={() => { setView(item.id); setEditorOpen(false) }} />)}
        </nav>

        <div className="sidebar-section-label section-gap">系统</div>
        <nav className="nav-list">
          {navItems.slice(4).map((item) => <NavItem key={item.id} item={item} active={view === item.id} onClick={() => { setView(item.id); setEditorOpen(false) }} />)}
        </nav>

        <div className="sidebar-bottom">
          <div className="proxy-card">
            <div className="proxy-card-heading"><span className="status-dot green" />本地代理</div>
            <div className="proxy-card-row"><span>运行状态</span><strong>未启动</strong></div>
            <button className="proxy-toggle" onClick={() => notify('代理服务将在后续版本接入')}><Activity size={13} />启动代理</button>
          </div>
          <div className="sidebar-footer"><ShieldCheck size={13} /> 配置只保存在本机</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>工作区</span><Minus size={12} /><strong>{currentTool ? toolMeta[currentTool].label : navItems.find((item) => item.id === view)?.label}</strong></div>
          <div className="topbar-actions">
            <button
              className={`update-check ${updateStatus === 'available' ? 'available' : ''}`}
              disabled={updateStatus === 'checking'}
              title="检查是否有新的 Si Switch 版本"
              onClick={() => updateInfo?.updateAvailable ? setUpdateDialogOpen(true) : void checkForUpdates(true)}
            >
              {updateStatus === 'available' ? <Download size={14} /> : <RefreshCw className={updateStatus === 'checking' ? 'spinning' : ''} size={14} />}
              {updateStatus === 'checking' ? '检查中' : updateStatus === 'available' ? `下载 v${updateInfo?.latestVersion}` : updateStatus === 'current' ? '已是最新' : '检查更新'}
            </button>
            <button className={`guide-entry ${view === 'guide' ? 'active' : ''}`} onClick={() => { setView('guide'); setEditorOpen(false) }}><BookOpen size={14} />使用说明</button>
            <button className="icon-button" title="切换主题" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
            <div className="version-chip" title={`构建版本 ${buildVersion}，构建时间 ${buildTimestamp}`}>v{buildVersion} · {buildTimestamp}</div>
          </div>
        </header>

        {currentTool ? (
          <ToolWorkspace
            tool={currentTool}
            configurations={visibleConfigurations}
            allConfigurations={configurations}
            activeId={activeIds[currentTool]}
            query={query}
            sort={sort}
            onQueryChange={setQuery}
            onSortChange={() => setSort((value) => value === 'updated' ? 'name' : 'updated')}
            onCreate={createConfiguration}
            onEdit={editConfiguration}
            onSetActive={setActive}
            onDuplicate={duplicateConfiguration}
            onDelete={deleteConfiguration}
            onRefresh={() => notify('已检查本地配置状态')}
          />
        ) : view === 'providers' ? <ProvidersView onNotify={notify} />
          : view === 'import' ? <ImportView onNotify={notify} />
            : view === 'guide' ? <GuideView />
              : <SettingsView theme={theme} onThemeChange={setTheme} onNotify={notify} />}
      </main>

      {editorOpen && <ConfigEditor tool={currentTool ?? selected?.tool ?? 'codex'} initial={selected} onClose={() => { setEditorOpen(false); setEditingId(null) }} onSave={saveConfiguration} />}
      {updateInfo?.updateAvailable && updateDialogOpen && (
        <UpdateDialog
          info={updateInfo}
          onClose={updateInfo.updateType === 'forced' ? undefined : () => setUpdateDialogOpen(false)}
          onDownload={() => void openExternal(updateInfo.downloadUrl)}
        />
      )}
      {toast && <div className="toast"><Check size={14} />{toast}</div>}
    </div>
  )
}

function UpdateDialog({ info, onClose, onDownload }: { info: UpdateCheckResult; onClose?: () => void; onDownload: () => void }) {
  const forced = info.updateType === 'forced'
  const releaseDate = info.publishedAt ? formatUpdateDate(info.publishedAt) : null
  const dialogRef = useRef<HTMLElement>(null)
  const downloadRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    downloadRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  return <div className="update-backdrop" role="presentation">
    <section ref={dialogRef} className={`update-dialog ${forced ? 'forced' : ''}`} role="dialog" aria-modal="true" aria-labelledby="update-title">
      <div className="update-dialog-header">
        <div className="update-icon">{forced ? <ShieldAlert size={21} /> : <Download size={21} />}</div>
        <div>
          <span>{forced ? '必须更新' : '发现新版本'}</span>
          <h2 id="update-title">Si Switch v{info.latestVersion}</h2>
        </div>
        {onClose && <button className="icon-button" title="稍后更新" onClick={onClose}><X size={17} /></button>}
      </div>
      <div className="update-dialog-body">
        <p>{info.message}</p>
        <div className="update-version-grid">
          <div><span>当前版本</span><strong>v{info.currentVersion}</strong></div>
          <div><span>最新版本</span><strong>v{info.latestVersion}</strong></div>
          {releaseDate && <div><span>发布时间</span><strong>{releaseDate}</strong></div>}
        </div>
        {forced && <div className="force-notice"><ShieldAlert size={15} /><span>此版本被列入强制更新范围，升级前无法关闭该提示。</span></div>}
      </div>
      <div className="update-dialog-footer">
        {onClose && <button className="secondary-button" onClick={onClose}>稍后更新</button>}
        <button ref={downloadRef} className="primary-button" onClick={onDownload}><Download size={15} />前往下载</button>
      </div>
    </section>
  </div>
}

function formatUpdateDate(value: string) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')} CST`
}

function NavItem({ item, active, onClick }: { item: { id: ViewId; label: string; icon: typeof TerminalSquare }; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon size={16} /><span>{item.label}</span>{active && <span className="nav-active-line" />}</button>
}

function ToolWorkspace({ tool, configurations, allConfigurations, activeId, query, sort, onQueryChange, onSortChange, onCreate, onEdit, onSetActive, onDuplicate, onDelete, onRefresh }: {
  tool: ToolId
  configurations: Configuration[]
  allConfigurations: Configuration[]
  activeId: string
  query: string
  sort: 'updated' | 'name'
  onQueryChange: (value: string) => void
  onSortChange: () => void
  onCreate: () => void
  onEdit: (config: Configuration) => void
  onSetActive: (config: Configuration) => void
  onDuplicate: (config: Configuration) => void
  onDelete: (config: Configuration) => void
  onRefresh: () => void
}) {
  const meta = toolMeta[tool]
  const active = allConfigurations.find((config) => config.id === activeId)
  const count = allConfigurations.filter((config) => config.tool === tool).length
  return <div className="workspace">
    <section className="page-heading">
      <div>
        <div className="eyebrow"><span className="status-dot green" />配置管理 / {meta.label}</div>
        <h1>{meta.label}<span className="heading-slash">/</span>配置</h1>
        <p>{meta.description}。所有变更默认只保存在本机。</p>
      </div>
      <button className="primary-button" onClick={onCreate}><Plus size={16} />新增配置</button>
    </section>

    <section className="current-config">
      <div className="current-label"><span className="active-pulse" />当前启用</div>
      <div className="current-main">
        <div className="current-avatar">{meta.short}</div>
        <div className="current-details"><strong>{active?.name ?? '尚未选择配置'}</strong><span>{active?.provider ?? '—'} <i>·</i> {active?.model ?? '—'}</span></div>
        <div className="current-endpoint"><span>API BASE URL</span><code>{active?.baseUrl ?? '—'}</code></div>
        <div className="current-status"><span className="status-dot green" />已连接</div>
        <button className="ghost-button" onClick={() => active && onEdit(active)}><FileCog size={14} />编辑</button>
      </div>
    </section>

    <section className="list-section">
      <div className="list-toolbar">
        <div className="list-title"><h2>全部配置</h2><span className="count-badge">{count}</span></div>
        <div className="list-actions">
          <label className="search-box"><Search size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索名称、服务商或模型" /></label>
          <button className="toolbar-button" onClick={onSortChange}><ArrowDownUp size={14} />{sort === 'updated' ? '最近更新' : '名称排序'}</button>
          <button className="toolbar-icon" onClick={onRefresh} title="刷新"><RefreshCw size={15} /></button>
        </div>
      </div>
      <div className="table-head"><span>配置名称</span><span>服务商 / 模型</span><span>接口地址</span><span>状态</span><span /></div>
      <div className="config-list">
        {configurations.map((config) => <ConfigRow key={config.id} config={config} active={activeId === config.id} onEdit={onEdit} onSetActive={onSetActive} onDuplicate={onDuplicate} onDelete={onDelete} />)}
        {configurations.length === 0 && <div className="empty-state"><Search size={20} /><strong>没有匹配的配置</strong><span>尝试更换关键词，或新增一条配置。</span></div>}
      </div>
      <div className="list-footer"><span><Database size={13} />本地数据库</span><span>已加载 {count} 条配置 · 支持无限扩展</span></div>
    </section>
  </div>
}

function ConfigRow({ config, active, onEdit, onSetActive, onDuplicate, onDelete }: { config: Configuration; active: boolean; onEdit: (config: Configuration) => void; onSetActive: (config: Configuration) => void; onDuplicate: (config: Configuration) => void; onDelete: (config: Configuration) => void }) {
  return <div className={`config-row ${active ? 'active' : ''}`}>
    <div className="config-name-cell"><div className={`config-avatar ${config.tool}`}>{config.tool === 'codex' ? 'CX' : 'CC'}</div><div><strong>{config.name}</strong><span>{config.source === 'sample' ? '演示数据' : '本地保存'} · 更新于 {config.updatedAt}</span></div></div>
    <div className="provider-cell"><strong>{config.provider}</strong><span>{config.model}</span></div>
    <code className="endpoint-cell">{config.baseUrl.replace(/^https?:\/\//, '')}</code>
    <div className="row-status"><span className={`status-dot ${config.status === 'ready' ? 'green' : 'amber'}`} />{config.status === 'ready' ? '可用' : '待测试'}</div>
    <div className="row-actions">
      {active ? <span className="active-badge"><Check size={12} />当前</span> : <button className="switch-button" onClick={() => onSetActive(config)}>切换</button>}
      <button className="row-menu" title="编辑配置" onClick={() => onEdit(config)}><FileCog size={14} /></button>
      <button className="row-menu" title="复制配置" onClick={() => onDuplicate(config)}><Copy size={14} /></button>
      <button className="row-menu danger" title="删除配置" onClick={() => onDelete(config)}><Trash2 size={14} /></button>
    </div>
  </div>
}

function ConfigEditor({ tool, initial, onClose, onSave }: { tool: ToolId; initial?: Configuration; onClose: () => void; onSave: (draft: Omit<Configuration, 'id' | 'updatedAt' | 'status'> & { id?: string }) => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [provider, setProvider] = useState(initial?.provider ?? (tool === 'codex' ? 'OpenAI' : 'Anthropic'))
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '')
  const [model, setModel] = useState(initial?.model ?? '')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const changeProvider = (value: string) => {
    setProvider(value)
    const preset = providers.find((item) => item.name === value)
    if (preset?.baseUrl) setBaseUrl(preset.baseUrl)
  }
  const testConnection = async () => {
    setTesting(true)
    const nativeResult = await callNative<{ ok: boolean }>('test_connection', { baseUrl, apiKey, tool })
    setTesting(false)
    setResult(nativeResult?.ok ? '连接成功' : '浏览器预览模式：已准备测试请求')
  }
  const canSave = name.trim() && provider.trim() && baseUrl.trim() && apiKey.trim() && model.trim()
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="editor-panel">
      <div className="editor-header"><div><div className="eyebrow">{initial ? '编辑配置' : '新增配置'}</div><h2>{toolMeta[tool].label} / 连接详情</h2></div><button className="icon-button" onClick={onClose}><X size={17} /></button></div>
      <div className="editor-scroll">
        <div className="field-group"><label>配置名称</label><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：团队 API" /><small>给这条配置起一个容易识别的名字。</small></div>
        <div className="field-group"><label>API 服务商</label><div className="select-wrap"><select value={provider} onChange={(event) => changeProvider(event.target.value)}>{providers.map((item) => <option key={item.id}>{item.name}</option>)}</select><ChevronDown size={15} /></div></div>
        <div className="field-group"><label>API Base URL</label><div className="input-with-icon"><GlobeIcon /><input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></div><small>支持 OpenAI 兼容接口或 Claude Code 接口。</small></div>
        <div className="field-group"><label>API Key</label><div className="input-with-icon"><KeyRound /><input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="粘贴 API Key" /><button onClick={() => setShowKey((value) => !value)}>{showKey ? <EyeOff size={15} /> : <Eye size={15} />}</button></div><small>保存后优先交给系统凭据存储。</small></div>
        <div className="field-group"><div className="label-row"><label>默认模型</label><button className="inline-action" onClick={() => setResult('请先测试接口，再获取模型列表')}><RefreshCw size={12} />获取模型</button></div><div className="input-with-icon"><LayoutGrid /><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="例如：gpt-5-codex" /></div><small>服务商未提供模型列表时，可以手动填写模型 ID。</small></div>
        <div className="connection-test"><div><div className="connection-title"><Wifi size={15} />连接测试</div><span>{result ?? '验证 API 地址、Key 和模型是否可用。'}</span></div><button className="secondary-button" onClick={testConnection} disabled={testing || !baseUrl || !apiKey}>{testing ? '测试中…' : '测试连接'}</button></div>
      </div>
      <div className="editor-footer"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={!canSave} onClick={() => onSave({ id: initial?.id, tool, name, provider, baseUrl, apiKey, model })}><Check size={15} />保存并应用</button></div>
    </aside>
  </div>
}

function ProvidersView({ onNotify }: { onNotify: (message: string) => void }) {
  return <div className="workspace"><section className="page-heading"><div><div className="eyebrow"><span className="status-dot green" />工作区 / 服务商</div><h1>服务商管理</h1><p>集中维护 API 协议与默认地址，配置实例可以自由复用。</p></div><button className="primary-button" onClick={() => onNotify('自定义服务商编辑器将在下一步接入')}><Plus size={16} />新增服务商</button></section><section className="provider-grid">{providers.map((provider) => <div className="provider-card" key={provider.id}><div className="provider-card-top"><div className="provider-icon"><Server size={17} /></div><button className="row-menu" onClick={() => onNotify(`${provider.name} 的编辑入口已预留`)}><MoreHorizontal size={16} /></button></div><h3>{provider.name}</h3><code>{provider.baseUrl || '未设置默认地址'}</code><div className="provider-meta"><span>{provider.protocol === 'openai-compatible' ? 'OpenAI 兼容' : 'Anthropic 协议'}</span><span>{provider.modelsSupported ? '模型列表' : '手动模型'}</span></div></div>)}</section></div>
}

function ImportView({ onNotify }: { onNotify: (message: string) => void }) {
  return <div className="workspace"><section className="page-heading"><div><div className="eyebrow"><span className="status-dot amber" />工作区 / 导入</div><h1>配置导入</h1><p>从本机已有工具或 CC Switch 选择性导入，导入前会展示预览。</p></div></section><div className="import-layout"><div className="import-dropzone"><div className="drop-icon"><FolderOpen size={22} /></div><h2>选择配置来源</h2><p>支持读取本机 Codex、Claude Code 配置文件<br />以及 CC Switch 导出文件。</p><button className="primary-button" onClick={() => onNotify('文件选择器将在 Tauri 运行时打开')}><ClipboardPaste size={15} />选择文件</button></div><div className="import-notes"><div className="note-heading"><ShieldCheck size={16} />导入规则</div><div className="note-row"><Check size={14} />可以只导入 Codex 或 Claude Code</div><div className="note-row"><Check size={14} />导入前预览并处理重复配置</div><div className="note-row"><Check size={14} />不会覆盖未选择的工具配置</div></div></div></div>
}

function GuideView() {
  const steps = [
    { title: '选择目标工具', body: '从左侧进入 Codex 或 Claude Code。两种工具的配置独立保存，切换其中一个不会影响另一个。' },
    { title: '添加 API 配置', body: '点击“新增配置”，填写配置名称、服务商、API Base URL、API Key 和默认模型。保存前可以测试连接。' },
    { title: '切换当前配置', body: '在配置列表中找到需要使用的配置并点击“切换”。当前启用的配置会在页面顶部单独标明。' },
    { title: '检查应用更新', body: '点击顶部“检查更新”。发现新版本后可进入下载页选择系统对应的安装包；必须更新的版本会显示不可跳过的提示。' },
  ]

  return <div className="workspace guide-view">
    <section className="page-heading">
      <div>
        <div className="eyebrow"><span className="status-dot green" />系统 / 文档</div>
        <h1>使用说明</h1>
        <p>了解 Si Switch 的用途，并完成第一条 API 配置。</p>
      </div>
      <div className="guide-build"><span>当前构建</span><strong>v{buildVersion}</strong><small>{buildTimestamp}</small></div>
    </section>

    <section className="guide-intro">
      <div className="guide-intro-mark"><BookOpen size={22} /></div>
      <div><h2>关于 Si Switch</h2><p>Si Switch 是本地优先的 AI 编程工具 API 配置管理器，用于集中管理 Codex 和 Claude Code 的服务商、接口地址、API Key 与模型，并快速切换当前配置。应用无需注册账号，支持 macOS、Windows 和 Linux。</p></div>
    </section>

    <section className="guide-section" aria-labelledby="quick-start-title">
      <div className="guide-section-heading"><span>01</span><div><h2 id="quick-start-title">开始使用</h2><p>按顺序完成以下步骤。</p></div></div>
      <div className="guide-steps">
        {steps.map((step, index) => <div className="guide-step" key={step.title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></div>)}
      </div>
    </section>

    <section className="guide-section" aria-labelledby="feature-title">
      <div className="guide-section-heading"><span>02</span><div><h2 id="feature-title">功能位置</h2><p>常用入口都位于主界面。</p></div></div>
      <div className="guide-reference">
        <div><strong>Codex / Claude Code</strong><span>新增、搜索、复制、编辑、删除和切换配置。</span></div>
        <div><strong>服务商管理</strong><span>维护 API 协议、默认接口地址和模型能力。</span></div>
        <div><strong>配置导入</strong><span>从本机工具或 CC Switch 文件选择性导入配置。</span></div>
        <div><strong>设置</strong><span>切换主题、管理配置备份和目标工具路径。</span></div>
      </div>
    </section>

    <section className="guide-note"><ShieldCheck size={17} /><div><strong>本地优先</strong><p>用户配置默认保存在本机。API Key 不应出现在日志、截图或公开的问题反馈中。</p></div></section>
  </div>
}

function SettingsView({ theme, onThemeChange, onNotify }: { theme: 'dark' | 'light'; onThemeChange: (theme: 'dark' | 'light') => void; onNotify: (message: string) => void }) {
  return <div className="workspace"><section className="page-heading"><div><div className="eyebrow"><span className="status-dot green" />系统 / 设置</div><h1>设置</h1><p>控制外观、数据位置和目标工具的配置路径。</p></div></section><div className="settings-list"><div className="setting-row"><div><strong>主题</strong><span>在深色与浅色工作台之间切换。</span></div><div className="segmented"><button className={theme === 'dark' ? 'selected' : ''} onClick={() => onThemeChange('dark')}><Moon size={14} />深色</button><button className={theme === 'light' ? 'selected' : ''} onClick={() => onThemeChange('light')}><Sun size={14} />浅色</button></div></div><div className="setting-row"><div><strong>配置备份</strong><span>切换前自动保留上一份目标工具配置。</span></div><button className="secondary-button" onClick={() => onNotify('备份功能已预留')}><Copy size={14} />立即备份</button></div><div className="setting-row"><div><strong>目标工具路径</strong><span>自动识别，也可以在此处手动指定。</span></div><button className="secondary-button" onClick={() => onNotify('路径选择器将在 Tauri 运行时打开')}><FolderOpen size={14} />选择路径</button></div></div></div>
}

function GlobeIcon() { return <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3Z" /></svg> }

export default App
