require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const axios = require('axios');

const app = express();

// Validar variáveis de ambiente obrigatórias
const requiredEnvVars = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Erro: Variáveis de ambiente obrigatórias não definidas: ${missingEnvVars.join(', ')}`);
  console.error('Por favor, configure o arquivo .env com todas as variáveis necessárias.');
  process.exit(1);
}

const PORT = process.env.PORT || 3001;

// CallFarma API (opcional): se configurado, /api/proxy/clientes-ticket usa a API CallFarma em vez do MySQL
const CALLFARMA_BASE_URL = (process.env.CALLFARMA_BASE_URL || 'https://apiv2.callfarma.com.br:8443').replace(/\/$/, '') || null;
const CALLFARMA_BEARER = process.env.CALLFARMA_BEARER || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEsImlhdCI6MTU5NjQ3NDg1Nn0.2K1SZ1d5ZYkvqZSIe8hbWa5LrSC7TB64F_XLKJ9qTow';
const CALLFARMA_X_CLIENT_ID = process.env.CALLFARMA_X_CLIENT_ID || '6582';
const CALLFARMA_X_AUTH_CODE = process.env.CALLFARMA_X_AUTH_CODE || '1';
const CALLFARMA_ENABLED = !!(CALLFARMA_BASE_URL && CALLFARMA_BEARER);

// HTTPS agent reutilizável para CallFarma (SSL não verificado, igual PHP CURLOPT_SSL_VERIFYPEER = false)
const CALLFARMA_HTTPS_AGENT = new (require('https').Agent)({ rejectUnauthorized: false });

/** Busca chave pública da API CallFarma (igual callfarma-proxy.php getPublicKey) */
async function getPublicKeyCallFarma() {
  const url = `${CALLFARMA_BASE_URL}/api/v1/public-key`;
  const res = await axios.get(url, {
    timeout: 30000,
    validateStatus: () => true,
    httpsAgent: CALLFARMA_HTTPS_AGENT
  });
  if (res.status !== 200) {
    throw new Error(`CallFarma public-key HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
  }
  const key = res.data?.key ?? res.data?.data?.key;
  if (!key || typeof key !== 'string') {
    throw new Error('Resposta da API não contém chave pública (key)');
  }
  return key;
}

/**
 * Modificador para assinatura CallFarma (igual PHP generateModifier)
 * strrev(timestamp) -> primeiros 4 chars -> intval % 997 -> dechex
 */
function generateModifierCallFarma(timestamp) {
  const ts = String(timestamp);
  const reversed = ts.split('').reverse().join('');
  const firstFour = reversed.slice(0, 4);
  const mod = parseInt(firstFour, 10) % 997;
  return mod.toString(16);
}

/**
 * Gera X-Request-Sign (igual PHP generateSignature)
 * stringToSign = "{modifier};_{pathname};_{timestamp};_{method};_{bodyStr}"
 * hmacHash = hmac-sha256(stringToSign, publicKey)
 * finalHash = sha256(hmacHash + modifier)
 * signature = finalHash + substr(finalHash, 0, 6)
 */
function generateSignatureCallFarma(method, pathname, timestamp, body, publicKey) {
  const modifier = generateModifierCallFarma(timestamp);
  const bodyStr = body ? JSON.stringify(body) : '';
  const stringToSign = `${modifier};_${pathname};_${timestamp};_${method};_${bodyStr}`;
  const hmacHash = crypto.createHmac('sha256', publicKey).update(stringToSign, 'utf8').digest('hex');
  const finalHash = crypto.createHash('sha256').update(hmacHash + modifier, 'utf8').digest('hex');
  return finalHash + finalHash.slice(0, 6);
}

/** GET financeiro/vendas-por-filial na API CallFarma – URL e formato iguais ao callfarma-proxy.php callFarmaRequest */
async function callFarmaVendasPorFilial(cdfil, dataIni, dataFim) {
  // 1. Construir a URL exatamente como no PHP: path + params com ksort (ordem alfabética) + http_build_query
  const path = '/financeiro/vendas-por-filial';
  const params = {
    cdfil: String(cdfil),
    dataFim: dataFim,
    dataFimAnt: dataFim,
    dataIni: dataIni,
    dataIniAnt: dataIni
  };
  const queryString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');
  const fullUrl = `${CALLFARMA_BASE_URL}${path}?${queryString}`;

  // 2. Obter chave pública e timestamp (igual PHP)
  const publicKey = await getPublicKeyCallFarma();
  const timestamp = String(Math.floor(Date.now() / 1000));

  // 3. Gerar assinatura (apenas path, sem query string – igual PHP)
  const signature = generateSignatureCallFarma('GET', path, timestamp, null, publicKey);

  // 4. Montar cabeçalhos (igual PHP)
  const res = await axios.get(fullUrl, {
    timeout: 30000,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${CALLFARMA_BEARER}`,
      'X-Auth-Code': CALLFARMA_X_AUTH_CODE,
      'X-Client-ID': CALLFARMA_X_CLIENT_ID,
      'X-Request-Time': timestamp,
      'X-Request-Sign': signature,
      Referer: 'https://coc.callfarma.com.br/'
    },
    validateStatus: () => true,
    httpsAgent: CALLFARMA_HTTPS_AGENT
  });

  if (res.status !== 200) {
    const msg = typeof res.data === 'object' ? JSON.stringify(res.data).slice(0, 400) : String(res.data).slice(0, 400);
    console.error('[CallFarma] vendas-por-filial HTTP', res.status, 'URL:', fullUrl, 'body:', msg);
    throw new Error(`CallFarma vendas-por-filial HTTP ${res.status}: ${msg}`);
  }
  // Debug: log estrutura da resposta para diagnóstico (remover em produção se quiser)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[CallFarma] Resposta 200 keys:', Object.keys(res.data || {}), 'msg length:', Array.isArray(res.data?.msg) ? res.data.msg.length : 'n/a', 'first row keys:', res.data?.msg?.[0] ? Object.keys(res.data.msg[0]) : 'n/a');
  }
  return res.data;
}

/** GET financeiro/vendas-por-funcionario na API CallFarma */
async function callFarmaVendasPorFuncionario(params = {}) {
  const path = '/financeiro/vendas-por-funcionario';
  const queryString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');
  const fullUrl = `${CALLFARMA_BASE_URL}${path}?${queryString}`;
  const publicKey = await getPublicKeyCallFarma();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = generateSignatureCallFarma('GET', path, timestamp, null, publicKey);

  const res = await axios.get(fullUrl, {
    timeout: 30000,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${CALLFARMA_BEARER}`,
      'X-Auth-Code': CALLFARMA_X_AUTH_CODE,
      'X-Client-ID': CALLFARMA_X_CLIENT_ID,
      'X-Request-Time': timestamp,
      'X-Request-Sign': signature,
      Referer: 'https://coc.callfarma.com.br/'
    },
    validateStatus: () => true,
    httpsAgent: CALLFARMA_HTTPS_AGENT
  });

  if (res.status !== 200) {
    const msg = typeof res.data === 'object' ? JSON.stringify(res.data).slice(0, 400) : String(res.data).slice(0, 400);
    console.error('[CallFarma] vendas-por-funcionario HTTP', res.status, 'URL:', fullUrl, 'body:', msg);
    throw new Error(`CallFarma vendas-por-funcionario HTTP ${res.status}`);
  }

  return res.data?.msg ?? res.data ?? [];
}

/** GET banner-prevendas na API CallFarma */
async function callFarmaBannerPrevendas(params = {}) {
  const path = '/banner-prevendas';
  const queryString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');
  const fullUrl = `${CALLFARMA_BASE_URL}${path}?${queryString}`;
  const publicKey = await getPublicKeyCallFarma();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = generateSignatureCallFarma('GET', path, timestamp, null, publicKey);

  const res = await axios.get(fullUrl, {
    timeout: 30000,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${CALLFARMA_BEARER}`,
      'X-Auth-Code': CALLFARMA_X_AUTH_CODE,
      'X-Client-ID': CALLFARMA_X_CLIENT_ID,
      'X-Request-Time': timestamp,
      'X-Request-Sign': signature,
      Referer: 'https://coc.callfarma.com.br/'
    },
    validateStatus: () => true,
    httpsAgent: CALLFARMA_HTTPS_AGENT
  });

  if (res.status !== 200) {
    const msg = typeof res.data === 'object' ? JSON.stringify(res.data).slice(0, 400) : String(res.data).slice(0, 400);
    console.error('[CallFarma] banner-prevendas HTTP', res.status, 'URL:', fullUrl, 'body:', msg);
    throw new Error(`CallFarma banner-prevendas HTTP ${res.status}`);
  }
  return res.data;
}

// CORS: HTTP localhost + HTTPS produção; CORS_ALLOW_ANY=true reflete qualquer origem
const CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://seellbr.com',
  'https://oldv2.seellbr.com',
  'https://consulta.seellbr.com',
  'https://www.seellbr.com',
  'https://onev2.seellbr.com',
  'https://app.seellbr.com',
  'http://seellbr.com',
  'http://www.seellbr.com',
  'https://69.6.222.250',
  'https://69.6.222.250:443',
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : [])
];
app.use(cors({
  origin(origin, cb) {
    if (process.env.CORS_ALLOW_ANY === 'true') return cb(null, true);
    if (!origin || CORS_ORIGINS.includes(origin)) return cb(null, origin || true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Preflight OPTIONS: responder 204 para qualquer /api/* (evita 404 no CORS)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS' && req.path.startsWith('/api/')) {
    return res.sendStatus(204);
  }
  next();
});

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
  connectTimeout: 10000
};

// ========== Supabase (Campanhas) ==========
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zzqlghoefcmuevtkvxum.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6cWxnaG9lZmNtdWV2dGt2eHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MTg2NzcsImV4cCI6MjA3MjA5NDY3N30.0PPrF8sKk5ZvscOH0WdTkddwEu7wRIXbCZaxVly7tYQ';
const SUPABASE_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function supabaseGet(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const response = await fetch(url, { headers: SUPABASE_HEADERS });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase GET ${response.status}: ${text}`);
  }
  return response.json();
}

async function supabasePatch(table, query = '', payload = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...SUPABASE_HEADERS,
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase PATCH ${response.status}: ${text}`);
  }
  return response.json();
}

// ========== Categorias (CDGRUPO) – espelho do frontend para queries de vendas ==========
const CATEGORIAS_LOJA = {
  r_mais: [20, 25],
  perfumaria_r_mais: [46],
  saude: [22],
  conveniencia_r_mais: [36, 13]
};
const CATEGORIAS_FUNCIONARIO = {
  similar: [2, 21, 20, 25, 22],
  generico: [47, 5, 6],
  perfumaria_alta: [46],
  goodlife: [22],
  rentaveis20: [20],
  rentaveis25: [25],
  dermocosmetico: [31, 16],
  conveniencia: [36],
  brinquedo: [13]
};

function normalizeCategoriasOverride(categoriasOverride) {
  if (!categoriasOverride || typeof categoriasOverride !== 'object') return null;
  const entries = Object.entries(categoriasOverride).filter(([, grupos]) => Array.isArray(grupos));
  if (!entries.length) return null;
  const normalized = {};
  entries.forEach(([categoria, grupos]) => {
    const valid = grupos.map((g) => Number(g)).filter((g) => Number.isFinite(g));
    if (valid.length) normalized[categoria] = [...new Set(valid)];
  });
  return Object.keys(normalized).length ? normalized : null;
}

function getCategorias(tipo, categoriasOverride) {
  const override = normalizeCategoriasOverride(categoriasOverride);
  if (override) return override;
  return tipo === 'loja' ? CATEGORIAS_LOJA : CATEGORIAS_FUNCIONARIO;
}

function getGruposUnicos(tipo, categoriasOverride) {
  const categorias = getCategorias(tipo, categoriasOverride);
  return [...new Set(Object.values(categorias).flat())];
}

/** Processa linhas da API de vendas para o formato esperado pelo frontend */
function processarDadosVendas(dados, tipo = 'loja', categoriasOverride = null) {
  const categorias = getCategorias(tipo, categoriasOverride);
  const vendas = { geral: 0 };
  Object.keys(categorias).forEach((key) => {
    vendas[key] = 0;
  });
  const entradas = Object.entries(categorias);
  dados.forEach((row) => {
    const grupo = row.GRUPO ?? row.grupo ?? '';
    const valor = parseFloat(row.TOTAL_VALOR ?? row.total_valor) || 0;
    if (grupo === 'TOTAL GERAL') {
      vendas.geral = valor;
      return;
    }
    const cdgrupo = Number(row.CDGRUPO ?? row.cdgrupo ?? row.cdGrupo ?? row.cd_grupo);
    if (!cdgrupo) return;
    for (const [categoria, grupos] of entradas) {
      if (Array.isArray(grupos) && grupos.includes(cdgrupo)) {
        vendas[categoria] = (vendas[categoria] ?? 0) + valor;
      }
    }
  });
  return vendas;
}

function buildQueryVendasDia(lojaId, tipo, cdfun, periodoDia, categoriasOverride = null) {
  const filtroLoja = lojaId ? `CDFIL = ${Number(lojaId)} AND ` : '';
  const filtroFunc = (tipo === 'funcionario' && cdfun != null) ? `CDFUN = ${Number(cdfun)} AND ` : '';
  const condicaoData = periodoDia === 'ontem'
    ? 'DATA = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
    : 'DATA = CURDATE()';
  const gruposUnicos = getGruposUnicos(tipo, categoriasOverride);
  const gruposStr = gruposUnicos.join(', ');
  return `
    SELECT 'TOTAL GERAL' AS GRUPO, NULL AS CDGRUPO, SUM(VALOR) AS TOTAL_VALOR
    FROM scevenda
    WHERE ${filtroLoja}${filtroFunc} ${condicaoData}
    UNION ALL
    SELECT NULL AS GRUPO, CDGRUPO, SUM(VALOR) AS TOTAL_VALOR
    FROM scevenda
    WHERE ${filtroLoja}${filtroFunc} ${condicaoData} AND CDGRUPO IN (${gruposStr})
    GROUP BY CDGRUPO
  `.trim();
}

function buildQueryVendasPeriodoCompleto(lojaId, dataInicio, dataFim, tipo, cdfun, categoriasOverride = null) {
  const filtroLoja = lojaId ? `CDFIL = ${Number(lojaId)} AND ` : '';
  const filtroFunc = (tipo === 'funcionario' && cdfun != null) ? `CDFUN = ${Number(cdfun)} AND ` : '';
  const condicaoData = `DATA BETWEEN '${dataInicio}' AND '${dataFim}'`;
  const gruposUnicos = getGruposUnicos(tipo, categoriasOverride);
  const gruposStr = gruposUnicos.join(', ');
  return `
    SELECT 'TOTAL GERAL' AS GRUPO, NULL AS CDGRUPO, SUM(VALOR) AS TOTAL_VALOR
    FROM scevenda
    WHERE ${filtroLoja}${filtroFunc} ${condicaoData}
    UNION ALL
    SELECT NULL AS GRUPO, CDGRUPO, SUM(VALOR) AS TOTAL_VALOR
    FROM scevenda
    WHERE ${filtroLoja}${filtroFunc} ${condicaoData} AND CDGRUPO IN (${gruposStr})
    GROUP BY CDGRUPO
  `.trim();
}

function toDDMMYYYY(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}
function toYYYYMMDD(dmy) {
  if (!dmy || !/^\d{2}\/\d{2}\/\d{4}$/.test(dmy)) return dmy;
  const [d, m, y] = dmy.split('/');
  return `${y}-${m}-${d}`;
}
function normalizeDateInput(input) {
  if (!input) return input;
  const raw = String(input).trim();
  const base = raw.length > 10 ? raw.slice(0, 10) : raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(base)) {
    return toYYYYMMDD(base);
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(base)) {
    const [d, m, y] = base.split('-');
    return `${y}-${m}-${d}`;
  }
  return base;
}
function normalizeDateInputStrict(input) {
  if (!input) return input;
  const raw = String(input).trim();
  const base = raw.length > 10 ? raw.slice(0, 10) : raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(base)) return toYYYYMMDD(base);
  if (/^\d{2}-\d{2}-\d{4}$/.test(base)) {
    const [d, m, y] = base.split('-');
    return `${y}-${m}-${d}`;
  }
  const digits = base.replace(/[^\d]/g, '');
  if (digits.length === 8) {
    // Heurística: YYYYMMDD ou DDMMYYYY
    const yearFirst = digits.slice(0, 4);
    const yearLast = digits.slice(4, 8);
    if (Number(yearFirst) >= 1900 && Number(yearFirst) <= 2100) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    }
    if (Number(yearLast) >= 1900 && Number(yearLast) <= 2100) {
      return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
    }
    return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  }
  return base;
}
function col(row, ...keys) {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null) return parseFloat(v) || 0;
  }
  return 0;
}
function mapMetasFuncionario(row, tipoUsuario = '') {
  const isConsultora = (tipoUsuario || '').toLowerCase() === 'consultora';
  const o2 = col(row, 'OBJETIVO2', 'objetivo2');
  return {
    geral: col(row, 'OBJETIVO1', 'objetivo1'),
    generico_similar: isConsultora ? 0 : o2,
    perfumaria_alta: isConsultora ? o2 : 0,
    dermocosmetico: col(row, 'OBJETIVO3', 'objetivo3'),
    goodlife: col(row, 'GOODLIFE', 'goodlife')
  };
}
function mapMetasLoja(row) {
  return {
    geral: col(row, 'META1', 'OBJETIVO1', 'objetivo1'),
    r_mais: col(row, 'META2', 'OBJETIVO2', 'objetivo2'),
    perfumaria_r_mais: col(row, 'META3', 'OBJETIVO3', 'objetivo3'),
    saude: col(row, 'META4', 'OBJETIVO4', 'objetivo4'),
    conveniencia_r_mais: col(row, 'META7'),
    goodlife: 0
  };
}

function initVendasLoja() {
  const vendas = { geral: 0 };
  Object.keys(CATEGORIAS_LOJA).forEach((key) => {
    vendas[key] = 0;
  });
  return vendas;
}

function processarVendasPorLoja(rows) {
  const mapa = {};
  const entradas = Object.entries(CATEGORIAS_LOJA);
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const cdfil = Number(row.CDFIL ?? row.cdfil);
    if (!cdfil) return;
    if (!mapa[cdfil]) mapa[cdfil] = initVendasLoja();
    const valor = parseFloat(row.TOTAL_VALOR ?? row.total_valor ?? row.valor) || 0;
    const grupoLabel = row.GRUPO ?? row.grupo ?? '';
    if (grupoLabel === 'TOTAL GERAL') {
      mapa[cdfil].geral = valor;
      return;
    }
    const cdgrupo = Number(row.CDGRUPO ?? row.cdgrupo ?? row.cd_grupo);
    if (!cdgrupo) return;
    for (const [categoria, grupos] of entradas) {
      if (Array.isArray(grupos) && grupos.includes(cdgrupo)) {
        mapa[cdfil][categoria] = (mapa[cdfil][categoria] ?? 0) + valor;
      }
    }
  });
  return mapa;
}

function analisarPeriodoSemFolgas(dataInicio, dataFim, temVendasHoje) {
  const inicio = new Date(`${dataInicio}T12:00:00`);
  const fim = new Date(`${dataFim}T12:00:00`);
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);

  let diasTrabalhados = 0;
  let diasUteisRestantes = 0;
  const corrente = new Date(inicio);
  const hojeStr = hoje.toISOString().slice(0, 10);

  while (corrente <= fim) {
    const dataStr = corrente.toISOString().slice(0, 10);
    if (corrente < hoje) {
      diasTrabalhados++;
    } else if (dataStr === hojeStr) {
      diasUteisRestantes++;
      if (temVendasHoje) diasTrabalhados++;
    } else {
      diasUteisRestantes++;
    }
    corrente.setDate(corrente.getDate() + 1);
  }

  return { dias_trabalhados: diasTrabalhados, dias_uteis_restantes: diasUteisRestantes };
}

// ---------- Endpoint legado (query genérica – apenas SELECT) ----------
app.post('/api/query', async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string' || !query.trim().toLowerCase().startsWith('select')) {
    return res.status(400).json({
      success: false,
      data: { status: false, error: 'Apenas comandos SELECT são permitidos.' },
      executionTime: 0,
      attempts: 1,
      sticky: false
    });
  }
  let conn;
  const attempts = 1;
  const sticky = false;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const startTime = Date.now();
    const [rows] = await conn.query(query);
    const executionTime = Date.now() - startTime;
    await conn.end();
    res.json({
      success: true,
      data: {
        status: true,
        data: rows
      },
      executionTime,
      attempts,
      sticky
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      data: { status: false, error: e.message },
      executionTime: 0,
      attempts,
      sticky
    });
  }
});

/** GET /api/acompanhamento/dados - Params: { cdfil?, cdfun, data_inicio, data_fim, tipo_usuario? } */
app.get('/api/acompanhamento/dados', async (req, res) => {
  const { cdfil, cdfun, data_inicio, data_fim, tipo_usuario } = req.query || {};

  if (!cdfun || !data_inicio || !data_fim) {
    return res.status(400).json({ success: false, error: 'cdfun, data_inicio e data_fim obrigatórios' });
  }

  const tipo = (tipo_usuario || 'aux_conveniencia').toString().toLowerCase();
  if (tipo !== 'aux_conveniencia') {
    return res.json({ success: true, data: { tipo, periodo: { data_inicio, data_fim } } });
  }

  const categoriasOverride = { conveniencia: [36], brinquedo: [13] };
  const lojaId = cdfil ? Number(cdfil) : null;
  const funId = Number(cdfun);
  let conn;

  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);

    const queryPeriodo = buildQueryVendasPeriodoCompleto(lojaId, data_inicio, data_fim, 'funcionario', funId, categoriasOverride);
    const [rowsPeriodo] = await conn.query(queryPeriodo);
    const vendas = processarDadosVendas(Array.isArray(rowsPeriodo) ? rowsPeriodo : [], 'funcionario', categoriasOverride);

    const queryDia = buildQueryVendasDia(lojaId, 'funcionario', funId, 'hoje', categoriasOverride);
    const [rowsDia] = await conn.query(queryDia);
    const vendasDiaAtual = processarDadosVendas(Array.isArray(rowsDia) ? rowsDia : [], 'funcionario', categoriasOverride);

    const queryHistorico = `
      SELECT DATE(DATA) AS data,
             SUM(VALOR) AS valor_vendido,
             COUNT(*) AS quantidade_vendas
      FROM scevenda
      WHERE ${lojaId ? `CDFIL = ${lojaId} AND ` : ''}CDFUN = ${funId}
        AND CDGRUPO IN (36, 13)
        AND DATA BETWEEN '${data_inicio}' AND '${data_fim}'
      GROUP BY DATE(DATA)
      ORDER BY data DESC
      LIMIT 15
    `.trim();
    const [rowsHistorico] = await conn.query(queryHistorico);

    await conn.end();

    const valorConveniencia = vendas.conveniencia || 0;
    const valorBrinquedo = vendas.brinquedo || 0;
    const valorTotal = valorConveniencia + valorBrinquedo;
    const taxa = 0.02;
    const totalComissoes = valorTotal * taxa;

    const temVendasHoje = (vendasDiaAtual.conveniencia || 0) + (vendasDiaAtual.brinquedo || 0) > 0;
    const analiseFolgas = analisarPeriodoSemFolgas(data_inicio, data_fim, temVendasHoje);
    const totalDiasUteis = analiseFolgas.dias_trabalhados + analiseFolgas.dias_uteis_restantes;
    const percentualTempo = totalDiasUteis > 0
      ? Math.min(100, Math.max(0, (analiseFolgas.dias_trabalhados / totalDiasUteis) * 100))
      : 0;

    const historico = (Array.isArray(rowsHistorico) ? rowsHistorico : []).map((row) => {
      const valorVendido = parseFloat(row.valor_vendido) || 0;
      return {
        data: row.data,
        valor_vendido: valorVendido,
        quantidade_vendas: parseInt(row.quantidade_vendas, 10) || 0,
        comissao: valorVendido * taxa
      };
    });

    const resumoConveniencia = {
      valor_total: valorTotal,
      comissao_total: totalComissoes,
      taxa: taxa * 100,
      vendas_hoje: (vendasDiaAtual.conveniencia || 0) + (vendasDiaAtual.brinquedo || 0),
      media_diaria: analiseFolgas.dias_trabalhados > 0 ? totalComissoes / analiseFolgas.dias_trabalhados : 0,
      projecao: totalDiasUteis > 0 ? (totalComissoes / Math.max(1, analiseFolgas.dias_trabalhados)) * totalDiasUteis : 0
    };

    res.json({
      success: true,
      data: {
        tipo,
        periodo: { data_inicio, data_fim },
        vendas,
        vendas_dia_atual: vendasDiaAtual,
        analise_folgas: analiseFolgas,
        percentual_tempo: percentualTempo,
        comissoes: {
          conveniencia: { valor: valorConveniencia, taxa: taxa * 100, comissao: valorConveniencia * taxa },
          brinquedo: { valor: valorBrinquedo, taxa: taxa * 100, comissao: valorBrinquedo * taxa }
        },
        total_comissoes: totalComissoes,
        historico_comissoes: historico,
        resumo_conveniencia: resumoConveniencia
      }
    });
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    res.status(500).json({ success: false, error: e.message });
  }
});

// ===== Campanhas (Supabase) =====
app.get('/api/campanhas', async (req, res) => {
  try {
    const incluirInativas = String(req.query.inativas || '0') === '1';
    const query = incluirInativas
      ? 'status=in.(ativa,inativa,encerrada)&order=data_fim.asc'
      : 'status=eq.ativa&order=data_fim.asc';
    const data = await supabaseGet('campanhas_vendas_lojas', query);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/campanhas/participantes', async (req, res) => {
  try {
    const idsParam = String(req.query.ids || '').trim();
    if (!idsParam) return res.json({ success: true, data: [] });
    const ids = idsParam.split(',').map((v) => Number(v)).filter((v) => Number.isFinite(v));
    if (!ids.length) return res.json({ success: true, data: [] });
    const query = `campanha_id=in.(${ids.join(',')})&order=campanha_id.asc,codigo_loja.asc`;
    const data = await supabaseGet('campanhas_vendas_lojas_participantes', query);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/campanhas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });
    const data = await supabaseGet('campanhas_vendas_lojas', `id=eq.${id}`);
    res.json({ success: true, data: data?.[0] || null });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/campanhas/:id/participantes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });
    const data = await supabaseGet('campanhas_vendas_lojas_participantes', `campanha_id=eq.${id}&order=codigo_loja.asc`);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.patch('/api/campanhas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const permitido = [
      'nome',
      'descricao',
      'data_inicio',
      'data_fim',
      'status',
      'tipo_meta',
      'fornecedores',
      'marcas',
      'familias',
      'grupos_produtos',
      'produtos'
    ];

    const payload = {};
    permitido.forEach((campo) => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, campo)) {
        payload[campo] = req.body[campo];
      }
    });

    if (!Object.keys(payload).length) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    const data = await supabasePatch('campanhas_vendas_lojas', `id=eq.${id}`, payload);
    res.json({ success: true, data: data?.[0] || null });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Atualizar meta/grupo de participante (loja) da campanha
app.patch('/api/campanhas/participantes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const permitido = ['grupo_id', 'meta_valor', 'meta_quantidade'];
    const payload = {};
    permitido.forEach((campo) => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, campo)) {
        payload[campo] = req.body[campo];
      }
    });

    if (!Object.keys(payload).length) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    const data = await supabasePatch('campanhas_vendas_lojas_participantes', `id=eq.${id}`, payload);
    res.json({ success: true, data: data?.[0] || null });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
// ---------- Endpoints dedicados (vendas/metas) ----------

/** POST /api/proxy/vendas/dia - Body: { lojaId, tipo?, cdfun?, periodoDia? } */
app.post('/api/proxy/vendas/dia', async (req, res) => {
  const { lojaId, tipo = 'loja', cdfun = null, periodoDia = 'hoje', categorias = null } = req.body || {};
  let conn;
  try {
    const query = buildQueryVendasDia(lojaId || null, tipo, cdfun, periodoDia, categorias);
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const [rows] = await conn.query(query);
    await conn.end();
    const arr = Array.isArray(rows) ? rows : [];
    const data = processarDadosVendas(arr, tipo, categorias);
    res.json({ success: true, data });
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/proxy/vendas/periodo - Body: { lojaId, dataInicio, dataFim } - Retorna { total } */
app.post('/api/proxy/vendas/periodo', async (req, res) => {
  const { lojaId, dataInicio, dataFim } = req.body || {};
  if (!dataInicio || !dataFim) {
    return res.status(400).json({ success: false, error: 'dataInicio e dataFim obrigatórios' });
  }
  const filtroLoja = lojaId ? `CDFIL = ${Number(lojaId)} AND ` : '';
  const query = `SELECT SUM(VALOR) AS TOTAL_GERAL FROM scevenda WHERE ${filtroLoja} DATA BETWEEN '${dataInicio}' AND '${dataFim}'`.trim();
  let conn;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const [rows] = await conn.query(query);
    await conn.end();
    const total = parseFloat(rows?.[0]?.TOTAL_GERAL ?? rows?.[0]?.total_geral) || 0;
    res.json({ success: true, total });
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/proxy/vendas/periodo-completo - Body: { lojaId, dataInicio, dataFim, tipo?, cdfun? } */
app.post('/api/proxy/vendas/periodo-completo', async (req, res) => {
  const { lojaId, dataInicio, dataFim, tipo = 'loja', cdfun = null, categorias = null } = req.body || {};
  if (!dataInicio || !dataFim) {
    return res.status(400).json({ success: false, error: 'dataInicio e dataFim obrigatórios' });
  }
  let conn;
  try {
    const query = buildQueryVendasPeriodoCompleto(lojaId || null, dataInicio, dataFim, tipo, cdfun, categorias);
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const [rows] = await conn.query(query);
    await conn.end();
    const arr = Array.isArray(rows) ? rows : [];
    const data = processarDadosVendas(arr, tipo, categorias);
    res.json({ success: true, data });
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/proxy/metas/funcionario - Body: { cdfil, cdfun, dataInicio, dataFim, tipoUsuario? } */
app.post('/api/proxy/metas/funcionario', async (req, res) => {
  const { cdfil, cdfun, dataInicio, dataFim, tipoUsuario = '' } = req.body || {};
  const defaults = { geral: 0, generico_similar: 0, perfumaria_alta: 0, dermocosmetico: 0, goodlife: 0 };
  if (!cdfil || cdfun == null || !dataInicio || !dataFim) {
    return res.json({ success: true, data: defaults });
  }
  const dataInicioDdMm = toDDMMYYYY(dataInicio);
  const dataFimDdMm = toDDMMYYYY(dataFim);
  const query = `
    SELECT OBJETIVO1, OBJETIVO2, OBJETIVO3, GOODLIFE
    FROM scemetas
    WHERE CDFIL = ${Number(cdfil)} AND CDFUN = ${Number(cdfun)}
      AND DATAINI = '${dataInicioDdMm}' AND DATAFIM = '${dataFimDdMm}'
    LIMIT 1
  `.trim();
  let conn;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const [rows] = await conn.query(query);
    await conn.end();
    const arr = Array.isArray(rows) ? rows : [];
    const data = arr.length ? mapMetasFuncionario(arr[0], tipoUsuario) : defaults;
    res.json({ success: true, data });
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    res.status(500).json({ success: false, error: e.message });
  }
});

/** Busca metas loja: useDate=true compara DATE(DATAINI)=YYYY-MM-DD; useDate=false compara DATAINI=DD/MM/YYYY */
async function fetchMetasLojaRows(conn, cdfil, dataInicioStr, dataFimStr, useDate = true, isList = false) {
  const iniNorm = normalizeDateInputStrict(dataInicioStr);
  const fimNorm = normalizeDateInputStrict(dataFimStr);
  const iniYmd = String(iniNorm || '').includes('/') ? toYYYYMMDD(iniNorm) : iniNorm;
  const fimYmd = String(fimNorm || '').includes('/') ? toYYYYMMDD(fimNorm) : fimNorm;
  const cond = `
    (CASE WHEN DATAINI LIKE '%/%'
      THEN STR_TO_DATE(DATAINI, '%d/%m/%Y')
      ELSE STR_TO_DATE(DATAINI, '%Y-%m-%d')
    END) = '${iniYmd}'
    AND
    (CASE WHEN DATAFIM LIKE '%/%'
      THEN STR_TO_DATE(DATAFIM, '%d/%m/%Y')
      ELSE STR_TO_DATE(DATAFIM, '%Y-%m-%d')
    END) = '${fimYmd}'
  `.trim();
  const cdfilCond = isList ? `CDFIL IN ${cdfil}` : `CDFIL = ${Number(cdfil)}`;
  const query = `
    SELECT CDFIL, META1, META2, META3, META4, META7
    FROM sceindicadores
    WHERE ${cdfilCond} AND ${cond}
  `.trim();
  const [rows] = await conn.query(query);
  return Array.isArray(rows) ? rows : [];
}
app.post('/api/proxy/metas/loja', async (req, res) => {
  const { cdfil, dataInicio, dataFim } = req.body || {};
  const defaults = { geral: 0, r_mais: 0, perfumaria_r_mais: 0, saude: 0, conveniencia_r_mais: 0, goodlife: 0 };
  if (!cdfil || !dataInicio || !dataFim) {
    return res.json({ success: true, data: defaults });
  }
  let conn;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);
    let rows = await fetchMetasLojaRows(conn, cdfil, dataInicio, dataFim, true);
    if (!rows.length) {
      const dataInicioDdMm = toDDMMYYYY(dataInicio);
      const dataFimDdMm = toDDMMYYYY(dataFim);
      rows = await fetchMetasLojaRows(conn, cdfil, dataInicioDdMm, dataFimDdMm, false);
    }
    await conn.end();
    const data = rows.length ? mapMetasLoja(rows[0]) : defaults;
    res.json({ success: true, data });
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/proxy/lojas/resumo - Body: { cdfils[], dataInicio, dataFim } */
app.post('/api/proxy/lojas/resumo', async (req, res) => {
  const { cdfils, dataInicio, dataFim } = req.body || {};
  const defaults = { geral: 0, r_mais: 0, perfumaria_r_mais: 0, saude: 0, conveniencia_r_mais: 0, goodlife: 0 };

  if (!Array.isArray(cdfils) || cdfils.length === 0 || !dataInicio || !dataFim) {
    return res.status(400).json({ success: false, error: 'cdfils, dataInicio e dataFim obrigatórios' });
  }

  const lista = [...new Set(cdfils.map((c) => Number(c)).filter((c) => Number.isFinite(c)))];
  if (!lista.length) {
    return res.status(400).json({ success: false, error: 'cdfils inválido' });
  }

  const inStr = lista.join(', ');
  const dataInicioYmd = normalizeDateInputStrict(dataInicio);
  const dataFimYmd = normalizeDateInputStrict(dataFim);
  const dataInicioSafe = String(dataInicioYmd || '').includes('/') ? toYYYYMMDD(dataInicioYmd) : dataInicioYmd;
  const dataFimSafe = String(dataFimYmd || '').includes('/') ? toYYYYMMDD(dataFimYmd) : dataFimYmd;
  const dataInicioDdMm = String(dataInicioYmd || '').includes('-') ? toDDMMYYYY(dataInicioYmd) : dataInicio;
  const dataFimDdMm = String(dataFimYmd || '').includes('-') ? toDDMMYYYY(dataFimYmd) : dataFim;
  let conn;

  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);

    const metasMap = {};
    let rows = await fetchMetasLojaRows(conn, `(${inStr})`, dataInicioSafe, dataFimSafe, true, true);
    if (!Array.isArray(rows)) rows = [];
    rows.forEach((row) => {
      const cdfil = Number(row.CDFIL ?? row.cdfil);
      if (cdfil) metasMap[cdfil] = mapMetasLoja(row);
    });

    const faltantes = lista.filter((cdfil) => !metasMap[cdfil]);
    if (faltantes.length) {
      const inFaltantes = faltantes.join(', ');
      let rowsFallback = await fetchMetasLojaRows(conn, `(${inFaltantes})`, dataInicioDdMm, dataFimDdMm, false, true);
      if (!Array.isArray(rowsFallback)) rowsFallback = [];
      rowsFallback.forEach((row) => {
        const cdfil = Number(row.CDFIL ?? row.cdfil);
        if (cdfil) metasMap[cdfil] = mapMetasLoja(row);
      });
    }

    const gruposUnicos = getGruposUnicos('loja');
    const gruposStr = gruposUnicos.join(', ');
    const queryVendas = `
      SELECT CDFIL, 'TOTAL GERAL' AS GRUPO, NULL AS CDGRUPO, SUM(VALOR) AS TOTAL_VALOR
      FROM scevenda
      WHERE CDFIL IN (${inStr}) AND DATA BETWEEN '${dataInicioSafe}' AND '${dataFimSafe}'
      GROUP BY CDFIL
      UNION ALL
      SELECT CDFIL, NULL AS GRUPO, CDGRUPO, SUM(VALOR) AS TOTAL_VALOR
      FROM scevenda
      WHERE CDFIL IN (${inStr}) AND DATA BETWEEN '${dataInicioSafe}' AND '${dataFimSafe}'
        AND CDGRUPO IN (${gruposStr})
      GROUP BY CDFIL, CDGRUPO
    `.trim();
    const [rowsVendas] = await conn.query(queryVendas);
    await conn.end();

    const vendasMap = processarVendasPorLoja(rowsVendas);

    const resposta = {};
    lista.forEach((cdfil) => {
      resposta[cdfil] = {
        metas: metasMap[cdfil] || defaults,
        vendas: vendasMap[cdfil] || initVendasLoja()
      };
    });

    res.json({ success: true, data: { lojas: resposta } });
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/proxy/clientes-ticket - Body: { cdfil, dataInicio, dataFim }
 *  Fonte: apenas API CallFarma (apiv2 – financeiro/vendas-por-filial), igual dashboard_home e callfarma-proxy.php.
 *  Requer CALLFARMA_BASE_URL e CALLFARMA_BEARER no .env. Se não configurado, retorna zeros. */
app.post('/api/proxy/clientes-ticket', async (req, res) => {
  const { cdfil, dataInicio, dataFim } = req.body || {};
  if (!dataInicio || !dataFim) {
    return res.status(400).json({ success: false, error: 'dataInicio e dataFim obrigatórios' });
  }
  const dataIni = normalizeDateInputStrict(dataInicio);
  const dataFimParam = normalizeDateInputStrict(dataFim);

  if (!CALLFARMA_ENABLED || cdfil == null) {
    if (!CALLFARMA_ENABLED) console.warn('[CallFarma] CALLFARMA_BASE_URL ou CALLFARMA_BEARER não definidos no .env');
    return res.json({ success: true, totalClientes: 0, totalVendas: 0, ticketMedio: 0 });
  }

  try {
    const data = await callFarmaVendasPorFilial(cdfil, dataIni, dataFimParam);
    // Aceitar msg em data.msg ou data.data.msg (estrutura alternativa)
    const msg = Array.isArray(data?.msg) ? data.msg : Array.isArray(data?.data?.msg) ? data.data.msg : [];
    const statusOk = data?.status === true || data?.status === 1 || String(data?.status).toLowerCase() === 'true';
    if (msg.length === 0) {
      console.warn('[CallFarma] Resposta com msg vazio. status=', data?.status, 'keys=', data ? Object.keys(data) : [], 'sample=', JSON.stringify(data).slice(0, 600));
    }
    let totalClientes = 0;
    let totalVendas = 0;
    for (const row of msg) {
      // API pode retornar totCli, tot_cli ou TOTCLI
      const cli = row?.totCli ?? row?.tot_cli ?? row?.TOTCLI ?? 0;
      const val = row?.valor ?? row?.valorVendas ?? row?.VALOR ?? 0;
      totalClientes += parseInt(cli, 10) || 0;
      totalVendas += parseFloat(val) || 0;
    }
    const ticketMedio = totalClientes > 0 ? totalVendas / totalClientes : 0;
    res.json({ success: true, totalClientes, totalVendas, ticketMedio });
  } catch (e) {
    console.error('[CallFarma] Erro clientes-ticket:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Banners de pré-venda (CallFarma)
app.get('/api/callfarma/banner-prevendas', async (req, res) => {
  try {
    const { dataIni, dataFim, filtro = '', page = '1', per_page = '50' } = req.query;
    if (!dataIni || !dataFim) {
      return res.status(400).json({ success: false, error: 'dataIni e dataFim são obrigatórios' });
    }
    const params = { dataIni, dataFim, filtro, page, per_page };
    const data = await callFarmaBannerPrevendas(params);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/proxy/consulta-preco/buscar-nome - Body: { termo, filial } */
app.post('/api/proxy/consulta-preco/buscar-nome', async (req, res) => {
  const { termo, filial } = req.body || {};
  const filialNum = Number(filial);
  const termoStr = String(termo || '').trim();

  if (!termoStr || !Number.isFinite(filialNum)) {
    return res.status(400).json({ success: false, error: 'termo e filial obrigatórios' });
  }

  let conn;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const query = `
      SELECT
        p.CDPRODU,
        p.NOME,
        p.PBM,
        COALESCE(e.ESTOQ, 0) as ESTOQUE,
        COALESCE(e.ENDER, 'Não informado') as ENDERECO,
        COALESCE(e.PRECOPOR, e.PRECOMAX, 0) as PRECO,
        COALESCE(e.PRECOMAX, 0) as PRECO_SEM_DESCONTO
      FROM sceprodu p
      LEFT JOIN sceestoq e ON e.CDPRODU = p.CDPRODU AND e.CDFIL = ?
      WHERE p.NOME LIKE ?
        AND p.FGATIVO = 'S'
      ORDER BY COALESCE(e.ESTOQ, 0) DESC, p.NOME
      LIMIT 50
    `.trim();
    const [rows] = await conn.execute(query, [filialNum, `%${termoStr}%`]);
    await conn.end();
    res.json({ success: true, data: rows || [] });
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/proxy/consulta-preco/buscar-preco - Body: { codigo, filial } */
app.post('/api/proxy/consulta-preco/buscar-preco', async (req, res) => {
  const { codigo, filial } = req.body || {};
  const filialNum = Number(filial);
  const codigoStr = String(codigo || '').trim();

  if (!codigoStr || !Number.isFinite(filialNum)) {
    return res.status(400).json({ success: false, error: 'codigo e filial obrigatórios' });
  }

  let conn;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const queryProduto = `
      SELECT
        p.CDPRODU,
        p.NOME,
        p.CDGRUPO,
        p.PBM,
        p.MSGPROM,
        p.LINKPBM,
        g.CDTIPO
      FROM sceprodu p
      LEFT JOIN estwin.tabgrupo g ON g.CDGRUPO = p.CDGRUPO
      WHERE (p.CDPRODU = ?
         OR p.BARRA = ?
         OR p.BAR1 = ?
         OR p.BAR2 = ?
         OR p.BAR3 = ?
         OR p.BAR4 = ?)
        AND p.FGATIVO = 'S'
      LIMIT 1
    `.trim();
    const [prodRows] = await conn.execute(queryProduto, [
      codigoStr,
      codigoStr,
      codigoStr,
      codigoStr,
      codigoStr,
      codigoStr
    ]);

    if (!prodRows || prodRows.length === 0) {
      await conn.end();
      return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    }

    const produto = prodRows[0];
    const cdprodu = produto.CDPRODU;

    const queryDetalhes = `
      SELECT
        e.PRECOMAX,
        e.PRECOPOR,
        e.ENDER,
        e.KITQTD,
        e.PRECOKIT
      FROM sceestoq e
      WHERE e.CDPRODU = ?
        AND e.CDFIL = ?
      LIMIT 1
    `.trim();
    const [detRows] = await conn.execute(queryDetalhes, [cdprodu, filialNum]);
    await conn.end();

    const detalhe = detRows && detRows.length ? detRows[0] : {};
    const detalhes = {
      precoMax: parseFloat(detalhe.PRECOMAX || 0),
      precoPor: parseFloat(detalhe.PRECOPOR || 0) || parseFloat(detalhe.PRECOMAX || 0),
      endereco: detalhe.ENDER || 'Não informado',
      kitQtd: parseInt(detalhe.KITQTD || 0, 10),
      precoKit: parseFloat(detalhe.PRECOKIT || 0)
    };

    let imageUrl = 'https://via.placeholder.com/120?text=Sem+Imagem';
    try {
      const productUrl = `https://callfarma.com.br/produto/${encodeURIComponent(cdprodu)}`;
      const resp = await fetch(productUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0 Safari/537.36'
        }
      });
      const html = await resp.text();
      if (resp.ok && html && !html.includes('Página não encontrada')) {
        let img = '';
        const matchImg = html.match(/<img[^>]*class=["'][^"']*product-pic[^"']*["'][^>]*src=["']([^"']+)["'][^>]*>/is)
          || html.match(/<img[^>]*alt=["'][^"']*Produto[^"']*["'][^>]*src=["']([^"']+)["'][^>]*>/is);
        if (matchImg && matchImg[1]) {
          img = matchImg[1];
        } else {
          const matchSrcset = html.match(/<img[^>]*class=["'][^"']*product-pic[^"']*["'][^>]*srcset=["'][^"']*url=([^&]+)[^"']*["'][^>]*>/is);
          if (matchSrcset && matchSrcset[1]) {
            img = decodeURIComponent(matchSrcset[1]);
          }
        }
        if (img) {
          img = String(img).trim().replace(/&amp;/g, '&');
          if (!/^https?:\/\//i.test(img)) {
            if (img.startsWith('/')) img = `https://callfarma.com.br${img}`;
            else img = `https://callfarma.com.br/${img}`;
          }
          img = img.replace(/([&?])w=\d+/, '$1w=640');
          imageUrl = img;
        }
      }
    } catch (_) {
      // ignore
    }

    res.json({ success: true, data: { produto, detalhes, cdprodu, imageUrl } });
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/proxy/consulta-preco/estoque - Body: { codigo } */
app.post('/api/proxy/consulta-preco/estoque', async (req, res) => {
  const { codigo } = req.body || {};
  const codigoStr = String(codigo || '').trim();
  if (!codigoStr) {
    return res.status(400).json({ success: false, error: 'codigo obrigatório' });
  }

  let conn;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const queryProduto = `
      SELECT
        p.CDPRODU,
        p.NOME
      FROM sceprodu p
      WHERE (p.CDPRODU = ?
         OR p.BARRA = ?
         OR p.BAR1 = ?
         OR p.BAR2 = ?
         OR p.BAR3 = ?
         OR p.BAR4 = ?)
        AND p.FGATIVO = 'S'
      LIMIT 1
    `.trim();
    const [prodRows] = await conn.execute(queryProduto, [
      codigoStr,
      codigoStr,
      codigoStr,
      codigoStr,
      codigoStr,
      codigoStr
    ]);
    if (!prodRows || prodRows.length === 0) {
      await conn.end();
      return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    }
    const produto = prodRows[0];

    const queryEstoque = `
      SELECT
        e.CDFIL,
        COALESCE(e.ESTOQ, 0) AS ESTOQUE,
        COALESCE(e.ENDER, '') AS ENDERECO
      FROM sceestoq e
      WHERE e.CDPRODU = ?
      ORDER BY e.CDFIL
    `.trim();
    const [rows] = await conn.execute(queryEstoque, [produto.CDPRODU]);
    await conn.end();

    res.json({ success: true, data: { produto, estoque: rows || [] } });
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * Função para construir query SQL de vendas de campanhas
 * A query é construída internamente e nunca exposta ao cliente
 */
function construirQueryVendasCampanha(data) {
  const { data_inicio, data_fim, fornecedores, marcas, familias, grupos, produtos, incluir_quantidade } = data;
  
  // Base da query - incluir quantidade se solicitado
  let selectFields = `k.CDFIL,
  SUM(IF(k.TIPO = 'VE', k.VALOR, -k.VALOR)) AS VALOR_TOTAL`;
  
  if (incluir_quantidade === true) {
    selectFields += `,
  SUM(IF(k.TIPO = 'VE', k.QTD, -k.QTD)) AS QUANTIDADE_TOTAL`;
  }
  
  let query = `SELECT
  ${selectFields}
FROM scekarde k FORCE INDEX (idx_scekarde_3)
WHERE k.DATA BETWEEN '${data_inicio}' AND '${data_fim}'
  AND k.TIPO IN ('VE', 'DV')`;

  // Verificar se há filtros de produtos
  const temFiltrosProduto = (fornecedores && fornecedores.length > 0) ||
                           (marcas && marcas.length > 0) ||
                           (familias && familias.length > 0) ||
                           (grupos && grupos.length > 0);

  // Se há filtros de produtos, construir subquery combinada
  if (temFiltrosProduto) {
    query += `\n  AND k.CDPRODU IN (\n    SELECT CDPRODU\n    FROM sceprodu\n    WHERE 1=1`;

    // Filtro por fornecedores
    if (fornecedores && Array.isArray(fornecedores) && fornecedores.length > 0) {
      const fornecedoresStr = fornecedores.map(f => parseInt(f)).join(', ');
      query += `\n      AND CDFORNE IN (${fornecedoresStr})`;
    }

    // Filtro por marcas
    if (marcas && Array.isArray(marcas) && marcas.length > 0) {
      const marcasStr = marcas.map(m => parseInt(m)).join(', ');
      query += `\n      AND CDMARCA IN (${marcasStr})`;
    }

    // Filtro por famílias
    if (familias && Array.isArray(familias) && familias.length > 0) {
      const familiasStr = familias.map(f => parseInt(f)).join(', ');
      query += `\n      AND CDFAMILIA IN (${familiasStr})`;
    }

    // Filtro por grupos
    if (grupos && Array.isArray(grupos) && grupos.length > 0) {
      const gruposStr = grupos.map(g => parseInt(g)).join(', ');
      query += `\n      AND CDGRUPO IN (${gruposStr})`;
    }

    query += `\n  )`;
  }

  // Filtro por produtos específicos (se fornecido e não há outros filtros)
  if (produtos && Array.isArray(produtos) && produtos.length > 0) {
    const produtosStr = produtos.map(p => parseInt(p)).join(', ');
    if (temFiltrosProduto) {
      // Se já tem filtros, substituir pela lista de produtos específicos
      query = query.replace(
        /AND k\.CDPRODU IN \([\s\S]*?\)/,
        `AND k.CDPRODU IN (${produtosStr})`
      );
    } else {
      query += `\n  AND k.CDPRODU IN (${produtosStr})`;
    }
  }

  query += `\nGROUP BY k.CDFIL\nORDER BY k.CDFIL`;

  return query;
}

function construirQueryVendasSelo(data) {
  const { data_inicio, data_fim, produtos, grupos, filial, matricula } = data;
  const produtosStr = Array.isArray(produtos) ? produtos.map(p => parseInt(p)).join(', ') : '';
  const gruposStr = Array.isArray(grupos) ? grupos.map(g => parseInt(g)).join(', ') : '';
  let query = `SELECT
  k.CDFIL as loja,
  k.CDFUN as matricula,
  f.NOME as nome_funcionario,
  SUM(k.VALOR) as valor_total,
  SUM(k.QTD) as quantidade_total,
  GROUP_CONCAT(DISTINCT k.CDPRODU ORDER BY k.CDPRODU SEPARATOR ',') as produtos
FROM scekarde k
JOIN scefun f ON f.CDFUN = k.CDFUN
${gruposStr ? 'JOIN sceprodu p ON p.CDPRODU = k.CDPRODU' : ''}
WHERE ${produtosStr ? `k.CDPRODU IN (${produtosStr})` : `p.CDGRUPO IN (${gruposStr})`}
  AND k.TIPO IN ('VE', 'DV')
  AND k.DATA >= '${data_inicio}'
  AND k.DATA <= '${data_fim}'`;

  if (filial) {
    query += `\n  AND k.CDFIL = ${parseInt(filial)}`;
  }
  if (matricula) {
    query += `\n  AND k.CDFUN = ${parseInt(matricula)}`;
  }

  query += `\nGROUP BY k.CDFIL, k.CDFUN, f.NOME\nORDER BY k.CDFIL, valor_total DESC`;
  return query;
}

function construirQueryDetalhesSelo(data) {
  const { data_inicio, data_fim, produtos, grupos, filial, matricula } = data;
  const produtosStr = Array.isArray(produtos) ? produtos.map(p => parseInt(p)).join(', ') : '';
  const gruposStr = Array.isArray(grupos) ? grupos.map(g => parseInt(g)).join(', ') : '';
  let query = `SELECT
  k.CDFIL as loja,
  k.CDFUN as matricula,
  k.CDPRODU as codigo,
  SUM(k.VALOR) as valor_total
FROM scekarde k
${gruposStr ? 'JOIN sceprodu p ON p.CDPRODU = k.CDPRODU' : ''}
WHERE ${produtosStr ? `k.CDPRODU IN (${produtosStr})` : `p.CDGRUPO IN (${gruposStr})`}
  AND k.TIPO IN ('VE', 'DV')
  AND k.DATA >= '${data_inicio}'
  AND k.DATA <= '${data_fim}'`;

  if (filial) {
    query += `\n  AND k.CDFIL = ${parseInt(filial)}`;
  }
  if (matricula) {
    query += `\n  AND k.CDFUN = ${parseInt(matricula)}`;
  }

  query += `\nGROUP BY k.CDFIL, k.CDFUN, k.CDPRODU\nORDER BY k.CDFIL, k.CDFUN, k.CDPRODU`;
  return query;
}

/**
 * Endpoint para buscar vendas de campanhas
 * POST /api/campanhas_vendas
 * 
 * Body esperado:
 * {
 *   "data_inicio": "2025-11-01",
 *   "data_fim": "2026-01-19",
 *   "fornecedores": [2552, 220, 113],  // Opcional
 *   "marcas": [1, 2, 3],               // Opcional
 *   "familias": [10, 20],              // Opcional
 *   "grupos": [5, 6],                  // Opcional
 *   "produtos": [100, 200],            // Opcional
 *   "incluir_quantidade": true         // Opcional: se true, retorna QUANTIDADE_TOTAL
 * }
 */
app.post('/api/campanhas_vendas', async (req, res) => {
  const { data_inicio, data_fim, fornecedores, marcas, familias, grupos, produtos, incluir_quantidade } = req.body;

  // Validação de parâmetros obrigatórios
  if (!data_inicio || !data_fim) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetros obrigatórios: data_inicio, data_fim'
    });
  }

  // Validação de formato de data (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data_inicio) || !dateRegex.test(data_fim)) {
    return res.status(400).json({
      success: false,
      error: 'Formato de data inválido. Use YYYY-MM-DD'
    });
  }

  // Validar que pelo menos um filtro de produto foi fornecido
  const temFiltros = (fornecedores && fornecedores.length > 0) ||
                    (marcas && marcas.length > 0) ||
                    (familias && familias.length > 0) ||
                    (grupos && grupos.length > 0) ||
                    (produtos && produtos.length > 0);

  if (!temFiltros) {
    return res.status(400).json({
      success: false,
      error: 'É necessário fornecer pelo menos um filtro: fornecedores, marcas, familias, grupos ou produtos'
    });
  }

  // Log dos parâmetros recebidos
  console.log('Campanhas Vendas - Parâmetros recebidos:', {
    data_inicio,
    data_fim,
    fornecedores: fornecedores ? fornecedores.length + ' fornecedores' : 'nenhum',
    marcas: marcas ? marcas.length + ' marcas' : 'nenhuma',
    familias: familias ? familias.length + ' familias' : 'nenhuma',
    grupos: grupos ? grupos.length + ' grupos' : 'nenhum',
    produtos: produtos ? produtos.length + ' produtos' : 'nenhum',
    incluir_quantidade: incluir_quantidade === true ? 'sim' : 'não'
  });

  let conn;
  try {
    if (CALLFARMA_ENABLED) {
      const params = {
        dataIni: data_inicio,
        dataFim: data_fim,
        dataIniAnt: data_inicio,
        dataFimAnt: data_fim,
        groupBy: 'scefilial.CDFIL',
        orderBy: 'TOTAL_VLR_VE desc'
      };
      const toList = (arr) => Array.isArray(arr) ? arr.filter((v) => v !== null && v !== undefined).join(',') : '';
      const f = toList(fornecedores);
      const m = toList(marcas);
      const fa = toList(familias);
      const g = toList(grupos);
      const p = toList(produtos);
      if (f) params.filtroFornecedores = f;
      if (m) params.filtroMarcas = m;
      if (fa) params.filtroFamilias = fa;
      if (g) params.filtroGrupos = g;
      if (p) params.filtroProduto = p;

      const data = await callFarmaVendasPorFuncionario(params);
      const rows = Array.isArray(data) ? data : [];
      const mapped = rows.map((row) => ({
        CDFIL: row.CDFIL ?? row.cdfil ?? row.CDFILIAL ?? row.cdfilial,
        VALOR_TOTAL: Number(row.TOTAL_VLR_VE ?? row.TOTAL_VALOR ?? row.valor ?? 0) || 0,
        QUANTIDADE_TOTAL: Number(row.TOTAL_QTD_VE ?? row.TOTAL_QUANTIDADE ?? row.quantidade ?? 0) || 0
      })).filter((row) => row.CDFIL !== undefined && row.CDFIL !== null);

      let valorTotal = 0;
      let quantidadeTotal = 0;
      mapped.forEach((row) => {
        valorTotal += Number(row.VALOR_TOTAL || 0);
        if (incluir_quantidade === true) {
          quantidadeTotal += Number(row.QUANTIDADE_TOTAL || 0);
        }
      });

      const response = {
        success: true,
        data: mapped,
        total_lojas: mapped.length,
        valor_total: valorTotal
      };
      if (incluir_quantidade === true) response.quantidade_total = quantidadeTotal;
      return res.json(response);
    }
    // Construir query SQL (internamente, nunca exposta)
    const query = construirQueryVendasCampanha({
      data_inicio,
      data_fim,
      fornecedores,
      marcas,
      familias,
      grupos,
      produtos,
      incluir_quantidade
    });

    // Log da query completa (apenas para debug)
    console.log('Campanhas Vendas - Query completa:');
    console.log(query);

    // Conectar ao MySQL
    conn = await mysql.createConnection(MYSQL_CONFIG);
    
    // Executar query
    const startTime = Date.now();
    const [rows] = await conn.query(query);
    const executionTime = Date.now() - startTime;
    
    // Fechar conexão
    await conn.end();

    // Log dos resultados
    console.log('Campanhas Vendas - Resultados:', {
      total_rows: rows ? rows.length : 0,
      sample_row: rows && rows.length > 0 ? rows[0] : null
    });

    // Calcular totais
    let valorTotal = 0;
    let quantidadeTotal = 0;
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        const valor = parseFloat(row.VALOR_TOTAL || 0);
        valorTotal += valor;
        if (incluir_quantidade === true && row.QUANTIDADE_TOTAL !== undefined) {
          const quantidade = parseFloat(row.QUANTIDADE_TOTAL || 0);
          quantidadeTotal += quantidade;
          console.log(`Campanhas Vendas - Loja ${row.CDFIL}: VALOR_TOTAL = ${valor}, QUANTIDADE_TOTAL = ${quantidade}`);
        } else {
          console.log(`Campanhas Vendas - Loja ${row.CDFIL}: VALOR_TOTAL = ${valor}`);
        }
      });
    }

    console.log('Campanhas Vendas - Valor Total Calculado:', valorTotal);
    if (incluir_quantidade === true) {
      console.log('Campanhas Vendas - Quantidade Total Calculada:', quantidadeTotal);
    }

    // Retornar resposta formatada
    const response = {
      success: true,
      data: rows || [],
      total_lojas: rows ? rows.length : 0,
      valor_total: valorTotal,
      execution_time_ms: executionTime
    };
    
    // Incluir quantidade_total na resposta se foi solicitado
    if (incluir_quantidade === true) {
      response.quantidade_total = quantidadeTotal;
    }
    
    res.json(response);

  } catch (e) {
    // Log do erro
    console.error('Campanhas Vendas - Erro:', e.message);
    
    // Fechar conexão se ainda estiver aberta
    if (conn) {
      try {
        await conn.end();
      } catch (err) {
        // Ignorar erro ao fechar
      }
    }

    // Retornar erro
    res.status(500).json({
      success: false,
      error: 'Erro ao executar query: ' + e.message,
      execution_time_ms: 0
    });
  }
});

// Campanhas: vendas por colaborador (CallFarma)
app.post('/api/campanhas_vendas_colaboradores', async (req, res) => {
  try {
    if (!CALLFARMA_ENABLED) {
      return res.status(500).json({ success: false, error: 'CALLFARMA não configurada' });
    }
    const { data_inicio, data_fim, fornecedores, marcas, familias, grupos, produtos } = req.body || {};
    if (!data_inicio || !data_fim) {
      return res.status(400).json({ success: false, error: 'data_inicio e data_fim obrigatórios' });
    }

    const params = {
      dataIni: data_inicio,
      dataFim: data_fim,
      dataIniAnt: data_inicio,
      dataFimAnt: data_fim,
      groupBy: 'scefun.CDFUN,scefilial.CDFIL',
      orderBy: 'TOTAL_VLR_VE desc'
    };

    const toList = (arr) => Array.isArray(arr) ? arr.filter((v) => v !== null && v !== undefined).join(',') : '';
    const f = toList(fornecedores);
    const m = toList(marcas);
    const fa = toList(familias);
    const g = toList(grupos);
    const p = toList(produtos);
    if (f) params.filtroFornecedores = f;
    if (m) params.filtroMarcas = m;
    if (fa) params.filtroFamilias = fa;
    if (g) params.filtroGrupos = g;
    if (p) params.filtroProduto = p;

    const data = await callFarmaVendasPorFuncionario(params);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * Endpoint para buscar vendas de selos (CashGold / GoodSale)
 * POST /api/selos/vendas
 *
 * Body esperado:
 * {
 *   "data_inicio": "2025-11-01",
 *   "data_fim": "2026-01-19",
 *   "produtos": [100, 200],
 *   "filial": 22,        // opcional
 *   "matricula": 1234    // opcional
 * }
 */
app.post('/api/selos/vendas', async (req, res) => {
  const { data_inicio, data_fim, produtos, grupos, filial, matricula } = req.body;

  if (!data_inicio || !data_fim) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetros obrigatórios: data_inicio, data_fim'
    });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data_inicio) || !dateRegex.test(data_fim)) {
    return res.status(400).json({
      success: false,
      error: 'Formato de data inválido. Use YYYY-MM-DD'
    });
  }

  const temProdutos = Array.isArray(produtos) && produtos.length > 0;
  const temGrupos = Array.isArray(grupos) && grupos.length > 0;
  if (!temProdutos && !temGrupos) {
    return res.status(400).json({
      success: false,
      error: 'É necessário fornecer produtos ou grupos'
    });
  }

  let conn;
  try {
    const query = construirQueryVendasSelo({ data_inicio, data_fim, produtos, grupos, filial, matricula });
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const startTime = Date.now();
    const [rows] = await conn.query(query);
    const executionTime = Date.now() - startTime;
    const produtosSet = new Set();
    (rows || []).forEach((row) => {
      const lista = String(row.produtos || '')
        .split(',')
        .map((p) => parseInt(String(p).trim(), 10))
        .filter((p) => Number.isFinite(p));
      lista.forEach((p) => produtosSet.add(p));
    });

    const produtosArray = Array.from(produtosSet);
    let nomesMap = {};
    if (produtosArray.length > 0) {
      const [nomesRows] = await conn.query(
        `SELECT CDPRODU, NOME FROM sceprodu WHERE CDPRODU IN (${produtosArray.join(',')})`
      );
      nomesMap = {};
      (nomesRows || []).forEach((item) => {
        nomesMap[String(item.CDPRODU)] = item.NOME;
      });
    }

    let detalhesMap = new Map();
    const queryDetalhes = construirQueryDetalhesSelo({ data_inicio, data_fim, produtos, grupos, filial, matricula });
    const [detalhesRows] = await conn.query(queryDetalhes);
    (detalhesRows || []).forEach((row) => {
      const key = `${row.loja}|${row.matricula}`;
      if (!detalhesMap.has(key)) detalhesMap.set(key, []);
      detalhesMap.get(key).push({
        codigo: Number(row.codigo),
        nome: nomesMap[String(row.codigo)] || null,
        valor_total: Number(row.valor_total || 0)
      });
    });

    (rows || []).forEach((row) => {
      const key = `${row.loja}|${row.matricula}`;
      const detalhes = detalhesMap.get(key);
      if (detalhes && detalhes.length) {
        row.produtos_detalhes = detalhes;
        row.produtos = detalhes.map((d) => d.codigo).join(',');
        return;
      }
      const lista = String(row.produtos || '')
        .split(',')
        .map((p) => parseInt(String(p).trim(), 10))
        .filter((p) => Number.isFinite(p));
      row.produtos_detalhes = lista.map((codigo) => ({
        codigo,
        nome: nomesMap[String(codigo)] || null,
        valor_total: 0
      }));
    });

    await conn.end();

    res.json({
      success: true,
      data: rows || [],
      total_linhas: rows ? rows.length : 0,
      execution_time_ms: executionTime
    });
  } catch (e) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    res.status(500).json({
      success: false,
      error: 'Erro ao executar query: ' + e.message,
      execution_time_ms: 0
    });
  }
});

/**
 * Endpoint para verificar status da loja (mercadoria em trânsito, notas pendentes, caixas CB)
 * POST /api/verificar_status_loja
 * 
 * Body esperado:
 * {
 *   "loja_id": 22
 * }
 * 
 * Retorna:
 * {
 *   "success": true,
 *   "tem_alerta": true,
 *   "nivel_alerta": "vermelho", // "amarelo" ou "vermelho"
 *   "alertas": {
 *     "transito": {
 *       "tem_alerta": true,
 *       "nivel": "vermelho",
 *       "quantidade_documentos": 5,
 *       "mais_antiga_dias": 12,
 *       "mensagem": "5 documentos em trânsito há 10+ dias"
 *     },
 *     "notas_pendentes": {
 *       "tem_alerta": true,
 *       "nivel": "amarelo",
 *       "quantidade_notas": 3,
 *       "mais_antiga_dias": 6,
 *       "mensagem": "3 notas pendentes há 6 dias"
 *     }
 *   }
 * }
 * 
 * LÓGICA DE ALERTAS:
 * - Trânsito: 9 dias = amarelo, 10+ dias = vermelho
 * - Notas: 6 dias = amarelo, 7+ dias = vermelho
 * - Caixas CB: >5 dias = vermelho, pendente <=5 dias = amarelo
 */
app.post('/api/verificar_status_loja', async (req, res) => {
  const { loja_id } = req.body;

  // Validação
  if (!loja_id) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetro obrigatório: loja_id'
    });
  }

  const lojaIdInt = parseInt(loja_id);
  if (isNaN(lojaIdInt)) {
    return res.status(400).json({
      success: false,
      error: 'loja_id deve ser um número válido'
    });
  }

  console.log('Verificar Status Loja - Loja ID:', lojaIdInt);

  let conn;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);

    // Query para mercadoria em trânsito (STATUS = 'A' significa pendente/ativo)
    // Agrupa por NUMDOC para contar documentos, não itens
    const queryTransito = `
      SELECT 
        NUMDOC,
        MIN(DATA) as DATA_MAIS_ANTIGA,
        DATEDIFF(CURDATE(), MIN(DATA)) as DIAS_TRANSITO
      FROM scetransito 
      WHERE STATUS = 'A' 
        AND CDFIL = ${lojaIdInt}
      GROUP BY NUMDOC
      ORDER BY DATA_MAIS_ANTIGA ASC
    `;

    // Query para notas pendentes (VALIDADA = 'N' significa não validada)
    // Agrupa por NRNOTA para contar notas, não itens
    const queryNotasPendentes = `
      SELECT 
        NRNOTA,
        MIN(DATA) as DATA_MAIS_ANTIGA,
        DATEDIFF(CURDATE(), MIN(DATA)) as DIAS_PENDENTE
      FROM sceent 
      WHERE VALIDADA = 'N' 
        AND CDFIL = ${lojaIdInt}
      GROUP BY NRNOTA
      ORDER BY DATA_MAIS_ANTIGA ASC
    `;

    // Query para caixas CB pendentes (baseado no SQL fornecido)
    const queryCaixasCb = `
      SELECT
        a.NRPEDIDO,
        a.CDFILD,
        a.DATA,
        b.CDCAIXA,
        b.DATARECFIL,
        b.HORARECFIL,
        b.DATACONFFIL,
        b.HORACONFFIL,
        b.OPERSCAN,
        b.HORASCAN,
        b.DATASCAN,
        b.STATUS_BAIXA,
        b.STATUS,
        a.FGSTATUS,
        DATEDIFF(CURDATE(), a.DATA) AS DIAS_PENDENTE
      FROM scepedc a
      JOIN scepedcaixa b ON a.NRPEDIDO = b.NRPEDIDO
      WHERE a.CDFILD = ${lojaIdInt}
        AND DATE_FORMAT(a.DATA,'%Y/%m/%d') >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 30 DAY),'%Y/%m/%d')
        AND DATE_FORMAT(a.DATA,'%Y/%m/%d') <= DATE_FORMAT(CURDATE(),'%Y/%m/%d')
        AND ((a.FGSTATUS = 3) OR (b.DATARECFIL <> '' AND b.STATUS_BAIXA = 'A'))
        AND b.STATUS <> 'E'
        AND b.STATUS <> 'D'
      ORDER BY a.NRPEDIDO, b.CDCAIXA
    `;

    // Executar queries em paralelo
    const [rowsTransito] = await conn.query(queryTransito);
    const [rowsNotasPendentes] = await conn.query(queryNotasPendentes);
    const [rowsCaixasCb] = await conn.query(queryCaixasCb);

    await conn.end();

    // ========================================
    // PROCESSAR MERCADORIA EM TRÂNSITO
    // ========================================
    const transitoData = Array.isArray(rowsTransito) ? rowsTransito : [];
    
    // Lógica: 9 dias = amarelo, 10+ dias = vermelho
    const transitoVermelho = transitoData.filter(t => t.DIAS_TRANSITO >= 10);
    const transitoAmarelo = transitoData.filter(t => t.DIAS_TRANSITO === 9);
    const transitoComAlerta = transitoData.filter(t => t.DIAS_TRANSITO >= 9);
    
    const transitoMaisAntigo = transitoData.length > 0 ? Math.max(...transitoData.map(t => t.DIAS_TRANSITO)) : 0;
    
    let nivelTransito = null;
    let mensagemTransito = '';
    
    if (transitoVermelho.length > 0) {
      nivelTransito = 'vermelho';
      mensagemTransito = `${transitoVermelho.length} documento${transitoVermelho.length > 1 ? 's' : ''} em trânsito há 10+ dias (mais antigo: ${transitoMaisAntigo} dias)`;
    } else if (transitoAmarelo.length > 0) {
      nivelTransito = 'amarelo';
      mensagemTransito = `${transitoAmarelo.length} documento${transitoAmarelo.length > 1 ? 's' : ''} em trânsito há 9 dias`;
    }

    const alertaTransito = {
      tem_alerta: transitoComAlerta.length > 0,
      nivel: nivelTransito,
      quantidade_documentos: transitoComAlerta.length,
      quantidade_vermelho: transitoVermelho.length,
      quantidade_amarelo: transitoAmarelo.length,
      total: transitoData.length,
      mais_antiga_dias: transitoMaisAntigo,
      mensagem: mensagemTransito
    };

    // ========================================
    // PROCESSAR NOTAS PENDENTES
    // ========================================
    const notasPendentesData = Array.isArray(rowsNotasPendentes) ? rowsNotasPendentes : [];
    
    // Lógica: 6 dias = amarelo, 7+ dias = vermelho
    const notasVermelho = notasPendentesData.filter(n => n.DIAS_PENDENTE >= 7);
    const notasAmarelo = notasPendentesData.filter(n => n.DIAS_PENDENTE === 6);
    const notasComAlerta = notasPendentesData.filter(n => n.DIAS_PENDENTE >= 6);
    
    const notaMaisAntiga = notasPendentesData.length > 0 ? Math.max(...notasPendentesData.map(n => n.DIAS_PENDENTE)) : 0;
    
    let nivelNotas = null;
    let mensagemNotas = '';
    
    if (notasVermelho.length > 0) {
      nivelNotas = 'vermelho';
      mensagemNotas = `${notasVermelho.length} nota${notasVermelho.length > 1 ? 's' : ''} pendente${notasVermelho.length > 1 ? 's' : ''} há 7+ dias (mais antiga: ${notaMaisAntiga} dias)`;
    } else if (notasAmarelo.length > 0) {
      nivelNotas = 'amarelo';
      mensagemNotas = `${notasAmarelo.length} nota${notasAmarelo.length > 1 ? 's' : ''} pendente${notasAmarelo.length > 1 ? 's' : ''} há 6 dias`;
    }

    const alertaNotasPendentes = {
      tem_alerta: notasComAlerta.length > 0,
      nivel: nivelNotas,
      quantidade_notas: notasComAlerta.length,
      quantidade_vermelho: notasVermelho.length,
      quantidade_amarelo: notasAmarelo.length,
      total: notasPendentesData.length,
      mais_antiga_dias: notaMaisAntiga,
      mensagem: mensagemNotas
    };

    // ========================================
    // PROCESSAR CAIXAS CB PENDENTES
    // ========================================
    const caixasCbData = Array.isArray(rowsCaixasCb) ? rowsCaixasCb : [];
    // Filtrar apenas caixas da filial correta e pendentes (STATUS_BAIXA = 'A')
    const caixasCbPendentesData = caixasCbData.filter(c => String(c.CDFILD) === String(lojaIdInt) && String(c.STATUS_BAIXA || '').toUpperCase() === 'A');
    // Só considerar alerta se DIAS_PENDENTE >= 5
    // Prazo: amarelo 5 dias, vermelho 6+ dias
    const caixasCbAmarelo = caixasCbPendentesData.filter(c => c.DIAS_PENDENTE === 5);
    const caixasCbVermelho = caixasCbPendentesData.filter(c => c.DIAS_PENDENTE >= 6);
    const caixasCbComAlerta = [...caixasCbAmarelo, ...caixasCbVermelho];
    const caixasCbMaisAntiga = caixasCbPendentesData.length > 0 ? Math.max(...caixasCbPendentesData.map(c => c.DIAS_PENDENTE)) : 0;

    let nivelCaixasCb = null;
    let mensagemCaixasCb = '';

    if (caixasCbVermelho.length > 0) {
      nivelCaixasCb = 'vermelho';
      mensagemCaixasCb = `${caixasCbVermelho.length} caixa${caixasCbVermelho.length > 1 ? 's' : ''} CB pendente${caixasCbVermelho.length > 1 ? 's' : ''} há 6+ dias (mais antiga: ${caixasCbMaisAntiga} dias)`;
    } else if (caixasCbAmarelo.length > 0) {
      nivelCaixasCb = 'amarelo';
      mensagemCaixasCb = `${caixasCbAmarelo.length} caixa${caixasCbAmarelo.length > 1 ? 's' : ''} CB pendente${caixasCbAmarelo.length > 1 ? 's' : ''} há 5 dias`;
    }

    const alertaCaixasCb = {
      tem_alerta: caixasCbComAlerta.length > 0,
      nivel: nivelCaixasCb,
      quantidade_caixas: caixasCbComAlerta.length,
      quantidade_5_dias: caixasCbAmarelo.length,
      quantidade_6_ou_mais: caixasCbVermelho.length,
      mais_antiga_dias: caixasCbMaisAntiga,
      total_pendentes: caixasCbPendentesData.length,
      mensagem: mensagemCaixasCb
    };

    // ========================================
    // DETERMINAR NÍVEL GERAL DO ALERTA
    // ========================================
    const temAlerta = alertaTransito.tem_alerta || alertaNotasPendentes.tem_alerta || alertaCaixasCb.tem_alerta;
    let nivelAlertaGeral = null;
    
    if (nivelTransito === 'vermelho' || nivelNotas === 'vermelho' || nivelCaixasCb === 'vermelho') {
      nivelAlertaGeral = 'vermelho';
    } else if (nivelTransito === 'amarelo' || nivelNotas === 'amarelo' || nivelCaixasCb === 'amarelo') {
      nivelAlertaGeral = 'amarelo';
    }

    console.log('Verificar Status Loja - Resultado:', {
      loja_id: lojaIdInt,
      tem_alerta: temAlerta,
      nivel_alerta: nivelAlertaGeral,
      transito: {
        total: transitoData.length,
        com_alerta: transitoComAlerta.length,
        vermelho: transitoVermelho.length,
        amarelo: transitoAmarelo.length
      },
      notas: {
        total: notasPendentesData.length,
        com_alerta: notasComAlerta.length,
        vermelho: notasVermelho.length,
        amarelo: notasAmarelo.length
      },
      caixas_cb: {
        total: caixasCbData.length,
        com_alerta: alertaCaixasCb.quantidade_caixas,
        amarelo: alertaCaixasCb.quantidade_5_dias,
        vermelho: alertaCaixasCb.quantidade_6_ou_mais
      }
    });

    res.json({
      success: true,
      tem_alerta: temAlerta,
      nivel_alerta: nivelAlertaGeral,
      alertas: {
        transito: alertaTransito,
        notas_pendentes: alertaNotasPendentes,
        caixas_cb: alertaCaixasCb
      }
    });

  } catch (e) {
    console.error('Verificar Status Loja - Erro:', e.message);
    
    if (conn) {
      try {
        await conn.end();
      } catch (err) {
        // Ignorar erro ao fechar
      }
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao verificar status da loja: ' + e.message
    });
  }
});

app.get('/api/health', (req, res) => {
  console.log(`[${new Date().toISOString()}] GET /api/health`);
  res.json({ status: 'ok', message: 'Proxy Node rodando!' });
});

// Rota 404 para qualquer outra rota (evita requisição ficar pendurada)
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor proxy rodando em http://0.0.0.0:${PORT}`);
  console.log(`Teste: curl http://127.0.0.1:${PORT}/api/health`);
});
