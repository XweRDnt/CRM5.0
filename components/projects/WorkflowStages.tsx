import { Badge } from "@/components/ui/badge";

export type WorkflowStage = {
  id: string;
  stageName: string;
  isActive?: boolean;
  completedAt?: string | Date | null;
};

type WorkflowStagesProps = {
  stages: WorkflowStage[];
};

export function WorkflowStages({ stages }: WorkflowStagesProps): JSX.Element {
  if (stages.length === 0) {
    return <div className="rounded border border-neutral-200 p-4 text-sm text-neutral-500">No workflow stages configured.</div>;
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="mb-3 text-sm font-medium text-neutral-700">Workflow Stages</p>
      <div className="flex flex-wrap gap-2">
        {stages.map((stage) => {
          const done = !!stage.completedAt;
          return (
            <Badge key={stage.id} variant={done ? "success" : stage.isActive ? "default" : "secondary"}>
              {stage.stageName}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
