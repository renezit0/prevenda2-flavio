#!/bin/bash

# Script de Deploy - seeLL Consulta React
# Usage: ./deploy.sh [production|staging]

set -e  # Exit on error

ENV=${1:-production}

echo "🚀 Iniciando deploy para $ENV..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configurações
if [ "$ENV" = "production" ]; then
    SERVER="root@SEU_IP_VPS"
    REMOTE_PATH="/var/www/consulta-react"
    DOMAIN="consulta.seellbr.com"
elif [ "$ENV" = "staging" ]; then
    SERVER="root@SEU_IP_STAGING"
    REMOTE_PATH="/var/www/consulta-react-staging"
    DOMAIN="staging-consulta.seellbr.com"
else
    echo -e "${RED}❌ Ambiente inválido. Use: production ou staging${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm ci

echo -e "${YELLOW}🔨 Fazendo build de $ENV...${NC}"
if [ "$ENV" = "production" ]; then
    npm run build
else
    npm run build
fi

echo -e "${GREEN}✅ Build concluído!${NC}"

echo -e "${YELLOW}📤 Compactando build...${NC}"
tar -czf build.tar.gz build/

echo -e "${YELLOW}🚚 Enviando para servidor...${NC}"
scp build.tar.gz $SERVER:/tmp/

echo -e "${YELLOW}📥 Descompactando no servidor...${NC}"
ssh $SERVER << EOF
    set -e

    # Backup do deploy anterior
    if [ -d "$REMOTE_PATH" ]; then
        echo "📦 Criando backup..."
        mv $REMOTE_PATH ${REMOTE_PATH}_backup_\$(date +%Y%m%d_%H%M%S)
    fi

    # Criar diretório
    mkdir -p $REMOTE_PATH

    # Descomprimir
    cd $REMOTE_PATH
    tar -xzf /tmp/build.tar.gz --strip-components=1

    # Limpar
    rm /tmp/build.tar.gz

    # Recarregar Nginx
    systemctl reload nginx

    echo "✅ Deploy concluído!"
EOF

# Limpar local
rm build.tar.gz

echo -e "${GREEN}🎉 Deploy para $ENV concluído com sucesso!${NC}"
echo -e "${GREEN}🌐 Acessível em: https://$DOMAIN${NC}"

# Testar URL
echo -e "${YELLOW}🔍 Testando URL...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Site respondendo corretamente (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}⚠️  Site retornou HTTP $HTTP_CODE${NC}"
fi
