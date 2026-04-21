import { ExportController } from "@/lib/controllers/export.controller";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return ExportController.getRemainingStock(request);
}
