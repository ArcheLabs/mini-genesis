export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};
