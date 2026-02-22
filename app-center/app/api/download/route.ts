import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3, BUCKET } from "@/lib/minio-client";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
  }

  // Sécurité : empêcher les path traversal
  if (key.includes("..") || key.startsWith("/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET(),
    Key: key,
  });

  const presignedUrl = await getSignedUrl(getS3(), command, { expiresIn: 3600 });

  return NextResponse.redirect(presignedUrl);
}
