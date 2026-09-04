import "server-only";

import type PocketBase from "pocketbase";

import { getAuthorizedDeliverableFile } from "@/lib/domain/team-deliverables";
import type { LomatonUser } from "@/lib/pocketbase/server";
import type { TeamDeliverableKind } from "@/lib/team-deliverables-contract";

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/[\r\n"]/g, "_");
  return `attachment; filename="${fallback || "archivo"}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function proxyDeliverableFile(
  pb: PocketBase,
  user: LomatonUser,
  teamId: string,
  kind: TeamDeliverableKind,
) {
  const file = await getAuthorizedDeliverableFile(pb, user, teamId, kind);
  const upstream = await fetch(file.url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response("El archivo no está disponible.", { status: upstream.status || 502 });
  }
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": contentDisposition(file.originalName),
    "Content-Type": file.mimeType,
    "X-Content-Type-Options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(upstream.body, { status: 200, headers });
}
