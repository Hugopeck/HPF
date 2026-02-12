import { createEl, setAttrs, clamp, getPointerPosition, uuid } from './core-utils.js';

export class NodeShape {
  constructor(svg, options = {}) {
    this.svg = svg;
    this.id = options.id || uuid('node');
    this.x = options.x ?? 40;
    this.y = options.y ?? 40;
    this.width = options.width ?? 160;
    this.height = options.height ?? 80;
    this.minWidth = options.minWidth ?? 80;
    this.minHeight = options.minHeight ?? 50;
    this.labelText = options.label ?? 'Node';
    this.ports = [];
    this.listeners = new Map();

    this.group = createEl('g', { class: 'hpf-node', 'data-id': this.id });
    this.body = createEl('rect', {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rx: 8,
      ry: 8,
      fill: options.fill || '#ffffff',
      stroke: options.stroke || '#1f2937',
      'stroke-width': 1.5
    });
    this.label = createEl('text', {
      x: this.x + 12,
      y: this.y + 24,
      'font-size': 14,
      'font-family': options.font || 'Georgia, serif',
      fill: options.labelColor || '#111827'
    });
    this.label.textContent = this.labelText;

    this.portsGroup = createEl('g', { class: 'hpf-node-ports' });

    this.resizeHandle = createEl('rect', {
      x: this.x + this.width - 10,
      y: this.y + this.height - 10,
      width: 10,
      height: 10,
      fill: '#111827',
      cursor: 'nwse-resize'
    });

    this.group.append(this.body, this.label, this.portsGroup, this.resizeHandle);
    this.svg.append(this.group);

    this._attachDrag();
    this._attachResize();
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
    this.label.textContent = text;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this._updateLayout();
    this.emit('move', this.getBounds());
  }

  setSize(width, height) {
    this.width = clamp(width, this.minWidth, 2000);
    this.height = clamp(height, this.minHeight, 2000);
    this._updateLayout();
    this.emit('resize', this.getBounds());
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
    setAttrs(this.body, { x: this.x, y: this.y, width: this.width, height: this.height });
    setAttrs(this.label, { x: this.x + 12, y: this.y + 24 });
    setAttrs(this.resizeHandle, {
      x: this.x + this.width - 10,
      y: this.y + this.height - 10
    });
    this.ports.forEach((port) => this._positionPort(port));
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
}

export function createNodeShape(svg, options) {
  const node = new NodeShape(svg, options);
  if (options?.ports) {
    options.ports.forEach((port) => node.addPort(port.side, port.offset));
  }
  return node;
}
