// 실제 production 빌드와 로컬 API를 같은 출처로 제공한다(Mock/외부 제공자 없음).
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "../../apps/web/dist");
http
  .createServer(async (req, res) => {
    if (req.url.startsWith("/api/") || req.url.startsWith("/health")) {
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: 4401,
          path: req.url,
          method: req.method,
          headers: req.headers,
        },
        (reply) => {
          res.writeHead(reply.statusCode, reply.headers);
          reply.pipe(res);
        },
      );
      upstream.on("error", () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep))
        file = path.join(root, "index.html");
      let data;
      try {
        data = await fs.readFile(file);
      } catch {
        file = path.join(root, "index.html");
        data = await fs.readFile(file);
      }
      const types = {
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".svg": "image/svg+xml",
      };
      res.setHeader(
        "Content-Type",
        types[path.extname(file)] || "application/octet-stream",
      );
      res.end(data);
    } catch {
      res.writeHead(500);
      res.end();
    }
  })
  .listen(4198, "127.0.0.1");
