const { test, expect } = require("@playwright/test");

test("guia visual abre nos três projetos e apresenta os diagramas", async ({
  page,
}) => {
  for (const port of [3001, 3002, 3003]) {
    const response = await page.goto(
      `http://localhost:${port}/shared/guia.html`,
    );
    expect(response.status()).toBe(200);
    await expect(page.locator("#websocket svg")).toBeVisible();
    await expect(page.locator("#sse svg")).toBeVisible();
    await expect(page.locator("#hls svg")).toBeVisible();
  }

  await page.screenshot({
    path: "test-results/guia-visual.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("chat troca mensagens entre dois clientes na mesma tela", async ({
  page,
}) => {
  await page.goto("http://localhost:3001");
  const a = page.locator("#chat-a"),
    b = page.locator("#chat-b");
  await a.locator("input[name=name]").fill("Ana");
  await a.locator(".join button").click();
  await b.locator("input[name=name]").fill("Beto");
  await b.locator(".join button").click();
  await expect(a.locator(".users")).toContainText("Beto");
  await a.locator("input[name=message]").fill("Olá Beto");
  await a.locator(".send button").click();
  await expect(b.locator(".messages")).toContainText("Olá Beto");
  await b.locator("input[name=message]").fill("Olá Ana");
  await b.locator(".send button").click();
  await expect(a.locator(".messages")).toContainText("Olá Ana");
});

test("Mosquitto entrega notificação do publicador ao painel por SSE", async ({
  browser,
  page,
}) => {
  await page.goto("http://localhost:3002");
  await expect(page.locator("#status")).toHaveText("Conectado");
  await expect(page.locator("#history li")).toHaveCount(2, { timeout: 10000 });

  const publisher = await browser.newPage();
  await publisher.goto("http://localhost:3002/publicar.html");
  await expect(publisher.locator("#publish-topic")).toHaveText(
    "lab/cpf/00000000000/notificacoes",
  );
  await publisher.locator("#kind").selectOption("warning");
  await publisher.locator("#message").fill("Teste de alerta MQTT");
  await publisher
    .getByRole("button", { name: "Publicar no Mosquitto" })
    .click();
  await expect(publisher.locator("#publish-status")).toContainText(
    "Publicado no MQTT",
  );
  await expect(page.locator("#alerts")).toContainText("Teste de alerta MQTT");
  await expect(page.locator("#last-topic")).toHaveText(
    "lab/cpf/00000000000/notificacoes",
  );

  // Outro CPF deve receber somente as notificações do próprio tópico.
  await page.locator("input[name=cpf]").fill("111.111.111-11");
  await page.getByRole("button", { name: "Acompanhar" }).click();
  await expect(page.locator("#status")).toHaveText("Conectado");
  await publisher.locator("#message").fill("Só para o primeiro CPF");
  await publisher
    .getByRole("button", { name: "Publicar no Mosquitto" })
    .click();
  await expect(publisher.locator("#publish-status")).toContainText(
    "Publicado no MQTT",
  );
  await expect(page.locator("#alerts")).not.toContainText(
    "Só para o primeiro CPF",
  );
  await publisher.close();
});

test("HLS carrega vídeo, segmentos e troca qualidade", async ({ page }) => {
  const segments = [];
  page.on("response", (response) => {
    if (response.url().endsWith(".ts")) segments.push(response.status());
  });
  await page.goto("http://localhost:3003");
  await expect(page.locator("#player-status")).toHaveText(
    "Pronto para reproduzir",
  );
  await expect(page.locator("#quality option")).toHaveCount(4);
  await page.getByRole("button", { name: "Reproduzir vídeo" }).click();
  await expect
    .poll(() => segments.length, { timeout: 15000 })
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.locator("video").evaluate((video) => video.currentTime), {
      timeout: 15000,
    })
    .toBeGreaterThan(3);
  const playback = await page.locator("video").evaluate((video) => ({
    duration: video.duration,
    width: video.videoWidth,
    readyState: video.readyState,
  }));
  expect(playback.duration).toBeCloseTo(24, 0);
  expect(playback.width).toBeGreaterThan(0);
  expect(playback.readyState).toBeGreaterThanOrEqual(2);
  await expect(page.locator("#playback-time")).not.toHaveText("00:00 / 00:24");
  await page.screenshot({ path: "test-results/hls-playing.png" });
  await expect(page.locator("#player-status")).toHaveText(
    "Reproduzindo vídeo HLS",
  );
  expect(
    segments.every((status) => status === 200 || status === 206),
  ).toBeTruthy();
  await page.locator("#quality").selectOption("0");
  await expect(page.locator("#mode")).toHaveText("Manual");
  await page.locator("#quality").selectOption("-1");
  await expect(page.locator("#mode")).toHaveText("Automático");
});

test("HLS aceita qualidade manual antes de iniciar", async ({ page }) => {
  await page.goto("http://localhost:3003");
  await expect(page.locator("#quality option")).toHaveCount(4);
  await page.locator("#quality").selectOption("0");
  await page.getByRole("button", { name: "Reproduzir vídeo" }).click();
  await expect
    .poll(() => page.locator("video").evaluate((video) => video.currentTime), {
      timeout: 15000,
    })
    .toBeGreaterThan(0);
  await expect(page.locator("#current-quality")).toHaveText("360p");
});
