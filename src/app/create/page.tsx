import CreateStudio from "./CreateStudio";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const { channel } = await searchParams;
  return <CreateStudio initialChannel={channel} />;
}
