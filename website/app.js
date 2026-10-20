const repository = document.body.dataset.repository
const releasesUrl = `https://github.com/${repository}/releases`

const platforms = {
  macos: {
    name: 'macOS',
    description: '支持 Apple Silicon 与 Intel Mac',
    options: [
      { name: 'DMG · Apple Silicon', detail: 'M1、M2、M3、M4 及更新芯片', match: (file) => file.endsWith('.dmg') && hasAny(file, 'aarch64', 'arm64') },
      { name: 'ZIP · Apple Silicon', detail: '免安装，解压后运行', match: (file) => /macos_arm64\.zip$/i.test(file) },
      { name: 'DMG · Intel', detail: '适用于 Intel 处理器 Mac', match: (file) => file.endsWith('.dmg') && hasAny(file, 'x64', 'x86_64') },
      { name: 'ZIP · Intel', detail: '免安装，解压后运行', match: (file) => /macos_x64\.zip$/i.test(file) },
    ],
  },
  windows: {
    name: 'Windows',
    description: '适用于 Windows 10 与 Windows 11 x64',
    options: [
      { name: 'MSI 安装版', detail: '适合大多数 Windows 用户', match: (file) => file.endsWith('.msi') },
      { name: 'ZIP 便携版', detail: '解压后运行，不经过安装器', match: (file) => /windows_x64_portable\.zip$/i.test(file) },
    ],
  },
  linux: {
    name: 'Linux',
    description: '当前发布版本面向 x86_64 桌面系统',
    options: [
      { name: 'AppImage', detail: '通用便携包', match: (file) => file.endsWith('.appimage') },
      { name: 'DEB', detail: 'Debian、Ubuntu 及衍生发行版', match: (file) => file.endsWith('.deb') },
      { name: 'RPM', detail: 'Fedora、RHEL、openSUSE 等发行版', match: (file) => file.endsWith('.rpm') },
    ],
  },
}

let activePlatform = detectPlatform()
let dialogPlatform = activePlatform
let release = null

function hasAny(value, ...parts) {
  return parts.some((part) => value.includes(part))
}

function detectPlatform() {
  const value = `${navigator.userAgentData?.platform || ''} ${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase()
  if (hasAny(value, 'mac', 'iphone', 'ipad')) return 'macos'
  if (hasAny(value, 'win')) return 'windows'
  if (hasAny(value, 'linux', 'x11', 'cros')) return 'linux'
  return 'windows'
}

function formatBytes(bytes) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / (1024 ** index)
  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`
}

function resolveOption(option) {
  const asset = release?.assets?.find((item) => option.match(item.name.toLowerCase()))
  return {
    ...option,
    url: asset?.browser_download_url || release?.html_url || releasesUrl,
    size: asset ? formatBytes(asset.size) : '',
    direct: Boolean(asset),
  }
}

function downloadRows(platformKey, compact = false) {
  return platforms[platformKey].options.map(resolveOption).map((option) => `
    <li class="download-row">
      <span class="download-name">${option.name}</span>
      <span class="download-detail">${option.detail}${option.size ? ` · ${option.size}` : ''}</span>
      <a class="download-link${option.direct ? '' : ' is-fallback'}" href="${option.url}"${option.direct ? ' download' : ''}>
        ${option.direct ? '下载' : compact ? '查看' : '查看发布'}
      </a>
    </li>
  `).join('')
}

function renderPlatform(platformKey) {
  activePlatform = platformKey
  document.querySelectorAll('.platform-tabs [role="tab"]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.platform === platformKey))
  })
  const platform = platforms[platformKey]
  document.querySelector('#platform-panel').innerHTML = `
    <div class="platform-summary">
      <div class="platform-meta"><h3>${platform.name}</h3><p>${platform.description}</p></div>
      <ul class="download-list">${downloadRows(platformKey)}</ul>
    </div>
  `
}

function renderDialog(platformKey) {
  dialogPlatform = platformKey
  document.querySelectorAll('.dialog-tabs [role="tab"]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.platform === platformKey))
  })
  const platform = platforms[platformKey]
  const intro = platformKey === 'macos'
    ? '浏览器无法可靠识别 Mac 芯片，请在 Apple 菜单的“关于本机”中确认后选择。'
    : `已为你显示 ${platform.name} 的可用下载格式。`
  document.querySelector('#dialog-options').innerHTML = `
    <p class="dialog-options-intro">${intro}</p>
    <ul class="dialog-options-list">${downloadRows(platformKey, true)}</ul>
  `
}

function openDialog() {
  renderDialog(activePlatform)
  const dialog = document.querySelector('#download-dialog')
  if (!dialog.open) dialog.showModal()
}

function setup() {
  document.querySelector('#system-hint').textContent = `已识别为 ${platforms[activePlatform].name}，你仍可以选择其他平台`
  document.querySelector('#dialog-detected').textContent = `已识别为 ${platforms[activePlatform].name}`
  document.querySelector('#smart-download').textContent = `下载 ${platforms[activePlatform].name} 版本`

  const dialogTabs = document.querySelector('.dialog-tabs')
  dialogTabs.innerHTML = Object.entries(platforms).map(([key, item]) => `
    <button type="button" role="tab" data-platform="${key}" aria-selected="false">${item.name}</button>
  `).join('')

  document.querySelectorAll('[role="tab"]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.platform
      if (button.closest('.dialog-tabs')) renderDialog(key)
      else {
        renderPlatform(key)
        sessionStorage.setItem('si-switch-download-choice', 'true')
      }
    })
  })
  document.querySelector('#smart-download').addEventListener('click', openDialog)
  document.querySelector('#close-dialog').addEventListener('click', () => document.querySelector('#download-dialog').close())
  document.querySelector('#download-dialog').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close()
  })
  renderPlatform(activePlatform)

  if (!sessionStorage.getItem('si-switch-download-choice')) {
    window.setTimeout(openDialog, 450)
  }
  document.querySelector('#download-dialog').addEventListener('click', (event) => {
    if (event.target.closest('.download-link')) sessionStorage.setItem('si-switch-download-choice', 'true')
  })
}

async function loadRelease() {
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=20`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`)
    const releases = await response.json()
    release = releases.find((item) => item.assets?.length)
    if (!release) throw new Error('No release with downloadable assets')
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(release.published_at))
    const value = (type) => parts.find((part) => part.type === type)?.value
    const date = `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')} CST`
    const automaticVersion = release.name?.match(/v\d+\.\d+\.\d+/)?.[0] || release.tag_name
    document.querySelector('#release-line').textContent = `最新构建 ${automaticVersion} · ${date}`
  } catch {
    document.querySelector('#release-line').textContent = '从 GitHub Releases 获取最新版本'
  }
  renderPlatform(activePlatform)
  if (document.querySelector('#download-dialog').open) renderDialog(dialogPlatform)
}

setup()
loadRelease()
