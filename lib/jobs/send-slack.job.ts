import type { Job } from "bullmq";

export async function handleSendSlackJob(_job: Job): Promise<void> {
  throw new Error("Not implemented");
}
