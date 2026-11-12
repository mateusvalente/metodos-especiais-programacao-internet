# Guia didático: WebSocket, MQTT + SSE e HLS

Este guia acompanha três aplicações Node.js independentes. Todas são iniciadas pelo mesmo `docker compose`, usam JavaScript puro no navegador e têm a mesma identidade visual. O objetivo é comparar **conversa em duas direções**, **eventos enviados pelo servidor** e **distribuição de vídeo em segmentos**.

## Preparação

```sh
docker compose up --build -d
```

| Projeto | Página | O que demonstrar |
| --- | --- | --- |
| 01 — WebSocket | <http://localhost:3001> | Dois clientes conversam em tempo real na mesma tela |
| 02 — MQTT + SSE | <http://localhost:3002> e <http://localhost:3002/publicar.html> | Uma página publica notificações; outra recebe eventos do servidor |
| 03 — HLS | <http://localhost:3003> | Um vídeo é baixado em segmentos e muda de qualidade |

Os diretórios das aplicações são montados em `/app` por volumes. O [Dockerfile](Dockerfile) prepara Node e FFmpeg, sem copiar o código. O [docker-compose.yml](docker-compose.yml) inicia os serviços, monta os volumes e expõe as portas.

## 01 — WebSocket: chat em tempo real

### Ideia

Cada painel de chat abre sua própria conexão WebSocket com `/ws`. Depois do handshake HTTP, a conexão permanece aberta. O navegador pode enviar dados ao servidor e o servidor pode enviar dados ao navegador pela mesma conexão.

```text
Cliente A ── join / message ──> Servidor WebSocket ── message / presence ──> Cliente B
Cliente A <── message / presence ── Servidor WebSocket <── join / message ── Cliente B
```

### Sequência para demonstrar

1. Entre como Ana no painel A e Beto no painel B.
2. Observe a lista de conectados atualizar nos dois painéis.
3. Envie uma mensagem de Ana e outra de Beto. Ambas aparecem imediatamente nos dois lados, com horário.
4. Em **DevTools → Network → WS**, selecione `/ws` e observe os frames `join`, `presence` e `message`.

### Métodos e eventos do servidor

Arquivo: [01-websocket-chat/server.js](01-websocket-chat/server.js).

| Chamada | O que faz neste projeto |
| --- | --- |
| `express.static("public")` | Entrega o HTML, CSS e JavaScript da página. |
| `http.createServer(app)` | Cria o servidor HTTP usado também pelo WebSocket. |
| `new WebSocketServer({ server, path: "/ws" })` | Aceita upgrades WebSocket no caminho `/ws`. |
| `wss.on("connection", callback)` | Executa o callback quando um cliente se conecta. |
| `socket.on("message", callback)` | Recebe um frame enviado pelo navegador. |
| `JSON.parse(raw)` | Transforma o texto do frame em objeto `{ type, ... }`. |
| `clients.set(socket, name)` | Associa o nome à conexão. |
| `broadcast(data)` | Função criada no exemplo: transforma o objeto em JSON e envia a todos os sockets abertos. |
| `client.send(message)` | Envia um frame WebSocket a um cliente. |
| `socket.on("close", callback)` | Remove o usuário quando a conexão termina. |

### Métodos e eventos do navegador

Arquivo: [01-websocket-chat/public/app.js](01-websocket-chat/public/app.js).

| Chamada | O que faz neste projeto |
| --- | --- |
| `new WebSocket("ws://.../ws")` | Inicia a conexão persistente com o servidor. |
| `socket.addEventListener("open", ...)` | Aguarda o handshake terminar para enviar `join`. |
| `socket.send(JSON.stringify(...))` | Envia `join` ou `message` ao servidor. |
| `socket.addEventListener("message", ...)` | Recebe `presence` ou `message` e atualiza a tela. |
| `socket.addEventListener("close", ...)` | Mostra o estado desconectado. |
| `textContent` | Insere nome e texto como texto comum, sem interpretar HTML enviado por outro usuário. |

**Pergunta para a turma:** por que o servidor envia a mensagem também ao remetente? Porque o remetente usa a resposta do servidor como confirmação visual de que o broadcast ocorreu.

## 02 — MQTT + SSE: notificações por CPF fictício

### Ideia

O [publicador](http://localhost:3002/publicar.html) simula um sistema que cria notificações. Ele faz um POST para o Node. O Node publica um JSON no Mosquitto. O mesmo Node assinou os tópicos MQTT e recebe a publicação do broker. Então ele escreve um evento SSE na conexão HTTP do [painel](http://localhost:3002) que acompanha aquele CPF.

```text
Página de envio ─ HTTP POST ─> Node ─ MQTT PUBLISH ─> Mosquitto
                                                      │
                                                MQTT SUBSCRIBE
                                                      │
                                                      ▼
Painel <──────────── SSE /events?cpf=... <────────── Node
```

O navegador **não faz subscribe MQTT**. Ele abre `EventSource`. O `subscribe` é feito pelo Node, e o Mosquitto distribui a mensagem para o assinante. Trocar o CPF no painel muda o filtro da conexão SSE, não a inscrição MQTT do Node.

### Tópicos

| Tópico | Uso |
| --- | --- |
| `lab/metricas` | Leituras simuladas de temperatura, CPU e memória. |
| `lab/cpf/00000000000/notificacoes` | Notificações publicadas para um CPF fictício específico. |
| `lab/cpf/+/notificacoes` | Padrão assinado pelo Node; `+` aceita exatamente um nível de tópico. |

### Sequência para demonstrar

1. Deixe o painel acompanhando `000.000.000-00`.
2. Abra a página de envio em outra aba, use o mesmo CPF e clique em **Cadastro recebido**.
3. Na aba **Network** da página de envio, observe o `POST /api/notifications`.
4. No painel, observe `/events?cpf=00000000000` permanecer aberto e receber `event: alert`.
5. Troque o painel para `111.111.111-11` e publique novamente para `000.000.000-00`. O broker entrega ao Node, mas o filtro do painel não mostra a mensagem.
6. Em um terminal, observe o broker diretamente:

   ```sh
   docker compose exec mosquitto mosquitto_sub -h localhost -t 'lab/cpf/+/notificacoes' -v
   ```

   Esse comando cria **outro assinante MQTT**. Envie uma mensagem pela página e veja tópico e payload no terminal.

### Métodos do servidor

Arquivo: [02-sse-monitoramento/server.js](02-sse-monitoramento/server.js).

| Chamada | O que faz neste projeto |
| --- | --- |
| `mqtt.connect("mqtt://mosquitto:1883")` | Abre a conexão MQTT do Node com o broker no Compose. |
| `broker.on("connect", ...)` | Detecta conexão ou reconexão e registra as assinaturas. |
| `broker.subscribe([METRICS_TOPIC, CPF_TOPICS], { qos: 1 }, ...)` | Pede ao Mosquitto mensagens dos dois padrões de tópico. |
| `broker.on("message", (topic, payload) => ...)` | Recebe uma publicação correspondente a uma assinatura. |
| `broker.publish(topic, JSON.stringify(notification), { qos: 1 }, ...)` | Publica uma notificação no tópico do CPF. QoS 1 confirma entrega ao broker, mas permite duplicatas. |
| `app.post("/api/notifications", ...)` | Recebe o formulário HTTP e solicita a publicação MQTT. |
| `app.get("/events", ...)` | Abre uma resposta HTTP contínua para o painel. |
| `response.set({ "Content-Type": "text/event-stream", ... })` | Identifica a resposta como fluxo SSE. |
| `response.write("event: ...\\ndata: ...\\n\\n")` | Envia um evento SSE sem encerrar a resposta. |
| `forwardToBrowsers(event, data, cpf)` | Função do exemplo: escolhe as conexões SSE com o CPF correspondente. |
| `request.on("close", ...)` | Retira uma conexão SSE fechada da lista de navegadores. |
| `setInterval(..., 1000)` | Simula e publica métricas MQTT a cada segundo. |

### Métodos do navegador

Arquivos: [app.js](02-sse-monitoramento/public/app.js) do painel e [publicar.js](02-sse-monitoramento/public/publicar.js) da página de envio.

| Chamada | O que faz neste projeto |
| --- | --- |
| `fetch("/api/notifications", { method: "POST", ... })` | Envia CPF e mensagem do navegador ao Node. |
| `new EventSource("/events?cpf=...")` | Abre a conexão SSE para o CPF acompanhado. |
| `source.addEventListener("reading", ...)` | Recebe métricas e atualiza cartões e histórico. |
| `source.addEventListener("alert", ...)` | Recebe uma notificação e a adiciona à lista. |
| `source.onerror` | Indica que o navegador está tentando reconectar. |
| `source.close()` | Encerra o fluxo anterior ao trocar o CPF. |

**Importante:** o Mosquitto do exemplo aceita conexões anônimas para facilitar a aula. Use apenas CPFs fictícios. Não há autenticação, autorização por CPF, banco de dados ou replay. Notificações perdidas enquanto o painel está fechado não reaparecem ao reabrir. Veja também [02-sse-monitoramento/AULA.md](02-sse-monitoramento/AULA.md).

## 03 — HLS: vídeo em segmentos e qualidades

### Ideia

O repositório inclui um único vídeo de origem, `sample.mp4`, com 24 segundos e resolução 1080p. Ao iniciar o serviço, o FFmpeg cria a partir dele versões HLS em 360p, 720p e 1080p: uma playlist mestre, uma playlist por qualidade e pequenos segmentos `.ts`. Esses arquivos derivados ficam fora do Git. O navegador os baixa por requisições HTTP. O player repete a amostra em loop para facilitar a demonstração. Isso é diferente da conexão persistente usada em WebSocket e SSE.

```text
FFmpeg ─> master.m3u8 ─┬─> 360p/index.m3u8 ─> segment_000.ts, ...
                       ├─> 720p/index.m3u8 ─> segment_000.ts, ...
                       └─> 1080p/index.m3u8 ─> segment_000.ts, ...

Navegador ─ HTTP GET ─> Node/Express ─ arquivos HLS ─> hls.js ─> <video>
```

### Sequência para demonstrar

1. Abra o player e clique em **Reproduzir vídeo**.
2. Em **DevTools → Network**, filtre por `m3u8` e `ts`. Abra a playlist mestre e uma playlist de variante.
3. Escolha 360p e depois 1080p; observe as novas requisições e a indicação da qualidade atual.
4. Volte para **Automática**. O `hls.js` escolhe uma qualidade de acordo com as condições percebidas; em rede local rápida tende a usar a maior.

### Métodos da geração e do servidor

Arquivos: [generate.js](03-hls-streaming/generate.js) e [server.js](03-hls-streaming/server.js).

| Chamada ou opção | O que faz neste projeto |
| --- | --- |
| `fs.existsSync("master.m3u8")` | Evita gerar novamente o vídeo em cada início. |
| `fs.mkdirSync(..., { recursive: true })` | Cria a pasta de cada variante. |
| `spawnSync("ffmpeg", args)` | Executa o FFmpeg e espera a geração terminar. |
| `sample.mp4` | Vídeo de origem versionado; pode ser substituído por outro MP4. |
| `-vf scale=...` | Redimensiona a origem para cada uma das três variantes. |
| `-c:v libx264` e `-c:a aac` | Codificam vídeo e áudio em formatos usados pelo player. |
| `-hls_time 2` | Solicita segmentos de aproximadamente dois segundos. |
| `-hls_playlist_type vod` | Produz playlists de vídeo sob demanda, com duração conhecida. |
| `fs.writeFileSync("master.m3u8", ...)` | Escreve a playlist mestre com resolução e banda de cada variante. |
| `express.static("videos")` | Serve playlists e segmentos por HTTP. |
| `res.type(...)` | Define os tipos MIME de `.m3u8` e `.ts`. |

### Métodos do navegador

Arquivo: [03-hls-streaming/public/app.js](03-hls-streaming/public/app.js).

| Chamada | O que faz neste projeto |
| --- | --- |
| `Hls.isSupported()` | Verifica se o navegador pode reproduzir HLS por Media Source Extensions. |
| `new Hls()` | Cria o controlador do player. |
| `hls.loadSource("/videos/master.m3u8")` | Carrega a playlist mestre. |
| `hls.attachMedia(video)` | Liga o controlador ao elemento `<video>`. |
| `MANIFEST_PARSED` | Informa as qualidades encontradas na playlist mestre. |
| `LEVEL_SWITCHED` | Informa qual qualidade passou a ser usada. |
| `hls.startLevel` | Define a primeira qualidade antes da reprodução. |
| `hls.currentLevel` | Troca ou libera a qualidade durante a reprodução; `-1` volta ao automático. |
| `video.canPlayType(...)` | Permite usar HLS nativo em navegadores que o suportam. |

## Comparação final

| Pergunta | WebSocket | MQTT + SSE | HLS |
| --- | --- | --- | --- |
| Quem inicia a conexão no navegador? | `WebSocket` | `EventSource` | `hls.js`/`<video>` |
| Como chegam os dados? | Frames nos dois sentidos | Broker entrega ao Node; Node envia eventos SSE ao navegador | Arquivos de playlist e segmentos por HTTP |
| A conexão com o navegador fica aberta? | Sim | Sim | Não: há requisições por arquivo/segmento |
| Exemplo de uso | Chat | Notificações e monitoramento | Vídeo adaptativo |

## Verificação

Com o Compose ativo, rode `npm install` e `npm test`. Os testes Playwright cobrem as duas pontas do chat, a entrega MQTT → SSE com filtro por CPF e a reprodução HLS em qualidades diferentes.
