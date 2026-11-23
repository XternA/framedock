# Build stage
FROM oven/bun:1.4.4 AS build

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY index.html tsconfig.json *.config.js ./
COPY src ./src
COPY public ./public

RUN bun run build
RUN bun -e 'for await (const path of new Bun.Glob("dist/assets/*.{js,css}").scan()) { await Bun.write(path + ".gz", Bun.gzipSync(await Bun.file(path).arrayBuffer())); }'

COPY *.ts ./
RUN mkdir -p /runtime/app/src /runtime/data \
    && cp -R dist *.ts /runtime/app/ \
    && cp src/workspace.ts /runtime/app/src/

# Final image
FROM oven/bun:1.4.4-distroless

WORKDIR /app
COPY --from=build /runtime/app/ ./
COPY LICENSE ./
COPY --from=build --chown=1000:1000 /runtime/data/ /data/

USER 1000:1000
CMD ["server.ts"]
