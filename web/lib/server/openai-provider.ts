// No SDK state, conversation IDs, background jobs, file uploads, logging, or retries.
import {
  AnalysisError,
  type AnalysisProvider,
  type ModelRequest,
} from './analysis';
export function createOpenAIProvider(
  config: { apiKey: string; model: string; retentionConfirmed: boolean },
  transport: typeof fetch = fetch,
): AnalysisProvider {
  if (!config.apiKey.trim() || !config.model.trim())
    throw new AnalysisError('NOT_CONFIGURED');
  if (!config.retentionConfirmed)
    throw new AnalysisError('PRIVACY_NOT_CONFIRMED');
  return {
    async generate(request: ModelRequest) {
      let response: Response;
      try {
        response = await transport('https://api.openai.com/v1/responses', {
          method: 'POST',
          redirect: 'error',
          signal: request.signal,
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            store: false,
            background: false,
            max_output_tokens: 5000,
            input: [
              { role: 'developer', content: request.instructions },
              { role: 'user', content: request.input },
            ],
            text: {
              format: {
                type: 'json_schema',
                name: `essay_${request.phase}`,
                strict: true,
                schema: request.schema,
              },
            },
          }),
        });
      } catch {
        throw new AnalysisError(
          request.signal.aborted ? 'TIMEOUT' : 'PROVIDER_FAILED',
        );
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new AnalysisError('PROVIDER_FAILED');
      }
      try {
        // Provider errors/refusals/partial output and arbitrary fields never reach the client.
        const raw = await readBoundedText(response, 128_000);
        const payload = JSON.parse(raw);
        if (payload.status !== 'completed' || !Array.isArray(payload.output))
          throw new Error();
        const parts = payload.output
          .filter((item: { type?: string }) => item.type === 'message')
          .flatMap((item: { content?: unknown[] }) => item.content ?? []);
        if (
          parts.length !== 1 ||
          parts[0].type !== 'output_text' ||
          typeof parts[0].text !== 'string'
        )
          throw new Error();
        return JSON.parse(parts[0].text);
      } catch {
        throw new AnalysisError(
          request.signal.aborted ? 'TIMEOUT' : 'PROVIDER_FAILED',
        );
      }
    },
  };
}
export async function readBoundedText(
  message: Request | Response,
  maxBytes: number,
): Promise<string> {
  const reader = message.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error('BODY_LIMIT');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    reader.releaseLock();
  }
}
