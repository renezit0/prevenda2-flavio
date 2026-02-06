import React, { useState, useEffect, useCallback } from 'react';
import WindowPreco from './windows/WindowPreco';
import WindowEstoque from './windows/WindowEstoque';
import WindowHistorico from './windows/WindowHistorico';
import WindowTransito from './windows/WindowTransito';
import WindowNotas from './windows/WindowNotas';
import WindowCliente from './windows/WindowCliente';
import WindowSimulador from './windows/WindowSimulador';
import WindowPosicaoVendas from './windows/WindowPosicaoVendas';
import WindowDevolucao from './windows/WindowDevolucao';
import WindowConsultaProtocolos from './windows/WindowConsultaProtocolos';
import Avatar from './Avatar';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { authService, lojasService } from '../services/api';
import ComparativoBalanco from '../pages/ComparativoBalanco';
import '../styles/ConsultaGlobal.css';

const ConsultaGlobal = ({ userData: userDataProp }) => {
  const [activeWindows, setActiveWindows] = useState([]);
  const [minimizedWindows, setMinimizedWindows] = useState([]);
  const [windowsZIndex, setWindowsZIndex] = useState({});
  const [maxZIndex, setMaxZIndex] = useState(1000);
  const [desktopActive, setDesktopActive] = useState(false);
  const [lastProductCode, setLastProductCode] = useState(null);
  const [estoqueAutoSearch, setEstoqueAutoSearch] = useState(null);
  const [estoqueReadOnly, setEstoqueReadOnly] = useState(false);
  const [userData, setUserData] = useState(userDataProp);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  // Debug userData e buscar nome da loja se não tiver
  useEffect(() => {
    console.log('👤 UserData:', userData);

    // Se tiver loja_id mas não tiver loja_nome, buscar
    if (userData.loja_id && !userData.loja_nome) {
      lojasService.getLojas().then(lojas => {
        const loja = lojas.find(l => l.id === userData.loja_id || l.numero === userData.loja_id);
        if (loja) {
          // Atualizar userData com nome da loja
          setUserData(prev => ({ ...prev, loja_nome: loja.nome }));
          console.log('Loja encontrada:', loja.nome);
        }
      }).catch(err => console.error('Erro ao buscar lojas:', err));
    }
  }, [userData]);

  // Função para abrir janela
  const openWindow = useCallback((windowId) => {
    setDesktopActive(true);

    if (!activeWindows.includes(windowId)) {
      setActiveWindows(prev => [...prev, windowId]);
    }

    // Trazer janela para frente
    setMaxZIndex(prev => prev + 1);
    setWindowsZIndex(prev => ({
      ...prev,
      [windowId]: maxZIndex + 1
    }));
  }, [activeWindows, maxZIndex]);

  // Função para fechar janela
  const closeWindow = useCallback((windowId) => {
    setActiveWindows(prev => prev.filter(id => id !== windowId));
  }, []);

  // Função para trazer janela para frente
  const bringToFront = useCallback((windowId) => {
    setMaxZIndex(prev => prev + 1);
    setWindowsZIndex(prev => ({
      ...prev,
      [windowId]: maxZIndex + 1
    }));
  }, [maxZIndex]);

  // Função para minimizar janela
  const minimizeWindow = useCallback((windowId) => {
    setMinimizedWindows(prev => [...prev, windowId]);
  }, []);

  // Função para restaurar janela
  const restoreWindow = useCallback((windowId) => {
    setMinimizedWindows(prev => prev.filter(id => id !== windowId));
    bringToFront(windowId);
  }, [bringToFront]);

  // Função para fechar desktop
  const closeDesktop = useCallback(() => {
    setDesktopActive(false);
    setActiveWindows([]);
    setMinimizedWindows([]);
  }, []);

  // Ao sair da home, garantir que não fica "desktop" aberto por trás
  useEffect(() => {
    if (!isHome && desktopActive) {
      closeDesktop();
    }
  }, [isHome, desktopActive, closeDesktop]);

  // Função para logout
  const handleLogout = async () => {
    try {
      await authService.logout();
      window.location.reload();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F5 - Consulta de Preço
      if (e.key === 'F5') {
        e.preventDefault();
        openWindow('preco');
      }
      // F4 - Consulta de Estoque
      else if (e.key === 'F4') {
        e.preventDefault();
        setEstoqueReadOnly(false); // F4 sempre abre no modo normal (com campo)
        setEstoqueAutoSearch(null); // Não faz auto-search
        openWindow('estoque');
      }
      // F7 - Posição de Vendas
      else if (e.key === 'F7') {
        e.preventDefault();
        openWindow('posicao');
      }
      // F8 - Em Trânsito
      else if (e.key === 'F8') {
        e.preventDefault();
        openWindow('transito');
      }
      // F9 - Histórico
      else if (e.key === 'F9') {
        e.preventDefault();
        openWindow('historico');
      }
      // ESC - Fechar desktop
      else if (e.key === 'Escape' && desktopActive) {
        e.preventDefault();
        closeDesktop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [desktopActive, openWindow, closeDesktop, lastProductCode]);

  const irParaComparativo = () => {
    closeDesktop();
    navigate('/comparativo-balanco');
  };

  const irParaHome = () => {
    closeDesktop();
    navigate('/');
  };

  const HomeContent = () => (
    <div className="consulta-welcome">
      <div className="consulta-shortcuts-grid">
        <div className="shortcut-card" onClick={() => openWindow('preco')}>
          <i className="fas fa-tag"></i>
          <h3>Consultar Preço</h3>
          <p>Tecla: <kbd>F5</kbd></p>
        </div>

        <div className="shortcut-card" onClick={() => {
          setEstoqueReadOnly(false);
          setEstoqueAutoSearch(null);
          openWindow('estoque');
        }}>
          <i className="fas fa-warehouse"></i>
          <h3>Consultar Estoque</h3>
          <p>Tecla: <kbd>F4</kbd></p>
        </div>

        <div className="shortcut-card" onClick={() => openWindow('posicao')}>
          <i className="fas fa-chart-line"></i>
          <h3>Posição de Vendas</h3>
          <p>Tecla: <kbd>F7</kbd></p>
        </div>

        <div className="shortcut-card" onClick={() => openWindow('transito')}>
          <i className="fas fa-truck"></i>
          <h3>Mercadorias Em Trânsito</h3>
          <p>Tecla: <kbd>F8</kbd></p>
        </div>

        <div className="shortcut-card" onClick={() => openWindow('protocolos')}>
          <i className="fas fa-search"></i>
          <h3>Consulta Protocolos</h3>
          <p>Buscar protocolos online</p>
        </div>

        <div className="shortcut-card" onClick={() => openWindow('historico')}>
          <i className="fas fa-history"></i>
          <h3>Histórico Movimentações</h3>
          <p>Tecla: <kbd>F9</kbd></p>
        </div>

        <div className="shortcut-card" onClick={() => openWindow('notas')}>
          <i className="fas fa-file-invoice"></i>
          <h3>Notas Fiscais Pendentes</h3>
        </div>

        <div className="shortcut-card" onClick={() => openWindow('cliente')}>
          <i className="fas fa-user"></i>
          <h3>Consultar Clientes</h3>
        </div>

        <div className="shortcut-card" onClick={() => openWindow('simulador')}>
          <i className="fas fa-shopping-cart"></i>
          <h3>Simulador de Vendas</h3>
          <p>Pré-venda</p>
        </div>

        <div className="shortcut-card" onClick={() => openWindow('devolucao')}>
          <i className="fas fa-undo-alt"></i>
          <h3>Devoluções</h3>
          <p>Gerenciar devoluções</p>
        </div>

        <div className="shortcut-card" onClick={irParaComparativo}>
          <i className="fas fa-scale-balanced"></i>
          <h3>Comparativo Balanço</h3>
          <p>Comparar 2 inventários (EI/SI)</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="consulta-global-app">
      {/* Header */}
      <div className="consulta-header">
        <div className="consulta-header-left">
          <img src="/favicon.png" alt="seeLL" className="consulta-header-logo" />
          <div className="consulta-header-nav">
            <Link to="/" onClick={irParaHome} className={`consulta-nav-link ${isHome ? 'active' : ''}`}>
              <i className="fas fa-house"></i> Início
            </Link>
            <Link to="/comparativo-balanco" onClick={irParaComparativo} className={`consulta-nav-link ${!isHome ? 'active' : ''}`}>
              <i className="fas fa-scale-balanced"></i> Comparativo Balanço
            </Link>
          </div>
        </div>
        <div className="consulta-header-right">
          <div className="consulta-user-info">
            <Avatar size={36} user={userData} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginLeft: '10px' }}>
              <span style={{ fontWeight: '600' }}>{userData.nome}</span>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{userData.loja_id} - {userData.loja_nome || 'Loja'}</span>
            </div>
          </div>
          <button
            onClick={isHome ? irParaComparativo : irParaHome}
            className="consulta-nav-btn"
            title={isHome ? 'Ir para Comparativo Balanço' : 'Voltar para Início'}
          >
            <i className={`fas ${isHome ? 'fa-scale-balanced' : 'fa-arrow-left'}`}></i>
          </button>
          <button onClick={handleLogout} className="consulta-logout-btn">
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>

      <div className="consulta-main-content">
        <Routes>
          <Route path="/" element={<HomeContent />} />
          <Route path="/comparativo-balanco" element={<ComparativoBalanco userData={userData} />} />
          <Route path="*" element={<HomeContent />} />
        </Routes>
      </div>

      {/* Desktop de janelas */}
      {isHome && desktopActive && (
        <div className="windows-desktop-container">
          {/* Janelas */}
            {activeWindows.includes('preco') && (
              <WindowPreco
                onClose={() => closeWindow('preco')}
                onMinimize={() => minimizeWindow('preco')}
                isMinimized={minimizedWindows.includes('preco')}
                zIndex={windowsZIndex['preco'] || 1000}
                onFocus={() => bringToFront('preco')}
                userData={userData}
                onProductConsulted={setLastProductCode}
                onOpenEstoque={(codigo) => {
                  setLastProductCode(codigo);
                  setEstoqueAutoSearch(codigo);
                  setEstoqueReadOnly(true); // F6 do WindowPreco abre no modo readOnly
                  openWindow('estoque');
                }}
              />
            )}

            {activeWindows.includes('estoque') && (
              <WindowEstoque
                onClose={() => {
                  closeWindow('estoque');
                  setEstoqueReadOnly(false);
                  setEstoqueAutoSearch(null);
                }}
                onMinimize={() => minimizeWindow('estoque')}
                isMinimized={minimizedWindows.includes('estoque')}
                zIndex={windowsZIndex['estoque'] || 1000}
                onFocus={() => bringToFront('estoque')}
                userData={userData}
                autoSearchCode={estoqueAutoSearch}
                readOnly={estoqueReadOnly}
              />
            )}

            {activeWindows.includes('historico') && (
              <WindowHistorico
                isOpen={!minimizedWindows.includes('historico')}
                onClose={() => closeWindow('historico')}
                onMinimize={() => minimizeWindow('historico')}
                zIndex={windowsZIndex['historico'] || 1000}
                onFocus={() => bringToFront('historico')}
                userData={userData}
              />
            )}

            {activeWindows.includes('posicao') && (
              <WindowPosicaoVendas
                isOpen={!minimizedWindows.includes('posicao')}
                onClose={() => closeWindow('posicao')}
                onMinimize={() => minimizeWindow('posicao')}
                zIndex={windowsZIndex['posicao'] || 1000}
                onFocus={() => bringToFront('posicao')}
                userData={userData}
              />
            )}

            {activeWindows.includes('transito') && (
              <WindowTransito
                onClose={() => closeWindow('transito')}
                onMinimize={() => minimizeWindow('transito')}
                isMinimized={minimizedWindows.includes('transito')}
                zIndex={windowsZIndex['transito'] || 1000}
                onFocus={() => bringToFront('transito')}
                userData={userData}
              />
            )}

            {activeWindows.includes('protocolos') && (
              <WindowConsultaProtocolos
                onClose={() => closeWindow('protocolos')}
                onMinimize={() => minimizeWindow('protocolos')}
                isMinimized={minimizedWindows.includes('protocolos')}
                zIndex={windowsZIndex['protocolos'] || 1000}
                onFocus={() => bringToFront('protocolos')}
              />
            )}

            {activeWindows.includes('notas') && (
              <WindowNotas
                onClose={() => closeWindow('notas')}
                onMinimize={() => minimizeWindow('notas')}
                isMinimized={minimizedWindows.includes('notas')}
                zIndex={windowsZIndex['notas'] || 1000}
                onFocus={() => bringToFront('notas')}
                userData={userData}
              />
            )}

            {activeWindows.includes('cliente') && (
              <WindowCliente
                onClose={() => closeWindow('cliente')}
                onMinimize={() => minimizeWindow('cliente')}
                isMinimized={minimizedWindows.includes('cliente')}
                zIndex={windowsZIndex['cliente'] || 1000}
                onFocus={() => bringToFront('cliente')}
                userData={userData}
              />
            )}

            {activeWindows.includes('simulador') && (
              <WindowSimulador
                onClose={() => closeWindow('simulador')}
                onMinimize={() => minimizeWindow('simulador')}
                isMinimized={minimizedWindows.includes('simulador')}
                zIndex={windowsZIndex['simulador'] || 1000}
                onFocus={() => bringToFront('simulador')}
                userData={userData}
              />
            )}

            {activeWindows.includes('devolucao') && (
              <WindowDevolucao
                onClose={() => closeWindow('devolucao')}
                onMinimize={() => minimizeWindow('devolucao')}
                isMinimized={minimizedWindows.includes('devolucao')}
                zIndex={windowsZIndex['devolucao'] || 1000}
                onFocus={() => bringToFront('devolucao')}
                userData={userData}
              />
            )}
        </div>
      )}

      {/* Taskbar para janelas minimizadas */}
      {isHome && minimizedWindows.length > 0 && (
        <div className="consulta-taskbar active">
          {minimizedWindows.map(windowId => {
            const windowIcons = {
              preco: 'fa-tag',
              posicao: 'fa-chart-line',
              estoque: 'fa-warehouse',
              historico: 'fa-history',
              transito: 'fa-truck',
              notas: 'fa-file-invoice',
              cliente: 'fa-user',
              simulador: 'fa-shopping-cart',
              devolucao: 'fa-undo-alt'
            };
            const windowTitles = {
              preco: 'Consultar Preço',
              estoque: 'Consultar Estoque',
              posicao: 'Posição de Vendas',
              historico: 'Histórico',
              transito: 'Em Trânsito',
              notas: 'Notas Pendentes',
              cliente: 'Consultar Cliente',
              simulador: 'Simulador de Vendas',
              devolucao: 'Devoluções'
            };
            return (
              <div
                key={windowId}
                className="consulta-taskbar-item"
                onClick={() => restoreWindow(windowId)}
              >
                <i className={`fas ${windowIcons[windowId]}`}></i>
                {windowTitles[windowId]}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConsultaGlobal;
