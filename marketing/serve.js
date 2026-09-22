// Tiny static server for previewing the demo HTML files locally.
const http = require('http');
const fs = require('fs');
const path = require('path');
const port = 8091;
http.createServer((rq, rs) => {
  let f = rq.url.split('?')[0];
  if (f === '/') f = '/unified-demo.html';
  try {
    const d = fs.readFileSync(path.join(__dirname, f));
    const ext = path.extname(f);
    const type = ext === '.html' ? 'text/html' : 'application/octet-stream';
    rs.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    rs.end(d);
  } catch (e) {
    rs.writeHead(404);
    rs.end('not found');
  }
}).listen(port, () => console.log('serving marketing demos on http://localhost:' + port));
