#!/usr/bin/env bash
# Gera os vídeos sintéticos de teste em fixtures/videos/. Rode a partir da raiz do repo.
# Precisa de ffmpeg (com libx265) no PATH. Os arquivos gerados são commitados:
# o CI usa os arquivos prontos e não precisa rodar este script.
set -euo pipefail

OUT=fixtures/videos
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# Sem GPS, data nem aparelho nos arquivos gerados; só a versão da biblioteca do ffmpeg (encoder=Lavf) permanece.
COMMON=(-v error -y -fflags +bitexact)

# 320x180 com rotação -90 (lido como 180x320), 1,5s, 60fps, H.265, lente 52mm
ffmpeg "${COMMON[@]}" -f lavfi -i testsrc2=size=320x180:rate=60 -t 1.5 -an \
  -c:v libx265 -x265-params log-level=error -pix_fmt yuv420p -tag:v hvc1 \
  -map_metadata -1 -metadata "com.blackmagic-design.camera.lensType=iPhone 14 Pro Max 52mm" \
  -movflags use_metadata_tags "$TMP/raw.mp4"
ffmpeg "${COMMON[@]}" -display_rotation:v:0 -90 -i "$TMP/raw.mp4" -c copy -map_metadata 0 \
  -movflags use_metadata_tags "$OUT/vertical-rotated-52mm.mp4"

# 180x320, 2s, H.265, sem lente e sem rotação
ffmpeg "${COMMON[@]}" -f lavfi -i testsrc2=size=180x320:rate=60 -t 2 -an \
  -c:v libx265 -x265-params log-level=error -pix_fmt yuv420p -tag:v hvc1 \
  -map_metadata -1 "$OUT/vertical-plain.mp4"

# só áudio, sem imagem
ffmpeg "${COMMON[@]}" -f lavfi -i sine=duration=1 -c:a aac -map_metadata -1 "$OUT/audio-only.mp4"

# arquivo cortado no meio
head -c 2000 "$OUT/vertical-plain.mp4" > "$OUT/truncated.mp4"

# texto puro com extensão de vídeo
printf 'isto não é um vídeo' > "$OUT/not-a-video.mp4"

# pasta de clipes para o e2e da fatia 2 (cópias; leiame.txt deve ser ignorado)
CLIPS="$OUT/clips-e2e"
mkdir -p "$CLIPS"
cp "$OUT/vertical-rotated-52mm.mp4" "$CLIPS/take1.mp4"
cp "$OUT/vertical-plain.mp4" "$CLIPS/take2a.mp4"
cp "$OUT/vertical-plain.mp4" "$CLIPS/take2c.mp4"
cp "$OUT/vertical-plain.mp4" "$CLIPS/take9.mp4"
printf 'arquivo que não é clipe' > "$CLIPS/leiame.txt"

echo "Fixtures geradas em $OUT"
