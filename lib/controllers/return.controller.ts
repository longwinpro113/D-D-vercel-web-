import { NextResponse } from "next/server";
import { ReturnService } from "../services/return.service";
import { getErrorMessage } from "@/lib/types";

export class ReturnController {
  static async createReceived(request: Request) {
    try {
      const payload = await request.json();
      console.log("[ReturnController] createReceived payload:", payload);
      const result = await ReturnService.createReceived(payload);
      return NextResponse.json({ id: result.insertId, message: "Return received record created." });
    } catch (error) {
      console.error("[ReturnController] createReceived error:", error);
      return NextResponse.json({ error: getErrorMessage(error, "Failed to create return received record.") }, { status: 500 });
    }
  }

  static async createShipped(request: Request) {
    try {
      const payload = await request.json();
      console.log("[ReturnController] createShipped payload:", payload);
      const result = await ReturnService.createShipped(payload);
      return NextResponse.json({ id: result.insertId, message: "Return shipped record created." });
    } catch (error) {
      console.error("[ReturnController] createShipped error:", error);
      return NextResponse.json({ error: getErrorMessage(error, "Failed to create return shipped record.") }, { status: 500 });
    }
  }

  static async getReceived(request: Request) {
    try {
      const url = new URL(request.url);
      const client = url.searchParams.get("client") || undefined;
      const ry_number = url.searchParams.get("ry_number") || undefined;
      const rows = await ReturnService.getReceivedList(client, ry_number);
      return NextResponse.json(rows);
    } catch (error) {
      return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch return received records.") }, { status: 500 });
    }
  }

  static async getShipped(request: Request) {
    try {
      const url = new URL(request.url);
      const client = url.searchParams.get("client") || undefined;
      const ry_number = url.searchParams.get("ry_number") || undefined;
      const rows = await ReturnService.getShippedList(client, ry_number);
      return NextResponse.json(rows);
    } catch (error) {
      return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch return shipped records.") }, { status: 500 });
    }
  }

  static async getRemaining(request: Request) {
    try {
      const url = new URL(request.url);
      const client = url.searchParams.get("client") || undefined;
      const rows = await ReturnService.getRemainingStock(client);
      return NextResponse.json(rows);
    } catch (error) {
      return NextResponse.json({ error: getErrorMessage(error, "Failed to calculate remaining return stock.") }, { status: 500 });
    }
  }
}
