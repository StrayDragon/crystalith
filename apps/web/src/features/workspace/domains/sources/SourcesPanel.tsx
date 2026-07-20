import SourcesPanelView, { type SourcesPanelProps } from './components/SourcesPanelView';

/** Sources panel — library management only (web search moved to top bar, c75). */
export default function SourcesPanel(props: SourcesPanelProps) {
  return <SourcesPanelView {...props} />;
}
