import { existsSync, readFileSync } from 'node:fs';

const DIST = 'dist';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function read(path) {
  if (!existsSync(path)) fail(`fichier absent : ${path}`);
  return readFileSync(path);
}

if (!existsSync(DIST)) fail('dist/ absent : lancez `npm run build` avant `npm run check:pwa`');

const base = process.env.VITE_BASE ?? '/';
const manifest = JSON.parse(read(`${DIST}/manifest.webmanifest`).toString('utf8'));
if (!manifest.name || !manifest.short_name) fail('nom du manifeste absent');
if (manifest.display !== 'standalone') fail(`display inattendu : ${manifest.display}`);
if (manifest.lang !== 'fr') fail(`langue inattendue : ${manifest.lang}`);
if (manifest.start_url !== base) fail(`start_url inattendu : ${manifest.start_url}`);
if (manifest.scope !== base) fail(`scope inattendu : ${manifest.scope}`);
if (!Array.isArray(manifest.icons) || manifest.icons.length < 3) fail('icônes du manifeste absentes');

for (const icon of manifest.icons) {
  const file = `${DIST}/${icon.src.replace(/^\//, '')}`;
  const bytes = read(file);
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) fail(`${file} n'est pas un PNG`);
}
const maskable = manifest.icons.find((icon) => icon.purpose === 'maskable');
if (!maskable) fail('icône maskable absente');

const index = read(`${DIST}/index.html`).toString('utf8');
if (!index.includes('rel="manifest"')) fail('lien vers le manifeste absent de index.html');
if (!index.includes('registerSW.js')) fail('enregistrement du service worker absent');
if (!index.includes('apple-touch-icon')) fail('icône Apple absente de index.html');

const sw = read(`${DIST}/sw.js`).toString('utf8');
if (!sw.includes('precacheAndRoute')) fail('précache Workbox absent de sw.js');
read(`${DIST}/registerSW.js`);

console.log(
  `PWA OK — base ${base}, ${manifest.icons.length} icônes, ${sw.length} octets de service worker, précache présent`,
);
