import { TasksPageClient } from "@/components/tasks/TasksPageClient";
import { getAccessibleProjectIds } from "@/lib/services/access-control.service";
import { taskService } from "@/lib/services/task.service";
import { requireServerSession } from "@/lib/server/session";

export default async function TasksPage(): Promise<JSX.Element> {
  const session = await requireServerSession("/tasks");
  const accessibleProjectIds =
    session.payload.role === "OWNER" || session.payload.role === "PM" ? undefined : await getAccessibleProjectIds(session.payload);
  const initialTasks = await taskService.listTasks(session.payload.tenantId, undefined, { accessibleProjectIds });

  return <TasksPageClient initialTasks={initialTasks} />;
}
