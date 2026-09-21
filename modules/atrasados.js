(function(){
  window.EHFModules=window.EHFModules||{};
  const state={mounted:false,loaded:false,data:{pedidos:[]},status:null,timer:null};
  const DEFAULT_API_BASE='https://atendente-vesco-separacao.2cwhzy.easypanel.host';const API_BASE=()=>{let value=String(localStorage.getItem('ehf_worker_api_base')||DEFAULT_API_BASE).replace(/\/+$/,'');try{const parsed=new URL(value);if(parsed.origin===location.origin||/\.vercel\.app$/i.test(parsed.hostname)||/github\.io$/i.test(parsed.hostname)){value=DEFAULT_API_BASE;localStorage.setItem('ehf_worker_api_base',value);}}catch(_){value=DEFAULT_API_BASE;}return value;};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const qty=v=>{const n=Number(v||0);return Number.isInteger(n)?String(n):n.toLocaleString('pt-BR',{maximumFractionDigits:3})};
  const $=id=>document.getElementById(id);
  function mount(){
    if(state.mounted)return;state.mounted=true;
    const root=$('ehf-atrasados-module');
    root.innerHTML=`<section class="ehfm-page" id="ehfm-late-page">
      <header class="ehfm-head"><div><h2>Pedidos atrasados</h2><p>Flex e Agência/Coleta, com produtos e vínculo ao Tiny, sem sair do painel principal.</p></div><div class="ehfm-actions"><button class="ehfm-btn" id="ehfm-late-refresh">Recarregar</button><button class="ehfm-btn" id="ehfm-products-rebuild">Reprocessar produtos</button><button class="ehfm-btn primary" id="ehfm-late-sync">Atualizar tudo</button></div></header>
      <div id="ehfm-late-alert" class="ehfm-alert"></div>
      <div class="ehfm-metrics"><div class="ehfm-metric"><span>Total atrasados</span><b id="ehfm-late-total">0</b></div><div class="ehfm-metric flex"><span>Flex</span><b id="ehfm-late-flex">0</b></div><div class="ehfm-metric coleta"><span>Agência / Coleta</span><b id="ehfm-late-coleta">0</b></div><div class="ehfm-metric"><span>Com produtos</span><b id="ehfm-late-with-products">0</b></div><div class="ehfm-metric"><span>Sem produtos</span><b id="ehfm-late-without-products">0</b></div></div>
      <section class="ehfm-panel"><div class="ehfm-head"><div><h3 style="margin:0">Processamento dos produtos</h3><p id="ehfm-products-updated">Consultando o Easypanel...</p></div></div><div class="ehfm-process"><div class="ehfm-process-main"><b id="ehfm-products-stage">Base de produtos</b><small id="ehfm-products-detail">Carregando cobertura...</small><div class="ehfm-progress"><i id="ehfm-products-bar"></i></div><small id="ehfm-products-live">Aguardando</small></div><div class="ehfm-process-stat"><small>Separações ativas</small><strong id="ehfm-products-active">0</strong></div><div class="ehfm-process-stat"><small>Com produtos</small><strong id="ehfm-products-with">0</strong></div><div class="ehfm-process-stat"><small>Sem produtos</small><strong id="ehfm-products-without">0</strong></div><div class="ehfm-process-stat"><small>Linhas / unidades</small><strong id="ehfm-products-lines">0</strong><small id="ehfm-products-units">0 unidades</small></div></div></section>
      <section class="ehfm-panel"><div class="ehfm-filters"><select class="ehfm-select" id="ehfm-late-modality"><option value="TODOS">Flex e Coleta</option><option value="FLEX">Somente Flex</option><option value="COLETA">Somente Agência/Coleta</option></select><select class="ehfm-select" id="ehfm-late-store"><option value="">Todas as lojas</option></select><input class="ehfm-input" id="ehfm-late-search" placeholder="Pesquisar pedido, etiqueta, SKU, produto ou marcador"></div></section>
      <section class="ehfm-panel"><div class="ehfm-head"><div><h3 style="margin:0">Pedidos consultados</h3></div><b id="ehfm-late-count">0 pedidos</b></div><div class="ehfm-table-wrap"><table class="ehfm-table"><thead><tr><th>Modalidade</th><th>Loja / pedido</th><th>Etiqueta / envio</th><th>Produtos</th><th>Motivo Tiny</th><th>Solução</th></tr></thead><tbody id="ehfm-late-rows"><tr><td colspan="6" class="ehfm-empty">Carregando...</td></tr></tbody></table></div></section>
    </section>`;
    $('ehfm-late-refresh').onclick=load;
    $('ehfm-late-sync').onclick=syncAll;
    $('ehfm-products-rebuild').onclick=rebuildProducts;
    ['ehfm-late-modality','ehfm-late-store'].forEach(id=>$(id).onchange=renderRows);
    $('ehfm-late-search').oninput=renderRows;
    // Delegado (as linhas são recriadas a cada renderRows): clique no botão
    // "Adicionar solução" ou na nota já existente abre um prompt pra
    // registrar/editar como aquele atraso foi resolvido.
    $('ehfm-late-rows').addEventListener('click',(ev)=>{
      const target=ev.target.closest('[data-solucao-id]');
      if(!target)return;
      abrirSolucao(Number(target.getAttribute('data-solucao-id')));
    });
  }
  function alert(text,type=''){const el=$('ehfm-late-alert');if(!el)return;el.textContent=text||'';el.className='ehfm-alert'+(text?' show':'')+(type==='ok'?' ok':'');}
  function markerNames(p){return(p.marcadores||[]).map(m=>{if(typeof m==='string')return m;const x=m?.marcador||m?.marker||m||{};return x.description||x.descricao||x.nome||x.name||''}).filter(Boolean)}
  function reason(p){const names=markerNames(p);const s=norm(names.join(' '));if(/naotem|estaprachegar/.test(s))return'Sem estoque / aguardando';if(/naoachou/.test(s))return'Produto não localizado';if(/conflitodeendereco|naoestaimprimindo|pacotequedeubo|verificar|bo/.test(s))return'Problema operacional';if(/naomandar|naoenviar|cancelado|prejuizo/.test(s))return'Bloqueado / não enviar';return names.length?names.join(', '):'Sem motivo informado'}
  function normalizeData(data){
    const pedidos=Array.isArray(data?.pedidos)?data.pedidos:Array.isArray(data?.orders)?data.orders:[];
    return {...data,pedidos};
  }
  function populateStores(){const sel=$('ehfm-late-store'),current=sel.value;const map=new Map(state.data.pedidos.map(p=>[p.conta,p.lojaNome||p.conta]));sel.innerHTML='<option value="">Todas as lojas</option>'+[...map].map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('');sel.value=current;}
  function matches(p){const m=$('ehfm-late-modality').value,s=$('ehfm-late-store').value,q=norm($('ehfm-late-search').value);if(m!=='TODOS'&&String(p.modalidadeCodigo||'').toUpperCase()!==m)return false;if(s&&p.conta!==s)return false;if(q){const hay=norm([p.orderId,p.pedidoTiny,p.separacaoId,p.cliente,p.modalidade,p.mensagem,p.marcadoresTexto,p.propriedadeOrigem,...(p.shipmentIds||[]),...(p.packIds||[]),...(p.logisticCodes||[]),...(p.itens||[]).flatMap(i=>[i.codigo,i.descricao])].join(' '));if(!hay.includes(q))return false}return true;}
  function renderRows(){
    const rows=state.data.pedidos.filter(matches);$('ehfm-late-count').textContent=`${rows.length} pedido${rows.length===1?'':'s'}`;
    $('ehfm-late-rows').innerHTML=rows.length?rows.map(p=>{
      const modality=String(p.modalidadeCodigo||'').toUpperCase();
      const items=Array.isArray(p.itens)?p.itens:[];const units=p.totalUnidades??items.reduce((a,i)=>a+Number(i.quantidade||0),0);
      const products=items.length?items.slice(0,12).map(i=>`<div><strong>${esc(qty(i.quantidade))}×</strong> ${esc(i.descricao||'Produto')}<span class="ehfm-sub">${esc(i.codigo||'SEM SKU')}</span></div>`).join(''):'<span class="ehfm-sub">Produtos ainda não associados ao Tiny</span>';
      const codes=[...(p.shipmentIds||[]),...(p.packIds||[]),...(p.logisticCodes||[])].filter(Boolean);
      const ml=[...(p.pedidosMarketplace||[]),p.orderId].filter(Boolean);
      const solucao=p.resolutionNote
        ?`<div class="ehfm-solucao-nota" data-solucao-id="${esc(p.id)}" title="Clique pra editar">${esc(p.resolutionNote)}</div><span class="ehfm-sub">${esc(p.resolutionBy||'')}${p.resolutionAt?` · ${new Date(p.resolutionAt).toLocaleString('pt-BR')}`:''}</span>`
        :`<button type="button" class="ehfm-btn ehfm-btn-sm" data-solucao-id="${esc(p.id)}">+ Adicionar solução</button>`;
      return `<tr><td><span class="ehfm-badge ${modality==='FLEX'?'flex':'coleta'}">${esc(modality||'N/D')}</span><span class="ehfm-sub">${esc(p.modalidade||'')}</span></td><td><b>${esc(p.lojaNome||p.conta||'')}</b><span class="ehfm-sub">ML ${esc([...new Set(ml)].join(' · ')||'--')}</span><span class="ehfm-sub">Tiny ${esc(p.pedidoTiny||'--')} · Separação ${esc(p.separacaoId||'--')}</span></td><td><b>${esc([...new Set(codes)].join(' · ')||'Sem código logístico')}</b><span class="ehfm-sub">${esc(p.mensagem||'')}</span></td><td class="ehfm-products">${products}${items.length?`<span class="ehfm-sub">${items.length} linha(s) · ${qty(units)} unidade(s)</span>`:''}</td><td><b>${esc(reason(p))}</b><span class="ehfm-sub">${esc(markerNames(p).join(', '))}</span></td><td class="ehfm-solucao">${solucao}</td></tr>`;
    }).join(''):'<tr><td colspan="6" class="ehfm-empty">Nenhum pedido corresponde aos filtros.</td></tr>';
  }
  async function abrirSolucao(id){
    const pedido=state.data.pedidos.find(p=>Number(p.id)===id);
    if(!pedido)return;
    const atual=pedido.resolutionNote||'';
    const nota=prompt('Como esse atraso foi ou está sendo resolvido?',atual);
    if(nota===null)return;
    const texto=nota.trim();
    if(texto===atual)return;
    const operador=String(localStorage.getItem('ehf_operador')||'').trim();
    try{
      const r=await fetch(API_BASE()+`/api/pedidos-atrasados/${id}/solucao`,{
        method:'POST',
        headers:writeHeaders(),
        body:JSON.stringify({nota:texto,operador})
      });
      const d=await r.json();
      if(!r.ok||d.ok===false)throw new Error(d.error||`HTTP ${r.status}`);
      pedido.resolutionNote=d.resolutionNote||'';
      pedido.resolutionBy=d.resolutionBy||'';
      pedido.resolutionAt=d.resolutionAt||'';
      renderRows();
    }catch(e){
      alert(e.message||String(e));
    }
  }
  function writeHeaders(){
    const headers={'Accept':'application/json','Content-Type':'application/json'};
    const apiKey=localStorage.getItem('ehf_api_key')||'';
    if(apiKey)headers['x-api-key']=apiKey;
    return headers;
  }
  function render(){
    const d=state.data;const pedidos=d.pedidos||[];const flex=Number(d.totalFlex??pedidos.filter(p=>p.modalidadeCodigo==='FLEX').length);const coleta=Number(d.totalColeta??pedidos.filter(p=>p.modalidadeCodigo==='COLETA').length);const withP=pedidos.filter(p=>(p.itens||[]).length).length;
    $('ehfm-late-total').textContent=d.atrasados??d.total??pedidos.length;$('ehfm-late-flex').textContent=flex;$('ehfm-late-coleta').textContent=coleta;$('ehfm-late-with-products').textContent=withP;$('ehfm-late-without-products').textContent=Math.max(0,pedidos.length-withP);populateStores();renderRows();
  }
  function renderStatus(data){
    const cov=data.productCoverage||data.coverage||{};const proc=data.productProcessing||{};const stats=data.stats||{};const active=Number(cov.activeSeparations||0),withP=Number(cov.activeWithProducts||0),without=Number(cov.activeWithoutProducts||0);const running=Boolean(data.running?.products||data.running?.tiny||proc.status==='RUNNING');const percent=Number(proc.percentage??(active?Math.round(withP/active*100):0));
    $('ehfm-products-active').textContent=active;$('ehfm-products-with').textContent=withP;$('ehfm-products-without').textContent=without;$('ehfm-products-lines').textContent=stats.orderItems||proc.itemLines||0;$('ehfm-products-units').textContent=`${qty(stats.orderUnits||0)} unidades indexadas`;$('ehfm-products-stage').textContent=running?'Processando produtos':without?'Cobertura parcial':'Produtos concluídos';$('ehfm-products-detail').textContent=running?`Passagem ${proc.pass||1}: ${proc.completed||0}/${proc.total||active} pedidos`:`${withP} de ${active} separações com produtos`;$('ehfm-products-live').textContent=running?'Processando agora':without?'Aguardando reprocessamento':'Concluído';$('ehfm-products-bar').style.width=`${Math.max(0,Math.min(100,percent))}%`;$('ehfm-products-updated').textContent=proc.updatedAt?`Atualizado em ${new Date(proc.updatedAt).toLocaleString('pt-BR')}`:'Status em tempo real do Easypanel';
    if(running&&!state.timer)state.timer=setInterval(loadStatus,3500);if(!running&&state.timer){clearInterval(state.timer);state.timer=null}
  }
  async function loadStatus(){try{const r=await fetch(API_BASE()+'/api/sync/status',{cache:'no-store'});const d=await r.json();if(r.ok&&d.ok!==false)renderStatus(d)}catch(_){}}
  async function load(){mount();const page=$('ehfm-late-page');page.setAttribute('aria-busy','true');alert('');try{const r=await fetch(API_BASE()+'/api/pedidos-atrasados?limit=5000',{cache:'no-store',headers:{Accept:'application/json'}});const d=await r.json();if(!r.ok||d.ok===false)throw new Error(d.error||`HTTP ${r.status}`);state.data=normalizeData(d);state.loaded=true;render();await loadStatus();}catch(e){alert(e.message||String(e));$('ehfm-late-rows').innerHTML='<tr><td colspan="6" class="ehfm-empty">Falha ao carregar os pedidos atrasados.</td></tr>';}finally{page.removeAttribute('aria-busy')}}
  async function syncAll(){const b=$('ehfm-late-sync');b.disabled=true;alert('Atualização completa iniciada. O painel continuará disponível.','ok');try{const r=await fetch(API_BASE()+'/api/sync/all',{method:'POST',headers:{Accept:'application/json'}});const d=await r.json();if(!r.ok||d.ok===false)throw new Error(d.error||`HTTP ${r.status}`);await loadStatus();setTimeout(load,4500);}catch(e){alert(e.message||String(e));}finally{b.disabled=false}}
  async function rebuildProducts(){const b=$('ehfm-products-rebuild');b.disabled=true;try{const r=await fetch(API_BASE()+'/api/sync/products/rebuild',{method:'POST',headers:{Accept:'application/json'}});const d=await r.json();if(!r.ok||d.ok===false)throw new Error(d.error||`HTTP ${r.status}`);alert('Reprocessamento dos produtos iniciado.','ok');await loadStatus();}catch(e){alert(e.message||String(e));}finally{b.disabled=false}}
  function activate(){mount();if(!state.loaded)load();else{render();loadStatus();}}
  window.EHFModules.atrasados={activate,refresh:load};
  document.addEventListener('DOMContentLoaded',mount);
})();
