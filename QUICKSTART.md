# 🚀 Guia de Início Rápido

## Passos para rodar o projeto

### 1. Instalar dependências

```bash
cd consulta-react
npm install
```

### 2. Iniciar o servidor de desenvolvimento

```bash
npm start
```

O projeto abrirá automaticamente em `http://localhost:3000`

### 3. Fazer login

Use as mesmas credenciais do sistema PHP existente:
- **Usuário**: Seu CPF ou login
- **Senha**: Sua senha do sistema

## ⚠️ Importante

### Backend PHP necessário

O projeto React precisa que o backend PHP esteja rodando. Certifique-se de que:

1. O servidor PHP está ativo (Apache/Nginx)
2. O arquivo `check_session.php` foi criado na raiz do projeto PHP
3. Os endpoints da API estão acessíveis

### Estrutura esperada do backend

```
/seu-projeto-php/
├── login.php              ✅ (já existe)
├── logout.php             ✅ (já existe)
├── check_session.php      ⚠️ (criar se não existir)
├── api/
│   ├── callfarma_query.php  ✅ (já existe)
│   └── buscar_produto.php   ✅ (já existe)
```

### Criar check_session.php

Se o arquivo não existir, copie o conteúdo abaixo para `/check_session.php`:

```php
<?php
require_once 'core/config.php';

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

## 🎮 Testando as funcionalidades

### Consulta de Preço (F9)
1. Pressione F9 ou clique em "Consultar Preço"
2. Digite um código de produto ou use `*nome` para buscar por nome
3. Veja o resultado com preços, imagem e endereço

### Consulta de Estoque (F6)
1. Pressione F6 ou clique em "Consultar Estoque"
2. Digite um código de produto
3. Veja o estoque em todas as filiais

### Histórico (SHIFT+F5)
1. Pressione SHIFT+F5 ou clique em "Histórico"
2. Preencha código do produto e datas
3. Veja as movimentações

## 🐛 Problemas comuns

### "Erro ao conectar com o servidor"
- Verifique se o backend PHP está rodando
- Verifique se não há erros no console do navegador (F12)

### "Sessão não persiste"
- Limpe os cookies do navegador
- Verifique se o PHP está com sessões habilitadas

### "CORS error"
- O projeto usa proxy automaticamente em desenvolvimento
- Se ainda houver erro, verifique se o setupProxy.js está correto

## 📦 Build para produção

Quando estiver pronto para deploy:

```bash
npm run build
```

Os arquivos otimizados estarão em `build/`

## 💡 Dicas

- Use o console do navegador (F12) para debug
- Todos os atalhos de teclado funcionam igual ao sistema original
- As janelas podem ser arrastadas e maximizadas
- No mobile, as janelas ocupam tela inteira automaticamente

## 📞 Suporte

Se encontrar problemas, verifique:
1. Console do navegador (erros JavaScript)
2. Console do terminal (erros do React)
3. Logs do PHP (erros do backend)
