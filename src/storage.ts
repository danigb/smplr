import { asConstructable } from "./smplr/as-constructable";

export type StorageResponse = {
  readonly status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<any>;
  text(): Promise<string>;
};

export type Storage = {
  fetch: (url: string) => Promise<StorageResponse>;
};

export const HttpStorage: Storage = {
  fetch(url) {
    return fetch(url);
  },
};

class CacheStorageImpl implements Storage {
  #cache: Promise<Cache>;

  constructor(name = "smplr") {
    if (typeof window === "undefined" || !("caches" in window)) {
      this.#cache = Promise.reject("CacheStorage not supported");
      // Attach a no-op handler so node doesn't surface this as an unhandled
      // rejection in environments where `fetch()` is never called.
      this.#cache.catch(() => {});
    } else {
      this.#cache = caches.open(name);
    }
  }

  async fetch(url: string): Promise<StorageResponse> {
    const request = new Request(url);
    try {
      return await this.#tryFromCache(request);
    } catch (err) {
      const response = await fetch(request);
      await this.#saveResponse(request, response);
      return response;
    }
  }

  async #tryFromCache(request: Request): Promise<StorageResponse> {
    const cache = await this.#cache;
    const response = await cache.match(request);
    if (response) return response;
    else throw Error("Not found");
  }

  async #saveResponse(request: Request, response: Response) {
    try {
      const cache = await this.#cache;
      await cache.put(request, response.clone());
    } catch (err) {}
  }
}

export const CacheStorage = asConstructable(CacheStorageImpl);
export type CacheStorage = ReturnType<typeof CacheStorage>;
