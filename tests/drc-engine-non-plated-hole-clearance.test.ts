import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import type { SimpleRouteJson, SimplifiedPcbTraces } from "../lib/types"

test("indexed DRC retains unconnected non-plated holes and their trace clearance", () => {
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.2,
    bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 },
    connections: [],
    obstacles: [
      {
        obstacleId: "mounting-hole",
        isNonPlatedHole: true,
        shape: "circle",
        type: "rect",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        layers: ["top", "bottom"],
        connectedTo: [],
      },
    ],
  }
  const traces: SimplifiedPcbTraces = [
    {
      type: "pcb_trace",
      pcb_trace_id: "signal",
      connection_name: "signal",
      route: [
        { route_type: "wire", x: -1, y: 0.7, width: 0.2, layer: "top" },
        { route_type: "wire", x: 1, y: 0.7, width: 0.2, layer: "top" },
      ],
    },
  ]
  const errors = new AutoroutingDrcEngine(srj, {
    traceClearance: 0.1,
  }).evaluate(traces).errors
  expect(errors).toHaveLength(1)
  expect(errors[0]!.minimum_clearance).toBe(0.2)
  expect(errors[0]!.actual_clearance).toBeCloseTo(0.1)
  expect(
    new AutoroutingDrcEngine({
      ...srj,
      minTraceToHoleEdgeClearance: 0.08,
    }).evaluate(traces).errors,
  ).toHaveLength(0)
})
