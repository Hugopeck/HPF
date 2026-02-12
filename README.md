# HPF (HTML Presentation Framework)

A single-file, SVG-first presentation toolkit built from small, copy-pasteable modules. HPF focuses on interactive diagrams, graphs, and slide-style narratives that run in any modern browser with no build step or external dependencies.

## Features
- Single-file friendly: all JS/CSS can live in one HTML document.
- Modular JS snippets: pick only the parts you need.
- Interactive diagramming: nodes, links, selection, drag, resize.
- Presentation flow: slides, transitions, thumbnails, progress, notes.
- Graph rendering: line/bar/scatter with zoom, brush, tooltips, and legend.
- Opinionated styling module included for MVP.

## Modules
All modules are vanilla JS and live in `src/`.

- `src/core-utils.js`: SVG/DOM helpers, event bus, store, debounce, UUID, RAF throttling.
- `src/node-shapes.js`: draggable/resizable nodes, multiple shapes, editable labels, ports, tooltips.
- `src/link-edges.js`: straight/curved/orthogonal links, labels, bend handle, delete/reconnect.
- `src/diagram-editor.js`: add/remove nodes & links, pan/zoom, lasso select, undo/redo, export.
- `src/presentation-manager.js`: slides, transitions, thumbnails, progress, notes panel.
- `src/graph-renderer.js`: line/bar/scatter plots, axes ticks, legend, zoom/brush, tooltips, animations.
- `src/toolbar-controls.js`: toolbar buttons, inspector, search, notes, theme switcher.
- `src/styling-module.css`: MVP styling module (copy-paste into `<style>`).

## Quick Start
Create a single HTML file and inline the modules you need.

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>HPF Demo</title>
    <style>
      /* paste src/styling-module.css here */
    </style>
  </head>
  <body>
    <svg id="diagram" width="900" height="600"></svg>
    <div id="toolbar"></div>

    <script type="module">
      import { createDiagramEditor } from './src/diagram-editor.js';
      import { createToolbarControls } from './src/toolbar-controls.js';

      const editor = createDiagramEditor({ svg: '#diagram' });
      const toolbar = createToolbarControls({ container: '#toolbar', editor });

      editor.addNode({
        label: 'Start',
        shape: 'rect',
        ports: [{ side: 'right', offset: 0.5 }]
      });
    </script>
  </body>
</html>
```

## Examples

Get started quickly with ready-to-use examples:

- **[boilerplate.html](boilerplate.html)** - Minimal starter template with commented code and instructions
- **[examples/flowchart.html](examples/flowchart.html)** - Interactive flowchart editor with drag-and-drop nodes, connectable ports, and full editing capabilities
- **[examples/presentation.html](examples/presentation.html)** - Multi-slide system architecture presentation with navigation, transitions, and speaker notes
- **[examples/data-viz.html](examples/data-viz.html)** - Interactive data visualization dashboard with multiple chart types, zoom, and tooltips

All examples are self-contained HTML files that work offline. Simply open them in a browser to see HPF in action, then view source to learn how they work.

## Styling Module (MVP)
The MVP styling is shipped as `src/styling-module.css`. Paste it into your HTML's `<style>` tag. Additional styles/themes are planned as optional snippets later.

## API Highlights
- `createDiagramEditor({ svg, data })`
- `editor.addNode({ shape, label, x, y, ports })`
- `editor.addLink(source, target, { type, label })`
- `createPresentationManager({ container })`
- `createGraphRenderer({ container, data })`
- `createToolbarControls({ container, editor, presentation, graph })`

## Project Structure
```
src/
  core-utils.js
  node-shapes.js
  link-edges.js
  diagram-editor.js
  presentation-manager.js
  graph-renderer.js
  toolbar-controls.js
  styling-module.css
```

## Roadmap
- v1.0: MVP modules + styling module.
- v1.1+: auto-routing, auto-layout, PNG export, math/text, extra themes.

## Contributing
Issues and PRs are welcome. Keep contributions small, dependency-free, and easy to copy into a single HTML file.

## License
MIT. See `LICENSE`.
