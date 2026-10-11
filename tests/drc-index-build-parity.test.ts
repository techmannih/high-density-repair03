import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { AutoroutingDrcEngine } from "../lib/drc/AutoroutingDrcEngine"
import type { SimpleRouteJson, SimplifiedPcbTraces } from "../lib/types"

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
type Item = { id: number }
type Index = {
  insert: (item: Item, bounds: Bounds) => void
  insertFresh: (item: Item, bounds: Bounds) => void
  query: (bounds: Bounds) => Item[]
  reset: () => void
  finishBuild: () => boolean
}
type IndexConstructor = new (cellSize: number) => Index

// Frozen coarse query implementation from the exact upstream base 53ce59a8.
const originalSource = String.raw`
class SpatialHash<T> {
  private readonly cells = new Map<number, Map<number, number[]>>()
  private readonly itemIds = new Map<T, number>()
  private readonly rowItems: T[] = []
  private visitedGenerations = new Uint32Array(0)
  private queryGeneration = 0

  constructor(private readonly cellSize: number) {}

  private registerItem(item: T): number {
    const existingId = this.itemIds.get(item)
    if (existingId !== undefined) return existingId

    const itemId = this.rowItems.length
    if (itemId >= this.visitedGenerations.length) {
      const generations = new Uint32Array(
        this.visitedGenerations.length === 0
          ? 16
          : this.visitedGenerations.length * 2,
      )
      generations.set(this.visitedGenerations)
      this.visitedGenerations = generations
    }
    this.itemIds.set(item, itemId)
    // Set iteration canonicalizes primitive negative zero to positive zero.
    this.rowItems.push(item === 0 ? (0 as T) : item)
    return itemId
  }

  insert(item: T, bounds: Bounds): void {
    const minCellX = Math.floor(bounds.minX / this.cellSize)
    const maxCellX = Math.floor(bounds.maxX / this.cellSize)
    const minCellY = Math.floor(bounds.minY / this.cellSize)
    const maxCellY = Math.floor(bounds.maxY / this.cellSize)
    let itemId: number | undefined

    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      let column = this.cells.get(cellX)
      if (!column && minCellY <= maxCellY) {
        column = new Map<number, number[]>()
        this.cells.set(cellX, column)
      }
      for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
        const items = column!.get(cellY)
        if (itemId === undefined) itemId = this.registerItem(item)
        if (items) {
          items.push(itemId)
        } else {
          column!.set(cellY, [itemId])
        }
      }
    }
  }

  query(bounds: Bounds): T[] {
    const minCellX = Math.floor(bounds.minX / this.cellSize)
    const maxCellX = Math.floor(bounds.maxX / this.cellSize)
    const minCellY = Math.floor(bounds.minY / this.cellSize)
    const maxCellY = Math.floor(bounds.maxY / this.cellSize)
    let generation = this.queryGeneration + 1
    if (generation > 0xffffffff) {
      this.visitedGenerations.fill(0)
      generation = 1
    }
    this.queryGeneration = generation
    const results: T[] = []

    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      const column = this.cells.get(cellX)
      // Keep the original loop for nonprogressing infinite/unsafe endpoints.
      if (
        !column &&
        minCellY >= -9007199254740991 &&
        maxCellY <= 9007199254740991
      ) {
        continue
      }
      for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
        const items = column?.get(cellY)
        if (!items) continue
        for (const itemId of items) {
          if (this.visitedGenerations[itemId] === generation) continue
          this.visitedGenerations[itemId] = generation
          results.push(this.rowItems[itemId]!)
        }
      }
    }

    return results
  }
}
`
const transpiler = new Bun.Transpiler({ loader: "ts" })
const OriginalIndex = new Function(
  transpiler.transformSync(originalSource) + "\nreturn SpatialHash;",
)() as IndexConstructor
const source = readFileSync(
  new URL("../lib/drc/AutoroutingDrcEngine.ts", import.meta.url),
  "utf8",
)
const CandidateIndex = new Function(
  transpiler.transformSync(
    source.slice(
      source.indexOf("class SpatialHash<T>"),
      source.indexOf("const getClosestPointBetweenSegments"),
    ),
  ) + "\nreturn SpatialHash;",
)() as IndexConstructor

test("DRC bounds and reusable builds preserve contacts, order and current layers", () => {
  let seed = 17232
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (const cellSize of [0.25, 2, 10]) {
    const candidate = new CandidateIndex(cellSize)
    for (const itemCount of [33, 2, 0, 35, 1]) {
      candidate.reset()
      const original = new OriginalIndex(cellSize)
      const insertedBounds = new Map<Item, Bounds>()
      for (let id = 0; id < itemCount; id++) {
        const item = { id }
        const x = random() * 6 - 3
        const y = random() * 6 - 3
        const bounds = {
          minX: x,
          minY: y,
          maxX: x + random(),
          maxY: y + random(),
        }
        original.insert(item, bounds)
        if (id % 2 === 0) candidate.insertFresh(item, { ...bounds })
        else candidate.insert(item, bounds)
        insertedBounds.set(item, { ...bounds })
        if (id % 2 === 1 && id % 3 === 1) {
          const nextBounds = { ...bounds, minX: x - 0.3 }
          original.insert(item, nextBounds)
          candidate.insert(item, nextBounds)
          insertedBounds.set(item, nextBounds)
        }
      }
      expect(candidate.finishBuild()).toBe(itemCount > 0)
      for (let query = 0; query < 30; query++) {
        const minX = random() * 8 - 4
        const minY = random() * 8 - 4
        const bounds = {
          minX,
          minY,
          maxX: minX + random() * 3,
          maxY: minY + random() * 3,
        }
        const expected = original.query(bounds).filter((item) => {
          const inserted = insertedBounds.get(item)!
          return !(
            inserted.maxX < bounds.minX ||
            inserted.minX > bounds.maxX ||
            inserted.maxY < bounds.minY ||
            inserted.minY > bounds.maxY
          )
        })
        expect(candidate.query(bounds)).toEqual(expected)
      }
      if (itemCount === 0) {
        expect(
          (candidate as unknown as { cells: Map<number, unknown> }).cells.size,
        ).toBe(0)
      }
    }
  }

  const srj: SimpleRouteJson = {
    bounds: { minX: -5, minY: -5, maxX: 5, maxY: 5 },
    layerCount: 2,
    minTraceWidth: 0.1,
    minViaDiameter: 0.3,
    connections: [],
    obstacles: [
      {
        type: "rect",
        center: { x: 0, y: 0 },
        width: 0.3,
        height: 0.3,
        layers: ["top"],
        connectedTo: ["pcb_smtpad_test"],
      },
    ],
  }
  const traces: SimplifiedPcbTraces = [
    {
      type: "pcb_trace",
      pcb_trace_id: "moving",
      connection_name: "moving",
      route: [
        { route_type: "wire", x: -1, y: 0, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0, width: 0.1, layer: "top" },
        {
          route_type: "via",
          x: 1,
          y: 0,
          from_layer: "top",
          to_layer: "bottom",
          via_diameter: 0.3,
        },
        { route_type: "wire", x: 1, y: 0, width: 0.1, layer: "bottom" },
      ],
    },
  ]
  const reused = new AutoroutingDrcEngine(srj)
  for (let pass = 0; pass < 4; pass++) {
    const current = pass === 2 ? [] : traces
    const expected = new AutoroutingDrcEngine(srj).evaluate(current)
    expect(reused.evaluate(current)).toEqual(expected)
    for (const point of traces[0]!.route) {
      if (point.route_type === "jumper") throw new Error("Expected copper")
      point.y += 0.3
    }
    if (pass === 0) traces[0]!.route.splice(2)
  }
})
