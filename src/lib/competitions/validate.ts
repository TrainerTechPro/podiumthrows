export type CompFormat = "THREE_PLUS_THREE" | "FOUR_STRAIGHT";
export type ThrowRound = "PRELIM" | "FINALS";
export type FoulType = "RING" | "SECTOR";
export type ResultType = "MARK" | "FOUL" | "PASS";

export function validateThrowSlot(
  format: CompFormat,
  round: ThrowRound,
  attemptInRound: number
): string | null {
  if (format === "FOUR_STRAIGHT") {
    if (round === "FINALS") return "FOUR_STRAIGHT has no FINALS round";
    if (attemptInRound < 1 || attemptInRound > 4)
      return "attemptInRound must be 1-4 for FOUR_STRAIGHT";
    return null;
  }
  // THREE_PLUS_THREE
  if (attemptInRound < 1 || attemptInRound > 3)
    return "attemptInRound must be 1-3 for THREE_PLUS_THREE";
  return null;
}

export type ResultShape = {
  resultType: ResultType;
  distance: number | null;
  isFoul: boolean;
  isPass: boolean;
  foulType: FoulType | null;
};

export function validateResultInvariants(r: ResultShape): string | null {
  if (r.isFoul && r.isPass) return "isFoul and isPass cannot both be true";

  switch (r.resultType) {
    case "MARK":
      if (r.distance == null) return "MARK requires a distance";
      if (r.isFoul) return "MARK cannot be a foul";
      if (r.isPass) return "MARK cannot be a pass";
      return null;
    case "FOUL":
      if (!r.isFoul) return "FOUL resultType requires isFoul=true";
      if (!r.foulType) return "FOUL requires a foulType";
      if (r.distance != null) return "FOUL cannot have a distance";
      return null;
    case "PASS":
      if (!r.isPass) return "PASS resultType requires isPass=true";
      if (r.distance != null) return "PASS cannot have a distance";
      if (r.foulType != null) return "PASS cannot have a foulType";
      return null;
  }
}
