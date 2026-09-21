window.EHF_MOBILE_CAMERA_SCAN_VERSION='4.2.43-IOS-CANAL-ESTRITO';
(function(){
  'use strict';

  const CDN_HTML5_QRCODE = [
    'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
  ];

  const state = {
    active:false,
    target:'',
    lastCode:'',
    lastAt:0,
    facingMode:'environment',
    nativeStream:null,
    nativeTimer:null,
    nativeDetector:null,
    html5:null,
    html5RegionId:'ehf-html5-camera-region',
    engine:'',
    loadingLib:null,
    fileInput:null
  };

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  function isIOS(){
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isMobile(){
    return window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  }

  function normalize(value){
    const raw = String(value || '').trim();
    if(!raw) return '';

    // Mercado Envios visuais/QR: 475..., MEL..., S475...
    const melFull = raw.match(/\b(MEL[0-9A-Z]{8,45})\b/i);
    if(melFull) return melFull[1].toUpperCase();

    const m47 = raw.match(/(?:^|[^0-9])(47\d{8,14})(?:[^0-9]|$)/);
    if(m47) return m47[1];

    const s47 = raw.match(/\bS(47\d{8,14})\b/i);
    if(s47) return s47[1];

    // Pack id ML
    const pack = raw.match(/(?:^|[^0-9])(20\d{13,18})(?:[^0-9]|$)/);
    if(pack) return pack[1];

    // Shopee/SPX
    const br = raw.match(/\b(BR[A-Z0-9]{8,35})\b/i);
    if(br) return br[1].toUpperCase();

    // TikTok/J&T e outros longos numéricos
    const longNum = raw.match(/(?:^|[^0-9])(\d{12,24})(?:[^0-9]|$)/);
    if(longNum) return longNum[1];

    const tbr = raw.match(/\b(TBR[A-Z0-9-]{6,35})\b/i);
    if(tbr) return tbr[1].toUpperCase();

    const tokens = raw.match(/[A-Za-z0-9_-]{8,80}/g) || [];
    return (tokens.sort((a,b)=>b.length-a.length)[0] || raw.replace(/[^A-Za-z0-9_-]/g,'')).trim();
  }

  function visible(el){ return !!(el && el.offsetParent !== null); }

  function currentTarget(){
    if(document.getElementById('view-embalagem')?.classList.contains('active')) return 'embalagem';
    if(document.getElementById('view-bipagem')?.classList.contains('active')) return 'bipagem';
    if(visible($('ehfm-pack-input'))) return 'embalagem';
    if(visible($('input-leitor-codigo'))) return 'bipagem';
    return location.hash && location.hash.includes('embalagem') ? 'embalagem' : 'bipagem';
  }

  function getTargetInput(target){
    return target === 'embalagem' ? $('ehfm-pack-input') : $('input-leitor-codigo');
  }

  function injectStyles(){
    if($('ehf-mobile-camera-scan-style')) return;
    const st = document.createElement('style');
    st.id = 'ehf-mobile-camera-scan-style';
    st.textContent = `
      html.ehf-mobile-ui, html.ehf-mobile-ui body{max-width:100%;overflow-x:hidden!important;background:#03070c!important}
      .ehf-camera-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid rgba(14,165,233,.75);background:#0ea5e9;color:#001018;border-radius:12px;padding:11px 14px;font-size:12px;font-weight:950;cursor:pointer;min-height:44px;box-shadow:0 8px 26px rgba(14,165,233,.16);white-space:nowrap}
      .ehf-camera-btn:hover{filter:brightness(1.08)}
      .ehf-camera-photo-btn{background:#ff8a00;border-color:#ff8a00;color:#111827}
      .bip-input-pro .ehf-camera-btn,.input-bip-box .ehf-camera-btn{margin-top:10px;width:100%;max-width:280px}
      .ehf-camera-modal{position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:10px}
      .ehf-camera-card{width:min(780px,100%);max-height:96vh;background:#07111d;border:1px solid rgba(255,138,0,.62);border-radius:18px;box-shadow:0 24px 90px rgba(0,0,0,.64);overflow:hidden;color:#fff;font-family:inherit;display:flex;flex-direction:column}
      .ehf-camera-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:#081421}
      .ehf-camera-head b{font-size:15px}.ehf-camera-head span{color:#93a4b8;font-size:11px;line-height:1.35}.ehf-camera-head button{border:1px solid rgba(239,68,68,.6);color:#fecaca;background:rgba(239,68,68,.10);border-radius:9px;padding:8px 10px;font-weight:850}
      .ehf-camera-body{position:relative;background:#000;min-height:300px;display:flex;align-items:center;justify-content:center}
      .ehf-camera-body video{width:100%;height:100%;max-height:72vh;object-fit:cover;background:#000}
      .ehf-camera-body #ehf-html5-camera-region{width:100%;min-height:320px;background:#000;color:#fff}
      .ehf-camera-body #ehf-html5-camera-region video{width:100%!important;height:auto!important;max-height:72vh!important;object-fit:cover!important}
      .ehf-camera-guide{position:absolute;left:7%;right:7%;top:40%;height:84px;border:2px solid rgba(255,138,0,.98);border-radius:12px;box-shadow:0 0 0 999px rgba(0,0,0,.25);pointer-events:none;z-index:5}
      .ehf-camera-guide:after{content:'';position:absolute;left:10px;right:10px;top:50%;border-top:2px solid rgba(34,197,94,.98);box-shadow:0 0 14px rgba(34,197,94,.78)}
      .ehf-camera-status{padding:9px 14px;color:#cbd5e1;font-size:12px;background:#0b1420;border-top:1px solid rgba(255,255,255,.08)}
      .ehf-camera-actions{display:flex;gap:8px;flex-wrap:wrap;padding:12px 14px;background:#07111d}.ehf-camera-actions button{border:1px solid rgba(255,255,255,.14);background:#111b29;color:#fff;border-radius:10px;padding:10px 12px;font-weight:850;cursor:pointer;min-height:40px}.ehf-camera-actions button.primary{background:#0ea5e9;color:#001018;border-color:#0ea5e9}.ehf-camera-actions button.orange{background:#ff8a00;color:#111827;border-color:#ff8a00}.ehf-camera-actions button.danger{border-color:rgba(239,68,68,.6);color:#fecaca;background:rgba(239,68,68,.10)}
      .ehf-camera-fallback{display:none;padding:0 14px 14px;color:#94a3b8;font-size:11px;line-height:1.45}
      @media(max-width:760px){
        html.ehf-mobile-ui body{font-size:12px!important}
        html.ehf-mobile-ui .sidebar,html.ehf-mobile-ui aside,html.ehf-mobile-ui .side-menu{max-width:58px!important;min-width:48px!important;overflow:hidden!important}
        html.ehf-mobile-ui main,html.ehf-mobile-ui .main,html.ehf-mobile-ui .content,html.ehf-mobile-ui .page,html.ehf-mobile-ui #view-bipagem,html.ehf-mobile-ui #view-embalagem{width:100%!important;max-width:100%!important;margin:0!important;padding:8px!important;box-sizing:border-box!important}
        html.ehf-mobile-ui .grid,html.ehf-mobile-ui .cards,html.ehf-mobile-ui .kpi-grid,html.ehf-mobile-ui .dashboard-grid{grid-template-columns:1fr!important;gap:8px!important}
        html.ehf-mobile-ui table{font-size:10px!important;min-width:680px!important} html.ehf-mobile-ui .table-wrap,html.ehf-mobile-ui .table-scroll,html.ehf-mobile-ui [style*="overflow"]{max-width:100%!important}
        html.ehf-mobile-ui #input-leitor-codigo,html.ehf-mobile-ui #ehfm-pack-input{height:56px!important;font-size:18px!important;text-align:center!important;border-radius:12px!important}
        html.ehf-mobile-ui .bip-input-pro,html.ehf-mobile-ui .input-bip-box{position:sticky!important;top:0!important;z-index:100!important;background:#07111d!important;border-radius:14px!important;padding:10px!important;margin-bottom:10px!important}
        .ehf-camera-card{width:100%;height:96vh;border-radius:14px}.ehf-camera-body{min-height:60vh;flex:1}.ehf-camera-guide{left:5%;right:5%;top:43%;height:74px}.bip-input-pro .ehf-camera-btn,.input-bip-box .ehf-camera-btn{max-width:none;width:100%;min-height:48px}.ehf-camera-actions button{flex:1 1 120px}.ehf-camera-head{padding:10px}.ehf-camera-status{font-size:11px}
      }
    `;
    document.head.appendChild(st);
    if(isMobile()) document.documentElement.classList.add('ehf-mobile-ui');
  }

  function cameraSetStatus(txt){ const el=$('ehf-camera-status'); if(el) el.textContent = txt || ''; }

  function ensureFileInput(){
    if(state.fileInput) return state.fileInput;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture','environment');
    input.style.position='fixed';
    input.style.left='-9999px';
    input.style.top='-9999px';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.value='';
      if(!file) return;
      await decodeImageFile(file, state.target || currentTarget());
    });
    document.body.appendChild(input);
    state.fileInput = input;
    return input;
  }

  async function loadHtml5Qrcode(){
    if(window.Html5Qrcode) return true;
    if(state.loadingLib) return state.loadingLib;
    state.loadingLib = (async()=>{
      for(const url of CDN_HTML5_QRCODE){
        try{
          await new Promise((resolve,reject)=>{
            const s=document.createElement('script');
            s.src=url;
            s.async=true;
            s.onload=resolve;
            s.onerror=reject;
            document.head.appendChild(s);
          });
          if(window.Html5Qrcode) return true;
        }catch(_){ }
      }
      return false;
    })();
    return state.loadingLib;
  }

  function html5Formats(){
    const f = window.Html5QrcodeSupportedFormats;
    if(!f) return undefined;
    return [
      f.QR_CODE,
      f.CODE_128,
      f.CODE_39,
      f.CODE_93,
      f.EAN_13,
      f.EAN_8,
      f.ITF,
      f.CODABAR,
      f.UPC_A,
      f.UPC_E,
      f.DATA_MATRIX,
      f.PDF_417
    ].filter(v=>v!==undefined && v!==null);
  }

  function ensureButtons(){
    injectStyles();
    const bipInput=$('input-leitor-codigo');
    if(bipInput && !$('ehf-bip-camera-btn')){
      const btn=document.createElement('button');
      btn.id='ehf-bip-camera-btn';
      btn.type='button';
      btn.className='ehf-camera-btn';
      btn.textContent='Ler com câmera';
      btn.onclick=()=>openCameraScanner('bipagem');
      const photo=document.createElement('button');
      photo.id='ehf-bip-photo-btn';
      photo.type='button';
      photo.className='ehf-camera-btn ehf-camera-photo-btn';
      photo.textContent='Foto do código';
      photo.onclick=()=>openPhotoScanner('bipagem');
      const box=bipInput.closest('.input-bip-box')||bipInput.parentElement;
      if(box){ box.appendChild(btn); box.appendChild(photo); }
    }
    const embInput=$('ehfm-pack-input');
    if(embInput && !$('ehfm-pack-camera') && !$('ehf-pack-camera-fallback-btn')){
      const btn=document.createElement('button');
      btn.id='ehf-pack-camera-fallback-btn';
      btn.type='button';
      btn.className='ehf-camera-btn';
      btn.textContent='Ler com câmera';
      btn.onclick=()=>openCameraScanner('embalagem');
      const photo=document.createElement('button');
      photo.id='ehf-pack-photo-btn';
      photo.type='button';
      photo.className='ehf-camera-btn ehf-camera-photo-btn';
      photo.textContent='Foto do código';
      photo.onclick=()=>openPhotoScanner('embalagem');
      const row=embInput.closest('.ehfm-scan-row')||embInput.parentElement;
      if(row){ row.appendChild(btn); row.appendChild(photo); }
    }

    const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    ['ehf-bip-camera-btn','ehf-pack-camera-fallback-btn','ehfm-pack-camera'].forEach(id=>{
      const el=$(id); if(el) el.style.display = hasMedia ? 'inline-flex' : 'none';
    });
    ['ehf-bip-photo-btn','ehf-pack-photo-btn'].forEach(id=>{ const el=$(id); if(el) el.style.display='inline-flex'; });
  }

  function ensureModal(){
    let modal=$('ehf-camera-modal');
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id='ehf-camera-modal';
    modal.className='ehf-camera-modal';
    modal.style.display='none';
    modal.innerHTML=`
      <div class="ehf-camera-card" role="dialog" aria-modal="true">
        <div class="ehf-camera-head">
          <div><b>Leitor por câmera</b><br><span id="ehf-camera-context">Aponte para o código de barras ou QR da etiqueta</span></div>
          <button id="ehf-camera-close" type="button">Fechar</button>
        </div>
        <div class="ehf-camera-body">
          <video id="ehf-camera-video" playsinline muted autoplay></video>
          <div id="ehf-html5-camera-region" style="display:none"></div>
          <div class="ehf-camera-guide"></div>
        </div>
        <div id="ehf-camera-status" class="ehf-camera-status">Preparando câmera...</div>
        <div class="ehf-camera-actions">
          <button id="ehf-camera-flip" type="button">Alternar câmera</button>
          <button id="ehf-camera-photo" class="orange" type="button">Tirar foto do código</button>
          <button id="ehf-camera-manual" type="button">Digitar manualmente</button>
        </div>
        <div id="ehf-camera-fallback" class="ehf-camera-fallback">No iPhone, abra pelo Safari/Chrome em HTTPS. Se a câmera ao vivo não abrir, use “Tirar foto do código”.</div>
      </div>`;
    document.body.appendChild(modal);
    $('ehf-camera-close').onclick=()=>closeCameraScanner(true);
    $('ehf-camera-manual').onclick=()=>{ const t=state.target||currentTarget(); closeCameraScanner(true); setTimeout(()=>focusTarget(t),80); };
    $('ehf-camera-photo').onclick=()=>openPhotoScanner(state.target||currentTarget());
    $('ehf-camera-flip').onclick=async()=>{
      state.facingMode=state.facingMode==='environment'?'user':'environment';
      const t=state.target||currentTarget();
      await closeCameraScanner(false);
      await openCameraScanner(t);
    };
    return modal;
  }

  function focusTarget(target){
    const input=getTargetInput(target);
    if(input){ input.focus(); try{ input.select(); }catch(_){} }
  }

  function consumeCode(code,target){
    const t=target||state.target||currentTarget();
    const input=getTargetInput(t);
    if(!input) return;
    input.value=code;
    input.focus();
    try{ if(navigator.vibrate) navigator.vibrate(80); }catch(_){ }
    const evDown = new KeyboardEvent('keydown',{key:'Enter',code:'Enter',which:13,keyCode:13,bubbles:true,cancelable:true});
    const evPress = new KeyboardEvent('keypress',{key:'Enter',code:'Enter',which:13,keyCode:13,bubbles:true,cancelable:true});
    input.dispatchEvent(evDown);
    input.dispatchEvent(evPress);
    if(t==='embalagem'){
      const btn=$('ehfm-pack-search');
      if(btn) setTimeout(()=>btn.click(),40);
    }
  }

  function onCameraCode(raw){
    const now=Date.now();
    const code=normalize(raw);
    if(!code) return;
    if(state.lastCode===code && (now-state.lastAt)<1800) return;
    state.lastCode=code;
    state.lastAt=now;
    const t=state.target||currentTarget();
    closeCameraScanner(true);
    setTimeout(()=>consumeCode(code,t),120);
  }

  async function startNativeDetector(video){
    if(!('BarcodeDetector' in window)) return false;
    try{
      let formats=['qr_code','code_128','code_39','code_93','ean_13','ean_8','itf','codabar','data_matrix','pdf417','upc_a','upc_e'];
      if(window.BarcodeDetector.getSupportedFormats){
        const supported=await window.BarcodeDetector.getSupportedFormats();
        formats=formats.filter(f=>supported.includes(f));
      }
      state.nativeDetector=new BarcodeDetector({formats:formats.length?formats:undefined});
      cameraSetStatus('Câmera ativa. Centralize a etiqueta dentro do retângulo.');
      const tick=async()=>{
        if(!state.active||!state.nativeDetector) return;
        try{
          const codes=await state.nativeDetector.detect(video);
          if(codes && codes.length){ onCameraCode(codes[0].rawValue||codes[0].rawData||codes[0].value||''); return; }
        }catch(_){ }
        state.nativeTimer=setTimeout(tick,160);
      };
      tick();
      return true;
    }catch(_){ return false; }
  }

  async function startHtml5Live(){
    const ok = await loadHtml5Qrcode();
    if(!ok || !window.Html5Qrcode) return false;

    const video=$('ehf-camera-video');
    const region=$('ehf-html5-camera-region');
    if(video) video.style.display='none';
    if(region){ region.style.display='block'; region.innerHTML=''; }

    const config = {
      fps: isIOS()?8:12,
      qrbox: function(viewfinderWidth, viewfinderHeight){
        const w = Math.floor(Math.min(viewfinderWidth * .88, 420));
        const h = Math.floor(Math.min(viewfinderHeight * .28, 150));
        return { width: Math.max(220,w), height: Math.max(90,h) };
      },
      aspectRatio: 1.7777778,
      disableFlip: false
    };
    const formats = html5Formats();
    const options = formats ? { formatsToSupport: formats, verbose:false } : { verbose:false };
    state.html5 = new window.Html5Qrcode(state.html5RegionId, options);
    cameraSetStatus(isIOS() ? 'iPhone detectado. Usando leitor compatível com iOS...' : 'Carregando leitor compatível...');
    await state.html5.start({ facingMode: state.facingMode || 'environment' }, config, decodedText => onCameraCode(decodedText), () => {});
    cameraSetStatus('Câmera ativa. Aproxime a etiqueta até preencher o retângulo.');
    return true;
  }

  async function startGetUserMediaNative(){
    const video=$('ehf-camera-video');
    const region=$('ehf-html5-camera-region');
    if(region) region.style.display='none';
    if(video) video.style.display='block';
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:state.facingMode||'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    state.nativeStream=stream;
    video.srcObject=stream;
    await video.play();
    const ok = await startNativeDetector(video);
    if(!ok) throw new Error('BarcodeDetector não disponível');
    return true;
  }

  async function openCameraScanner(target){
    state.target=target||currentTarget();
    ensureModal().style.display='flex';
    state.active=true;
    $('ehf-camera-context').textContent = state.target==='bipagem' ? 'Bipagem: aponte para a etiqueta do pacote' : 'Embalagem: aponte para a etiqueta do pedido';
    const fb=$('ehf-camera-fallback'); if(fb) fb.style.display='none';
    cameraSetStatus('Preparando leitor...');

    try{
      // iOS: BarcodeDetector/Shape Detection não é confiável. Usar html5-qrcode primeiro.
      if(isIOS()){
        const okHtml5 = await startHtml5Live();
        if(okHtml5) return;
        cameraSetStatus('Leitor ao vivo não carregou no iOS. Use “Tirar foto do código”.');
        if(fb) fb.style.display='block';
        return;
      }

      // Android/desktop Chrome: nativo primeiro, fallback para html5-qrcode.
      try{
        cameraSetStatus('Solicitando permissão da câmera...');
        const okNative = await startGetUserMediaNative();
        if(okNative) return;
      }catch(e){
        await closeNativeOnly();
      }

      const okHtml5 = await startHtml5Live();
      if(okHtml5) return;

      cameraSetStatus('Não foi possível abrir o leitor ao vivo. Use “Tirar foto do código”.');
      if(fb) fb.style.display='block';
    }catch(error){
      cameraSetStatus('Erro ao abrir câmera: ' + (error && error.message ? error.message : String(error)));
      if(fb) fb.style.display='block';
    }
  }

  async function openPhotoScanner(target){
    state.target = target || currentTarget();
    await loadHtml5Qrcode();
    ensureFileInput().click();
  }

  async function decodeImageFile(file,target){
    try{
      const ok=await loadHtml5Qrcode();
      if(!ok || !window.Html5Qrcode){ alert('Não foi possível carregar o leitor da foto. Use digitação manual.'); return; }
      cameraSetStatus('Lendo foto...');
      const regionId='ehf-image-reader-temp';
      let holder=$(regionId);
      if(!holder){ holder=document.createElement('div'); holder.id=regionId; holder.style.display='none'; document.body.appendChild(holder); }
      const reader = new window.Html5Qrcode(regionId, { verbose:false });
      const text = await reader.scanFile(file, true);
      try{ await reader.clear(); }catch(_){ }
      const code=normalize(text);
      if(code) consumeCode(code,target||state.target||currentTarget());
      else alert('Não consegui ler o código da foto. Tente aproximar e tirar outra foto.');
    }catch(e){
      alert('Não consegui ler o código da foto. Tente aproximar melhor ou digite manualmente.');
    }
  }

  async function closeNativeOnly(){
    if(state.nativeTimer){ clearTimeout(state.nativeTimer); state.nativeTimer=null; }
    state.nativeDetector=null;
    try{ if(state.nativeStream){ state.nativeStream.getTracks().forEach(t=>t.stop()); state.nativeStream=null; } }catch(_){ }
    const video=$('ehf-camera-video');
    if(video) video.srcObject=null;
  }

  async function closeCameraScanner(hide=true){
    state.active=false;
    await closeNativeOnly();
    try{ if(state.html5 && state.html5.isScanning) await state.html5.stop(); }catch(_){ }
    try{ if(state.html5) await state.html5.clear(); }catch(_){ }
    state.html5=null;
    const region=$('ehf-html5-camera-region'); if(region){ region.innerHTML=''; region.style.display='none'; }
    const video=$('ehf-camera-video'); if(video) video.style.display='block';
    if(hide){ const modal=$('ehf-camera-modal'); if(modal) modal.style.display='none'; }
  }

  function boot(){
    injectStyles();
    ensureButtons();
    setTimeout(ensureButtons,500);
    setTimeout(ensureButtons,1500);
    setTimeout(ensureButtons,3500);
  }

  window.EHFMobileCameraScan = {
    version: window.EHF_MOBILE_CAMERA_SCAN_VERSION,
    open: openCameraScanner,
    close: closeCameraScanner,
    photo: openPhotoScanner,
    ensureButtons,
    isIOS,
    normalize
  };

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('hashchange',()=>setTimeout(ensureButtons,160));
  const mo = new MutationObserver(()=>ensureButtons());
  mo.observe(document.documentElement,{childList:true,subtree:true});
})();
