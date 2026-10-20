import { expect, test } from "bun:test"
import {
  hasNewTraceObstacleOverlaps,
  isBetterDrcSnapshot,
  isDrcSnapshotCountBetter,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import type { DrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/types"

const padError = (
  pad: string,
  clearance: number,
  extra: Record<string, unknown> = {},
) => ({
  type: "pcb_trace_error",
  pcb_trace_error_id: `overlap_trace_0_${pad}`,
  pcb_trace_id: "trace_0",
  message: `PCB trace trace_0 is too close to pcb_smtpad "${pad}"`,
  actual_clearance: clearance,
  ...extra,
})

const snapshot = (
  errors: Record<string, unknown>[],
  issueScore = errors.length,
): DrcSnapshot => ({
  errors,
  count: errors.length,
  issueScore,
  legacyIssueScore: issueScore,
  traceRouteIndexById: new Map([["trace_0", 0]]),
})

test.each([
  ["negative clearance", padError("pad_a", -0.04)],
  [
    "overlap hidden behind a positive first contact",
    padError("pad_a", 0.07, { worst_actual_clearance: -0.04 }),
  ],
  [
    "external evaluator without numeric clearance",
    padError("pad_a", 0, {
      actual_clearance: undefined,
      message:
        'PCB trace trace_0 overlaps with pcb_smtpad "pad_a" (accidental contact)',
    }),
  ],
])("detects a new obstacle overlap from %s", (_, overlap) => {
  const before = snapshot([padError("pad_a", 0.07), padError("pad_b", 0.04)])
  const after = snapshot([overlap], 0.01)

  expect(hasNewTraceObstacleOverlaps(after, before)).toBe(true)
})

test("detects trading an existing overlap for an overlap on another pad", () => {
  const before = snapshot([padError("pad_a", -0.04), padError("pad_b", 0.07)])
  const after = snapshot([padError("pad_b", -0.01)], 0.01)

  expect(hasNewTraceObstacleOverlaps(after, before)).toBe(true)
})

test("still accepts progress on pre-existing overlaps and positive clearances", () => {
  for (const clearance of [-0.04, 0.04]) {
    const before = snapshot([
      padError("pad_a", clearance),
      padError("pad_b", 0.07),
    ])
    const after = snapshot([padError("pad_a", clearance + 0.01)], 0.01)

    expect(hasNewTraceObstacleOverlaps(after, before)).toBe(false)
    expect(isDrcSnapshotCountBetter(after, before)).toBe(true)
    expect(
      isBetterDrcSnapshot(after, 0, before.count, before.issueScore, 0, before),
    ).toBe(true)
    expect(isDrcSnapshotCountBetter(snapshot([]), before)).toBe(true)
  }
})

test("keeps an existing pad overlap eligible for same-count clearance improvement", () => {
  const before = snapshot([padError("pad_a", -0.04)], 0.14)
  const after = snapshot([padError("pad_a", -0.01)], 0.11)

  expect(hasNewTraceObstacleOverlaps(after, before)).toBe(false)
  expect(
    isBetterDrcSnapshot(after, 0, before.count, before.issueScore, 0, before),
  ).toBe(true)
})

test("inspects both complete evaluator errors and enriched force-targeting metadata", () => {
  const before = snapshot([])
  const rawOnly = {
    ...snapshot([]),
    count: 1,
    rawErrors: [padError("pad_a", -0.04)],
  }
  const enrichedOnly = {
    ...snapshot([padError("pad_a", 0.07, { worst_actual_clearance: -0.04 })]),
    rawErrors: [padError("pad_a", 0.07)],
  }

  expect(hasNewTraceObstacleOverlaps(rawOnly, before)).toBe(true)
  expect(hasNewTraceObstacleOverlaps(enrichedOnly, before)).toBe(true)
  expect(hasNewTraceObstacleOverlaps(enrichedOnly, rawOnly)).toBe(false)
})
