import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3, BUCKET } from "@/lib/minio-client";

interface BuildMetadata {
  gitSha?: string;
}

async function resolveFilename(key: string): Promise<string> {
  const dir = key.substring(0, key.lastIndexOf("/") + 1);
  const metadataKey = `${dir}metadata.json`;

  try {
    const metaCmd = new GetObjectCommand({ Bucket: BUCKET(), Key: metadataKey });
    const metaRes = await getS3().send(metaCmd);
    const body = await metaRes.Body?.transformToString();
    if (body) {
      const metadata = JSON.parse(body) as BuildMetadata;
      if (metadata.gitSha) {
        return `com.pensine.app-${metadata.gitSha.slice(0, 7)}.apk`;
      }
    }
  } catch {
    // metadata absente ou invalide, fallback sur le nom du fichier
  }

  return key.split("/").pop() ?? "download.apk";
}

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

  const [s3Response, filename] = await Promise.all([
    getS3().send(command),
    resolveFilename(key),
  ]);

  return new Response(s3Response.Body?.transformToWebStream(), {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...(s3Response.ContentLength && {
        "Content-Length": String(s3Response.ContentLength),
      }),
    },
  });
}
