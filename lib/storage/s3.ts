import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { generateUUID } from "@/lib/utils";
import type {
  PutOptions,
  StorageBody,
  StorageProvider,
  StoredFile,
} from "./types";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const TRAILING_SLASHES = /\/+$/;

type S3Config = {
  accessKeyId: string;
  bucket: string;
  endpoint: string | undefined;
  forcePathStyle: boolean;
  keyPrefix: string;
  publicUrl: string | undefined;
  region: string;
  secretAccessKey: string;
};

function required(
  name: "S3_ACCESS_KEY_ID" | "S3_BUCKET" | "S3_SECRET_ACCESS_KEY"
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Storage provider "s3" needs ${name}. docker-compose.yml sets these for the bundled MinIO; see .env.docker.example.`
    );
  }

  return value;
}

function readConfig(): S3Config {
  const prefix = process.env.S3_KEY_PREFIX ?? "";

  return {
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    bucket: required("S3_BUCKET"),
    endpoint: process.env.S3_ENDPOINT,
    // MinIO and most non-AWS implementations only serve path-style addressing.
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    keyPrefix: prefix && !prefix.endsWith("/") ? `${prefix}/` : prefix,
    publicUrl: process.env.S3_PUBLIC_URL?.replace(TRAILING_SLASHES, ""),
    region: process.env.S3_REGION ?? "us-east-1",
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  };
}

/**
 * The URL handed to the browser, which is not always the endpoint the server
 * uploads through: in Docker the app reaches MinIO at http://minio:9000 while
 * the browser has to use http://localhost:9000. S3_PUBLIC_URL covers that split,
 * and doubles as the hook for a CDN or custom domain in production.
 */
function publicUrlFor(config: S3Config, key: string): string {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");

  if (config.publicUrl) {
    return `${config.publicUrl}/${encodedKey}`;
  }

  if (config.endpoint) {
    const base = config.endpoint.replace(TRAILING_SLASHES, "");

    return config.forcePathStyle
      ? `${base}/${config.bucket}/${encodedKey}`
      : `${base}/${encodedKey}`;
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodedKey}`;
}

function toBytes(body: StorageBody): Uint8Array {
  return body instanceof Uint8Array ? body : new Uint8Array(body);
}

/**
 * S3-compatible backend: MinIO locally, and AWS S3, Cloudflare R2 or any other
 * S3 API in production.
 */
export function createS3Provider(): StorageProvider {
  const config = readConfig();

  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
    region: config.region,
    ...(config.endpoint === undefined ? {} : { endpoint: config.endpoint }),
  });

  return {
    name: "s3",
    async put(
      pathname: string,
      body: StorageBody,
      options?: PutOptions
    ): Promise<StoredFile> {
      const contentType = options?.contentType ?? DEFAULT_CONTENT_TYPE;
      // The uuid segment keeps two uploads of the same filename from
      // overwriting each other, which is what Vercel Blob's random suffix does.
      const key = `${config.keyPrefix}${generateUUID()}/${pathname}`;

      await client.send(
        new PutObjectCommand({
          Body: toBytes(body),
          Bucket: config.bucket,
          ContentType: contentType,
          Key: key,
        })
      );

      return {
        contentType,
        pathname,
        url: publicUrlFor(config, key),
      };
    },
  };
}
