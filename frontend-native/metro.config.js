const http = require('node:http');
const https = require('node:https');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const enhanceMiddleware = config.server.enhanceMiddleware;

config.server.enhanceMiddleware = (middleware, metroServer) => {
  const expoMiddleware = enhanceMiddleware ? enhanceMiddleware(middleware, metroServer) : middleware;
  return (request, response, next) => {
    if (!request.url?.startsWith('/api')) return expoMiddleware(request, response, next);

    const target = new URL(request.url, process.env.EXPO_API_PROXY_TARGET || 'http://localhost:3000');
    const transport = target.protocol === 'https:' ? https : http;
    const proxy = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: request.method,
      path: `${target.pathname}${target.search}`,
      headers: { ...request.headers, host: target.host },
    }, proxyResponse => {
      response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
      proxyResponse.pipe(response);
    });
    proxy.on('error', () => {
      if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: 'Không thể kết nối Backend.' }));
    });
    request.pipe(proxy);
  };
};

module.exports = config;
