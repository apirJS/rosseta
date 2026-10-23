import puterSdk from '@heyputer/puter.js';
import {
  raceAbort,
  throwIfAborted,
} from '../../translation/execution/translation-execution';

let previousLease: Promise<void> = Promise.resolve();

function reserveLease() {
  let release!: () => void;

  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  const ready = previousLease;

  previousLease = ready.then(() => released);

  return { ready, release };
}

/** All authenticated Puter operations share this lease, including model fetching. */
export async function withPuterSession<T>(
  token: string,
  operation: (sdk: typeof puterSdk) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const lease = reserveLease();

  try {
    await raceAbort(lease.ready, signal);
    if (signal) throwIfAborted(signal);
  } catch (error) {
    lease.release();

    throw error;
  }

  let work: Promise<T>;

  try {
    if (puterSdk.authToken !== token) puterSdk.setAuthToken(token);
    work = operation(puterSdk);
  } catch (error) {
    lease.release();

    throw error;
  }

  // Cancellation ends the caller's wait, but another credential cannot replace
  // the global SDK token until the underlying operation actually settles.
  const ownedWork = work.finally(lease.release);

  return raceAbort(ownedWork, signal);
}
