import { expect, test } from "bun:test"
import { hasNewTraceObstacleOverlaps } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { padError, snapshot } from "./fixtures/traceObstacleOverlapFixtures"

test("detects trading an existing overlap for an overlap on another pad", () => {
  const before = snapshot([padError("pad_a", -0.04), padError("pad_b", 0.07)])
  const after = snapshot([padError("pad_b", -0.01)], 0.01)

  expect(hasNewTraceObstacleOverlaps(after, before)).toBe(true)
})
