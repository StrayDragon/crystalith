import WorkspacePage from '../features/workspace/WorkspacePage';
import { ToastContainer } from '../shared/toast';
import { LayerProvider } from '../shared/layer';

function App() {
  return (
    <LayerProvider>
      <WorkspacePage />
      <ToastContainer />
    </LayerProvider>
  );
}

export default App;
