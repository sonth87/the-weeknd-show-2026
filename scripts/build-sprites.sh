#!/usr/bin/env bash
set -euo pipefail

CLIP1="resources/Character_animating_through_360_…_20261022102002.mp4"
CLIP2="resources/Character_looking_around_360_deg…_20261022101910.mp4"

mkdir -p public/sprites/clip1/frames
mkdir -p public/sprites/clip2/frames

echo "=== [1/4] Extracting all 240 frames from Clip 1 with FFmpeg ==="
ffmpeg -y -v error -i "$CLIP1" -vf "scale=540:960" -q:v 4 "public/sprites/clip1/frames/frame_%03d.jpg"

echo "=== [2/4] Assembling Clip 1 frames into one horizontal sprite sheet (240x1) ==="
ffmpeg -y -v error -i "public/sprites/clip1/frames/frame_%03d.jpg" \
  -vf "scale=270:480,tile=240x1" -frames:v 1 -update 1 -q:v 4 \
  "public/sprites/clip1/sprite-sheet.jpg"

# Also generate a 12,960px (<16,384px GPU texture limit) horizontal sprite sheet for instant GPU texture scrubbing
ffmpeg -y -v error -i "$CLIP1" \
  -vf "select='lt(n\,192)*not(mod(n\,2))',scale=135:240,tile=96x1" -frames:v 1 -update 1 -q:v 4 \
  "public/sprites/clip1/sprite-strip-preview.jpg"

echo "=== [3/4] Extracting all 240 frames from Clip 2 with FFmpeg ==="
ffmpeg -y -v error -i "$CLIP2" -vf "scale=540:960" -q:v 4 "public/sprites/clip2/frames/frame_%03d.jpg"

echo "=== [4/4] Assembling Clip 2 frames into one horizontal sprite sheet (240x1) ==="
ffmpeg -y -v error -i "public/sprites/clip2/frames/frame_%03d.jpg" \
  -vf "scale=270:480,tile=240x1" -frames:v 1 -update 1 -q:v 4 \
  "public/sprites/clip2/sprite-sheet.jpg"

ffmpeg -y -v error -i "$CLIP2" \
  -vf "select='lt(n\,192)*not(mod(n\,2))',scale=135:240,tile=96x1" -frames:v 1 -update 1 -q:v 4 \
  "public/sprites/clip2/sprite-strip-preview.jpg"

echo "=== Done! Sprite sheets and frame sequences generated in public/sprites/ ==="
