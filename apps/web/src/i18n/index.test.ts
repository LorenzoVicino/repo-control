import { beforeEach, describe, expect, it } from "vitest";
import {
  getInitialLanguage,
  isAppLanguage,
  LANGUAGE_STORAGE_KEY
} from "./index";

describe("language preference bootstrap", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to English and accepts only supported stored languages", () => {
    expect(getInitialLanguage()).toBe("en");

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "it");
    expect(getInitialLanguage()).toBe("it");

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    expect(getInitialLanguage()).toBe("en");
    expect(isAppLanguage("en")).toBe(true);
    expect(isAppLanguage("it")).toBe(true);
    expect(isAppLanguage("fr")).toBe(false);
  });
});
