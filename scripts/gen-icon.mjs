/**
 * 从 resources/music_cast.svg 生成 resources/icon.ico（多分辨率）
 * 用法：node scripts/gen-icon.mjs
 */
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const svgPath = resolve(root, 'resources/music_cast.svg')
const icoPath = resolve(root, 'resources/icon.ico')

// 读取 SVG 并修改 width/height 属性，让 sharp/librsvg 按正确尺寸渲染
const svgRaw = readFileSync(svgPath, 'utf8')
  .replace(/width="[^"]*"/, 'width="512px"')
  .replace(/height="[^"]*"/, 'height="512px"')
const svgBuf = Buffer.from(svgRaw)

// ICO 需要包含的尺寸（从大到小）
const sizes = [256, 128, 64, 48, 32, 16]

console.log('Generating icon sizes:', sizes.join(', '))

const pngs = await Promise.all(
  sizes.map(size =>
    sharp(svgBuf, { density: 300 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
  )
)

const ico = await pngToIco(pngs)
writeFileSync(icoPath, ico)
console.log(`Written: ${icoPath} (${ico.length} bytes)`)
