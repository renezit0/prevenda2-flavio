import React, { useState, useEffect, useRef } from 'react';
import DraggableWindow from './DraggableWindow';
import CustomSelect from '../CustomSelect';
import { authService, lojasService, queryService } from '../../services/api';

const WindowPosicaoVendas = ({ isOpen, onClose, onMinimize, zIndex, onFocus, userData }) => {
  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filial, setFilial] = useState('TODAS');
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('por-grupo');
  const [resultado, setResultado] = useState(null);
  const [filtroFuncionario, setFiltroFuncionario] = useState(null);

  const scrollContainerRefPorGrupo = useRef(null);
  const totalContainerRefPorGrupo = useRef(null);
  const scrollContainerRefPorBalconista = useRef(null);
  const totalContainerRefPorBalconista = useRef(null);
  const scrollContainerRefResumido = useRef(null);
  const totalContainerRefResumido = useRef(null);
  const scrollContainerRefPorIndicador = useRef(null);
  const totalContainerRefPorIndicador = useRef(null);

  // Atualizar filial quando userData mudar
  useEffect(() => {
    if (userData?.loja_id) {
      setFilial(userData.loja_id);
    }
  }, [userData]);

  // Carregar lojas e verificar sessão
  useEffect(() => {
    const fetchLojasEUsuario = async () => {
      try {
        const lojasResponse = await lojasService.getLojas();
        const lojasOrdenadas = (lojasResponse || []).sort((a, b) => a.numero - b.numero);
        setLojas(lojasOrdenadas);

        // Buscar dados do usuário logado para pegar a loja imediatamente
        if (!userData?.loja_id) {
          const sessionData = await authService.checkAuth();
          if (sessionData.autenticado && sessionData.usuario?.loja_id) {
            setFilial(sessionData.usuario.loja_id);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setLojas([]);
      }
    };

    if (isOpen) {
      fetchLojasEUsuario();
      const hoje = new Date().toISOString().split('T')[0];
      setDataIni(hoje);
      setDataFim(hoje);
    }
  }, [isOpen, userData]);

  const handleSubmit = async (e, cdfunFiltro = null) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const dataIniFormatted = dataIni.replace(/-/g, '');
      const dataFimFormatted = dataFim.replace(/-/g, '');
      const whereCdfil = filial === 'TODAS' ? '' : `AND k.CDFIL = ${filial}`;
      const whereCdfun = cdfunFiltro ? `AND k.CDFUN = ${cdfunFiltro}` : '';

      const query = `
        SELECT
          k.CDPRODU + 0 AS CDPRODU,
          p.NOME AS NOME,
          p.NOME AS DESCRICAO,
          k.QTD AS QTD,
          k.VALOR AS VALOR,
          k.VALOR AS TOTAL,
          k.VLDESCUS AS VLDESCUS,
          p.PREPRO AS PREPRO,
          p.PRECO AS PRECO,
          k.TIPO AS TIPO,
          k.CDFUN AS CDFUN,
          f.NOME AS NOMEFUNCIONARIO,
          f.NOME AS NOMEFUN,
          p.CDGRUPO AS CDGRUPO,
          g.NOME AS NOMEGRUPO,
          g.NOME AS GRUPO,
          g.CDTIPO AS CDTIPO,
          t.NMTIPO AS NMTIPO,
          k.DATA AS DATA
        FROM estwin.scekarde k
        JOIN estwin.sceprodu p ON p.CDPRODU = k.CDPRODU
        JOIN estwin.tabgrupo g ON g.CDGRUPO = p.CDGRUPO
        JOIN estwin.tabtipo t ON t.CDTIPO = g.CDTIPO
        JOIN estwin.scefun f ON f.CDFUN = k.CDFUN
        WHERE k.TIPO IN ('VE','DV')
          AND k.DATA >= '${dataIniFormatted}'
          AND k.DATA <= '${dataFimFormatted}'
          ${whereCdfil}
          ${whereCdfun}
        ORDER BY k.DATA DESC
      `;

      const rows = await queryService.execute(query);
      setDados(rows || []);
      setResultado({ success: true });
    } catch (error) {
      console.error('Erro ao consultar vendas:', error);
      alert('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleClickBalconista = (cdfun, nomeFun) => {
    setFiltroFuncionario({ cdfun, nome: nomeFun });
    handleSubmit(null, cdfun);
  };

  const removerFiltroFuncionario = () => {
    setFiltroFuncionario(null);
    handleSubmit(null, null);
  };

  const renderPorGrupo = () => {
    if (!dados.length) return <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Nenhum resultado encontrado</p>;

    // Agrupar por CDGRUPO
    const grupos = {};
    let totalGeral = 0;

    dados.forEach(item => {
      const key = item.CDGRUPO;
      const multiplicador = item.TIPO === 'DV' ? -1 : 1;
      const valor = parseFloat(item.VALOR || 0) * multiplicador;
      const desconto = parseFloat(item.VLDESCUS || 0) * multiplicador;

      if (!grupos[key]) {
        grupos[key] = {
          cdgrupo: item.CDGRUPO,
          nomegrupo: item.NOMEGRUPO || item.GRUPO || 'Sem Grupo',
          valorVenda: 0,
          desconto: 0
        };
      }
      grupos[key].valorVenda += valor;
      grupos[key].desconto += desconto;
      totalGeral += valor;
    });

    const gruposArray = Object.values(grupos).sort((a, b) => a.cdgrupo - b.cdgrupo);
    const totalDesconto = gruposArray.reduce((sum, g) => sum + g.desconto, 0);
    const percDescTotal = totalGeral > 0 ? (totalDesconto / totalGeral) * 100 : 0;

    const scrollContainerRef = scrollContainerRefPorGrupo;
    const totalContainerRef = totalContainerRefPorGrupo;

    const handleScroll = (e) => {
      if (totalContainerRef.current) {
        totalContainerRef.current.scrollLeft = e.target.scrollLeft;
      }
    };

    return (
      <div className="excel-table-container" style={{ height: '350px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }} onScroll={handleScroll}>
          <table className="excel-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '60px' }} />
              <col style={{ width: '250px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Nome</th>
                <th className="text-right">Valor Venda</th>
                <th className="text-right">Desconto</th>
                <th className="text-right">% Desc.</th>
                <th className="text-right">% Partc.</th>
              </tr>
            </thead>
            <tbody>
              {gruposArray.map(grupo => {
                const percDesc = Math.abs(grupo.valorVenda) > 0 ? (grupo.desconto / Math.abs(grupo.valorVenda)) * 100 : 0;
                const percPartc = Math.abs(totalGeral) > 0 ? (grupo.valorVenda / totalGeral) * 100 : 0;
                const valorClass = grupo.valorVenda < 0 ? 'negative' : 'currency';

                return (
                  <tr key={grupo.cdgrupo} className="clickable">
                    <td className="text-center"><strong>{grupo.cdgrupo}</strong></td>
                    <td>{grupo.nomegrupo}</td>
                    <td className={`text-right ${valorClass}`}>
                      R$ {grupo.valorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right">
                      R$ {grupo.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right">{percDesc.toFixed(2)}%</td>
                    <td className="text-right">{percPartc.toFixed(2)}%</td>
                  </tr>
                );
              })}
              {/* Preencher linhas vazias */}
              {Array.from({ length: Math.max(0, 13 - gruposArray.length) }).map((_, index) => (
                <tr key={`empty-${index}`}>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div ref={totalContainerRef} style={{ overflowX: 'auto', overflowY: 'hidden' }}>
          <table className="excel-table" style={{ marginTop: '0', borderTop: '2px solid #10b981', tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '60px' }} />
              <col style={{ width: '250px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <tbody>
              <tr className="total-row">
                <td colSpan="2"><strong>TOTAL GERAL</strong></td>
                <td className="text-right currency">
                  R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="text-right">
                  R$ {totalDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="text-right">{percDescTotal.toFixed(2)}%</td>
                <td className="text-right">100.00%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPorBalconista = () => {
    if (!dados.length) return <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Nenhum resultado encontrado</p>;

    // Agrupar por CDFUN
    const funcionarios = {};
    let totalGeral = 0;

    dados.forEach(item => {
      const key = item.CDFUN;
      const multiplicador = item.TIPO === 'DV' ? -1 : 1;
      const valor = parseFloat(item.VALOR || 0) * multiplicador;
      const desconto = parseFloat(item.VLDESCUS || 0) * multiplicador;

      if (!funcionarios[key]) {
        funcionarios[key] = {
          cdfun: item.CDFUN,
          nome: item.NOMEFUNCIONARIO || 'Sem Nome',
          valorVenda: 0,
          desconto: 0
        };
      }
      funcionarios[key].valorVenda += valor;
      funcionarios[key].desconto += desconto;
      totalGeral += valor;
    });

    const funcionariosArray = Object.values(funcionarios).sort((a, b) => b.valorVenda - a.valorVenda);
    const totalDesconto = funcionariosArray.reduce((sum, f) => sum + f.desconto, 0);
    const percDescTotal = totalGeral > 0 ? (totalDesconto / totalGeral) * 100 : 0;

    const scrollContainerRef = scrollContainerRefPorBalconista;
    const totalContainerRef = totalContainerRefPorBalconista;

    const handleScroll = (e) => {
      if (totalContainerRef.current) {
        totalContainerRef.current.scrollLeft = e.target.scrollLeft;
      }
    };

    return (
      <div className="excel-table-container" style={{ height: '350px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }} onScroll={handleScroll}>
          <table className="excel-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '60px' }} />
              <col style={{ width: '250px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Vend.</th>
                <th>Nome</th>
                <th className="text-right">Valor Venda</th>
                <th className="text-right">Desconto</th>
                <th className="text-right">% Desc.</th>
                <th className="text-right">% Partc.</th>
              </tr>
            </thead>
            <tbody>
              {funcionariosArray.map(func => {
                const percDesc = Math.abs(func.valorVenda) > 0 ? (func.desconto / Math.abs(func.valorVenda)) * 100 : 0;
                const percPartc = Math.abs(totalGeral) > 0 ? (func.valorVenda / totalGeral) * 100 : 0;
                const valorClass = func.valorVenda < 0 ? 'negative' : 'currency';

                return (
                  <tr
                    key={func.cdfun}
                    className="clickable"
                    onClick={() => handleClickBalconista(func.cdfun, func.nome)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="text-center"><strong>{func.cdfun}</strong></td>
                    <td>{func.nome}</td>
                    <td className={`text-right ${valorClass}`}>
                      R$ {func.valorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right">
                      R$ {func.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right">{percDesc.toFixed(2)}%</td>
                    <td className="text-right">{percPartc.toFixed(2)}%</td>
                  </tr>
                );
              })}
              {/* Preencher linhas vazias */}
              {Array.from({ length: Math.max(0, 13 - funcionariosArray.length) }).map((_, index) => (
                <tr key={`empty-${index}`}>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div ref={totalContainerRef} style={{ overflowX: 'auto', overflowY: 'hidden' }}>
          <table className="excel-table" style={{ marginTop: '0', borderTop: '2px solid #10b981', tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '60px' }} />
              <col style={{ width: '250px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <tbody>
              <tr className="total-row">
                <td colSpan="2"><strong>TOTAL GERAL</strong></td>
                <td className="text-right currency">
                  R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="text-right">
                  R$ {totalDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="text-right">{percDescTotal.toFixed(2)}%</td>
                <td className="text-right">100.00%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPorProduto = () => {
    if (!dados.length) return <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Nenhum resultado encontrado</p>;

    return (
      <div className="excel-table-container" style={{ height: '350px', overflowY: 'auto' }}>
        <table className="excel-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '90px' }} />
            <col style={{ width: '250px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '70px' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Código</th>
              <th>Produto</th>
              <th className="text-right">Qtd.</th>
              <th className="text-right">Valor Unit.</th>
              <th className="text-right">Desconto</th>
              <th className="text-right">% Desc.</th>
              <th className="text-right">P. Venda</th>
              <th className="text-center">Vend.</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((item, index) => {
              const indicador = item.TIPO === 'VE' ? '+' : '-';
              const indicadorClass = item.TIPO === 'VE' ? 'venda' : 'devolucao';
              const multiplicador = item.TIPO === 'DV' ? -1 : 1;
              const valorUnit = parseFloat(item.VALOR || 0) * multiplicador;
              const precoVenda = parseFloat(item.PRECO || 0) * multiplicador;
              const desconto = precoVenda - valorUnit;
              const percDesc = Math.abs(valorUnit) > 0 ? (desconto / Math.abs(valorUnit)) * 100 : 0;

              return (
                <tr key={index}>
                  <td>
                    <span className={`produto-tipo-indicator ${indicadorClass}`}>{indicador}</span>
                    {' '}
                    <strong>{item.CDPRODU}</strong>
                  </td>
                  <td>{item.NOME || 'Sem nome'}</td>
                  <td className="text-right number">{item.QTD || 0}</td>
                  <td className="text-right currency">
                    R$ {valorUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="text-right">
                    R$ {desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="text-right">{percDesc.toFixed(2)}%</td>
                  <td className="text-right">
                    R$ {precoVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="text-center"><strong>{item.CDFUN}</strong></td>
                </tr>
              );
            })}
            {/* Preencher linhas vazias */}
            {Array.from({ length: Math.max(0, 15 - dados.length) }).map((_, index) => (
              <tr key={`empty-${index}`}>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td className="text-right">&nbsp;</td>
                <td className="text-right">&nbsp;</td>
                <td className="text-right">&nbsp;</td>
                <td className="text-right">&nbsp;</td>
                <td className="text-right">&nbsp;</td>
                <td className="text-center">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderResumido = () => {
    if (!dados.length) return <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Nenhum resultado encontrado</p>;

    // Agrupar por CDTIPO
    const tipos = {};
    let totalGeral = 0;

    dados.forEach(item => {
      const key = item.CDTIPO;
      const multiplicador = item.TIPO === 'DV' ? -1 : 1;
      const valor = parseFloat(item.VALOR || 0) * multiplicador;
      const desconto = parseFloat(item.VLDESCUS || 0) * multiplicador;

      if (!tipos[key]) {
        tipos[key] = {
          cdtipo: item.CDTIPO,
          nmtipo: item.NMTIPO || 'Sem Tipo',
          valorVenda: 0,
          desconto: 0
        };
      }
      tipos[key].valorVenda += valor;
      tipos[key].desconto += desconto;
      totalGeral += valor;
    });

    const tiposArray = Object.values(tipos).sort((a, b) => b.valorVenda - a.valorVenda);
    const totalDesconto = tiposArray.reduce((sum, t) => sum + t.desconto, 0);
    const percDescTotal = totalGeral > 0 ? (totalDesconto / totalGeral) * 100 : 0;

    const scrollContainerRef = scrollContainerRefResumido;
    const totalContainerRef = totalContainerRefResumido;

    const handleScroll = (e) => {
      if (totalContainerRef.current) {
        totalContainerRef.current.scrollLeft = e.target.scrollLeft;
      }
    };

    return (
      <div className="excel-table-container" style={{ height: '350px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }} onScroll={handleScroll}>
          <table className="excel-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '60px' }} />
              <col style={{ width: '250px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nome</th>
                <th className="text-right">Valor Venda</th>
                <th className="text-right">Desconto</th>
                <th className="text-right">% Desc.</th>
                <th className="text-right">% Partc.</th>
              </tr>
            </thead>
            <tbody>
              {tiposArray.map(tipo => {
                const percDesc = Math.abs(tipo.valorVenda) > 0 ? (tipo.desconto / Math.abs(tipo.valorVenda)) * 100 : 0;
                const percPartc = Math.abs(totalGeral) > 0 ? (tipo.valorVenda / totalGeral) * 100 : 0;
                const valorClass = tipo.valorVenda < 0 ? 'negative' : 'currency';

                return (
                  <tr key={tipo.cdtipo} className="clickable">
                    <td className="text-center"><strong>{tipo.cdtipo}</strong></td>
                    <td>{tipo.nmtipo}</td>
                    <td className={`text-right ${valorClass}`}>
                      R$ {tipo.valorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right">
                      R$ {tipo.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right">{percDesc.toFixed(2)}%</td>
                    <td className="text-right">{percPartc.toFixed(2)}%</td>
                  </tr>
                );
              })}
              {/* Preencher linhas vazias */}
              {Array.from({ length: Math.max(0, 13 - tiposArray.length) }).map((_, index) => (
                <tr key={`empty-${index}`}>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div ref={totalContainerRef} style={{ overflowX: 'auto', overflowY: 'hidden' }}>
          <table className="excel-table" style={{ marginTop: '0', borderTop: '2px solid #10b981', tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '60px' }} />
              <col style={{ width: '250px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <tbody>
              <tr className="total-row">
                <td colSpan="2"><strong>TOTAL GERAL</strong></td>
                <td className="text-right currency">
                  R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="text-right">
                  R$ {totalDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="text-right">{percDescTotal.toFixed(2)}%</td>
                <td className="text-right">100.00%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPorIndicador = () => {
    if (!dados.length) return <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Nenhum resultado encontrado</p>;

    // Definir indicadores e grupos
    const indicadores = {
      'Rentáveis': [20, 25],
      'Perfumaria R+': [46],
      'Conveniência R+': [36, 13],
      'Goodlife': [22]
    };

    const resultado = {};
    let totalGeral = 0;

    Object.keys(indicadores).forEach(nomeIndicador => {
      resultado[nomeIndicador] = {
        nome: nomeIndicador,
        valorVenda: 0,
        desconto: 0
      };
    });

    dados.forEach(item => {
      const cdgrupo = parseInt(item.CDGRUPO);
      const multiplicador = item.TIPO === 'DV' ? -1 : 1;
      const valor = parseFloat(item.VALOR || 0) * multiplicador;
      const desconto = parseFloat(item.VLDESCUS || 0) * multiplicador;

      totalGeral += valor;

      for (const [nomeIndicador, grupos] of Object.entries(indicadores)) {
        if (grupos.includes(cdgrupo)) {
          resultado[nomeIndicador].valorVenda += valor;
          resultado[nomeIndicador].desconto += desconto;
          break;
        }
      }
    });

    const indicadoresArray = Object.values(resultado).filter(ind => ind.valorVenda !== 0);
    const totalDesconto = indicadoresArray.reduce((sum, ind) => sum + ind.desconto, 0);
    const percDescTotal = totalGeral > 0 ? (totalDesconto / totalGeral) * 100 : 0;

    const scrollContainerRef = scrollContainerRefPorIndicador;
    const totalContainerRef = totalContainerRefPorIndicador;

    const handleScroll = (e) => {
      if (totalContainerRef.current) {
        totalContainerRef.current.scrollLeft = e.target.scrollLeft;
      }
    };

    return (
      <div className="excel-table-container" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }} onScroll={handleScroll}>
          <table className="excel-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '250px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Indicador</th>
                <th className="text-right">Valor Venda</th>
                <th className="text-right">Desconto</th>
                <th className="text-right">% Desc.</th>
                <th className="text-right">% Partc.</th>
              </tr>
            </thead>
            <tbody>
              {indicadoresArray.map((ind, index) => {
                const percDesc = Math.abs(ind.valorVenda) > 0 ? (ind.desconto / Math.abs(ind.valorVenda)) * 100 : 0;
                const percPartc = Math.abs(totalGeral) > 0 ? (ind.valorVenda / totalGeral) * 100 : 0;
                const valorClass = ind.valorVenda < 0 ? 'negative' : 'currency';

                return (
                  <tr key={index}>
                    <td><strong>{ind.nome}</strong></td>
                    <td className={`text-right ${valorClass}`}>
                      R$ {ind.valorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right">
                      R$ {ind.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right">{percDesc.toFixed(2)}%</td>
                    <td className="text-right">{percPartc.toFixed(2)}%</td>
                  </tr>
                );
              })}
              {/* Preencher linhas vazias */}
              {Array.from({ length: Math.max(0, 13 - indicadoresArray.length) }).map((_, index) => (
                <tr key={`empty-${index}`}>
                  <td>&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div ref={totalContainerRef} style={{ overflowX: 'auto', overflowY: 'hidden' }}>
          <table className="excel-table" style={{ marginTop: '0', borderTop: '2px solid #10b981', tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '250px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <tbody>
              <tr className="total-row">
                <td><strong>TOTAL GERAL</strong></td>
                <td className="text-right currency">
                  R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="text-right">
                  R$ {totalDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="text-right">{percDescTotal.toFixed(2)}%</td>
                <td className="text-right">100.00%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <DraggableWindow
      title="Posição de Vendas - Balconista"
      onClose={onClose}
      onMinimize={onMinimize}
      zIndex={zIndex}
      onFocus={onFocus}
      initialWidth={900}
      initialHeight={600}
    >
      <div style={{ padding: '20px' }}>
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
                Data Inicial
              </label>
              <input
                type="date"
                value={dataIni}
                onChange={(e) => setDataIni(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
                Data Final
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
                Filial
              </label>
              <CustomSelect
                options={[
                  { value: 'TODAS', label: 'Todas as Filiais' },
                  ...lojas.map(loja => ({
                    value: loja.numero,
                    label: `${loja.numero} - ${loja.nome}`
                  }))
                ]}
                value={filial}
                onChange={setFilial}
                placeholder="Selecione a filial"
                searchPlaceholder="Buscar filial..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="consulta-btn-submit"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Consultando...
                </>
              ) : (
                <>
                  <i className="fas fa-search"></i>
                  Consultar
                </>
              )}
            </button>
          </div>
        </form>

        {resultado && (
          <>
            {/* Filtro de funcionário ativo */}
            {filtroFuncionario && (
              <div style={{
                padding: '12px',
                marginBottom: '16px',
                background: '#e0f2fe',
                border: '1px solid #0ea5e9',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '14px', color: '#0c4a6e' }}>
                  <strong>Filtro ativo:</strong> Vendas de {filtroFuncionario.nome} (ID: {filtroFuncionario.cdfun})
                </span>
                <button
                  onClick={removerFiltroFuncionario}
                  style={{
                    padding: '6px 12px',
                    background: '#0ea5e9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                >
                  Remover Filtro
                </button>
              </div>
            )}

            {/* Abas */}
            <div className="vendas-tabs">
              <button
                className={`vendas-tab ${abaAtiva === 'por-grupo' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('por-grupo')}
              >
                Por Grupo
              </button>
              <button
                className={`vendas-tab ${abaAtiva === 'por-balconista' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('por-balconista')}
              >
                Por Balconista
              </button>
              <button
                className={`vendas-tab ${abaAtiva === 'por-produto' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('por-produto')}
              >
                Por Produto
              </button>
              <button
                className={`vendas-tab ${abaAtiva === 'resumido' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('resumido')}
              >
                Resumido
              </button>
              <button
                className={`vendas-tab ${abaAtiva === 'por-indicador' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('por-indicador')}
              >
                Por Indicador
              </button>
            </div>

            {/* Conteúdo das abas */}
            {abaAtiva === 'por-grupo' && renderPorGrupo()}
            {abaAtiva === 'por-balconista' && renderPorBalconista()}
            {abaAtiva === 'por-produto' && renderPorProduto()}
            {abaAtiva === 'resumido' && renderResumido()}
            {abaAtiva === 'por-indicador' && renderPorIndicador()}
          </>
        )}
      </div>
    </DraggableWindow>
  );
};

export default WindowPosicaoVendas;
