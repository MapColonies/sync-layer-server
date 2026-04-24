import { SpanStatusCode, trace, type Span, type Tracer } from '@opentelemetry/api';
import { SERVICE_NAME } from './constants';

export const tracer: Tracer = trace.getTracer(SERVICE_NAME);

export async function withSpan<T>(name: string, attributes: Record<string, string | number | boolean>, fn: (span: Span) => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      const err = error as Error;
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw error;
    } finally {
      span.end();
    }
  });
}
