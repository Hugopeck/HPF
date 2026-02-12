import { createEl, setAttrs, clamp } from './core-utils.js';

function extent(values) {
  return [Math.min(...values), Math.max(...values)];
}

function linearScale(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const m = (r1 - r0) / (d1 - d0 || 1);
  return (value) => r0 + (value - d0) * m;
}

export class GraphRenderer {
  constructor(svg, options = {}) {
    this.svg = typeof svg === 'string' ? document.querySelector(svg) : svg;
    this.width = options.width ?? 600;
    this.height = options.height ?? 360;
    this.margin = { top: 24, right: 24, bottom: 40, left: 48, ...options.margin };
    this.zoom = { kx: 1, ky: 1, ox: 0, oy: 0 };
    this.brush = null;
    this.data = [];

    this.root = createEl('g', { class: 'hpf-graph' });
    this.plot = createEl('g', { class: 'hpf-plot' });
    this.axes = createEl('g', { class: 'hpf-axes' });
    this.overlay = createEl('rect', {
      x: this.margin.left,
      y: this.margin.top,
      width: this.width - this.margin.left - this.margin.right,
      height: this.height - this.margin.top - this.margin.bottom,
      fill: 'transparent'
    });
    this.root.append(this.plot, this.axes, this.overlay);
    this.svg.append(this.root);

    setAttrs(this.svg, { viewBox: `0 0 ${this.width} ${this.height}` });
  }

  setData(data) {
    this.data = data || [];
    this.render();
  }

  render(type = 'line') {
    this.plot.innerHTML = '';
    this.axes.innerHTML = '';
    if (!this.data.length) return;

    const points = this.data.flatMap((series) => series.values);
    const xValues = points.map((p) => p.x);
    const yValues = points.map((p) => p.y);

    const [xMin, xMax] = extent(xValues);
    const [yMin, yMax] = extent(yValues);

    const innerWidth = this.width - this.margin.left - this.margin.right;
    const innerHeight = this.height - this.margin.top - this.margin.bottom;

    const xScale = linearScale(
      [xMin + this.zoom.ox, xMax + this.zoom.ox],
      [this.margin.left, this.margin.left + innerWidth * this.zoom.kx]
    );
    const yScale = linearScale(
      [yMin + this.zoom.oy, yMax + this.zoom.oy],
      [this.margin.top + innerHeight * this.zoom.ky, this.margin.top]
    );

    if (type === 'line') this._renderLine(xScale, yScale);
    if (type === 'scatter') this._renderScatter(xScale, yScale);
    if (type === 'bar') this._renderBars(xScale, yScale, innerHeight);

    this._renderAxes(xScale, yScale, { xMin, xMax, yMin, yMax });
  }

  enableZoom() {
    this.overlay.addEventListener('wheel', (evt) => {
      evt.preventDefault();
      const direction = evt.deltaY > 0 ? 0.9 : 1.1;
      this.zoom.kx = clamp(this.zoom.kx * direction, 0.5, 4);
      this.zoom.ky = clamp(this.zoom.ky * direction, 0.5, 4);
      this.render(this.lastType || 'line');
    });
  }

  enableBrush(onBrush) {
    let start = null;
    const rect = createEl('rect', {
      fill: 'rgba(15, 23, 42, 0.15)',
      stroke: '#0f172a',
      'stroke-width': 1
    });

    this.overlay.addEventListener('pointerdown', (evt) => {
      const bbox = this.overlay.getBoundingClientRect();
      start = { x: evt.clientX - bbox.left, y: evt.clientY - bbox.top };
      this.brush = rect;
      this.plot.append(rect);
    });

    const move = (evt) => {
      if (!start) return;
      const bbox = this.overlay.getBoundingClientRect();
      const current = { x: evt.clientX - bbox.left, y: evt.clientY - bbox.top };
      const x = Math.min(start.x, current.x) + this.margin.left;
      const y = Math.min(start.y, current.y) + this.margin.top;
      const width = Math.abs(start.x - current.x);
      const height = Math.abs(start.y - current.y);
      setAttrs(rect, { x, y, width, height });
    };

    const up = () => {
      if (!start) return;
      const selection = rect.getBBox();
      start = null;
      rect.remove();
      this.brush = null;
      onBrush?.(selection);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  _renderLine(xScale, yScale) {
    this.lastType = 'line';
    this.data.forEach((series) => {
      const path = series.values
        .map((point, idx) => {
          const x = xScale(point.x);
          const y = yScale(point.y);
          return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');
      const line = createEl('path', {
        d: path,
        fill: 'none',
        stroke: series.color || '#0f172a',
        'stroke-width': 2
      });
      this.plot.append(line);
    });
  }

  _renderScatter(xScale, yScale) {
    this.lastType = 'scatter';
    this.data.forEach((series) => {
      series.values.forEach((point) => {
        const circle = createEl('circle', {
          cx: xScale(point.x),
          cy: yScale(point.y),
          r: 4,
          fill: series.color || '#0f172a'
        });
        this.plot.append(circle);
      });
    });
  }

  _renderBars(xScale, yScale, innerHeight) {
    this.lastType = 'bar';
    const barWidth = 24;
    this.data.forEach((series) => {
      series.values.forEach((point) => {
        const x = xScale(point.x) - barWidth / 2;
        const y = yScale(point.y);
        const height = this.margin.top + innerHeight - y;
        const rect = createEl('rect', {
          x,
          y,
          width: barWidth,
          height,
          fill: series.color || '#0f172a'
        });
        this.plot.append(rect);
      });
    });
  }

  _renderAxes(xScale, yScale, domain) {
    const axisColor = '#64748b';
    const xAxis = createEl('line', {
      x1: this.margin.left,
      y1: this.height - this.margin.bottom,
      x2: this.width - this.margin.right,
      y2: this.height - this.margin.bottom,
      stroke: axisColor,
      'stroke-width': 1
    });
    const yAxis = createEl('line', {
      x1: this.margin.left,
      y1: this.margin.top,
      x2: this.margin.left,
      y2: this.height - this.margin.bottom,
      stroke: axisColor,
      'stroke-width': 1
    });
    const xLabel = createEl('text', {
      x: this.width - this.margin.right,
      y: this.height - 12,
      'text-anchor': 'end',
      fill: axisColor,
      'font-size': 11
    });
    xLabel.textContent = `${domain.xMin} - ${domain.xMax}`;

    const yLabel = createEl('text', {
      x: 6,
      y: this.margin.top,
      'text-anchor': 'start',
      fill: axisColor,
      'font-size': 11
    });
    yLabel.textContent = `${domain.yMax} - ${domain.yMin}`;

    this.axes.append(xAxis, yAxis, xLabel, yLabel);
  }
}

export function createGraphRenderer(options) {
  return new GraphRenderer(options.svg || options.container, options);
}
