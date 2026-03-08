import { createContext, useContext, useMemo, type ReactNode } from "react";
import { LAYER_LEVELS, MAX_SLOTS_PER_LAYER } from "./constants";
import type { LayerContextValue, LayerName } from "./types";

/**
 * Layer 上下文
 */
const LayerContext = createContext<LayerContextValue | null>(null);

/**
 * 获取 Layer 上下文的 hook
 * @throws 如果在 LayerProvider 外部使用则抛出错误
 */
export function useLayerContext(): LayerContextValue {
  const context = useContext(LayerContext);
  if (!context) {
    throw new Error("useLayerContext must be used within a LayerProvider");
  }
  return context;
}

interface LayerProviderProps {
  children: ReactNode;
}

/**
 * Layer Provider 组件
 *
 * 提供统一的层级管理上下文，应在应用根组件中使用。
 *
 * @example
 * ```tsx
 * <LayerProvider>
 *   <App />
 * </LayerProvider>
 * ```
 */
export function LayerProvider({ children }: LayerProviderProps) {
  const value = useMemo<LayerContextValue>(
    () => ({
      getZIndex: (layerName: LayerName, slot: number = 0) => {
        const baseZIndex = LAYER_LEVELS[layerName];
        // 确保 slot 在有效范围内
        const safeSlot = Math.max(0, Math.min(slot, MAX_SLOTS_PER_LAYER - 1));
        return baseZIndex + safeSlot;
      },
    }),
    [],
  );

  return <LayerContext.Provider value={value}>{children}</LayerContext.Provider>;
}
