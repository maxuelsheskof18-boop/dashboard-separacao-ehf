    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getDatabase, ref, set, onValue, push, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

    const firebaseConfig = {
      apiKey: "AIzaSyCcO-kwO-vIFs8x0zchjlyc1bsOxCLnhgs",
      authDomain: "painel-expedicao-a23c6.firebaseapp.com",
      databaseURL: "https://painel-expedicao-a23c6-default-rtdb.firebaseio.com",
      projectId: "painel-expedicao-a23c6",
      storageBucket: "painel-expedicao-a23c6.firebasestorage.app",
      messagingSenderId: "1095017505982",
      appId: "1:1095017505982:web:8cdebef7aea45b21622aef"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);


    /* ========== CALENDÁRIO OPERACIONAL DIÁRIO ========== */
    function getBrasiliaDateKey(date = new Date()) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date);
      const obj = {};
      parts.forEach(p => obj[p.type] = p.value);
      return `${obj.year}-${obj.month}-${obj.day}`;
    }

    function getWeekKey(dateKey) {
      const d = new Date(dateKey + 'T12:00:00');
      const onejan = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
      return `${d.getFullYear()}-S${String(week).padStart(2, '0')}`;
    }

    function getDataOperacionalSelecionada() {
      return localStorage.getItem('ehf_data_operacional') || getBrasiliaDateKey();
    }

    const DATA_OPERACIONAL = getDataOperacionalSelecionada();
    window.ehfDataOperacional = DATA_OPERACIONAL;
    window.ehfIsDataHistorica = DATA_OPERACIONAL !== getBrasiliaDateKey();

    function diaPath(subpath) {
      return `expedicao/dias/${DATA_OPERACIONAL}/${subpath}`;
    }

    function semanaPath(subpath) {
      return `expedicao/semanas/${getWeekKey(DATA_OPERACIONAL)}/${DATA_OPERACIONAL}/${subpath}`;
    }

    function criarControleCalendarioOperacional() {
      if (document.getElementById('controle-calendario-operacional')) return;

      const topRight = document.querySelector('.topbar-right') || document.querySelector('.topbar') || document.body;
      const box = document.createElement('div');
      box.id = 'controle-calendario-operacional';
      box.innerHTML = `
        <span>Data operacional</span>
        <input id="input-data-operacional" type="date" value="${DATA_OPERACIONAL}" />
        <button id="btn-data-hoje" type="button">Hoje</button>
      `;

      const style = document.createElement('style');
      style.innerHTML = `
        #controle-calendario-operacional{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:999px;padding:6px 8px;font-size:11px;color:#aaa;}
        #controle-calendario-operacional input{background:#080808;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:6px;font-size:12px;max-width:140px;}
        #controle-calendario-operacional button{background:#222;color:#ff8a00;border:1px solid rgba(255,138,0,.35);border-radius:7px;padding:6px 9px;font-size:11px;font-weight:800;cursor:pointer;}
        .ehf-historico-banner{background:rgba(255,138,0,.10);border:1px solid rgba(255,138,0,.28);color:#ffbd72;border-radius:10px;padding:8px 10px;margin:8px 0;font-size:12px;font-weight:700;}
      `;
      document.head.appendChild(style);
      topRight.prepend(box);

      document.getElementById('input-data-operacional').addEventListener('change', (e) => {
        localStorage.setItem('ehf_data_operacional', e.target.value);
        location.reload();
      });

      document.getElementById('btn-data-hoje').addEventListener('click', () => {
        localStorage.removeItem('ehf_data_operacional');
        location.reload();
      });

      if (window.ehfIsDataHistorica) {
        const banner = document.createElement('div');
        banner.className = 'ehf-historico-banner';
        banner.textContent = `Visualizando histórico de ${DATA_OPERACIONAL}. Para voltar à operação atual, clique em Hoje.`;
        const viewColetas = document.getElementById('view-coletas') || document.body;
        viewColetas.prepend(banner);
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      const bipagemAtiva = document.getElementById('view-bipagem')?.classList.contains('active');
      document.body.classList.toggle('ehf-bipagem-ativa', !!bipagemAtiva);
      if (typeof atualizarVisibilidadePainelProducao === 'function') {
        setTimeout(atualizarVisibilidadePainelProducao, 100);
      }
    });

    document.addEventListener('DOMContentLoaded', criarControleCalendarioOperacional);

    async function salvarSnapshotOperacionalDiario(payload) {
      try {
        const snapshot = {
          ...payload,
          dataOperacional: DATA_OPERACIONAL,
          semana: getWeekKey(DATA_OPERACIONAL),
          atualizadoEm: Date.now(),
          atualizadoEmTexto: formatHorarioBrasilia(new Date(), true)
        };
        await set(ref(db, diaPath('snapshot_operacional')), snapshot);
        await set(ref(db, semanaPath('snapshot_operacional')), snapshot);
      } catch (e) {
        console.warn('Não foi possível salvar snapshot diário:', e);
      }
    }


    /* ========== PAINEL DE PRODUÇÃO FLUTUANTE + ROTINA ADMIN ========== */
    const producaoAdminRef = ref(db, diaPath("admin/producao"));
    const rotinaAdminRef = ref(db, diaPath("admin/rotina_separacao"));

    const producaoPadraoPainel = [
      { id: "magalu", nome: "MAGALU", horario: "07:00", ativo: true, finalizado: false, naoTem: false },
      { id: "spx", nome: "SPX", horario: "11:00", ativo: true, finalizado: false, naoTem: false },
      { id: "flex", nome: "FLEX", horario: "13:30", ativo: true, finalizado: false, naoTem: false },
      { id: "melhor_envio", nome: "MELHOR ENVIO", horario: "12:00", ativo: true, finalizado: false, naoTem: false },
      { id: "tiktok", nome: "TIKTOK", horario: "12:00", ativo: true, finalizado: false, naoTem: false },
      { id: "amazon", nome: "AMAZON", horario: "11:00", ativo: true, finalizado: false, naoTem: false },
      { id: "mercado_envio", nome: "MERCADO ENVIO", horario: "13:30", ativo: true, finalizado: false, naoTem: false },
      { id: "shopee", nome: "SHOPEE", horario: "13:00", ativo: true, finalizado: false, naoTem: false }
    ];

    const rotinaPadraoPainel = [
      {
        id: "rotina_0700",
        horario: "07:00",
        titulo: "Enviar todos para separação",
        descricao: "Envio geral do início do dia para separação.",
        canais: ["MAGALU", "SPX", "FLEX", "MELHOR ENVIO", "TIKTOK", "AMAZON", "MERCADO ENVIO", "SHOPEE"],
        sequenciaRemessa: ["MAGALU", "SPX", "FLEX", "MELHOR ENVIO", "TIKTOK", "AMAZON", "MERCADO ENVIO", "SHOPEE"],
        concluido: false,
        concluidoEm: ""
      },
      {
        id: "rotina_1100",
        horario: "11:00",
        titulo: "Enviar SPX entrega rápida e Amazon, revisar Magalu",
        descricao: "Priorizar SPX entrega rápida e Amazon. Revisar Magalu para garantir que nada ficou parado.",
        canais: ["SPX", "AMAZON", "MAGALU"],
        sequenciaRemessa: ["SPX", "AMAZON", "MAGALU"],
        concluido: false,
        concluidoEm: ""
      },
      {
        id: "rotina_1200",
        horario: "12:00",
        titulo: "Enviar TikTok e Melhor Envio, revisar Mercado Livre",
        descricao: "Enviar TikTok e Melhor Envio. Revisar Mercado Livre e conferir horário de despacho.",
        canais: ["TIKTOK", "MELHOR ENVIO", "MERCADO ENVIO"],
        sequenciaRemessa: ["TIKTOK", "MELHOR ENVIO", "MERCADO ENVIO"],
        concluido: false,
        concluidoEm: ""
      },
      {
        id: "rotina_1300",
        horario: "13:00",
        titulo: "Enviar Shopee coleta para separação",
        descricao: "Enviar Shopee coleta. Se Mercado Livre estiver com corte às 16h, enviar Mercado Livre também.",
        canais: ["SHOPEE", "MERCADO ENVIO"],
        sequenciaRemessa: ["SHOPEE", "MERCADO ENVIO"],
        concluido: false,
        concluidoEm: ""
      },
      {
        id: "rotina_1330",
        horario: "13:30",
        titulo: "Enviar Mercado Livre e revisar Shopee",
        descricao: "Enviar Mercado Livre para separação e revisar se ficou algo para trás da Shopee.",
        canais: ["MERCADO ENVIO", "SHOPEE"],
        sequenciaRemessa: ["MERCADO ENVIO", "SHOPEE"],
        concluido: false,
        concluidoEm: ""
      }
    ];

    function salvarProducaoPadraoSeVazio() {
      set(producaoAdminRef, {
        sequencia: producaoPadraoPainel,
        atualizadoEm: Date.now(),
        atualizadoEmTexto: formatHorarioBrasilia(new Date(), true),
        atualizadoPor: "SISTEMA"
      }).catch((err) => console.warn("Não foi possível inicializar produção padrão:", err));
    }

    function salvarRotinaPadraoSeVazio() {
      set(rotinaAdminRef, {
        itens: rotinaPadraoPainel,
        atualizadoEm: Date.now(),
        atualizadoEmTexto: formatHorarioBrasilia(new Date(), true),
        atualizadoPor: "SISTEMA"
      }).catch((err) => console.warn("Não foi possível inicializar rotina padrão:", err));
    }

    onValue(producaoAdminRef, (snapshot) => {
      const config = snapshot.val();
      const sequencia = Array.isArray(config?.sequencia) && config.sequencia.length > 0
        ? config.sequencia
        : producaoPadraoPainel;

      window.ehfProducaoAdmin = sequencia;
      renderPainelProducaoFlutuante(sequencia, window.ehfRotinaAdmin || rotinaPadraoPainel);

      if (!config || !Array.isArray(config.sequencia) || config.sequencia.length === 0) {
        salvarProducaoPadraoSeVazio();
      }
    }, (error) => {
      console.warn("Erro ao ler produção admin. Usando padrão local:", error);
      window.ehfProducaoAdmin = producaoPadraoPainel;
      renderPainelProducaoFlutuante(producaoPadraoPainel, window.ehfRotinaAdmin || rotinaPadraoPainel);
    });

    onValue(rotinaAdminRef, (snapshot) => {
      const config = snapshot.val();
      const rotina = Array.isArray(config?.itens) && config.itens.length > 0
        ? config.itens
        : rotinaPadraoPainel;

      window.ehfRotinaAdmin = rotina;
      renderPainelProducaoFlutuante(window.ehfProducaoAdmin || producaoPadraoPainel, rotina);

      if (!config || !Array.isArray(config.itens) || config.itens.length === 0) {
        salvarRotinaPadraoSeVazio();
      }
    }, (error) => {
      console.warn("Erro ao ler rotina admin. Usando padrão local:", error);
      window.ehfRotinaAdmin = rotinaPadraoPainel;
      renderPainelProducaoFlutuante(window.ehfProducaoAdmin || producaoPadraoPainel, rotinaPadraoPainel);
    });

    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => {
        if (!document.getElementById("painel-producao-flutuante")) {
          window.ehfProducaoAdmin = window.ehfProducaoAdmin || producaoPadraoPainel;
          window.ehfRotinaAdmin = window.ehfRotinaAdmin || rotinaPadraoPainel;
          renderPainelProducaoFlutuante(window.ehfProducaoAdmin, window.ehfRotinaAdmin);
        }
      }, 1200);
    });

    function getPosicaoPainelProducao() {
      try {
        return JSON.parse(localStorage.getItem("ehf_painel_producao_posicao") || "null");
      } catch (e) {
        return null;
      }
    }

    function salvarPosicaoPainelProducao(left, top) {
      localStorage.setItem("ehf_painel_producao_posicao", JSON.stringify({ left, top }));
    }

    function habilitarArrastarPainelProducao(painel) {
      const header = painel.querySelector(".pp-header");
      if (!header || header.dataset.dragReady === "1") return;
      header.dataset.dragReady = "1";

      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;

      function iniciar(e) {
        if (e.target && e.target.id === "pp-toggle") return;

        dragging = true;
        painel.classList.add("pp-dragging");

        const point = e.touches ? e.touches[0] : e;
        const rect = painel.getBoundingClientRect();

        startX = point.clientX;
        startY = point.clientY;
        startLeft = rect.left;
        startTop = rect.top;

        painel.style.left = `${rect.left}px`;
        painel.style.top = `${rect.top}px`;
        painel.style.right = "auto";
        painel.style.bottom = "auto";

        document.addEventListener("mousemove", mover);
        document.addEventListener("mouseup", finalizar);
        document.addEventListener("touchmove", mover, { passive: false });
        document.addEventListener("touchend", finalizar);
      }

      function mover(e) {
        if (!dragging) return;
        if (e.cancelable) e.preventDefault();

        const point = e.touches ? e.touches[0] : e;
        const dx = point.clientX - startX;
        const dy = point.clientY - startY;

        const maxLeft = window.innerWidth - painel.offsetWidth - 8;
        const maxTop = window.innerHeight - painel.offsetHeight - 8;

        const left = Math.max(8, Math.min(maxLeft, startLeft + dx));
        const top = Math.max(8, Math.min(maxTop, startTop + dy));

        painel.style.left = `${left}px`;
        painel.style.top = `${top}px`;
      }

      function finalizar() {
        if (!dragging) return;
        dragging = false;
        painel.classList.remove("pp-dragging");

        const rect = painel.getBoundingClientRect();
        salvarPosicaoPainelProducao(rect.left, rect.top);

        document.removeEventListener("mousemove", mover);
        document.removeEventListener("mouseup", finalizar);
        document.removeEventListener("touchmove", mover);
        document.removeEventListener("touchend", finalizar);
      }

      header.addEventListener("mousedown", iniciar);
      header.addEventListener("touchstart", iniciar, { passive: true });
    }

    function renderPainelProducaoFlutuante(sequencia, rotina) {
      window.ehfProducaoAdmin = Array.isArray(sequencia) ? sequencia : [];
      window.ehfRotinaAdmin = Array.isArray(rotina) ? rotina : [];
      document.getElementById('painel-producao-flutuante')?.remove();
    }

    async function atualizarStatusProducaoPainel(id, field, checked) {
      const sequenciaAtual = Array.isArray(window.ehfProducaoAdmin) && window.ehfProducaoAdmin.length > 0
        ? window.ehfProducaoAdmin
        : producaoPadraoPainel;

      const novaSequencia = sequenciaAtual.map(item => {
        if (String(item.id) !== String(id)) return item;

        const novoItem = { ...item };

        if (field === "naoTem") {
          novoItem.naoTem = checked;
          if (checked) novoItem.finalizado = false;
        }

        if (field === "finalizado") {
          novoItem.finalizado = checked;
          if (checked) novoItem.naoTem = false;
        }

        return novoItem;
      });

      window.ehfProducaoAdmin = novaSequencia;
      renderPainelProducaoFlutuante(novaSequencia, window.ehfRotinaAdmin || rotinaPadraoPainel);

      const itemAlterado = novaSequencia.find(item => String(item.id) === String(id));
      const statusTexto = field === "naoTem"
        ? (checked ? "NÃO TEM" : "removeu NÃO TEM")
        : (checked ? "FEITO" : "removeu FEITO");

      try {
        await set(producaoAdminRef, {
          sequencia: novaSequencia,
          atualizadoEm: Date.now(),
          atualizadoEmTexto: formatHorarioBrasilia(new Date(), true),
          atualizadoPor: nomeOperadorLocal || "PAINEL"
        });

        await set(alertaBroadcastRef, {
          txt: `O operador <b>${nomeOperadorLocal || "PAINEL"}</b> marcou <b>${itemAlterado?.nome || id}</b> como <b>${statusTexto}</b> no Painel de Produção.`,
          ts: Date.now()
        });
      } catch (err) {
        console.warn("Erro ao atualizar produção pelo painel:", err);
      }
    }

    const estadoRef = ref(db, diaPath('estado_atual'));
    const alertaBroadcastRef = ref(db, 'expedicao/ultimo_alerta');
    const bipagemRef = ref(db, diaPath('bipagens_dia'));

    const terminalID = 'tela_' + Math.random().toString(36).substring(2, 9);
    const meuUsuarioRef = ref(db, 'expedicao/operadores_ativos/' + terminalID);

    const GRUPOS_CONFIG = [
      {
        titulo: "MERCADO LIVRE",
        lojas: [
          { id: 'mercado_envios_coleta', name: 'MERCADO ENVIOS COLETA' },
          { id: 'mercado_livre_remessa_1', name: 'MERCADO LIVRE - REMESSA 1', defaultTime: '13:00', remessa: '1ª remessa' },
          { id: 'mercado_livre_remessa_2', name: 'MERCADO LIVRE - REMESSA 2', defaultTime: '16:00', remessa: '2ª remessa' },
          { id: 'comercio', name: 'COMERCIO' },
          { id: 'suprimentos', name: 'SUPRIMENTOS' },
          { id: 'ekn', name: 'EKN' },
          { id: 'distribuidora', name: 'DISTRIBUIDORA' },
          { id: 'mercado_envios_flex', name: 'MERCADO ENVIOS FLEX' }
        ]
      },
      {
        titulo: "SHOPEE",
        lojas: [
          { id: 'shopee_remessa_1', name: 'SHOPEE ENVIO - REMESSA 1', defaultTime: '13:00', remessa: '1ª remessa' },
          { id: 'shopee_remessa_2', name: 'SHOPEE ENVIO - REMESSA 2', defaultTime: '16:00', remessa: '2ª remessa' },
          { id: 'spx', name: 'SPX ENTREGA RÁPIDA' },
          { id: 'shopee_xpress', name: 'SHOPEE XPRESS' }
        ]
      },
      {
        titulo: "OUTRAS PLATAFORMAS",
        lojas: [
          { id: 'amazon', name: 'AMAZON' },
          { id: 'tiktok', name: 'TIKTOK' },
          { id: 'melhor_envio', name: 'MELHOR ENVIO' },
          { id: 'magalu', name: 'MAGALU' }
        ]
      }
    ];

    let localTasks = [];
    let isUpdatingFromFirebase = false;
    let timestampUltimoAlertaLocal = Date.now();
    let nomeOperadorLocal = "GERAL";
    let totalBipadosFisico = 0;
    const ALARM_SNOOZE_MS = 10 * 60 * 1000;
    const ALARM_RESOLVED_RECHECK_MS = 10 * 60 * 1000;
    const ALARM_CHECK_MS = 30 * 1000;
    const alarmState = {};

    function gerenciarLoginServidor() {
      let user = localStorage.getItem('ehf_operador');

      if (!user || user.trim() === "") {
        user = prompt("Quem está operando este painel hoje?");

        if (!user || user.trim() === "") {
          user = "Geral";
        }

        localStorage.setItem('ehf_operador', user.trim().toUpperCase());
      }

      nomeOperadorLocal = user.trim().toUpperCase();

      const currentUser = document.getElementById('current-user');

      if (currentUser) {
        currentUser.textContent = nomeOperadorLocal;
      }

      set(meuUsuarioRef, {
        nome: nomeOperadorLocal,
        ts: Date.now()
      });
    }

    document.getElementById('btn-change-user').addEventListener('click', () => {
      localStorage.removeItem('ehf_operador');
      gerenciarLoginServidor();
    });

    gerenciarLoginServidor();

    /* ========== SESSÃO DE COLETA / ROMANEIO ========== */
    const EHF_WORKER_BASE = String(window.EHF_API_BASE || 'https://atendente-vesco-separacao.2cwhzy.easypanel.host').replace(/\/+$/, '');
    let ehfBipSession = null;
    const EHF_FAST_BIP_QUEUE_KEY = `ehf_fast_bip_queue_${DATA_OPERACIONAL}`;
    const ehfFastBipSeen = new Set();
    let ehfFastBipQueue = [];
    let ehfFastBipInFlight = 0;
    let ehfFastBipPollBusy = false;
    let ehfFastLastServerQueue = { resolver: { pending: 0 }, sheet: { pending: 0 } };

    function ehfFastLoadPendingQueue() {
      try {
        const rows = JSON.parse(localStorage.getItem(EHF_FAST_BIP_QUEUE_KEY) || '[]');
        ehfFastBipQueue = Array.isArray(rows) ? rows.filter((row) => row && row.code && row.sessionId) : [];
        ehfFastBipQueue.forEach((row) => ehfFastBipSeen.add(String(row.normalized || limparCodigoBipado(row.code))));
      } catch (_) { ehfFastBipQueue = []; }
    }

    function ehfFastPersistQueue() {
      try { localStorage.setItem(EHF_FAST_BIP_QUEUE_KEY, JSON.stringify(ehfFastBipQueue.slice(-500))); } catch (_) {}
      ehfFastUpdateQueueUi();
    }

    function ehfFastUpdateQueueUi(summary) {
      const local = ehfFastBipQueue.length + ehfFastBipInFlight;
      const pending = Number(summary?.pendingResolution ?? ehfBipSession?.summary?.pendingResolution ?? ehfFastLastServerQueue?.resolver?.pending ?? 0);
      const sheet = Number(summary?.sheetPending ?? ehfBipSession?.summary?.sheetPending ?? ehfFastLastServerQueue?.sheet?.pending ?? 0);
      const q = document.getElementById('bip-session-queue'); if (q) q.textContent = String(local);
      const p = document.getElementById('bip-session-pending'); if (p) p.textContent = String(pending);
      const sh = document.getElementById('bip-session-sheet'); if (sh) sh.textContent = String(sheet);
      const status = document.querySelector('.bip-scan-hero .scan-status');
      if (status) {
        status.textContent = local > 0 ? `Salvando ${local}` : pending > 0 ? `Identificando ${pending}` : 'Pronto';
        status.classList.toggle('busy', local > 0 || pending > 0);
      }
    }

    function ehfFastStatusFromScan(scan) {
      const resolution = String(scan?.resolution_status || '').toUpperCase();
      if (resolution === 'RESOLVIDO') return scan.status === 'CANAL_DIVERGENTE' ? 'Canal divergente' : 'Conferido';
      if (resolution === 'NAO_LOCALIZADO' || resolution === 'ERRO_FINAL') return 'Não localizado';
      return 'Identificando...';
    }

    function ehfFastRefreshSeenFromSession(detail) {
      (detail?.scans || []).forEach((scan) => {
        const code = String(scan.normalized_code || scan.scanned_code || '').trim();
        if (code) ehfFastBipSeen.add(code);
      });
    }

    function ehfFastSyncFirebaseFromSession(detail) {
      const scans = detail?.scans || [];
      if (!scans.length || !(ehfBipagensCache || []).length) return;
      const byId = new Map(scans.map((scan) => [String(scan.id || ''), scan]));
      const byCode = new Map(scans.map((scan) => [String(scan.normalized_code || scan.scanned_code || '').trim(), scan]));
      (ehfBipagensCache || []).forEach((cached) => {
        const code = String(cached.codigoLimpo || cached.codigo || '').trim();
        const scan = (cached.scanId ? byId.get(String(cached.scanId)) : null) || byCode.get(code);
        if (!scan || !cached._firebaseKey) return;
        const nextStatus = ehfFastStatusFromScan(scan);
        const nextTiny = String(scan.tiny_number || '');
        const nextMarket = String(scan.ecommerce_order_id || '');
        const nextStore = String(scan.account || cached.lojaKey || 'nao_localizada');
        const nextUnits = Number(scan.total_units || 0);
        const nextResolution = String(scan.resolution_status || '');
        const unchanged = String(cached.status || '') === nextStatus &&
          String(cached.pedidoTiny || '') === nextTiny && String(cached.pedidoMarketplace || '') === nextMarket &&
          Number(cached.totalUnidades || 0) === nextUnits && String(cached.lookupStatus || '') === nextResolution &&
          String(cached.scanId || '') === String(scan.id || '');
        if (unchanged) return;
        const payload = { ...cached };
        delete payload._firebaseKey;
        Object.assign(payload, {
          scanId: scan.id,
          lojaKey: nextStore,
          lojaNome: NOMES_LOJAS_BIPAGEM[nextStore] || nextStore || 'Não localizada',
          plataforma: scan.platform || cached.plataforma || 'A identificar',
          canal: scan.channel_code || cached.canal || '',
          canalNome: scan.channel_name || cached.canalNome || '',
          idEtiqueta: scan.normalized_code || cached.idEtiqueta || code,
          codigoRastreio: scan.shipment_id || cached.codigoRastreio || code,
          pedidoTiny: nextTiny,
          pedidoMarketplace: nextMarket,
          totalUnidades: nextUnits,
          lookupStatus: nextResolution,
          lookupTentativas: Number(scan.resolution_attempts || 0),
          status: nextStatus,
          observacao: scan.error || (nextStatus === 'Conferido' ? 'Pedido identificado em segundo plano.' : cached.observacao || '')
        });
        set(ref(db, `${diaPath('bipagens_dia')}/${cached._firebaseKey}`), payload).catch(()=>{});
      });
    }

    function ehfApiHeaders() {
      const headers = { 'Content-Type': 'application/json' };
      const apiKey = localStorage.getItem('ehf_api_key') || '';
      if (apiKey) headers['x-api-key'] = apiKey;
      return headers;
    }

    async function ehfApi(path, options = {}) {
      const method = String(options.method || 'GET').toUpperCase();
      const separator = String(path).includes('?') ? '&' : '?';
      const requestPath = method === 'GET' ? `${path}${separator}_ts=${Date.now()}` : path;
      const response = await fetch(EHF_WORKER_BASE + requestPath, {
        cache: 'no-store',
        ...options,
        headers: { ...ehfApiHeaders(), ...(options.headers || {}) }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || data.message || `Erro HTTP ${response.status}`);
        error.data = data;
        error.status = response.status;
        throw error;
      }
      return data;
    }

    function ehfBipToast(message, danger = false) {
      const container = document.getElementById('toast-container');
      if (!container) return;
      container.innerHTML = `<b style="color:${danger ? '#ff7b7b' : '#ff9b22'}">${message}</b>`;
      container.style.display = 'block';
      setTimeout(() => { container.style.display = 'none'; }, 3500);
    }

    function ehfOpenBipSessionModal() {
      const panel = document.getElementById('bip-session-panel');
      if (!panel) return;
      document.getElementById('bip-session-checker').value = nomeOperadorLocal || '';
      document.getElementById('bip-session-collector').value = localStorage.getItem('ehf_ultimo_coletor') || '';
      panel.classList.add('setup-open');
      setTimeout(() => document.getElementById('bip-session-collector')?.focus(), 50);
    }

    function ehfCloseBipSessionModal() {
      document.getElementById('bip-session-panel')?.classList.remove('setup-open');
    }
    window.ehfOpenBipSessionSetup = ehfOpenBipSessionModal;

    function ehfSetScanLocked(locked) {
      const hero = document.querySelector('.bip-scan-hero');
      const input = document.getElementById('input-leitor-codigo');
      hero?.classList.toggle('session-locked', !!locked);
      if (input) {
        input.disabled = !!locked;
        input.placeholder = locked ? 'INICIE UMA CONFERÊNCIA PARA BIPAR' : 'BIPE AQUI';
      }
    }

    function ehfRenderBipSession(detail) {
      ehfBipSession = detail || null;
      const session = detail?.session || null;
      const summary = detail?.summary || {};
      const title = document.getElementById('bip-session-title');
      const description = document.getElementById('bip-session-description');
      const btnStart = document.getElementById('btn-bip-session-start');
      const btnManifest = document.getElementById('btn-bip-session-manifest');
      const btnFinish = document.getElementById('btn-bip-session-finish');
      document.getElementById('bip-session-packages').textContent = Number(summary.packages || 0);
      document.getElementById('bip-session-units').textContent = Number(summary.totalUnits || 0);
      ehfFastRefreshSeenFromSession(detail);
      ehfFastSyncFirebaseFromSession(detail);
      ehfFastUpdateQueueUi(summary);
      const meta = document.getElementById('bip-session-current-meta');
      window.ehfBipHasOpenSession = !!(session && session.status === 'ABERTA');
      if (!session || session.status !== 'ABERTA') {
        title.textContent = 'Configure a coleta/conferência';
        description.textContent = 'Escolha o canal e informe claramente quem está coletando e quem está conferindo.';
        description.className = 'bip-session-warning';
        if (meta) meta.innerHTML = '<span>Status <b>aguardando início</b></span><span>Romaneio <b>será gerado ao finalizar</b></span>';
        btnStart.textContent = 'Preencher dados';
        btnManifest.disabled = !session;
        btnFinish.disabled = true;
        ehfSetScanLocked(true);
        document.getElementById('bip-session-panel')?.classList.add('setup-open');
        return;
      }
      title.textContent = `${session.channel_name} — coleta com ${session.collector_name}`;
      description.textContent = `Conferente: ${session.checker_name || session.operator} · Sessão #${session.id} · iniciada em ${new Date(session.opened_at).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`;
      description.className = 'bip-session-success';
      if (meta) meta.innerHTML = `<span>Canal <b>${ehfEscapeHtml(session.channel_name)}</b></span><span>Coletor/responsável <b>${ehfEscapeHtml(session.collector_name)}</b></span><span>Conferente <b>${ehfEscapeHtml(session.checker_name || session.operator)}</b></span><span>Loja <b>${ehfEscapeHtml(session.account || 'todas')}</b></span>`;
      document.getElementById('bip-session-panel')?.classList.remove('setup-open');
      btnStart.textContent = 'Trocar / nova sessão';
      btnManifest.disabled = false;
      btnFinish.disabled = false;
      ehfSetScanLocked(false);
      setTimeout(() => document.getElementById('input-leitor-codigo')?.focus(), 80);
      localStorage.setItem('ehf_bip_session_id', String(session.id));
    }

    async function ehfLoadBipSession() {
      const savedId = Number(localStorage.getItem('ehf_bip_session_id') || 0);
      try {
        let data;
        if (savedId) data = await ehfApi(`/api/bipagem/sessoes/${savedId}`);
        else data = await ehfApi(`/api/bipagem/sessoes/ativa?operator=${encodeURIComponent(nomeOperadorLocal || '')}`);
        const detail = data.detail || (data.session && data.summary ? data : null);
        if (detail?.session?.status === 'ABERTA') ehfRenderBipSession(detail);
        else ehfRenderBipSession(detail || null);
      } catch (_) {
        localStorage.removeItem('ehf_bip_session_id');
        ehfRenderBipSession(null);
      }
    }

    async function ehfStartBipSession() {
      const channelCode = document.getElementById('bip-session-channel').value;
      const account = document.getElementById('bip-session-account').value;
      const collectorName = document.getElementById('bip-session-collector').value.trim();
      const checkerName = document.getElementById('bip-session-checker').value.trim() || nomeOperadorLocal;
      const notes = document.getElementById('bip-session-notes').value.trim();
      if (!collectorName) return ehfBipToast('Informe quem receberá ou levará os pacotes.', true);
      if (!checkerName) return ehfBipToast('Informe quem está conferindo.', true);
      try {
        const data = await ehfApi('/api/bipagem/sessoes', {
          method: 'POST',
          body: JSON.stringify({ channelCode, account, collectorName, checkerName, operator: nomeOperadorLocal, notes })
        });
        localStorage.setItem('ehf_ultimo_coletor', collectorName);
        ehfCloseBipSessionModal();
        ehfRenderBipSession(data.detail);
        ehfBipToast(`Conferência iniciada para ${data.session.channel_name}.`);
      } catch (error) {
        ehfBipToast(error.message, true);
      }
    }

    function ehfEscapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
    }

    function ehfPrintManifest(detail) {
      if (!detail?.session) return;
      const { session, scans = [], summary = {} } = detail;
      const rows = scans.map((scan, index) => {
        const products = (scan.items || []).map((item) => `${Number(item.quantity || item.quantidade || 0)}x ${item.description || item.descricao || item.sku || item.codigo || ''}`).join('<br>');
        const status = ehfFastStatusFromScan(scan);
        return `<tr><td>${index + 1}</td><td><b>#${Number(scan.id || 0)}</b></td><td>${ehfEscapeHtml((scan.account || session.account || '-').toUpperCase())}</td><td>${ehfEscapeHtml(scan.tiny_number || '-')}</td><td>${ehfEscapeHtml(scan.ecommerce_order_id || '-')}</td><td>${ehfEscapeHtml(scan.normalized_code || scan.shipment_id || scan.scanned_code || '-')}</td><td>${ehfEscapeHtml(scan.capture_category || '-')}</td><td>${ehfEscapeHtml(status)}</td><td>${products || '-'}</td><td>${Number(scan.total_units || 0)}</td></tr>`;
      }).join('');
      const firstId = summary.firstScanId || (scans[0]?.id || '-');
      const lastId = summary.lastScanId || (scans.length ? scans[scans.length - 1]?.id : '-');
      const idRange = scans.length ? (String(firstId) === String(lastId) ? `#${firstId}` : `#${firstId} a #${lastId}`) : '-';
      const win = window.open('', '_blank', 'width=1180,height=820');
      if (!win) return ehfBipToast('O navegador bloqueou a abertura do romaneio.', true);
      win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Romaneio #${session.id}</title><style>body{font-family:Arial,sans-serif;color:#111;margin:26px}h1{margin:0;font-size:24px}.head{display:flex;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:12px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.meta div{border:1px solid #bbb;padding:9px}.meta span{display:block;font-size:10px;text-transform:uppercase;color:#555}.meta b{font-size:13px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #aaa;padding:6px;vertical-align:top}th{background:#eee}.totals{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:15px 0}.totals div{border:2px solid #111;padding:9px;text-align:center}.totals b{font-size:21px}.receipt{margin:22px 0 0;border:2px solid #111;padding:12px;font-size:12px;line-height:1.5}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:70px}.signature{border-top:1px solid #111;text-align:center;padding-top:6px}.foot{margin-top:24px;font-size:9px;color:#555}@media print{button{display:none}body{margin:9mm}}@page{size:A4 landscape;margin:8mm}</style></head><body><div class="head"><div><h1>EHF LOGÍSTICA</h1><div>Romaneio de coleta / expedição</div></div><div><b>ROMANEIO #${session.id}</b><br>${new Date().toLocaleString('pt-BR')}</div></div><div class="meta"><div><span>Canal</span><b>${ehfEscapeHtml(session.channel_name)}</b></div><div><span>Responsável / coletor</span><b>${ehfEscapeHtml(session.collector_name)}</b></div><div><span>Conferente</span><b>${ehfEscapeHtml(session.checker_name || session.operator)}</b></div><div><span>Início</span><b>${new Date(session.opened_at).toLocaleString('pt-BR')}</b></div><div><span>Fim</span><b>${session.closed_at ? new Date(session.closed_at).toLocaleString('pt-BR') : 'Em andamento'}</b></div><div><span>IDs internos de bipagem</span><b>${ehfEscapeHtml(idRange)}</b></div></div><div class="totals"><div><b>${Number(summary.packages || scans.length || 0)}</b><br>volumes bipados</div><div><b>${Number(summary.resolvedPackages || 0)}</b><br>identificados</div><div><b>${Number(summary.pendingResolution || 0)}</b><br>em identificação</div><div><b>${Number(summary.uniqueOrders || 0)}</b><br>pedidos</div><div><b>${Number(summary.totalUnits || 0)}</b><br>unidades</div><div><b>${Number(summary.channelDivergence || 0)}</b><br>divergências</div></div><table><thead><tr><th>#</th><th>ID bipagem</th><th>Loja</th><th>Pedido Tiny</th><th>Pedido marketplace</th><th>Código / rastreio</th><th>Categoria</th><th>Status</th><th>Produtos</th><th>Unid.</th></tr></thead><tbody>${rows || '<tr><td colspan="10">Nenhuma leitura registrada.</td></tr>'}</tbody></table><div class="receipt">Declaro o recebimento de <b>${Number(summary.packages || scans.length || 0)} volume(s)</b> referentes ao <b>Romaneio #${session.id}</b>, identificados internamente pela faixa <b>${ehfEscapeHtml(idRange)}</b>. Pedidos ainda em identificação poderão ser vinculados automaticamente em segundo plano sem alterar a quantidade física recebida.</div><div class="signatures"><div class="signature">Entregue/conferido por: ${ehfEscapeHtml(session.checker_name || session.operator)}</div><div class="signature">Recebido por: ${ehfEscapeHtml(session.collector_name)}</div></div><div class="signatures"><div class="signature">Documento / placa</div><div class="signature">Assinatura e data/hora</div></div><div class="foot">Dashboard EHF · Romaneio #${session.id} · ${Number(summary.packages || scans.length || 0)} volumes · IDs ${ehfEscapeHtml(idRange)}</div></body></html>`);
      win.document.close();
      setTimeout(() => { try { win.focus(); win.print(); } catch (_) {} }, 350);
    }

    async function ehfRefreshBipSession() {
      if (!ehfBipSession?.session?.id) return;
      try {
        const detail = await ehfApi(`/api/bipagem/sessoes/${ehfBipSession.session.id}`);
        ehfRenderBipSession(detail);
      } catch (_) {}
    }

    async function ehfFinishBipSession() {
      if (!ehfBipSession?.session?.id) return;
      if (!confirm(`Finalizar a conferência com ${ehfBipSession.summary?.packages || 0} pacotes e gerar o romaneio?`)) return;
      try {
        const detail = await ehfApi(`/api/bipagem/sessoes/${ehfBipSession.session.id}/finalizar`, { method:'POST', body:JSON.stringify({ signedBy: ehfBipSession.session.collector_name }) });
        ehfPrintManifest(detail);
        localStorage.removeItem('ehf_bip_session_id');
        ehfRenderBipSession(detail);
        ehfBipSession = null;
        setTimeout(() => ehfRenderBipSession(null), 800);
      } catch (error) { ehfBipToast(error.message, true); }
    }

    window.ehfEnsureBipSession = function() {
      if (!ehfBipSession?.session || ehfBipSession.session.status !== 'ABERTA') {
        ehfLoadBipSession().then(() => {
          if (!ehfBipSession?.session || ehfBipSession.session.status !== 'ABERTA') ehfOpenBipSessionModal();
        });
      }
    };

    document.getElementById('btn-bip-session-start')?.addEventListener('click', ehfOpenBipSessionModal);
    document.getElementById('btn-bip-session-cancel')?.addEventListener('click', ehfCloseBipSessionModal);
    document.getElementById('btn-bip-session-confirm')?.addEventListener('click', ehfStartBipSession);
    document.getElementById('btn-bip-session-manifest')?.addEventListener('click', () => ehfPrintManifest(ehfBipSession));
    document.getElementById('btn-bip-session-finish')?.addEventListener('click', ehfFinishBipSession);
    document.getElementById('bip-session-modal')?.addEventListener('click', (event) => { if (event.target.id === 'bip-session-modal') ehfCloseBipSessionModal(); });
    ehfFastLoadPendingQueue();
    ehfLoadBipSession();
    setInterval(async () => {
      if (ehfFastBipPollBusy || !ehfBipSession?.session?.id || ehfBipSession.session.status !== 'ABERTA') return;
      ehfFastBipPollBusy = true;
      try { await ehfRefreshBipSession(); } finally { ehfFastBipPollBusy = false; }
    }, 1600);
    setInterval(ehfFastDrainQueue, 700);

    /* ========== BIPAGEM INTELIGENTE POR PLATAFORMA + LOJA ========== */

    const MAPA_FORMAS_ENVIO_BIPAGEM = {
      comercio: {
        "769570519": "Mercado Envios",
        "778029845": "Shopee Envios",
        "780391986": "Mercado Envios Flex",
        "849173976": "Amazon DBA",
        "850044775": "Magalu Entregas",
        "852535843": "Loggi",
        "854284026": "TikTok Shipping"
      },
      suprimentos: {
        "772849381": "Mercado Envios",
        "778034480": "Shopee Envios",
        "780375701": "Mercado Envios Flex",
        "852535096": "Loggi",
        "853036097": "Magalu Entregas",
        "854064525": "Amazon DBA"
      },
      distribuidora: {
        "778095610": "Shopee Envios",
        "780192106": "Amazon DBA",
        "846935602": "LALAMOVE",
        "847199235": "Mercado Envios",
        "850341481": "Loggi",
        "854536867": "Shopee - SPX Entrega Rápida"
      }
    };

    const NOMES_LOJAS_BIPAGEM = {
      comercio: "EHF Comércio",
      suprimentos: "EHF Suprimentos",
      distribuidora: "EHF Distribuidora",
      ekn: "EHF EKN",
      nao_localizada: "Não localizada"
    };

    let ehfResumoLojaCanal = {};
    let ehfBipagensCache = [];
    const bipagemResumoOperacionalRef = ref(db, diaPath('bipagem_resumo_operacional'));
    let ehfResumoLojaCanalPersistidoCarregado = false;

    function clonarResumoLojaCanal(obj) {
      return JSON.parse(JSON.stringify(obj || {}));
    }

    function mesclarResumoDiarioBipagem(resumoSalvo, resumoAtual) {
      const base = clonarResumoLojaCanal(resumoSalvo);
      Object.keys(resumoAtual || {}).forEach(lojaKey => {
        if (!base[lojaKey]) base[lojaKey] = {};
        Object.keys(resumoAtual[lojaKey] || {}).forEach(canalNome => {
          const atual = resumoAtual[lojaKey][canalNome] || {};
          const salvo = base[lojaKey][canalNome] || { esperado: 0, bipado: 0, idFormas: {} };
          base[lojaKey][canalNome] = {
            ...salvo,
            ...atual,
            esperado: Math.max(Number(salvo.esperado || 0), Number(atual.esperado || 0)),
            bipado: Number(salvo.bipado || 0),
            idFormas: {
              ...(salvo.idFormas || {}),
              ...(atual.idFormas || {})
            }
          };
        });
      });
      return base;
    }

    function limparCodigoBipado(codigoOriginal) {
      return String(codigoOriginal || "")
        .trim()
        .replace(/\r/g, "")
        .replace(/\n/g, "")
        .replace(/\s+/g, "");
    }

    function normalizarTexto(txt) {
      return String(txt || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ç/g, "c")
        .trim();
    }

    function normalizarLojaKey(loja) {
      const key = normalizarTexto(loja);
      if (key.includes("comercio")) return "comercio";
      if (key.includes("suprimentos")) return "suprimentos";
      if (key.includes("distribuidora")) return "distribuidora";
      if (key.includes("ekn")) return "ekn";
      return key || "nao_localizada";
    }

    function normalizarCanalNome(nome) {
      const n = normalizarTexto(nome);
      if (n.includes("mercado envios flex")) return "Mercado Envios Flex";
      if (n.includes("mercado envios")) return "Mercado Envios";
      if (n.includes("spx")) return "Shopee - SPX Entrega Rápida";
      if (n.includes("shopee")) return "Shopee Envios";
      if (n.includes("amazon")) return "Amazon DBA";
      if (n.includes("tiktok")) return "TikTok Shipping";
      if (n.includes("magalu")) return "Magalu Entregas";
      if (n.includes("loggi")) return "Loggi";
      return nome || "Desconhecido";
    }

    function getAliasesCanal(canal) {
      const n = normalizarTexto(canal);
      if (n.includes("mercado envios flex")) return ["Mercado Envios Flex"];
      if (n.includes("mercado envios coleta") || n.includes("mercado livre coleta") || n === "mercado envios") return ["Mercado Envios"];
      if (n.includes("spx")) return ["Shopee - SPX Entrega Rápida", "Shopee Envios"];
      if (n.includes("shopee")) return ["Shopee Envios", "Shopee - SPX Entrega Rápida"];
      if (n.includes("amazon")) return ["Amazon DBA"];
      if (n.includes("tiktok")) return ["TikTok Shipping"];
      if (n.includes("magalu")) return ["Magalu Entregas"];
      return [canal];
    }

    function getProcessoProducaoAtual() {
      try {
        const sequencia = Array.isArray(window.ehfProducaoAdmin) ? window.ehfProducaoAdmin : [];
        const primeiroPendente = sequencia.find(item => item && item.ativo !== false && !item.finalizado && !item.feito && !item.naoTem);
        return primeiroPendente ? normalizarTexto(primeiroPendente.nome || "") : "";
      } catch (e) { return ""; }
    }

    function resolverShopeeOuSpx(codigo) {
      const processoAtual = getProcessoProducaoAtual();
      const codigoUpper = String(codigo || "").toUpperCase();
      if (processoAtual.includes("spx")) return { plataforma: "Shopee", canal: "spx_entrega_rapida", canalNome: "Shopee - SPX Entrega Rápida", observacao: "Código BR classificado como SPX pelo processo atual." };
      if (processoAtual.includes("shopee")) return { plataforma: "Shopee", canal: "shopee_coleta", canalNome: "Shopee Envios", observacao: "Código BR classificado como Shopee pelo processo atual." };
      if (codigoUpper.endsWith("U")) return { plataforma: "Shopee", canal: "spx_entrega_rapida", canalNome: "Shopee - SPX Entrega Rápida", observacao: "Código BR classificado como SPX pela letra final U." };
      if (codigoUpper.endsWith("W")) return { plataforma: "Shopee", canal: "shopee_coleta", canalNome: "Shopee Envios", observacao: "Código BR classificado como Shopee pela letra final W." };
      return { plataforma: "Shopee", canal: "shopee_ou_spx", canalNome: "Shopee Envios", observacao: "Código BR reconhecido. Classificado como Shopee por padrão." };
    }

    function identificarEtiqueta(codigoOriginal) {
      const codigo = limparCodigoBipado(codigoOriginal);
      const resultado = {
        codigoOriginal: String(codigoOriginal || "").trim(), codigoLimpo: codigo,
        plataforma: "Desconhecida", canal: "desconhecido", canalNome: "Desconhecido",
        idEtiqueta: "", codigoRastreio: "", senderId: "", hashCode: "", tagCode: "", externalGrouperCode: "",
        tipo: "desconhecido", status: "Atenção", observacao: "Padrão não reconhecido"
      };
      if (!codigo) { resultado.observacao = "Código vazio"; return resultado; }

      if (codigo.includes("sender_id") && codigo.includes("hash_code")) {
        const idMatch = codigo.match(/\^id\^Ç\^?([0-9]+)/i);
        const senderMatch = codigo.match(/sender_id\^Ç\^?([0-9]+)/i);
        const hashMatch = codigo.match(/hash_code\^Ç\^?([^,{}]+)/i);
        return { ...resultado, plataforma: "Mercado Livre", canal: "mercado_envios_flex", canalNome: "Mercado Envios Flex", idEtiqueta: idMatch ? idMatch[1] : "", codigoRastreio: idMatch ? idMatch[1] : "", senderId: senderMatch ? senderMatch[1] : "", hashCode: hashMatch ? hashMatch[1] : "", tipo: "mercado_livre_flex", status: "Conferido", observacao: "Etiqueta Mercado Envios Flex" };
      }

      if (codigo.includes("^id^") && codigo.includes("^t^") && codigo.toLowerCase().includes("lm")) {
        const idMatch = codigo.match(/\^id\^Ç\^?([0-9]+)/i);
        return { ...resultado, plataforma: "Mercado Livre", canal: "mercado_envios_coleta", canalNome: "Mercado Envios", idEtiqueta: idMatch ? idMatch[1] : "", codigoRastreio: idMatch ? idMatch[1] : "", tipo: "mercado_livre_coleta", status: "Conferido", observacao: "Etiqueta Mercado Envios Coleta" };
      }

      if (/^47[0-9]{9}$/.test(codigo)) {
        return { ...resultado, plataforma: "Mercado Livre", canal: "mercado_envios_coleta", canalNome: "Mercado Envios", idEtiqueta: codigo, codigoRastreio: codigo, tipo: "mercado_livre_coleta", status: "Conferido", observacao: "Código numérico Mercado Envios Coleta" };
      }

      if (codigo.includes("external_grouper_code") || codigo.includes("external_code") || codigo.includes("tag_code") || codigo.includes("logistical_flow_start")) {
        const grouperMatch = codigo.match(/external_grouper_code\^Ç\^?([0-9]+)/i);
        const tagMatch = codigo.match(/tag_code\^Ç\^?([0-9-]+)/i);
        const externalCodeMatch = codigo.match(/external_code\^Ç\^?([a-z0-9-]+)/i);
        const id = tagMatch ? tagMatch[1] : (grouperMatch ? grouperMatch[1] : (externalCodeMatch ? externalCodeMatch[1] : ""));
        return { ...resultado, plataforma: "Magalu", canal: "magalu", canalNome: "Magalu Entregas", externalGrouperCode: grouperMatch ? grouperMatch[1] : "", tagCode: tagMatch ? tagMatch[1] : "", idEtiqueta: id, codigoRastreio: id, tipo: "magalu", status: "Conferido", observacao: "Etiqueta Magalu" };
      }

      if (/^TBR[0-9]+$/i.test(codigo)) return { ...resultado, plataforma: "Amazon", canal: "amazon", canalNome: "Amazon DBA", codigoRastreio: codigo.toUpperCase(), idEtiqueta: codigo.toUpperCase(), tipo: "amazon", status: "Conferido", observacao: "Etiqueta Amazon" };
      if (/^999[0-9]{12,}$/.test(codigo)) return { ...resultado, plataforma: "TikTok", canal: "tiktok", canalNome: "TikTok Shipping", codigoRastreio: codigo, idEtiqueta: codigo, tipo: "tiktok", status: "Conferido", observacao: "Etiqueta TikTok" };
      if (/^BR[0-9]{10,}[A-Z]$/i.test(codigo)) {
        const c = resolverShopeeOuSpx(codigo);
        return { ...resultado, plataforma: c.plataforma, canal: c.canal, canalNome: c.canalNome, codigoRastreio: codigo.toUpperCase(), idEtiqueta: codigo.toUpperCase(), tipo: c.canal, status: "Conferido", observacao: c.observacao };
      }
      return resultado;
    }

    function obterFormaEnvioPorLoja(lojaKey, idFormaEnvio) {
      const mapa = MAPA_FORMAS_ENVIO_BIPAGEM[lojaKey] || {};
      return normalizarCanalNome(mapa[String(idFormaEnvio)] || String(idFormaEnvio));
    }

    function montarResumoEsperadoPorLojaCanal(formasEnvioPayload) {
      const resumo = {};
      const origem = formasEnvioPayload && formasEnvioPayload.formasEnvio ? formasEnvioPayload.formasEnvio : {};
      Object.keys(origem).forEach(lojaOriginal => {
        const lojaKey = normalizarLojaKey(lojaOriginal);
        if (!resumo[lojaKey]) resumo[lojaKey] = {};
        const situacoes = origem[lojaOriginal] || {};
        Object.keys(situacoes).forEach(situacaoKey => {
          const formas = situacoes[situacaoKey] || {};
          Object.keys(formas).forEach(idFormaEnvio => {
            const qtd = Number(formas[idFormaEnvio] || 0);
            if (qtd <= 0) return;
            const canalNome = obterFormaEnvioPorLoja(lojaKey, idFormaEnvio);
            if (!resumo[lojaKey][canalNome]) resumo[lojaKey][canalNome] = { esperado: 0, bipado: 0, idFormas: {} };
            resumo[lojaKey][canalNome].esperado += qtd;
            resumo[lojaKey][canalNome].idFormas[idFormaEnvio] = (resumo[lojaKey][canalNome].idFormas[idFormaEnvio] || 0) + qtd;
          });
        });
      });
      return resumo;
    }

    async function atualizarResumoEsperadoBipagem() {
      try {
        const resp = await fetch("/api/formasEnvio", { method: "GET", cache: "no-store" });
        if (!resp.ok) return;
        const data = await resp.json();
        const resumoAtual = montarResumoEsperadoPorLojaCanal(data);

        onValue(bipagemResumoOperacionalRef, (snapshot) => {
          if (ehfResumoLojaCanalPersistidoCarregado) return;
          ehfResumoLojaCanalPersistidoCarregado = true;
          const salvo = snapshot.val() || {};
          ehfResumoLojaCanal = mesclarResumoDiarioBipagem(salvo.resumo || salvo, resumoAtual);
          atualizarContagemBipadaNoResumo();
          renderResumoBipagemPorLojaCanal();
          set(bipagemResumoOperacionalRef, {
            dataOperacional: DATA_OPERACIONAL,
            atualizadoEm: Date.now(),
            atualizadoEmTexto: formatHorarioBrasilia(new Date(), true),
            resumo: clonarResumoLojaCanal(ehfResumoLojaCanal)
          }).catch(e => console.warn('Falha ao salvar resumo diário da bipagem:', e));
        }, { onlyOnce: true });

        if (ehfResumoLojaCanalPersistidoCarregado) {
          ehfResumoLojaCanal = mesclarResumoDiarioBipagem(ehfResumoLojaCanal, resumoAtual);
          atualizarContagemBipadaNoResumo();
          renderResumoBipagemPorLojaCanal();
          set(bipagemResumoOperacionalRef, {
            dataOperacional: DATA_OPERACIONAL,
            atualizadoEm: Date.now(),
            atualizadoEmTexto: formatHorarioBrasilia(new Date(), true),
            resumo: clonarResumoLojaCanal(ehfResumoLojaCanal)
          }).catch(e => console.warn('Falha ao salvar resumo diário da bipagem:', e));
        }
      } catch (e) { console.warn("Falha ao atualizar resumo esperado da bipagem:", e); }
    }

    function atualizarContagemBipadaNoResumo() {
      Object.keys(ehfResumoLojaCanal || {}).forEach(lojaKey => {
        Object.keys(ehfResumoLojaCanal[lojaKey] || {}).forEach(canalNome => ehfResumoLojaCanal[lojaKey][canalNome].bipado = 0);
      });
      ehfBipagensCache.forEach(b => {
        const lojaKey = normalizarLojaKey(b.lojaKey || b.loja || "");
        const canalNome = normalizarCanalNome(b.canalEsperado || b.canalNome || "");
        if (ehfResumoLojaCanal[lojaKey] && ehfResumoLojaCanal[lojaKey][canalNome]) ehfResumoLojaCanal[lojaKey][canalNome].bipado++;
      });
    }

    function escolherLojaParaBipagem(infoEtiqueta) {
      const aliases = getAliasesCanal(infoEtiqueta.canalNome);
      let melhor = { lojaKey: "nao_localizada", lojaNome: "Não localizada", canalEsperado: infoEtiqueta.canalNome, esperado: 0, bipado: 0, restante: -1 };
      Object.keys(ehfResumoLojaCanal || {}).forEach(lojaKey => {
        const canaisLoja = ehfResumoLojaCanal[lojaKey] || {};
        Object.keys(canaisLoja).forEach(canalNome => {
          const canalNormalizado = normalizarCanalNome(canalNome);
          const bate = aliases.some(alias => normalizarCanalNome(alias) === canalNormalizado);
          if (!bate) return;
          const esperado = Number(canaisLoja[canalNome].esperado || 0);
          const bipado = Number(canaisLoja[canalNome].bipado || 0);
          const restante = esperado - bipado;
          if (restante > melhor.restante) melhor = { lojaKey, lojaNome: NOMES_LOJAS_BIPAGEM[lojaKey] || lojaKey, canalEsperado: canalNome, esperado, bipado, restante };
        });
      });
      return melhor;
    }

    function ehfFastFirebaseRef(firebaseKey) {
      return firebaseKey ? ref(db, `${diaPath('bipagens_dia')}/${firebaseKey}`) : null;
    }

    function ehfFastOptimisticPayload(code, normalized, info, firebaseKey) {
      const session = ehfBipSession?.session || {};
      const lojaKey = session.account || 'nao_localizada';
      return {
        codigo: code,
        codigoLimpo: normalized,
        plataforma: info.plataforma === 'Desconhecida' ? 'A identificar' : info.plataforma,
        canal: info.canal || '',
        canalNome: info.canalNome === 'Desconhecido' ? session.channel_name || 'A identificar' : info.canalNome,
        canalEsperado: session.channel_name || '',
        lojaKey,
        lojaNome: NOMES_LOJAS_BIPAGEM[lojaKey] || 'A localizar',
        idEtiqueta: info.idEtiqueta || normalized,
        codigoRastreio: info.codigoRastreio || normalized,
        tipo: info.tipo || 'captura_rapida',
        categoriaCodigo: info.tipo || 'captura_rapida',
        observacao: 'Leitura salva. Pedido sendo identificado em segundo plano.',
        lookupStatus: 'PENDENTE',
        status: 'Identificando...',
        operador: nomeOperadorLocal,
        coletor: session.collector_name || '',
        sessaoBipagemId: session.id,
        pedidoTiny: '',
        pedidoMarketplace: '',
        totalUnidades: 0,
        horario: formatHorarioBrasilia(new Date(), true),
        horarioCompleto: formatHorarioBrasilia(new Date(), true),
        ts: Date.now(),
        firebaseKey
      };
    }

    function ehfFastScheduleRetry(item, error) {
      item.attempts = Number(item.attempts || 0) + 1;
      item.lastError = String(error?.message || error || 'Falha de rede');
      const wait = Math.min(15000, 500 * Math.pow(1.7, Math.min(item.attempts, 8)));
      item.nextAt = Date.now() + wait;
      ehfFastBipQueue.push(item);
      ehfFastPersistQueue();
      setTimeout(ehfFastDrainQueue, wait + 20);
    }

    async function ehfFastSendCapture(item) {
      try {
        const data = await ehfApi(`/api/bipagem/sessoes/${item.sessionId}/capturar`, {
          method: 'POST',
          body: JSON.stringify({ codigo: item.code, operator: item.operator, capturedAt: item.capturedAt })
        });
        ehfFastLastServerQueue = data.queue || ehfFastLastServerQueue;
        const firebaseRef = ehfFastFirebaseRef(item.firebaseKey);
        if (data.duplicate) {
          if (firebaseRef) remove(firebaseRef).catch(()=>{});
          tocarSomConfirmacaoLeitura(false);
          ehfBipToast(`Duplicado: ${item.normalized} já foi bipado hoje.`, true);
          return;
        }
        if (firebaseRef && data.scan) {
          const current = ehfBipagensCache.find((row) => row._firebaseKey === item.firebaseKey) || item.optimistic || {};
          const payload = { ...current };
          delete payload._firebaseKey;
          Object.assign(payload, {
            scanId: data.scan.id,
            categoriaCodigo: data.scan.capture_category || data.category || payload.categoriaCodigo || '',
            lookupStatus: data.scan.resolution_status || 'PENDENTE',
            status: 'Identificando...',
            observacao: 'Leitura confirmada pelo servidor. Pedido sendo identificado em segundo plano.'
          });
          set(firebaseRef, payload).catch(()=>{});
        }
        const pkg = document.getElementById('bip-session-packages'); if (pkg && data.summary) pkg.textContent = Number(data.summary.packages || 0);
        ehfFastUpdateQueueUi(data.summary);
      } catch (error) {
        if ([400,404,409].includes(Number(error?.status || 0))) {
          const firebaseRef = ehfFastFirebaseRef(item.firebaseKey);
          if (firebaseRef) {
            const payload = { ...(item.optimistic || {}), status: 'Erro de sessão', lookupStatus: 'ERRO', observacao: error.message || 'Não foi possível salvar a leitura.' };
            set(firebaseRef, payload).catch(()=>{});
          }
          tocarSomConfirmacaoLeitura(false);
          ehfBipToast(error.message || 'Não foi possível salvar a leitura.', true);
          return;
        }
        ehfFastScheduleRetry(item, error);
      }
    }

    function ehfFastDrainQueue() {
      const MAX_IN_FLIGHT = 4;
      if (!ehfFastBipQueue.length) return ehfFastUpdateQueueUi();
      const now = Date.now();
      while (ehfFastBipInFlight < MAX_IN_FLIGHT) {
        const index = ehfFastBipQueue.findIndex((item) => Number(item.nextAt || 0) <= now);
        if (index < 0) break;
        const item = ehfFastBipQueue.splice(index, 1)[0];
        ehfFastBipInFlight += 1;
        ehfFastPersistQueue();
        ehfFastSendCapture(item).finally(() => {
          ehfFastBipInFlight = Math.max(0, ehfFastBipInFlight - 1);
          ehfFastPersistQueue();
          ehfFastDrainQueue();
        });
      }
    }

    function processarBipagem(codigoDigitado) {
      if (!ehfBipSession?.session?.id || ehfBipSession.session.status !== 'ABERTA') {
        ehfOpenBipSessionModal();
        tocarSomConfirmacaoLeitura(false);
        ehfBipToast('Inicie uma conferência antes de bipar.', true);
        return;
      }
      const input = document.getElementById('input-leitor-codigo');
      const rawCode = String(codigoDigitado || '').trim();
      const normalized = limparCodigoBipado(rawCode);
      if (input) { input.value = ''; input.focus(); }
      if (!normalized) return;

      if (ehfFastBipSeen.has(normalized)) {
        tocarSomConfirmacaoLeitura(false);
        ehfBipToast(`Duplicado: ${normalized} já foi bipado hoje.`, true);
        return;
      }

      // A partir daqui a leitura física está aceita. Nada de Tiny/planilha bloqueia o leitor.
      ehfFastBipSeen.add(normalized);
      const info = identificarEtiqueta(rawCode);
      const novaBipagemRef = push(bipagemRef);
      const firebaseKey = novaBipagemRef.key || '';
      const optimistic = ehfFastOptimisticPayload(rawCode, normalized, info, firebaseKey);
      set(novaBipagemRef, optimistic).catch(()=>{});
      tocarSomConfirmacaoLeitura(true);

      const item = {
        code: rawCode,
        normalized,
        sessionId: Number(ehfBipSession.session.id),
        operator: nomeOperadorLocal,
        capturedAt: new Date().toISOString(),
        firebaseKey,
        optimistic,
        attempts: 0,
        nextAt: 0
      };
      ehfFastBipQueue.push(item);
      ehfFastPersistQueue();
      ehfFastDrainQueue();
      ehfBipToast(`Bipado: ${normalized} · salvo, identificando em segundo plano.`);
    }

    function garantirCabecalhoTabelaBipagem() {
      const tabela = document.getElementById("tabela-historico-bipagem");
      if (!tabela) return;
      const thead = tabela.querySelector("thead");
      if (!thead) return;
      thead.innerHTML = `<tr><th>Horário</th><th>Loja</th><th>Plataforma</th><th>Canal</th><th>Código / ID</th><th>Operador</th><th>Status</th></tr>`;
    }

    function abreviarLojaBipagem(lojaKey) {
      const key = String(lojaKey || "").toLowerCase();
      if (key.includes("comercio")) return "C";
      if (key.includes("suprimentos")) return "S";
      if (key.includes("distribuidora")) return "D";
      if (key.includes("ekn")) return "E";
      return "X";
    }

    function abreviarCanalBipagem(canalNome) {
      const n = normalizarTexto(canalNome);
      if (n.includes("mercado envios flex")) return "FLEX";
      if (n.includes("mercado envios")) return "ML";
      if (n.includes("spx")) return "SPX";
      if (n.includes("shopee")) return "SHP";
      if (n.includes("amazon")) return "AMZ";
      if (n.includes("tiktok")) return "TKT";
      if (n.includes("magalu")) return "MAG";
      if (n.includes("loggi")) return "LOG";
      return "OUT";
    }

    function montarResumoRapidoBipagem() {
      const itens = [];

      Object.keys(ehfResumoLojaCanal || {}).forEach(lojaKey => {
        const canais = ehfResumoLojaCanal[lojaKey] || {};

        Object.keys(canais).forEach(canalNome => {
          const esperado = Number(canais[canalNome].esperado || 0);
          const bipado = Number(canais[canalNome].bipado || 0);
          const restante = Math.max(esperado - bipado, 0);

          if (esperado <= 0 && bipado <= 0) return;

          itens.push({
            lojaKey,
            lojaNome: NOMES_LOJAS_BIPAGEM[lojaKey] || lojaKey,
            canalNome,
            abbr: `${abreviarCanalBipagem(canalNome)}-${abreviarLojaBipagem(lojaKey)}`,
            esperado,
            bipado,
            restante
          });
        });
      });

      return itens.sort((a, b) => {
        if (b.restante !== a.restante) return b.restante - a.restante;
        return b.esperado - a.esperado;
      });
    }

    function getPosicaoResumoRapidoBipagem() {
      try {
        return JSON.parse(localStorage.getItem("ehf_bip_resumo_rapido_posicao") || "null");
      } catch (e) {
        return null;
      }
    }

    function salvarPosicaoResumoRapidoBipagem(left, top) {
      localStorage.setItem("ehf_bip_resumo_rapido_posicao", JSON.stringify({ left, top }));
    }

    function habilitarArrastarResumoRapidoBipagem(painel) {
      const header = painel.querySelector(".bip-float-header");
      if (!header || header.dataset.dragReady === "1") return;
      header.dataset.dragReady = "1";

      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;

      function iniciar(e) {
        if (e.target && e.target.closest("button")) return;

        dragging = true;
        painel.classList.add("dragging");

        const point = e.touches ? e.touches[0] : e;
        const rect = painel.getBoundingClientRect();

        startX = point.clientX;
        startY = point.clientY;
        startLeft = rect.left;
        startTop = rect.top;

        painel.style.left = `${rect.left}px`;
        painel.style.top = `${rect.top}px`;
        painel.style.right = "auto";
        painel.style.bottom = "auto";

        document.addEventListener("mousemove", mover);
        document.addEventListener("mouseup", finalizar);
        document.addEventListener("touchmove", mover, { passive: false });
        document.addEventListener("touchend", finalizar);
      }

      function mover(e) {
        if (!dragging) return;
        if (e.cancelable) e.preventDefault();

        const point = e.touches ? e.touches[0] : e;
        const dx = point.clientX - startX;
        const dy = point.clientY - startY;

        const maxLeft = window.innerWidth - painel.offsetWidth - 8;
        const maxTop = window.innerHeight - painel.offsetHeight - 8;

        const left = Math.max(8, Math.min(maxLeft, startLeft + dx));
        const top = Math.max(8, Math.min(maxTop, startTop + dy));

        painel.style.left = `${left}px`;
        painel.style.top = `${top}px`;
      }

      function finalizar() {
        if (!dragging) return;
        dragging = false;
        painel.classList.remove("dragging");

        const rect = painel.getBoundingClientRect();
        salvarPosicaoResumoRapidoBipagem(rect.left, rect.top);

        document.removeEventListener("mousemove", mover);
        document.removeEventListener("mouseup", finalizar);
        document.removeEventListener("touchmove", mover);
        document.removeEventListener("touchend", finalizar);
      }

      header.addEventListener("mousedown", iniciar);
      header.addEventListener("touchstart", iniciar, { passive: true });
    }

    function bipagemEstaAtiva() {
      const view = document.getElementById('view-bipagem');
      return !!(view && view.classList.contains('active'));
    }

    function painelNormalEstaAtivo() {
      const view = document.getElementById('view-coletas');
      return !!(view && view.classList.contains('active'));
    }

    function atualizarVisibilidadePainelProducao() {
      const painel = document.getElementById('painel-producao-flutuante');
      if (!painel) return;

      const esconderNaBipagem = document.body.classList.contains('ehf-bipagem-ativa') || bipagemEstaAtiva();
      painel.style.display = esconderNaBipagem ? 'none' : '';
    }

    function atualizarVisibilidadeResumoRapidoBipagem() {
      const painel = document.getElementById('bip-resumo-rapido-flutuante');
      if (!painel) return;
      painel.style.display = bipagemEstaAtiva() ? '' : 'none';
    }

    function renderResumoRapidoFlutuanteBipagem(itens) {
      document.getElementById('bip-resumo-rapido-flutuante')?.remove();
      return itens;
    }

    function renderResumoBipagemPorLojaCanal() {
      const container = document.getElementById("resumo-bipagem-loja-canal");
      if (!container) return;

      atualizarContagemBipadaNoResumo();

      const lojas = Object.keys(ehfResumoLojaCanal || {});
      const itensRapidos = montarResumoRapidoBipagem();

      renderResumoRapidoFlutuanteBipagem(itensRapidos);

      const countLojas = document.getElementById("bip-menu-count-lojas");
      if (countLojas) countLojas.textContent = String(lojas.length);

      const countBipes = document.getElementById("bip-menu-count-bipes");
      if (countBipes) countBipes.textContent = String((ehfBipagensCache || []).length);

      if (lojas.length === 0) {
        container.innerHTML = `<div style="color:var(--muted);font-size:12px;">Nenhuma leitura consolidada por loja ainda.</div>`;
        return;
      }

      container.innerHTML = `<div class="bip-compact-store-grid">${lojas.map(lojaKey => {
        const canais = ehfResumoLojaCanal[lojaKey] || {};
        const lojaNome = NOMES_LOJAS_BIPAGEM[lojaKey] || lojaKey;
        const nomesCanais = Object.keys(canais);

        const esperadoTotal = nomesCanais.reduce((acc, canalNome) => acc + Number(canais[canalNome].esperado || 0), 0);
        const bipadoTotal = nomesCanais.reduce((acc, canalNome) => acc + Number(canais[canalNome].bipado || 0), 0);
        const restanteTotal = Math.max(esperadoTotal - bipadoTotal, 0);

        const canaisHtml = nomesCanais.map(canalNome => {
          const esperado = Number(canais[canalNome].esperado || 0);
          const bipado = Number(canais[canalNome].bipado || 0);
          const abbr = `${abreviarCanalBipagem(canalNome)}-${abreviarLojaBipagem(lojaKey)}`;

          return `<span title="${canalNome}">${abbr}: <b>${bipado}/${esperado}</b></span>`;
        }).join("");

        return `
          <div class="bip-compact-store-card">
            <div class="store-line">
              <div class="store-name">${lojaNome}</div>
              <div class="store-total">${esperadoTotal}</div>
            </div>
            <div class="store-meta">
              <span>Entraram hoje</span>
              <span><strong style="color:var(--success);">${bipadoTotal}</strong> bipada(s) · <strong style="color:var(--accent);">${restanteTotal}</strong> restante(s)</span>
            </div>
            <div class="channel-short-list">${canaisHtml || '<span>Sem canais</span>'}</div>
          </div>
        `;
      }).join("")}</div>`;
    }

    const inputLeitor = document.getElementById("input-leitor-codigo");
    if (inputLeitor) {
      inputLeitor.addEventListener("keydown", function(e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const codigoDigitado = this.value.trim();
        if (codigoDigitado === "") return;
        processarBipagem(codigoDigitado);
      });
    }

    garantirCabecalhoTabelaBipagem();
    atualizarResumoEsperadoBipagem();
    setInterval(atualizarResumoEsperadoBipagem, 20 * 60 * 1000);

    onValue(bipagemRef, (snapshot) => {
      const dados = snapshot.val();
      const listaTbody = document.getElementById("lista-bipagens-historico");
      if (!listaTbody) return;
      garantirCabecalhoTabelaBipagem();
      listaTbody.innerHTML = "";
      totalBipadosFisico = 0;
      let bipesNaUltimaHora = 0;
      const umaHoraAtras = Date.now() - (60 * 60 * 1000);
      const listaOrdenada = dados ? Object.entries(dados).map(([firebaseKey, value]) => ({ ...(value || {}), _firebaseKey: firebaseKey })).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0)) : [];
      ehfBipagensCache = listaOrdenada.map(b => {
        if (!b.canalNome || b.canalNome === "Desconhecido" || b.plataforma === "Desconhecida") {
          const reprocessado = identificarEtiqueta(b.codigo || b.codigoLimpo || "");
          return { ...b, plataforma: reprocessado.plataforma, canal: reprocessado.canal, canalNome: reprocessado.canalNome, idEtiqueta: b.idEtiqueta || reprocessado.idEtiqueta, codigoRastreio: b.codigoRastreio || reprocessado.codigoRastreio, status: b.status || reprocessado.status, observacao: b.observacao || reprocessado.observacao };
        }
        return b;
      });
      totalBipadosFisico = ehfBipagensCache.length;
      ehfBipagensCache.forEach(b => {
        const seenCode = String(b.codigoLimpo || b.codigo || '').trim();
        if (seenCode) ehfFastBipSeen.add(seenCode);
        if (b.ts && b.ts >= umaHoraAtras) bipesNaUltimaHora++;
        const lojaNome = b.lojaNome || NOMES_LOJAS_BIPAGEM[b.lojaKey] || "Não localizada";
        const plataforma = b.plataforma || "Desconhecida";
        const canalNome = b.canalEsperado || b.canalNome || b.canal || "Desconhecido";
        const codigoPrincipal = b.idEtiqueta || b.codigoRastreio || b.codigo || "";
        const status = b.status || "Conferido";
        const statusColor = status === "Conferido" ? "var(--success)" : "var(--danger)";
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${b.horario || "--:--:--"}</td><td><b>${lojaNome}</b></td><td>${plataforma}</td><td>${canalNome}</td><td><b>${codigoPrincipal}</b><div style="font-size:10px;color:var(--muted);max-width:360px;overflow:hidden;text-overflow:ellipsis;">${b.observacao || ""}</div></td><td>${b.operador || "-"}</td><td style="color:${statusColor};font-weight:700;">${status}</td>`;
        listaTbody.appendChild(tr);
      });
      atualizarContagemBipadaNoResumo();
      renderResumoBipagemPorLojaCanal();
      const realProduction = document.getElementById("real-production-hour");
      if (realProduction) realProduction.textContent = `${bipesNaUltimaHora} pacotes/h`;
      const auditTotal = document.getElementById("audit-bipados-total");
      if (auditTotal) auditTotal.textContent = totalBipadosFisico;
      atualizarBipagemExecutiva();
      window.recalcularDivergenciaBipagem();
    });


    function atualizarBipagemExecutiva() {
      try {
        const totalTiny = Number(totalEmbaladasAcumuladoTiny || 0);
        const bipados = Number(totalBipadosFisico || 0);
        const restante = Math.max(totalTiny - bipados, 0);
        const percentual = totalTiny > 0 ? Math.min(100, Math.round((bipados / totalTiny) * 1000) / 10) : 0;

        const percentEl = document.getElementById("bip-percent-concluido");
        if (percentEl) percentEl.textContent = String(percentual).replace(".", ",") + "%";

        const donutTotal = document.getElementById("bip-donut-total");
        if (donutTotal) donutTotal.textContent = bipados;

        const statusTotal = document.getElementById("bip-status-total");
        if (statusTotal) statusTotal.textContent = bipados;

        const conferidas = (ehfBipagensCache || []).filter(b => String(b.status || "Conferido").toLowerCase().includes("confer")).length;
        const naoLocalizadas = (ehfBipagensCache || []).filter(b => {
          const loja = String(b.lojaNome || b.lojaKey || "").toLowerCase();
          const status = String(b.status || "").toLowerCase();
          return loja.includes("não localizada") || loja.includes("nao localizada") || status.includes("não") || status.includes("nao");
        }).length;
        const pendentes = Math.max(bipados - conferidas - naoLocalizadas, 0);

        const naoLocEl = document.getElementById("bip-nao-localizadas-total");
        if (naoLocEl) naoLocEl.textContent = naoLocalizadas;

        const sideNao = document.getElementById("bip-side-nao-localizadas");
        if (sideNao) sideNao.textContent = naoLocalizadas;

        const confEl = document.getElementById("bip-status-conferidas");
        if (confEl) confEl.textContent = conferidas;

        const pendEl = document.getElementById("bip-status-pendentes");
        if (pendEl) pendEl.textContent = pendentes;

        const naoStatusEl = document.getElementById("bip-status-nao-localizadas");
        if (naoStatusEl) naoStatusEl.textContent = naoLocalizadas;

        const platformAcc = {};
        (ehfBipagensCache || []).forEach(b => {
          const plataforma = b.plataforma || "Desconhecida";
          platformAcc[plataforma] = (platformAcc[plataforma] || 0) + 1;
        });

        const platformList = document.getElementById("bip-platform-list");
        if (platformList) {
          const rows = Object.keys(platformAcc).sort((a,b) => platformAcc[b] - platformAcc[a]).slice(0, 6);
          platformList.innerHTML = rows.length
            ? rows.map(nome => {
                const qtd = platformAcc[nome];
                const pct = bipados > 0 ? Math.round((qtd / bipados) * 1000) / 10 : 0;
                return `<div class="platform-row"><span>${nome}</span><b>${qtd} (${String(pct).replace(".", ",")}%)</b></div>`;
              }).join("")
            : `<div class="platform-row"><span>Sem leituras</span><b>0</b></div>`;
        }

        const listaNao = document.getElementById("bip-nao-localizadas-list");
        if (listaNao) {
          const itens = (ehfBipagensCache || []).filter(b => {
            const loja = String(b.lojaNome || b.lojaKey || "").toLowerCase();
            const status = String(b.status || "").toLowerCase();
            return loja.includes("não localizada") || loja.includes("nao localizada") || status.includes("não") || status.includes("nao");
          }).slice(0, 4);

          listaNao.innerHTML = itens.length
            ? itens.map(b => `<div class="empty-list"><b>${b.horario || "--:--"}</b> · ${b.codigoKey || b.codigo || ""}</div>`).join("")
            : `<div class="empty-list">Sem leituras pendentes.</div>`;
        }

      } catch (e) {
        console.warn("Falha ao atualizar visual executivo da bipagem:", e);
      }
    }

    window.recalcularDivergenciaBipagem = function() {
      const elDiv = document.getElementById("audit-divergencia");
      if (!elDiv) return;
      const dif = Number(totalEmbaladasAcumuladoTiny || 0) - Number(totalBipadosFisico || 0);
      if (dif === 0) { elDiv.style.color = "var(--success)"; elDiv.textContent = "Esteira batida"; }
      else if (dif > 0) { elDiv.style.color = "var(--accent)"; elDiv.textContent = `${dif} faltando`; }
      else { elDiv.style.color = "var(--danger)"; elDiv.textContent = `${Math.abs(dif)} sobrando`; }

      const totalTiny = Number(totalEmbaladasAcumuladoTiny || 0);
      const bipados = Number(totalBipadosFisico || 0);
      const percentEl = document.getElementById("bip-percent-concluido");
      if (percentEl) {
        const pct = totalTiny > 0 ? Math.min(100, Math.round((bipados / totalTiny) * 1000) / 10) : 0;
        percentEl.textContent = String(pct).replace(".", ",") + "%";
      }
    };

    function limparAlarmeTask(taskId) {
      if (!taskId) return;
      delete alarmState[taskId];
      pararSomAlerta();

      if (typeof window.esconderAlarmePersistente === 'function') {
        window.esconderAlarmePersistente();
      }
    }

    window.adiarAlarmeTask = function(taskId) {
      alarmState[taskId] = alarmState[taskId] || {};
      alarmState[taskId].snoozeUntil = Date.now() + ALARM_SNOOZE_MS;
      alarmState[taskId].lastAlarmAt = Date.now();
      pararSomAlerta();
      if (typeof window.esconderAlarmePersistente === 'function') {
        window.esconderAlarmePersistente();
      }

      const container = document.getElementById('toast-container');
      if (container) {
        container.innerHTML = 'Alarme adiado por 10 minutos.';
        container.style.display = 'block';
        setTimeout(() => { container.style.display = 'none'; }, 2500);
      }
    };

    window.resolverAlarmeTask = function(taskId) {
      // Resolve o aviso atual, mas se nenhuma caixa for marcada o alarme volta no próximo ciclo de verificação.
      alarmState[taskId] = alarmState[taskId] || {};
      alarmState[taskId].snoozeUntil = Date.now() + ALARM_RESOLVED_RECHECK_MS;
      alarmState[taskId].lastAlarmAt = Date.now();
      pararSomAlerta();
      if (typeof window.esconderAlarmePersistente === 'function') {
        window.esconderAlarmePersistente();
      }

      const container = document.getElementById('toast-container');
      if (container) {
        container.innerHTML = 'Alarme marcado como resolvido. Se nenhuma caixa for marcada, ele voltará a soar.';
        container.style.display = 'block';
        setTimeout(() => { container.style.display = 'none'; }, 3500);
      }
    };


    function timeToMinutes(value) {
      const raw = String(value || '').trim();
      if (!raw || !/^\d{1,2}:\d{2}$/.test(raw)) return null;
      const [h, m] = raw.split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return (h * 60) + m;
    }

    function getBrasiliaMinutesNow() {
      const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(new Date());

      const h = Number(parts.find(p => p.type === 'hour')?.value || 0);
      const m = Number(parts.find(p => p.type === 'minute')?.value || 0);
      return (h * 60) + m;
    }

    function taskTemAlgumaCaixaMarcada(task) {
      // Finalizado agora é apenas registro interno de produção.
      // Ele NÃO encerra o alarme de saída do galpão.
      // O alarme só para quando existir uma ação operacional de saída/coleta.
      return !!(task && (task.coletado || task.enviado));
    }

    function verificarAlarmesDePrazo() {
      if (!Array.isArray(localTasks) || localTasks.length === 0) return;

      const agoraMs = Date.now();
      const minutosAgora = getBrasiliaMinutesNow();

      const atrasada = localTasks.find(t => {
        if (!t || t.semHorario) return false;
        if (taskTemAlgumaCaixaMarcada(t)) {
          limparAlarmeTask(t.id);
          return false;
        }

        const limiteMinutos = timeToMinutes(t.time);
        if (limiteMinutos === null) return false;
        if (minutosAgora < limiteMinutos) return false;

        const estado = alarmState[t.id] || {};
        if (estado.snoozeUntil && agoraMs < estado.snoozeUntil) return false;

        // Evita tocar repetido caso a tela verifique muitas vezes em sequência.
        if (estado.lastAlarmAt && agoraMs - estado.lastAlarmAt < 60 * 1000) return false;

        return true;
      });

      if (!atrasada) return;

      alarmState[atrasada.id] = alarmState[atrasada.id] || {};
      alarmState[atrasada.id].lastAlarmAt = agoraMs;

      executarAlarmeVisualESonoroLocal(
        `Prazo vencido: <b>${atrasada.name}</b> tinha limite às <b>${atrasada.time}</b> e ainda não foi marcado como Coletado ou Enviado.`,
        atrasada.id
      );
    }

    window.verificarAlarmesDePrazo = verificarAlarmesDePrazo;

    if (!window.ehfAlarmEngineStarted) {
      window.ehfAlarmEngineStarted = true;
      setInterval(() => verificarAlarmesDePrazo(), 5000);
      document.addEventListener('visibilitychange', () => verificarAlarmesDePrazo());
      window.addEventListener('focus', () => verificarAlarmesDePrazo());
      setTimeout(() => verificarAlarmesDePrazo(), 1000);
    }

    const GROUP_TARGETS = {
      mercado_envios_coleta: ['comercio', 'suprimentos', 'ekn', 'distribuidora']
    };

    const STATUS_FIELDS = ['coletado', 'enviado', 'finalizado'];

    
    function getTaskById(taskId) {
      return localTasks.find(x => x.id === taskId);
    }

    function getAllTaskConfigs() {
      return GRUPOS_CONFIG.flatMap(grupo => grupo.lojas);
    }

    function getTaskConfigById(taskId) {
      return getAllTaskConfigs().find(item => item.id === taskId) || null;
    }

    function criarTaskPadrao(config) {
      return {
        id: config.id,
        name: config.name,
        time: config.defaultTime || '',
        coletado: false,
        enviado: false,
        finalizado: false,
        finalizadoEm: '',
        semHorario: !!config.semHorario,
        remessa: config.remessa || ''
      };
    }

    function garantirTasksPadrao() {
      const configs = getAllTaskConfigs();

      configs.forEach(config => {
        let task = getTaskById(config.id);

        if (!task) {
          task = criarTaskPadrao(config);
          localTasks.push(task);
        }

        task.name = config.name;
        task.semHorario = !!config.semHorario;
        task.remessa = config.remessa || '';

        if (!task.time && config.defaultTime) {
          task.time = config.defaultTime;
        }
      });

      localTasks = localTasks.filter(task => configs.some(config => config.id === task.id));

      localTasks.sort((a, b) => {
        const ia = configs.findIndex(config => config.id === a.id);
        const ib = configs.findIndex(config => config.id === b.id);
        return ia - ib;
      });
    }

    function sincronizarEstadoTaskPorInputs(taskId) {
      const task = getTaskById(taskId);
      if (!task) return;

      STATUS_FIELDS.forEach(field => {
        const box = document.getElementById(`${field}-${taskId}`);
        if (box) task[field] = !!box.checked;
      });

      const inputTime = document.getElementById(`time-${taskId}`);
      if (inputTime) task.time = inputTime.value || '';
    }

    function aplicarStatusExclusivoTask(task, status, checked) {
      if (!task) return;

      if (status === 'finalizado') {
        task.finalizado = !!checked;
        task.finalizadoEm = checked ? formatHorarioBrasilia(new Date(), true) : '';
        return;
      }

      if (checked) {
        task.coletado = status === 'coletado';
        task.enviado = status === 'enviado';
      } else {
        task[status] = false;
      }
    }

    function setTaskStatus(taskId, status, checked, exclusivo = true) {
      const task = getTaskById(taskId);

      if (!task) return;

      if (exclusivo) {
        aplicarStatusExclusivoTask(task, status, checked);
      } else {
        task[status] = !!checked;
      }

      if (status !== 'finalizado') {
        limparAlarmeTask(taskId);
      }
    }

    function aplicarHorarioGrupo(groupId, horario) {
      if (!GROUP_TARGETS[groupId]) return;

      GROUP_TARGETS[groupId].forEach(id => {
        const task = getTaskById(id);

        if (!task || task.semHorario) return;

        task.time = horario || '';
        limparAlarmeTask(id);
      });
    }

    function aplicarStatusGrupo(groupId, status, checked) {
      if (!GROUP_TARGETS[groupId]) return;

      GROUP_TARGETS[groupId].forEach(id => {
        setTaskStatus(id, status, checked, true);
      });
    }

    function atualizarGruposAposAlteracaoFilho(childId) {
      Object.keys(GROUP_TARGETS).forEach(groupId => {
        const targets = GROUP_TARGETS[groupId];

        if (!targets.includes(childId)) return;

        const groupTask = getTaskById(groupId);

        if (!groupTask) return;

        STATUS_FIELDS.forEach(status => {
          const todosComStatus = targets.length > 0 && targets.every(id => {
            const task = getTaskById(id);
            return !!(task && task[status]);
          });

          groupTask[status] = todosComStatus;
        });

        /*
          Se as lojas filhas não estiverem todas no mesmo status,
          o bloco mestre fica sem marcação. Isso evita estado falso.
        */
        const algumStatusCompleto = STATUS_FIELDS.some(status => groupTask[status]);

        if (!algumStatusCompleto) {
          STATUS_FIELDS.forEach(status => {
            groupTask[status] = false;
          });
        }
      });
    }

    function corrigirTextoSuprimentos() {
      document.querySelectorAll('.store-row-title, .store-name').forEach(el => {
        const txt = el.textContent || '';

        if (txt.includes('SUPLEMENTOS')) {
          el.textContent = txt.replace(/SUPLEMENTOS/g, 'SUPRIMENTOS');
        }

        if (txt.includes('Suplementos')) {
          el.textContent = txt.replace(/Suplementos/g, 'Suprimentos');
        }
      });
    }

    window.corrigirTextoSuprimentos = corrigirTextoSuprimentos;

    function renderEstructuralHTML() {
      garantirTasksPadrao();

      const container = document.getElementById('cp-agrupador-container');

      if (!container) return;

      container.innerHTML = '';

      GRUPOS_CONFIG.forEach(grupo => {
        const header = document.createElement('div');
        header.className = 'cp-group-title';
        header.textContent = grupo.titulo;
        container.appendChild(header);

        const ul = document.createElement('ul');
        ul.className = 'cp-store-list';

        grupo.lojas.forEach(config => {
          const t = getTaskById(config.id);

          const li = document.createElement('li');
          li.className = t.remessa ? 'cp-store-item remessa-row' : 'cp-store-item';
          li.id = `row-item-${t.id}`;

          if (t.finalizado) {
            li.style.opacity = '0.4';
          }

          const nameDiv = document.createElement('div');
          nameDiv.className = 'store-name';
          nameDiv.innerHTML = `${t.name}${t.remessa ? `<span class="remessa-badge">${t.remessa}</span>` : ''}`;

          const controls = document.createElement('div');
          controls.className = 'cp-store-controls';

          let timeInput = null;
          let timePlaceholder = null;

          if (!t.semHorario) {
            timeInput = document.createElement('input');
            timeInput.type = 'time';
            timeInput.value = t.time || '';
            timeInput.id = `time-${t.id}`;

            timeInput.addEventListener('change', () => {
              const horario = timeInput.value || '';

              t.time = horario;
              limparAlarmeTask(t.id);

              if (GROUP_TARGETS[t.id]) {
                aplicarHorarioGrupo(t.id, horario);
              }

              renderEstructuralHTML();

              set(alertaBroadcastRef, {
                txt: `O operador <b>${nomeOperadorLocal}</b> alterou o horário limite da <b>${t.name}</b> para <b>${horario || '--:--'}</b>.`,
                ts: Date.now()
              });

              tocarSomNotificacao();
              pushStateToFirebase();
              verificarAlarmesDePrazo();
            });
          } else {
            timePlaceholder = document.createElement('span');
            timePlaceholder.className = 'cp-time-placeholder';
          }

          const labelCo = criarCheckboxControle(t, 'coletado', 'Coletado', config, false);
          const labelEn = criarCheckboxControle(t, 'enviado', 'Enviado', config, false);
          const labelFi = criarCheckboxControle(t, 'finalizado', 'Finalizado', config, true);

          if (timeInput) {
            controls.appendChild(timeInput);
          } else if (timePlaceholder) {
            controls.appendChild(timePlaceholder);
          }

          controls.appendChild(labelCo);
          controls.appendChild(labelEn);
          controls.appendChild(labelFi);

          li.appendChild(nameDiv);
          li.appendChild(controls);

          ul.appendChild(li);
        });

        container.appendChild(ul);
      });

      corrigirTextoSuprimentos();
    }

    function criarCheckboxControle(task, campo, texto, config, greenLabel) {
      const label = document.createElement('label');
      label.className = greenLabel ? 'checkbox-inline lbl-finalizado' : 'checkbox-inline';

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !!task[campo];
      box.id = `${campo}-${task.id}`;

      box.addEventListener('change', () => {
        const marcado = box.checked;

        setTaskStatus(task.id, campo, marcado, true);

        if (GROUP_TARGETS[task.id]) {
          aplicarStatusGrupo(task.id, campo, marcado);
        } else {
          atualizarGruposAposAlteracaoFilho(task.id);
        }

        renderEstructuralHTML();

        set(alertaBroadcastRef, {
          txt: `O operador <b>${nomeOperadorLocal}</b> ${marcado ? 'marcou' : 'desmarcou'} <b>${texto}</b> em <b>${task.name}</b>.`,
          ts: Date.now()
        });

        if (campo !== 'finalizado') {
          limparAlarmeTask(task.id);
        }
        tocarSomNotificacao();
        pushStateToFirebase();
        verificarAlarmesDePrazo();
      });

      label.appendChild(box);
      const textoLabel = campo === 'finalizado' && task.finalizadoEm
        ? `${texto} (${task.finalizadoEm})`
        : texto;
      label.appendChild(document.createTextNode(textoLabel));

      return label;
    }

    function montarEstadoParaSalvar() {
      garantirTasksPadrao();

      const inputOperadores = document.getElementById('input-operators');
      const inputTempo = document.getElementById('input-time');
      const inputHorarioGeral = document.getElementById('cp-bulk-time-input');

      const estadoParaSalvar = {
        dataOperacional: typeof DATA_OPERACIONAL !== 'undefined' ? DATA_OPERACIONAL : '',
        operadoresAtivos: Number(inputOperadores ? inputOperadores.value : 3),
        tempoMedioPacote: parseTempoMedioPacote(inputTempo ? inputTempo.value : '00:01:00'),
        horarioLimiteGeral: inputHorarioGeral ? (inputHorarioGeral.value || '') : '',
        atualizadoEm: Date.now(),
        atualizadoPor: nomeOperadorLocal || 'GERAL',
        lojas: {}
      };

      localTasks.forEach(t => {
        estadoParaSalvar.lojas[t.id] = {
          name: t.name,
          time: t.time || '',
          coletado: !!t.coletado,
          enviado: !!t.enviado,
          finalizado: !!t.finalizado,
          finalizadoEm: t.finalizadoEm || '',
          semHorario: !!t.semHorario,
          remessa: t.remessa || ''
        };
      });

      return estadoParaSalvar;
    }

    function pushStateToFirebase() {
      if (isUpdatingFromFirebase) return;

      const estadoParaSalvar = montarEstadoParaSalvar();

      set(estadoRef, estadoParaSalvar)
        .catch(err => {
          console.error('Erro ao salvar estado do painel no Firebase:', err);
        });
    }

    function carregarEstadoDoFirebase(serverState) {
      isUpdatingFromFirebase = true;

      try {
        const inputOperadores = document.getElementById('input-operators');
        const inputTempo = document.getElementById('input-time');
        const inputHorarioGeral = document.getElementById('cp-bulk-time-input');

        if (inputOperadores && serverState.operadoresAtivos !== undefined) {
          inputOperadores.value = serverState.operadoresAtivos;
        }

        if (inputTempo && serverState.tempoMedioPacote !== undefined) {
          inputTempo.value = formatDuracaoHHMMSS(parseTempoMedioPacote(serverState.tempoMedioPacote));
        }

        if (inputHorarioGeral && serverState.horarioLimiteGeral !== undefined) {
          inputHorarioGeral.value = serverState.horarioLimiteGeral;
        }

        localTasks = [];

        getAllTaskConfigs().forEach(config => {
          const salvo = serverState.lojas && serverState.lojas[config.id]
            ? serverState.lojas[config.id]
            : null;

          localTasks.push({
            id: config.id,
            name: config.name,
            time: salvo ? (salvo.time || config.defaultTime || '') : (config.defaultTime || ''),
            coletado: salvo ? !!salvo.coletado : false,
            enviado: salvo ? !!salvo.enviado : false,
            finalizado: salvo ? !!salvo.finalizado : false,
            finalizadoEm: salvo ? (salvo.finalizadoEm || '') : '',
            semHorario: !!config.semHorario,
            remessa: config.remessa || (salvo ? (salvo.remessa || '') : '')
          });
        });

        garantirTasksPadrao();
        renderEstructuralHTML();

        if (typeof window.recalcularETALocal === 'function') {
          window.recalcularETALocal();
        }

        verificarAlarmesDePrazo();

      } finally {
        isUpdatingFromFirebase = false;
      }
    }

    onValue(estadoRef, (snapshot) => {
      const serverState = snapshot.val();

      if (!serverState) {
        localTasks = [];
        garantirTasksPadrao();
        renderEstructuralHTML();
        pushStateToFirebase();
        verificarAlarmesDePrazo();
        return;
      }

      carregarEstadoDoFirebase(serverState);
    });

onValue(alertaBroadcastRef, (snapshot) => {
      const alerta = snapshot.val();

      if (alerta && alerta.ts && alerta.ts > timestampUltimoAlertaLocal) {
        timestampUltimoAlertaLocal = alerta.ts;

        if (typeof window.executarAvisoVisualESonoroLocal === 'function') {
          window.executarAvisoVisualESonoroLocal(alerta.txt);
        }
      }
    });

    document.getElementById('cp-bulk-time-apply-btn').addEventListener('click', () => {
      const t = document.getElementById('cp-bulk-time-input').value;

      if (!t) return;

      const agora = Date.now();

      set(alertaBroadcastRef, {
        txt: `O operador <b>${nomeOperadorLocal}</b> definiu o limite de <b>${t}</b> para todas as linhas com alarme.`,
        ts: agora
      });

      localTasks.forEach(x => {
        if (!x.semHorario) {
          x.time = t;
          limparAlarmeTask(x.id);
        }
      });

      pushStateToFirebase();
      verificarAlarmesDePrazo();
    });

    document.getElementById('cp-dismiss-all').onclick = () => {
      const agora = Date.now();

      set(alertaBroadcastRef, {
        txt: `O operador <b>${nomeOperadorLocal}</b> limpou os alertas da tela.`,
        ts: agora
      });

      localTasks.forEach(x => {
        x.coletado = true;
        x.enviado = false;
        x.finalizado = false;
      });

      pushStateToFirebase();
      verificarAlarmesDePrazo();
    };
  

/* ========== V3.4.4 — HORÁRIOS, CONTAGEM E SYNC IDEMPOTENTE DO MERCADO LIVRE ========== */
(function(){
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const base=String(window.EHF_API_BASE||'https://atendente-vesco-separacao.2cwhzy.easypanel.host').replace(/\/+$/,'');
  let loading=false;

  function fmtTime(value){
    const text=String(value||'').trim();
    return /^\d{1,2}:\d{2}$/.test(text)?text.padStart(5,'0'):'Não disponível no retorno';
  }

  function modeDisplay(mode){
    const verified=Boolean(mode?.countVerified)&&mode?.totalPackages!==null&&mode?.totalPackages!==undefined;
    const delayedVerified=Boolean(mode?.delayedCountVerified)&&mode?.delayedPackages!==null&&mode?.delayedPackages!==undefined;
    const delayed=delayedVerified?Number(mode.delayedPackages||0):null;
    const observed=Number(mode?.observedPackages||mode?.enumeratedPackages||0);
    return {
      verified,
      value:verified?String(Number(mode.totalPackages||0)):'—',
      delayedVerified,
      delayed,
      observed
    };
  }

  function queueCount(mode, aliases){
    const normalizedQueue=mode?.queues||{};
    for(const alias of aliases){
      if(normalizedQueue[alias]!==undefined&&normalizedQueue[alias]!==null)return Number(normalizedQueue[alias]||0);
    }
    const source=mode?.declaredTaskCounts||mode?.taskCounts||{};
    const entries=Object.entries(source);
    for(const alias of aliases){
      if(source[alias]!==undefined&&source[alias]!==null)return Number(source[alias]||0);
    }
    const normalizedAliases=aliases.map(value=>String(value).toUpperCase().replace(/[^A-Z0-9]/g,''));
    for(const [key,value] of entries){
      const normalized=String(key).toUpperCase().replace(/[^A-Z0-9]/g,'');
      if(normalizedAliases.some(alias=>normalized.includes(alias)))return Number(value||0);
    }
    return null;
  }

  function queueRows(mode, modality){
    const delayed=queueCount(mode,['atrasadas','TASK_DELAYED_TO_DISPATCH','DELAYEDTODISPATCH']);
    const rows=modality==='FLEX'
      ?[
        ['Canceladas · não enviar',queueCount(mode,['canceladas','TASK_CANCELLED','TASK_CANCELED','CANCELLED','CANCELED']),'danger'],
        ['Atrasadas · enviar',delayed,'danger'],
        ['Etiquetas para imprimir',queueCount(mode,['etiquetas','TASK_READY_TO_PRINT','READYTOPRINT']),'warning'],
        ['Reagendadas',queueCount(mode,['reagendadas','TASK_RESCHEDULED','RESCHEDULED','REAGENDADA']),'info'],
        ['Prontas para enviar',queueCount(mode,['prontas','TASK_READY_TO_DISPATCH','READYTODISPATCH']),'success']
      ]
      :[
        ['Canceladas · não enviar',queueCount(mode,['canceladas','TASK_CANCELLED','TASK_CANCELED','CANCELLED','CANCELED']),'danger'],
        ['Atrasadas · enviar',delayed,'danger'],
        ['NF-e para gerenciar',queueCount(mode,['nfe','TASK_INVOICES_TO_BE_MANAGED','INVOICESTOBEMANAGED']),'info'],
        ['Etiquetas para imprimir',queueCount(mode,['etiquetas','TASK_READY_TO_PRINT','READYTOPRINT']),'warning'],
        ['Prontas para enviar',queueCount(mode,['prontas','TASK_READY_TO_DISPATCH','READYTODISPATCH']),'success'],
        ['Mensagens não lidas',queueCount(mode,['mensagens','UNREAD_MESSAGES','TASK_UNREAD_MESSAGES']),'info']
      ];
    return `<div class="ml-queue-list">${rows.map(([label,value,klass])=>{
      const missing=value===null||value===undefined;
      const numeric=missing?null:Number(value||0);
      return `<div class="ml-queue-row ${klass}${numeric===0?' zero':''}"><span>${esc(label)}</span><strong>${missing?'—':numeric}</strong></div>`;
    }).join('')}</div>`;
  }

  function copyIcon(){
    return `<svg class="ml-copy-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 8.5V6.8c0-1 .8-1.8 1.8-1.8h6.4c1 0 1.8.8 1.8 1.8v6.4c0 1-.8 1.8-1.8 1.8h-1.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="5" y="9" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/></svg>`;
  }

  function renderMode(mode, modality){
    const view=modeDisplay(mode);
    const name=modality==='FLEX'?'Flex':'Agência / Coleta';
    const subtitle=modality==='FLEX'?'Envios Flex do dia':'Envios para agência/coleta';
    const delayedText=view.delayedVerified?String(view.delayed):'—';
    const delayZero=view.delayedVerified&&Number(view.delayed||0)===0;
    return `<div class="ml-mode">
      <div class="ml-mode-head">
        <div class="ml-mode-name"><label>${name}</label><small>${subtitle}</small></div>
        <div class="ml-mode-total"><small>Total</small><b>${view.value}</b></div>
      </div>
      <div class="ml-mode-delay${delayZero?' zero':''}"><span>Atrasados no cartão</span><strong>${delayedText}</strong></div>
      ${view.verified?'':`<small class="ml-count-pending">Contador pendente · ${view.observed} registro(s) observado(s)</small>`}
      ${queueRows(mode,modality)}
    </div>`;
  }

  function renderAccount(account){
    const flex=account.flex||{};
    const coleta=account.coleta||{};
    const flexView=modeDisplay(flex);
    const coletaView=modeDisplay(coleta);
    const complete=Boolean(account.complete&&flexView.verified&&coletaView.verified);
    const cutoff=fmtTime(account.cutoff);
    const authCode=String(account.authorizationCode||'').trim();
    const authStatus=String(account.authorizationCodeStatus||'').trim();
    const accountError=String(account.error||flex.error||coleta.error||'').trim();
    const codeTitle=String(account.authorizationCodeError||authStatus||'Código diário de autorização/devolução do Mercado Livre');
    return `<article class="ml-account-card">
      <div class="ml-account-title"><b>${esc(account.label||account.key)}</b><span class="${complete?'ok':'warn'}">${complete?'LEITURA COMPLETA':'VERIFICAR'}</span></div>
      ${accountError?`<div class="ml-account-error" title="${esc(accountError)}">${esc(accountError)}</div>`:''}
      <div class="ml-cutoff"><small>Agência / Coleta até</small><strong class="${cutoff==='Não disponível no retorno'?'missing':''}">${esc(cutoff)}</strong></div>
      <div class="ml-auth-code ${authCode?'':'missing'}" title="${esc(codeTitle)}">
        <div class="ml-auth-code-info"><span>Código de devolução</span><b>${esc(authCode||'Não disponível')}</b></div>
        <button class="ml-copy-code" type="button" data-ml-copy-code="${esc(authCode)}" ${authCode?'':'disabled'} aria-label="Copiar código de devolução ${esc(authCode)}">${copyIcon()}<span>Copiar</span></button>
      </div>
      <div class="ml-mode-grid">
        ${renderMode(flex,'FLEX')}
        ${renderMode(coleta,'COLETA')}
      </div>
    </article>`;
  }

  async function getJson(path){
    const separator=String(path).includes('?')?'&':'?';
    const response=await fetch(base+path+separator+'_ts='+Date.now(),{
      cache:'no-store',
      headers:{'Accept':'application/json'}
    });
    const raw=await response.text();
    let data={};
    try{data=raw?JSON.parse(raw):{};}catch(_){throw new Error(`A rota ${path} devolveu uma resposta inválida.`);}
    if(!response.ok)throw new Error(data?.error||data?.message||`Erro HTTP ${response.status} em ${path}`);
    return data;
  }

  function writeHeaders(){
    const headers={'Accept':'application/json','Content-Type':'application/json'};
    const apiKey=localStorage.getItem('ehf_api_key')||'';
    if(apiKey)headers['x-api-key']=apiKey;
    return headers;
  }

  async function startAndWait(statusEl){
    const before=await getJson('/api/sync/status');
    const beforeId=Number(before?.mercadoLivre?.id||0);
    const wasRunning=Boolean(before?.running?.ml);

    const start=await fetch(base+'/api/sync/mercadolivre?_ts='+Date.now(),{
      method:'POST',
      cache:'no-store',
      headers:writeHeaders(),
      body:'{}'
    });
    const raw=await start.text();
    let startData={};
    try{startData=raw?JSON.parse(raw):{};}catch(_){throw new Error('A rota de atualização do Mercado Livre devolveu uma resposta inválida.');}

    if(!start.ok&&start.status!==409){
      const message=startData?.error==='API_KEY_INVALIDA'
        ?'A API Key do painel não confere com a configurada no Easypanel.'
        :(startData?.error||startData?.message||`Erro HTTP ${start.status} ao iniciar o Mercado Livre.`);
      throw new Error(message);
    }

    let targetId=Number(startData?.current?.id||0);
    if(!targetId&&(startData?.alreadyRunning||start.status===409)&&wasRunning)targetId=beforeId;
    const startedAt=Date.now();
    const deadline=startedAt+300000;

    while(Date.now()<deadline){
      await new Promise(resolve=>setTimeout(resolve,1500));
      const syncData=await getJson('/api/sync/status');
      const row=syncData?.mercadoLivre||null;
      const rowId=Number(row?.id||0);

      if(rowId>beforeId)targetId=rowId;
      if(!targetId&&(startData?.alreadyRunning||start.status===409)&&rowId===beforeId)targetId=rowId;

      const elapsed=Math.max(1,Math.round((Date.now()-startedAt)/1000));
      statusEl.textContent=`Mercado Livre em processamento: ${elapsed}s. Aguardando todas as contas terminarem...`;

      const finished=targetId>0&&rowId===targetId&&row?.status&&row.status!=='RUNNING'&&Boolean(row.finished_at);
      if(!finished)continue;

      if(row.status==='ERROR')throw new Error(row.error||'A leitura do Mercado Livre terminou com erro.');
      return row;
    }

    throw new Error('O Mercado Livre não confirmou a conclusão da leitura dentro de 5 minutos.');
  }

  async function load(force=false){
    if(loading)return;
    const root=document.getElementById('ml-deadline-summary');
    if(!root)return;
    loading=true;
    const status=document.getElementById('ml-deadline-status');
    const badge=document.getElementById('ml-deadline-source');
    const button=document.getElementById('btn-refresh-ml-deadlines');
    if(button){
      button.disabled=true;
      if(force)button.textContent='Atualizando...';
    }

    try{
      let finalRun=null;

      if(force){
        badge.textContent='PROCESSANDO';
        badge.className='ml-source-badge warn';
        status.textContent='Leitura iniciada. Atualizando os cartões de todas as contas...';
        status.className='ml-deadline-status warn';
        finalRun=await startAndWait(status);
      }else{
        try{
          const syncData=await getJson('/api/sync/status');
          if(syncData?.running?.ml){
            status.textContent='Mercado Livre em processamento paralelo. Os números abaixo são do último snapshot confirmado.';
            status.className='ml-deadline-status warn';
            badge.textContent='PROCESSANDO';
            badge.className='ml-source-badge warn';
          }
        }catch(_){}
      }

      const data=await getJson('/api/mercadolivre/horarios');
      if(!data?.ok)throw new Error(data?.error||'Falha ao consultar horários.');

      root.innerHTML=(data.accounts||[]).filter(account=>account.configured).map(renderAccount).join('')||'<div class="ml-deadline-loading">Nenhuma conta do Mercado Livre configurada.</div>';

      const configured=(data.accounts||[]).filter(a=>a.configured);
      const exact=Boolean(data.complete)&&configured.length>0&&configured.every(a=>a.complete&&a.flex?.countVerified&&a.coleta?.countVerified);
      const updatedDate=data.updatedAt?new Date(data.updatedAt):null;
      const updatedValid=updatedDate&&Number.isFinite(updatedDate.getTime());
      const ageSeconds=updatedValid?Math.max(0,Math.round((Date.now()-updatedDate.getTime())/1000)):null;
      const stale=ageSeconds===null||ageSeconds>600;

      if(finalRun?.status==='PARTIAL'){
        badge.textContent='LEITURA PARCIAL';
        badge.className='ml-source-badge warn';
        status.textContent=finalRun.error||'A leitura terminou parcialmente; os últimos totais completos foram preservados.';
        status.className='ml-deadline-status warn';
      }else if(stale){
        badge.textContent='DADOS ANTIGOS';
        badge.className='ml-source-badge warn';
        status.textContent=updatedValid
          ?`O último snapshot do Mercado Livre tem ${ageSeconds} segundo(s). Clique em Atualizar Mercado Livre.`
          :'O servidor ainda não confirmou uma leitura do Mercado Livre.';
        status.className='ml-deadline-status warn';
      }else{
        badge.textContent=exact?'CONTAGEM EXATA':'LEITURA PARCIAL';
        badge.className='ml-source-badge '+(exact?'ok':'warn');
        if(exact){
          status.innerHTML=`<span class="ml-status-chip"><strong>${Number(data.totals?.packages||0)}</strong> pacotes</span><span class="ml-status-chip flex"><strong>${Number(data.totals?.flex||0)}</strong> Flex</span><span class="ml-status-chip coleta"><strong>${Number(data.totals?.coleta||0)}</strong> Agência/Coleta</span><span class="ml-status-chip time">Atualizado <strong>${updatedDate.toLocaleTimeString('pt-BR')}</strong></span>`;
        }else{
          status.textContent='Uma ou mais filas não confirmou o contador de pacotes. Para evitar número incorreto, o painel mostra “—” até validar Pack ID, shipment ou o contador específico do cartão.';
        }
        status.className='ml-deadline-status '+(exact?'':'warn');
      }
    }catch(error){
      if(!root.querySelector('.ml-account-card')){
        root.innerHTML='<div class="ml-deadline-loading">Não foi possível carregar o painel do Mercado Livre.</div>';
      }
      badge.textContent='ERRO DE LEITURA';
      badge.className='ml-source-badge warn';
      status.textContent=error.message||String(error);
      status.className='ml-deadline-status error';
    }finally{
      loading=false;
      if(button){
        button.disabled=false;
        button.textContent='Atualizar Mercado Livre';
      }
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('btn-refresh-ml-deadlines')?.addEventListener('click',()=>load(true));
    document.addEventListener('click',async event=>{
      const button=event.target.closest?.('[data-ml-copy-code]');
      if(!button||button.disabled)return;
      const code=String(button.dataset.mlCopyCode||'').trim();
      if(!code)return;
      const label=button.querySelector('span');
      const original=label?.textContent||'Copiar';
      try{
        if(navigator.clipboard?.writeText){
          await navigator.clipboard.writeText(code);
        }else{
          const textarea=document.createElement('textarea');textarea.value=code;textarea.style.position='fixed';textarea.style.opacity='0';document.body.appendChild(textarea);textarea.select();document.execCommand('copy');textarea.remove();
        }
        button.classList.add('copied');if(label)label.textContent='Copiado';
        const toast=document.getElementById('toast-container');if(toast){toast.textContent=`Código ${code} copiado.`;toast.style.display='block';setTimeout(()=>{toast.style.display='none';},1800);}
      }catch(error){
        if(label)label.textContent='Erro';
        console.error('Falha ao copiar código do Mercado Livre:',error);
      }finally{
        setTimeout(()=>{button.classList.remove('copied');if(label)label.textContent=original;},1400);
      }
    });
    load(false);
    setInterval(()=>load(false),60000);
  });
  window.ehfAtualizarHorariosMercadoLivre=load;
})();

/* ===== UX 4.2.50 — Menu lateral recolhível ===== */
(()=>{
  const STORAGE_KEY='ehf_sidebar_collapsed';

  function initSidebarToggle(){
    const button=document.getElementById('enterprise-sidebar-toggle');
    const sidebar=document.querySelector('.enterprise-sidebar');
    if(!button||!sidebar)return;

    document.querySelectorAll('.enterprise-nav-item').forEach(item=>{
      const text=Array.from(item.children).find(el=>el.tagName==='SPAN'&&!el.classList.contains('nav-icon')&&!el.classList.contains('nav-badge'))?.textContent?.trim();
      if(text&&!item.getAttribute('title'))item.setAttribute('title',text);
    });

    const apply=()=>{
      const desktop=window.innerWidth>900;
      const wanted=localStorage.getItem(STORAGE_KEY)==='1';
      const collapsed=desktop&&wanted;
      document.body.classList.toggle('ehf-sidebar-collapsed',collapsed);
      button.setAttribute('aria-expanded',String(!collapsed));
      button.setAttribute('aria-label',collapsed?'Expandir menu lateral':'Recolher menu lateral');
      button.title=collapsed?'Expandir menu':'Recolher menu';
    };

    button.addEventListener('click',()=>{
      const next=!document.body.classList.contains('ehf-sidebar-collapsed');
      localStorage.setItem(STORAGE_KEY,next?'1':'0');
      apply();
    });

    window.addEventListener('resize',apply,{passive:true});
    apply();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSidebarToggle,{once:true});
  else initSidebarToggle();
})();


window.EHF_BIPAGEM_FAST_VERSION = '4.2.51-BIPAGEM-ASYNC-FAST-QUEUE';
