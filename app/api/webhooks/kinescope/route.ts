import { getKinescopeService } from "@/lib/services/kinescope.service";
import { handleAPIError } from "@/lib/utils/api-error";

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-kinescope-signature");
    const kinescopeService = getKinescopeService();

    if (!kinescopeService.verifyWebhookSignature(rawBody, signature)) {
      return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as {
      type?: string;
      event?: string;
      video?: Record<string, unknown>;
      data?: Record<string, unknown>;
    };
    await kinescopeService.syncWebhookEvent(payload);

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
}
