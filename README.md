<a href="https://chatbot.ai-sdk.dev/demo">
  <img alt="Chatbot" src="app/(chat)/opengraph-image.png">
  <h1 align="center">Chatbot</h1>
</a>

<p align="center">
    Chatbot (formerly AI Chatbot) is a free, open-source template built with Next.js and the AI SDK that helps you quickly build powerful chatbot applications.
</p>

<p align="center">
  <a href="https://chatbot.ai-sdk.dev/docs"><strong>Read Docs</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://ai-sdk.dev/docs/introduction)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports OpenAI, Anthropic, Google, xAI, and other model providers via AI Gateway
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Neon Serverless Postgres](https://vercel.com/marketplace/neon) for saving chat history and user data
  - [Vercel Blob](https://vercel.com/storage/blob) for efficient file storage
- [Auth.js](https://authjs.dev)
  - Simple and secure authentication

## Model Providers

This template uses the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) to access multiple AI models through a unified interface. Models are configured in `lib/ai/models.ts` with per-model provider routing. Included models: Mistral, Moonshot, DeepSeek, OpenAI, and xAI.

### AI Gateway Authentication

**For Vercel deployments**: Authentication is handled automatically via OIDC tokens.

**For non-Vercel deployments**: You need to provide an AI Gateway API key by setting the `AI_GATEWAY_API_KEY` environment variable in your `.env.local` file.

With the [AI SDK](https://ai-sdk.dev/docs/introduction), you can also switch to direct LLM providers like [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://ai-sdk.dev/providers/ai-sdk-providers) with just a few lines of code.

## Deploy Your Own

You can deploy your own version of Chatbot to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/templates/next.js/chatbot)

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Chatbot. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm db:migrate # Setup database or apply latest database changes
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000).

## Running the whole stack with Docker

The compose stack brings up the app plus everything it stores data in — Postgres,
Redis and an S3-compatible bucket — so nothing outside Docker needs to be
installed and no Vercel account is required:

```bash
docker compose up
```

That builds the app image, waits for the backing services to report healthy,
creates the uploads bucket, applies `lib/db/migrations`, then starts `next dev` on
[localhost:3000](http://localhost:3000). The source tree is bind-mounted, so edits
on the host hot-reload in the container; `node_modules` and `.next` live in named
volumes so the container's Linux builds never collide with the host's.

### File storage

Uploads go through a provider interface in [`lib/storage`](lib/storage) rather than
straight to Vercel Blob:

| Provider | Selected by | Used for |
| --- | --- | --- |
| `s3` | `STORAGE_PROVIDER=s3`, or any `S3_BUCKET` being set | MinIO locally; AWS S3, Cloudflare R2 or any S3 API in production |
| `vercel-blob` | `STORAGE_PROVIDER=vercel-blob`, or neither being set | Vercel deployments |

Compose defaults to `s3` and points it at the bundled MinIO, so image attachments
work out of the box. The MinIO console is at
[localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin`).

Writes and reads take different routes locally. The app uploads straight to MinIO
over the compose network (`S3_ENDPOINT`), while reads come back through the app's
own origin at `/storage/...`, which `next.config.ts` rewrites to the bucket. That
indirection is there because `next/image` fetches the upstream image server-side:
a `localhost:9000` URL would send the optimizer to the app container rather than
to MinIO. In production, leave `S3_PROXY_PATH` unset and point `S3_PUBLIC_URL` at
the bucket or a CDN domain.

### Credentials

Every value has a working default, so `docker compose up` boots on a fresh clone
with no configuration. Copy [`.env.docker.example`](.env.docker.example) to `.env`
to override any of them.

One thing still reaches outside Docker: **`AI_GATEWAY_API_KEY`**, needed for real
model responses. Without it the chat route streams back an error. Set
`MOCK_AI=True` instead to serve canned replies from `lib/ai/models.mock.ts`;
everything else (auth, chat persistence, history, uploads, artifacts) works
normally.

### Common commands

```bash
docker compose up -d                    # start in the background
docker compose logs -f app              # tail the dev server
docker compose exec app pnpm check      # lint inside the container
docker compose exec postgres psql -U chatbot chatbot
docker compose run --rm migrate         # re-apply migrations
docker compose --profile tools up -d adminer   # DB browser on :8080
docker compose down                     # stop; add -v to also drop the data
```

Installing a dependency needs a one-off container rather than `exec`, so pnpm does
not pull `node_modules` out from under the running dev server:

```bash
docker compose stop app
docker compose run --rm --no-deps --entrypoint sh app -c 'pnpm add <package>'
docker compose up -d app
```

Postgres, Redis and MinIO are published on the host at 5432, 6379 and 9000, so
`pnpm db:studio` and other host-side tooling can reach them. Set `PORT`,
`POSTGRES_PORT`, `REDIS_PORT` or `MINIO_PORT` in `.env` if those are taken.

> Note: the compose stack runs `next dev`. A production build served over plain
> HTTP would set `__Secure-` auth cookies that the browser drops on `localhost`,
> so `next start` is left to real deployments.
