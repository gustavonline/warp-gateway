import { execSync } from 'node:child_process';

const forbidden = [
  /^(package\/)?config\/config\.json$/,
  /^(package\/)?\.run\//,
  /^(package\/)?run\//,
  /^(package\/)?logs\//,
  /^(package\/)?tools\//,
  /ngrok(\.exe|\.zip)?$/i,
  /\.env$/,
  /\.local$/,
  /node_modules\//
];

const output = execSync('npm pack --dry-run --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const packs = JSON.parse(output);
const files = packs[0].files.map((f) => f.path);
const bad = files.filter((file) => forbidden.some((re) => re.test(file)));

if (bad.length) {
  console.error('Forbidden files would be published to npm:');
  for (const file of bad) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`npm pack safety check passed (${files.length} files).`);
