import { formatTimecode } from "@/lib/utils/time";

type TelegramResponse = {
  ok: boolean;
  description?: string;
};

type NewFeedbackTelegramInput = {
  projectName: string;
  versionNumber: number;
  authorName: string;
  text: string;
  timecodeSec?: number | null;
  portalUrl: string;
};

type VersionApprovedTelegramInput = {
  projectName: string;
  versionNumber: number;
  portalUrl: string;
  approvedAt: Date;
};

export class TelegramNotificationService {
  private readonly token: string;
  private readonly chatId: string;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
    this.chatId = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.chatId);
  }

  async notifyNewFeedback(input: NewFeedbackTelegramInput): Promise<void> {
    const timecodePart =
      typeof input.timecodeSec === "number" ? `Таймкод: ${formatTimecode(input.timecodeSec)}\n` : "";
    const shortText = input.text.length > 300 ? `${input.text.slice(0, 300)}...` : input.text;
    const message = [
      "Новая правка от клиента",
      `Проект: ${input.projectName}`,
      `Версия: v${input.versionNumber}`,
      `Автор: ${input.authorName}`,
      timecodePart.trim(),
      `Текст: ${shortText}`,
      `Ссылка: ${input.portalUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    await this.sendMessage(message);
  }

  async notifyVersionApproved(input: VersionApprovedTelegramInput): Promise<void> {
    const approvedAt = input.approvedAt.toLocaleString("ru-RU");
    const message = [
      "Версия утверждена клиентом",
      `Проект: ${input.projectName}`,
      `Версия: v${input.versionNumber}`,
      `Время: ${approvedAt}`,
      `Ссылка: ${input.portalUrl}`,
    ].join("\n");

    await this.sendMessage(message);
  }

  private async sendMessage(text: string): Promise<void> {
    if (!this.isConfigured()) {
      console.warn("[Telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID are not configured");
      return;
    }

    const endpoint = `https://api.telegram.org/bot${this.token}/sendMessage`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
      }),
    });

    const payload = (await response.json().catch(() => null)) as TelegramResponse | null;

    if (!response.ok || !payload?.ok) {
      const errorDescription = payload?.description || `HTTP ${response.status}`;
      throw new Error(`[Telegram] Failed to send message: ${errorDescription}`);
    }
  }
}

let telegramService: TelegramNotificationService | null = null;

export function getTelegramNotificationService(): TelegramNotificationService {
  if (!telegramService) {
    telegramService = new TelegramNotificationService();
  }

  return telegramService;
}

