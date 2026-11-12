const express = require("express");
const { WebSocketServer, WebSocket } = require("ws");
const http = require("http");

const app = express();
app.use(express.static("public"));

// WebSocket usa o mesmo servidor HTTP que entrega os arquivos da interface.
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Cada conexão guarda o nome escolhido pelo participante.
const clients = new Map();

function broadcast(data) {
  const message = JSON.stringify(data);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function presence() {
  broadcast({ type: "presence", users: [...clients.values()] });
}

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let data;

    // O protocolo desta aula usa mensagens JSON com um campo "type".
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    // O evento "join" registra o usuário e atualiza a lista de conectados.
    if (data.type === "join") {
      const name = String(data.name || "")
        .trim()
        .slice(0, 24);
      if (!name) {
        return;
      }

      clients.set(socket, name);
      presence();
    }

    // Uma mensagem de chat é enviada a todos, inclusive ao remetente.
    if (data.type === "message" && clients.has(socket)) {
      const text = String(data.text || "")
        .trim()
        .slice(0, 500);
      if (text) {
        broadcast({
          type: "message",
          name: clients.get(socket),
          text,
          time: new Date().toISOString(),
        });
      }
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    presence();
  });
});
server.listen(3000, () => console.log("Chat: http://localhost:3000"));
