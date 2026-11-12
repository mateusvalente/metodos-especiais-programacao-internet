FROM node:22-alpine
# FFmpeg gera as três variantes HLS. O código das aplicações entra por volume.
RUN apk add --no-cache ffmpeg
EXPOSE 3000
