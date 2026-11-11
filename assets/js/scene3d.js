/* ==========================================================================
   GS3D — interactive 3D model viewer
   Light studio render matching the site palette (paper, cyan, graphite).
   Three models, pointer orbit with inertia, keyboard orbit, zoom, reset.
   No external requests: Three.js is served from assets/vendor.
   ========================================================================== */

import * as THREE from "../vendor/three.module.min.js"

const BRAND = 0x10c0e0
const BRAND_DEEP = 0x0b8fad
const GRAPHITE = 0x3c464f
const CLAY = 0xeef2f5

const MATERIALS = {
  clay: new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.62, metalness: 0.05 }),
  clayShade: new THREE.MeshStandardMaterial({ color: 0xd7dee4, roughness: 0.55, metalness: 0.12 }),
  graphite: new THREE.MeshStandardMaterial({ color: GRAPHITE, roughness: 0.48, metalness: 0.25 }),
  brand: new THREE.MeshStandardMaterial({
    color: 0x24c9e4,
    roughness: 0.34,
    metalness: 0.12,
    emissive: BRAND,
    emissiveIntensity: 0.14,
  }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xa9e4f1,
    roughness: 0.12,
    metalness: 0.04,
    transparent: true,
    opacity: 0.6,
  }),
}

/* One shared edge material keeps the wireframe accent consistent and cheap. */
const EDGE = new THREE.LineBasicMaterial({ color: BRAND_DEEP, transparent: true, opacity: 0.38 })

function addMesh(parent, geometry, material, options = {}) {
  const { position = [0, 0, 0], rotation = [0, 0, 0], edge = true, shadow = true } = options // taste-skill-ignore: three.js mesh lighting, not a UI shadow
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(position[0], position[1], position[2])
  mesh.rotation.set(rotation[0], rotation[1], rotation[2])
  mesh.castShadow = shadow
  mesh.receiveShadow = shadow
  if (edge) {
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), EDGE))
  }
  parent.add(mesh)
  return mesh
}

function pipe(parent, from, to, radius = 0.055, material = MATERIALS.graphite) {
  const start = new THREE.Vector3(from[0], from[1], from[2])
  const end = new THREE.Vector3(to[0], to[1], to[2])
  const length = start.distanceTo(end)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), material)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    end.clone().sub(start).normalize()
  )
  mesh.castShadow = true
  parent.add(mesh)
  return mesh
}

/* --------------------------------------------------------------- models */

function buildPlant() {
  const group = new THREE.Group()

  addMesh(group, new THREE.BoxGeometry(7.4, 0.22, 5.2), MATERIALS.clayShade, { position: [0, 0.11, 0] })

  /* Silo cluster with conical roofs and a service platform. */
  const siloX = [-2.35, -1.0, 0.35]
  siloX.forEach((x, index) => {
    const height = 2.5 + index * 0.42
    addMesh(group, new THREE.CylinderGeometry(0.46, 0.46, height, 26), MATERIALS.clay, {
      position: [x, 0.22 + height / 2, -1.35],
    })
    addMesh(group, new THREE.ConeGeometry(0.5, 0.42, 26), MATERIALS.brand, {
      position: [x, 0.22 + height + 0.21, -1.35],
    })
    addMesh(group, new THREE.TorusGeometry(0.48, 0.028, 8, 24), MATERIALS.graphite, {
      position: [x, 0.22 + height * 0.62, -1.35],
      rotation: [Math.PI / 2, 0, 0],
    })
  })

  /* Service walkway across the silos. */
  addMesh(group, new THREE.BoxGeometry(3.9, 0.06, 0.5), MATERIALS.graphite, {
    position: [-1.0, 2.15, -1.35],
  })
  for (let i = 0; i < 5; i += 1) {
    addMesh(group, new THREE.BoxGeometry(0.03, 0.42, 0.03), MATERIALS.graphite, {
      position: [-2.9 + i * 0.95, 2.39, -1.15],
      edge: false,
    })
  }
  addMesh(group, new THREE.BoxGeometry(3.9, 0.03, 0.03), MATERIALS.graphite, {
    position: [-1.0, 2.6, -1.15],
    edge: false,
  })

  /* Reactor column with dome and relief valve. */
  addMesh(group, new THREE.CylinderGeometry(0.34, 0.34, 3.0, 22), MATERIALS.clay, {
    position: [2.0, 1.72, -1.2],
  })
  addMesh(group, new THREE.SphereGeometry(0.34, 22, 14), MATERIALS.brand, {
    position: [2.0, 3.22, -1.2],
  })
  addMesh(group, new THREE.TorusGeometry(0.36, 0.03, 8, 22), MATERIALS.graphite, {
    position: [2.0, 2.5, -1.2],
    rotation: [Math.PI / 2, 0, 0],
  })
  pipe(group, [2.24, 3.28, -1.2], [2.62, 3.62, -1.2], 0.035)

  /* Horizontal storage tanks with saddles. */
  addMesh(group, new THREE.CylinderGeometry(0.5, 0.5, 2.2, 22), MATERIALS.clay, {
    position: [-1.55, 0.74, 1.1],
    rotation: [0, 0, Math.PI / 2],
  })
  addMesh(group, new THREE.CylinderGeometry(0.5, 0.5, 0.06, 22), MATERIALS.brand, {
    position: [-2.65, 0.74, 1.1],
    rotation: [0, 0, Math.PI / 2],
  })
  addMesh(group, new THREE.CylinderGeometry(0.42, 0.42, 1.7, 22), MATERIALS.clay, {
    position: [0.95, 0.66, 1.3],
    rotation: [0, 0, Math.PI / 2],
  })
  ;[-2.35, -0.75].forEach((x) => {
    addMesh(group, new THREE.BoxGeometry(0.16, 0.26, 0.7), MATERIALS.graphite, {
      position: [x, 0.35, 1.1],
    })
  })

  /* Process building with roof units. */
  addMesh(group, new THREE.BoxGeometry(2.1, 1.25, 1.5), MATERIALS.clay, {
    position: [2.45, 0.84, 0.9],
  })
  addMesh(group, new THREE.BoxGeometry(1.5, 0.08, 1.1), MATERIALS.clayShade, {
    position: [2.45, 1.5, 0.9],
  })
  addMesh(group, new THREE.CylinderGeometry(0.16, 0.16, 0.4, 16), MATERIALS.graphite, {
    position: [3.15, 1.74, 1.15],
  })

  /* Pipe runs tying the units together. */
  pipe(group, [-2.35, 1.6, -1.35], [2.0, 1.6, -1.2])
  pipe(group, [2.0, 2.4, -1.2], [2.45, 1.4, 0.9])
  pipe(group, [-1.55, 1.24, 1.1], [0.95, 1.08, 1.3])
  pipe(group, [0.95, 0.9, 1.3], [2.45, 0.9, 1.2], 0.045)

  /* Conveyor and control kiosk. */
  addMesh(group, new THREE.BoxGeometry(2.4, 0.14, 0.36), MATERIALS.graphite, {
    position: [-0.4, 1.0, 2.05],
    rotation: [0, 0, -0.16],
  })
  addMesh(group, new THREE.BoxGeometry(0.55, 0.7, 0.45), MATERIALS.clay, {
    position: [1.55, 0.57, 2.1],
  })

  return group
}

function buildArchitecture() {
  const group = new THREE.Group()

  addMesh(group, new THREE.BoxGeometry(7.2, 0.2, 5.0), MATERIALS.clayShade, { position: [0, 0.1, 0] })

  /* Podium + lawn + road, the base a client reads first. */
  addMesh(group, new THREE.BoxGeometry(5.4, 0.12, 2.6), MATERIALS.clay, { position: [-0.2, 0.26, 1.05] })
  addMesh(group, new THREE.BoxGeometry(6.6, 0.02, 0.5), MATERIALS.graphite, {
    position: [0, 0.22, -1.55],
    edge: false,
  })

  const towers = [
    { x: -1.9, z: -0.35, w: 1.5, d: 1.3, h: 3.2, bands: 7 },
    { x: -0.05, z: 0.15, w: 1.25, d: 1.15, h: 4.3, bands: 9 },
    { x: 1.75, z: -0.45, w: 1.45, d: 1.45, h: 2.5, bands: 5 },
  ]

  towers.forEach((tower, index) => {
    addMesh(group, new THREE.BoxGeometry(tower.w, tower.h, tower.d), MATERIALS.clay, {
      position: [tower.x, 0.2 + tower.h / 2, tower.z],
    })

    /* Floor bands: thin glazing rings, no wireframe to keep edges clean. */
    for (let band = 1; band <= tower.bands; band += 1) {
      const y = 0.2 + (tower.h / (tower.bands + 1)) * band
      addMesh(
        group,
        new THREE.BoxGeometry(tower.w + 0.04, 0.1, tower.d + 0.04),
        index === 1 ? MATERIALS.glass : MATERIALS.brand,
        { position: [tower.x, y, tower.z], edge: false, shadow: false }
      )
    }

    /* Roof parapet reads as a distinct edge at model scale. */
    addMesh(
      group,
      new THREE.BoxGeometry(tower.w + 0.12, 0.07, tower.d + 0.12),
      MATERIALS.graphite,
      { position: [tower.x, 0.2 + tower.h + 0.04, tower.z], edge: false }
    )
  })

  /* Corner tower detail: vertical fin. */
  addMesh(group, new THREE.BoxGeometry(0.06, 3.0, 0.16), MATERIALS.graphite, {
    position: [-1.15, 1.7, 0.3],
    edge: false,
  })

  /* Landscape: planting, benches, plaza lighting. */
  const trees = [
    [-2.6, 1.55, 0.9],
    [-2.05, 1.85, 0.75],
    [1.35, 1.6, 1.0],
    [2.5, 1.4, 0.7],
    [0.6, 1.85, 0.9],
  ]
  trees.forEach(([x, z, size]) => {
    addMesh(group, new THREE.CylinderGeometry(0.045, 0.055, 0.34, 8), MATERIALS.graphite, {
      position: [x, 0.32, z],
      edge: false,
    })
    addMesh(group, new THREE.IcosahedronGeometry(size * 0.42, 0), MATERIALS.brand, {
      position: [x, 0.32 + 0.34 + size * 0.3, z],
      edge: false,
    })
  })

  /* Plaza slab with lamp posts. */
  addMesh(group, new THREE.BoxGeometry(2.2, 0.05, 1.4), MATERIALS.clay, { position: [1.4, 0.33, 1.5], edge: false })
  ;[
    [0.6, 1.5],
    [2.2, 1.5],
  ].forEach(([x, z]) => {
    addMesh(group, new THREE.CylinderGeometry(0.022, 0.022, 0.7, 6), MATERIALS.graphite, {
      position: [x, 0.7, z],
      edge: false,
    })
    addMesh(group, new THREE.SphereGeometry(0.05, 10, 8), MATERIALS.brand, {
      position: [x, 1.06, z],
      edge: false,
      shadow: false,
    })
  })

  return group
}

/* A gear profile, extruded — used in the prototype assembly. */
function gearGeometry(teeth, rootRadius, tipRadius, thickness, boreRadius) {
  const shape = new THREE.Shape()
  const step = (Math.PI * 2) / teeth

  for (let i = 0; i < teeth; i += 1) {
    const angle = i * step
    const points = [
      [rootRadius, angle - step * 0.25],
      [rootRadius, angle - step * 0.1],
      [tipRadius, angle - step * 0.06],
      [tipRadius, angle + step * 0.06],
      [rootRadius, angle + step * 0.1],
      [rootRadius, angle + step * 0.25],
    ]
    points.forEach(([radius, a], index) => {
      const x = Math.cos(a) * radius
      const y = Math.sin(a) * radius
      if (i === 0 && index === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
  }
  shape.closePath()

  const bore = new THREE.Path()
  bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, true)
  shape.holes.push(bore)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 6,
  })
  geometry.translate(0, 0, -thickness / 2)
  return geometry
}

function buildPrototype() {
  const group = new THREE.Group()
  const animated = []

  addMesh(group, new THREE.BoxGeometry(4.4, 0.18, 3.0), MATERIALS.clayShade, { position: [0, 0.09, 0] })

  /* Open housing: base, four posts, top plate — so the mechanism stays visible. */
  const postX = [-1.65, 1.65]
  const postZ = [-1.05, 1.05]
  postX.forEach((x) => {
    postZ.forEach((z) => {
      addMesh(group, new THREE.CylinderGeometry(0.075, 0.075, 2.0, 12), MATERIALS.graphite, {
        position: [x, 1.18, z],
      })
    })
  })
  addMesh(group, new THREE.BoxGeometry(3.8, 0.14, 2.5), MATERIALS.clay, { position: [0, 2.24, 0] })
  addMesh(group, new THREE.BoxGeometry(0.9, 0.22, 0.7), MATERIALS.graphite, { position: [0.9, 2.42, 0.4] })

  /* Gear train: large drive gear meshing with a smaller output gear. */
  const bigGear = new THREE.Mesh(gearGeometry(22, 0.72, 0.86, 0.22, 0.12), MATERIALS.brand)
  bigGear.position.set(-0.55, 1.2, 0)
  bigGear.castShadow = true
  bigGear.add(new THREE.LineSegments(new THREE.EdgesGeometry(bigGear.geometry, 26), EDGE))
  group.add(bigGear)

  const smallGear = new THREE.Mesh(gearGeometry(14, 0.44, 0.56, 0.22, 0.1), MATERIALS.clay)
  smallGear.position.set(0.86, 1.2, 0)
  smallGear.castShadow = true
  smallGear.add(new THREE.LineSegments(new THREE.EdgesGeometry(smallGear.geometry, 26), EDGE))
  group.add(smallGear)

  animated.push((delta) => {
    bigGear.rotation.z -= delta * 0.35
    smallGear.rotation.z += delta * 0.35 * (22 / 14)
  })

  /* Shafts and bearing blocks. */
  ;[
    [-0.55, 0.12],
    [0.86, 0.1],
  ].forEach(([x, radius]) => {
    addMesh(group, new THREE.CylinderGeometry(radius, radius, 1.9, 14), MATERIALS.graphite, {
      position: [x, 1.2, 0],
      rotation: [Math.PI / 2, 0, 0],
      edge: false,
    })
    ;[-0.72, 0.72].forEach((z) => {
      addMesh(group, new THREE.BoxGeometry(0.5, 0.5, 0.16), MATERIALS.clayShade, {
        position: [x, 1.2, z],
        edge: false,
      })
    })
  })

  /* Motor block with cooling fins. */
  addMesh(group, new THREE.CylinderGeometry(0.34, 0.34, 1.1, 20), MATERIALS.clay, {
    position: [-1.95, 1.2, 0],
    rotation: [Math.PI / 2, 0, 0],
  })
  for (let fin = 0; fin < 6; fin += 1) {
    addMesh(group, new THREE.TorusGeometry(0.36, 0.018, 6, 22), MATERIALS.graphite, {
      position: [-1.95, 1.2, -0.42 + fin * 0.17],
      edge: false,
      shadow: false,
    })
  }
  pipe(group, [-0.55, 1.2, -0.72], [-1.6, 1.2, -0.4], 0.05)

  /* Printed cover panel leaning against the frame. */
  addMesh(group, new THREE.BoxGeometry(1.15, 0.9, 0.05), MATERIALS.clay, {
    position: [1.25, 0.62, 1.05],
    rotation: [0, 0.34, -0.18],
  })

  return { group, animated }
}

const MODELS = {
  plant: {
    label: "process plant",
    build: () => ({ group: buildPlant(), animated: [] }),
    target: [0, 1.62, 0],
    distance: 12.9,
    yaw: 0.42,
    pitch: 0.2,
    caption: "Process plant · silos, reactor, tanks and pipe runs modelled from your drawings.",
    description:
      "Interactive 3D model of an industrial process plant with silo cluster, reactor column, storage tanks and interconnecting pipework.",
  },
  architecture: {
    label: "architecture",
    build: () => ({ group: buildArchitecture(), animated: [] }),
    target: [0, 2.2, 0],
    distance: 13.8,
    yaw: 0.5,
    pitch: 0.22,
    caption: "Architecture · massing, floor bands and landscape at presentation scale.",
    description:
      "Interactive 3D model of an architectural housing scheme with three towers, floor banding, landscaping and a paved plaza.",
  },
  prototype: {
    label: "prototype",
    build: () => buildPrototype(),
    target: [0, 1.22, 0],
    distance: 7.4,
    yaw: 0.55,
    pitch: 0.16,
    caption: "Prototype · meshing parts checked for fit before anything is printed.",
    description:
      "Interactive 3D model of a gear train prototype: a large drive gear meshing with an output gear inside an open frame.",
  },
}

/* ----------------------------------------------------------------- viewer */

function init() {
  const host = document.getElementById("plant-3d")
  if (!host) return

  const stage = host.closest(".scene-stage")
  const status = stage ? stage.querySelector("[data-scene-status]") : null
  const caption = document.querySelector("[data-scene-caption]")
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    })
  } catch {
    showFallback()
    return
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.02
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.setAttribute("aria-hidden", "true")
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(36, 4 / 3, 0.1, 200)
  const currentTarget = new THREE.Vector3(...MODELS.plant.target)

  /* Studio light: white key, soft sky fill, cyan rim from behind-left. */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe8ee, 2.1))

  const key = new THREE.DirectionalLight(0xffffff, 2.6)
  key.position.set(6, 10, 7)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = -9
  key.shadow.camera.right = 9
  key.shadow.camera.top = 9
  key.shadow.camera.bottom = -9
  key.shadow.camera.near = 1
  key.shadow.camera.far = 34
  key.shadow.bias = -0.0012
  key.shadow.normalBias = 0.02
  scene.add(key)

  const rim = new THREE.DirectionalLight(BRAND, 2.0)
  rim.position.set(-8, 4, -6)
  scene.add(rim)

  const fill = new THREE.DirectionalLight(0xffffff, 0.9)
  fill.position.set(-6, 2, 7)
  scene.add(fill)

  /* Contact shadow catcher, matches the CSS studio floor. taste-skill-ignore: WebGL ground shadow */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ color: 0x2b3a44, opacity: 0.16 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const grid = new THREE.GridHelper(24, 24, 0xcfdde4, 0xe4eaee)
  grid.position.y = 0.002
  grid.material.transparent = true
  grid.material.opacity = 0.9
  scene.add(grid)

  /* Model container: one visible model at a time. */
  const holder = new THREE.Group()
  scene.add(holder)

  let current = null
  let currentKey = "plant"
  let animated = []

  function clearHolder() {
    while (holder.children.length) {
      const child = holder.children[0]
      holder.remove(child)
      child.traverse((node) => {
        if (node.geometry) node.geometry.dispose()
      })
    }
  }

  function loadModel(name) {
    const definition = MODELS[name]
    if (!definition) return

    clearHolder()
    const built = definition.build()
    holder.add(built.group)
    animated = built.animated || []
    current = definition
    currentKey = name

    currentTarget.set(...definition.target)
    spherical.yaw = definition.yaw
    spherical.pitch = definition.pitch
    spherical.radius = definition.distance
    zoom = 1
    zoomTarget = 1
    velocity.yaw = 0
    velocity.pitch = 0

    host.setAttribute("aria-label", definition.description + " Drag, or use the arrow keys, to rotate.")
    if (caption) caption.textContent = definition.caption

    document.querySelectorAll('input[name="scene-model"]').forEach((input) => {
      input.checked = input.value === name
    })

    updateCamera()
    renderer.render(scene, camera)
  }

  /* --- camera state --- */
  const spherical = { yaw: MODELS.plant.yaw, pitch: MODELS.plant.pitch, radius: MODELS.plant.distance }
  const velocity = { yaw: 0, pitch: 0 }
  let zoom = 1
  let zoomTarget = 1
  let dragging = false
  let moved = false
  let lastX = 0
  let lastY = 0
  let idle = 0

  function updateCamera() {
    /* Narrow viewports need the camera further back so the model never clips. */
    const framing = Math.min(1.5, Math.max(1, 4 / 3 / camera.aspect))
    const radius = spherical.radius * zoom * framing
    const cosPitch = Math.cos(spherical.pitch)
    camera.position.set(
      currentTarget.x + Math.sin(spherical.yaw) * cosPitch * radius,
      currentTarget.y + Math.sin(spherical.pitch) * radius,
      currentTarget.z + Math.cos(spherical.yaw) * cosPitch * radius
    )
    camera.lookAt(currentTarget)
  }

  /* --- pointer interaction: drag orbits, vertical scroll stays native --- */
  const surface = renderer.domElement
  surface.style.touchAction = "pan-y"
  surface.style.cursor = "grab"

  surface.addEventListener("pointerdown", (event) => {
    dragging = true
    moved = false
    lastX = event.clientX
    lastY = event.clientY
    idle = 0
    surface.style.cursor = "grabbing"
    surface.setPointerCapture?.(event.pointerId)
  })

  surface.addEventListener("pointermove", (event) => {
    if (!dragging) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
    spherical.yaw -= dx * 0.0062
    spherical.pitch = Math.max(0.02, Math.min(0.85, spherical.pitch + dy * 0.0042))
    velocity.yaw = -dx * 0.0018
    velocity.pitch = dy * 0.0011
    lastX = event.clientX
    lastY = event.clientY
  })

  const endDrag = () => {
    dragging = false
    surface.style.cursor = "grab"
  }
  surface.addEventListener("pointerup", endDrag)
  surface.addEventListener("pointercancel", endDrag)
  surface.addEventListener("pointerleave", endDrag)

  surface.addEventListener("dblclick", () => resetView())

  /* Keyboard orbit for visitors who cannot drag. */
  host.addEventListener("keydown", (event) => {
    const step = 0.16
    let handled = true
    switch (event.key) {
      case "ArrowLeft":
        spherical.yaw += step
        break
      case "ArrowRight":
        spherical.yaw -= step
        break
      case "ArrowUp":
        spherical.pitch = Math.min(0.85, spherical.pitch + 0.06)
        break
      case "ArrowDown":
        spherical.pitch = Math.max(0.02, spherical.pitch - 0.06)
        break
      case "+":
      case "=":
        zoomTarget = Math.min(1.4, zoomTarget + 0.08)
        break
      case "-":
      case "_":
        zoomTarget = Math.max(0.72, zoomTarget - 0.08)
        break
      case "Home":
        resetView()
        return
      default:
        handled = false
    }
    if (handled) {
      event.preventDefault()
      idle = 0
    }
  })

  function resetView() {
    const definition = MODELS[currentKey]
    spherical.yaw = definition.yaw
    spherical.pitch = definition.pitch
    zoomTarget = 1
    velocity.yaw = 0
    velocity.pitch = 0
  }

  /* --- UI controls --- */
  document.querySelectorAll('input[name="scene-model"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) loadModel(input.value)
    })
  })

  document.querySelectorAll("[data-scene-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.getAttribute("data-scene-zoom") === "in" ? 1 : -1
      zoomTarget = Math.max(0.72, Math.min(1.4, zoomTarget + direction * 0.1))
      idle = 0
    })
  })

  const resetButton = document.querySelector("[data-scene-reset]")
  if (resetButton) resetButton.addEventListener("click", resetView)

  /* --- sizing --- */
  function resize() {
    const width = host.clientWidth
    const height = host.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
  }
  resize()
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)

  /* --- loop with visibility gating --- */
  const clock = new THREE.Clock()
  let frame = 0
  let onScreen = false

  function tick() {
    frame = requestAnimationFrame(tick)
    if (!onScreen || document.hidden) return

    const delta = Math.min(clock.getDelta(), 0.05)

    if (!dragging) {
      idle += delta
      const settle = Math.pow(0.86, delta * 60)
      velocity.yaw *= settle
      velocity.pitch *= settle
      spherical.yaw += velocity.yaw
      spherical.pitch = Math.max(0.02, Math.min(0.85, spherical.pitch + velocity.pitch))
      if (!reduced && idle > 1.6) spherical.yaw += delta * 0.12
    }

    zoom += (zoomTarget - zoom) * Math.min(1, delta * 6)
    animated.forEach((update) => update(delta))
    updateCamera()
    renderer.render(scene, camera)
  }

  const intersection = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        onScreen = entry.isIntersecting
        if (onScreen) clock.start()
      })
    },
    { threshold: 0.02 }
  )
  intersection.observe(host)

  loadModel("plant")
  tick()

  if (status) status.remove()
  if (stage) stage.classList.add("is-ready")

  /* Small public handle: used by the site's own QA scripts. */
  window.__gs3d = {
    setModel: (name) => loadModel(name),
    reset: resetView,
    state: () => ({
      model: currentKey,
      yaw: spherical.yaw,
      pitch: spherical.pitch,
      zoom,
      ready: true,
      animated: animated.length,
      label: current ? current.label : null,
    }),
    /* Geometry and framing report, used by the site's QA checks. */
    stats: () => {
      if (!holder.children.length) return null
      const box = new THREE.Box3().setFromObject(holder)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      let meshes = 0
      holder.traverse((node) => {
        if (node.isMesh) meshes += 1
      })
      const points = []
      for (let i = 0; i < 8; i += 1) {
        points.push(
          new THREE.Vector3(
            i & 1 ? box.max.x : box.min.x,
            i & 2 ? box.max.y : box.min.y,
            i & 4 ? box.max.z : box.min.z
          )
        )
      }
      const ndc = points.map((point) => point.clone().project(camera))
      const xs = ndc.map((p) => p.x)
      const ys = ndc.map((p) => p.y)
      return {
        meshes,
        size: size.toArray().map((n) => +n.toFixed(2)),
        center: center.toArray().map((n) => +n.toFixed(2)),
        coverage: [
          +((Math.max(...xs) - Math.min(...xs)) / 2).toFixed(2),
          +((Math.max(...ys) - Math.min(...ys)) / 2).toFixed(2),
        ],
        onScreen: onScreen && !document.hidden,
        aspect: +camera.aspect.toFixed(3),
        distance: +camera.position.distanceTo(currentTarget).toFixed(2),
      }
    },
  }

  document.dispatchEvent(new CustomEvent("gs3d:ready"))

  function showFallback() {
    if (status) status.remove()
    host.innerHTML =
      '<p class="scene-fallback">This device could not start WebGL. ' +
      '<a href="#work">See the finished models in the gallery</a> instead.</p>'
  }
}

/* ------------------------------------------------------------ bootstrap */

function boot() {
  const host = document.getElementById("plant-3d")
  if (!host) return

  /* Build the scene only when the viewer is close to the viewport: keeps the
     hero fast and avoids paying for WebGL on visitors who never scroll. */
  if (!("IntersectionObserver" in window)) {
    init()
    return
  }

  const trigger = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        trigger.disconnect()
        init()
      })
    },
    { rootMargin: "600px 0px" }
  )

  trigger.observe(host)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot)
} else {
  boot()
}
