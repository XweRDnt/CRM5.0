import { Job, Worker } from "bullmq";
import { handleAnalyzeScope } from "@/lib/jobs/handlers/analyze-scope.handler";
import { SCOPE_QUEUE_NAME, type AnalyzeScopeJobData } from "@/lib/jobs/queues/scope.queue";
import { getRedisConnectionOptions } from "@/lib/jobs/redis";

export const scopeWorker = new Worker<AnalyzeScopeJobData>(
  SCOPE_QUEUE_NAME,
  async (job: Job<AnalyzeScopeJobData>) => {
    console.info(`[Scope Worker] Processing job ${job.id}`);
    await handleAnalyzeScope(job.data);
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
