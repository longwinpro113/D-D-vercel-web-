import { NextResponse } from "next/server";
import { ExportService } from "../services/export.service";
import { getErrorMessage } from "@/lib/types";

export class ExportController {
  static async getHistory(request: Request) {
    console.log(`[ExportController] GET /api/history-export - Request received`);
    try {
      const url = new URL(request.url);
      const query = Object.fromEntries(url.searchParams.entries());
      const rows = await ExportService.getExports(query);
      
      console.log(`[ExportController] GET /api/history-export - Success: ${Array.isArray(rows) ? rows.length : 0} rows found`);
      return NextResponse.json(rows);
    } catch (error: unknown) {
      console.error(`[ExportController] GET /api/history-export - Error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch export data.") }, { status: 500 });
    }
  }

  static async create(request: Request) {
    console.log(`[ExportController] POST /api/history-export - Request received`);
    try {
      const payload = await request.json();
      if (!payload.ry_number) {
        return NextResponse.json({ error: "ry_number is required." }, { status: 400 });
      }
      
      const result = await ExportService.createExport(payload);
      
      console.log(`[ExportController] POST /api/history-export - Success: ID ${result.insertId}`);
      return NextResponse.json({ id: result.insertId, message: "Export saved." });
    } catch (error: unknown) {
      console.error(`[ExportController] POST /api/history-export - Error:`, error);
      return NextResponse.json({ error: `Failed to save export: ${getErrorMessage(error, "Unknown error")}` }, { status: 500 });
    }
  }

  static async getRemainingStock(request: Request) {
    console.log(`[ExportController] GET /api/remaining-stock - Request received`);
    try {
      const url = new URL(request.url);
      const query = Object.fromEntries(url.searchParams.entries());
      const rows = await ExportService.getRemainingStock(query);
      
      console.log(`[ExportController] GET /api/remaining-stock - Success: ${Array.isArray(rows) ? rows.length : 0} rows found`);
      return NextResponse.json(rows);
    } catch (error: unknown) {
      console.error(`[ExportController] GET /api/remaining-stock - Error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch remaining stock.") }, { status: 500 });
    }
  }

  static async getMaxMonth(request: Request) {
    console.log(`[ExportController] GET /api/history-export/max-month - Request received`);
    try {
      const url = new URL(request.url);
      const client = url.searchParams.get("client") || undefined;
      const result = await ExportService.getMaxMonth(client);
      return NextResponse.json(result);
    } catch (error: unknown) {
      console.error(`[ExportController] GET /api/history-export/max-month - Error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch max month.") }, { status: 500 });
    }
  }

  static async getDates(request: Request) {
    console.log(`[ExportController] GET /api/history-export/dates - Request received`);
    try {
      const url = new URL(request.url);
      const client = url.searchParams.get("client") || undefined;
      const rows = await ExportService.getAvailableDates(client);
      return NextResponse.json(rows);
    } catch (error: unknown) {
      console.error(`[ExportController] GET /api/history-export/dates - Error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch available dates.") }, { status: 500 });
    }
  }

  static async update(request: Request, context: { params: Promise<{ id: string }> }) {
    console.log(`[ExportController] PATCH /api/history-export/[id] - Request received`);
    try {
      const { id } = await context.params;
      const payload = await request.json();
      console.log(`[ExportController] PATCH /api/history-export/${id} - Payload:`, payload);

      const result = await ExportService.updateExport(id, payload);
      if (!result.found) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      console.log(`[ExportController] PATCH /api/history-export/${id} - Success`);
      return NextResponse.json({ message: "Updated" });
    } catch (error: unknown) {
      console.error(`[ExportController] PATCH /api/history-export - Error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, "Failed to update export.") }, { status: 500 });
    }
  }

  static async delete(request: Request, context: { params: Promise<{ id: string }> }) {
    console.log(`[ExportController] DELETE /api/history-export/[id] - Request received`);
    try {
      const { id } = await context.params;
      const result = await ExportService.deleteExport(id);
      if (!result.found) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      console.log(`[ExportController] DELETE /api/history-export/${id} - Success`);
      return NextResponse.json({ message: "Deleted" });
    } catch (error: unknown) {
      console.error(`[ExportController] DELETE /api/history-export - Error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, "Failed to delete export.") }, { status: 500 });
    }
  }
}
