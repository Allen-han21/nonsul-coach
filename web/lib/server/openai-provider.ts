// No SDK state, conversation IDs, background jobs, file uploads, logging, or retries.
import {
  AnalysisError,
  type AnalysisProvider,
  type ModelRequest,
} from './analysis';
export type OpenAIUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};
export type OpenAIProviderError = {
  status: number;
  type?: string;
  code?: string;
  param?: string;
  message?: string;
};
export function createOpenAIProvider(
  config: {
    apiKey: string;
    model: string;
    onUsage?: (usage: OpenAIUsage) => void;
    onProviderError?: (error: OpenAIProviderError) => void;
  },
  transport: typeof fetch = fetch,
): AnalysisProvider {
  if (!config.apiKey.trim() || !config.model.trim())
    throw new AnalysisError('NOT_CONFIGURED');
  return {
    async generate(request: ModelRequest) {
      let response: Response;
      try {
        response = await transport('https://api.openai.com/v1/responses', {
          method: 'POST',
          // Workers supports manual/follow only. Manual also prevents forwarding
          // the Authorization header if an upstream redirect is ever returned.
          redirect: 'manual',
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
            reasoning: { effort: 'low' },
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
      } catch (error) {
        if (config.onProviderError) {
          const value = error as {
            name?: unknown;
            code?: unknown;
            message?: unknown;
            cause?: { code?: unknown; message?: unknown };
          };
          const diagnostic: OpenAIProviderError = {
            status: 0,
            type:
              typeof value?.name === 'string' ? value.name : 'transport_error',
          };
          const code = value?.cause?.code ?? value?.code;
          if (typeof code === 'string') diagnostic.code = code;
          const message = value?.cause?.message ?? value?.message;
          if (typeof message === 'string')
            diagnostic.message = message
              .replaceAll(config.apiKey, '[redacted]')
              .replace(/sk-(?:proj-|admin-)?[A-Za-z0-9_-]+/g, '[redacted]')
              .slice(0, 240);
          try {
            config.onProviderError(diagnostic);
          } catch {
            // Optional diagnostics must never affect failure handling.
          }
        }
        throw new AnalysisError(
          request.signal.aborted ? 'TIMEOUT' : 'PROVIDER_FAILED',
        );
      }
      if (!response.ok) {
        if (config.onProviderError) {
          const diagnostic: OpenAIProviderError = { status: response.status };
          try {
            const payload = JSON.parse(
              await readBoundedText(response.clone(), 8_192),
            );
            if (typeof payload?.error?.type === 'string')
              diagnostic.type = payload.error.type;
            if (typeof payload?.error?.code === 'string')
              diagnostic.code = payload.error.code;
            if (typeof payload?.error?.param === 'string')
              diagnostic.param = payload.error.param;
          } catch {
            // The status is sufficient when no bounded JSON error is available.
          }
          try {
            config.onProviderError(diagnostic);
          } catch {
            // Optional diagnostics must never affect failure handling.
          }
        }
        await response.body?.cancel();
        throw new AnalysisError('PROVIDER_FAILED');
      }
      try {
        // Provider errors/refusals/partial output and arbitrary fields never reach the client.
        const raw = await readBoundedText(response, 128_000);
        const payload = JSON.parse(raw);
        if (payload.status !== 'completed' || !Array.isArray(payload.output))
          throw new Error();
        if (
          payload.usage &&
          typeof payload.usage.input_tokens === 'number' &&
          typeof payload.usage.output_tokens === 'number' &&
          typeof payload.usage.total_tokens === 'number'
        ) {
          try {
            config.onUsage?.({
              inputTokens: payload.usage.input_tokens,
              outputTokens: payload.usage.output_tokens,
              totalTokens: payload.usage.total_tokens,
            });
          } catch {
            // Optional accounting must never affect analysis delivery.
          }
        }
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
