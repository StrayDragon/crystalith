import { memo, useState, useMemo, useCallback } from "react";
import { Button, IconButton, Chip, Spinner } from "@material-tailwind/react";
import {
  Close as CloseIcon,
  Description as DescriptionIcon,
  Link as LinkIcon,
  Note as NoteIcon,
  Source as SourceIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  SelectAll as SelectAllIcon,
} from "@mui/icons-material";
import {
  exportResearchV1NotebooksNotebookIdResearchResearchIdExportPost as exportResearch,
  type ResearchSessionResponse,
} from "../../../../api/generated";
import { unwrapData } from "../../../../api/unwrap";
import { toast } from "../../../../shared/toast";
import { useLayer } from "../../../../shared/layer";

interface ResearchExportDialogProps {
  session: ResearchSessionResponse;
  onClose: () => void;
  onExportComplete?: () => void;
}

type ExportTarget = "source" | "note";
type ExportItemType = "report" | "reference";

interface ExportItem {
  id: string;
  type: ExportItemType;
  title: string;
  url?: string;
  snippet?: string;
  relevance?: number;
}

function ResearchExportDialog({ session, onClose, onExportComplete }: ResearchExportDialogProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(["report"]));
  const [exportTarget, setExportTarget] = useState<ExportTarget>("source");
  const [isExporting, setIsExporting] = useState(false);
  const [relevanceFilter, setRelevanceFilter] = useState<"all" | "high">("all");
  const { style: modalStyle } = useLayer("modal");

  // Build exportable items from session data
  const exportItems = useMemo<ExportItem[]>(() => {
    const items: ExportItem[] = [];

    // Add report as first item
    if (session.final_report) {
      items.push({
        id: "report",
        type: "report",
        title: `研究报告：${session.topic.slice(0, 30)}`,
      });
    }

    // Add references from aggregated results
    if (session.aggregated_results) {
      session.aggregated_results.forEach((rawResult, index) => {
        const result = rawResult as Record<string, unknown>;
        const title =
          typeof result.title === "string" && result.title.trim()
            ? result.title
            : `来源 ${index + 1}`;
        const url = typeof result.url === "string" ? result.url : undefined;
        const snippetValue = typeof result.snippet === "string" ? result.snippet : undefined;
        const snippet = snippetValue ? snippetValue.slice(0, 100) : undefined;
        const relevance =
          typeof result.relevance_score === "number" ? result.relevance_score : undefined;
        items.push({
          id: `ref-${index}`,
          type: "reference",
          title,
          url,
          snippet,
          relevance: relevance ?? 0.5,
        });
      });
    }

    return items;
  }, [session]);

  // Filter items by relevance
  const filteredItems = useMemo(() => {
    if (relevanceFilter === "all") return exportItems;
    return exportItems.filter(
      (item) => item.type === "report" || (item.relevance && item.relevance >= 0.7),
    );
  }, [exportItems, relevanceFilter]);

  // Group items by type
  const reportItems = filteredItems.filter((i) => i.type === "report");
  const referenceItems = filteredItems.filter((i) => i.type === "reference");

  const toggleItem = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedItems(new Set(filteredItems.map((i) => i.id)));
  }, [filteredItems]);

  const selectNone = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const handleExport = useCallback(async () => {
    if (selectedItems.size === 0) {
      toast.error("请选择要导出的内容");
      return;
    }

    setIsExporting(true);
    try {
      // Check if report is selected
      const includeReport = selectedItems.has("report");

      // Get selected reference URLs
      const selectedRefs = referenceItems
        .filter((item) => selectedItems.has(item.id))
        .map((item) => item.url)
        .filter((url): url is string => typeof url === "string" && url.length > 0);

      const data = await unwrapData(
        exportResearch<true>({
          path: { notebook_id: session.notebook_id, research_id: session.id },
          body: {
            export_type: exportTarget,
            include_report: includeReport,
            include_results: selectedRefs.length > 0,
          },
        }),
      );

      if (data?.success) {
        toast.success(data.message);
        onExportComplete?.();
        onClose();
      } else {
        toast.error(data?.message || "导出失败");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "导出失败";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  }, [selectedItems, exportTarget, session, referenceItems, onExportComplete, onClose]);

  return (
    <div
      className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      style={modalStyle}
    >
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-2xl animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <DownloadIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">导出研究成果</h2>
              <p className="text-sm text-gray-500">选择要导出的内容和目标位置</p>
            </div>
          </div>
          <IconButton variant="text" size="sm" onClick={onClose}>
            <CloseIcon className="w-5 h-5" />
          </IconButton>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {/* Export Target Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">导出目标</h3>
            <div className="flex gap-3">
              <label
                className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  exportTarget === "source"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="export-target"
                  checked={exportTarget === "source"}
                  onChange={() => setExportTarget("source")}
                  className="h-4 w-4 text-blue-600"
                />
                <SourceIcon
                  className={`w-5 h-5 ${exportTarget === "source" ? "text-blue-600" : "text-gray-400"}`}
                />
                <div>
                  <p className="font-medium text-gray-900">来源</p>
                  <p className="text-xs text-gray-500">作为可搜索的知识来源</p>
                </div>
              </label>
              <label
                className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  exportTarget === "note"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="export-target"
                  checked={exportTarget === "note"}
                  onChange={() => setExportTarget("note")}
                  className="h-4 w-4 text-blue-600"
                />
                <NoteIcon
                  className={`w-5 h-5 ${exportTarget === "note" ? "text-blue-600" : "text-gray-400"}`}
                />
                <div>
                  <p className="font-medium text-gray-900">笔记</p>
                  <p className="text-xs text-gray-500">作为 Studio 中的笔记</p>
                </div>
              </label>
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">选择内容</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRelevanceFilter(relevanceFilter === "all" ? "high" : "all")}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                  relevanceFilter === "high"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <FilterIcon className="w-3 h-3" />
                {relevanceFilter === "high" ? "仅高相关" : "全部"}
              </button>
              <button
                onClick={selectAll}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
              >
                <SelectAllIcon className="w-3 h-3" />
                全选
              </button>
              <button
                onClick={selectNone}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
              >
                清空
              </button>
            </div>
          </div>

          {/* Report Section */}
          {reportItems.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <DescriptionIcon className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-gray-500 uppercase">研究报告</span>
              </div>
              {reportItems.map((item) => (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedItems.has(item.id)
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="w-4 h-4 accent-green-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500">
                      {session.final_report ? `${session.final_report.length} 字` : ""}
                    </p>
                  </div>
                  <Chip size="sm" value="推荐" className="bg-green-100 text-green-700" />
                </label>
              ))}
            </div>
          )}

          {/* References Section */}
          {referenceItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-gray-500 uppercase">
                  参考来源 ({referenceItems.length})
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {referenceItems.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedItems.has(item.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="w-4 h-4 mt-0.5 accent-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.title}</p>
                      {item.snippet && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{item.snippet}</p>
                      )}
                      {item.url && (
                        <p className="text-xs text-blue-500 truncate mt-0.5">{item.url}</p>
                      )}
                    </div>
                    {item.relevance && item.relevance >= 0.7 && (
                      <Chip
                        size="sm"
                        value="高相关"
                        className="bg-purple-100 text-purple-700 flex-shrink-0"
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>没有可导出的内容</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <p className="text-sm text-gray-500">
            已选择 <span className="font-medium text-gray-900">{selectedItems.size}</span> 项
          </p>
          <div className="flex gap-2">
            <Button variant="outlined" color="gray" onClick={onClose} disabled={isExporting}>
              取消
            </Button>
            <Button
              color="blue"
              onClick={handleExport}
              disabled={isExporting || selectedItems.size === 0}
              className="flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <Spinner className="h-4 w-4" />
                  导出中...
                </>
              ) : (
                <>
                  <DownloadIcon className="w-4 h-4" />
                  导出到{exportTarget === "source" ? "来源" : "笔记"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ResearchExportDialog);
