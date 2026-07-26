import { describe, expect, it } from 'bun:test';

import {
  e2eStubDecomposePlan,
  e2eStubNodeSummary,
  e2eStubResearchReport,
  isResearchE2eStub,
} from '../../src/features/research/e2e-stub.ts';

describe('research e2e stub (c100/c102)', () => {
  it('reads CL_RESEARCH_E2E_STUB', () => {
    const prev = process.env.CL_RESEARCH_E2E_STUB;
    process.env.CL_RESEARCH_E2E_STUB = '1';
    expect(isResearchE2eStub()).toBe(true);
    process.env.CL_RESEARCH_E2E_STUB = '0';
    expect(isResearchE2eStub()).toBe(false);
    if (prev === undefined) delete process.env.CL_RESEARCH_E2E_STUB;
    else process.env.CL_RESEARCH_E2E_STUB = prev;
  });

  it('stub plan has ≥2 decompose branches', () => {
    const plan = e2eStubDecomposePlan('xlsx');
    expect(plan.branches.length).toBeGreaterThanOrEqual(2);
    expect(plan.branches.every((b) => b.edgeKind === 'decompose')).toBe(true);
  });

  it('stub report and node summary are deterministic', () => {
    const report = e2eStubResearchReport('topic', 0);
    expect(report.title).toContain('topic');
    expect(report.citations).toEqual({});
    expect(e2eStubNodeSummary('A', 2)).toContain('2 条');
  });
});
