import { createEventBus, createStore, uuid, getPointerPosition, createEl, setAttrs } from './core-utils.js';
import { createNodeShape } from './node-shapes.js';
import { LinkManager, attachPortDrag } from './link-edges.js';

export class DiagramEditor {
  constructor(svg, options = {}) {
    this.svg = typeof svg === 'string' ? document.querySelector(svg) : svg;
    this.options = {
      panZoom: options.panZoom ?? true,
      collision: options.collision ?? true,
      wheelZoom: options.wheelZoom ?? true
    };
    this.bus = createEventBus();
    this.store = createStore({ nodes: [], links: [] });
    this.nodes = new Map();
    this.links = new Set();
    this.linkManager = new LinkManager(this.svg);
    this.undoStack = [];
    this.redoStack = [];
    this.selected = null;
    this.selectedLinks = new Set();
    this.selectedNodes = new Set();
    this.dragStartPositions = new Map();
    this.contextMenu = null;
    this.lasso = null;
    this.isPanning = false;
    this.viewBox = this._initViewBox();

    this.svg.addEventListener('pointerdown', (evt) => this._handleCanvasPointerDown(evt));
    this.svg.addEventListener('contextmenu', (evt) => this._openContextMenu(evt));

    this._bindPanZoom();

    if (options.data) {
      this.load(options.data);
    }
  }

  on(event, handler) {
    return this.bus.on(event, handler);
  }

  addNode(options = {}) {
    const node = createNodeShape(this.svg, { id: uuid('node'), ...options });
    node.on('move', () => {
      this.linkManager.updateAll();
      this._syncStore();
      this.bus.emit('diagram:changed', { type: 'node:move', node });
    });
    node.on('resize', () => {
      this.linkManager.updateAll();
      this._syncStore();
      this.bus.emit('diagram:changed', { type: 'node:resize', node });
    });
    node.on('dragstart', () => this.dragStartPositions.set(node.id, { x: node.x, y: node.y }));
    node.on('dragend', () => this._handleCollision(node));
    node.group.addEventListener('pointerdown', (evt) => {
      evt.stopPropagation();
      this.selectNode(node, { append: evt.shiftKey });
    });

    node.ports.forEach((port) => this._attachPort(port, node));

    this.nodes.set(node.id, node);
    this._record({
      type: 'add-node',
      do: () => {},
      undo: () => this.removeNode(node.id)
    });
    this._syncStore();
    this.bus.emit('node:add', node);
    this.bus.emit('diagram:changed', { type: 'node:add', node });
    return node;
  }

  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    [...this.links].forEach((link) => {
      if (link.source?.node === node || link.target?.node === node) {
        this.removeLink(link);
      }
    });
    node.remove();
    this.nodes.delete(nodeId);
    this._syncStore();
    this.bus.emit('node:remove', node);
    this.bus.emit('diagram:changed', { type: 'node:remove', node });
  }

  addLink(source, target, options = {}) {
    const edge = this.linkManager.createEdge(source, target, options);
    edge.on('remove', () => this.removeLink(edge));
    edge.on('click', () => this.selectLink(edge, { append: false }));
    edge.on('reconnect', () => this._reconnectEdge(edge));
    this.links.add(edge);
    this._record({
      type: 'add-link',
      do: () => {},
      undo: () => this.removeLink(edge)
    });
    this._syncStore();
    this.bus.emit('link:add', edge);
    this.bus.emit('diagram:changed', { type: 'link:add', edge });
    return edge;
  }

  removeLink(edge) {
    if (!this.links.has(edge)) return;
    this.linkManager.removeEdge(edge);
    this.links.delete(edge);
    this._syncStore();
    this.bus.emit('link:remove', edge);
    this.bus.emit('diagram:changed', { type: 'link:remove', edge });
  }

  selectNode(node, { append = false } = {}) {
    if (!append) {
      this.selectedNodes.forEach((item) => item.group.classList.remove('is-selected'));
      this.selectedNodes.clear();
    }
    if (node) {
      this.selectedNodes.add(node);
      node.group.classList.add('is-selected');
    }
    this.selected = node || null;
    this.bus.emit('node:select', node);
  }

  selectLink(edge, { append = false } = {}) {
    if (!append) {
      this.selectedLinks.forEach((item) => item.path.classList.remove('is-selected'));
      this.selectedLinks.clear();
    }
    if (edge) {
      this.selectedLinks.add(edge);
      edge.path.classList.add('is-selected');
    }
    this.bus.emit('link:select', edge);
  }

  undo() {
    const action = this.undoStack.pop();
    if (!action) return;
    action.undo();
    this.redoStack.push(action);
    this.bus.emit('history:undo', action);
  }

  redo() {
    const action = this.redoStack.pop();
    if (!action) return;
    action.do();
    this.undoStack.push(action);
    this.bus.emit('history:redo', action);
  }

  exportJSON() {
    const nodes = [...this.nodes.values()].map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      label: node.labelText,
      ports: node.ports.map((port) => ({
        id: port.id,
        side: port.side,
        offset: port.offset
      }))
    }));
    const links = [...this.links].map((edge) => ({
      source: edge.source?.node?.id || null,
      target: edge.target?.node?.id || null
    }));
    return { nodes, links };
  }

  exportSVG() {
    return this.svg.outerHTML;
  }

  load(data) {
    data.nodes?.forEach((node) => {
      this.addNode(node);
    });
    data.links?.forEach((link) => {
      const sourceNode = this.nodes.get(link.source);
      const targetNode = this.nodes.get(link.target);
      if (sourceNode && targetNode) {
        const sourcePort = sourceNode.ports[0];
        const targetPort = targetNode.ports[0];
        if (sourcePort && targetPort) {
          this.addLink({ node: sourceNode, port: sourcePort }, { node: targetNode, port: targetPort });
        }
      }
    });
  }

  _syncStore() {
    this.store.setState({
      nodes: [...this.nodes.values()],
      links: [...this.links]
    });
  }

  _record(action) {
    this.undoStack.push(action);
    this.redoStack = [];
  }

  _attachPort(port, node) {
    attachPortDrag(port, this.linkManager, (endPoint) => {
      const hit = this._hitTestPort(endPoint, node);
      if (hit) {
        this.addLink({ node, port }, { node: hit.node, port: hit.port });
      }
    });
  }

  _reconnectEdge(edge) {
    const start = edge.source;
    if (!start) return;
    this.linkManager.startDragLink(start, (endPoint) => {
      const hit = this._hitTestPort(endPoint, start.node);
      if (hit) {
        edge.setEndpoints(start, { node: hit.node, port: hit.port });
        this.linkManager.updateAll();
        this._syncStore();
        this.bus.emit('diagram:changed', { type: 'link:reconnect', edge });
      }
    });
  }

  _hitTestPort(point, excludeNode) {
    const threshold = 12;
    for (const node of this.nodes.values()) {
      if (node === excludeNode) continue;
      for (const port of node.ports) {
        const cx = Number(port.el.getAttribute('cx'));
        const cy = Number(port.el.getAttribute('cy'));
        if (Math.hypot(point.x - cx, point.y - cy) < threshold) {
          return { node, port };
        }
      }
    }
    return null;
  }

  addNodeAtPointer(evt, options = {}) {
    const pos = getPointerPosition(evt, this.svg);
    return this.addNode({ x: pos.x, y: pos.y, ...options });
  }

  _initViewBox() {
    const viewBox = this.svg.getAttribute('viewBox');
    if (viewBox) {
      const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
      return { x, y, w, h };
    }
    const width = this.svg.clientWidth || 800;
    const height = this.svg.clientHeight || 600;
    const vb = { x: 0, y: 0, w: width, h: height };
    this.svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    return vb;
  }

  _setViewBox(next) {
    this.viewBox = next;
    this.svg.setAttribute('viewBox', `${next.x} ${next.y} ${next.w} ${next.h}`);
  }

  _bindPanZoom() {
    if (!this.options.panZoom) return;
    window.addEventListener('keydown', (evt) => {
      if (evt.code === 'Space') this.isPanning = true;
    });
    window.addEventListener('keyup', (evt) => {
      if (evt.code === 'Space') this.isPanning = false;
    });

    if (this.options.wheelZoom) {
      this.svg.addEventListener('wheel', (evt) => {
        evt.preventDefault();
        const scale = evt.deltaY > 0 ? 1.1 : 0.9;
        const pt = getPointerPosition(evt, this.svg);
        const { x, y, w, h } = this.viewBox;
        const nx = pt.x - (pt.x - x) * scale;
        const ny = pt.y - (pt.y - y) * scale;
        this._setViewBox({ x: nx, y: ny, w: w * scale, h: h * scale });
      });
    }
  }

  _handleCanvasPointerDown(evt) {
    this.selectNode(null);
    this.selectLink(null);
    if (this.isPanning && evt.target === this.svg) {
      const start = { x: evt.clientX, y: evt.clientY, ...this.viewBox };
      const move = (moveEvt) => {
        const dx = moveEvt.clientX - start.x;
        const dy = moveEvt.clientY - start.y;
        this._setViewBox({ x: start.x - dx, y: start.y - dy, w: start.w, h: start.h });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
      return;
    }

    if (evt.shiftKey && evt.target === this.svg) {
      this._startLasso(evt);
    }
  }

  _startLasso(evt) {
    const start = getPointerPosition(evt, this.svg);
    if (!this.lasso) {
      this.lasso = createEl('rect', {
        class: 'hpf-lasso',
        fill: 'rgba(59, 130, 246, 0.1)',
        stroke: '#3b82f6',
        'stroke-width': 1
      });
    }
    this.svg.append(this.lasso);

    const move = (moveEvt) => {
      const pos = getPointerPosition(moveEvt, this.svg);
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const width = Math.abs(pos.x - start.x);
      const height = Math.abs(pos.y - start.y);
      setAttrs(this.lasso, { x, y, width, height });
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (this.lasso) {
        const box = this.lasso.getBBox();
        this.lasso.remove();
        this.lasso = null;
        this._selectWithin(box);
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  _selectWithin(box) {
    this.selectedNodes.forEach((item) => item.group.classList.remove('is-selected'));
    this.selectedNodes.clear();
    this.nodes.forEach((node) => {
      const bounds = node.getBounds();
      if (
        bounds.x >= box.x &&
        bounds.y >= box.y &&
        bounds.x + bounds.width <= box.x + box.width &&
        bounds.y + bounds.height <= box.y + box.height
      ) {
        this.selectedNodes.add(node);
        node.group.classList.add('is-selected');
      }
    });
    this.bus.emit('node:select', [...this.selectedNodes]);
  }

  _openContextMenu(evt) {
    const nodeEl = evt.target.closest('.hpf-node');
    if (!nodeEl) return;
    evt.preventDefault();
    this._destroyContextMenu();
    const menu = document.createElement('div');
    menu.className = 'hpf-context-menu';
    menu.style.left = `${evt.clientX}px`;
    menu.style.top = `${evt.clientY}px`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete Node';
    remove.addEventListener('click', () => {
      const id = nodeEl.getAttribute('data-id');
      this.removeNode(id);
      this._destroyContextMenu();
    });
    menu.append(remove);
    document.body.append(menu);
    this.contextMenu = menu;
    const dismiss = () => this._destroyContextMenu();
    window.addEventListener('click', dismiss, { once: true });
  }

  _destroyContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  _handleCollision(node) {
    if (!this.options.collision) return;
    const bounds = node.getBounds();
    for (const other of this.nodes.values()) {
      if (other.id === node.id) continue;
      const ob = other.getBounds();
      const overlap =
        bounds.x < ob.x + ob.width &&
        bounds.x + bounds.width > ob.x &&
        bounds.y < ob.y + ob.height &&
        bounds.y + bounds.height > ob.y;
      if (overlap) {
        const start = this.dragStartPositions.get(node.id);
        if (start) node.setPosition(start.x, start.y);
        break;
      }
    }
  }
}

export function createDiagramEditor(options) {
  return new DiagramEditor(options.svg || options.container, options);
}
