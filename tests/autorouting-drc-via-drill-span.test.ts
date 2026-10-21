import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib/drc/AutoroutingDrcEngine"
import type { SimpleRouteJson, SimplifiedPcbTraces } from "../lib/types"
import { convertToCircuitJson } from "../lib/utils/convertToCircuitJson"

test("via drill spans follow board policy for both endpoint and explicit layer APIs", (): void => {
  const srj: SimpleRouteJson = {
    layerCount: 4,
    minTraceWidth: 0.1,
    minViaDiameter: 0.3,
    bounds: { minX: -2, minY: -2, maxX: 2, maxY: 2 },
    obstacles: [],
    connections: [],
  }
  const traces: SimplifiedPcbTraces = [
    {
      type: "pcb_trace",
      pcb_trace_id: "power",
      connection_name: "power",
      route: [
        {
          route_type: "via",
          x: 0,
          y: 0,
          from_layer: "top",
          to_layer: "inner2",
        },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "signal",
      connection_name: "signal",
      route: [
        { route_type: "wire", x: -1, y: 0, width: 0.1, layer: "bottom" },
        { route_type: "wire", x: 1, y: 0, width: 0.1, layer: "bottom" },
      ],
    },
  ]
  for (const explicitLayers of [false, true]) {
    const input = structuredClone(traces)
    const via = input[0]!.route[0]!
    if (via.route_type !== "via") throw new Error("Expected a via")
    if (explicitLayers) via.layers = ["top", "inner1", "inner2"]
    const original = structuredClone(input)
    for (const allowBlindAndBuriedVias of [undefined, false, true]) {
      srj.allowBlindAndBuriedVias = allowBlindAndBuriedVias
      expect(new AutoroutingDrcEngine(srj).evaluate(input).errors).toHaveLength(
        allowBlindAndBuriedVias ? 0 : 1,
      )
      expect(
        convertToCircuitJson(srj, input).find(
          (element) => element.type === "pcb_via",
        ),
      ).toMatchObject({
        layers: allowBlindAndBuriedVias
          ? ["top", "inner1", "inner2"]
          : ["top", "inner1", "inner2", "bottom"],
      })
    }
    expect(input).toEqual(original)
  }
})
