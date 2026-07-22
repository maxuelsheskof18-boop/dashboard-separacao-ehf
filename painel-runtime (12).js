    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getDatabase, ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

    function ajustarPainelProducaoDentroDaTela(painel) {
      if (!painel || !document.body.contains(painel)) return;

      const margem = 8;
      const rect = painel.getBoundingClientRect();
      let left = rect.left;
      let top = rect.top;

      if (rect.right > window.innerWidth - margem) {
        left = Math.max(margem, window.innerWidth - rect.width - margem);
      }
      if (rect.bottom > window.innerHeight - margem) {
        top = Math.max(margem, window.innerHeight - rect.height - margem);
      }
      if (left < margem) left = margem;
      if (top < margem) top = margem;

      painel.style.setProperty('left', `${left}px`, 'important');
      painel.style.setProperty('top', `${top}px`, 'important');
      painel.style.setProperty('right', 'auto', 'important');
      painel.style.setProperty('bottom', 'auto', 'important');
      salvarPosicaoPainelProducao(left, top);
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

    function garantirEstilosPainelProducao() {
      if (document.getElementById('ehf-painel-producao-style')) return;

      const style = document.createElement('style');
      style.id = 'ehf-painel-producao-style';
      style.textContent = `
        #painel-producao-flutuante{
          position:fixed!important;
          right:18px!important;
          bottom:18px!important;
          width:min(760px,calc(100vw - 24px))!important;
          height:auto!important;
          min-height:0!important;
          max-height:min(78vh,760px)!important;
          box-sizing:border-box!important;
          display:flex!important;
          visibility:visible!important;
          pointer-events:auto!important;
          flex-direction:column!important;
          overflow:hidden!important;
          z-index:9992!important;
          color:#f7f8fb!important;
          background:linear-gradient(165deg,rgba(16,23,34,.985),rgba(5,8,13,.99))!important;
          border:1px solid rgba(255,138,0,.52)!important;
          border-radius:15px!important;
          box-shadow:0 22px 58px rgba(0,0,0,.62),0 0 0 1px rgba(255,138,0,.06) inset!important;
          font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
          transform:none!important;
          opacity:1!important;
        }
        #painel-producao-flutuante.pp-dragging{cursor:grabbing!important;user-select:none!important;box-shadow:0 28px 70px rgba(0,0,0,.74)!important}
        #painel-producao-flutuante .pp-header{
          display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;
          padding:12px 12px 11px!important;background:linear-gradient(90deg,rgba(255,138,0,.18),rgba(255,138,0,.04))!important;
          border-bottom:1px solid rgba(255,255,255,.07)!important;cursor:grab!important;touch-action:none!important
        }
        #painel-producao-flutuante .pp-head-main{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important}
        #painel-producao-flutuante .pp-grip{color:#ff9b26!important;font-size:19px!important;line-height:1!important;letter-spacing:-2px!important}
        #painel-producao-flutuante .pp-title{display:block!important;font-size:13px!important;font-weight:950!important;letter-spacing:.02em!important;color:#fff!important}
        #painel-producao-flutuante .pp-subtitle{display:block!important;margin-top:2px!important;font-size:9px!important;color:#9da8b8!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
        #painel-producao-flutuante .pp-toggle{
          flex:0 0 auto!important;width:32px!important;height:32px!important;border-radius:9px!important;cursor:pointer!important;
          border:1px solid rgba(255,255,255,.10)!important;background:#151d28!important;color:#fff!important;font-size:17px!important;font-weight:900!important
        }
        #painel-producao-flutuante .pp-body{display:flex!important;flex-direction:column!important;height:auto!important;min-height:0!important;overflow:auto!important;padding:11px!important;gap:10px!important}
        #painel-producao-flutuante.collapsed{width:310px!important;height:auto!important;min-height:0!important;max-height:58px!important}
        #painel-producao-flutuante.collapsed .pp-header{border-bottom:0!important}
        #painel-producao-flutuante.collapsed .pp-body{display:none!important;height:0!important;min-height:0!important;padding:0!important;margin:0!important;overflow:hidden!important}
        #painel-producao-flutuante .pp-progress-wrap{display:grid!important;grid-template-columns:1fr auto!important;gap:8px!important;align-items:center!important}
        #painel-producao-flutuante .pp-progress{grid-column:1/-1!important;height:6px!important;border-radius:999px!important;background:#242d39!important;overflow:hidden!important}
        #painel-producao-flutuante .pp-progress i{display:block!important;height:100%!important;border-radius:inherit!important;background:linear-gradient(90deg,#ff8a00,#ffbd5a)!important}
        #painel-producao-flutuante .pp-progress-label{font-size:10px!important;color:#aeb8c7!important}
        #painel-producao-flutuante .pp-progress-value{font-size:11px!important;font-weight:950!important;color:#ffad42!important}
        #painel-producao-flutuante .pp-next{
          border:1px solid rgba(255,138,0,.25)!important;background:rgba(255,138,0,.075)!important;border-radius:11px!important;padding:10px!important
        }
        #painel-producao-flutuante .pp-next-top{display:flex!important;justify-content:space-between!important;gap:8px!important;color:#ffad42!important;font-size:9px!important;font-weight:900!important;text-transform:uppercase!important}
        #painel-producao-flutuante .pp-next strong{display:block!important;margin-top:5px!important;font-size:11px!important;line-height:1.35!important;color:#fff!important}
        #painel-producao-flutuante .pp-list{display:flex!important;flex-direction:column!important;gap:7px!important}
        #painel-producao-flutuante .pp-row{
          display:grid!important;grid-template-columns:54px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;
          padding:8px!important;border:1px solid rgba(255,255,255,.07)!important;background:#0c121b!important;border-radius:10px!important
        }
        #painel-producao-flutuante .pp-row.done{border-color:rgba(34,197,94,.36)!important;background:rgba(20,83,45,.18)!important}
        #painel-producao-flutuante .pp-row.none{border-color:rgba(148,163,184,.25)!important;opacity:.77!important}
        #painel-producao-flutuante .pp-row.late{border-color:rgba(239,68,68,.42)!important;background:rgba(127,29,29,.13)!important}
        #painel-producao-flutuante .pp-time{font-size:10px!important;font-weight:950!important;color:#ff9d2e!important}
        #painel-producao-flutuante .pp-channel{min-width:0!important}
        #painel-producao-flutuante .pp-channel b{display:block!important;font-size:10px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
        #painel-producao-flutuante .pp-channel small{display:block!important;margin-top:2px!important;font-size:8px!important;font-weight:850!important;color:#8894a5!important;text-transform:uppercase!important}
        #painel-producao-flutuante .pp-row.late .pp-channel small{color:#fca5a5!important}
        #painel-producao-flutuante .pp-actions{display:flex!important;align-items:center!important;gap:5px!important}
        #painel-producao-flutuante .pp-action{
          border:1px solid rgba(255,255,255,.10)!important;background:#17202c!important;color:#cbd5e1!important;border-radius:8px!important;
          min-height:29px!important;padding:5px 7px!important;font-size:8px!important;font-weight:950!important;cursor:pointer!important;white-space:nowrap!important
        }
        #painel-producao-flutuante .pp-action.done.active{background:#1f9d59!important;border-color:#35c878!important;color:#fff!important}
        #painel-producao-flutuante .pp-action.none.active{background:#475569!important;border-color:#64748b!important;color:#fff!important}
        #painel-producao-flutuante .pp-action:disabled{opacity:.45!important;cursor:wait!important}
        #painel-producao-flutuante .pp-sections-grid{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;align-items:start!important;gap:10px!important;min-width:0!important}
        #painel-producao-flutuante .pp-section{display:flex!important;flex-direction:column!important;gap:7px!important;min-width:0!important;padding:10px!important;border:1px solid rgba(255,255,255,.075)!important;border-radius:12px!important;background:rgba(8,13,20,.58)!important}
        #painel-producao-flutuante .pp-section + .pp-section{padding-top:10px!important;border-top:1px solid rgba(255,255,255,.075)!important}
        #painel-producao-flutuante .pp-section-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important}
        #painel-producao-flutuante .pp-section-title{font-size:9px!important;font-weight:950!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:#dce4ef!important}
        #painel-producao-flutuante .pp-section-count{font-size:8px!important;font-weight:900!important;color:#ffad42!important;background:rgba(255,138,0,.10)!important;border:1px solid rgba(255,138,0,.18)!important;border-radius:999px!important;padding:3px 7px!important}
        #painel-producao-flutuante .pp-routine-list{display:flex!important;flex-direction:column!important;gap:7px!important}
        #painel-producao-flutuante .pp-routine-row{display:grid!important;grid-template-columns:48px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;padding:8px!important;border:1px solid rgba(255,255,255,.07)!important;background:#0c121b!important;border-radius:10px!important}
        #painel-producao-flutuante .pp-routine-row.done{border-color:rgba(34,197,94,.36)!important;background:rgba(20,83,45,.18)!important}
        #painel-producao-flutuante .pp-routine-row.late{border-color:rgba(239,68,68,.42)!important;background:rgba(127,29,29,.13)!important}
        #painel-producao-flutuante .pp-routine-time{font-size:10px!important;font-weight:950!important;color:#ff9d2e!important}
        #painel-producao-flutuante .pp-routine-main{min-width:0!important}
        #painel-producao-flutuante .pp-routine-main b{display:block!important;font-size:9px!important;line-height:1.3!important;color:#fff!important}
        #painel-producao-flutuante .pp-routine-main small{display:block!important;margin-top:3px!important;font-size:8px!important;line-height:1.25!important;color:#8894a5!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
        #painel-producao-flutuante .pp-routine-row.late .pp-routine-main small{color:#fca5a5!important}
        #painel-producao-flutuante .pp-routine-action{border:1px solid rgba(255,255,255,.10)!important;background:#17202c!important;color:#cbd5e1!important;border-radius:8px!important;min-height:29px!important;padding:5px 8px!important;font-size:8px!important;font-weight:950!important;cursor:pointer!important;white-space:nowrap!important}
        #painel-producao-flutuante .pp-routine-action.active{background:#1f9d59!important;border-color:#35c878!important;color:#fff!important}
        #painel-producao-flutuante .pp-routine-action:disabled{opacity:.45!important;cursor:wait!important}
        #painel-producao-flutuante .pp-footer{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding-top:2px!important}
        #painel-producao-flutuante .pp-date{font-size:8px!important;color:#7f8a99!important}
        #painel-producao-flutuante .pp-admin{border:0!important;background:transparent!important;color:#ffad42!important;font-size:9px!important;font-weight:900!important;cursor:pointer!important;padding:5px!important}
        body.ehf-bipagem-ativa #painel-producao-flutuante,#view-bipagem.active~#painel-producao-flutuante{display:none!important;visibility:hidden!important;pointer-events:none!important}
        @media(max-width:980px){
          #painel-producao-flutuante{width:min(390px,calc(100vw - 20px))!important;max-height:74vh!important}
          #painel-producao-flutuante .pp-sections-grid{grid-template-columns:minmax(0,1fr)!important}
          #painel-producao-flutuante.collapsed{width:310px!important;max-height:58px!important}
        }
        @media(max-width:720px){
          #painel-producao-flutuante{right:8px!important;bottom:8px!important;width:min(350px,calc(100vw - 16px))!important;max-height:68vh!important}
          #painel-producao-flutuante.collapsed{width:min(310px,calc(100vw - 16px))!important;max-height:58px!important}
          #painel-producao-flutuante .pp-row{grid-template-columns:46px minmax(0,1fr)!important}
          #painel-producao-flutuante .pp-actions{grid-column:1/-1!important;justify-content:flex-end!important}
          #painel-producao-flutuante .pp-routine-row{grid-template-columns:46px minmax(0,1fr)!important}
          #painel-producao-flutuante .pp-routine-action{grid-column:1/-1!important;justify-self:end!important}
        }
      `;
      document.head.appendChild(style);
    }

    function escaparTextoPainelProducao(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function horarioEmMinutosPainel(value) {
      const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return 9999;
      return (Number(match[1]) * 60) + Number(match[2]);
    }

    function minutosAgoraBrasiliaPainel() {
      const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date());
      const data = Object.fromEntries(parts.map(part => [part.type, part.value]));
      return (Number(data.hour || 0) * 60) + Number(data.minute || 0);
    }

    function renderPainelProducaoFlutuante(sequencia, rotina) {
      window.ehfProducaoAdmin = Array.isArray(sequencia) ? sequencia : [];
      window.ehfRotinaAdmin = Array.isArray(rotina) ? rotina : [];

      document.getElementById('painel-producao-flutuante')?.remove();
      garantirEstilosPainelProducao();

      const itens = window.ehfProducaoAdmin
        .filter(item => item && item.ativo !== false)
        .slice()
        .sort((a, b) => horarioEmMinutosPainel(a.horario) - horarioEmMinutosPainel(b.horario));

      const rotinas = window.ehfRotinaAdmin
        .filter(item => item)
        .slice()
        .sort((a, b) => horarioEmMinutosPainel(a.horario) - horarioEmMinutosPainel(b.horario));

      if (!itens.length && !rotinas.length) return;

      const agora = minutosAgoraBrasiliaPainel();
      const concluidos = itens.filter(item => item.finalizado || item.naoTem).length;
      const percentual = Math.round((concluidos / Math.max(1, itens.length)) * 100);
      const rotinasConcluidas = rotinas.filter(item => item.concluido).length;
      const percentualSeparacao = Math.round((rotinasConcluidas / Math.max(1, rotinas.length)) * 100);
      const progressoGeral = Math.round(((concluidos + rotinasConcluidas) / Math.max(1, itens.length + rotinas.length)) * 100);
      const rotinasPendentes = rotinas.filter(item => !item.concluido);
      const proximaRotina = rotinasPendentes.find(item => horarioEmMinutosPainel(item.horario) >= agora) || rotinasPendentes[0] || null;
      const rotinaAtrasada = proximaRotina && horarioEmMinutosPainel(proximaRotina.horario) < agora;
      const recolhido = localStorage.getItem('ehf_painel_producao_recolhido') === '1';

      const painel = document.createElement('section');
      painel.id = 'painel-producao-flutuante';
      painel.className = recolhido ? 'collapsed' : '';
      painel.setAttribute('aria-label', 'Painel operacional de Produção e Separação');

      const posicao = getPosicaoPainelProducao();
      if (posicao && Number.isFinite(Number(posicao.left)) && Number.isFinite(Number(posicao.top))) {
        const left = Math.max(8, Number(posicao.left));
        const top = Math.max(8, Number(posicao.top));
        painel.style.setProperty('left', `${left}px`, 'important');
        painel.style.setProperty('top', `${top}px`, 'important');
        painel.style.setProperty('right', 'auto', 'important');
        painel.style.setProperty('bottom', 'auto', 'important');
      }

      const rows = itens.map(item => {
        const finalizado = Boolean(item.finalizado);
        const naoTem = Boolean(item.naoTem);
        const atrasado = !finalizado && !naoTem && horarioEmMinutosPainel(item.horario) < agora;
        const status = finalizado ? 'Finalizado' : (naoTem ? 'Sem pedidos' : (atrasado ? 'Atrasado' : 'Pendente'));
        const rowClass = finalizado ? 'done' : (naoTem ? 'none' : (atrasado ? 'late' : ''));
        const id = escaparTextoPainelProducao(item.id);

        return `
          <div class="pp-row ${rowClass}">
            <span class="pp-time">${escaparTextoPainelProducao(item.horario || '--:--')}</span>
            <span class="pp-channel">
              <b>${escaparTextoPainelProducao(item.nome || item.id)}</b>
              <small>${status}</small>
            </span>
            <span class="pp-actions">
              <button type="button" class="pp-action done ${finalizado ? 'active' : ''}" data-producao-id="${id}" data-producao-field="finalizado">✓ Feito</button>
              <button type="button" class="pp-action none ${naoTem ? 'active' : ''}" data-producao-id="${id}" data-producao-field="naoTem">— Não tem</button>
            </span>
          </div>`;
      }).join('');

      const routineRows = rotinas.map(item => {
        const concluido = Boolean(item.concluido);
        const atrasado = !concluido && horarioEmMinutosPainel(item.horario) < agora;
        const rowClass = concluido ? 'done' : (atrasado ? 'late' : '');
        const status = concluido
          ? `Concluído${item.concluidoEm ? ` · ${item.concluidoEm}` : ''}`
          : (atrasado ? 'Envio pendente' : 'Aguardando horário');
        const canais = Array.isArray(item.sequenciaRemessa) && item.sequenciaRemessa.length
          ? item.sequenciaRemessa.join(' → ')
          : (Array.isArray(item.canais) ? item.canais.join(', ') : '');
        const id = escaparTextoPainelProducao(item.id);

        return `
          <div class="pp-routine-row ${rowClass}">
            <span class="pp-routine-time">${escaparTextoPainelProducao(item.horario || '--:--')}</span>
            <span class="pp-routine-main">
              <b>${escaparTextoPainelProducao(item.titulo || item.descricao || 'Enviar para separação')}</b>
              <small title="${escaparTextoPainelProducao(canais)}">${escaparTextoPainelProducao(status)}${canais ? ` · ${escaparTextoPainelProducao(canais)}` : ''}</small>
            </span>
            <button type="button" class="pp-routine-action ${concluido ? 'active' : ''}" data-rotina-id="${id}">${concluido ? '✓ Feito' : 'Marcar feito'}</button>
          </div>`;
      }).join('');

      painel.innerHTML = `
        <header class="pp-header">
          <span class="pp-head-main">
            <span class="pp-grip" aria-hidden="true">⠿</span>
            <span>
              <span class="pp-title">Operação do Dia</span>
              <span class="pp-subtitle">Produção ${concluidos}/${itens.length} · Separação ${rotinasConcluidas}/${rotinas.length} · operador ${escaparTextoPainelProducao(nomeOperadorLocal || 'PAINEL')}</span>
            </span>
          </span>
          <button id="pp-toggle" class="pp-toggle" type="button" aria-label="${recolhido ? 'Expandir' : 'Recolher'} painel">${recolhido ? '+' : '−'}</button>
        </header>
        <div class="pp-body">
          <div class="pp-progress-wrap">
            <span class="pp-progress-label">Andamento geral do dia</span>
            <strong class="pp-progress-value">${progressoGeral}%</strong>
            <span class="pp-progress"><i style="width:${progressoGeral}%"></i></span>
          </div>
          ${proximaRotina ? `
            <div class="pp-next">
              <div class="pp-next-top"><span>${rotinaAtrasada ? 'Separação pendente' : 'Próximo envio para separação'}</span><span>${escaparTextoPainelProducao(proximaRotina.horario || '--:--')}</span></div>
              <strong>${escaparTextoPainelProducao(proximaRotina.titulo || proximaRotina.descricao || 'Rotina operacional')}</strong>
            </div>` : ''}
          <div class="pp-sections-grid">
            ${itens.length ? `
              <section class="pp-section pp-section-producao">
                <div class="pp-section-head"><span class="pp-section-title">Produção</span><span class="pp-section-count">${concluidos}/${itens.length} · ${percentual}%</span></div>
                <div class="pp-list">${rows}</div>
              </section>` : ''}
            ${rotinas.length ? `
              <section class="pp-section pp-section-separacao">
                <div class="pp-section-head"><span class="pp-section-title">Envio para Separação</span><span class="pp-section-count">${rotinasConcluidas}/${rotinas.length} · ${percentualSeparacao}%</span></div>
                <div class="pp-routine-list">${routineRows}</div>
              </section>` : ''}
          </div>
          <footer class="pp-footer">
            <span class="pp-date">Data operacional: ${escaparTextoPainelProducao(DATA_OPERACIONAL)}</span>
            <span class="pp-date">Somente execução · configuração no Admin</span>
          </footer>
        </div>`;

      document.body.appendChild(painel);
      setTimeout(() => ajustarPainelProducaoDentroDaTela(painel), 0);

      painel.querySelector('#pp-toggle')?.addEventListener('click', event => {
        event.stopPropagation();
        const collapsed = painel.classList.toggle('collapsed');
        localStorage.setItem('ehf_painel_producao_recolhido', collapsed ? '1' : '0');
        event.currentTarget.textContent = collapsed ? '+' : '−';
        event.currentTarget.setAttribute('aria-label', collapsed ? 'Expandir painel' : 'Recolher painel');
        setTimeout(() => ajustarPainelProducaoDentroDaTela(painel), 0);
      });

      painel.querySelectorAll('[data-producao-id][data-producao-field]').forEach(button => {
        button.addEventListener('click', async () => {
          const id = button.dataset.producaoId;
          const field = button.dataset.producaoField;
          const item = (window.ehfProducaoAdmin || []).find(row => String(row.id) === String(id));
          const checked = !Boolean(item?.[field]);
          painel.querySelectorAll('.pp-action,.pp-routine-action').forEach(action => { action.disabled = true; });
          await atualizarStatusProducaoPainel(id, field, checked);
        });
      });

      painel.querySelectorAll('[data-rotina-id]').forEach(button => {
        button.addEventListener('click', async () => {
          const id = button.dataset.rotinaId;
          const item = (window.ehfRotinaAdmin || []).find(row => String(row.id) === String(id));
          const checked = !Boolean(item?.concluido);
          painel.querySelectorAll('.pp-action,.pp-routine-action').forEach(action => { action.disabled = true; });
          await atualizarStatusRotinaPainel(id, checked);
        });
      });

      habilitarArrastarPainelProducao(painel);
      atualizarVisibilidadePainelProducao();
    }

    window.ehfRenderPainelProducao = renderPainelProducaoFlutuante;

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


    async function atualizarStatusRotinaPainel(id, checked) {
      const rotinaAtual = Array.isArray(window.ehfRotinaAdmin) && window.ehfRotinaAdmin.length > 0
        ? window.ehfRotinaAdmin
        : rotinaPadraoPainel;

      const concluidoEm = checked ? formatHorarioBrasilia(new Date(), true) : '';
      const novaRotina = rotinaAtual.map(item => String(item.id) === String(id)
        ? { ...item, concluido: checked, concluidoEm, concluidoPor: checked ? (nomeOperadorLocal || 'PAINEL') : '' }
        : item);

      window.ehfRotinaAdmin = novaRotina;
      renderPainelProducaoFlutuante(window.ehfProducaoAdmin || producaoPadraoPainel, novaRotina);

      const itemAlterado = novaRotina.find(item => String(item.id) === String(id));

      try {
        await set(rotinaAdminRef, {
          itens: novaRotina,
          atualizadoEm: Date.now(),
          atualizadoEmTexto: formatHorarioBrasilia(new Date(), true),
          atualizadoPor: nomeOperadorLocal || 'PAINEL'
        });

        await set(alertaBroadcastRef, {
          txt: `O operador <b>${nomeOperadorLocal || 'PAINEL'}</b> ${checked ? 'concluiu' : 'reabriu'} a rotina de separação <b>${itemAlterado?.titulo || id}</b>.`,
          ts: Date.now()
        });
      } catch (err) {
        console.warn('Erro ao atualizar rotina de separação pelo painel:', err);
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
    const ML_ALARM_OFFSET_MINUTES = 60;
    const alarmState = {};

    function ehfGarantirVisualControle42120() {
      if (document.getElementById('ehf-visual-controle-42120')) return;
      const style = document.createElement('style');
      style.id = 'ehf-visual-controle-42120';
      style.textContent = `

/* ===== EHF v4.2.20 - VISUAL DO PAINEL DE ALARMES FORCADO ===== */
html body #control-panel .cp-group-title,
html body .cp-group-title{
  display:flex!important;align-items:center!important;gap:8px!important;
  margin:18px 0 10px 0!important;padding-left:10px!important;
  border-left:3px solid #ff8a00!important;color:#ff9b22!important;
  font-size:12px!important;font-weight:900!important;letter-spacing:.55px!important;
  text-transform:uppercase!important;
}
html body #control-panel .cp-store-list,
html body .cp-store-list{list-style:none!important;margin:0 0 10px 0!important;padding:0!important;display:block!important;}
html body #control-panel .cp-store-item,
html body .cp-store-item{
  display:grid!important;grid-template-columns:170px minmax(0,1fr)!important;
  align-items:center!important;gap:16px!important;min-height:58px!important;
  padding:12px 14px!important;margin:0 0 8px 0!important;
  border-radius:12px!important;background:rgba(15,23,42,.82)!important;
  border:1px solid rgba(148,163,184,.16)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;
  transition:opacity .18s ease,background .18s ease,border-color .18s ease!important;
}
html body #control-panel .cp-store-item.remessa-row,
html body .cp-store-item.remessa-row{border-left:3px solid rgba(255,138,0,.82)!important;}
html body #control-panel .cp-store-item .store-name,
html body .cp-store-item .store-name{
  width:auto!important;border:0!important;padding:0!important;margin:0!important;
  color:#fff!important;font-size:12px!important;font-weight:950!important;line-height:1.1!important;
  text-transform:uppercase!important;letter-spacing:-.1px!important;
}
html body #control-panel .remessa-badge,
html body .remessa-badge{
  display:inline-flex!important;margin:6px 0 0 0!important;width:max-content!important;
  padding:3px 7px!important;border-radius:999px!important;
  color:#ff9b22!important;background:rgba(255,138,0,.10)!important;
  border:1px solid rgba(255,138,0,.26)!important;font-size:9px!important;font-weight:950!important;
}
html body #control-panel .cp-store-controls,
html body .cp-store-controls{
  display:flex!important;align-items:center!important;justify-content:flex-start!important;
  gap:12px!important;flex-wrap:wrap!important;width:100%!important;min-width:0!important;
}
html body #control-panel .cp-time-block.only-alarm,
html body .cp-time-block.only-alarm{
  display:inline-flex!important;flex-direction:column!important;align-items:flex-start!important;
  gap:4px!important;min-width:78px!important;width:auto!important;margin:0!important;
}
html body #control-panel .cp-time-block.only-alarm small,
html body .cp-time-block.only-alarm small{
  color:#ffb454!important;font-size:8px!important;line-height:1!important;
  font-weight:950!important;text-transform:uppercase!important;letter-spacing:.42px!important;
}
html body #control-panel .cp-time-block.only-alarm input,
html body .cp-time-block.only-alarm input{
  width:86px!important;height:34px!important;padding:6px 8px!important;
  background:#060b12!important;color:#fff!important;border:1px solid rgba(255,138,0,.86)!important;
  border-radius:7px!important;outline:none!important;font-size:12px!important;font-weight:900!important;
  box-shadow:0 0 0 1px rgba(255,138,0,.10), inset 0 1px 0 rgba(255,255,255,.04)!important;
}
html body #control-panel .cp-time-block.only-alarm input:focus,
html body .cp-time-block.only-alarm input:focus{box-shadow:0 0 0 3px rgba(255,138,0,.18)!important;border-color:#ff9b22!important;}
html body #control-panel .cp-time-block.only-alarm input.input-invalid,
html body .cp-time-block.only-alarm input.input-invalid{border-color:#ef4444!important;box-shadow:0 0 0 3px rgba(239,68,68,.18)!important;color:#fecaca!important;}
html body #control-panel .cp-auto-alarm-btn,
html body .cp-auto-alarm-btn{
  height:30px!important;padding:0 10px!important;border:1px solid rgba(255,138,0,.66)!important;
  background:rgba(255,138,0,.075)!important;color:#ffb454!important;border-radius:7px!important;
  font-size:9px!important;font-weight:950!important;cursor:pointer!important;white-space:nowrap!important;
}
html body #control-panel .cp-auto-alarm-btn:hover,
html body .cp-auto-alarm-btn:hover{background:rgba(255,138,0,.16)!important;}
html body #control-panel .cp-auto-alarm-btn:disabled,
html body .cp-auto-alarm-btn:disabled{opacity:.42!important;cursor:not-allowed!important;}
html body #control-panel .cp-store-controls label,
html body .cp-store-controls label{
  display:inline-flex!important;align-items:center!important;gap:5px!important;
  color:#e5edf8!important;font-size:11px!important;font-weight:750!important;white-space:nowrap!important;
  margin:0!important;
}
html body #control-panel .cp-store-controls label:last-child,
html body .cp-store-controls label:last-child{color:#69d991!important;}
html body #control-panel .cp-store-controls input[type="checkbox"],
html body .cp-store-controls input[type="checkbox"]{
  width:15px!important;height:15px!important;margin:0!important;padding:0!important;accent-color:#ff8a00!important;
}
html body #control-panel .cp-time-placeholder,
html body .cp-time-placeholder{display:inline-block!important;width:86px!important;min-width:86px!important;}
html body #control-panel .cp-alarm-meta,
html body .cp-alarm-meta{display:none!important;}
html body #ehf-visual-version-badge{
  position:fixed!important;right:8px!important;bottom:6px!important;z-index:999999!important;
  opacity:.45!important;color:#94a3b8!important;background:rgba(2,6,23,.75)!important;border:1px solid rgba(148,163,184,.16)!important;
  border-radius:999px!important;padding:3px 7px!important;font-size:9px!important;font-weight:800!important;pointer-events:none!important;
}
@media (max-width: 980px){
  html body #control-panel .cp-store-item, html body .cp-store-item{grid-template-columns:1fr!important;gap:10px!important;}
  html body #control-panel .cp-store-controls, html body .cp-store-controls{gap:10px!important;}
}
`;
      document.head.appendChild(style);
      if (!document.getElementById('ehf-visual-version-badge')) {
        const badge = document.createElement('div');
        badge.id = 'ehf-visual-version-badge';
        badge.textContent = 'EHF v4.2.20';
        document.body.appendChild(badge);
      }
      document.documentElement.setAttribute('data-ehf-visual', '4.2.20');
      window.EHF_FRONTEND_VERSION = '4.2.20-VISUAL-FORCADO';
    }

    function ehfGarantirEstiloAlarmesML() {
      if (document.getElementById('ehf-ml-auto-alarm-style')) return;
      const style = document.createElement('style');
      style.id = 'ehf-ml-auto-alarm-style';
      style.textContent = `
        .cp-time-block{display:inline-flex;flex-direction:column;gap:3px;align-items:flex-start;min-width:82px}
        .cp-time-block small{font-size:8px;line-height:1;color:#93a4bc;font-weight:900;text-transform:uppercase;letter-spacing:.35px}
        .cp-time-block.alarm small{color:#ffb454}
        .cp-time-block.alarm input{border-color:rgba(255,138,0,.55);box-shadow:0 0 0 1px rgba(255,138,0,.10)}
        .cp-time-block.alarm input.input-invalid{border-color:rgba(239,68,68,.85)!important;box-shadow:0 0 0 1px rgba(239,68,68,.28)!important;color:#fecaca!important}
        .cp-time-block.alarm input::placeholder{color:#64748b}
        .cp-alarm-meta{font-size:9px;color:#8ea0b8;width:100%;line-height:1.35;margin-top:-3px}
        .cp-alarm-meta b{color:#ffb454}.cp-alarm-meta .manual{color:#fbbf24}.cp-alarm-meta .auto{color:#86efac}
        .cp-auto-alarm-btn{border:1px solid rgba(255,138,0,.42);background:rgba(255,138,0,.08);color:#ffb454;border-radius:7px;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer;white-space:nowrap}
        .cp-auto-alarm-btn:disabled{opacity:.45;cursor:not-allowed}
      `;
      document.head.appendChild(style);
    }

    ehfGarantirVisualControle42120();

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
    const EHF_WORKER_BASE = String(window.EHF_TINY_WORKER_BASE || window.EHF_API_BASE || 'https://atendente-vesco-tiny-worker.2cwhzy.easypanel.host').replace(/\/+$/, '');
    let ehfBipSession = null;

    function ehfApiHeaders() {
      const headers = { 'Content-Type': 'application/json' };
      const apiKey = localStorage.getItem('ehf_api_key') || '';
      if (apiKey) headers['x-api-key'] = apiKey;
      return headers;
    }

    async function ehfApi(path, options = {}) {
      const response = await fetch(EHF_WORKER_BASE + path, {
        ...options,
        headers: { ...ehfApiHeaders(), ...(options.headers || {}) }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || `Erro HTTP ${response.status}`);
        error.data = data;
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
      const rows = scans.filter((scan) => scan.status !== 'NAO_LOCALIZADO').map((scan, index) => {
        const products = (scan.items || []).map((item) => `${Number(item.quantity || item.quantidade || 0)}x ${item.description || item.descricao || item.sku || item.codigo || ''}`).join('<br>');
        return `<tr><td>${index + 1}</td><td>${ehfEscapeHtml((scan.account || '').toUpperCase())}</td><td>${ehfEscapeHtml(scan.tiny_number || '-')}</td><td>${ehfEscapeHtml(scan.ecommerce_order_id || '-')}</td><td>${ehfEscapeHtml(scan.normalized_code || scan.shipment_id || '-')}</td><td>${products || '-'}</td><td>${Number(scan.total_units || 0)}</td></tr>`;
      }).join('');
      const win = window.open('', '_blank', 'width=1100,height=800');
      if (!win) return ehfBipToast('O navegador bloqueou a abertura do romaneio.', true);
      win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Romaneio #${session.id}</title><style>body{font-family:Arial,sans-serif;color:#111;margin:26px}h1{margin:0;font-size:24px}.head{display:flex;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:12px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.meta div{border:1px solid #bbb;padding:9px}.meta span{display:block;font-size:10px;text-transform:uppercase;color:#555}.meta b{font-size:13px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #aaa;padding:7px;vertical-align:top}th{background:#eee}.totals{display:flex;gap:12px;margin:15px 0}.totals div{border:2px solid #111;padding:10px 16px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:70px}.signature{border-top:1px solid #111;text-align:center;padding-top:6px}.foot{margin-top:24px;font-size:9px;color:#555}@media print{button{display:none}body{margin:12mm}}</style></head><body><div class="head"><div><h1>EHF LOGÍSTICA</h1><div>Romaneio de coleta / expedição</div></div><div><b>ROMANEIO #${session.id}</b><br>${new Date().toLocaleString('pt-BR')}</div></div><div class="meta"><div><span>Canal</span><b>${ehfEscapeHtml(session.channel_name)}</b></div><div><span>Responsável / coletor</span><b>${ehfEscapeHtml(session.collector_name)}</b></div><div><span>Conferente</span><b>${ehfEscapeHtml(session.checker_name || session.operator)}</b></div><div><span>Início</span><b>${new Date(session.opened_at).toLocaleString('pt-BR')}</b></div><div><span>Fim</span><b>${session.closed_at ? new Date(session.closed_at).toLocaleString('pt-BR') : 'Em andamento'}</b></div><div><span>Observações</span><b>${ehfEscapeHtml(session.notes || '-')}</b></div></div><table><thead><tr><th>#</th><th>Loja</th><th>Pedido Tiny</th><th>Pedido marketplace</th><th>Etiqueta / envio</th><th>Produtos</th><th>Unidades</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Nenhum pacote localizado.</td></tr>'}</tbody></table><div class="totals"><div><b>${Number(summary.packages || 0)}</b><br>pacotes</div><div><b>${Number(summary.uniqueOrders || 0)}</b><br>pedidos</div><div><b>${Number(summary.totalUnits || 0)}</b><br>unidades</div><div><b>${Number(summary.notFound || 0)}</b><br>não localizados</div></div><div class="signatures"><div class="signature">Entregue/conferido por: ${ehfEscapeHtml(session.checker_name || session.operator)}</div><div class="signature">Recebido por: ${ehfEscapeHtml(session.collector_name)}</div></div><div class="signatures"><div class="signature">Documento / placa</div><div class="signature">Assinatura e data/hora</div></div><div class="foot">Gerado pelo Dashboard de Separação EHF · sessão ${session.id}</div></body></html>`);
      win.document.close();
      setTimeout(() => {
        try { win.focus(); win.print(); } catch (_) {}
      }, 350);
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
    ehfLoadBipSession();

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

    async function processarBipagem(codigoDigitado) {
      if (!ehfBipSession?.session?.id || ehfBipSession.session.status !== 'ABERTA') {
        ehfOpenBipSessionModal();
        ehfBipToast('Inicie uma conferência antes de bipar.', true);
        return;
      }
      const input = document.getElementById('input-leitor-codigo');
      if (input) input.disabled = true;
      try {
        // Pré-resolução rápida: usa cache, atraso do Mercado Livre e, somente quando
        // necessário, consulta o pedido exato no Tiny antes de registrar a bipagem.
        try {
          ehfBipToast('Preparando etiqueta e produtos...');
          await ehfApi('/api/packing/preparar', {
            method: 'POST',
            body: JSON.stringify({ codigo: codigoDigitado })
          });
        } catch (prepareError) {
          // Durante a ordem de deploy o Gateway antigo pode não possuir a rota.
          // Nesse único caso continuamos pela leitura tradicional.
          const message = String(prepareError.message || '');
          if (!/404|Cannot POST|N[ÃA]O ENCONTRAD/i.test(message)) throw prepareError;
        }
        const data = await ehfApi(`/api/bipagem/sessoes/${ehfBipSession.session.id}/scan`, {
          method: 'POST',
          body: JSON.stringify({ codigo: codigoDigitado, operator: nomeOperadorLocal })
        });
        ehfBipSession = data.session || ehfBipSession;
        ehfRenderBipSession(ehfBipSession);
        if (data.duplicate) {
          tocarSomConfirmacaoLeitura(false);
          ehfBipToast('Esta etiqueta já foi bipada nesta conferência.', true);
          return;
        }
        const lookup = data.lookup || {};
        const infoOriginal = identificarEtiqueta(codigoDigitado);
        const actualChannel = data.actualChannel || {};
        const infoEtiqueta = {
          ...infoOriginal,
          plataforma: actualChannel.platform || infoOriginal.plataforma,
          canal: actualChannel.code || infoOriginal.canal,
          canalNome: actualChannel.name || infoOriginal.canalNome,
          idEtiqueta: lookup.codigoNormalizado || lookup.codigoLido || infoOriginal.idEtiqueta,
          codigoRastreio: lookup.pedido?.codigoRastreamento || infoOriginal.codigoRastreio,
          status: data.channelMatch ? 'Conferido' : 'Canal divergente',
          observacao: data.channelMatch ? infoOriginal.observacao : `Selecionado ${data.expectedChannel?.name}; identificado ${actualChannel.name || 'outro canal'}`
        };
        const destino = lookup.lojaKey
          ? { lojaKey: lookup.lojaKey, lojaNome: lookup.lojaNome || lookup.lojaKey, canalEsperado: ehfBipSession.session.channel_name, esperado: 0, bipado: 0, restante: 0 }
          : escolherLojaParaBipagem(infoEtiqueta);
        const agora = Date.now();
        const novaBipagemRef = push(bipagemRef);
        const payloadBipagem = {
          codigo: codigoDigitado,
          codigoLimpo: infoEtiqueta.codigoLimpo || lookup.codigoNormalizado || codigoDigitado,
          plataforma: infoEtiqueta.plataforma,
          canal: infoEtiqueta.canal,
          canalNome: infoEtiqueta.canalNome,
          canalEsperado: ehfBipSession.session.channel_name,
          lojaKey: destino.lojaKey,
          lojaNome: destino.lojaNome,
          esperadoCanalLoja: destino.esperado,
          bipadoAntesCanalLoja: destino.bipado,
          restanteAntesCanalLoja: destino.restante,
          idEtiqueta: infoEtiqueta.idEtiqueta,
          codigoRastreio: infoEtiqueta.codigoRastreio,
          tipo: infoEtiqueta.tipo,
          observacao: infoEtiqueta.observacao,
          status: infoEtiqueta.status,
          operador: nomeOperadorLocal,
          coletor: ehfBipSession.session.collector_name,
          sessaoBipagemId: ehfBipSession.session.id,
          pedidoTiny: lookup.pedido?.numero || '',
          pedidoMarketplace: lookup.pedido?.numeroEcommerce || '',
          totalUnidades: Number(lookup.totalUnidades || 0),
          horario: formatHorarioBrasilia(new Date(), true),
          horarioCompleto: formatHorarioBrasilia(new Date(), true),
          ts: agora
        };
        await set(novaBipagemRef, payloadBipagem).catch(() => {});
        tocarSomConfirmacaoLeitura(data.channelMatch !== false);
        const corStatus = data.channelMatch !== false ? '#5bae5f' : '#ef4444';
        set(alertaBroadcastRef, { txt: `O operador <b>${nomeOperadorLocal}</b> bipou: <b>${payloadBipagem.lojaNome}</b> — <b>${payloadBipagem.canalEsperado}</b> <span style="color:${corStatus};">(${payloadBipagem.status})</span><br>Pedido: <b>${payloadBipagem.pedidoMarketplace || payloadBipagem.pedidoTiny || '-'}</b> · Código: <b>${payloadBipagem.idEtiqueta || payloadBipagem.codigoRastreio || codigoDigitado}</b>`, ts: agora });
        ehfBipToast(`${payloadBipagem.lojaNome} · pedido ${payloadBipagem.pedidoMarketplace || payloadBipagem.pedidoTiny || 'localizado'} · ${payloadBipagem.totalUnidades} unidade(s)`);
      } catch (error) {
        const detail = error.data?.session;
        if (detail) ehfRenderBipSession(detail);
        tocarSomConfirmacaoLeitura(false);
        ehfBipToast(error.message || 'Etiqueta não localizada.', true);
      } finally {
        if (input) { input.disabled = false; input.value = ''; input.focus(); }
      }
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
      painel.style.setProperty('display', esconderNaBipagem ? 'none' : 'flex', 'important');
      painel.style.setProperty('visibility', esconderNaBipagem ? 'hidden' : 'visible', 'important');
      painel.style.setProperty('pointer-events', esconderNaBipagem ? 'none' : 'auto', 'important');
    }

    window.ehfAtualizarVisibilidadePainelProducao = atualizarVisibilidadePainelProducao;

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
      const listaOrdenada = dados ? Object.values(dados).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0)) : [];
      ehfBipagensCache = listaOrdenada.map(b => {
        if (!b.canalNome || b.canalNome === "Desconhecido" || b.plataforma === "Desconhecida") {
          const reprocessado = identificarEtiqueta(b.codigo || b.codigoLimpo || "");
          return { ...b, plataforma: reprocessado.plataforma, canal: reprocessado.canal, canalNome: reprocessado.canalNome, idEtiqueta: b.idEtiqueta || reprocessado.idEtiqueta, codigoRastreio: b.codigoRastreio || reprocessado.codigoRastreio, status: b.status || reprocessado.status, observacao: b.observacao || reprocessado.observacao };
        }
        return b;
      });
      totalBipadosFisico = ehfBipagensCache.length;
      ehfBipagensCache.forEach(b => {
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

    function minutesToTime(totalMinutes) {
      if (!Number.isFinite(totalMinutes)) return '';
      const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
      const h = String(Math.floor(normalized / 60)).padStart(2, '0');
      const m = String(normalized % 60).padStart(2, '0');
      return `${h}:${m}`;
    }

    function normalizarHorarioHHMM(value) {
      const minutos = timeToMinutes(value);
      return minutos === null ? '' : minutesToTime(minutos);
    }

    function normalizarHorarioDigitavel(value) {
      const raw = String(value || '').trim();
      if (!raw) return { ok: true, value: '', empty: true };

      const somenteDigitos = raw.replace(/\D/g, '');

      // Aceita digitação simples: 8 => 08:00, 13 => 13:00, 930 => 09:30, 1530 => 15:30.
      if (/^\d{1,4}$/.test(somenteDigitos) && raw.replace(/\d/g, '') === '') {
        let h = 0;
        let m = 0;

        if (somenteDigitos.length <= 2) {
          h = Number(somenteDigitos);
          m = 0;
        } else if (somenteDigitos.length === 3) {
          h = Number(somenteDigitos.slice(0, 1));
          m = Number(somenteDigitos.slice(1));
        } else {
          h = Number(somenteDigitos.slice(0, 2));
          m = Number(somenteDigitos.slice(2));
        }

        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          return { ok: true, value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, empty: false };
        }

        return { ok: false, value: '', empty: false };
      }

      const normalizado = normalizarHorarioHHMM(raw);
      return normalizado ? { ok: true, value: normalizado, empty: false } : { ok: false, value: '', empty: false };
    }

    function calcularAlarmeUmaHoraAntes(horarioLimite) {
      const minutos = timeToMinutes(horarioLimite);
      if (minutos === null) return '';
      return minutesToTime(minutos - ML_ALARM_OFFSET_MINUTES);
    }

    function getHorarioAlarmeTask(task) {
      if (!task) return '';

      // Se o operador apagou manualmente o alarme, respeita vazio.
      if (task.alarmManual) {
        return normalizarHorarioHHMM(task.alarmTime || '');
      }

      return normalizarHorarioHHMM(task.alarmTime || '') || calcularAlarmeUmaHoraAntes(task.time || '') || normalizarHorarioHHMM(task.time || '');
    }

    function atualizarAlarmeAutomatico(task, force = false) {
      if (!task || task.semHorario) return false;
      const auto = calcularAlarmeUmaHoraAntes(task.time || '');
      if (!auto) return false;
      // Se está manual, inclusive manual em branco, não sobrescreve.
      if (!force && task.alarmManual) return false;
      const mudou = task.alarmTime !== auto || task.alarmOffsetMinutes !== ML_ALARM_OFFSET_MINUTES;
      task.alarmTime = auto;
      task.alarmOffsetMinutes = ML_ALARM_OFFSET_MINUTES;
      task.alarmManual = false;
      task.alarmFonte = 'AUTO_ML_MENOS_1H';
      return mudou;
    }

    function aplicarHorarioLimiteTask(task, horario, origem = 'manual', options = {}) {
      if (!task || task.semHorario) return false;
      const normalizado = normalizarHorarioHHMM(horario);
      if (!normalizado) return false;

      const manual = origem === 'manual';
      if (!manual && task.deadlineManual && !options.force) return false;

      const mudou = task.time !== normalizado;
      task.time = normalizado;
      task.mlDeadlineTime = origem === 'mercado_livre' ? normalizado : (task.mlDeadlineTime || '');
      if (manual) task.deadlineManual = true;
      else task.deadlineManual = false;

      const mudouAlarme = atualizarAlarmeAutomatico(task, !!options.forceAlarm);
      if (mudou || mudouAlarme) limparAlarmeTask(task.id);
      return mudou || mudouAlarme;
    }

    function menorHorarioValido(horarios) {
      const minutos = (horarios || [])
        .map(timeToMinutes)
        .filter(v => v !== null)
        .sort((a, b) => a - b);
      return minutos.length ? minutesToTime(minutos[0]) : '';
    }

    function extrairHorarioCampo(obj, campos) {
      for (const campo of campos) {
        const valor = campo.split('.').reduce((acc, key) => acc && acc[key] !== undefined ? acc[key] : undefined, obj);
        const horario = normalizarHorarioHHMM(valor);
        if (horario) return horario;
      }
      return '';
    }

    function extrairHorarioModoML(account, modo) {
      const hoje = account?.enviosHoje || account?.today || account?.tabToday || account?.TAB_TODAY || {};
      const bloco = hoje?.[modo] || hoje?.[String(modo || '').toUpperCase()] || account?.[modo] || {};
      return extrairHorarioCampo(bloco, ['cutoff', 'cutoffTime', 'deadline', 'deadlineTime', 'horario', 'time', 'until', 'limite', 'horarioLimite']) ||
        extrairHorarioCampo(account, modo === 'coleta'
          ? ['cutoff', 'cutoffTime', 'coleta.cutoff', 'coleta.cutoffTime', 'agencyCutoff', 'horarioColeta', 'horarioLimite']
          : ['flex.cutoff', 'flex.cutoffTime', 'flexDeadline', 'horarioFlex']);
    }

    function aplicarAlarmesDoMercadoLivre(data) {
      const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
      if (!accounts.length) return false;

      const mapContaTask = {
        comercio: 'comercio',
        ehf_comercio: 'comercio',
        suprimentos: 'suprimentos',
        ehf_suprimentos: 'suprimentos',
        distribuidora: 'distribuidora',
        ehf_distribuidora: 'distribuidora',
        ekn: 'ekn'
      };

      let mudou = false;
      const horariosColeta = [];
      const horariosFlex = [];

      accounts.forEach(account => {
        const rawKey = String(account?.key || account?.account || account?.id || account?.label || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const taskId = mapContaTask[rawKey] || mapContaTask[rawKey.replace(/^ehf_/, '')];
        const horarioColeta = extrairHorarioModoML(account, 'coleta');
        const horarioFlex = extrairHorarioModoML(account, 'flex');

        if (horarioColeta) horariosColeta.push(horarioColeta);
        if (horarioFlex) horariosFlex.push(horarioFlex);

        if (taskId && horarioColeta) {
          const task = getTaskById(taskId);
          mudou = aplicarHorarioLimiteTask(task, horarioColeta, 'mercado_livre') || mudou;
        }
      });

      const coletaMaster = getTaskById('mercado_envios_coleta');
      const horarioColetaMaster = menorHorarioValido(horariosColeta);
      if (horarioColetaMaster) mudou = aplicarHorarioLimiteTask(coletaMaster, horarioColetaMaster, 'mercado_livre') || mudou;

      const flexMaster = getTaskById('mercado_envios_flex');
      const horarioFlexMaster = menorHorarioValido(horariosFlex);
      if (horarioFlexMaster) mudou = aplicarHorarioLimiteTask(flexMaster, horarioFlexMaster, 'mercado_livre') || mudou;

      ['mercado_livre_remessa_1', 'mercado_livre_remessa_2', 'shopee_remessa_1', 'shopee_remessa_2'].forEach(id => {
        const task = getTaskById(id);
        if (task && task.time && !task.alarmManual) mudou = atualizarAlarmeAutomatico(task, false) || mudou;
      });

      if (mudou) {
        renderEstructuralHTML();
        pushStateToFirebase();
        verificarAlarmesDePrazo();
      }

      return mudou;
    }

    window.ehfAplicarAlarmesDoMercadoLivre = aplicarAlarmesDoMercadoLivre;

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

        const alarmeMinutos = timeToMinutes(getHorarioAlarmeTask(t));
        if (alarmeMinutos === null) return false;
        if (minutosAgora < alarmeMinutos) return false;

        const estado = alarmState[t.id] || {};
        if (estado.snoozeUntil && agoraMs < estado.snoozeUntil) return false;

        // Evita tocar repetido caso a tela verifique muitas vezes em sequência.
        if (estado.lastAlarmAt && agoraMs - estado.lastAlarmAt < 60 * 1000) return false;

        return true;
      });

      if (!atrasada) return;

      alarmState[atrasada.id] = alarmState[atrasada.id] || {};
      alarmState[atrasada.id].lastAlarmAt = agoraMs;

      const horarioAlarme = getHorarioAlarmeTask(atrasada);
      const limiteMinutos = timeToMinutes(atrasada.time);
      const prazoVencido = limiteMinutos !== null && minutosAgora >= limiteMinutos;
      executarAlarmeVisualESonoroLocal(
        `${prazoVencido ? 'Prazo vencido' : 'Alarme de saída'}: <b>${atrasada.name}</b>. Alarme programado para <b>${horarioAlarme || '--:--'}</b>${atrasada.time ? `, prazo limite <b>${atrasada.time}</b>` : ''}. Ainda não foi marcado como Coletado ou Enviado.`,
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
      const horarioPadrao = config.defaultTime || '';
      return {
        id: config.id,
        name: config.name,
        time: horarioPadrao,
        alarmTime: calcularAlarmeUmaHoraAntes(horarioPadrao),
        alarmManual: false,
        deadlineManual: false,
        alarmOffsetMinutes: ML_ALARM_OFFSET_MINUTES,
        mlDeadlineTime: '',
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

        if (!task.alarmManual && !task.alarmTime && task.time) {
          atualizarAlarmeAutomatico(task, true);
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

      const inputAlarm = document.getElementById(`alarm-${taskId}`);
      if (inputAlarm) task.alarmTime = inputAlarm.value || '';
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

        aplicarHorarioLimiteTask(task, horario || '', 'manual', { forceAlarm: false });
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
      ehfGarantirVisualControle42120();
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

              aplicarHorarioLimiteTask(t, horario, 'manual', { forceAlarm: false });

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

          ehfGarantirEstiloAlarmesML();

          if (timeInput) {
            // v4.2.10: o prazo ML continua salvo internamente em t.time e alimentado pelo Mercado Livre,
            // mas não é mais exibido/editado no painel. O operador vê e edita somente o horário do alarme.
            const alarmWrap = document.createElement('span');
            alarmWrap.className = 'cp-time-block alarm only-alarm';
            const alarmLabel = document.createElement('small');
            alarmLabel.textContent = 'Alarme';
            const alarmInput = document.createElement('input');
            alarmInput.type = 'text';
            alarmInput.inputMode = 'numeric';
            alarmInput.autocomplete = 'off';
            alarmInput.placeholder = '--:--';
            alarmInput.maxLength = 5;
            // Manual em branco deve aparecer em branco; automático aparece calculado.
            alarmInput.value = t.alarmManual ? (t.alarmTime || '') : getHorarioAlarmeTask(t);
            alarmInput.id = `alarm-${t.id}`;
            let alarmSaveTimer = null;

            function salvarDigitacaoAlarme(renderDepois = false) {
              const raw = alarmInput.value || '';
              const parsed = normalizarHorarioDigitavel(raw);
              if (!parsed.ok) {
                alarmInput.classList.add('input-invalid');
                return false;
              }

              alarmInput.classList.remove('input-invalid');
              const valorFinal = parsed.value;
              const mudou = (t.alarmTime || '') !== valorFinal || !t.alarmManual;
              t.alarmTime = valorFinal;
              t.alarmManual = true;
              t.alarmFonte = valorFinal ? 'MANUAL' : 'MANUAL_VAZIO';
              if (!valorFinal) t.alarmOffsetMinutes = 0;
              limparAlarmeTask(t.id);

              if (valorFinal && raw !== valorFinal && (raw.length >= 3 || renderDepois)) {
                alarmInput.value = valorFinal;
              }

              if (mudou) {
                pushStateToFirebase();
                verificarAlarmesDePrazo();
              }

              return true;
            }

            alarmInput.addEventListener('input', () => {
              const raw = alarmInput.value || '';

              // Permite apagar e salvar vazio imediatamente.
              if (!raw.trim()) {
                if (alarmSaveTimer) clearTimeout(alarmSaveTimer);
                alarmInput.classList.remove('input-invalid');
                salvarDigitacaoAlarme(false);
                return;
              }

              // Quando digita 930 ou 1530, salva automaticamente sem precisar sair do campo.
              if (alarmSaveTimer) clearTimeout(alarmSaveTimer);
              const onlyDigits = raw.replace(/\D/g, '');
              const delay = onlyDigits.length >= 3 || raw.includes(':') ? 350 : 900;
              alarmSaveTimer = setTimeout(() => salvarDigitacaoAlarme(false), delay);
            });

            alarmInput.addEventListener('blur', () => {
              if (alarmSaveTimer) clearTimeout(alarmSaveTimer);
              const ok = salvarDigitacaoAlarme(true);
              if (ok) renderEstructuralHTML();
            });

            alarmInput.addEventListener('keydown', (ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault();
                if (alarmSaveTimer) clearTimeout(alarmSaveTimer);
                const ok = salvarDigitacaoAlarme(true);
                if (ok) renderEstructuralHTML();
              }
            });
            alarmWrap.appendChild(alarmLabel);
            alarmWrap.appendChild(alarmInput);
            controls.appendChild(alarmWrap);

            const autoBtn = document.createElement('button');
            autoBtn.type = 'button';
            autoBtn.className = 'cp-auto-alarm-btn';
            autoBtn.textContent = 'Auto -1h';
            autoBtn.title = t.time ? `Usar uma hora antes do prazo do Mercado Livre (${t.time})` : 'Prazo Mercado Livre ainda não carregado';
            autoBtn.disabled = !t.time;
            autoBtn.addEventListener('click', () => {
              t.alarmManual = false;
              atualizarAlarmeAutomatico(t, true);
              limparAlarmeTask(t.id);
              renderEstructuralHTML();
              pushStateToFirebase();
              verificarAlarmesDePrazo();
            });
            controls.appendChild(autoBtn);
          } else if (timePlaceholder) {
            controls.appendChild(timePlaceholder);
          }

          controls.appendChild(labelCo);
          controls.appendChild(labelEn);
          controls.appendChild(labelFi);

          li.appendChild(nameDiv);
          li.appendChild(controls);

          // v4.2.10: removido texto lateral de prazo/alarme/manual para deixar cada linha limpa.

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
          alarmTime: t.alarmTime || '',
          alarmManual: !!t.alarmManual,
          deadlineManual: !!t.deadlineManual,
          alarmOffsetMinutes: Number(t.alarmOffsetMinutes || ML_ALARM_OFFSET_MINUTES),
          mlDeadlineTime: t.mlDeadlineTime || '',
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
            alarmTime: salvo ? (salvo.alarmManual ? (salvo.alarmTime || '') : (salvo.alarmTime || calcularAlarmeUmaHoraAntes(salvo.time || config.defaultTime || ''))) : calcularAlarmeUmaHoraAntes(config.defaultTime || ''),
            alarmManual: salvo ? !!salvo.alarmManual : false,
            deadlineManual: salvo ? !!salvo.deadlineManual : false,
            alarmOffsetMinutes: salvo ? Number(salvo.alarmOffsetMinutes || ML_ALARM_OFFSET_MINUTES) : ML_ALARM_OFFSET_MINUTES,
            mlDeadlineTime: salvo ? (salvo.mlDeadlineTime || '') : '',
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
          aplicarHorarioLimiteTask(x, t, 'manual', { forceAlarm: false });
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
  

/* ========== V3.3.1 — HORÁRIOS E CONTAGEM EXATA DO MERCADO LIVRE ========== */
(function(){
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"}[char]));
  const base=String(window.EHF_API_BASE||'https://atendente-vesco-separacao.2cwhzy.easypanel.host').replace(/\/+$/,'');
  let loading=false;

  function fmtTime(value){
    const text=String(value||'').trim();
    return /^\d{1,2}:\d{2}$/.test(text)?text.padStart(5,'0'):'Não disponível no retorno';
  }

  function modeDisplay(mode){
    const verified=Boolean(mode?.countVerified)&&mode?.totalPackages!==null&&mode?.totalPackages!==undefined;
    const delayed=Number(mode?.delayedPackages||mode?.delayedOrders||0);
    const observed=Number(mode?.observedPackages||mode?.enumeratedPackages||0);
    return {
      verified,
      value:verified?String(Number(mode.totalPackages||0)):'—',
      delayed,
      observed
    };
  }

  function pickTodayMode(account, key){
    const today=account?.enviosHoje||account?.today||account?.tabToday||account?.TAB_TODAY||{};
    const direct=today?.[key]||today?.[key.toUpperCase?.()]||null;
    return direct||account?.[key]||{};
  }

  function renderAccount(account){
    const flex=pickTodayMode(account,'flex');
    const coleta=pickTodayMode(account,'coleta');
    const entrega=pickTodayMode(account,'entregaPorConta');
    const devolucoes=pickTodayMode(account,'devolucoes');
    const flexView=modeDisplay(flex);
    const coletaView=modeDisplay(coleta);
    const entregaView=modeDisplay(entrega);
    const devolucoesView=modeDisplay(devolucoes);
    const hasExtra=(entregaView.verified&&Number(entrega.totalPackages||0)>0)||(devolucoesView.verified&&Number(devolucoes.totalPackages||0)>0);
    const complete=Boolean(account.complete&&flexView.verified&&coletaView.verified);
    const cutoff=fmtTime(account.cutoff);
    return `<article class="ml-account-card">
      <div class="ml-account-title"><b>${esc(account.label||account.key)}</b><span class="${complete?'ok':'warn'}">${complete?'LEITURA COMPLETA':'VERIFICAR'}</span></div>
      <div class="ml-cutoff"><small>Agência / Coleta até</small><strong class="${cutoff==='Não identificado'?'missing':''}">${esc(cutoff)}</strong></div>
      <div class="ml-mode-grid">
        <div class="ml-mode"><label>Flex</label><b>${flexView.value}</b><em>${flexView.delayed} atrasado(s)</em>${flexView.verified?'':`<small class="ml-count-pending">contador pendente · ${flexView.observed} registro(s) lido(s)</small>`}</div>
        <div class="ml-mode"><label>Agência / Coleta</label><b>${coletaView.value}</b><em>${coletaView.delayed} atrasado(s)</em>${coletaView.verified?'':`<small class="ml-count-pending">contador pendente · ${coletaView.observed} registro(s) lido(s)</small>`}</div>
        ${hasExtra?`<div class="ml-mode"><label>Entrega por sua conta</label><b>${entregaView.value}</b><em class="warn">${entregaView.delayed} pendência(s)</em></div><div class="ml-mode"><label>Devoluções</label><b>${devolucoesView.value}</b><em class="warn">${devolucoesView.delayed} pendência(s)</em></div>`:''}
      </div>
    </article>`;
  }

  async function load(force=false){
    if(loading)return;
    const root=document.getElementById('ml-deadline-summary');
    if(!root)return;
    loading=true;
    const status=document.getElementById('ml-deadline-status');
    const badge=document.getElementById('ml-deadline-source');
    const button=document.getElementById('btn-refresh-ml-deadlines');
    if(button)button.disabled=true;
    try{
      if(!force){
        try{
          const syncResponse=await fetch(base+'/api/sync/status?ts='+Date.now(),{cache:'no-store'});
          const syncData=await syncResponse.json();
          if(syncData?.running?.ml){
            status.textContent='Mercado Livre em processamento paralelo. Os totais atuais serão substituídos juntos quando todas as contas terminarem.';
            status.className='ml-deadline-status warn';
            badge.textContent='PROCESSANDO';
            badge.className='ml-source-badge warn';
            return;
          }
        }catch(_){ }
      }
      if(force){
        const headers={'Content-Type':'application/json'};
        const apiKey=localStorage.getItem('ehf_api_key')||'';
        if(apiKey)headers['x-api-key']=apiKey;
        const start=await fetch(base+'/api/sync/mercadolivre',{method:'POST',headers});
        if(!start.ok&&start.status!==409)throw new Error('Não foi possível iniciar a leitura do Mercado Livre.');
        status.textContent='Leitura iniciada. Atualizando todas as páginas dos cartões...';
        status.className='ml-deadline-status warn';
        const deadline=Date.now()+180000;
        while(Date.now()<deadline){
          await new Promise(resolve=>setTimeout(resolve,1500));
          try{
            const syncResponse=await fetch(base+'/api/sync/status?ts='+Date.now(),{cache:'no-store'});
            const syncData=await syncResponse.json();
            if(!syncData?.running?.ml)break;
          }catch(_){break;}
        }
      }
      const response=await fetch(base+'/api/mercadolivre/horarios?ts='+Date.now(),{cache:'no-store'});
      const data=await response.json();
      if(!response.ok||!data?.ok)throw new Error(data?.error||'Falha ao consultar horários.');
      if (typeof window.ehfAplicarAlarmesDoMercadoLivre === 'function') {
        window.ehfAplicarAlarmesDoMercadoLivre(data);
      }
      root.innerHTML=(data.accounts||[]).filter(account=>account.configured).map(renderAccount).join('')||'<div class="ml-deadline-loading">Nenhuma conta do Mercado Livre configurada.</div>';
      const configured=(data.accounts||[]).filter(a=>a.configured);
      const exact=Boolean(data.complete)&&configured.length>0&&configured.every(a=>a.complete&&a.flex?.countVerified&&a.coleta?.countVerified);
      badge.textContent=exact?'CONTAGEM EXATA':'LEITURA PARCIAL';
      badge.className='ml-source-badge '+(exact?'ok':'warn');
      status.textContent=exact
        ? `Leitura direta concluída: ${Number(data.totals?.packages||0)} pacote(s), sendo ${Number(data.totals?.flex||0)} Flex e ${Number(data.totals?.coleta||0)} Agência/Coleta. Atualizado em ${data.updatedAt?new Date(data.updatedAt).toLocaleTimeString('pt-BR'):'--'}.`
        : 'Uma ou mais filas não confirmou o contador de pacotes. Para evitar número incorreto, o painel mostra “—” até validar Pack ID, shipment ou o contador específico do cartão.';
      status.className='ml-deadline-status '+(exact?'':'warn');
    }catch(error){
      root.innerHTML='<div class="ml-deadline-loading">Não foi possível carregar o painel do Mercado Livre.</div>';
      badge.textContent='ERRO DE LEITURA';badge.className='ml-source-badge warn';
      status.textContent=error.message||String(error);status.className='ml-deadline-status error';
    }finally{
      loading=false;
      if(button)button.disabled=false;
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('btn-refresh-ml-deadlines')?.addEventListener('click',()=>load(true));
    load(false);
    setInterval(()=>load(false),60000);
  });
  window.ehfAtualizarHorariosMercadoLivre=load;
})();
