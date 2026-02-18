import type { SendEmailJobData } from "@/lib/jobs/queues/email.queue";

export async function handleSendEmail(data: SendEmailJobData): Promise<void> {
  console.info(`[Send Email Job] Placeholder handler for recipient ${data.to}`);
}
