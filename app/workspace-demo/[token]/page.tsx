import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isWorkspaceDemoToken } from "@/lib/utils/workspace-demo-token";

export default async function WorkspaceDemoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<never> {
  const { token } = await params;

  if (!isWorkspaceDemoToken(token)) {
    notFound();
  }

  const cookieStore = await cookies();
  cookieStore.set("workspaceDemoToken", token, {
    path: "/",
    sameSite: "lax",
  });

  redirect("/projects");
}
