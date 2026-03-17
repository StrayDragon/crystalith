import { useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

import { copyToClipboard } from "../../../../shared/clipboard";
import { useLayer } from "../../../../shared/layer";
import { toast } from "../../../../shared/toast";
import { t } from "../../../../shared/i18n";
import { useFocusTrap } from "../../shared/hooks/useFocusTrap";
import {
  toOptionalServiceDiagnostics,
  type DependencyHealthResponse,
} from "../hooks/useDependencyHealth";
import type { WorkspaceToolsDiagnostics } from "../../../../api/generated";

interface DiagnosticsDialogProps {
  open: boolean;
  onClose: () => void;
  isLoading: boolean;
  error: string;
  data: DependencyHealthResponse | null;
  toolsDiagnostics: WorkspaceToolsDiagnostics | null;
  toolsLoading?: boolean;
  toolsError?: string;
  onRefresh: () => void;
}

function toneForStatus(status: string): { bg: string; text: string } {
  switch (status) {
    case "healthy":
      return {
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-800 dark:text-emerald-200",
      };
    case "degraded":
      return {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-800 dark:text-amber-200",
      };
    case "disabled":
      return { bg: "bg-gray-100 dark:bg-slate-800", text: "text-gray-700 dark:text-slate-200" };
    case "unknown":
    default:
      return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-200" };
  }
}

function toneForPluginStatus(status: string): { bg: string; text: string } {
  switch (status) {
    case "loaded":
      return {
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-800 dark:text-emerald-200",
      };
    case "skipped":
      return {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-800 dark:text-amber-200",
      };
    case "not_installed":
      return { bg: "bg-gray-100 dark:bg-slate-800", text: "text-gray-700 dark:text-slate-200" };
    default:
      return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-200" };
  }
}

function labelForOptionalStatus(status: string): string {
  switch (status) {
    case "healthy":
      return t("workspace.diagnostics.status.healthy");
    case "degraded":
      return t("workspace.diagnostics.status.degraded");
    case "disabled":
      return t("workspace.diagnostics.status.disabled");
    case "unknown":
      return t("workspace.diagnostics.status.unknown");
    default:
      return status;
  }
}

function labelForCoreHealth(healthy: boolean | null | undefined): string {
  if (healthy === true) {
    return t("workspace.diagnostics.status.healthy");
  }
  if (healthy === false) {
    return t("workspace.diagnostics.status.unhealthy");
  }
  return t("workspace.diagnostics.status.na");
}

export default function DiagnosticsDialog({
  open,
  onClose,
  isLoading,
  error,
  data,
  toolsDiagnostics,
  toolsLoading = false,
  toolsError = "",
  onRefresh,
}: DiagnosticsDialogProps) {
  const { style: modalStyle } = useLayer("modal");
  const modalRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap({
    active: open,
    containerRef: modalRef,
    onEscape: onClose,
  });

  const optionalItems = useMemo(
    () => toOptionalServiceDiagnostics(data?.optional),
    [data?.optional],
  );

  const loadedPlugins = useMemo(() => toolsDiagnostics?.plugins?.loaded ?? [], [toolsDiagnostics]);
  const skippedPlugins = useMemo(
    () => toolsDiagnostics?.plugins?.skipped ?? {},
    [toolsDiagnostics],
  );
  const officialEntries = useMemo(() => {
    const official = toolsDiagnostics?.official ?? {};
    return Object.entries(official).sort(([a], [b]) => a.localeCompare(b));
  }, [toolsDiagnostics]);
  const missingOfficial = useMemo(
    () => officialEntries.filter(([, item]) => item.status !== "loaded"),
    [officialEntries],
  );
  const slidesDiagnostic = useMemo(() => toolsDiagnostics?.slides ?? null, [toolsDiagnostics]);
  const slidesOfficial = useMemo(
    () => toolsDiagnostics?.official?.["slides-slidev"] ?? null,
    [toolsDiagnostics],
  );

  const handleCopy = useCallback(async (value: string) => {
    await copyToClipboard(value);
    toast.success(t("common.copied_to_clipboard"));
  }, []);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 relative flex items-center justify-center"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label={t("workspace.diagnostics.title")}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t("common.close")}
        tabIndex={-1}
      />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 ux-modal-in overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900 dark:text-slate-100">
              {t("workspace.diagnostics.title")}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400">
              {data?.generated_at
                ? t("workspace.diagnostics.generated_at", { timestamp: data.generated_at })
                : t("workspace.diagnostics.description")}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="w-9 h-9 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center justify-center text-gray-700 dark:text-slate-200"
              aria-label={t("workspace.diagnostics.refresh_aria")}
            >
              <RefreshIcon sx={{ fontSize: 18 }} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center text-gray-700 dark:text-slate-200"
              aria-label={t("common.close")}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50/60 dark:bg-red-950/20 px-4 py-3">
              <div className="text-sm font-semibold text-red-800 dark:text-red-200">
                {t("workspace.diagnostics.failure_title")}
              </div>
              <div className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</div>
            </div>
          ) : null}

          {isLoading && !data ? (
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-700 dark:text-slate-200">
              {t("common.loading")}
            </div>
          ) : null}

          {data?.core ? (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-2">
                {t("workspace.diagnostics.section.core")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(data.core).map(([key, service]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {service.service}
                      </div>
                      <div
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          service.healthy
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {labelForCoreHealth(service.healthy)}
                      </div>
                    </div>
                    {service.note ? (
                      <div className="mt-1 text-[11px] text-gray-600 dark:text-slate-400">
                        {service.note}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-2">
              {t("workspace.diagnostics.section.optional")}
            </div>

            <div className="space-y-2">
              {optionalItems.map((item) => {
                const tone = toneForStatus(item.status);
                const statusLabel = labelForOptionalStatus(item.status);
                return (
                  <div
                    key={item.key}
                    className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                            {item.label}
                          </div>
                          <div
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tone.bg} ${tone.text}`}
                          >
                            {statusLabel}
                          </div>
                          {!item.enabled ? (
                            <div className="text-[10px] text-gray-500 dark:text-slate-400">
                              {t("workspace.diagnostics.disabled_badge")}
                            </div>
                          ) : null}
                        </div>

                        {item.endpoint ? (
                          <div className="mt-1 text-[11px] text-gray-600 dark:text-slate-400">
                            {t("workspace.diagnostics.label.endpoint")}{" "}
                            <span className="font-mono">{item.endpoint}</span>
                          </div>
                        ) : null}

                        {item.errorCode ? (
                          <div className="mt-1 text-[11px] text-gray-600 dark:text-slate-400">
                            {t("workspace.diagnostics.label.error_code")}{" "}
                            <span className="font-mono">{item.errorCode}</span>
                          </div>
                        ) : null}

                        {item.error ? (
                          <div className="mt-1 text-[11px] text-red-700 dark:text-red-300">
                            {item.error}
                          </div>
                        ) : null}

                        {item.recoveryHint ? (
                          <div className="mt-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-semibold text-gray-800 dark:text-slate-200">
                                {t("workspace.diagnostics.label.recovery_hint")}
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleCopy(item.recoveryHint ?? "")}
                                className="px-2 py-1 rounded-md text-[11px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1"
                              >
                                <ContentCopyIcon sx={{ fontSize: 14 }} />
                                {t("common.copy")}
                              </button>
                            </div>
                            <pre className="mt-1 whitespace-pre-wrap text-[11px] text-gray-700 dark:text-slate-300">
                              {item.recoveryHint}
                            </pre>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex-shrink-0 text-[10px] text-gray-500 dark:text-slate-400">
                        {item.lastProbe
                          ? t("workspace.diagnostics.label.last_probe", {
                              timestamp: item.lastProbe,
                            })
                          : null}
                      </div>
                    </div>

                    {item.key === "ollama" && data?.optional?.ollama?.hosts ? (
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold text-gray-700 dark:text-slate-200 mb-1">
                          {t("workspace.diagnostics.section.hosts")}
                        </div>
                        <div className="space-y-1">
                          {Object.entries(data.optional.ollama.hosts).map(([host, hostStatus]) => (
                            <div
                              key={host}
                              className="flex items-center justify-between gap-2 text-[11px] text-gray-700 dark:text-slate-300"
                            >
                              <span className="font-mono truncate">{host}</span>
                              <span className="text-gray-500 dark:text-slate-400">
                                {labelForOptionalStatus(
                                  hostStatus.healthy ? "healthy" : "degraded",
                                )}
                                {hostStatus.model_count != null
                                  ? ` · ${t("workspace.diagnostics.label.models", { count: hostStatus.model_count })}`
                                  : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {optionalItems.length === 0 && !isLoading ? (
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  {t("workspace.diagnostics.empty_optional")}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-2">
              Plugins
            </div>

            {toolsError ? (
              <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3">
                <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  工具诊断不可用
                </div>
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">{toolsError}</div>
              </div>
            ) : null}

            {toolsLoading && !toolsDiagnostics ? (
              <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-700 dark:text-slate-200">
                {t("common.loading")}
              </div>
            ) : null}

            {toolsDiagnostics ? (
              <div className="space-y-2">
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                        已加载插件
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400">
                        loaded: {loadedPlugins.length} · skipped:{" "}
                        {Object.keys(skippedPlugins).length} · official missing:{" "}
                        {missingOfficial.length}
                      </div>
                    </div>
                    {loadedPlugins.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => void handleCopy(loadedPlugins.join("\n"))}
                        className="px-2 py-1 rounded-md text-[11px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1"
                      >
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                        {t("common.copy")}
                      </button>
                    ) : null}
                  </div>
                  {loadedPlugins.length > 0 ? (
                    <pre className="mt-2 whitespace-pre-wrap text-[11px] text-gray-700 dark:text-slate-300">
                      {loadedPlugins.join("\n")}
                    </pre>
                  ) : (
                    <div className="mt-2 text-[11px] text-gray-600 dark:text-slate-400">
                      未检测到已加载插件（可能为 core-only 安装或连接未建立）。
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                        Slides 工作流
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-700 dark:text-slate-300">
                        {slidesDiagnostic?.active_plugin_id
                          ? `active: ${slidesDiagnostic.active_plugin_id}${slidesDiagnostic.engine ? ` · engine: ${slidesDiagnostic.engine}` : ""}`
                          : "当前未激活 slides workflow plugin"}
                      </div>
                    </div>
                    <div
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        toneForPluginStatus(
                          slidesDiagnostic?.active_plugin_id
                            ? "loaded"
                            : (slidesOfficial?.status ?? "not_installed"),
                        ).bg
                      } ${
                        toneForPluginStatus(
                          slidesDiagnostic?.active_plugin_id
                            ? "loaded"
                            : (slidesOfficial?.status ?? "not_installed"),
                        ).text
                      }`}
                    >
                      {slidesDiagnostic?.active_plugin_id
                        ? "可用"
                        : slidesOfficial?.status === "loaded"
                          ? "待配置"
                          : slidesOfficial?.status === "skipped"
                            ? "已跳过"
                            : "未安装"}
                    </div>
                  </div>
                  {slidesDiagnostic?.error_code ? (
                    <div className="mt-2 text-[11px] text-gray-700 dark:text-slate-300">
                      <span className="font-mono">{slidesDiagnostic.error_code}</span>
                      {slidesDiagnostic.message ? ` · ${slidesDiagnostic.message}` : ""}
                    </div>
                  ) : slidesDiagnostic?.message ? (
                    <div className="mt-2 text-[11px] text-gray-700 dark:text-slate-300">
                      {slidesDiagnostic.message}
                    </div>
                  ) : null}
                  {slidesDiagnostic?.hint || slidesOfficial?.hint ? (
                    <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-[11px] text-amber-800 dark:text-amber-200">
                          {slidesDiagnostic?.hint ?? slidesOfficial?.hint}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopy(slidesDiagnostic?.hint ?? slidesOfficial?.hint ?? "")
                          }
                          className="px-2 py-1 rounded-md text-[11px] bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/30 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-1"
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                          {t("common.copy")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {Object.entries(skippedPlugins).length > 0 ? (
                  <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
                      跳过的插件
                    </div>
                    <div className="space-y-2">
                      {Object.entries(skippedPlugins).map(([pluginId, detail]) => (
                        <div
                          key={pluginId}
                          className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-gray-800 dark:text-slate-200">
                                <span className="font-mono">{pluginId}</span>
                              </div>
                              <div className="mt-0.5 text-[11px] text-gray-700 dark:text-slate-300">
                                <span className="font-mono">{detail.error_code}</span> ·{" "}
                                {detail.message}
                              </div>
                            </div>
                            {detail.hint ? (
                              <button
                                type="button"
                                onClick={() => void handleCopy(detail.hint ?? "")}
                                className="px-2 py-1 rounded-md text-[11px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1"
                              >
                                <ContentCopyIcon sx={{ fontSize: 14 }} />
                                {t("common.copy")}
                              </button>
                            ) : null}
                          </div>
                          {detail.hint ? (
                            <pre className="mt-1 whitespace-pre-wrap text-[11px] text-gray-700 dark:text-slate-300">
                              {detail.hint}
                            </pre>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                  <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
                    官方插件（catalog）
                  </div>

                  {missingOfficial.length === 0 ? (
                    <div className="text-[11px] text-gray-600 dark:text-slate-400">
                      所有官方插件均已加载。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {missingOfficial.map(([pluginId, item]) => {
                        const tone = toneForPluginStatus(item.status);
                        return (
                          <div
                            key={pluginId}
                            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="text-[11px] font-semibold text-gray-800 dark:text-slate-200">
                                    <span className="font-mono">{pluginId}</span>
                                  </div>
                                  <div
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tone.bg} ${tone.text}`}
                                  >
                                    {item.status}
                                  </div>
                                </div>
                                {item.hint ? (
                                  <pre className="mt-1 whitespace-pre-wrap text-[11px] text-gray-700 dark:text-slate-300">
                                    {item.hint}
                                  </pre>
                                ) : null}
                              </div>
                              {item.hint ? (
                                <button
                                  type="button"
                                  onClick={() => void handleCopy(item.hint ?? "")}
                                  className="px-2 py-1 rounded-md text-[11px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1"
                                >
                                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                                  {t("common.copy")}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
