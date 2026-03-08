import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Menu, MenuHandler, MenuList, MenuItem, Spinner } from "@material-tailwind/react";
import { Download as DownloadIcon } from "@mui/icons-material";

import type { FrontendBundleDescriptor, OutputItem, OutputTypeId } from "../../shared/types";
import { getOutputPayloadWarnings, isFallbackOutputPayload } from "../../shared/outputPayload";
import { LAYER_LEVELS } from "../../../../shared/layer";
import { t } from "../../../../shared/i18n";
import { useWorkspaceStore } from "../../shared/state/workspaceStore";
import { getBuiltinBundleLoader } from "../../../../plugins/official/registry";
import { EXPORT_FORMAT_LABELS } from "./exporters";
import { useExport } from "./useExport";
import GenericOutputRenderer from "./GenericOutputRenderer";

interface OutputContentProps {
  output: OutputItem;
}

type BundleRenderer = (content: unknown, isFallback?: boolean) => ReactNode;

function isSupportedFrontendBundle(
  bundle: FrontendBundleDescriptor | null,
): bundle is FrontendBundleDescriptor {
  if (!bundle) return false;
  if (bundle.api_version !== "v1") return false;
  if (bundle.kind !== "builtin") return false;
  if (!bundle.id.trim() || !bundle.export.trim()) return false;
  return true;
}

export default function OutputContent({ output }: OutputContentProps) {
  const content = output.content ?? {};
  const isFallback = isFallbackOutputPayload(content);
  const warnings = useMemo(() => getOutputPayloadWarnings(content), [content]);
  const typeId = output.type as OutputTypeId;
  const { isExporting, activeFormat, getSupportedFormats, exportOutput } = useExport();
  const renderDescriptor = useWorkspaceStore((s) => s.outputTypeRenderDescriptors[typeId] ?? null);
  const frontendBundle = useWorkspaceStore((s) => s.outputTypeFrontendBundles[typeId] ?? null);
  const [bundleRenderer, setBundleRenderer] = useState<BundleRenderer | null>(null);

  const supportedFormats = useMemo(
    () => getSupportedFormats(typeId),
    [getSupportedFormats, typeId],
  );

  useEffect(() => {
    let cancelled = false;
    setBundleRenderer(null);

    if (!isSupportedFrontendBundle(frontendBundle)) return () => {};

    const loader = getBuiltinBundleLoader(frontendBundle.id);
    if (!loader) {
      if (import.meta.env.DEV) {
        console.warn(`Missing builtin frontend bundle loader: ${frontendBundle.id}`);
      }
      return () => {};
    }

    void loader()
      .then((mod) => {
        const exported = (mod as unknown as Record<string, unknown>)[frontendBundle.export];
        if (typeof exported !== "function") {
          if (import.meta.env.DEV) {
            console.warn(
              `Invalid frontend bundle export "${frontendBundle.export}" for "${frontendBundle.id}"`,
            );
          }
          return;
        }
        if (cancelled) return;
        setBundleRenderer(() => exported as BundleRenderer);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn(`Failed to load frontend bundle "${frontendBundle.id}"`, error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    frontendBundle?.api_version,
    frontendBundle?.export,
    frontendBundle?.id,
    frontendBundle?.kind,
  ]);

  const body = bundleRenderer ? (
    bundleRenderer(content, isFallback)
  ) : renderDescriptor ? (
    <GenericOutputRenderer content={content} renderDescriptor={renderDescriptor} />
  ) : (
    <pre className="StructuredOutputRaw rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
      {JSON.stringify(output.content ?? {}, null, 2)}
    </pre>
  );

  return (
    <div className="space-y-3">
      {import.meta.env.DEV && warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="font-semibold">{t("common.debug_warnings")}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {warnings.map((warning, index) => (
              <span
                key={`${warning}-${index}`}
                className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[11px] text-amber-900 dark:bg-amber-500/20 dark:text-amber-100"
              >
                {warning}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {isExporting && activeFormat ? (
          <span className="text-xs text-gray-500 dark:text-slate-300" aria-live="polite">
            正在导出 {EXPORT_FORMAT_LABELS[activeFormat]}...
          </span>
        ) : null}
        <Menu placement="bottom-end">
          <MenuHandler>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="导出输出"
              disabled={isExporting}
            >
              <DownloadIcon style={{ fontSize: 14 }} />
              导出
            </button>
          </MenuHandler>
          <MenuList
            className="p-1 min-w-[180px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700"
            style={{ zIndex: LAYER_LEVELS.dropdown }}
          >
            {supportedFormats.map((format) => {
              const formatLabel = EXPORT_FORMAT_LABELS[format];
              const isCurrent = isExporting && activeFormat === format;

              return (
                <MenuItem
                  key={format}
                  className="flex items-center justify-between gap-2 py-2 px-3 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800"
                  disabled={isExporting}
                  onClick={() => {
                    void exportOutput(output, format);
                  }}
                >
                  <span>导出为 {formatLabel}</span>
                  {isCurrent ? <Spinner className="h-3.5 w-3.5" /> : null}
                </MenuItem>
              );
            })}
          </MenuList>
        </Menu>
      </div>
      {body}
    </div>
  );
}
