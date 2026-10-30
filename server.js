const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT) || 8000;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  const filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== root) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    const target = pathname.endsWith('/') ? path.join(filePath, 'index.html') : filePath;
    const sendFile = (resolvedPath) => {
      fs.readFile(resolvedPath, (readError, content) => {
        if (readError) {
          response.writeHead(readError.code === 'ENOENT' ? 404 : 500);
          response.end(readError.code === 'ENOENT' ? 'Not found' : 'Internal server error');
          return;
        }

        response.writeHead(200, {
          'Content-Type': mimeTypes[path.extname(resolvedPath).toLowerCase()] || 'application/octet-stream',
        });
        response.end(request.method === 'HEAD' ? undefined : content);
      });
    };

    if (statError || !stats.isDirectory()) {
      sendFile(filePath);
      return;
    }

    sendFile(target);
  });
});

server.on('error', (error) => {
  console.error(`Unable to start the development server: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`QuickPOS is running at http://localhost:${port}`);
});
