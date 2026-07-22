<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Dashboard de Separação — EHF</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <script>
    // 🌟 MAPEAMENTO CORRETO
    const ID_MAPPINGS = {
      "769570519": "Mercado Envios", "778029845": "Shopee Envios", "780391986": "Mercado Envios Flex",
      "778034480": "Shopee Envios", "772849381": "Mercado Envios", "780375701": "Mercado Envios Flex",
      "853036097": "Magalu Entregas", "778095610": "Shopee Envios", "847199235": "Amazon DBA",
      "849173976": "Amazon DBA", "854284026": "TikTok Shipping", "854064525": "Amazon DBA"
    };

    function translateChannelName(rawName) { return ID_MAPPINGS[rawName] || rawName; }

    function buildRealTimeDetails(storeKey, storeData) {
      const container = document.getElementById(`container-${storeKey}`);
      if (!container) return; container.innerHTML = '';
      
      // 🌟 CONVERSÃO DE SEGURANÇA PARA O JSON
      let mapaSituacoes = {};
      try {
        if (typeof storeData.situacaoEnvioCounts === 'string') {
          mapaSituacoes = JSON.parse(storeData.situacaoEnvioCounts);
        } else {
          mapaSituacoes = storeData.situacaoEnvioCounts || {};
        }
      } catch(e) { return; }

      // Renderiza as situações que vierem da planilha
      Object.keys(mapaSituacoes).forEach(situacao => {
        if (Object.keys(mapaSituacoes[situacao]).length > 0) {
            renderSituacaoGroup(container, situacao.toUpperCase(), mapaSituacoes[situacao]);
        }
      });
    }

    function renderSituacaoGroup(container, titulo, dadosObjeto) {
      container.innerHTML += `<div class="status-group-title">${titulo}</div>`;
      const ul = document.createElement('ul'); ul.className = 'channel-badge-list';
      Object.entries(dadosObjeto).forEach(([id, qtd]) => {
        ul.innerHTML += `<li class="channel-badge-item"><span>${translateChannelName(id)}</span><span class="channel-val">${qtd}</span></li>`;
      });
      container.appendChild(ul);
    }
  </script>
</body>
</html>
