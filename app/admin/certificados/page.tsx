import { AdminCertificateReviewQueue } from "../admin-certificate-review-queue";

const statuses = new Set(["pending", "approved", "rejected"]);

function value(input: string | string[] | undefined) {
  return typeof input === "string" ? input : "";
}

export default async function AdminCertificatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const requestedStatus = value(query.estado);
  const requestedPage = Number(value(query.pagina));
  return (
    <AdminCertificateReviewQueue
      initialStatus={statuses.has(requestedStatus) ? requestedStatus as "pending" | "approved" | "rejected" : "pending"}
      initialPage={Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1}
      initialCandidateId={value(query.candidato)}
    />
  );
}
