import { SuggestionController } from "@/lib/controllers/suggestion.controller";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return SuggestionController.getSuggestions(request);
}
