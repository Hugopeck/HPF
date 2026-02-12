import { createEventBus } from './core-utils.js';

function createButton(label, title) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hpf-toolbar-button';
  button.textContent = label;
  if (title) button.title = title;
  return button;
}

export class ToolbarControls {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.editor = options.editor || null;
    this.presentation = options.presentation || null;
    this.graph = options.graph || null;
    this.bus = createEventBus();

    this.root = document.createElement('div');
    this.root.className = 'hpf-toolbar';

    this.buttons = {
      addNode: createButton('Add Node', 'Insert a new node'),
      addLink: createButton('Link Mode', 'Drag between ports'),
      undo: createButton('Undo', 'Undo last action'),
      redo: createButton('Redo', 'Redo last action'),
      exportJson: createButton('Export JSON', 'Download JSON'),
      exportSvg: createButton('Export SVG', 'Download SVG'),
      prev: createButton('Prev', 'Previous slide'),
      next: createButton('Next', 'Next slide')
    };

    Object.values(this.buttons).forEach((button) => this.root.append(button));
    this.container.append(this.root);

    this._bind();
  }

  on(event, handler) {
    return this.bus.on(event, handler);
  }

  _bind() {
    this.buttons.addNode.addEventListener('click', () => {
      if (!this.editor) return;
      this.editor.addNode({
        x: 80,
        y: 80,
        label: `Node ${this.editor.nodes.size + 1}`,
        ports: [{ side: 'right', offset: 0.5 }, { side: 'left', offset: 0.5 }]
      });
      this.bus.emit('toolbar:add-node');
    });

    this.buttons.addLink.addEventListener('click', () => {
      this.root.classList.toggle('link-mode');
      this.bus.emit('toolbar:link-mode', this.root.classList.contains('link-mode'));
    });

    this.buttons.undo.addEventListener('click', () => {
      this.editor?.undo();
      this.bus.emit('toolbar:undo');
    });

    this.buttons.redo.addEventListener('click', () => {
      this.editor?.redo();
      this.bus.emit('toolbar:redo');
    });

    this.buttons.exportJson.addEventListener('click', () => {
      if (!this.editor) return;
      const json = JSON.stringify(this.editor.exportJSON(), null, 2);
      this._download('diagram.json', json, 'application/json');
      this.bus.emit('toolbar:export-json');
    });

    this.buttons.exportSvg.addEventListener('click', () => {
      if (!this.editor) return;
      const svg = this.editor.exportSVG();
      this._download('diagram.svg', svg, 'image/svg+xml');
      this.bus.emit('toolbar:export-svg');
    });

    this.buttons.prev.addEventListener('click', () => {
      this.presentation?.prev();
      this.bus.emit('toolbar:prev');
    });

    this.buttons.next.addEventListener('click', () => {
      this.presentation?.next();
      this.bus.emit('toolbar:next');
    });
  }

  attachGraphRenderer(renderer) {
    this.graph = renderer;
  }

  _download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

export function createToolbarControls(options) {
  return new ToolbarControls(options.container, options);
}
