import { expect, test } from "bun:test"
import { hasNewTraceObstacleOverlaps } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import {
  identityRoute,
  identitySnapshot,
} from "./fixtures/traceObstacleIdentityFixtures"

test("regenerated overlaps retain logical trace identity across fragment reorder, split and merge", () => {
  const original = [identityRoute(), identityRoute("net_a", -1, 1, 1.5)]
  const before = identitySnapshot(original)
  const variants = [
    [...original].reverse(),
    [identityRoute("net_a", -1, 0), identityRoute("net_a", 0, 1), original[1]!],
    [
      {
        ...original[0]!,
        route: [
          original[0]!.route[0]!,
          { x: 0, y: 0.52, z: 0 },
          original[0]!.route[1]!,
        ],
      },
      original[1]!,
    ],
  ]
  for (const routes of variants) {
    const after = identitySnapshot(structuredClone(routes))
    expect(after.count).toBeGreaterThan(0)
    expect(hasNewTraceObstacleOverlaps(after, before)).toBe(false)
    expect(hasNewTraceObstacleOverlaps(before, after)).toBe(false)
  }
})
