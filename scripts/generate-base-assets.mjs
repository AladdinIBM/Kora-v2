import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'assets', 'bip-6')

const originalIcons = {
  'blank.png':
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"></svg>',
  'back-left.png':
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="m25 8-12 12 12 12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'back-right.png':
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="m15 8 12 12-12 12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'chevron-right.png':
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="m12 7 9 9-9 9" fill="none" stroke="#8E8E93" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'chevron-left.png':
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="m20 7-9 9 9 9" fill="none" stroke="#8E8E93" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'chevron-white-right.png':
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="m12 7 9 9-9 9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'chevron-white-left.png':
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="m20 7-9 9 9 9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'check.png':
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="m6 17 6 6L27 8" fill="none" stroke="#34C759" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'add.png':
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="16" fill="#3B82F6"/><path d="M20 12v16m-8-8h16" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>',
  'trash.png':
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M12 13h16l-1 21H13Zm-3 0h22M16 9h8" fill="none" stroke="#FF453A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
}

const clubHomeIcons = {
  'refresh.png': { source: 'refresh.svg', width: 25, height: 25 },
  'settings.png': { source: 'settings.svg', width: 25, height: 25 },
  'chevron-down.png': { source: 'chevron-down.svg', width: 14, height: 14 },
  'calendar-match.png': {
    source: 'calendar-match.svg',
    width: 49,
    height: 49,
  },
  'connection-off.png': {
    source: 'connection-off.svg',
    width: 49,
    height: 49,
  },
  'team-placeholder.png': {
    source: 'team-placeholder.svg',
    width: 82,
    height: 82,
  },
}

function previewSvg(language) {
  const arabic = language === 'ar-EG'
  const title = arabic ? 'نبض النادي' : 'ClubPulse'
  const subtitle = arabic ? 'المباراة القادمة' : 'NEXT MATCH'
  const time = arabic ? '٢١:٠٠' : '21:00'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="266" height="307">
    <rect width="266" height="307" rx="46" fill="#000"/>
    <path d="M24 55h218" stroke="#3B82F6" stroke-width="3"/>
    <circle cx="42" cy="31" r="17" fill="#141414" stroke="#3B82F6" stroke-width="3"/>
    <path d="M31 31h8l3-6 5 12 4-8 4 5h7" fill="none" stroke="#FF3B30" stroke-width="3"/>
    <text x="${arabic ? 232 : 68}" y="38" text-anchor="${arabic ? 'end' : 'start'}" fill="#fff" font-size="20" font-family="sans-serif">${title}</text>
    <rect x="20" y="75" width="226" height="166" rx="20" fill="#141414" stroke="#3B82F6" stroke-width="2"/>
    <text x="133" y="103" text-anchor="middle" fill="#8E8E93" font-size="12" font-family="sans-serif">${subtitle}</text>
    <circle cx="70" cy="148" r="27" fill="#222" stroke="#8E8E93" stroke-width="2"/>
    <circle cx="196" cy="148" r="27" fill="#222" stroke="#8E8E93" stroke-width="2"/>
    <text x="133" y="160" text-anchor="middle" fill="#fff" font-size="34" font-family="sans-serif">${time}</text>
    <text x="70" y="198" text-anchor="middle" fill="#fff" font-size="13" font-family="sans-serif">HOME</text>
    <text x="196" y="198" text-anchor="middle" fill="#fff" font-size="13" font-family="sans-serif">AWAY</text>
    <text x="133" y="223" text-anchor="middle" fill="#8E8E93" font-size="12" font-family="sans-serif">SUN • 23 AUG</text>
    <text x="133" y="277" text-anchor="middle" fill="#8E8E93" font-size="12" font-family="sans-serif">ESPN • CACHED</text>
  </svg>`
}

await mkdir(output, { recursive: true })

const appIcon = await readFile(path.join(root, 'assets-src', 'clubpulse-logo.png'))
await sharp(appIcon)
  .resize(124, 124)
  .png({ compressionLevel: 9 })
  .toFile(path.join(output, 'icon.png'))

const neutralCrest = await readFile(
  path.join(root, 'assets-src', 'neutral-crest.svg'),
)
await sharp(neutralCrest)
  .resize(72, 72)
  .png({ compressionLevel: 9 })
  .toFile(path.join(output, 'neutral-crest.png'))

for (const [filename, svg] of Object.entries(originalIcons)) {
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(path.join(output, filename))
}

for (const [filename, icon] of Object.entries(clubHomeIcons)) {
  const source = await readFile(
    path.join(root, 'assets-src', 'club-home-icons', icon.source),
  )
  await sharp(source)
    .resize(icon.width, icon.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toFile(path.join(output, filename))
}

const leagueSources = {
  'premier-league.png': 'premier-league-reference.png',
  'la-liga.png': 'la-liga-reference.png',
  'la-liga-symbol.png': 'la-liga-symbol-reference.png',
}

for (const [filename, sourceName] of Object.entries(leagueSources)) {
  const source = await readFile(path.join(root, 'assets-src', sourceName))
  await sharp(source)
    .resize(72, 72, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(path.join(output, filename))
}

for (const language of ['en-US', 'ar-EG']) {
  await sharp(Buffer.from(previewSvg(language)))
    .png({ compressionLevel: 9 })
    .toFile(path.join(output, `widget-preview_${language}.png`))
}
await writeFile(
  path.join(output, 'widget-preview.png'),
  await readFile(path.join(output, 'widget-preview_en-US.png')),
)

console.log(`Generated base assets in ${path.relative(root, output)}`)
