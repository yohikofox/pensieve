import { S3Client } from "@aws-sdk/client-s3";

// Initialisation lazy : le client n'est créé qu'à la première utilisation
// (au runtime, pas au build time) pour éviter les erreurs sur les variables
// d'environnement absentes pendant le build Docker.
let _s3: S3Client | null = null;

export function getS3(): S3Client {
  if (_s3) return _s3;

  if (!process.env.MINIO_ENDPOINT_URL) throw new Error("MINIO_ENDPOINT_URL is required");
  if (!process.env.MINIO_ACCESS_KEY) throw new Error("MINIO_ACCESS_KEY is required");
  if (!process.env.MINIO_SECRET_KEY) throw new Error("MINIO_SECRET_KEY is required");

  _s3 = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT_URL,
    region: process.env.MINIO_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY,
      secretAccessKey: process.env.MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
  });

  return _s3;
}

export const BUCKET = () => process.env.MINIO_BUCKET ?? "pensine-apks";
