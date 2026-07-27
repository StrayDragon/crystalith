/**
 * Lab report surface — Eden ResearchRun revisions / CoW / convert (c85 + c89).
 * Demo/fixture report lives at `/demo/research-lab/:nid/report`.
 */
import EdenLabReportPage from './EdenLabReportPage';

export type LabReportPageProps = {
  notebookId: number;
  runId?: number | null;
};

export default function LabReportPage({ notebookId, runId = null }: LabReportPageProps) {
  return <EdenLabReportPage notebookId={notebookId} runId={runId} />;
}
