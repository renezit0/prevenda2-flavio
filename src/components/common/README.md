# 🎨 Componentes Compartilhados - Modais e Toasts

Sistema universal de feedback com modais e notificações toast reutilizáveis.

---

## 📦 Componentes Disponíveis

### 1. **Toast** - Notificações no canto superior direito
### 2. **ToastContainer** - Container para múltiplos toasts
### 3. **ModalFeedback** - Modal de feedback (sucesso/erro/aviso/info)
### 4. **ModalConfirm** - Modal de confirmação com dois botões

---

## 🔧 Hooks Customizados

### **useToast()** - Gerenciar toasts
### **useModal()** - Gerenciar modais de feedback e confirmação

---

## 📖 Como Usar

### Exemplo Completo em um Componente

```jsx
import React from 'react';
import { useToast } from '../../hooks/useToast';
import { useModal } from '../../hooks/useModal';
import ToastContainer from '../common/ToastContainer';
import ModalFeedback from '../common/ModalFeedback';
import ModalConfirm from '../common/ModalConfirm';

const MeuComponente = () => {
  // Hooks
  const { toasts, mostrarToast, removerToast } = useToast();
  const {
    modalFeedback,
    mostrarFeedback,
    fecharFeedback,
    modalConfirm,
    mostrarConfirmacao,
    confirmarAcao,
    fecharConfirmacao
  } = useModal();

  // Exemplos de uso
  const handleSucesso = () => {
    mostrarToast('sucesso', 'Operação realizada com sucesso!');
  };

  const handleErro = () => {
    mostrarFeedback('erro', 'Erro', 'Algo deu errado!');
  };

  const handleAviso = () => {
    mostrarFeedback('aviso', 'Atenção', 'Verifique os dados antes de continuar.');
  };

  const handleConfirmar = () => {
    mostrarConfirmacao(
      'Confirmar ação?',
      'Tem certeza que deseja realizar esta operação?',
      () => {
        console.log('Ação confirmada!');
        mostrarToast('sucesso', 'Ação executada!');
      }
    );
  };

  return (
    <div>
      <button onClick={handleSucesso}>Toast Sucesso</button>
      <button onClick={handleErro}>Modal Erro</button>
      <button onClick={handleAviso}>Modal Aviso</button>
      <button onClick={handleConfirmar}>Modal Confirmação</button>

      {/* Renderizar componentes */}
      <ToastContainer toasts={toasts} onRemove={removerToast} />

      <ModalFeedback
        show={modalFeedback.show}
        tipo={modalFeedback.tipo}
        titulo={modalFeedback.titulo}
        mensagem={modalFeedback.mensagem}
        onClose={fecharFeedback}
      />

      <ModalConfirm
        show={modalConfirm.show}
        titulo={modalConfirm.titulo}
        mensagem={modalConfirm.mensagem}
        onConfirm={confirmarAcao}
        onCancel={fecharConfirmacao}
      />
    </div>
  );
};

export default MeuComponente;
```

---

## 🎨 Tipos Disponíveis

### Para Toast e ModalFeedback:

- **`'sucesso'`** - Verde com ícone de check ✅
- **`'erro'`** - Vermelho com ícone X ❌
- **`'aviso'`** - Laranja com ícone de alerta ⚠️
- **`'info'`** - Azul com ícone de informação ℹ️

---

## 🚀 API dos Hooks

### **useToast()**

```javascript
const { toasts, mostrarToast, removerToast } = useToast();

// Mostrar toast
mostrarToast('sucesso', 'Mensagem aqui');

// Toasts auto-fecham após 3 segundos
// Podem ser fechados manualmente clicando no X
```

### **useModal()**

```javascript
const {
  modalFeedback,
  mostrarFeedback,
  fecharFeedback,
  modalConfirm,
  mostrarConfirmacao,
  confirmarAcao,
  fecharConfirmacao
} = useModal();

// Modal de Feedback
mostrarFeedback('erro', 'Título', 'Mensagem de erro');

// Modal de Confirmação
mostrarConfirmacao(
  'Título',
  'Mensagem',
  () => {
    // Callback executado quando confirmar
    console.log('Confirmado!');
  }
);
```

---

## 💡 Quando Usar Cada Um?

### 🍞 **Toast** (não bloqueia a tela)
- ✅ Confirmações rápidas de sucesso
- 📝 Salvamento automático
- 📋 Item copiado
- ➕ Item adicionado

### 🔲 **ModalFeedback** (bloqueia a tela)
- ❌ Erros que precisam de atenção
- ⚠️ Avisos importantes
- ℹ️ Informações que o usuário DEVE ler

### ❓ **ModalConfirm** (bloqueia a tela)
- 🗑️ Deletar/Remover itens
- 🔄 Ações irreversíveis
- 💾 Descartar alterações
- ⚡ Ações críticas

---

## 🎯 Características

### Toast:
- ✅ Auto-fecha após 3 segundos
- ✅ Pode ser fechado manualmente
- ✅ Suporta múltiplos toasts empilhados
- ✅ Animação suave de entrada/saída
- ✅ Não bloqueia a interação com a tela

### ModalFeedback:
- ✅ Bloqueia a tela até o usuário clicar em OK
- ✅ 4 tipos visuais diferentes
- ✅ Blur no fundo
- ✅ Click fora fecha o modal

### ModalConfirm:
- ✅ Dois botões: Cancelar e Confirmar
- ✅ Callback executado apenas se confirmar
- ✅ Ícone de pergunta laranja
- ✅ Bloqueia a tela até decisão

---

## 📁 Estrutura de Arquivos

```
src/
├── components/
│   └── common/
│       ├── Toast.jsx
│       ├── ToastContainer.jsx
│       ├── ModalFeedback.jsx
│       ├── ModalConfirm.jsx
│       └── README.md (este arquivo)
└── hooks/
    ├── useToast.js
    └── useModal.js
```

---

## 🎨 Customização

Todos os componentes usam inline styles, então você pode facilmente:

1. Alterar cores no arquivo do componente
2. Mudar duração do toast (atualmente 3s)
3. Ajustar animações
4. Modificar z-index se necessário

---

**Desenvolvido por:** Claude Code Assistant
**Data:** Janeiro 2026
**Versão:** 1.0.0
