import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Add as AddIcon,
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

import ConfirmPopover from "../../../../shared/ConfirmPopover";
import { copyToClipboard } from "../../../../shared/clipboard";
import { useLayer } from "../../../../shared/layer";
import { toast } from "../../../../shared/toast";
import { useFocusTrap } from "../../shared/hooks/useFocusTrap";
import { usePromptPresets } from "../../shared/hooks/usePromptPresets";

const TRIGGER_RE = /^[a-z0-9_-]{1,32}$/;

interface SystemConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

type EditorMode = "create" | "edit";

interface EditorState {
  mode: EditorMode;
  presetId: number | null;
  trigger: string;
  description: string;
  systemPrompt: string;
  enabled: boolean;
}

function labelForSource(source: "builtin" | "custom") {
  return source === "builtin" ? "内置" : "自定义";
}

function toTextareaValue(value: string | null | undefined) {
  return (value ?? "").toString();
}

export default function SystemConfigDialog({ open, onClose }: SystemConfigDialogProps) {
  const { style: modalStyle } = useLayer("modal");
  const modalRef = useRef<HTMLDivElement | null>(null);

  const {
    presets,
    isLoading,
    error,
    refreshPresets,
    createCustomPreset,
    updateCustomPreset,
    deleteCustomPreset,
  } = usePromptPresets({ enabled: open });

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusTrap({
    active: open,
    containerRef: modalRef,
    onEscape: () => {
      setEditor(null);
      onClose();
    },
  });

  const builtinPresets = useMemo(
    () =>
      presets
        .filter((item) => item.source === "builtin")
        .sort((a, b) => a.trigger.localeCompare(b.trigger)),
    [presets],
  );
  const customPresets = useMemo(
    () =>
      presets
        .filter((item) => item.source === "custom")
        .sort((a, b) => a.trigger.localeCompare(b.trigger)),
    [presets],
  );

  const startCreate = useCallback(() => {
    setEditor({
      mode: "create",
      presetId: null,
      trigger: "",
      description: "",
      systemPrompt: "",
      enabled: true,
    });
  }, []);

  const startEdit = useCallback((preset: (typeof customPresets)[number]) => {
    setEditor({
      mode: "edit",
      presetId: preset.preset_id ?? null,
      trigger: preset.trigger,
      description: preset.description ?? "",
      systemPrompt: preset.system_prompt,
      enabled: preset.enabled,
    });
  }, []);

  const startCopyBuiltin = useCallback((preset: (typeof builtinPresets)[number]) => {
    const base = preset.trigger ? `${preset.trigger}-copy` : "custom";
    setEditor({
      mode: "create",
      presetId: null,
      trigger: base.slice(0, 32),
      description: preset.description ?? "",
      systemPrompt: preset.system_prompt,
      enabled: true,
    });
  }, []);

  const handleCopySystemPrompt = useCallback(async (systemPrompt: string) => {
    await copyToClipboard(systemPrompt);
    toast.success("已复制 system prompt");
  }, []);

  const validateTrigger = useCallback((value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return { ok: false, value: normalized, message: "触发词不能为空" };
    if (!TRIGGER_RE.test(normalized)) {
      return { ok: false, value: normalized, message: "触发词需匹配 [a-z0-9_-]{1,32}" };
    }
    return { ok: true, value: normalized, message: "" };
  }, []);

  const saveEditor = useCallback(async () => {
    if (!editor) return;
    const triggerResult = validateTrigger(editor.trigger);
    if (!triggerResult.ok) {
      toast.error(triggerResult.message);
      return;
    }
    const systemPrompt = editor.systemPrompt.trim();
    if (!systemPrompt) {
      toast.error("system prompt 不能为空");
      return;
    }

    setSaving(true);
    try {
      if (editor.mode === "create") {
        await createCustomPreset({
          trigger: triggerResult.value,
          description: editor.description.trim() || null,
          systemPrompt,
          enabled: editor.enabled,
        });
        toast.success("已创建预设");
        setEditor(null);
        return;
      }

      if (!editor.presetId) {
        toast.error("无效 preset id");
        return;
      }

      await updateCustomPreset(editor.presetId, {
        trigger: triggerResult.value,
        description: editor.description.trim() || null,
        systemPrompt,
        enabled: editor.enabled,
      });
      toast.success("已更新预设");
      setEditor(null);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  }, [createCustomPreset, editor, updateCustomPreset, validateTrigger]);

  const toggleCustomEnabled = useCallback(
    async (presetId: number, enabled: boolean) => {
      try {
        await updateCustomPreset(presetId, { enabled });
      } catch (err) {
        toast.error(String(err));
      }
    },
    [updateCustomPreset],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label="系统配置"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          setEditor(null);
          onClose();
        }}
        aria-label="关闭系统配置"
        tabIndex={-1}
      />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 ux-modal-in overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900 dark:text-slate-100">
              系统配置
            </div>
            <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400">
              管理 Chat 输入的 <span className="font-mono">/prompt:&lt;id&gt;</span> 预设（触发词 /
              描述 / system prompt / 启用状态）
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshPresets()}
              className="w-9 h-9 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center justify-center text-gray-700 dark:text-slate-200"
              aria-label="刷新"
            >
              <RefreshIcon sx={{ fontSize: 18 }} />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditor(null);
                onClose();
              }}
              className="w-9 h-9 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center text-gray-700 dark:text-slate-200"
              aria-label="关闭"
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div className="p-5 max-h-[75vh] overflow-y-auto">
          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50/60 dark:bg-red-950/20 px-4 py-3">
              <div className="text-sm font-semibold text-red-800 dark:text-red-200">加载失败</div>
              <div className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-xs font-semibold text-gray-700 dark:text-slate-200">
              Prompt Presets
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-200"
            >
              <AddIcon sx={{ fontSize: 16 }} />
              新建预设
            </button>
          </div>

          {editor ? (
            <div className="mb-5 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {editor.mode === "create" ? "新建预设" : "编辑预设"}
                </div>
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                >
                  取消
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-[11px] font-semibold text-gray-700 dark:text-slate-200">
                    触发词（id）
                  </div>
                  <input
                    value={editor.trigger}
                    onChange={(e) =>
                      setEditor((prev) => (prev ? { ...prev, trigger: e.target.value } : prev))
                    }
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono text-gray-900 dark:text-slate-100"
                    placeholder="demo"
                    disabled={saving}
                  />
                  <div className="mt-1 text-[10px] text-gray-500 dark:text-slate-400">
                    最终触发为 <span className="font-mono">/prompt:&lt;id&gt;</span>
                  </div>
                </label>

                <label className="block">
                  <div className="text-[11px] font-semibold text-gray-700 dark:text-slate-200">
                    描述（用于补全提示）
                  </div>
                  <input
                    value={editor.description}
                    onChange={(e) =>
                      setEditor((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                    }
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100"
                    placeholder="一句话说明这个 preset 的用途…"
                    disabled={saving}
                  />
                </label>
              </div>

              <div className="block mt-3">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`system-config-system-prompt-${editor.presetId ?? "new"}`}
                    className="text-[11px] font-semibold text-gray-700 dark:text-slate-200"
                  >
                    system prompt
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleCopySystemPrompt(editor.systemPrompt)}
                    className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1"
                    disabled={saving}
                  >
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                    复制
                  </button>
                </div>
                <textarea
                  id={`system-config-system-prompt-${editor.presetId ?? "new"}`}
                  value={editor.systemPrompt}
                  onChange={(e) =>
                    setEditor((prev) => (prev ? { ...prev, systemPrompt: e.target.value } : prev))
                  }
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono text-gray-900 dark:text-slate-100 min-h-[140px]"
                  placeholder="写入将覆盖 QA 的 system message 的内容…"
                  disabled={saving}
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={editor.enabled}
                    onChange={(e) =>
                      setEditor((prev) => (prev ? { ...prev, enabled: e.target.checked } : prev))
                    }
                    disabled={saving}
                  />
                  启用
                </label>

                <button
                  type="button"
                  onClick={() => void saveEditor()}
                  className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={saving}
                >
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-3">
                内置预设
              </div>

              {isLoading && presets.length === 0 ? (
                <div className="text-xs text-gray-500 dark:text-slate-400">加载中…</div>
              ) : builtinPresets.length === 0 ? (
                <div className="text-xs text-gray-500 dark:text-slate-400">无</div>
              ) : (
                <div className="space-y-2">
                  {builtinPresets.map((preset) => (
                    <div
                      key={`builtin:${preset.trigger}`}
                      className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-950/20 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-900 dark:text-slate-100">
                              /prompt:{preset.trigger}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                              {labelForSource(preset.source)}
                            </span>
                          </div>
                          {preset.description ? (
                            <div className="mt-1 text-[11px] text-gray-600 dark:text-slate-400">
                              {preset.description}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startCopyBuiltin(preset)}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-white/80 dark:hover:bg-slate-800 text-[11px]"
                          >
                            复制为自定义
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopySystemPrompt(toTextareaValue(preset.system_prompt))
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-white/80 dark:hover:bg-slate-800 text-[11px] flex items-center gap-1"
                          >
                            <ContentCopyIcon sx={{ fontSize: 14 }} />
                            复制 prompt
                          </button>
                        </div>
                      </div>

                      <details className="mt-2">
                        <summary className="text-[11px] text-gray-600 dark:text-slate-400 cursor-pointer">
                          查看 system prompt
                        </summary>
                        <pre className="mt-2 p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-[11px] text-gray-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap">
                          {preset.system_prompt}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-3">
                自定义预设
              </div>

              {customPresets.length === 0 ? (
                <div className="text-xs text-gray-500 dark:text-slate-400">
                  暂无自定义预设。点击右上角“新建预设”开始。
                </div>
              ) : (
                <div className="space-y-2">
                  {customPresets.map((preset) => {
                    const presetId = preset.preset_id ?? null;
                    return (
                      <div
                        key={`custom:${preset.trigger}:${presetId ?? "na"}`}
                        className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-gray-900 dark:text-slate-100">
                                /prompt:{preset.trigger}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200">
                                {labelForSource(preset.source)}
                              </span>
                              {!preset.enabled ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300">
                                  已禁用
                                </span>
                              ) : null}
                            </div>
                            {preset.description ? (
                              <div className="mt-1 text-[11px] text-gray-600 dark:text-slate-400">
                                {preset.description}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {presetId ? (
                              <label className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={preset.enabled}
                                  onChange={(e) =>
                                    void toggleCustomEnabled(presetId, e.target.checked)
                                  }
                                />
                                启用
                              </label>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => startEdit(preset)}
                              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-[11px] flex items-center gap-1"
                              disabled={!presetId}
                            >
                              <EditIcon sx={{ fontSize: 14 }} />
                              编辑
                            </button>

                            <ConfirmPopover
                              message={`确认删除 /prompt:${preset.trigger} ?`}
                              onConfirm={() => {
                                if (!presetId) return;
                                void deleteCustomPreset(presetId).then(() =>
                                  toast.success("已删除预设"),
                                );
                              }}
                              placement="top"
                              disabled={!presetId}
                            >
                              <button
                                type="button"
                                className="px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-[11px] text-red-700 dark:text-red-300"
                                disabled={!presetId}
                              >
                                删除
                              </button>
                            </ConfirmPopover>
                          </div>
                        </div>

                        <details className="mt-2">
                          <summary className="text-[11px] text-gray-600 dark:text-slate-400 cursor-pointer">
                            查看 system prompt
                          </summary>
                          <div className="mt-2 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopySystemPrompt(toTextareaValue(preset.system_prompt))
                              }
                              className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1"
                            >
                              <ContentCopyIcon sx={{ fontSize: 14 }} />
                              复制
                            </button>
                          </div>
                          <pre className="mt-2 p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950/20 text-[11px] text-gray-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap">
                            {preset.system_prompt}
                          </pre>
                        </details>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
