import Link from "next/link";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessibleProjectIds } from "@/lib/services/access-control.service";
import { projectService } from "@/lib/services/project.service";
import { taskService } from "@/lib/services/task.service";
import { requireServerSession } from "@/lib/server/session";

export default async function DashboardPage(): Promise<JSX.Element> {
  const session = await requireServerSession("/dashboard");
  const accessibleProjectIds =
    session.payload.role === "OWNER" || session.payload.role === "PM" ? undefined : await getAccessibleProjectIds(session.payload);

  const [projects, tasks] = await Promise.all([
    projectService.listProjects(session.payload.tenantId, undefined, session.payload),
    taskService.listTasks(session.payload.tenantId, undefined, { accessibleProjectIds }),
  ]);

  const openTasks = tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button asChild>
          <Link href="/projects/new">New Project</Link>
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="space-y-0 border-b border-neutral-200 px-4 pb-2 pt-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Projects</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-3">
            <p className="text-3xl font-semibold">{projects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 border-b border-neutral-200 px-4 pb-2 pt-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Open Tasks</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-3">
            <p className="text-3xl font-semibold">{openTasks}</p>
          </CardContent>
        </Card>
      </section>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-sm text-neutral-500">No projects yet.</p>
            <Button asChild>
              <Link href="/projects/new">Create your first project</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
