import { Typography } from '@material-tailwind/react';

import { TestIds, tid } from '../../../../../shared/testids';

export default function SourcesPanelEmptyState() {
  return (
    <div
      className="p-3 text-center border border-dashed border-gray-300 rounded-lg bg-gray-100 dark:bg-slate-800"
      {...tid(TestIds.sourcesEmpty)}
    >
      <Typography
        variant="small"
        className="text-gray-700 dark:text-slate-200 text-[11px] font-semibold"
      >
        添加文档开始分析
      </Typography>
      <Typography variant="small" className="text-gray-500 dark:text-slate-400 text-[10px] mt-1">
        上传文档后，可在中间面板提问并在右侧生成输出。
      </Typography>
    </div>
  );
}
