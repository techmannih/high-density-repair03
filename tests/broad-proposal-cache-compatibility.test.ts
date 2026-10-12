import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { AutoroutingDrcEngine } from "../lib/drc"
import { GlobalDrcForceImproveSolver } from "../lib/solvers/GlobalDrcForceImproveSolver/GlobalDrcForceImproveSolver"
import type { GlobalDrcForceImproveSolverParams } from "../lib/solvers/GlobalDrcForceImproveSolver/types"
import type { SimpleRouteJson } from "../lib/types"
import type { HighDensityRoute } from "../lib/types/high-density-types"

test("default behavior and custom evaluation paths recompute broad proposals for mutable connectivity", () => {
  for (const mode of [
    "default",
    "evaluator",
    "reference",
    "engine",
    "engine getter",
    "snapshot",
  ] as const) {
    const srj: SimpleRouteJson = {
      bounds: { minX: -2, minY: -2, maxX: 3, maxY: 2 },
      connections: [],
      layerCount: 2,
      minTraceWidth: 0.1,
      minViaDiameter: 0.3,
      obstacles: [
        {
          type: "rect",
          center: { x: 1, y: 0.08 },
          width: 0.3,
          height: 0.3,
          layers: ["top"],
          connectedTo: ["pad_a"],
        },
      ],
    }
    const routes: HighDensityRoute[] = ["route_a", "route_b"].map(
      (connectionName, i) => ({
        connectionName,
        route: [0, 1, 2].map((x) => ({ x, y: i * 0.15, z: 0 })),
        vias: [],
        traceThickness: 0.1,
        viaDiameter: 0.3,
      }),
    )
    const connMap = new ConnectivityMap({
      net_a: ["route_a"],
      net_b: ["route_b"],
      net_pad: ["pad_a"],
    })
    const params: GlobalDrcForceImproveSolverParams = {
      srj,
      hdRoutes: routes,
      connMap,
      enableBroadProposalCache: mode !== "default",
    }
    if (mode === "evaluator") params.drcEvaluator = () => []
    if (mode === "reference") params.referenceDrcEvaluator = () => []
    if (mode === "engine")
      params.autoroutingDrcEngine = new AutoroutingDrcEngine(srj, { connMap })
    let engineReads = 0
    if (mode === "engine getter") {
      const engine = new AutoroutingDrcEngine(srj, { connMap })
      Object.defineProperty(params, "autoroutingDrcEngine", {
        get: () => (++engineReads === 1 ? engine : undefined),
      })
    }
    const solver = new GlobalDrcForceImproveSolver(params)
    if (mode === "engine getter") expect(engineReads).toBe(1)
    const internal = solver as any
    if (mode === "snapshot")
      internal.getSnapshot = internal.getSnapshot.bind(solver)
    expect(internal.getBroadCandidateRoutes(routes, 1)).not.toBe(routes)
    connMap.addConnections([["route_a", "route_b", "pad_a"]])
    expect(internal.getBroadCandidateRoutes(routes, 1)).toBe(routes)
    srj.obstacles[0]!.connectedTo = ["foreign_pad"]
    expect(internal.getBroadCandidateRoutes(routes, 1)).not.toBe(routes)
  }
})
