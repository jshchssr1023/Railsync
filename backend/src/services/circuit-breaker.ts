/**
 * Circuit Breaker & Timeout Utilities
 *
 * Prevents cascading failures when external services (SAP, Salesforce) are
 * unreachable or slow. Provides:
 *   - fetchWithTimeout: wraps fetch() with an AbortController deadline
 *   - CircuitBreaker: tracks consecutive failures and short-circuits calls
 *     once a threshold is reached, re-trying after a cooldown period.
 *
 * State machine:
 *   CLOSED  --[failure >= threshold]--> OPEN
 *   OPEN    --[cooldown elapsed]------> HALF_OPEN
 *   HALF_OPEN --[success]-------------> CLOSED
 *   HALF_OPEN --[failure]-------------> OPEN
 */

import logger from '../config/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit (default 5) */
  failureThreshold: number;
  /** Time in ms to wait before allowing a probe request (default 60 000) */
  cooldownMs: number;
  /** Per-call timeout in ms applied via AbortController (default 30 000) */
  timeoutMs: number;
  /** Human-readable name used in log messages */
  name: string;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStatus {
  name: string;
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  cooldownMs: number;
  failureThreshold: number;
  timeoutMs: number;
  /** If OPEN, ms until the circuit enters HALF_OPEN (0 if not OPEN) */
  cooldownRemainingMs: number;
}

// ============================================================================
// CIRCUIT BREAKER ERROR
// ============================================================================

export class CircuitBreakerOpenError extends Error {
  public readonly circuitName: string;
  public readonly cooldownRemainingMs: number;

  constructor(name: string, cooldownRemainingMs: number) {
    super(`Circuit breaker "${name}" is OPEN. Retry after ${Math.ceil(cooldownRemainingMs / 1000)}s.`);
    this.name = 'CircuitBreakerOpenError';
    this.circuitName = name;
    this.cooldownRemainingMs = cooldownRemainingMs;
  }
}

export class TimeoutError extends Error {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

// ============================================================================
// fetchWithTimeout
// ============================================================================

/**
 * Drop-in replacement for `fetch()` that aborts after `timeoutMs`
 * milliseconds. On timeout, throws a `TimeoutError`.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  cooldownMs: 60_000,
  timeoutMs: 30_000,
  name: 'unnamed',
};

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> & { name: string }) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    logger.info(
      { circuit: this.options.name, failureThreshold: this.options.failureThreshold, cooldownMs: this.options.cooldownMs, timeoutMs: this.options.timeoutMs },
      'Circuit breaker initialised',
    );
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Execute `fn` through the circuit breaker.
   *
   * - If OPEN and the cooldown has not elapsed, throws immediately.
   * - If OPEN and the cooldown has elapsed, transitions to HALF_OPEN and
   *   allows one probe call.
   * - On success: resets to CLOSED.
   * - On failure: increments count; transitions to OPEN when threshold met.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // ---- Check if circuit is OPEN ----
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.lastFailureTime ?? 0);
      if (elapsed < this.options.cooldownMs) {
        const remaining = this.options.cooldownMs - elapsed;
        logger.warn(
          { circuit: this.options.name, state: this.state, cooldownRemainingMs: remaining },
          'Circuit breaker OPEN — call rejected',
        );
        throw new CircuitBreakerOpenError(this.options.name, remaining);
      }
      // Cooldown elapsed — allow one probe
      this.transitionTo('HALF_OPEN');
    }

    // ---- Execute with timeout ----
    try {
      const result = await this.withTimeout(fn);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      throw err;
    }
  }

  /**
   * Returns a snapshot of the breaker's current status, suitable for health
   * check responses and operator dashboards.
   */
  getStatus(): CircuitBreakerStatus {
    let cooldownRemainingMs = 0;
    if (this.state === 'OPEN' && this.lastFailureTime !== null) {
      const elapsed = Date.now() - this.lastFailureTime;
      cooldownRemainingMs = Math.max(0, this.options.cooldownMs - elapsed);
    }

    return {
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      cooldownMs: this.options.cooldownMs,
      failureThreshold: this.options.failureThreshold,
      timeoutMs: this.options.timeoutMs,
      cooldownRemainingMs,
    };
  }

  /**
   * Manually reset the breaker to CLOSED. Useful for admin override.
   */
  reset(): void {
    logger.info({ circuit: this.options.name, previousState: this.state }, 'Circuit breaker manually reset');
    this.state = 'CLOSED';
    this.failureCount = 0;
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(this.options.timeoutMs));
      }, this.options.timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private onSuccess(): void {
    if (this.state !== 'CLOSED') {
      logger.info(
        { circuit: this.options.name, previousState: this.state, failureCount: this.failureCount },
        'Circuit breaker recovered — transitioning to CLOSED',
      );
    }
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastSuccessTime = Date.now();
  }

  private onFailure(err: unknown): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn(
      { circuit: this.options.name, state: this.state, failureCount: this.failureCount, threshold: this.options.failureThreshold, error: errorMsg },
      'Circuit breaker recorded failure',
    );

    if (this.failureCount >= this.options.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    const previousState = this.state;
    this.state = newState;
    logger.warn(
      { circuit: this.options.name, from: previousState, to: newState, failureCount: this.failureCount },
      `Circuit breaker state transition: ${previousState} -> ${newState}`,
    );
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

/**
 * Shared circuit breakers for external integrations. Exported as singletons
 * so that every call through the respective service shares the same state.
 */
export const sapCircuitBreaker = new CircuitBreaker({
  name: 'SAP',
  failureThreshold: 5,
  cooldownMs: 60_000,
  timeoutMs: 30_000,
});

export const salesforceCircuitBreaker = new CircuitBreaker({
  name: 'Salesforce',
  failureThreshold: 5,
  cooldownMs: 60_000,
  timeoutMs: 30_000,
});

/**
 * Returns status of all integration circuit breakers.
 * Used by health endpoints for operator visibility.
 */
export function getAllCircuitBreakerStatuses(): CircuitBreakerStatus[] {
  return [
    sapCircuitBreaker.getStatus(),
    salesforceCircuitBreaker.getStatus(),
  ];
}
