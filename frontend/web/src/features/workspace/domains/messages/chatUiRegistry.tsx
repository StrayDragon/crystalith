import type { ComponentType } from 'react';

import AnswerCard from './components/AnswerCard';
import BarChartCard from './components/BarChartCard';
import DataTableCard from './components/DataTableCard';

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

function validateBarChartCardProps(props: Record<string, unknown>): ChatUiComponentValidationResult {
  const title = props.title;
  const unit = props.unit;
  const items = props.items;

  const issues: string[] = [];
  if (typeof title !== 'string' || !title.trim()) {
    issues.push('props.title must be a non-empty string');
  }
  if (unit !== undefined && unit !== null && typeof unit !== 'string') {
    issues.push('props.unit must be a string | null | undefined');
  }
  if (!Array.isArray(items)) {
    issues.push('props.items must be an array');
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const normalizedItems: Array<{ label: string; value: number }> = [];
  for (const [index, raw] of (items as unknown[]).entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, issues: [`props.items[${index}] must be an object`] };
    }
    const label = (raw as Record<string, unknown>).label;
    const value = (raw as Record<string, unknown>).value;
    if (typeof label !== 'string' || !label.trim()) {
      return { ok: false, issues: [`props.items[${index}].label must be a non-empty string`] };
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, issues: [`props.items[${index}].value must be a finite number`] };
    }
    normalizedItems.push({ label, value });
  }

  return {
    ok: true,
    data: {
      title,
      unit: typeof unit === 'string' ? unit : unit === null ? null : undefined,
      items: normalizedItems,
    },
  };
}

function validateDataTableCardProps(props: Record<string, unknown>): ChatUiComponentValidationResult {
  const columns = props.columns;
  const rows = props.rows;
  if (!Array.isArray(columns) || columns.some((col) => typeof col !== 'string')) {
    return { ok: false, issues: ['props.columns must be string[]'] };
  }
  if (!Array.isArray(rows)) {
    return { ok: false, issues: ['props.rows must be (string|number|null)[][]'] };
  }
  for (const [rowIndex, row] of (rows as unknown[]).entries()) {
    if (!Array.isArray(row)) {
      return { ok: false, issues: [`props.rows[${rowIndex}] must be an array`] };
    }
    for (const [cellIndex, cell] of (row as unknown[]).entries()) {
      if (cell === null) continue;
      if (typeof cell === 'string') continue;
      if (typeof cell === 'number' && Number.isFinite(cell)) continue;
      return { ok: false, issues: [`props.rows[${rowIndex}][${cellIndex}] must be string|number|null`] };
    }
  }
  return { ok: true, data: { columns, rows } };
}

export const chatUiComponentRegistry: Record<string, ChatUiComponentRegistration> = {
  AnswerCard: {
    Component: AnswerCard,
    validateProps: validateAnswerCardProps,
  },
  BarChartCard: {
    Component: BarChartCard,
    validateProps: validateBarChartCardProps,
  },
  DataTableCard: {
    Component: DataTableCard,
    validateProps: validateDataTableCardProps,
  },
};
