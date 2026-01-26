// Layer 层级管理系统
// 提供统一的 z-index 层级管理，避免硬编码值导致的层级冲突

export { LayerProvider, useLayerContext } from './LayerProvider';
export { useLayer, getLayerZIndex } from './useLayer';
export { LAYER_LEVELS, LAYER_NAMES, MAX_SLOTS_PER_LAYER } from './constants';
export type { LayerName, LayerContextValue, UseLayerResult } from './types';
