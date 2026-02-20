import { Entity } from './Entity';

export abstract class AggregateRoot<T> extends Entity<T> {
  // Can include domain events logic here in the future
}
