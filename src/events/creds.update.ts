import { LOGGER } from "../utils/logger.js";

export const getOnCredsUpdate = (saveCreds: () => Promise<void>) => {
  return async function onCredsUpdate() {
    await saveCreds();
    LOGGER("events/creds.update", "debug").debug("Credentials updated");
  }
};
