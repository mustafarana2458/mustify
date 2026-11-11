// Generates the PWA / favicon icons from the logo mark.  Run:  npm run icons
// Installed icons can't follow the in-app accent setting, so they use the default accent.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { markSvg } from '../src/brand/mark.ts';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const icons: { file: string; size: number; svg: string }[] = [
  // "any" purpose: rounded tile with transparent corners.
  { file: 'icon-192.png', size: 192, svg: markSvg({ size: 192 }) },
  { file: 'icon-512.png', size: 512, svg: markSvg({ size: 512 }) },
  // Maskable: full-bleed background. At scale 1 the outermost point (stroke caps at the M's
  // bottom corners) is ~198px from the centre, inside the 205px (80%) safe-zone circle.
  { file: 'maskable-512.png', size: 512, svg: markSvg({ size: 512, shape: 'square' }) },
  // iOS home screen: full-bleed square (iOS applies its own rounded mask).
  { file: 'apple-touch-icon.png', size: 180, svg: markSvg({ size: 180, shape: 'square' }) },
];

for (const { file, size, svg } of icons) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(join(out, file));
  console.log(`wrote public/icons/${file} (${size}×${size})`);
}
writeFileSync(join(out, 'favicon.svg'), markSvg());
console.log('wrote public/icons/favicon.svg');
