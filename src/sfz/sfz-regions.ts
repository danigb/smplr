import { Websfz, WebsfzGroup, WebsfzRegion } from "./websfz";

function checkRange(value?: number, low?: number, hi?: number) {
  const isAboveLow = low === undefined || (value !== undefined && value >= low);
  const isBelowHi = hi === undefined || (value !== undefined && value <= hi);
  return isAboveLow && isBelowHi;
}

export function findRegions(
  websfz: Websfz,
  note: { midi?: number; velocity?: number; cc64?: number }
): [WebsfzGroup, WebsfzRegion][] {
  const regions: [WebsfzGroup, WebsfzRegion][] = [];
  for (const group of websfz.groups) {
    if (
      checkRange(note.midi, group.lokey, group.hikey) &&
      checkRange(note.velocity, group.lovel, group.hivel) &&
      checkRange(note.cc64, group.locc64, group.hicc64)
    ) {
      for (const region of group.regions) {
        if (
          checkRange(note.midi, region.lokey, region.hikey) &&
          checkRange(note.velocity, region.lovel, region.hivel) &&
          checkRange(note.cc64, group.locc64, group.hicc64)
        ) {
          regions.push([group, region]);
        }
      }
    }
  }
  return regions;
}
