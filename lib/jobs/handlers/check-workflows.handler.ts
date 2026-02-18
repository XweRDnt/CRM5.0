import type { CheckWorkflowsJobData } from "@/lib/jobs/queues/workflow.queue";

export async function handleCheckWorkflows(data: CheckWorkflowsJobData): Promise<void> {
  const tenantPart = data.tenantId ? ` for tenant ${data.tenantId}` : "";
  console.info(`[Workflow Reminder Job] Placeholder handler${tenantPart}`);
}
