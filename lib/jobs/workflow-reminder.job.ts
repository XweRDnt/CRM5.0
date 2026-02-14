import type { Job } from "bullmq";

export async function handleWorkflowReminderJob(_job: Job): Promise<void> {
  throw new Error("Not implemented");
}
