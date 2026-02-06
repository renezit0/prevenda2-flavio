import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.seellbr.com/vendascall/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const PROXY_API_URL = process.env.REACT_APP_PROXY_URL || 'https://api.seellbr.com/api';
const apiProxy = axios.create({
  baseURL: PROXY_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

function addAuthToken(config) {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}

api.interceptors.request.use(addAuthToken, (e) => Promise.reject(e));
apiProxy.interceptors.request.use(addAuthToken, (e) => Promise.reject(e));
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (error.config?.url?.includes('/auth/verify-remember-token')) {
        localStorage.removeItem('rememberToken');
      }
    }
    return Promise.reject(error);
  }
);

// Serviço de autenticação
export const authService = {
  login: async (usuario, senha, lembrar = false) => {
    const response = await api.post('/auth/login', {
      usuario,
      senha,
      lembrar
    });
    if (response.data?.status === 'sucesso' && response.data?.token) {
      localStorage.setItem('token', response.data.token);
      if (response.data.rememberToken) {
        localStorage.setItem('rememberToken', response.data.rememberToken);
      } else {
        localStorage.removeItem('rememberToken');
      }
    }
    return response.data;
  },

  logout: async () => {
    const rememberToken = localStorage.getItem('rememberToken');
    try {
      const response = await api.post('/auth/logout', { rememberToken });
      return response.data;
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('rememberToken');
    }
  },

  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  verifyRememberToken: async (token) => {
    const response = await api.post('/auth/verify-remember-token', { token });
    if (response.data?.status === 'sucesso' && response.data?.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await api.get('/auth/me');
        if (response.data?.status === 'sucesso' && response.data?.usuario) {
          return { autenticado: true, usuario: response.data.usuario };
        }
      } catch {
        localStorage.removeItem('token');
      }
    }

    const rememberToken = localStorage.getItem('rememberToken');
    if (rememberToken) {
      try {
        const response = await api.post('/auth/verify-remember-token', { token: rememberToken });
        if (response.data?.status === 'sucesso' && response.data?.usuario) {
          if (response.data.token) localStorage.setItem('token', response.data.token);
          return { autenticado: true, usuario: response.data.usuario };
        }
      } catch {
        localStorage.removeItem('rememberToken');
      }
    }

    return { autenticado: false };
  }
};

// Serviço de lojas
export const lojasService = {
  getLojas: async () => {
    const response = await api.get('/lojas');
    if (response.data?.status === 'success' && Array.isArray(response.data.lojas)) {
      return response.data.lojas;
    }
    return [];
  }
};

// Serviço de queries CallFarma
export const queryService = {
  execute: async (query) => {
    const response = await apiProxy.post('/query', { query });
    if (response.data && response.data.success && response.data.data && response.data.data.status) {
      return response.data.data.data;
    }
    return [];
  }
};

export const bannersService = {
  async listar({ dataIni, dataFim, page = 1, perPage = 50, filtro = '' } = {}) {
    const response = await axios.get('https://api.seellbr.com/api/callfarma/banner-prevendas', {
      params: {
        dataIni,
        dataFim,
        filtro,
        page,
        per_page: perPage
      }
    });
    if (response.data?.success) {
      return response.data.data;
    }
    return null;
  }
};

// Serviço de busca de produtos
export const produtoService = {
  buscarPorNome: async (nome, filial) => {
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
      LEFT JOIN sceestoq e ON e.CDPRODU = p.CDPRODU AND e.CDFIL = ${filial}
      WHERE p.NOME LIKE '%${nome}%'
        AND p.FGATIVO = 'S'
      ORDER BY COALESCE(e.ESTOQ, 0) DESC, p.NOME
      LIMIT 50
    `;
    return queryService.execute(query);
  },

  buscarPreco: async (codigo, filial) => {
    const response = await apiProxy.post('/proxy/consulta-preco/buscar-preco', {
      codigo,
      filial
    });

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error(response.data?.message || 'Erro ao consultar preço');
  },

  buscarEstoque: async (codigo) => {
    const query = `
      SELECT
        e.CDFIL,
        COALESCE(e.ESTOQ, 0) as ESTOQUE,
        e.ENDER
      FROM sceestoq e
      WHERE e.CDPRODU = '${codigo}'
      ORDER BY e.CDFIL
    `;
    return queryService.execute(query);
  },

  buscarHistorico: async (codigo, filial, dataIni, dataFim) => {
    const query = `
      SELECT
        k.DATA,
        k.HORA,
        k.CDFUN,
        k.CDOPE,
        k.TIPO,
        k.CDFORNE,
        k.QTD,
        k.DOC,
        k.ESTOQU,
        k.LOTE,
        k.nRECF,
        k.nrCPF
      FROM scekarde k
      WHERE k.CDFIL = ${filial}
        AND k.CDPRODU IN (
          SELECT CDPRODU
          FROM sceprodu
          WHERE CDPRODU = '${codigo}'
             OR BARRA = '${codigo}'
             OR BAR1  = '${codigo}'
             OR BAR2  = '${codigo}'
             OR BAR3  = '${codigo}'
             OR BAR4  = '${codigo}'
        )
        AND k.DATA >= '${dataIni}'
        AND k.DATA <= '${dataFim}'
      ORDER BY k.DATA ASC, k.HORA ASC
      LIMIT 100
    `;
    return queryService.execute(query);
  }
};

// Serviço de devolução
export const devolucaoService = {
  buscarProduto: async (codigo, filial) => {
    const query = `
      SELECT
        sceprodu.*,
        sceforne.desconto as descfor,
        sceforne.CDCOMPRADOR,
        sceforne.ABREV as FORNECEDOR
      FROM sceprodu, sceforne
      WHERE (sceprodu.CDPRODU = '${codigo}'
        OR sceprodu.BARRA = '${codigo}'
        OR sceprodu.BAR1 = '${codigo}'
        OR sceprodu.BAR2 = '${codigo}'
        OR sceprodu.BAR3 = '${codigo}'
        OR sceprodu.BAR4 = '${codigo}')
        AND sceprodu.CDFORNE = sceforne.CDFORNE
      LIMIT 1
    `;
    const result = await queryService.execute(query);
    return result && result.length > 0 ? result[0] : null;
  },

  buscarNFEs: async (cdprodu, filial) => {
    const query = `
      SELECT
        a.NRNOTA,
        a.QTD,
        a.DATACONF,
        b.ABREV,
        a.ENDERECO,
        a.CDFORNE,
        a.NRSERIE,
        a.QTDEMB,
        (
          SELECT i.CHAVENFE
          FROM sceitensnfent i
          WHERE i.CDEMP = a.CDEMP
            AND i.CDFIL = a.CDFIL
            AND i.CDFORNE = a.CDFORNE
            AND i.NRNOTA = a.NRNOTA
            AND i.SERIE = a.NRSERIE
          LIMIT 1
        ) AS CHAVENFE,
        (
          SELECT e.VLRUNI
          FROM sceent e
          WHERE e.CDEMP = a.CDEMP
            AND e.CDFIL = a.CDFIL
            AND e.CDFORNE = a.CDFORNE
            AND e.NRNOTA = a.NRNOTA
            AND e.CDPRODU = a.CDPRODU
          LIMIT 1
        ) AS VLRUNI
      FROM sceentconf a
      JOIN sceforne b ON b.CDFORNE = a.CDFORNE
      WHERE a.CDEMP = '1'
        AND a.CDFIL = ${filial}
        AND a.CDPRODU = '${cdprodu}'
      ORDER BY a.DATACONF DESC
      LIMIT 10
    `;
    return queryService.execute(query);
  },

  verificarDevolucao: async (chavenfe, cdprodu) => {
    const query = `
      SELECT *
      FROM sceitensnfent
      WHERE CHAVENFE = '${chavenfe}'
        AND CDPRODU = ${cdprodu}
    `;
    const result = await queryService.execute(query);
    return result && result.length > 0 ? result[0] : null;
  },

  buscarPedidos: async (cdprodu, filial) => {
    const query = `
      SELECT
        a.NRPEDIDO,
        a.QTD,
        a.DATA,
        a.VLRPED,
        b.ABREV,
        b.CDCOMPRADOR
      FROM scepedf a, sceforne b, scepedfc c
      WHERE a.CDEMP = '1'
        AND a.CDFIL = ${filial}
        AND a.CDPRODU = '${cdprodu}'
        AND a.CDFORNE = b.CDFORNE
        AND a.NRPEDIDO = c.NRPEDIDO
      ORDER BY a.DATA DESC
      LIMIT 6
    `;
    return queryService.execute(query);
  }
};

// Serviço de comparativo de balanço (inventário EI/SI)
let _balancoCostFieldCache = null; // { table: 'sceestoq'|'sceprodu', column: string }

const BALANCO_COST_PRIORITY = [
  { table: 'sceestoq', column: 'CUSMED' },
  { table: 'sceestoq', column: 'CUSMEDIO' },
  { table: 'sceestoq', column: 'CUSTMED' },
  { table: 'sceestoq', column: 'CUSTO_MEDIO' },
  { table: 'sceestoq', column: 'CUSMEDI' },
  { table: 'sceprodu', column: 'CUSMED' },
  { table: 'sceprodu', column: 'CUSMEDIO' },
  { table: 'sceprodu', column: 'CUSLIQ' }
];

async function detectarColunaCustoMedio() {
  if (_balancoCostFieldCache) return _balancoCostFieldCache;

  const tables = [...new Set(BALANCO_COST_PRIORITY.map((c) => c.table))];
  const cols = [...new Set(BALANCO_COST_PRIORITY.map((c) => c.column))];

  // MySQL/MariaDB: INFORMATION_SCHEMA + DATABASE() funcionam bem nesse cenário
  const query = `
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('${tables.join("','")}')
      AND COLUMN_NAME IN ('${cols.join("','")}')
  `;

  let found = [];
  try {
    found = await queryService.execute(query);
  } catch (e) {
    // Se falhar, usa fallback conhecido no projeto (CUSLIQ)
    _balancoCostFieldCache = { table: 'sceprodu', column: 'CUSLIQ' };
    return _balancoCostFieldCache;
  }

  const foundSet = new Set((found || []).map((r) => `${String(r.TABLE_NAME).toLowerCase()}|${String(r.COLUMN_NAME).toUpperCase()}`));
  const pick = BALANCO_COST_PRIORITY.find((c) => foundSet.has(`${c.table}|${c.column}`));
  _balancoCostFieldCache = pick || { table: 'sceprodu', column: 'CUSLIQ' };
  return _balancoCostFieldCache;
}

export const balancoService = {
  buscarMovimentosInventario: async ({ filial, data }) => {
    const fil = Number(filial);
    if (!fil || !data) return [];

    const costField = await detectarColunaCustoMedio();
    const custoExpr =
      costField.table === 'sceestoq'
        ? `COALESCE(e.${costField.column}, p.CUSLIQ, 0)`
        : `COALESCE(p.${costField.column}, p.CUSLIQ, 0)`;

    const query = `
      SELECT
        k.CDFIL,
        k.DATA,
        k.TIPO,
        k.CDPRODU,
        k.QTD,
        k.ESTOQU,
        p.NOME AS NOME_PRODUTO,
        ${custoExpr} AS CUSTO_MEDIO,
        COALESCE(e.ESTOQ, 0) AS ESTOQUE_ATUAL
      FROM scekarde k
      LEFT JOIN sceprodu p ON p.CDPRODU = k.CDPRODU
      LEFT JOIN sceestoq e ON e.CDPRODU = k.CDPRODU AND e.CDFIL = k.CDFIL
      WHERE k.CDFIL = ${fil}
        AND k.TIPO IN ('EI', 'SI')
        AND k.DATA = '${data}'
      ORDER BY k.CDPRODU
    `;

    return queryService.execute(query);
  }
};

export default api;
