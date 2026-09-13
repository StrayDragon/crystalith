import type { Chunk as ChunkRead } from '@crystalith/shared';
import {
  DataObject as DataObjectIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useState } from 'react';

import { Typography } from '../../../../shared/ui';

function ChunkItem({ chunk }: { chunk: ChunkRead }) {
  const [expanded, setExpanded] = useState(false);
  const charCount = chunk.text.length;
  const previewLength = 150;
  const needsTruncate = chunk.text.length > previewLength;

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 hover:border-gray-300 dark:border-slate-600 transition-colors">
      <button
        type="button"
        className="w-full p-3 text-left"
        onClick={() => {
          setExpanded(!expanded);
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs font-medium">
              #{chunk.chunkIndex + 1}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <Typography
              variant="small"
              className="text-xs text-gray-700 dark:text-slate-200 leading-relaxed"
            >
              {expanded || !needsTruncate ? chunk.text : `${chunk.text.slice(0, previewLength)}...`}
            </Typography>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {needsTruncate &&
              (expanded ? (
                <ExpandLessIcon className="h-4 w-4 text-gray-400 dark:text-slate-500" />
              ) : (
                <ExpandMoreIcon className="h-4 w-4 text-gray-400 dark:text-slate-500" />
              ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 dark:text-slate-500">
          <span>{charCount} 字符</span>
          {chunk.startOffset !== null && chunk.endOffset !== null && (
            <span>
              位置: {chunk.startOffset}-{chunk.endOffset}
            </span>
          )}
          {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
            <span className="text-blue-400">有元数据</span>
          )}
        </div>
      </button>
      {expanded && chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
        <div className="px-3 pb-3 pt-0">
          <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded text-[10px] font-mono text-gray-500 dark:text-slate-400 overflow-x-auto">
            {JSON.stringify(chunk.metadata, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}

interface SourceDetailChunksPanelProps {
  chunks: ChunkRead[];
  isChunksLoading: boolean;
  chunksError: string;
}

export function SourceDetailChunksPanel({
  chunks,
  isChunksLoading,
  chunksError,
}: SourceDetailChunksPanelProps) {
  return (
    <div className="p-4">
      {isChunksLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 animate-pulse"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : chunksError ? (
        <div className="text-center py-8">
          <Typography variant="small" color="red" className="text-xs">
            {chunksError}
          </Typography>
        </div>
      ) : chunks.length === 0 ? (
        <div className="text-center py-8">
          <DataObjectIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
          <Typography variant="small" className="text-gray-500 dark:text-slate-400 text-xs">
            暂无原始数据
          </Typography>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <Typography
              variant="small"
              className="text-xs text-gray-500 dark:text-slate-400 font-medium"
            >
              共 {chunks.length} 个片段
            </Typography>
          </div>
          {chunks.map((chunk) => (
            <ChunkItem key={chunk.id} chunk={chunk} />
          ))}
        </div>
      )}
    </div>
  );
}
