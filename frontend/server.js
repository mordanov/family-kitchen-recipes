const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const app = express();

const BACKEND_ORIGINS = process.env.BACKEND_ORIGIN
  ? [process.env.BACKEND_ORIGIN]
  : ['http://recipes-backend:8000', 'http://backend:8000'];

function sendProxyRequest(req, res, origin, onError) {
  const target = new URL(req.originalUrl, origin);
  const transport = target.protocol === 'https:' ? https : http;

  const proxyReq = transport.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers: {
        ...req.headers,
        host: target.host,
      },
    },
    (proxyRes) => {
      res.status(proxyRes.statusCode || 502);
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (value !== undefined) {
          res.setHeader(key, value);
        }
      });
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (error) => {
    if (!res.headersSent) {
      res.status(502).json({ detail: `Backend proxy error: ${error.message}` });
      return;
    }
    res.end();
  });

  req.pipe(proxyReq);
}

function proxyToBackend(req, res) {
  let originIndex = 0;

  const tryNextOrigin = (lastError) => {
    if (originIndex >= BACKEND_ORIGINS.length) {
      if (!res.headersSent) {
        res.status(502).json({ detail: `Backend proxy error: ${lastError.message}` });
      } else {
        res.end();
      }
      return;
    }

    const origin = BACKEND_ORIGINS[originIndex++];
    sendProxyRequest(req, res, origin, (error) => {
      if (error && error.code === 'ENOTFOUND') {
        tryNextOrigin(error);
        return;
      }

      if (!res.headersSent) {
        res.status(502).json({ detail: `Backend proxy error: ${error.message}` });
      } else {
        res.end();
      }
    });
  };

  tryNextOrigin(new Error('No backend origin available'));
}

// Forward API and uploaded static files to backend instead of SPA fallback.
app.use(['/api', '/uploads', '/documents'], proxyToBackend);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => console.log('Frontend running on port 3000'));
