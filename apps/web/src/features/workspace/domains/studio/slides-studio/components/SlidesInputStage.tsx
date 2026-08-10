import { Button, Input, Textarea, Typography } from '@material-tailwind/react';

import { ModelSelector } from '../../ModelSelector';
import type { SlidesInputStageProps } from '../types';

export function SlidesInputStage({
  title,
  onTitleChange,
  prompt,
  onPromptChange,
  configPreference,
  onConfigPreferenceChange,
  configQuantity,
  onConfigQuantityChange,
  configStructure,
  onConfigStructureChange,
  configAudience,
  onConfigAudienceChange,
  configTone,
  onConfigToneChange,
  configLanguage,
  onConfigLanguageChange,
  configDensity,
  onConfigDensityChange,
  configThemePreset,
  onConfigThemePresetChange,
  showAdvanced,
  onToggleAdvanced,
  configFrontmatter,
  onConfigFrontmatterChange,
  frontmatterPreview,
  configModelId,
  onConfigModelIdChange,
  isConnected,
  selectionLabel,
  quantityOptions,
  structureOptions,
  audienceOptions,
  toneOptions,
  languageOptions,
  densityOptions,
  themePresetOptions,
}: SlidesInputStageProps) {
  return (
    <div className="space-y-4">
      <Input
        label="演示标题"
        value={title}
        onChange={(event) => {
          onTitleChange(event.target.value);
        }}
        crossOrigin="anonymous"
      />
      <Textarea
        label="演示说明"
        value={prompt}
        onChange={(event) => {
          onPromptChange(event.target.value);
        }}
        rows={5}
      />
      <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Typography variant="small" className="text-gray-700 dark:text-slate-200 font-semibold">
            生成设置
          </Typography>
          <Button
            variant="text"
            size="sm"
            className="px-2 py-1 text-xs text-gray-600 dark:text-slate-300"
            onClick={onToggleAdvanced}
          >
            {showAdvanced ? '收起高级设置' : '高级设置'}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
            生成倾向
            <select
              className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
              value={configPreference}
              onChange={(event) => {
                const next = event.target.value;
                if (next === 'default' || next === 'quality' || next === 'speed') {
                  onConfigPreferenceChange(next);
                }
              }}
              name="slidePreference"
            >
              <option value="default">默认</option>
              <option value="quality">质量</option>
              <option value="speed">速度</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
            幻灯片数量
            <select
              className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
              value={configQuantity}
              onChange={(event) => {
                onConfigQuantityChange(event.target.value);
              }}
              name="slideQuantity"
            >
              {quantityOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
            结构模板
            <select
              className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
              value={configStructure}
              onChange={(event) => {
                onConfigStructureChange(event.target.value);
              }}
              name="slideStructure"
            >
              {structureOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
            受众定位
            <select
              className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
              value={configAudience}
              onChange={(event) => {
                onConfigAudienceChange(event.target.value);
              }}
              name="slideAudience"
            >
              {audienceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
            语气风格
            <select
              className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
              value={configTone}
              onChange={(event) => {
                onConfigToneChange(event.target.value);
              }}
              name="slideTone"
            >
              {toneOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
            输出语言
            <select
              className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
              value={configLanguage}
              onChange={(event) => {
                onConfigLanguageChange(event.target.value);
              }}
              name="slideLanguage"
            >
              {languageOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
            排版密度
            <select
              className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
              value={configDensity}
              onChange={(event) => {
                onConfigDensityChange(event.target.value);
              }}
              name="slideDensity"
            >
              {densityOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
            主题预设
            <select
              className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
              value={configThemePreset}
              onChange={(event) => {
                onConfigThemePresetChange(event.target.value);
              }}
              name="slideThemePreset"
            >
              {themePresetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {showAdvanced && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Typography
                variant="small"
                className="text-gray-600 dark:text-slate-300 text-xs font-medium"
              >
                Frontmatter 覆盖（YAML，可选）
              </Typography>
              <Textarea
                value={configFrontmatter}
                onChange={(event) => {
                  onConfigFrontmatterChange(event.target.value);
                }}
                rows={5}
                className="font-mono text-[11px]"
                placeholder={
                  'theme: default\ncolorSchema: light\nfonts:\n  sans: "Manrope"\ntransition: fade'
                }
              />
              <Typography variant="small" className="text-gray-500 dark:text-slate-400 text-[11px]">
                留空将使用主题预设自动生成；如需覆盖请填写 YAML（不需要 --- 包裹）。
              </Typography>
            </div>
            <div className="space-y-1">
              <Typography
                variant="small"
                className="text-gray-600 dark:text-slate-300 text-xs font-medium"
              >
                Frontmatter 预览
              </Typography>
              <pre className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-[11px] text-gray-700 dark:text-slate-200 whitespace-pre-wrap">
                {frontmatterPreview}
              </pre>
            </div>
            {isConnected && (
              <div className="space-y-1">
                <Typography
                  variant="small"
                  className="text-gray-600 dark:text-slate-300 text-xs font-medium"
                >
                  AI 模型
                </Typography>
                <ModelSelector
                  value={configModelId}
                  onChange={onConfigModelIdChange}
                  role="chat"
                  label="选择生成模型"
                  size="md"
                />
              </div>
            )}
          </div>
        )}
      </div>
      <Typography variant="small" className="text-gray-600 dark:text-slate-300">
        {selectionLabel}
      </Typography>
    </div>
  );
}
