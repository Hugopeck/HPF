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
    this.path = createEl('path', {
      fill: 'none',
      stroke: options.stroke || '#0f172a',
      'stroke-width': 2.2,
      'marker-end': `url(#${ensureArrowMarker(svg).id})`
    });
    this.path.classList.add('hpf-edge');
    this.svg.append(this.path);
    this.update();
  }

  setEndpoints(source, target) {
    this.source = source;
    this.target = target;
    this.update();
  }

  update() {
    if (!this.source || !this.target) return;
    const start = this._resolvePoint(this.source);
    const end = this._resolvePoint(this.target);
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const curve = Math.max(dx, dy) * 0.25;
    const path = `M ${start.x} ${start.y} C ${start.x + curve} ${start.y} ${end.x - curve} ${end.y} ${end.x} ${end.y}`;
    setAttrs(this.path, { d: path });
  }

  remove() {
    this.path.remove();
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
