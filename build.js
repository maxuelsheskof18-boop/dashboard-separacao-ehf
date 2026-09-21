const fs = require('fs');
const path = require('path');

const root = __dirname;
const site = path.join(root, 'site');
const dist = path.join(root, 'dist');

function copyRecursive(from, to) {
  if (!fs.existsSync(from)) return;

  const stat = fs.statSync(from);

  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });

    for (const entry of fs.readdirSync(from)) {
      copyRecursive(
        path.join(from, entry),
        path.join(to, entry)
      );
    }

    return;
  }

  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/*
 * 1. Limpa o build anterior
 */
fs.rmSync(dist, {
  recursive: true,
  force: true
});

/*
 * 2. Copia o site base
 */
copyRecursive(site, dist);

/*
 * 3. Sobrescreve os módulos usando
 *    a versão atual da raiz do projeto
 */
copyRecursive(
  path.join(root, 'modules'),
  path.join(dist, 'modules')
);

/*
 * 4. Se houver assets atualizados na raiz,
 *    também prevalecem sobre /site
 */
copyRecursive(
  path.join(root, 'assets'),
  path.join(dist, 'assets')
);

/*
 * Validação
 */
const indexPath = path.join(dist, 'index.html');

if (!fs.existsSync(indexPath)) {
  throw new Error('index.html não foi gerado em dist.');
}

console.log('Painel estático gerado em dist.');
console.log('Site base:', site);
console.log('Módulos atualizados:', path.join(root, 'modules'));
console.log('Destino:', dist);