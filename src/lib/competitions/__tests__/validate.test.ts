import { describe, it, expect } from "vitest";
import { validateThrowSlot, validateResultInvariants } from "../validate";

describe("validateThrowSlot", () => {
  it("accepts THREE_PLUS_THREE prelims 1-3 and finals 1-3", () => {
    expect(validateThrowSlot("THREE_PLUS_THREE", "PRELIM", 1)).toBeNull();
    expect(validateThrowSlot("THREE_PLUS_THREE", "PRELIM", 3)).toBeNull();
    expect(validateThrowSlot("THREE_PLUS_THREE", "FINALS", 1)).toBeNull();
    expect(validateThrowSlot("THREE_PLUS_THREE", "FINALS", 3)).toBeNull();
  });

  it("rejects THREE_PLUS_THREE prelim 4 / finals 4", () => {
    expect(validateThrowSlot("THREE_PLUS_THREE", "PRELIM", 4)).toBe(
      "attemptInRound must be 1-3 for THREE_PLUS_THREE"
    );
    expect(validateThrowSlot("THREE_PLUS_THREE", "FINALS", 4)).toBe(
      "attemptInRound must be 1-3 for THREE_PLUS_THREE"
    );
  });

  it("accepts FOUR_STRAIGHT PRELIM 1-4", () => {
    for (const n of [1, 2, 3, 4]) {
      expect(validateThrowSlot("FOUR_STRAIGHT", "PRELIM", n)).toBeNull();
    }
  });

  it("rejects FOUR_STRAIGHT FINALS or PRELIM 5+", () => {
    expect(validateThrowSlot("FOUR_STRAIGHT", "FINALS", 1)).toBe(
      "FOUR_STRAIGHT has no FINALS round"
    );
    expect(validateThrowSlot("FOUR_STRAIGHT", "PRELIM", 5)).toBe(
      "attemptInRound must be 1-4 for FOUR_STRAIGHT"
    );
  });
});

describe("validateResultInvariants", () => {
  it("MARK requires distance, null foul/pass", () => {
    expect(
      validateResultInvariants({
        resultType: "MARK",
        distance: 18.42,
        isFoul: false,
        isPass: false,
        foulType: null,
      })
    ).toBeNull();
    expect(
      validateResultInvariants({
        resultType: "MARK",
        distance: null,
        isFoul: false,
        isPass: false,
        foulType: null,
      })
    ).toBe("MARK requires a distance");
  });

  it("FOUL requires foulType, null distance, isFoul=true", () => {
    expect(
      validateResultInvariants({
        resultType: "FOUL",
        distance: null,
        isFoul: true,
        isPass: false,
        foulType: "RING",
      })
    ).toBeNull();
    expect(
      validateResultInvariants({
        resultType: "FOUL",
        distance: null,
        isFoul: true,
        isPass: false,
        foulType: null,
      })
    ).toBe("FOUL requires a foulType");
    expect(
      validateResultInvariants({
        resultType: "FOUL",
        distance: 15,
        isFoul: true,
        isPass: false,
        foulType: "RING",
      })
    ).toBe("FOUL cannot have a distance");
  });

  it("PASS requires no distance / foul / pass=true", () => {
    expect(
      validateResultInvariants({
        resultType: "PASS",
        distance: null,
        isFoul: false,
        isPass: true,
        foulType: null,
      })
    ).toBeNull();
    expect(
      validateResultInvariants({
        resultType: "PASS",
        distance: 15,
        isFoul: false,
        isPass: true,
        foulType: null,
      })
    ).toBe("PASS cannot have a distance");
  });

  it("rejects simultaneous foul + pass", () => {
    expect(
      validateResultInvariants({
        resultType: "FOUL",
        distance: null,
        isFoul: true,
        isPass: true,
        foulType: "RING",
      })
    ).toBe("isFoul and isPass cannot both be true");
  });
});
