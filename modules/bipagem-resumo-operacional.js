window.EHF_BIPAGEM_RESUMO_OPERACIONAL_VERSION = '4.2.45-LOJA-ROMANEIO-RESUMO';
(function(){
  'use strict';

  const WORKER_BASE = (window.EHF_TINY_WORKER_BASE || window.EHF_WORKER_API_BASE || 'https://atendente-vesco-tiny-worker.2cwhzy.easypanel.host').replace(/\/$/,'');
  const STORE_KEYS = ['comercio','suprimentos','distribuidora','ekn'];
  const STORE_NAMES = {
    comercio: 'EHF Comércio',
    suprimentos: 'EHF Suprimentos',
    distribuidora: 'EHF Distribuidora',
    ekn: 'EHF EKN',
    nao_localizada: 'Não localizada'
  };
  const STATUS_ORDER = ['aguardando','emSeparacao','separadas','embaladas'];
  const STATUS_LABELS = {
    aguardando: 'Aguardando separação',
    emSeparacao: 'Em separação',
    separadas: 'Separadas',
    embaladas: 'Embaladas / checkout'
  };
  const STATUS_SHORT = {
    aguardando: 'Aguardando',
    emSeparacao: 'Em separação',
    separadas: 'Separadas',
    embaladas: 'Embaladas'
  };

  const FORMA_ENVIO = {
    comercio: {
      '769570519': 'Mercado Envios',
      '778029845': 'Shopee Envios',
      '780391986': 'Mercado Envios Flex',
      '849173976': 'Amazon DBA',
      '850044775': 'Magalu Entregas',
      '852535843': 'Loggi',
      '854284026': 'TikTok Shipping'
    },
    suprimentos: {
      '772849381': 'Mercado Envios',
      '778034480': 'Shopee Envios',
      '780375701': 'Mercado Envios Flex',
      '852535096': 'Loggi',
      '853036097': 'Magalu Entregas',
      '854064525': 'Amazon DBA'
    },
    distribuidora: {
      '778095610': 'Shopee Envios',
      '780192106': 'Amazon DBA',
      '846935602': 'LALAMOVE',
      '847199235': 'Mercado Envios',
      '850341481': 'Loggi',
      '854536867': 'Shopee / SPX'
    },
    ekn: {}
  };

  let lastSummary = null;
  let fetching = false;
  let lastFetchAt = 0;

  function norm(v){
    return String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/ç/g,'c')
      .trim();
  }
  function cleanKey(v){ return norm(v).replace(/[^a-z0-9]+/g,''); }
  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function n(v){
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const m = String(v ?? '').match(/-?\d+/);
    return m ? Number(m[0] || 0) : 0;
  }
  function lojaKey(v){
    const t = norm(v);
    if(t.includes('comercio') || t.includes('comércio')) return 'comercio';
    if(t.includes('suprimentos')) return 'suprimentos';
    if(t.includes('distribuidora')) return 'distribuidora';
    if(t.includes('ekn')) return 'ekn';
    if(t.includes('nao localizada') || t.includes('nao_localizada')) return 'nao_localizada';
    return '';
  }
  function channelCanon(v){
    const t = norm(v);
    if(t.includes('flex')) return 'Mercado Envios Flex';
    if(t.includes('spx')) return 'Shopee Envios';
    if(t.includes('shopee')) return 'Shopee Envios';
    if(t.includes('tiktok') || t.includes('j&t') || t.includes('jt')) return 'TikTok Shipping';
    if(t.includes('amazon') || t.includes('dba')) return 'Amazon DBA';
    if(t.includes('magalu')) return 'Magalu Entregas';
    if(t.includes('loggi')) return 'Loggi';
    if(t.includes('mercado') || t.includes('coleta') || t.includes('agencia')) return 'Mercado Envios';
    return String(v || 'Sem canal').trim() || 'Sem canal';
  }
  function channelName(storeKey, raw){
    const s = String(raw ?? '').trim();
    if (!s) return 'Sem canal';
    if (FORMA_ENVIO[storeKey] && FORMA_ENVIO[storeKey][s]) return FORMA_ENVIO[storeKey][s];
    if (/^\d+$/.test(s)) return 'ID ' + s;
    return channelCanon(s);
  }
  function channelMatches(a,b){
    const ca = channelCanon(a), cb = channelCanon(b);
    if (ca === cb) return true;
    const na = norm(ca), nb = norm(cb);
    if ((na.includes('shopee') || na.includes('spx')) && (nb.includes('shopee') || nb.includes('spx'))) return true;
    if (na.includes('flex') && nb.includes('flex')) return true;
    if (na.includes('mercado') && nb.includes('mercado') && !na.includes('flex') && !nb.includes('flex')) return true;
    return false;
  }

  function normalizeSituacaoEnvioCounts(value){
    const base = { aguardando:{}, emSeparacao:{}, separadas:{}, embaladas:{} };
    if(!value) return base;
    let obj = value;
    if(typeof obj === 'string'){
      try { obj = JSON.parse(obj); } catch(_){ obj = null; }
    }
    if(!obj || typeof obj !== 'object') return base;
    return {
      aguardando: obj.aguardando || obj.Aguardando || obj['Aguardando Separação'] || {},
      emSeparacao: obj.emSeparacao || obj.emSeparação || obj['Em Separação'] || obj['em separação'] || {},
      separadas: obj.separadas || obj.Separadas || {},
      embaladas: obj.embaladas || obj.Embaladas || obj['Embaladas / Checkout'] || {}
    };
  }

  function storeFromSummary(data, key){
    const per = data?.perStore || data?.raw?.perStore || data?.summary?.perStore || {};
    const st = per[key] || per[key.toUpperCase?.()] || null;
    return st;
  }

  function operationalFromSummary(data){
    const out = {};
    STORE_KEYS.forEach(key => {
      const st = storeFromSummary(data, key) || {};
      const counts = normalizeSituacaoEnvioCounts(st.situacaoEnvioCounts || st.situacaoCanalCounts || st.strictCanalCounts || st.canalCounts || st.raw?.situacaoEnvioCounts);
      const total = n(st.total) || n(st.totalGeral) || (n(st.aguardando) + n(st.emSeparacao) + n(st.separadas) + n(st.embaladas));
      const statuses = {
        aguardando: n(st.aguardando || st.aguardandoSeparacao || st.status?.['1']),
        emSeparacao: n(st.emSeparacao || st.em_separacao || st.status?.['4']),
        separadas: n(st.separadas || st.status?.['2']),
        embaladas: n(st.embaladas || st.checkout || st.status?.['3'])
      };
      const groups = { aguardando:[], emSeparacao:[], separadas:[], embaladas:[] };
      STATUS_ORDER.forEach(sk => {
        const obj = counts[sk] || {};
        Object.keys(obj).forEach(raw => {
          const qty = n(obj[raw]);
          if (qty <= 0) return;
          groups[sk].push({ raw, name: channelName(key, raw), canon: channelCanon(channelName(key, raw)), expected: qty, bipado: 0 });
        });
      });
      out[key] = { key, name: STORE_NAMES[key] || key, total, statuses, groups, last:'' };
    });
    return out;
  }

  function operationalFromDom(){
    const out = {};
    STORE_KEYS.forEach(key => {
      const statuses = {
        aguardando: n(document.getElementById(`row-${key}-aguardando`)?.textContent),
        emSeparacao: n(document.getElementById(`row-${key}-separacao`)?.textContent),
        separadas: n(document.getElementById(`row-${key}-separadas`)?.textContent),
        embaladas: n(document.getElementById(`row-${key}-embaladas`)?.textContent)
      };
      const total = n(document.getElementById(`row-${key}-total`)?.textContent) || Object.values(statuses).reduce((a,b)=>a+n(b),0);
      const groups = { aguardando:[], emSeparacao:[], separadas:[], embaladas:[] };
      const cont = document.getElementById(`container-${key}`);
      if (cont) {
        let current = 'aguardando';
        Array.from(cont.children || []).forEach(child => {
          if (child.classList?.contains('status-group-title')) {
            const t = norm(child.textContent);
            current = t.includes('em separacao') ? 'emSeparacao' : t.includes('separada') ? 'separadas' : (t.includes('embalada') || t.includes('checkout')) ? 'embaladas' : 'aguardando';
          }
          if (child.classList?.contains('channel-badge-list')) {
            Array.from(child.querySelectorAll('.channel-badge-item')).forEach(li => {
              const nm = li.querySelector('.channel-name')?.textContent || li.childNodes?.[0]?.textContent || li.textContent || '';
              const qty = n(li.querySelector('.channel-val')?.textContent || li.textContent);
              if(qty > 0) groups[current].push({ raw:nm, name:channelName(key,nm), canon:channelCanon(nm), expected:qty, bipado:0 });
            });
          }
        });
      }
      out[key] = { key, name: STORE_NAMES[key] || key, total, statuses, groups, last:'' };
    });
    return out;
  }

  function getOperational(){
    const fromSummary = operationalFromSummary(lastSummary || window.ehfUltimoResumo || window.ehfSummary || {});
    const anyChannel = STORE_KEYS.some(k => STATUS_ORDER.some(sk => (fromSummary[k]?.groups?.[sk] || []).length));
    if (anyChannel) return fromSummary;
    return operationalFromDom();
  }

  function readBips(){
    const rows = Array.from(document.querySelectorAll('#lista-bipagens-historico tr, .ehf-romaneio-leitura-row'));
    const out = [];
    rows.forEach(tr => {
      const td = tr.querySelectorAll('td');
      if (td.length < 5) return;
      const horario = (td[0]?.textContent || '').trim();
      const loja = lojaKey(td[1]?.textContent || '');
      const plataforma = (td[2]?.textContent || '').trim();
      const canal = channelCanon(td[3]?.textContent || plataforma || '');
      const code = (td[4]?.querySelector('b')?.textContent || td[4]?.textContent || '').trim().split(/\s+/)[0];
      if(!code) return;
      out.push({ horario, loja, plataforma, canal, code });
    });
    // também tenta localStorage/cache usado por algumas versões do romaneio
    try{
      Object.keys(localStorage || {}).forEach(k => {
        if(!/romaneio|leituras|bip/i.test(k)) return;
        let arr;
        try { arr = JSON.parse(localStorage.getItem(k)); } catch(_){ return; }
        if(!Array.isArray(arr)) return;
        arr.forEach(it => {
          const code = String(it.codigo || it.codigoId || it.etiqueta || it.code || '').trim();
          if(!code) return;
          out.push({
            horario: it.horario || it.hora || '',
            loja: lojaKey(it.loja || it.store || ''),
            plataforma: it.plataforma || it.marketplace || '',
            canal: channelCanon(it.canal || it.channel || it.plataforma || ''),
            code
          });
        });
      });
    }catch(_){ }
    const seen = new Set();
    return out.filter(x => {
      const k = String(x.code).toUpperCase().replace(/[^A-Z0-9]/g,'');
      if(!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function escolherLojaOperacionalParaCanal(canalAlvo){
    const op = applyBips(getOperational(), readBips());
    const alvo = channelCanon(canalAlvo || '');
    let melhor = null;
    STORE_KEYS.forEach(sk => {
      const store = op[sk];
      if(!store) return;
      STATUS_ORDER.forEach(status => {
        (store.groups[status] || []).forEach(g => {
          if(!channelMatches(g.name, alvo)) return;
          const exp = n(g.expected), bip = n(g.bipado), restante = exp - bip;
          const score = (restante > 0 ? restante : 0) * 1000 + exp;
          if(!melhor || score > melhor.score){
            melhor = { lojaKey: sk, lojaNome: store.name || STORE_NAMES[sk] || sk, canalNome: g.name, statusKey: status, esperado: exp, bipado: bip, restante, score };
          }
        });
      });
    });
    return melhor || { lojaKey:'nao_localizada', lojaNome:'Não localizada', canalNome: canalAlvo || '', esperado:0, bipado:0, restante:0 };
  }

  function applyBips(op, bips){
    Object.values(op).forEach(store => {
      store.last = '';
      STATUS_ORDER.forEach(sk => (store.groups[sk] || []).forEach(g => g.bipado = 0));
    });
    bips.forEach(b => {
      let sk = b.loja;
      if(!sk || sk === 'nao_localizada' || !op[sk]) {
        const escolhido = escolherLojaOperacionalParaCanal(b.canal || b.plataforma || '');
        sk = escolhido && escolhido.lojaKey !== 'nao_localizada' ? escolhido.lojaKey : '';
      }
      if(!sk || sk === 'nao_localizada' || !op[sk]) return;
      let hit = null;
      STATUS_ORDER.forEach(status => {
        (op[sk].groups[status] || []).forEach(g => {
          if(!hit && channelMatches(g.name, b.canal)) hit = g;
        });
      });
      if(hit) hit.bipado += 1;
      if(b.horario) op[sk].last = b.horario;
    });
    return op;
  }

  function groupTotal(store, field){
    return STATUS_ORDER.reduce((acc, sk) => acc + (store.groups[sk] || []).reduce((a,g) => a + n(g[field]), 0), 0);
  }
  function storeBipado(store){ return groupTotal(store,'bipado'); }
  function storeExpected(store){ return groupTotal(store,'expected') || n(store.total); }

  function chipHtml(store, statusKey){
    const chips = store.groups[statusKey] || [];
    if(!chips.length) return '';
    return `<div class="ehf-op-section"><div class="ehf-op-section-title">${esc(STATUS_LABELS[statusKey])}</div><div class="ehf-op-chips">${chips.map(g => {
      const ok = n(g.bipado), exp = n(g.expected);
      const cls = ok > 0 ? ' tem-bipe' : '';
      return `<span class="ehf-op-chip${cls}" title="${esc(g.name)}"><b>${esc(g.name)}</b> <em>${ok}/${exp}</em></span>`;
    }).join('')}</div></div>`;
  }

  let rendering = false;
  function render(){
    const container = document.getElementById('resumo-bipagem-loja-canal');
    if(!container || rendering) return;
    const op = applyBips(getOperational(), readBips());
    const stores = STORE_KEYS.filter(k => op[k] && storeExpected(op[k]) > 0);
    if(!stores.length) return;
    rendering = true;
    try{
      container.innerHTML = `<div class="ehf-op-clone-list">${stores.map(k => {
        const st = op[k];
        const bip = storeBipado(st);
        const exp = storeExpected(st);
        const restante = Math.max(exp - bip, 0);
        const sections = STATUS_ORDER.map(sk => chipHtml(st, sk)).join('') || `<div class="ehf-op-section"><div class="ehf-op-chips"><span class="ehf-op-chip"><b>Sem canais</b></span></div></div>`;
        return `<article class="ehf-op-clone-card" data-store="${esc(k)}">
          <header><div><strong>${esc(st.name)}</strong><small>Resumo por loja igual ao operacional</small></div><b class="ehf-op-total">${exp}</b></header>
          <div class="ehf-op-meta"><span><b class="ok">${bip}</b> bipada(s)</span><span><b class="warn">${restante}</b> restante(s)</span>${st.last ? `<span>Último ${esc(st.last)}</span>` : ''}</div>
          ${sections}
        </article>`;
      }).join('')}</div>`;
      const countLojas = document.getElementById('bip-menu-count-lojas');
      if(countLojas) countLojas.textContent = String(stores.length);
      const countBipes = document.getElementById('bip-menu-count-bipes');
      if(countBipes) countBipes.textContent = String(readBips().length);
    } finally { rendering = false; }
  }

  async function fetchSummary(){
    if(fetching) return;
    if(Date.now() - lastFetchAt < 8000) return;
    fetching = true;
    lastFetchAt = Date.now();
    try{
      const r = await fetch(WORKER_BASE + '/api/summary?ts=' + Date.now(), { cache:'no-store' });
      const data = await r.json();
      if(data && data.ok !== false){
        lastSummary = data;
        window.ehfResumoOperacionalBipagemSource = data;
        render();
      }
    }catch(e){
      console.warn('[EHF] resumo operacional da bipagem: falha ao buscar worker; usando DOM.', e);
    }finally{ fetching = false; }
  }

  function injectStyle(){
    if(document.getElementById('ehf-bipagem-resumo-operacional-v4245')) return;
    const st = document.createElement('style');
    st.id = 'ehf-bipagem-resumo-operacional-v4245';
    st.textContent = `
      #resumo-bipagem-loja-canal{display:block!important}
      .ehf-op-clone-list{display:grid;gap:10px;width:100%}
      .ehf-op-clone-card{border:1px solid rgba(148,163,184,.16);background:linear-gradient(180deg,#121b28,#0b111b);border-radius:14px;padding:11px;box-shadow:0 10px 28px rgba(0,0,0,.22)}
      .ehf-op-clone-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px}
      .ehf-op-clone-card header strong{display:block;color:#ff8a00;font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.02em}
      .ehf-op-clone-card header small{display:block;color:#94a3b8;font-size:10px;margin-top:3px}
      .ehf-op-total{font-size:24px;color:#fff;font-weight:950;line-height:1}
      .ehf-op-meta{display:flex;flex-wrap:wrap;gap:8px;color:#aab6c8;font-size:10px;margin:5px 0 8px;align-items:center;justify-content:space-between}
      .ehf-op-meta .ok{color:#22c55e}.ehf-op-meta .warn{color:#ff8a00}
      .ehf-op-section{margin-top:7px}
      .ehf-op-section-title{color:#ff8a00;text-transform:uppercase;font-size:9.5px;font-weight:950;letter-spacing:.035em;margin:0 0 5px}
      .ehf-op-chips{display:flex;flex-wrap:wrap;gap:5px}
      .ehf-op-chip{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:4px 7px;border-radius:999px;background:#05070a;border:1px solid rgba(255,255,255,.07);color:#dbeafe;font-size:10px;font-weight:900;white-space:nowrap}
      .ehf-op-chip b{font-weight:950;color:#dbeafe;overflow:hidden;text-overflow:ellipsis;max-width:150px}
      .ehf-op-chip em{font-style:normal;color:#ff8a00;font-weight:950}
      .ehf-op-chip.tem-bipe{border-color:rgba(34,197,94,.4);box-shadow:0 0 0 1px rgba(34,197,94,.08) inset}.ehf-op-chip.tem-bipe em{color:#22c55e}
      @media(max-width:760px){.ehf-op-total{font-size:20px}.ehf-op-chip{font-size:9px;padding:4px 6px}.ehf-op-chip b{max-width:108px}.ehf-op-meta{font-size:9px}.ehf-op-clone-card{padding:10px}}
    `;
    document.head.appendChild(st);
  }
  function schedule(){ setTimeout(render, 80); }
  function boot(){
    injectStyle();
    fetchSummary();
    schedule();
    setInterval(() => { fetchSummary(); render(); }, 2500);
    ['lista-bipagens-historico','resumo-bipagem-loja-canal','container-comercio','container-suprimentos','container-distribuidora','container-ekn'].forEach(id => {
      const el = document.getElementById(id);
      if(el) try{ new MutationObserver(schedule).observe(el,{childList:true,subtree:true,characterData:true}); }catch(_){ }
    });
    window.addEventListener('ehf:romaneioAtualizado', schedule);
    window.addEventListener('ehf:estado-operacional', ev => { if(ev?.detail){ lastSummary = ev.detail.summary || ev.detail; schedule(); } });
    window.EHFRenderResumoOperacionalBipagem = render;
    window.EHFEscolherLojaResumoOperacional = escolherLojaOperacionalParaCanal;
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
