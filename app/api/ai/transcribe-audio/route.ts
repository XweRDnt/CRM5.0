import { aiService } from "@/lib/services/ai.service";
import { handleAPIError } from "@/lib/utils/api-error";

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return Response.json({ error: "Audio file is required" }, { status: 400 });
    }

    const result = await aiService.transcribeAudioFeedback({ audio });
    return Response.json(result, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
}
