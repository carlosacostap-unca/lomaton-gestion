import { AdminTeamList } from "../admin-team-list";

function value(input: string | string[] | undefined) {
  return typeof input === "string" ? input : "";
}

export default async function AdminTeamsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <AdminTeamList initialQuery={value(query.buscar)} initialStatus={value(query.estado)} />;
}
