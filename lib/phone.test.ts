import { describe, it, expect } from "vitest";
import { normalizePhone, phoneToEmail, isValidPhone, formatPhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("keeps a full +998 number as 12 digits", () => {
    expect(normalizePhone("+998901234567")).toBe("998901234567");
    expect(normalizePhone("+998 90 123 45 67")).toBe("998901234567");
  });

  it("prepends 998 to a 9-digit national number", () => {
    expect(normalizePhone("901234567")).toBe("998901234567");
  });

  it("strips all non-digit characters", () => {
    expect(normalizePhone(" (90) 123-45-67 ")).toBe("998901234567");
  });
});

describe("phoneToEmail", () => {
  it("maps any spelling of the same number to the SAME email", () => {
    const a = phoneToEmail("+998 90 123 45 67");
    const b = phoneToEmail("901234567");
    const c = phoneToEmail("998901234567");
    expect(a).toBe("u998901234567@sellora.app");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("matches the migration mapping for an existing operator", () => {
    // operator phone "771771319" was backfilled as u998771771319@sellora.app
    expect(phoneToEmail("771771319")).toBe("u998771771319@sellora.app");
  });
});

describe("isValidPhone", () => {
  it("accepts full Uzbek numbers and 9-digit national form", () => {
    expect(isValidPhone("+998901234567")).toBe(true);
    expect(isValidPhone("901234567")).toBe(true);
  });
  it("rejects junk / too-short input", () => {
    expect(isValidPhone("admin")).toBe(false);
    expect(isValidPhone("123")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("formatPhone", () => {
  it("pretty-prints a normalized number", () => {
    expect(formatPhone("998901234567")).toBe("+998 90 123 45 67");
    expect(formatPhone("901234567")).toBe("+998 90 123 45 67");
  });
});
