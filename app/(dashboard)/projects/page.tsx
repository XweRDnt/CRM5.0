import { ProjectsPageClient } from "@/components/projects/ProjectsPageClient";
import { projectService } from "@/lib/services/project.service";
import { requireServerSession } from "@/lib/server/session";

export default async function ProjectsPage(): Promise<JSX.Element> {
  const session = await requireServerSession("/projects");
  const initialProjects = await projectService.listProjects(session.payload.tenantId, undefined, session.payload);

  return <ProjectsPageClient initialProjects={initialProjects} user={session.user} />;
}
