# Dashboard Separação EHF — v4.2.16

Projeto real sincronizado para GitHub + Vercel.

## Vercel
- Framework: Other
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: `./`

O build copia `site/` para `dist/`.

## Importante
As atualizações reais estão duplicadas em:
- `index.html` e `site/index.html`
- `modules/` e `site/modules/`

A versão v4.2.16 força cache busting dos módulos com `?v=4216`.
