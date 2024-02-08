import makeWASocket, {
  makeMongoStore,
  WAProto,
  fetchLatestWaWebVersion,
  Browsers,
  makeCacheableSignalKeyStore,
  useMongoDBAuthState,
} from "@iamrony777/baileys";
import type {
  WAMessageKey,
  WASocket,
  ConnectionState,
} from "@iamrony777/baileys";
import NodeCache from "node-cache";
import type {
  getOnConnectionUpdate,
  executeOnOpenConnection,
} from "../events/connection.update.js";
import type { getOnCredsUpdate } from "../events/creds.update.js";
import { Db, MongoClient } from "mongodb";
import "dotenv/config";
import { LOGGER } from "../utils/logger.js";

const logger = LOGGER("core/bot", "trace");

const { version, isLatest } = await fetchLatestWaWebVersion({});

export class Socket {
  phoneNumber: number;
  msgRetryCounterCache: NodeCache;
  mediaCache: NodeCache;
  userDevicesCache: NodeCache;
  mongoClient: MongoClient;
  mongoDb: Db;
  store: ReturnType<typeof makeMongoStore>;
  socket: WASocket;
  saveCreds: Awaited<ReturnType<typeof useMongoDBAuthState>>["saveCreds"];
  removeCreds: Awaited<ReturnType<typeof useMongoDBAuthState>>["removeCreds"];
  constructor(phoneNumber: number) {
    this.phoneNumber = phoneNumber;
    // Cache Setup
    this.msgRetryCounterCache = new NodeCache({ stdTTL: 604800 });
    this.mediaCache = new NodeCache({});
    this.userDevicesCache = new NodeCache({});

    // store setup (mongodb)
    this.mongoClient = new MongoClient(process.env.MONGO_URL!, {
      socketTimeoutMS: 1_000_000,
      connectTimeoutMS: 1_000_000,
      waitQueueTimeoutMS: 1_000_000,
    });

    this.mongoDb = this.mongoClient.db(String(this.phoneNumber));
  }

  // required funtion,variables for socket
  getMessage = async (key: WAMessageKey) => {
    if (this.store) {
      const msg = await this.store.loadMessage(key.remoteJid!, key.id!);

      if (typeof msg?.message?.messageContextInfo?.messageSecret == "string") {
        msg.message.messageContextInfo.messageSecret = Uint8Array.from(
          Buffer.from(msg?.message.messageContextInfo.messageSecret)
        );
      }

      return msg?.message || undefined;
    }

    // only if store is present
    return WAProto.Message.fromObject({});
  };

  async connect() {
    await this.mongoClient.connect();
    const authCollection = this.mongoDb.collection("auth_info_baileys");
    this.store = makeMongoStore({
      db: this.mongoDb,
      autoDeleteStatusMessage: true,
      logger: LOGGER("db/mongo/store", "silent"),
    });

    // auth setup (mongodb)
    const authData = await useMongoDBAuthState(
      authCollection,
      LOGGER("db/mongo/auth", "silent")
    );

    const { state, saveCreds, removeCreds } = authData;
    this.saveCreds = saveCreds;
    this.removeCreds = removeCreds;
    // @ts-ignore
    this.socket = makeWASocket.default({
      version,
      browser: [`Forge Bot`, "Safari", "3.0"],
      connectTimeoutMs: 15 * 60 * 1000,
      keepAliveIntervalMs: 1 * 60 * 1000,
      printQRInTerminal: true,
      auth: {
        creds: state.creds,
        /** caching makes the store faster to send/recv messages */
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger: LOGGER("core/socket", "silent"),
      markOnlineOnConnect: false,
      emitOwnEvents: true,
      mediaCache: this.mediaCache,
      userDevicesCache: this.userDevicesCache,
      msgRetryCounterCache: this.msgRetryCounterCache,
      generateHighQualityLinkPreview: false,
      shouldSyncHistoryMessage: () => false,
      syncFullHistory: false,
      // shouldIgnoreJid: (jid: string) => isJidGroup(jid),
      getMessage: this.getMessage,
    });

    return {
      socket: this.socket,
      store: this.store,
      saveCreds: this.saveCreds,
      removeCreds: this.removeCreds,
    };
  }

  async eventsMap({
    socket,
    onConnectionUpdate,
    onCredsUpdate,
  }: {
    socket: WASocket;
    onConnectionUpdate: (update: Partial<ConnectionState>) => Promise<void>;
    onCredsUpdate: ReturnType<typeof getOnCredsUpdate>;
  }) {
    socket.ev.on("connection.update", onConnectionUpdate);
    socket.ev.on("creds.update", onCredsUpdate);
  }
}

// try {
//   const isNumberExists = await waClient.socket.onWhatsApp(jid);
//   if (isNumberExists.length === 0) {
//     res.status(404).json({ error: "API_INVALID_PHONE_NUMBER" });
//     return;
//   }

// if (text) {
// const sentMsg = await waClient.socket.sendMessage(jid, { text });
// console.log("Message sent:", sentMsg);
// res.status(200).json({ message: "Message sent successfully." });
// } else if (audio) {
// if (audio.startsWith("file://")) {
//   const filePath = audio.replace("file://", "");
//   const audioBuffer = await readFile(filePath);
//   await waClient.socket.sendMessage(jid, {
//     audio: audioBuffer,
//     mimetype: "audio/mp4",
//   });
//   res.status(200).json({ message: "Message sent successfully." });
// } else if (audio.startsWith("http")) {
//   // Use buffer read for audio link
//   const audioBuffer = await axios.get(audio, {
//     responseType: "arraybuffer",
//   });
//   await waClient.socket.sendMessage(jid, {
//     audio: audioBuffer.data,
//     mimetype: "audio/mp4",
//   });
//   res.status(200).json({ message: "Message sent successfully." });
// }
// } else if (video) {
// const videoResponse = await axios.get(video, {
//   responseType: "arraybuffer",
// });
// const videoBuffer = Buffer.from(videoResponse.data);
// await waClient.socket.sendMessage(jid, {
//   video: videoBuffer,
//   caption: caption,
//   gifPlayback: true,
// });
// res.status(200).json({ message: "Message sent successfully." });
// } else if (image) {
// const imageResponse = await axios.get(image, {
//   responseType: "arraybuffer",
// });
// const imageBuffer = Buffer.from(imageResponse.data);
// await waClient.socket.sendMessage(jid, {
//   image: imageBuffer,
//   caption: caption,
// });
// res.status(200).json({ message: "Message sent successfully." });
// }

// } catch (error: any) {}
// }
