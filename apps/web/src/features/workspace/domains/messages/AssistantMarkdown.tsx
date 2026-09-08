import { code } from '@streamdown/code';
import { memo } from 'react';
import { defaultTranslations, Streamdown } from 'streamdown';

/** streamdown 内建控件文案中文化（未列出的沿用 defaultTranslations） */
const zhTranslations = {
  ...defaultTranslations,
  copyCode: '复制代码',
  copied: '已复制',
  copyTable: '复制表格',
  copyLink: '复制链接',
  viewFullscreen: '全屏查看',
  exitFullscreen: '退出全屏',
  zoomIn: '放大',
  zoomOut: '缩小',
  resetView: '重置视图',
  close: '关闭',
};

interface AssistantMarkdownProps {
  content: string;
  /** 流式进行中：启用未闭合语法补全与内建打字光标 */
  streaming?: boolean;
}

/**
 * assistant 消息的流式安全 markdown 渲染（streamdown）。
 * user 消息不走这里——保持纯文本 `whitespace-pre-wrap` 渲染。
 *
 * - 高亮：`@streamdown/code` 插件（shiki 运行时不在 streamdown 核心包内）
 * - 复制按钮：streamdown 内建 controls；下载/全屏类入口关闭，保持气泡轻量
 * - 主题：依赖 tailwind.css 的 `--sd-*` token（light=gray / dark=slate）
 */
const AssistantMarkdown = memo(function AssistantMarkdown({
  content,
  streaming = false,
}: AssistantMarkdownProps) {
  return (
    <Streamdown
      mode={streaming ? 'streaming' : 'static'}
      parseIncompleteMarkdown={streaming}
      caret="block"
      plugins={{ code }}
      translations={zhTranslations}
      controls={{
        code: { copy: true, download: false },
        table: { copy: true, download: false, fullscreen: false },
        mermaid: { download: false, copy: false, fullscreen: false },
        image: { download: false },
      }}
      lineNumbers={false}
    >
      {content}
    </Streamdown>
  );
});

export default AssistantMarkdown;
