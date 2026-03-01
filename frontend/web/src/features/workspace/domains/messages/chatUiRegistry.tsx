import type { ComponentType } from 'react';

import AnswerCard from './components/AnswerCard';

export type ChatUiComponentValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; issues: string[] };

export type ChatUiComponentRegistration = {
  Component: ComponentType<any>;
  validateProps: (props: Record<string, unknown>) => ChatUiComponentValidationResult;
};

function validateAnswerCardProps(props: Record<string, unknown>): ChatUiComponentValidationResult {
  const markdown = props.markdown;
  if (typeof markdown !== 'string') {
    return { ok: false, issues: ['props.markdown must be a string'] };
  }
  return { ok: true, data: { markdown } };
}

export const chatUiComponentRegistry: Record<string, ChatUiComponentRegistration> = {
  AnswerCard: {
    Component: AnswerCard,
    validateProps: validateAnswerCardProps,
  },
};

