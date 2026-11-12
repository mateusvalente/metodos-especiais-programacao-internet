const video = document.getElementById("video");
const quality = document.getElementById("quality");
const status = document.getElementById("player-status");
const current = document.getElementById("current-quality");
const mode = document.getElementById("mode");
const playButton = document.getElementById("play-button");
const playbackTime = document.getElementById("playback-time");
const playbackProgress = document.getElementById("playback-progress");
const source = "/videos/master.m3u8";

function formatTime(seconds) {
  const whole = Math.floor(seconds || 0);
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

// O contador mostra visualmente que novos segmentos estão sendo reproduzidos.
video.addEventListener("timeupdate", () => {
  playbackTime.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  playbackProgress.max = Number.isFinite(video.duration) ? video.duration : 24;
  playbackProgress.value = video.currentTime;
});

// O botão deixa explícito como iniciar a demonstração, inclusive em navegadores
// que impedem reprodução automática. O vídeo fica em loop para dar tempo de
// observar a troca de qualidade na aba Network.
playButton.addEventListener("click", async () => {
  if (video.paused) {
    try {
      await video.play();
    } catch (error) {
      status.textContent = `Não foi possível reproduzir: ${error.message}`;
    }
  } else {
    video.pause();
  }
});

video.addEventListener("playing", () => {
  playButton.textContent = "Pausar vídeo";
  status.textContent = "Reproduzindo vídeo HLS";
});

video.addEventListener("pause", () => {
  playButton.textContent = "Reproduzir vídeo";
  if (!video.ended) {
    status.textContent = "Vídeo pausado";
  }
});

video.addEventListener("waiting", () => {
  status.textContent = "Carregando segmento de vídeo…";
});

// Chrome e Firefox usam hls.js para traduzir HLS para Media Source Extensions.
if (window.Hls?.isSupported()) {
  const hls = new Hls();
  hls.loadSource(source);
  hls.attachMedia(video);

  // A playlist mestre revela os níveis de qualidade disponíveis.
  hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
    data.levels.forEach((level, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `${level.height}p`;
      quality.append(option);
    });
    status.textContent = "Pronto para reproduzir";
    playButton.disabled = false;
  });
  hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
    current.textContent = `${hls.levels[data.level].height}p`;
  });
  hls.on(Hls.Events.ERROR, (_, data) => {
    if (data.fatal) {
      status.textContent = `Erro: ${data.details}`;
    }
  });

  // Antes da reprodução, startLevel define o primeiro segmento.
  // Durante a reprodução, currentLevel troca a variante ativa.
  quality.addEventListener("change", () => {
    const level = Number(quality.value);

    if (video.readyState === 0) {
      hls.startLevel = level;
    } else {
      hls.currentLevel = level;
    }

    mode.textContent = level === -1 ? "Automático" : "Manual";
  });
} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
  // Safari consegue abrir a playlist HLS diretamente no elemento <video>.
  video.src = source;
  status.textContent = "Pronto para reproduzir (HLS nativo)";
  playButton.disabled = false;
  quality.disabled = true;
  mode.textContent = "Automático (nativo)";
} else {
  status.textContent = "Este navegador não suporta HLS.";
}
