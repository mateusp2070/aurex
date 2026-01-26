export function range(stop: number): Generator<number, void, unknown>;

export function range(
  start: number,
  stop: number,
): Generator<number, void, unknown>;

export function range(
  start: number,
  stop: number,
  step: number,
): Generator<number, void, unknown>;

export function* range(start: number, stop?: number, step = 1) {
  if (stop === undefined) {
    stop = start;
    start = 0;
  }

  if (step <= 0) throw new Error("range() step must greater than zero");

  if (start < stop) {
    for (let i = start; i <= stop; i += step) {
      yield i;
    }
  } else if (start > stop) {
    for (let i = start; i >= stop; i -= step) {
      yield i;
    }
  }
}

export function* enumerate<T>(
  iterable: Iterable<T>,
): Generator<[T, number], void, unknown> {
  let index = 0;

  for (const item of iterable) {
    yield [item, index];

    index += 1;
  }
}
