const WEB_APP_URL =
  process.env.WEB_APP_URL ||
  process.env.GOOGLE_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwQ8-Rn-zZJQM0fLm9js3ErtJZefRnHP55E3M0r3Z_TIXS_skTioZ6p3yHqTLFYxPU9/exec';

async function fetchText(url, opts = {}) {
  const r = await fetch(url, opts);
  const text = await r.text();

  let json = null;

  try {
    json = JSON.parse(text);
  } catch (e) {
    json = null;
  }

  return {
    ok: r.ok,
    status: r.status,
    text,
    json
  };
}

async function proxyToWebApp(queryStr) {
  let target = WEB_APP_URL;

  if (queryStr) {
    target += (WEB_APP_URL.includes('?') ? '&' : '?') + queryStr.replace(/^\?/, '');
  }

  const resp = await fetchText(target, {
    method: 'GET',
    cache: 'no-store'
  });

  return resp;
}

function normalizeSummaryResponse(original) {
  const mapped = original.mapped || original || {};
  const ts = original.ts || mapped.ts || new Date().toISOString();

  return {
    ok: true,
    ts,
    aguardando: Number(
      mapped.aguardando_total ??
      original.aguardando ??
      0
    ),
    emSeparacao: Number(
      mapped.em_separao_total ??
      mapped.em_separacao_total ??
      original.emSeparacao ??
      0
    ),
    separadas: Number(
      mapped.separadas_total ??
      original.separadas ??
      0
    ),
    embaladas: Number(
      mapped.embaladas_total ??
      original.embaladas ??
      0
    ),
    embaladosNaUltimaHora: Number(
      mapped.embalados_ultima_hora ??
      original.embaladosNaUltimaHora ??
      0
    ),
    overall: {
      totalItens: Number(
        mapped.grand_total ??
        original.total ??
        0
      )
    },
    perStore: original.perStore || original.raw?.perStore || {},
    raw: original
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    const prox = await proxyToWebApp('action=summary');

    if (!prox.json) {
      return res.status(prox.status || 500).json({
        ok: false,
        error: 'Resposta do Apps Script não veio como JSON',
        raw: prox.text
      });
    }

    const normalized = normalizeSummaryResponse(prox.json);

    return res.status(200).json(normalized);

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Erro ao buscar summary',
      detail: String(error && error.message ? error.message : error)
    });
  }
};