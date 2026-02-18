import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "@/lib/jobs/redis";

export interface AnalyzeScopeJobData {
  tenantId: string;
  projectId: string;
  feedbackId: string;
}

export const SCOPE_QUEUE_NAME = "scope-analysis";
const ANALYZE_SCOPE_JOB_NAME = "analyze-scope";
type AnalyzeScopeJobName = typeof ANALYZE_SCOPE_JOB_NAME;

export const scopeQueue = new Queue<AnalyzeScopeJobData, void, AnalyzeScopeJobName>(SCOPE_QUEUE_NAME, {
  connection: getRedisConnectionOptions("queue"),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
    },
  },
});

export async function addAnalyzeScopeJob(data: AnalyzeScopeJobData): Promise<void> {
  if (process.env.NODE_ENV === "test" || process.env.REDIS_DISABLED === "true") {
    return;
  }
  await scopeQueue.add(ANALYZE_SCOPE_JOB_NAME, data, { priority: 2 });
}
