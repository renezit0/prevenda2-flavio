import React, { useState, useRef, useEffect, useCallback } from 'react';
import { produtoService } from '../../services/api';
import DraggableWindow from './DraggableWindow';

const WindowPreco = ({
  onClose,
  zIndex,
  onFocus,
  userData,
  onProductConsulted,
  onOpenEstoque,
  embedded = false,
  initialCodigo = '',
  autoBuscar = false,
  onAddProduct
}) => {
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [dropdownIndex, setDropdownIndex] = useState(0);
  const [lastCdprodu, setLastCdprodu] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Focar automaticamente no input quando a janela abrir
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Função para buscar produtos por nome
  const buscarPorNome = async (termo) => {
    try {
      const response = await produtoService.buscarPorNome(termo, userData.loja_id || 22);
      if (response && response.length > 0) {
        setSugestoes(response);
        setMostrarSugestoes(true);
        setDropdownIndex(0);
        posicionarDropdown();
      }
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
    }
  };

  // Posicionar dropdown
  const posicionarDropdown = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom,
        left: rect.left,
        width: rect.width - 110
      });
    }
  };

  // Handle input change
  const handleInputChange = (e) => {
    const valor = e.target.value;
    setCodigo(valor);

    if (valor.startsWith('*')) {
      const termo = valor.substring(1).trim();
      if (termo.length >= 2) {
        buscarPorNome(termo);
      }
    } else {
      const isSomenteNumero = /^\d+$/.test(valor);
      if (!isSomenteNumero && valor.length >= 3) {
        setMostrarSugestoes(true);
        setSugestoes([{ hint: true }]);
        setDropdownIndex(0);
        posicionarDropdown();
      } else {
        setMostrarSugestoes(false);
      }
    }
  };

  // Handle Enter key
  const handleKeyDown = async (e) => {
    if (mostrarSugestoes && sugestoes.length > 0 && !sugestoes[0]?.hint) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDropdownIndex((idx) => Math.min(sugestoes.length - 1, idx + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDropdownIndex((idx) => Math.max(0, idx - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = sugestoes[dropdownIndex] || sugestoes[0];
        if (selected?.CDPRODU) {
          selecionarProduto(selected.CDPRODU);
        }
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const valor = String(codigo).trim();
      const isSomenteNumero = /^\d+$/.test(valor);

      if (!isSomenteNumero && valor.length >= 3 && !valor.startsWith('*')) {
        await buscarPorNome(valor);
      } else if (!valor.startsWith('*')) {
        handleSubmit(e);
      }
    }
  };


  // Selecionar produto
  const selecionarProduto = (cdprodu) => {
    setCodigo(String(cdprodu));
    setMostrarSugestoes(false);
    setSugestoes([]);
    setTimeout(() => handleBuscarPreco(String(cdprodu)), 100);
  };

  // Buscar preço
  const handleBuscarPreco = useCallback(async (codigoProduto) => {
    const cod = String(codigoProduto || codigo);
    if (!cod || cod.startsWith('*')) return;

    setCarregando(true);
    setErro('');
    setResultado(null);

    try {
      const data = await produtoService.buscarPreco(cod, userData.loja_id || 22);

      setResultado({
        ...data,
        imageUrl: data.imageUrl || 'https://via.placeholder.com/120?text=Sem+Imagem'
      });

      // Salvar código do produto consultado para F6
      setLastCdprodu(data.cdprodu);
      if (onProductConsulted && data.cdprodu) {
        onProductConsulted(data.cdprodu);
      }

      setCodigo('');
    } catch (error) {
      console.error('Erro ao buscar preço:', error);
      setErro(error.message || 'Erro ao consultar preço');
    } finally {
      setCarregando(false);
    }
  }, [codigo, userData, onProductConsulted]);

  useEffect(() => {
    if (!initialCodigo) return;
    setCodigo(String(initialCodigo));
    if (autoBuscar) {
      setTimeout(() => handleBuscarPreco(String(initialCodigo)), 50);
    }
  }, [initialCodigo, autoBuscar, handleBuscarPreco]);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleBuscarPreco();
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Get badge grupo
  const getBadgeGrupo = (grupo) => {
    const grupoNum = parseInt(grupo);
    const baseStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      fontWeight: '700',
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      lineHeight: '1',
      color: 'white'
    };

    if (grupoNum === 36) {
      return <span style={{ ...baseStyle, background: '#fb923c' }} title="Conveniência">+</span>;
    } else if (grupoNum === 20 || grupoNum === 25) {
      return <span style={{ ...baseStyle, background: '#ef4444' }} title="Rentáveis">+</span>;
    } else if (grupoNum === 46) {
      return <span style={{ ...baseStyle, background: '#a855f7' }} title="Perfumaria">+</span>;
    } else if (grupoNum === 22) {
      return <span style={{ ...baseStyle, background: '#22c55e' }} title="Saúde">+</span>;
    }
    return null;
  };

  // Get badge tipo
  const getBadgeTipo = (tipo) => {
    const tipoNum = parseInt(tipo);
    const baseStyle = {
      display: 'inline-block',
      fontSize: '8px',
      fontWeight: '600',
      padding: '3px 6px',
      borderRadius: '4px',
      letterSpacing: '0.2px',
      textTransform: 'uppercase',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    };

    if (tipoNum === 1) {
      return <span style={{ ...baseStyle, background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' }}>R</span>;
    } else if (tipoNum === 2) {
      return <span style={{ ...baseStyle, background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>S</span>;
    } else if (tipoNum === 3) {
      return <span style={{ ...baseStyle, background: '#fef3c7', color: '#a16207', border: '1px solid #fde047' }}>G</span>;
    } else if (tipoNum === 5) {
      return <span style={{ ...baseStyle, background: '#f5f5f5', color: '#525252', border: '1px solid #d4d4d4' }}>Dermocosmetico</span>;
    }
    return null;
  };

  // Função para abrir estoque do produto (F6)
  const abrirEstoqueProduto = useCallback(() => {
    if (!onOpenEstoque) return;
    if (!lastCdprodu) {
      alert('Consulte um produto primeiro para visualizar o estoque.');
      return;
    }
    onOpenEstoque(lastCdprodu);
  }, [lastCdprodu, onOpenEstoque]);

  useEffect(() => {
    const handleResize = () => {
      if (mostrarSugestoes) {
        posicionarDropdown();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [mostrarSugestoes]);

  // Listener para F6
  useEffect(() => {
    if (!onOpenEstoque) return;
    const handleKeyDown = (e) => {
      if (e.keyCode === 117) { // F6
        e.preventDefault();
        abrirEstoqueProduto();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abrirEstoqueProduto, onOpenEstoque]);

  const windowWidth = 860;
  const windowTop = Math.max(20, (window.innerHeight - 640) / 2);
  const windowLeft = Math.max(20, (window.innerWidth - windowWidth) / 2);

  const content = (
    <div className={embedded ? 'preco-standalone' : undefined}>
      {embedded && (
        <div className="preco-standalone-header">
          <img src="/favicon.png" alt="seeLL" />
          <div>
            <h1>Consulta de Preço</h1>
            <p>Filial 22</p>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="consulta-form">
        <div className="consulta-form-group">
          <label htmlFor="preco-codigo">Código de Barras, Código Interno ou Nome do Produto</label>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                ref={inputRef}
                type="text"
                id="preco-codigo"
                value={codigo}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Digite o código ou *nome para buscar..."
                style={{ flex: 1 }}
                autoComplete="off"
              />
              <button type="submit" className="consulta-btn-submit" style={{ width: '100px', height: '46px' }}>
                <i className="fas fa-search"></i>
              </button>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              💡 Use <strong>*</strong> antes do nome para buscar produtos. Ex: <code>*GOODLIFE</code>
            </div>
          </div>
        </div>
      </form>

      {/* Dropdown de sugestões */}
      {mostrarSugestoes && sugestoes.length > 0 && (
        <div
          ref={dropdownRef}
          className="preco-dropdown-sugestoes"
          style={{
            display: 'block',
            position: 'fixed',
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
            background: 'white',
            border: '2px solid #10b981',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 50000,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
          }}
        >
          {sugestoes[0]?.hint ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#10b981', fontSize: '13px', background: '#f0fdf4', borderBottom: '1px solid #86efac' }}>
              <i className="fas fa-info-circle"></i> Pressione <strong>Enter</strong> para buscar por nome
            </div>
          ) : (
            sugestoes.map((prod, idx) => {
              const estoque = parseFloat(prod.ESTOQUE || 0);
              const temEstoque = estoque > 0;

              // Se PRECO for 0, usar PRECO_SEM_DESCONTO
              let precoExibir = parseFloat(prod.PRECO || 0);
              if (precoExibir === 0) {
                precoExibir = parseFloat(prod.PRECO_SEM_DESCONTO || 0);
              }

              return (
                <div
                  key={prod.CDPRODU}
                  onClick={() => selecionarProduto(prod.CDPRODU)}
                  style={{
                    padding: '10px 12px',
                    borderBottom: idx < sugestoes.length - 1 ? '1px solid #f3f4f6' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    background: dropdownIndex === idx ? '#eef2ff' : 'white'
                  }}
                  onMouseEnter={() => setDropdownIndex(idx)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: '#111827' }}>
                      {prod.CDPRODU} - {prod.NOME}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginLeft: '12px', whiteSpace: 'nowrap' }}>
                      <i className="fas fa-map-marker-alt" style={{ color: '#3b82f6' }}></i> {prod.ENDERECO}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: temEstoque ? '#10b981' : '#ef4444'
                        }}></span>
                        Estoque: <strong style={{ color: temEstoque ? '#10b981' : '#ef4444' }}>{estoque.toFixed(0)}</strong>
                      </span>
                      <span>Preço: <strong style={{ color: '#059669' }}>R$ {precoExibir.toFixed(2)}</strong></span>
                    </div>
                    {prod.PBM === 'S' && (
                      <span style={{
                        fontSize: '9px',
                        fontWeight: '600',
                        color: '#92400e',
                        background: '#fef3c7',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        border: '1px solid #fde68a'
                      }}>
                        PBM
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="preco-resultado-container" style={{ marginTop: '20px' }}>
        {carregando && (
          <div className="consulta-loading">
            <i className="fas fa-spinner fa-spin"></i> Consultando preço...
          </div>
        )}

        {erro && (
          <div className="consulta-error">{erro}</div>
        )}

        {resultado && (
          <div style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            gap: '20px',
            alignItems: 'flex-start'
          }}>
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <div style={{
                width: '120px',
                height: '120px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'white'
              }}>
                <a href={`https://callfarma.com.br/produto/${resultado.cdprodu}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                  <img
                    src={resultado.imageUrl}
                    alt="Imagem do Produto"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => e.target.src = 'https://via.placeholder.com/120?text=Sem+Imagem'}
                  />
                </a>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginTop: '8px', minHeight: '20px' }}>
                {getBadgeGrupo(resultado.produto.CDGRUPO)}
                {getBadgeTipo(resultado.produto.CDTIPO)}
              </div>
            </div>

            <div style={{ flexGrow: 1 }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
                Código: {resultado.cdprodu}
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px', lineHeight: '1.2' }}>
                {resultado.produto.NOME}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                <i className="fas fa-map-marker-alt" style={{ color: '#3b82f6' }}></i> <strong>Endereço:</strong> {resultado.detalhes.endereco}
              </div>

              {resultado.produto.PBM === 'S' && resultado.produto.MSGPROM && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    display: 'inline-block',
                    fontSize: '13px',
                    padding: '8px 12px',
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: '6px'
                  }}>
                    <i className="fas fa-prescription-bottle-alt" style={{ color: '#92400e', marginRight: '6px' }}></i>
                    <strong style={{ color: '#92400e' }}>PBM:</strong>{' '}
                    <a
                      href={resultado.produto.LINKPBM || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#92400e',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      {resultado.produto.MSGPROM} <i className="fas fa-external-link-alt" style={{ fontSize: '10px' }}></i>
                    </a>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ background: 'white', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>De:</div>
                  <div style={{ fontSize: '18px', color: '#9ca3af', textDecoration: 'line-through' }}>{formatCurrency(resultado.detalhes.precoMax)}</div>
                </div>
                <div style={{ background: '#ecfdf5', padding: '12px 16px', borderRadius: '8px', border: '1px solid #10b981' }}>
                  <div style={{ fontSize: '12px', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Por:</div>
                  <div style={{ fontSize: '24px', color: '#059669', fontWeight: '800' }}>{formatCurrency(resultado.detalhes.precoPor)}</div>
                </div>
                {resultado.detalhes.kitQtd > 0 && resultado.detalhes.precoKit > 0 && (
                  <div style={{ background: '#fef3c7', padding: '12px 16px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                    <div style={{ fontSize: '12px', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      <i className="fas fa-tags"></i> Leve {resultado.detalhes.kitQtd}+ Pague Menos
                    </div>
                    <div style={{ fontSize: '20px', color: '#92400e', fontWeight: '800' }}>{formatCurrency(resultado.detalhes.precoKit)}</div>
                    <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>A partir da {resultado.detalhes.kitQtd}ª unidade</div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {onAddProduct && (
                  <button
                    type="button"
                    onClick={() => onAddProduct(resultado.cdprodu)}
                    style={{
                      padding: '10px 20px',
                      background: '#10b981',
                      color: 'white',
                      border: '2px solid #10b981',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => { e.target.style.background = '#059669'; e.target.style.borderColor = '#059669'; }}
                    onMouseOut={(e) => { e.target.style.background = '#10b981'; e.target.style.borderColor = '#10b981'; }}
                  >
                    <i className="fas fa-plus"></i> Adicionar
                  </button>
                )}
                {onOpenEstoque && (
                  <button
                    type="button"
                    onClick={abrirEstoqueProduto}
                    style={{
                      padding: '10px 20px',
                      background: 'white',
                      color: '#3b82f6',
                      border: '2px solid #3b82f6',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => { e.target.style.background = '#3b82f6'; e.target.style.color = 'white'; }}
                    onMouseOut={(e) => { e.target.style.background = 'white'; e.target.style.color = '#3b82f6'; }}
                  >
                    <i className="fas fa-warehouse"></i> Estoque (F6)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <DraggableWindow
      title="Consultar Preço"
      icon="fa-tag"
      onClose={onClose}
      zIndex={zIndex}
      onFocus={onFocus}
      initialWidth={windowWidth}
      initialTop={windowTop}
      initialLeft={windowLeft}
    >
      {content}
    </DraggableWindow>
  );
};

export default WindowPreco;
