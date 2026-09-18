import { test, expect } from "@playwright/test";
import {
  challenges,
  initialLearning,
  remember,
  nextChallenge,
} from "../src/learning";

test("removing the notes interface leaves existing browser data intact", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "kinetic-anatomy-v1",
      JSON.stringify({
        saved: ["deltoid"],
        notes: { deltoid: "My original shoulder cue" },
        studied: ["deltoid"],
        completed: ["exercise"],
        attempts: [{ score: 5, total: 5, date: "2026-09-07" }],
      }),
    ),
  );
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Notes", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("kinetic-anatomy-v1")!),
    ),
  ).toEqual({
    saved: ["deltoid"],
    notes: { deltoid: "My original shoulder cue" },
    studied: ["deltoid"],
    completed: ["exercise"],
    attempts: [{ score: 5, total: 5, date: "2026-09-07" }],
  });
  await expect(
    page.getByRole("button", {
      name: /mark.*studied|finish review|complete lesson/i,
    }),
  ).toHaveCount(0);
});

test("missed concepts return after two intervening prompts; correct unaided recall waits longer", () => {
  const now = 100000;
  let state = remember(initialLearning, "Infraspinatus", false, now);
  expect(state.memories["identify-deltoid"].streak).toBe(0);
  state = nextChallenge(state, now);
  expect(state.activeId).not.toBe("identify-deltoid");
  let card = challenges.find((c) => c.id === state.activeId)!;
  state = nextChallenge(remember(state, card.answer, false, now), now);
  expect(state.activeId).not.toBe("identify-deltoid");
  card = challenges.find((c) => c.id === state.activeId)!;
  state = nextChallenge(remember(state, card.answer, false, now), now);
  expect(state.activeId).toBe("identify-deltoid");
  state = remember(state, "Deltoid", false, now);
  expect(state.memories["identify-deltoid"].dueAt).toBeGreaterThan(now);
  expect(remember(state, "Infraspinatus", false, now)).toEqual(state);
  const hinted = remember(
    { ...initialLearning, hinted: true },
    "Deltoid",
    false,
    now,
  );
  expect(hinted.response?.correct).toBe(true);
  expect(hinted.response?.assisted).toBe(true);
  expect(hinted.memories["identify-deltoid"].streak).toBe(0);
  expect(remember(initialLearning, "", true, now).response?.correct).toBe(
    false,
  );
});
