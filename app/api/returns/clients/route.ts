import { NextResponse } from "next/server";
import { ReturnController } from "@/lib/controllers/return.controller";

export async function GET(request: Request) {
  try {
    const { ReturnService } = await import("@/lib/services/return.service");
    const clients = await ReturnService.getClients();
    return NextResponse.json(clients);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch return clients" }, { status: 500 });
  }
}
