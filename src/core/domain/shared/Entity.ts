export abstract class Entity<T> {
  public readonly id: T;

  constructor(id: T) {
    this.id = id;
  }

  public equals(other: Entity<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (this === other) {
      return true;
    }

    return this.id === other.id;
  }
}
