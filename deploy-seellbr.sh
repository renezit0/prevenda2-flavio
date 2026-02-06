#!/bin/bash

# Script de Deploy - seeLL Consulta para consulta.seellbr.com
# VPS que já tem api.seellbr.com rodando

set -e

echo "🚀 Deploy seeLL Consulta para consulta.seellbr.com"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações (ALTERE AQUI SE NECESSÁRIO)
SERVER="root@SEU_IP_VPS"  # Altere para o IP da sua VPS
REMOTE_PATH="/var/www/consulta-react"
DOMAIN="consulta.seellbr.com"

echo -e "${BLUE}📋 Configurações:${NC}"
echo -e "  Servidor: $SERVER"
echo -e "  Caminho: $REMOTE_PATH"
echo -e "  Domínio: $DOMAIN"
echo ""

# Confirmar
read -p "Confirma o deploy? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Deploy cancelado${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm ci

echo -e "${YELLOW}🔨 Fazendo build de produção...${NC}"
npm run build

if [ ! -d "build" ]; then
    echo -e "${RED}❌ Erro: pasta build não foi criada!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build concluído!${NC}"

echo -e "${YELLOW}📤 Compactando build...${NC}"
tar -czf build.tar.gz build/

echo -e "${YELLOW}🚚 Enviando para servidor $SERVER...${NC}"
scp build.tar.gz $SERVER:/tmp/

echo -e "${YELLOW}📤 Enviando config Nginx...${NC}"
scp nginx-consulta.conf $SERVER:/tmp/

echo -e "${YELLOW}📥 Instalando no servidor...${NC}"
ssh $SERVER << 'ENDSSH'
    set -e

    echo "📦 Criando backup do deploy anterior..."
    if [ -d "/var/www/consulta-react" ]; then
        BACKUP_NAME="consulta-react_backup_$(date +%Y%m%d_%H%M%S)"
        mv /var/www/consulta-react /var/www/$BACKUP_NAME
        echo "   Backup salvo em: /var/www/$BACKUP_NAME"
    fi

    echo "📁 Criando diretório..."
    mkdir -p /var/www/consulta-react

    echo "📦 Descompactando..."
    cd /var/www/consulta-react
    tar -xzf /tmp/build.tar.gz --strip-components=1

    echo "🔧 Ajustando permissões..."
    chown -R www-data:www-data /var/www/consulta-react
    chmod -R 755 /var/www/consulta-react

    echo "📝 Instalando config Nginx..."
    if [ -f "/tmp/nginx-consulta.conf" ]; then
        cp /tmp/nginx-consulta.conf /etc/nginx/conf.d/consulta.conf
        echo "   Config instalada em: /etc/nginx/conf.d/consulta.conf"
    fi

    echo "🧹 Limpando arquivos temporários..."
    rm /tmp/build.tar.gz
    rm -f /tmp/nginx-consulta.conf

    echo "🔍 Testando config Nginx..."
    if nginx -t 2>&1 | grep -q "successful"; then
        echo "✅ Config OK!"
    else
        echo "⚠️  Erro na config Nginx:"
        nginx -t
        exit 1
    fi

    echo "🔄 Recarregando Nginx..."
    if systemctl reload nginx; then
        echo "✅ Nginx recarregado com sucesso!"
    else
        echo "⚠️  Erro ao recarregar Nginx"
        systemctl status nginx
        exit 1
    fi

    echo ""
    echo "✅ Deploy concluído no servidor!"
ENDSSH

# Limpar local
rm build.tar.gz

echo ""
echo -e "${GREEN}🎉 Deploy concluído com sucesso!${NC}"
echo -e "${GREEN}🌐 Acessível em: https://$DOMAIN${NC}"
echo ""

# Testar URL
echo -e "${YELLOW}🔍 Testando conectividade...${NC}"
sleep 2

if curl -s --head https://$DOMAIN | grep "200 OK" > /dev/null; then
    echo -e "${GREEN}✅ Site respondendo corretamente!${NC}"
else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN)
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Site respondendo (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${YELLOW}⚠️  Site retornou HTTP $HTTP_CODE${NC}"
        echo -e "${YELLOW}   Aguarde alguns segundos e teste manualmente${NC}"
    fi
fi

echo ""
echo -e "${BLUE}📱 Próximos passos:${NC}"
echo -e "  1. Acesse: ${GREEN}https://$DOMAIN${NC}"
echo -e "  2. Atualize apps Desktop/Mobile com a URL pública"
echo -e "  3. Teste todas as funcionalidades"
echo ""
