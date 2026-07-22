# EHF v4.2.20 - Visual forçado e sincronizado

Correções:
- Visual do painel de alarmes aplicado por CSS estático e por injeção dinâmica no painel-runtime.js.
- Raiz, site/ e dist/ sincronizados.
- Cache dos módulos atualizado para ?v=4220.
- Embalagem/painel apontando para vesco-tiny-worker quando aplicável.

Após subir no GitHub, faça Redeploy sem cache no Vercel.
Teste: https://dashboard-separacao-ehf.vercel.app/#painel?v=4220
Console: document.documentElement.getAttribute('data-ehf-visual') deve retornar 4.2.20.
