import { AdminTeamManager } from "../../admin-team-manager";

function value(input: string | string[] | undefined) {
  return typeof input === "string" ? input : "";
}

export default async function AdminTeamDetailPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ teamId }, query] = await Promise.all([params, searchParams]);
  const backParams = new URLSearchParams();
  const search = value(query.buscar);
  const status = value(query.estado);
  if (search) backParams.set("buscar", search);
  if (status) backParams.set("estado", status);
  return <AdminTeamManager teamId={teamId} backHref={`/admin/equipos${backParams.size ? `?${backParams}` : ""}`} />;
}
