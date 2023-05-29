type StorageResponse = {
  readonly status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<any>;
  text(): Promise<string>;
};

export type Storage = {
  fetch: (url: string) => Promise<StorageResponse>;
};

export const HttpStorage: Storage = {
  fetch,
};
