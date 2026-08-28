import { MetricDetail } from "@/components/MetricDetail";
import { METRICS } from "@/lib/metrics";

export function generateStaticParams() {
  return METRICS.map((m) => ({ id: m.id }));
}

export default async function MetricPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MetricDetail metricId={id} />;
}
