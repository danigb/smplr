/**
 * A function to unsubscribe from an event or control
 */
export type Unsubscribe = () => void;
/**
 * A function that listener to event or control changes
 */
export type Listener<T> = (value: T) => void;
/**
 * A function to subscribe an trigger or control events
 */
export type Subscribe<T> = (listener: Listener<T>) => Unsubscribe;

/**
 * A trigger is a subscribable event
 */
export type Trigger<T> = {
  subscribe: Subscribe<T>;
  trigger: (event: T) => void;
};

/**
 * A control is a subscribable value
 */
export type Control<T> = {
  subscribe: Subscribe<T>;
  set: (value: T) => void;
  get: () => T;
};

/**
 * Create a control signal
 * @param initialValue
 * @returns Control
 */
export function createControl<T>(initialValue: T): Control<T> {
  let current = initialValue;
  const listeners = new Set<Listener<T>>();

  function subscribe(listener: Listener<T>) {
    listeners.add(listener);
    listener(current);
    return () => {
      listeners.delete(listener);
    };
  }

  function set(value: T) {
    current = value;
    listeners.forEach((listener) => listener(current));
  }

  function get(): T {
    return current;
  }
  return { subscribe, set, get };
}

export function createTrigger<T>(): Trigger<T> {
  const listeners = new Set<Listener<T>>();

  function subscribe(listener: Listener<T>) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function trigger(value: T) {
    listeners.forEach((listener) => listener(value));
  }

  return { subscribe, trigger };
}

export function unsubscribeAll(unsubscribe: Array<Unsubscribe | undefined>) {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    unsubscribe.forEach((cb) => cb?.());
  };
}
