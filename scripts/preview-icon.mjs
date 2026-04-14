import sharp from 'sharp'
import { readFileSync } from 'fs'

const svgRaw = readFileSync('resources/music_cast.svg', 'utf8')
const pathMatch = svgRaw.match(/<path\s+d="([^"]+)"/)
const pathData = pathMatch[1]
const size = 256
const pad = Math.round(size * 0.15)
const iconSize = size - pad * 2
const radius = Math.round(size * 0.22)
const scale = iconSize / 960
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#1C1B1F"/>
  <g transform="translate(${pad}, ${pad + iconSize}) scale(${scale}, ${scale})">
    <path d="${pathData}" fill="#E8DEF8"/>
  </g>
</svg>`)
await sharp(svg, { density: 300 }).resize(256, 256).png().toFile('resources/icon-preview.png')
console.log('done')
