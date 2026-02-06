import React, { useState, useEffect, useRef } from 'react';
import DraggableWindow from './DraggableWindow';
import { queryService } from '../../services/api';

const WindowCliente = ({ onClose, zIndex, onFocus }) => {
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [historicoVendas, setHistoricoVendas] = useState(null);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const vendasPorPagina = 10;
  const cpfInputRef = useRef(null);

  // Focar automaticamente no input de CPF quando a janela abrir
  useEffect(() => {
    if (cpfInputRef.current) {
      cpfInputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResultado(null);

    const cpfTrimmed = cpf.trim();
    const nomeTrimmed = nome.trim();

    if (!cpfTrimmed && !nomeTrimmed) {
      setError('Por favor, preencha o CPF ou o Nome.');
      return;
    }

    let whereClause = '';
    if (cpfTrimmed) {
      const cpfLimpo = cpfTrimmed.replace(/\D/g, '').replace(/^0+/, '');
      whereClause = `CPF_LIMPO = ${cpfLimpo}`;
    } else if (nomeTrimmed) {
      const nomes = nomeTrimmed.split(' ').filter(n => n.length > 0);
      if (nomes.length < 2) {
        setError('Para busca por nome, insira pelo menos 2 nomes.');
        return;
      }
      whereClause = `NOME LIKE '%${nomeTrimmed.toUpperCase()}%'`;
    }

    setLoading(true);

    try {
      const query = `
        SELECT
          CODIGO, NOME, ENDE, BAIR, CEP, CIDA, ESTA, FONE, IDENTIDADE, CPF,
          NASCIMENTO, DATA, EMAIL, OPER, TRANSMITIDO, CODBAR, COMPL, PONTOREF,
          NRENDE, TIPO, FILIAL, CELULAR, SEXO, ANIMAL, ATENDLIG, DATALIG,
          HORALIG, OBSLIG, DTULTCPA, CODMUN, CUPOMDESC, DATACONSERASA,
          NOMEMAE, TITULOELEITOR, APELIDO, SENHA, IDFACEBOOK, CODIGOANTIGO,
          GAZETADOPOVO, RESPONSAVEL, NFOBRIGATORIA, FUNCAD, LOJACAD, DATACAD,
          HORACAD, CONFCAD, RECEBEOFERTA, ABC, MARGEM, SNGPC_TIPODOC,
          SNGPC_NUMDOC, SNGPC_ORGAO, SNGPC_UF, NRCRM, GAZETADOPOVO_ID,
          CPF_LIMPO, CPFNANOTA, NRCPFNANOTA, FGSENHAPROVISORIA, FGCOMPRERAPIDO
        FROM televendas.pdvcliente
        WHERE ${whereClause}
      `;

      const data = await queryService.execute(query);

      if (!data || data.length === 0) {
        setError('Nenhum cliente encontrado com os dados informados.');
      } else {
        setResultado(data);
      }
    } catch (err) {
      console.error('Erro ao buscar cliente:', err);
      setError('Erro ao buscar cliente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (cpf) => {
    if (!cpf) return 'Não informado';
    const cpfStr = cpf.toString().padStart(11, '0');
    return cpfStr.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatPhone = (phone) => {
    if (!phone) return 'Não informado';
    const phoneStr = phone.toString().replace(/\D/g, '');
    if (phoneStr.length === 11) {
      return phoneStr.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (phoneStr.length === 10) {
      return phoneStr.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const formatDate = (date) => {
    if (!date) return 'Não informado';
    const dateStr = date.toString();
    if (dateStr.length === 8) {
      return `${dateStr.substr(6, 2)}/${dateStr.substr(4, 2)}/${dateStr.substr(0, 4)}`;
    }
    return date;
  };

  const formatDateHistorico = (date) => {
    if (!date) return '-';
    try {
      // Se for string YYYYMMDD
      const dateStr = date.toString();
      if (dateStr.length === 8) {
        const year = dateStr.substr(0, 4);
        const month = dateStr.substr(4, 2);
        const day = dateStr.substr(6, 2);
        const dateObj = new Date(year, parseInt(month) - 1, day);
        return dateObj.toLocaleDateString('pt-BR');
      }
      // Se for Date object ou ISO string
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString('pt-BR');
      }
    } catch (e) {
      console.error('Erro ao formatar data:', e);
    }
    return date;
  };

  const abrirHistoricoVendas = async (cliente) => {
    setClienteSelecionado(cliente);
    setLoadingHistorico(true);
    setHistoricoVendas(null);
    setPaginaAtual(0);

    try {
      const cpfLimpo = cliente.CPF.toString().replace(/\D/g, '').replace(/^0+/, '');

      // Buscar vendas do cliente
      const queryVendas = `
        SELECT *
        FROM scevendacpf
        WHERE CPF = ${cpfLimpo}
        ORDER BY DATA DESC
      `;
      const vendas = await queryService.execute(queryVendas);

      if (vendas && vendas.length > 0) {
        // Buscar nomes dos produtos
        const codigosProdutos = [...new Set(vendas.map(v => v.CDPRODU))];
        const queryProdutos = `
          SELECT CDPRODU, NOME
          FROM sceprodu
          WHERE CDPRODU IN (${codigosProdutos.join(',')})
        `;
        const produtos = await queryService.execute(queryProdutos);

        const nomesProdutos = {};
        if (produtos && produtos.length > 0) {
          produtos.forEach(p => {
            nomesProdutos[p.CDPRODU] = p.NOME;
          });
        }

        // Vincular nomes às vendas
        const vendasComNomes = vendas.map(v => ({
          ...v,
          NOME_PRODUTO: nomesProdutos[v.CDPRODU] || 'Produto não encontrado'
        }));

        setHistoricoVendas(vendasComNomes);
      } else {
        setHistoricoVendas([]);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de vendas:', error);
      setHistoricoVendas([]);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const fecharHistorico = () => {
    setHistoricoVendas(null);
    setClienteSelecionado(null);
    setPaginaAtual(0);
  };

  return (
    <DraggableWindow
      title="Consulta de Cliente"
      icon="fa-user"
      onClose={onClose}
      zIndex={zIndex}
      onFocus={onFocus}
      initialWidth={800}
      initialTop={80}
      initialLeft={150}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
          <div className="consulta-form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="cliente-cpf">CPF (Apenas números)</label>
            <input
              ref={cpfInputRef}
              type="text"
              id="cliente-cpf"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="Digite o CPF..."
              inputMode="numeric"
            />
          </div>
          <div className="consulta-form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="cliente-nome">Nome (Mínimo 2 nomes)</label>
            <input
              type="text"
              id="cliente-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite o nome..."
            />
          </div>
          <button type="submit" className="consulta-btn-submit" style={{ height: '46px', width: '120px' }} disabled={loading}>
            <i className="fas fa-search"></i> Buscar
          </button>
        </div>
      </form>

      {error && (
        <div className="consulta-error" style={{ marginTop: '20px' }}>
          <strong><i className="fas fa-exclamation-triangle"></i> {error}</strong>
        </div>
      )}

      {loading && (
        <div className="consulta-loading" style={{ marginTop: '20px' }}>
          <i className="fas fa-spinner fa-spin"></i> Buscando cliente...
        </div>
      )}

      {resultado && resultado.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          {resultado.map((cliente, index) => (
            <div key={index} style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '16px'
            }}>
              <h3 style={{
                margin: '0 0 16px 0',
                color: '#111827',
                fontSize: '18px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <i className="fas fa-user" style={{ color: '#ffd400' }}></i>
                {cliente.NOME}
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px'
              }}>
                <div>
                  <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Código:</strong>
                  <div style={{ color: '#111827', fontSize: '14px', marginTop: '4px' }}>{cliente.CODIGO}</div>
                </div>

                <div>
                  <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>CPF:</strong>
                  <div style={{ color: '#111827', fontSize: '14px', marginTop: '4px' }}>{formatCPF(cliente.CPF)}</div>
                </div>

                <div>
                  <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>RG:</strong>
                  <div style={{ color: '#111827', fontSize: '14px', marginTop: '4px' }}>{cliente.IDENTIDADE || 'Não informado'}</div>
                </div>

                <div>
                  <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Nascimento:</strong>
                  <div style={{ color: '#111827', fontSize: '14px', marginTop: '4px' }}>{formatDate(cliente.NASCIMENTO)}</div>
                </div>

                <div>
                  <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Telefone:</strong>
                  <div style={{ color: '#111827', fontSize: '14px', marginTop: '4px' }}>{formatPhone(cliente.FONE)}</div>
                </div>

                <div>
                  <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Celular:</strong>
                  <div style={{ color: '#111827', fontSize: '14px', marginTop: '4px' }}>{formatPhone(cliente.CELULAR)}</div>
                </div>

                <div>
                  <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Email:</strong>
                  <div style={{ color: '#111827', fontSize: '14px', marginTop: '4px' }}>{cliente.EMAIL || 'Não informado'}</div>
                </div>

                <div>
                  <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Sexo:</strong>
                  <div style={{ color: '#111827', fontSize: '14px', marginTop: '4px' }}>
                    {cliente.SEXO === 'M' ? 'Masculino' : cliente.SEXO === 'F' ? 'Feminino' : 'Não informado'}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Endereço:</strong>
                <div style={{ color: '#111827', fontSize: '14px', marginTop: '4px' }}>
                  {cliente.ENDE}, {cliente.NRENDE || 'S/N'} {cliente.COMPL && `- ${cliente.COMPL}`}
                </div>
                <div style={{ color: '#111827', fontSize: '14px', marginTop: '2px' }}>
                  {cliente.BAIR} - {cliente.CIDA}/{cliente.ESTA}
                </div>
                <div style={{ color: '#111827', fontSize: '14px', marginTop: '2px' }}>
                  CEP: {cliente.CEP || 'Não informado'}
                </div>
                {cliente.PONTOREF && (
                  <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px', fontStyle: 'italic' }}>
                    Ponto de Referência: {cliente.PONTOREF}
                  </div>
                )}
              </div>

              {cliente.DTULTCPA && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                  <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Última Compra:</strong>
                  <div style={{ color: '#111827', fontSize: '14px', marginTop: '4px' }}>{formatDate(cliente.DTULTCPA)}</div>
                </div>
              )}

              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
                <button
                  onClick={() => abrirHistoricoVendas(cliente)}
                  style={{
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = '#2563eb';
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = '#3b82f6';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <i className="fas fa-shopping-cart"></i>
                  Ver Histórico de Compras
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Histórico de Vendas */}
      {historicoVendas !== null && (
        <div
          onClick={fecharHistorico}
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
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              width: '1000px',
              maxWidth: '95%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '2px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f9fafb'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#111827', fontWeight: '700' }}>
                <i className="fas fa-shopping-cart" style={{ color: '#ffd400', marginRight: '8px' }}></i>
                Histórico de Vendas: {clienteSelecionado?.NOME}
              </h3>
              <button
                onClick={fecharHistorico}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: 0,
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#ef4444';
                  e.target.style.color = 'white';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'none';
                  e.target.style.color = '#6b7280';
                }}
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {loadingHistorico && (
                <div className="consulta-loading">
                  <i className="fas fa-spinner fa-spin"></i> Carregando histórico...
                </div>
              )}

              {!loadingHistorico && historicoVendas.length === 0 && (
                <div className="consulta-error">Nenhuma venda encontrada para este cliente.</div>
              )}

              {!loadingHistorico && historicoVendas.length > 0 && (
                <div className="excel-table-container">
                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th className="text-center">Data</th>
                        <th className="text-center">Loja</th>
                        <th className="text-center">Doc.</th>
                        <th className="text-center">Cód.</th>
                        <th>Produto</th>
                        <th className="text-right">Qtd.</th>
                        <th className="text-right">Valor</th>
                        <th className="text-center">ABC</th>
                        <th className="text-center">Cashback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoVendas
                        .slice(paginaAtual * vendasPorPagina, (paginaAtual + 1) * vendasPorPagina)
                        .map((venda, index) => (
                          <tr key={index}>
                            <td className="text-center">{formatDateHistorico(venda.DATA)}</td>
                            <td className="text-center">{venda.CDFIL || '-'}</td>
                            <td className="text-center">{venda.NUMDOC || '-'}</td>
                            <td className="text-center"><strong>{venda.CDPRODU}</strong></td>
                            <td>{venda.NOME_PRODUTO}</td>
                            <td className="text-right">{Math.round(parseFloat(venda.QTD || 0))}</td>
                            <td className="text-right currency">
                              R$ {parseFloat(venda.VALOR || 0).toFixed(2)}
                            </td>
                            <td className="text-center">{venda.ABC || '-'}</td>
                            <td className="text-center">{venda.CASHBACK || '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            {!loadingHistorico && historicoVendas.length > 0 && (
              <div style={{
                padding: '12px 24px',
                background: '#f9fafb',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  Mostrando {paginaAtual * vendasPorPagina + 1} - {Math.min((paginaAtual + 1) * vendasPorPagina, historicoVendas.length)} de {historicoVendas.length} vendas
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setPaginaAtual(Math.max(0, paginaAtual - 1))}
                    disabled={paginaAtual === 0}
                    style={{
                      padding: '6px 12px',
                      background: paginaAtual === 0 ? '#e5e7eb' : 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      cursor: paginaAtual === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: paginaAtual === 0 ? '#9ca3af' : '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <i className="fas fa-chevron-left"></i> Anterior
                  </button>
                  <button
                    onClick={() => setPaginaAtual(Math.min(Math.ceil(historicoVendas.length / vendasPorPagina) - 1, paginaAtual + 1))}
                    disabled={paginaAtual >= Math.ceil(historicoVendas.length / vendasPorPagina) - 1}
                    style={{
                      padding: '6px 12px',
                      background: paginaAtual >= Math.ceil(historicoVendas.length / vendasPorPagina) - 1 ? '#e5e7eb' : 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      cursor: paginaAtual >= Math.ceil(historicoVendas.length / vendasPorPagina) - 1 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: paginaAtual >= Math.ceil(historicoVendas.length / vendasPorPagina) - 1 ? '#9ca3af' : '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    Próximo <i className="fas fa-chevron-right"></i>
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

export default WindowCliente;
