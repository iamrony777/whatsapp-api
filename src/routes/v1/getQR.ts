import { Router } from "express";
import { getOnConnectionUpdate } from "../../events/connection.update.js";
import { getOnCredsUpdate } from "../../events/creds.update.js";
import { Socket } from "../../core/socket.js";

const router = Router();

router.get("/getQR/:phonenum", async (req, res) => {
  const phonenum = req.params.phonenum;
  const waClient = new Socket(Number(phonenum));

  await waClient.mongoClient.connect();

  if (await waClient.mongoDb.collections()) {
    await waClient.mongoDb.dropDatabase(); // if collection exists, drop the database
  }

  // generate and return qr-code
  await waClient.connect();

  waClient.store.bind(waClient.socket.ev);

  await waClient.eventsMap(waClient.socket, {
    
    onConnectionUpdate: getOnConnectionUpdate(res, waClient, Socket),
    onCredsUpdate: getOnCredsUpdate(waClient.saveCreds),
  });
});

export default router