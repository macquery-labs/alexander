import { put } from "@vercel/blob";
import type {
  PutOptions,
  StorageBody,
  StorageProvider,
  StoredFile,
} from "./types";

/** @vercel/blob does not accept a bare ArrayBuffer or Uint8Array. */
function toBuffer(body: StorageBody): Buffer {
  return Buffer.from(body instanceof Uint8Array ? body : new Uint8Array(body));
}

/**
 * Vercel Blob backend. Used on Vercel deployments, where the token is injected
 * by the Blob integration.
 */
export function createVercelBlobProvider(): StorageProvider {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'Storage provider "vercel-blob" needs BLOB_READ_WRITE_TOKEN. Set it, or set STORAGE_PROVIDER=s3 to use an S3-compatible bucket instead.'
    );
  }

  return {
    name: "vercel-blob",
    async put(
      pathname: string,
      body: StorageBody,
      options?: PutOptions
    ): Promise<StoredFile> {
      const blob = await put(pathname, toBuffer(body), {
        access: "public",
        ...(options?.contentType === undefined
          ? {}
          : { contentType: options.contentType }),
      });

      return {
        contentType:
          blob.contentType ??
          options?.contentType ??
          "application/octet-stream",
        pathname: blob.pathname,
        url: blob.url,
      };
    },
  };
}
