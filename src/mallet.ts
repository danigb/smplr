import { Smplr } from "./smplr";
import { Versilian, VersilianOptions } from "./versilian";

export function getMalletNames() {
  return Object.keys(NAME_TO_PATH) as MalletName[];
}

export function Mallet(
  context: BaseAudioContext,
  options: VersilianOptions = {}
): Smplr {
  if (new.target) console.warn("smplr: `new Mallet(ctx, opts)` is deprecated. Call as a function: `Mallet(ctx, opts)`.");
  return Versilian(context, {
    ...options,
    instrument: NAME_TO_PATH[options.instrument ?? ""],
  });
}

type MalletName = keyof typeof NAME_TO_PATH;

export const NAME_TO_PATH: Record<string, string | undefined> = {
  "Balafon - Hard Mallet":
    "Idiophones/Struck Idiophones/Balafon - Hard Mallet",
  "Balafon - Keyswitch":
    "Idiophones/Struck Idiophones/Balafon - Keyswitch",
  "Balafon - Soft Mallet":
    "Idiophones/Struck Idiophones/Balafon - Soft Mallet",
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
  "Xylophone - Keyswitch":
    "Idiophones/Struck Idiophones/Xylophone - Keyswitch",
  "Xylophone - Medium Mallets":
    "Idiophones/Struck Idiophones/Xylophone - Medium Mallets",
  "Xylophone - Soft Mallets":
    "Idiophones/Struck Idiophones/Xylophone - Soft Mallets",
} as const;
