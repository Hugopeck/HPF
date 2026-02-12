import { createEl, setAttrs, getPointerPosition, uuid } from './core-utils.js';

function ensureArrowMarker(svg, id = 'hpf-arrow') {
  let marker = svg.querySelector(`#${id}`);
  if (marker) return marker;
  const defs = svg.querySelector('defs') || svg.insertBefore(createEl('defs'), svg.firstChild);
  marker = createEl('marker', {
    id,
    viewBox: '0 0 10 10',
    refX: 10,
    refY: 5,
    markerWidth: 8,
    markerHeight: 8,
    orient: 'auto-start-reverse'
  });
  const path = createEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#0f172a' });
  marker.append(path);
  defs.append(marker);
  return marker;
}

function portPoint(port) {
  return {
    x: Number(port.el.getAttribute('cx')),
    y: Number(port.el.getAttribute('cy'))
  };
}

export class LinkEdge {
  constructor(svg, options = {}) {
    this.svg = svg;
    this.id = options.id || uuid('edge');
    this.source = options.source || null;
    this.target = options.target || null;
    this.type = options.type || 'curved';
    this.labelText = options.label || '';
    this.deleteOnClick = options.deleteOnClick ?? true;
    this.listeners = new Map();
    this.bend = null;
    this.group = createEl('g', { class: 'hpf-edge-group', 'data-id': this.id });
    this.path = createEl('path', {
      fill: 'none',
      stroke: options.stroke || '#0f172a',
      'stroke-width': 2.2,
      'marker-end': `url(#${ensureArrowMarker(svg).id})`
    });
    this.path.classList.add('hpf-edge');
    this.label = createEl('text', {
      class: 'hpf-edge-label',
      'font-size': 12,
      'text-anchor': 'middle',
      fill: options.labelColor || '#0f172a'
    });
    this.label.textContent = this.labelText;
    this.handle = createEl('circle', {
      r: 5,
      class: 'hpf-edge-handle',
      fill: '#94a3b8'
    });
    this.group.append(this.path, this.label);
    this.svg.append(this.group);
    this._attachEvents();
    this.update();
  }

  on(event, handler) {
    const set = this.listeners.get(event) || new Set();
    set.add(handler);
    this.listeners.set(event, set);
    return () => set.delete(handler);
  }

  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set) return;
    [...set].forEach((handler) => handler(payload));
  }

  setEndpoints(source, target) {
    this.source = source;
    this.target = target;
    this.update();
  }

  setLabel(text) {
    this.labelText = text;
    this.label.textContent = text;
  }

  update() {
    if (!this.source || !this.target) return;
    const start = this._resolvePoint(this.source);
    const end = this._resolvePoint(this.target);
    const path = this._buildPath(start, end);
    setAttrs(this.path, { d: path });
    this._positionLabel();
    this._positionHandle();
  }

  remove() {
    this.group.remove();
  }

  _buildPath(start, end) {
    if (this.type === 'straight') {
      return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }
    if (this.type === 'orthogonal') {
      if (!this.bend) {
        this.bend = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      }
      return `M ${start.x} ${start.y} L ${this.bend.x} ${start.y} L ${this.bend.x} ${end.y} L ${end.x} ${end.y}`;
    }
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const curve = Math.max(dx, dy) * 0.25;
    return `M ${start.x} ${start.y} C ${start.x + curve} ${start.y} ${end.x - curve} ${end.y} ${end.x} ${end.y}`;
  }

  _positionLabel() {
    if (!this.labelText) {
      this.label.textContent = '';
      return;
    }
    const length = this.path.getTotalLength();
    const mid = this.path.getPointAtLength(length / 2);
    setAttrs(this.label, { x: mid.x, y: mid.y - 6 });
  }

  _positionHandle() {
    if (this.type !== 'orthogonal') {
      this.handle.remove();
      return;
    }
    if (!this.handle.isConnected) this.group.append(this.handle);
    const start = this._resolvePoint(this.source);
    const end = this._resolvePoint(this.target);
    if (!this.bend) {
      this.bend = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    }
    setAttrs(this.handle, { cx: this.bend.x, cy: this.bend.y });
  }

  _attachEvents() {
    this.path.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (evt.shiftKey) {
        this.emit('reconnect', this);
        return;
      }
      this.emit('click', this);
      if (this.deleteOnClick) this.emit('remove', this);
    });
    this.path.addEventListener('dblclick', (evt) => {
      evt.stopPropagation();
      this.emit('remove', this);
    });

    this.handle.addEventListener('pointerdown', (evt) => {
      evt.stopPropagation();
      if (this.type !== 'orthogonal') return;
      const move = (moveEvt) => {
        const next = getPointerPosition(moveEvt, this.svg);
        this.bend = { x: next.x, y: next.y };
        this.update();
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
    });
  }

  _resolvePoint(endpoint) {
    if (endpoint.port) return portPoint(endpoint.port);
    return { x: endpoint.x, y: endpoint.y };
  }
}

export class LinkManager {
  constructor(svg) {
    this.svg = svg;
    this.edges = [];
    this.dragLine = null;
  }

  createEdge(source, target, options = {}) {
    const edge = new LinkEdge(this.svg, { ...options, source, target });
    this.edges.push(edge);
    return edge;
  }

  removeEdge(edge) {
    this.edges = this.edges.filter((item) => item !== edge);
    edge.remove();
  }

  updateAll() {
    this.edges.forEach((edge) => edge.update());
  }

  startDragLink(source, onComplete) {
    const startPoint = source.port ? portPoint(source.port) : source;
    if (!this.dragLine) {
      this.dragLine = createEl('path', {
        fill: 'none',
        stroke: '#64748b',
        'stroke-width': 2,
        'stroke-dasharray': '4 4'
      });
      this.svg.append(this.dragLine);
    }
    const move = (evt) => {
      const end = getPointerPosition(evt, this.svg);
      const path = `M ${startPoint.x} ${startPoint.y} L ${end.x} ${end.y}`;
      setAttrs(this.dragLine, { d: path });
    };
    const up = (evt) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const end = getPointerPosition(evt, this.svg);
      if (this.dragLine) this.dragLine.remove();
      this.dragLine = null;
      onComplete?.(end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }
}

export function attachPortDrag(port, linkManager, onComplete) {
  port.el.addEventListener('pointerdown', (evt) => {
    evt.stopPropagation();
    linkManager.startDragLink({ port }, (endPoint) => {
      onComplete?.(endPoint, port);
    });
  });
}
