import { expect, test } from "bun:test"
import { applyBroadRepulsionForces } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import type { SimpleRouteJson } from "../lib/types"
import type { HighDensityRoute } from "../lib/types/high-density-types"

test("point repulsion cannot detach a noncontiguous reference to an explicit via", () => {
  const route: HighDensityRoute = {
    connectionName: "via-owner", traceThickness: 0.1524, viaDiameter: 0.2032,
    route: [
      { x: -1, y: 0, z: 7 }, { x: 0, y: 0, z: 1 },
      { x: 0.1, y: 0.1, z: 1 }, { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    ], vias: [{ x: 0, y: 0 }],
  }
  const blocker: HighDensityRoute = {
    connectionName: "blocker", traceThickness: 0.1524, viaDiameter: 0.2032,
    route: [{ x: -1, y: 0.08, z: 1 }, { x: 1, y: 0.08, z: 1 }], vias: [],
  }
  const srj: SimpleRouteJson = {
    layerCount: 8, allowBlindAndBuriedVias: true, minTraceWidth: 0.1524,
    bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 }, obstacles: [], connections: [],
  }
  const [output] = applyBroadRepulsionForces(srj, [route, blocker], 1, 1, undefined, false, false)
  expect(output!.route[1]!.x).toBe(output!.route[3]!.x)
  expect(output!.route[1]!.y).toBe(output!.route[3]!.y)
  expect(output!.route[4]!.x).toBe(output!.route[3]!.x)
  expect(output!.route[4]!.y).toBe(output!.route[3]!.y)
  expect(Math.hypot(output!.route[1]!.x, output!.route[1]!.y)).toBeGreaterThan(0)
})
