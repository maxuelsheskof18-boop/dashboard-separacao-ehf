// Dashboard de Separação EHF — servidor Node 18+
// Proxy do Google Apps Script + integração direta com a API 2.0 do Tiny/Olist.

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORTS = [
  process.env.PORT ? Number(process.env.PORT) : undefined,
  3000,
  3001,
  3002,
  4000,
  5000
].filter(Boolean);

const WEB_APP_URL =
  process.env.WEB_APP_URL ||
  process.env.GOOGLE_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzvgtteSSSEsJrR5WoYX6tymQYhuVKmWCkYTYVYWsaKzal9NuzJJZZSZoEbu_CFSVSm/exec';

const API_BASE = process.env.TINY_API_BASE || 'https://api.tiny.com.br/api2';
const APP_DIR = __dirname;
const MARKERS_FILE = path.join(APP_DIR, 'marcadores.json');

const ACCOUNTS = {
  comercio: {
    key: 'comercio',
    nome: 'EHF Comércio',
    token: process.env.TINY_TOKEN_COMERCIO || ''
  },
  suprimentos: {
    key: 'suprimentos',
    nome: 'EHF Suprimentos',
    token: process.env.TINY_TOKEN_SUPRIMENTOS || ''
  },
  ekn: {
    key: 'ekn',
    nome: 'EKN',
    token: process.env.TINY_TOKEN_EKN || ''
  },
  distribuidora: {
    key: 'distribuidora',
    nome: 'EHF Distribuidora',
    token: process.env.TINY_TOKEN_DISTRIBUIDORA || ''
  }
};

const cache = new Map();

function getCached(key, ttlMs) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value) {
  cache.set(key, { ts: Date.now(), value });
  return value;
}

async function cached(key, ttlMs, loader) {
  const hit = getCached(key, ttlMs);
  if (hit !== null) return hit;
  const value = await loader();
  return setCached(key, value);
}

function sendJson(res, obj, code = 200) {
  const body = JSON.stringify(obj);
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function sendText(res, text, code = 200, contentType = 'text/plain; charset=utf-8') {
  res.statusCode = code;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.end(text);
}

function sendError(res, message, code = 500, details = undefined) {
  sendJson(res, { ok: false, error: message, details }, code);
}

async function fetchText(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, { ...opts, signal: controller.signal });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    return { ok: response.ok, status: response.status, text, json };
  } finally {
    clearTimeout(timer);
  }
}

function tinyError(retorno) {
  if (!retorno) return null;
  if (retorno.status === 'Erro' || String(retorno.status_processamento) === '1') {
    const mensagens = Array.isArray(retorno.erros)
      ? retorno.erros.map(item => item?.erro || item).filter(Boolean)
      : [];
    return {
      codigo: retorno.codigo_erro,
      mensagem: mensagens.join(' | ') || 'Erro retornado pelo Tiny',
      raw: retorno
    };
  }
  return null;
}

async function tinyCall(token, endpoint, params = {}) {
  if (!token) throw new Error('Token do Tiny não configurado');
  const body = new URLSearchParams({
    token,
    formato: 'JSON',
    ...Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    )
  });

  const response = await fetchText(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Tiny HTTP ${response.status}: ${response.text.slice(0, 300)}`);
  }
  if (!response.json) {
    throw new Error(`Tiny retornou conteúdo inválido em ${endpoint}`);
  }

  const retorno = response.json.retorno || response.json;
  const err = tinyError(retorno);
  if (err) {
    // Código 20 normalmente significa consulta sem registros e não é falha operacional.
    if (String(err.codigo) === '20') return { retorno, vazio: true };
    const e = new Error(err.mensagem);
    e.tiny = err;
    throw e;
  }

  return { retorno, vazio: false };
}

function unwrapList(value, wrapperKey) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map(item => item?.[wrapperKey] || item).filter(Boolean);
}

function totalPages(retorno) {
  return Number(
    retorno?.numero_paginas ??
    retorno?.total_paginas ??
    retorno?.paginacao?.total_paginas ??
    retorno?.paginacao?.totalPaginas ??
    1
  ) || 1;
}

async function pesquisarSeparacoesForToken(token, filtros = {}) {
  const acumulado = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { retorno, vazio } = await tinyCall(token, 'separacao.pesquisa.php', { ...filtros, pagina });
    if (vazio) break;
    const lista = unwrapList(
      retorno?.separacoes || retorno?.separacao || retorno?.lista || retorno?.itens,
      'separacao'
    );
    acumulado.push(...lista);
    if (pagina >= totalPages(retorno)) break;
  }
  return acumulado;
}

async function pesquisarPedidosForToken(token, filtros = {}) {
  const acumulado = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { retorno, vazio } = await tinyCall(token, 'pedidos.pesquisa.php', { ...filtros, pagina });
    if (vazio) break;
    const lista = unwrapList(retorno?.pedidos || retorno?.pedido, 'pedido');
    acumulado.push(...lista);
    if (pagina >= totalPages(retorno)) break;
  }
  return acumulado;
}

async function obterSeparacao(token, idSeparacao) {
  const { retorno } = await tinyCall(token, 'separacao.obter.php', { idSeparacao });
  return retorno?.separacao || retorno;
}

async function obterPedido(token, id) {
  const key = `pedido:${token.slice(-8)}:${id}`;
  return cached(key, 10 * 60 * 1000, async () => {
    const { retorno } = await tinyCall(token, 'pedido.obter.php', { id });
    return retorno?.pedido || retorno;
  });
}

function parseTinyDate(text) {
  const match = String(text || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return new Date(`${match[3]}-${match[2]}-${match[1]}T12:00:00-03:00`);
}

function formatTinyDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function todaySaoPaulo() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function earliestDateFromSeparations(separacoes) {
  const datas = separacoes
    .map(s => parseTinyDate(s.dataEmissao || s.dataCriacao))
    .filter(Boolean)
    .sort((a, b) => a - b);
  const fallback = todaySaoPaulo();
  fallback.setDate(fallback.getDate() - 45);
  const earliest = datas[0] || fallback;
  earliest.setDate(earliest.getDate() - 1);
  return earliest;
}

function normalizeCode(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function valuesForOrder(order) {
  return [
    order?.id,
    order?.numero,
    order?.numero_ecommerce,
    order?.numeroPedidoEcommerce,
    order?.codigo_rastreamento,
    order?.ecommerce?.numeroPedidoEcommerce,
    order?.ecommerce?.numeroPedidoCanalVenda
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== '');
}

function valuesForSeparation(sep) {
  return [
    sep?.id,
    sep?.idOrigem,
    sep?.idOrigemVinc,
    sep?.numero,
    sep?.numeroPedidoEcommerce
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== '');
}

function separationMatchesOrder(sep, order) {
  const a = new Set(valuesForSeparation(sep).map(normalizeCode));
  return valuesForOrder(order).some(v => a.has(normalizeCode(v)));
}

function extractMarkers(order) {
  return unwrapList(order?.marcadores, 'marcador').map(m => ({
    id: String(m?.id ?? ''),
    descricao: String(m?.descricao ?? ''),
    cor: String(m?.cor ?? '')
  }));
}

function statusKey(situacao) {
  switch (Number(situacao)) {
    case 1: return 'aguardando';
    case 2: return 'separadas';
    case 3: return 'embaladas';
    case 4: return 'emSeparacao';
    default: return 'aguardando';
  }
}

function statusLabel(situacao) {
  switch (Number(situacao)) {
    case 1: return 'Aguardando separação';
    case 2: return 'Separada';
    case 3: return 'Embalada / Checkout';
    case 4: return 'Em separação';
    default: return 'Desconhecida';
  }
}

function emptyStoreSummary() {
  return { aguardando: 0, emSeparacao: 0, separadas: 0, embaladas: 0, total: 0 };
}

function emptyShippingCounts() {
  return { aguardando: {}, emSeparacao: {}, separadas: {}, embaladas: {} };
}

function buildMarkerSummary(resultsByAccount, marker) {
  const perStore = {};
  const formasEnvio = {};
  const pedidos = [];
  const totals = { aguardando: 0, emSeparacao: 0, separadas: 0, embaladas: 0 };
  const errors = {};

  for (const result of resultsByAccount) {
    const { account, matches, error } = result;
    perStore[account.key] = emptyStoreSummary();
    formasEnvio[account.key] = emptyShippingCounts();

    if (error) {
      errors[account.key] = error;
      continue;
    }

    for (const match of matches) {
      const sep = match.separacao;
      const order = match.pedido || {};
      const key = statusKey(sep.situacao);
      totals[key] += 1;
      perStore[account.key][key] += 1;
      perStore[account.key].total += 1;

      const idForma = String(sep.idFormaEnvio || '0');
      formasEnvio[account.key][key][idForma] = (formasEnvio[account.key][key][idForma] || 0) + 1;

      pedidos.push({
        lojaKey: account.key,
        lojaNome: account.nome,
        separacaoId: sep.id,
        pedidoId: order.id || sep.idOrigemVinc || sep.idOrigem,
        numero: order.numero || sep.numero,
        numeroEcommerce: order.numero_ecommerce || order.ecommerce?.numeroPedidoEcommerce || sep.numeroPedidoEcommerce || '',
        cliente: order.nome || order.cliente?.nome || sep.destinatario || '',
        situacao: Number(sep.situacao || 0),
        situacaoTexto: statusLabel(sep.situacao),
        idFormaEnvio: sep.idFormaEnvio || '',
        codigoRastreamento: order.codigo_rastreamento || '',
        marcador: marker,
        marcadores: match.marcadores || []
      });
    }
  }

  pedidos.sort((a, b) => String(a.lojaNome).localeCompare(String(b.lojaNome), 'pt-BR') || String(a.numero).localeCompare(String(b.numero), 'pt-BR'));

  return {
    ok: true,
    ts: new Date().toISOString(),
    filtro: marker,
    ...totals,
    overall: { totalItens: pedidos.length },
    perStore,
    formasEnvio,
    pedidos,
    errors
  };
}

async function getCurrentSeparations(account) {
  return cached(`separacoes:${account.key}`, 45 * 1000, () => pesquisarSeparacoesForToken(account.token));
}

async function filterAccountByMarker(account, markerId, markerName) {
  if (!account.token) {
    return { account, matches: [], error: 'Token do Tiny não configurado para esta loja.' };
  }

  try {
    const separacoes = await getCurrentSeparations(account);
    let matches = [];

    if (String(markerId) === '1') {
      // O endpoint de pesquisa não possui filtro nativo "sem marcadores".
      // Neste caso, conferimos os pedidos atualmente na separação e usamos cache.
      const concurrency = 6;
      let cursor = 0;
      const found = [];

      async function worker() {
        while (cursor < separacoes.length) {
          const sep = separacoes[cursor++];
          const orderId = sep.idOrigemVinc || sep.idOrigem;
          if (!orderId) continue;
          try {
            const order = await obterPedido(account.token, orderId);
            const markers = extractMarkers(order);
            if (markers.length === 0) found.push({ separacao: sep, pedido: order, marcadores: [] });
          } catch (_) {}
        }
      }

      await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(separacoes.length, 1)) }, worker));
      matches = found;
    } else {
      const dataInicial = formatTinyDate(earliestDateFromSeparations(separacoes));
      const pedidosMarcados = await pesquisarPedidosForToken(account.token, {
        marcador: markerName,
        dataInicial
      });

      const matchedSeparations = new Set();
      for (const order of pedidosMarcados) {
        const sep = separacoes.find(s => separationMatchesOrder(s, order));
        if (!sep || matchedSeparations.has(String(sep.id))) continue;
        matchedSeparations.add(String(sep.id));
        matches.push({ separacao: sep, pedido: order, marcadores: [{ id: markerId, descricao: markerName }] });
      }
    }

    return { account, matches };
  } catch (error) {
    return {
      account,
      matches: [],
      error: error?.tiny?.mensagem || error.message || String(error)
    };
  }
}

function loadMarkers() {
  try {
    return JSON.parse(fs.readFileSync(MARKERS_FILE, 'utf8'));
  } catch (_) {
    return [{ id: '0', nome: 'Sem filtro por marcador' }, { id: '1', nome: 'Sem marcadores' }];
  }
}

async function handleMarkers(req, res) {
  return sendJson(res, { ok: true, marcadores: loadMarkers() });
}

async function handleMarkerSeparations(req, res, urlObj) {
  const markerId = String(urlObj.searchParams.get('marcadorId') || '');
  const markerName = String(urlObj.searchParams.get('marcador') || '').trim();
  if (!markerId || markerId === '0') {
    return sendError(res, 'Selecione um marcador.', 400);
  }
  if (!markerName && markerId !== '1') {
    return sendError(res, 'Descrição do marcador não informada.', 400);
  }

  const accounts = Object.values(ACCOUNTS);
  const results = await Promise.all(accounts.map(account => filterAccountByMarker(account, markerId, markerName)));
  return sendJson(res, buildMarkerSummary(results, { id: markerId, nome: markerName || 'Sem marcadores' }));
}

function extractScanCandidates(raw) {
  const original = String(raw || '').trim();
  const candidates = new Set();
  const add = value => {
    const text = String(value || '').trim();
    if (!text) return;
    candidates.add(text);
    candidates.add(normalizeCode(text));
  };

  add(original);
  try {
    const decoded = decodeURIComponent(original);
    add(decoded);
  } catch (_) {}

  const regexes = [
    /\bTBR\d+\b/gi,
    /\bBR\d{10,}[A-Z]\b/gi,
    /\b999\d{12,}\b/g,
    /\b47\d{9,}\b/g,
    /(?:sender[_-]?id|hash[_-]?code|tag[_-]?code|external[_-]?grouper[_-]?code|external[_-]?code|shipment[_-]?id|order[_-]?id)[^A-Z0-9-]*([A-Z0-9-]{6,})/gi,
    /\b[A-Z0-9-]{8,}\b/gi
  ];
  for (const regex of regexes) {
    for (const match of original.matchAll(regex)) add(match[1] || match[0]);
  }

  return [...candidates].filter(Boolean);
}

async function getRecentOrders(account, separacoes) {
  const start = formatTinyDate(earliestDateFromSeparations(separacoes));
  const end = formatTinyDate(todaySaoPaulo());
  return cached(`recent-orders:${account.key}:${start}:${end}`, 3 * 60 * 1000, () =>
    pesquisarPedidosForToken(account.token, { dataInicial: start, dataFinal: end })
  );
}

function matchCandidate(candidateSet, values) {
  return values.some(value => candidateSet.has(normalizeCode(value)));
}

async function lookupInAccount(account, rawCode) {
  if (!account.token) return { account, error: 'Token não configurado' };

  const separacoes = await getCurrentSeparations(account);
  const candidateSet = new Set(extractScanCandidates(rawCode).map(normalizeCode).filter(Boolean));
  if (candidateSet.size === 0) return { account, error: 'Código vazio' };

  let selectedSep = separacoes.find(sep => matchCandidate(candidateSet, valuesForSeparation(sep)));
  let selectedOrder = null;

  if (!selectedSep) {
    const recentOrders = await getRecentOrders(account, separacoes);
    selectedOrder = recentOrders.find(order => matchCandidate(candidateSet, valuesForOrder(order)));
    if (selectedOrder) selectedSep = separacoes.find(sep => separationMatchesOrder(sep, selectedOrder));
  }

  if (!selectedSep) return { account, notFound: true };

  const orderId = selectedOrder?.id || selectedSep.idOrigemVinc || selectedSep.idOrigem;
  if (!orderId) return { account, error: 'Separação localizada, mas sem ID do pedido vinculado.' };

  const [pedido, separacao] = await Promise.all([
    obterPedido(account.token, orderId),
    obterSeparacao(account.token, selectedSep.id)
  ]);

  return { account, pedido, separacao: separacao || selectedSep };
}

function normalizeOrderItems(pedido, separacao) {
  const sepItems = unwrapList(separacao?.itens, 'item');
  const orderItems = unwrapList(pedido?.itens, 'item');
  const source = sepItems.length ? sepItems : orderItems;
  return source.map((item, index) => ({
    index: index + 1,
    idProduto: String(item.idProduto ?? item.id_produto ?? ''),
    codigo: String(item.codigo ?? ''),
    descricao: String(item.descricao ?? ''),
    quantidade: Number(item.quantidade ?? 0),
    unidade: String(item.unidade ?? ''),
    localizacao: String(item.localizacao ?? ''),
    infoAdicional: String(item.infoAdicional ?? item.info_adicional ?? '')
  }));
}

function normalizePackagingResult(result, scannedCode) {
  const { account, pedido, separacao } = result;
  const marcadores = extractMarkers(pedido);
  const itens = normalizeOrderItems(pedido, separacao);
  return {
    ok: true,
    codigoLido: scannedCode,
    lojaKey: account.key,
    lojaNome: account.nome,
    pedido: {
      id: String(pedido?.id ?? separacao?.idOrigemVinc ?? separacao?.idOrigem ?? ''),
      numero: String(pedido?.numero ?? separacao?.numero ?? ''),
      numeroEcommerce: String(
        pedido?.numero_ecommerce ??
        pedido?.ecommerce?.numeroPedidoEcommerce ??
        pedido?.ecommerce?.numeroPedidoCanalVenda ??
        separacao?.numeroPedidoEcommerce ??
        ''
      ),
      cliente: String(pedido?.cliente?.nome ?? separacao?.destinatario ?? ''),
      codigoRastreamento: String(pedido?.codigo_rastreamento ?? ''),
      formaEnvio: String(pedido?.forma_envio ?? separacao?.formaEnvio ?? ''),
      formaFrete: String(pedido?.forma_frete ?? separacao?.formaFrete ?? ''),
      situacao: String(pedido?.situacao ?? ''),
      observacao: String(pedido?.obs ?? ''),
      observacaoInterna: String(pedido?.obs_interna ?? ''),
      marcadores
    },
    separacao: {
      id: String(separacao?.id ?? ''),
      situacao: Number(separacao?.situacao ?? 0),
      situacaoTexto: statusLabel(separacao?.situacao),
      dataCriacao: String(separacao?.dataCriacao ?? ''),
      dataSeparacao: String(separacao?.dataSeparacao ?? ''),
      dataCheckout: String(separacao?.dataCheckout ?? ''),
      qtdVolumes: Number(separacao?.qtdVolumes ?? 0),
      idUsuarioEmbaladorTiny: String(separacao?.idUsuarioEmbalador ?? '')
    },
    itens,
    totalLinhas: itens.length,
    totalUnidades: itens.reduce((sum, item) => sum + Number(item.quantidade || 0), 0)
  };
}

async function handlePackagingLookup(req, res, urlObj) {
  const codigo = String(urlObj.searchParams.get('codigo') || '').trim();
  if (!codigo) return sendError(res, 'Informe o código da etiqueta.', 400);

  const configured = Object.values(ACCOUNTS).filter(a => a.token);
  if (configured.length === 0) {
    return sendError(res, 'Nenhum token do Tiny foi configurado no servidor.', 503, {
      variaveis: ['TINY_TOKEN_COMERCIO', 'TINY_TOKEN_SUPRIMENTOS', 'TINY_TOKEN_EKN', 'TINY_TOKEN_DISTRIBUIDORA']
    });
  }

  const results = await Promise.all(configured.map(async account => {
    try { return await lookupInAccount(account, codigo); }
    catch (error) { return { account, error: error?.tiny?.mensagem || error.message || String(error) }; }
  }));

  const found = results.find(item => item.pedido && item.separacao);
  if (!found) {
    return sendJson(res, {
      ok: false,
      error: 'Etiqueta não localizada entre os pedidos que estão atualmente na separação.',
      codigo,
      tentativas: results.map(item => ({ lojaKey: item.account.key, lojaNome: item.account.nome, erro: item.error || null }))
    }, 404);
  }

  return sendJson(res, normalizePackagingResult(found, codigo));
}

/* Proxy do Apps Script já utilizado pelo dashboard */
async function proxyToWebApp(queryStr) {
  let target = WEB_APP_URL;
  if (queryStr) target += (WEB_APP_URL.includes('?') ? '&' : '?') + queryStr.replace(/^\?/, '');
  const response = await fetchText(target, { method: 'GET', cache: 'no-store' });
  return { ok: response.ok, status: response.status, json: response.json, raw: response.text };
}

function normalizeSummaryResponse(original) {
  const mapped = original?.mapped || original || {};
  return {
    ok: true,
    ts: original?.ts || mapped.ts || new Date().toISOString(),
    aguardando: Number(mapped.aguardando_total ?? original?.aguardando ?? 0),
    emSeparacao: Number(mapped.em_separao_total ?? mapped.em_separacao_total ?? original?.emSeparacao ?? 0),
    separadas: Number(mapped.separadas_total ?? original?.separadas ?? 0),
    embaladas: Number(mapped.embaladas_total ?? original?.embaladas ?? 0),
    embaladosNaUltimaHora: Number(mapped.embalados_ultima_hora ?? 0),
    overall: { totalItens: Number(mapped.grand_total ?? original?.total ?? 0) },
    perStore: original?.perStore || original?.raw?.perStore || {},
    raw: original
  };
}

function normalizeFormasEnvioResponse(original) {
  return {
    ok: true,
    ts: original?.ts || new Date().toISOString(),
    formasEnvio: original?.formasEnvio || original?.raw?.formasEnvio || original?.data?.formasEnvio || {},
    raw: original
  };
}

async function handleProxyAction(res, action, normalizer = value => value) {
  const prox = await proxyToWebApp(`action=${encodeURIComponent(action)}`);
  if (prox.json) return sendJson(res, normalizer(prox.json), prox.status || 200);
  return sendError(res, 'Resposta do Web App não veio como JSON', prox.status || 500, prox.raw);
}

async function handleApiAccount(req, res, accountKey) {
  const account = ACCOUNTS[accountKey];
  if (account?.token) {
    try {
      const separacoes = await getCurrentSeparations(account);
      return sendJson(res, {
        ok: true,
        ts: Date.now(),
        perStore: {
          [accountKey]: {
            separacoes,
            totalSeparacoes: separacoes.length
          }
        }
      });
    } catch (error) {
      return sendError(res, error.message || String(error), 500);
    }
  }

  const prox = await proxyToWebApp(`action=account&acc=${encodeURIComponent(accountKey)}`);
  if (prox.json) return sendJson(res, prox.json, prox.status || 200);
  return sendError(res, 'Conta não localizada', prox.status || 404, prox.raw);
}

function serveStaticFile(res, pathname) {
  const safePath = pathname === '/' || pathname === '' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(APP_DIR, safePath));
  if (!filePath.startsWith(APP_DIR)) return sendError(res, 'Forbidden', 403);

  fs.readFile(filePath, (error, content) => {
    if (error) return sendError(res, 'Not Found', 404);
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    sendText(res, content, 200, types[ext] || 'application/octet-stream');
  });
}

async function createRequestHandler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.end();
    }
    if (req.method !== 'GET') return sendError(res, 'Method Not Allowed', 405);

    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    if (pathname === '/api/marcadores') return handleMarkers(req, res);
    if (pathname === '/api/separacoes-marcador') return handleMarkerSeparations(req, res, urlObj);
    if (pathname === '/api/embalagem/buscar') return handlePackagingLookup(req, res, urlObj);

    if (['/summary', '/api/summary', '/api/summary/', '/api/summary/summary'].includes(pathname)) {
      return handleProxyAction(res, 'summary', normalizeSummaryResponse);
    }
    if (['/formasEnvio', '/api/formasEnvio', '/formas-envio', '/api/formas-envio'].includes(pathname)) {
      return handleProxyAction(res, 'formasEnvio', normalizeFormasEnvioResponse);
    }
    if (['/produtividade', '/api/produtividade'].includes(pathname)) {
      return handleProxyAction(res, 'produtividade');
    }

    if (pathname.startsWith('/api/summary/')) {
      const accountKey = pathname.replace(/^\/api\/summary\/?/, '').split('/').filter(Boolean)[0];
      if (!accountKey || accountKey === 'summary') return handleProxyAction(res, 'summary', normalizeSummaryResponse);
      return handleApiAccount(req, res, accountKey);
    }
    if (pathname.startsWith('/summary/')) {
      const accountKey = pathname.replace(/^\/summary\/?/, '').split('/').filter(Boolean)[0];
      if (!accountKey || accountKey === 'summary') return handleProxyAction(res, 'summary', normalizeSummaryResponse);
      return handleApiAccount(req, res, accountKey);
    }

    if (pathname.startsWith('/api/')) return sendError(res, 'API route not found', 404);
    if (pathname === '/admin') return serveStaticFile(res, '/admin.html');
    if (pathname === '/embalagem') return serveStaticFile(res, '/embalagem.html');
    return serveStaticFile(res, pathname);
  } catch (error) {
    console.error('Server error:', error);
    return sendError(res, error?.message || String(error), 500);
  }
}

function makeServer() {
  return http.createServer((req, res) => createRequestHandler(req, res));
}

module.exports = (req, res) => createRequestHandler(req, res);

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  (async () => {
    for (const port of DEFAULT_PORTS) {
      try {
        const server = makeServer();
        await new Promise((resolve, reject) => {
          server.once('error', reject);
          server.listen(port, resolve);
        });
        console.log(`Dashboard disponível em http://localhost:${port}`);
        return;
      } catch (error) {
        if (error.code !== 'EADDRINUSE') throw error;
      }
    }
    throw new Error('Nenhuma porta disponível');
  })().catch(error => console.error('Falha ao iniciar servidor:', error));
}
