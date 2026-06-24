// server/src/lib/retryWithBackoff.ts
//
// A generic retry wrapper for any async operation that might fail
// transiently — built specifically for the OpenAI call in generate.ts,
// but written generically since the same pattern would apply to any
// external API call added later (e.g. a future DALL-E image generation
// call in Phase 2).
//
// WHY THIS BELONGS ON THE SERVER, NOT AS A CLIENT-SIDE RETRY:
// Cook.tsx already retries the WHOLE request to our own server on
// failure (Day 9). That's the wrong layer to absorb an OpenAI hiccup —
// a full client retry re-runs checkUsageLimit too, and a careless
// implementation could end up incrementing usage twice for what the
// user experiences as one attempt. Retrying ONLY the OpenAI call,
// before usage is incremented, keeps the retry contained to the exact
// operation that's actually flaky.
//
// WHY NOT RETRY EVERY ERROR:
// A malformed-prompt 400 from OpenAI will fail identically every time —
// retrying it wastes the user's wait time and one of their limited
// daily attempts for zero chance of success. Only errors that are
// plausibly transient (rate limits, 5xx, network-level failures)
// are worth retrying.

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  // Lets the caller decide what counts as "worth retrying" for THIS
  // specific operation, rather than baking OpenAI-specific status code
  // knowledge into a generic retry utility.
  shouldRetry?: (error: unknown) => boolean;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 2,
    baseDelayMs = 500,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  // attempt 0 is the FIRST try, not a retry — maxRetries=2 means up to
  // 3 total attempts (1 original + 2 retries), matching the same
  // "max 2 retries" budget already used in the Cook.tsx client retry,
  // so the two layers reason about retry budget consistently.
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt || !shouldRetry(error)) {
        throw error;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms, ...
      // Jitter (randomness) is intentionally omitted here — at maxRetries=2
      // with a single server instance, the risk of many simultaneous
      // requests retrying in exact lockstep against OpenAI is low enough
      // that the added complexity of jitter isn't justified yet. Worth
      // revisiting if this pattern is reused for a higher-traffic endpoint.
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable in practice (the loop always returns or throws), but
  // keeps TypeScript satisfied that every code path returns or throws.
  throw lastError;
}

// Encodes exactly which OpenAI failures are worth retrying.
// Kept separate from the generic retryWithBackoff function so that
// utility stays reusable for any future external call with different
// retry criteria.
export function isRetryableOpenAIError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // The official openai SDK attaches a `status` field to errors for
  // HTTP-level failures (rate limits, server errors). We check for it
  // defensively with 'in' rather than assuming the shape, since a
  // network-level failure (DNS, timeout) won't have a status at all
  // and should still be retried.
  const status = 'status' in error ? (error as { status?: number }).status : undefined;

  if (status === 429) return true;       // rate limited — worth waiting and retrying
  if (status !== undefined && status >= 500) return true; // OpenAI server error
  if (status === undefined) return true; // network-level failure (no HTTP response at all)

  // Any other 4xx (400 bad request, 401 invalid key, etc.) means
  // retrying would fail identically — these are not transient.
  return false;
}