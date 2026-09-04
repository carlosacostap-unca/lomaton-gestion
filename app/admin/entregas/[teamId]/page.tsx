import { AdminDeliverableDetail } from "../../admin-deliverable-detail";

export default async function AdminDeliverableDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <AdminDeliverableDetail teamId={teamId} />;
}
