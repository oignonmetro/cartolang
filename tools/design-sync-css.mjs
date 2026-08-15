#!/usr/bin/env node
/**
 * Recopie la feuille de style compilée sous un nom stable, pour le sync
 * Claude Design.
 *
 * Le convertisseur a besoin du CSS *compilé* : `src/styles.css` est du
 * Tailwind v4 source (`@import 'tailwindcss'`), qu'il ne sait pas résoudre —
 * pointer dessus rendait tous les composants sans style. Mais Vite écrit ce
 * CSS sous un nom haché (`index-<hash>.css`) qui change à chaque build dès
 * qu'une source bouge, si bien que `cfg.cssEntry` pointait dans le vide au
 * build suivant. Plutôt que de rééditer le hash à la main à chaque re-sync,
 * on dépose ici une copie au nom fixe.
 *
 * Usage : node tools/design-sync-css.mjs   (après `npm run build`)
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ASSETS = 'dist/assets'
const OUT_DIR = '.design-sync/.cache'
const OUT = join(OUT_DIR, 'app.css')

let files
try {
  files = readdirSync(ASSETS)
} catch {
  console.error(`${ASSETS} introuvable — lancez \`npm run build\` d'abord.`)
  process.exit(1)
}

// Une seule feuille attendue ; s'il y en avait plusieurs, la plus grosse est
// forcément celle de l'app plutôt qu'un fragment.
const sheets = files.filter((name) => name.startsWith('index-') && name.endsWith('.css'))
if (sheets.length === 0) {
  console.error(`aucune feuille index-*.css dans ${ASSETS} — le build a-t-il abouti ?`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })
copyFileSync(join(ASSETS, sheets[0]), OUT)
console.error(`${sheets[0]} → ${OUT}`)
