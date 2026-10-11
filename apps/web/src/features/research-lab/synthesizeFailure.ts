/** Synthesize-class failureReason prefixes (aligned with server report.ts). */
const SYNTHESIZE_FAILED_PREFIX = 'synthesize_failed:';
const SYNTHESIZE_MODEL_ERROR_PREFIX = 'synthesize_model_error:';

export function isSynthesizeFailureReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return (
    reason.startsWith(SYNTHESIZE_FAILED_PREFIX) || reason.startsWith(SYNTHESIZE_MODEL_ERROR_PREFIX)
  );
}
