import { ExportController } from "@/lib/controllers/export.controller";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return ExportController.update(request, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return ExportController.delete(request, context);
}
