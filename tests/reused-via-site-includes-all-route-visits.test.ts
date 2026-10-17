import { expect, test } from "bun:test"
import { collectViaNodes } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import type { SimpleRouteJson } from "../lib/types"
import type { HighDensityRoute } from "../lib/types/high-density-types"

test("a reused via moves every visit and retains its full physical layer span", () => {
  const route: HighDensityRoute = {
    connectionName: "sample024-via", traceThickness: 0.1524, viaDiameter: 0.2032,
    route: [
      { x: -1, y: 0, z: 7 }, { x: 0, y: 0, z: 1 },
      { x: 0.1, y: 0.1, z: 1 }, { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    ],
    vias: [{ x: 0, y: 0 }],
  }
  const srj: SimpleRouteJson = {
    layerCount: 8, allowBlindAndBuriedVias: true, minTraceWidth: 0.1524,
    bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 }, obstacles: [], connections: [],
  }
  const vias = collectViaNodes([route], srj)
  expect(vias).toHaveLength(1)
  expect(vias[0]!.pointIndexes).toEqual([1, 3, 4])
  expect(vias[0]!.zLayers).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  expect(vias[0]!.movable).toBeTrue()
})
