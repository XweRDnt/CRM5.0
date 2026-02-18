import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "@/lib/jobs/redis";

export interface SendEmailJobData {
  tenantId: string;
  to: string;
  subject: string;
  body: string;
  templateKey?: string;
}

export const EMAIL_QUEUE_NAME = "email-delivery";
const SEND_EMAIL_JOB_NAME = "send-email";
type SendEmailJobName = typeof SEND_EMAIL_JOB_NAME;

export const emailQueue = new Queue<SendEmailJobData, void, SendEmailJobName>(EMAIL_QUEUE_NAME, {
  connection: getRedisConnectionOptions("queue"),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 2000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
    },
  },
});

export async function addSendEmailJob(data: SendEmailJobData): Promise<void> {
  if (process.env.NODE_ENV === "test" || process.env.REDIS_DISABLED === "true") {
    return;
  }
  await emailQueue.add(SEND_EMAIL_JOB_NAME, data, { priority: 3 });
}
