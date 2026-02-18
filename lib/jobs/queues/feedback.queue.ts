import { Job, Queue } from "bullmq";
import { getRedisConnectionOptions } from "@/lib/jobs/redis";

export interface ParseFeedbackJobData {
  tenantId: string;
  projectId: string;
  feedbackIds: string[];
}

const QUEUE_NAME = "feedback-processing";
const JOB_NAME = "parse-feedback";
type ParseFeedbackJobName = typeof JOB_NAME;

let queue: Queue<ParseFeedbackJobData, void, ParseFeedbackJobName> | undefined;

function getFeedbackQueue(): Queue<ParseFeedbackJobData, void, ParseFeedbackJobName> {
  if (queue) {
    return queue;
  }

  queue = new Queue<ParseFeedbackJobData, void, ParseFeedbackJobName>(QUEUE_NAME, {
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

  return queue;
}

export async function addParseFeedbackJob(
  data: ParseFeedbackJobData,
): Promise<Job<ParseFeedbackJobData, void, ParseFeedbackJobName> | null> {
  if (process.env.NODE_ENV === "test" || process.env.REDIS_DISABLED === "true") {
    return null;
  }

  return getFeedbackQueue().add(JOB_NAME, data, {
    priority: 1,
  });
}

export async function closeFeedbackQueue(): Promise<void> {
  if (!queue) {
    return;
  }

  await queue.close();
  queue = undefined;
}

export { QUEUE_NAME as FEEDBACK_QUEUE_NAME };
