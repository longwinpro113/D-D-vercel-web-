import { ReturnController } from "@/lib/controllers/return.controller";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return ReturnController.getReceived(request);
}

export async function POST(request: Request) {
  return ReturnController.createReceived(request);
}
