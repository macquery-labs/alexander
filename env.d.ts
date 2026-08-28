/**
 * Environment variables this app reads.
 *
 * Declaring them here does two things that `process.env` alone cannot:
 * dot access keeps working under `noPropertyAccessFromIndexSignature`, and
 * any variable *not* listed becomes a compile error at the access site — so a
 * typo like `process.env.POSTGRES_URI` fails the build instead of being
 * silently `undefined`.
 *
 * Every entry is optional on purpose: nothing here is guaranteed to be set at
 * runtime, so call sites must keep handling `undefined`.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /** Vercel AI Gateway key. Unused on Vercel, which supplies OIDC instead. */
    AI_GATEWAY_API_KEY?: string;
    /** Auth.js signing secret. See .env.example. */
    AUTH_SECRET?: string;
    /** Vercel Blob read/write token, for file uploads. */
    BLOB_READ_WRITE_TOKEN?: string;
    CI?: string;
    CI_PLAYWRIGHT?: string;

    /** "1" when running the public demo deployment. */
    IS_DEMO?: string;
    /** Injected by next.config.ts; "" or "/demo". */
    NEXT_PUBLIC_BASE_PATH?: string;

    /** Set by Playwright and by CI; see lib/constants.ts. */
    PLAYWRIGHT?: string;
    PLAYWRIGHT_TEST_BASE_URL?: string;
    PORT?: string;
    /** Postgres connection string. */
    POSTGRES_URL?: string;
    /** Redis connection string. Absent means resumable streams are disabled. */
    REDIS_URL?: string;
    S3_ACCESS_KEY_ID?: string;
    /** Bucket that uploads are written to. */
    S3_BUCKET?: string;
    /** Server-side API endpoint. Omit for real AWS S3. */
    S3_ENDPOINT?: string;
    /** "true" for MinIO and most non-AWS implementations. */
    S3_FORCE_PATH_STYLE?: string;
    /** Optional folder prefix for uploaded keys. */
    S3_KEY_PREFIX?: string;
    /** Path under which next.config.ts proxies the bucket, e.g. "/storage". */
    S3_PROXY_PATH?: string;
    /** Bucket root as the *browser* sees it, when that differs from S3_ENDPOINT. */
    S3_PUBLIC_URL?: string;
    /** Defaults to us-east-1; MinIO ignores it but the SDK requires one. */
    S3_REGION?: string;
    S3_SECRET_ACCESS_KEY?: string;

    /** Upload backend: "s3" or "vercel-blob". Inferred from S3_BUCKET if unset. */
    STORAGE_PROVIDER?: string;
  }
}
