export let ROD_LENGTH = 1;
export const ROD_TOLERANCE = 0.08;
export const SOCKET_ANGLE_TOLERANCE_DEG = 8;
export const MAX_SOCKET_DEGREE = 18;

const DEG = Math.PI / 180;

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

const AXIS_SOCKET_DEFS = [
  ['X+', '+X straight', { x: 1, y: 0, z: 0 }],
  ['X-', '-X straight', { x: -1, y: 0, z: 0 }],
  ['Y+', '+Y straight', { x: 0, y: 1, z: 0 }],
  ['Y-', '-Y straight', { x: 0, y: -1, z: 0 }],
  ['Z+', '+Z straight', { x: 0, y: 0, z: 1 }],
  ['Z-', '-Z straight', { x: 0, y: 0, z: -1 }]
];

const FACE_DIAGONAL_SOCKET_DEFS = [
  ...[-1, 1].flatMap((x) => [-1, 1].map((y) => [`XY${x > 0 ? '+' : '-'}${y > 0 ? '+' : '-'}`, `45° XY ${x > 0 ? '+' : '-'}X/${y > 0 ? '+' : '-'}Y`, { x, y, z: 0 }])),
  ...[-1, 1].flatMap((x) => [-1, 1].map((z) => [`XZ${x > 0 ? '+' : '-'}${z > 0 ? '+' : '-'}`, `45° XZ ${x > 0 ? '+' : '-'}X/${z > 0 ? '+' : '-'}Z`, { x, y: 0, z }])),
  ...[-1, 1].flatMap((y) => [-1, 1].map((z) => [`YZ${y > 0 ? '+' : '-'}${z > 0 ? '+' : '-'}`, `45° YZ ${y > 0 ? '+' : '-'}Y/${z > 0 ? '+' : '-'}Z`, { x: 0, y, z }])),
];

// 18-hole connector model from the Thingiverse/Discovery-style coupling ball geometry.
// The visible printed connector is a rhombicuboctahedron-like solid: 18 square faces with holes
// and 8 small triangular facets. Normals of those 18 square faces are:
//   6 straight axis sockets + 12 45° face-diagonal sockets.
// This permits many angled triangles/braces while every rod remains exactly one fixed length.
export const SOCKET_DIRECTIONS = [...AXIS_SOCKET_DEFS, ...FACE_DIAGONAL_SOCKET_DEFS].map(([id, label, vector]) => ({
  id,
  label,
  vector: normalize(vector)
}));

export function createEmptyDesign() {
  return { nodes: [], sticks: [], nextNodeId: 1, nextStickId: 1, rodLength: ROD_LENGTH };
}

export const UNDO_LIMIT = 50;

export function createUndoHistory() {
  return [];
}

export function pushUndoSnapshot(history, design, selected = [], limit = UNDO_LIMIT) {
  history.push({ design: serializeDesign(design), selected: [...selected] });
  if (history.length > limit) history.splice(0, history.length - limit);
  return history;
}

export function restoreUndoSnapshot(history) {
  const snapshot = history.pop();
  if (!snapshot) return { ok: false, reason: 'Nothing to undo.' };
  const design = deserializeDesign(snapshot.design);
  const nodeIds = new Set(design.nodes.map((node) => node.id));
  return {
    ok: true,
    design,
    selected: snapshot.selected.filter((id) => nodeIds.has(id))
  };
}

export function setRodLength(length) {
  const next = Number(length);
  ROD_LENGTH = Number.isFinite(next) ? Math.max(0.1, next) : 1;
  return ROD_LENGTH;
}

export function rodTolerance() {
  return Math.max(0.02, ROD_LENGTH * ROD_TOLERANCE);
}

export function roundToGrid(value, step = 0.5) {
  return Math.round(value / step) * step;
}

function roundCoord(value) {
  return Math.round(Number(value) * 1000000) / 1000000;
}

function normalizePosition(position) {
  return { x: roundCoord(position.x), y: Math.max(0, roundCoord(position.y)), z: roundCoord(position.z) };
}

export function keyForPosition(position) {
  return [position.x, position.y, position.z].map((value) => roundCoord(value).toFixed(3)).join(',');
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function vectorBetween(a, b) {
  const length = distance(a, b) || 1;
  return { x: (b.x - a.x) / length, y: (b.y - a.y) / length, z: (b.z - a.z) / length };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function angleDeg(a, b) {
  return Math.acos(Math.min(1, Math.max(-1, dot(normalize(a), normalize(b))))) / DEG;
}

export function nearestSocketDirection(vector) {
  const normal = normalize(vector);
  let best = SOCKET_DIRECTIONS[0];
  let bestAngle = Infinity;
  for (const socket of SOCKET_DIRECTIONS) {
    const angle = angleDeg(normal, socket.vector);
    if (angle < bestAngle) {
      best = socket;
      bestAngle = angle;
    }
  }
  return { ...best, angle: bestAngle };
}

export function isOneRodLength(a, b, tolerance = rodTolerance()) {
  return Math.abs(distance(a, b) - ROD_LENGTH) <= tolerance;
}

export function connectionAnalysis(a, b) {
  const length = distance(a, b);
  const forward = nearestSocketDirection(vectorBetween(a, b));
  const backward = nearestSocketDirection(vectorBetween(b, a));
  return {
    length,
    lengthOk: Math.abs(length - ROD_LENGTH) <= rodTolerance(),
    socketOk: forward.angle <= SOCKET_ANGLE_TOLERANCE_DEG && backward.angle <= SOCKET_ANGLE_TOLERANCE_DEG,
    fromSocket: forward,
    toSocket: backward
  };
}

export function addNode(design, position) {
  const normalized = normalizePosition(position);
  const existing = design.nodes.find((node) => keyForPosition(node.position) === keyForPosition(normalized));
  if (existing) return existing;
  const node = { id: design.nextNodeId++, position: normalized };
  design.nodes.push(node);
  return node;
}

export function moveNode(design, nodeId, position) {
  const node = design.nodes.find((item) => item.id === nodeId);
  if (!node) return null;
  const normalized = normalizePosition(position);
  const occupied = design.nodes.find((item) => item.id !== nodeId && keyForPosition(item.position) === keyForPosition(normalized));
  if (occupied) return occupied;
  node.position = normalized;
  return node;
}

export function moveNodesByDelta(design, nodeIds, delta) {
  const ids = new Set(nodeIds);
  const moving = design.nodes.filter((node) => ids.has(node.id));
  const proposed = new Map(moving.map((node) => [node.id, normalizePosition({
    x: node.position.x + delta.x,
    y: node.position.y + delta.y,
    z: node.position.z + delta.z
  })]));
  for (const [id, position] of proposed) {
    const occupied = design.nodes.find((node) => !ids.has(node.id) && keyForPosition(node.position) === keyForPosition(position));
    if (occupied) return { ok: false, reason: `Move blocked: ball ${occupied.id} already occupies a target spot.` };
    if (position.y < 0) return { ok: false, reason: 'Move blocked: balls cannot go below floor level.' };
    const duplicate = [...proposed].find(([otherId, otherPosition]) => otherId !== id && keyForPosition(otherPosition) === keyForPosition(position));
    if (duplicate) return { ok: false, reason: 'Move blocked: selected balls would overlap.' };
  }
  for (const node of moving) node.position = proposed.get(node.id);
  return { ok: true, moved: moving.length };
}

export function scaleDesignToRodLength(design, newLength, oldLength = ROD_LENGTH) {
  const previous = Number(oldLength) || ROD_LENGTH || 1;
  const next = setRodLength(newLength);
  const factor = next / previous;
  if (Math.abs(factor - 1) > 1e-9) {
    for (const node of design.nodes) {
      node.position = normalizePosition({
        x: node.position.x * factor,
        y: node.position.y * factor,
        z: node.position.z * factor
      });
    }
  }
  design.rodLength = next;
  calculateParts(design);
  return { factor, rodLength: next };
}

export function removeNode(design, nodeId) {
  design.nodes = design.nodes.filter((node) => node.id !== nodeId);
  design.sticks = design.sticks.filter((stick) => stick.a !== nodeId && stick.b !== nodeId);
}

export function removeStick(design, stickId) {
  design.sticks = design.sticks.filter((stick) => stick.id !== stickId);
}

export function getSocketUsage(design, nodeId) {
  const node = design.nodes.find((item) => item.id === nodeId);
  if (!node) return [];
  return design.sticks.flatMap((stick) => {
    if (stick.a !== nodeId && stick.b !== nodeId) return [];
    const otherId = stick.a === nodeId ? stick.b : stick.a;
    const other = design.nodes.find((item) => item.id === otherId);
    if (!other) return [];
    const socket = nearestSocketDirection(vectorBetween(node.position, other.position));
    return [{ stickId: stick.id, socketId: socket.id, angle: socket.angle }];
  });
}

export function getNodeDegree(design, nodeId) {
  return design.sticks.filter((stick) => stick.a === nodeId || stick.b === nodeId).length;
}

export function hasFreeSocket(design, nodeId, socketId) {
  return !getSocketUsage(design, nodeId).some((usage) => usage.socketId === socketId);
}

export function addStick(design, a, b, { strict = true } = {}) {
  if (a === b) return { ok: false, reason: 'Pick two different balls.' };
  const nodeA = design.nodes.find((node) => node.id === a);
  const nodeB = design.nodes.find((node) => node.id === b);
  if (!nodeA || !nodeB) return { ok: false, reason: 'Missing ball.' };
  const exists = design.sticks.find((stick) => (stick.a === a && stick.b === b) || (stick.a === b && stick.b === a));
  if (exists) return { ok: false, reason: 'These balls are already connected.' };
  const analysis = connectionAnalysis(nodeA.position, nodeB.position);
  if (strict && !analysis.lengthOk) {
    return { ok: false, reason: `Off-length: ${analysis.length.toFixed(2)} vs stick length ${ROD_LENGTH.toFixed(2)}. Toy sticks are all one length, so square diagonals cannot be connected.` };
  }
  if (strict && !analysis.socketOk) {
    return { ok: false, reason: `Off-angle: nearest 18-hole sockets miss by ${Math.min(analysis.fromSocket.angle, analysis.toSocket.angle).toFixed(1)}°.` };
  }
  if (strict && !hasFreeSocket(design, a, analysis.fromSocket.id)) {
    return { ok: false, reason: `Ball ${a} socket ${analysis.fromSocket.label} is already used.` };
  }
  if (strict && !hasFreeSocket(design, b, analysis.toSocket.id)) {
    return { ok: false, reason: `Ball ${b} socket ${analysis.toSocket.label} is already used.` };
  }
  const stick = {
    id: design.nextStickId++,
    a,
    b,
    length: Number(analysis.length.toFixed(3)),
    valid: analysis.lengthOk && analysis.socketOk,
    fromSocket: analysis.fromSocket.id,
    toSocket: analysis.toSocket.id
  };
  design.sticks.push(stick);
  return { ok: true, stick };
}

export function connectSelectedPairs(design, nodeIds, { strict = true } = {}) {
  let added = 0;
  const messages = [];
  for (let i = 0; i < nodeIds.length; i += 1) {
    for (let j = i + 1; j < nodeIds.length; j += 1) {
      const result = addStick(design, nodeIds[i], nodeIds[j], { strict });
      if (result.ok) added += 1;
      else messages.push(result.reason);
    }
  }
  return { added, messages };
}

export function calculateParts(design, inventory = {}) {
  for (const stick of design.sticks) {
    const a = design.nodes.find((node) => node.id === stick.a);
    const b = design.nodes.find((node) => node.id === stick.b);
    if (a && b) {
      const analysis = connectionAnalysis(a.position, b.position);
      stick.length = Number(analysis.length.toFixed(3));
      stick.valid = analysis.lengthOk && analysis.socketOk;
      stick.fromSocket = analysis.fromSocket.id;
      stick.toSocket = analysis.toSocket.id;
    }
  }
  const balls = design.nodes.length;
  const sticks = design.sticks.length;
  const invalidSticks = design.sticks.filter((stick) => !stick.valid).length;
  const overloadedBalls = design.nodes.filter((node) => getNodeDegree(design, node.id) > MAX_SOCKET_DEGREE).length;
  const duplicateSockets = design.nodes.reduce((sum, node) => {
    const usage = getSocketUsage(design, node.id);
    return sum + Math.max(0, usage.length - new Set(usage.map((item) => item.socketId)).size);
  }, 0);
  const openEnds = design.nodes.reduce((sum, node) => sum + Math.max(0, MAX_SOCKET_DEGREE - new Set(getSocketUsage(design, node.id).map((item) => item.socketId)).size), 0);
  const ownedBalls = Number(inventory.balls ?? 0);
  const ownedSticks = Number(inventory.sticks ?? 0);
  return {
    balls,
    sticks,
    invalidSticks,
    overloadedBalls,
    duplicateSockets,
    openEnds,
    ballShortage: Math.max(0, balls - ownedBalls),
    stickShortage: Math.max(0, sticks - ownedSticks),
    withinInventory: balls <= ownedBalls && sticks <= ownedSticks && invalidSticks === 0 && overloadedBalls === 0 && duplicateSockets === 0
  };
}

export function serializeDesign(design) {
  return JSON.stringify({ version: 3, rodLength: ROD_LENGTH, nodes: design.nodes, sticks: design.sticks }, null, 2);
}

export function deserializeDesign(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  setRodLength(parsed.rodLength ?? 1);
  const design = createEmptyDesign();
  design.nodes = (parsed.nodes || []).map((node) => ({ id: Number(node.id), position: normalizePosition(node.position) }));
  design.sticks = (parsed.sticks || []).map((stick) => ({
    id: Number(stick.id),
    a: Number(stick.a),
    b: Number(stick.b),
    length: Number(stick.length),
    valid: Boolean(stick.valid),
    fromSocket: stick.fromSocket,
    toSocket: stick.toSocket
  }));
  design.nextNodeId = Math.max(0, ...design.nodes.map((node) => node.id)) + 1;
  design.nextStickId = Math.max(0, ...design.sticks.map((stick) => stick.id)) + 1;
  calculateParts(design);
  return design;
}

function addEdge(design, a, b) {
  addStick(design, a.id, b.id, { strict: true });
}

export function addEquilateralTriangle(design, origin = { x: 0, y: 0, z: 0 }) {
  const o = origin;
  const s = ROD_LENGTH / Math.sqrt(2);
  // Uses three allowed 18-hole directions:
  // A→B = XY diagonal, A→C = XZ diagonal, B→C = YZ diagonal.
  // All three rods are exactly the same length.
  const a = addNode(design, { x: o.x, y: o.y, z: o.z });
  const b = addNode(design, { x: o.x + s, y: o.y + s, z: o.z });
  const c = addNode(design, { x: o.x + s, y: o.y, z: o.z + s });
  addEdge(design, a, b);
  addEdge(design, b, c);
  addEdge(design, c, a);
  return [a, b, c];
}

export function addCubeBay(design, origin = { x: 0, y: 0, z: 0 }) {
  const o = origin;
  const r = ROD_LENGTH;
  const n = [];
  for (const x of [0, r]) for (const y of [0, r]) for (const z of [0, r]) {
    n.push(addNode(design, { x: o.x + x, y: o.y + y, z: o.z + z }));
  }
  const at = (x, y, z) => design.nodes.find((node) => keyForPosition(node.position) === keyForPosition({ x: o.x + x * r, y: o.y + y * r, z: o.z + z * r }));
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
  for (let i = 0; i < bays; i += 1) addCubeBay(design, { x: origin.x + i * ROD_LENGTH, y: origin.y, z: origin.z });
}

export function addPitchedRoofBay(design, origin = { x: 0, y: 1, z: 0 }) {
  const o = origin;
  const s = ROD_LENGTH / Math.sqrt(2);
  const width = ROD_LENGTH * Math.sqrt(2);
  const left = addNode(design, { x: o.x, y: o.y, z: o.z });
  const right = addNode(design, { x: o.x + width, y: o.y, z: o.z });
  const peak = addNode(design, { x: o.x + s, y: o.y + s, z: o.z });
  const leftBack = addNode(design, { x: o.x, y: o.y, z: o.z + 1 });
  const rightBack = addNode(design, { x: o.x + width, y: o.y, z: o.z + 1 });
  const peakBack = addNode(design, { x: o.x + s, y: o.y + s, z: o.z + 1 });
  // Do not connect left↔right: that would be √2 rods and impossible with equal-length sticks.
  for (const pair of [[left, peak], [right, peak], [leftBack, peakBack], [rightBack, peakBack], [left, leftBack], [right, rightBack], [peak, peakBack]]) {
    addEdge(design, pair[0], pair[1]);
  }
}

function encodeForUrl(design) {
  return btoa(unescape(encodeURIComponent(serializeDesign(design))));
}

function decodeFromUrl(value) {
  return deserializeDesign(decodeURIComponent(escape(atob(value))));
}

async function setupBrowserApp() {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const { ConvexGeometry } = await import('three/addons/geometries/ConvexGeometry.js');

  let design = createEmptyDesign();
  let mode = 'add';
  let selected = [];
  let meshes = new Map();
  let stickMeshes = new Map();
  let previewMeshes = [];
  const undoHistory = createUndoHistory();

  const canvas = document.querySelector('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x08111f, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x08111f, 14, 32);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(5, 4, 6);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(1, 0.8, 1);
  controls.enableDamping = true;

  const structureGroup = new THREE.Group();
  const previewGroup = new THREE.Group();
  scene.add(structureGroup, previewGroup);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  const grid = new THREE.GridHelper(12, 24, 0x46627f, 0x1f344d);
  grid.position.set(0, -0.01, 0);
  scene.add(grid);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ visible: false }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ghost = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0x52d1ff, transparent: true, opacity: 0.42 })
  );
  scene.add(ghost);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function createConnectorGeometry(radius = 0.205) {
    const long = 1 + Math.sqrt(2);
    const rawPoints = [];
    const signs = [-1, 1];
    const permutations = [
      (a, b, c) => [a, b, c],
      (a, b, c) => [a, c, b],
      (a, b, c) => [c, a, b]
    ];
    for (const sx of signs) for (const sy of signs) for (const sz of signs) {
      for (const permute of permutations) rawPoints.push(permute(sx, sy, sz * long));
    }
    const maxLength = Math.max(...rawPoints.map(([x, y, z]) => Math.hypot(x, y, z)));
    const points = rawPoints.map(([x, y, z]) => new THREE.Vector3((x / maxLength) * radius, (y / maxLength) * radius, (z / maxLength) * radius));
    const geometry = new ConvexGeometry(points);
    geometry.computeVertexNormals();
    return geometry;
  }

  const ballGeometry = createConnectorGeometry();
  const socketHoleGeometry = new THREE.CylinderGeometry(0.046, 0.038, 0.065, 24, 1, true);
  const socketRimGeometry = new THREE.TorusGeometry(0.047, 0.007, 8, 24);
  const ballMaterial = new THREE.MeshStandardMaterial({ color: 0x126bd1, roughness: 0.62, metalness: 0.01, flatShading: true });
  const selectedBallMaterial = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x5a3b00, roughness: 0.48, flatShading: true });
  const socketMaterial = new THREE.MeshStandardMaterial({ color: 0x06111f, roughness: 0.82 });
  const usedSocketMaterial = new THREE.MeshStandardMaterial({ color: 0x073b55, emissive: 0x0f6d91, roughness: 0.55 });
  const stickMaterial = new THREE.MeshStandardMaterial({ color: 0x52d1ff, roughness: 0.42 });
  const badStickMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.42 });
  const previewStickMaterial = new THREE.MeshStandardMaterial({ color: 0x5dd39e, roughness: 0.35, transparent: true, opacity: 0.42 });
  const previewNewMaterial = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.35, transparent: true, opacity: 0.38 });
  const previewBadMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.35, transparent: true, opacity: 0.34 });

  function setMessage(text) { document.querySelector('#message').textContent = text; }
  function updateUndoButton() {
    const button = document.querySelector('#undo');
    if (button) button.disabled = undoHistory.length === 0;
  }
  function rememberUndo() {
    pushUndoSnapshot(undoHistory, design, selected);
    updateUndoButton();
  }
  function undoLastEdit() {
    const result = restoreUndoSnapshot(undoHistory);
    if (!result.ok) {
      setMessage(result.reason);
      updateUndoButton();
      return;
    }
    design = result.design;
    selected = result.selected;
    setMessage('Undid last edit.');
    refreshScene();
  }
  function nodeById(id) { return design.nodes.find((node) => node.id === id); }
  function nodeAt(position) { return design.nodes.find((node) => keyForPosition(node.position) === keyForPosition(position)); }

  function cylinderBetween(a, b, material, radius = 0.035) {
    const start = new THREE.Vector3(a.x, a.y, a.z);
    const end = new THREE.Vector3(b.x, b.y, b.z);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const length = start.distanceTo(end);
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 18);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    return mesh;
  }

  function makeBallMesh(node) {
    const root = new THREE.Group();
    root.position.set(node.position.x, node.position.y, node.position.z);
    root.userData = { type: 'node', id: node.id };
    const shell = new THREE.Mesh(ballGeometry, selected.includes(node.id) ? selectedBallMaterial : ballMaterial);
    shell.userData = { type: 'node', id: node.id };
    root.add(shell);
    const usedSockets = new Set(getSocketUsage(design, node.id).map((usage) => usage.socketId));
    for (const socket of SOCKET_DIRECTIONS) {
      const socketGroup = new THREE.Group();
      socketGroup.position.set(socket.vector.x * 0.17, socket.vector.y * 0.17, socket.vector.z * 0.17);
      socketGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(socket.vector.x, socket.vector.y, socket.vector.z).normalize());
      socketGroup.userData = { type: 'node', id: node.id, socketId: socket.id };

      const hole = new THREE.Mesh(socketHoleGeometry, usedSockets.has(socket.id) ? usedSocketMaterial : socketMaterial);
      hole.userData = { type: 'node', id: node.id, socketId: socket.id };
      socketGroup.add(hole);

      const rim = new THREE.Mesh(socketRimGeometry, usedSockets.has(socket.id) ? usedSocketMaterial : socketMaterial);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.032;
      rim.userData = { type: 'node', id: node.id, socketId: socket.id };
      socketGroup.add(rim);
      root.add(socketGroup);
    }
    return root;
  }

  function clearPreviews() {
    for (const mesh of previewMeshes) previewGroup.remove(mesh);
    previewMeshes = [];
  }

  function addPreviewMesh(mesh, payload) {
    mesh.userData = { type: 'preview', ...payload };
    previewGroup.add(mesh);
    previewMeshes.push(mesh);
  }

  function buildConnectionPreviews() {
    clearPreviews();
    if (mode !== 'connect' || selected.length !== 1) return;
    const from = nodeById(selected[0]);
    if (!from) return;
    for (const socket of SOCKET_DIRECTIONS) {
      if (!hasFreeSocket(design, from.id, socket.id)) continue;
      const targetPosition = normalizePosition({
        x: from.position.x + socket.vector.x * ROD_LENGTH,
        y: from.position.y + socket.vector.y * ROD_LENGTH,
        z: from.position.z + socket.vector.z * ROD_LENGTH
      });
      if (targetPosition.y < 0) continue;
      const existing = nodeAt(targetPosition);
      const canUseExisting = existing ? hasFreeSocket(design, existing.id, nearestSocketDirection(vectorBetween(existing.position, from.position)).id) : true;
      const material = canUseExisting ? (existing ? previewStickMaterial : previewNewMaterial) : previewBadMaterial;
      const rod = cylinderBetween(from.position, targetPosition, material, 0.024);
      addPreviewMesh(rod, { fromId: from.id, targetId: existing?.id, targetPosition, socketId: socket.id, enabled: canUseExisting });
      const endpoint = new THREE.Mesh(new THREE.SphereGeometry(existing ? 0.105 : 0.085, 18, 12), material);
      endpoint.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
      addPreviewMesh(endpoint, { fromId: from.id, targetId: existing?.id, targetPosition, socketId: socket.id, enabled: canUseExisting });
    }
  }

  function refreshScene() {
    for (const mesh of meshes.values()) structureGroup.remove(mesh);
    for (const mesh of stickMeshes.values()) structureGroup.remove(mesh);
    meshes = new Map();
    stickMeshes = new Map();
    calculateParts(design);

    for (const stick of design.sticks) {
      const a = nodeById(stick.a);
      const b = nodeById(stick.b);
      if (!a || !b) continue;
      const mesh = cylinderBetween(a.position, b.position, stick.valid ? stickMaterial : badStickMaterial, 0.038);
      mesh.userData = { type: 'stick', id: stick.id };
      structureGroup.add(mesh);
      stickMeshes.set(stick.id, mesh);
    }

    for (const node of design.nodes) {
      const mesh = makeBallMesh(node);
      structureGroup.add(mesh);
      meshes.set(node.id, mesh);
    }
    buildConnectionPreviews();
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
    document.querySelector('#stick-length-label').textContent = ROD_LENGTH.toFixed(2);
    const stickLengthInput = document.querySelector('#stick-length');
    if (stickLengthInput && Math.abs(Number(stickLengthInput.value) - ROD_LENGTH) > 0.001) stickLengthInput.value = ROD_LENGTH.toFixed(2);
    const status = document.querySelector('#inventory-status');
    status.className = 'status';
    if (parts.ballShortage || parts.stickShortage) {
      status.classList.add('bad');
      status.textContent = `Short by ${parts.ballShortage} balls and ${parts.stickShortage} sticks.`;
    } else if (parts.invalidSticks || parts.overloadedBalls || parts.duplicateSockets) {
      status.classList.add('warn');
      status.textContent = `${parts.invalidSticks} off-length/off-angle sticks; ${parts.duplicateSockets} duplicate sockets.`;
    } else {
      status.classList.add('good');
      status.textContent = 'Within entered inventory and 18-hole socket rules.';
    }
    document.querySelector('#parts-list').value = [
      `Balls/connectors: ${parts.balls}`,
      `Sticks/rods: ${parts.sticks}`,
      `Open socket holes: ${parts.openEnds}`,
      `Off-length/off-angle sticks: ${parts.invalidSticks}`,
      `Duplicate socket usage: ${parts.duplicateSockets}`,
      `Owned inventory: ${inventory.balls} balls, ${inventory.sticks} sticks`,
      `Current stick length: ${ROD_LENGTH.toFixed(2)} planner units`,
      '',
      '18-hole model: 6 straight sockets + 12 face-diagonal sockets on a rhombicuboctahedron-like connector.',
      'Connect mode: click a ball, then click a semitransparent preview rod/end to add it. Yellow endpoints create a new ball.'
    ].join('\n');
    document.querySelector('#selection-label').textContent = selected.length ? `Selected ${selected.length}: ${selected.join(', ')}` : 'No selection';
    updateUndoButton();
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
    const y = Number(document.querySelector('#height').value) * ROD_LENGTH;
    const snap = Math.max(0.05, ROD_LENGTH / 2);
    return { x: roundToGrid(hit.point.x, snap), y, z: roundToGrid(hit.point.z, snap) };
  }

  function findInteractive(object) {
    let current = object;
    while (current) {
      if (current.userData?.type) return current;
      current = current.parent;
    }
    return object;
  }

  function getHitObject(event) {
    pointerToNdc(event);
    raycaster.setFromCamera(pointer, camera);
    const objects = [...meshes.values(), ...stickMeshes.values(), ...previewMeshes];
    return findInteractive(raycaster.intersectObjects(objects, true)[0]?.object || null);
  }

  function toggleSelection(id) {
    selected = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
  }

  function selectNode(id, event = {}) {
    if (event.shiftKey || mode === 'select') {
      toggleSelection(id);
    } else if (mode === 'connect') {
      selected = [id];
      setMessage(`Ball ${id} selected. Click a semitransparent preview rod/end to add a connection.`);
    } else if (mode === 'move') {
      if (!selected.includes(id)) selected = [id];
      else if (event.shiftKey) toggleSelection(id);
      setMessage(selected.length > 1 ? 'Click the grid to move the whole selection using the first selected ball as anchor.' : 'Click the grid to move this ball. Shift-click more balls for multi-move.');
    } else {
      selected = [id];
    }
    refreshScene();
  }

  function connectPreview(payload) {
    if (!payload.enabled) {
      setMessage('That preview uses a socket that is already occupied.');
      return;
    }
    rememberUndo();
    const target = payload.targetId ? nodeById(payload.targetId) : addNode(design, payload.targetPosition);
    const strict = true;
    const result = addStick(design, payload.fromId, target.id, { strict });
    setMessage(result.ok ? `Stick added via ${payload.socketId}.` : result.reason);
    selected = [target.id];
    refreshScene();
  }

  canvas.addEventListener('pointermove', (event) => {
    const point = getGridPoint(event);
    if (point) ghost.position.set(point.x, point.y, point.z);
  });

  canvas.addEventListener('pointerdown', (event) => {
    const hit = getHitObject(event);
    if (hit?.userData.type === 'preview') {
      connectPreview(hit.userData);
      return;
    }
    if (hit?.userData.type === 'node') {
      const id = hit.userData.id;
      if (mode === 'delete') {
        rememberUndo();
        removeNode(design, id);
        selected = selected.filter((item) => item !== id);
        setMessage('Ball and attached sticks deleted.');
        refreshScene();
      } else {
        selectNode(id, event);
      }
      return;
    }
    if (hit?.userData.type === 'stick' && mode === 'delete') {
      rememberUndo();
      removeStick(design, hit.userData.id);
      setMessage('Stick deleted.');
      refreshScene();
      return;
    }
    const point = getGridPoint(event);
    if (!point) return;
    if (mode === 'add') {
      rememberUndo();
      const node = addNode(design, point);
      selected = [node.id];
      setMessage(`Ball ${node.id} placed at ${point.x}, ${point.y}, ${point.z}.`);
      refreshScene();
    } else if (mode === 'move' && selected.length) {
      const anchor = nodeById(selected[0]);
      const delta = { x: point.x - anchor.position.x, y: point.y - anchor.position.y, z: point.z - anchor.position.z };
      const historyLength = undoHistory.length;
      rememberUndo();
      const result = moveNodesByDelta(design, selected, delta);
      if (!result.ok) undoHistory.splice(historyLength);
      setMessage(result.ok ? `Moved ${result.moved} selected ball${result.moved === 1 ? '' : 's'}.` : result.reason);
      refreshScene();
    } else if (mode === 'select' && !event.shiftKey) {
      selected = [];
      refreshScene();
    }
  });

  function setMode(nextMode) {
    mode = nextMode;
    if (mode === 'add' || mode === 'delete') selected = [];
    document.querySelectorAll('.tool').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    const help = {
      select: 'Select mode: click balls to multi-select. Shift-click also toggles selection in other modes.',
      add: 'Add mode: click the grid to place connector balls. Use height for upper levels.',
      connect: 'Connect mode: click a ball, then click a semitransparent preview rod/end. Yellow endpoint creates a new ball.',
      move: 'Move mode: select one or more balls, then click the grid to move them together.',
      delete: 'Delete mode: click a ball or stick to remove it.'
    };
    document.querySelector('#mode-help').textContent = help[mode];
    refreshScene();
  }

  document.querySelectorAll('.tool').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelector('#height').addEventListener('input', (event) => {
    document.querySelector('#height-label').textContent = event.target.value;
  });
  document.querySelector('#stick-length').addEventListener('input', (event) => {
    const previous = ROD_LENGTH;
    const next = Number(event.target.value);
    rememberUndo();
    const result = scaleDesignToRodLength(design, next, previous);
    document.querySelector('#stick-length-label').textContent = result.rodLength.toFixed(2);
    setMessage(`Stick length changed to ${result.rodLength.toFixed(2)}. Existing balls/sticks were rescaled by ${result.factor.toFixed(2)}×.`);
    refreshScene();
  });
  document.querySelectorAll('#owned-balls, #owned-sticks, #strict-rods').forEach((input) => input.addEventListener('input', () => refreshScene()));
  document.querySelector('#connect-selected').addEventListener('click', () => {
    const strict = true;
    const historyLength = undoHistory.length;
    rememberUndo();
    const result = connectSelectedPairs(design, selected, { strict });
    if (!result.added) undoHistory.splice(historyLength);
    setMessage(result.added ? `Connected ${result.added} valid selected pair${result.added === 1 ? '' : 's'}.` : `No valid selected pairs. ${result.messages[0] || ''}`);
    refreshScene();
  });

  function findOpenOrigin() {
    if (!design.nodes.length) return { x: 0, y: 0, z: 0 };
    const maxX = Math.max(...design.nodes.map((node) => node.position.x));
    return { x: roundToGrid(maxX + ROD_LENGTH, Math.max(0.05, ROD_LENGTH / 2)), y: 0, z: 0 };
  }

  document.querySelectorAll('[data-template]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.template;
    rememberUndo();
    if (action === 'reset') {
      design = createEmptyDesign();
      selected = [];
      setMessage('Design cleared.');
    } else if (action === 'triangle') {
      selected = addEquilateralTriangle(design, findOpenOrigin()).map((node) => node.id);
      setMessage('Equal-stick triangle added using 45° face-diagonal sockets.');
    } else if (action === 'cube') {
      selected = addCubeBay(design, findOpenOrigin()).map((node) => node.id);
      setMessage('Cube bay added.');
    } else if (action === 'tunnel') {
      addTunnel(design, findOpenOrigin(), 3);
      selected = [];
      setMessage('Three-bay tunnel added with shared balls/sticks between bays.');
    } else if (action === 'roof') {
      addPitchedRoofBay(design, { ...findOpenOrigin(), y: ROD_LENGTH });
      selected = [];
      setMessage('Pitched roof bay added using equal-length face-diagonal sockets.');
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
    rememberUndo();
    design = deserializeDesign(await file.text());
    selected = [];
    setMessage('JSON design loaded.');
    refreshScene();
  });

  document.querySelector('#undo').addEventListener('click', undoLastEdit);
  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      undoLastEdit();
    }
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

if (typeof document !== 'undefined') {
  setupBrowserApp().catch((error) => {
    console.error(error);
    const message = document.querySelector('#message');
    if (message) message.textContent = `3D engine failed to load: ${error.message}`;
  });
}
