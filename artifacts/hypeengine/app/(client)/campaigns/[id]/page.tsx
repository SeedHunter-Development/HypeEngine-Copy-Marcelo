import ClientCampaignDetail from "./ClientCampaignDetail";

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ClientCampaignDetail params={params} />;
}
