import { expect, test } from "bun:test"
import { hasNewTraceObstacleOverlaps } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { padError, snapshot } from "./fixtures/traceObstacleOverlapFixtures"

test("detects a new obstacle overlap from negative clearance", () => {
  const before = snapshot([padError("pad_a", 0.07), padError("pad_b", 0.04)])
  const after = snapshot([padError("pad_a", -0.04)], 0.01)
  expect(hasNewTraceObstacleOverlaps(after, before)).toBe(true)
})
