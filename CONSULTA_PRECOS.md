# Consulta de Preço de Produtos (lógica + CSS)

Este documento descreve a lógica da tela de **Consulta de Preço** e **todos os estilos** usados na “telinha” de consulta de preços, incluindo CSS global e estilos inline reais do JSX.

## Visão geral do fluxo

1. A tela “Consultar Preço” é aberta a partir do **desktop de janelas** do `ConsultaGlobal`.
2. O usuário digita um código (barras/interno) ou um nome de produto (com `*` no início) e envia.
3. A consulta é feita via `produtoService` (queries SQL em `queryService` + endpoint PHP para imagem).
4. O resultado é renderizado com detalhes de preço, imagem, endereço, badges e promoção.
5. Atalho `F6` abre a janela de Estoque com o último produto consultado.

Arquivos principais:
- `src/components/ConsultaGlobal.jsx`
- `src/components/windows/WindowPreco.jsx`
- `src/services/api.js`
- `src/styles/ConsultaGlobal.css`

---

## Abertura da janela de consulta de preço

Arquivo: `src/components/ConsultaGlobal.jsx`

- A janela é aberta por **atalho** `F5` ou pelo card “Consultar Preço” na Home.
- O estado `activeWindows` controla quais janelas estão visíveis.
- O `WindowPreco` é renderizado quando `activeWindows` inclui `preco`.

Pontos chave:
- `openWindow('preco')` ativa a janela e coloca ela em primeiro plano.
- `onProductConsulted` salva o último produto consultado para ser usado no `F6`.
- `onOpenEstoque` abre a janela de Estoque já com o código e em modo `readOnly`.

---

## Lógica principal da consulta de preço

Arquivo: `src/components/windows/WindowPreco.jsx`

### 1) Estados usados

- `codigo`: valor digitado no input.
- `resultado`: objeto com produto + detalhes + imagem.
- `carregando`: indicador de loading.
- `erro`: mensagem de erro.
- `sugestoes`: sugestões de produto para busca por nome.
- `mostrarSugestoes`: controla o dropdown.
- `lastCdprodu`: último produto consultado (usado no `F6`).

### 2) Fluxos de entrada

- **Busca por nome via `*`**
  - Se o input começa com `*`, o texto após `*` dispara `buscarPorNome()` quando tiver pelo menos 2 caracteres.

- **Busca por nome sem `*`**
  - Se o input **não** for só números e tiver pelo menos 3 caracteres, exibe um “hint” dizendo para pressionar `Enter`.
  - Ao pressionar `Enter`, chama `buscarPorNome(valor)`.

- **Busca por código**
  - Se for somente números, `Enter` chama `handleSubmit()` que chama `handleBuscarPreco()`.

### 3) Buscar preço (fluxo principal)

`handleBuscarPreco()`:

1. Valida o código (não vazio e não começando com `*`).
2. Limpa erro e resultado, ativa `carregando`.
3. Chama `produtoService.buscarPreco(cod, filial)` para obter:
   - Produto (nome, grupo, tipo, PBM etc.).
   - Detalhes de preço/estoque (preço por, máximo, kit e endereço).
4. Em seguida busca a **imagem** via `produtoService.buscarPorCodigo(data.cdprodu)`.
   - Se não tiver imagem, usa placeholder.
5. Atualiza `resultado` e armazena o código em `lastCdprodu`.

### 4) Atalho F6

- Listener global de `keydown` detecta `F6`.
- Se existir `lastCdprodu`, chama `onOpenEstoque(lastCdprodu)`.
- Isso abre a janela de estoque com auto-search e modo `readOnly`.

---

## Serviço e queries de dados

Arquivo: `src/services/api.js`

### `produtoService.buscarPorNome(nome, filial)`

Executa query SQL via `queryService.execute()`:
- `sceprodu` + `sceestoq` (com LEFT JOIN).
- Filtra por `p.NOME LIKE '%nome%'` e `p.FGATIVO = 'S'`.
- Ordena por estoque desc e nome.
- Limite 50.

Retorno usado para:
- Mostrar sugestão com **estoque**, **endereço**, **preço** e **PBM**.

### `produtoService.buscarPreco(codigo, filial)`

Consulta em duas etapas:

1. **Produto**
   - Busca por `CDPRODU` ou códigos de barras `BARRA`/`BAR1..BAR4`.
   - Se não encontra, lança erro `Produto não encontrado`.

2. **Detalhes de estoque/preço**
   - Busca em `sceestoq` por `CDPRODU` e `CDFIL`.
   - Preenche:
     - `precoMax`
     - `precoPor` (fallback para `precoMax`)
     - `endereco`
     - `kitQtd` e `precoKit`

### `produtoService.buscarPorCodigo(codigo)`

- Faz GET para `/views/TODOS/buscar_produto.php?codigo=...`
- Se encontrar `imagem`, ela é usada no card do resultado.

---

## CSS e estilos reais da tela de Consulta de Preço

A tela de consulta usa:
1. **CSS global** em `src/styles/ConsultaGlobal.css`.
2. **Estilos inline** diretamente no JSX do `WindowPreco`.

Abaixo estão os estilos exatos.

### 1) CSS global (ConsultaGlobal.css)

Arquivo: `src/styles/ConsultaGlobal.css`

```css
/* Desktop */
.windows-desktop-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 900;
}

/* Windows */
.consulta-window {
  position: fixed;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: none;
  pointer-events: auto;
}

.consulta-window.active {
  display: block;
}

.consulta-window-header {
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
  color: #111827;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  cursor: move;
}

.consulta-window-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 16px;
  color: #111827;
}

.consulta-window-title i {
  color: #009bdd;
}

.consulta-window-controls {
  display: flex;
  gap: 8px;
}

.consulta-window-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.consulta-window-btn:hover {
  background: #e5e7eb;
  color: #111827;
}

.consulta-window-btn.closeb:hover {
  background: #ef4444;
  color: white;
}

.consulta-window-content {
  padding: 24px;
  max-height: calc(80vh - 60px);
  overflow-y: auto;
  overflow-x: visible;
  background: white;
  position: relative;
  z-index: 1;
}

/* Forms */
.consulta-form {
  margin-bottom: 20px;
}

.consulta-form-group {
  margin-bottom: 16px;
}

.consulta-form-group label {
  display: block;
  margin-bottom: 6px;
  color: #374151;
  font-weight: 600;
  font-size: 14px;
}

.consulta-form-group input,
.consulta-form-group select {
  width: 100%;
  padding: 12px;
  border: 2px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.consulta-form-group input {
  autocomplete: off;
}

.consulta-form-group input:-webkit-autofill,
.consulta-form-group input:-webkit-autofill:hover,
.consulta-form-group input:-webkit-autofill:focus,
.consulta-form-group input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 30px white inset !important;
  box-shadow: 0 0 0 30px white inset !important;
}

.consulta-form-group input:focus,
.consulta-form-group select:focus {
  outline: none;
  border-color: #009bdd;
  box-shadow: 0 0 0 3px rgba(255, 212, 0, 0.1);
}

.consulta-btn-submit {
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.consulta-btn-submit:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.consulta-btn-submit:disabled {
  background: #d1d5db;
  cursor: not-allowed;
  transform: none;
}

/* Loading & Error */
.consulta-loading {
  text-align: center;
  padding: 40px;
  color: #6b7280;
  font-size: 16px;
}

.consulta-error {
  background: #fee2e2;
  color: #991b1b;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #ef4444;
  margin: 16px 0;
}
```

### 2) Estilos inline do `WindowPreco`

Arquivo: `src/components/windows/WindowPreco.jsx`

#### Campo e hint abaixo do input

```jsx
<div style={{ position: 'relative' }}>
  <div style={{ display: 'flex', gap: '10px' }}>
    <input ... style={{ flex: 1 }} />
    <button type="submit" className="consulta-btn-submit" style={{ width: '100px', height: '46px' }}>
      <i className="fas fa-search"></i>
    </button>
  </div>
  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
    💡 Use <strong>*</strong> antes do nome para buscar produtos.
  </div>
</div>
```

#### Dropdown de sugestões

```jsx
<div
  className="preco-dropdown-sugestoes"
  style={{
    display: 'block',
    position: 'fixed',
    top: `${dropdownPos.top}px`,
    left: `${dropdownPos.left}px`,
    width: `${dropdownPos.width}px`,
    background: 'white',
    border: '2px solid #10b981',
    borderTop: 'none',
    borderRadius: '0 0 8px 8px',
    maxHeight: '400px',
    overflowY: 'auto',
    zIndex: 50000,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
  }}
>
```

#### Item de sugestão

```jsx
<div
  style={{
    padding: '10px 12px',
    borderBottom: idx < sugestoes.length - 1 ? '1px solid #f3f4f6' : 'none',
    cursor: 'pointer',
    transition: 'background 0.2s'
  }}
  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
>
```

#### Container do resultado

```jsx
<div className="preco-resultado-container" style={{ marginTop: '20px' }}>
```

#### Card principal do produto

```jsx
<div style={{
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '24px',
  display: 'flex',
  gap: '20px',
  alignItems: 'flex-start'
}}>
```

#### Bloco da imagem

```jsx
<div style={{
  width: '120px',
  height: '120px',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'white'
}}>
```

#### Badges de grupo e tipo (inline)

```jsx
const baseStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '10px',
  fontWeight: '700',
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
  lineHeight: '1',
  color: 'white'
};

const baseStyleTipo = {
  display: 'inline-block',
  fontSize: '8px',
  fontWeight: '600',
  padding: '3px 6px',
  borderRadius: '4px',
  letterSpacing: '0.2px',
  textTransform: 'uppercase',
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
};
```

#### Linha “Código / Nome / Endereço”

```jsx
<div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
  Código: {resultado.cdprodu}
</div>
<div style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px', lineHeight: '1.2' }}>
  {resultado.produto.NOME}
</div>
<div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
  <i className="fas fa-map-marker-alt" style={{ color: '#3b82f6' }}></i>
  <strong>Endereço:</strong> {resultado.detalhes.endereco}
</div>
```

#### Box PBM

```jsx
<div style={{
  display: 'inline-block',
  fontSize: '13px',
  padding: '8px 12px',
  background: '#fef3c7',
  border: '1px solid #fde68a',
  borderRadius: '6px'
}}>
```

#### Cards de preço

```jsx
<div style={{ background: 'white', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
  <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>De:</div>
  <div style={{ fontSize: '18px', color: '#9ca3af', textDecoration: 'line-through' }}>{formatCurrency(resultado.detalhes.precoMax)}</div>
</div>

<div style={{ background: '#ecfdf5', padding: '12px 16px', borderRadius: '8px', border: '1px solid #10b981' }}>
  <div style={{ fontSize: '12px', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Por:</div>
  <div style={{ fontSize: '24px', color: '#059669', fontWeight: '800' }}>{formatCurrency(resultado.detalhes.precoPor)}</div>
</div>

<div style={{ background: '#fef3c7', padding: '12px 16px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
  <div style={{ fontSize: '12px', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
    <i className="fas fa-tags"></i> Leve {resultado.detalhes.kitQtd}+ Pague Menos
  </div>
  <div style={{ fontSize: '20px', color: '#92400e', fontWeight: '800' }}>{formatCurrency(resultado.detalhes.precoKit)}</div>
  <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>A partir da {resultado.detalhes.kitQtd}ª unidade</div>
</div>
```

#### Botão “Estoque (F6)”

```jsx
<button
  type="button"
  style={{
    padding: '10px 20px',
    background: 'white',
    color: '#3b82f6',
    border: '2px solid #3b82f6',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  }}
  onMouseOver={(e) => { e.target.style.background = '#3b82f6'; e.target.style.color = 'white'; }}
  onMouseOut={(e) => { e.target.style.background = 'white'; e.target.style.color = '#3b82f6'; }}
>
  <i className="fas fa-warehouse"></i> Estoque (F6)
</button>
```

---

## Onde editar

- Lógica de consulta e UI
  - `src/components/windows/WindowPreco.jsx`

- Queries/serviços
  - `src/services/api.js`

- Estilos globais da janela (base)
  - `src/styles/ConsultaGlobal.css`
