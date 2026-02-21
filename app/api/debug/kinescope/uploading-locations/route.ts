import { withAuth, type AuthenticatedRequest } from "@/lib/middleware/auth";
import { getKinescopeService } from "@/lib/services/kinescope.service";
import { handleAPIError } from "@/lib/utils/api-error";

const ALLOWED_ROLES = new Set(["OWNER", "PM"]);

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    if (!ALLOWED_ROLES.has(request.user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const kinescopeService = getKinescopeService();
    const locations = await kinescopeService.listUploadingLocations();

    return Response.json(
      {
        data: locations,
        hint: "Use one of these ids as KINESCOPE_UPLOADING_LOCATION_ID",
      },
      { status: 200 },
    );
  } catch (error) {
    return handleAPIError(error);
  }
});
