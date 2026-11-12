# Laboratório de comunicação web

Três exemplos independentes em Node.js, Express e JavaScript puro, com interface visual semelhante.

Comece pelo [guia didático em Markdown](GUIA_DIDATICO.md) ou pela [página visual com diagramas](http://localhost:3001/shared/guia.html) após subir o Compose. A página também está no menu de cada aplicação.

## Executar

Requisitos: Docker e Docker Compose. Na raiz do projeto:

```sh
docker compose up --build
```

Abra [chat](http://localhost:3001), [monitoramento SSE](http://localhost:3002), [publicador de notificações](http://localhost:3002/publicar.html) e [player HLS](http://localhost:3003). O Compose monta o código local em `/app` por volumes; os Dockerfiles não copiam o projeto. Dependências ficam em volumes nomeados. O primeiro início do HLS gera um vídeo de teste com FFmpeg nas resoluções 360p, 720p e 1080p e salva os segmentos em `03-hls-streaming/videos/` (ignorado pelo Git).

Para encerrar: `docker compose down`. Para gerar o vídeo novamente, remova a pasta `03-hls-streaming/videos` e reinicie o serviço.

## Testes de navegador

Com os serviços em execução, instale as dependências de teste e rode o Playwright (usa o Google Chrome instalado):

```sh
npm install
npm test
```

Os testes verificam a troca de mensagens entre os dois clientes, a entrega de notificações MQTT por SSE, o filtro por CPF, e carregamento, reprodução e seleção de qualidade do HLS.

O código está identado e comentado para uso em aula. Para manter a formatação após alterações, execute `npm run format`.

Para explicar `publish`, `subscribe`, tópicos, o curinga `+` e a ponte MQTT → SSE, siga o [roteiro detalhado do projeto 02](02-sse-monitoramento/AULA.md).

## Roteiro de demonstração

1. **SSE + MQTT:** abra o painel no CPF fictício `000.000.000-00` e o publicador em outra aba. Envie uma mensagem pronta ou personalizada para o mesmo CPF. O navegador faz POST ao Node, que publica no Mosquitto; o Node assina o tópico e entrega ao painel por SSE. Troque o CPF no painel para demonstrar o filtro. Em Network, inspecione `/events` e os eventos `reading` e `alert`.
2. **WebSocket:** entre como duas pessoas nos painéis lado a lado. Envie mensagens nos dois sentidos e observe a lista de conectados. Em Network → WS, inspecione os frames.
3. **HLS:** reproduza o vídeo gerado, selecione 360p, 720p e 1080p, depois volte a Automática. Em Network, encontre `master.m3u8`, playlists das variantes e segmentos `.ts`.

| Critério | WebSocket | SSE | HLS |
| --- | --- | --- | --- |
| Direção | Bidirecional | Servidor → navegador | Servidor → navegador |
| Transporte | Conexão WebSocket persistente | Resposta HTTP persistente | Requisições HTTP por segmentos |
| Exemplo | Chat | Métricas e alertas | Vídeo adaptativo |

O Mosquitto fica disponível para ferramentas locais em `127.0.0.1:1883` e para os contêineres em `mosquitto:1883`. Os tópicos são `lab/metricas` e `lab/cpf/{cpf}/notificacoes`. Use apenas CPFs fictícios nesta demonstração: o projeto não implementa autenticação ou proteção de dados pessoais.

O vídeo de teste dura 24 segundos, usa imagem sintética e tom de áudio, e se repete em loop. Clique em **Reproduzir vídeo** para iniciar; ele começa mudo e pode ser desmutado no controle nativo. A seleção automática depende das condições percebidas pelo `hls.js`; em rede local rápida, normalmente ele escolhe a melhor resolução.

