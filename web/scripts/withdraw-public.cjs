// Idempotent withdrawal of retired public artifacts. Scientific originals are retained
// byte-for-byte outside public/. Run after data regeneration and before dev/build.
const fs = require('node:fs');
const path = require('node:path');
const WEB = path.resolve(__dirname, '..');
const WITHDRAWN = ['polls_2023', 'polls_2026', 'latest_polls', 'poll_sources', 'campaign'];
function withdrawPublic() {
  const archive = path.join(WEB, 'archive/data');
  fs.mkdirSync(archive, { recursive: true });
  for (const name of WITHDRAWN) {
    const file = path.join(WEB, 'public/data', `${name}.json`);
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(archive, `${name}.json`));
      fs.unlinkSync(file);
    }
  }
  const file = path.join(WEB, 'public/data/simulator.json');
  const sim = JSON.parse(fs.readFileSync(file, 'utf8'));
  if ('baseline_votes' in sim.provinces[0]) {
    fs.copyFileSync(file, path.join(archive, 'simulator.json'));
    const atlas = {
      provinces: sim.provinces.map(p => ({ province_code: p.province_code, province_name: p.province_name, seats: p.seats, seats_2023: p.seats_2023, seats_2026: p.seats_2026 })),
      parties: sim.parties.map(p => ({ party_id: p.party_id, seats_2023_official: p.seats_2023_official, hex_color: p.hex_color })),
    };
    fs.writeFileSync(file, JSON.stringify(atlas));
  }
}
module.exports = { withdrawPublic, WITHDRAWN };
if (require.main === module) withdrawPublic();
