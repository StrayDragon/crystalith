import { memo, useCallback, useState } from 'react';
import {
  Button,
  Typography,
  Chip,
  Spinner,
  Tooltip,
  Card,
  CardBody,
} from '@material-tailwind/react';
import {
  Refresh as RefreshIcon,
  Hub as HubIcon,
  Category as CategoryIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';

import type { AnalysisResult, Topic, Relation } from '../../../../api/generated';

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  isLoading: boolean;
  error: string;
  onRefresh: () => void;
  isConnected: boolean;
  sourceCount: number;
}

// Color palette for topics
const TOPIC_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
  { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
];

function getTopicColor(index: number) {
  return TOPIC_COLORS[index % TOPIC_COLORS.length];
}

// Topic Card Component
function TopicCard({ topic, index }: { topic: Topic; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const color = getTopicColor(index);

  return (
    <div
      className={`rounded-lg border ${color.border} ${color.bg} p-3 transition-all hover:shadow-sm`}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full ${color.dot} flex-shrink-0`} />
            <Typography variant="small" className={`font-semibold text-xs ${color.text} truncate`}>
              {topic.name}
            </Typography>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Chip
              value={`${topic.chunk_ids.length} 片段`}
              size="sm"
              className="bg-white/80 text-gray-600 text-[10px] h-5 py-0 px-1.5 font-medium"
            />
            {topic.keywords.length > 0 && (
              expanded ? (
                <ExpandLessIcon className="h-4 w-4 text-gray-400" />
              ) : (
                <ExpandMoreIcon className="h-4 w-4 text-gray-400" />
              )
            )}
          </div>
        </div>
      </button>
      {expanded && topic.keywords.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200/50">
          <div className="flex flex-wrap gap-1">
            {topic.keywords.map((keyword, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 bg-white/60 rounded text-[10px] text-gray-600 font-medium"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Relation Item Component
function RelationItem({ relation, type }: { relation: Relation; type: 'similar' | 'contradicts' }) {
  const isContradiction = type === 'contradicts';
  const scorePercent = Math.round(relation.score * 100);

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg border ${
        isContradiction
          ? 'bg-red-50/50 border-red-200'
          : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-[10px] text-gray-500 font-mono">#{relation.source_chunk_id}</span>
        <span className={`text-[10px] ${isContradiction ? 'text-red-400' : 'text-gray-400'}`}>
          {isContradiction ? '⚡' : '↔'}
        </span>
        <span className="text-[10px] text-gray-500 font-mono">#{relation.target_chunk_id}</span>
      </div>
      <Tooltip content={`相似度: ${scorePercent}%`}>
        <div className="flex items-center gap-1">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${isContradiction ? 'bg-red-400' : 'bg-blue-400'}`}
              style={{ width: `${scorePercent}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 font-medium w-8 text-right">
            {scorePercent}%
          </span>
        </div>
      </Tooltip>
    </div>
  );
}

// Section Component
function Section({
  title,
  icon,
  count,
  children,
  emptyMessage,
  color = 'gray',
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  emptyMessage: string;
  color?: 'gray' | 'blue' | 'red';
}) {
  const [collapsed, setCollapsed] = useState(false);

  const colorClasses = {
    gray: 'text-gray-600',
    blue: 'text-blue-600',
    red: 'text-red-600',
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className={colorClasses[color]}>{icon}</span>
          <Typography variant="small" className="font-semibold text-xs text-gray-800">
            {title}
          </Typography>
          <Chip
            value={count}
            size="sm"
            className={`${
              color === 'red' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'
            } text-[10px] h-5 py-0 px-1.5 font-semibold`}
          />
        </div>
        {collapsed ? (
          <ExpandMoreIcon className="h-4 w-4 text-gray-400" />
        ) : (
          <ExpandLessIcon className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {!collapsed && (
        <div className="p-3">
          {count === 0 ? (
            <Typography variant="small" className="text-gray-400 text-xs text-center py-2">
              {emptyMessage}
            </Typography>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisPanel({
  analysis,
  isLoading,
  error,
  onRefresh,
  isConnected,
  sourceCount,
}: AnalysisPanelProps) {
  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  // Empty state - no sources
  if (sourceCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <HubIcon className="h-12 w-12 text-gray-300 mb-3" />
        <Typography variant="small" className="text-gray-500 font-medium">
          添加来源后可进行跨文档分析
        </Typography>
        <Typography variant="small" className="text-gray-400 text-xs mt-1">
          系统将自动发现来源之间的关联、主题和潜在矛盾
        </Typography>
      </div>
    );
  }

  // Loading state
  if (isLoading && !analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <Spinner className="h-8 w-8 text-gray-400" />
        <Typography variant="small" className="text-gray-500 mt-3 font-medium">
          正在分析来源...
        </Typography>
      </div>
    );
  }

  // Error state
  if (error && !analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <WarningIcon className="h-10 w-10 text-red-300 mb-3" />
        <Typography variant="small" className="text-red-600 font-medium">
          {error}
        </Typography>
        <Button
          variant="text"
          size="sm"
          onClick={handleRefresh}
          className="mt-3 normal-case text-gray-600"
        >
          重试
        </Button>
      </div>
    );
  }

  // No analysis yet - prompt to analyze
  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <HubIcon className="h-12 w-12 text-gray-300 mb-3" />
        <Typography variant="small" className="text-gray-500 font-medium">
          点击下方按钮开始分析
        </Typography>
        <Typography variant="small" className="text-gray-400 text-xs mt-1 mb-4">
          分析 {sourceCount} 个来源的关联和主题
        </Typography>
        <Button
          variant="filled"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 bg-gray-900 normal-case"
        >
          {isLoading ? <Spinner className="h-4 w-4" /> : <HubIcon style={{ fontSize: 16 }} />}
          开始分析
        </Button>
      </div>
    );
  }

  // Analysis results
  const { topics, relations, contradictions } = analysis;
  const similarRelations = relations.filter((r) => r.relation_type === 'similar');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <HubIcon style={{ fontSize: 18 }} className="text-gray-500" />
          <Typography variant="small" className="font-semibold text-gray-800 text-xs">
            跨文档分析
          </Typography>
        </div>
        <Tooltip content="刷新分析">
          <Button
            variant="text"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || !isConnected}
            className="p-1.5 min-w-0 rounded-full"
          >
            <RefreshIcon
              style={{ fontSize: 16 }}
              className={`text-gray-500 ${isLoading ? 'animate-spin' : ''}`}
            />
          </Button>
        </Tooltip>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Topics Section */}
        <Section
          title="主题聚类"
          icon={<CategoryIcon style={{ fontSize: 16 }} />}
          count={topics.length}
          emptyMessage="未发现明显的主题聚类"
          color="blue"
        >
          <div className="space-y-2">
            {topics.map((topic, index) => (
              <TopicCard key={topic.id} topic={topic} index={index} />
            ))}
          </div>
        </Section>

        {/* Relations Section */}
        <Section
          title="来源关联"
          icon={<HubIcon style={{ fontSize: 16 }} />}
          count={similarRelations.length}
          emptyMessage="未发现显著的来源关联"
        >
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {similarRelations.slice(0, 20).map((relation, index) => (
              <RelationItem key={index} relation={relation} type="similar" />
            ))}
            {similarRelations.length > 20 && (
              <Typography variant="small" className="text-gray-400 text-[10px] text-center pt-1">
                还有 {similarRelations.length - 20} 个关联...
              </Typography>
            )}
          </div>
        </Section>

        {/* Contradictions Section */}
        <Section
          title="潜在矛盾"
          icon={<WarningIcon style={{ fontSize: 16 }} />}
          count={contradictions.length}
          emptyMessage="未发现潜在矛盾"
          color="red"
        >
          <div className="space-y-1.5">
            {contradictions.map((relation, index) => (
              <RelationItem key={index} relation={relation} type="contradicts" />
            ))}
          </div>
        </Section>

        {/* Summary Stats */}
        <Card className="bg-gray-50 border border-gray-200 shadow-none">
          <CardBody className="p-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <Typography variant="h6" className="text-lg font-bold text-gray-800">
                  {topics.length}
                </Typography>
                <Typography variant="small" className="text-[10px] text-gray-500 font-medium">
                  主题
                </Typography>
              </div>
              <div>
                <Typography variant="h6" className="text-lg font-bold text-gray-800">
                  {similarRelations.length}
                </Typography>
                <Typography variant="small" className="text-[10px] text-gray-500 font-medium">
                  关联
                </Typography>
              </div>
              <div>
                <Typography variant="h6" className="text-lg font-bold text-red-600">
                  {contradictions.length}
                </Typography>
                <Typography variant="small" className="text-[10px] text-gray-500 font-medium">
                  矛盾
                </Typography>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default memo(AnalysisPanel);
