export type SfzInstrument = {
  name: string;
  formats?: string[];
  baseUrl?: string;
  websfzUrl: string;
  tags?: string[];
};

export type SfzInstrumentKit = {
  name: string;
  description?: string;
  url: string;
};

export const SfzInstrumentKits: SfzInstrumentKit[] = [
  {
    name: "Smolken Basses",
    description: "Drogomir Smolken's collection of sampled basses",
    url: "https://danigb.github.io/samples/dsmolken/instruments.json",
  },
  {
    name: "Versilian",
    description: "The Versilian Community Sample Library",
    url: "https://danigb.github.io/samples/vcsl/instruments.json",
  },
  {
    name: "Electric Pianos",
    description: "Greg Sullivan Electric Piano collection",
    url: "https://danigb.github.io/samples/gs-e-pianos/instruments.json",
  },
];

export function loadSfzKit(url: string): Promise<SfzInstrument[]> {
  return fetch(url).then((res) => res.json() as unknown as SfzInstrument[]);
}
