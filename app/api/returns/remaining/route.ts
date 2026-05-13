import { ReturnController } from "@/lib/controllers/return.controller";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return ReturnController.getRemaining(request);
}
