import { useCallback, useState } from 'react';

import type { OutputItem, OutputTypeId } from '../../shared/types';
import { toast } from '../../../../shared/toast';
import {
  type ExportFormat,
  EXPORT_FORMAT_LABELS,
  buildExportFileName,
  buildJsonExport,
  buildMarkdownExport,
  buildSlidesExportItems,
  getSupportedExportFormats,
} from './exporters';

function downloadBlob(blob: Blob, fileName: string) {
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

async function exportPdf(output: OutputItem, fileName: string) {
  const markdown = buildMarkdownExport(output);
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const lines = doc.splitTextToSize(markdown, 520) as string[];
  const lineHeight = 16;
  const pageHeight = doc.internal.pageSize.height;
  let y = 40;

  for (const line of lines) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 40;
    }
    doc.text(line, 40, y);
    y += lineHeight;
  }

  const blob = doc.output('blob') as Blob;
  downloadBlob(blob, fileName);
}

async function exportPptx(output: OutputItem, fileName: string) {
  const slides = buildSlidesExportItems(output);
  const module = await import('pptxgenjs');
  const PptxGenJS = module.default;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Crystalith';
  pptx.subject = 'Exported Slides';
  pptx.title = fileName.replace(/\.pptx$/i, '');

  slides.forEach((slideData) => {
    const slide = pptx.addSlide();
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.4,
      w: 12,
      h: 0.7,
      bold: true,
      fontSize: 28,
      color: '1F2937',
    });

    const bulletLines = slideData.bullets.map((item) => `• ${item}`);
    const paragraphLines = slideData.paragraphs;
    const bodyText = [...bulletLines, ...paragraphLines].join('\n');

    slide.addText(bodyText || '（无内容）', {
      x: 0.7,
      y: 1.5,
      w: 11.8,
      h: 4.8,
      fontSize: 18,
      color: '374151',
      valign: 'top',
    });
  });

  await pptx.writeFile({ fileName });
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);

  const getSupportedFormats = useCallback((type: OutputTypeId) => {
    return getSupportedExportFormats(type);
  }, []);

  const exportOutput = useCallback(async (output: OutputItem, format: ExportFormat) => {
    const supportedFormats = getSupportedExportFormats(output.type);
    if (!supportedFormats.includes(format)) {
      toast.warning(`当前输出类型不支持导出 ${EXPORT_FORMAT_LABELS[format]}`);
      return;
    }

    setIsExporting(true);
    setActiveFormat(format);

    const formatLabel = EXPORT_FORMAT_LABELS[format];
    toast.info(`开始导出 ${formatLabel}...`, 2000);

    try {
      const fileName = buildExportFileName(output, format);

      if (format === 'markdown') {
        const markdown = buildMarkdownExport(output);
        downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), fileName);
      } else if (format === 'json') {
        const payload = buildJsonExport(output);
        const json = `${JSON.stringify(payload, null, 2)}\n`;
        downloadBlob(new Blob([json], { type: 'application/json;charset=utf-8' }), fileName);
      } else if (format === 'pdf') {
        await exportPdf(output, fileName);
      } else if (format === 'pptx') {
        await exportPptx(output, fileName);
      }

      toast.success(`导出成功：${fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      toast.error(`导出失败：${message}`);
    } finally {
      setIsExporting(false);
      setActiveFormat(null);
    }
  }, []);

  return {
    isExporting,
    activeFormat,
    getSupportedFormats,
    exportOutput,
  };
}
