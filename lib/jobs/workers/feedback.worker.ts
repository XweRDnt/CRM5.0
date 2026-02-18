import { Job, Worker } from "bullmq";
import { handleParseFeedback } from "@/lib/jobs/handlers/parse-feedback.handler";
import { FEEDBACK_QUEUE_NAME, type ParseFeedbackJobData } from "@/lib/jobs/queues/feedback.queue";
import { getRedisConnectionOptions } from "@/lib/jobs/redis";

export const feedbackWorker = new Worker<ParseFeedbackJobData>(
  FEEDBACK_QUEUE_NAME,
  async (job: Job<ParseFeedbackJobData>) => {
    console.info(`[Feedback Worker] Processing job ${job.id}`);
    await handleParseFeedback(job.data);
  },
  {
    connection: getRedisConnectionOptions("worker"),
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 60_000,
    },
  },
);

feedbackWorker.on("completed", (job) => {
  console.info(`[Feedback Worker] Job ${job.id} completed`);
});

feedbackWorker.on("failed", (job, error) => {
  console.error(`[Feedback Worker] Job ${job?.id} failed`, error);
});
