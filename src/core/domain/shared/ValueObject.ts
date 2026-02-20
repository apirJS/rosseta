export abstract class ValueObject {
  public equals(other: ValueObject): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (other.constructor.name !== this.constructor.name) {
      return false;
    }

    return JSON.stringify(this) === JSON.stringify(other);
  }
}
