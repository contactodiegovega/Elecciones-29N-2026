// Read-only deployment verification. The caller supplies a short-lived/private
// automation bypass in the process environment; it is never logged or embedded.
const { createHash } = require('node:crypto');

async function verify(host = process.argv[2]) {
  if (!/^[a-z0-9-]+\.vercel\.app$/.test(host || '')) throw new Error('Indica el hostname del despliegue Vercel.');
  const secret = process.env.REVIEW_PROTECTION_BYPASS;
  if (!secret) throw new Error('Falta REVIEW_PROTECTION_BYPASS para verificar el contenido autorizado.');
  const base = `https://${host}`;
  const authorized = file => fetch(base + file, { redirect: 'manual', headers: { 'x-vercel-protection-bypass': secret } });
  for (const file of ['/', '/encuestas', '/data/latest_polls.json', '/data/provinces/24.json', '/ultimo-escano?province=24']) {
    const response = await fetch(base + file, { redirect: 'manual' });
    const login = response.status >= 300 && response.status < 400 && (response.headers.get('location') || '').startsWith('https://vercel.com/');
    if (![401, 403].includes(response.status) && !login) throw new Error(`Acceso anónimo no protegido: ${file} (${response.status})`);
  }
  const response = await authorized('/review-manifest.json');
  if (!response.ok) throw new Error(`Manifiesto remoto ausente: ${response.status}`);
  const manifest = await response.json();
  if (manifest.mode !== 'review' || manifest.public_release_authorized !== false || manifest.files.length !== 78) throw new Error('Manifiesto de revisión inesperado.');
  for (let start = 0; start < manifest.files.length; start += 8) {
    await Promise.all(manifest.files.slice(start, start + 8).map(async file => {
      const r = await authorized(`/${file.path}`);
      if (!r.ok) throw new Error(`Recurso histórico ausente: ${file.path} (${r.status})`);
      const bytes = Buffer.from(await r.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Hash remoto incorrecto: ${file.path}`);
      if (!(r.headers.get('cache-control') || '').includes('no-store')) throw new Error(`Recurso cacheable: ${file.path}`);
    }));
  }
  for (const name of ['polls_2023', 'polls_2026', 'latest_polls', 'campaign', 'poll_sources', 'publication_status', 'ml', 'ml_gate', 'model_registry', 'oos_map']) {
    const r = await authorized(`/data/${name}.json`);
    if (r.status !== 404) throw new Error(`JSON excluido accesible: ${name} (${r.status})`);
  }
  for (const route of manifest.withheld_routes) {
    const r = await authorized(`/${route}`);
    if (!r.ok || !(await r.text()).includes('Contenido no incluido en la revisión')) throw new Error(`Ruta sin protección de contenido: ${route}`);
  }
  const home = await authorized('/');
  const html = await home.text();
  if (!(home.headers.get('x-robots-tag') || '').includes('noindex')) throw new Error('Falta noindex.');
  const js = html.match(/src="([^\"]+\.js[^\"]*)"/);
  if (!js) throw new Error('No se encontró un chunk JS.');
  const anonymousJS = await fetch(base + js[1], { redirect: 'manual' });
  if (anonymousJS.status === 200) throw new Error('Chunk JS accesible anónimamente.');
  console.log(JSON.stringify({ host, mode: manifest.mode, historicalResourcesVerified: manifest.files.length,
    excludedJSONs404: 10, withheldRoutesVerified: manifest.withheld_routes.length,
    anonymousAccessProtected: true, noStoreVerified: true, noIndexVerified: true }));
}

if (require.main === module) verify().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { verify };
