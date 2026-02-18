import { Job, Worker } from "bullmq";
import { handleCheckWorkflows } from "@/lib/jobs/handlers/check-workflows.handler";
import { WORKFLOW_QUEUE_NAME, type CheckWorkflowsJobData } from "@/lib/jobs/queues/workflow.queue";
import { getRedisConnectionOptions } from "@/lib/jobs/redis";

export const workflowWorker = new Worker<CheckWorkflowsJobData>(
  WORKFLOW_QUEUE_NAME,
  async (job: Job<CheckWorkflowsJobData>) => {
    console.info(`[Workflow Worker] Processing job ${job.id}`);
    await handleCheckWorkflows(job.data);
  },
  {
    connection: getRedisConnectionOptions("worker"),
    concurrency: 1,
    limiter: {
      max: 6,
      duration: 60_000,
    },
  },
);
