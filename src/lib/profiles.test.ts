import { expect, it, vi } from "vitest";
import { syncBuiltinProfilesToDb } from "./profiles";
import { listProfiles, updateProfile, type DbProfile } from "./tauri";

vi.mock("./tauri", () => ({ listProfiles: vi.fn(), updateProfile: vi.fn() }));

it("includes search guidance when backfilling each built-in profile", async () => {
  const profileIds = ["interview", "sales", "meeting", "presentation", "negotiation", "exam"];
  vi.mocked(listProfiles).mockResolvedValue(
    profileIds.map((id): DbProfile => ({
      id,
      name: id,
      system_prompt: "",
      is_builtin: true,
      position: 0,
      max_words: 0,
      tone: "",
      created_at: 0,
      updated_at: 0,
    })),
  );

  await syncBuiltinProfilesToDb();

  expect(updateProfile).toHaveBeenCalledTimes(profileIds.length);
  for (const id of profileIds) {
    expect(updateProfile).toHaveBeenCalledWith(
      id,
      undefined,
      expect.stringContaining("\n\n**SEARCH TOOL USAGE:**"),
    );
  }
});
