import { expect, test } from "bun:test"
import { hasNewTraceObstacleOverlaps } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import {
  identityRoute,
  identitySnapshot,
} from "./fixtures/traceObstacleIdentityFixtures"

test("logical overlap identities distinguish new pads and connections sharing a net", () => {
  const before = identitySnapshot([identityRoute()])
  for (const candidate of [
    identityRoute("net_a", 2, 4),
    identityRoute("net_b"),
  ]) {
    const after = identitySnapshot([candidate])
    expect(after.count).toBe(1)
    expect(hasNewTraceObstacleOverlaps(after, before)).toBe(true)
  }
})
