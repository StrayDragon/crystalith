interface WorkspaceHeaderProps {
  title: string;
}

export default function WorkspaceHeader({ title }: WorkspaceHeaderProps) {
  return (
    <header className="WorkspaceTopBar">
      <div className="WorkspaceTopBar__left">
        <span className="WorkspaceLogo" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M6 12a6 6 0 0 1 10.8-3.6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M8.5 12a3.5 3.5 0 0 1 6.2-2.1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="12" cy="14.5" r="1.4" fill="currentColor" />
          </svg>
        </span>
        <h1 className="WorkspaceTopBar__title" title={title}>
          {title}
        </h1>
      </div>

      <div className="WorkspaceTopBar__right">
        <button type="button" className="WorkspacePrimaryAction">
          <span className="WorkspacePrimaryAction__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          创建笔记本
        </button>
        <div className="WorkspaceTopBar__icons">
          <button type="button" className="WorkspaceIconButton" aria-label="分享">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M15 8l4 4-4 4M5 12h13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button type="button" className="WorkspaceIconButton" aria-label="设置">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.2 3.5-.8-.6.4-1.5-1.7-1-1.2.8a6.7 6.7 0 0 0-1.3-.7l-.3-1.4h-2l-.3 1.4c-.5.2-.9.4-1.3.7l-1.2-.8-1.7 1 .4 1.5-.8.6.8.6-.4 1.5 1.7 1 1.2-.8c.4.3.8.5 1.3.7l.3 1.4h2l.3-1.4c.5-.2.9-.4 1.3-.7l1.2.8 1.7-1-.4-1.5.8-.6Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button type="button" className="WorkspaceIconButton" aria-label="应用">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M6 6h4v4H6V6Zm8 0h4v4h-4V6ZM6 14h4v4H6v-4Zm8 0h4v4h-4v-4Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <button type="button" className="WorkspaceAvatar" aria-label="个人账户">
          <span className="WorkspaceAvatar__ring" aria-hidden="true" />
          <span className="WorkspaceAvatar__inner" aria-hidden="true">
            CL
          </span>
        </button>
      </div>
    </header>
  );
}
