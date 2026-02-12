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
    this.lastData = null;
    this.animate = options.animate ?? true;
    this.duration = options.duration ?? 320;

    this.root = createEl('g', { class: 'hpf-graph' });
    this.plot = createEl('g', { class: 'hpf-plot' });
    this.axes = createEl('g', { class: 'hpf-axes' });
    this.legend = createEl('g', { class: 'hpf-legend' });
    this.overlay = createEl('rect', {
      x: this.margin.left,
      y: this.margin.top,
      width: this.width - this.margin.left - this.margin.right,
      height: this.height - this.margin.top - this.margin.bottom,
      fill: 'transparent'
    });
    this.root.append(this.plot, this.axes, this.legend, this.overlay);
    this.svg.append(this.root);

    setAttrs(this.svg, { viewBox: `0 0 ${this.width} ${this.height}` });
    this._ensureTooltip();
  }

  setData(data) {
    this.data = data || [];
    this.update({ data: this.data, type: this.lastType || 'line', animate: this.animate });
  }

  update({ data, type = 'line', animate = true } = {}) {
    this.data = data || [];
    this._render(type, animate);
  }

  render(type = 'line') {
    this._render(type, this.animate);
  }

  _render(type = 'line', animate = true) {
    this.plot.innerHTML = '';
    this.axes.innerHTML = '';
    this.legend.innerHTML = '';
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

    const renderData = (data) => {
      if (type === 'line') this._renderLine(xScale, yScale, data);
      if (type === 'scatter') this._renderScatter(xScale, yScale, data);
      if (type === 'bar') this._renderBars(xScale, yScale, innerHeight, data);
      this._renderAxes(xScale, yScale, { xMin, xMax, yMin, yMax });
      this._renderLegend(data);
    };

    if (animate && this.lastData) {
      this._animateTransition(this.lastData, this.data, renderData);
    } else {
      renderData(this.data);
    }

    this.lastData = JSON.parse(JSON.stringify(this.data));
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

  _renderLine(xScale, yScale, data) {
    this.lastType = 'line';
    data.forEach((series) => {
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
      series.values.forEach((point) => {
        const circle = createEl('circle', {
          cx: xScale(point.x),
          cy: yScale(point.y),
          r: 4,
          fill: series.color || '#0f172a',
          opacity: 0.0
        });
        this.plot.append(circle);
        this._attachTooltip(circle, `${series.name || 'Series'}: (${point.x}, ${point.y})`);
      });
    });
  }

  _renderScatter(xScale, yScale, data) {
    this.lastType = 'scatter';
    data.forEach((series) => {
      series.values.forEach((point) => {
        const circle = createEl('circle', {
          cx: xScale(point.x),
          cy: yScale(point.y),
          r: 4,
          fill: series.color || '#0f172a'
        });
        this.plot.append(circle);
        this._attachTooltip(circle, `${series.name || 'Series'}: (${point.x}, ${point.y})`);
      });
    });
  }

  _renderBars(xScale, yScale, innerHeight, data) {
    this.lastType = 'bar';
    const barWidth = 24;
    data.forEach((series) => {
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
        this._attachTooltip(rect, `${series.name || 'Series'}: (${point.x}, ${point.y})`);
      });
    });
  }

  _renderAxes(xScale, yScale, domain) {
    const axisColor = '#64748b';
    const ticks = 5;
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
    this.axes.append(xAxis, yAxis);

    for (let i = 0; i <= ticks; i += 1) {
      const t = i / ticks;
      const x = this.margin.left + t * (this.width - this.margin.left - this.margin.right);
      const y = this.height - this.margin.bottom;
      const tick = createEl('line', { x1: x, y1: y, x2: x, y2: y + 6, stroke: axisColor });
      const label = createEl('text', {
        x,
        y: y + 16,
        'text-anchor': 'middle',
        fill: axisColor,
        'font-size': 10
      });
      label.textContent = (domain.xMin + (domain.xMax - domain.xMin) * t).toFixed(1);
      this.axes.append(tick, label);
    }

    for (let i = 0; i <= ticks; i += 1) {
      const t = i / ticks;
      const y = this.margin.top + t * (this.height - this.margin.top - this.margin.bottom);
      const x = this.margin.left;
      const tick = createEl('line', { x1: x - 6, y1: y, x2: x, y2: y, stroke: axisColor });
      const label = createEl('text', {
        x: x - 8,
        y: y + 3,
        'text-anchor': 'end',
        fill: axisColor,
        'font-size': 10
      });
      label.textContent = (domain.yMax - (domain.yMax - domain.yMin) * t).toFixed(1);
      this.axes.append(tick, label);
    }
  }

  _renderLegend(data) {
    const startX = this.width - this.margin.right - 100;
    let y = this.margin.top;
    data.forEach((series) => {
      const swatch = createEl('rect', {
        x: startX,
        y,
        width: 10,
        height: 10,
        fill: series.color || '#0f172a'
      });
      const label = createEl('text', {
        x: startX + 16,
        y: y + 9,
        'font-size': 10,
        fill: '#0f172a'
      });
      label.textContent = series.name || 'Series';
      this.legend.append(swatch, label);
      y += 16;
    });
  }

  _animateTransition(prev, next, renderFn) {
    const start = performance.now();
    const duration = this.duration;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t * (2 - t);
      const interpolated = next.map((series, idx) => {
        const prevSeries = prev[idx] || series;
        const values = series.values.map((point, pIdx) => {
          const prevPoint = prevSeries.values?.[pIdx] || point;
          return {
            x: prevPoint.x + (point.x - prevPoint.x) * eased,
            y: prevPoint.y + (point.y - prevPoint.y) * eased
          };
        });
        return { ...series, values };
      });
      renderFn(interpolated);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  _ensureTooltip() {
    const host = this.svg.parentElement || document.body;
    const style = window.getComputedStyle(host);
    if (style.position === 'static') {
      host.style.position = 'relative';
    }
    this.tooltip = host.querySelector('.hpf-graph-tooltip');
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'hpf-graph-tooltip';
      host.append(this.tooltip);
    }
  }

  _attachTooltip(el, text) {
    el.addEventListener('pointerenter', (evt) => {
      this.tooltip.textContent = text;
      this.tooltip.style.opacity = '1';
      const rect = this.svg.getBoundingClientRect();
      this.tooltip.style.left = `${evt.clientX - rect.left + 8}px`;
      this.tooltip.style.top = `${evt.clientY - rect.top + 8}px`;
    });
    el.addEventListener('pointerleave', () => {
      this.tooltip.style.opacity = '0';
    });
  }
}

export function createGraphRenderer(options) {
  return new GraphRenderer(options.svg || options.container, options);
}
