import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getS3, BUCKET } from "@/lib/minio-client";

interface BuildMetadata {
  version: string;
  buildDate: string;
  gitSha: string;
  size: number;
}

interface Build {
  version: string;
  apkKey: string;
  metadataKey: string;
  metadata?: BuildMetadata;
  apkSize?: number;
}

async function listBuilds(): Promise<Build[]> {
  const s3 = getS3();
  const bucket = BUCKET();

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: "pensine/mobile/",
    Delimiter: "/",
  });

  const response = await s3.send(command);
  const prefixes = response.CommonPrefixes ?? [];

  const builds: Build[] = [];

  for (const prefix of prefixes) {
    if (!prefix.Prefix) continue;

    const versionDir = prefix.Prefix;
    const version = versionDir.replace("pensine/mobile/", "").replace("/", "");

    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: versionDir,
    });

    const objects = await s3.send(listCommand);
    const items = objects.Contents ?? [];

    const apkObj = items.find((o) => o.Key?.endsWith(".apk"));
    const metaObj = items.find((o) => o.Key?.endsWith("metadata.json"));

    if (!apkObj?.Key) continue;

    const build: Build = {
      version,
      apkKey: apkObj.Key,
      metadataKey: metaObj?.Key ?? "",
      apkSize: apkObj.Size,
    };

    if (metaObj?.Key) {
      try {
        const { GetObjectCommand } = await import("@aws-sdk/client-s3");
        const metaCmd = new GetObjectCommand({ Bucket: bucket, Key: metaObj.Key });
        const metaRes = await s3.send(metaCmd);
        const body = await metaRes.Body?.transformToString();
        if (body) {
          build.metadata = JSON.parse(body) as BuildMetadata;
        }
      } catch {
        // metadata optionnelle
      }
    }

    builds.push(build);
  }

  return builds.sort((a, b) => b.version.localeCompare(a.version));
}

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} Mo`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function HomePage() {
  let builds: Build[] = [];
  let error: string | null = null;

  try {
    builds = await listBuilds();
  } catch (e) {
    error = e instanceof Error ? e.message : "Erreur lors de la récupération des builds.";
  }

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pensine App Center</h1>
            <p className="text-sm text-gray-500">Distribution interne — Android APK</p>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
            {error}
          </div>
        )}

        {builds.length === 0 && !error && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">Aucun build disponible</p>
            <p className="text-sm mt-1">Lancez <code className="bg-gray-100 px-1 rounded">build-and-push.sh</code> pour publier un APK.</p>
          </div>
        )}

        {builds.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              {builds.length} build{builds.length > 1 ? "s" : ""} disponible{builds.length > 1 ? "s" : ""}
            </h2>

            {builds.map((build) => (
              <div
                key={build.version}
                className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between hover:border-primary-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {build.version}
                    </span>
                    {build.metadata?.gitSha && (
                      <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">
                        {build.metadata.gitSha.slice(0, 7)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 flex gap-4">
                    <span>{formatDate(build.metadata?.buildDate)}</span>
                    <span>{formatSize(build.apkSize)}</span>
                  </div>
                </div>

                <a
                  href={`/api/download?key=${encodeURIComponent(build.apkKey)}`}
                  className="ml-4 flex-shrink-0 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  Télécharger APK
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
