import React, { useState, useEffect } from 'react';
import DraggableWindow from './DraggableWindow';
import CustomSelect from '../CustomSelect';
import { queryService, lojasService } from '../../services/api';

const WindowNotas = ({ onClose, onMinimize, isMinimized, zIndex, onFocus, userData }) => {
  const [filial, setFilial] = useState(userData.loja_id || 22);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState([]);
  const [detalhesCache, setDetalhesCache] = useState({});
  const [lojas, setLojas] = useState([]);
  const [nomeFilial, setNomeFilial] = useState('');

  // Carregar lojas
  useEffect(() => {
    const carregarLojas = async () => {
      try {
        const lojasResponse = await lojasService.getLojas();
        // Ordenar lojas por número
        const lojasOrdenadas = (lojasResponse || []).sort((a, b) => a.numero - b.numero);
        setLojas(lojasOrdenadas);
      } catch (err) {
        console.error('Erro ao carregar lojas:', err);
      }
    };
    carregarLojas();
  }, []);

  const toggleRow = async (cdfil, nrnota, cdforne, index) => {
    const isExpanding = !expandedRows.includes(index);

    setExpandedRows(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );

    if (isExpanding && !detalhesCache[index]) {
      // Carregar detalhes dos produtos
      try {
        const queryProdutos = `
          SELECT
            e.CDPRODU,
            e.QTD as QTD_NOTA,
            COALESCE(c.QTD, 0) as QTD_CONFERIDA
          FROM sceent e
          LEFT JOIN sceentconf c ON c.CDFIL = e.CDFIL
            AND c.NRNOTA = e.NRNOTA
            AND c.CDFORNE = e.CDFORNE
            AND c.CDPRODU = e.CDPRODU
          WHERE e.CDFIL = ${cdfil}
            AND e.NRNOTA = '${nrnota}'
            AND e.CDFORNE = ${cdforne}
            AND e.VALIDADA = 'N'
          ORDER BY e.CDPRODU
        `;

        const produtos = await queryService.execute(queryProdutos);

        if (!produtos || produtos.length === 0) {
          setDetalhesCache(prev => ({
            ...prev,
            [index]: []
          }));
          return;
        }

        // Buscar nomes dos produtos
        const codigosProdutos = [...new Set(produtos.map(p => p.CDPRODU))];
        const queryNomes = `SELECT CDPRODU, NOME FROM sceprodu WHERE CDPRODU IN (${codigosProdutos.join(',')})`;
        const nomes = await queryService.execute(queryNomes);

        const nomesProdutos = {};
        nomes.forEach(prod => {
          nomesProdutos[prod.CDPRODU] = prod.NOME;
        });

        // Buscar estoques da filial
        const queryEstoque = `SELECT CDPRODU, ESTOQ FROM sceestoq WHERE CDFIL = ${cdfil} AND CDPRODU IN (${codigosProdutos.join(',')})`;
        const estoques = await queryService.execute(queryEstoque);

        const estoquesProdutos = {};
        estoques.forEach(est => {
          estoquesProdutos[est.CDPRODU] = est.ESTOQ || 0;
        });

        // Combinar dados
        const produtosCompletos = produtos.map(prod => ({
          ...prod,
          NOME_PRODUTO: nomesProdutos[prod.CDPRODU] || 'Nome não encontrado',
          ESTOQUE: estoquesProdutos[prod.CDPRODU] !== undefined ? estoquesProdutos[prod.CDPRODU] : '-'
        }));

        setDetalhesCache(prev => ({
          ...prev,
          [index]: produtosCompletos
        }));
      } catch (err) {
        console.error('Erro ao carregar produtos:', err);
        setDetalhesCache(prev => ({
          ...prev,
          [index]: []
        }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);
    setExpandedRows([]);
    setDetalhesCache({});

    if (!filial) {
      setError('Selecione uma filial');
      return;
    }

    setLoading(true);

    try {
      // Buscar notas pendentes agrupadas
      const queryNotas = `
        SELECT
          a.CDFIL,
          a.DATA,
          a.NRNOTA,
          a.NRSERIE,
          a.CDFORNE,
          b.NOME as NOME_FORNE,
          a.NRPEDIDO,
          SUM(a.QTD) as QTD_TOTAL,
          SUM(a.QTD * a.VLRUNI) as VLRTOTAL,
          COUNT(DISTINCT a.CDPRODU) as QTD_ITENS
        FROM sceent a, sceforne b
        WHERE a.CDFIL = ${filial}
          AND a.VALIDADA = 'N'
          AND a.CDFORNE = b.CDFORNE
        GROUP BY a.NRNOTA
        ORDER BY a.DATA DESC, a.NRNOTA DESC
      `;

      const notas = await queryService.execute(queryNotas);

      if (!notas || notas.length === 0) {
        setError('Nenhuma nota pendente encontrada para esta filial.');
      } else {
        // Buscar datas de conferência
        const notasChaves = notas.map(n =>
          `(CDFIL = ${n.CDFIL} AND NRNOTA = '${n.NRNOTA}' AND CDFORNE = ${n.CDFORNE})`
        ).join(' OR ');

        let datasConferencia = {};
        try {
          const queryConferencia = `SELECT CDFIL, NRNOTA, CDFORNE, DATACONF FROM sceentconf WHERE ${notasChaves}`;
          const conferencias = await queryService.execute(queryConferencia);
          conferencias.forEach(c => {
            const chave = `${c.CDFIL}_${c.NRNOTA}_${c.CDFORNE}`;
            datasConferencia[chave] = c.DATACONF;
          });
        } catch (err) {
          console.error('Erro ao buscar conferências:', err);
        }

        // Buscar nome da filial
        const lojaSelecionada = lojas.find(l => String(l.numero) === String(filial));
        setNomeFilial(lojaSelecionada ? `${lojaSelecionada.numero} - ${lojaSelecionada.nome}` : filial);

        // Processar notas com alertas
        const notasProcessadas = notas.map(nota => {
          const dataEmissao = nota.DATA ? new Date(nota.DATA) : null;
          const chaveConf = `${nota.CDFIL}_${nota.NRNOTA}_${nota.CDFORNE}`;

          let diasDesdeEmissao = 0;
          if (dataEmissao) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataEmissaoZerada = new Date(dataEmissao);
            dataEmissaoZerada.setHours(0, 0, 0, 0);
            const diffTime = hoje - dataEmissaoZerada;
            diasDesdeEmissao = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          }

          return {
            ...nota,
            dataConferencia: datasConferencia[chaveConf] || null,
            diasDesdeEmissao
          };
        });

        setResultado(notasProcessadas);
      }
    } catch (err) {
      console.error('Erro ao buscar notas pendentes:', err);
      setError('Erro ao buscar notas pendentes. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';

    // Se a data vier como string ISO (2025-12-23T03:00:00.000Z)
    if (typeof date === 'string' && date.includes('T')) {
      const [datePart] = date.split('T');
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}`;
    }

    // Se vier como Date object ou outro formato
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return '-';

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (value) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <DraggableWindow
      title="Notas Pendentes (Não Validadas)"
      icon="fa-clipboard-list"
      onClose={onClose}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      zIndex={zIndex}
      onFocus={onFocus}
      initialWidth={1100}
      initialTop={60}
      initialLeft={400}
    >
      <form onSubmit={handleSubmit}>
        <div className="consulta-form-group">
          <label>Selecione a Filial</label>
          <CustomSelect
            options={lojas.map(loja => ({
              value: loja.numero,
              label: `${loja.numero} - ${loja.nome}`
            }))}
            value={filial}
            onChange={setFilial}
            placeholder="Selecione a filial..."
            searchPlaceholder="Buscar filial..."
          />
        </div>
        <button type="submit" className="consulta-btn-submit" disabled={loading}>
          <i className="fas fa-search"></i> Buscar Notas Pendentes
        </button>
      </form>

      {error && (
        <div className="consulta-error" style={{ marginTop: '16px' }}>
          <strong><i className="fas fa-exclamation-triangle"></i> {error}</strong>
        </div>
      )}

      {loading && (
        <div className="consulta-loading" style={{ marginTop: '16px' }}>
          <i className="fas fa-spinner fa-spin"></i> Buscando notas pendentes...
        </div>
      )}

      {resultado && resultado.length > 0 && (
        <div className="consulta-resultado" style={{ marginTop: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#f59e0b' }}>
            <i className="fas fa-clipboard-list"></i> {resultado.length} Nota(s) Pendente(s) - Filial {nomeFilial}
          </h4>

          <div className="transito-table-container" style={{ overflowX: 'auto' }}>
            <table className="transito-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ width: '40px', padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: '600' }}></th>
                  <th style={{ width: '110px', padding: '12px', fontSize: '11px', fontWeight: '600' }}>Data Emissão</th>
                  <th style={{ width: '100px', padding: '12px', fontSize: '11px', fontWeight: '600' }}>Nr Nota</th>
                  <th style={{ width: '70px', padding: '12px', fontSize: '11px', fontWeight: '600' }}>Série</th>
                  <th style={{ padding: '12px', fontSize: '11px', fontWeight: '600' }}>Fornecedor</th>
                  <th style={{ width: '110px', padding: '12px', fontSize: '11px', fontWeight: '600' }}>Dt Confer.</th>
                  <th style={{ textAlign: 'center', width: '70px', padding: '12px', fontSize: '11px', fontWeight: '600' }}>Itens</th>
                  <th style={{ width: '100px', padding: '12px', fontSize: '11px', fontWeight: '600' }}>Nr Pedido</th>
                  <th style={{ textAlign: 'right', width: '120px', padding: '12px', fontSize: '11px', fontWeight: '600' }}>Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {resultado.map((nota, index) => {
                  const isExpanded = expandedRows.includes(index);
                  let alertaIcon = null;
                  let rowStyle = {};

                  if (nota.diasDesdeEmissao >= 7) {
                    alertaIcon = <i className="fas fa-exclamation-circle" style={{ color: '#dc2626', marginLeft: '6px' }} title="7+ dias - Urgente!"></i>;
                    rowStyle = { background: '#fee2e2', borderLeft: '4px solid #dc2626' };
                  } else if (nota.diasDesdeEmissao >= 6) {
                    alertaIcon = <i className="fas fa-exclamation-triangle" style={{ color: '#f59e0b', marginLeft: '6px' }} title="6 dias - Atenção!"></i>;
                    rowStyle = { background: '#fef3c7', borderLeft: '4px solid #f59e0b' };
                  }

                  return (
                    <React.Fragment key={index}>
                      <tr
                        className="transito-row"
                        onClick={() => toggleRow(nota.CDFIL, nota.NRNOTA, nota.CDFORNE, index)}
                        style={{
                          ...rowStyle,
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ textAlign: 'center', padding: '12px' }}>
                          <i
                            className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}
                            style={{ color: '#9ca3af', fontSize: '12px', transition: 'transform 0.3s' }}
                          ></i>
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{formatDate(nota.DATA)}</span>
                            {alertaIcon}
                          </div>
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px' }}><strong>{nota.NRNOTA}</strong></td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>{nota.NRSERIE || '-'}</td>
                        <td style={{ padding: '12px', fontSize: '12px' }}>
                          {nota.NOME_FORNE} <i style={{ color: '#9ca3af' }}>({nota.CDFORNE})</i>
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>{formatDate(nota.dataConferencia)}</td>
                        <td style={{ textAlign: 'center', padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: '#fef3c7',
                            color: '#92400e'
                          }}>
                            {nota.QTD_ITENS}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>{nota.NRPEDIDO || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600', padding: '12px', fontSize: '13px' }}>
                          {formatCurrency(nota.VLRTOTAL)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="9" style={{ padding: '16px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                            {detalhesCache[index] ? (
                              detalhesCache[index].length > 0 ? (
                                <table style={{ width: '100%', fontSize: '13px' }}>
                                  <thead>
                                    <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                                      <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Código</th>
                                      <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Produto</th>
                                      <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#374151', width: '90px' }}>Qtd Nota</th>
                                      <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#374151', width: '90px' }}>Qtd Conf.</th>
                                      <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#374151', width: '90px' }}>Estoque</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detalhesCache[index].map((prod, pIndex) => {
                                      const qtdConferida = parseFloat(prod.QTD_CONFERIDA || 0);
                                      const qtdNota = parseFloat(prod.QTD_NOTA || 0);
                                      const estoque = prod.ESTOQUE !== '-' ? parseFloat(prod.ESTOQUE) : '-';
                                      const bgColor = pIndex % 2 === 0 ? '#ffffff' : '#f9fafb';

                                      // Cor para quantidade conferida
                                      let corConferida = '#9ca3af';
                                      if (qtdConferida > 0) {
                                        corConferida = qtdConferida === qtdNota ? '#10b981' : '#f59e0b';
                                      }

                                      // Cor para estoque
                                      const corEstoque = estoque !== '-' && estoque > 0 ? '#10b981' : '#ef4444';

                                      return (
                                        <tr key={pIndex} style={{ background: bgColor, borderBottom: '1px solid #e5e7eb' }}>
                                          <td style={{ padding: '10px', fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>{prod.CDPRODU}</td>
                                          <td style={{ padding: '10px', fontSize: '12px', color: '#4b5563' }}>{prod.NOME_PRODUTO || 'Nome não encontrado'}</td>
                                          <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>
                                            {qtdNota.toFixed(0)}
                                          </td>
                                          <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: corConferida }}>
                                            {qtdConferida.toFixed(0)}
                                          </td>
                                          <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: corEstoque }}>
                                            {estoque !== '-' ? estoque.toFixed(0) : '-'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                                  Nenhum produto encontrado
                                </div>
                              )
                            ) : (
                              <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                                <i className="fas fa-spinner fa-spin"></i> Carregando produtos...
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DraggableWindow>
  );
};

export default WindowNotas;
