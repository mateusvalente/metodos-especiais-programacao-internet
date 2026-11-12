const express = require("express");
const path = require("path");
const app = express();

// hls.js vem da dependência local, sem depender de CDN.
app.use(
  "/vendor",
  express.static(path.join(__dirname, "node_modules/hls.js/dist")),
);

// Playlists e segmentos são arquivos HTTP comuns, com os tipos MIME corretos.
app.use(
  "/videos",
  express.static(path.join(__dirname, "videos"), {
    setHeaders(res, file) {
      if (file.endsWith(".m3u8")) {
        res.type("application/vnd.apple.mpegurl");
      }

      if (file.endsWith(".ts")) {
        res.type("video/mp2t");
      }
    },
  }),
);
app.use(express.static("public"));

app.listen(3000, () => console.log("HLS: http://localhost:3000"));
