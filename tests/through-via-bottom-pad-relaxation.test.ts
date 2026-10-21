import { expect, test } from "bun:test"
import {
  AutoroutingDrcEngine,
  type HighDensityRoute,
  type SimpleRouteJson,
} from "../lib"
import { getDrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import { applyViaToPadClearanceRelaxation } from "../lib/solvers/GlobalDrcForceImproveSolver/viaToPadClearanceRelaxation"

test("via relaxation clears every physical drill layer without moving terminals", (): void => {
  for (const layerCount of [4, 6]) {
    for (const allowBlindAndBuriedVias of [undefined, false, true]) {
      for (const obstacleLayer of ["inner1", "bottom"]) {
        const srj: SimpleRouteJson = {
          layerCount,
          allowBlindAndBuriedVias,
          minTraceWidth: 0.1,
          minViaDiameter: 0.3,
          minViaEdgeToPadEdgeClearance: 0.1,
          bounds: { minX: -2, minY: -2, maxX: 2, maxY: 2 },
          connections: [
            {
              name: "signal",
              pointsToConnect: [
                { x: -1, y: 0, layer: "top" },
                { x: 1, y: 0, layer: "inner2" },
              ],
            },
          ],
          obstacles: [
            {
              type: "rect",
              layers: [obstacleLayer],
              center: { x: 0.2, y: 0 },
              width: 0.2,
              height: 0.2,
              connectedTo: ["pcb_smtpad_foreign", "foreign_net"],
            },
          ],
        }
        const routes: HighDensityRoute[] = [
          {
            connectionName: "signal",
            traceThickness: 0.1,
            viaDiameter: 0.3,
            route: [
              { x: -1, y: 0, z: 0 },
              { x: 0, y: 0, z: 0 },
              { x: 0, y: 0, z: 2 },
              { x: 1, y: 0, z: 2 },
            ],
            vias: [{ x: 0, y: 0 }],
          },
        ]
        const before = structuredClone(routes)
        const engine = new AutoroutingDrcEngine(srj)
        const shouldMove = !allowBlindAndBuriedVias || obstacleLayer === "inner1"
        expect(
          getDrcSnapshot(srj, routes, undefined, undefined, engine).count,
        ).toBe(shouldMove ? 1 : 0)
        const output = applyViaToPadClearanceRelaxation(srj, routes)
        expect(
          getDrcSnapshot(srj, output, undefined, undefined, engine).count,
        ).toBe(0)
        expect(output[0]!.route[0]).toEqual(routes[0]!.route[0])
        expect(output[0]!.route.at(-1)).toEqual(routes[0]!.route.at(-1))
        expect(routes).toEqual(before)
        if (!shouldMove) expect(output).toEqual(before)
      }
    }
  }
})
