import { notFound, redirect } from "next/navigation";

import { isDemoToken } from "@/lib/utils/demo-token";

export default async function DemoRedirectPage({ params }: { params: Promise<{ token: string }> }): Promise<never> {
  const { token } = await params;

  if (!isDemoToken(token)) {
    return notFound();
  }

  redirect(`/client-portal/${token}?readonly=true`);
}
