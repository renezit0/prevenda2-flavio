import { useState } from 'react';

export const useModal = () => {
  const [modalFeedback, setModalFeedback] = useState({
    show: false,
    tipo: 'info',
    titulo: '',
    mensagem: ''
  });

  const [modalConfirm, setModalConfirm] = useState({
    show: false,
    titulo: '',
    mensagem: '',
    onConfirm: null
  });

  const mostrarFeedback = (tipo, titulo, mensagem) => {
    setModalFeedback({ show: true, tipo, titulo, mensagem });
  };

  const fecharFeedback = () => {
    setModalFeedback({ show: false, tipo: 'info', titulo: '', mensagem: '' });
  };

  const mostrarConfirmacao = (titulo, mensagem, onConfirm) => {
    setModalConfirm({ show: true, titulo, mensagem, onConfirm });
  };

  const fecharConfirmacao = () => {
    setModalConfirm({ show: false, titulo: '', mensagem: '', onConfirm: null });
  };

  const confirmarAcao = () => {
    if (modalConfirm.onConfirm) {
      modalConfirm.onConfirm();
    }
    fecharConfirmacao();
  };

  return {
    modalFeedback,
    mostrarFeedback,
    fecharFeedback,
    modalConfirm,
    mostrarConfirmacao,
    fecharConfirmacao,
    confirmarAcao
  };
};
