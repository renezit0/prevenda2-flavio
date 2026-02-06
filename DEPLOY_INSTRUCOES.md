# 🚀 Instruções de Deploy - consulta.seellbr.com

## ✅ Arquivos Criados

1. **`nginx-consulta.conf`** - Configuração Nginx pronta
2. **`deploy-seellbr.sh`** - Script automático de deploy

---

## 📋 Pré-requisitos

- [ ] DNS `consulta.seellbr.com` apontando para o IP da VPS
- [ ] Acesso SSH à VPS
- [ ] VPS já tem Nginx instalado (como você tem api.seellbr.com)

---

## 🚀 Deploy (2 opções)

### Opção 1: Deploy Automático (Recomendado)

```bash
cd consulta-react

# 1. Editar o IP da VPS no script
nano deploy-seellbr.sh
# Linha 15: Altere "SEU_IP_VPS" para o IP real

# 2. Executar deploy
./deploy-seellbr.sh
```

O script faz **TUDO** automaticamente:
- ✅ Build do React
- ✅ Envia para VPS
- ✅ Instala config Nginx em `/etc/nginx/conf.d/`
- ✅ Testa config
- ✅ Recarrega Nginx

---

### Opção 2: Deploy Manual

#### Passo 1: No seu Mac

```bash
cd consulta-react

# Build
npm run build

# Comprimir
tar -czf build.tar.gz build/

# Enviar arquivos
scp build.tar.gz root@SEU_IP_VPS:/tmp/
scp nginx-consulta.conf root@SEU_IP_VPS:/tmp/
```

#### Passo 2: Na VPS

```bash
ssh root@SEU_IP_VPS

# Criar diretório
mkdir -p /var/www/consulta-react

# Extrair build
cd /var/www/consulta-react
tar -xzf /tmp/build.tar.gz --strip-components=1

# Ajustar permissões
chown -R www-data:www-data /var/www/consulta-react
chmod -R 755 /var/www/consulta-react

# Instalar config Nginx
cp /tmp/nginx-consulta.conf /etc/nginx/conf.d/consulta.conf

# Testar config
nginx -t

# Se OK, recarregar Nginx
systemctl reload nginx

# Limpar
rm /tmp/build.tar.gz /tmp/nginx-consulta.conf
```

---

## 🔐 Instalar SSL (HTTPS) - OBRIGATÓRIO

```bash
# Na VPS
ssh root@SEU_IP_VPS

# Instalar Certbot (se não tiver)
apt install certbot python3-certbot-nginx -y

# Obter certificado SSL
certbot --nginx -d consulta.seellbr.com

# Responder:
# - Email: seu-email@seellbr.com
# - Concordar com termos: Yes
# - Compartilhar email: No
# - Redirect HTTP para HTTPS: 2 (Yes)
```

**Certbot vai editar automaticamente `/etc/nginx/conf.d/consulta.conf` e adicionar SSL!**

---

## 🌐 Estrutura na VPS

```
/etc/nginx/conf.d/
├── api.conf                    # Config da API (já existe)
└── consulta.conf               # Config nova (React)

/var/www/
├── api/                        # API existente
└── consulta-react/             # React novo
    ├── index.html
    ├── static/
    │   ├── css/
    │   └── js/
    └── ...
```

---

## ✅ Verificar Deploy

### 1. Testar HTTP (antes do SSL):
```bash
curl http://consulta.seellbr.com
# Deve retornar HTML do React
```

### 2. Testar HTTPS (depois do SSL):
```bash
curl https://consulta.seellbr.com
# Deve retornar HTML do React
```

### 3. Abrir no navegador:
- `https://consulta.seellbr.com`

---

## 🔄 Atualizações Futuras

Sempre que fizer mudanças no React:

```bash
cd consulta-react

# Deploy automático
./deploy-seellbr.sh

# Ou manual:
npm run build
scp -r build/* root@SEU_IP_VPS:/var/www/consulta-react/
```

**Não precisa reconfigurar Nginx!** Só na primeira vez.

---

## 📱 Atualizar Apps com URL Pública

### Desktop

Edite `consulta-desktop/main.js` linha 27:
```javascript
const appUrl = 'https://consulta.seellbr.com';
```

Build:
```bash
cd consulta-desktop
npm run build:win
```

### Mobile

Edite `consulta-ios/App.js` linha 12:
```javascript
const APP_URL = 'https://consulta.seellbr.com';
```

Build:
```bash
cd consulta-ios
npm run build:ios
npm run build:android
```

---

## 🐛 Troubleshooting

### Config não carrega:

```bash
# Ver configs carregadas
ls -la /etc/nginx/conf.d/

# Ver conteúdo
cat /etc/nginx/conf.d/consulta.conf

# Testar config
nginx -t
```

### Erro 404:

```bash
# Verificar arquivos
ls -la /var/www/consulta-react/

# Deve ter index.html na raiz
```

### Erro 502 Bad Gateway:

```bash
# Ver logs
tail -f /var/log/nginx/consulta-error.log
```

### Permissões:

```bash
# Corrigir permissões
chown -R www-data:www-data /var/www/consulta-react
chmod -R 755 /var/www/consulta-react
```

### CORS errors:

A config Nginx já tem CORS configurado para `/api/`.
Se precisar de mais ajustes, edite `/etc/nginx/conf.d/consulta.conf`.

---

## 📊 Comandos Úteis

```bash
# Status Nginx
systemctl status nginx

# Recarregar Nginx
systemctl reload nginx

# Reiniciar Nginx
systemctl restart nginx

# Ver logs em tempo real
tail -f /var/log/nginx/consulta-access.log
tail -f /var/log/nginx/consulta-error.log

# Testar config
nginx -t

# Ver certificados SSL
certbot certificates
```

---

## ✨ Pronto!

Sua aplicação React estará rodando em:
**`https://consulta.seellbr.com`** 🚀

E seus apps Desktop/Mobile acessarão essa URL!
