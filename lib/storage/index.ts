import "server-only";

import { createS3Provider } from "./s3";
import type { StorageProvider, StorageProviderName } from "./types";
import { createVercelBlobProvider } from "./vercel-blob";

function selectProviderName(): StorageProviderName {
  const configured = process.env.STORAGE_PROVIDER;

  if (configured === "s3" || configured === "vercel-blob") {
    return configured;
  }

  if (configured) {
    throw new Error(
      `Unknown STORAGE_PROVIDER "${configured}". Expected "s3" or "vercel-blob".`
    );
  }

  // Nothing declared: infer from whichever backend has been configured, so a
  // Vercel deployment keeps working with only its Blob token set.
  return process.env.S3_BUCKET ? "s3" : "vercel-blob";
}

let provider: StorageProvider | null = null;

/**
 * The active storage backend. Construction is lazy and cached so that importing
 * this module never throws at build time on a missing credential.
 */
export function getStorageProvider(): StorageProvider {
  provider ??=
    selectProviderName() === "s3"
      ? createS3Provider()
      : createVercelBlobProvider();

  return provider;
}
