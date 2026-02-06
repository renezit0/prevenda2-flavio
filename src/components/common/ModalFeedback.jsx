import React from 'react';

const ModalFeedback = ({ show, tipo, titulo, mensagem, onClose }) => {
  if (!show) return null;

  const getIconConfig = () => {
    switch (tipo) {
      case 'sucesso':
        return {
          icon: 'fa-check',
          gradient: 'linear-gradient(135deg, #10b981, #059669)',
          shadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          buttonBg: '#10b981'
        };
      case 'erro':
        return {
          icon: 'fa-times',
          gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
          shadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
          buttonBg: '#ef4444'
        };
      case 'aviso':
        return {
          icon: 'fa-exclamation-triangle',
          gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
          shadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
          buttonBg: '#f59e0b'
        };
      default:
        return {
          icon: 'fa-info',
          gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          shadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          buttonBg: '#3b82f6'
        };
    }
  };

  const config = getIconConfig();

  return (
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
        zIndex: 10001
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          width: '90%',
          maxWidth: '450px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Header com ícone */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: config.gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: config.shadow
          }}>
            <i className={`fas ${config.icon}`} style={{ fontSize: '28px', color: 'white' }}></i>
          </div>

          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            {titulo}
          </h3>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
            {mensagem}
          </p>
        </div>

        {/* Botão OK */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            background: config.buttonBg,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.opacity = '0.9';
            e.target.style.transform = 'scale(1.02)';
          }}
          onMouseOut={(e) => {
            e.target.style.opacity = '1';
            e.target.style.transform = 'scale(1)';
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default ModalFeedback;
