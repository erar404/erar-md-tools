import { ToolChooser } from "@/components/edit/tool-chooser";

export default async function EditIndexPage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold text-foreground">What do you want to do?</h1>
        <p className="text-sm text-muted-foreground">Pick a tool to start working with this track.</p>
      </div>
      <ToolChooser trackId={trackId} />
    </div>
  );
}
