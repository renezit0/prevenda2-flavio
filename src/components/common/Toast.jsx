import React from 'react';

const Toast = ({ toast, onRemove }) => {
  const getConfig = () => {
    switch (toast.tipo) {
      case 'sucesso':
        return {
          borderColor: '#10b981',
          iconBg: '#d1fae5',
          iconColor: '#10b981',
          icon: 'fa-check-circle',
          title: 'Sucesso!'
        };
      case 'erro':
        return {
          borderColor: '#ef4444',
          iconBg: '#fee2e2',
          iconColor: '#ef4444',
          icon: 'fa-times-circle',
          title: 'Erro!'
        };
      case 'aviso':
        return {
          borderColor: '#f59e0b',
          iconBg: '#fef3c7',
          iconColor: '#f59e0b',
          icon: 'fa-exclamation-triangle',
          title: 'Atenção!'
        };
      default:
        return {
          borderColor: '#3b82f6',
          iconBg: '#dbeafe',
          iconColor: '#3b82f6',
          icon: 'fa-info-circle',
          title: 'Informação'
        };
    }
  };

  const config = getConfig();

  return (
    <div
      style={{
        background: 'white',
        padding: '16px 20px',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: '300px',
        maxWidth: '400px',
        transform: toast.show ? 'translateX(0)' : 'translateX(400px)',
        opacity: toast.show ? 1 : 0,
        transition: 'all 0.3s ease',
        borderLeft: `4px solid ${config.borderColor}`,
        pointerEvents: 'all'
      }}
    >
      {/* Ícone */}
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: config.iconBg,
        color: config.iconColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <i className={`fas ${config.icon}`} style={{ fontSize: '12px' }}></i>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight: '600',
          fontSize: '14px',
          color: '#111827',
          marginBottom: '2px'
        }}>
          {config.title}
        </div>
        <div style={{
          fontSize: '13px',
          color: '#6b7280'
        }}>
          {toast.mensagem}
        </div>
      </div>

      {/* Botão fechar */}
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          color: '#9ca3af',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = '#f3f4f6';
          e.currentTarget.style.color = '#374151';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'none';
          e.currentTarget.style.color = '#9ca3af';
        }}
      >
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

export default Toast;
