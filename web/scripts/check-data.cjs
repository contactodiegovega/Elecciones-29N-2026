// Validate committed artifacts without Python, downloads, or dataset mutation.
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const PUBLIC = path.join(ROOT, 'web/public');
const REQUIRED = [
  'meta', 'territories', 'results_national', 'turnout', 'colors', 'taxonomy',
  'demography', 'ml', 'model_registry', 'oos_map', 'simulator',
  'publication_status', 'ml_gate',
];

function readJSON(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Artefacto ausente o JSON inválido: ${file}. Regenera los datos antes de compilar. ${error.message}`);
  }
}

function phaseAt(calendar, today) {
  if (today < calendar.campaign_start) return 'pre_campaign';
  if (today >= calendar.moratorium_start && today <= calendar.moratorium_end) return 'moratorium';
  if (today <= calendar.campaign_end) return 'campaign';
  if (today === calendar.election_date) return 'election_day';
  return 'post_election';
}

function validatePublication({ policy, calendar, status, today, release }) {
  const phase = phaseAt(calendar, today);
  const visible = !['moratorium', 'election_day'].includes(phase);
  if (release) {
    const missing = ['public_release_authorized', 'cache_withdrawal_verified', 'legacy_urls_withdrawal_verified']
      .filter(key => policy[key] !== true);
    if (missing.length || !visible) {
      throw new Error(`PUBLICACIÓN BLOQUEADA: ${missing.join(', ') || 'restricción editorial vigente'}`);
    }
  }
  if (status.phase !== phase || status.polls_visible !== visible ||
      status.poll_derived_visible !== visible || status.simulator_poll_baseline_visible !== visible ||
      status.restricted !== (phase === 'moratorium') || status.today_madrid > today ||
      status.restriction_start !== calendar.moratorium_start ||
      status.restriction_end !== calendar.moratorium_end ||
      status.campaign_start !== calendar.campaign_start || status.campaign_end !== calendar.campaign_end ||
      status.election_date !== calendar.election_date) {
    throw new Error('Reloj editorial desactualizado o incoherente. Ejecuta npm run prepare:data y versiona los JSON antes de compilar.');
  }
}

function checkData(publicDir = PUBLIC) {
  const data = path.join(publicDir, 'data');
  for (const name of REQUIRED) readJSON(path.join(data, `${name}.json`));
  for (const name of require('./withdraw-public.cjs').WITHDRAWN) {
    if (require('node:fs').existsSync(path.join(data, `${name}.json`))) throw new Error(`Recurso retirado expuesto: ${name}`);
  }
  const meta = readJSON(path.join(data, 'meta.json'));
  if (!Array.isArray(meta.elections) || !meta.elections.length) throw new Error('Falta el catálogo de elecciones.');
  for (const election of meta.elections) readJSON(path.join(data, 'labels_by_election', `${election}.json`));
  const provinces = readJSON(path.join(data, 'provinces/index.json'));
  const codes = Array.from({ length: 52 }, (_, i) => String(i + 1).padStart(2, '0'));
  if (provinces.length !== 52 || new Set(provinces.map(p => p.code)).size !== 52 ||
      codes.some(code => !provinces.some(p => p.code === code))) throw new Error('El índice debe contener las 52 provincias.');
  let seats2023 = 0, seats2026 = 0;
  for (const code of codes) {
    const province = readJSON(path.join(data, 'provinces', `${code}.json`));
    if (province.code !== code) throw new Error(`Código provincial incoherente: ${code}`);
    seats2023 += province.seats2023;
    seats2026 += province.seats2026;
  }
  if (seats2023 !== 350 || seats2026 !== 350) throw new Error('El reparto provincial debe sumar 350 escaños.');
  const geo = readJSON(path.join(publicDir, 'maps/spain_provinces.geojson'));
  if (geo.type !== 'FeatureCollection' || geo.features.length !== 52) throw new Error('El mapa debe contener 52 geometrías.');
  // Validate every JSON too, including artifacts added after this script.
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.json')) readJSON(file);
    }
  }
  walk(data);
}

function main() {
  checkData();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  validatePublication({
    policy: readJSON(path.join(ROOT, 'config/publication_policy.json')),
    calendar: readJSON(path.join(ROOT, 'config/campaign.json')),
    status: readJSON(path.join(PUBLIC, 'data/publication_status.json')),
    today,
    release: Boolean(process.argv.includes('--release') || process.env.VERCEL || process.env.NETLIFY || process.env.PUBLIC_RELEASE),
  });
  console.log('[web] Datos públicos, 52 fichas y mapa validados; build sin Python.');
}

module.exports = { checkData, phaseAt, validatePublication };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
