const status = document.getElementById("status");
const cpfForm = document.getElementById("cpf-form");
let source;

function connectToEvents(cpf) {
  // EventSource abre uma resposta HTTP contínua. Ao mudar o CPF, fechamos
  // a conexão antiga e abrimos outra com o novo filtro.
  source?.close();
  source = new EventSource(`/events?cpf=${cpf}`);
  status.textContent = "Conectando…";

  source.onopen = () => {
    status.textContent = "Conectado";
  };

  source.onerror = () => {
    status.textContent = "Reconectando…";
  };

  source.addEventListener("reading", (event) => {
    const data = JSON.parse(event.data);

    for (const [key, suffix] of [
      ["temperature", "°C"],
      ["cpu", "%"],
      ["memory", "%"],
    ]) {
      document.getElementById(key).textContent = `${data[key]}${suffix}`;
      document.getElementById(`${key}-bar`).style.width = `${data[key]}%`;
    }

    const item = document.createElement("li");
    item.textContent = `${new Date(data.time).toLocaleTimeString("pt-BR")} · ${data.temperature}°C · CPU ${data.cpu}% · Memória ${data.memory}%`;

    const list = document.getElementById("history");
    list.prepend(item);

    while (list.children.length > 8) {
      list.lastElementChild.remove();
    }
  });

  source.addEventListener("alert", (event) => {
    const data = JSON.parse(event.data);
    const list = document.getElementById("alerts");
    document.getElementById("last-topic").textContent =
      `lab/cpf/${data.cpf}/notificacoes`;

    if (list.firstElementChild?.classList.contains("muted")) {
      list.replaceChildren();
    }

    const item = document.createElement("li");
    item.textContent = `${new Date(data.time).toLocaleTimeString("pt-BR")} · ${data.kind.toUpperCase()} · ${data.message}`;
    list.prepend(item);

    while (list.children.length > 8) {
      list.lastElementChild.remove();
    }
  });
}

cpfForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const cpf = cpfForm.elements.cpf.value.replace(/\D/g, "");

  if (cpf.length !== 11) {
    cpfForm.elements.cpf.setCustomValidity("Informe 11 dígitos.");
    cpfForm.reportValidity();
    return;
  }

  cpfForm.elements.cpf.setCustomValidity("");
  document.getElementById("cpf-label").textContent =
    `Acompanhando ${cpfForm.elements.cpf.value}`;
  document.getElementById("alerts").innerHTML =
    '<li class="muted">Aguardando notificações…</li>';
  document.getElementById("last-topic").textContent = "aguardando";
  connectToEvents(cpf);
});

connectToEvents("00000000000");
