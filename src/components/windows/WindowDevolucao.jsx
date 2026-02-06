import React, { useState, useRef, useEffect, Fragment } from 'react';
import { devolucaoService } from '../../services/api';
import DraggableWindow from './DraggableWindow';
import { useToast } from '../../hooks/useToast';
import { useModal } from '../../hooks/useModal';
import ToastContainer from '../common/ToastContainer';
import ModalFeedback from '../common/ModalFeedback';
import ModalConfirm from '../common/ModalConfirm';

const WindowDevolucao = ({ onClose, onMinimize, isMinimized, zIndex, onFocus, userData }) => {
  const [codigo, setCodigo] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [mostrarModalAdicionar, setMostrarModalAdicionar] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [chaveCopiada, setChaveCopiada] = useState(null);
  const [expandedFornecedor, setExpandedFornecedor] = useState(null);
  const inputRef = useRef(null);
  const inputModalRef = useRef(null);

  // Hooks universais de toast e modal
  const { toasts, mostrarToast, removerToast } = useToast();
  const {
    modalFeedback,
    mostrarFeedback,
    fecharFeedback,
    modalConfirm,
    mostrarConfirmacao,
    confirmarAcao,
    fecharConfirmacao
  } = useModal();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleKeyDownModal = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.target.name === 'codigo' && quantidade) {
        adicionarProdutoModal();
      } else if (e.target.name === 'codigo') {
        document.querySelector('input[name="quantidade"]')?.focus();
      } else if (e.target.name === 'quantidade' && codigo) {
        adicionarProdutoModal();
      }
    } else if (e.key === 'Escape') {
      fecharModal();
    }
  };

  const abrirModal = () => {
    setMostrarModalAdicionar(true);
    setCodigo('');
    setQuantidade('');
    setTimeout(() => {
      inputModalRef.current?.focus();
    }, 100);
  };

  const fecharModal = () => {
    setMostrarModalAdicionar(false);
    setCodigo('');
    setQuantidade('');
  };

  const sugerirNFEs = (nfes, quantidadeDesejada, produtoAtual, todosOsProdutos = produtos) => {
    // Contar quantos produtos da lista aparecem em cada NFE
    const contarProdutosNaNFE = (chavenfe) => {
      if (!chavenfe) return 0;
      return todosOsProdutos.filter(p =>
        p.nfes.some(nfe => nfe.CHAVENFE === chavenfe)
      ).length;
    };

    // Ordenar NFEs: mesma nota de outros produtos, sem devolução, maior quantidade, mais antiga
    const nfesDisponiveis = nfes
      .map(nfe => {
        const devolvida = nfe.devolucao?.QTDDEVOL || 0;
        const disponivel = nfe.QTD - devolvida;
        const qtdProdutosNaNFE = contarProdutosNaNFE(nfe.CHAVENFE);
        return { ...nfe, disponivel, qtdProdutosNaNFE };
      })
      .filter(nfe => nfe.disponivel > 0)
      .sort((a, b) => {
        // 1. Priorizar NFEs que têm outros produtos da lista
        if (b.qtdProdutosNaNFE !== a.qtdProdutosNaNFE) {
          return b.qtdProdutosNaNFE - a.qtdProdutosNaNFE;
        }
        // 2. Priorizar NFEs sem devolução
        const aTemDev = a.devolucao && a.devolucao.QTDDEVOL > 0;
        const bTemDev = b.devolucao && b.devolucao.QTDDEVOL > 0;
        if (aTemDev !== bTemDev) return aTemDev ? 1 : -1;
        // 3. Depois por maior quantidade disponível
        if (b.disponivel !== a.disponivel) return b.disponivel - a.disponivel;
        // 4. Por último, data MAIS ANTIGA (inverti aqui!)
        return new Date(a.DATACONF) - new Date(b.DATACONF);
      });

    const sugeridas = [];
    let restante = quantidadeDesejada;

    for (const nfe of nfesDisponiveis) {
      if (restante <= 0) break;
      const usar = Math.min(restante, nfe.disponivel);
      sugeridas.push({ ...nfe, quantidadeUsar: usar });
      restante -= usar;
    }

    return { sugeridas, faltando: restante > 0 ? restante : 0 };
  };

  // Recalcular sugestões de todos os produtos
  const recalcularTodasSugestoes = (produtosAtualizados) => {
    return produtosAtualizados.map(p => {
      const { sugeridas, faltando } = sugerirNFEs(p.nfes, p.quantidadeDevolver, p.data, produtosAtualizados);
      return {
        ...p,
        nfesSugeridas: sugeridas,
        faltando: faltando
      };
    });
  };

  const adicionarProdutoModal = async () => {
    const cod = codigo.trim();
    const qtd = parseInt(quantidade);

    if (!cod) {
      mostrarFeedback('erro', 'Campo obrigatório', 'Digite um código de produto');
      return;
    }

    if (!qtd || qtd <= 0) {
      mostrarFeedback('erro', 'Campo obrigatório', 'Digite uma quantidade válida');
      return;
    }

    setCarregando(true);

    try {
      const productData = await devolucaoService.buscarProduto(cod, userData.loja_id || 22);

      if (!productData) {
        mostrarFeedback('erro', 'Produto não encontrado', 'Não foi possível encontrar um produto com este código.');
        setCarregando(false);
        return;
      }

      // Verificar se já existe
      const exists = produtos.find(p => p.data.CDPRODU === productData.CDPRODU);
      if (exists) {
        mostrarFeedback('aviso', 'Produto duplicado', 'Este produto já está na lista de devoluções!');
        setCarregando(false);
        return;
      }

      // Buscar NFEs
      const nfes = await devolucaoService.buscarNFEs(productData.CDPRODU, userData.loja_id || 22);

      // Verificar devoluções para cada NFE
      for (const nfe of nfes) {
        if (nfe.CHAVENFE) {
          try {
            const devolucao = await devolucaoService.verificarDevolucao(nfe.CHAVENFE, productData.CDPRODU);
            nfe.devolucao = devolucao;
          } catch (error) {
            nfe.devolucao = null;
          }
        }
      }

      // Buscar últimos pedidos
      const pedidos = await devolucaoService.buscarPedidos(productData.CDPRODU, userData.loja_id || 22);

      // Criar novo produto sem sugestões ainda
      const novoProduto = {
        code: productData.CDPRODU,
        data: productData,
        quantidadeDevolver: qtd,
        nfes: nfes,
        nfesSugeridas: [],
        faltando: 0,
        pedidos: pedidos
      };

      // Adicionar à lista temporária e recalcular TODAS as sugestões
      setProdutos(prev => {
        const todosOsProdutos = [...prev, novoProduto];
        const produtosRecalculados = recalcularTodasSugestoes(todosOsProdutos);
        return produtosRecalculados;
      });

      setCodigo('');
      setQuantidade('');
      inputModalRef.current?.focus();

      // Calcular se falta quantidade (usando a lista atualizada)
      const { faltando } = sugerirNFEs(nfes, qtd, productData, [...produtos, novoProduto]);
      if (faltando > 0) {
        mostrarFeedback('aviso', 'Quantidade insuficiente', `Faltam ${faltando} unidades! Não há NFEs suficientes com estoque disponível.`);
      } else {
        mostrarToast('sucesso', `${productData.NOME} adicionado com sucesso!`);
      }

    } catch (error) {
      console.error('Erro:', error);
      mostrarFeedback('erro', 'Erro ao buscar produto', error.message || 'Ocorreu um erro ao buscar os dados do produto.');
    } finally {
      setCarregando(false);
    }
  };

  const removerProduto = (idx) => {
    const produto = produtos[idx];
    mostrarConfirmacao(
      'Remover produto?',
      `Deseja remover "${produto.data.NOME}" da lista de devoluções?`,
      () => {
        setProdutos(prev => {
          const novosProds = prev.filter((_, i) => i !== idx);
          // Recalcular sugestões após remover
          return recalcularTodasSugestoes(novosProds);
        });
        mostrarToast('sucesso', `${produto.data.NOME} removido com sucesso!`);
      }
    );
  };

  const limparTodos = () => {
    if (produtos.length === 0) return;
    const qtd = produtos.length;
    mostrarConfirmacao(
      'Limpar lista?',
      `Tem certeza que deseja remover todos os ${qtd} produto(s) da lista?`,
      () => {
        setProdutos([]);
        setExpandedFornecedor(null);
        mostrarToast('sucesso', `${qtd} produto(s) removido(s) da lista!`);
      }
    );
  };

  // Agrupar produtos por fornecedor
  const agruparPorFornecedor = () => {
    const grupos = {};

    produtos.forEach(p => {
      const fornecedor = p.data.FORNECEDOR || 'SEM FORNECEDOR';
      const cdforne = p.data.CDFORNE || '0';
      const chave = `${cdforne}_${fornecedor}`;

      if (!grupos[chave]) {
        grupos[chave] = {
          fornecedor,
          cdforne,
          produtos: []
        };
      }

      grupos[chave].produtos.push(p);
    });

    return Object.values(grupos).sort((a, b) => a.fornecedor.localeCompare(b.fornecedor));
  };

  // Verificar se outros produtos da lista estão na mesma chave NFE
  const verificarProdutosMesmaChave = (chavenfe) => {
    const produtosNaMesmaChave = produtos.filter(p =>
      p.nfes.some(nfe => nfe.CHAVENFE === chavenfe)
    );
    return produtosNaMesmaChave.length > 1 ? produtosNaMesmaChave : [];
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const copiarChave = (chavenfe) => {
    navigator.clipboard.writeText(chavenfe).then(() => {
      setChaveCopiada(chavenfe);
      setTimeout(() => setChaveCopiada(null), 2000);
    }).catch(err => {
      console.error('Erro ao copiar:', err);
      mostrarFeedback('erro', 'Erro ao copiar', 'Não foi possível copiar a chave NFE.');
    });
  };

  return (
    <DraggableWindow
      title="Consulta de Devoluções"
      icon="fa-search"
      onClose={onClose}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      zIndex={zIndex}
      onFocus={onFocus}
      initialWidth={1100}
      initialTop={60}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Botões de Ação */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <button
            onClick={abrirModal}
            disabled={carregando}
            style={{
              padding: '12px 20px',
              background: carregando ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: carregando ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: 1
            }}
            onMouseOver={(e) => {
              if (!carregando) e.target.style.background = '#2563eb';
            }}
            onMouseOut={(e) => {
              if (!carregando) e.target.style.background = '#3b82f6';
            }}
          >
            <i className="fas fa-plus-circle"></i>
            Adicionar Produto para Devolução
          </button>

          {produtos.length > 0 && (
            <button
              onClick={limparTodos}
              style={{
                padding: '12px 20px',
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => { e.target.style.background = '#fecaca'; }}
              onMouseOut={(e) => { e.target.style.background = '#fee2e2'; }}
            >
              <i className="fas fa-trash"></i>
              Limpar Tudo
            </button>
          )}
        </div>

        {/* Loading */}
        {carregando && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', color: '#3b82f6' }}></i>
            <p style={{ marginTop: '10px', color: '#64748b', fontSize: '14px' }}>Carregando...</p>
          </div>
        )}

        {/* Produtos Agrupados por Fornecedor */}
        {produtos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {agruparPorFornecedor().map((grupo, grupoIdx) => {
              const chaveGrupo = `${grupo.cdforne}_${grupo.fornecedor}`;
              const isExpanded = expandedFornecedor === chaveGrupo;
              const totalProdutos = grupo.produtos.length;
              const totalDevolver = grupo.produtos.reduce((sum, p) => sum + p.quantidadeDevolver, 0);

              return (
                <div key={grupoIdx} style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  {/* Header do Fornecedor */}
                  <div
                    onClick={() => setExpandedFornecedor(isExpanded ? null : chaveGrupo)}
                    style={{
                      padding: '16px',
                      background: '#f8fafc',
                      borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`} style={{ color: '#64748b', fontSize: '12px' }}></i>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                          {grupo.fornecedor}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          Código: {grupo.cdforne} • {totalProdutos} produto(s) • Total a devolver: {totalDevolver} un
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Produtos do Fornecedor */}
                  {isExpanded && (
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {grupo.produtos.map((p, pIdx) => (
                        <div key={pIdx} style={{
                          background: '#fafafa',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '14px'
                        }}>
                          {/* Header do Produto */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                                {p.data.CDPRODU} - {p.data.NOME}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '12px' }}>
                                <span>Devolver: <strong style={{ color: '#dc2626' }}>{p.quantidadeDevolver}</strong> un</span>
                                {p.faltando > 0 && (
                                  <span style={{ color: '#ea580c', fontWeight: '600' }}>
                                    ⚠ Faltam {p.faltando} un
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => removerProduto(produtos.indexOf(p))}
                              style={{
                                padding: '6px 12px',
                                background: '#fee2e2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>

                          {/* NFEs Sugeridas */}
                          {p.nfesSugeridas && p.nfesSugeridas.length > 0 && (
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                <i className="fas fa-check-circle" style={{ color: '#10b981' }}></i> NFEs Sugeridas Automaticamente:
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {p.nfesSugeridas.map((nfe, nfeIdx) => (
                                  <div key={nfeIdx} style={{
                                    background: 'white',
                                    border: '1px solid #10b981',
                                    borderRadius: '6px',
                                    padding: '10px 12px',
                                    fontSize: '11px'
                                  }}>
                                    {/* Primeira linha: Info da NFE */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      marginBottom: '8px'
                                    }}>
                                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: '700', color: '#1e293b' }}>NF {nfe.NRNOTA}</span>
                                        <span style={{ color: '#64748b' }}>{formatDate(nfe.DATACONF)}</span>
                                        <span style={{ color: '#10b981', fontWeight: '600' }}>
                                          Usar: {nfe.quantidadeUsar} un
                                        </span>
                                        <span style={{ color: '#64748b' }}>
                                          (Disponível: {nfe.disponivel})
                                        </span>
                                        {nfe.qtdProdutosNaNFE > 1 && (
                                          <span style={{
                                            padding: '2px 8px',
                                            background: '#dbeafe',
                                            color: '#1e40af',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: '600'
                                          }}>
                                            <i className="fas fa-link"></i> {nfe.qtdProdutosNaNFE} produtos nesta nota
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Segunda linha: Chave NFE */}
                                    {nfe.CHAVENFE && (
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        background: '#f8fafc',
                                        padding: '6px 8px',
                                        borderRadius: '4px'
                                      }}>
                                        <span style={{
                                          fontSize: '10px',
                                          color: '#64748b',
                                          fontWeight: '600',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px'
                                        }}>
                                          Chave:
                                        </span>
                                        <span style={{
                                          fontSize: '10px',
                                          fontFamily: 'monospace',
                                          color: '#1e293b',
                                          flex: 1,
                                          letterSpacing: '0.5px'
                                        }}>
                                          {nfe.CHAVENFE}
                                        </span>
                                        <button
                                          onClick={() => copiarChave(nfe.CHAVENFE)}
                                          style={{
                                            padding: '4px 10px',
                                            background: chaveCopiada === nfe.CHAVENFE ? '#10b981' : '#3b82f6',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '10px',
                                            fontWeight: '600',
                                            color: 'white',
                                            transition: 'all 0.2s',
                                            whiteSpace: 'nowrap'
                                          }}
                                          onMouseOver={(e) => {
                                            if (chaveCopiada !== nfe.CHAVENFE) {
                                              e.target.style.background = '#2563eb';
                                            }
                                          }}
                                          onMouseOut={(e) => {
                                            if (chaveCopiada !== nfe.CHAVENFE) {
                                              e.target.style.background = '#3b82f6';
                                            }
                                          }}
                                        >
                                          <i className={`fas ${chaveCopiada === nfe.CHAVENFE ? 'fa-check' : 'fa-copy'}`}></i>
                                          {chaveCopiada === nfe.CHAVENFE ? ' Copiado!' : ' Copiar'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {carregando && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', color: '#0ea5e9' }}></i>
            <p style={{ marginTop: '10px', color: '#64748b', fontSize: '14px' }}>Carregando...</p>
          </div>
        )}

        {/* Produtos Agrupados por Fornecedor - Ja esta implementado nas linhas anteriores */}
        {false && produtos.length > 0 && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                <i className="fas fa-list" style={{ color: '#64748b' }}></i> Produtos Consultados
              </h4>
              <span style={{
                padding: '4px 12px',
                background: '#3b82f6',
                color: 'white',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {produtos.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {produtos.map((p, idx) => {
                const totalDevolvido = p.nfes.reduce((sum, nfe) => sum + (nfe.devolucao?.QTDDEVOL || 0), 0);
                const hasDevolution = totalDevolvido > 0;

                return (
                  <div key={idx} style={{
                    background: 'white',
                    border: `1px solid ${hasDevolution ? '#fed7aa' : '#e2e8f0'}`,
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#1f2937', marginBottom: '4px' }}>
                        {p.data.CDPRODU} - {p.data.NOME}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span>Fornecedor: {p.data.FORNECEDOR || 'N/A'} ({p.data.CDFORNE})</span>
                        {hasDevolution && (
                          <span style={{ color: '#d97706', fontWeight: '600' }}>
                            ⚠ Total Devolvido: {totalDevolvido}
                          </span>
                        )}
                        <span style={{ color: '#64748b' }}>
                          {p.nfes.length} entradas | {p.pedidos.length} pedidos
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removerProduto(idx)}
                      style={{
                        padding: '6px 12px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detalhes dos Produtos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {produtos.map((p, idx) => {
            const isExpanded = expandedProduct === idx;
            const totalEntradas = p.nfes.reduce((sum, nfe) => sum + nfe.QTD, 0);
            const totalDevolvido = p.nfes.reduce((sum, nfe) => sum + (nfe.devolucao?.QTDDEVOL || 0), 0);
            const hasDevolutions = p.nfes.some(nfe => nfe.devolucao && nfe.devolucao.QTDDEVOL > 0);

            return (
              <div key={idx} style={{
                background: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '12px'
              }}>
                {/* Header do Produto - Clicável para expandir */}
                <div
                  onClick={() => setExpandedProduct(isExpanded ? null : idx)}
                  style={{
                    padding: '16px 20px',
                    background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                    borderBottom: isExpanded ? '2px solid #e5e7eb' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                        {p.data.NOME}
                      </h3>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ padding: '4px 10px', background: '#e0e7ff', color: '#3730a3', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                          Código: {p.data.CDPRODU}
                        </span>
                        <span style={{ padding: '4px 10px', background: '#dbeafe', color: '#1e40af', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                          Total Entradas: {totalEntradas}
                        </span>
                        {hasDevolutions && (
                          <span style={{ padding: '4px 10px', background: '#fed7aa', color: '#9a3412', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                            ⚠ Devolvido: {totalDevolvido}
                          </span>
                        )}
                        <span style={{ padding: '4px 10px', background: '#f3e8ff', color: '#7c3aed', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                          Fornecedor: {p.data.FORNECEDOR || 'N/A'} ({p.data.CDFORNE})
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '18px', color: '#6b7280' }}>
                      <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                    </div>
                  </div>
                </div>

                {/* Conteúdo Expandido */}
                {isExpanded && (
                  <div style={{ padding: '20px', maxHeight: '600px', overflowY: 'auto', overflowX: 'hidden' }}>
                    {/* Informações do Produto */}
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                        <i className="fas fa-info-circle" style={{ color: '#3b82f6' }}></i> Informações do Produto
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        padding: '16px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Preço</div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#059669' }}>{formatCurrency(p.data.PRECO)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Custo Líquido</div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#dc2626' }}>{formatCurrency(p.data.CUSLIQ)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Última Compra</div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>{formatCurrency(p.data.ULTPRE)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Qtd Última Compra</div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>{p.data.ULTQTD}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Embalagem</div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>{p.data.EMBCOM}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Status</div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: p.data.FGATIVO === 'S' ? '#059669' : '#dc2626' }}>
                            {p.data.FGATIVO === 'S' ? '✓ Ativo' : '✗ Inativo'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Entradas (NFEs) - Tabela */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                          <i className="fas fa-file-invoice" style={{ color: '#64748b' }}></i> Entradas (NFEs)
                          {hasDevolutions && (
                            <span style={{
                              marginLeft: '8px',
                              padding: '2px 8px',
                              background: '#fed7aa',
                              color: '#9a3412',
                              borderRadius: '4px',
                              fontSize: '10px'
                            }}>
                              ⚠ Há devoluções registradas
                            </span>
                          )}
                        </h4>
                      </div>

                      {p.nfes.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>
                          Nenhuma entrada encontrada
                        </p>
                      ) : (
                        <div style={{
                          overflowX: 'auto',
                          background: 'white',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <table style={{
                            width: '100%',
                            borderCollapse: 'separate',
                            borderSpacing: 0,
                            fontSize: '12px'
                          }}>
                            <thead>
                              <tr style={{
                                background: '#f8fafc',
                                borderBottom: '2px solid #e2e8f0'
                              }}>
                                <th style={{
                                  padding: '10px 12px',
                                  textAlign: 'left',
                                  fontWeight: '600',
                                  fontSize: '11px',
                                  color: '#64748b',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  whiteSpace: 'nowrap'
                                }}>Status</th>
                                <th style={{
                                  padding: '10px 12px',
                                  textAlign: 'left',
                                  fontWeight: '600',
                                  fontSize: '11px',
                                  color: '#64748b',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  whiteSpace: 'nowrap'
                                }}>Nota Fiscal</th>
                                <th style={{
                                  padding: '10px 12px',
                                  textAlign: 'left',
                                  fontWeight: '600',
                                  fontSize: '11px',
                                  color: '#64748b',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  whiteSpace: 'nowrap'
                                }}>Data</th>
                                <th style={{
                                  padding: '10px 12px',
                                  textAlign: 'left',
                                  fontWeight: '600',
                                  fontSize: '11px',
                                  color: '#64748b',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  whiteSpace: 'nowrap'
                                }}>Fornecedor</th>
                                <th style={{
                                  padding: '10px 12px',
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  fontSize: '11px',
                                  color: '#64748b',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  whiteSpace: 'nowrap'
                                }}>Qtd Entrada</th>
                                <th style={{
                                  padding: '10px 12px',
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  fontSize: '11px',
                                  color: '#64748b',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  whiteSpace: 'nowrap'
                                }}>Devolvido</th>
                                <th style={{
                                  padding: '10px 12px',
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  fontSize: '11px',
                                  color: '#64748b',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  whiteSpace: 'nowrap'
                                }}>Disponível</th>
                                <th style={{
                                  padding: '10px 12px',
                                  textAlign: 'right',
                                  fontWeight: '600',
                                  fontSize: '11px',
                                  color: '#64748b',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  whiteSpace: 'nowrap'
                                }}>Vlr Unit.</th>
                                <th style={{
                                  padding: '10px 12px',
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  fontSize: '11px',
                                  color: '#64748b',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  whiteSpace: 'nowrap'
                                }}>Chave NFE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.nfes.map((nfe, nfeIdx) => {
                                const hasDevolution = nfe.devolucao && nfe.devolucao.QTDDEVOL > 0;
                                const devolvida = hasDevolution ? nfe.devolucao.QTDDEVOL : 0;
                                const qtdDisponivel = nfe.QTD - devolvida;
                                const produtosMesmaChave = verificarProdutosMesmaChave(nfe.CHAVENFE);
                                const temOutrosProdutos = produtosMesmaChave.length > 1;

                                return (
                                  <Fragment key={nfeIdx}>
                                    <tr style={{
                                      background: hasDevolution ? '#fffbeb' : (nfeIdx % 2 === 0 ? '#fafafa' : 'white'),
                                      borderBottom: '1px solid #e5e7eb',
                                      transition: 'all 0.15s'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.background = '#f1f5f9';
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.background = hasDevolution ? '#fffbeb' : (nfeIdx % 2 === 0 ? '#fafafa' : 'white');
                                    }}>
                                      <td style={{ padding: '12px' }}>
                                        <span style={{
                                          padding: '4px 8px',
                                          background: hasDevolution ? '#fef3c7' : '#dcfce7',
                                          color: hasDevolution ? '#92400e' : '#166534',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          fontWeight: '600',
                                          whiteSpace: 'nowrap',
                                          display: 'inline-block'
                                        }}>
                                          {hasDevolution ? '↩ DEV' : '✓ OK'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '14px 12px' }}>
                                        <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{nfe.NRNOTA}</div>
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                          Série {nfe.NRSERIE}
                                        </div>
                                      </td>
                                      <td style={{ padding: '14px 12px' }}>
                                        <div style={{ color: '#374151', fontWeight: '500', fontSize: '12px' }}>
                                          {formatDate(nfe.DATACONF)}
                                        </div>
                                      </td>
                                      <td style={{ padding: '14px 12px' }}>
                                        <div style={{ fontWeight: '600', color: '#111827', fontSize: '12px' }}>{nfe.ABREV}</div>
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                          Cód: {nfe.CDFORNE}
                                        </div>
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                          fontWeight: '600',
                                          color: '#374151',
                                          fontSize: '12px'
                                        }}>
                                          {nfe.QTD}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div>
                                          <span style={{
                                            fontWeight: '600',
                                            color: hasDevolution ? '#d97706' : '#9ca3af',
                                            fontSize: '12px'
                                          }}>
                                            {devolvida}
                                          </span>
                                        </div>
                                        {hasDevolution && nfe.devolucao.NRDOCDEVOL && (
                                          <div style={{
                                            fontSize: '10px',
                                            color: '#9ca3af',
                                            marginTop: '2px'
                                          }}>
                                            Doc: {nfe.devolucao.NRDOCDEVOL}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                          fontWeight: '600',
                                          fontSize: '12px',
                                          color: qtdDisponivel > 0 ? '#16a34a' : '#dc2626'
                                        }}>
                                          {qtdDisponivel}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'right' }}>
                                        <span style={{
                                          fontWeight: '600',
                                          color: '#059669',
                                          fontSize: '12px'
                                        }}>
                                          {nfe.VLRUNI ? formatCurrency(nfe.VLRUNI) : '-'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {nfe.CHAVENFE && (
                                          <button
                                            onClick={() => copiarChave(nfe.CHAVENFE)}
                                            style={{
                                              padding: '6px 12px',
                                              background: chaveCopiada === nfe.CHAVENFE ? '#10b981' : '#3b82f6',
                                              border: 'none',
                                              borderRadius: '6px',
                                              cursor: 'pointer',
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              color: 'white',
                                              transition: 'all 0.2s',
                                              whiteSpace: 'nowrap'
                                            }}
                                            onMouseOver={(e) => {
                                              if (chaveCopiada !== nfe.CHAVENFE) {
                                                e.target.style.background = '#2563eb';
                                              }
                                            }}
                                            onMouseOut={(e) => {
                                              if (chaveCopiada !== nfe.CHAVENFE) {
                                                e.target.style.background = '#3b82f6';
                                              }
                                            }}
                                            title={chaveCopiada === nfe.CHAVENFE ? 'Copiado!' : nfe.CHAVENFE}
                                          >
                                            <i className={`fas ${chaveCopiada === nfe.CHAVENFE ? 'fa-check' : 'fa-copy'}`}></i>
                                            {chaveCopiada === nfe.CHAVENFE ? ' Copiado!' : ' Copiar'}
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                    {/* Linha de detalhes adicionais - outros produtos */}
                                    {temOutrosProdutos && (
                                      <tr style={{
                                        background: '#f1f5f9',
                                        borderBottom: '1px solid #cbd5e1'
                                      }}>
                                        <td colSpan="9" style={{ padding: '8px 12px', fontSize: '11px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <i className="fas fa-link" style={{
                                              color: '#64748b',
                                              fontSize: '11px'
                                            }}></i>
                                            <span style={{
                                              fontWeight: '600',
                                              color: '#64748b',
                                              fontSize: '10px'
                                            }}>
                                              Outros produtos nesta NFE:
                                            </span>
                                            <span style={{
                                              color: '#1e293b',
                                              fontWeight: '600',
                                              fontSize: '10px'
                                            }}>
                                              {produtosMesmaChave.filter(pr => pr.code !== p.code).map(pr => `${pr.data.CDPRODU}`).join(', ')}
                                            </span>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Últimos Pedidos */}
                    {p.pedidos && p.pedidos.length > 0 && (
                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
                          <i className="fas fa-clipboard-list" style={{ color: '#64748b' }}></i> Últimos Pedidos
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                          {p.pedidos.map((ped, pedIdx) => (
                            <div key={pedIdx} style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '10px',
                              fontSize: '11px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontWeight: '700', color: '#1e293b' }}>Pedido #{ped.NRPEDIDO}</span>
                                <span style={{ color: '#64748b', fontSize: '10px' }}>{formatDate(ped.DATA)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                                <span>Qtd: {ped.QTD}</span>
                                <span style={{ fontWeight: '700', color: '#0f766e' }}>{formatCurrency(ped.VLRPED)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Resumo Geral */}
        {produtos.length > 0 && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
              <i className="fas fa-chart-bar" style={{ color: '#64748b' }}></i> Resumo Geral
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              <div style={{ background: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Total de Produtos</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>{produtos.length}</div>
              </div>
              <div style={{ background: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Total de Entradas</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669' }}>
                  {produtos.reduce((sum, p) => sum + p.nfes.length, 0)}
                </div>
              </div>
              <div style={{ background: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Produtos com Devolução</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#d97706' }}>
                  {produtos.filter(p => p.nfes.some(nfe => nfe.devolucao && nfe.devolucao.QTDDEVOL > 0)).length}
                </div>
              </div>
              <div style={{ background: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Total Devolvido (Un)</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#dc2626' }}>
                  {produtos.reduce((sum, p) =>
                    sum + p.nfes.reduce((nfeSum, nfe) =>
                      nfeSum + (nfe.devolucao?.QTDDEVOL || 0), 0
                    ), 0
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Adicionar Produto */}
        {mostrarModalAdicionar && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000
            }}
            onClick={fecharModal}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '24px',
                width: '90%',
                maxWidth: '500px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                  <i className="fas fa-plus-circle" style={{ color: '#3b82f6', marginRight: '8px' }}></i>
                  Adicionar Produto para Devolução
                </h3>
                <button
                  onClick={fecharModal}
                  style={{
                    padding: '6px 10px',
                    background: '#f3f4f6',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#64748b'
                  }}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Campo Código */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                    Código ou Código de Barras
                  </label>
                  <input
                    ref={inputModalRef}
                    type="text"
                    name="codigo"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    onKeyDown={handleKeyDownModal}
                    placeholder="Digite ou bipe o código..."
                    disabled={carregando}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      background: carregando ? '#f8fafc' : 'white'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>

                {/* Campo Quantidade */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                    Quantidade a Devolver
                  </label>
                  <input
                    type="number"
                    name="quantidade"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    onKeyDown={handleKeyDownModal}
                    placeholder="Digite a quantidade..."
                    min="1"
                    disabled={carregando}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      background: carregando ? '#f8fafc' : 'white'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>

                {/* Dica */}
                <div style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '12px',
                  color: '#1e40af'
                }}>
                  <i className="fas fa-lightbulb" style={{ marginRight: '6px' }}></i>
                  <strong>Dica:</strong> O sistema vai sugerir automaticamente as melhores NFEs para usar baseado na quantidade informada!
                </div>

                {/* Botões */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    onClick={adicionarProdutoModal}
                    disabled={carregando || !codigo || !quantidade}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: (carregando || !codigo || !quantidade) ? '#cbd5e1' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: (carregando || !codigo || !quantidade) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => {
                      if (!carregando && codigo && quantidade) e.target.style.background = '#2563eb';
                    }}
                    onMouseOut={(e) => {
                      if (!carregando && codigo && quantidade) e.target.style.background = '#3b82f6';
                    }}
                  >
                    {carregando ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Carregando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-plus"></i>
                        Adicionar
                      </>
                    )}
                  </button>
                  <button
                    onClick={fecharModal}
                    disabled={carregando}
                    style={{
                      padding: '12px 24px',
                      background: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: carregando ? 'not-allowed' : 'pointer'
                    }}
                    onMouseOver={(e) => { if (!carregando) e.target.style.background = '#e5e7eb'; }}
                    onMouseOut={(e) => { if (!carregando) e.target.style.background = '#f3f4f6'; }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Componentes Universais de Feedback */}
        <ToastContainer toasts={toasts} onRemove={removerToast} />

        <ModalFeedback
          show={modalFeedback.show}
          tipo={modalFeedback.tipo}
          titulo={modalFeedback.titulo}
          mensagem={modalFeedback.mensagem}
          onClose={fecharFeedback}
        />

        <ModalConfirm
          show={modalConfirm.show}
          titulo={modalConfirm.titulo}
          mensagem={modalConfirm.mensagem}
          onConfirm={confirmarAcao}
          onCancel={fecharConfirmacao}
        />
      </div>
    </DraggableWindow>
  );
};

export default WindowDevolucao;
