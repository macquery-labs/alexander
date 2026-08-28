# syntax=docker/dockerfile:1

# Node 22 covers Next 16's supported runtime. libc6-compat is the glibc shim the
# prebuilt native binaries (SWC, lightningcss, biome) expect on musl.
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
# The repo installs husky git hooks on `pnpm install`; pointless in a container,
# and the entrypoint install would otherwise rewrite hooks in the bind-mounted .git.
ENV HUSKY=0
RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# Development image. Dependencies install in their own layer, ahead of the source
# copy, so editing a component does not reinstall them. They stay in this stage
# rather than a separate one because pnpm hardlinks node_modules from its store,
# and COPY --from across stages breaks those links — leaving the image without a
# store for the entrypoint to install against incrementally.
FROM base AS dev
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile \
  && md5sum package.json pnpm-lock.yaml | md5sum | cut -d' ' -f1 > node_modules/.deps-hash

# Source arrives over a bind mount at runtime; this copy only exists so the image
# is runnable on its own.
COPY . .
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["pnpm", "dev", "--hostname", "0.0.0.0"]
