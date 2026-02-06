import React, { useState, useEffect, useCallback, useRef } from 'react';
import { produtoService, lojasService } from '../../services/api';
import DraggableWindow from './DraggableWindow';

const WindowEstoque = ({ onClose, zIndex, onFocus, userData, autoSearchCode, readOnly = false, embedded = false }) => {
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [lojas, setLojas] = useState([]);
  const [nomeProduto, setNomeProduto] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [dropdownIndex, setDropdownIndex] = useState(0);

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Posicionar dropdown
  const posicionarDropdown = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom,
        left: rect.left,
        width: rect.width - 110 // Subtrair largura do botão
      });
    }
  };

  // Carregar lojas do banco local
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

  // Buscar por nome (autocomplete)
  const buscarPorNome = async (termo) => {
    if (!termo || termo.length < 2) {
      setSugestoes([]);
      setMostrarSugestoes(false);
      return;
    }

    try {
      const produtos = await produtoService.buscarPorNome(termo, userData?.loja_id || 22);
      console.log('📦 Produtos encontrados:', produtos);
      if (produtos && produtos.length > 0) {
        setSugestoes(produtos);
        setMostrarSugestoes(true);
        setDropdownIndex(0);
        posicionarDropdown();
      } else {
        setSugestoes([]);
        setMostrarSugestoes(false);
      }
    } catch (error) {
      console.error('Erro ao buscar por nome:', error);
      setSugestoes([]);
      setMostrarSugestoes(false);
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

  // Selecionar produto da lista
  const selecionarProduto = (cdprodu) => {
    setCodigo(String(cdprodu));
    setMostrarSugestoes(false);
    setSugestoes([]);
    setTimeout(() => buscarEstoque(String(cdprodu)), 100);
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

      console.log('🔍 ENTER pressionado:', { valor, isSomenteNumero });

      if (!isSomenteNumero && valor.length >= 3 && !valor.startsWith('*')) {
        // Se não for só número e tiver 3+ chars, buscar por nome
        console.log('🔍 Buscando por nome:', valor);
        await buscarPorNome(valor);
      } else if (!valor.startsWith('*')) {
        // Caso contrário, buscar normalmente
        console.log('🔍 Buscando por código:', valor);
        setMostrarSugestoes(false);
        await buscarEstoque();
      }
    }
  };

  const buscarEstoque = useCallback(async (codigoProduto) => {
    const cod = codigoProduto || codigo;
    if (!cod || String(cod).startsWith('*')) return;

    setCarregando(true);
    setErro('');
    setResultado(null);
    setNomeProduto('');

    try {
      // Buscar informações do produto
      const infoProduto = await produtoService.buscarPreco(cod, userData?.loja_id || 22);
      if (infoProduto && infoProduto.produto) {
        setNomeProduto(infoProduto.produto.NOME || 'Produto não encontrado');
      }

      const response = await produtoService.buscarEstoque(cod);

      if (response && response.length > 0) {
        console.log('📦 Lojas carregadas:', lojas);
        console.log('📦 Resposta estoque:', response);

        // Adicionar nomes das lojas aos resultados
        const resultadoComLojas = response.map(item => {
          // Normalizar: converter ambos para número para comparar (3 === 03)
          const loja = lojas.find(l => parseInt(l.numero, 10) === parseInt(item.CDFIL, 10));
          console.log(`🔍 CDFIL: ${item.CDFIL}, Loja encontrada:`, loja);
          return {
            ...item,
            LOJA_NOME: loja ? loja.nome : `Filial ${item.CDFIL}`,
            LOJA_NUMERO: item.CDFIL
          };
        });
        setResultado(resultadoComLojas);
      } else {
        setErro('Produto não encontrado');
      }
    } catch (error) {
      console.error('Erro ao consultar estoque:', error);
      setErro('Erro ao consultar estoque');
    } finally {
      setCarregando(false);
    }
  }, [codigo, lojas, userData]);

  // Auto-busca quando F6 é pressionado
  useEffect(() => {
    if (autoSearchCode && lojas.length > 0) {
      setCodigo(autoSearchCode);
      buscarEstoque(autoSearchCode);
    }
  }, [autoSearchCode, buscarEstoque, lojas]);

  // Listener para evento de auto-busca
  useEffect(() => {
    const handleAutoSearch = (e) => {
      if (e.detail && e.detail.codigo) {
        setCodigo(e.detail.codigo);
        buscarEstoque(e.detail.codigo);
      }
    };

    window.addEventListener('autoSearchProduct', handleAutoSearch);
    return () => window.removeEventListener('autoSearchProduct', handleAutoSearch);
  }, [buscarEstoque]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valor = String(codigo).trim();

    // Não buscar se começar com * (aguardando autocomplete)
    if (valor.startsWith('*')) return;

    setMostrarSugestoes(false);
    await buscarEstoque();
    // Não limpar o código após buscar para permitir nova consulta
  };

  const windowWidth = 520;
  const maxWindowHeight = Math.max(420, window.innerHeight - 80);
  const windowHeight = Math.min(600, maxWindowHeight);
  const windowTop = Math.max(20, (window.innerHeight - windowHeight) / 2);
  const windowLeft = Math.max(20, (window.innerWidth - windowWidth) / 2);

  const content = (
    <div
      className={embedded ? 'preco-standalone' : undefined}
      style={{ maxHeight: `${windowHeight - 60}px`, overflowY: 'auto' }}
    >
      {!readOnly && (
        <form onSubmit={handleSubmit} className="consulta-form">
          <div className="consulta-form-group">
            <label htmlFor="estoque-codigo">Código de Barras, Código Interno ou Nome do Produto</label>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  id="estoque-codigo"
                  value={codigo}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite o código ou *nome para buscar..."
                  style={{ flex: 1 }}
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" className="consulta-btn-submit" style={{ width: '100px', height: '46px' }}>
                  <i className="fas fa-search"></i>
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                💡 Use <strong>*</strong> antes do nome para buscar produtos. Ex: <code>*GOODLIFE</code>
              </div>

              {/* Dropdown de sugestões */}
              {mostrarSugestoes && sugestoes.length > 0 && (
                <div
                  ref={dropdownRef}
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
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    zIndex: 50000
                  }}>
                  {sugestoes[0]?.hint ? (
                    <div style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#10b981',
                      fontSize: '13px',
                      background: '#f0fdf4',
                      borderBottom: '1px solid #86efac'
                    }}>
                      <i className="fas fa-info-circle"></i> Pressione <strong>Enter</strong> para buscar por nome
                    </div>
                  ) : (
                    sugestoes.map((prod, idx) => {
                      const temEstoque = parseFloat(prod.ESTOQUE || 0) > 0;
                      return (
                        <div
                          key={prod.CDPRODU}
                          onClick={() => selecionarProduto(prod.CDPRODU)}
                          style={{
                            padding: '12px',
                            borderBottom: '1px solid #e5e7eb',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            background: dropdownIndex === idx ? '#eef2ff' : 'white'
                          }}
                          onMouseEnter={() => setDropdownIndex(idx)}
                        >
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{
                              display: 'inline-block',
                              width: '10px',
                              height: '10px',
                              background: temEstoque ? '#16a34a' : '#dc2626',
                              borderRadius: '50%',
                              boxShadow: `0 0 4px rgba(${temEstoque ? '22, 163, 74' : '220, 38, 38'}, 0.4)`
                            }}></span>
                            <div style={{ fontWeight: '600', color: '#111827', fontSize: '14px', flex: 1 }}>{prod.NOME}</div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginLeft: '20px', gap: '10px' }}>
                            <span>Código: {prod.CDPRODU}</span>
                            <span><i className="fas fa-map-marker-alt" style={{ color: '#3b82f6' }}></i> {prod.ENDERECO || 'N/A'}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      <div style={{ marginTop: readOnly ? '0' : '12px' }}>
        {carregando && (
          <div className="consulta-loading">
            <i className="fas fa-spinner fa-spin"></i> Consultando estoque...
          </div>
        )}

        {erro && <div className="consulta-error">{erro}</div>}

        {resultado && resultado.length > 0 && (
          <div>
            {nomeProduto && (
              <div style={{ padding: '8px 10px', background: '#f9fafb', borderRadius: '6px', marginBottom: '10px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{nomeProduto}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Código: {codigo}</div>
              </div>
            )}

            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden', background: 'white' }}>
              {resultado.map((item, index) => {
                const estoque = parseFloat(item.ESTOQUE || 0);
                const estoqueFormatado = estoque % 1 === 0 ? Math.round(estoque) : estoque.toFixed(2);
                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderBottom: index < resultado.length - 1 ? '1px solid #f3f4f6' : 'none',
                      fontSize: '12px'
                    }}
                  >
                    <span style={{ color: '#374151', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: estoque > 0 ? '#16a34a' : '#dc2626'
                      }}></span>
                      {item.LOJA_NOME}
                    </span>
                    <span style={{ fontWeight: '700', color: estoque > 0 ? '#059669' : '#dc2626' }}>{estoqueFormatado}</span>
                  </div>
                );
              })}
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
      title={readOnly ? "Estoque do Produto" : "Consulta de Estoque"}
      icon="fa-warehouse"
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

export default WindowEstoque;
