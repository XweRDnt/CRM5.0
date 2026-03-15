import { z } from "zod";
import { getKinescopeService } from "@/lib/services/kinescope.service";
import { handleAPIError } from "@/lib/utils/api-error";

const querySchema = z.object({
  videoId: z.string().min(1),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const searchParams = new URL(request.url).searchParams;
    const { videoId } = querySchema.parse({ videoId: searchParams.get("videoId") ?? undefined });

    const posterUrl = await getKinescopeService().getVideoPosterUrl(videoId);
    return Response.json({ url: posterUrl }, { status: 200 });
  } catch (error) {
    return handleAPIError(error);
  }
}
