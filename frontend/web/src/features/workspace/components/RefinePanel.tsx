import { useEffect, useMemo, useRef, useState } from 'react';

import type { RefineJob, RefineMode, RefineSettings, RefineTemplate } from '../types';
import { formatOutputForCopy } from '../utils';

interface RefinePanelProps {
  mode: RefineMode;
  onModeChange: (mode: RefineMode) => void;
  isBlocked: boolean;
  selectedCitationCount: number;
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  templates: RefineTemplate[];
  jobs: RefineJob[];
  onTogglePin: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  settings: RefineSettings;
  onToggleSetting: (key: keyof RefineSettings) => void;
  highlightedJobId: string | null;
}

interface RefineTemplateSectionProps {
  title: string;
  items: RefineTemplate[];
  activeTemplateId: string | null;
  favoriteSet: Set<string>;
  onSelect: (item: RefineTemplate) => void;
  onToggleFavorite: (templateId: string) => void;
}

interface RefineTemplateItemProps {
  item: RefineTemplate;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: (item: RefineTemplate) => void;
  onToggleFavorite: (templateId: string) => void;
}

function RefineTemplateItem({
  item,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: RefineTemplateItemProps) {
  return (
    <div className={`RefineTemplateItem ${isActive ? 'isActive' : ''}`}>
      <button
        type="button"
        className="RefineTemplateButton"
        aria-pressed={isActive}
        onClick={() => onSelect(item)}
      >
        {item.label}
      </button>
      <button
        type="button"
        className={`RefineTemplateStar ${isFavorite ? 'isActive' : ''}`}
        aria-label={isFavorite ? `取消收藏 ${item.label}` : `收藏 ${item.label}`}
        onClick={() => onToggleFavorite(item.id)}
      >
        {isFavorite ? '★' : '☆'}
      </button>
    </div>
  );
}

function RefineTemplateSection({
  title,
  items,
  activeTemplateId,
  favoriteSet,
  onSelect,
  onToggleFavorite,
}: RefineTemplateSectionProps) {
  if (!items.length) return null;
  return (
    <div className="RefineTemplateGroup">
      <div className="RefineTemplateGroup__title">{title}</div>
      <div className="RefineTemplateList" role="list">
        {items.map((item) => (
          <RefineTemplateItem
            key={item.id}
            item={item}
            isActive={activeTemplateId === item.id}
            isFavorite={favoriteSet.has(item.id)}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}

export default function RefinePanel({
  mode,
  onModeChange,
  isBlocked,
  selectedCitationCount,
  prompt,
  onPromptChange,
  onGenerate,
  templates,
  jobs,
  onTogglePin,
  onDeleteJob,
  settings,
  onToggleSetting,
  highlightedJobId,
}: RefinePanelProps) {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const configRef = useRef<HTMLDivElement | null>(null);
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState<string[]>([]);
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const normalizedPrompt = prompt.trim();
  const activeTemplate =
    templates.find((item) => item.prompt.trim() === normalizedPrompt) ?? null;
  const activeTemplateId = activeTemplate?.id ?? null;
  const favoriteSet = useMemo(
    () => new Set(favoriteTemplateIds),
    [favoriteTemplateIds],
  );
  const recentTemplates = useMemo(
    () =>
      recentTemplateIds
        .map((id) => templates.find((item) => item.id === id))
        .filter((item): item is RefineTemplate => Boolean(item) && !favoriteSet.has(item.id)),
    [recentTemplateIds, templates, favoriteSet],
  );
  const favoriteTemplates = useMemo(
    () => templates.filter((item) => favoriteSet.has(item.id)),
    [templates, favoriteSet],
  );
  const templateGroups = useMemo(() => {
    const order = ['决策', '行动', '风险', '分析', '洞察', '表达'];
    const grouped = new Map<string, RefineTemplate[]>();
    for (const item of templates) {
      const group = item.group ?? '其他';
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)?.push(item);
    }
    const sorted: { id: string; label: string; items: RefineTemplate[] }[] = [];
    for (const group of order) {
      if (grouped.has(group)) {
        sorted.push({ id: group, label: group, items: grouped.get(group) ?? [] });
        grouped.delete(group);
      }
    }
    for (const [group, items] of grouped) {
      sorted.push({ id: group, label: group, items });
    }
    return sorted;
  }, [templates]);
  const statusLabels: Record<RefineJob['status'], string> = {
    queued: '排队中',
    running: '生成中',
    done: '已完成',
    error: '失败',
  };
  const pendingCount = jobs.filter(
    (job) => job.status === 'queued' || job.status === 'running',
  ).length;
  const totalCount = jobs.length;
  const progress = totalCount
    ? Math.round(((totalCount - pendingCount) / totalCount) * 100)
    : 0;
  const orderedJobs = useMemo(() => {
    const pinned: RefineJob[] = [];
    const normal: RefineJob[] = [];
    for (const job of jobs) {
      if (job.pinned) pinned.push(job);
      else normal.push(job);
    }
    return [...pinned, ...normal];
  }, [jobs]);

  useEffect(() => {
    if (!isConfigOpen) return undefined;
    function handleClick(event: MouseEvent) {
      if (!configRef.current) return;
      if (configRef.current.contains(event.target as Node)) return;
      setIsConfigOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isConfigOpen]);

  function handleSelectTemplate(item: RefineTemplate) {
    onPromptChange(item.prompt);
    promptRef.current?.focus();
    setRecentTemplateIds((prev) => {
      const next = [item.id, ...prev.filter((id) => id !== item.id)];
      return next.slice(0, 4);
    });
  }

  function handleToggleFavorite(templateId: string) {
    setFavoriteTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId],
    );
  }

  async function handleCopyJob(job: RefineJob) {
    const output = job.outputs?.[mode];
    const content = formatOutputForCopy(output, mode);
    if (!content) return;
    const text = `${job.title}\n${content}`.trim();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedJobId(job.id);
      window.setTimeout(() => {
        setCopiedJobId((current) => (current === job.id ? null : current));
      }, 1500);
    } catch (error) {
      // noop: clipboard may be blocked
    }
  }

  return (
    <div className="WorkspacePanelBody">
      <div className="RefineCard">
        <div className="RefineCard__header">
          <div>
            <div className="RefineCard__title">智能提炼</div>
            <div className="RefineCard__subtitle">
              {selectedCitationCount > 0
                ? `已选 ${selectedCitationCount} 条引用，将仅基于选中引用生成输出。`
                : '选择模板或自定义提示词，点击提炼生成输出。'}
            </div>
          </div>
          <div className="RefineCard__actions" ref={configRef}>
            <div className="RefineCard__badge">
              {totalCount ? `历史 ${totalCount} 条` : '暂无历史'}
            </div>
            <button
              type="button"
              className="IconButton"
              aria-label="输出中心配置"
              aria-expanded={isConfigOpen}
              onClick={() => setIsConfigOpen((prev) => !prev)}
              title="输出中心配置"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm9.25 3.75a7.25 7.25 0 0 0-.1-1.2l2-1.56-1.9-3.29-2.38.94a7.5 7.5 0 0 0-2.08-1.2L16.5 2h-4.9l-.29 2.69a7.5 7.5 0 0 0-2.08 1.2l-2.38-.94-1.9 3.29 2 1.56a7.25 7.25 0 0 0 0 2.4l-2 1.56 1.9 3.29 2.38-.94a7.5 7.5 0 0 0 2.08 1.2L11.6 22h4.9l.29-2.69a7.5 7.5 0 0 0 2.08-1.2l2.38.94 1.9-3.29-2-1.56c.07-.39.1-.79.1-1.2Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            {isConfigOpen ? (
              <div className="OutputConfigPanel">
                <div className="OutputConfigItem isDisabled">
                  <label className="Switch">
                    <input type="checkbox" checked={settings.autoTrigger} disabled />
                    <span className="SwitchTrack" />
                    <span className="SwitchThumb" />
                  </label>
                  <div>
                    <div className="OutputConfigTitle">对话后自动触发提炼</div>
                    <div className="OutputConfigHint">当前仅支持手动触发</div>
                  </div>
                </div>
                <div className="OutputConfigItem">
                  <label className="Switch">
                    <input
                      type="checkbox"
                      checked={settings.asyncQueue}
                      onChange={() => onToggleSetting('asyncQueue')}
                    />
                    <span className="SwitchTrack" />
                    <span className="SwitchThumb" />
                  </label>
                  <div>
                    <div className="OutputConfigTitle">开启后台异步队列</div>
                    <div className="OutputConfigHint">任务在后台依序生成输出</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="RefineTemplates">
          <RefineTemplateSection
            title="收藏"
            items={favoriteTemplates}
            activeTemplateId={activeTemplateId}
            favoriteSet={favoriteSet}
            onSelect={handleSelectTemplate}
            onToggleFavorite={handleToggleFavorite}
          />
          <RefineTemplateSection
            title="最近"
            items={recentTemplates}
            activeTemplateId={activeTemplateId}
            favoriteSet={favoriteSet}
            onSelect={handleSelectTemplate}
            onToggleFavorite={handleToggleFavorite}
          />
          {templateGroups.map((group) => (
            <RefineTemplateSection
              key={group.id}
              title={group.label}
              items={group.items}
              activeTemplateId={activeTemplateId}
              favoriteSet={favoriteSet}
              onSelect={handleSelectTemplate}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
        <textarea
          className="RefinePrompt"
          ref={promptRef}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={3}
          disabled={isBlocked}
          placeholder={isBlocked ? '请先创建笔记本' : '例如：提炼核心结论、行动项与风险点。'}
        />
        <div className="RefineModes" role="tablist" aria-label="输出格式">
          {([
            { id: 'paragraph', label: '段落' },
            { id: 'bullets', label: '要点' },
            { id: 'structured', label: '结构化' },
          ] as { id: RefineMode; label: string }[]).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={`RefineMode ${mode === item.id ? 'isActive' : ''}`}
              onClick={() => onModeChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="RefineActions">
          <button
            type="button"
            className="PrimaryButton"
            onClick={onGenerate}
            disabled={isBlocked || prompt.trim().length === 0}
          >
            立即提炼
          </button>
        </div>
      </div>

      {pendingCount > 0 ? (
        <div className="OutputQueueStatus">
          <div className="OutputQueueStatus__text">{pendingCount} 个任务处理中…</div>
          <div className="OutputQueueProgress" aria-hidden="true">
            <div className="OutputQueueProgress__bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      <div className="OutputList" aria-label="输出历史">
        {orderedJobs.length === 0 ? (
          <div className="OutputEmpty">
            <div className="OutputEmpty__icon" aria-hidden="true" />
            <div className="OutputEmpty__title">暂无输出历史</div>
            <div className="OutputEmpty__subtitle">点击左侧按钮或通过聊天触发智能提炼</div>
          </div>
        ) : (
          orderedJobs.map((job) => {
            const output = job.outputs?.[mode];
            const hasOutput = Boolean(
              output?.paragraph ||
                output?.bullets?.length ||
                output?.structured?.title ||
                output?.structured?.bullets?.length ||
                output?.structured?.terms?.length,
            );
            const isPending = job.status === 'queued' || job.status === 'running';
            const timeLabel = job.completedAtLabel ?? job.createdAtLabel;
            return (
              <div
                key={job.id}
                className={`RefineResultCard ${job.pinned ? 'isPinned' : ''} ${
                  isPending ? 'isLoading' : ''
                } ${highlightedJobId === job.id ? 'isNew' : ''}`}
              >
                <div className="RefineResultCard__header">
                  <div>
                    <div className="RefineResultCard__title">{job.title}</div>
                    <div className="RefineResultCard__meta">
                      <span className={`RefineResultStatus is-${job.status}`}>
                        {statusLabels[job.status]}
                      </span>
                      <span>
                        {job.chunkIds?.length ? `引用 ${job.chunkIds.length}` : '自动检索'}
                      </span>
                      <span>{timeLabel}</span>
                    </div>
                  </div>
                  <div className="RefineResultCard__actions">
                    {copiedJobId === job.id ? (
                      <span className="RefineResultCard__hint">已复制</span>
                    ) : null}
                    <button
                      type="button"
                      className="IconButton"
                      aria-label={job.pinned ? '取消固定' : '固定结果'}
                      aria-pressed={job.pinned}
                      onClick={() => onTogglePin(job.id)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M6 3h12l-3 5v5l2 2v1H7v-1l2-2V8L6 3Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="IconButton"
                      aria-label="复制结果"
                      onClick={() => handleCopyJob(job)}
                      disabled={!hasOutput}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M9 8h9a2 2 0 0 1 2 2v9h-9a2 2 0 0 1-2-2V8Z"
                          fill="currentColor"
                        />
                        <path
                          d="M6 5h9a2 2 0 0 1 2 2H8a2 2 0 0 0-2 2v9H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="IconButton"
                      aria-label="删除结果"
                      onClick={() => onDeleteJob(job.id)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M8 6h8l-.6 14H8.6L8 6Zm9-2h-4l-1-2h-2l-1 2H7v2h10V4Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="RefineResultCard__prompt">{job.prompt}</div>
                <div className="RefineResultCard__content">
                  {job.status === 'error' ? (
                    <div className="RefineResultCard__error">{job.error}</div>
                  ) : isPending ? (
                    <div className="RefineResultCard__placeholder">
                      <div className="RefineResultCard__line" />
                      <div className="RefineResultCard__line isShort" />
                      <div className="RefineResultCard__line" />
                    </div>
                  ) : !hasOutput ? (
                    <div className="RefineResultCard__empty">暂无内容</div>
                  ) : mode === 'paragraph' ? (
                    <p className="RefineParagraph">{output?.paragraph}</p>
                  ) : mode === 'bullets' ? (
                    <ul className="RefineBullets">
                      {output?.bullets?.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : mode === 'structured' && output?.structured ? (
                    <div className="RefineStructured">
                      <div className="RefineStructured__title">
                        {output.structured.title || '未命名主题'}
                      </div>
                      <ul className="RefineStructured__bullets">
                        {output.structured.bullets?.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      {output.structured.terms?.length ? (
                        <div className="RefineStructured__terms">
                          {output.structured.terms.map((term) => (
                            <span key={term} className="RefineTag">
                              {term}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
