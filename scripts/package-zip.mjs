import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import archiver from 'archiver'

const platform = process.argv[2]
if (!['mac', 'windows'].includes(platform)) {
  console.error('Usage: node scripts/package-zip.mjs <mac|windows>')
  process.exit(1)
}
const expectedHost = platform === 'mac' ? 'darwin' : 'win32'
if (process.platform !== expectedHost) {
  console.error(`Build ${platform} ZIP packages on ${expectedHost}.`)
  process.exit(1)
}
if (!['arm64', 'x64'].includes(process.arch)) {
  console.error(`Unsupported architecture: ${process.arch}`)
  process.exit(1)
}

const root = fileURLToPath(new URL('../', import.meta.url))
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = process.env.SI_BUILD_VERSION || packageJson.version
const stamp = process.env.SI_BUILD_STAMP ? `_${process.env.SI_BUILD_STAMP}` : ''
const artifactsDir = path.join(root, 'artifacts')
const releaseDir = path.join(root, 'src-tauri', 'target', 'release')
const source = platform === 'mac'
  ? path.join(releaseDir, 'bundle', 'macos', 'Si Switch.app')
  : path.join(releaseDir, 'si-switch.exe')
const output = path.join(artifactsDir, `Si-Switch_v${version}${stamp}_${platform}_${process.arch}.zip`)

if (!fs.existsSync(source)) {
  console.error(`Build artifact not found: ${source}`)
  console.error(`Run npm run bundle:${platform} first.`)
  process.exit(1)
}

fs.mkdirSync(artifactsDir, { recursive: true })
if (fs.existsSync(output)) fs.rmSync(output)

if (platform === 'mac' && process.platform === 'darwin') {
  const result = spawnSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', source, output], { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
} else {
  const archive = archiver('zip', { zlib: { level: 9 } })
  const stream = fs.createWriteStream(output)
  const done = new Promise((resolve, reject) => {
    stream.on('close', resolve)
    stream.on('error', reject)
    archive.on('error', reject)
    archive.on('warning', reject)
  })
  archive.pipe(stream)
  archive.file(source, { name: path.basename(source) })
  await Promise.all([archive.finalize(), done])
}
console.log(`Created ${path.relative(root, output)}`)
