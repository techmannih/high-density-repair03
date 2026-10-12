import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { GlobalDrcForceImproveSolver } from "../lib/solvers/GlobalDrcForceImproveSolver/GlobalDrcForceImproveSolver"
import { applyBroadRepulsionForces } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"
import type { HighDensityRoute } from "../lib/types/high-density-types"
import fixtures from "./fixtures/broad-contact-ties.json"

class CountingConnectivityMap extends ConnectivityMap {
  lookupCount = 0
  override getNetConnectedToId(id: string) {
    this.lookupCount++
    return super.getNetConnectedToId(id)
  }
}

test("broad proposals preserve geometry and isolate consumers across both passes and route epochs", () => {
  for (const fixture of fixtures) {
    const routes: HighDensityRoute[] = structuredClone(fixture.routes)
    const original = structuredClone(routes)
    const connMap = new CountingConnectivityMap({
      first: ["first"],
      second: ["second"],
    })
    const solver = new GlobalDrcForceImproveSolver({
      srj: fixture.srj,
      hdRoutes: routes,
      connMap,
      enableBroadProposalCache: true,
    })
    const propose = (base: HighDensityRoute[], multiplier: number) =>
      (solver as any).getBroadCandidateRoutes(
        base,
        multiplier,
      ) as HighDensityRoute[]
    const expected = (base: HighDensityRoute[], multiplier: number) =>
      applyBroadRepulsionForces(
        solver.srj,
        base,
        solver.effort,
        multiplier,
        solver.connMap,
        true,
        false,
      )
    for (const multiplier of [1, 2]) {
      const reference = expected(routes, multiplier)
      const first = propose(routes, multiplier)
      expect(first).toEqual(reference)
      expect(first).not.toBe(routes)
      const lookupCount = connMap.lookupCount
      expect(lookupCount).toBeGreaterThan(0)
      first[0]!.route[1]!.x += 100
      const repeated = propose(routes, multiplier)
      expect(connMap.lookupCount).toBe(lookupCount)
      expect(repeated).toEqual(reference)
      expect(repeated[0]!.route[1]).not.toBe(first[0]!.route[1])
      repeated[1]!.route[1]!.y += 100
      expect(propose(routes, multiplier)).toEqual(reference)
    }
    expect(routes).toEqual(original)

    // A pass-one acceptance can change the base before pass two in the same step.
    const accepted = structuredClone(routes)
    accepted[0]!.route[1]!.y -= 0.2
    expect(propose(accepted, 2)).toEqual(expected(accepted, 2))
    expect(propose(routes, 1)).toEqual(expected(routes, 1))

    for (const [property, value] of [
      [
        "srj",
        {
          ...fixture.srj,
          obstacles: [
            {
              type: "rect",
              center: { x: -1, y: 0 },
              width: 0.5,
              height: 0.5,
              layers: ["top"],
              connectedTo: [],
            },
          ],
        },
      ],
      ["connMap", new ConnectivityMap({ net: ["first", "second"] })],
      ["effort", 2],
    ] as const) {
      ;(solver as any)[property] = value
      expect(propose(routes, 1)).toEqual(expected(routes, 1))
      expect(propose(routes, 2)).toEqual(expected(routes, 2))
    }
    const empty: HighDensityRoute[] = []
    expect(propose(empty, 1)).toBe(empty)
    expect(propose(empty, 1)).toBe(empty)
  }
})
