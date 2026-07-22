// app.js — frontend do Dashboard de Separação
// Usa proxy local (Node) em http://127.0.0.1:3001/api/summary por padrão.
// Mantém JSONP como fallback para o Web App do Apps Script.

const PROXY_URL = 'http://127.0.0.1:3001/api/summary'; // <- ajuste se seu proxy estiver em outra porta
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzvgtteSSSEsJrR5WoYX6tymQYhuVKmWCkYTYVYWsaKzal9NuzJJZZSZoEbu_CFSVSm/exec';

// JSONP helper (retained as fallback)
function jsonpFetch(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const cbName = 'jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const script = document.createElement('script');
    let timer;

    window[cbName] = function(data) {
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    function cleanup() {
      try { delete window[cbName]; } catch (e) {}
      try { script.remove(); } catch (e) {}
    }

    script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + cbName;
    script.onerror = function() {
      clearTimeout(timer);
      cleanup();
      reject(new Error('JSONP script error'));
    };

    document.body.appendChild(script);

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, timeout);
  });
}

/* fetchSummary por conta — usa PROXY se disponível, senão JSONP direto ao Web App */
async function fetchSummary(account) {
  // Tenta proxy primeiro (mais seguro e contorna CSP/JSONP)
  if (typeof PROXY_URL === 'string' && PROXY_URL.trim()) {
    try {
      const url = `${PROXY_URL}/${encodeURIComponent(account.key)}`;
      const resp = await fetch(url, { method: 'GET' });
      if (!resp.ok) {
        console.warn('fetchSummary: proxy returned', resp.status, await resp.text());
        // fallback para JSONP abaixo
      } else {
        const json = await resp.json();
        // Caso o proxy retorne normalized object (ok:true, aguardando, etc.)
        if (json && json.ok && (('aguardando' in json) || json.perStore || json.overall)) {
          // se veio perStore com a conta específica
          if (json.perStore && json.perStore[account.key]) {
            const ps = json.perStore[account.key];
            return {
              totalGeral: Number(ps.totalItens ?? ps.totalGeral ?? 0),
              aguardando: Number(ps.aguardando ?? 0),
              emSeparacao: Number(ps.emSeparacao ?? ps.em_separacao ?? 0),
              separadas: Number(ps.separadas ?? 0),
              embaladas: Number(ps.embaladas ?? 0)
            };
          }
          // top-level normalized
          return {
            totalGeral: Number(json.overall?.totalItens ?? json.totalGeral ?? json.grandTotal ?? 0),
            aguardando: Number(json.aguardando ?? 0),
            emSeparacao: Number(json.emSeparacao ?? json.em_separacao ?? 0),
            separadas: Number(json.separadas ?? 0),
            embaladas: Number(json.embaladas ?? 0)
          };
        }
        // Se proxy retornou formato WebApp (mapped/raw)
        const mapped = json.mapped || json.raw || json;
        return {
          totalGeral: Number(mapped.grand_total ?? mapped.grandTotal ?? mapped.total ?? 0),
          aguardando: Number(mapped.aguardando_total ?? mapped.aguardando ?? 0),
          emSeparacao: Number(mapped.em_separao_total ?? mapped.em_separacao_total ?? mapped.emSeparacao ?? 0),
          separadas: Number(mapped.separadas_total ?? mapped.separadas ?? 0),
          embaladas: Number(mapped.embaladas_total ?? mapped.embaladas ?? 0)
        };
      }
    } catch (err) {
      console.warn('fetchSummary: erro no proxy', err);
      // fallback JSONP continua abaixo
    }
  }

  // Fallback JSONP -> chama Web App diretamente (pode falhar por CSP)
  try {
    const url = `${WEB_APP_URL}?action=account&acc=${encodeURIComponent(account.key)}`;
    const json = await jsonpFetch(url, 10000);
    if (!json || json.error) {
      console.warn('fetchSummary: erro na resposta JSONP para', account.key, json && json.error);
      return { totalGeral: 0, aguardando: 0, emSeparacao: 0, separadas: 0, embaladas: 0 };
    }
    return {
      totalGeral: Number(json.total || json.grandTotal || 0),
      aguardando: Number(json.aguardando || 0),
      emSeparacao: Number(json.emSeparacao || json['emSeparacao'] || 0),
      separadas: Number(json.separadas || 0),
      embaladas: Number(json.embaladas || 0)
    };
  } catch (err) {
    console.error('Erro fetchSummary JSONP', account.key, err);
    return { totalGeral: 0, aguardando: 0, emSeparacao: 0, separadas: 0, embaladas: 0 };
  }
}

/* sync principal — usa fetchSummary para cada conta */
async function sync() {
  const btn = document.getElementById('btn-refresh');
  if (btn) { btn.textContent = 'Sincronizando...'; btn.disabled = true; }

  // expectativa: CONFIG.ACCOUNTS existe e é um array de { key, label } (mantido pelo seu app)
  if (!window.CONFIG || !Array.isArray(window.CONFIG.ACCOUNTS)) {
    console.error('CONFIG.ACCOUNTS não definido. Verifique onde CONFIG é carregado.');
    if (btn) { btn.textContent = 'Sincronizar Tiny'; btn.disabled = false; }
    return;
  }

  let totals = { aguardando: 0, emSeparacao: 0, separadas: 0, embaladas: 0 };

  const promises = window.CONFIG.ACCOUNTS.map(acc => fetchSummary(acc).then(r => ({ acc, r })).catch(e => ({ acc, r: null })));
  const results = await Promise.all(promises);

  results.forEach(res => {
    const r = res.r;
    if (!r) return;
    totals.aguardando += r.aguardando || 0;
    totals.emSeparacao += r.emSeparacao || 0;
    totals.separadas += r.separadas || 0;
    totals.embaladas += r.embaladas || 0;
  });

  // atualiza estado e UI (supondo funções/variáveis globais já existentes no app)
  window.globalState = window.globalState || {};
  window.globalState.totalAseparar = totals.aguardando;
  window.globalState.totalEmSeparacao = totals.emSeparacao;
  window.globalState.totalSeparadas = totals.separadas;
  window.globalState.totalEmbaladas = totals.embaladas;

  // updateUI() deve existir no seu projeto (mantive a chamada)
  if (typeof updateUI === 'function') {
    updateUI();
  } else {
    // fallback simples: atualiza alguns elementos se existirem
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('total-a-separar', totals.aguardando);
    setText('total-em-separacao', totals.emSeparacao);
    setText('total-separadas', totals.separadas);
    setText('total-embaladas', totals.embaladas);
  }

  if (btn) { btn.textContent = 'Sincronizar Tiny'; btn.disabled = false; }
}

/* Inicialização: wire up botão e auto-sync opcional */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-refresh');
  if (btn) btn.addEventListener('click', () => sync());

  // Se quiser auto-sync ao carregar, descomente:
  // sync();
});