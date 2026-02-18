import type { AnalyzeScopeJobData } from "@/lib/jobs/queues/scope.queue";

export async function handleAnalyzeScope(data: AnalyzeScopeJobData): Promise<void> {
  console.info(`[Analyze Scope Job] Placeholder handler for project ${data.projectId}`);
}
