import { untrack } from 'svelte';
import { ModalLayoutController } from './ModalLayoutController.svelte';
import type { TranslationModalController } from './TranslationModalController.svelte';
import {
  measureCompactModalWidth,
  measureDescriptionLayout,
} from './modal-layout-measurement';

export class ModalViewportController {
  public readonly layout = new ModalLayoutController();
  public backdrop = $state<HTMLDivElement>();
  public modal = $state<HTMLDivElement>();
  public body = $state<HTMLDivElement>();
  public sections = $state<HTMLDivElement>();
  public textColumn = $state<HTMLDivElement>();
  public width = $state(0);
  public height = $state(0);

  constructor(private readonly translation: () => TranslationModalController) {}

  public focusBackdrop = (): void => {
    this.backdrop?.focus();
  };

  public handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this.translation().close();
  };

  public observeContent(): (() => void) | undefined {
    const { modal, body, sections, textColumn } = this;
    const renderedMode = this.layout.mode;
    const viewport = { width: this.width, height: this.height };

    const content = {
      revision: this.translation().attemptRevision,
      hasContent:
        this.translation().original.length > 0 ||
        this.translation().translated.length > 0 ||
        !!this.translation().description,
      hasDescription: !!this.translation().description,
      unsuccessful: this.translation().isUnsuccessful,
    };

    untrack(() => this.layout.setContent(content));
    if (!modal || !body || !sections || !textColumn || content.unsuccessful)
      return;

    let frame: number | undefined;
    let active = true;

    const scheduleMeasure = () => {
      if (!active || frame !== undefined) return;

      frame = requestAnimationFrame(() => {
        frame = undefined;

        const compactWidth = content.hasContent
          ? measureCompactModalWidth({
              modal,
              sections,
              viewportWidth: viewport.width,
              viewportHeight: viewport.height,
              preferredModalWidth: this.layout.preferredWidth,
              minimumModalWidth: this.layout.minimumWidth,
            })
          : undefined;

        if (
          compactWidth !== undefined &&
          this.layout.setAutomaticWidth(renderedMode, compactWidth)
        ) {
          scheduleMeasure();

          return;
        }

        const descriptionLayout =
          renderedMode === 'three-columns'
            ? measureDescriptionLayout({
                modal,
                sections,
                textColumn,
                viewportWidth: viewport.width,
                viewportHeight: viewport.height,
                preferredModalWidth: this.layout.descriptionSideWidth,
                minimumModalWidth: this.layout.descriptionSideMinWidth,
              })
            : {
                textStackHeight: Infinity,
                availableHeight: sections.clientHeight,
              };

        this.layout.measure({
          renderedMode,
          overflowing: body.scrollHeight > body.clientHeight + 1,
          textColumnOverflowing:
            textColumn.scrollHeight > textColumn.clientHeight + 1,
          viewportWidth: viewport.width,
          ...descriptionLayout,
        });
      });
    };

    const observer = new ResizeObserver(scheduleMeasure);

    observer.observe(body);
    observer.observe(sections);
    observer.observe(textColumn);
    scheduleMeasure();

    return () => {
      active = false;
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }

  public constrainPosition(): (() => void) | undefined {
    const mode = this.layout.mode;
    const automaticallySized = this.layout.width !== undefined;
    const { modal, body } = this;
    const viewport = { width: this.width, height: this.height };

    if (!modal || !body || (mode === 'stacked' && !automaticallySized)) return;
    body.scrollTop = 0;

    const frame = requestAnimationFrame(() => {
      this.translation().drag.constrainToViewport(
        modal.getBoundingClientRect(),
        viewport,
      );
    });

    return () => cancelAnimationFrame(frame);
  }
}
