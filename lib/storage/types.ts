/** Body shapes the upload route hands to a provider. */
export type StorageBody = ArrayBuffer | Uint8Array;

export type PutOptions = {
  /** MIME type to record on the object. */
  contentType?: string;
};

/**
 * Normalized upload result. Route handlers and the client see this same shape
 * whichever backend is active, so nothing downstream branches on the provider.
 */
export type StoredFile = {
  /** Absolute, browser-reachable URL. */
  url: string;
  /** Name the file was stored under; the UI uses it as the display name. */
  pathname: string;
  contentType: string;
};

export type StorageProviderName = "s3" | "vercel-blob";

export type StorageProvider = {
  readonly name: StorageProviderName;
  put: (
    pathname: string,
    body: StorageBody,
    options?: PutOptions
  ) => Promise<StoredFile>;
};
