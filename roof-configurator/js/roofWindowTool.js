import { drawAlignmentPreview } from './alignmentPreview.js?v=windows-24';
import { roofWindowGeometry } from './roofWindows.js?v=windows-24';

export class RoofWindowTool {
  constructor(editor) {
    this.editor = editor;
    this.panel = document.createElement('fieldset');
    this.panel.className = 'layout-window';
    this.panel.hidden = true;
    this.panel.innerHTML = `<div class="layout-section-heading">Roof window</div>
      <label>Window<select data-window="selection"></select></label>
      <p>Click on a slope to place the centre. Height is measured along the slope.</p>
      <div class="layout-coordinate-row">
        <label>Width (m)<input data-window="width" type="number" min="0.3" max="3" step="0.01" value="0.78"></label>
        <label>Height (m)<input data-window="length" type="number" min="0.4" max="4" step="0.01" value="1.18"></label>
      </div>
      <div class="layout-coordinate-row">
        <label>Centre X (m)<input data-window="x" type="number" step="0.1"></label>
        <label>Centre Z (m)<input data-window="z" type="number" step="0.1"></label>
      </div>
      <output data-window="status" aria-live="polite"></output>
      <svg data-window="preview" role="img" aria-label="Roof window preview" hidden></svg>
      <div class="layout-action-row">
        <button type="button" data-window="save" class="layout-primary">Add window</button>
        <button type="button" data-window="remove">Delete window</button>
        <button type="button" data-window="cancel">Cancel</button>
      </div>`;
    editor.dialog.querySelector('aside').prepend(this.panel);
    this.panel.addEventListener('input', event => {
      if (event.target.matches('input')) this.preview();
    });
    this.field('selection').addEventListener('change', () => this.select());
    this.field('cancel').addEventListener('click', () => { this.close(); editor.render(); });
    this.field('save').addEventListener('click', () => {
      if (!this.result) return;
      const next = this.result;
      this.close();
      editor.commit(next);
      editor.status('Roof window saved. Apply roof to see it in 3D.');
    });
    this.field('remove').addEventListener('click', () => {
      const index = Number(this.field('selection').value);
      if (index < 0) return;
      const next = structuredClone(editor.layout);
      next.roofWindows.splice(index, 1);
      this.close();
      editor.commit(next);
    });
  }

  field(name) { return this.panel.querySelector(`[data-window="${name}"]`); }

  open(index = -1) {
    const editor = this.editor;
    editor.stopMeet(); editor.stopDormer();
    editor.mode = 'select'; editor.path = []; editor.panEnabled = false;
    this.active = true;
    this.panel.hidden = false;
    this.field('selection').replaceChildren(new Option('New window', '-1'),
      ...(editor.layout.roofWindows || []).map((_, i) => new Option(`Window ${i + 1}`, String(i))));
    this.field('selection').value = String(index);
    this.select();
    this.panel.scrollIntoView({ block: 'nearest' });
  }

  select() {
    const index = Number(this.field('selection').value);
    const existing = this.editor.layout.roofWindows?.[index];
    this.field('save').textContent = existing ? 'Update window' : 'Add window';
    this.field('remove').disabled = !existing;
    for (const key of ['width', 'length', 'x', 'z']) {
      this.field(key).value = existing?.[key] ?? ({ width: .78, length: 1.18, x: '', z: '' }[key]);
    }
    this.preview();
  }

  close() { this.active = false; this.panel.hidden = true; this.result = null; }

  place(point) {
    this.field('x').value = point.x.toFixed(3);
    this.field('z').value = point.z.toFixed(3);
    this.preview();
  }

  preview() {
    this.result = null;
    this.field('preview').setAttribute('hidden', '');
    try {
      const window = Object.fromEntries(['width', 'length', 'x', 'z'].map(key =>
        [key, this.field(key).value === '' ? NaN : Number(this.field(key).value)]));
      if (!Number.isFinite(window.x) || !Number.isFinite(window.z)) throw new Error('Click inside a slope to position the window.');
      const next = structuredClone(this.editor.layout);
      next.roofWindows ||= [];
      const index = Number(this.field('selection').value);
      if (index < 0) next.roofWindows.push(window); else next.roofWindows[index] = window;
      const geometry = roofWindowGeometry(next);
      const previewWindow = geometry[index < 0 ? geometry.length - 1 : index];
      drawAlignmentPreview(this.field('preview'), next, -1, previewWindow.point(0, 0));
      this.field('preview').removeAttribute('hidden');
      this.result = next;
      this.field('status').textContent = 'Ready. The blue rectangle shows the roof opening.';
    } catch (error) { this.field('status').textContent = error.message; }
    this.field('save').disabled = !this.result;
    this.editor.render();
  }

  draw(svg, project) {
    const layout = this.result || this.editor.layout;
    for (const window of roofWindowGeometry(layout)) {
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      shape.setAttribute('points', window.corners.map(p => { const q = project(p); return `${q.x},${q.y}`; }).join(' '));
      shape.setAttribute('class', 'layout-roof-window');
      shape.dataset.roofWindow = window.index;
      svg.append(shape);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const p = project(window);
      label.setAttribute('x', p.x); label.setAttribute('y', p.y);
      label.setAttribute('text-anchor', 'middle');
      label.textContent = `W${window.index + 1}`;
      label.style.pointerEvents = 'none';
      svg.append(label);
    }
  }
}
