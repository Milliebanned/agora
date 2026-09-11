export type NodeColor = 'accent' | 'info' | 'violet'

export interface GlobeNode {
  id: string
  lat: number
  lon: number
  color: NodeColor
}

export function latLonToVector3(
  latDeg: number,
  lonDeg: number,
  radius = 1
): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  const x = radius * Math.cos(lat) * Math.cos(lon)
  const y = radius * Math.sin(lat)
  const z = radius * Math.cos(lat) * Math.sin(lon)
  return [x, y, z]
}

// Decorative points, not real geodata — just enough spread to read as a network.
export const GLOBE_NODES: GlobeNode[] = [
  { id: 'a', lat: 32, lon: -40, color: 'accent' },
  { id: 'b', lat: 12, lon: 55, color: 'info' },
  { id: 'c', lat: -28, lon: 8, color: 'violet' },
  { id: 'd', lat: 42, lon: 125, color: 'accent' },
  { id: 'e', lat: -12, lon: -105, color: 'info' },
]

export const GLOBE_ARCS: Array<[string, string]> = [
  ['a', 'b'],
  ['b', 'c'],
  ['c', 'd'],
  ['a', 'e'],
]

export function buildLatitudeRings(
  radius: number,
  ringCount = 7,
  segments = 48
): [number, number, number][][] {
  const rings: [number, number, number][][] = []
  for (let i = 1; i < ringCount + 1; i++) {
    const lat = -90 + (180 * i) / (ringCount + 1)
    const pts: [number, number, number][] = []
    for (let s = 0; s <= segments; s++) {
      pts.push(latLonToVector3(lat, (360 * s) / segments, radius))
    }
    rings.push(pts)
  }
  return rings
}

export function buildLongitudeLines(
  radius: number,
  lineCount = 12,
  segments = 32
): [number, number, number][][] {
  const lines: [number, number, number][][] = []
  for (let i = 0; i < lineCount; i++) {
    const lon = (360 * i) / lineCount
    const pts: [number, number, number][] = []
    for (let s = 0; s <= segments; s++) {
      pts.push(latLonToVector3(-90 + (180 * s) / segments, lon, radius))
    }
    lines.push(pts)
  }
  return lines
}

// Every ring/meridian intersection, flattened for one Points draw call.
export function buildGridDots(
  radius: number,
  latSteps = 9,
  lonSteps = 18
): Float32Array {
  const dots: number[] = []
  for (let i = 0; i <= latSteps; i++) {
    const lat = -90 + (180 * i) / latSteps
    for (let j = 0; j < lonSteps; j++) {
      const lon = (360 * j) / lonSteps
      dots.push(...latLonToVector3(lat, lon, radius))
    }
  }
  return new Float32Array(dots)
}
