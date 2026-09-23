import { redirect } from "next/navigation";

export default async function EditIndexPage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;
  redirect(`/edit/${trackId}/trim`);
}
