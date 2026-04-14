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

// 图标设计：深色圆角矩形背景（MD3 #1C1B1F）+ 白色图标居中
// 背景圆角 = 尺寸的 22%，符合 Material You 图标规范
function buildIconSvg(size) {
  const pad = Math.round(size * 0.15)          // 图标距边缘留白 15%
  const iconSize = size - pad * 2
  const radius = Math.round(size * 0.22)

  // 读取原始路径数据（只取 <path d="..."> 部分）
  const svgRaw = readFileSync(svgPath, 'utf8')
  const pathMatch = svgRaw.match(/<path\s+d="([^"]+)"/)
  if (!pathMatch) throw new Error('Cannot find <path> in SVG')
  const pathData = pathMatch[1]

  // 原始 viewBox 是 0 -960 960 960，需要将路径缩放到 iconSize×iconSize
  // 通过 transform 实现：translate 到 pad,pad，scale 到 iconSize/960
  const scale = iconSize / 960

  // viewBox 是 "0 -960 960 960"，路径 y 坐标范围 [-960, 0]
  // 映射到画布：canvas_y = pad + iconSize + y * scale（无需翻转）
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#1C1B1F"/>
  <g transform="translate(${pad}, ${pad + iconSize}) scale(${scale}, ${scale})">
    <path d="${pathData}" fill="#E8DEF8"/>
  </g>
</svg>`
}

// ICO 需要包含的尺寸（从大到小）
const sizes = [256, 128, 64, 48, 32, 16]

console.log('Generating icon sizes:', sizes.join(', '))

const pngs = await Promise.all(
  sizes.map(size => {
    const svg = Buffer.from(buildIconSvg(size))
    return sharp(svg, { density: 300 })
      .resize(size, size)
      .png()
      .toBuffer()
  })
)

const ico = await pngToIco(pngs)
writeFileSync(icoPath, ico)
console.log(`Written: ${icoPath} (${ico.length} bytes)`)
