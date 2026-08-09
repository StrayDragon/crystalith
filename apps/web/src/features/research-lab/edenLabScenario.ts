import type { LabScenario } from './model/types';

/**
 * Neutral placeholder for Eden Lab UI fields that still read `lab.scenario.*`
 * (topic fallback / constraintsNote). MUST NOT bind xlsx-lib fixture copy (c103).
 */
export const EDEN_LAB_SCENARIO: LabScenario = {
  id: 'eden',
  label: 'Eden ResearchRun',
  shortLabel: 'Eden',
  topic: '',
  constraintsNote: '',
  nodes: [],
  edges: [],
  citations: {},
  reportMarkdown: '',
  phaseSnapshots: {},
};

export const EDEN_LAB_SCENARIOS: LabScenario[] = [EDEN_LAB_SCENARIO];
