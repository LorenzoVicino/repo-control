import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import { buildSuggestions } from "./suggestions";

const t = ((key: string, options?: { name?: string }) => `${key}${options?.name ? `:${options.name}` : ""}`) as unknown as TFunction;

describe("buildSuggestions", () => {
  it("offers triage first, then the most pressing pull, review and push", () => {
    const suggestions = buildSuggestions(
      [
        createProjectFixture("docs", { behind: 1 }),
        createProjectFixture("wiki", { behind: 4 }),
        createProjectFixture("dirty-behind", { behind: 9, isClean: false, modified: 1 }),
        createProjectFixture("atlas", { isClean: false, modified: 3, untracked: 2 }),
        createProjectFixture("design", { ahead: 2 })
      ],
      t
    );
    expect(suggestions.map((suggestion) => suggestion.id)).toEqual(["triage", "pull-wiki", "review-atlas", "push-design"]);
    expect(suggestions[1].prompt).toBe("assistant.suggestions.pull.prompt:wiki");
  });

  it("never suggests a pull for a repository with local changes, and works for an empty workspace", () => {
    expect(buildSuggestions([createProjectFixture("a", { behind: 2, isClean: false, modified: 1 })], t).map((suggestion) => suggestion.id)).toEqual(["triage", "review-a"]);
    expect(buildSuggestions([], t).map((suggestion) => suggestion.id)).toEqual(["triage"]);
  });
});
