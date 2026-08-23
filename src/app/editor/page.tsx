import EditorShell from "./EditorShell";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; template?: string }>;
}) {
  const { item, template } = await searchParams;
  return <EditorShell itemIdRaw={item} templateId={template} />;
}
