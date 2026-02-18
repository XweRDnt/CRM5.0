import { Job, Worker } from "bullmq";
import { handleSendEmail } from "@/lib/jobs/handlers/send-email.handler";
import { EMAIL_QUEUE_NAME, type SendEmailJobData } from "@/lib/jobs/queues/email.queue";
import { getRedisConnectionOptions } from "@/lib/jobs/redis";

export const emailWorker = new Worker<SendEmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<SendEmailJobData>) => {
    console.info(`[Email Worker] Processing job ${job.id}`);
    await handleSendEmail(job.data);
  },
  {
    connection: getRedisConnectionOptions("worker"),
    concurrency: 4,
    limiter: {
      max: 30,
      duration: 60_000,
    },
  },
);
