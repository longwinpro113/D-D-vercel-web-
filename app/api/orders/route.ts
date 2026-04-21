import { OrderController } from "@/lib/controllers/order.controller";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return OrderController.getAll(request);
}

export async function POST(request: Request) {
  return OrderController.create(request);
}
