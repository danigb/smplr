import { Versilian, VersilianOptions } from "./versilian";

export function getMalletNames() {
  return Object.keys(NAME_TO_PATH) as MalletName[];
}

export class Mallet extends Versilian {
  constructor(context: AudioContext, options: VersilianOptions) {
    super(context, {
      ...options,
      instrument: NAME_TO_PATH[options.instrument ?? ""],
    });
  }
}

const BASE_URL = "https://danigb.github.io/samples/vcsl/";
const EXT = ".websfz.json";

type MalletName = keyof typeof NAME_TO_PATH;

export const NAME_TO_PATH: Record<string, string | undefined> = {
  "Balafon - Hard Mallet": "Idiophones/Struck Idiophones/Balafon - Hard Mallet",
  "Balafon - Keyswitch": "Idiophones/Struck Idiophones/Balafon - Keyswitch",
  "Balafon - Soft Mallet": "Idiophones/Struck Idiophones/Balafon - Soft Mallet",
  "Balafon - Traditional Mallet":
    "Idiophones/Struck Idiophones/Balafon - Traditional Mallet",

  "Tubular Bells 1": "Idiophones/Struck Idiophones/Tubular Bells 1",
  "Tubular Bells 2": "Idiophones/Struck Idiophones/Tubular Bells 2",

  "Vibraphone - Bowed": "Idiophones/Struck Idiophones/Vibraphone - Bowed",
  "Vibraphone - Hard Mallets":
    "Idiophones/Struck Idiophones/Vibraphone - Hard Mallets",
  "Vibraphone - Keyswitch":
    "Idiophones/Struck Idiophones/Vibraphone - Keyswitch",
  "Vibraphone - Soft Mallets":
    "Idiophones/Struck Idiophones/Vibraphone - Soft Mallets",

  "Xylophone - Hard Mallets":
    "Idiophones/Struck Idiophones/Xylophone - Hard Mallets",
  "Xylophone - Keyswitch": "Idiophones/Struck Idiophones/Xylophone - Keyswitch",
  "Xylophone - Medium Mallets":
    "Idiophones/Struck Idiophones/Xylophone - Medium Mallets",
  "Xylophone - Soft Mallets":
    "Idiophones/Struck Idiophones/Xylophone - Soft Mallets",
} as const;
