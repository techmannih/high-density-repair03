import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import {
  AutoroutingDrcEngine,
  GlobalDrcForceImproveSolver,
  type HighDensityRoute,
  type SimpleRouteJson,
} from "../lib"
import { getDrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import input from "./fixtures/sample006-before-global-repair.json"

test("sample006 repair does not introduce a different-net SMT pad overlap", () => {
  const srj = structuredClone(input.srj) as SimpleRouteJson
  const hdRoutes = structuredClone(input.hdRoutes) as HighDensityRoute[]
  const connMap = new ConnectivityMap(input.netMap)
  // Zero clearance isolates physical copper contact from the existing
  // positive-gap clearance violations that this stage is trying to repair.
  const contactDrc = new AutoroutingDrcEngine(srj, {
    connMap,
    traceClearance: 0,
    viaClearance: 0,
  })
  const getPadOverlaps = (routes: HighDensityRoute[]) =>
    getDrcSnapshot(srj, routes, undefined, connMap, contactDrc).errors.filter(
      (error) =>
        error.type === "pcb_trace_error" &&
        String(error.message).includes("pcb_smtpad") &&
        Number(error.actual_clearance) < 0,
    )

  expect(getPadOverlaps(hdRoutes)).toEqual([])
  const solver = new GlobalDrcForceImproveSolver({
    srj,
    hdRoutes,
    connMap,
    effort: input.effort,
    maxIterations: input.maxIterations,
    enableLargeBoardBroadFallback: input.enableLargeBoardBroadFallback,
    enablePostSolveClearanceRelaxation:
      input.enablePostSolveClearanceRelaxation,
  })
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput()).toHaveLength(hdRoutes.length)
  expect(getPadOverlaps(solver.getOutput())).toEqual([])
})
