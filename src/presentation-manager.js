import { createEventBus, createStore, uuid } from './core-utils.js';

export class PresentationManager {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bus = createEventBus();
    this.store = createStore({ slides: [], activeIndex: 0 });
    this.transition = options.transition || 'fade';
    this.duration = options.duration ?? 400;
    this.slides = [];

    this.container.classList.add('hpf-presentation');
    this._bindKeyboard();
  }

  on(event, handler) {
    return this.bus.on(event, handler);
  }

  addSlide(content, options = {}) {
    const slide = document.createElement('div');
    slide.className = 'hpf-slide';
    slide.dataset.id = options.id || uuid('slide');
    slide.style.transitionDuration = `${this.duration}ms`;

    if (typeof content === 'string') {
      slide.innerHTML = content;
    } else if (content instanceof HTMLElement || content instanceof SVGElement) {
      slide.append(content);
    }

    this.container.append(slide);
    this.slides.push(slide);

    if (this.slides.length === 1) {
      this._activateSlide(0, false);
    } else {
      slide.classList.add('is-hidden');
    }

    this._syncStore();
    this.bus.emit('slide:add', slide);
    return slide;
  }

  removeSlide(index) {
    const slide = this.slides[index];
    if (!slide) return;
    slide.remove();
    this.slides.splice(index, 1);
    const nextIndex = Math.max(0, Math.min(this.store.getState().activeIndex, this.slides.length - 1));
    this._activateSlide(nextIndex, false);
    this._syncStore();
    this.bus.emit('slide:remove', slide);
  }

  goTo(index) {
    if (index < 0 || index >= this.slides.length) return;
    this._activateSlide(index, true);
  }

  next() {
    this.goTo(this.store.getState().activeIndex + 1);
  }

  prev() {
    this.goTo(this.store.getState().activeIndex - 1);
  }

  setTransition(type) {
    this.transition = type;
  }

  _activateSlide(index, animate = true) {
    const { activeIndex } = this.store.getState();
    if (activeIndex === index) return;
    const current = this.slides[activeIndex];
    const next = this.slides[index];
    if (!next) return;

    if (current) this._applyTransition(current, 'out', animate);
    this._applyTransition(next, 'in', animate);

    this.store.setState({ activeIndex: index });
    this.bus.emit('slide:change', { index, slide: next });
  }

  _applyTransition(slide, direction, animate) {
    slide.classList.remove('is-hidden', 'is-in', 'is-out', 'transition-fade', 'transition-slide');
    slide.classList.add(`transition-${this.transition}`);

    if (!animate) {
      slide.classList.toggle('is-hidden', direction === 'out');
      return;
    }

    if (direction === 'in') {
      slide.classList.remove('is-hidden');
      slide.classList.add('is-in');
      requestAnimationFrame(() => slide.classList.remove('is-in'));
    } else {
      slide.classList.add('is-out');
      setTimeout(() => {
        slide.classList.add('is-hidden');
        slide.classList.remove('is-out');
      }, this.duration);
    }
  }

  _bindKeyboard() {
    this._onKeyDown = (evt) => {
      if (evt.key === 'ArrowRight' || evt.key === 'PageDown') {
        this.next();
      }
      if (evt.key === 'ArrowLeft' || evt.key === 'PageUp') {
        this.prev();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  _syncStore() {
    this.store.setState({ slides: this.slides, activeIndex: this.store.getState().activeIndex });
  }
}

export function createPresentationManager(options) {
  return new PresentationManager(options.container, options);
}
