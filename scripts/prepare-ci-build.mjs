import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const version = process.env.SI_BUILD_VERSION
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('SI_BUILD_VERSION must be a numeric semantic version, for example 0.1.27.')
  process.exit(1)
}

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'src-tauri', 'tauri.build.conf.json')
fs.writeFileSync(output, `${JSON.stringify({ version }, null, 2)}\n`)
console.log(`Prepared Tauri build version ${version}`)
