import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/utils/db";

const INVITE_TTL_DAYS = 7;

export class InviteService {
  generateToken(): string {
    return `inv_${randomBytes(24).toString("base64url")}`;
  }

  async createInviteLink(input: { workspaceId: string; createdBy: string; expiresAt?: Date }) {
    return prisma.inviteLink.create({
      data: {
        workspaceId: input.workspaceId,
        createdBy: input.createdBy,
        token: this.generateToken(),
        expiresAt: input.expiresAt ?? new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });
  }

  async getInviteByToken(token: string) {
    return prisma.inviteLink.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            tenantId: true,
          },
        },
      },
    });
  }

  async validateInviteToken(token: string) {
    const invite = await this.getInviteByToken(token);

    if (!invite) {
      throw new Error("Invite link not found");
    }

    if (!invite.isActive) {
      throw new Error("Invite link is inactive");
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      throw new Error("Invite link is expired");
    }

    return invite;
  }

  async acceptInvite(input: { token: string; userId: string }) {
    const invite = await this.validateInviteToken(input.token);

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, tenantId: true, role: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.tenantId !== invite.workspace.tenantId) {
      throw new Error("User belongs to another workspace");
    }

    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspace.id,
          userId: user.id,
        },
      },
      create: {
        workspaceId: invite.workspace.id,
        userId: user.id,
        role: "EDITOR",
      },
      update: {},
    });

    return invite;
  }

  async listActiveInvites(workspaceId: string) {
    return prisma.inviteLink.findMany({
      where: {
        workspaceId,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const inviteService = new InviteService();
