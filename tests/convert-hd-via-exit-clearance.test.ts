import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib/drc/AutoroutingDrcEngine"
import { getDrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import type { SimpleRouteJson } from "../lib/types"
import type { HighDensityRoute } from "../lib/types/high-density-types"

test("repair DRC detects a crossing on the first segment after a via", () => {
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    minViaDiameter: 0.3,
    bounds: { minX: -3, minY: -2, maxX: 3, maxY: 2 },
    obstacles: [],
    connections: [
      { name: "signal", pointsToConnect: [] },
      { name: "crossing", pointsToConnect: [] },
    ],
  }
  const routes: HighDensityRoute[] = [
    {
      connectionName: "signal",
      traceThickness: 0.1,
      viaDiameter: 0.3,
      vias: [{ x: 0, y: 0 }],
      route: [
        { x: -2, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 2, y: 0, z: 1 },
      ],
    },
    {
      connectionName: "crossing",
      traceThickness: 0.1,
      viaDiameter: 0.3,
      vias: [],
      route: [
        { x: 1, y: -1, z: 1 },
        { x: 1, y: 1, z: 1 },
      ],
    },
  ]
  const engine = new AutoroutingDrcEngine(srj)
  const snapshot = getDrcSnapshot(srj, routes, undefined, undefined, engine)
  expect(snapshot.errors).toHaveLength(1)
  expect(snapshot.errors[0]).toMatchObject({
    type: "pcb_trace_error",
    center: { x: 1, y: 0 },
  })

  // The same crossing on the other layer must remain valid.
  for (const point of routes[1]!.route) point.z = 0
  expect(
    getDrcSnapshot(srj, routes, undefined, undefined, engine).errors,
  ).toEqual([])
})
