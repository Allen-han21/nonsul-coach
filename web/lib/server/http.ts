import { InputSchema } from '../schema';
import { analyze, AnalysisError, type AnalysisProvider } from './analysis';
import { packages } from './package-data';
import { createOpenAIProvider, readBoundedText } from './openai-provider';

export type RuntimeConfig = {
  provider?: string;
  apiKey?: string;
  model?: string;
  retentionConfirmed?: string;
  siteOrigin?: string;
};
export const errorMessages = {
  NOT_CONFIGURED:
    '분석 서버 연결이 아직 완료되지 않았습니다. 입력은 유지되며 외부 AI로 전송하지 않았습니다.',
  PRIVACY_NOT_CONFIRMED:
    '분석 제공자의 답안 비저장 설정이 확인되지 않아 전송을 중단했습니다. 운영자의 설정 확인이 필요합니다.',
  INVALID_INPUT:
    '선택한 문항과 답안을 확인해 주세요. 답안은 6,000자 이내로 입력해 주세요.',
  PROVIDER_FAILED:
    '분석 결과를 안전하게 확인하지 못했습니다. 입력을 유지했으니 잠시 후 다시 시도해 주세요.',
  TIMEOUT:
    '분석 시간이 초과되었습니다. 입력은 유지됩니다. 잠시 후 다시 시도해 주세요.',
  PRIVATE_INPUT:
    '연락처·이메일·주민등록번호로 보이는 내용이 있습니다. 개인정보를 지운 뒤 다시 시도해 주세요.',
  INVALID_REQUEST: '허용되지 않은 요청입니다. 이 화면에서 다시 시도해 주세요.',
};
function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, private, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
export function configuredProvider(config: RuntimeConfig): AnalysisProvider {
  if (config.provider !== 'openai' || !config.apiKey || !config.model)
    throw new AnalysisError('NOT_CONFIGURED');
  return createOpenAIProvider({
    apiKey: config.apiKey,
    model: config.model,
    retentionConfirmed: config.retentionConfirmed === 'true',
  });
}
// Factory injection is used by isolated tests only. No test mode or fake-provider environment switch exists.
export async function handleAnalysis(
  request: Request,
  config: RuntimeConfig,
  factory: (config: RuntimeConfig) => AnalysisProvider = configuredProvider,
  timeoutMs = 55_000,
) {
  const origin = request.headers.get('origin');
  const requestOrigin = new URL(request.url).origin;
  if (
    !origin ||
    (origin !== requestOrigin && origin !== config.siteOrigin) ||
    request.method !== 'POST' ||
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  ) {
    return json(
      { code: 'INVALID_REQUEST', message: errorMessages.INVALID_REQUEST },
      403,
    );
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Check configuration before parsing any answer; no external call is made here.
    const provider = factory(config);
    let value: unknown;
    try {
      value = JSON.parse(await readBoundedText(request, 100_000));
    } catch {
      throw new AnalysisError('INVALID_INPUT');
    }
    const parsed = InputSchema.safeParse(value);
    if (!parsed.success) throw new AnalysisError('INVALID_INPUT');
    const input = parsed.data;
    if (
      /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b|\b\d{6}[ -]?[1-4]\d{6}\b)/i.test(
        input.answer,
      )
    ) {
      return json(
        { code: 'PRIVATE_INPUT', message: errorMessages.PRIVATE_INPUT },
        400,
      );
    }
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, request.signal]);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new AnalysisError('TIMEOUT'));
      }, timeoutMs);
    });
    const result = await Promise.race([
      analyze(
        input,
        packages.find((p) => p.id === input.packageId)!,
        provider,
        signal,
      ),
      timeout,
    ]);
    return json(result);
  } catch (error) {
    // Never log/return thrown messages, schema issue objects, provider bodies or request content.
    const code =
      error instanceof AnalysisError ? error.code : 'PROVIDER_FAILED';
    const status =
      code === 'INVALID_INPUT'
        ? 400
        : code === 'TIMEOUT'
          ? 504
          : code === 'NOT_CONFIGURED' || code === 'PRIVACY_NOT_CONFIRMED'
            ? 503
            : 502;
    return json({ code, message: errorMessages[code] }, status);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
