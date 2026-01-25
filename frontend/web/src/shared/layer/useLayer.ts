import { useMemo } from 'react';
import { useLayerContext } from './LayerProvider';
import type { LayerName, UseLayerResult } from './types';

/**
 * 获取指定层级的 z-index 值和相关样式
 *
 * @param layerName 层级名称：'base' | 'dropdown' | 'popover' | 'modal' | 'toast' | 'tooltip'
 * @param slot 可选的 slot 索引，用于同一层级内多个元素的堆叠（如多个 Toast）
 * @returns 包含 zIndex、style 和 className 的对象
 *
 * @example
 * ```tsx
 * // 基本用法
 * const { zIndex, style } = useLayer('modal');
 * return <div style={style}>Modal Content</div>;
 *
 * // 使用 slot 区分同层级多个元素
 * const { style } = useLayer('toast', toastIndex);
 * return <div style={style}>Toast {toastIndex}</div>;
 *
 * // 与 Tailwind 类名结合使用
 * const { style, className } = useLayer('tooltip');
 * return <div className={`${className} other-classes`} style={style}>Tooltip</div>;
 * ```
 */
export function useLayer(layerName: LayerName, slot: number = 0): UseLayerResult {
  const { getZIndex } = useLayerContext();

  return useMemo(() => {
    const zIndex = getZIndex(layerName, slot);
    return {
      zIndex,
      style: { zIndex },
      className: `z-[${zIndex}]`,
    };
  }, [getZIndex, layerName, slot]);
}

/**
 * 直接获取层级 z-index 值的工具函数
 * 用于不在 React 组件内部的场景（如 CSS-in-JS 或配置）
 *
 * @param layerName 层级名称
 * @param slot 可选的 slot 索引
 * @returns z-index 数值
 */
export function getLayerZIndex(layerName: LayerName, slot: number = 0): number {
  const { LAYER_LEVELS, MAX_SLOTS_PER_LAYER } = require('./constants');
  const baseZIndex = LAYER_LEVELS[layerName];
  const safeSlot = Math.max(0, Math.min(slot, MAX_SLOTS_PER_LAYER - 1));
  return baseZIndex + safeSlot;
}
