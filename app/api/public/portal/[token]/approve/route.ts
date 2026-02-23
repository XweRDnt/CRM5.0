import { VersionStatus } from "@prisma/client";
import { z } from "zod";
import { assetService } from "@/lib/services/asset.service";
import { getTelegramNotificationService } from "@/lib/services/telegram-notification.service";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";
import { resolvePortalProjectToken } from "@/lib/utils/portal-token";

const paramsSchema = z.object({
  token: z.string().min(1),
});

const approveBodySchema = z.object({
  versionId: z.string().min(1),
});

export async function POST(request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  try {
    const { token } = paramsSchema.parse(await context.params);
    const { versionId } = approveBodySchema.parse(await request.json());
    const portalToken = resolvePortalProjectToken(token);

    if (!portalToken) {
      return Response.json({ error: "Invalid portal token" }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { portalToken },
      select: {
        id: true,
        tenantId: true,
        name: true,
        portalToken: true,
      },
    });

    if (!project) {
      return Response.json({ error: "Portal not found" }, { status: 404 });
    }

    const version = await prisma.assetVersion.findFirst({
      where: {
        id: versionId,
        projectId: project.id,
      },
      select: {
        id: true,
        versionNo: true,
        status: true,
        approvedAt: true,
      },
    });

    if (!version) {
      return Response.json({ error: "Version not found in this portal" }, { status: 404 });
    }

    if (version.status === VersionStatus.APPROVED || version.status === VersionStatus.FINAL) {
      return Response.json(
        {
          status: version.status,
          approvedAt: version.approvedAt,
        },
        { status: 200 },
      );
    }

    const updated = await assetService.approveVersion({
      projectId: project.id,
      versionId: version.id,
      tenantId: project.tenantId,
      approvedBy: "client-portal",
    });

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await getTelegramNotificationService().notifyVersionApproved({
        projectName: project.name,
        versionNumber: version.versionNo,
        approvedAt: updated.approvedAt ?? new Date(),
        portalUrl: `${appUrl}/client-portal/${project.portalToken}`,
      });
    } catch (telegramError) {
      console.error("[Telegram] approve notification failed", telegramError);
    }

    return Response.json(updated, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
}
