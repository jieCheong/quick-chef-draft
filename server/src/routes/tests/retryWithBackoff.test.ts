// Unit tests for the generic retry utility, independent of OpenAI or
// any route. vi.useFakeTimers() means the actual setTimeout delays
// (500ms, 1000ms, ...) never really elapse during the test run —
// without this, this single test file would take several real seconds
// to run, which defeats the point of a fast test suite.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff, isRetryableOpenAIError } from '../../lib/retryWithBackoff';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the result immediately on first success, with no delay', async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledOnce();
  });

  it('retries on failure and succeeds on the second attempt', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce('success on retry');

    const promise = retryWithBackoff(operation, { maxRetries: 2, baseDelayMs: 500 });

    // The first attempt has already failed synchronously inside the
    // promise chain; advancing fake time is what lets the awaited
    // setTimeout inside retryWithBackoff resolve so the loop proceeds
    // to attempt 2 without a real 500ms wait actually elapsing.
    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;

    expect(result).toBe('success on retry');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('stops retrying and throws after maxRetries is exhausted', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('always fails'));

    const promise = retryWithBackoff(operation, { maxRetries: 2, baseDelayMs: 100 });
    promise.catch(() => {}); // prevent unhandled-rejection warning while fake timers run

    // maxRetries=2 means 3 total attempts (1 original + 2 retries) —
    // advance through both backoff delays (100ms, then 200ms) so all
    // three attempts actually run before asserting the final rejection.
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).rejects.toThrow('always fails');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('does not retry at all when shouldRetry returns false', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('non-retryable'));
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(
      retryWithBackoff(operation, { maxRetries: 2, shouldRetry })
    ).rejects.toThrow('non-retryable');

    // This is the assertion that actually matters for this test: a
    // non-retryable error must fail FAST, on the first attempt, not
    // burn through the full retry budget for an error that was never
    // going to succeed on a second try.
    expect(operation).toHaveBeenCalledOnce();
  });

  it('uses exponential backoff timing — delay doubles each retry', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('success');

    const promise = retryWithBackoff(operation, { maxRetries: 2, baseDelayMs: 500 });

    // After attempt 1 fails, exactly 500ms must elapse before attempt 2
    // fires — advancing by less should not yet trigger the second call.
    await vi.advanceTimersByTimeAsync(499);
    expect(operation).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(operation).toHaveBeenCalledTimes(2);

    // After attempt 2 fails, the delay doubles to 1000ms before attempt 3.
    await vi.advanceTimersByTimeAsync(999);
    expect(operation).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(operation).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toBe('success');
  });
});

describe('isRetryableOpenAIError', () => {
  it('treats a 429 rate limit error as retryable', () => {
    const error = Object.assign(new Error('rate limited'), { status: 429 });
    expect(isRetryableOpenAIError(error)).toBe(true);
  });

  it('treats a 500-range OpenAI server error as retryable', () => {
    const error = Object.assign(new Error('server error'), { status: 503 });
    expect(isRetryableOpenAIError(error)).toBe(true);
  });

  it('treats a network-level failure with no status as retryable', () => {
    // A timeout or DNS failure never gets an HTTP response at all,
    // so it has no .status field — this must still be retried, since
    // it's exactly the kind of transient failure the feature targets.
    const error = new Error('ECONNRESET');
    expect(isRetryableOpenAIError(error)).toBe(true);
  });

  it('treats a 400 bad request as NOT retryable', () => {
    // A malformed prompt or invalid parameters will fail identically
    // on every retry — retrying wastes time and retry budget for zero
    // chance of success.
    const error = Object.assign(new Error('bad request'), { status: 400 });
    expect(isRetryableOpenAIError(error)).toBe(false);
  });

  it('treats a 401 invalid API key as NOT retryable', () => {
    const error = Object.assign(new Error('invalid api key'), { status: 401 });
    expect(isRetryableOpenAIError(error)).toBe(false);
  });

  it('treats a non-Error thrown value as NOT retryable', () => {
    // Defensive case — if something throws a plain string or object
    // instead of an Error instance, fail safe rather than assume retryable.
    expect(isRetryableOpenAIError('just a string')).toBe(false);
  });
});