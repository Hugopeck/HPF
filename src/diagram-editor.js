import { createEventBus, createStore, uuid, getPointerPosition } from './core-utils.js';
import { createNodeShape } from './node-shapes.js';
import { LinkManager, attachPortDrag } from './link-edges.js';

export class DiagramEditor {
  constructor(svg, options = {}) {
    this.svg = typeof svg === 'string' ? document.querySelector(svg) : svg;
    this.bus = createEventBus();
    this.store = createStore({ nodes: [], links: [] });
    this.nodes = new Map();
    this.links = new Set();
    this.linkManager = new LinkManager(this.svg);
    this.undoStack = [];
    this.redoStack = [];
    this.selected = null;

    this.svg.addEventListener('pointerdown', () => this.selectNode(null));

    if (options.data) {
      this.load(options.data);
    }
  }

  on(event, handler) {
    return this.bus.on(event, handler);
  }

  addNode(options = {}) {
    const node = createNodeShape(this.svg, { id: uuid('node'), ...options });
    node.on('move', () => this.linkManager.updateAll());
    node.on('resize', () => this.linkManager.updateAll());
    node.group.addEventListener('pointerdown', (evt) => {
      evt.stopPropagation();
      this.selectNode(node);
    });

    node.ports.forEach((port) => this._attachPort(port, node));
    if (options.ports) {
      node.ports.forEach((port) => this._attachPort(port, node));
    }

    this.nodes.set(node.id, node);
    this._record({
      type: 'add-node',
      do: () => {},
      undo: () => this.removeNode(node.id)
    });
    this._syncStore();
    this.bus.emit('node:add', node);
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
  }

  addLink(source, target) {
    const edge = this.linkManager.createEdge(source, target);
    this.links.add(edge);
    this._record({
      type: 'add-link',
      do: () => {},
      undo: () => this.removeLink(edge)
    });
    this._syncStore();
    this.bus.emit('link:add', edge);
    return edge;
  }

  removeLink(edge) {
    if (!this.links.has(edge)) return;
    this.linkManager.removeEdge(edge);
    this.links.delete(edge);
    this._syncStore();
    this.bus.emit('link:remove', edge);
  }

  selectNode(node) {
    if (this.selected?.group) {
      this.selected.group.classList.remove('is-selected');
    }
    this.selected = node;
    if (node?.group) {
      node.group.classList.add('is-selected');
    }
    this.bus.emit('node:select', node);
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
}

export function createDiagramEditor(options) {
  return new DiagramEditor(options.svg || options.container, options);
}
