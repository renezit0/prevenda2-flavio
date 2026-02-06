# seeLL - Consulta Global (React)

Sistema de Consulta Global desenvolvido em React, com autenticação via banco de dados e integração com API CallFarma.

## 🚀 Características

- ✅ Login com autenticação no banco de dados MySQL
- ✅ Interface moderna com janelas arrastáveis
- ✅ Consulta de preços com busca inteligente por nome
- ✅ Consulta de estoque multi-filial
- ✅ Histórico de movimentações
- ✅ Atalhos de teclado (F9, F6, SHIFT+F5)
- ✅ Design responsivo (mobile e desktop)
- ✅ Indicadores visuais de estoque
- ✅ Endereços de produtos nos resultados

## 📋 Pré-requisitos

- Node.js 16+ instalado
- npm ou yarn
- Servidor PHP com acesso ao banco de dados
- API CallFarma configurada

## 🔧 Instalação

### 1. Instalar dependências

```bash
cd consulta-react
npm install
```

### 2. Configurar integração com backend

O projeto está configurado para usar o mesmo backend PHP existente. Certifique-se de que os seguintes endpoints estão disponíveis:

- `POST /login.php` - Autenticação de usuários
- `POST /logout.php` - Logout
- `GET /check_session.php` - Verificar sessão ativa
- `POST /api/callfarma_query.php` - Executar queries
- `GET /api/buscar_produto.php` - Buscar imagens de produtos

### 3. Criar arquivo check_session.php (se não existir)

Crie o arquivo `/check_session.php` na raiz do projeto PHP:

```php
<?php
session_start();

header('Content-Type: application/json');

if (isset($_SESSION['usuario_id'])) {
    echo json_encode([
        'autenticado' => true,
        'usuario' => [
            'nome' => $_SESSION['nome_usuario'],
            'tipo' => $_SESSION['tipo_usuario'],
            'loja_id' => $_SESSION['loja_id']
        ]
    ]);
} else {
    echo json_encode(['autenticado' => false]);
}
```

## 🎮 Executar em Desenvolvimento

```bash
npm start
```

A aplicação abrirá em `http://localhost:3000`

## 🏗️ Build para Produção

```bash
npm run build
```

Os arquivos otimizados serão gerados na pasta `build/`

## 📦 Deploy

### Opção 1: Integrar com servidor PHP existente

1. Execute o build:
```bash
npm run build
```

2. Copie o conteúdo da pasta `build/` para uma pasta no servidor PHP:
```bash
cp -r build/* /caminho/do/servidor/consulta-react-app/
```

3. Configure o servidor para servir os arquivos estáticos

### Opção 2: Servidor separado (Nginx/Apache)

Configure um proxy reverso para as APIs PHP enquanto serve o React em um domínio separado.

## ⌨️ Atalhos de Teclado

- **F9** - Abrir Consulta de Preço
- **F6** - Abrir Consulta de Estoque
- **SHIFT + F5** - Abrir Histórico de Movimentações
- **ESC** - Fechar desktop de janelas

## 🎨 Funcionalidades

### Login
- Autenticação com usuário/CPF e senha
- Opção "Lembrar-me" com tokens
- Integração com sistema de permissões existente

### Consulta de Preço
- Busca por código de barras ou código interno
- Busca inteligente por nome (com `*` ou Enter)
- Dropdown com sugestões e indicadores de estoque
- Exibição de endereço do produto
- Badges de categoria e tipo
- Preços promocionais e kits

### Consulta de Estoque
- Visualização de estoque em todas as filiais
- Endereços dos produtos por filial
- Indicadores visuais (verde/vermelho)

### Histórico
- Filtro por produto, data inicial e final
- Pré-seleção da loja do usuário logado
- Listagem de movimentações

## 🛠️ Estrutura do Projeto

```
consulta-react/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── windows/
│   │   │   ├── DraggableWindow.jsx    # Componente base para janelas
│   │   │   ├── WindowPreco.jsx         # Janela de consulta de preço
│   │   │   ├── WindowEstoque.jsx       # Janela de estoque
│   │   │   ├── WindowHistorico.jsx     # Janela de histórico
│   │   │   ├── WindowTransito.jsx      # Janela de trânsito
│   │   │   ├── WindowNotas.jsx         # Janela de notas
│   │   │   └── WindowCliente.jsx       # Janela de cliente
│   │   ├── ConsultaGlobal.jsx          # Componente principal
│   │   └── Login.jsx                   # Tela de login
│   ├── services/
│   │   └── api.js                      # Serviços de API
│   ├── styles/
│   │   ├── App.css
│   │   ├── ConsultaGlobal.css
│   │   ├── Login.css
│   │   └── index.css
│   ├── App.jsx
│   └── index.js
├── package.json
└── README.md
```

## 🔐 Segurança

- Sessões gerenciadas pelo backend PHP
- Tokens "lembrar-me" com expiração
- Validação de autenticação em cada requisição
- CORS configurado via withCredentials

## 🐛 Troubleshooting

### Erro de CORS
Se encontrar erros de CORS, adicione no seu servidor PHP:

```php
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
```

### Sessão não persiste
Certifique-se de que:
1. O PHP está configurado com `session.cookie_samesite = "Lax"`
2. As requisições usam `withCredentials: true`
3. O domínio do frontend e backend são compatíveis

### Imagens não carregam
Verifique se o endpoint `/api/buscar_produto.php` está retornando URLs válidas

## 📝 Notas Técnicas

- **React 18** com hooks modernos
- **Axios** para requisições HTTP
- **CSS puro** (sem bibliotecas de UI) para manter design original
- **Componentização modular** para fácil manutenção
- **Estado local** (sem Redux) para simplicidade

## 🎯 Próximas Melhorias

- [ ] Implementar WindowTransito completa
- [ ] Implementar WindowNotas completa
- [ ] Implementar WindowCliente completa
- [ ] Adicionar testes unitários
- [ ] Adicionar cache de queries
- [ ] PWA com service workers
- [ ] Dark mode

## 📄 Licença

Propriedade de seeLL - Sistema de Gestão

## 👥 Suporte

Para dúvidas e suporte, entre em contato com a equipe de desenvolvimento.
