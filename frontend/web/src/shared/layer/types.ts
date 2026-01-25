import { LAYER_LEVELS } from './constants';

/**
 * 层级名称类型
 */
export type LayerName = keyof typeof LAYER_LEVELS;

/**
 * Layer 上下文值类型
 */
export interface LayerContextValue {
  /**
   * 获取指定层级的 z-index 值
   * @param layerName 层级名称
   * @param slot 可选的 slot 索引，用于同一层级内多个元素的堆叠
   * @returns z-index 数值
   */
  getZIndex: (layerName: LayerName, slot?: number) => number;
}

/**
 * useLayer hook 返回值类型
 */
export interface UseLayerResult {
  /**
   * 计算后的 z-index 值
   */
  zIndex: number;
  /**
   * 可直接应用于元素的 style 对象
   */
  style: { zIndex: number };
  /**
   * 可用于 Tailwind 的 z-index 类名
   * 注意：由于使用动态值，需要配合 style 属性使用
   */
  className: string;
}
