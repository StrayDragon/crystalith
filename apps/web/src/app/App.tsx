import { useEffect, useState } from 'react';

import LabReportPage from '../features/research-lab/LabReportPage';
import { parseResearchLabPath } from '../features/research-lab/labRouting';
// Deep Research UX surface: `/research-lab/:nid` (Lab). Production ResearchRun API remains server-side.
import ResearchLabPage from '../features/research-lab/ResearchLabPage';
import WorkspacePage from '../features/workspace/app/WorkspacePage';
import ErrorBoundary from '../features/workspace/shared/components/ErrorBoundary';
import { LayerProvider } from '../shared/layer';
import { ToastContainer } from '../shared/toast';

function usePathname(): string {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const sync = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  return pathname;
}

function AppRoutes() {
  const pathname = usePathname();
  const lab = parseResearchLabPath(pathname);
  if (lab?.view === 'report') {
    return (
      <ErrorBoundary title="报告页异常" description="研究报告页加载失败，请返回图谱重试。">
        <LabReportPage notebookId={lab.notebookId} />
      </ErrorBoundary>
    );
  }
  if (lab) {
    return (
      <ErrorBoundary title="试验室异常" description="深度研究试验页加载失败，请返回工作区重试。">
        <ResearchLabPage notebookId={lab.notebookId} />
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary title="应用出现异常" description="工作区加载失败，请重试或刷新页面。">
      <WorkspacePage />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <LayerProvider>
      <AppRoutes />
      <ToastContainer />
    </LayerProvider>
  );
}

export default App;
