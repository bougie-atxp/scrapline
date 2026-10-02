import * as THREE from 'three';
import type { Drawing } from '../game/drawing';
import { drawingTexture, loaner, normalizeDrawing } from '../game/drawing';
import type { Race } from '../game/simulation';
import { LENGTH, ROAD_HALF, START, trackAt } from '../game/track';
import { inkSpot, stampPhase, stampSpot } from '../game/hazards';

const palette = { paper: 0xf5f0e1, road: 0xdfd8c6, ink: 0x30342f, red: 0xc9432b, cardboard: 0xb2946d, edge: 0x897453 };
function material(color: number, roughness = 1) { return new THREE.MeshStandardMaterial({ color, roughness }); }
function box(width: number, height: number, depth: number, color: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color));
  mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
function label(text: string, width: number, height: number, ink = '#30342f', paper = '#f5f0e1') {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 192;
  const context = canvas.getContext('2d')!;
  context.fillStyle = paper; context.fillRect(0, 0, 768, 192);
  context.fillStyle = ink; context.font = '900 100px "Arial Narrow", Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 384, 101, 715);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 1 }));
  return mesh;
}
function groundLabel(text: string, x: number, z: number, width: number, heading = 0) {
  const mesh = label(text, width, width / 4); mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = -heading; mesh.position.set(x, .045, z); return mesh;
}
function roadGeometry() {
  const positions: number[] = [], indices: number[] = [];
  for (let index = 0; index <= 240; index++) {
    const center = trackAt(index / 240 * LENGTH);
    for (const side of [-1, 1]) positions.push(center.x - Math.sin(center.heading) * ROAD_HALF * side, .01, center.y + Math.cos(center.heading) * ROAD_HALF * side);
    if (index < 240) { const base = index * 2; indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
function makeCar(drawing: Drawing, player: boolean, color = 0xc9432b) {
  const group = new THREE.Group();
  const canvas = drawingTexture(drawing); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const bodyMaterial = new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .08, side: THREE.DoubleSide, roughness: 1 });
  for (const side of [-.15, .15]) {
    const body = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.52), bodyMaterial); body.position.set(0, 1.74, side); body.castShadow = true; group.add(body);
  }
  const chassis = box(3.7, .1, .9, player ? palette.paper : color); chassis.position.y = .55; group.add(chassis);
  for (const side of [-.66, .66]) for (const along of [-1.36, 1.36]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .3, 12), material(palette.ink)); wheel.rotation.x = Math.PI / 2; wheel.position.set(along, .5, side); wheel.castShadow = true; group.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .32, 12), material(palette.paper)); hub.rotation.x = Math.PI / 2; hub.position.copy(wheel.position); group.add(hub);
  }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.3), new THREE.MeshBasicMaterial({ color: 0x4b412f, transparent: true, opacity: .12, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .025; group.add(shadow);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(.38, .85, 3), material(player ? palette.red : palette.ink)); arrow.rotation.z = -Math.PI / 2; arrow.position.set(2.85, .12, 0); group.add(arrow);
  return group;
}
export class Stadium {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, 1, .1, 450);
  cars: THREE.Group[];
  stamp = new THREE.Group();
  stampShadow: THREE.Mesh;
  spectators: THREE.Mesh[] = [];
  flags: THREE.Group[] = [];
  marks = new THREE.Group();
  boostTrails: THREE.Mesh[] = [];
  resize: ResizeObserver;
  lookTarget = new THREE.Vector3();
  ready = false;
  disposed = false;
  onLost: (event: Event) => void;
  constructor(public host: HTMLElement, drawing: Drawing, onError: () => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.setClearColor(0xe5ddcb);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
    this.renderer.domElement.setAttribute('aria-label', 'Miniature cardboard circuit with your hand-drawn paper racer');
    host.appendChild(this.renderer.domElement);
    this.onLost = event => { event.preventDefault(); onError(); };
    this.renderer.domElement.addEventListener('webglcontextlost', this.onLost);
    this.scene.fog = new THREE.Fog(0xe5ddcb, 110, 220);
    const ambient = new THREE.HemisphereLight(0xfffae7, 0xa39680, 1.8); this.scene.add(ambient);
    const sunlight = new THREE.DirectionalLight(0xfff4da, 2.4); sunlight.position.set(-30, 70, -38); sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048); sunlight.shadow.camera.left = -100; sunlight.shadow.camera.right = 100; sunlight.shadow.camera.top = 80; sunlight.shadow.camera.bottom = -80; sunlight.shadow.normalBias = .04; sunlight.shadow.bias = -.0004; this.scene.add(sunlight);
    const desk = box(230, 1.5, 155, 0xe6decc); desk.position.y = -1.4; this.scene.add(desk);
    const base = box(156, .7, 100, palette.cardboard); base.position.y = -.6; this.scene.add(base);
    const top = box(154.7, .18, 98.7, palette.paper); top.position.y = -.16; this.scene.add(top);
    const road = new THREE.Mesh(roadGeometry(), material(palette.road)); road.receiveShadow = true; this.scene.add(road);
    for (let index = 0; index < 100; index++) {
      const center = trackAt(index / 100 * LENGTH);
      for (const side of [-1, 1]) {
        const edge = box(2.2, .13, .6, index % 3 === 0 ? palette.red : palette.paper); edge.position.set(center.x - Math.sin(center.heading) * 6.95 * side, .07, center.y + Math.cos(center.heading) * 6.95 * side); edge.rotation.y = -center.heading; this.scene.add(edge);
        const barrier = box(2.8, .95, .48, index % 6 === 0 ? palette.red : palette.cardboard); barrier.position.set(center.x - Math.sin(center.heading) * 7.85 * side, .45, center.y + Math.cos(center.heading) * 7.85 * side); barrier.rotation.y = -center.heading; this.scene.add(barrier);
        if (index % 2 === 0) { const seam = box(.045, .9, .5, palette.edge); seam.position.copy(barrier.position); seam.rotation.copy(barrier.rotation); this.scene.add(seam); }
      }
      if (index % 3 === 0) { const dash = box(1.1, .025, .13, 0xbab3a2); dash.position.set(center.x, .03, center.y); dash.rotation.y = -center.heading; this.scene.add(dash); }
    }
    const start = trackAt(START);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 18; column++) { const square = box(.55, .025, .76, (row + column) % 2 ? palette.ink : palette.paper); square.position.set(start.x + row * .55, .04, start.y - 6.8 + column * .76); this.scene.add(square); }
    for (let number = 0; number < 4; number++) {
      const grid = groundLabel(`0${number + 1}`, start.x - 3 - Math.floor(number / 2) * 5, start.y + (number % 2 ? 2.8 : -2.8), 2.5, Math.PI / 2); this.scene.add(grid);
    }
    this.gantry(START, 'SCRAPLINE / 02 LAPS', false);
    this.gantry(143, 'THE DAILY OFFCUT', true);
    this.scene.add(groundLabel('SCRAPLINE', -8, 2, 37));
    this.scene.add(groundLabel('DRAW BADLY. DRIVE BEAUTIFULLY.', -8, 10, 31));
    this.scene.add(groundLabel('DESK CIRCUIT / EST. TODAY', -8, -7, 25));
    for (let index = 0; index < 4; index++) this.grandstand(-38 + index * 25, -42, index);
    for (let index = 0; index < 3; index++) this.garage(-27 + index * 20, 40, index);
    for (let index = 0; index < 12; index++) { const center = trackAt(index / 12 * LENGTH); const flag = this.flag(index % 3 === 0); flag.position.set(center.x - Math.sin(center.heading) * 11, 0, center.y + Math.cos(center.heading) * 11); this.scene.add(flag); this.flags.push(flag); }
    for (const distance of [83, 118, 230, 270]) {
      const center = trackAt(distance); const apex = groundLabel('› › ›', center.x - Math.sin(center.heading) * 4, center.y + Math.cos(center.heading) * 4, 4, center.heading); this.scene.add(apex);
    }
    const inkShape = new THREE.Shape();
    for (let index = 0; index <= 32; index++) { const angle = index / 32 * Math.PI * 2; const radius = 3.7 + Math.sin(angle * 5) * .25; const x = Math.cos(angle) * radius * 1.3, y = Math.sin(angle) * radius; if (index === 0) inkShape.moveTo(x, y); else inkShape.lineTo(x, y); }
    const ink = new THREE.Mesh(new THREE.ShapeGeometry(inkShape), material(0x434e49)); ink.rotation.x = -Math.PI / 2; ink.position.set(inkSpot.x, .055, inkSpot.z); this.scene.add(ink);
    const outlinePoints = inkShape.getPoints(50).map(point => new THREE.Vector3(point.x + inkSpot.x, .08, -point.y + inkSpot.z));
    const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outlinePoints), new THREE.LineBasicMaterial({ color: 0xf7edce })); this.scene.add(outline);
    this.scene.add(groundLabel('WET INK', inkSpot.x - 8, inkSpot.z, 5));
    const stampBase = box(6.5, .9, 5.5, palette.red); this.stamp.add(stampBase);
    const stampWood = box(6.7, .7, 5.7, 0xc3a37e); stampWood.position.y = .65; this.stamp.add(stampWood);
    const handle = box(1.2, 3.5, 1.2, palette.ink); handle.position.y = 2.5; this.stamp.add(handle);
    const grip = box(4.3, 1.4, 1.6, palette.ink); grip.position.y = 4.1; this.stamp.add(grip);
    const approved = label('REJECTED', 5.8, 1.45, '#c9432b'); approved.position.set(0, 1.25, -1); approved.rotation.x = -.2; this.stamp.add(approved);
    this.stamp.position.set(stampSpot.x, 9, stampSpot.z); this.stamp.rotation.y = -stampSpot.heading; this.scene.add(this.stamp);
    this.stampShadow = new THREE.Mesh(new THREE.PlaneGeometry(7, 6.1), new THREE.MeshBasicMaterial({ color: palette.red, transparent: true, opacity: .17, depthWrite: false })); this.stampShadow.rotation.x = -Math.PI / 2; this.stampShadow.rotation.z = -stampSpot.heading; this.stampShadow.position.set(stampSpot.x, .07, stampSpot.z); this.scene.add(this.stampShadow);
    this.scene.add(groundLabel('KEEP INSIDE →', stampSpot.x - 7, stampSpot.z, 6, stampSpot.heading));
    this.cars = [drawing, ...[0x69858c, 0xb59b45, 0xb77062].map(color => {
      const hex = '#' + color.toString(16).padStart(6, '0');
      return normalizeDrawing(loaner.map(stroke => ({ ...stroke, color: stroke.color === '#c9432b' ? hex : '#292c29' })))!;
    })].map((carDrawing, index) => { const car = makeCar(carDrawing, index === 0); this.scene.add(car); return car; });
    for (let index = 0; index < 4; index++) { const trail = box(1, .07, .55, palette.red); trail.visible = false; this.scene.add(trail); this.boostTrails.push(trail); }
    this.scene.add(this.marks);
    this.resize = new ResizeObserver(() => this.size()); this.resize.observe(host); this.size();
  }
  size() { const width = this.host.clientWidth, height = this.host.clientHeight; if (!width || !height) return; this.renderer.setSize(width, height); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
  gantry(distance: number, title: string, bridge: boolean) {
    const group = new THREE.Group(), point = trackAt(distance);
    for (const side of [-1, 1]) { const support = box(bridge ? 5 : .65, bridge ? 6.3 : 6, .6, bridge ? palette.paper : palette.ink); support.position.set(0, 3, side * 8.6); group.add(support); }
    if (bridge) {
      const roof = box(7, .16, 18, palette.paper); roof.position.y = 6.4; roof.rotation.z = -.12; group.add(roof);
      const fold = box(3.5, .12, 18, 0xe4dcc6); fold.position.set(4.1, 5.9, 0); fold.rotation.z = -.55; group.add(fold);
      const programme = label(title, 14, 3.3); programme.rotation.x = -Math.PI / 2; programme.rotation.z = Math.PI / 2; programme.position.set(-.5, 6.8, 0); group.add(programme);
      const edition = label('RACE PROGRAMME / VOL. 01', 12, 1.5, '#c9432b'); edition.rotation.x = -Math.PI / 2; edition.rotation.z = Math.PI / 2; edition.position.set(2, 6.7, 0); group.add(edition);
    } else { const beam = box(.7, 1.6, 18, palette.paper); beam.position.y = 6; group.add(beam); const sign = label(title, 16.5, 1.4); sign.rotation.y = -Math.PI / 2; sign.position.set(-.37, 6, 0); group.add(sign); }
    group.position.set(point.x, 0, point.y); group.rotation.y = -point.heading; this.scene.add(group);
  }
  grandstand(x: number, z: number, seed: number) {
    const group = new THREE.Group();
    for (let tier = 0; tier < 3; tier++) {
      const seat = box(20, .35, 2, tier === 2 ? palette.red : palette.cardboard); seat.position.set(0, .7 + tier * .9, -tier * 1.7); group.add(seat);
      for (let person = 0; person < 11; person++) {
        const spectator = box(.65, .95, .09, [palette.ink, palette.red, 0xc9bb98, 0x758783][(person + tier + seed) % 4]); spectator.position.set(-8.8 + person * 1.75, 1.3 + tier * .9, -tier * 1.7); spectator.userData.baseY = spectator.position.y; group.add(spectator); this.spectators.push(spectator);
        const head = new THREE.Mesh(new THREE.CircleGeometry(.29, 8), material(palette.paper)); head.position.set(0, .67, 0); spectator.add(head);
      }
    }
    for (const side of [-9, 9]) { const leg = box(.25, 3, 5.4, palette.cardboard); leg.position.set(side, 1, -2); leg.rotation.x = .12; group.add(leg); }
    const sign = label(`GRANDSTAND 0${seed + 1}`, 16, 1.5); sign.position.set(0, .7, 1.08); group.add(sign);
    group.position.set(x, 0, z); this.scene.add(group);
  }
  garage(x: number, z: number, index: number) {
    const group = new THREE.Group(); const structure = box(15, 5.8, 7, palette.cardboard); structure.position.y = 2.8; group.add(structure);
    const door = box(11, 3.9, .05, palette.ink); door.position.set(0, 1.95, -3.54); group.add(door);
    const number = label(`GARAGE / 0${index + 1}`, 12, 1.8); number.rotation.y = Math.PI; number.position.set(0, 4.9, -3.57); group.add(number);
    const roof = box(16, .2, 8, palette.paper); roof.position.y = 5.8; roof.rotation.z = .035; group.add(roof); group.position.set(x, 0, z); this.scene.add(group);
  }
  flag(red: boolean) {
    const group = new THREE.Group(); const pole = box(.08, 4.7, .08, palette.ink); pole.position.y = 2.35; group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1), new THREE.MeshStandardMaterial({ color: red ? palette.red : palette.paper, side: THREE.DoubleSide })); flag.position.set(.85, 4.1, 0); group.add(flag); return group;
  }
  update(race: Race, delta: number, lift: number, reduced: boolean) {
    if (this.disposed) return;
    const player = race.cars[0];
    race.cars.forEach((car, index) => {
      const group = this.cars[index]; group.position.set(car.x, index === 0 ? lift * 8 : 0, car.z); group.rotation.y = -car.heading;
      group.rotation.x = car.drifting ? .055 * Math.sin(race.time * 8) : 0; group.rotation.z = car.collision > 0 ? .06 * Math.sin(race.time * 23) : 0;
      group.scale.y = car.stampCooldown > 1.5 ? .55 : 1;
      const trail = this.boostTrails[index]; trail.visible = car.turbo > 0; trail.position.set(car.x - Math.cos(car.heading) * 3, .12, car.z - Math.sin(car.heading) * 3); trail.rotation.y = -car.heading; trail.scale.x = 1 + Math.sin(race.time * 35) * .3;
    });
    const phase = stampPhase(race.time); this.stamp.position.y = phase.height;
    const shadowMaterial = this.stampShadow.material as THREE.MeshBasicMaterial; shadowMaterial.opacity = phase.warning ? .28 + Math.sin(race.time * 16) * .1 : phase.impact ? .48 : .12;
    if (!reduced) { this.spectators.forEach((person, index) => { person.position.y = person.userData.baseY + Math.max(0, Math.sin(race.time * 4 + index * 1.7)) * .16; }); this.flags.forEach((flag, index) => { flag.rotation.y = Math.sin(race.time * 2 + index) * .16; }); }
    while (this.marks.children.length < race.marks.length) { const mark = new THREE.Mesh(new THREE.PlaneGeometry(.8, .16), new THREE.MeshBasicMaterial({ color: palette.ink, transparent: true, opacity: .25, depthWrite: false })); mark.rotation.x = -Math.PI / 2; this.marks.add(mark); }
    this.marks.children.forEach((object, index) => { const mark = race.marks[index]; object.visible = !!mark; if (mark) { object.position.set(mark.x, .08, mark.z); object.rotation.z = -mark.heading; ((object as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.min(.45, mark.life * .24); } });
    const forward = trackAt(player.distance + 12);
    const cameraHeading = player.heading * .25 + nearestAngle(player.heading, forward.heading) * .75;
    const narrow = this.camera.aspect < .85;
    const distance = narrow ? 24 : 18;
    const desired = new THREE.Vector3(player.x - Math.cos(cameraHeading) * distance + Math.sin(cameraHeading) * 23, narrow ? 29 : 24, player.z - Math.sin(cameraHeading) * distance - Math.cos(cameraHeading) * 23);
    const target = new THREE.Vector3(player.x + Math.cos(cameraHeading) * 7, 0, player.z + Math.sin(cameraHeading) * 7);
    if (!this.ready) { this.camera.position.copy(desired); this.lookTarget.copy(target); this.ready = true; }
    const smoothing = 1 - Math.exp(-delta * 4.2); this.camera.position.lerp(desired, smoothing); this.lookTarget.lerp(target, smoothing); this.camera.lookAt(this.lookTarget);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.disposed = true; this.resize.disconnect(); this.renderer.domElement.removeEventListener('webglcontextlost', this.onLost);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { geometries.add(object.geometry); const list = Array.isArray(object.material) ? object.material : [object.material]; list.forEach(item => { materials.add(item); if ('map' in item && item.map) textures.add(item.map as THREE.Texture); }); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(item => item.dispose()); textures.forEach(texture => texture.dispose()); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
function nearestAngle(reference: number, angle: number) { return reference + Math.atan2(Math.sin(angle - reference), Math.cos(angle - reference)); }
