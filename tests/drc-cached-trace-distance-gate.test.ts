import { expect, test } from "bun:test"
import {
  doSegmentsIntersect,
  pointToSegmentDistance,
  segmentToSegmentMinDistance,
} from "@tscircuit/math-utils"
import { readFileSync } from "node:fs"
import { AutoroutingDrcEngine } from "../lib/drc/AutoroutingDrcEngine"
import type { SimpleRouteJson, SimplifiedPcbTraces } from "../lib/types"

type Point = { x: number; y: number }
type Segment = {
  kind: "trace_segment"
  order: number
  traceId: string
  netId: string
  start: Point
  end: Point
  width: number
  layer: string
  pcbPortIds: string[]
  distanceBounds?: { minX: number; minY: number; maxX: number; maxY: number }
}
const source = readFileSync(
  new URL("../lib/drc/AutoroutingDrcEngine.ts", import.meta.url),
  "utf8",
)
const distance = new Function(
  "doSegmentsIntersect",
  "pointToSegmentDistance",
  "segmentToSegmentMinDistance",
  "DRC_EPSILON",
  new Bun.Transpiler({ loader: "ts" }).transformSync(
    source.slice(
      source.indexOf("const isBoundedTracePoint ="),
      source.indexOf("class SpatialHash<T>"),
    ),
  ) + "\nreturn getTracePairDistance;",
)(
  doSegmentsIntersect,
  pointToSegmentDistance,
  segmentToSegmentMinDistance,
  0.005,
) as (a: Segment, b: Segment, clearance: number) => number
const segment = (
  id: string,
  start: Point,
  end: Point,
  width = 0.1,
): Segment => ({
  kind: "trace_segment",
  order: 0,
  traceId: id,
  netId: id,
  start,
  end,
  width,
  layer: "top",
  pcbPortIds: [],
  distanceBounds: undefined,
})
const srj: SimpleRouteJson = {
  bounds: { minX: -5, minY: -5, maxX: 5, maxY: 5 },
  layerCount: 2,
  minTraceWidth: 0.1,
  minViaDiameter: 0.3,
  connections: [],
  obstacles: [],
}
const checkPair = (engine: AutoroutingDrcEngine, a: Segment, b: Segment) =>
  (
    engine as unknown as {
      checkTracePair: (
        a: Segment,
        b: Segment,
      ) => { actual_clearance: number } | undefined
    }
  ).checkTracePair(a, b)

const prepare = (engine: AutoroutingDrcEngine, segments: Segment[]) =>
  (
    engine as unknown as {
      buildDynamicIndexes: (segments: Segment[], vias: never[]) => unknown
    }
  ).buildDynamicIndexes(segments, [])
const nativeDistance = (a: Segment, b: Segment) =>
  segmentToSegmentMinDistance(a.start, a.end, b.start, b.end)

// The native distance helper is the independent numeric oracle. The gate only
// removes work after its original intersection predicate has returned false.
test("cached trace distance preserves native gaps and callbacks", () => {
  let seed = 18473
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const engine = new AutoroutingDrcEngine(srj, { spatialCellSize: 10000 })
  let rejected = 0
  for (let index = 0; index < 1000; index++) {
    const point = (): Point => ({
      x: random() * 20 - 10,
      y: random() * 20 - 10,
    })
    const a = segment("a", point(), point(), random())
    const b = segment("b", point(), point(), random())
    prepare(engine, [a, b])
    const expected = nativeDistance(a, b)
    const actual = distance(a, b, 0.1)
    const gap = expected - a.width / 2 - b.width / 2
    if (actual === Infinity) {
      rejected++
      expect(gap).toBeGreaterThan(0.1 - 0.005)
    } else {
      expect(actual).toBe(expected)
    }
    const error = checkPair(engine, a, b)
    if (gap > 0.1 - 0.005) expect(error).toBeUndefined()
    else expect(error!.actual_clearance).toBe(gap)
  }
  expect(rejected).toBeGreaterThan(100)
  expect(engine.lastRunStats.exactCheckCount).toBe(1000)

  for (const origin of [-1e9, 0, 1e9 - 1]) {
    for (const length of [0, 1e-170, 0.1]) {
      for (const separation of [0.194999, 0.2, 0.205, 0.205001, 0.4]) {
        const a = segment(
          "a",
          { x: origin, y: 0 },
          { x: origin + length, y: 0 },
        )
        const b = segment(
          "b",
          { x: origin, y: separation },
          { x: origin + length, y: separation },
        )
        const gap =
          segmentToSegmentMinDistance(a.start, a.end, b.start, b.end) -
          a.width / 2 -
          b.width / 2
        prepare(engine, [a, b])
        const actual = distance(a, b, 0.1)
        if (actual === Infinity) expect(gap).toBeGreaterThan(0.095)
        else expect(actual).toBe(nativeDistance(a, b))
        const error = checkPair(engine, a, b)
        if (gap > 0.095) expect(error).toBeUndefined()
        else expect(error!.actual_clearance).toBe(gap)
      }
    }
  }

  const cancellation = [
    segment(
      "a",
      { x: 100, y: 277.08762483671313 },
      { x: 919.6560543728992, y: 49.971075547494685 },
      75,
    ),
    segment(
      "b",
      { x: 1229.701747186482, y: -35.93874906507412 },
      { x: 2100, y: -277.08762483671313 },
      75,
    ),
  ]
  prepare(engine, cancellation)
  expect(distance(cancellation[0]!, cancellation[1]!, 0.1)).toBe(0)
  const cancellationTraces: SimplifiedPcbTraces = cancellation.map((item) => ({
    type: "pcb_trace",
    pcb_trace_id: item.traceId,
    connection_name: item.netId,
    route: [item.start, item.end].map((point) => ({
      route_type: "wire",
      ...point,
      width: item.width,
      layer: "top",
    })),
  }))
  const legacyError = new AutoroutingDrcEngine(srj, {
    spatialCellSize: 10000,
  }).evaluate(cancellationTraces)
  expect(legacyError.errors[0]!.actual_clearance).toBe(-75)

  const a = segment("a", { x: 0, y: 0 }, { x: 1, y: 0 })
  const b = segment("b", { x: 0, y: 1 }, { x: 1, y: 1 })
  prepare(engine, [a, b])
  expect(distance(a, b, 0.1)).toBe(Infinity)
  for (const value of [NaN, Infinity, -0.1, 1e10, "1"]) {
    expect(distance(a, b, value as number)).toBe(nativeDistance(a, b))
    const unsafe = segment("unsafe", { x: 0, y: 0 }, { x: 1, y: 0 })
    unsafe.width = value as number
    expect(distance(unsafe, b, 0.1)).toBe(nativeDistance(unsafe, b))
    for (const point of ["start", "end"] as const) {
      for (const axis of ["x", "y"] as const) {
        const coordinates = segment("unsafe", { x: 0, y: 0 }, { x: 1, y: 0 })
        coordinates[point][axis] = value as number
        expect(distance(coordinates, b, 0.1)).toBe(
          nativeDistance(coordinates, b),
        )
      }
    }
  }

  const calls: string[] = []
  const boxed = {
    valueOf: () => {
      calls.push("width")
      return 0.1
    },
  }
  const unsafe = segment("unsafe", { x: 0, y: 0 }, { x: 1, y: 0 })
  unsafe.width = boxed as unknown as number
  prepare(engine, [unsafe])
  expect(unsafe.distanceBounds).toBeUndefined()
  calls.length = 0
  expect(distance(unsafe, b, 0.1)).toBe(nativeDistance(unsafe, b))
  expect(distance(a, b, boxed as unknown as number)).toBe(nativeDistance(a, b))
  expect(calls).toEqual([])
  const live = segment("b", { x: 0, y: 1 }, { x: 1, y: 1 })
  live.width = boxed as unknown as number
  const connected = new AutoroutingDrcEngine(srj, {
    connMap: {
      areIdsConnected: () => {
        calls.push("connected")
        live.start.y = 0
        live.end.y = 0
        return false
      },
      getNetConnectedToId: (id: string) => {
        calls.push(id)
        return undefined
      },
    } as never,
  })
  expect(checkPair(connected, a, live)!.actual_clearance).toBe(-0.1)
  expect(calls).toEqual(["connected", "a", "b", "width"])
  expect(connected.lastRunStats.exactCheckCount).toBe(1)

  calls.length = 0
  const sameNet = new AutoroutingDrcEngine(srj, {
    connMap: {
      areIdsConnected: () => {
        calls.push("connected")
        return true
      },
      getNetConnectedToId: () => undefined,
    } as never,
  })
  expect(checkPair(sameNet, a, live)).toBeUndefined()
  expect(calls).toEqual(["connected"])
  expect(sameNet.lastRunStats.exactCheckCount).toBe(0)

  const routes: SimplifiedPcbTraces = [0, 0.05].map((y, index) => ({
    type: "pcb_trace",
    pcb_trace_id: `trace_${index}`,
    connection_name: `net_${index}`,
    route: [0, 1].map((x) => ({
      route_type: "wire",
      x,
      y,
      width: 0.1,
      layer: "top",
    })),
  }))
  const mutating = new AutoroutingDrcEngine(srj, {
    spatialCellSize: 10,
    connMap: {
      areIdsConnected: () => {
        for (const point of routes[1]!.route) {
          if (point.route_type === "wire") point.y = 20
        }
        return false
      },
      getNetConnectedToId: () => undefined,
    } as never,
  })
  expect(mutating.evaluate(routes).errors[0]!.actual_clearance).toBe(-0.05)
  expect(mutating.lastRunStats.exactCheckCount).toBe(1)
  const mutatedPoint = routes[1]!.route[0]!
  if (mutatedPoint.route_type !== "wire") {
    throw new Error("Expected a wire point in the mutable trace fixture")
  }
  expect(mutatedPoint.y).toBe(20)

  const descriptor = Object.getOwnPropertyDescriptor(
    Object.prototype,
    "distanceBounds",
  )
  try {
    const first = routes[0]!.route[0]!
    if (first.route_type === "wire") first.width = boxed as unknown as number
    for (const point of routes[1]!.route) {
      if (point.route_type === "wire") point.y = 0.15
    }
    const inherited = new AutoroutingDrcEngine(srj, {
      spatialCellSize: 10,
      connMap: {
        areIdsConnected: () => {
          Object.defineProperty(Object.prototype, "distanceBounds", {
            configurable: true,
            get: () => {
              throw new Error("inherited metadata read")
            },
          })
          return false
        },
        getNetConnectedToId: () => undefined,
      } as never,
    })
    expect(inherited.evaluate(routes).errors[0]!.actual_clearance).toBe(
      0.04999999999999999,
    )
  } finally {
    if (descriptor) {
      Object.defineProperty(Object.prototype, "distanceBounds", descriptor)
    } else {
      delete (Object.prototype as { distanceBounds?: unknown }).distanceBounds
    }
  }
})
