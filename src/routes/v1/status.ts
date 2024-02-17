import { Router, Request, Response } from "express";
import { LOGGER } from "../../utils/logger.js";
import { Socket } from "../../core/socket.js";
import { executeOnOpenConnection } from "../../events/connection.update.js";
import { getOnCredsUpdate } from "../../events/creds.update.js";
const logger = LOGGER("routes/status", "debug");
const router = Router();

router.get("/status/:phonenum", async (req, res) => {
  const { phonenum } = req.params;
  const waClient = new Socket(Number(phonenum));
  await waClient.mongoClient.connect();

  const dbExists = await waClient.mongoClient
    .db(phonenum)
    .listCollections()
    .toArray();

  if (dbExists.length === 0) {
    // The database doesn't exist
    res.status(404).json({ error: "Instance not found" });
    return;
  }

  const funtionToExecute = async (connectionStatusSet: boolean = false) => {
    if (!connectionStatusSet) {
      res
        .status(200)
        .json({ isConnected: true, connectionStatus: "Connected" });
      connectionStatusSet = true;
    }
  };

  await waClient.connect();
  await waClient.eventsMap(waClient.socket, {
    onConnectionUpdate: executeOnOpenConnection(
      res,
      waClient,
      funtionToExecute
    ),
    onCredsUpdate: getOnCredsUpdate(waClient.saveCreds),
  });
});

export default router