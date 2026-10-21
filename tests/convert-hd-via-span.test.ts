import { expect, test } from "bun:test"
import type { SimpleRouteJson } from "../lib/types"
import type { HighDensityRoute } from "../lib/types/high-density-types"
import { convertToCircuitJson } from "../lib/utils/convertToCircuitJson"

test("HD conversion preserves travel endpoints while exporting physical via spans", () => {
  const srj: SimpleRouteJson = {
    layerCount: 4,
    minTraceWidth: 0.1,
    bounds: { minX: -2, minY: -2, maxX: 2, maxY: 2 },
    obstacles: [],
    connections: [],
  }
  const routes: HighDensityRoute[] = [
    {
      connectionName: "signal",
      traceThickness: 0.1,
      viaDiameter: 0.3,
      vias: [{ x: 0, y: 0 }],
      route: [
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 2 },
        { x: 1, y: 0, z: 2 },
      ],
    },
  ]
  for (const allowBlindAndBuriedVias of [undefined, false, true]) {
    const json = convertToCircuitJson(
      { ...srj, allowBlindAndBuriedVias },
      routes,
    )
    const via = json.find((element) => element.type === "pcb_via")
    expect(via?.layers).toEqual(
      allowBlindAndBuriedVias
        ? ["top", "inner1", "inner2"]
        : ["top", "inner1", "inner2", "bottom"],
    )
    const trace = json.find((element) => element.type === "pcb_trace")
    expect(trace?.route.at(-1)).toMatchObject({ layer: "inner2" })
  }
})
