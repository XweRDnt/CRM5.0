import type { Job } from "bullmq";

export async function handleSendEmailJob(_job: Job): Promise<void> {
  throw new Error("Not implemented");
}
