// Layer 层级管理系统
// 提供统一的 z-index 层级管理，避免硬编码值导致的层级冲突

export { LayerProvider } from './LayerProvider';
export { useLayer } from './useLayer';
export { LAYER_LEVELS } from './constants';
export type { LayerName, LayerContextValue, UseLayerResult } from './types';
