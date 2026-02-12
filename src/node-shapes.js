import { createEl, setAttrs, clamp, getPointerPosition, uuid } from './core-utils.js';

export class NodeShape {
  constructor(svg, options = {}) {
    this.svg = svg;
    this.id = options.id || uuid('node');
    this.shapeType = options.shape || 'rect';
    this.x = options.x ?? 40;
    this.y = options.y ?? 40;
    this.width = options.width ?? 160;
    this.height = options.height ?? 80;
    this.minWidth = options.minWidth ?? 80;
    this.minHeight = options.minHeight ?? 50;
    this.labelText = options.label ?? 'Node';
    this.align = options.align || 'start';
    this.tooltipText = options.tooltip || '';
    this.snap = options.snap ?? 0;
    this.ports = [];
    this.listeners = new Map();

    this.group = createEl('g', { class: 'hpf-node', 'data-id': this.id });
    this.body = this._createBody(options);
    this.label = createEl('text', {
      'font-size': 14,
      'font-family': options.font || 'Georgia, serif',
      fill: options.labelColor || '#111827',
      'text-anchor': this.align
    });

    this.portsGroup = createEl('g', { class: 'hpf-node-ports' });
    this.tooltip = createEl('title');
    this.tooltip.textContent = this.tooltipText || this.labelText;

    this.resizeHandle = createEl('rect', {
      x: this.x + this.width - 10,
      y: this.y + this.height - 10,
      width: 10,
      height: 10,
      fill: '#111827',
      cursor: 'nwse-resize'
    });

    this.group.append(this.body, this.label, this.portsGroup, this.resizeHandle, this.tooltip);
    this.svg.append(this.group);

    this._attachDrag();
    this._attachResize();
    this._attachEditing();
    this._attachHover();
    this._updateLabel();
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

  setLabel(text) {
    this.labelText = text;
    this.tooltip.textContent = this.tooltipText || text;
    this._updateLabel();
  }

  setPosition(x, y) {
    const nextX = this.snap ? Math.round(x / this.snap) * this.snap : x;
    const nextY = this.snap ? Math.round(y / this.snap) * this.snap : y;
    this.x = nextX;
    this.y = nextY;
    this._updateLayout();
    this.emit('move', this.getBounds());
  }

  setSize(width, height) {
    this.width = clamp(width, this.minWidth, 2000);
    this.height = clamp(height, this.minHeight, 2000);
    this._updateLayout();
    this.emit('resize', this.getBounds());
  }

  setStyle({ fill, stroke, labelColor } = {}) {
    if (fill) setAttrs(this.body, { fill });
    if (stroke) setAttrs(this.body, { stroke });
    if (labelColor) setAttrs(this.label, { fill: labelColor });
  }

  setTooltip(text) {
    this.tooltipText = text;
    this.tooltip.textContent = text;
  }

  getBounds() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }

  addPort(side = 'right', offset = 0.5) {
    const port = createEl('circle', {
      r: 5,
      fill: '#0f172a',
      stroke: '#ffffff',
      'stroke-width': 1.5,
      class: 'hpf-port',
      cursor: 'crosshair'
    });
    const data = { id: uuid('port'), side, offset, el: port };
    this.ports.push(data);
    this.portsGroup.append(port);
    this._positionPort(data);
    return data;
  }

  remove() {
    this.group.remove();
  }

  _createBody(options) {
    const base = {
      fill: options.fill || '#ffffff',
      stroke: options.stroke || '#1f2937',
      'stroke-width': 1.5
    };
    if (this.shapeType === 'circle') {
      return createEl('circle', {
        ...base,
        cx: this.x + this.width / 2,
        cy: this.y + this.height / 2,
        r: Math.min(this.width, this.height) / 2
      });
    }
    if (this.shapeType === 'ellipse') {
      return createEl('ellipse', {
        ...base,
        cx: this.x + this.width / 2,
        cy: this.y + this.height / 2,
        rx: this.width / 2,
        ry: this.height / 2
      });
    }
    if (this.shapeType === 'diamond' || this.shapeType === 'path') {
      return createEl('path', { ...base, d: this._diamondPath() });
    }
    return createEl('rect', {
      ...base,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rx: options.rx ?? 8,
      ry: options.ry ?? 8
    });
  }

  _diamondPath() {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    return `M ${cx} ${this.y} L ${this.x + this.width} ${cy} L ${cx} ${this.y + this.height} L ${this.x} ${cy} Z`;
  }

  _positionPort(port) {
    let cx = this.x;
    let cy = this.y;
    if (port.side === 'left') {
      cx = this.x;
      cy = this.y + this.height * port.offset;
    } else if (port.side === 'right') {
      cx = this.x + this.width;
      cy = this.y + this.height * port.offset;
    } else if (port.side === 'top') {
      cx = this.x + this.width * port.offset;
      cy = this.y;
    } else if (port.side === 'bottom') {
      cx = this.x + this.width * port.offset;
      cy = this.y + this.height;
    }
    setAttrs(port.el, { cx, cy });
  }

  _updateLayout() {
    if (this.shapeType === 'circle') {
      setAttrs(this.body, {
        cx: this.x + this.width / 2,
        cy: this.y + this.height / 2,
        r: Math.min(this.width, this.height) / 2
      });
    } else if (this.shapeType === 'ellipse') {
      setAttrs(this.body, {
        cx: this.x + this.width / 2,
        cy: this.y + this.height / 2,
        rx: this.width / 2,
        ry: this.height / 2
      });
    } else if (this.shapeType === 'diamond' || this.shapeType === 'path') {
      setAttrs(this.body, { d: this._diamondPath() });
    } else {
      setAttrs(this.body, { x: this.x, y: this.y, width: this.width, height: this.height });
    }
    this._updateLabel();
    setAttrs(this.resizeHandle, {
      x: this.x + this.width - 10,
      y: this.y + this.height - 10
    });
    this.ports.forEach((port) => this._positionPort(port));
  }

  _updateLabel() {
    const padding = 12;
    const maxWidth = Math.max(24, this.width - padding * 2);
    const maxChars = Math.max(4, Math.floor(maxWidth / 7));
    const words = String(this.labelText || '').split(/\s+/);
    const lines = [];
    let current = '';
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);

    this.label.textContent = '';
    const anchor = this.align === 'middle' ? 'middle' : this.align === 'end' ? 'end' : 'start';
    const x =
      anchor === 'middle'
        ? this.x + this.width / 2
        : anchor === 'end'
          ? this.x + this.width - padding
          : this.x + padding;
    const y = this.y + 24;
    setAttrs(this.label, { x, y, 'text-anchor': anchor });
    lines.forEach((line, idx) => {
      const tspan = createEl('tspan', {
        x,
        dy: idx === 0 ? 0 : 16
      });
      tspan.textContent = line;
      this.label.append(tspan);
    });
  }

  _attachDrag() {
    const dragTargets = [this.body, this.label];
    dragTargets.forEach((target) => {
      target.style.cursor = 'move';
      target.addEventListener('pointerdown', (evt) => {
        evt.stopPropagation();
        const start = getPointerPosition(evt, this.svg);
        const startX = this.x;
        const startY = this.y;
        const move = (moveEvt) => {
          const next = getPointerPosition(moveEvt, this.svg);
          this.setPosition(startX + (next.x - start.x), startY + (next.y - start.y));
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          this.emit('dragend', this.getBounds());
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up, { once: true });
        this.emit('dragstart', this.getBounds());
      });
    });
  }

  _attachResize() {
    this.resizeHandle.addEventListener('pointerdown', (evt) => {
      evt.stopPropagation();
      const start = getPointerPosition(evt, this.svg);
      const startWidth = this.width;
      const startHeight = this.height;
      const move = (moveEvt) => {
        const next = getPointerPosition(moveEvt, this.svg);
        this.setSize(startWidth + (next.x - start.x), startHeight + (next.y - start.y));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        this.emit('resizeend', this.getBounds());
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
      this.emit('resizestart', this.getBounds());
      });
  }

  _attachEditing() {
    this.group.addEventListener('dblclick', (evt) => {
      evt.stopPropagation();
      const next = window.prompt('Edit label', this.labelText);
      if (next !== null) {
        this.setLabel(next);
        this.emit('label', this.getBounds());
      }
    });

    this.group.addEventListener('click', (evt) => {
      evt.stopPropagation();
      this.emit('click', this.getBounds());
    });
  }

  _attachHover() {
    this.group.addEventListener('pointerenter', () => this.emit('hover', this.getBounds()));
    this.group.addEventListener('pointerleave', () => this.emit('blur', this.getBounds()));
  }
}

export function createNodeShape(svg, options) {
  const node = new NodeShape(svg, options);
  if (options?.ports) {
    options.ports.forEach((port) => node.addPort(port.side, port.offset));
  }
  return node;
}
