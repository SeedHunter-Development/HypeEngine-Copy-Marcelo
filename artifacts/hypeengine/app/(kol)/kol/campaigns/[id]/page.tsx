import KolCampaignDetail from "./KolCampaignDetail";

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <KolCampaignDetail params={params} />;
}
