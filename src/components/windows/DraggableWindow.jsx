import React, { useState, useRef, useEffect, useCallback } from 'react';

const DraggableWindow = ({
  title,
  icon,
  onClose,
  onMinimize,
  isMinimized = false,
  zIndex,
  onFocus,
  children,
  initialWidth = 800,
  initialTop = 100,
  initialLeft = 100
}) => {
  // Ajustar posição inicial baseada no tamanho da tela
  const getAdjustedInitialPosition = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedLeft = initialLeft;
    let adjustedTop = initialTop;

    // Se a janela não couber na viewport, centralizar
    if (initialLeft + initialWidth > viewportWidth) {
      adjustedLeft = Math.max(20, (viewportWidth - initialWidth) / 2);
    }

    if (initialTop + 400 > viewportHeight) {
      adjustedTop = Math.max(20, (viewportHeight - 400) / 2);
    }

    return { x: adjustedLeft, y: adjustedTop };
  };

  const [position, setPosition] = useState(getAdjustedInitialPosition());
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.closest('.consulta-window-btn')) return;

    // Desabilitar drag em mobile
    if (window.innerWidth <= 768) return;

    setIsDragging(true);
    const rect = windowRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    onFocus();
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || isMaximized) return;
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    },
    [isDragging, isMaximized, dragOffset]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  const windowStyle = isMaximized
    ? {
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        transform: 'none'
      }
    : {
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: `${initialWidth}px`,
        maxWidth: '95vw'
      };

  return (
    <div
      ref={windowRef}
      className={`consulta-window ${!isMinimized ? 'active' : ''} ${isMaximized ? 'maximized' : ''}`}
      style={{
        ...windowStyle,
        zIndex,
        position: 'fixed',
        display: isMinimized ? 'none' : 'block'
      }}
      onClick={onFocus}
    >
      <div
        className="consulta-window-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className="consulta-window-title">
          <i className={`fas ${icon}`}></i>
          <span>{title}</span>
        </div>
        <div className="consulta-window-controls">
          {onMinimize && (
            <button className="consulta-window-btn minimize" onClick={onMinimize}>
              <i className="fas fa-minus"></i>
            </button>
          )}
          <button className="consulta-window-btn maximize" onClick={handleMaximize}>
            <i className={`fas ${isMaximized ? 'fa-compress' : 'fa-expand'}`}></i>
          </button>
          <button className="consulta-window-btn closeb" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div className="consulta-window-content">
        {children}
      </div>
    </div>
  );
};

export default DraggableWindow;
