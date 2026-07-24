type MessageParams = Record<string, string | number | boolean | null | undefined>;

export const SUPPORTED_LOCALES = ['zh-CN'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh-CN';

const ZH_CN_MESSAGES = {
  'common.copy_to_clipboard': '复制到剪贴板',
  'common.close': '关闭',
  'common.copy': '复制',
  'common.copied_to_clipboard': '已复制到剪贴板',
  'common.debug_warnings': '调试警告',
  'common.loading': '加载中…',
  'common.retry': '重试',

  'workspace.error_boundary.title': '组件加载失败',
  'workspace.error_boundary.description': '请稍后重试，若问题持续请刷新页面。',

  'workspace.onboarding.connecting_title': '正在连接后端…',
  'workspace.onboarding.connecting_description':
    '首次加载可能需要几秒；若长时间无响应，请确认后端服务已启动。',
  'workspace.onboarding.connection_failed_title': '后端连接失败',
  'workspace.onboarding.connection_failed_description': '未连接到后端服务，请检查后重试。',
  'workspace.onboarding.retry_connection': '重试连接',
  'workspace.onboarding.open_diagnostics': '查看诊断',
  'workspace.onboarding.open_deployment_docs': '打开部署文档',
  'workspace.onboarding.banner_aria': 'Workspace 引导提示',
  'workspace.onboarding.dismiss_banner_aria': '关闭引导提示',

  'workspace.onboarding.no_notebook_title': '先创建一个笔记本',
  'workspace.onboarding.no_notebook_description': '笔记本用于隔离不同项目的来源、对话与输出。',
  'workspace.onboarding.create_notebook': '创建笔记本',
  'workspace.onboarding.command_palette': '命令面板（Ctrl+K）',
  'workspace.onboarding.shortcut_help': '快捷键帮助',

  'workspace.onboarding.no_sources_title': '导入一些来源',
  'workspace.onboarding.no_sources_description':
    '上传文件、从 URL 导入，或先做一次搜索，把内容放进当前笔记本。',
  'workspace.onboarding.upload_sources': '上传文件',
  'workspace.onboarding.add_source_from_url': '从 URL 导入',
  'workspace.onboarding.focus_source_search': '搜索导入',

  'workspace.onboarding.no_session_title': '开始一个会话',
  'workspace.onboarding.no_session_description':
    '有了来源后，创建会话开始提问；也可以直接打开 Studio 生成输出。',
  'workspace.onboarding.start_session': '一键开始会话',
  'workspace.onboarding.focus_chat': '去提问',
  'workspace.onboarding.open_slides_studio': '打开 Slides Studio',

  'workspace.onboarding.ready_title': '准备就绪',
  'workspace.onboarding.ready_description':
    '试试提问（对话面板），或直接生成一个输出（例如 Slides）。',
  'workspace.onboarding.ask_question': '开始提问',
  'workspace.onboarding.generate_slides': '生成 Slides',
  'workspace.onboarding.recover_slides': '查看 Slides 指引',

  'workspace.diagnostics.title': '健康 / 诊断',
  'workspace.diagnostics.description': '用于排查依赖服务状态与修复建议',
  'workspace.diagnostics.generated_at': '生成时间：{timestamp}',
  'workspace.diagnostics.refresh_aria': '刷新诊断',
  'workspace.diagnostics.failure_title': '诊断失败',
  'workspace.diagnostics.section.core': '核心服务',
  'workspace.diagnostics.section.optional': '可选服务',
  'workspace.diagnostics.section.hosts': '主机',
  'workspace.diagnostics.status.healthy': '健康',
  'workspace.diagnostics.status.unhealthy': '不健康',
  'workspace.diagnostics.status.degraded': '降级',
  'workspace.diagnostics.status.disabled': '禁用',
  'workspace.diagnostics.status.unknown': '未知',
  'workspace.diagnostics.status.na': '无',
  'workspace.diagnostics.disabled_badge': '已禁用',
  'workspace.diagnostics.label.endpoint': '地址：',
  'workspace.diagnostics.label.error_code': '错误码：',
  'workspace.diagnostics.label.recovery_hint': '恢复建议',
  'workspace.diagnostics.label.last_probe': '上次探测：{timestamp}',
  'workspace.diagnostics.label.models': '模型数={count}',
  'workspace.diagnostics.empty_optional': '未找到可选服务状态。',

  'sources.upload.tooltip': '支持 .txt / .md / .markdown / .pdf / .csv 文件，可多选与拖拽',
  'sources.upload.drag_drop': '拖放文件到此处',
  'sources.upload.uploading': '上传中…',
  'sources.upload.add_sources': '添加来源',
  'sources.upload.aria_label': '上传来源文件',
  'sources.upload.hint.default': '支持拖拽多个文件到上传按钮区域',
  'sources.upload.hint.only_supported': '仅支持 .txt / .md / .markdown / .pdf / .csv 文件',
  'sources.upload.hint.filtered_ready': '已过滤 {unsupported} 个文件，准备上传 {supported} 个文件',
  'sources.upload.toast.unsupported':
    '已忽略 {count} 个不支持的文件，仅支持 .txt/.md/.markdown/.pdf/.csv',

  'sources.search.placeholder': '在网络中搜索新来源',
  'sources.search.aria_label': '在网络中搜索新来源',
  'sources.search.action.fast': '开始搜索',
  'sources.search.searching': '搜索中…',
  'sources.search.searching_detail': '正在查询网络搜索引擎（SearXNG）…',
  'sources.search.searching_elapsed': '已等待 {seconds} 秒，通常约需 10–30 秒',
  'sources.search.engine.web': '网页',

  'sources.detail.subtitle': '来源详情 · 支持 RAG 问答',
  'sources.detail.close_aria': '关闭来源详情',
  'sources.detail.qa_export.download_markdown': '下载为 Markdown',

  'messages.convert.connection_required': '未连接到后端服务，暂不支持转换。',
  'messages.convert.to_source.success': '已转换为来源：{filename}（{chunkCount} 个分块）',
  'messages.convert.to_output.success': '已转换为笔记：{title}',
  'messages.convert.failure_default': '转换失败',
  'messages.convert.failure': '转换失败：{message}',

  'studio.slides.connection_required': '未连接到后端服务。',
  'studio.slides.require_notebook': '请先创建笔记本。',
  'studio.slides.require_sources': '请先选择来源。',
  'studio.slides.queue.added': '已加入队列',
  'studio.slides.queue.failed_default': '加入队列失败，请稍后重试。',
  'studio.slides.queue.pending': '已加入队列，等待生成...',
} as const;

export type MessageKey = keyof typeof ZH_CN_MESSAGES;

const MESSAGES_BY_LOCALE: Record<Locale, typeof ZH_CN_MESSAGES> = {
  'zh-CN': ZH_CN_MESSAGES,
};

const TEMPLATE_PARAM = /\{(\w+)\}/gu;

export function t(
  key: MessageKey,
  params?: MessageParams,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const template = MESSAGES_BY_LOCALE[locale][key];
  if (!template) {
    return key;
  }

  if (!params) {
    return template;
  }

  return template.replace(TEMPLATE_PARAM, (_, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) {
      return `{${name}}`;
    }
    return String(value);
  });
}
