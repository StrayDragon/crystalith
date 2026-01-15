import type { Notebook, StatusLabel } from '../types';

interface WorkspaceHeaderProps {
  notebooks: Notebook[];
  activeNotebookId: number | null;
  onNotebookChange: (value: number | null) => void;
  statusLabel: StatusLabel;
}

export default function WorkspaceHeader({
  notebooks,
  activeNotebookId,
  onNotebookChange,
  statusLabel,
}: WorkspaceHeaderProps) {
  const activeNotebook = notebooks.find((notebook) => notebook.id === activeNotebookId) ?? null;

  function handleNotebookChange(value: string) {
    const parsed = Number(value);
    onNotebookChange(Number.isFinite(parsed) ? parsed : null);
  }

  return (
    <header className="WorkspaceHeader">
      <div className="WorkspaceHeader__left">
        <div className="WorkspaceBrand">研究工作台</div>
        <div className="WorkspaceMeta">三栏：来源 / 聊天 / 输出中心</div>
      </div>

      <div className="WorkspaceHeader__center">
        <label className="WorkspaceLabel" htmlFor="notebookSelect">
          当前笔记本
        </label>
        <select
          id="notebookSelect"
          className="WorkspaceSelect"
          value={activeNotebookId ?? ''}
          onChange={(event) => handleNotebookChange(event.target.value)}
        >
          {notebooks.length === 0 ? <option value="">暂无笔记本</option> : null}
          {notebooks.map((notebook) => (
            <option key={notebook.id} value={notebook.id}>
              {notebook.title}
            </option>
          ))}
        </select>
      </div>

      <div className="WorkspaceHeader__right">
        <div className={`WorkspacePill ${statusLabel.tone}`} title={statusLabel.tooltip}>
          {statusLabel.text}
        </div>
        {activeNotebook?.updatedAt ? (
          <div className="WorkspaceTiny">更新于：{activeNotebook.updatedAt}</div>
        ) : null}
      </div>
    </header>
  );
}
