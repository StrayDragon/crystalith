import {
  AccountTree as MindmapIcon,
  Assignment as BriefingIcon,
  QuestionAnswer as FAQIcon,
  Quiz as QuizIcon,
  MenuBook as GuideIcon,
  Timeline as TimelineIcon,
  Save as SaveIcon,
  Slideshow as SlidesIcon,
} from '@mui/icons-material';

import type { OutputItem, OutputTypeId } from '../../shared/types';
import { getOutputTitle } from '../../shared/outputPayload';
import { formatRelativeTime } from '../../shared/utils';

export type StudioTone = 'slate' | 'blue' | 'green' | 'rose' | 'amber' | 'teal' | 'indigo';

export const DEFAULT_TYPE_LABELS: Record<OutputTypeId, string> = {
  FAQ: '闪卡',
  GUIDE: '指南',
  TIMELINE: '时间轴',
  MINDMAP: '思维导图',
  QUIZ: '测验',
  BRIEFING: '报告',
  SLIDES: '演示',
  PARAGRAPH: '段落',
  BULLETS: '要点',
  STRUCTURED: '结构化',
};

export const TONE_COLORS: Record<StudioTone, { bg: string; border: string; text: string; icon: string }> = {
  slate: { bg: '#f4f6fb', border: '#e2e8f0', text: '#475569', icon: '#e7ebf2' },
  blue: { bg: '#eef4ff', border: '#c9d8ff', text: '#2f5fd0', icon: '#dbe7ff' },
  green: { bg: '#edf7f1', border: '#bfe6cf', text: '#2f8f5b', icon: '#d6f1e2' },
  rose: { bg: '#ffeef1', border: '#f7c5cf', text: '#b4234b', icon: '#ffd7de' },
  amber: { bg: '#fff4e6', border: '#fbd9a2', text: '#b45309', icon: '#ffe3c5' },
  teal: { bg: '#e7f7f6', border: '#b5e1de', text: '#0f766e', icon: '#ccefed' },
  indigo: { bg: '#eef0ff', border: '#cfd4ff', text: '#4f46e5', icon: '#dde2ff' },
};

export function resolveOutputTitle(output: OutputItem): string {
  return getOutputTitle(output);
}

export function resolveNoteMeta(output: OutputItem): string {
  const count = output.chunkIds?.length ?? 0;
  const relative =
    formatRelativeTime(output.createdAtRaw ?? output.updatedAtRaw) ||
    output.createdAt ||
    output.updatedAt ||
    '刚刚';
  if (count > 0) {
    return `${count} 个来源 · ${relative}`;
  }
  return `未选择来源 · ${relative}`;
}

export function resolveTone(type: OutputTypeId): StudioTone {
  switch (type) {
    case 'MINDMAP':
      return 'indigo';
    case 'BRIEFING':
      return 'amber';
    case 'FAQ':
      return 'blue';
    case 'QUIZ':
      return 'teal';
    case 'GUIDE':
      return 'green';
    case 'TIMELINE':
      return 'rose';
    case 'SLIDES':
      return 'slate';
    default:
      return 'slate';
  }
}

export function resolveTypeLabel(type: OutputTypeId, labels: Map<OutputTypeId, string>) {
  return labels.get(type) ?? DEFAULT_TYPE_LABELS[type];
}

export function getToolIcon(type: OutputTypeId) {
  const props = { style: { fontSize: 18 } };
  switch (type) {
    case 'MINDMAP':
      return <MindmapIcon {...props} />;
    case 'BRIEFING':
      return <BriefingIcon {...props} />;
    case 'FAQ':
      return <FAQIcon {...props} />;
    case 'QUIZ':
      return <QuizIcon {...props} />;
    case 'GUIDE':
      return <GuideIcon {...props} />;
    case 'TIMELINE':
      return <TimelineIcon {...props} />;
    case 'SLIDES':
      return <SlidesIcon {...props} />;
    default:
      return <SaveIcon {...props} />;
  }
}
