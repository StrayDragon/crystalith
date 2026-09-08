import { memo } from 'react';
import { Streamdown } from 'streamdown';

interface AssistantMarkdownProps {
  content: string;
  /** 流式进行中：启用未闭合语法补全与内建打字光标 */
  streaming?: boolean;
}

/**
 * assistant 消息的流式安全 markdown 渲染（streamdown）。
 * user 消息不走这里——保持纯文本 `whitespace-pre-wrap` 渲染。
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
      // 消息级复制/保存按钮已存在于气泡工具条，避免块级按钮重复
      controls={false}
      lineNumbers={false}
    >
      {content}
    </Streamdown>
  );
});

export default AssistantMarkdown;
