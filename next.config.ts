import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const basePath = process.env.IS_DEMO === "1" ? "/demo" : "";

/**
 * The bundled MinIO answers to two different addresses — minio:9000 on the
 * compose network, localhost:9000 from the browser — and next/image needs one
 * URL that works from both, because the optimizer fetches the upstream image
 * server-side. Proxying the bucket under the app's own origin gives it that.
 * Left unset in production, where a bucket has a single public address.
 */
const storageProxy = (() => {
  const path = process.env.S3_PROXY_PATH;
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;

  if (!(path && endpoint && bucket)) {
    return null;
  }

  return {
    destination: `${endpoint.replace(/\/+$/, "")}/${bucket}/:path*`,
    source: `${path}/:path*`,
  };
})();

/**
 * next/image only loads remote hosts declared up front, and the storage host is
 * configuration rather than a constant: MinIO on localhost in development, a
 * bucket or CDN domain in production. Derive it from the same variables the S3
 * provider reads so the two cannot drift apart.
 */
const storageRemotePatterns = (() => {
  const configured = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT;

  if (!configured) {
    return [];
  }

  try {
    const { hostname, port, protocol } = new URL(configured);

    return [
      {
        hostname,
        protocol:
          protocol === "https:" ? ("https" as const) : ("http" as const),
        ...(port ? { port } : {}),
      },
    ];
  } catch {
    return [];
  }
})();

/**
 * next/image refuses to fetch upstream images that resolve to a private IP,
 * which the bundled MinIO always will. Lift that only for local development,
 * and only when the configured storage host is genuinely a loopback address.
 */
const allowsLocalImages =
  process.env.NODE_ENV !== "production" &&
  storageRemotePatterns.some(
    ({ hostname }) => hostname === "localhost" || hostname === "127.0.0.1"
  );

const nextConfig: NextConfig = {
  ...(storageProxy ? { rewrites: () => Promise.resolve([storageProxy]) } : {}),
  ...(basePath
    ? {
        assetPrefix: "/demo-assets",
        basePath,
        redirects: async () => [
          {
            basePath: false,
            destination: basePath,
            permanent: false,
            source: "/",
          },
        ],
      }
    : {}),
  cacheComponents: true,
  devIndicators: false,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  experimental: {
    appNewScrollHandler: true,
    cachedNavigations: true,
    inlineCss: true,
    prefetchInlining: true,
    turbopackFileSystemCacheForDev: true,
  },
  images: {
    ...(allowsLocalImages ? { dangerouslyAllowLocalIP: true } : {}),
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        hostname: "*.public.blob.vercel-storage.com",
        protocol: "https",
      },
      ...storageRemotePatterns,
    ],
  },
  logging: {
    fetches: {
      fullUrl: false,
    },
    incomingRequests: false,
  },
  poweredByHeader: false,
  reactCompiler: true,
};

export default withBotId(nextConfig);
