import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.MINIO_ENDPOINT_URL) {
  throw new Error("MINIO_ENDPOINT_URL is required");
}
if (!process.env.MINIO_ACCESS_KEY) {
  throw new Error("MINIO_ACCESS_KEY is required");
}
if (!process.env.MINIO_SECRET_KEY) {
  throw new Error("MINIO_SECRET_KEY is required");
}

export const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT_URL,
  region: process.env.MINIO_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

export const BUCKET = process.env.MINIO_BUCKET ?? "pensine-apks";
