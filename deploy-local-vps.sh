#!/bin/bash

# Script de Deploy LOCAL - Executar dentro da VPS
# Para quando você já está SSH na VPS

set -e

echo "🚀 Deploy Local - seeLL Consulta"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DEPLOY_PATH="/var/www/consulta-react"

echo -e "${YELLOW}📦 Fazendo backup do deploy anterior...${NC}"
if [ -d "$DEPLOY_PATH" ]; then
    BACKUP_NAME="consulta-react_backup_$(date +%Y%m%d_%H%M%S)"
    mv $DEPLOY_PATH /var/www/$BACKUP_NAME
    echo -e "${GREEN}✅ Backup salvo em: /var/www/$BACKUP_NAME${NC}"
fi

echo -e "${YELLOW}📁 Criando diretório...${NC}"
mkdir -p $DEPLOY_PATH

echo -e "${YELLOW}📦 Copiando build...${NC}"
cp -r build/* $DEPLOY_PATH/

echo -e "${YELLOW}🔧 Ajustando permissões...${NC}"
chown -R www-data:www-data $DEPLOY_PATH
chmod -R 755 $DEPLOY_PATH

echo -e "${YELLOW}📝 Instalando config Nginx...${NC}"
if [ -f "nginx-consulta.conf" ]; then
    cp nginx-consulta.conf /etc/nginx/conf.d/consulta.conf
    echo -e "${GREEN}✅ Config instalada em: /etc/nginx/conf.d/consulta.conf${NC}"
fi

echo -e "${YELLOW}🔍 Testando config Nginx...${NC}"
if nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✅ Config OK!${NC}"
else
    echo -e "${RED}❌ Erro na config Nginx:${NC}"
    nginx -t
    exit 1
fi

echo -e "${YELLOW}🔄 Recarregando Nginx...${NC}"
if systemctl reload nginx; then
    echo -e "${GREEN}✅ Nginx recarregado!${NC}"
else
    echo -e "${RED}❌ Erro ao recarregar Nginx${NC}"
    systemctl status nginx
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Deploy concluído com sucesso!${NC}"
echo -e "${GREEN}🌐 Acessível em: https://consulta.seellbr.com${NC}"
