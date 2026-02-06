import React, { useState } from 'react';
import DraggableWindow from './DraggableWindow';
import { queryService } from '../../services/api';

const WindowConsultaProtocolos = ({ onClose, onMinimize, isMinimized, zIndex, onFocus }) => {
  const [termoBusca, setTermoBusca] = useState('');
  const [tipoBusca, setTipoBusca] = useState('numero'); // 'chave' ou 'numero'
  const [resultadosConsulta, setResultadosConsulta] = useState([]);
  const [loadingConsulta, setLoadingConsulta] = useState(false);

  const traduzirStatus = (status) => {
    const statusMap = {
      1: 'Aberto',
      2: 'Em Trânsito',
      3: 'Recebido'
    };
    return statusMap[status] || status;
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

  const buscarProtocolos = async (e) => {
    e.preventDefault();

    if (!termoBusca.trim()) {
      return;
    }

    setLoadingConsulta(true);
    setResultadosConsulta([]);

    try {
      let query = '';

      if (tipoBusca === 'chave') {
        // Buscar por chave NFE
        query = `
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
          WHERE protocolo_online_documento.documento LIKE '%${termoBusca}%'
          ORDER BY protocolo_online.data_cadastro DESC
        `;
      } else {
        // Buscar por número de movimentação (NUMDOC)
        // Primeiro buscar a chave NFE do NUMDOC
        const queryNumDoc = `
          SELECT NRNFE
          FROM admnf
          WHERE NRPEDIDO = ${termoBusca}
          ORDER BY DTEMIS DESC
          LIMIT 1
        `;

        const resultNumDoc = await queryService.execute(queryNumDoc);

        if (resultNumDoc && resultNumDoc.length > 0 && resultNumDoc[0].NRNFE) {
          const chaveNFe = resultNumDoc[0].NRNFE;
          query = `
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
            WHERE protocolo_online_documento.documento = '${chaveNFe}'
            ORDER BY protocolo_online.data_cadastro DESC
          `;
        } else {
          setResultadosConsulta([]);
          setLoadingConsulta(false);
          return;
        }
      }

      const data = await queryService.execute(query);
      setResultadosConsulta(data || []);
    } catch (err) {
      console.error('Erro ao buscar protocolos:', err);
      setResultadosConsulta([]);
    } finally {
      setLoadingConsulta(false);
    }
  };

  return (
    <DraggableWindow
      title="Consulta de Protocolos"
      icon="fa-search"
      onClose={onClose}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      zIndex={zIndex}
      onFocus={onFocus}
      initialWidth={800}
      initialTop={100}
      initialLeft={300}
    >
      {/* Formulário de Busca */}
      <form onSubmit={buscarProtocolos} style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>
            Tipo de Busca
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', background: tipoBusca === 'numero' ? '#f3e8ff' : '#f9fafb', border: `2px solid ${tipoBusca === 'numero' ? '#8b5cf6' : '#e5e7eb'}`, borderRadius: '6px', transition: 'all 0.2s' }}>
              <input
                type="radio"
                value="numero"
                checked={tipoBusca === 'numero'}
                onChange={(e) => setTipoBusca(e.target.value)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Número da Movimentação</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', background: tipoBusca === 'chave' ? '#f3e8ff' : '#f9fafb', border: `2px solid ${tipoBusca === 'chave' ? '#8b5cf6' : '#e5e7eb'}`, borderRadius: '6px', transition: 'all 0.2s' }}>
              <input
                type="radio"
                value="chave"
                checked={tipoBusca === 'chave'}
                onChange={(e) => setTipoBusca(e.target.value)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Chave NFe</span>
            </label>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>
            {tipoBusca === 'chave' ? 'Chave NFe' : 'Número da Movimentação'}
          </label>
          <input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder={tipoBusca === 'chave' ? 'Digite a chave da NFe...' : 'Digite o número da movimentação...'}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => { e.target.style.borderColor = '#8b5cf6'; }}
            onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
          />
        </div>

        <button
          type="submit"
          disabled={loadingConsulta}
          style={{
            background: '#8b5cf6',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: loadingConsulta ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            opacity: loadingConsulta ? 0.7 : 1
          }}
          onMouseOver={(e) => { if (!loadingConsulta) e.currentTarget.style.background = '#7c3aed'; }}
          onMouseOut={(e) => { if (!loadingConsulta) e.currentTarget.style.background = '#8b5cf6'; }}
        >
          <i className={loadingConsulta ? 'fas fa-spinner fa-spin' : 'fas fa-search'}></i>
          {loadingConsulta ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {/* Resultados */}
      {loadingConsulta && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', color: '#8b5cf6' }}></i>
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Buscando protocolos...</p>
        </div>
      )}

      {!loadingConsulta && resultadosConsulta.length === 0 && termoBusca && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f9fafb', borderRadius: '6px' }}>
          <i className="fas fa-info-circle" style={{ fontSize: '32px', color: '#9ca3af' }}></i>
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Nenhum protocolo encontrado.</p>
        </div>
      )}

      {!loadingConsulta && resultadosConsulta.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 16px 0', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
            {resultadosConsulta.length} Resultado(s) Encontrado(s)
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto' }}>
            {resultadosConsulta.map((protocolo, index) => (
              <div key={index} style={{ background: '#f9fafb', borderRadius: '6px', padding: '16px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Número do Protocolo
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ background: 'white', padding: '6px 10px', borderRadius: '4px', fontFamily: 'monospace', color: '#374151', border: '1px solid #e5e7eb', fontSize: '13px', fontWeight: '600' }}>
                        {protocolo.protocolo}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(protocolo.protocolo);
                        }}
                        style={{
                          background: '#8b5cf6',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#7c3aed'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#8b5cf6'; }}
                        title="Copiar protocolo"
                      >
                        <i className="fas fa-copy"></i>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Data
                    </label>
                    <div style={{ background: 'white', padding: '6px 10px', borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fas fa-calendar-alt" style={{ color: '#9ca3af', fontSize: '11px' }}></i>
                      {protocolo.data_cadastro ? formatDate(protocolo.data_cadastro) : '-'}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Funcionário
                    </label>
                    <div style={{ background: 'white', padding: '6px 10px', borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '13px', color: '#374151' }}>
                      {protocolo.nome_funcionario ? `${protocolo.remetente_cdfun} - ${protocolo.nome_funcionario}` : (protocolo.remetente_cdfun || '-')}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Filial
                    </label>
                    <div style={{ background: 'white', padding: '6px 10px', borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '13px', color: '#374151' }}>
                      {protocolo.remetente_cdfil || '-'}
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Status
                    </label>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: protocolo.status === 3 ? '#86efac' : protocolo.status === 2 ? '#fef3c7' : '#d1fae5',
                      color: protocolo.status === 3 ? '#166534' : protocolo.status === 2 ? '#92400e' : '#047857',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      <i className={protocolo.status === 3 ? 'fas fa-check-circle' : protocolo.status === 2 ? 'fas fa-truck' : 'fas fa-folder-open'}></i>
                      {traduzirStatus(protocolo.status)}
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Chave NFe
                    </label>
                    <code style={{ background: 'white', padding: '6px 10px', borderRadius: '4px', fontFamily: 'monospace', color: '#374151', border: '1px solid #e5e7eb', fontSize: '11px', display: 'block', wordBreak: 'break-all' }}>
                      {protocolo.documento}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DraggableWindow>
  );
};

export default WindowConsultaProtocolos;
