import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const platform = process.argv[2]
if (!['macos', 'windows', 'linux'].includes(platform)) {
  console.error('Usage: node scripts/collect-release-assets.mjs <macos|windows|linux>')
  process.exit(1)
}

const version = process.env.SI_BUILD_VERSION
const stamp = process.env.SI_BUILD_STAMP
if (!version || !stamp || !/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-CST$/.test(stamp)) {
  console.error('SI_BUILD_VERSION and SI_BUILD_STAMP (YYYY-MM-DD_HH-MM-CST) are required.')
  process.exit(1)
}

const root = fileURLToPath(new URL('../', import.meta.url))
const bundleDir = path.join(root, 'src-tauri', 'target', 'release', 'bundle')
const artifactsDir = path.join(root, 'artifacts')
const outputDir = path.join(root, 'release-assets')
const architecture = process.arch === 'arm64' ? 'arm64' : 'x64'

const findOne = (directory, extension) => {
  if (!fs.existsSync(directory)) return null
  const file = fs.readdirSync(directory).find((name) => name.toLowerCase().endsWith(extension.toLowerCase()))
  return file ? path.join(directory, file) : null
}

const zip = (name, arch) => {
  const file = path.join(artifactsDir, `Si-Switch_v${version}_${stamp}_${name}_${arch}.zip`)
  return fs.existsSync(file) ? file : null
}
const definitions = {
  macos: [
    { source: () => findOne(path.join(bundleDir, 'dmg'), '.dmg'), suffix: `macOS_${architecture}.dmg` },
    { source: () => zip('mac', architecture), suffix: `macOS_${architecture}.zip` },
  ],
  windows: [
    { source: () => findOne(path.join(bundleDir, 'msi'), '.msi'), suffix: 'Windows_x64.msi' },
    { source: () => zip('windows', 'x64'), suffix: 'Windows_x64_portable.zip' },
  ],
  linux: [
    { source: () => findOne(path.join(bundleDir, 'appimage'), '.appimage'), suffix: 'Linux_x64.AppImage' },
    { source: () => findOne(path.join(bundleDir, 'deb'), '.deb'), suffix: 'Linux_x64.deb' },
    { source: () => findOne(path.join(bundleDir, 'rpm'), '.rpm'), suffix: 'Linux_x64.rpm' },
  ],
}

fs.mkdirSync(outputDir, { recursive: true })
for (const definition of definitions[platform]) {
  const source = definition.source()
  if (!source) {
    console.error(`Missing ${definition.suffix} build output.`)
    process.exit(1)
  }
  const name = `Si-Switch_v${version}_${stamp}_${definition.suffix}`
  fs.copyFileSync(source, path.join(outputDir, name))
  console.log(`Collected release-assets/${name}`)
}
