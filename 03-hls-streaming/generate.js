const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");
const { spawnSync } = require("child_process");

const dir = path.join(__dirname, "videos");
const sourceVideo = path.join(__dirname, "sample.mp4");
fs.mkdirSync(dir, { recursive: true });
const generationVersion = "3";
const versionFile = path.join(dir, "generation-version.txt");
const sourceHash = createHash("sha256")
  .update(fs.readFileSync(sourceVideo))
  .digest("hex");
const generationSignature = `${generationVersion}:${sourceHash}`;

// Cada variante representa uma resolução e um bitrate anunciados no master.m3u8.
const variants = [
  {
    name: "360p",
    width: 640,
    height: 360,
    bitrate: "800k",
    bandwidth: 1000000,
  },
  {
    name: "720p",
    width: 1280,
    height: 720,
    bitrate: "2500k",
    bandwidth: 3000000,
  },
  {
    name: "1080p",
    width: 1920,
    height: 1080,
    bitrate: "4500k",
    bandwidth: 5500000,
  },
];

// A geração acontece na primeira inicialização, quando o comando muda ou
// quando sample.mp4 é substituído por outro arquivo.
// O MP4 original é versionado; as playlists e os segmentos são derivados dele.
if (
  !fs.existsSync(versionFile) ||
  fs.readFileSync(versionFile, "utf8") !== generationSignature
) {
  for (const item of variants) {
    const output = path.join(dir, item.name);
    fs.mkdirSync(output, { recursive: true });
    console.log(`Gerando vídeo de exemplo ${item.name}...`);

    // Cada variante vem do mesmo MP4, reduzido para a resolução desejada.
    // O FFmpeg cria uma playlist e segmentos MPEG-TS de cerca de dois segundos.
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      sourceVideo,
      "-vf",
      `scale=${item.width}:${item.height}`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-b:v",
      item.bitrate,
      "-g",
      "48",
      "-sc_threshold",
      "0",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-f",
      "hls",
      "-hls_time",
      "2",
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      path.join(output, "segment_%03d.ts"),
      path.join(output, "index.m3u8"),
    ];
    const result = spawnSync("ffmpeg", args, { stdio: "inherit" });

    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
  }

  // A playlist mestre aponta para as três playlists de resolução.
  fs.writeFileSync(
    path.join(dir, "master.m3u8"),
    "#EXTM3U\n#EXT-X-VERSION:3\n" +
      variants
        .map(
          (v) =>
            `#EXT-X-STREAM-INF:BANDWIDTH=${v.bandwidth},RESOLUTION=${v.width}x${v.height}\n${v.name}/index.m3u8\n`,
        )
        .join(""),
  );
  fs.writeFileSync(versionFile, generationSignature);
}
