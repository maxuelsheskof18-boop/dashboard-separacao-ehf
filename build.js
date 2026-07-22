const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, 'site');
const destination = path.join(__dirname, 'dist');

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

fs.rmSync(destination, { recursive: true, force: true });
copyRecursive(source, destination);

const indexPath = path.join(destination, 'index.html');
if (!fs.existsSync(indexPath)) {
  throw new Error('index.html não foi gerado em dist. Verifique a pasta site/.');
}

const indexHead = fs.readFileSync(indexPath, 'utf8').slice(0, 100).toLowerCase();
if (!indexHead.includes('<!doctype') && !indexHead.includes('<html')) {
  throw new Error('dist/index.html não parece ser HTML válido. Pode ter sido substituído por imagem/binário.');
}

console.log('Painel estático gerado em dist.');
