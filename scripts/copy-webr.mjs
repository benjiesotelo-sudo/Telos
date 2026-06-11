import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
const src = 'node_modules/webr/dist', dest = 'public/webr'
if (!existsSync(src)) { console.error('webr dist not found'); process.exit(1) }
mkdirSync(dest, { recursive: true }); cpSync(src, dest, { recursive: true })
copyFileSync('node_modules/webr/LICENSE.md', `${dest}/LICENSE.md`)

// Decompress the lazy VFS images: served as-is, *.data.gz gets double-gunzipped
// (server Content-Encoding + the worker's own gunzip) and aborts in the browser.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith('.js.metadata') ? [join(dir, d.name)] : [])
let n = 0
for (const metaPath of walk(`${dest}/vfs`)) {
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  if (!meta.gzip) continue
  const base = metaPath.replace(/\.js\.metadata$/, '')
  const data = gunzipSync(readFileSync(`${base}.data.gz`))
  writeFileSync(`${base}.data`, data); unlinkSync(`${base}.data.gz`)
  writeFileSync(metaPath, JSON.stringify({ ...meta, gzip: false, remote_package_size: data.length }))
  n++
}
console.log(`Copied WebR runtime to public/webr/ (decompressed ${n} VFS images)`)
