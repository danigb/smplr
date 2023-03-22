import { SfzInstrument } from "./sfz/sfz-kits";
import { SfzSampler, SfzSamplerConfig } from "./sfz/sfz-sampler";

export function getMalletNames() {
  return Object.keys(NAME_TO_PATH) as MalletName[];
}

export class Mallet extends SfzSampler {
  constructor(
    context: AudioContext,
    options: Partial<SfzSamplerConfig> & { instrument: string }
  ) {
    const instrument = getMallet(options.instrument);
    super(context, {
      ...options,
      instrument,
    });
  }
}

function getMallet(name: MalletName | string): SfzInstrument {
  if (!NAME_TO_PATH[name]) throw Error(`Mallet instrument "${name}" not valid`);
  return {
    name: name,
    websfzUrl: BASE_URL + NAME_TO_PATH[name] + EXT,
  };
}
const BASE_URL = "https://danigb.github.io/samples/vcsl/";
const EXT = ".websfz.json";

type MalletName = keyof typeof NAME_TO_PATH;

export const NAME_TO_PATH: Record<string, string | undefined> = {
  "Balafon - Hard Mallet": "Struck Idiophones/balafon-hard-mallet",
  "Balafon - Keyswitch": "Struck Idiophones/balafon-keyswitch",
  "Balafon - Soft Mallet": "Struck Idiophones/balafon-soft-mallet",
  "Balafon - Traditional Mallet":
    "Struck Idiophones/balafon-traditional-mallet",
  "Tubular Bells 1": "Struck Idiophones/tubular-bells-1",
  "Tubular Bells 2": "Struck Idiophones/tubular-bells-2",
  "Vibraphone - Hard Mallets": "Struck Idiophones/vibraphone-hard-mallets",
  "Vibraphone - Keyswitch": "Struck Idiophones/vibraphone-keyswitch",
  "Vibraphone - Soft Mallets": "Struck Idiophones/vibraphone-soft-mallets",
  "Xylophone - Hard Mallets": "Struck Idiophones/xylophone-hard-mallets",
  "Xylophone - Keyswitch": "Struck Idiophones/xylophone-keyswitch",
  "Xylophone - Medium Mallets": "Struck Idiophones/xylophone-medium-mallets",
  "Xylophone - Soft Mallets": "Struck Idiophones/xylophone-soft-mallets",
} as const;
