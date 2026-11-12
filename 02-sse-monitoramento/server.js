const express = require("express");
const mqtt = require("mqtt");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const METRICS_TOPIC = "lab/metricas";
// + é um curinga MQTT: aceita um segmento, neste caso qualquer CPF.
const CPF_TOPICS = "lab/cpf/+/notificacoes";

// O Node assina os tópicos do Mosquitto. A biblioteca reconecta sozinha.
const broker = mqtt.connect("mqtt://mosquitto:1883");
let brokerConnected = false;

// Cada navegador tem uma resposta SSE aberta e um CPF de interesse.
const browsers = new Map();
let latestReading = null;

function sendEvent(response, event, data) {
  // A linha vazia no final encerra um evento no protocolo SSE.
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function forwardToBrowsers(event, data, cpf = null) {
  for (const [response, subscribedCpf] of browsers) {
    if (cpf === null || subscribedCpf === cpf) {
      sendEvent(response, event, data);
    }
  }
}

broker.on("connect", () => {
  brokerConnected = true;
  console.log("Conectado ao Mosquitto");

  // SUBSCRIBE acontece no Node, uma vez por conexão MQTT. Ele acompanha
  // todas as métricas e todas as notificações de CPF. O navegador não fala MQTT.
  broker.subscribe([METRICS_TOPIC, CPF_TOPICS], { qos: 1 }, (error) => {
    if (error) {
      console.error("Falha no SUBSCRIBE MQTT:", error);
      return;
    }

    console.log(`SUBSCRIBE ${METRICS_TOPIC} e ${CPF_TOPICS}`);
  });
});

broker.on("close", () => {
  brokerConnected = false;
});

broker.on("message", (topic, payload) => {
  let data;

  try {
    data = JSON.parse(payload.toString());
  } catch {
    return;
  }

  // Este callback é executado quando o broker entrega uma publicação assinada.
  // Aqui está a ponte MQTT → SSE: um protocolo termina e o outro começa.
  if (topic === METRICS_TOPIC) {
    latestReading = data;
    forwardToBrowsers("reading", data);
  } else if (/^lab\/cpf\/\d{11}\/notificacoes$/.test(topic)) {
    const cpf = topic.split("/")[2];
    console.log(`RECEIVE ${topic}`);
    forwardToBrowsers("alert", data, cpf);
  }
});

app.get("/events", (request, response) => {
  const cpf = String(request.query.cpf || "").replace(/\D/g, "");

  if (cpf.length !== 11) {
    return response.status(400).json({ error: "Informe 11 dígitos de CPF." });
  }

  response.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders();
  browsers.set(response, cpf);

  if (latestReading) {
    sendEvent(response, "reading", latestReading);
  }

  request.on("close", () => browsers.delete(response));
});

app.post("/api/notifications", (request, response) => {
  const cpf = String(request.body.cpf || "").replace(/\D/g, "");
  const kind = ["info", "warning", "critical"].includes(request.body.kind)
    ? request.body.kind
    : "info";
  const message = String(request.body.message || "")
    .trim()
    .slice(0, 120);

  if (cpf.length !== 11 || !message) {
    return response.status(400).json({ error: "Informe CPF e mensagem." });
  }

  if (!brokerConnected) {
    return response.status(503).json({ error: "Broker MQTT indisponível." });
  }

  const notification = { cpf, kind, message, time: new Date().toISOString() };
  const topic = `lab/cpf/${cpf}/notificacoes`;

  // PUBLISH envia o JSON ao broker, no tópico específico do CPF.
  // QoS 1 pede confirmação do broker; pode haver entrega duplicada.
  // O POST não envia dados diretamente ao painel.
  broker.publish(topic, JSON.stringify(notification), { qos: 1 }, (error) => {
    if (error) {
      return response.status(503).json({ error: "Falha ao publicar no MQTT." });
    }

    console.log(`PUBLISH ${topic}`);
    response.status(202).json(notification);
  });
});

// O simulador também publica as métricas no broker para mostrar o mesmo caminho.
let reading = { temperature: 42, cpu: 25, memory: 51 };

setInterval(() => {
  if (!brokerConnected) {
    return;
  }

  const drift = (value, amount) =>
    Math.min(
      100,
      Math.max(0, value + Math.round((Math.random() - 0.5) * amount)),
    );

  reading = {
    temperature: drift(reading.temperature, 7),
    cpu: drift(reading.cpu, 25),
    memory: drift(reading.memory, 9),
    time: new Date().toISOString(),
  };

  broker.publish(METRICS_TOPIC, JSON.stringify(reading));
}, 1000);

app.listen(3000, () => console.log("SSE + MQTT: http://localhost:3000"));
