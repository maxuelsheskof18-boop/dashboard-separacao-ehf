(function(){
  'use strict';
  window.EHFModules=window.EHFModules||{};

  const BUILD='342';
  const state={
    mounted:false,
    loaded:false,
    current:null,
    history:[],
    startedAt:null,
    operator:'',
    alreadyPacked:false,
    packedEvent:null,
    refreshTimer:null,
    currentCode:''
  };

  const DEFAULT_API_BASE='https://atendente-vesco-separacao.2cwhzy.easypanel.host';
  const API_BASE=()=>{
    let value=String(localStorage.getItem('ehf_worker_api_base')||DEFAULT_API_BASE).replace(/\/+$/,'');
    try{
      const parsed=new URL(value);
      const isFrontendHost=parsed.origin===location.origin||/\.vercel\.app$/i.test(parsed.hostname)||/github\.io$/i.test(parsed.hostname);
      if(isFrontendHost){value=DEFAULT_API_BASE;localStorage.setItem('ehf_worker_api_base',value);}
    }catch(_){value=DEFAULT_API_BASE;}
    return value;
  };

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const qty=v=>{
    const n=Number(v||0);
    return Number.isInteger(n)?String(n):n.toLocaleString('pt-BR',{maximumFractionDigits:3});
  };

  function normalize(value){
    const raw=String(value||'').trim();
    if(!raw)return'';
    const m=raw.match(/(?:^|[^0-9])(47\d{8,14})(?:[^0-9]|$)/);
    if(m)return m[1];
    const pack=raw.match(/(?:^|[^0-9])(20\d{13,18})(?:[^0-9]|$)/);
    if(pack)return pack[1];
    const br=raw.match(/\b(BR[A-Z0-9]{8,30})\b/i);
    if(br)return br[1].toUpperCase();
    const tbr=raw.match(/\b(TBR[A-Z0-9-]{6,30})\b/i);
    if(tbr)return tbr[1].toUpperCase();
    const tokens=raw.match(/[A-Za-z0-9_-]{8,40}/g)||[];
    return tokens.sort((a,b)=>b.length-a.length)[0]||raw.replace(/[^A-Za-z0-9_-]/g,'');
  }

  function operationalDate(){
    const input=document.getElementById('dataSelecionada')||document.querySelector('[data-operational-date]');
    const fromInput=String(input?.value||'').trim();
    return fromInput||localStorage.getItem('ehf_data_operacional')||dateKey(new Date());
  }

  function parseDate(value){
    if(!value)return null;
    if(value instanceof Date)return Number.isNaN(value.getTime())?null:value;
    if(typeof value==='number'){
      const d=new Date(value);
      return Number.isNaN(d.getTime())?null:d;
    }
    const text=String(value).trim();
    if(!text)return null;
    const br=text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if(br){
      const d=new Date(Number(br[3]),Number(br[2])-1,Number(br[1]),Number(br[4]||0),Number(br[5]||0),Number(br[6]||0));
      return Number.isNaN(d.getTime())?null:d;
    }
    const sql=text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if(sql){
      const d=new Date(`${sql[1]}-${sql[2]}-${sql[3]}T${sql[4]}:${sql[5]}:${sql[6]||'00'}-03:00`);
      return Number.isNaN(d.getTime())?null:d;
    }
    const d=new Date(text);
    return Number.isNaN(d.getTime())?null:d;
  }

  function dateKey(value){
    const d=value instanceof Date?value:parseDate(value);
    if(!d)return'';
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{
        timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'
      }).formatToParts(d);
      const map={};parts.forEach(p=>map[p.type]=p.value);
      return `${map.year}-${map.month}-${map.day}`;
    }catch(_){
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
  }

  function formatTime(value){
    const d=parseDate(value);
    return d?d.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'--';
  }

  function formatDateTime(value){
    const d=parseDate(value);
    return d?d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'--';
  }

  function injectStyles(){
    if(document.getElementById('ehfm-pack-v342-style'))return;
    const style=document.createElement('style');
    style.id='ehfm-pack-v342-style';
    style.textContent=`
      .ehfm-pack-visual-note{display:flex;align-items:center;gap:8px;color:#9aa0aa;font-size:11px}.ehfm-pack-visual-note b{color:#fff}
      .ehfm-items.visual{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:12px}
      .ehfm-product-card{position:relative;display:grid;grid-template-columns:122px 1fr;gap:13px;min-height:142px;background:#0b1017;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:11px;overflow:hidden}
      .ehfm-product-card:hover{border-color:rgba(255,138,0,.42)}
      .ehfm-product-image{position:relative;width:122px;height:122px;border-radius:10px;overflow:hidden;background:#fff;border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center}
      .ehfm-product-image img{width:100%;height:100%;object-fit:contain;display:block;background:#fff}
      .ehfm-product-image.loading:after{content:'BUSCANDO FOTO';position:absolute;inset:auto 4px 4px;background:rgba(0,0,0,.72);color:#fff;font-size:8px;text-align:center;border-radius:5px;padding:4px}
      .ehfm-product-image.no-image{background:#101722;color:#7f8a98}.ehfm-product-image.no-image:before{content:'SEM FOTO NO TINY';font-size:9px;font-weight:900;letter-spacing:.4px;text-align:center;padding:8px}
      .ehfm-product-card .ehfm-product-copy{min-width:0;display:flex;flex-direction:column}.ehfm-product-card .ehfm-product-qty{position:absolute;left:8px;top:8px;z-index:2;min-width:36px;height:36px;padding:0 9px;border-radius:999px;background:#ff8a00;color:#050505;font-weight:950;font-size:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 18px rgba(0,0,0,.32)}
      .ehfm-product-card .ehfm-product-sku{color:#92a0b2;font-size:10px;font-weight:800;word-break:break-word}.ehfm-product-card .ehfm-product-name{display:block;margin-top:5px;color:#fff;font-size:14px;line-height:1.25}.ehfm-product-card .ehfm-product-location{display:inline-flex;align-self:flex-start;margin-top:auto;background:#161f2c;color:#c6d0dc;border-radius:7px;padding:5px 7px;font-size:10px}.ehfm-product-card .ehfm-product-unit{margin-top:5px;color:#8d99a9;font-size:9px}
      .ehfm-order.locked{border-color:rgba(239,68,68,.42)}.ehfm-order.locked .ehfm-order-head:after{content:'JÁ EMBALADA';background:rgba(127,29,29,.42);color:#fecaca;border:1px solid rgba(239,68,68,.45);border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900}
      .ehfm-packed-info{display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px;padding:12px;border-radius:11px;background:rgba(127,29,29,.22);border:1px solid rgba(239,68,68,.48)}.ehfm-packed-info.show{display:grid}.ehfm-packed-info div{display:flex;flex-direction:column;gap:3px}.ehfm-packed-info span{color:#fca5a5;font-size:9px;text-transform:uppercase;font-weight:900}.ehfm-packed-info b{color:#fff;font-size:12px;word-break:break-word}
      .ehfm-history-code{font-weight:900;color:#ffb04a;white-space:nowrap}.ehfm-history-error{color:#fca5a5!important}.ehfm-history-sub{display:block;color:#8190a1;font-size:9px;margin-top:2px}
      @media(max-width:700px){.ehfm-items.visual{grid-template-columns:1fr}.ehfm-product-card{grid-template-columns:94px 1fr;min-height:114px}.ehfm-product-image{width:94px;height:94px}.ehfm-packed-info{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureOperator(force=false){
    let name=force?'':localStorage.getItem('ehf_operador');
    if(!name)name=prompt('Quem está realizando a embalagem?')||'GERAL';
    state.operator=String(name).trim().toUpperCase()||'GERAL';
    localStorage.setItem('ehf_operador',state.operator);
    if($('ehfm-pack-operator'))$('ehfm-pack-operator').textContent=state.operator;
  }

  function mount(){
    if(state.mounted)return;
    state.mounted=true;
    injectStyles();
    const root=$('ehf-embalagem-module');
    if(!root)return;

    root.innerHTML=`
      <section class="ehfm-page" id="ehfm-pack-page">
        <header class="ehfm-head"><div><h2>Conferência de Embalagem</h2><p>Leia a etiqueta, confira visualmente os produtos e finalize sem sair do painel principal.</p></div><div class="ehfm-actions"><button class="ehfm-btn" id="ehfm-pack-change-user">Operador: <b id="ehfm-pack-operator">--</b></button></div></header>
        <div id="ehfm-pack-alert" class="ehfm-alert"></div>
        <section class="ehfm-scan-panel"><div class="ehfm-head"><div><h3 style="margin:0">Leitor de etiqueta</h3><p>O leitor deve enviar Enter após o código.</p></div><span id="ehfm-pack-last" class="ehfm-sub">Nenhuma leitura nesta sessão</span></div><div class="ehfm-scan-row"><input id="ehfm-pack-input" class="ehfm-scan-input" autocomplete="off" placeholder="BIPE A ETIQUETA OU DIGITE O CÓDIGO"><button id="ehfm-pack-search" class="ehfm-btn primary">Localizar pedido</button></div><div id="ehfm-pack-status" class="ehfm-scan-status">Pronto para leitura</div></section>
        <div class="ehfm-pack-metrics"><div class="ehfm-metric"><span>Embalados hoje</span><b id="ehfm-pack-total">0</b></div><div class="ehfm-metric"><span>Em conferência</span><b id="ehfm-pack-pending">0</b></div><div class="ehfm-metric"><span>Por este operador</span><b id="ehfm-pack-mine">0</b></div><div class="ehfm-metric"><span>Última embalagem</span><b id="ehfm-pack-last-time">--:--</b></div></div>
        <section class="ehfm-panel" id="ehfm-pack-empty"><div class="ehfm-empty"><b>Aguardando uma etiqueta</b><span class="ehfm-sub">O pedido, as quantidades e as fotos dos produtos aparecerão aqui.</span></div></section>
        <section class="ehfm-panel ehfm-order" id="ehfm-pack-order">
          <div id="ehfm-pack-packed-info" class="ehfm-packed-info"><div><span>Status</span><b id="ehfm-packed-status">EMBALADO</b></div><div><span>Embalado por</span><b id="ehfm-packed-operator">--</b></div><div><span>Data e horário</span><b id="ehfm-packed-time">--</b></div><div><span>Etiqueta registrada</span><b id="ehfm-packed-code">--</b></div></div>
          <div class="ehfm-order-head"><div><h3>Pedido <span id="ehfm-order-number">--</span></h3><span class="ehfm-sub"><b id="ehfm-order-store">--</b> · <span id="ehfm-order-customer">--</span></span></div><span class="ehfm-badge" id="ehfm-order-status">--</span></div>
          <div class="ehfm-order-meta"><div><span>Pedido e-commerce</span><b id="ehfm-order-ecommerce">--</b></div><div><span>Rastreio / etiqueta</span><b id="ehfm-order-tracking">--</b></div><div><span>Forma de envio</span><b id="ehfm-order-shipping">--</b></div><div><span>Separação Tiny</span><b id="ehfm-order-separation">--</b></div></div>
          <div class="ehfm-head"><div><h3 style="margin:0">Conferência visual dos produtos</h3><p><b id="ehfm-item-lines">0</b> produtos · <b id="ehfm-item-units">0</b> unidades</p></div><div class="ehfm-pack-visual-note"><b>Sem caixas de seleção.</b> Confira foto, SKU, descrição e quantidade.</div></div>
          <div id="ehfm-pack-items" class="ehfm-items visual"></div>
          <div class="ehfm-head" style="margin-top:14px"><div><b id="ehfm-pack-ready-text">Produtos exibidos para conferência</b></div><div class="ehfm-actions"><button id="ehfm-pack-cancel" class="ehfm-btn danger">Nova leitura</button><button id="ehfm-pack-confirm" class="ehfm-btn success" disabled>Confirmar embalagem</button></div></div>
        </section>
        <section class="ehfm-panel"><div class="ehfm-head"><div><h3 style="margin:0">Histórico de embalagem do dia</h3><p>Inclui etiqueta, pedido, operador e horário registrados no Easypanel.</p></div><button class="ehfm-btn" id="ehfm-pack-history-refresh">Atualizar histórico</button></div><div class="ehfm-table-wrap ehfm-history"><table class="ehfm-table" style="min-width:1040px"><thead><tr><th>Início</th><th>Fim</th><th>Etiqueta</th><th>Loja</th><th>Pedido</th><th>Operador</th><th>Status</th></tr></thead><tbody id="ehfm-pack-history"><tr><td colspan="7" class="ehfm-empty">Carregando histórico...</td></tr></tbody></table></div></section>
      </section>`;

    $('ehfm-pack-search').onclick=lookup;
    $('ehfm-pack-input').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();lookup();}};
    $('ehfm-pack-change-user').onclick=()=>ensureOperator(true);
    $('ehfm-pack-cancel').onclick=reset;
    $('ehfm-pack-confirm').onclick=complete;
    $('ehfm-pack-history-refresh').onclick=()=>loadHistory(true);
    ensureOperator();
  }

  function alertBox(text,type=''){
    const el=$('ehfm-pack-alert');if(!el)return;
    el.textContent=text||'';
    el.className='ehfm-alert'+(text?' show':'')+(type==='ok'?' ok':'');
  }
  function setStatus(text){if($('ehfm-pack-status'))$('ehfm-pack-status').textContent=text;}

  function showPackedInfo(event,code){
    state.packedEvent=event||null;
    const box=$('ehfm-pack-packed-info');
    if(!box)return;
    if(!event){box.classList.remove('show');return;}
    box.classList.add('show');
    $('ehfm-packed-status').textContent=String(event.status||'EMBALADO').toUpperCase();
    $('ehfm-packed-operator').textContent=event.operator||event.operador||'NÃO INFORMADO';
    $('ehfm-packed-time').textContent=formatDateTime(event.finished_at||event.finishedAt||event.started_at||event.startedAt);
    $('ehfm-packed-code').textContent=event.normalized_code||event.scanned_code||event.codigo||code||'--';
  }

  function reset(){
    state.current=null;state.startedAt=null;state.alreadyPacked=false;state.packedEvent=null;state.currentCode='';
    $('ehfm-pack-order')?.classList.remove('show','locked');
    showPackedInfo(null);
    if($('ehfm-pack-empty'))$('ehfm-pack-empty').style.display='block';
    if($('ehfm-pack-input')){$('ehfm-pack-input').disabled=false;$('ehfm-pack-input').value='';}
    if($('ehfm-pack-search'))$('ehfm-pack-search').disabled=false;
    if($('ehfm-pack-confirm'))$('ehfm-pack-confirm').disabled=true;
    alertBox('');setStatus('Pronto para leitura');renderHistory();
    setTimeout(()=>$('ehfm-pack-input')?.focus(),40);
  }

  function directImage(item){
    return String(item?.imagem||item?.imageUrl||item?.image_url||item?.thumbnail||item?.foto||'').trim();
  }

  function proxyImage(item,account){
    const sku=String(item?.codigo||item?.sku||'').trim();
    if(!sku||!account)return'';
    return API_BASE()+'/api/produtos/imagem/proxy?account='+encodeURIComponent(account)+'&sku='+encodeURIComponent(sku)+'&description='+encodeURIComponent(item?.descricao||item?.description||'')+'&v='+BUILD;
  }

  function renderProductCard(item,index,account){
    const proxy=proxyImage(item,account);
    const fallback=directImage(item);
    const src=proxy||fallback;
    return `<article class="ehfm-product-card" data-item-index="${index}"><div class="ehfm-product-qty">${esc(qty(item.quantidade))}×</div><div class="ehfm-product-image ${src?'loading':'no-image'}" data-product-image="${index}">${src?`<img src="${esc(src)}" data-fallback="${esc(fallback)}" data-tried-fallback="0" alt="${esc(item.descricao||'Produto')}" loading="eager" referrerpolicy="no-referrer">`:''}</div><div class="ehfm-product-copy"><span class="ehfm-product-sku">${esc(item.codigo||'SEM SKU')}</span><b class="ehfm-product-name">${esc(item.descricao||'Produto')}</b>${item.unidade?`<span class="ehfm-product-unit">Unidade: ${esc(item.unidade)}</span>`:''}<span class="ehfm-product-location">${esc(item.localizacao?'Local: '+item.localizacao:'Local não informado')}</span></div></article>`;
  }

  function markImageUnavailable(box){
    if(!box)return;box.classList.remove('loading');box.classList.add('no-image');box.innerHTML='';
  }

  function bindImages(){
    document.querySelectorAll('#ehfm-pack-items .ehfm-product-image img').forEach(img=>{
      img.addEventListener('load',()=>img.closest('.ehfm-product-image')?.classList.remove('loading'),{once:true});
      img.addEventListener('error',()=>{
        const fallback=String(img.dataset.fallback||'');
        if(fallback&&img.dataset.triedFallback!=='1'&&fallback!==img.src){
          img.dataset.triedFallback='1';img.src=fallback;return;
        }
        markImageUnavailable(img.closest('.ehfm-product-image'));
      });
    });
  }

  function renderOrder(data,event=null){
    state.current=data;state.startedAt=new Date().toISOString();state.alreadyPacked=Boolean(data.alreadyPacked||event);state.packedEvent=event||data.event||null;
    $('ehfm-pack-empty').style.display='none';$('ehfm-pack-order').classList.add('show');$('ehfm-pack-order').classList.toggle('locked',state.alreadyPacked);
    const pedido=data.pedido||{},sep=data.separacao||{};
    $('ehfm-order-number').textContent=pedido.numero||pedido.tinyNumber||'--';$('ehfm-order-store').textContent=data.lojaNome||data.storeName||data.lojaKey||'--';$('ehfm-order-customer').textContent=pedido.cliente||pedido.customer||'Cliente não informado';$('ehfm-order-status').textContent=sep.situacaoTexto||sep.statusName||'--';$('ehfm-order-ecommerce').textContent=pedido.numeroEcommerce||pedido.ecommerceOrderId||'--';$('ehfm-order-tracking').textContent=pedido.codigoRastreamento||pedido.trackingCode||data.codigoLido||state.currentCode||'--';$('ehfm-order-shipping').textContent=pedido.formaEnvio||pedido.formaFrete||pedido.shippingMethodName||'--';$('ehfm-order-separation').textContent=sep.id||sep.idSeparacao||'--';
    const items=Array.isArray(data.itens)?data.itens:[];const units=data.totalUnidades??items.reduce((a,i)=>a+Number(i.quantidade||0),0);$('ehfm-item-lines').textContent=data.totalLinhas??items.length;$('ehfm-item-units').textContent=qty(units);$('ehfm-pack-items').innerHTML=items.map((item,index)=>renderProductCard(item,index,data.lojaKey||data.conta||'')).join('');bindImages();
    showPackedInfo(state.packedEvent,state.currentCode);
    $('ehfm-pack-confirm').disabled=state.alreadyPacked||!items.length;
    $('ehfm-pack-ready-text').textContent=state.alreadyPacked?'Esta etiqueta já foi embalada. Pedido aberto somente para consulta.':`${items.length} produto(s) exibido(s). Confira visualmente e confirme.`;
    renderHistory();
  }

  async function fetchJson(url,options={}){
    const response=await fetch(url,{cache:'no-store',headers:{Accept:'application/json',...(options.headers||{})},...options});
    const data=await response.json().catch(()=>({ok:false,error:'Resposta inválida da API'}));
    return {response,data};
  }

  async function lookup(){
    const raw=$('ehfm-pack-input').value.trim();if(!raw||state.current)return;
    const code=normalize(raw);state.currentCode=code;$('ehfm-pack-input').value=code;$('ehfm-pack-input').disabled=true;$('ehfm-pack-search').disabled=true;alertBox('');setStatus('Localizando pedido, produtos e histórico da etiqueta...');
    try{
      const checkPromise=fetchJson(API_BASE()+'/api/packing/check?codigo='+encodeURIComponent(code)).catch(()=>({response:{ok:false},data:{}}));
      let lookupResult=await fetchJson(API_BASE()+'/api/embalagem/buscar?codigo='+encodeURIComponent(code));
      if((!lookupResult.response.ok||lookupResult.data.ok===false)&&!lookupResult.data.alreadyPacked&&/^47\d{8,14}$/.test(code)){
        fetch(API_BASE()+'/api/sync/labels/full',{method:'POST'}).catch(()=>{});await new Promise(r=>setTimeout(r,3500));lookupResult=await fetchJson(API_BASE()+'/api/embalagem/buscar?codigo='+encodeURIComponent(code));
      }
      const check=await checkPromise;const duplicateEvent=lookupResult.data.event||check.data.event||null;const alreadyPacked=Boolean(lookupResult.data.alreadyPacked||check.data.alreadyPacked||duplicateEvent);
      if(!lookupResult.response.ok||lookupResult.data.ok===false){
        if(alreadyPacked){
          showPackedInfo(duplicateEvent,code);await loadHistory(true,duplicateEvent);throw new Error(`ETIQUETA JÁ EMBALADA${duplicateEvent?.operator?' por '+duplicateEvent.operator:''}${duplicateEvent?.finished_at?' em '+formatDateTime(duplicateEvent.finished_at):''}. O pedido não foi encontrado no cache para exibir os produtos.`);
        }
        throw new Error(lookupResult.data.message||lookupResult.data.error||`HTTP ${lookupResult.response.status}`);
      }
      const data={...lookupResult.data,alreadyPacked,event:duplicateEvent};
      if(!Array.isArray(data.itens)||!data.itens.length)throw new Error('Pedido localizado, mas os produtos ainda não foram processados. Execute a sincronização de produtos no Easypanel.');
      renderOrder(data,duplicateEvent);$('ehfm-pack-last').textContent=`Última leitura: ${code} · ${new Date().toLocaleTimeString('pt-BR')}`;
      if(alreadyPacked){alertBox(`ETIQUETA JÁ EMBALADA${duplicateEvent?.operator?' por '+duplicateEvent.operator:''}${duplicateEvent?.finished_at?' em '+formatDateTime(duplicateEvent.finished_at):''}. Pedido aberto somente para consulta.`);setStatus('Consulta exibida. Nova confirmação bloqueada.');}
      else setStatus('Pedido localizado. Confira foto, SKU, descrição e quantidade.');
      await loadHistory(false,duplicateEvent);
    }catch(error){
      alertBox(error.message||String(error));setStatus(state.packedEvent?'Etiqueta já embalada. Registro exibido acima.':'Etiqueta não localizada.');
      if(!state.current){$('ehfm-pack-input').disabled=false;$('ehfm-pack-search').disabled=false;$('ehfm-pack-input').focus();$('ehfm-pack-input').select();}
    }
  }

  function mergeEvent(event){
    if(!event)return;
    const code=normalize(event.normalized_code||event.scanned_code||event.codigo||'');
    const id=event.id;
    const exists=state.history.some(row=>(id&&row.id===id)||(code&&normalize(row.normalized_code||row.scanned_code||row.codigo||'')===code&&String(row.finished_at||'')===String(event.finished_at||'')));
    if(!exists)state.history.unshift(event);
  }

  async function complete(){
    if(!state.current||state.alreadyPacked||$('ehfm-pack-confirm').disabled)return;
    const button=$('ehfm-pack-confirm');button.disabled=true;setStatus('Registrando a embalagem...');
    try{
      const data=state.current;const code=data.codigoLido||state.currentCode||normalize($('ehfm-pack-input').value);const payload={operator:state.operator,operador:state.operator,scannedCode:code,codigo:code,account:data.lojaKey||data.conta,conta:data.lojaKey||data.conta,orderId:data.pedido?.id||data.pedido?.tinyOrderId,pedidoId:data.pedido?.id||data.pedido?.tinyOrderId,separationId:data.separacao?.id||data.separacao?.idSeparacao,separacaoId:data.separacao?.id||data.separacao?.idSeparacao,items:data.itens,itens:data.itens,startedAt:state.startedAt};
      const completeResponse=await fetchJson(API_BASE()+'/api/packing/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const response=completeResponse.response;
      const result=completeResponse.data;
      if(!response.ok||result.ok===false){
        if(result?.alreadyPacked||result?.error==='ETIQUETA_JA_EMBALADA'){mergeEvent(result.event);state.alreadyPacked=true;showPackedInfo(result.event,code);renderHistory();throw new Error(`ETIQUETA JÁ EMBALADA${result.event?.operator?' por '+result.event.operator:''}${result.event?.finished_at?' em '+formatDateTime(result.event.finished_at):''}.`);}
        throw new Error(result.message||result.error||`HTTP ${response.status}`);
      }
      mergeEvent(result.event);state.alreadyPacked=true;showPackedInfo(result.event,code);$('ehfm-pack-order').classList.add('locked');alertBox(`Pedido ${data.pedido?.numero||''} embalado com sucesso por ${state.operator}.`,'ok');setStatus(`Embalagem registrada por ${state.operator} às ${formatTime(result.event?.finished_at||new Date())}.`);renderHistory();await loadHistory(false,result.event);setTimeout(reset,2200);
    }catch(error){alertBox(error.message||String(error));button.disabled=state.alreadyPacked;setStatus(state.alreadyPacked?'Etiqueta já embalada. Nova confirmação bloqueada.':'Falha ao registrar a embalagem.');}
  }

  function normalizeHistory(data){
    const candidates=[data?.rows,data?.events,data?.records,data?.history,data?.produtividade,Array.isArray(data)?data:null];
    return candidates.find(Array.isArray)||[];
  }

  async function loadHistory(showError=false,extraEvent=null){
    if(extraEvent)mergeEvent(extraEvent);
    try{
      const {response,data}=await fetchJson(API_BASE()+'/api/packing/history?limit=1000&_='+Date.now());
      if(!response.ok||data.ok===false)throw new Error(data.error||`HTTP ${response.status}`);
      state.history=normalizeHistory(data);if(extraEvent)mergeEvent(extraEvent);state.loaded=true;renderHistory();
    }catch(error){
      renderHistory(error.message||String(error));
      if(showError)alertBox('Não foi possível carregar o histórico: '+(error.message||String(error)));
    }
  }

  function renderHistory(error=''){
    const targetDate=operationalDate();
    const normalized=state.history.map(row=>({
      ...row,
      operator:row.operator||row.operador||row.usuario||'',
      normalized_code:normalize(row.normalized_code||row.scanned_code||row.codigo||row.etiqueta||''),
      started_at:row.started_at||row.startedAt||row.iniciado_em||row.created_at||'',
      finished_at:row.finished_at||row.finishedAt||row.completed_at||row.completedAt||row.finalizado_em||row.started_at||row.startedAt||'',
      status:String(row.status||row.situacao||'EMBALADO').toUpperCase()
    })).sort((a,b)=>(parseDate(b.finished_at)?.getTime()||0)-(parseDate(a.finished_at)?.getTime()||0));
    const rows=normalized.filter(row=>dateKey(row.finished_at||row.started_at)===targetDate);
    const body=$('ehfm-pack-history');if(!body)return;
    if(error)body.innerHTML=`<tr><td colspan="7" class="ehfm-empty ehfm-history-error">Histórico indisponível: ${esc(error)}</td></tr>`;
    else body.innerHTML=rows.length?rows.map(row=>{const order=row.tiny_number||row.ecommerce_order_id||row.pedidoId||row.order_id||'--';return `<tr><td>${esc(formatTime(row.started_at))}</td><td>${esc(formatTime(row.finished_at))}</td><td class="ehfm-history-code">${esc(row.normalized_code||'--')}</td><td>${esc(row.account||row.conta||'--')}</td><td>${esc(order)}${row.ecommerce_order_id&&row.tiny_number?`<span class="ehfm-history-sub">ML ${esc(row.ecommerce_order_id)}</span>`:''}</td><td>${esc(row.operator||'NÃO INFORMADO')}</td><td>${esc(row.status)}</td></tr>`;}).join(''):'<tr><td colspan="7" class="ehfm-empty">Sem registros para a data operacional selecionada.</td></tr>';
    const valid=rows.filter(row=>!['CANCELADA','CANCELADO'].includes(row.status));const mine=valid.filter(row=>String(row.operator||'').toUpperCase()===state.operator);$('ehfm-pack-total').textContent=valid.length;$('ehfm-pack-pending').textContent=state.current&&!state.alreadyPacked?1:0;$('ehfm-pack-mine').textContent=mine.length;const last=valid[0];$('ehfm-pack-last-time').textContent=last?formatTime(last.finished_at||last.started_at).slice(0,5):'--:--';
  }

  function activate(){
    mount();ensureOperator();loadHistory(false);clearInterval(state.refreshTimer);state.refreshTimer=setInterval(()=>{if(location.hash==='#embalagem')loadHistory(false);},15000);setTimeout(()=>{if(!state.current)$('ehfm-pack-input')?.focus()},80);
  }

  window.EHFModules.embalagem={activate,reset,refresh:()=>loadHistory(true)};
  document.addEventListener('DOMContentLoaded',mount);
})();
