# 🚀 Como Rodar o Projeto React - Guia Completo

## Passo 1: Verificar se o servidor PHP está rodando

Você precisa ter o servidor PHP (MAMP, XAMPP, ou outro) rodando.

### Opção A: Usando MAMP (mais comum no Mac)
1. Abra o MAMP
2. Clique em "Start Servers"
3. Anote a porta (geralmente 8888 ou 80)

### Opção B: Usando servidor PHP built-in
Se não tiver MAMP, pode iniciar um servidor PHP direto:

```bash
cd "/Users/macbook/Desenvolvimento/onev2 edit 29 dezembro"
php -S localhost:8000
```

Isso vai rodar na porta 8000.

---

## Passo 2: Configurar o proxy no React

Abra o arquivo: `consulta-react/src/setupProxy.js`

**Se estiver usando MAMP (porta 8888):**
```javascript
target: 'http://localhost:8888'
```

**Se estiver usando servidor PHP built-in (porta 8000):**
```javascript
target: 'http://localhost:8000'
```

**Se estiver usando Apache padrão (porta 80):**
```javascript
target: 'http://localhost'
```

---

## Passo 3: Instalar as dependências do React

```bash
cd "/Users/macbook/Desenvolvimento/onev2 edit 29 dezembro/consulta-react"
npm install
```

Isso vai baixar todas as bibliotecas necessárias (React, Axios, etc.)

---

## Passo 4: Iniciar o projeto React

```bash
npm start
```

O navegador vai abrir automaticamente em `http://localhost:3000`

---

## 🎯 Resumo Rápido (Cole no terminal):

```bash
# 1. Vá para a pasta do projeto React
cd "/Users/macbook/Desenvolvimento/onev2 edit 29 dezembro/consulta-react"

# 2. Instale as dependências (só precisa fazer 1 vez)
npm install

# 3. Inicie o servidor
npm start
```

---

## ❓ Problemas Comuns

### Erro: "EADDRINUSE: porta 3000 já está em uso"
Solução: Mate o processo na porta 3000
```bash
lsof -ti:3000 | xargs kill -9
npm start
```

### Erro: "command not found: npm"
Solução: Instale o Node.js
```bash
# Instale o Homebrew (se não tiver)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instale o Node.js
brew install node

# Verifique a instalação
node --version
npm --version
```

### Erro 504 (Gateway Timeout)
**Problema:** O React não consegue se conectar com o PHP

**Solução:**
1. Verifique se o servidor PHP está rodando
2. Verifique a porta no arquivo `setupProxy.js`
3. Teste manualmente acessando: `http://localhost:8888` (ou sua porta)

### Erro: "Cannot find module 'http-proxy-middleware'"
Solução:
```bash
npm install http-proxy-middleware --save
```

---

## 🔍 Como descobrir qual porta o PHP está usando?

### Método 1: Verificar portas abertas
```bash
lsof -i :8888
lsof -i :8000
lsof -i :80
```

### Método 2: Se estiver usando MAMP
- Abra o MAMP
- Clique em "Preferences"
- Vá em "Ports"
- Veja a "Apache Port" (geralmente 8888)

### Método 3: Teste manualmente
Tente abrir no navegador:
- `http://localhost:8888` (MAMP padrão)
- `http://localhost:8000` (PHP built-in)
- `http://localhost` (Apache padrão)

Se abrir a página do sistema PHP, essa é a porta correta!

---

## ✅ Checklist Final

Antes de rodar o React, confirme:

- [ ] Servidor PHP está rodando
- [ ] Você sabe qual é a porta (8888, 8000, 80, etc)
- [ ] O arquivo `setupProxy.js` tem a porta correta
- [ ] O arquivo `check_session.php` existe na raiz do projeto PHP
- [ ] Node.js e npm estão instalados (`node --version`)

---

## 🎉 Se Tudo Funcionou

Você verá:
1. Servidor React rodando em `http://localhost:3000`
2. Tela de login do sistema
3. Ao fazer login, entrará no sistema de Consulta Global

---

## 🆘 Precisa de Ajuda?

Se ainda tiver problemas, me envie:
1. Qual erro aparece no terminal
2. Qual erro aparece no console do navegador (F12)
3. Qual servidor PHP você está usando (MAMP, XAMPP, built-in)
