import type { JsonValue } from '@hustle-ring/shared';

export interface Telemetry {
  track(event: string, props?: Record<string, JsonValue>): void;
  flush(): Promise<void>;
}

/** v1 default: drops everything. Engine never imports this; UI only calls through the interface. */
export class NullTelemetry implements Telemetry {
  track(): void {
    /* intentionally empty */
  }
  flush(): Promise<void> {
    return Promise.resolve();
  }
}
