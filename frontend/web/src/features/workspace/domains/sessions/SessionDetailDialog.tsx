import { useMemo } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogBody,
  IconButton,
  Typography,
  Spinner,
} from '@material-tailwind/react';
import {
  Close as CloseIcon,
  Chat as ChatIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';

import type { ChatMessage, SessionSummary } from '../../shared/types';

interface SessionDetailDialogProps {
  open: boolean;
  session: SessionSummary | null;
  messages: ChatMessage[];
  onClose: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isLoading?: boolean;
}

export default function SessionDetailDialog({
  open,
  session,
  messages,
  onClose,
  isFullscreen = false,
  onToggleFullscreen,
  isLoading = false,
}: SessionDetailDialogProps) {
  // Group messages into QA pairs
  const qaPairs = useMemo(() => {
    const pairs: { question: ChatMessage; answer: ChatMessage | null }[] = [];
    let currentQuestion: ChatMessage | null = null;

    for (const message of messages) {
      if (message.role === 'user') {
        // If there was a previous question without answer, add it
        if (currentQuestion) {
          pairs.push({ question: currentQuestion, answer: null });
        }
        currentQuestion = message;
      } else if (message.role === 'assistant' && currentQuestion) {
        pairs.push({ question: currentQuestion, answer: message });
        currentQuestion = null;
      }
    }
    // Add any remaining question without answer
    if (currentQuestion) {
      pairs.push({ question: currentQuestion, answer: null });
    }

    return pairs;
  }, [messages]);

  if (!session) return null;

  return (
    <Dialog
      open={open}
      handler={onClose}
      size={isFullscreen ? 'xxl' : 'lg'}
      className={`rounded-xl overflow-hidden flex flex-col ${isFullscreen ? 'h-[95vh] max-h-[95vh]' : 'h-[70vh] max-h-[70vh]'}`}
    >
      {/* Header */}
      <DialogHeader className="flex items-start justify-between gap-4 border-b border-gray-100 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-100 text-green-600 flex-shrink-0">
            <ChatIcon fontSize="small" />
          </div>
          <div className="min-w-0">
            <Typography variant="h6" className="text-[15px] font-semibold text-gray-900 truncate">
              {session.title || `对话 ${session.id}`}
            </Typography>
            <Typography variant="small" className="text-gray-500 text-xs font-medium">
              对话详情 · {qaPairs.length} 组问答
            </Typography>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onToggleFullscreen && (
            <IconButton variant="text" size="sm" onClick={onToggleFullscreen} className="rounded-full">
              {isFullscreen ? (
                <FullscreenExitIcon className="h-4 w-4" />
              ) : (
                <FullscreenIcon className="h-4 w-4" />
              )}
            </IconButton>
          )}
          <IconButton variant="text" size="sm" onClick={onClose} className="rounded-full">
            <CloseIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </DialogHeader>

      <DialogBody className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Spinner className="h-8 w-8 text-green-500 mx-auto mb-3" />
              <Typography variant="small" className="text-gray-500 text-sm">
                加载对话内容...
              </Typography>
            </div>
          </div>
        ) : qaPairs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <ChatIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <Typography variant="small" className="text-gray-500 text-sm">
                此对话暂无内容
              </Typography>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {qaPairs.map((pair, index) => (
              <div key={pair.question.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Question */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-medium flex-shrink-0 mt-0.5">
                      Q
                    </span>
                    <Typography variant="small" className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                      {pair.question.content}
                    </Typography>
                  </div>
                </div>

                {/* Answer */}
                <div className="bg-white px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-medium flex-shrink-0 mt-0.5">
                      A
                    </span>
                    {pair.answer ? (
                      <Typography variant="small" className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                        {pair.answer.content}
                      </Typography>
                    ) : (
                      <Typography variant="small" className="text-gray-400 text-sm italic">
                        等待回答...
                      </Typography>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogBody>
    </Dialog>
  );
}
