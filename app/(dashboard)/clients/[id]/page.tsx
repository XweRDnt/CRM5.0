import { redirect } from "next/navigation";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }): Promise<never> {
  const { id } = await params;
  redirect(`/clients/${id}/edit`);
}
