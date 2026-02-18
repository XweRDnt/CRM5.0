import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "@/lib/jobs/redis";

export interface CheckWorkflowsJobData {
  tenantId?: string;
  runAtIso?: string;
}

export const WORKFLOW_QUEUE_NAME = "workflow-reminders";
const CHECK_WORKFLOWS_JOB_NAME = "check-workflows";
type CheckWorkflowsJobName = typeof CHECK_WORKFLOWS_JOB_NAME;

export const workflowQueue = new Queue<CheckWorkflowsJobData, void, CheckWorkflowsJobName>(WORKFLOW_QUEUE_NAME, {
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

export async function addCheckWorkflowsJob(data: CheckWorkflowsJobData = {}): Promise<void> {
  if (process.env.NODE_ENV === "test" || process.env.REDIS_DISABLED === "true") {
    return;
  }
  await workflowQueue.add(CHECK_WORKFLOWS_JOB_NAME, data, { priority: 4 });
}

export async function scheduleWorkflowReminderJob(cronPattern = "0 * * * *"): Promise<void> {
  if (process.env.NODE_ENV === "test" || process.env.REDIS_DISABLED === "true") {
    return;
  }

  await workflowQueue.add(
    CHECK_WORKFLOWS_JOB_NAME,
    { runAtIso: new Date().toISOString() },
    {
      repeat: {
        pattern: cronPattern,
      },
      jobId: "workflow-reminder-schedule",
    },
  );
}
