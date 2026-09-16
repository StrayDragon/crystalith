/**
 * Transport-level error → user-facing Chinese copy. Shared so every surface
 * (chat, Lab, sources) reports failures with the same honest, actionable
 * wording instead of leaking raw `Error.message` / `[object Object]` (W5).
 */
export function mapTransportError(error: unknown, status?: number): string {
  if (status === 503) {
    return '可选 AI 服务暂时不可用（核心功能仍可用），请检查模型配置或稍后重试。';
  }
  if (status === 404) {
    return '会话或笔记本不存在。';
  }
  if (status === 500) {
    return '服务器内部错误，请检查模型/Embedding 配置或稍后重试。';
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.length > 0 && message.length < 120) {
    return message;
  }
  return '请求失败，请检查后端服务或稍后重试。';
}
