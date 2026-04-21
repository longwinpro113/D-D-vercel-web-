import { OrderController } from "@/lib/controllers/order.controller";

export const runtime = "nodejs";

export async function GET() {
  return OrderController.getClients();
}
