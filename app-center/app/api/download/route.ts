import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
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

  const s3Response = await getS3().send(command);
  const filename = key.split("/").pop() ?? "download.apk";

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
