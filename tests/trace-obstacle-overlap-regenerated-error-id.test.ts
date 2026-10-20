import { expect, test } from "bun:test"
import { hasNewTraceObstacleOverlaps } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { padError, snapshot } from "./fixtures/traceObstacleOverlapFixtures"

test("overlap identity ignores regenerated error IDs and detects reused IDs for different pairs", () => {
  const before = snapshot([
    padError("pad_a", -0.04, { pcb_trace_error_id: "opaque_error_1" }),
  ])
  const regenerated = snapshot([
    padError("pad_a", -0.03, { pcb_trace_error_id: "opaque_error_2" }),
  ])
  const otherPad = snapshot([
    padError("pad_b", -0.03, { pcb_trace_error_id: "opaque_error_1" }),
  ])
  const otherTrace = snapshot([
    padError("pad_a", -0.03, {
      pcb_trace_error_id: "opaque_error_1",
      pcb_trace_id: "trace_1",
    }),
  ])
  expect(hasNewTraceObstacleOverlaps(regenerated, before)).toBe(false)
  expect(hasNewTraceObstacleOverlaps(otherPad, before)).toBe(true)
  expect(hasNewTraceObstacleOverlaps(otherTrace, before)).toBe(true)
})
