import { NextResponse } from "next/server";
import { OrderService } from "../services/order.service";
import { getErrorMessage } from "@/lib/types";

export class SuggestionController {
  static async getSuggestions(request: Request) {
    console.log(`[SuggestionController] GET /api/suggestions - Request received`);
    try {
      const url = new URL(request.url);
      const field = url.searchParams.get("field");
      const client = url.searchParams.get("client") || undefined;

      if (!field) {
        return NextResponse.json({ error: "Missing field parameter" }, { status: 400 });
      }

      const suggestions = await OrderService.getSuggestions(field, client);
      
      console.log(`[SuggestionController] GET /api/suggestions - Success: field=${field}, count=${Array.isArray(suggestions) ? suggestions.length : 0}`);
      return NextResponse.json(suggestions);
    } catch (error: unknown) {
      console.error(`[SuggestionController] GET /api/suggestions - Error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
    }
  }
}
