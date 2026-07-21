import { parseServerError, type ParsedServerError } from '../../../../api/parseServerError';
import { t } from '../../../../shared/i18n';
import { toast } from '../../../../shared/toast';

export function isResearchSpecialError(errorCode: string | undefined): boolean {
  return errorCode === 'RESEARCH_INVALID_STATE' || errorCode === 'RESEARCH_BUDGET';
}

export function researchErrorMessage(parsed: ParsedServerError): string {
  if (parsed.errorCode === 'RESEARCH_INVALID_STATE') {
    return t('research.error.invalid_state');
  }
  if (parsed.errorCode === 'RESEARCH_BUDGET') {
    return t('research.error.budget');
  }
  return parsed.message;
}

/** Surface RESEARCH_* as inline + toast; return user-facing message for inline. */
export function surfaceResearchError(error: unknown): string {
  const parsed = parseServerError(error);
  const message = researchErrorMessage(parsed);
  toast.error(message);
  return message;
}
