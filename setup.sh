#!/bin/bash

echo "🔍 Detectando configuração do servidor PHP..."
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado!${NC}"
    echo ""
    echo "Instale o Node.js primeiro:"
    echo "brew install node"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) encontrado${NC}"
echo -e "${GREEN}✅ npm $(npm --version) encontrado${NC}"
echo ""

# Detectar porta do servidor PHP
echo "🔎 Procurando servidor PHP..."
PHP_PORT=""

# Verificar porta 8888 (MAMP)
if lsof -i :8888 | grep -q LISTEN; then
    PHP_PORT="8888"
    echo -e "${GREEN}✅ Servidor encontrado na porta 8888 (MAMP)${NC}"
fi

# Verificar porta 8000
if [ -z "$PHP_PORT" ] && lsof -i :8000 | grep -q LISTEN; then
    PHP_PORT="8000"
    echo -e "${GREEN}✅ Servidor encontrado na porta 8000${NC}"
fi

# Verificar porta 80
if [ -z "$PHP_PORT" ] && lsof -i :80 | grep -q LISTEN; then
    PHP_PORT="80"
    echo -e "${GREEN}✅ Servidor encontrado na porta 80${NC}"
fi

# Se não encontrou nenhum servidor
if [ -z "$PHP_PORT" ]; then
    echo -e "${RED}❌ Nenhum servidor PHP encontrado!${NC}"
    echo ""
    echo "Opções:"
    echo "1. Inicie o MAMP"
    echo "2. Ou rode: cd .. && php -S localhost:8000"
    echo ""
    read -p "Digite manualmente a porta do PHP (ou pressione Enter para 8888): " MANUAL_PORT
    PHP_PORT=${MANUAL_PORT:-8888}
fi

echo ""
echo -e "${YELLOW}📝 Configurando proxy para porta ${PHP_PORT}...${NC}"

# Atualizar setupProxy.js
cat > src/setupProxy.js << EOF
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy para APIs e arquivos PHP
  app.use(
    ['/api', '/login.php', '/logout.php', '/check_session.php', '/assets'],
    createProxyMiddleware({
      target: 'http://localhost:${PHP_PORT}',
      changeOrigin: true,
      secure: false,
      timeout: 30000,
      proxyTimeout: 30000
    })
  );
};
EOF

echo -e "${GREEN}✅ Proxy configurado para porta ${PHP_PORT}${NC}"
echo ""

# Verificar se check_session.php existe
if [ ! -f "../check_session.php" ]; then
    echo -e "${YELLOW}⚠️  Arquivo check_session.php não encontrado${NC}"
    echo "Criando check_session.php..."

    cat > ../check_session.php << 'EOF'
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
EOF

    echo -e "${GREEN}✅ check_session.php criado${NC}"
else
    echo -e "${GREEN}✅ check_session.php já existe${NC}"
fi

echo ""
echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 Configuração concluída com sucesso!${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}Servidor PHP detectado na porta: ${PHP_PORT}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Para iniciar o projeto:"
    echo -e "${YELLOW}npm start${NC}"
    echo ""

    read -p "Deseja iniciar o servidor agora? (s/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        npm start
    fi
else
    echo ""
    echo -e "${RED}❌ Erro na instalação${NC}"
    exit 1
fi
