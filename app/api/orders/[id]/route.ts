import { OrderController } from "@/lib/controllers/order.controller";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return OrderController.updateById(request, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return OrderController.delete(request, context);
}
