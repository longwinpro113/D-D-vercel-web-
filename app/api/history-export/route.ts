import { ExportController } from "@/lib/controllers/export.controller";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return ExportController.getHistory(request);
}

export async function POST(request: Request) {
  return ExportController.create(request);
}
