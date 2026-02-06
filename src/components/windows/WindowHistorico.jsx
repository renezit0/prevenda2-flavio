import React, { useState, useEffect, useRef } from 'react';
import { produtoService, lojasService } from '../../services/api';
import DraggableWindow from './DraggableWindow';
import CustomSelect from '../CustomSelect';

const WindowHistorico = ({ isOpen, onClose, onMinimize, zIndex, onFocus, userData }) => {
  const codigoInputRef = useRef(null);
  // Configurar datas padrão: último mês
  const hoje = new Date();
  const umMesAtras = new Date();
  umMesAtras.setMonth(hoje.getMonth() - 1);

  const formatDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState(userData?.loja_id || '');
  const [codigo, setCodigo] = useState('');
  const [nomeProduto, setNomeProduto] = useState('-');
  const [dataIni, setDataIni] = useState(formatDateInput(umMesAtras));
  const [dataFim, setDataFim] = useState(formatDateInput(hoje));
  const [resultado, setResultado] = useState(null);
  const [estoqueAtual, setEstoqueAtual] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [modalPesquisa, setModalPesquisa] = useState(false);
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [produtosPesquisa, setProdutosPesquisa] = useState([]);
  const [carregandoPesquisa, setCarregandoPesquisa] = useState(false);
  const [vendaExpandida, setVendaExpandida] = useState(null);

  // Função para gerar descrição do histórico
  const gerarHistoricoTexto = (tipo, cdforne) => {
    switch(tipo) {
      case 'TE':
        return `+ ENT.TR-${cdforne || ''}`;
      case 'EI':
        return '+ENT. INVENT.';
      case 'VE':
        return 'VENDA';
      case 'EN':
        return '+COMPRAS';
      case 'TS':
        return `SAI.TR-${cdforne || ''}`;
      default:
        return tipo;
    }
  };

  // Carregar lojas
  useEffect(() => {
    const carregarLojas = async () => {
      try {
        const response = await lojasService.getLojas();
        if (response && Array.isArray(response)) {
          // Ordenar lojas por número
          const lojasOrdenadas = response.sort((a, b) => a.numero - b.numero);
          setLojas(lojasOrdenadas);
          if (!lojaSelecionada && lojasOrdenadas.length > 0) {
            setLojaSelecionada(lojasOrdenadas[0].numero);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar lojas:', error);
      }
    };
    carregarLojas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focar no campo código quando a janela abrir
  useEffect(() => {
    if (isOpen && codigoInputRef.current) {
      setTimeout(() => {
        codigoInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Pesquisa de produtos
  useEffect(() => {
    if (!termoPesquisa || termoPesquisa.length < 3) {
      setProdutosPesquisa([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setCarregandoPesquisa(true);
      try {
        const produtos = await produtoService.buscarPorNome(termoPesquisa, lojaSelecionada);
        setProdutosPesquisa(produtos || []);
      } catch (error) {
        console.error('Erro ao pesquisar produtos:', error);
        setProdutosPesquisa([]);
      } finally {
        setCarregandoPesquisa(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [termoPesquisa, lojaSelecionada]);

  const selecionarProduto = (produto) => {
    setCodigo(produto.CDPRODU);
    setNomeProduto(produto.NOME);
    setModalPesquisa(false);
    setTermoPesquisa('');
    setProdutosPesquisa([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lojaSelecionada || !codigo || !dataIni || !dataFim) return;

    setCarregando(true);
    setErro('');
    setResultado(null);
    setEstoqueAtual(null);

    try {
      // Buscar informações do produto primeiro
      const infoProduto = await produtoService.buscarPreco(codigo, lojaSelecionada);
      if (infoProduto && infoProduto.produto) {
        setNomeProduto(infoProduto.produto.NOME || 'Produto não encontrado');
      }

      const response = await produtoService.buscarHistorico(
        codigo,
        lojaSelecionada,
        dataIni.replace(/-/g, ''),
        dataFim.replace(/-/g, '')
      );

      if (response && response.length > 0) {
        setResultado(response);

        // Buscar estoque atual
        const estoques = await produtoService.buscarEstoque(codigo);
        const estoqueFilial = estoques?.find(e => e.CDFIL === parseInt(lojaSelecionada));
        if (estoqueFilial) {
          setEstoqueAtual(estoqueFilial.ESTOQUE);
        }
      } else {
        setErro('Nenhuma movimentação encontrada');
      }
    } catch (error) {
      console.error('Erro ao consultar histórico:', error);
      setErro('Erro ao consultar histórico');
    } finally {
      setCarregando(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    if (typeof date === 'string' && date.includes('T')) {
      const [datePart] = date.split('T');
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}`;
    }
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return '-';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  };

  if (!isOpen) return null;

  return (
    <DraggableWindow
      title="Consulta Movimentação"
      icon="fa-history"
      onClose={onClose}
      onMinimize={onMinimize}
      zIndex={zIndex}
      onFocus={onFocus}
      initialWidth={950}
      initialHeight={600}
      initialTop={100}
      initialLeft={100}
    >
      <form onSubmit={handleSubmit} className="consulta-form">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', gap: '10px', marginBottom: '12px' }}>
          <div className="consulta-form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '12px', marginBottom: '4px' }}>Loja</label>
            <CustomSelect
              options={lojas.map(loja => ({
                value: loja.numero,
                label: `${loja.numero} - ${loja.nome}`
              }))}
              value={lojaSelecionada}
              onChange={setLojaSelecionada}
              placeholder="Selecione a loja..."
              searchPlaceholder="Buscar loja..."
            />
          </div>
          <div className="consulta-form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="historico-data-ini" style={{ fontSize: '12px', marginBottom: '4px' }}>Data Inicial</label>
            <input
              type="date"
              id="historico-data-ini"
              value={dataIni}
              onChange={(e) => setDataIni(e.target.value)}
              required
              style={{ padding: '8px 10px', fontSize: '13px', height: '36px' }}
            />
          </div>
          <div className="consulta-form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="historico-data-fim" style={{ fontSize: '12px', marginBottom: '4px' }}>Data Final</label>
            <input
              type="date"
              id="historico-data-fim"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              required
              style={{ padding: '8px 10px', fontSize: '13px', height: '36px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
          <div className="consulta-form-group" style={{ marginBottom: 0, width: '130px' }}>
            <label htmlFor="historico-codigo" style={{ fontSize: '12px', marginBottom: '4px' }}>Código</label>
            <input
              ref={codigoInputRef}
              type="text"
              id="historico-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Código..."
              required
              style={{ padding: '8px 10px', fontSize: '13px', height: '36px', width: '100%' }}
            />
          </div>
          <button
            type="button"
            onClick={() => setModalPesquisa(true)}
            style={{
              padding: '0',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              height: '36px',
              width: '36px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#4b5563'}
            onMouseOut={(e) => e.target.style.background = '#6b7280'}
          >
            <i className="fas fa-search"></i>
          </button>
          <div className="consulta-form-group" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
            <label htmlFor="historico-nome" style={{ fontSize: '12px', marginBottom: '4px' }}>Produto</label>
            <div
              id="historico-nome"
              style={{
                padding: '8px 10px',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#374151',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {nomeProduto}
            </div>
          </div>
          <button type="submit" className="consulta-btn-submit" style={{ height: '36px', padding: '0 16px', fontSize: '13px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <i className="fas fa-search"></i> Buscar
          </button>
        </div>
      </form>

      <div style={{ marginTop: '20px' }}>
        {carregando && (
          <div className="consulta-loading">
            <i className="fas fa-spinner fa-spin"></i> Buscando movimentações...
          </div>
        )}

        {erro && <div className="consulta-error">{erro}</div>}

        {resultado && resultado.length > 0 && (
          <div className="excel-table-container" style={{ height: '350px', overflowY: 'auto', marginBottom: '16px' }}>
            <table className="excel-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Hora</th>
                  <th className="text-right">Vend</th>
                  <th>Op</th>
                  <th>Histórico</th>
                  <th className="text-right">Quantidade</th>
                  <th className="text-right">Nº Doc</th>
                  <th className="text-right">Estoque</th>
                  <th>Lote</th>
                  <th className="text-center">Caixa(s)</th>
                </tr>
              </thead>
              <tbody>
                {resultado.map((item, index) => {
                  const isVenda = item.TIPO === 'VE';
                  const tipoClass = ['EN', 'TE', 'EI'].includes(item.TIPO) ? 'venda' : 'devolucao';
                  const tipoIndicator = ['EN', 'TE', 'EI'].includes(item.TIPO) ? '+' : '-';
                  const isExpanded = vendaExpandida === index;

                  return (
                    <React.Fragment key={index}>
                      <tr
                        className={isVenda ? 'clickable' : ''}
                        onClick={() => isVenda && setVendaExpandida(isExpanded ? null : index)}
                        style={{ cursor: isVenda ? 'pointer' : 'default' }}
                      >
                        <td>{formatDate(item.DATA)}</td>
                        <td>{item.HORA || '-'}</td>
                        <td className="text-right">{item.CDFUN || 0}</td>
                        <td>{item.CDOPE || 0}</td>
                        <td>
                          <span className={`produto-tipo-indicator ${tipoClass}`}>{tipoIndicator}</span>
                          {gerarHistoricoTexto(item.TIPO, item.CDFORNE)}
                        </td>
                        <td className="text-right">{Math.round(parseFloat(item.QTD || 0))}</td>
                        <td className="text-right">{item.DOC || '-'}</td>
                        <td className="text-right">{Math.round(parseFloat(item.ESTOQU || 0))}</td>
                        <td>{item.LOTE || '-'}</td>
                        <td className="text-center">0</td>
                      </tr>
                      {isVenda && isExpanded && (
                        <tr className="expanded-row">
                          <td colSpan="10">
                            <div className="expanded-content" style={{ padding: '12px 16px', background: '#f9fafb' }}>
                              <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
                                <div><strong>Série:</strong> {item.nRECF || '-'}</div>
                                <div><strong>CPF:</strong> {item.nrCPF || '-'}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {/* Preencher linhas vazias para manter a estrutura da tabela */}
                {Array.from({ length: Math.max(0, 15 - resultado.length) }).map((_, index) => (
                  <tr key={`empty-${index}`}>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td className="text-right">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td className="text-right">&nbsp;</td>
                    <td className="text-right">&nbsp;</td>
                    <td className="text-right">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td className="text-center">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {estoqueAtual !== null && (
          <div style={{
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#991b1b'
          }}>
            <i className="fas fa-box"></i>
            <span>Estoque Atual: <strong>{estoqueAtual}</strong></span>
          </div>
        )}
      </div>

      {/* Modal de Pesquisa de Produto */}
      {modalPesquisa && (
        <div
          onClick={() => setModalPesquisa(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '8px',
              width: '600px',
              maxWidth: '90%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>Pesquisar Produto</h3>
              <button
                onClick={() => setModalPesquisa(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#6b7280', cursor: 'pointer', padding: 0, width: '24px', height: '24px' }}
              >
                &times;
              </button>
            </div>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <input
                type="text"
                value={termoPesquisa}
                onChange={(e) => setTermoPesquisa(e.target.value)}
                placeholder="Digite o nome do produto..."
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                autoFocus
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {carregandoPesquisa && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  <i className="fas fa-spinner fa-spin"></i> Buscando...
                </div>
              )}
              {!carregandoPesquisa && !termoPesquisa && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  Digite para pesquisar...
                </div>
              )}
              {!carregandoPesquisa && termoPesquisa && produtosPesquisa.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  Nenhum produto encontrado
                </div>
              )}
              {!carregandoPesquisa && produtosPesquisa.length > 0 && (
                <div>
                  {produtosPesquisa.map((produto, index) => (
                    <div
                      key={index}
                      onClick={() => selecionarProduto(produto)}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        ':hover': { background: '#f9fafb' }
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>
                        {produto.CDPRODU} - {produto.NOME}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                        Estoque: {produto.ESTOQUE || 0} | Endereço: {produto.ENDERECO || 'Não informado'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DraggableWindow>
  );
};

export default WindowHistorico;
