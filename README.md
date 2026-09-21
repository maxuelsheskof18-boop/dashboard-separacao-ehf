# Painel de Separação EHF

Painel operacional publicado em https://dashboard-mtk-ehf.vercel.app

## Qual arquivo eu edito?

**`site/index.html`.** É ele que vira a página publicada.

O `dist/` é gerado, não se edita e não vai para o git. Não existe `index.html` na raiz
de propósito: já existiu um, desatualizado, e ele fez mais de uma pessoa editar o arquivo
errado achando que estava mexendo no painel.

```
site/          -> base do site publicado (index.html, admin.html, atrasados.html, ...)
site/modules/  -> cópia dos módulos usada como base
modules/       -> módulos atuais; o build sobrescreve site/modules/ com estes
assets/        -> imagens e ícones; o build sobrescreve site/assets/ com estes
api/           -> funções serverless do Vercel (proxies para o Apps Script)
dist/          -> GERADO pelo build. Não editar, não commitar.
```

## Build e publicação

```bash
npm run build
```

`build.js` copia `site/` para `dist/` e por cima aplica `modules/` e `assets/` da raiz.
O Vercel roda esse mesmo comando: veja `buildCommand` e `outputDirectory` em `vercel.json`.

Depois do build, confira que todo `<script src="modules/...">` do `dist/index.html` tem
arquivo correspondente em `dist/modules/`. Um módulo faltando não quebra o build — só
some da tela, silenciosamente.

## De onde vêm os dados

São três backends diferentes, e confundi-los custa tempo:

| O que | De onde | Observação |
|---|---|---|
| Cards, canais, resumo por loja | tiny-worker no EasyPanel: `/api/summary` e `/api/formasEnvio` | É o que `EHF_SUMMARY_API_BASE` aponta |
| Romaneios e bipagem | Apps Script via JSONP: `action=romaneios`, `action=romaneioItens` | Abas `Bipagem_Romaneios` e `Bipagem_Scans` |
| `api/summary.js`, `api/formasEnvio.js` | Proxies para o Apps Script | O front **não** usa; existem para consumo externo |

### fallbackFrom não é erro

O tiny-worker marca `fallbackFrom: APP_STATE_SUMMARY_PLANILHA_LATEST` em **toda**
consolidação de snapshot, inclusive quando o payload está perfeito. Tratar essa marca
como sinal de dado ruim descarta dado bom — foi exatamente o que derrubou as formas de
envio. O critério correto é olhar o conteúdo: só descarta se vier sem contagem nenhuma.

### Datas do Apps Script vêm no fuso da operação

O painel filtra dia operacional com regex em cima da string de data. Se o Apps Script
devolver ISO/UTC, toda bipagem feita depois das 21h BRT cai no dia seguinte e some da
tela. Por isso os leitores usam
`Utilities.formatDate(valor, getTinyTimezone_(), 'yyyy-MM-dd HH:mm:ss')`.

## Apps Script

O código da planilha vive fora deste repositório. Ao mudá-lo, **republique o Web App como
nova versão** — sem isso a URL `/exec` continua servindo o código antigo.

Ações aceitas no `doGet`: `summary`, `formasEnvio`, `separacoesIndex`, `buscarSeparacao`,
`romaneios`, `romaneioItens`, `debug`.
