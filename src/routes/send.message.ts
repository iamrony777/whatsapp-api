import { Router, Request, Response } from "express";
import { Socket } from "../core/socket.js";
import { Buffer } from "buffer";
import { LOGGER } from "../utils/logger.js";
import axios from "axios";
const router = Router();

import { readFile } from "fs/promises";
import { executeOnOpenConnection } from "../events/connection.update.js";
import { getOnCredsUpdate } from "../events/creds.update.js";
import { WAProto } from "@iamrony777/baileys";

const logger = LOGGER("routes/send.message", "debug");

interface SendMessageBody {
  id: string;
  phonenum: string;
  text?: string;
  audio?: string;
  video?: string;
  gifPlayback?: boolean;
  caption?: string;
  image?: string;
}

router.post(
  "/send-message",
  async (req: Request<any, any, SendMessageBody>, res: Response) => {
    const { id, phonenum, text, audio, video, gifPlayback, caption, image } =
      req.body;
    const jid = id + "@s.whatsapp.net";

    if (!phonenum) {
      logger.error("`phonenum` is required");
      res.status(400).json({ error: "API_INVALID_PHONE_NUMBER" });
    }

    const waClient = new Socket(Number(phonenum));
    await waClient.mongoClient.connect();
    const dbExists = await waClient.mongoDb.listCollections().toArray();

    if (dbExists.length === 0) {
      // The database doesn't exist
      logger.error("Database doesn't exist");
      res.status(404).json({ error: "API_INSTANCE_NOT_FOUND" });
      return;
    }

    const funtionToExecute = async () => {
      const isNumberExists = await waClient.socket.onWhatsApp(jid);
      if (isNumberExists.length === 0) {
        res.status(404).json({ error: "API_INVALID_PHONE_NUMBER" });
        return;
      }

      let sentMsg = {} as WAProto.IWebMessageInfo;
      if (text) {
        sentMsg = await waClient.socket.sendMessage(jid, { text });
        logger.debug(sentMsg, "Message sent");
        res.status(200).json({ message: "Message sent successfully." });
      } else if (audio) {
        if (audio.startsWith("file://")) {
          const filePath = audio.replace("file://", "");
          const audioBuffer = await readFile(filePath);
          sentMsg = await waClient.socket.sendMessage(jid, {
            audio: audioBuffer,
            mimetype: "audio/mp4",
          });
          logger.debug(sentMsg, "Message sent");
          res.status(200).json({ message: "Message sent successfully." });
        } else if (audio.startsWith("http")) {
          // Use buffer read for audio link
          const audioBuffer = await axios.get(audio, {
            responseType: "arraybuffer",
          });
          sentMsg = await waClient.socket.sendMessage(jid, {
            audio: audioBuffer.data,
            mimetype: "audio/mp4",
          });

          logger.debug(sentMsg, "Message sent");
          res.status(200).json({ message: "Message sent successfully." });
        }
      } else if (video) {
        const videoResponse = await axios.get(video, {
          responseType: "arraybuffer",
        });
        const videoBuffer = Buffer.from(videoResponse.data);
        sentMsg = await waClient.socket.sendMessage(jid, {
          video: videoBuffer,
          caption: caption,
          gifPlayback: true,
        });

        logger.debug(sentMsg, "Message sent");
        res.status(200).json({ message: "Message sent successfully." });
      } else if (image) {
        const imageResponse = await axios.get(image, {
          responseType: "arraybuffer",
        });
        const imageBuffer = Buffer.from(imageResponse.data);
        sentMsg = await waClient.socket.sendMessage(jid, {
          image: imageBuffer,
          caption: caption,
        });

        logger.debug(sentMsg, "Message sent");
        res.status(200).json({ message: "Message sent successfully." });
      }
    };

    await waClient.connect();
    await waClient.eventsMap({
      socket: waClient.socket,
      onConnectionUpdate: executeOnOpenConnection(
        res,
        waClient,
        funtionToExecute
      ),
      onCredsUpdate: getOnCredsUpdate(waClient.saveCreds),
    });
  }
);

export default router;
