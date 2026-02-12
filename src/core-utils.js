const SVG_NS = 'http://www.w3.org/2000/svg';

export function createEl(tag, attrs = {}, ns = SVG_NS) {
  const el = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  setAttrs(el, attrs);
  return el;
}

export function setAttrs(el, attrs = {}) {
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
      return;
    }
    if (key in el) {
      try {
        el[key] = value;
        return;
      } catch (err) {
        // fall through to setAttribute for non-writable props
      }
    }
    el.setAttribute(key, String(value));
  });
}

export function createEventBus() {
  const listeners = new Map();
  return {
    on(event, handler) {
      const set = listeners.get(event) || new Set();
      set.add(handler);
      listeners.set(event, set);
      return () => set.delete(handler);
    },
    once(event, handler) {
      const off = this.on(event, (...args) => {
        off();
        handler(...args);
      });
      return off;
    },
    off(event, handler) {
      const set = listeners.get(event);
      if (set) set.delete(handler);
    },
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      [...set].forEach((handler) => handler(payload));
    },
    clear() {
      listeners.clear();
    }
  };
}

export function createStore(initialState = {}) {
  let state = { ...initialState };
  const subscribers = new Set();
  return {
    getState() {
      return { ...state };
    },
    setState(nextState) {
      state = { ...state, ...nextState };
      subscribers.forEach((fn) => fn(this.getState()));
    },
    update(updater) {
      const next = updater(this.getState());
      if (next && typeof next === 'object') {
        this.setState(next);
      }
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    }
  };
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function uuid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getPointerPosition(evt, referenceEl) {
  const pt = referenceEl.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const transform = referenceEl.getScreenCTM();
  if (!transform) return { x: evt.clientX, y: evt.clientY };
  const result = pt.matrixTransform(transform.inverse());
  return { x: result.x, y: result.y };
}
