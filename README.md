# Laboratório de comunicação web

Três exemplos independentes em Node.js, Express e JavaScript puro, com interface visual semelhante.

Comece pelo [guia didático em Markdown](GUIA_DIDATICO.md) ou pela [página visual com diagramas](http://localhost:3001/shared/guia.html) após subir o Compose. A página também está no menu de cada aplicação.

## Executar

Requisitos: Docker e Docker Compose. Na raiz do projeto:

```sh
docker compose up --build
```

Abra [chat](http://localhost:3001), [monitoramento SSE](http://localhost:3002), [publicador de notificações](http://localhost:3002/publicar.html) e [player HLS](http://localhost:3003). O Compose monta o código local em `/app` por volumes; os Dockerfiles não copiam o projeto. Dependências ficam em volumes nomeados. O repositório inclui **um único vídeo de origem**, `03-hls-streaming/sample.mp4`. Ao iniciar, o FFmpeg gera a partir dele playlists e segmentos HLS em 360p, 720p e 1080p na pasta `videos/`.

Para encerrar: `docker compose down`. A pasta `03-hls-streaming/videos/` contém apenas arquivos gerados e fica fora do Git.

### Gerar ou trocar o vídeo HLS

O arquivo [sample.mp4](03-hls-streaming/sample.mp4) é a fonte das três qualidades. Para criar outra amostra sintética de 24 segundos com o FFmpeg do contêiner:

```sh
docker compose exec streaming ffmpeg -y -f lavfi -i testsrc2=size=1920x1080:rate=24:duration=24 -f lavfi -i sine=frequency=440:sample_rate=44100:duration=24 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -b:v 900k -c:a aac -b:a 64k -movflags +faststart /app/sample.mp4
```

Você também pode substituir `03-hls-streaming/sample.mp4` por seu próprio MP4 e reiniciar o serviço com `docker compose restart streaming`. O script [generate.js](03-hls-streaming/generate.js) detecta a mudança no arquivo, executa o FFmpeg três vezes, uma por resolução, e grava as playlists `.m3u8` e segmentos `.ts`. O vídeo de origem deve ter resolução pelo menos 1920×1080 para manter detalhes reais na variante 1080p.

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
