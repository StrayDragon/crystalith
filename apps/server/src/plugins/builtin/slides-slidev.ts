import type { SlidesConfigSchema } from '@crystalith/shared';
// Built-in slides workflow plugin (kind: 'slides-workflow') — the official
// reference implementation backed by the Slidev integration. Id follows the
// stable naming required by slides-workflow-plugins r139.
// The config tables/resolvers in features/studio/config.ts are this plugin's
// implementation; /workspace/tools reads the config schema through the
// registry instead of importing the table module directly (r7).
import { z } from 'zod';

import { buildSlidesConfigSchema } from '../../features/studio/config.ts';
import type { CrystalithPlugin } from '../types.ts';

export interface SlidesWorkflowImpl {
  buildSlidesConfigSchema: () => SlidesConfigSchema;
}

export const SLIDES_PLUGIN_ID = 'slides-slidev';

export const slidesSlidevPlugin: CrystalithPlugin = {
  id: SLIDES_PLUGIN_ID,
  kind: 'slides-workflow',
  displayName: 'Slidev Slides',
  description: 'Slidev 幻灯片工作流（内置官方参考实现）',
  configSchema: z.object({}),
  capabilities: ['preview', 'frontend-bundle'],
  factory: async () => ({ buildSlidesConfigSchema }) satisfies SlidesWorkflowImpl,
};
