const MIN_COLUMN_WIDTH = 280;
const PREFERRED_COLUMN_WIDTH = 400;
const COLUMN_GAP = 16;
const BODY_PADDING_AND_BORDER = 34;

export type ModalLayoutMode =
  'stacked' | 'text-columns' | 'description-side' | 'three-columns';

function columnsWidth(count: number, columnWidth: number): number {
  return (
    count * columnWidth + (count - 1) * COLUMN_GAP + BODY_PADDING_AND_BORDER
  );
}

/** Switches overflowing results to columns without bouncing between layouts. */
export class ModalLayoutController {
  private bodyOverflowed = $state(false);
  private textColumnOverflowed = $state(false);
  private hasDescription = $state(false);
  private viewportWidth = $state(0);
  private automaticWidth = $state<{ mode: ModalLayoutMode; width: number }>();
  private revision = 0;

  public readonly descriptionSideWidth = columnsWidth(
    2,
    PREFERRED_COLUMN_WIDTH,
  );

  public readonly descriptionSideMinWidth = columnsWidth(2, MIN_COLUMN_WIDTH);

  public readonly mode: ModalLayoutMode = $derived.by(() => {
    if (!this.bodyOverflowed || !this.columnsFit(2)) return 'stacked';
    if (!this.hasDescription) return 'text-columns';

    return this.textColumnOverflowed && this.columnsFit(3)
      ? 'three-columns'
      : 'description-side';
  });

  public readonly columns = $derived(
    this.mode === 'stacked' ? 1 : this.mode === 'three-columns' ? 3 : 2,
  );

  public readonly preferredWidth = $derived(
    this.columns > 1 ? columnsWidth(this.columns, PREFERRED_COLUMN_WIDTH) : 520,
  );

  public readonly minimumWidth = $derived(
    this.columns > 1 ? columnsWidth(this.columns, MIN_COLUMN_WIDTH) : 320,
  );

  public readonly width = $derived(
    this.automaticWidth?.mode === this.mode
      ? `${this.automaticWidth.width}px`
      : this.columns > 1
        ? `${this.preferredWidth}px`
        : undefined,
  );

  public readonly minWidth = $derived(
    this.columns > 1
      ? `${columnsWidth(this.columns, MIN_COLUMN_WIDTH)}px`
      : undefined,
  );

  public setContent(content: {
    revision: number;
    hasContent: boolean;
    hasDescription: boolean;
    unsuccessful: boolean;
  }): void {
    if (content.hasDescription !== this.hasDescription) {
      this.textColumnOverflowed = false;
      this.automaticWidth = undefined;
    }

    this.hasDescription = content.hasDescription;

    if (
      content.revision !== this.revision ||
      !content.hasContent ||
      content.unsuccessful
    ) {
      this.bodyOverflowed = false;
      this.textColumnOverflowed = false;
      this.automaticWidth = undefined;
    }

    this.revision = content.revision;
  }

  public setAutomaticWidth(mode: ModalLayoutMode, width: number): boolean {
    if (mode !== this.mode || !Number.isFinite(width) || width <= 0)
      return false;
    if (
      this.automaticWidth?.mode === mode &&
      this.automaticWidth.width === width
    )
      return false;

    this.automaticWidth = { mode, width };

    return true;
  }

  public measure(measurement: {
    renderedMode: ModalLayoutMode;
    overflowing: boolean;
    textColumnOverflowing: boolean;
    viewportWidth: number;
    availableHeight: number;
    textStackHeight: number;
  }): void {
    if (measurement.renderedMode !== this.mode) return;

    this.viewportWidth = measurement.viewportWidth;

    // Keep the expanded layout after it removes the original body overflow.
    if (measurement.overflowing) this.bodyOverflowed = true;

    if (measurement.renderedMode === 'description-side') {
      this.textColumnOverflowed = measurement.textColumnOverflowing;
    } else if (
      measurement.renderedMode === 'three-columns' &&
      Number.isFinite(measurement.textStackHeight) &&
      Number.isFinite(measurement.availableHeight) &&
      measurement.textStackHeight >= 0 &&
      measurement.textStackHeight + 8 <= measurement.availableHeight
    ) {
      // Measure the candidate first; leave room for rounding at the scroll edge.
      this.textColumnOverflowed = false;
    }
  }

  private columnsFit(count: number): boolean {
    return this.viewportWidth * 0.9 >= columnsWidth(count, MIN_COLUMN_WIDTH);
  }
}
