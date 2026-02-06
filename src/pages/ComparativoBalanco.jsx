import React, { useEffect, useMemo, useState } from 'react';
import CustomSelect from '../components/CustomSelect';
import { balancoService, lojasService } from '../services/api';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import '../styles/ComparativoBalanco.css';

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pad2 = (n) => String(n).padStart(2, '0');

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const isoAddDays = (iso, days) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};

const formatDateBR = (iso) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNum(value));

const palette = {
  danger: '#ef4444',
  warn: '#f59e0b',
  info: '#3b82f6',
  indigo: '#6366f1',
  success: '#10b981',
  grid: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280'
};

const getDir = (net) => {
  if (net > 0) return 'SOBRA';
  if (net < 0) return 'FALTA';
  return 'NEUTRO';
};

const getBadge = (tipo) => {
  if (tipo === 'CONTAGEM_INCORRETA') return { label: 'Contagem incorreta', bg: '#fee2e2', fg: '#991b1b', icon: 'fa-triangle-exclamation' };
  if (tipo === 'REINCIDENCIA') return { label: 'Reincidência', bg: '#fef3c7', fg: '#92400e', icon: 'fa-rotate-left' };
  if (tipo === 'MISTO') return { label: 'Misto', bg: '#e0e7ff', fg: '#3730a3', icon: 'fa-circle-nodes' };
  return { label: 'Neutro', bg: '#f3f4f6', fg: '#374151', icon: 'fa-minus' };
};

const TooltipBox = ({ active, payload, label, formatterLabel }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="balanco-tooltip">
      {label != null && (
        <div className="balanco-tooltip-title">
          {formatterLabel ? formatterLabel(label) : label}
        </div>
      )}
      <div className="balanco-tooltip-body">
        {payload.map((p, idx) => (
          <div key={idx} className="balanco-tooltip-row">
            <span className="balanco-tooltip-dot" style={{ background: p.color }} />
            <span className="balanco-tooltip-name">{p.name || p.dataKey}</span>
            <span className="balanco-tooltip-value">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ComparativoBalanco = ({ userData }) => {
  const [lojas, setLojas] = useState([]);
  const [filial, setFilial] = useState(userData?.loja_id || 22);
  const [dataA, setDataA] = useState(isoAddDays(isoToday(), -1));
  const [dataB, setDataB] = useState(isoAddDays(isoToday(), -2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rawA, setRawA] = useState([]);
  const [rawB, setRawB] = useState([]);
  const [filtroGrupo, setFiltroGrupo] = useState('TODOS'); // TODOS | CONTAGEM_INCORRETA | REINCIDENCIA
  const [search, setSearch] = useState('');

  useEffect(() => {
    const carregarLojas = async () => {
      try {
        const lojasResponse = await lojasService.getLojas();
        const lojasOrdenadas = (lojasResponse || []).sort((a, b) => a.numero - b.numero);
        setLojas(lojasOrdenadas);
      } catch (err) {
        console.error('Erro ao carregar lojas:', err);
      }
    };
    carregarLojas();
  }, []);

  useEffect(() => {
    if (userData?.loja_id) setFilial(userData.loja_id);
  }, [userData?.loja_id]);

  const processar = async () => {
    setError('');
    setLoading(true);
    setRawA([]);
    setRawB([]);

    try {
      if (!filial) throw new Error('Selecione uma filial');
      if (!dataA || !dataB) throw new Error('Selecione as duas datas do inventário');
      if (dataA === dataB) throw new Error('As datas devem ser diferentes');

      const [a, b] = await Promise.all([
        balancoService.buscarMovimentosInventario({ filial, data: dataA }),
        balancoService.buscarMovimentosInventario({ filial, data: dataB })
      ]);

      setRawA(a || []);
      setRawB(b || []);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Erro ao buscar inventários. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const { gruposOrdenados, resumo, topPerdas, topImpactoQtd } = useMemo(() => {
    const normalize = (row, data) => {
      const tipo = String(row.TIPO || '').trim().toUpperCase();
      const qtdRaw = toNum(row.QTD);
      const qtd = tipo === 'SI' ? -Math.abs(qtdRaw) : Math.abs(qtdRaw);
      return {
        data,
        cdprodu: String(row.CDPRODU ?? ''),
        nome: row.NOME_PRODUTO || row.NOME || 'Nome não encontrado',
        tipo,
        qtd,
        estoqueMov: row.ESTOQU ?? row.ESTOQUE ?? null,
        estoqueAtual: row.ESTOQUE_ATUAL ?? row.ESTOQ ?? null,
        custo: row.CUSTO_MEDIO ?? row.CUSLIQ ?? row.ULTPRE ?? null
      };
    };

    const aggregate = (rows, data) => {
      const byKey = new Map(); // cdprodu|tipo
      for (const r of rows || []) {
        const n = normalize(r, data);
        if (!n.cdprodu) continue;
        const key = `${n.cdprodu}|${n.tipo}`;
        const prev = byKey.get(key);
        if (!prev) {
          byKey.set(key, { ...n });
          continue;
        }
        prev.qtd += n.qtd;
        prev.nome = prev.nome || n.nome;
        if (prev.estoqueMov == null && n.estoqueMov != null) prev.estoqueMov = n.estoqueMov;
        if (prev.estoqueAtual == null && n.estoqueAtual != null) prev.estoqueAtual = n.estoqueAtual;
        if (prev.custo == null && n.custo != null) prev.custo = n.custo;
      }
      return [...byKey.values()];
    };

    const aggA = aggregate(rawA, dataA);
    const aggB = aggregate(rawB, dataB);

    const setA = new Set(aggA.map((r) => r.cdprodu));
    const setB = new Set(aggB.map((r) => r.cdprodu));
    const inter = new Set([...setA].filter((x) => setB.has(x)));

    const byProd = new Map();
    const add = (r) => {
      if (!inter.has(r.cdprodu)) return;
      const g = byProd.get(r.cdprodu) || { cdprodu: r.cdprodu, nome: r.nome, rows: [] };
      g.nome = g.nome || r.nome;
      g.rows.push(r);
      byProd.set(r.cdprodu, g);
    };
    aggA.forEach(add);
    aggB.forEach(add);

    const grupos = [...byProd.values()].map((g) => {
      const rowsA = g.rows.filter((r) => r.data === dataA);
      const rowsB = g.rows.filter((r) => r.data === dataB);
      const netA = rowsA.reduce((sum, r) => sum + toNum(r.qtd), 0);
      const netB = rowsB.reduce((sum, r) => sum + toNum(r.qtd), 0);
      const dirA = getDir(netA);
      const dirB = getDir(netB);

      let classificacao = 'NEUTRO';
      if ((dirA === 'SOBRA' && dirB === 'FALTA') || (dirA === 'FALTA' && dirB === 'SOBRA')) {
        classificacao = 'CONTAGEM_INCORRETA';
      } else if (dirA === dirB && (dirA === 'SOBRA' || dirA === 'FALTA')) {
        classificacao = 'REINCIDENCIA';
      } else if (dirA !== 'NEUTRO' || dirB !== 'NEUTRO') {
        classificacao = 'MISTO';
      }

      const custos = g.rows.map((r) => toNum(r.custo)).filter((v) => v > 0);
      const custoRef = custos.length ? custos.sort((a, b) => b - a)[0] : 0;
      const faltaUn = Math.max(0, -netA) + Math.max(0, -netB);
      const sobraUn = Math.max(0, netA) + Math.max(0, netB);
      const perdaValor = faltaUn * custoRef;
      const sobraValor = sobraUn * custoRef;
      const impactoQtd = Math.abs(netA) + Math.abs(netB);

      const rowsOrdenadas = [...g.rows].sort((a, b) => {
        if (a.data !== b.data) return a.data.localeCompare(b.data);
        if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
        return 0;
      });

      return {
        ...g,
        rows: rowsOrdenadas,
        netA,
        netB,
        classificacao,
        custoRef,
        faltaUn,
        sobraUn,
        perdaValor,
        sobraValor,
        impactoQtd
      };
    });

    const gruposOrdenados = grupos.sort((a, b) => {
      const na = parseInt(a.cdprodu, 10);
      const nb = parseInt(b.cdprodu, 10);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.cdprodu.localeCompare(b.cdprodu);
    });

    const resumo = {
      total: gruposOrdenados.length,
      contagemIncorreta: gruposOrdenados.filter((g) => g.classificacao === 'CONTAGEM_INCORRETA').length,
      reincidencia: gruposOrdenados.filter((g) => g.classificacao === 'REINCIDENCIA').length,
      misto: gruposOrdenados.filter((g) => g.classificacao === 'MISTO').length,
      faltaUn: gruposOrdenados.reduce((s, g) => s + toNum(g.faltaUn), 0),
      sobraUn: gruposOrdenados.reduce((s, g) => s + toNum(g.sobraUn), 0),
      perdaValor: gruposOrdenados.reduce((s, g) => s + toNum(g.perdaValor), 0),
      sobraValor: gruposOrdenados.reduce((s, g) => s + toNum(g.sobraValor), 0)
    };

    const topPerdas = [...gruposOrdenados]
      .filter((g) => g.perdaValor > 0)
      .sort((a, b) => b.perdaValor - a.perdaValor)
      .slice(0, 10);

    const topImpactoQtd = [...gruposOrdenados]
      .filter((g) => g.impactoQtd > 0)
      .sort((a, b) => b.impactoQtd - a.impactoQtd)
      .slice(0, 10);

    return { gruposOrdenados, resumo, topPerdas, topImpactoQtd };
  }, [rawA, rawB, dataA, dataB]);

  const gruposFiltrados = useMemo(() => {
    let list = gruposOrdenados;
    if (filtroGrupo !== 'TODOS') list = list.filter((g) => g.classificacao === filtroGrupo);
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter((g) => g.cdprodu.includes(s) || String(g.nome || '').toLowerCase().includes(s));
    }
    return list;
  }, [gruposOrdenados, filtroGrupo, search]);

  const chartResumoClassificacao = useMemo(() => ([
    { name: 'Contagem incorreta', value: resumo.contagemIncorreta, color: palette.danger },
    { name: 'Reincidência', value: resumo.reincidencia, color: palette.warn },
    { name: 'Misto', value: resumo.misto, color: palette.indigo }
  ]), [resumo.contagemIncorreta, resumo.reincidencia, resumo.misto]);

  const chartResumoQtd = useMemo(() => ([
    { name: 'Faltas (un)', value: toNum(resumo.faltaUn), color: palette.danger },
    { name: 'Sobras (un)', value: toNum(resumo.sobraUn), color: palette.success }
  ]), [resumo.faltaUn, resumo.sobraUn]);

  const chartCustoFaltas = useMemo(
    () => [{ name: 'Faltas', value: toNum(resumo.perdaValor) }],
    [resumo.perdaValor]
  );

  const chartCustoSobras = useMemo(
    () => [{ name: 'Sobras', value: toNum(resumo.sobraValor) }],
    [resumo.sobraValor]
  );

  const chartTopPerdas = useMemo(
    () => topPerdas.map((g) => ({
      name: `${g.cdprodu} - ${g.nome}`.slice(0, 42),
      value: toNum(g.perdaValor)
    })),
    [topPerdas]
  );

  const chartTopImpactoQtd = useMemo(
    () => topImpactoQtd.map((g) => ({
      name: `${g.cdprodu} - ${g.nome}`.slice(0, 42),
      value: toNum(g.impactoQtd)
    })),
    [topImpactoQtd]
  );

  const lojasOptions = lojas.map((loja) => ({ value: loja.numero, label: `${loja.numero} - ${loja.nome}` }));

  return (
    <div className="balanco-page">
      <div className="balanco-header">
        <div>
          <div className="balanco-title">
            <i className="fas fa-scale-balanced" /> Comparativo Balanço
          </div>
          <div className="balanco-subtitle">
            Compara ajustes de inventário (EI/SAÍDA e SI/ENTRADA) entre duas datas e destaca reincidências e inconsistências.
          </div>
        </div>
      </div>

      <div className="balanco-card">
        <div className="balanco-filtros">
          <div className="consulta-form-group" style={{ marginBottom: 0 }}>
            <label>Filial</label>
            <CustomSelect
              options={lojasOptions}
              value={filial}
              onChange={setFilial}
              placeholder="Selecione a filial..."
              searchPlaceholder="Buscar filial..."
            />
          </div>

          <div className="consulta-form-group" style={{ marginBottom: 0 }}>
            <label>Data Inventário A</label>
            <input type="date" value={dataA} onChange={(e) => setDataA(e.target.value)} />
          </div>

          <div className="consulta-form-group" style={{ marginBottom: 0 }}>
            <label>Data Inventário B</label>
            <input type="date" value={dataB} onChange={(e) => setDataB(e.target.value)} />
          </div>

          <div className="balanco-actions">
            <button className="consulta-btn-submit" onClick={processar} disabled={loading}>
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-search'}`} /> Processar
            </button>
            <button
              className="balanco-btn-secondary"
              onClick={() => {
                setRawA([]);
                setRawB([]);
                setError('');
              }}
              disabled={loading}
            >
              <i className="fas fa-eraser" /> Limpar
            </button>
          </div>
        </div>

        <div className="balanco-hints">
          <div>
            <strong>EI</strong> = entrada de inventário (ajuste positivo) • <strong>SI</strong> = saída de inventário (ajuste negativo)
          </div>
          <div>
            Mostramos apenas <strong>códigos repetidos nas duas datas</strong> (interseção).
          </div>
        </div>
      </div>

      {error && (
        <div className="consulta-error" style={{ marginTop: 16 }}>
          <strong>
            <i className="fas fa-exclamation-triangle" /> {error}
          </strong>
        </div>
      )}

      {loading && (
        <div className="consulta-loading" style={{ marginTop: 16 }}>
          <i className="fas fa-spinner fa-spin" /> Buscando inventários e processando...
        </div>
      )}

      {!loading && (rawA.length > 0 || rawB.length > 0) && (
        <>
          <div className="balanco-kpis">
            <div className="balanco-kpi">
              <div className="balanco-kpi-label">Produtos comparados</div>
              <div className="balanco-kpi-value">{resumo.total}</div>
              <div className="balanco-kpi-sub">{formatDateBR(dataA)} vs {formatDateBR(dataB)}</div>
            </div>
            <div className="balanco-kpi danger">
              <div className="balanco-kpi-label">Contagem incorreta</div>
              <div className="balanco-kpi-value">{resumo.contagemIncorreta}</div>
              <div className="balanco-kpi-sub">Sobra em um, falta no outro</div>
            </div>
            <div className="balanco-kpi warn">
              <div className="balanco-kpi-label">Reincidência</div>
              <div className="balanco-kpi-value">{resumo.reincidencia}</div>
              <div className="balanco-kpi-sub">Mesmo sentido nas duas datas</div>
            </div>
            <div className="balanco-kpi">
              <div className="balanco-kpi-label">Faltas (un / custo)</div>
              <div className="balanco-kpi-value">{resumo.faltaUn.toFixed(0)}</div>
              <div className="balanco-kpi-sub">{formatCurrency(resumo.perdaValor)}</div>
            </div>
            <div className="balanco-kpi ok">
              <div className="balanco-kpi-label">Sobras (un / custo)</div>
              <div className="balanco-kpi-value">{resumo.sobraUn.toFixed(0)}</div>
              <div className="balanco-kpi-sub">{formatCurrency(resumo.sobraValor)}</div>
            </div>
          </div>

          <div className="balanco-grid">
            <div className="balanco-card balanco-card--indicators">
              <div className="balanco-card-title">
                <i className="fas fa-chart-simple" /> Indicadores (Recharts)
              </div>

              <div className="balanco-charts-grid">
                <div className="balanco-chart-card">
                  <div className="balanco-chart-title">Distribuição</div>
                  <div className="balanco-chart" style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<TooltipBox />} />
                        <Legend verticalAlign="bottom" height={24} />
                        <Pie
                          data={chartResumoClassificacao}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {chartResumoClassificacao.map((e, idx) => (
                            <Cell key={idx} fill={e.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="balanco-chart-card">
                  <div className="balanco-chart-title">Faltas vs Sobras (un)</div>
                  <div className="balanco-chart" style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartResumoQtd} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fill: palette.muted, fontSize: 11 }} />
                        <YAxis tick={{ fill: palette.muted, fontSize: 11 }} />
                        <Tooltip content={<TooltipBox />} />
                        <Bar dataKey="value" name="Unidades" radius={[10, 10, 0, 0]}>
                          {chartResumoQtd.map((e, idx) => (
                            <Cell key={idx} fill={e.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="balanco-chart-card">
                  <div className="balanco-chart-title">
                    Custo das faltas <span className="balanco-chart-title-value">{formatCurrency(resumo.perdaValor)}</span>
                  </div>
                  <div className="balanco-chart" style={{ height: 170 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartCustoFaltas} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fill: palette.muted, fontSize: 11 }} />
                        <YAxis
                          tick={{ fill: palette.muted, fontSize: 11 }}
                          tickFormatter={(v) => `R$ ${toNum(v).toFixed(0)}`}
                        />
                        <Tooltip content={<TooltipBox />} formatter={(v) => formatCurrency(v)} />
                        <Bar dataKey="value" name="Faltas (R$)" fill={palette.danger} radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="balanco-chart-card">
                  <div className="balanco-chart-title">
                    Custo das sobras <span className="balanco-chart-title-value">{formatCurrency(resumo.sobraValor)}</span>
                  </div>
                  <div className="balanco-chart" style={{ height: 170 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartCustoSobras} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fill: palette.muted, fontSize: 11 }} />
                        <YAxis
                          tick={{ fill: palette.muted, fontSize: 11 }}
                          tickFormatter={(v) => `R$ ${toNum(v).toFixed(0)}`}
                        />
                        <Tooltip content={<TooltipBox />} formatter={(v) => formatCurrency(v)} />
                        <Bar dataKey="value" name="Sobras (R$)" fill={palette.success} radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div className="balanco-card">
              <div className="balanco-card-title">
                <i className="fas fa-sack-dollar" /> Maiores custos de perdas (Top 10)
              </div>
              {chartTopPerdas.length === 0 ? (
                <div className="balanco-empty">Sem perdas (SI) nas duas datas para os itens repetidos.</div>
              ) : (
                <div className="balanco-chart" style={{ height: 520 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...chartTopPerdas].reverse()}
                      layout="vertical"
                      margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
                    >
                      <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tick={{ fill: palette.muted, fontSize: 11 }}
                        tickFormatter={(v) => `R$ ${toNum(v).toFixed(0)}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tick={{ fill: palette.muted, fontSize: 11 }}
                      />
                      <Tooltip content={<TooltipBox />} formatter={(v) => formatCurrency(v)} />
                      <Bar dataKey="value" name="Perda (R$)" fill={palette.danger} radius={[0, 10, 10, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="balanco-card">
              <div className="balanco-card-title">
                <i className="fas fa-boxes-stacked" /> Maiores impactos em quantidade (Top 10)
              </div>
              {chartTopImpactoQtd.length === 0 ? (
                <div className="balanco-empty">Sem movimentos EI/SI nas duas datas para os itens repetidos.</div>
              ) : (
                <div className="balanco-chart" style={{ height: 520 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...chartTopImpactoQtd].reverse()}
                      layout="vertical"
                      margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
                    >
                      <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fill: palette.muted, fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tick={{ fill: palette.muted, fontSize: 11 }}
                      />
                      <Tooltip content={<TooltipBox />} formatter={(v) => `${toNum(v).toFixed(0)} un`} />
                      <Bar dataKey="value" name="Impacto (un)" fill={palette.info} radius={[0, 10, 10, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="balanco-card" style={{ marginTop: 16 }}>
            <div className="balanco-table-header">
              <div className="balanco-card-title" style={{ marginBottom: 0 }}>
                <i className="fas fa-table" /> Produtos repetidos nas duas datas
              </div>

              <div className="balanco-table-tools">
                <div className="vendas-tabs" style={{ marginBottom: 0 }}>
                  <button className={`vendas-tab ${filtroGrupo === 'TODOS' ? 'active' : ''}`} onClick={() => setFiltroGrupo('TODOS')} type="button">
                    Todos
                  </button>
                  <button className={`vendas-tab ${filtroGrupo === 'CONTAGEM_INCORRETA' ? 'active' : ''}`} onClick={() => setFiltroGrupo('CONTAGEM_INCORRETA')} type="button">
                    Contagem incorreta
                  </button>
                  <button className={`vendas-tab ${filtroGrupo === 'REINCIDENCIA' ? 'active' : ''}`} onClick={() => setFiltroGrupo('REINCIDENCIA')} type="button">
                    Reincidência
                  </button>
                </div>

                <input
                  className="balanco-search"
                  placeholder="Filtrar por código ou nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="excel-table-container" style={{ marginTop: 12 }}>
              <table className="excel-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Código</th>
                    <th>Produto</th>
                    <th style={{ width: 110 }}>Data</th>
                    <th className="text-center" style={{ width: 90 }}>Tipo</th>
                    <th className="text-right" style={{ width: 110 }}>Qtd (ajuste)</th>
                    <th className="text-right" style={{ width: 110 }}>Estoque (mov)</th>
                    <th className="text-right" style={{ width: 120 }}>Estoque atual</th>
                    <th className="text-right" style={{ width: 120 }}>Custo médio</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 18, textAlign: 'center', color: '#9ca3af' }}>
                        Nenhum produto encontrado para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    gruposFiltrados.map((g) => {
                      const badge = getBadge(g.classificacao);
                      return (
                        <React.Fragment key={g.cdprodu}>
                          <tr className="balanco-group-row">
                            <td colSpan={8}>
                              <div className="balanco-group-row-inner">
                                <div className="balanco-group-row-left">
                                  <div className="balanco-group-code">{g.cdprodu}</div>
                                  <div className="balanco-group-name">{g.nome}</div>
                                </div>
                                <div className="balanco-group-row-right">
                                  <span className="balanco-badge" style={{ background: badge.bg, color: badge.fg }}>
                                    <i className={`fas ${badge.icon}`} /> {badge.label}
                                  </span>
                                  <span className="balanco-meta">
                                    A: <strong className={g.netA < 0 ? 'neg' : g.netA > 0 ? 'pos' : ''}>{g.netA.toFixed(0)}</strong> •
                                    B: <strong className={g.netB < 0 ? 'neg' : g.netB > 0 ? 'pos' : ''}>{g.netB.toFixed(0)}</strong>
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {g.rows.map((r, idx) => {
                            const tipoLabel = r.tipo === 'SI' ? 'SAÍDA' : 'ENTRADA';
                            const qtyClass = r.qtd < 0 ? 'negative' : r.qtd > 0 ? 'positive' : '';
                            return (
                              <tr key={`${g.cdprodu}-${r.data}-${r.tipo}-${idx}`}>
                                <td className="number">{g.cdprodu}</td>
                                <td>{g.nome}</td>
                                <td>{formatDateBR(r.data)}</td>
                                <td className="text-center">
                                  <span className={`balanco-tipo ${r.tipo === 'SI' ? 'si' : 'ei'}`}>{tipoLabel}</span>
                                </td>
                                <td className={`text-right number ${qtyClass}`}>{toNum(r.qtd).toFixed(0)}</td>
                                <td className="text-right number">{r.estoqueMov == null ? '-' : toNum(r.estoqueMov).toFixed(0)}</td>
                                <td className="text-right number">{r.estoqueAtual == null ? '-' : toNum(r.estoqueAtual).toFixed(0)}</td>
                                <td className="text-right currency">{r.custo == null ? '-' : formatCurrency(r.custo)}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="balanco-footer-note">
              <strong>Leitura rápida:</strong> “Contagem incorreta” = um inventário ajustou para cima e o outro para baixo (mesmo produto). “Reincidência” = ajustes no mesmo sentido nas duas datas.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ComparativoBalanco;
