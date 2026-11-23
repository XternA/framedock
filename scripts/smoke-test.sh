#!/usr/bin/env bash
set -euo pipefail

image=$1
platform=${2:-}
platform_option=()
if [[ -n $platform ]]; then
  platform_option=(--platform "$platform")
fi

volume=$(docker volume create)
container=
cleanup() {
  local status=$?
  if [[ -n $container ]]; then
    if (( status != 0 )); then
      docker logs "$container" >&2 || true
    fi
    docker rm -f "$container" >/dev/null || true
  fi
  docker volume rm "$volume" >/dev/null
}
trap cleanup EXIT

start_container() {
  container=$(docker run --detach "${platform_option[@]}" --cap-drop ALL --security-opt no-new-privileges:true --mount "type=volume,source=$volume,target=/data" \
    --publish 127.0.0.1::80 --publish 127.0.0.1::9640 "$image")
  base="http://$(docker port "$container" 80/tcp)"
  relay="http://$(docker port "$container" 9640/tcp)"
  curl --fail --silent --show-error --retry 15 --retry-all-errors --retry-delay 1 --retry-max-time 35 --max-time 5 "$base/" |
    grep -F '<title>FrameDock</title>'
}

echo "Starting FrameDock and checking the homepage"
start_container

echo "Saving a project and checking preview relay"
docker exec -d "$container" bun -e 'Bun.serve({ port: 3000, hostname: "127.0.0.1", fetch() { return new Response("<!doctype html><title>Preview fixture</title>", { headers: { "content-type": "text/html" } }) } });'
target=http://127.0.0.1:3000/
curl --fail --silent --show-error -H "Origin: $base" -H 'Content-Type: application/json' \
  --data '{"type":"project","editing":false,"project":{"id":"smoke","name":"Preview fixture","url":"http://127.0.0.1:3000/"}}' \
  "$base/api/workspace" | grep -F '"selectedId":"smoke"'
curl --fail --silent --show-error --get --data-urlencode "url=$target" "$base/api/relay" | grep -F '"port":9640'
curl --fail --silent --show-error --retry 6 --retry-all-errors --max-time 10 "$relay/" |
  grep -F '<title>Preview fixture</title>'

echo "Recreating the container and checking persisted workspace"
docker rm -f "$container" >/dev/null
container=
start_container
curl --fail --silent --show-error "$base/api/workspace" | grep -F '"selectedId":"smoke"'
docker exec "$container" bun -e 'process.stdout.write(await Bun.file("/app/LICENSE").text())' | cmp - LICENSE
docker exec "$container" bun -e '
  import { existsSync } from "node:fs";
  if (process.getuid() === 0) throw new Error("FrameDock must run as non-root");
  for (const path of ["/bin/sh", "/app/docs", "/app/dist/framedock-demo.webp"]) {
    if (existsSync(path)) throw new Error("Unexpected runtime file: " + path);
  }
'
