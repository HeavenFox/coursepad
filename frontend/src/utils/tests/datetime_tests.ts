import { timeStringToHour, bitmaskToDay } from "../datetime";

describe("datetime", function() {
  describe("timeStringToHour", function() {
    it("converts AM time correctly", function() {
      expect(timeStringToHour("11:30 AM")).toEqual(11.5);
      expect(timeStringToHour("12:30 AM")).toEqual(0.5);
    });

    it("converts PM time correctly", function() {
      expect(timeStringToHour("12:30 PM")).toEqual(12.5);
      expect(timeStringToHour("11:30 PM")).toEqual(23.5);
    });
  });

  describe("bitmaskToDay", function() {
    it("converts days correctly", function() {
      expect(bitmaskToDay(1 + (1 << 3))).toEqual("MR");
    });
  });
});
