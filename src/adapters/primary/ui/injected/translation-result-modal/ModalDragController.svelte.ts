/** Owns the modal position and the pointer listeners used to move it. */
export class ModalDragController {
  public x = $state(0);
  public y = $state(0);
  private stopDrag?: () => void;
  private disposed = false;

  public start = (event: PointerEvent): void => {
    if (this.disposed || event.button !== 0) return;
    this.stopDrag?.();

    const offsetX = event.clientX - this.x;
    const offsetY = event.clientY - this.y;

    const move = (pointer: PointerEvent) => {
      this.x = pointer.clientX - offsetX;
      this.y = pointer.clientY - offsetY;
    };

    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      this.stopDrag = undefined;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    this.stopDrag = stop;
  };

  public dispose(): void {
    this.disposed = true;
    this.stopDrag?.();
  }
}
