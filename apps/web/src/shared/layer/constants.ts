/**
 * Layer 层级常量定义
 *
 * 层级优先级（从低到高）：
 * - base: 普通内容层
 * - dropdown: 下拉菜单层
 * - popover: 弹出框层
 * - modal: 模态对话框层
 * - toast: 通知消息层
 * - tooltip: 工具提示层（始终最高）
 *
 * 每个层级预留 100 的间隔，支持未来扩展
 */
export const LAYER_LEVELS = {
  base: 0,
  dropdown: 100,
  popover: 200,
  modal: 300,
  toast: 400,
  tooltip: 500,
} as const;

/**
 * 层级名称数组（按优先级排序）
 */
export const LAYER_NAMES = ['base', 'dropdown', 'popover', 'modal', 'toast', 'tooltip'] as const;

/**
 * 每个层级内的最大 slot 数量
 * 用于同一层级内多个元素的堆叠（如多个 Toast）
 */
export const MAX_SLOTS_PER_LAYER = 50;
