import { tx } from "./db.mjs";
import { HttpError } from "./http.mjs";
import { validateFormSettings, writeFormSettings } from "./form-settings.mjs";
import { writeFormSwitch } from "./intake.mjs";

/* Settings and an optional intake switch commit together. An absent switch stays absent when
   availability is kept, preserving the original alternate form until an explicit change. */
export async function saveFormSetup(key, input, by) {
  if (!input || Object.keys(input).some(k => !["settings", "state", "expectedState", "confirm", "formVersion"].includes(k)) || !Number.isInteger(input.formVersion) || input.formVersion < 1 || !["keep", "open", "closed"].includes(input.state) || !["open", "closed"].includes(input.expectedState)) throw new HttpError(400, "settings.shape");
  validateFormSettings(input.settings);
  if (input.state === "open" && input.confirm !== key) throw new HttpError(409, "switch.confirm");
  return tx(async t => {
    const settings = await writeFormSettings(t, key, input.settings, by);
    if (input.state !== "keep") await writeFormSwitch(t, key, input.state, by, input.expectedState);
    return settings;
  });
}
