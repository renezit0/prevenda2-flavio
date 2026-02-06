const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    ['/vendascall/api'],
    createProxyMiddleware({
      target: 'https://api.seellbr.com',
      changeOrigin: true,
      secure: true,
      timeout: 30000,
      proxyTimeout: 30000,
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('Origin', 'https://api.seellbr.com');
      }
    })
  );
};
