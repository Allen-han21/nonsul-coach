import 'server-only';
import { handleAnalysis } from '@/lib/server/http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return handleAnalysis(request, {
    provider: process.env.ANALYSIS_PROVIDER,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.ANALYSIS_MODEL,
    retentionConfirmed: process.env.ANALYSIS_RETENTION_CONFIRMED,
    siteOrigin: process.env.SITE_ORIGIN,
  });
}
