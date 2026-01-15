import './WorkspacePage.css';

import { WorkspaceProvider } from './context/WorkspaceContext';
import WorkspaceLayout from './components/WorkspaceLayout';

export default function WorkspacePage() {
  return (
    <WorkspaceProvider>
      <WorkspaceLayout />
    </WorkspaceProvider>
  );
}
