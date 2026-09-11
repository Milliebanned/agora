'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  GLOBE_ARCS,
  GLOBE_NODES,
  buildGridDots,
  buildLatitudeRings,
  buildLongitudeLines,
  latLonToVector3,
  type NodeColor,
} from './globe-data'

export interface WireframeGlobeProps {
  className?: string
  radius?: number
  autoRotateSpeed?: number
}

const cssVar = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

function buildGridGroup(radius: number): THREE.Group {
  const group = new THREE.Group()
  const material = new THREE.LineBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.14,
  })
  for (const ring of buildLatitudeRings(radius)) {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      ring.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    )
    group.add(new THREE.LineLoop(geometry, material))
  }
  for (const meridian of buildLongitudeLines(radius)) {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      meridian.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    )
    group.add(new THREE.Line(geometry, material))
  }

  const dotsGeometry = new THREE.BufferGeometry()
  dotsGeometry.setAttribute('position', new THREE.BufferAttribute(buildGridDots(radius), 3))
  const dotsMaterial = new THREE.PointsMaterial({
    color: '#ffffff',
    size: 0.02,
    transparent: true,
    opacity: 0.22,
    sizeAttenuation: true,
  })
  group.add(new THREE.Points(dotsGeometry, dotsMaterial))

  return group
}

function buildNodeMarker(position: [number, number, number], color: string): THREE.Group {
  const group = new THREE.Group()
  group.position.set(...position)

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 8, 8),
    new THREE.MeshBasicMaterial({ color })
  )
  group.add(core)

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  group.add(halo)

  return group
}

function buildArc(
  from: [number, number, number],
  to: [number, number, number],
  color: string
): THREE.Line {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const mid = a
    .clone()
    .add(b)
    .multiplyScalar(0.5)
    .normalize()
    .multiplyScalar(a.length() * 1.25)
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32))
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  return new THREE.Line(geometry, material)
}

function buildScene(radius: number): THREE.Group {
  const colors: Record<NodeColor, string> = {
    accent: cssVar('--accent', '#e4f222'),
    info: cssVar('--info', '#02b8cc'),
    violet: cssVar('--violet', '#6366f1'),
  }

  const nodePositions: Record<string, [number, number, number]> = {}
  for (const n of GLOBE_NODES) nodePositions[n.id] = latLonToVector3(n.lat, n.lon, radius)

  const root = new THREE.Group()
  root.rotation.z = 0.35
  root.add(buildGridGroup(radius))

  for (const n of GLOBE_NODES) {
    root.add(buildNodeMarker(nodePositions[n.id], colors[n.color]))
  }

  for (const [fromId, toId] of GLOBE_ARCS) {
    const node = GLOBE_NODES.find((n) => n.id === fromId)
    root.add(buildArc(nodePositions[fromId], nodePositions[toId], colors[node?.color ?? 'accent']))
  }

  return root
}

export default function WireframeGlobe({
  className,
  radius = 1.4,
  autoRotateSpeed = 0.06,
}: WireframeGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0, 4.2)

    const scene = new THREE.Scene()
    const root = buildScene(radius)
    scene.add(root)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    })
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const resize = () => {
      const { clientWidth, clientHeight } = container
      if (clientWidth === 0 || clientHeight === 0) return
      const dpr = Math.min(window.devicePixelRatio, 1.5)
      renderer.setPixelRatio(dpr)
      renderer.setSize(clientWidth, clientHeight)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    let rafId = 0
    let lastTime = performance.now()
    const renderFrame = (time: number) => {
      const delta = (time - lastTime) / 1000
      lastTime = time
      root.rotation.y += delta * autoRotateSpeed
      renderer.render(scene, camera)
      if (!reducedMotion) rafId = requestAnimationFrame(renderFrame)
    }
    renderer.render(scene, camera)
    if (!reducedMotion) rafId = requestAnimationFrame(renderFrame)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      renderer.dispose()
      container.removeChild(renderer.domElement)
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          obj.geometry.dispose()
          const material = obj.material
          if (Array.isArray(material)) material.forEach((m) => m.dispose())
          else material.dispose()
        }
      })
    }
  }, [radius, autoRotateSpeed])

  return <div ref={containerRef} className={className} />
}
