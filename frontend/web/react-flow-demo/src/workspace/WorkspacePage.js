import { useMemo, useState } from 'react';

import './workspace.css';

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildRefineOutput(text) {
  const normalized = text.trim();
  if (!normalized) return { paragraph: '', bullets: [], json: {} };

  const bullets = normalized
    .split(/[\n。；;]+/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    paragraph: `已生成提炼结果（演示）：${normalized}`,
    bullets: bullets.length > 0 ? bullets : [normalized],
    json: {
      主题: normalized.slice(0, 48),
      要点: bullets.length > 0 ? bullets : [normalized],
      置信度: '演示数据',
    },
  };
}

function WorkspaceHeader({ notebooks, activeNotebookId, onNotebookChange }) {
  const activeNotebook = notebooks.find((n) => n.id === activeNotebookId) ?? null;

  return (
    <header className="WorkspaceHeader">
      <div className="WorkspaceHeader__left">
        <div className="WorkspaceBrand">研究工作台</div>
        <div className="WorkspaceMeta">三栏：来源 / 聊天 / 提炼</div>
      </div>

      <div className="WorkspaceHeader__center">
        <label className="WorkspaceLabel" htmlFor="notebookSelect">
          当前笔记本
        </label>
        <select
          id="notebookSelect"
          className="WorkspaceSelect"
          value={activeNotebookId}
          onChange={(e) => onNotebookChange(e.target.value)}
        >
          {notebooks.map((notebook) => (
            <option key={notebook.id} value={notebook.id}>
              {notebook.title}
            </option>
          ))}
        </select>
      </div>

      <div className="WorkspaceHeader__right">
        <div className="WorkspacePill" title="当前为前端演示数据，尚未接入后端 API">
          演示模式
        </div>
        {activeNotebook ? (
          <div className="WorkspaceTiny">{activeNotebook.updatedAt}</div>
        ) : null}
      </div>
    </header>
  );
}

function WorkspaceTabs({ activePanel, onChange }) {
  return (
    <nav className="WorkspaceTabs" aria-label="工作区面板切换">
      {[
        { id: 'sources', label: '来源/引用' },
        { id: 'chat', label: '聊天' },
        { id: 'refine', label: '提炼' },
      ].map((item) => (
        <button
          key={item.id}
          type="button"
          className={`WorkspaceTab ${activePanel === item.id ? 'isActive' : ''}`}
          aria-current={activePanel === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function SourcesPanel({ sources, citations }) {
  return (
    <div className="WorkspacePanelBody">
      <section className="WorkspaceSection">
        <h3 className="WorkspaceSectionTitle">来源</h3>
        <ul className="WorkspaceList">
          {sources.map((source) => (
            <li key={source.id} className="WorkspaceListItem">
              <div className="WorkspaceListItem__main">
                <div className="WorkspaceListItem__title">{source.title}</div>
                <div className="WorkspaceListItem__sub">
                  {source.type} · {source.status}
                </div>
              </div>
              <div className="WorkspaceBadge">{source.chunks} 段</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="WorkspaceSection">
        <h3 className="WorkspaceSectionTitle">引用</h3>
        {citations.length === 0 ? (
          <div className="WorkspaceEmpty">暂无引用。发送一次消息后这里会展示引用片段。</div>
        ) : (
          <ul className="WorkspaceList">
            {citations.map((c) => (
              <li key={c.id} className="WorkspaceListItem WorkspaceListItem--compact">
                <div className="WorkspaceListItem__main">
                  <div className="WorkspaceListItem__title">{c.sourceTitle}</div>
                  <div className="WorkspaceListItem__sub">{c.snippet}</div>
                </div>
                <div className="WorkspaceBadge"># {c.chunkIndex}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ChatPanel({ messages, draft, onDraftChange, onSend }) {
  return (
    <div className="WorkspacePanelBody WorkspacePanelBody--chat">
      <div className="ChatMessages" role="log" aria-label="聊天记录">
        {messages.length === 0 ? (
          <div className="WorkspaceEmpty">开始对话吧：输入问题或指令，中间显示聊天，右侧显示提炼。</div>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`ChatMessage ${message.role === 'user' ? 'isUser' : 'isAssistant'}`}
          >
            <div className="ChatMessage__meta">{message.role === 'user' ? '你' : '助手'}</div>
            <div className="ChatMessage__bubble">{message.content}</div>
          </div>
        ))}
      </div>

      <form
        className="ChatComposer"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <textarea
          className="ChatInput"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (e.shiftKey) return;
            if (e.isComposing) return;
            e.preventDefault();
            onSend();
          }}
          placeholder="在这里输入问题或指令…"
          rows={2}
        />
        <div className="ChatActions">
          <div className="WorkspaceTiny">Enter 发送 · Shift+Enter 换行</div>
          <button type="submit" className="PrimaryButton" disabled={draft.trim().length === 0}>
            发送
          </button>
        </div>
      </form>
    </div>
  );
}

function RefinePanel({ mode, onModeChange, output }) {
  return (
    <div className="WorkspacePanelBody">
      <div className="RefineModes" role="tablist" aria-label="提炼格式">
        {[
          { id: 'paragraph', label: '段落' },
          { id: 'bullets', label: '要点' },
          { id: 'json', label: '结构化' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            className={`RefineMode ${mode === item.id ? 'isActive' : ''}`}
            onClick={() => onModeChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {output.paragraph === '' ? (
        <div className="WorkspaceEmpty">暂无提炼结果。发送一次消息后这里会展示提炼内容。</div>
      ) : (
        <div className="RefineOutput" aria-label="提炼结果">
          {mode === 'paragraph' ? <p className="RefineParagraph">{output.paragraph}</p> : null}
          {mode === 'bullets' ? (
            <ul className="RefineBullets">
              {output.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {mode === 'json' ? (
            <pre className="RefineJson">{JSON.stringify(output.json, null, 2)}</pre>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  const notebooks = useMemo(
    () => [
      { id: 'nb-001', title: '示例：产品调研', updatedAt: '更新于：刚刚' },
      { id: 'nb-002', title: '示例：技术笔记', updatedAt: '更新于：昨天' },
    ],
    [],
  );

  const sources = useMemo(
    () => [
      { id: 'src-001', title: '需求说明.md', type: 'Markdown', status: '已索引', chunks: 12 },
      { id: 'src-002', title: '竞品对比.txt', type: 'TXT', status: '已索引', chunks: 8 },
      { id: 'src-003', title: '访谈纪要.md', type: 'Markdown', status: '处理中', chunks: 0 },
    ],
    [],
  );

  const [activeNotebookId, setActiveNotebookId] = useState(notebooks[0]?.id ?? '');
  const [activePanel, setActivePanel] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [citations, setCitations] = useState([]);
  const [refineMode, setRefineMode] = useState('paragraph');
  const [refineOutput, setRefineOutput] = useState({ paragraph: '', bullets: [], json: {} });
  const activeNotebook = notebooks.find((n) => n.id === activeNotebookId) ?? null;

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;

    const userMessage = { id: createId(), role: 'user', content: text };
    const assistantMessage = {
      id: createId(),
      role: 'assistant',
      content: `（演示）已收到：${text}`,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setDraft('');

    setCitations([
      {
        id: createId(),
        sourceTitle: '需求说明.md',
        snippet: '...与三栏工作区一致：左来源/引用，中聊天，右提炼输出。',
        chunkIndex: 3,
      },
      {
        id: createId(),
        sourceTitle: '竞品对比.txt',
        snippet: '...对话区域需要始终可用，提炼区域用于结构化输出。',
        chunkIndex: 1,
      },
    ]);

    setRefineOutput(buildRefineOutput(text));
    setActivePanel('chat');
  }

  return (
    <div className="WorkspaceApp">
      <WorkspaceHeader
        notebooks={notebooks}
        activeNotebookId={activeNotebookId}
        onNotebookChange={setActiveNotebookId}
      />

      <WorkspaceTabs activePanel={activePanel} onChange={setActivePanel} />

      <main className="WorkspaceMain" aria-label="三栏工作区">
        <section
          className={`WorkspacePanel WorkspacePanel--sources ${
            activePanel === 'sources' ? 'isActive' : ''
          }`}
          aria-label="来源与引用"
        >
          <div className="WorkspacePanelHeader">
            <h2 className="WorkspacePanelTitle">来源/引用</h2>
            <div className="WorkspaceTiny">笔记本：{activeNotebook?.title ?? '-'}</div>
          </div>
          <SourcesPanel sources={sources} citations={citations} />
        </section>

        <section
          className={`WorkspacePanel WorkspacePanel--chat ${
            activePanel === 'chat' ? 'isActive' : ''
          }`}
          aria-label="聊天"
        >
          <div className="WorkspacePanelHeader">
            <h2 className="WorkspacePanelTitle">聊天</h2>
            <div className="WorkspaceTiny">输入 → 对话 → 提炼</div>
          </div>
          <ChatPanel
            messages={messages}
            draft={draft}
            onDraftChange={setDraft}
            onSend={sendMessage}
          />
        </section>

        <section
          className={`WorkspacePanel WorkspacePanel--refine ${
            activePanel === 'refine' ? 'isActive' : ''
          }`}
          aria-label="提炼"
        >
          <div className="WorkspacePanelHeader">
            <h2 className="WorkspacePanelTitle">提炼</h2>
            <div className="WorkspaceTiny">输出面板</div>
          </div>
          <RefinePanel mode={refineMode} onModeChange={setRefineMode} output={refineOutput} />
        </section>
      </main>
    </div>
  );
}
