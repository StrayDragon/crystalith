import WorkspacePage from '../features/workspace/app/WorkspacePage';
import ErrorBoundary from '../features/workspace/shared/components/ErrorBoundary';
import { ToastContainer } from '../shared/toast';
import { LayerProvider } from '../shared/layer';

function App() {
  return (
    <LayerProvider>
      <ErrorBoundary
        title="应用出现异常"
        description="工作区加载失败，请重试或刷新页面。"
      >
        <WorkspacePage />
      </ErrorBoundary>
      <ToastContainer />
    </LayerProvider>
  );
}

export default App;
