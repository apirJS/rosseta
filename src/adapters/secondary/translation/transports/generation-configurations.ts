/** Adapter-local request variants. Persistence and execution need only opaque identities. */
export interface GenerationConfiguration {
  id: string;
  rejectionFields: readonly string[];
}
