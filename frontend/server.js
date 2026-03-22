const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const app = express();

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || 'http://backend:8000';

function proxyToBackend(req, res) {
  const target = new URL(req.originalUrl, BACKEND_ORIGIN);
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

// Forward API and uploaded static files to backend instead of SPA fallback.
app.use(['/api', '/uploads', '/documents'], proxyToBackend);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => console.log('Frontend running on port 3000'));
