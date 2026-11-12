# Aula: MQTT, Mosquitto e SSE

## Objetivo

Mostrar como um produtor publica uma mensagem em um broker MQTT e como outro componente a recebe por **subscribe**. O navegador recebe o resultado por SSE. As notificações e os CPFs são fictícios; o transporte MQTT e SSE é real.

## Papéis de cada peça

| Peça | Papel | Protocolo usado |
| --- | --- | --- |
| Página `/publicar.html` | Simula um sistema que produz notificações | HTTP POST para o Node |
| Node.js | Publica e assina tópicos no Mosquitto; encaminha eventos ao painel | MQTT e SSE |
| Mosquitto | Broker: recebe publicações e as entrega aos assinantes | MQTT |
| Painel `/` | Acompanha um CPF e mostra métricas e notificações | SSE por `EventSource` |

```text
Página de envio ── HTTP POST ──> Node ── MQTT PUBLISH ──> Mosquitto
                                                             │
                                                       MQTT SUBSCRIBE
                                                             │
                                                             ▼
Painel <────────────── SSE /events?cpf=... <────────────── Node
```

O mesmo processo Node é publicador e assinante neste exemplo para reduzir o número de serviços. Em uma aplicação maior, esses papéis podem ficar em processos separados.

## Vocabulário

- **Broker:** servidor que recebe e distribui mensagens MQTT. Aqui é o Mosquitto.
- **Tópico:** endereço lógico de uma mensagem. Exemplo: `lab/cpf/00000000000/notificacoes`.
- **Publish:** envio de uma mensagem para um tópico. Quem publica não precisa conhecer os assinantes.
- **Subscribe:** inscrição em um tópico ou padrão de tópicos. O broker entrega as publicações correspondentes ao assinante.
- **Curinga `+`:** representa exatamente um nível do tópico. `lab/cpf/+/notificacoes` recebe publicações de qualquer CPF nesse ponto do caminho.
- **Payload:** conteúdo da mensagem; neste projeto é JSON com CPF, tipo, texto e horário.
- **SSE:** resposta HTTP que permanece aberta para o servidor enviar eventos ao navegador. `EventSource` não fala MQTT.

## Acompanhe uma mensagem passo a passo

1. Abra o painel em `http://localhost:3002`. Ele começa acompanhando o CPF fictício `000.000.000-00` e cria um `EventSource('/events?cpf=00000000000')`.
2. Abra `http://localhost:3002/publicar.html`. Escolha o mesmo CPF e envie `Cadastro recebido`.
3. O navegador faz `POST /api/notifications`. Procure essa requisição na aba **Network**.
4. A rota no [server.js](server.js) monta o tópico `lab/cpf/00000000000/notificacoes` e chama `broker.publish(...)`.
5. O Mosquitto recebe a publicação. O Node já havia chamado `broker.subscribe('lab/cpf/+/notificacoes')` ao conectar.
6. O evento `message` do cliente MQTT recebe o tópico e o payload. O Node compara o CPF do tópico com o CPF acompanhado por cada painel.
7. Para os painéis correspondentes, o Node escreve `event: alert` e `data: ...` na resposta HTTP aberta. O `EventSource` recebe o evento e atualiza a lista.

**Ponto para enfatizar:** mudar o CPF no painel abre outra conexão SSE com outro filtro. Isso **não** cria um novo `subscribe` MQTT. O Node assina todos os CPFs com `+` e faz o filtro para cada navegador.

## Observe o broker diretamente

Em um terminal, execute:

```sh
docker compose exec mosquitto mosquitto_sub -h localhost -t 'lab/cpf/+/notificacoes' -v
```

O comando é outro assinante MQTT. Com ele aberto, envie uma notificação pela página. O terminal mostra o tópico e o JSON recebido. Para ver o subscribe do Node e as publicações processadas:

```sh
docker compose logs -f monitor
```

O Mosquitto também está acessível em `127.0.0.1:1883` para ferramentas MQTT instaladas no computador. O painel do navegador usa a porta `3002` e SSE, não a porta MQTT.

## Experimentos para a turma

1. **Mesmo CPF:** abra dois painéis com `000.000.000-00`. Uma publicação aparece nos dois.
2. **CPF diferente:** altere um painel para `111.111.111-11`. Publique para `000.000.000-00`; somente o primeiro painel recebe.
3. **Curinga:** observe que `lab/cpf/+/notificacoes` recebe os dois tópicos no terminal, apesar de cada painel mostrar apenas seu CPF.
4. **Reconexão SSE:** recarregue o painel. `EventSource` abre outra conexão. Notificações anteriores não são recuperadas, pois este exemplo não grava histórico.
5. **Broker indisponível:** pare o Mosquitto com `docker compose stop mosquitto`; o envio responde que o broker está indisponível. Reinicie com `docker compose start mosquitto` e observe o Node assinar os tópicos novamente.

## Perguntas para discussão

- Por que a página de envio não conhece os painéis conectados?
- O que o `+` representa? Ele aceitaria `lab/cpf/123/outra/coisa/notificacoes`? (Não: `+` ocupa um único nível.)
- Por que o navegador usa `EventSource` em vez de se conectar diretamente ao broker?
- O que aconteceria se houvesse dois processos Node? (Cada um faria seu próprio subscribe e atenderia seus próprios navegadores.)
- O que falta para uso real? Autenticação, autorização por CPF, TLS, persistência, tratamento de duplicatas e histórico de eventos.

## Limites intencionais do exemplo

O Mosquitto aceita conexões anônimas apenas para facilitar a aula. A porta MQTT está ligada somente a `127.0.0.1`. Os CPFs usados devem ser fictícios. O `QoS 1` da notificação confirma a entrega ao broker, mas permite duplicatas; ele não garante que um navegador a tenha exibido. Não há retenção, histórico ou replay de notificações. As métricas simuladas são publicadas a cada segundo em `lab/metricas`.
