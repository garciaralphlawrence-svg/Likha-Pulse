import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Quotation from "../components/Quotation";
import { Empty, ErrorBox, Spinner } from "../components/ui";
import { useAsync } from "../lib/useAsync";

/** Staff view of the final quotation (printable). */
export default function QuotePage() {
  const { id } = useParams();
  const { data: r, loading, error } = useAsync(() => api.request(id!), [id]);
  if (loading) return <Spinner />;
  if (error || !r) return <ErrorBox error={error} />;
  return (
    <div className="mx-auto max-w-[860px]">
      <Link to={`/staff/requests/${r.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 print:hidden"><ArrowLeft className="h-4 w-4" />Back to the request</Link>
      {r.terms && r.offer ? (
        <Quotation q={{ customer: r.customer.name, input: r.input, rec: r.recommendation, option: r.offer.option, lines: r.offer.lines.map((l) => ({ label: l.label, detail: l.detail, price: l.price })), discount: r.offer.discount, total: r.offer.totals.price, per_person: r.offer.totals.per_person, notes: r.offer.notes, terms: r.terms }} />
      ) : <Empty title="No quotation yet">A quotation is issued once a travel agent approves the offer.</Empty>}
    </div>
  );
}
