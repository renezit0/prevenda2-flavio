import { useState } from 'react';

const MAX_TOASTS = 3;

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const mostrarToast = (tipo, mensagem) => {
    const id = Date.now();

    setToasts(prev => {
      // Se já tem 3 toasts, remove o mais antigo
      let novosToasts = [...prev];
      if (novosToasts.length >= MAX_TOASTS) {
        const maisAntigo = novosToasts[0];
        removerToast(maisAntigo.id);
        novosToasts = novosToasts.slice(1);
      }

      return [...novosToasts, { id, tipo, mensagem, show: false }];
    });

    // Trigger animação de entrada
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, show: true } : t));
    }, 10);

    // Auto-remover após 3 segundos
    setTimeout(() => {
      removerToast(id);
    }, 3000);
  };

  const removerToast = (id) => {
    // Primeiro anima a saída (esconde)
    setToasts(prev => prev.map(t => t.id === id ? { ...t, show: false } : t));

    // Depois remove do array (após animação de 300ms)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  };

  return {
    toasts,
    mostrarToast,
    removerToast
  };
};
