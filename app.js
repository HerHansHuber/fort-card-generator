export const ROD_LENGTH = 1;
export const ROD_TOLERANCE = 0.08;
export const MAX_SOCKET_DEGREE = 8;

export function createEmptyDesign() {
  return { nodes: [], sticks: [], nextNodeId: 1, nextStickId: 1 };
}

export function roundToGrid(value, step = 0.5) {
  return Math.round(value / step) * step;
}

function roundCoord(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

export function keyForPosition(position) {
  return [position.x, position.y, position.z].map((value) => roundCoord(value).toFixed(3)).join(',');
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function isOneRodLength(a, b, tolerance = ROD_TOLERANCE) {
  return Math.abs(distance(a, b) - ROD_LENGTH) <= tolerance;
}

export function addNode(design, position) {
  const normalized = {
    x: roundCoord(position.x),
    y: Math.max(0, roundCoord(position.y)),
    z: roundCoord(position.z)
  };
  const existing = design.nodes.find((node) => keyForPosition(node.position) === keyForPosition(normalized));
  if (existing) return existing;
  const node = { id: design.nextNodeId++, position: normalized };
  design.nodes.push(node);
  return node;
}

export function moveNode(design, nodeId, position) {
  const node = design.nodes.find((item) => item.id === nodeId);
  if (!node) return null;
  const snapped = {
    x: roundToGrid(position.x),
    y: Math.max(0, roundToGrid(position.y)),
    z: roundToGrid(position.z)
  };
  const occupied = design.nodes.find((item) => item.id !== nodeId && keyForPosition(item.position) === keyForPosition(snapped));
  if (occupied) return occupied;
  node.position = snapped;
  return node;
}

export function removeNode(design, nodeId) {
  design.nodes = design.nodes.filter((node) => node.id !== nodeId);
  design.sticks = design.sticks.filter((stick) => stick.a !== nodeId && stick.b !== nodeId);
}

export function addStick(design, a, b, { strict = true } = {}) {
  if (a === b) return { ok: false, reason: 'Pick two different balls.' };
  const nodeA = design.nodes.find((node) => node.id === a);
  const nodeB = design.nodes.find((node) => node.id === b);
  if (!nodeA || !nodeB) return { ok: false, reason: 'Missing ball.' };
  const exists = design.sticks.find((stick) => (stick.a === a && stick.b === b) || (stick.a === b && stick.b === a));
  if (exists) return { ok: false, reason: 'These balls are already connected.' };
  const length = distance(nodeA.position, nodeB.position);
  const oneRod = Math.abs(length - ROD_LENGTH) <= ROD_TOLERANCE;
  if (strict && !oneRod) {
    return { ok: false, reason: `Off-length: ${length.toFixed(2)} rods. Move balls one rod apart or disable strict mode.` };
  }
  const stick = { id: design.nextStickId++, a, b, length: Number(length.toFixed(3)), valid: oneRod };
  design.sticks.push(stick);
  return { ok: true, stick };
}

export function removeStick(design, stickId) {
  design.sticks = design.sticks.filter((stick) => stick.id !== stickId);
}

export function getNodeDegree(design, nodeId) {
  return design.sticks.filter((stick) => stick.a === nodeId || stick.b === nodeId).length;
}

export function calculateParts(design, inventory = {}) {
  const balls = design.nodes.length;
  const sticks = design.sticks.length;
  const invalidSticks = design.sticks.filter((stick) => !stick.valid).length;
  const overloadedBalls = design.nodes.filter((node) => getNodeDegree(design, node.id) > MAX_SOCKET_DEGREE).length;
  const openEnds = design.nodes.reduce((sum, node) => sum + Math.max(0, MAX_SOCKET_DEGREE - getNodeDegree(design, node.id)), 0);
  const ownedBalls = Number(inventory.balls ?? 0);
  const ownedSticks = Number(inventory.sticks ?? 0);
  return {
    balls,
    sticks,
    invalidSticks,
    overloadedBalls,
    openEnds,
    ballShortage: Math.max(0, balls - ownedBalls),
    stickShortage: Math.max(0, sticks - ownedSticks),
    withinInventory: balls <= ownedBalls && sticks <= ownedSticks && invalidSticks === 0
  };
}

export function serializeDesign(design) {
  return JSON.stringify({ version: 1, nodes: design.nodes, sticks: design.sticks }, null, 2);
}

export function deserializeDesign(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  const design = createEmptyDesign();
  design.nodes = (parsed.nodes || []).map((node) => ({ id: Number(node.id), position: { ...node.position } }));
  design.sticks = (parsed.sticks || []).map((stick) => ({
    id: Number(stick.id),
    a: Number(stick.a),
    b: Number(stick.b),
    length: Number(stick.length),
    valid: Boolean(stick.valid)
  }));
  design.nextNodeId = Math.max(0, ...design.nodes.map((node) => node.id)) + 1;
  design.nextStickId = Math.max(0, ...design.sticks.map((stick) => stick.id)) + 1;
  return design;
}

function addEdge(design, a, b) {
  addStick(design, a.id, b.id, { strict: true });
}

export function addCubeBay(design, origin = { x: 0, y: 0, z: 0 }) {
  const o = origin;
  const n = [];
  for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) {
    n.push(addNode(design, { x: o.x + x, y: o.y + y, z: o.z + z }));
  }
  const at = (x, y, z) => design.nodes.find((node) => keyForPosition(node.position) === keyForPosition({ x: o.x + x, y: o.y + y, z: o.z + z }));
  for (const y of [0, 1]) {
    addEdge(design, at(0, y, 0), at(1, y, 0));
    addEdge(design, at(0, y, 1), at(1, y, 1));
    addEdge(design, at(0, y, 0), at(0, y, 1));
    addEdge(design, at(1, y, 0), at(1, y, 1));
  }
  for (const x of [0, 1]) for (const z of [0, 1]) addEdge(design, at(x, 0, z), at(x, 1, z));
  return n;
}

export function addTunnel(design, origin = { x: 0, y: 0, z: 0 }, bays = 3) {
  for (let i = 0; i < bays; i += 1) addCubeBay(design, { x: origin.x + i, y: origin.y, z: origin.z });
}

export function addPitchedRoofBay(design, origin = { x: 0, y: 1, z: 0 }) {
  const o = origin;
  // Equilateral roof sides: each sloping roof rod is one rod long.
  const peakY = o.y + Math.sqrt(3) / 2;
  const eaves = [
    addNode(design, { x: o.x, y: o.y, z: o.z }),
    addNode(design, { x: o.x + 1, y: o.y, z: o.z }),
    addNode(design, { x: o.x, y: o.y, z: o.z + 1 }),
    addNode(design, { x: o.x + 1, y: o.y, z: o.z + 1 })
  ];
  const peaks = [
    addNode(design, { x: o.x + 0.5, y: peakY, z: o.z }),
    addNode(design, { x: o.x + 0.5, y: peakY, z: o.z + 1 })
  ];
  addEdge(design, eaves[0], eaves[1]);
  addEdge(design, eaves[2], eaves[3]);
  addEdge(design, eaves[0], peaks[0]);
  addEdge(design, eaves[1], peaks[0]);
  addEdge(design, eaves[2], peaks[1]);
  addEdge(design, eaves[3], peaks[1]);
  addEdge(design, peaks[0], peaks[1]);
  addEdge(design, eaves[0], eaves[2]);
  addEdge(design, eaves[1], eaves[3]);
}

function encodeForUrl(design) {
  return btoa(unescape(encodeURIComponent(serializeDesign(design))));
}

function decodeFromUrl(value) {
  return deserializeDesign(decodeURIComponent(escape(atob(value))));
}

async function setupBrowserApp() {
  const THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
  const { OrbitControls } = await import('https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js');

  let design = createEmptyDesign();
  let mode = 'add';
  let selected = [];
  let meshes = new Map();
  let stickMeshes = new Map();

  const canvas = document.querySelector('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x08111f, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x08111f, 12, 30);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(5, 4, 6);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(1, 0.8, 1);
  controls.enableDamping = true;

  const group = new THREE.Group();
  scene.add(group);

  const ambient = new THREE.HemisphereLight(0xffffff, 0x223344, 2.2);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  const grid = new THREE.GridHelper(12, 24, 0x46627f, 0x1f344d);
  grid.position.set(0, -0.01, 0);
  scene.add(grid);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ghost = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0x52d1ff, transparent: true, opacity: 0.45 })
  );
  scene.add(ghost);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ballGeometry = new THREE.SphereGeometry(0.105, 32, 20);
  const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.02 });
  const selectedBallMaterial = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x5a3b00, roughness: 0.35 });
  const stickMaterial = new THREE.MeshStandardMaterial({ color: 0x52d1ff, roughness: 0.42 });
  const badStickMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.42 });

  function setMessage(text) { document.querySelector('#message').textContent = text; }

  function nodeById(id) { return design.nodes.find((node) => node.id === id); }

  function stickCylinderBetween(a, b, valid) {
    const start = new THREE.Vector3(a.x, a.y, a.z);
    const end = new THREE.Vector3(b.x, b.y, b.z);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const length = start.distanceTo(end);
    const geometry = new THREE.CylinderGeometry(0.035, 0.035, length, 18);
    const mesh = new THREE.Mesh(geometry, valid ? stickMaterial : badStickMaterial);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    return mesh;
  }

  function refreshScene() {
    for (const mesh of meshes.values()) group.remove(mesh);
    for (const mesh of stickMeshes.values()) group.remove(mesh);
    meshes = new Map();
    stickMeshes = new Map();

    for (const stick of design.sticks) {
      const a = nodeById(stick.a);
      const b = nodeById(stick.b);
      if (!a || !b) continue;
      stick.length = Number(distance(a.position, b.position).toFixed(3));
      stick.valid = isOneRodLength(a.position, b.position);
      const mesh = stickCylinderBetween(a.position, b.position, stick.valid);
      mesh.userData = { type: 'stick', id: stick.id };
      group.add(mesh);
      stickMeshes.set(stick.id, mesh);
    }

    for (const node of design.nodes) {
      const mesh = new THREE.Mesh(ballGeometry, selected.includes(node.id) ? selectedBallMaterial : ballMaterial);
      mesh.position.set(node.position.x, node.position.y, node.position.z);
      mesh.userData = { type: 'node', id: node.id };
      group.add(mesh);
      meshes.set(node.id, mesh);
    }
    updatePanel();
  }

  function updatePanel() {
    const inventory = {
      balls: Number(document.querySelector('#owned-balls').value || 0),
      sticks: Number(document.querySelector('#owned-sticks').value || 0)
    };
    const parts = calculateParts(design, inventory);
    document.querySelector('#balls-used').textContent = parts.balls;
    document.querySelector('#sticks-used').textContent = parts.sticks;
    document.querySelector('#open-ends').textContent = parts.openEnds;
    document.querySelector('#invalid-sticks').textContent = parts.invalidSticks;
    const status = document.querySelector('#inventory-status');
    status.className = 'status';
    if (parts.ballShortage || parts.stickShortage) {
      status.classList.add('bad');
      status.textContent = `Short by ${parts.ballShortage} balls and ${parts.stickShortage} sticks.`;
    } else if (parts.invalidSticks || parts.overloadedBalls) {
      status.classList.add('warn');
      status.textContent = `${parts.invalidSticks} off-length sticks; ${parts.overloadedBalls} balls over ${MAX_SOCKET_DEGREE} sockets.`;
    } else {
      status.classList.add('good');
      status.textContent = 'Within entered inventory.';
    }
    document.querySelector('#parts-list').value = [
      `Balls/connectors: ${parts.balls}`,
      `Sticks/rods: ${parts.sticks}`,
      `Off-length sticks: ${parts.invalidSticks}`,
      `Open connector sockets estimate: ${parts.openEnds}`,
      `Owned inventory: ${inventory.balls} balls, ${inventory.sticks} sticks`,
      '',
      'Tip: keep strict mode on for same-length rod kits. Red sticks mean the distance is not one rod length.'
    ].join('\n');
    document.querySelector('#selection-label').textContent = selected.length ? `Selected ball${selected.length > 1 ? 's' : ''}: ${selected.join(', ')}` : 'No selection';
  }

  function pointerToNdc(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function getGridPoint(event) {
    pointerToNdc(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(floor)[0];
    if (!hit) return null;
    const y = Number(document.querySelector('#height').value);
    return { x: roundToGrid(hit.point.x), y, z: roundToGrid(hit.point.z) };
  }

  function getHitObject(event) {
    pointerToNdc(event);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects([...meshes.values(), ...stickMeshes.values()], false)[0]?.object || null;
  }

  function selectNode(id) {
    if (mode === 'connect') {
      if (!selected.includes(id)) selected.push(id);
      if (selected.length === 2) {
        const strict = document.querySelector('#strict-rods').checked;
        const result = addStick(design, selected[0], selected[1], { strict });
        setMessage(result.ok ? 'Stick added.' : result.reason);
        selected = [];
      }
    } else {
      selected = [id];
    }
    refreshScene();
  }

  canvas.addEventListener('pointermove', (event) => {
    const point = getGridPoint(event);
    if (point) ghost.position.set(point.x, point.y, point.z);
  });

  canvas.addEventListener('pointerdown', (event) => {
    const hit = getHitObject(event);
    if (hit?.userData.type === 'node') {
      const id = hit.userData.id;
      if (mode === 'delete') {
        removeNode(design, id);
        selected = [];
        setMessage('Ball and attached sticks deleted.');
        refreshScene();
      } else {
        selectNode(id);
      }
      return;
    }
    if (hit?.userData.type === 'stick' && mode === 'delete') {
      removeStick(design, hit.userData.id);
      setMessage('Stick deleted.');
      refreshScene();
      return;
    }
    const point = getGridPoint(event);
    if (!point) return;
    if (mode === 'add') {
      const node = addNode(design, point);
      selected = [node.id];
      setMessage(`Ball ${node.id} placed at ${point.x}, ${point.y}, ${point.z}.`);
      refreshScene();
    } else if (mode === 'move' && selected.length === 1) {
      const moved = moveNode(design, selected[0], point);
      setMessage(moved?.id === selected[0] ? 'Ball moved; connected stick lengths recalculated.' : 'That spot already has a ball.');
      refreshScene();
    }
  });

  function setMode(nextMode) {
    mode = nextMode;
    selected = [];
    document.querySelectorAll('.tool').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    const help = {
      add: 'Add mode: click the grid to place connector balls. Use height for upper levels.',
      connect: 'Connect mode: click two balls. Strict mode only accepts one-rod distances.',
      move: 'Move mode: select a ball, then click a new grid position at the chosen height.',
      delete: 'Delete mode: click a ball or stick to remove it.'
    };
    document.querySelector('#mode-help').textContent = help[mode];
    refreshScene();
  }

  document.querySelectorAll('.tool').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelector('#height').addEventListener('input', (event) => {
    document.querySelector('#height-label').textContent = event.target.value;
  });
  document.querySelectorAll('#owned-balls, #owned-sticks, #strict-rods').forEach((input) => input.addEventListener('input', updatePanel));

  function findOpenOrigin() {
    if (!design.nodes.length) return { x: 0, y: 0, z: 0 };
    const maxX = Math.max(...design.nodes.map((node) => node.position.x));
    return { x: Math.ceil(maxX) + 1, y: 0, z: 0 };
  }

  document.querySelectorAll('[data-template]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.template;
    if (action === 'reset') {
      design = createEmptyDesign();
      selected = [];
      setMessage('Design cleared.');
    } else if (action === 'cube') {
      addCubeBay(design, findOpenOrigin());
      setMessage('Cube bay added: 8 balls, up to 12 sticks if not sharing parts.');
    } else if (action === 'tunnel') {
      addTunnel(design, findOpenOrigin(), 3);
      setMessage('Three-bay tunnel added with shared balls/sticks between bays.');
    } else if (action === 'roof') {
      addPitchedRoofBay(design, { ...findOpenOrigin(), y: 1 });
      setMessage('Pitched roof bay added using one-rod sloped sides.');
    }
    refreshScene();
  }));

  document.querySelector('#copy-link').addEventListener('click', async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('design', encodeForUrl(design));
    await navigator.clipboard.writeText(url.toString());
    setMessage('Design link copied.');
  });

  document.querySelector('#download-json').addEventListener('click', () => {
    const blob = new Blob([serializeDesign(design)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'fort-kit-design.json';
    link.click();
    URL.revokeObjectURL(link.href);
  });

  document.querySelector('#load-json').addEventListener('click', () => document.querySelector('#file-input').click());
  document.querySelector('#file-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    design = deserializeDesign(await file.text());
    selected = [];
    setMessage('JSON design loaded.');
    refreshScene();
  });

  document.querySelector('#fit-view').addEventListener('click', () => {
    camera.position.set(5, 4, 6);
    controls.target.set(1, 0.8, 1);
    controls.update();
  });

  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('design')) design = decodeFromUrl(params.get('design'));
    else addCubeBay(design, { x: 0, y: 0, z: 0 });
  } catch (error) {
    setMessage(`Could not load shared design: ${error.message}`);
    addCubeBay(design, { x: 0, y: 0, z: 0 });
  }

  resize();
  refreshScene();
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

if (typeof document !== 'undefined') setupBrowserApp();
