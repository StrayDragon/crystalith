/**
 * All Output Plugins
 *
 * This file exports all built-in output plugins for registration.
 * To add a new output type, create a plugin file and add it to the exports.
 */

import {
  AccountTree as MindmapIcon,
  Assignment as BriefingIcon,
  QuestionAnswer as FAQIcon,
  Quiz as QuizIcon,
  MenuBook as GuideIcon,
  Timeline as TimelineIcon,
  Slideshow as SlidesIcon,
} from '@mui/icons-material';

import type { OutputPlugin, OutputContent } from './index';
import FlashcardViewer from '../FlashcardViewer';
import GuideChecklist from '../GuideChecklist';
import MindmapViewer from '../MindmapViewer';
import QuizRunner from '../QuizRunner';
import ReportViewer from '../ReportViewer';
import TimelineViewer from '../TimelineViewer';

// --- Shared Components ---

function FallbackWarning() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <div className="flex items-start gap-2">
        <span aria-hidden="true">⚠️</span>
        <div className="space-y-1">
          <div>AI 模型生成失败。这可能是因为模型能力不足或响应格式不正确。建议：</div>
          <ul className="list-disc pl-4">
            <li>稍后重试</li>
            <li>使用更强大的 AI 模型（如 GPT-4、Claude 等）</li>
            <li>简化提示内容</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function OutputError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
      {message}
    </div>
  );
}

// --- FAQ Plugin ---

export const faqPlugin: OutputPlugin = {
  id: 'FAQ',
  label: '闪卡',
  description: '问答清单',
  tone: 'blue',
  icon: <FAQIcon fontSize="small" />,
  defaultPrompt: '整理为 FAQ 问答清单。',
  configSchema: {
    quantityOptions: [
      { id: 'less', label: '更少' },
      { id: 'standard', label: '标准（默认）', isDefault: true },
      { id: 'more', label: '更多' },
    ],
    topicPlaceholder: '示例提示\n• 抽认卡必须仅限于一个特定来源\n• 抽认卡必须专注于一个特定主题\n• 卡片正面内容必须简短易记',
    supportsTopic: true,
  },
  enabled: true,
  render: (content, isFallback) => {
    const items = (content as any).items;
    if (!Array.isArray(items)) return <OutputError message="无效的闪卡数据" />;
    return (
      <div className="StructuredOutputFaq">
        {isFallback && <FallbackWarning />}
        <FlashcardViewer items={items} />
      </div>
    );
  },
  validateContent: (content) => Array.isArray((content as any).items),
};

// --- Guide Plugin ---

export const guidePlugin: OutputPlugin = {
  id: 'GUIDE',
  label: '指南',
  description: '学习/行动指南',
  tone: 'green',
  icon: <GuideIcon fontSize="small" />,
  defaultPrompt: '生成结构化学习指南。',
  configSchema: {
    quantityOptions: [
      { id: 'brief', label: '简要' },
      { id: 'standard', label: '标准（默认）', isDefault: true },
      { id: 'detailed', label: '详细' },
    ],
    difficultyOptions: [
      { id: 'easy', label: '简单' },
      { id: 'medium', label: '中等（默认）', isDefault: true },
      { id: 'hard', label: '困难' },
    ],
    topicPlaceholder: '指南应该聚焦于什么主题？\n例如：入门指南、最佳实践',
    supportsTopic: true,
  },
  enabled: true,
  render: (content, isFallback) => {
    const modules = (content as any).modules;
    if (!Array.isArray(modules)) return <OutputError message="无效的指南数据" />;
    return (
      <div className="StructuredOutputGuide">
        {isFallback && <FallbackWarning />}
        <GuideChecklist modules={modules} />
      </div>
    );
  },
  validateContent: (content) => Array.isArray((content as any).modules),
};

// --- Timeline Plugin ---

export const timelinePlugin: OutputPlugin = {
  id: 'TIMELINE',
  label: '时间轴',
  description: '关键事件序列',
  tone: 'rose',
  icon: <TimelineIcon fontSize="small" />,
  defaultPrompt: '按时间轴整理关键事件。',
  configSchema: {
    quantityOptions: [
      { id: 'less', label: '更少' },
      { id: 'standard', label: '标准（默认）', isDefault: true },
      { id: 'more', label: '更多' },
    ],
    topicPlaceholder: '时间轴应该覆盖什么时间范围或事件类型？\n例如：技术发展历程、项目里程碑',
    supportsTopic: true,
  },
  enabled: true,
  render: (content, isFallback) => {
    const events = (content as any).events;
    if (!Array.isArray(events)) return <OutputError message="无效的时间轴数据" />;
    return (
      <div className="StructuredOutputTimeline">
        {isFallback && <FallbackWarning />}
        <TimelineViewer events={events} />
      </div>
    );
  },
  validateContent: (content) => Array.isArray((content as any).events),
};

// --- Mindmap Plugin ---

export const mindmapPlugin: OutputPlugin = {
  id: 'MINDMAP',
  label: '思维导图',
  description: '主题层级结构',
  tone: 'indigo',
  icon: <MindmapIcon fontSize="small" />,
  defaultPrompt: '生成思维导图层级结构。',
  configSchema: {
    quantityOptions: [
      { id: 'shallow', label: '浅层（2层）' },
      { id: 'standard', label: '标准（3层）', isDefault: true },
      { id: 'deep', label: '深层（4层）' },
    ],
    topicPlaceholder: '思维导图的核心主题是什么？\n例如：系统架构、知识体系',
    supportsTopic: true,
  },
  enabled: true,
  render: (content, isFallback) => {
    const root = (content as any).root;
    if (!root) return <OutputError message="无效的思维导图数据" />;
    return (
      <>
        {isFallback && <FallbackWarning />}
        <MindmapViewer data={{ root }} className="StructuredMindmapInteractive" />
      </>
    );
  },
  validateContent: (content) => !!(content as any).root,
};

// --- Quiz Plugin ---

export const quizPlugin: OutputPlugin = {
  id: 'QUIZ',
  label: '测验',
  description: '知识检验',
  tone: 'teal',
  icon: <QuizIcon fontSize="small" />,
  defaultPrompt: '生成小测验题目。',
  configSchema: {
    quantityOptions: [
      { id: 'less', label: '更少' },
      { id: 'standard', label: '标准（默认）', isDefault: true },
      { id: 'more', label: '更多' },
    ],
    difficultyOptions: [
      { id: 'easy', label: '简单' },
      { id: 'medium', label: '中等（默认）', isDefault: true },
      { id: 'hard', label: '困难' },
    ],
    topicPlaceholder: '测验应该测试什么知识点？\n例如：基础概念、高级应用',
    supportsTopic: true,
  },
  enabled: true,
  render: (content, isFallback) => {
    const questions = (content as any).questions;
    if (!Array.isArray(questions)) return <OutputError message="无效的测验数据" />;
    return (
      <div className="StructuredOutputQuiz">
        {isFallback && <FallbackWarning />}
        <QuizRunner questions={questions} />
      </div>
    );
  },
  validateContent: (content) => Array.isArray((content as any).questions),
};

// --- Briefing Plugin ---

export const briefingPlugin: OutputPlugin = {
  id: 'BRIEFING',
  label: '报告',
  description: '高层摘要',
  tone: 'amber',
  icon: <BriefingIcon fontSize="small" />,
  defaultPrompt: '生成简报：背景/发现/建议/下一步。',
  configSchema: {
    quantityOptions: [
      { id: 'executive', label: '高管摘要' },
      { id: 'standard', label: '标准报告（默认）', isDefault: true },
      { id: 'comprehensive', label: '详尽报告' },
    ],
    topicPlaceholder: '报告应该重点关注什么方面？\n例如：技术分析、市场趋势',
    supportsTopic: true,
  },
  enabled: true,
  render: (content, isFallback) => {
    const sections = (content as any).sections;
    if (!Array.isArray(sections)) return <OutputError message="无效的报告数据" />;
    return (
      <div className="StructuredOutputBriefing">
        {isFallback && <FallbackWarning />}
        <ReportViewer sections={sections} />
      </div>
    );
  },
  validateContent: (content) => Array.isArray((content as any).sections),
};

// --- Slides Plugin ---

export const slidesPlugin: OutputPlugin = {
  id: 'SLIDES',
  label: '演示',
  description: '演示文稿',
  tone: 'slate',
  icon: <SlidesIcon fontSize="small" />,
  defaultPrompt: '生成演示大纲与 Slidev Markdown。',
  configSchema: {
    quantityOptions: [
      { id: 'short', label: '精简' },
      { id: 'standard', label: '标准（默认）', isDefault: true },
      { id: 'detailed', label: '详尽' },
    ],
    topicPlaceholder: '演示应该围绕什么主题？',
    supportsTopic: true,
  },
  enabled: true,
  render: (content, isFallback) => {
    const title = (content as any).title || '演示';
    const outline = (content as any).outline;
    const markdown = (content as any).markdown;
    return (
      <div className="space-y-4">
        {isFallback && <FallbackWarning />}
        <div>
          <div className="text-lg font-semibold text-gray-900 dark:text-slate-100">{title}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">
            引擎：{(content as any).engine || 'slidev'}
          </div>
        </div>
        {outline?.slides ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="text-xs font-semibold text-gray-600 mb-2 dark:text-slate-300">大纲</div>
            <div className="space-y-2 text-sm text-gray-800 dark:text-slate-200">
              {outline.slides.map((slide: any, index: number) => (
                <div key={`${slide.title}-${index}`}>
                  <div className="font-semibold">{slide.title || `幻灯片 ${index + 1}`}</div>
                  {Array.isArray(slide.bullets) && slide.bullets.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-gray-600 dark:text-slate-400">
                      {slide.bullets.map((bullet: string, idx: number) => (
                        <li key={`${bullet}-${idx}`}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {markdown ? (
          <pre className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {markdown}
          </pre>
        ) : (
          <div className="text-xs text-gray-500 dark:text-slate-400">尚未生成 Markdown。</div>
        )}
      </div>
    );
  },
  validateContent: (content) =>
    typeof (content as any).title === 'string' ||
    typeof (content as any).markdown === 'string' ||
    Boolean((content as any).outline),
};

// --- Export all plugins ---

export const allPlugins: OutputPlugin[] = [
  faqPlugin,
  guidePlugin,
  timelinePlugin,
  mindmapPlugin,
  quizPlugin,
  briefingPlugin,
  slidesPlugin,
];
