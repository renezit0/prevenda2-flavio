import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const CustomSelect = ({ options, value, onChange, placeholder = 'Selecione...', searchPlaceholder = 'Buscar...' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const searchContainerRef = useRef(null);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    setFilteredOptions(
      options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, options]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Verificar se o clique foi dentro do wrapper OU dentro do dropdown portal
      const isInsideWrapper = wrapperRef.current && wrapperRef.current.contains(event.target);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);

      if (!isInsideWrapper && !isInsideDropdown) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manter o foco no input de pesquisa quando o dropdown está aberto
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, filteredOptions]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const updatePosition = () => {
        if (triggerRef.current) {
          const rect = triggerRef.current.getBoundingClientRect();
          setDropdownPosition({
            top: rect.bottom,
            left: rect.left,
            width: rect.width
          });
        }
      };

      updatePosition();

      let ticking = false;
      const handleScrollOrResize = (e) => {
        // Ignorar eventos dentro do dropdown ou do campo de busca
        if (e.target) {
          const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
          const isInsideSearch = searchContainerRef.current && searchContainerRef.current.contains(e.target);

          if (isInsideDropdown || isInsideSearch) {
            return;
          }
        }

        if (!ticking) {
          window.requestAnimationFrame(() => {
            updatePosition();
            ticking = false;
          });
          ticking = true;
        }
      };

      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  // Comparação flexível para lidar com string vs number
  const selectedOption = options.find(opt => String(opt.value) === String(value));

  const handleToggle = () => {
    setIsOpen(!isOpen);
    setSearchTerm('');
  };

  const handleSelect = (optionValue) => {
    console.log('🔄 CustomSelect - handleSelect chamado');
    console.log('   Valor selecionado:', optionValue, '(tipo:', typeof optionValue + ')');
    console.log('   Value atual:', value, '(tipo:', typeof value + ')');
    console.log('   onChange:', !!onChange);

    if (onChange && typeof onChange === 'function') {
      onChange(optionValue);
      console.log('   ✅ onChange executado com valor:', optionValue);
    } else {
      console.error('   ❌ onChange não é uma função válida!');
    }

    setIsOpen(false);
    setSearchTerm('');
  };

  const DropdownPortal = () => {
    if (!isOpen) return null;

    const dropdownStyle = {
      position: 'fixed',
      top: `${dropdownPosition.top}px`,
      left: `${dropdownPosition.left}px`,
      width: `${dropdownPosition.width}px`,
      background: 'white',
      border: '2px solid #10b981',
      borderTop: 'none',
      borderRadius: '0 0 8px 8px',
      maxHeight: '300px',
      overflowY: 'auto',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
      zIndex: 9999999,
      WebkitTransform: 'translateZ(0)',
      transform: 'translateZ(0)',
      willChange: 'transform',
      WebkitOverflowScrolling: 'touch'
    };

    return createPortal(
      <div
        ref={dropdownRef}
        className="custom-select-dropdown active"
        style={dropdownStyle}
      >
        <div
          ref={searchContainerRef}
          className="custom-select-search"
          style={{
            padding: '8px',
            borderBottom: '1px solid #e5e7eb',
            position: 'sticky',
            top: 0,
            background: 'white',
            zIndex: 1,
            flexShrink: 0
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            autoFocus={true}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              outline: 'none',
              WebkitAppearance: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.style.border = '1px solid #10b981'}
            onBlur={(e) => e.target.style.border = '1px solid #d1d5db'}
          />
        </div>

        <div className="custom-select-options">
          {filteredOptions.map((option, index) => (
            <div
              key={`${option.value}-${index}`}
              className={`custom-select-option ${String(option.value) === String(value) ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'background 0.15s',
                fontSize: '14px',
                color: String(option.value) === String(value) ? '#10b981' : '#374151',
                background: String(option.value) === String(value) ? '#e8f5e9' : 'transparent',
                fontWeight: String(option.value) === String(value) ? '600' : '400',
                borderBottom: '1px solid #f3f4f6'
              }}
              onMouseEnter={(e) => {
                if (String(option.value) !== String(value)) {
                  e.target.style.background = '#f3f4f6';
                }
              }}
              onMouseLeave={(e) => {
                if (String(option.value) !== String(value)) {
                  e.target.style.background = 'transparent';
                }
              }}
            >
              {option.label}
            </div>
          ))}
          {filteredOptions.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
              Nenhuma opção encontrada
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      <div
        ref={wrapperRef}
        className={`custom-select-wrapper ${isOpen ? 'active' : ''}`}
        style={{ 
          position: 'relative', 
          width: '100%'
        }}
      >
        <div
          ref={triggerRef}
          className={`custom-select-trigger ${isOpen ? 'active' : ''}`}
          onClick={handleToggle}
          style={{
            width: '100%',
            padding: '9px',
            border: `2px solid ${isOpen ? '#10b981' : '#d1d5db'}`,
            borderRadius: isOpen ? '8px 8px 0 0' : '8px',
            fontSize: '14px',
            background: 'white',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'all 0.2s',
            position: 'relative',
            zIndex: isOpen ? 10 : 1
          }}
        >
          <span style={{ color: selectedOption ? '#374151' : '#9ca3af' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <i
            className="fas fa-chevron-down"
            style={{
              transition: 'transform 0.2s',
              color: isOpen ? '#10b981' : '#9ca3af',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0)'
            }}
          ></i>
        </div>
      </div>

      <DropdownPortal />
    </>
  );
};

export default CustomSelect;