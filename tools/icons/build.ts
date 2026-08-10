/**
 * Génère les icônes PNG de l'application à partir de `public/favicon.svg`.
 *
 *   npm run icons
 *
 * Les fichiers produits sont versionnés : le build de l'APK et le manifeste
 * PWA les consomment tels quels, sans dépendance de génération d'images.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const source = readFileSync(join(root, 'public', 'favicon.svg'))
const outDir = join(root, 'public', 'icons')

/** L'icône masquable garde 20 % de marge : Android en rogne les bords. */
const MASKABLE_PADDING = 0.2

async function render(size: number, name: string, padding = 0) {
  await write(outDir, name, size, padding, '#FFF8EE')
  console.log(`  ✓ icons/${name} (${size}×${size})`)
}

/**
 * Icônes du lanceur Android.
 *
 * Les densités suivent la convention Android (48 dp de base). Le calque avant
 * des icônes adaptatives fait 108 dp, dont seuls les 72 dp centraux sont
 * garantis visibles : d'où la marge appliquée au dessin.
 */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const ADAPTIVE_PADDING = (1 - 72 / 108) / 2

async function renderAndroid() {
  const resDir = join(root, 'android', 'app', 'src', 'main', 'res')
  if (!existsSync(resDir)) {
    console.log('  · projet Android absent, icônes de lanceur ignorées')
    return
  }

  for (const [density, scale] of Object.entries(DENSITIES)) {
    const dir = join(resDir, `mipmap-${density}`)
    mkdirSync(dir, { recursive: true })

    const legacy = Math.round(48 * scale)
    const adaptive = Math.round(108 * scale)

    await write(dir, 'ic_launcher.png', legacy, 0, '#FFF8EE')
    await write(dir, 'ic_launcher_round.png', legacy, 0, '#FFF8EE')
    // Le fond du calque avant reste transparent : Android le compose lui-même.
    await write(dir, 'ic_launcher_foreground.png', adaptive, ADAPTIVE_PADDING, null)
  }

  // Le fond de l'icône adaptative doit s'accorder au thème de l'application.
  writeFileSync(
    join(resDir, 'values', 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFF8EE</color>\n</resources>\n',
    'utf8',
  )

  console.log('  ✓ icônes de lanceur Android (5 densités)')
}

async function write(dir: string, name: string, size: number, padding: number, background: string | null) {
  const inner = Math.round(size * (1 - padding * 2))
  const art = await sharp(source, { density: 384 }).resize(inner, inner).png().toBuffer()
  const offset = Math.round((size - inner) / 2)

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: art, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toFile(join(dir, name))
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  await render(192, 'icon-192.png')
  await render(512, 'icon-512.png')
  await render(512, 'icon-512-maskable.png', MASKABLE_PADDING)
  await renderAndroid()

  writeFileSync(
    join(outDir, 'README.md'),
    'Icônes générées par `npm run icons` à partir de `public/favicon.svg`.\nNe pas éditer à la main.\n',
    'utf8',
  )
}

void main()
