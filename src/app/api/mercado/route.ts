import { fetchMarket } from "@/lib/market";

// Sem `dynamic = "force-dynamic"`: isso anularia o cache de 24 h dos fetch em lib/market.ts.
export async function GET() {
  const market = await fetchMarket();
  return Response.json(market, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
