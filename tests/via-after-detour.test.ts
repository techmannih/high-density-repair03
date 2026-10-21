import { expect, test } from "bun:test"
import {
  applyDrcErrorForces,
  cloneRoutes,
  collectViaNodes,
  materializeRoutes,
} from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import type { HighDensityRoute, SimpleRouteJson } from "../lib"
import fixture from "./fixtures/via-after-detour.json"

test("keeps both via endpoints together after inserting a trace detour", (): void => {
  const srj = fixture.srj as SimpleRouteJson
  const input = fixture.routes as HighDensityRoute[]
  const routes = cloneRoutes(input)
  const inputCopy = structuredClone(input)
  const changed = applyDrcErrorForces(
    srj,
    routes,
    [fixture.error],
    new Map([[fixture.error.pcb_trace_id, 0]]),
    1,
  )

  expect(changed).toBe(true)
  expect(routes[0]!.route.length).toBeGreaterThan(input[0]!.route.length)
  const transitions = routes[0]!.route.flatMap((point, index) => {
    const previous = routes[0]!.route[index - 1]
    return previous && previous.z !== point.z ? [[previous, point]] : []
  })
  expect(transitions).toHaveLength(2)
  for (const [start, end] of transitions) {
    expect(start!.x).toBe(end!.x)
    expect(start!.y).toBe(end!.y)
  }
  expect(collectViaNodes(routes, srj)).toHaveLength(2)
  expect(materializeRoutes(routes)[0]!.vias).toHaveLength(2)
  expect(input).toEqual(inputCopy)
})
