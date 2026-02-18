import { VersionStatus } from "@prisma/client";
import { z } from "zod";
import { assetService } from "@/lib/services/asset.service";
import { getTelegramNotificationService } from "@/lib/services/telegram-notification.service";
import { prisma } from "@/lib/utils/db";
import { handleAPIError } from "@/lib/utils/api-error";
import { resolvePortalVersionId } from "@/lib/utils/portal-token";

const paramsSchema = z.object({
  token: z.string().min(1),
});

export async function POST(_: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  try {
    const { token } = paramsSchema.parse(await context.params);
    const versionId = resolvePortalVersionId(token);

    if (!versionId) {
      return Response.json({ error: "Invalid or expired portal token" }, { status: 400 });
    }

    const version = await prisma.assetVersion.findFirst({
      where: { id: versionId },
      include: {
        project: {
          select: {
            id: true,
            tenantId: true,
            name: true,
          },
        },
      },
    });

    if (!version) {
      return Response.json({ error: "Version not found" }, { status: 404 });
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
      projectId: version.project.id,
      versionId: version.id,
      tenantId: version.project.tenantId,
      approvedBy: "client-portal",
    });

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await getTelegramNotificationService().notifyVersionApproved({
        projectName: version.project.name,
        versionNumber: version.versionNo,
        approvedAt: updated.approvedAt ?? new Date(),
        portalUrl: `${appUrl}/client-portal/${token}`,
      });
    } catch (telegramError) {
      console.error("[Telegram] approve notification failed", telegramError);
    }

    return Response.json(updated, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
}

