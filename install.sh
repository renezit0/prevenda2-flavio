#!/bin/bash

echo "🚀 Instalando seeLL - Consulta Global (React)"
echo "=============================================="
echo ""

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale o Node.js 16+ primeiro."
    echo "   Download: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) encontrado"
echo ""

# Verificar se o npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado. Por favor, instale o npm primeiro."
    exit 1
fi

echo "✅ npm $(npm --version) encontrado"
echo ""

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Instalação concluída com sucesso!"
    echo ""
    echo "📋 Próximos passos:"
    echo "   1. Certifique-se de que o backend PHP está rodando"
    echo "   2. Verifique se o arquivo check_session.php existe"
    echo "   3. Execute: npm start"
    echo ""
    echo "📖 Para mais informações, leia:"
    echo "   - README.md"
    echo "   - QUICKSTART.md"
    echo ""

    # Perguntar se deseja iniciar o servidor
    read -p "Deseja iniciar o servidor de desenvolvimento agora? (s/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo ""
        echo "🚀 Iniciando servidor..."
        npm start
    fi
else
    echo ""
    echo "❌ Erro na instalação. Por favor, verifique os erros acima."
    exit 1
fi
