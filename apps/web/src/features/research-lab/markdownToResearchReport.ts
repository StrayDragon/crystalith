import type { ResearchReport, ResearchReportSection } from '@crystalith/shared';

/**
 * Best-effort markdown → ResearchReport for Eden CoW editing.
 * Preserves citations from `base`; maps [^N] footnote refs back to citation ids.
 */
export function markdownToResearchReport(
  markdown: string,
  base: ResearchReport | null | undefined,
): ResearchReport {
  const citeOrder: string[] = [];
  if (base) {
    for (const section of base.sections) {
      for (const block of section.blocks) {
        const ids =
          block.type === 'paragraph' ? block.citeIds : block.items.flatMap((item) => item.citeIds);
        for (const id of ids) {
          if (!citeOrder.includes(id)) citeOrder.push(id);
        }
      }
    }
    for (const id of Object.keys(base.citations)) {
      if (!citeOrder.includes(id)) citeOrder.push(id);
    }
  }
  const mapCiteIds = (text: string): { text: string; citeIds: string[] } => {
    const citeIds: string[] = [];
    const cleaned = text.replaceAll(/\[\^(\d+)\]/gu, (_m, n: string) => {
      const idx = Number(n) - 1;
      const id = citeOrder[idx];
      if (id && !citeIds.includes(id)) citeIds.push(id);
      return '';
    });
    return { text: cleaned.trim(), citeIds };
  };

  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  let title = base?.title ?? '研究报告';
  const sections: ResearchReportSection[] = [];
  let heading: string | null = null;
  let bodyLines: string[] = [];
  let secIdx = 0;
  let sawH1 = false;
  let skipRest = false;

  const flush = () => {
    if (heading === null && bodyLines.every((l) => !l.trim())) {
      bodyLines = [];
      return;
    }
    const blocks: ResearchReportSection['blocks'] = [];
    let para: string[] = [];
    const flushPara = () => {
      const raw = para.join('\n').trim();
      para = [];
      if (!raw) return;
      const mapped = mapCiteIds(raw);
      if (!mapped.text && mapped.citeIds.length === 0) return;
      blocks.push({
        type: 'paragraph',
        text: mapped.text || ' ',
        citeIds: mapped.citeIds,
      });
    };
    for (const line of bodyLines) {
      const listMatch = /^[-*]\s+(.*)$/u.exec(line);
      if (listMatch) {
        flushPara();
        const mapped = mapCiteIds(listMatch[1] ?? '');
        const last = blocks.at(-1);
        if (last?.type === 'bullets') {
          last.items.push({ text: mapped.text || ' ', citeIds: mapped.citeIds });
        } else {
          blocks.push({
            type: 'bullets',
            items: [{ text: mapped.text || ' ', citeIds: mapped.citeIds }],
          });
        }
        continue;
      }
      if (!line.trim()) {
        flushPara();
        continue;
      }
      para.push(line);
    }
    flushPara();
    sections.push({
      id: `sec-${secIdx++}`,
      heading: heading ?? '正文',
      blocks: blocks.length > 0 ? blocks : [{ type: 'paragraph', text: ' ', citeIds: [] }],
    });
    bodyLines = [];
  };

  for (const line of lines) {
    if (skipRest) continue;
    const h1 = /^#\s+(.+)$/u.exec(line);
    if (h1 && !sawH1) {
      title = h1[1].trim() || title;
      sawH1 = true;
      continue;
    }
    const h2 = /^##\s+(.+)$/u.exec(line);
    if (h2) {
      const label = h2[1].trim();
      if (label === '参考文献') {
        flush();
        skipRest = true;
        continue;
      }
      flush();
      heading = label;
      continue;
    }
    if (heading === null && /^\[\^\d+\]:/u.test(line.trim())) continue;
    if (heading === null && line.trim() === '---') continue;
    bodyLines.push(line);
  }
  flush();

  if (sections.length === 0) {
    sections.push({
      id: 'sec-0',
      heading: '正文',
      blocks: [{ type: 'paragraph', text: markdown.trim() || ' ', citeIds: [] }],
    });
  }

  return {
    title,
    sections,
    citations: base?.citations ?? {},
  };
}
