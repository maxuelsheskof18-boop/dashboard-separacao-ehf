# Dashboard Separação EHF v4.2.14

Projeto limpo para GitHub + Vercel.

## Importante

Antes de subir esta versão, apague os arquivos antigos do repositório, principalmente arquivos como:

- README-HOTFIX-*.md
- README-HOTFIX-* (com nomes duplicados)
- dist antigo, se preferir deixar o Vercel gerar novamente
- arquivos PNG enviados acidentalmente como index.html

## Vercel

Configuração correta:

- Framework: Other
- Build Command: npm run build
- Output Directory: dist
- Install Command: npm install
- Root Directory: ./

O build copia `site/` para `dist/`.

## GitHub Pages

Este pacote inclui `.nojekyll` na raiz para impedir o GitHub Pages de tentar processar arquivos com Jekyll.
