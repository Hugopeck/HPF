import { createEventBus, createStore, uuid } from './core-utils.js';

export class PresentationManager {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.bus = createEventBus();
    this.store = createStore({ slides: [], activeIndex: 0 });
    this.transition = options.transition || 'fade';
    this.duration = options.duration ?? 400;
    this.slides = [];
    this.options = {
      showNotes: options.showNotes ?? true,
      showThumbnails: options.showThumbnails ?? true,
      showProgress: options.showProgress ?? true,
      fullscreen: options.fullscreen ?? false
    };

    this.container.classList.add('hpf-presentation');
    if (this.options.fullscreen) this.container.classList.add('is-fullscreen');
    this._buildChrome();
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

    this.stage.append(slide);
    this.slides.push({
      el: slide,
      id: slide.dataset.id,
      title: options.title || `Slide ${this.slides.length + 1}`,
      notes: options.notes || ''
    });
    this._renderThumbnails();

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
    const entry = this.slides[index];
    if (!entry) return;
    entry.el.remove();
    this.slides.splice(index, 1);
    this._renderThumbnails();
    const nextIndex = Math.max(0, Math.min(this.store.getState().activeIndex, this.slides.length - 1));
    this._activateSlide(nextIndex, false);
    this._syncStore();
    this.bus.emit('slide:remove', entry.el);
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

    if (current) this._applyTransition(current.el, 'out', animate);
    this._applyTransition(next.el, 'in', animate);

    this.store.setState({ activeIndex: index });
    this._updateNotes(next);
    this._updateProgress();
    this._highlightThumbnail(index);
    this.bus.emit('slide:change', { index, slide: next.el });
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
    this.store.setState({
      slides: this.slides.map((slide) => slide.el),
      activeIndex: this.store.getState().activeIndex
    });
  }

  _buildChrome() {
    this.stage = document.createElement('div');
    this.stage.className = 'hpf-stage';
    this.container.append(this.stage);

    if (this.options.showProgress) {
      this.progress = document.createElement('div');
      this.progress.className = 'hpf-progress';
      this.progressBar = document.createElement('div');
      this.progressBar.className = 'hpf-progress-bar';
      this.progress.append(this.progressBar);
      this.container.append(this.progress);
    }

    if (this.options.showThumbnails) {
      this.thumbnails = document.createElement('div');
      this.thumbnails.className = 'hpf-thumbnails';
      this.container.append(this.thumbnails);
    }

    if (this.options.showNotes) {
      this.notesPanel = document.createElement('div');
      this.notesPanel.className = 'hpf-notes';
      this.notesPanelTitle = document.createElement('div');
      this.notesPanelTitle.className = 'hpf-notes-title';
      this.notesPanelBody = document.createElement('div');
      this.notesPanelBody.className = 'hpf-notes-body';
      this.notesPanel.append(this.notesPanelTitle, this.notesPanelBody);
      this.container.append(this.notesPanel);
    }
  }

  _renderThumbnails() {
    if (!this.thumbnails) return;
    this.thumbnails.innerHTML = '';
    this.slides.forEach((slide, idx) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hpf-thumbnail';
      button.textContent = slide.title || `Slide ${idx + 1}`;
      button.addEventListener('click', () => this.goTo(idx));
      this.thumbnails.append(button);
    });
    this._highlightThumbnail(this.store.getState().activeIndex);
  }

  _highlightThumbnail(index) {
    if (!this.thumbnails) return;
    [...this.thumbnails.children].forEach((child, idx) => {
      child.classList.toggle('is-active', idx === index);
    });
  }

  _updateProgress() {
    if (!this.progressBar) return;
    const total = Math.max(1, this.slides.length);
    const current = this.store.getState().activeIndex + 1;
    const pct = (current / total) * 100;
    this.progressBar.style.width = `${pct}%`;
  }

  _updateNotes(slide) {
    if (!this.notesPanel) return;
    this.notesPanelTitle.textContent = slide.title || 'Notes';
    this.notesPanelBody.textContent = slide.notes || '';
  }
}

export function createPresentationManager(options) {
  return new PresentationManager(options.container, options);
}
