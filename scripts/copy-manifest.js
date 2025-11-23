// Simple script to copy manifest.json and icon128.png to the dist folder
// This runs after vite build to ensure the extension files are in place

import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'

const distDir = join(process.cwd(), 'dist')
const manifestSrc = join(process.cwd(), 'manifest.json')
const manifestDest = join(distDir, 'manifest.json')
const iconSrc = join(process.cwd(), 'icon128.png')
const iconDest = join(distDir, 'icon128.png')

// Copy manifest.json
if (existsSync(manifestSrc)) {
  copyFileSync(manifestSrc, manifestDest)
  console.log('✓ Copied manifest.json to dist/')
} else {
  console.warn('⚠ manifest.json not found')
}

// Copy icon (if it exists)
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, iconDest)
  console.log('✓ Copied icon128.png to dist/')
} else {
  console.warn('⚠ icon128.png not found - you may need to add an icon file')
}

