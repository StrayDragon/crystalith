import { WorkspaceProvider } from './WorkspaceContext';
import WorkspaceLayout from '../layout/WorkspaceLayout';

export default function WorkspacePage() {
  return (
    <WorkspaceProvider>
      <WorkspaceLayout />
    </WorkspaceProvider>
  );
}
