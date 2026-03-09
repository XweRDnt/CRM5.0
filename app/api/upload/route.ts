import { withAuth } from "@/lib/middleware/auth";
import { assertProjectAccess } from "@/lib/services/access-control.service";
import { billingGuardService } from "@/lib/services/billing-guard.service";
import { getKinescopeService } from "@/lib/services/kinescope.service";
import { kinescopeWorkspaceProjectService } from "@/lib/services/kinescope-workspace-project.service";
import { z } from "zod";
import { handleAPIError } from "@/lib/utils/api-error";

const getUploadUrlSchema = z.object({
  projectId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1),
  fileSize: z.number().int().positive(),
  durationSec: z.number().int().positive().optional(),
});

export const POST = withAuth(async (req) => {
  try {
    const payload = getUploadUrlSchema.parse(await req.json());
    await assertProjectAccess(req.user, payload.projectId);
    await billingGuardService.assertCanUploadToKinescope({
      tenantId: req.user.tenantId,
      incomingFileSize: payload.fileSize,
      incomingDurationSec: payload.durationSec,
    });

    const workspaceProjectId = await kinescopeWorkspaceProjectService.ensureWorkspaceProjectForTenant(req.user.tenantId);
    const kinescopeService = getKinescopeService();
    const upload = await kinescopeService.createUploadSession(
      { tenantId: req.user.tenantId },
      {
        ...payload,
        kinescopeParentId: workspaceProjectId,
      },
    );
    return Response.json(upload, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
});
