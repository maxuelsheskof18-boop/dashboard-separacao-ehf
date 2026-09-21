(function(){
  'use strict';

  const VERSION = '4.2.51-ROMANEIO-ID-BIPAGEM-ASSINATURA';
  const MIN_KEY = 'ehf_romaneios_salvos_minimizado';
  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwQ8-Rn-zZJQM0fLm9js3ErtJZefRnHP55E3M0r3Z_TIXS_skTioZ6p3yHqTLFYxPU9/exec';

  window.EHF_ROMANEIO_MOBILE_PC_VERSION = VERSION;

  function injectStyle(){
    if(document.getElementById('ehf-romaneio-mobile-pc-style')) return;
    const st=document.createElement('style');
    st.id='ehf-romaneio-mobile-pc-style';
    st.textContent = `
      .ehf-romaneios-panel{margin:12px 0 14px;padding:12px;border:1px solid rgba(255,138,0,.28);border-radius:14px;background:linear-gradient(135deg,rgba(255,138,0,.10),rgba(13,18,27,.94));box-shadow:0 12px 28px rgba(0,0,0,.22)}
      .ehf-romaneios-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.ehf-romaneios-titlebar{display:flex;align-items:flex-start;gap:8px;min-width:0}.ehf-romaneios-titlebar h3{margin:0;color:#fff;font-size:15px}.ehf-romaneios-head small{display:block;color:#9ca3af;font-size:10px;margin-top:2px}.ehf-romaneios-toggle{border:1px solid rgba(255,138,0,.38);background:rgba(255,138,0,.10);color:#ffb454;border-radius:8px;padding:6px 8px;font-weight:950;font-size:10px;cursor:pointer;line-height:1}.ehf-romaneios-toggle:hover{background:rgba(255,138,0,.18)}
      .ehf-romaneios-panel.ehf-romaneios-collapsed{padding-bottom:10px}.ehf-romaneios-panel.ehf-romaneios-collapsed .ehf-romaneios-list{display:none!important}.ehf-romaneios-panel.ehf-romaneios-collapsed .ehf-romaneios-head{margin-bottom:0}.ehf-romaneios-panel.ehf-romaneios-collapsed .ehf-romaneio-actions input,.ehf-romaneios-panel.ehf-romaneios-collapsed .ehf-romaneio-actions #ehf-romaneio-refresh,.ehf-romaneios-panel.ehf-romaneios-collapsed .ehf-romaneio-actions #ehf-romaneio-save-now{display:none!important}
      .ehf-romaneio-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.ehf-romaneio-btn{border:0;border-radius:9px;padding:8px 10px;background:#ff8a00;color:#111;font-weight:900;font-size:10px;cursor:pointer}.ehf-romaneio-btn.secondary{background:#1f2937;color:#fff;border:1px solid rgba(255,255,255,.12)}.ehf-romaneio-btn[disabled]{opacity:.55;cursor:wait}
      .ehf-romaneio-month{background:#05070a;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 9px;font-size:11px}.ehf-romaneios-list{display:grid;gap:8px}.ehf-romaneio-month-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:2px}.ehf-romaneio-month-summary .sum{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(7,10,14,.76);padding:10px}.ehf-romaneio-month-summary span{display:block;color:#9ca3af;font-size:9px;font-weight:900;text-transform:uppercase}.ehf-romaneio-month-summary b{display:block;color:#fff;font-size:20px;margin-top:2px}.ehf-romaneio-month-summary .bad b{color:#fb7185}.ehf-romaneio-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(7,10,14,.76);padding:10px}
      .ehf-romaneio-title{font-weight:950;color:#fff;font-size:12px}.ehf-romaneio-meta{margin-top:4px;color:#aeb6c2;font-size:10px;line-height:1.45}.ehf-romaneio-status{display:inline-flex;padding:3px 7px;border-radius:999px;background:rgba(39,174,96,.13);border:1px solid rgba(39,174,96,.28);color:#8ff0ad;font-size:9px;font-weight:900;margin-right:5px}.ehf-romaneio-status.finalizado{background:rgba(59,130,246,.13);border-color:rgba(59,130,246,.32);color:#bfdbfe}.ehf-romaneio-print{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.ehf-romaneio-empty{color:#9ca3af;font-size:11px;padding:8px;border:1px dashed rgba(255,255,255,.14);border-radius:10px;text-align:center}.ehf-romaneio-error{color:#fecaca;border-color:rgba(239,68,68,.35);background:rgba(127,29,29,.18)}
      @media(max-width:760px){.ehf-romaneios-panel{padding:10px!important;margin:8px 0!important;border-radius:13px!important}.ehf-romaneios-head{align-items:flex-start!important;flex-direction:column!important;margin-bottom:8px!important}.ehf-romaneios-titlebar{width:100%;justify-content:space-between;align-items:flex-start}.ehf-romaneio-actions{width:100%!important;display:grid!important;grid-template-columns:1fr 1fr!important}.ehf-romaneio-actions #ehf-romaneio-month{grid-column:1/-1}.ehf-romaneios-panel.ehf-romaneios-collapsed .ehf-romaneio-actions{display:none!important}.ehf-romaneio-month-summary{grid-template-columns:1fr 1fr!important}.ehf-romaneio-item{grid-template-columns:1fr!important}.ehf-romaneio-print{justify-content:stretch}.ehf-romaneio-print button{flex:1}.ehf-romaneio-print button[data-mode="complete"]{display:none!important}}
    `;
    document.head.appendChild(st);
  }

  function monthKey(date=new Date()){ return `${date.getFullYear()}_${String(date.getMonth()+1).padStart(2,'0')}`; }

  function todayKey(){
    const op = window.ehfDataOperacional || '';
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(op))) return String(op);
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function compactDateKey(value){
    if(!value) return '';
    if(value instanceof Date && !isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
    const s=String(value);
    const iso=s.match(/(20\d{2})[-/](\d{2})[-/](\d{2})/);
    if(iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br=s.match(/(\d{2})\/(\d{2})\/(20\d{2})/);
    if(br) return `${br[3]}-${br[2]}-${br[1]}`;
    const filename=s.match(/(\d{2})(\d{2})(20\d{2})/);
    if(filename) return `${filename[3]}-${filename[2]}-${filename[1]}`;
    const d=new Date(s);
    if(!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return '';
  }
  function rowDateKey(row){
    const r=normalizeRow(row);
    return compactDateKey(r.fim) || compactDateKey(r.inicio) || compactDateKey(r.data) || compactDateKey(r.arquivo) || compactDateKey(r.key);
  }
  function filterRowsByOperationalDay(rows){
    const day=todayKey();
    return (rows||[]).filter(row=>rowDateKey(row) === day);
  }

  function esc(v){ return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function number(v){ const n=Number(v||0); return Number.isFinite(n)?n:0; }
  function brDateTime(v){
    if(!v) return '-';
    if(v instanceof Date && !isNaN(v.getTime())) return v.toLocaleString('pt-BR');
    const d = new Date(v);
    if(!isNaN(d.getTime())) return d.toLocaleString('pt-BR');
    return String(v);
  }
  function brTime(v){
    if(!v) return '-';
    const d = new Date(v);
    if(!isNaN(d.getTime())) return d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const s=String(v);
    const m=s.match(/\b\d{2}:\d{2}(?::\d{2})?\b/);
    return m ? m[0] : s;
  }
  function normalizeKey(v){ return String(v||'').trim(); }

  function normalizeRow(row){
    return {
      key: row.romaneio_key || row.session_id || row.arquivo || row.file_name || '',
      mes: row.mes || '',
      session: row.session_id || '',
      arquivo: row.arquivo || row.file_name || '',
      status: row.status || '',
      canal: row.canal || '',
      conta: row.conta || row.account || '',
      coletor: row.coletor || '',
      conferente: row.conferente || '',
      inicio: row.inicio || '',
      fim: row.fim || '',
      leituras: number(row.leituras),
      pedidos: number(row.pedidos),
      unidades: number(row.unidades),
      divergentes: number(row.divergentes),
      html: row.html_salvo || row.html || '',
      data: row.data_registro || row.data_local || ''
    };
  }

  function inferPlatform(item, romaneio){
    const raw = String(item.plataforma || item.platform || item.source || '').trim();
    if(raw && !/^firebase|worker|dashboard|scan$/i.test(raw)) return raw;
    const txt = [item.etiqueta_envio, item.codigo, item.canal, item.observacao, romaneio && romaneio.canal].join(' ').toLowerCase();
    if(/shopee|spx|^br/i.test(txt) || /^br/i.test(String(item.etiqueta_envio||''))) return 'Shopee';
    if(/mercado|mel|flex|coleta|^47/i.test(txt) || /^47/.test(String(item.etiqueta_envio||''))) return 'Mercado Livre';
    if(/amazon|dba|^tbr/i.test(txt) || /^TBR/i.test(String(item.etiqueta_envio||''))) return 'Amazon';
    if(/tiktok|^999/i.test(txt) || /^999/.test(String(item.etiqueta_envio||''))) return 'TikTok';
    if(/magalu|magazine/i.test(txt)) return 'Magalu';
    return '-';
  }

  function normalizeItem(row, romaneio){
    return {
      key: row.romaneio_key || row.session_id || row.arquivo || row.file_name || '',
      mes: row.mes || '',
      ordem: row.ordem || '',
      scanId: row.scan_id || row.scanId || row.id_bipagem || '',
      horario: row.horario || row.hora || row.data_registro || '',
      loja: row.loja || row.conta || row.account || '',
      plataforma: inferPlatform(row, romaneio),
      canal: row.canal || (romaneio && romaneio.canal) || '',
      pedidoTiny: row.pedido_tiny || row.pedidoTiny || row.numero_tiny || '',
      pedidoMarketplace: row.pedido_marketplace || row.pedidoMarketplace || row.numero || row.pedido || '',
      codigo: row.etiqueta_envio || row.codigo || row.codigo_id || row.id || '',
      produtos: row.produtos || row.itens_resumo || row.item || '',
      unidades: number(row.unidades),
      status: row.status || '',
      observacao: row.observacao || '',
      operador: row.operador || row.operator || ''
    };
  }

  function getMonthFromRow(row){
    const r=normalizeRow(row);
    if(/^\d{4}_\d{2}$/.test(String(r.mes||''))) return r.mes;
    const raw=r.fim || r.inicio || r.data;
    const d=new Date(raw);
    if(!isNaN(d.getTime())) return monthKey(d);
    const input=document.getElementById('ehf-romaneio-month');
    if(input && /^\d{4}_\d{2}$/.test(String(input.value||''))) return String(input.value);
    return monthKey();
  }

  function jsonp(action, params={}){
    return new Promise((resolve,reject)=>{
      const cb='ehf_jsonp_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const url=new URL(WEB_APP_URL);
      url.searchParams.set('action', action);
      Object.entries(params||{}).forEach(([k,v])=>{ if(v!==undefined && v!==null) url.searchParams.set(k,String(v)); });
      url.searchParams.set('callback', cb);
      url.searchParams.set('_', String(Date.now()));
      const s=document.createElement('script');
      let called=false;
      const timer=setTimeout(()=>{ cleanup(); reject(new Error('Tempo esgotado ao consultar planilha. Confira se o Apps Script v2.9 foi publicado como Web App.')); },30000);
      function cleanup(){ clearTimeout(timer); try{ delete window[cb]; }catch(_){} if(s && s.parentNode) s.parentNode.removeChild(s); }
      window[cb]=(data)=>{ called=true; cleanup(); resolve(data); };
      s.async=true;
      s.onerror=()=>{ cleanup(); reject(new Error('Falha ao consultar planilha. Normalmente é Web App antigo, URL errada ou permissão do Apps Script.')); };
      s.onload=()=>{ setTimeout(()=>{ if(!called){ cleanup(); reject(new Error('A planilha respondeu, mas não chamou o callback JSONP. Publique o Apps Script v2.9.')); } },500); };
      s.src=url.toString();
      document.body.appendChild(s);
    });
  }
  window.EHFRomaneioJsonp = jsonp;

  function filterItemsForRomaneio(rows, romaneio){
    const r=normalizeRow(romaneio);
    const keys = new Set([r.key, r.session, r.arquivo].map(normalizeKey).filter(Boolean));
    return (rows||[]).filter(row=>{
      const vals=[row.romaneio_key, row.session_id, row.arquivo, row.file_name].map(normalizeKey).filter(Boolean);
      return vals.some(v=>keys.has(v));
    }).map(row=>normalizeItem(row, r));
  }

  async function fetchItensRomaneio(romaneio){
    const mes=getMonthFromRow(romaneio);
    const r=normalizeRow(romaneio);
    // Manda a sessão junto: sem isso o Apps Script devolve os scans do mês
    // inteiro por JSONP só para o cliente descartar quase tudo em seguida.
    const data=await jsonp('romaneioItens', { mes, limit: 12000, session: r.session || r.key });
    if(!data || data.ok===false) throw new Error(data?.error || data?.detail || 'Não consegui consultar os itens do romaneio.');
    return filterItemsForRomaneio(data.rows || data.itens || [], romaneio);
  }

  function buildRomaneioHtml(row, itens, mode){
    const r=normalizeRow(row);
    const items=(itens||[]).map(x=>normalizeItem(x, r));
    const title=esc((r.arquivo || ('romaneio-'+(r.session||r.key||''))).replace(/\.html?$/i,''));
    const totalLeituras = r.leituras || items.length;
    const totalPedidos = r.pedidos || new Set(items.map(i=>i.pedidoMarketplace||i.pedidoTiny||i.codigo).filter(Boolean)).size;
    const totalUnidades = r.unidades || items.reduce((acc,i)=>acc+number(i.unidades),0);
    const totalDivergentes = r.divergentes || items.filter(i=>/diverg|erro|nao|não|bloq/i.test(String(i.status||''))).length;
    const listRows = items.map((item, idx)=>{
      const numero = item.pedidoMarketplace || item.pedidoTiny || '-';
      const statusColor = /diverg|erro|nao|não|bloq/i.test(String(item.status||'')) ? '#b91c1c' : '#166534';
      const obs = item.observacao ? `<div class="obs">${esc(item.observacao)}</div>` : '';
      return `<tr><td>${idx+1}</td><td>${esc(item.scanId ? '#'+item.scanId : '-')}</td><td>${esc(brTime(item.horario))}</td><td>${esc(item.loja||'-')}</td><td>${esc(item.plataforma||'-')}</td><td>${esc(item.canal||r.canal||'-')}</td><td><b>${esc(numero)}</b></td><td>${esc(item.codigo||'-')}</td><td>${esc(item.operador||'-')}</td><td style="color:${statusColor};font-weight:700;">${esc(item.status||'-')}${obs}</td><td>${esc(item.produtos||'-')}</td><td>${number(item.unidades)}</td></tr>`;
    }).join('');
    const bodyClass = mode === 'complete' ? 'print-complete' : 'print-summary';
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title><style>
      body{font-family:Arial,sans-serif;margin:22px;color:#111;background:#fff}h1{margin:0;font-size:24px}.head{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #111;padding-bottom:12px}.sub{font-size:13px;color:#333}.right{text-align:right;font-size:12px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.box{border:1px solid #bbb;padding:10px;min-height:48px}.box span{display:block;font-size:10px;text-transform:uppercase;color:#555;font-weight:700}.box b{font-size:14px}.totals{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.total{border:2px solid #111;padding:12px;text-align:center}.total b{display:block;font-size:28px}.summary-note{margin:12px 0 18px;font-size:12px;color:#444}.manifest-table{width:100%;border-collapse:collapse;font-size:10.5px;margin-top:14px}.manifest-table th,.manifest-table td{border:1px solid #999;padding:6px 7px;text-align:left;vertical-align:top}.manifest-table th{background:#eee}.obs{font-size:9px;color:#555;margin-top:2px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:70px}.signature{border-top:1px solid #111;text-align:center;padding-top:7px;font-size:12px}.foot{margin-top:24px;font-size:9px;color:#555}.actions{position:sticky;top:0;background:#fff;padding:8px 0;margin-bottom:8px;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;gap:8px}.actions button{background:#ff8a00;color:#111;border:0;border-radius:6px;padding:8px 12px;font-weight:800;cursor:pointer}.actions button.secondary{background:#111;color:#fff}@media print{.actions{display:none}body{margin:10mm}.summary-only{display:block}.complete-only{display:block}body.print-summary .complete-only{display:none!important}}@page{size:A4;margin:10mm}
    </style></head><body class="${bodyClass}"><div class="actions"><div><button onclick="document.body.className='print-summary';window.print()">Imprimir resumo</button><button class="secondary" onclick="document.body.className='print-complete';window.print()">Imprimir lista completa</button></div><b>${title}</b></div><div class="head"><div><h1>EHF LOGÍSTICA</h1><div class="sub">${mode === 'complete' ? 'Romaneio completo' : 'Resumo do romaneio'}</div></div><div class="right"><b>${title}</b><br>${brDateTime(r.data || r.fim || new Date())}</div></div><div class="grid"><div class="box"><span>Canal</span><b>${esc(r.canal||'-')}</b></div><div class="box"><span>Coletor</span><b>${esc(r.coletor||'-')}</b></div><div class="box"><span>Conferente</span><b>${esc(r.conferente||'-')}</b></div><div class="box"><span>Status</span><b>${esc(r.status||'-')}</b></div><div class="box"><span>Início</span><b>${esc(brDateTime(r.inicio))}</b></div><div class="box"><span>Fim</span><b>${esc(brDateTime(r.fim)||'Em andamento')}</b></div></div><div class="totals"><div class="total"><b>${totalLeituras}</b>leituras</div><div class="total"><b>${totalPedidos}</b>pedidos</div><div class="total"><b>${totalUnidades}</b>unidades</div><div class="total"><b>${totalDivergentes}</b>divergências</div></div><div class="summary-note summary-only">Para coleta grande, imprima o resumo para assinatura e mantenha a lista completa salva para consulta.</div><div class="complete-only"><h2 style="font-size:16px;margin:18px 0 8px;">Leituras do romaneio</h2><table class="manifest-table"><thead><tr><th>#</th><th>ID bipagem</th><th>Hora</th><th>Loja</th><th>Plataforma</th><th>Canal</th><th>Número / Pedido</th><th>Código / ID</th><th>Operador</th><th>Status</th><th>Produtos</th><th>Unid.</th></tr></thead><tbody>${listRows || '<tr><td colspan="12">Nenhuma leitura detalhada encontrada para este romaneio.</td></tr>'}</tbody></table></div><div class="signatures"><div class="signature">Entregue/conferido por: ${esc(r.conferente||'-')}</div><div class="signature">Recebido por: ${esc(r.coletor||'-')}</div></div><div class="signatures"><div class="signature">Documento / placa</div><div class="signature">Assinatura e data/hora</div></div><div class="foot">Gerado pelo DashMarketplace EHF · versão ${VERSION}</div><script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>`;
  }

  function openOrDownloadHtml(html, name){
    const win=window.open('','_blank','width=1180,height=820');
    if(win){
      win.document.open();
      win.document.write(html);
      win.document.close();
      return true;
    }
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=(name||'romaneio-ehf')+'.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    return false;
  }

  async function printRomaneio(row, mode='summary'){
    const r=normalizeRow(row);
    let itens=[];
    if(mode === 'complete'){
      try{ itens = await fetchItensRomaneio(r); }
      catch(err){
        console.warn('[EHF] Falha ao buscar itens do romaneio completo:', err);
        alert('Não consegui buscar a lista completa na planilha. Vou abrir o romaneio com o resumo e a tabela vazia. Detalhe: ' + (err && err.message ? err.message : err));
      }
    }
    const html=buildRomaneioHtml(r, itens, mode);
    openOrDownloadHtml(html, (r.arquivo||r.key||'romaneio-ehf').replace(/\.html?$/i,''));
  }
  window.EHFPrintRomaneioSalvo = printRomaneio;

  function getCollapsed(){
    try { return localStorage.getItem(MIN_KEY) === '1'; } catch(_) { return false; }
  }

  function setCollapsed(panel, collapsed){
    if(!panel) return;
    panel.classList.toggle('ehf-romaneios-collapsed', !!collapsed);
    const btn = panel.querySelector('#ehf-romaneio-toggle');
    if(btn){
      btn.textContent = collapsed ? 'Expandir' : 'Minimizar';
      btn.title = collapsed ? 'Mostrar romaneios salvos' : 'Ocultar romaneios salvos';
    }
    try { localStorage.setItem(MIN_KEY, collapsed ? '1' : '0'); } catch(_) {}
  }

  function ensurePanel(){
    const bip=document.getElementById('view-bipagem'); if(!bip) return null;
    let panel=document.getElementById('ehf-romaneios-salvos-panel'); if(panel) return panel;
    panel=document.createElement('section'); panel.id='ehf-romaneios-salvos-panel'; panel.className='ehf-romaneios-panel';
    panel.innerHTML=`<div class="ehf-romaneios-head"><div class="ehf-romaneios-titlebar"><div><h3>Romaneios salvos</h3><small>Mostra somente o dia operacional. No PC, imprima resumo ou lista completa.</small></div><button type="button" id="ehf-romaneio-toggle" class="ehf-romaneios-toggle">Minimizar</button></div><div class="ehf-romaneio-actions"><input id="ehf-romaneio-month" class="ehf-romaneio-month" value="${monthKey()}"><button type="button" id="ehf-romaneio-refresh" class="ehf-romaneio-btn secondary">Atualizar</button><button type="button" id="ehf-romaneio-save-now" class="ehf-romaneio-btn">Salvar atual</button></div></div><div id="ehf-romaneios-list" class="ehf-romaneios-list"><div class="ehf-romaneio-empty">Carregando romaneios...</div></div>`;
    const session=document.getElementById('bip-session-panel');
    if(session && session.parentNode) session.parentNode.insertBefore(panel, session.nextSibling); else bip.prepend(panel);
    panel.querySelector('#ehf-romaneio-refresh')?.addEventListener('click',()=>loadRomaneios(true));
    panel.querySelector('#ehf-romaneio-save-now')?.addEventListener('click',()=>{ if(typeof window.ehfSalvarRomaneioAtual==='function') window.ehfSalvarRomaneioAtual('EM_ANDAMENTO'); setTimeout(()=>loadRomaneios(true),2500); });
    panel.querySelector('#ehf-romaneio-toggle')?.addEventListener('click',()=>setCollapsed(panel, !panel.classList.contains('ehf-romaneios-collapsed')));
    setCollapsed(panel, getCollapsed());
    return panel;
  }

  function readLocalFallback(){
    const out=[];
    try{
      const last=JSON.parse(localStorage.getItem('ehf_ultimo_romaneio_payload')||'null');
      if(last && last.romaneio) out.push(normalizeRow(last.romaneio));
    }catch(_){}
    try{
      const pend=JSON.parse(localStorage.getItem('ehf_romaneios_pendentes')||'[]');
      (Array.isArray(pend)?pend:[]).forEach(p=>{ if(p && p.romaneio) out.push(normalizeRow(p.romaneio)); });
    }catch(_){}
    const seen=new Set();
    return out.filter(r=>{ const k=r.key||r.arquivo; if(!k||seen.has(k)) return false; seen.add(k); return true; });
  }

  function renderRows(rows, list, warning){
    rows = (rows||[]).map(normalizeRow).filter(r=>r.key||r.arquivo);
    if(!rows.length){ list.innerHTML=`<div class="ehf-romaneio-empty ${warning?'ehf-romaneio-error':''}">${warning ? esc(warning) : 'Nenhum romaneio salvo neste mês ainda.'}</div>`; return; }
    const totals = rows.reduce((acc,r)=>{ acc.romaneios++; acc.leituras+=number(r.leituras); acc.pedidos+=number(r.pedidos); acc.divergentes+=number(r.divergentes); return acc; }, {romaneios:0,leituras:0,pedidos:0,divergentes:0});
    const warnHtml = warning ? `<div class="ehf-romaneio-empty ehf-romaneio-error">${esc(warning)}<br>Mostrando cache local deste aparelho.</div>` : '';
    const summary = `<div class="ehf-romaneio-month-summary"><div class="sum"><span>Romaneios</span><b>${totals.romaneios}</b></div><div class="sum"><span>Leituras</span><b>${totals.leituras}</b></div><div class="sum"><span>Pedidos</span><b>${totals.pedidos}</b></div><div class="sum bad"><span>Divergências</span><b>${totals.divergentes}</b></div></div>`;
    list.innerHTML=warnHtml+summary+rows.slice(0,30).map((r,i)=>`<div class="ehf-romaneio-item" data-key="${esc(r.key)}"><div><div class="ehf-romaneio-title"><span class="ehf-romaneio-status ${/final/i.test(r.status)?'finalizado':''}">${esc(r.status||'EM ANDAMENTO')}</span>Romaneio ${esc(r.session||r.key||('#'+(i+1)))}</div><div class="ehf-romaneio-meta"><b>${esc(r.canal||'-')}</b> · ${esc(r.coletor||'-')} / ${esc(r.conferente||'-')}<br>${r.leituras} leituras · ${r.pedidos} pedidos · ${r.unidades} unid. · ${r.divergentes} diverg.</div></div><div class="ehf-romaneio-print"><button class="ehf-romaneio-btn" type="button" data-idx="${i}" data-mode="summary">Imprimir resumo</button><button class="ehf-romaneio-btn secondary" type="button" data-idx="${i}" data-mode="complete">Lista completa</button></div></div>`).join('');
    list.querySelectorAll('button[data-idx]').forEach(btn=>btn.addEventListener('click',async()=>{
      const label=btn.textContent;
      try{
        btn.disabled=true;
        btn.textContent = btn.dataset.mode === 'complete' ? 'Carregando lista...' : 'Abrindo...';
        await printRomaneio(rows[Number(btn.dataset.idx)], btn.dataset.mode);
      } finally {
        btn.disabled=false;
        btn.textContent=label;
      }
    }));
    window.EHFRomaneiosSalvosCache=rows;
  }

  async function loadRomaneios(force){
    injectStyle(); const panel=ensurePanel(); if(!panel) return;
    const list=panel.querySelector('#ehf-romaneios-list'); const monthInput=panel.querySelector('#ehf-romaneio-month');
    const mes=(monthInput?.value||monthKey()).trim()||monthKey();
    list.innerHTML='<div class="ehf-romaneio-empty">Buscando romaneios na planilha...</div>';
    try{
      const data=await jsonp('romaneios',{mes,limit:120,data:todayKey()});
      if(!data || data.ok===false) throw new Error(data?.error || data?.detail || 'Resposta inválida da planilha');
      const rows=filterRowsByOperationalDay((data.rows||data.romaneios||[]).map(normalizeRow)).sort((a,b)=>String(b.data||b.inicio||'').localeCompare(String(a.data||a.inicio||'')));
      renderRows(rows, list, rows.length ? '' : 'Nenhum romaneio salvo para o dia operacional atual.');
    }catch(err){
      const local=readLocalFallback();
      renderRows(local, list, (err && err.message) ? err.message : 'Não consegui ler a planilha agora.');
      console.warn('[EHF] Falha ao consultar romaneios na planilha:', err);
    }
  }
  window.EHFLoadRomaneiosSalvos = loadRomaneios;

  function boot(){ injectStyle(); ensurePanel(); setTimeout(()=>loadRomaneios(false),900); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('hashchange',()=>setTimeout(()=>{ if(location.hash.includes('bipagem')) boot(); },300));
  window.addEventListener('ehf:romaneioAtualizado',()=>setTimeout(()=>loadRomaneios(true),1800));
})();
