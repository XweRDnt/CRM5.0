import { closeFeedbackQueue } from "@/lib/jobs/queues/feedback.queue";
import { scheduleWorkflowReminderJob } from "@/lib/jobs/queues/workflow.queue";
import { closeRedisConnections } from "@/lib/jobs/redis";
import { emailWorker } from "@/lib/jobs/workers/email.worker";
import { feedbackWorker } from "@/lib/jobs/workers/feedback.worker";
import { scopeWorker } from "@/lib/jobs/workers/scope.worker";
import { workflowWorker } from "@/lib/jobs/workers/workflow.worker";

let shutdownRegistered = false;

async function closeWorkers(): Promise<void> {
  await Promise.allSettled([
    feedbackWorker.close(),
    scopeWorker.close(),
    emailWorker.close(),
    workflowWorker.close(),
    closeFeedbackQueue(),
  ]);
  await closeRedisConnections();
}

export function startWorkers(): void {
  if (shutdownRegistered) {
    return;
  }

  shutdownRegistered = true;
  console.info("Starting background workers...");
  void scheduleWorkflowReminderJob().catch((error) => {
    console.error("Failed to schedule workflow reminder job", error);
  });

  const shutdown = async (signal: string) => {
    console.info(`${signal} received, closing workers...`);
    await closeWorkers();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

startWorkers();
