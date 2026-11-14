const { execFileSync } = require('node:child_process');
const path = require('node:path');
execFileSync(process.env.PYTHON || 'python', ['-m', 'src.electoral.web_publication', ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, '../..'), stdio: 'inherit',
});
