# Design: refactor-citation-ui

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                    Citation Display System                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │  CitationMark   │    │ CitationPopover │  ← NEW          │
│  │  (inline badge) │    │ (floating list) │                 │
│  └────────┬────────┘    └────────┬────────┘                 │
│           │                      │                           │
│           │  hover tooltip       │  click to open            │
│           ▼                      ▼                           │
│  ┌─────────────────────────────────────────┐                │
│  │              ChatPanel                   │                │
│  │  "回答内容... [1][2][3] [查看引用]"      │                │
│  └─────────────────────────────────────────┘                │
│                                                              │
│  ┌─────────────────────────────────────────┐                │
│  │          StudioOutputViewer              │                │
│  │  引用 5条  [1][2][3][4][5] [查看全部]   │                │
│  └─────────────────────────────────────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 组件设计

### CitationPopover 组件

```typescript
interface CitationPopoverProps {
  /** 引用列表 */
  citations: Citation[];
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 锚点元素（用于定位） */
  anchorRef: React.RefObject<HTMLElement>;
  /** 点击引用跳转回调 */
  onJumpToCitation?: (citation: Citation) => void;
  /** 悬停引用回调 */
  onCitationHover?: (chunkId: number | null) => void;
}
```

**内部结构**：

```tsx
<Portal>
  <div className="CitationPopover" style={positionStyle}>
    <header className="CitationPopoverHeader">
      <span>引用详情 ({citations.length} 条)</span>
      <button onClick={onClose}>×</button>
    </header>
    <ul className="CitationPopoverList">
      {citations.map((citation, index) => (
        <li key={citation.id} onClick={() => onJumpToCitation?.(citation)}>
          <span className="CitationIndex">[{index + 1}]</span>
          <div className="CitationContent">
            <div className="CitationSource">{citation.sourceTitle}</div>
            {citation.pageNumber && (
              <div className="CitationPage">第 {citation.pageNumber} 页</div>
            )}
            <div className="CitationSnippet">{citation.snippet}</div>
          </div>
        </li>
      ))}
    </ul>
  </div>
</Portal>
```

### 定位算法

复用 `CitationMark` 的定位逻辑，确保 Popover 不超出视口：

```typescript
function calculatePosition(anchorRect: DOMRect): { top: number; left: number } {
  const popoverWidth = 320;
  const popoverMaxHeight = 400;
  const gap = 8;

  let top = anchorRect.bottom + gap;
  let left = anchorRect.left;

  // 水平边界检查
  if (left + popoverWidth > window.innerWidth - 8) {
    left = window.innerWidth - popoverWidth - 8;
  }
  if (left < 8) left = 8;

  // 垂直边界检查：如果下方空间不足，显示在上方
  if (top + popoverMaxHeight > window.innerHeight - 8) {
    top = anchorRect.top - popoverMaxHeight - gap;
  }
  if (top < 8) top = 8;

  return { top, left };
}
```

## 交互流程

### ChatPanel 引用查看流程

```
用户看到消息 → 消息包含引用 [1][2][3] → 点击"查看引用"按钮
                                              ↓
                                    打开 CitationPopover
                                              ↓
                            查看引用列表 → 点击某个引用
                                              ↓
                                    触发 onJumpToCitation
                                              ↓
                                    跳转到来源面板对应位置
```

### 深度研究并发控制流程

```
用户输入研究主题 → 点击"开始研究"
                        ↓
              检查 research.isLoading
                        ↓
                   isLoading?
                   ↓       ↓
                  Yes      No
                   ↓       ↓
            toast.error   检查 sessions 中是否有活动研究
            ("请稍候")    (status in ['searching', 'analyzing', 'waiting_user'])
                   ↓              ↓
                 返回    ┌────────┴────────┐
                        ↓                 ↓
                   有活动研究         无活动研究
                        ↓                 ↓
                  toast.error        创建新研究会话
                  ("已有研究进行中")        ↓
                        ↓            启动研究
                      返回                ↓
                                    订阅 SSE
```

### 研究状态说明

| 状态 | 含义 | 是否阻止新建 |
|------|------|-------------|
| `planning` | 已创建但未开始 | 否（用户可能放弃） |
| `searching` | 正在搜索 | **是** |
| `analyzing` | 正在分析 | **是** |
| `waiting_user` | 等待用户确认 | **是** |
| `completed` | 已完成 | 否 |
| `cancelled` | 已取消 | 否 |

### 当前问题代码位置

```
SourcesPanel.tsx
├── Line 180: const research = useResearch(notebookId);
├── Line 321-354: handleSearch() - 缺少并发检查 ← 需要修复
└── Line 190-198: SSE 订阅 useEffect

useResearch.ts
├── Line 152-189: createSession() - 无并发检查
├── Line 213-229: startResearch() - 无并发检查
└── Line 315-472: subscribeToSSE() - 会关闭旧连接
```

## 状态管理

### ChatPanel 状态

```typescript
// 新增状态
const [citationPopoverOpen, setCitationPopoverOpen] = useState(false);
const [popoverAnchorMessage, setPopoverAnchorMessage] = useState<ChatMessage | null>(null);
const popoverAnchorRef = useRef<HTMLButtonElement>(null);

// 打开 Popover
const handleOpenCitationPopover = (message: ChatMessage, buttonRef: RefObject<HTMLButtonElement>) => {
  setPopoverAnchorMessage(message);
  popoverAnchorRef.current = buttonRef.current;
  setCitationPopoverOpen(true);
};
```

### StudioOutputViewer 状态

```typescript
// 新增状态
const [citationPopoverOpen, setCitationPopoverOpen] = useState(false);
const citationButtonRef = useRef<HTMLButtonElement>(null);
```

## 样式规范

### CitationPopover 样式

```css
.CitationPopover {
  position: fixed;
  width: 320px;
  max-width: 90vw;
  max-height: 400px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: var(--layer-popover);
}

.CitationPopoverHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.CitationPopoverList {
  max-height: 340px;
  overflow-y: auto;
  padding: 8px;
}

.CitationPopoverItem {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.CitationPopoverItem:hover {
  background: #f9fafb;
}
```

## 技术决策

### 为什么使用 Portal？

- 避免被父容器的 `overflow: hidden` 裁剪
- 确保 z-index 层级正确
- 与现有 `CitationMark` tooltip 保持一致

### 为什么保留 CitationMark？

- 提供快速预览功能（悬停 tooltip）
- 用户已习惯的交互模式
- CitationPopover 是补充而非替代

### 并发控制为什么只检查特定状态？

- `planning` 状态的研究还未真正开始，可以被新研究覆盖
- `completed` 和 `cancelled` 状态的研究已结束，不影响新建
- 只有 `searching`、`analyzing`、`waiting_user` 表示研究正在进行中

### 为什么在前端而非后端做并发控制？

1. **用户体验**：前端检查可以立即给出反馈，无需等待网络请求
2. **后端已有保护**：后端 API 可能已有并发限制，但错误信息不够友好
3. **UI 状态一致性**：前端检查确保 UI 状态与用户操作预期一致
4. **可选的后端增强**：后续可以在后端添加更严格的并发控制作为双重保护
