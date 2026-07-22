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

if (!fs.existsSync(path.join(destination, 'index.html'))) {
  throw new Error('index.html não foi gerado em dist.');
}

console.log('Painel estático gerado em dist.');
