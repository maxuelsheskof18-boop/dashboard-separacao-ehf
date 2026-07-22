(function(){
  window.EHFModules=window.EHFModules||{};

  const state={
    mounted:false,
    loaded:false,
    current:null,
    history:[],
    startedAt:null,
    operator:'',
    alreadyPacked:false
  };

  const API_BASE=()=>String(
    window.EHF_TINY_WORKER_BASE||
    localStorage.getItem('ehf_worker_api_base')||
    localStorage.getItem('ehf_summary_api_base')||
    'https://atendente-vesco-tiny-worker.2cwhzy.easypanel.host'
  ).replace(/\/+$/,'');

  const PLANILHA_APP_URL=()=>String(
    window.EHF_PLANILHA_APP_URL||
    localStorage.getItem('ehf_planilha_app_url')||
    'https://script.google.com/macros/s/AKfycbwQ8-Rn-zZJQM0fLm9js3ErtJZefRnHP55E3M0r3Z_TIXS_skTioZ6p3yHqTLFYxPU9/exec'
  ).replace(/\/+$/,'');

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

  function planilhaLookupUrl(code){
    const base=PLANILHA_APP_URL();
    if(!base)return'';
    return base+'?action=buscarSeparacao&codigo='+encodeURIComponent(code)+'&live=1&ts='+Date.now();
  }

  async function registrarFaltaNaPlanilha(code){
    try{
      const base=PLANILHA_APP_URL();
      if(!base)return;
      await fetch(base+'?action=debugCodigo&codigo='+encodeURIComponent(code)+'&ts='+Date.now(),{cache:'no-store'});
    }catch(_){}
  }

  function injectStyles(){
    if(document.getElementById('ehfm-pack-v339-style'))return;
    const style=document.createElement('style');
    style.id='ehfm-pack-v339-style';
    style.textContent=`
      .ehfm-pack-visual-note{display:flex;align-items:center;gap:8px;color:#9aa0aa;font-size:11px}
      .ehfm-pack-visual-note b{color:#fff}
      .ehfm-items.visual{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:12px}
      .ehfm-product-card{position:relative;display:grid;grid-template-columns:112px 1fr;gap:13px;min-height:132px;background:#0b1017;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:11px;overflow:hidden}
      .ehfm-product-card:hover{border-color:rgba(255,138,0,.42)}
      .ehfm-product-image{position:relative;width:112px;height:112px;border-radius:10px;overflow:hidden;background:#fff;border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center}
      .ehfm-product-image img{width:100%;height:100%;object-fit:contain;display:block;background:#fff}
      .ehfm-product-image.loading:after{content:'Carregando foto';position:absolute;inset:auto 4px 4px;background:rgba(0,0,0,.72);color:#fff;font-size:8px;text-align:center;border-radius:5px;padding:3px}
      .ehfm-product-image.no-image{background:#101722;color:#7f8a98}
      .ehfm-product-image.no-image:before{content:'SEM FOTO';font-size:10px;font-weight:900;letter-spacing:.5px}
      .ehfm-product-card .ehfm-product-copy{min-width:0;display:flex;flex-direction:column}
      .ehfm-product-card .ehfm-product-qty{position:absolute;left:8px;top:8px;z-index:2;min-width:34px;height:34px;padding:0 8px;border-radius:999px;background:#ff8a00;color:#050505;font-weight:950;font-size:15px;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 18px rgba(0,0,0,.32)}
      .ehfm-product-card .ehfm-product-sku{color:#92a0b2;font-size:10px;font-weight:800;word-break:break-word}
      .ehfm-product-card .ehfm-product-name{display:block;margin-top:5px;color:#fff;font-size:14px;line-height:1.25}
      .ehfm-product-card .ehfm-product-location{display:inline-flex;align-self:flex-start;margin-top:auto;background:#161f2c;color:#c6d0dc;border-radius:7px;padding:5px 7px;font-size:10px}
      .ehfm-product-card .ehfm-product-unit{margin-top:5px;color:#8d99a9;font-size:9px}
      .ehfm-product-image-status{margin-top:6px;color:#7f8a98;font-size:9px;font-weight:700}
      .ehfm-product-image-status[data-status=ok]{color:#86efac}
      .ehfm-product-image-status[data-status=error]{color:#fca5a5}
      .ehfm-order.locked{border-color:rgba(239,68,68,.42)}
      .ehfm-order.locked .ehfm-order-head:after{content:'JÁ EMBALADA';background:rgba(127,29,29,.42);color:#fecaca;border:1px solid rgba(239,68,68,.45);border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900}
      .ehfm-history-code{font-weight:900;color:#ffb04a;white-space:nowrap}
      @media(max-width:700px){
        .ehfm-items.visual{grid-template-columns:1fr}
        .ehfm-product-card{grid-template-columns:90px 1fr;min-height:110px}
        .ehfm-product-image{width:90px;height:90px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOperator(force=false){
    let name=force?'':localStorage.getItem('ehf_operador');
    if(!name)name=prompt('Quem está realizando a embalagem?')||'GERAL';
    state.operator=String(name).trim().toUpperCase()||'GERAL';
    localStorage.setItem('ehf_operador',state.operator);
    const el=$('ehfm-pack-operator');
    if(el)el.textContent=state.operator;
  }

  function mount(){
    if(state.mounted)return;
    state.mounted=true;
    injectStyles();
    const root=$('ehf-embalagem-module');
    if(!root)return;

    root.innerHTML=`
      <section class="ehfm-page" id="ehfm-pack-page">
        <header class="ehfm-head">
          <div>
            <h2>Conferência de Embalagem</h2>
            <p>Leia a etiqueta, confira visualmente os produtos e finalize sem sair do painel principal.</p>
          </div>
          <div class="ehfm-actions">
            <button class="ehfm-btn" id="ehfm-pack-change-user">Operador: <b id="ehfm-pack-operator">--</b></button>
          </div>
        </header>

        <div id="ehfm-pack-alert" class="ehfm-alert"></div>

        <section class="ehfm-scan-panel">
          <div class="ehfm-head">
            <div>
              <h3 style="margin:0">Leitor de etiqueta</h3>
              <p>O leitor deve enviar Enter após o código.</p>
            </div>
            <span id="ehfm-pack-last" class="ehfm-sub">Nenhuma leitura nesta sessão</span>
          </div>
          <div class="ehfm-scan-row">
            <input id="ehfm-pack-input" class="ehfm-scan-input" autocomplete="off" placeholder="BIPE A ETIQUETA OU DIGITE O CÓDIGO">
            <button id="ehfm-pack-search" class="ehfm-btn primary">Localizar pedido</button>
          </div>
          <div id="ehfm-pack-status" class="ehfm-scan-status">Pronto para leitura</div>
        </section>

        <div class="ehfm-pack-metrics">
          <div class="ehfm-metric"><span>Embalados hoje</span><b id="ehfm-pack-total">0</b></div>
          <div class="ehfm-metric"><span>Em conferência</span><b id="ehfm-pack-pending">0</b></div>
          <div class="ehfm-metric"><span>Por este operador</span><b id="ehfm-pack-mine">0</b></div>
          <div class="ehfm-metric"><span>Última embalagem</span><b id="ehfm-pack-last-time">--:--</b></div>
        </div>

        <section class="ehfm-panel" id="ehfm-pack-empty">
          <div class="ehfm-empty">
            <b>Aguardando uma etiqueta</b>
            <span class="ehfm-sub">O pedido, as quantidades e as fotos dos produtos aparecerão aqui.</span>
          </div>
        </section>

        <section class="ehfm-panel ehfm-order" id="ehfm-pack-order">
          <div class="ehfm-order-head">
            <div>
              <h3>Pedido <span id="ehfm-order-number">--</span></h3>
              <span class="ehfm-sub"><b id="ehfm-order-store">--</b> · <span id="ehfm-order-customer">--</span></span>
            </div>
            <span class="ehfm-badge" id="ehfm-order-status">--</span>
          </div>

          <div class="ehfm-order-meta">
            <div><span>Pedido e-commerce</span><b id="ehfm-order-ecommerce">--</b></div>
            <div><span>Rastreio / etiqueta</span><b id="ehfm-order-tracking">--</b></div>
            <div><span>Forma de envio</span><b id="ehfm-order-shipping">--</b></div>
            <div><span>Separação Tiny</span><b id="ehfm-order-separation">--</b></div>
          </div>

          <div class="ehfm-head">
            <div>
              <h3 style="margin:0">Conferência visual dos produtos</h3>
              <p><b id="ehfm-item-lines">0</b> produtos · <b id="ehfm-item-units">0</b> unidades</p>
            </div>
            <div class="ehfm-pack-visual-note"><b>Sem caixas de seleção.</b> Confira foto, SKU, descrição e quantidade.</div>
          </div>

          <div id="ehfm-pack-items" class="ehfm-items visual"></div>

          <div class="ehfm-head" style="margin-top:14px">
            <div><b id="ehfm-pack-ready-text">Produtos exibidos para conferência</b></div>
            <div class="ehfm-actions">
              <button id="ehfm-pack-cancel" class="ehfm-btn danger">Nova leitura</button>
              <button id="ehfm-pack-confirm" class="ehfm-btn success" disabled>Confirmar embalagem</button>
            </div>
          </div>
        </section>

        <section class="ehfm-panel">
          <div class="ehfm-head">
            <div>
              <h3 style="margin:0">Histórico de embalagem do dia</h3>
              <p>Inclui a etiqueta, pedido, operador e horário registrados no Easypanel.</p>
            </div>
            <button class="ehfm-btn" id="ehfm-pack-history-refresh">Atualizar histórico</button>
          </div>
          <div class="ehfm-table-wrap ehfm-history">
            <table class="ehfm-table" style="min-width:980px">
              <thead>
                <tr>
                  <th>Início</th><th>Fim</th><th>Etiqueta</th><th>Loja</th><th>Pedido</th><th>Operador</th><th>Status</th>
                </tr>
              </thead>
              <tbody id="ehfm-pack-history">
                <tr><td colspan="7" class="ehfm-empty">Sem registros.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>`;

    $('ehfm-pack-search').onclick=lookup;
    $('ehfm-pack-input').onkeydown=e=>{
      if(e.key==='Enter'){e.preventDefault();lookup();}
    };
    $('ehfm-pack-change-user').onclick=()=>ensureOperator(true);
    $('ehfm-pack-cancel').onclick=reset;
    $('ehfm-pack-confirm').onclick=complete;
    $('ehfm-pack-history-refresh').onclick=loadHistory;
    document.addEventListener('keydown',e=>{
      const visible=$('ehf-embalagem-module')&&$('ehf-embalagem-module').offsetParent!==null;
      const confirm=$('ehfm-pack-confirm');
      if(visible&&state.current&&!state.alreadyPacked&&confirm&&!confirm.disabled&&e.key==='Enter'){
        e.preventDefault();complete();
      }
    });
    ensureOperator();
  }

  function alert(text,type=''){
    const el=$('ehfm-pack-alert');
    if(!el)return;
    el.textContent=text||'';
    el.className='ehfm-alert'+(text?' show':'')+(type==='ok'?' ok':'');
  }

  function setStatus(text){
    const el=$('ehfm-pack-status');
    if(el)el.textContent=text;
  }

  function reset(){
    state.current=null;
    state.startedAt=null;
    state.alreadyPacked=false;
    $('ehfm-pack-order')?.classList.remove('show','locked');
    if($('ehfm-pack-empty'))$('ehfm-pack-empty').style.display='block';
    if($('ehfm-pack-input')){
      $('ehfm-pack-input').disabled=false;
      $('ehfm-pack-input').value='';
    }
    if($('ehfm-pack-search'))$('ehfm-pack-search').disabled=false;
    if($('ehfm-pack-confirm'))$('ehfm-pack-confirm').disabled=true;
    alert('');
    setStatus('Pronto para leitura');
    renderHistory();
    setTimeout(()=>$('ehfm-pack-input')?.focus(),40);
  }

  function imageFromItem(item){
    return String(item?.imagem||item?.imageUrl||item?.image_url||item?.thumbnail||'').trim();
  }

  function productId(item){
    return String(item?.idProduto||item?.productId||item?.product_id||'').trim();
  }

  function productSku(item){
    return String(item?.codigo||item?.sku||item?.codigoProduto||'').trim();
  }

  function normalizedAccount(account){
    return String(account||'').trim().toLowerCase();
  }

  function productImageMetadataUrl(item,account){
    const sku=productSku(item);
    const id=productId(item);
    const conta=normalizedAccount(account);
    if((!sku&&!id)||!conta)return'';
    return API_BASE()+'/api/produtos/imagem?account='+encodeURIComponent(conta)+
      '&sku='+encodeURIComponent(sku)+'&productId='+encodeURIComponent(id)+
      '&description='+encodeURIComponent(item?.descricao||'');
  }

  function productImageProxy(item,account){
    const sku=productSku(item);
    const id=productId(item);
    const conta=normalizedAccount(account);
    if((!sku&&!id)||!conta)return imageFromItem(item);
    return API_BASE()+'/api/produtos/imagem/arquivo?account='+encodeURIComponent(conta)+
      '&sku='+encodeURIComponent(sku)+'&productId='+encodeURIComponent(id)+
      '&description='+encodeURIComponent(item?.descricao||'');
  }

  function renderProductCard(item,index,account){
    const existing=imageFromItem(item);
    const initialImage=existing?(productImageProxy(item,account)||existing):'';
    return `
      <article class="ehfm-product-card" data-item-index="${index}">
        <div class="ehfm-product-qty">${esc(qty(item.quantidade))}×</div>
        <div class="ehfm-product-image loading" data-product-image="${index}">
          ${initialImage?`<img src="${esc(initialImage)}" alt="${esc(item.descricao||'Produto')}" loading="eager" referrerpolicy="no-referrer">`:''}
        </div>
        <div class="ehfm-product-copy">
          <span class="ehfm-product-sku">${esc(productSku(item)||'SEM SKU')}</span>
          <b class="ehfm-product-name">${esc(item.descricao||'Produto')}</b>
          ${item.unidade?`<span class="ehfm-product-unit">Unidade: ${esc(item.unidade)}</span>`:''}
          <span class="ehfm-product-location">${esc(item.localizacao?'Local: '+item.localizacao:'Local não informado')}</span>
          <span class="ehfm-product-image-status" data-product-image-status="${index}">${initialImage?'Carregando imagem...':'Buscando imagem no Tiny...'}</span>
        </div>
      </article>`;
  }

  function setImageStatus(index,text,type=''){
    const el=document.querySelector(`#ehfm-pack-items [data-product-image-status="${index}"]`);
    if(!el)return;
    el.textContent=text||'';
    el.dataset.status=type;
  }

  function markImageUnavailable(box,index,message='Produto sem imagem cadastrada no Tiny'){
    if(!box)return;
    box.classList.remove('loading');
    box.classList.add('no-image');
    box.innerHTML='';
    setImageStatus(index,message,'error');
  }

  function attachImageEvents(img,box,index,errorMessage='Produto sem imagem cadastrada no Tiny'){
    if(!img||!box)return;
    let settled=false;
    const success=()=>{
      if(settled)return;
      settled=true;
      box.classList.remove('loading','no-image');
      setImageStatus(index,'Imagem carregada','ok');
    };
    const failure=()=>{
      if(settled)return;
      settled=true;
      markImageUnavailable(box,index,errorMessage);
    };
    img.addEventListener('load',success,{once:true});
    img.addEventListener('error',failure,{once:true});
    if(img.complete)queueMicrotask(()=>img.naturalWidth>0?success():failure());
  }

  function bindImageEvents(){
    document.querySelectorAll('#ehfm-pack-items .ehfm-product-image img').forEach(img=>{
      const box=img.closest('.ehfm-product-image');
      attachImageEvents(img,box,box?.dataset?.productImage);
    });
  }

  async function loadProductImage(item,index,account){
    const box=document.querySelector(`#ehfm-pack-items [data-product-image="${index}"]`);
    if(!box)return;
    const sku=productSku(item);
    const id=productId(item);
    const conta=normalizedAccount(account);
    if(!sku&&!id){markImageUnavailable(box,index,'SKU e ID do produto não informados; não foi possível buscar a imagem');return;}
    if(!conta){markImageUnavailable(box,index,'Conta do pedido não informada');return;}
    if(imageFromItem(item))return;

    try{
      const metadataUrl=productImageMetadataUrl(item,conta);
      const response=await fetch(metadataUrl,{cache:'no-store',headers:{Accept:'application/json'}});
      const result=await response.json().catch(()=>({ok:false,error:'RESPOSTA_INVALIDA'}));
      if(!response.ok||!result.ok||!result.imageUrl){
        const reason=result.error==='PRODUTO_SEM_IMAGEM'
          ?'Produto sem imagem cadastrada no Tiny'
          :result.error==='FALHA_CONSULTA_TINY'
            ?'A API do Tiny não respondeu à busca da imagem'
            :'Imagem não localizada no Tiny';
        markImageUnavailable(box,index,reason);
        return;
      }

      const url=productImageProxy(item,conta)+'&v='+encodeURIComponent(result.updatedAt||Date.now());
      box.classList.add('loading');
      box.classList.remove('no-image');
      box.innerHTML=`<img src="${esc(url)}" alt="${esc(item.descricao||'Produto')}" loading="eager" referrerpolicy="no-referrer">`;
      setImageStatus(index,result.cached?'Imagem encontrada no cache':'Imagem encontrada no Tiny','loading');
      const img=box.querySelector('img');
      attachImageEvents(img,box,index,'A imagem foi localizada, mas não pôde ser aberta');
    }catch(error){
      console.error('[embalagem-imagem]',sku||id,error);
      markImageUnavailable(box,index,'Falha ao consultar a imagem');
    }
  }

  async function hydrateProductImages(items,account){
    const queue=items.map((item,index)=>({item,index}));
    const workers=Array.from({length:Math.min(3,queue.length)},async()=>{
      while(queue.length){
        const current=queue.shift();
        if(current)await loadProductImage(current.item,current.index,account);
      }
    });
    await Promise.all(workers);
  }

  function renderOrder(data){
    state.current=data;
    state.startedAt=new Date().toISOString();
    state.alreadyPacked=Boolean(data.alreadyPacked);

    $('ehfm-pack-empty').style.display='none';
    $('ehfm-pack-order').classList.add('show');
    $('ehfm-pack-order').classList.toggle('locked',state.alreadyPacked);

    const pedido=data.pedido||{};
    const sep=data.separacao||{};
    $('ehfm-order-number').textContent=pedido.numero||pedido.tinyNumber||'--';
    $('ehfm-order-store').textContent=data.lojaNome||data.storeName||data.lojaKey||'--';
    $('ehfm-order-customer').textContent=pedido.cliente||pedido.customer||'Cliente não informado';
    $('ehfm-order-status').textContent=sep.situacaoTexto||sep.statusName||'--';
    $('ehfm-order-ecommerce').textContent=pedido.numeroEcommerce||pedido.ecommerceOrderId||'--';
    $('ehfm-order-tracking').textContent=pedido.codigoRastreamento||pedido.trackingCode||data.codigoLido||'--';
    $('ehfm-order-shipping').textContent=pedido.formaEnvio||pedido.formaFrete||pedido.shippingMethodName||'--';
    $('ehfm-order-separation').textContent=sep.id||sep.idSeparacao||'--';

    const items=Array.isArray(data.itens)?data.itens:[];
    const units=data.totalUnidades??items.reduce((a,i)=>a+Number(i.quantidade||0),0);
    $('ehfm-item-lines').textContent=data.totalLinhas??items.length;
    $('ehfm-item-units').textContent=qty(units);
    const imageAccount=data.lojaKey||data.conta||'';
    $('ehfm-pack-items').innerHTML=items.map((item,index)=>renderProductCard(item,index,imageAccount)).join('');
    bindImageEvents();
    hydrateProductImages(items,data.lojaKey||data.conta||'').catch(error=>console.error('[embalagem-imagens]',error));

    const confirm=$('ehfm-pack-confirm');
    confirm.disabled=state.alreadyPacked||!items.length;
    $('ehfm-pack-ready-text').textContent=state.alreadyPacked
      ? 'Esta etiqueta está bloqueada porque já foi embalada.'
      : `${items.length} produto(s) exibido(s). Confira visualmente e confirme.`;
  }

  async function lookup(){
    const raw=$('ehfm-pack-input').value.trim();
    if(!raw||state.current)return;

    // IMPORTANTE: o QR do Mercado Livre contém shipment_id, sender_id, hash_code e
    // security_digit. Enviamos o conteúdo bruto ao backend para ele identificar a
    // conta correta. O valor normalizado fica apenas para exibição e histórico.
    const code=normalize(raw);
    $('ehfm-pack-input').value=code;
    $('ehfm-pack-input').disabled=true;
    $('ehfm-pack-search').disabled=true;
    alert('');
    setStatus('Preparando etiqueta: cache → pedido exato → produtos...');

    try{
      let response=await fetch(
        API_BASE()+'/api/packing/preparar',
        {method:'POST',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({codigo:raw})}
      );
      // Compatibilidade durante a ordem de deploy: se o Gateway antigo ainda não
      // tiver a preparação rápida, usa a rota tradicional do Worker.
      if(response.status===404){
        response=await fetch(API_BASE()+'/api/embalagem/buscar?codigo='+encodeURIComponent(raw),{cache:'no-store',headers:{Accept:'application/json'}});
      }
      let data=await response.json().catch(()=>({ok:false,error:'Resposta inválida'}));

      // A resolução completa é feita dentro do backend. Não iniciamos uma segunda
      // sincronização automática aqui, pois isso duplicava requisições e escondia o
      // diagnóstico real com vários erros 401/403 do Mercado Livre.

      if(!response.ok||data.ok===false){
        if(data?.alreadyPacked||data?.error==='ETIQUETA_JA_EMBALADA'){
          await loadHistory();
          const ev=data.event||{};
          const when=ev.finished_at||ev.started_at||'';
          throw new Error(`ETIQUETA JÁ EMBALADA${ev.operator?' por '+ev.operator:''}${when?' em '+new Date(when).toLocaleString('pt-BR'):''}. O registro original aparece no histórico abaixo.`);
        }
        throw new Error(data.message||data.error||`HTTP ${response.status}`);
      }

      if(!Array.isArray(data.itens)||!data.itens.length){
        throw new Error('Pedido localizado, mas os produtos ainda não foram processados. Reprocesse os produtos na aba Pedidos atrasados.');
      }

      renderOrder(data);
      $('ehfm-pack-last').textContent=`Última leitura: ${code} · ${new Date().toLocaleTimeString('pt-BR')}`;

      if(data.alreadyPacked){
        const ev=data.event||{};
        const when=ev.finished_at||ev.started_at||'';
        alert(`ETIQUETA JÁ EMBALADA${ev.operator?' por '+ev.operator:''}${when?' em '+new Date(when).toLocaleString('pt-BR'):''}. O pedido foi aberto somente para consulta.`);
        setStatus('Consulta exibida. Nova confirmação bloqueada.');
        await loadHistory();
      }else{
        setStatus('Pedido localizado. Confira os produtos e pressione Enter para confirmar.');
        setTimeout(()=>$('ehfm-pack-confirm')?.focus(),60);
      }
    }catch(error){
      await registrarFaltaNaPlanilha(raw).catch(()=>{});
      alert((error.message||String(error))+' | Fonte: tiny-worker. Falta registrada na planilha se não existir alias.');
      setStatus('Etiqueta não localizada ou bloqueada.');
      $('ehfm-pack-input').disabled=false;
      $('ehfm-pack-search').disabled=false;
      $('ehfm-pack-input').focus();
      $('ehfm-pack-input').select();
    }
  }

  async function complete(){
    if(!state.current||state.alreadyPacked||$('ehfm-pack-confirm').disabled)return;
    const button=$('ehfm-pack-confirm');
    button.disabled=true;
    setStatus('Registrando a embalagem...');

    try{
      const data=state.current;
      const payload={
        operador:state.operator,
        codigo:data.codigoLido||normalize($('ehfm-pack-input').value),
        conta:data.lojaKey||data.conta,
        pedidoId:data.pedido?.id||data.pedido?.tinyOrderId,
        separacaoId:data.separacao?.id||data.separacao?.idSeparacao,
        itens:data.itens,
        startedAt:state.startedAt
      };

      const response=await fetch(API_BASE()+'/api/packing/complete',{
        method:'POST',
        headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify(payload)
      });
      const result=await response.json().catch(()=>({ok:false,error:'Resposta inválida'}));

      if(!response.ok||result.ok===false){
        if(result?.alreadyPacked||result?.error==='ETIQUETA_JA_EMBALADA'){
          const ev=result.event||{};
          const when=ev.finished_at||ev.started_at||'';
          throw new Error(`ETIQUETA JÁ EMBALADA${ev.operator?' por '+ev.operator:''}${when?' em '+new Date(when).toLocaleString('pt-BR'):''}.`);
        }
        throw new Error(result.message||result.error||`HTTP ${response.status}`);
      }

      alert(`Pedido ${data.pedido?.numero||''} embalado com sucesso por ${state.operator}.`,'ok');
      await loadHistory();
      setTimeout(reset,450);
    }catch(error){
      alert(error.message||String(error));
      button.disabled=state.alreadyPacked;
      setStatus('Falha ao registrar a embalagem.');
    }
  }

  function normalizeHistory(data){
    if(Array.isArray(data?.rows))return data.rows;
    if(Array.isArray(data?.events))return data.events;
    if(Array.isArray(data?.records))return data.records;
    if(Array.isArray(data?.history))return data.history;
    return [];
  }

  function isToday(value){
    if(!value)return false;
    const date=new Date(value);
    const now=new Date();
    return date.getFullYear()===now.getFullYear()&&
      date.getMonth()===now.getMonth()&&
      date.getDate()===now.getDate();
  }

  async function loadHistory(){
    try{
      const response=await fetch(API_BASE()+'/api/packing/history?limit=500',{cache:'no-store'});
      const data=await response.json();
      if(!response.ok||data.ok===false)throw new Error(data.error||`HTTP ${response.status}`);
      state.history=normalizeHistory(data);
      renderHistory();
      state.loaded=true;
    }catch(_){}
  }

  function renderHistory(){
    const rows=state.history.filter(row=>isToday(row.finished_at||row.started_at||row.created_at));
    const body=$('ehfm-pack-history');
    if(!body)return;

    body.innerHTML=rows.length?rows.map(row=>{
      const start=row.started_at||row.startedAt||'';
      const finish=row.finished_at||row.completed_at||row.completedAt||'';
      const label=row.normalized_code||row.scanned_code||row.codigo||'--';
      const order=row.tiny_number||row.ecommerce_order_id||row.pedidoId||row.order_id||'--';
      return `<tr>
        <td>${esc(start?new Date(start).toLocaleTimeString('pt-BR'):'--')}</td>
        <td>${esc(finish?new Date(finish).toLocaleTimeString('pt-BR'):'--')}</td>
        <td class="ehfm-history-code">${esc(label)}</td>
        <td>${esc(row.account||row.conta||'--')}</td>
        <td>${esc(order)}</td>
        <td>${esc(row.operator||row.operador||'--')}</td>
        <td>${esc(row.status||'EMBALADO')}</td>
      </tr>`;
    }).join(''):'<tr><td colspan="7" class="ehfm-empty">Sem registros.</td></tr>';

    const valid=rows.filter(row=>!['CANCELADA','CANCELADO'].includes(String(row.status||'EMBALADO').toUpperCase()));
    const mine=valid.filter(row=>String(row.operator||row.operador||'').toUpperCase()===state.operator);
    $('ehfm-pack-total').textContent=valid.length;
    $('ehfm-pack-pending').textContent=state.current&&!state.alreadyPacked?1:0;
    $('ehfm-pack-mine').textContent=mine.length;
    const last=valid[0];
    $('ehfm-pack-last-time').textContent=last
      ?new Date(last.finished_at||last.completed_at||last.started_at||Date.now()).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
      :'--:--';
  }

  function activate(){
    mount();
    ensureOperator();
    if(!state.loaded)loadHistory();else renderHistory();
    setTimeout(()=>{if(!state.current)$('ehfm-pack-input')?.focus()},80);
  }

  window.EHFModules.embalagem={activate,reset,refresh:loadHistory};
  document.addEventListener('DOMContentLoaded',mount);
})();