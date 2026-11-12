const form = document.getElementById("publisher-form");
const status = document.getElementById("publish-status");

// O tópico mostrado acompanha o CPF digitado, antes mesmo do envio.
form.elements.cpf.addEventListener("input", () => {
  const cpf = form.elements.cpf.value.replace(/\D/g, "");
  document.getElementById("publish-topic").textContent =
    `lab/cpf/${cpf || "?"}/notificacoes`;
});

async function publishNotification() {
  const cpf = form.elements.cpf.value.replace(/\D/g, "");

  if (cpf.length !== 11) {
    status.textContent = "Informe um CPF fictício com 11 dígitos.";
    return;
  }

  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cpf,
      kind: form.elements.kind.value,
      message: form.elements.message.value,
    }),
  });

  const result = await response.json();
  status.textContent = response.ok
    ? `Publicado no MQTT para o CPF ${form.elements.cpf.value}.`
    : result.error;

  if (response.ok) {
    form.elements.message.value = "";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  publishNotification();
});

// Os botões de exemplo preenchem e enviam o mesmo formulário manual.
for (const button of document.querySelectorAll(".example")) {
  button.addEventListener("click", () => {
    form.elements.kind.value = button.dataset.kind;
    form.elements.message.value = button.dataset.message;
    publishNotification();
  });
}
