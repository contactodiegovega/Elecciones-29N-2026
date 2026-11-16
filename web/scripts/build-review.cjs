// Isolated, allowlisted review export. Never edits the scientific archive/public source.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const WEB = path.resolve(__dirname, '..');
const STAGE = path.join(WEB, '.review-build');
const SAFE_DATA = ['meta', 'territories', 'results_national', 'turnout', 'colors', 'taxonomy', 'demography'];
const WITHHELD_ROUTES = ['encuestas', 'campana', 'simulador', 'laboratorio-ml', 'metodologia', 'metodologia/modelos'];
const message = 'Revisión limitada: encuestas, derivados y modelos no se incluyen en esta compilación. Publicación pública pendiente de autorización y evidencias.';

function files(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = prefix + entry.name;
    return entry.isDirectory() ? files(path.join(dir, entry.name), `${name}/`) : [name];
  }).sort();
}

function atlasOnly(sim) {
  return {
    provinces: sim.provinces.map(p => ({
      province_code: p.province_code, province_name: p.province_name,
      seats: p.seats, seats_2023: p.seats_2023, seats_2026: p.seats_2026,
    })),
    parties: sim.parties.map(p => ({
      party_id: p.party_id, seats_2023_official: p.seats_2023_official, hex_color: p.hex_color,
    })),
  };
}

function prepareReview(stage = STAGE) {
  fs.mkdirSync(stage, { recursive: true });
  for (const name of ['app', 'components', 'lib']) {
    fs.cpSync(path.join(WEB, name), path.join(stage, name), {
      recursive: true, filter: file => !file.endsWith('.test.ts'),
    });
  }
  for (const name of ['package.json', 'tsconfig.json', 'postcss.config.mjs', 'tailwind.config.ts', 'eslint.config.mjs']) {
    fs.copyFileSync(path.join(WEB, name), path.join(stage, name));
  }
  fs.writeFileSync(path.join(stage, 'next.config.mjs'),
    'import path from "node:path"; import { fileURLToPath } from "node:url"; export default { output: "export", images: { unoptimized: true }, productionBrowserSourceMaps: false, outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)) };\n');
  const pub = path.join(stage, 'public');
  fs.mkdirSync(path.join(pub, 'data'), { recursive: true });
  const source = path.join(WEB, 'public');
  for (const name of SAFE_DATA) fs.copyFileSync(path.join(source, `data/${name}.json`), path.join(pub, `data/${name}.json`));
  const meta = JSON.parse(fs.readFileSync(path.join(source, 'data/meta.json'), 'utf8'));
  const historical = [
    'provinces/index.json',
    ...Array.from({ length: 52 }, (_, i) => `provinces/${String(i + 1).padStart(2, '0')}.json`),
    ...Array.from({ length: 52 }, (_, i) => `scenario_history/${String(i + 1).padStart(2, '0')}.json`),
    ...meta.elections.map(date => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > '2023-07-23') throw new Error('Elección histórica no clasificada.');
      return `labels_by_election/${date}.json`;
    }),
  ];
  for (const file of historical) {
    fs.mkdirSync(path.dirname(path.join(pub, 'data', file)), { recursive: true });
    fs.copyFileSync(path.join(source, 'data', file), path.join(pub, 'data', file));
  }
  fs.mkdirSync(path.join(pub, 'maps'), { recursive: true });
  fs.copyFileSync(path.join(source, 'maps/spain_provinces.geojson'), path.join(pub, 'maps/spain_provinces.geojson'));
  const atlas = atlasOnly(JSON.parse(fs.readFileSync(path.join(source, 'data/simulator.json'), 'utf8')));
  fs.writeFileSync(path.join(pub, 'data/simulator.json'), JSON.stringify(atlas));
  for (const route of WITHHELD_ROUTES) {
    const dir = path.join(stage, 'app', route);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'page.tsx'), `export default function Withheld() { return <section><h1>Contenido no incluido en la revisión</h1><p>${message}</p></section>; }\n`);
  }
  fs.writeFileSync(path.join(stage, 'app/robots.ts'), 'export const dynamic = "force-static"; export default function robots() { return { rules: { userAgent: "*", disallow: "/" } }; }\n');
  // Visible notice on every page, including historical/legacy routes.
  const layout = path.join(stage, 'app/layout.tsx');
  fs.writeFileSync(layout, fs.readFileSync(layout, 'utf8').replace('{children}', `<aside role="status" className="mb-5 border p-3">${message}</aside>{children}`));
  return files(pub);
}

function auditReview(out, pub) {
  const expected = files(pub);
  const actual = files(out).filter(file => file.startsWith('data/') || file.startsWith('maps/'));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('La exportación contiene recursos no clasificados o incompletos.');
  for (const file of expected) {
    if (!fs.readFileSync(path.join(out, file)).equals(fs.readFileSync(path.join(pub, file)))) {
      throw new Error(`Recurso exportado alterado: ${file}`);
    }
  }
  // Snapshots/source evidence must never be in an emitted HTML, Flight payload or JS chunk.
  const sensitive = JSON.parse(fs.readFileSync(path.join(WEB, 'archive/data/latest_polls.json'), 'utf8'));
  const hashes = sensitive.polls.flatMap(p => [p.source_hash, ...(p.document_evidence || []).map(d => d.sha256)]).filter(Boolean);
  for (const file of files(out)) {
    const content = fs.readFileSync(path.join(out, file)).toString('utf8');
    if (hashes.some(hash => content.includes(hash))) throw new Error(`Evidencia de sondeo filtrada: ${file}`);
    if (file.endsWith('.map')) throw new Error(`Source map no permitido: ${file}`);
  }
  return expected.map(file => ({ path: file, sha256: createHash('sha256').update(fs.readFileSync(path.join(out, file))).digest('hex') }));
}

function main() {
  // Only generated directories; never delete the original public/, app/ or datasets.
  fs.rmSync(STAGE, { recursive: true, force: true });
  for (const dir of ['out', '.next']) fs.rmSync(path.join(WEB, dir), { recursive: true, force: true });
  prepareReview();
  const childEnv = { ...process.env };
  // No dotenv files are copied. This config has no publication bypass: it compiles only the allowlist.
  execFileSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build', STAGE], {
    cwd: STAGE, env: childEnv, stdio: 'inherit',
  });
  const manifest = auditReview(path.join(STAGE, 'out'), path.join(STAGE, 'public'));
  // Next's export-detail.json retains the isolated outDirectory. Put the
  // manifest there too so the Vercel adapter packages the audited manifest.
  fs.writeFileSync(path.join(STAGE, 'out/review-manifest.json'), JSON.stringify({
    mode: 'review', generated_at: new Date().toISOString(), protection_verified: false,
    public_release_authorized: false, withheld_routes: WITHHELD_ROUTES, files: manifest,
  }, null, 2));
  for (const dir of ['out', '.next']) fs.cpSync(path.join(STAGE, dir), path.join(WEB, dir), {
    recursive: true,
    // Webpack cache entries contain paths relative to the isolated build root.
    // They must not be reused when compiling the original application later.
    filter: file => dir !== '.next' || !file.startsWith(path.join(STAGE, '.next/cache')),
  });
  console.log(`[review] ${manifest.length} recursos históricos auditados; sin encuestas ni derivados. Protección Vercel pendiente de verificación externa.`);
}

module.exports = { prepareReview, auditReview, atlasOnly, SAFE_DATA, WITHHELD_ROUTES };
if (require.main === module) main();
