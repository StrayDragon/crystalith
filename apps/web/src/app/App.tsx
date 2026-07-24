import { useEffect, useState } from 'react';

import { isLabFixtureMode } from '../features/research-lab/labFixtureMode';
import LabReportPage from '../features/research-lab/LabReportPage';
import { parseResearchLabPath } from '../features/research-lab/labRouting';
// Deep Research UX surface: `/research-lab/:nid` (Lab). Production ResearchRun API remains server-side.
import ResearchLabPage from '../features/research-lab/ResearchLabPage';
import { readActiveRunIdFromUrl } from '../features/research-lab/useEdenLabController';
import WorkspacePage from '../features/workspace/app/WorkspacePage';
import ErrorBoundary from '../features/workspace/shared/components/ErrorBoundary';
import { LayerProvider } from '../shared/layer';
import { ToastContainer } from '../shared/toast';

function useLocationKey(): string {
  const [key, setKey] = useState(() => `${window.location.pathname}${window.location.search}`);
  useEffect(() => {
    const sync = () => setKey(`${window.location.pathname}${window.location.search}`);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  return key;
}

function AppRoutes() {
  const locationKey = useLocationKey();
  const pathname = locationKey.split('?')[0] ?? locationKey;
  const lab = parseResearchLabPath(pathname);
  if (lab?.view === 'report') {
    const fixture = isLabFixtureMode();
    return (
      <ErrorBoundary title="报告页异常" description="研究报告页加载失败，请返回图谱重试。">
        <LabReportPage
          notebookId={lab.notebookId}
          mode={fixture ? 'fixture' : 'eden'}
          runId={fixture ? null : readActiveRunIdFromUrl()}
        />
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
