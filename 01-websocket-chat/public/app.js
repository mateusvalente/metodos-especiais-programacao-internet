for (const root of document.querySelectorAll(".chat")) {
  // Cada painel cria sua própria conexão, como se fosse uma aba separada.
  let socket, myName;
  const join = root.querySelector(".join");
  const send = root.querySelector(".send");
  const messages = root.querySelector(".messages");
  const status = root.querySelector(".status");

  join.addEventListener("submit", (event) => {
    event.preventDefault();
    myName = join.elements.name.value.trim();

    if (!myName) {
      return;
    }

    // O navegador faz o handshake WebSocket em /ws.
    socket = new WebSocket(`ws://${location.host}/ws`);
    status.textContent = "Conectando…";
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "join", name: myName }));
      status.textContent = "Conectado";
      join.hidden = true;
      send.elements.message.disabled = false;
      send.querySelector("button").disabled = false;
    });
    // O servidor pode enviar mensagens de chat ou mudanças de presença.
    socket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "presence") {
        root.querySelector(".users").textContent =
          `Conectados: ${data.users.join(", ") || "ninguém"}`;
      }

      if (data.type === "message") {
        const item = document.createElement("div");
        item.className = `message ${data.name === myName ? "mine" : ""}`;
        const name = document.createElement("b");
        name.textContent = data.name;
        const time = document.createElement("time");
        time.textContent = new Date(data.time).toLocaleTimeString("pt-BR");
        const text = document.createElement("p");
        text.textContent = data.text;
        item.append(name, time, text);
        messages.append(item);
        messages.scrollTop = messages.scrollHeight;
      }
    });

    socket.addEventListener("close", () => {
      status.textContent = "Desconectado";
      join.hidden = false;
      send.elements.message.disabled = true;
      send.querySelector("button").disabled = true;
    });
  });
  send.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = send.elements.message.value.trim();

    if (text && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "message", text }));
    }

    send.reset();
  });
}
