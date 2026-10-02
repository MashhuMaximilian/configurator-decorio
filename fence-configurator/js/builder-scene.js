import * as THREE from "three";
import { DecorioViewer } from "./viewer.js";
import { nearestRun, projectPoint, gateSpan } from "./builder-engine.js";
import { resolveProduct } from "./ontology.js";
import { disposeObjectResources } from "../../shared-3d/src/geometry/resourceLifecycle.js";
export class BuilderScene extends DecorioViewer {
  constructor(host, handlers) {
    super(host);
    this.handlers = handlers;
    this.view = "3d";
    this.tool = "select";
    this.controls.mouseButtons.LEFT = null;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    this.scene.background.set("#edf2ed");
    this.overlays = new THREE.Group();
    this.scene.add(this.overlays);
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.onSelect = null;
    this.anchorGroup = new THREE.Group();
    this.scene.add(this.anchorGroup);
    this.grid = new THREE.GridHelper(100, 100, "#b7cbbd", "#d5dfd7");
    this.grid.position.y = 0.008;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.4;
    this.scene.add(this.grid);
    const pointers = new Set(),
      canvas = this.renderer.domElement;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) {
        this.down = null;
        this.controls.enabled = true;
        this.handlers.cancel();
        return;
      }
      if (e.button !== 0 || !e.isPrimary) return;
      const point = this.ground(e);
      if (!point) return;
      const hit = this.pick(e, point);
      this.down = { x: e.clientX, y: e.clientY, point, hit };
      if (["node", "gate"].includes(hit?.type) && this.tool === "select")
        this.controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!e.isPrimary || pointers.size > 1) return;
      const point = this.ground(e);
      if (!point) return;
      const dragging =
        !!this.down &&
        Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5;
      this.handlers.hover(point, {
        dragging,
        down: this.down,
        hit: this.pick(e, point),
      });
    });
    canvas.addEventListener("pointerup", (e) => {
      pointers.delete(e.pointerId);
      if (e.button !== 0 || !this.down) return;
      const point = this.ground(e),
        down = this.down;
      this.down = null;
      this.controls.enabled = true;
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      if (point)
        this.handlers.release(point, {
          down,
          dragging: Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5,
          hit: this.pick(e, point),
        });
    });
    canvas.addEventListener("pointercancel", (e) => {
      pointers.delete(e.pointerId);
      this.down = null;
      this.controls.enabled = true;
      this.handlers.cancel();
    });
    canvas.addEventListener("pointerleave", () => {
      if (!this.down) this.handlers.cancel();
    });
  }
  selectionScreenPoint(selected) {
    const gate =
      selected.type === "gate"
        ? this.state.gates.find((g) => g.id === selected.id)
        : null;
    const run = this.state.segments.find(
      (s) => s.id === (gate?.segmentId || selected.id),
    );
    if (!run) return null;
    const a = this.state.nodes.find((n) => n.id === run.a),
      b = this.state.nodes.find((n) => n.id === run.b);
    const offset = gate
      ? gate.offset + gateSpan(resolveProduct(this.catalog, gate)) / 2
      : Math.hypot(b.x - a.x, b.y - a.y) / 2;
    const p = projectPoint(this.state, run.id, offset);
    this.camera.updateMatrixWorld();
    const v = new THREE.Vector3(p.x, this.view === "2d" ? 0 : 0.7, p.y).project(
      this.camera,
    );
    const r = this.renderer.domElement.getBoundingClientRect();
    return {
      x: r.left + ((v.x + 1) * r.width) / 2,
      y: r.top + ((1 - v.y) * r.height) / 2,
    };
  }
  setAnchor(point) {
    disposeObjectResources(this.anchorGroup, { materialFilter: () => true });
    this.anchorGroup.clear();
    if (point) {
      const marker = this.surface.geometry.mesh(
        this.surface.geometry.create("decorio.sphere", {
          radius: 0.16,
          widthSegments: 16,
          heightSegments: 12,
        }),
        this.surface.materials.create("decorio.steel", {
          color: "#e3ac43",
          metalness: 0,
        }),
      );
      marker.position.set(point.x, 0.16, point.y);
      this.anchorGroup.add(marker);
    }
    this.surface.invalidate();
  }
  setTool(tool) {
    this.tool = tool;
    this.grid.visible = tool === "fence" || this.view === "2d";
    this.controls.touches.ONE = tool === "select" ? THREE.TOUCH.ROTATE : null;
    this.renderer.domElement.style.cursor =
      tool === "select"
        ? "default"
        : tool === "erase"
          ? "not-allowed"
          : "crosshair";
  }
  ground(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.x) / r.width) * 2 - 1,
        (-(e.clientY - r.y) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    const p = this.ray.ray.intersectPlane(this.plane, new THREE.Vector3());
    return p ? { x: p.x, y: p.z } : null;
  }
  pick(e, point) {
    if (!this.state) return null;
    const nodeHit = this.ray
      .intersectObjects(this.overlays.children, true)
      .find((h) => h.object.userData.nodeId);
    if (nodeHit && this.tool === "select")
      return { type: "node", id: nodeHit.object.userData.nodeId };
    if (this.view === "3d") {
      const hit = this.ray.intersectObjects(this.group.children, true)[0];
      let obj = hit?.object;
      while (obj && !obj.userData.segmentId) obj = obj.parent;
      if (obj) {
        const gate = this.state.gates.find(
          (g) => g.id === obj.userData.elementId,
        );
        return {
          type: gate ? "gate" : "run",
          id: gate?.id || obj.userData.segmentId,
        };
      }
    }
    const near = nearestRun(this.state, point);
    if (
      !near ||
      near.distance >
        Math.max(
          0.22,
          this.camera.position.distanceTo(this.controls.target) * 0.008,
        )
    )
      return null;
    const gate = this.state.gates.find(
      (g) =>
        g.segmentId === near.segmentId &&
        near.offset >= g.offset &&
        near.offset <= g.offset + gateSpan(resolveProduct(this.catalog, g)),
    );
    return { type: gate ? "gate" : "run", id: gate?.id || near.segmentId };
  }
  setView(view) {
    this.view = view;
    this.grid.visible = this.tool === "fence" || view === "2d";
    this.controls.enableRotate = view === "3d";
    this.controls.mouseButtons.RIGHT =
      view === "3d" ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    this.fit();
  }
  fit() {
    if (!this.currentBuild) return;
    super.fit();
    const center = this.controls.target.clone(),
      d = this.camera.position.distanceTo(center);
    this.camera.position
      .copy(center)
      .add(
        this.view === "2d"
          ? new THREE.Vector3(0, d, 0.001)
          : new THREE.Vector3(0.8, 0.8, 1).normalize().multiplyScalar(d),
      );
    this.controls.update();
    this.surface.invalidate();
  }
  show(
    assembly,
    state,
    catalog,
    { selected = null, ghost = false, fit = false } = {},
  ) {
    this.state = state;
    this.catalog = catalog;
    super.render(
      {
        ...assembly,
        parts: assembly.parts.map((p) =>
          p.kind === "gate" ? { ...p, previewOpen: true } : p,
        ),
      },
      state,
      { selected: selected?.type === "run" ? selected.id : "", fit: false },
    );
    this.group.visible = this.view !== "2d";
    disposeObjectResources(this.overlays, { materialFilter: () => true });
    this.overlays.clear();
    const overlay = (geo, color) => {
      const mesh = this.surface.geometry.mesh(
        geo,
        this.surface.materials.create("decorio.steel", {
          color,
          roughness: 1,
          metalness: 0,
        }),
        { castShadow: false },
      );
      this.overlays.add(mesh);
      return mesh;
    };
    if (this.view === "2d")
      for (const part of assembly.parts.filter((p) =>
        ["panel", "gate", "gap"].includes(p.kind),
      )) {
        const a = part.a,
          b = part.b,
          length = Math.hypot(b.x - a.x, b.y - a.y),
          color =
            part.kind === "gap"
              ? "#de7457"
              : part.kind === "gate"
                ? "#d7a448"
                : part.elementId === selected?.id
                  ? "#4182db"
                  : "#2d6955",
          mesh = overlay(
            this.surface.geometry.create("primitive.box", {
              width: length,
              height: 0.025,
              depth: part.kind === "gate" ? 0.24 : 0.13,
            }),
            color,
          );
        mesh.position.set((a.x + b.x) / 2, 0.03, (a.y + b.y) / 2);
        mesh.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
      }
    // No catalog geometry means a wireframe spatial reservation, never an invented product.
    if (this.view === "3d")
      for (const part of assembly.parts.filter(
        (p) =>
          ["panel", "gate"].includes(p.kind) &&
          p.visual?.status !== "reconstructed",
      )) {
        const a = part.a,
          b = part.b,
          w = Math.hypot(b.x - a.x, b.y - a.y),
          h = part.variant.height,
          box = this.surface.geometry.create("primitive.box", {
            width: w,
            height: h,
            depth: 0.08,
          }),
          edges = new THREE.EdgesGeometry(box);
        box.dispose();
        const mesh = new THREE.LineSegments(
          edges,
          new THREE.LineDashedMaterial({
            color: "#c58e35",
            dashSize: 0.12,
            gapSize: 0.08,
          }),
        );
        mesh.computeLineDistances();
        mesh.position.set((a.x + b.x) / 2, h / 2, (a.y + b.y) / 2);
        mesh.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
        this.overlays.add(mesh);
      }
    // Gate outlines remain visible among same-colour fence panels, and selection marks the actual gate.
    if (this.view === "3d")
      for (const part of assembly.parts.filter((p) => p.kind === "gate")) {
        const a = part.a,
          b = part.b,
          h = part.variant.height + 0.04,
          points = [
            new THREE.Vector3(a.x, 0.04, a.y),
            new THREE.Vector3(a.x, h, a.y),
            new THREE.Vector3(b.x, h, b.y),
            new THREE.Vector3(b.x, 0.04, b.y),
          ];
        this.overlays.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({
              color: selected?.id === part.elementId ? "#4182db" : "#c49b57",
            }),
          ),
        );
      }
    for (const n of state.nodes) {
      const mesh = overlay(
        this.surface.geometry.create("decorio.sphere", {
          radius: 0.11,
          widthSegments: 12,
          heightSegments: 8,
        }),
        "#f9fcf8",
      );
      mesh.position.set(n.x, 0.12, n.y);
      mesh.userData.nodeId = n.id;
    }
    for (const gate of state.gates) {
      const r = resolveProduct(catalog, gate),
        a = projectPoint(state, gate.segmentId, gate.offset),
        b = projectPoint(state, gate.segmentId, gate.offset + gateSpan(r)),
        angle = Math.atan2(b.y - a.y, b.x - a.x),
        sign = gate.handing === "left" ? 1 : -1;
      const leaves = r.visual?.leaves || 1;
      if (leaves > 2) continue; // Folding clearances require the mechanism's own installation drawing.
      const curves = [];
      if (r.model.legacyGenerator === "sliding") {
        const direction = gate.handing === "right" ? 1 : -1,
          origin = direction === 1 ? b : a;
        curves.push([
          new THREE.Vector3(origin.x, 0.055, origin.y),
          new THREE.Vector3(
            origin.x + direction * Math.cos(angle) * r.variant.width,
            0.055,
            origin.y + direction * Math.sin(angle) * r.variant.width,
          ),
        ]);
      } else
        for (let leaf = 0; leaf < leaves; leaf++) {
          const hinge = leaf === 0 ? a : b,
            heading = angle + (leaf ? Math.PI : 0),
            swing = leaf ? -sign : sign,
            radius = r.variant.width / leaves;
          curves.push(
            Array.from(
              { length: 25 },
              (_, i) =>
                new THREE.Vector3(
                  hinge.x +
                    Math.cos(heading + (((swing * i) / 24) * Math.PI) / 2) *
                      radius,
                  0.055,
                  hinge.y +
                    Math.sin(heading + (((swing * i) / 24) * Math.PI) / 2) *
                      radius,
                ),
            ),
          );
        }
      for (const points of curves) {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineDashedMaterial({
            color: "#cc9938",
            dashSize: 0.15,
            gapSize: 0.1,
          }),
        );
        line.computeLineDistances();
        this.overlays.add(line);
      }
    }
    if (ghost) {
      for (const root of [this.group, this.overlays])
        root.traverse((o) => {
          if (o.material) {
            o.material.transparent = true;
            o.material.opacity = 0.7;
          }
        });
    }
    this.currentBuild.bounds.box.expandByObject(this.overlays);
    this.currentBuild.bounds.box.getCenter(this.currentBuild.bounds.center);
    this.currentBuild.bounds.box.getSize(this.currentBuild.bounds.size);
    if (fit) this.fit();
    this.surface.invalidate();
  }
}
