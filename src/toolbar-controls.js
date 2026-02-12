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
    this.activeNode = null;
    this.activeLink = null;

    this.root = document.createElement('div');
    this.root.className = 'hpf-toolbar';

    this.buttons = {
      addNode: createButton('Add Node', 'Insert a new node'),
      addLink: createButton('Link Mode', 'Drag between ports'),
      delete: createButton('Delete', 'Delete selected'),
      zoomIn: createButton('Zoom In', 'Zoom in'),
      zoomOut: createButton('Zoom Out', 'Zoom out'),
      undo: createButton('Undo', 'Undo last action'),
      redo: createButton('Redo', 'Redo last action'),
      exportJson: createButton('Export JSON', 'Download JSON'),
      exportSvg: createButton('Export SVG', 'Download SVG'),
      prev: createButton('Prev', 'Previous slide'),
      next: createButton('Next', 'Next slide')
    };

    Object.values(this.buttons).forEach((button) => this.root.append(button));
    this.container.append(this.root);

    this.panel = document.createElement('div');
    this.panel.className = 'hpf-toolbar-panel';
    this._buildInspector();
    this._buildSearch();
    this._buildNotes();
    this._buildThemeSwitcher();
    this.container.append(this.panel);

    this._bind();
    this._bindEditor();
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

    this.buttons.delete.addEventListener('click', () => {
      if (this.activeNode) {
        this.editor?.removeNode(this.activeNode.id);
        this.activeNode = null;
      }
      if (this.activeLink) {
        this.editor?.removeLink(this.activeLink);
        this.activeLink = null;
      }
      this.bus.emit('toolbar:delete');
    });

    this.buttons.zoomIn.addEventListener('click', () => {
      this.editor?._setViewBox({
        x: this.editor.viewBox.x,
        y: this.editor.viewBox.y,
        w: this.editor.viewBox.w * 0.9,
        h: this.editor.viewBox.h * 0.9
      });
      this.bus.emit('toolbar:zoom-in');
    });

    this.buttons.zoomOut.addEventListener('click', () => {
      this.editor?._setViewBox({
        x: this.editor.viewBox.x,
        y: this.editor.viewBox.y,
        w: this.editor.viewBox.w * 1.1,
        h: this.editor.viewBox.h * 1.1
      });
      this.bus.emit('toolbar:zoom-out');
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

  _buildInspector() {
    this.inspector = document.createElement('div');
    this.inspector.className = 'hpf-inspector';
    const title = document.createElement('div');
    title.className = 'hpf-panel-title';
    title.textContent = 'Inspector';
    this.labelInput = document.createElement('input');
    this.labelInput.type = 'text';
    this.labelInput.placeholder = 'Label';
    this.fillInput = document.createElement('input');
    this.fillInput.type = 'color';
    this.strokeInput = document.createElement('input');
    this.strokeInput.type = 'color';
    this.inspector.append(title, this.labelInput, this.fillInput, this.strokeInput);
    this.panel.append(this.inspector);

    this.labelInput.addEventListener('input', () => {
      if (!this.activeNode) return;
      this.activeNode.setLabel(this.labelInput.value);
      this.bus.emit('toolbar:label', this.labelInput.value);
    });

    this.fillInput.addEventListener('input', () => {
      if (!this.activeNode) return;
      this.activeNode.setStyle({ fill: this.fillInput.value });
      this.bus.emit('toolbar:fill', this.fillInput.value);
    });

    this.strokeInput.addEventListener('input', () => {
      if (!this.activeNode) return;
      this.activeNode.setStyle({ stroke: this.strokeInput.value });
      this.bus.emit('toolbar:stroke', this.strokeInput.value);
    });
  }

  _buildSearch() {
    this.searchPanel = document.createElement('div');
    this.searchPanel.className = 'hpf-search';
    const title = document.createElement('div');
    title.className = 'hpf-panel-title';
    title.textContent = 'Search';
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.placeholder = 'Filter nodes...';
    this.searchPanel.append(title, this.searchInput);
    this.panel.append(this.searchPanel);
    this.searchInput.addEventListener('input', () => {
      this.bus.emit('toolbar:search', this.searchInput.value);
    });
  }

  _buildNotes() {
    this.notesPanel = document.createElement('div');
    this.notesPanel.className = 'hpf-notes-panel';
    const title = document.createElement('div');
    title.className = 'hpf-panel-title';
    title.textContent = 'Slide Notes';
    this.notesInput = document.createElement('textarea');
    this.notesInput.rows = 4;
    this.notesInput.placeholder = 'Notes for current slide...';
    this.notesPanel.append(title, this.notesInput);
    this.panel.append(this.notesPanel);
    this.notesInput.addEventListener('input', () => {
      this.bus.emit('toolbar:notes', this.notesInput.value);
    });
  }

  _buildThemeSwitcher() {
    this.themePanel = document.createElement('div');
    this.themePanel.className = 'hpf-theme';
    const title = document.createElement('div');
    title.className = 'hpf-panel-title';
    title.textContent = 'Theme';
    this.themeSelect = document.createElement('select');
    ['default', 'light', 'dark'].forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      this.themeSelect.append(option);
    });
    this.themePanel.append(title, this.themeSelect);
    this.panel.append(this.themePanel);
    this.themeSelect.addEventListener('change', () => {
      document.documentElement.setAttribute('data-hpf-theme', this.themeSelect.value);
      this.bus.emit('toolbar:theme', this.themeSelect.value);
    });
  }

  _bindEditor() {
    if (!this.editor) return;
    this.editor.on('node:select', (node) => {
      const picked = Array.isArray(node) ? node[0] : node;
      this.activeNode = picked || null;
      if (!this.activeNode) return;
      this.labelInput.value = this.activeNode.labelText || '';
      const fill = this.activeNode.body.getAttribute('fill') || '#ffffff';
      const stroke = this.activeNode.body.getAttribute('stroke') || '#1f2937';
      this.fillInput.value = fill.startsWith('#') ? fill : '#ffffff';
      this.strokeInput.value = stroke.startsWith('#') ? stroke : '#1f2937';
    });

    this.editor.on('link:select', (edge) => {
      this.activeLink = edge || null;
    });
  }
}

export function createToolbarControls(options) {
  return new ToolbarControls(options.container, options);
}
