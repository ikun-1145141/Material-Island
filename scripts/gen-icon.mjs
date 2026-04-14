/**
 * 从 resources/music_cast.svg 生成 resources/icon.ico（多分辨率，BMP-in-ICO 格式）
 * NSIS / electron-builder 要求 ICO 内部使用传统 BMP 编码，不能是 PNG-in-ICO。
 * 用法：node scripts/gen-icon.mjs
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const svgPath = resolve(root, 'resources/music_cast.svg')
const icoPath = resolve(root, 'resources/icon.ico')

// 图标设计：MD3 深色圆角背景 (#1C1B1F) + 浅紫图标 (#E8DEF8)
function buildIconSvg(size) {
  const pad      = Math.round(size * 0.15)
  const iconSize = size - pad * 2
  const radius   = Math.round(size * 0.22)
  const scale    = iconSize / 960

  const svgRaw   = readFileSync(svgPath, 'utf8')
  const pathMatch = svgRaw.match(/<path\s+d="([^"]+)"/)
  if (!pathMatch) throw new Error('Cannot find <path> in SVG')
  const pathData = pathMatch[1]

  // viewBox "0 -960 960 960"：路径 y 范围 [-960, 0]
  // translate(pad, pad+iconSize) + scale(s, s) → canvas_y = pad + iconSize + y*s
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#1C1B1F"/>
  <g transform="translate(${pad},${pad + iconSize}) scale(${scale},${scale})">
    <path d="${pathData}" fill="#E8DEF8"/>
  </g>
</svg>`
}

/**
 * 将 RGBA Buffer 打包为 ICO 内部的 BMP 条目（BITMAPINFOHEADER + BGRA 像素 + AND 掩码）
 * NSIS / Win32 图标资源只识别这种格式，不接受 PNG-in-ICO。
 */
function makeBmpEntry(size, rgbaData) {
  // BITMAPINFOHEADER（40 字节）
  const bih = Buffer.alloc(40)
  bih.writeUInt32LE(40,           0)   // biSize
  bih.writeInt32LE (size,         4)   // biWidth
  bih.writeInt32LE (size * 2,     8)   // biHeight（ICO 约定加倍）
  bih.writeUInt16LE(1,           12)   // biPlanes
  bih.writeUInt16LE(32,          14)   // biBitCount
  bih.writeUInt32LE(0,           16)   // biCompression = BI_RGB
  bih.writeUInt32LE(size*size*4, 20)   // biSizeImage
  // 其余字段全 0

  // 像素数据：BMP 是 bottom-up，颜色顺序 BGRA
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = ((size - 1 - y) * size + x) * 4  // 上下翻转
      pixels[dst + 0] = rgbaData[src + 2]  // B
      pixels[dst + 1] = rgbaData[src + 1]  // G
      pixels[dst + 2] = rgbaData[src + 0]  // R
      pixels[dst + 3] = rgbaData[src + 3]  // A
    }
  }

  // AND 掩码：每行对齐到 4 字节，全 0 = 完全不透明（透明由 alpha 通道控制）
  const maskRowBytes = Math.ceil(size / 32) * 4
  const mask = Buffer.alloc(maskRowBytes * size, 0)

  return Buffer.concat([bih, pixels, mask])
}

/**
 * 将多个 BMP 条目打包成标准 ICO 文件
 */
function packIco(entries, sizes) {
  const count      = entries.length
  const dirOffset  = 6 + 16 * count  // ICO 文件头 + 目录项

  let dataOffset = dirOffset
  const dirBufs = entries.map((entry, i) => {
    const size = sizes[i]
    const dir  = Buffer.alloc(16)
    dir.writeUInt8(size >= 256 ? 0 : size, 0)  // width  (0 = 256)
    dir.writeUInt8(size >= 256 ? 0 : size, 1)  // height (0 = 256)
    dir.writeUInt8(0,   2)   // colorCount (0 = 32-bit)
    dir.writeUInt8(0,   3)   // reserved
    dir.writeUInt16LE(1,  4) // planes
    dir.writeUInt16LE(32, 6) // bitCount
    dir.writeUInt32LE(entry.length, 8)
    dir.writeUInt32LE(dataOffset,  12)
    dataOffset += entry.length
    return dir
  })

  const fileHeader = Buffer.alloc(6)
  fileHeader.writeUInt16LE(0,     0)  // reserved
  fileHeader.writeUInt16LE(1,     2)  // type = ICO
  fileHeader.writeUInt16LE(count, 4)

  return Buffer.concat([fileHeader, ...dirBufs, ...entries])
}

// ── 主流程 ─────────────────────────────────────────────────
const sizes = [256, 128, 64, 48, 32, 16]
console.log('Generating icon sizes:', sizes.join(', '))

const entries = await Promise.all(
  sizes.map(async size => {
    const svgBuf = Buffer.from(buildIconSvg(size))
    const { data } = await sharp(svgBuf, { density: 300 })
      .resize(size, size)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    return makeBmpEntry(size, data)
  })
)

const ico = packIco(entries, sizes)
writeFileSync(icoPath, ico)
console.log(`Written: ${icoPath} (${ico.length} bytes)`)
