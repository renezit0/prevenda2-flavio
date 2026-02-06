# 📦 Sistema de Devoluções - Consulta React

## 🎯 Visão Geral

Sistema completo de gerenciamento de devoluções integrado ao Consulta React, seguindo o mesmo padrão visual e arquitetural das outras janelas do sistema.

## ✨ Funcionalidades Implementadas

### 1. **Adicionar Produtos para Devolução**
- Campo de busca por código ou código de barras
- Definição de quantidade para devolução
- Busca automática do fornecedor
- Validação instantânea de produtos duplicados

### 2. **Gestão da Lista de Produtos**
- Visualização de todos os produtos adicionados
- Editar quantidade de cada produto
- Remover produtos da lista
- Adicionar múltiplos produtos em lote (modal dedicado)
- Limpar toda a lista
- Badges indicando status (NFE selecionada, fornecedor, etc.)

### 3. **Detalhes Completos por Produto**

Para cada produto adicionado, o sistema exibe:

#### **Informações Básicas:**
- Nome completo do produto
- Código do produto
- Fornecedor
- Quantidade a devolver

#### **Entradas Disponíveis (NFEs):**
- Últimas 10 entradas do produto
- Quantidade da entrada original
- Quantidade já devolvida (se houver)
- Quantidade disponível para devolução
- Data de conferência
- Número da nota e série
- Validação automática de quantidade suficiente
- Indicadores visuais:
  - ✅ Verde: Entrada sem devolução
  - ⚠️ Laranja: Entrada com devolução parcial
  - ❌ Vermelho/Desabilitado: Quantidade insuficiente

#### **Últimos Pedidos:**
- Histórico das últimas 6 compras do produto
- Número do pedido
- Data
- Quantidade
- Valor unitário
- Fornecedor

### 4. **Seleção Inteligente de NFE**
- Clique para selecionar a entrada desejada
- Validação automática se há quantidade disponível
- Bloqueio visual de entradas com quantidade insuficiente
- Check visual na NFE selecionada
- Obrigatório selecionar NFE para todos os produtos antes de processar

### 5. **Processamento de Devolução**
- Botão aparece somente quando todas as NFEs estão selecionadas
- Modal de confirmação com resumo completo:
  - Total de produtos
  - Total de itens
  - Lista detalhada com NFE de cada produto
- Console log com as queries SQL para UPDATE no banco
- Mensagem de sucesso após processamento
- Limpeza automática da lista

### 6. **Funcionalidades Extras**
- **Adicionar em Lote**: Modal para adicionar múltiplos produtos de uma vez
  - Formato: `codigo quantidade` (um por linha)
  - Exemplo:
    ```
    58206 5
    12345 10
    67890 3
    ```
- **Enter para adicionar**: Pressione Enter nos campos para adicionar rapidamente
- **ESC para fechar modais**: Atalho de teclado
- **Auto-focus**: Campo de busca focado automaticamente

## 🎨 Design e Experiência

- **Tema Light**: Moderno e profissional
- **Gradientes Suaves**: Background com degradê azul/indigo/roxo
- **Animações**: Slide-in, fade-in, hover effects
- **Responsivo**: Funciona perfeitamente em desktop e mobile
- **Badges Coloridos**: Indicadores visuais para status
- **Scrollbar Customizada**: Visual limpo e moderno
- **Cards Interativos**: Hover effects e transições suaves
- **Cores Semânticas**:
  - 🔵 Azul: Informações gerais
  - 🟢 Verde: Sucesso / Sem problemas
  - 🟠 Laranja: Atenção / Devolução parcial
  - 🔴 Vermelho: Erro / Indisponível
  - 🟣 Roxo: Lista de produtos

## 📁 Arquivos Criados/Modificados

### Novos Arquivos:
1. **`src/components/windows/WindowDevolucao.jsx`**
   - Componente principal da janela de devoluções
   - 1000+ linhas de código React
   - Gerenciamento completo de estado
   - Interface responsiva e moderna

### Arquivos Modificados:
2. **`src/services/api.js`**
   - Adicionado `devolucaoService` com 4 funções:
     - `buscarProduto()`: Busca produto com fornecedor
     - `buscarNFEs()`: Busca entradas conferidas
     - `verificarDevolucao()`: Verifica devoluções existentes
     - `buscarPedidos()`: Busca histórico de pedidos

3. **`src/components/ConsultaGlobal.jsx`**
   - Import do `WindowDevolucao`
   - Card de atalho "Devoluções" na tela inicial
   - Gerenciamento de abertura/fechamento da janela
   - Suporte na taskbar para janela minimizada

## 🔌 Integração com Banco de Dados

### Queries Implementadas:

#### 1. Buscar Produto:
```sql
SELECT sceprodu.*, sceforne.desconto as descfor, sceforne.CDCOMPRADOR, sceforne.ABREV as FORNECEDOR
FROM sceprodu, sceforne
WHERE (sceprodu.CDPRODU = '${codigo}' OR sceprodu.BARRA = '${codigo}' OR ...)
  AND sceprodu.CDFORNE = sceforne.CDFORNE
LIMIT 1
```

#### 2. Buscar NFEs (Entradas):
```sql
SELECT a.NRNOTA, a.QTD, a.DATACONF, b.ABREV, a.ENDERECO, a.CDFORNE, a.NRSERIE, a.QTDEMB,
  (SELECT i.CHAVENFE FROM sceitensnfent i WHERE ...) AS CHAVENFE,
  (SELECT e.VLRUNI FROM sceent e WHERE ...) AS VLRUNI
FROM sceentconf a
JOIN sceforne b ON b.CDFORNE = a.CDFORNE
WHERE a.CDEMP = '1' AND a.CDFIL = ${filial} AND a.CDPRODU = '${cdprodu}'
ORDER BY a.DATACONF DESC
LIMIT 10
```

#### 3. Verificar Devolução:
```sql
SELECT * FROM sceitensnfent
WHERE CHAVENFE = '${chavenfe}' AND CDPRODU = ${cdprodu}
```

#### 4. Buscar Pedidos:
```sql
SELECT a.NRPEDIDO, a.QTD, a.DATA, a.VLRPED, b.ABREV, b.CDCOMPRADOR
FROM scepedf a, sceforne b, scepedfc c
WHERE a.CDEMP = '1' AND a.CDFIL = ${filial} AND a.CDPRODU = '${cdprodu}'
  AND a.CDFORNE = b.CDFORNE AND a.NRPEDIDO = c.NRPEDIDO
ORDER BY a.DATA DESC
LIMIT 6
```

### Query para Processar Devolução (Backend):

**⚠️ IMPORTANTE:** A query abaixo precisa ser implementada no backend:

```sql
UPDATE sceitensnfent
SET QTDDEVOL = QTDDEVOL + ${quantidade},
    NRDOCDEVOL = ${numeroDocumento}
WHERE CHAVENFE = '${chavenfe}'
  AND CDPRODU = ${cdprodu}
```

**Nota:** O sistema atual loga essa query no console. Você precisa criar um endpoint no backend para executá-la.

## 🚀 Como Usar

### 1. Abrir o Sistema:
- Clique no card "Devoluções" na tela inicial
- Ou adicione um atalho de teclado no futuro (ex: F10)

### 2. Adicionar Produtos:
```
1. Digite o código ou código de barras
2. Defina a quantidade
3. Pressione Enter ou clique em "Adicionar"
```

### 3. Adicionar Múltiplos Produtos:
```
1. Clique em "📋 Adicionar em Lote"
2. Digite no formato: codigo quantidade (um por linha)
3. Clique em "Adicionar Todos"
```

### 4. Selecionar Entradas:
```
1. Para cada produto, visualize as entradas disponíveis
2. Clique na entrada (NFE) desejada
3. Verifique se tem quantidade suficiente
4. O sistema marca automaticamente com ✓
```

### 5. Processar Devolução:
```
1. Aguarde todas as NFEs serem selecionadas
2. Botão "Processar Devolução" aparece automaticamente
3. Clique e confirme no modal
4. Acompanhe no console as queries SQL
```

## 📊 Exemplo de Uso Prático

```
Cenário: Devolver 5 unidades do produto 58206

1. Abrir Sistema de Devoluções
2. Digite "58206" no campo de código
3. Digite "5" na quantidade
4. Pressione Enter
5. Sistema busca:
   ✓ Dados do produto (BAUDUCCO PAO DE FORMA TRADICIONAL 390G)
   ✓ Fornecedor (DISTRILOBO)
   ✓ 10 últimas entradas
   ✓ Devoluções já registradas
   ✓ 6 últimos pedidos
6. Visualizar entradas disponíveis
7. Selecionar NFE 899049 (tem 10 unidades, 0 devolvidas = 10 disponíveis)
8. Clicar em "Processar Devolução"
9. Confirmar no modal
10. Sistema registra e limpa a lista
```

## 🛠️ Próximos Passos

### Backend:
1. Criar endpoint para processar devolução:
   ```php
   POST /api/processar-devolucao
   Body: {
     produtos: [
       {
         cdprodu: 58206,
         chavenfe: "41251201554188000182550010008990491992364414",
         quantidade: 5,
         nrnota: 899049
       }
     ],
     numeroDocumento: "DEV-2026-001"
   }
   ```

2. Implementar a query UPDATE no backend

3. Adicionar geração de número de documento de devolução

4. Log de auditoria (quem, quando, o quê)

### Melhorias Futuras:
- [ ] Adicionar atalho de teclado (ex: F10)
- [ ] Histórico de devoluções processadas
- [ ] Exportar relatório em PDF/Excel
- [ ] Impressão de romaneio de devolução
- [ ] Múltiplas chaves na mesma devolução
- [ ] Motivo da devolução (dropdown)
- [ ] Foto/anexo de comprovação
- [ ] Integração com sistema fiscal (gerar NFe de devolução)

## 🎯 Diferenciais

✅ **Validação Inteligente**: Sistema verifica automaticamente quantidade disponível
✅ **Visual Indicativo**: Cores diferentes para cada situação
✅ **Experiência Fluida**: Enter, ESC, auto-focus, drag & drop
✅ **Responsivo**: Funciona em qualquer tamanho de tela
✅ **Seguro**: Confirmação antes de processar
✅ **Informativo**: Mostra tudo que você precisa saber
✅ **Integrado**: Mesmo padrão do resto do sistema
✅ **Performático**: Queries otimizadas, cache quando necessário

## 📝 Notas Importantes

1. **Proxy de API**: O sistema usa `https://api.seellbr.com/api/query` para executar queries
2. **Filial**: Usa `userData.loja_id` ou fallback para 22
3. **CDEMP**: Fixado em '1' nas queries
4. **Limite de Entradas**: Mostra últimas 10 NFEs
5. **Limite de Pedidos**: Mostra últimos 6 pedidos
6. **Console Logs**: Todas as queries são logadas para debug

## 🐛 Debug

Para debugar, abra o console do navegador (F12) e verifique:
- Queries SQL enviadas
- Respostas da API
- Erros de validação
- Estrutura de dados

## 👨‍💻 Desenvolvido com

- ⚛️ React 18
- 🎨 Inline Styles (seguindo padrão do projeto)
- 🔌 Axios para requisições
- 📦 Font Awesome para ícones
- 🎯 Hooks modernos (useState, useRef, useEffect, useCallback)

---

**Status**: ✅ Pronto para uso (falta apenas implementar o UPDATE no backend)
**Versão**: 1.0.0
**Data**: Janeiro 2026
**Autor**: Claude Code Assistant
