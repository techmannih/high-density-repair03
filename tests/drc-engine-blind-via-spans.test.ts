import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import type { SimpleRouteJson, SimplifiedPcbTraces } from "../lib/types"

test("indexed via spacing ignores disjoint blind drill spans but retains overlapping spans", () => {
  const srj: SimpleRouteJson = {
    layerCount: 4,
    allowBlindAndBuriedVias: true,
    minTraceWidth: 0.1,
    minViaDiameter: 0.3,
    bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 },
    connections: [],
    obstacles: [],
  }
  const traces: SimplifiedPcbTraces = ["a", "b"].map((name, index) => ({
    type: "pcb_trace",
    pcb_trace_id: name,
    connection_name: name,
    route: [
      {
        route_type: "via",
        x: index * 0.15,
        y: 0,
        via_diameter: 0.3,
        from_layer: index === 0 ? "top" : "inner2",
        to_layer: index === 0 ? "inner1" : "bottom",
      },
    ],
  }))
  expect(new AutoroutingDrcEngine(srj).evaluate(traces).errors).toHaveLength(0)
  const via = traces[1]!.route[0]!
  if (via.route_type !== "via") throw new Error("Expected a via")
  via.from_layer = "inner1"
  expect(new AutoroutingDrcEngine(srj).evaluate(traces).errors).toHaveLength(1)
  via.x = 0
  expect(new AutoroutingDrcEngine(srj).evaluate(traces).errors).toHaveLength(1)
})
