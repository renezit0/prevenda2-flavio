import React, { useState } from 'react';
import DraggableWindow from './DraggableWindow';
import CustomSelect from '../CustomSelect';
import { queryService, lojasService } from '../../services/api';

const WindowTransito = ({ onClose, onMinimize, isMinimized, zIndex, onFocus, userData }) => {
  const [filial, setFilial] = useState(userData.loja_id || 22);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [copiado, setCopiado] = useState(null);
  const [modalProtocolo, setModalProtocolo] = useState(false);
  const [dadosProtocolo, setDadosProtocolo] = useState(null);
  const [loadingProtocolo, setLoadingProtocolo] = useState(false);
  const [copiadoProtocolo, setCopiadoProtocolo] = useState(false);

  // Carregar lojas
  React.useEffect(() => {
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

  const toggleRow = (index) => {
    setExpandedRows(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const copiarNFe = (chave, index) => {
    if (!chave || chave === '-') return;
    navigator.clipboard.writeText(chave).then(() => {
      setCopiado(index);
      setTimeout(() => setCopiado(null), 2000);
    }).catch(err => {
      console.error('Erro ao copiar NFe:', err);
    });
  };

  const traduzirStatus = (status) => {
    const statusMap = {
      1: 'Aberto',
      2: 'Em Trânsito',
      3: 'Recebido'
    };
    return statusMap[status] || status;
  };

  const buscarProtocolo = async (chave) => {
    if (!chave || chave === '-') return;

    setLoadingProtocolo(true);
    setModalProtocolo(true);
    setDadosProtocolo(null);

    try {
      const query = `
        SELECT
          protocolo_online_documento.documento,
          protocolo_online_documento.protocolo,
          protocolo_online.remetente_cdfun,
          protocolo_online.remetente_cdfil,
          protocolo_online.status,
          protocolo_online.data_cadastro,
          scefun.NOME as nome_funcionario
        FROM protocolo_online_documento
        JOIN protocolo_online
          ON protocolo_online.id = protocolo_online_documento.protocolo
        LEFT JOIN scefun
          ON scefun.CDFUN = protocolo_online.remetente_cdfun
        WHERE protocolo_online_documento.documento = '${chave}'
      `;

      const data = await queryService.execute(query);

      if (data && data.length > 0) {
        setDadosProtocolo(data[0]);
      } else {
        setDadosProtocolo(null);
      }
    } catch (err) {
      console.error('Erro ao buscar protocolo:', err);
      setDadosProtocolo(null);
    } finally {
      setLoadingProtocolo(false);
    }
  };

  const copiarProtocolo = (protocolo) => {
    if (!protocolo) return;
    navigator.clipboard.writeText(protocolo).then(() => {
      setCopiadoProtocolo(true);
      setTimeout(() => setCopiadoProtocolo(false), 2000);
    }).catch(err => {
      console.error('Erro ao copiar protocolo:', err);
    });
  };

  const fecharModal = () => {
    setModalProtocolo(false);
    setDadosProtocolo(null);
    setCopiadoProtocolo(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);

    if (!filial) {
      setError('Selecione uma loja');
      return;
    }

    setLoading(true);

    try {
      const query = `
        SELECT *
        FROM scetransito
        WHERE STATUS = 'A'
          AND CDFIL = ${filial}
        ORDER BY DATA ASC, NUMDOC ASC
      `;

      const data = await queryService.execute(query);

      if (!data || data.length === 0) {
        setError('Nenhuma mercadoria em trânsito encontrada para esta filial.');
      } else {
        let nomesProdutos = {};
        let chavesNFe = {};
        let estoquePorFilialProduto = {};
        let nomesLojas = {};

        // Buscar nomes das lojas (já temos no state)
        // Criar mapa com número como chave (tanto string quanto number)
        lojas.forEach(loja => {
          const num = String(loja.numero);
          nomesLojas[num] = loja.nome;
          nomesLojas[parseInt(num)] = loja.nome; // Também como número
        });

        const codigosProdutos = [...new Set(data.map(p => p.CDPRODU))];
        const numdocs = [...new Set(data.map(p => p.NUMDOC))];

        // Buscar nomes dos produtos
        if (codigosProdutos.length > 0) {
          const queryNomes = `
            SELECT CDPRODU, NOME
            FROM sceprodu
            WHERE CDPRODU IN (${codigosProdutos.join(',')})
          `;
          const nomes = await queryService.execute(queryNomes);
          nomes.forEach(n => {
            nomesProdutos[n.CDPRODU] = n.NOME;
          });
        }

        // Buscar chaves NFe (pegar a mais recente quando há duplicatas)
        if (numdocs.length > 0) {
          // Buscar todas as NFes para os pedidos (ordenar por data de emissão decrescente)
          const queryChaves = `
            SELECT NRPEDIDO, NRNFE
            FROM admnf
            WHERE NRPEDIDO IN (${numdocs.join(',')})
            ORDER BY DTEMIS DESC
          `;
          const chaves = await queryService.execute(queryChaves);

          // Processar mantendo apenas a mais recente de cada NRPEDIDO
          chaves.forEach(nf => {
            // Se ainda não existe ou se não tem chave válida, adicionar
            if (!chavesNFe[nf.NRPEDIDO] || chavesNFe[nf.NRPEDIDO] === '-') {
              chavesNFe[nf.NRPEDIDO] = nf.NRNFE || '-';
            }
          });
        }

        // Buscar estoques por filial/produto
        const produtosPorLoja = {};
        data.forEach(item => {
          if (!produtosPorLoja[item.CDFIL]) {
            produtosPorLoja[item.CDFIL] = new Set();
          }
          produtosPorLoja[item.CDFIL].add(item.CDPRODU);
        });

        for (const [cdfil, produtos] of Object.entries(produtosPorLoja)) {
          const produtosArray = Array.from(produtos);
          const queryEstoque = `
            SELECT CDFIL, CDPRODU, ESTOQ
            FROM sceestoq
            WHERE CDFIL = ${cdfil}
              AND CDPRODU IN (${produtosArray.join(',')})
          `;
          const estoques = await queryService.execute(queryEstoque);
          estoques.forEach(est => {
            const chave = `${est.CDFIL}_${est.CDPRODU}`;
            estoquePorFilialProduto[chave] = est.ESTOQ || 0;
          });
        }

        // Agrupar por NUMDOC
        const porNumDoc = {};
        data.forEach(item => {
          if (!porNumDoc[item.NUMDOC]) {
            porNumDoc[item.NUMDOC] = {
              numdoc: item.NUMDOC,
              cdfil: item.CDFIL,
              data: item.DATA,
              chave: chavesNFe[item.NUMDOC] || '-',
              produtos: []
            };
          }
          porNumDoc[item.NUMDOC].produtos.push({
            ...item,
            NOME_PRODUTO: nomesProdutos[item.CDPRODU] || 'Produto não encontrado',
            ESTOQUE: estoquePorFilialProduto[`${item.CDFIL}_${item.CDPRODU}`] || 0
          });
        });

        // Ordenar por data ASC (mais antiga primeiro)
        const movimentacoes = Object.values(porNumDoc);

        const movimentacoesOrdenadas = movimentacoes.sort((a, b) => {
          // Converter para Date objects se necessário
          const dataA = a.data instanceof Date ? a.data : new Date(a.data);
          const dataB = b.data instanceof Date ? b.data : new Date(b.data);
          return dataA - dataB; // ASC (crescente - mais antiga primeiro)
        });

        console.log('Movimentações ordenadas:', movimentacoesOrdenadas.map(m => ({
          numdoc: m.numdoc,
          data: m.data instanceof Date ? m.data.toLocaleDateString('pt-BR') : m.data
        })));

        // Adicionar informação sobre alertas
        movimentacoesOrdenadas.forEach((mov, idx) => {
          // A data pode vir como Date object ou string YYYYMMDD
          let dataEmissao;

          if (mov.data instanceof Date) {
            // Já é um Date object
            dataEmissao = new Date(mov.data);
          } else if (typeof mov.data === 'string' && mov.data.includes('T')) {
            // É uma string ISO (2025-12-23T03:00:00.000Z)
            dataEmissao = new Date(mov.data);
          } else {
            // É uma string YYYYMMDD
            const dateStr = String(mov.data);
            const year = parseInt(dateStr.substr(0, 4));
            const month = parseInt(dateStr.substr(4, 2)) - 1;
            const day = parseInt(dateStr.substr(6, 2));
            dataEmissao = new Date(year, month, day);
          }

          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          dataEmissao.setHours(0, 0, 0, 0);

          const diffTime = hoje - dataEmissao;
          const diasDesdeEmissao = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          mov.diasDesdeEmissao = diasDesdeEmissao;

          console.log(`[${idx}] Pedido ${mov.numdoc}: ${diasDesdeEmissao} dias (emitido em ${dataEmissao.toLocaleDateString('pt-BR')})`);
          // Formato: número - nome da loja (com zero à esquerda)
          const numDestinoFormatado = String(mov.cdfil).padStart(2, '0');
          const nomeDestino = nomesLojas[mov.cdfil] || nomesLojas[String(mov.cdfil)] || nomesLojas[parseInt(mov.cdfil)];
          mov.lojaDestino = nomeDestino ? `${numDestinoFormatado} - ${nomeDestino}` : numDestinoFormatado;

          const cdfilOrigem = mov.produtos.length > 0 ? mov.produtos[0].CDFILORIGEM : null;
          const numOrigemFormatado = cdfilOrigem ? String(cdfilOrigem).padStart(2, '0') : '-';
          const nomeOrigem = cdfilOrigem ? (nomesLojas[cdfilOrigem] || nomesLojas[String(cdfilOrigem)] || nomesLojas[parseInt(cdfilOrigem)]) : null;
          mov.lojaOrigem = nomeOrigem ? `${numOrigemFormatado} - ${nomeOrigem}` : numOrigemFormatado;

          mov.totalProdutos = mov.produtos.reduce((sum, p) => sum + (parseFloat(p.QTD) || 0), 0);
        });

        setResultado(movimentacoesOrdenadas);
      }
    } catch (err) {
      console.error('Erro ao buscar trânsito:', err);
      setError('Erro ao buscar mercadorias em trânsito. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';

    // Se for string no formato YYYYMMDD
    const dateStr = String(date);
    if (dateStr.length === 8) {
      const year = dateStr.substr(0, 4);
      const month = dateStr.substr(4, 2);
      const day = dateStr.substr(6, 2);
      const dateObj = new Date(year, parseInt(month) - 1, day);
      return dateObj.toLocaleDateString('pt-BR');
    }

    // Se for Date object ou timestamp
    try {
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString('pt-BR');
      }
    } catch (e) {
      console.error('Erro ao formatar data:', e);
    }

    return date;
  };

  return (
    <DraggableWindow
      title="Mercadorias Em Trânsito"
      icon="fa-truck"
      onClose={onClose}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      zIndex={zIndex}
      onFocus={onFocus}
      initialWidth={850}
      initialTop={80}
      initialLeft={550}
    >
      <form onSubmit={handleSubmit}>
        <div className="consulta-form-group">
          <label>Selecione a Loja (Filial Destino)</label>
          <CustomSelect
            options={lojas.map(loja => ({
              value: loja.numero,
              label: `${loja.numero} - ${loja.nome}`
            }))}
            value={filial}
            onChange={setFilial}
            placeholder="Selecione a loja..."
            searchPlaceholder="Buscar loja..."
          />
        </div>
        <button type="submit" className="consulta-btn-submit" disabled={loading}>
          <i className="fas fa-sync"></i> Carregar Movimentações
        </button>
      </form>

      {error && (
        <div className="consulta-error" style={{ marginTop: '16px' }}>
          <strong><i className="fas fa-exclamation-triangle"></i> {error}</strong>
        </div>
      )}

      {loading && (
        <div className="consulta-loading" style={{ marginTop: '16px' }}>
          <i className="fas fa-spinner fa-spin"></i> Buscando pendências...
        </div>
      )}

      {resultado && resultado.length > 0 && (
        <div className="consulta-resultado" style={{ marginTop: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#f59e0b' }}>
            <i className="fas fa-clock"></i> {resultado.length} Movimentação(ões) Pendente(s)
          </h4>

          <div className="transito-table-container" style={{ overflowX: 'auto' }}>
            <table className="transito-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ width: '40px', padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: '600' }}></th>
                  <th style={{ width: '100px', padding: '12px', fontSize: '11px', fontWeight: '600' }}>Pedido</th>
                  <th style={{ padding: '12px', fontSize: '11px', fontWeight: '600' }}>Origem</th>
                  <th style={{ padding: '12px', fontSize: '11px', fontWeight: '600' }}>Destino</th>
                  <th style={{ width: '110px', padding: '12px', fontSize: '11px', fontWeight: '600' }}>Data</th>
                  <th style={{ textAlign: 'center', width: '70px', padding: '12px', fontSize: '11px', fontWeight: '600' }}>Prod.</th>
                  <th style={{ textAlign: 'right', width: '70px', padding: '12px', fontSize: '11px', fontWeight: '600' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {resultado.map((mov, index) => {
                  const isExpanded = expandedRows.includes(index);
                  let alertaHTML = '';
                  let rowStyle = '';

                  // Destaques baseados nos dias desde emissão
                  if (mov.diasDesdeEmissao >= 10) {
                    alertaHTML = <i className="fas fa-exclamation-circle" style={{ color: '#dc2626', marginLeft: '6px' }} title="10+ dias - Bloqueio!"></i>;
                    rowStyle = 'background: #fee2e2; border-left: 4px solid #dc2626;';
                  } else if (mov.diasDesdeEmissao >= 9) {
                    alertaHTML = <i className="fas fa-exclamation-triangle" style={{ color: '#f59e0b', marginLeft: '6px' }} title="9 dias - Atenção!"></i>;
                    rowStyle = 'background: #fef3c7; border-left: 4px solid #f59e0b;';
                  }

                  // Parsear o rowStyle string para objeto
                  const rowStyleObj = {};
                  if (rowStyle) {
                    const styles = rowStyle.split(';').filter(s => s.trim());
                    styles.forEach(style => {
                      const [key, value] = style.split(':').map(s => s.trim());
                      if (key && value) {
                        const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                        rowStyleObj[camelKey] = value;
                      }
                    });
                  }

                  return (
                    <React.Fragment key={index}>
                      <tr
                        className="transito-row"
                        onClick={() => toggleRow(index)}
                        style={{
                          ...rowStyleObj,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          borderBottom: '1px solid #f3f4f6'
                        }}
                      >
                        <td style={{ textAlign: 'center', padding: '14px 16px' }}>
                          <i
                            className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}
                            style={{ color: '#9ca3af', fontSize: '12px', transition: 'transform 0.3s' }}
                          ></i>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fas fa-file-invoice" style={{ color: '#f59e0b' }}></i>
                            <span style={{ fontWeight: '700', fontSize: '14px' }}>{mov.numdoc}</span>
                            {alertaHTML}
                          </div>
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>
                          <i className="fas fa-store" style={{ color: '#3b82f6', marginRight: '6px' }}></i>
                          {mov.lojaOrigem}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>
                          <i className="fas fa-store" style={{ color: '#10b981', marginRight: '6px' }}></i>
                          {mov.lojaDestino}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right' }}>{formatDate(mov.data)}</td>
                        <td style={{ textAlign: 'center', padding: '12px', fontWeight: '600', fontSize: '14px' }}>
                          {mov.produtos.length}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px', fontWeight: '600', fontSize: '14px' }}>
                          {Math.round(mov.totalProdutos)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="transito-expanded-row">
                          <td colSpan="7" style={{ padding: '16px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                            <table className="transito-produtos-table" style={{ width: '100%', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ background: '#f3f4f6' }}>
                                  <th style={{ padding: '8px', textAlign: 'left', width: '100px' }}>Código</th>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>Produto</th>
                                  <th style={{ padding: '8px', textAlign: 'right', width: '80px' }}>Qtd</th>
                                  <th style={{ padding: '8px', textAlign: 'right', width: '80px' }}>Estoque</th>
                                </tr>
                              </thead>
                              <tbody className="transito-produtos-tbody">
                                {mov.produtos.map((prod, pIndex) => {
                                  const estoque = parseFloat(prod.ESTOQUE || 0);
                                  let estoqueColor = '#6b7280';
                                  if (estoque < parseFloat(prod.QTD)) {
                                    estoqueColor = '#dc2626';
                                  } else if (estoque >= parseFloat(prod.QTD)) {
                                    estoqueColor = '#059669';
                                  }

                                  return (
                                    <tr key={pIndex} className="transito-produto-row" style={{ borderBottom: '1px solid #e5e7eb' }}>
                                      <td className="transito-produto-codigo" style={{ padding: '8px' }}>{prod.CDPRODU}</td>
                                      <td className="transito-produto-nome" style={{ padding: '8px' }}>{prod.NOME_PRODUTO}</td>
                                      <td className="transito-produto-qtd" style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }}>
                                        {Math.round(parseFloat(prod.QTD || 0))}
                                      </td>
                                      <td className="transito-produto-estoque" style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: estoqueColor }}>
                                        {Math.round(estoque)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div className="transito-chave-area" style={{ padding: '12px 16px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                              <div className="transito-chave-info" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                <i className="fas fa-key" style={{ color: '#9ca3af' }}></i>
                                <strong>Chave NF-e:</strong>
                                <code className="transito-chave-code" style={{ background: 'white', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace', color: '#374151', border: '1px solid #e5e7eb', fontSize: '10px' }}>
                                  {mov.chave}
                                </code>
                              </div>
                              {mov.chave && mov.chave !== '-' && (
                                <div className="transito-chave-buttons">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); buscarProtocolo(mov.chave); }}
                                    style={{
                                      background: '#8b5cf6',
                                      color: 'white',
                                      border: 'none',
                                      padding: '6px 12px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      whiteSpace: 'nowrap',
                                      transition: 'all 0.2s',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      marginRight: '8px'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.background = '#7c3aed';
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.background = '#8b5cf6';
                                    }}
                                    title="Ver Protocolo"
                                  >
                                    <i className="fas fa-eye"></i>
                                    Protocolo
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copiarNFe(mov.chave, index); }}
                                    style={{
                                      background: copiado === index ? '#10b981' : '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      padding: '6px 12px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      whiteSpace: 'nowrap',
                                      transition: 'all 0.2s',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                    onMouseOver={(e) => {
                                      if (copiado !== index) e.currentTarget.style.background = '#2563eb';
                                    }}
                                    onMouseOut={(e) => {
                                      if (copiado !== index) e.currentTarget.style.background = '#3b82f6';
                                    }}
                                  >
                                    <i className={copiado === index ? 'fas fa-check' : 'fas fa-copy'}></i>
                                    {copiado === index ? 'Copiado!' : 'Copiar'}
                                  </button>
                                </div>
                              )}
                            </div>
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

      {/* Modal de Protocolo */}
      {modalProtocolo && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={fecharModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#111827', fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-file-contract" style={{ color: '#8b5cf6' }}></i>
                Informações do Protocolo
              </h3>
              <button
                onClick={fecharModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px 8px',
                  lineHeight: 1,
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = '#111827'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = '#6b7280'; }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Conteúdo do Modal */}
            {loadingProtocolo && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', color: '#8b5cf6' }}></i>
                <p style={{ marginTop: '16px', color: '#6b7280' }}>Buscando informações do protocolo...</p>
              </div>
            )}

            {!loadingProtocolo && !dadosProtocolo && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <i className="fas fa-exclamation-circle" style={{ fontSize: '32px', color: '#ef4444' }}></i>
                <p style={{ marginTop: '16px', color: '#6b7280' }}>Nenhuma informação de protocolo encontrada para esta chave.</p>
              </div>
            )}

            {!loadingProtocolo && dadosProtocolo && (
              <div>
                <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Documento (Chave NFe)
                    </label>
                    <code style={{ background: 'white', padding: '8px 12px', borderRadius: '4px', fontFamily: 'monospace', color: '#374151', border: '1px solid #e5e7eb', fontSize: '12px', display: 'block', wordBreak: 'break-all' }}>
                      {dadosProtocolo.documento}
                    </code>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Número do Protocolo
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ background: 'white', padding: '8px 12px', borderRadius: '4px', fontFamily: 'monospace', color: '#374151', border: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600', flex: 1 }}>
                        {dadosProtocolo.protocolo}
                      </code>
                      <button
                        onClick={() => copiarProtocolo(dadosProtocolo.protocolo)}
                        style={{
                          background: copiadoProtocolo ? '#10b981' : '#8b5cf6',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onMouseOver={(e) => {
                          if (!copiadoProtocolo) e.currentTarget.style.background = '#7c3aed';
                        }}
                        onMouseOut={(e) => {
                          if (!copiadoProtocolo) e.currentTarget.style.background = '#8b5cf6';
                        }}
                      >
                        <i className={copiadoProtocolo ? 'fas fa-check' : 'fas fa-copy'}></i>
                        {copiadoProtocolo ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Data do Protocolo
                    </label>
                    <div style={{ background: 'white', padding: '8px 12px', borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fas fa-calendar-alt" style={{ color: '#9ca3af' }}></i>
                      {dadosProtocolo.data_cadastro ? formatDate(dadosProtocolo.data_cadastro) : '-'}
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Remetente - Funcionário
                    </label>
                    <div style={{ background: 'white', padding: '8px 12px', borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '13px', color: '#374151' }}>
                      {dadosProtocolo.nome_funcionario ? `${dadosProtocolo.remetente_cdfun} - ${dadosProtocolo.nome_funcionario}` : (dadosProtocolo.remetente_cdfun || '-')}
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Remetente - Filial
                    </label>
                    <div style={{ background: 'white', padding: '8px 12px', borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '13px', color: '#374151' }}>
                      {dadosProtocolo.remetente_cdfil || '-'}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Status
                    </label>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: dadosProtocolo.status === 3 ? '#86efac' : dadosProtocolo.status === 2 ? '#fef3c7' : '#d1fae5',
                      color: dadosProtocolo.status === 3 ? '#166534' : dadosProtocolo.status === 2 ? '#92400e' : '#047857',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      <i className={dadosProtocolo.status === 3 ? 'fas fa-check-circle' : dadosProtocolo.status === 2 ? 'fas fa-truck' : 'fas fa-folder-open'}></i>
                      {traduzirStatus(dadosProtocolo.status)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button
                    onClick={fecharModal}
                    style={{
                      background: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      padding: '8px 20px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#e5e7eb'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DraggableWindow>
  );
};

export default WindowTransito;
