const {
  DisconnectReason,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const useMongoDBAuthState = require("../mongoAuthState");
const makeWASocket = require("@whiskeysockets/baileys").default;
const mongoURL = process.env.MONGO_URL || "mongodb+srv://ash:ash@cluster0.afau75l.mongodb.net";

const { MongoClient } = require("mongodb");
const pino = require('pino');


async function connectionLogic(phonenum) {
  const mongoClient = new MongoClient(mongoURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await mongoClient.connect();
  // const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const collection = mongoClient
    .db(phonenum)
    .collection("auth_info_baileys");
  const { state, saveCreds } = await useMongoDBAuthState(collection);
  const sock = makeWASocket({
    // can provide additional config here
    printQRInTerminal: true,
    browser: ['Future-Forge-Shin', 'Safari', '3.1.0'],
    logger: pino({ level: 'silent' }),
    auth: state,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update || {};

    if (qr) {
      console.log(qr);
      // write custom logic over here
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) {
        connectionLogic();
      }
    }
  });

  sock.ev.on("messages.update", (messageInfo) => {
    console.log(messageInfo);
  });

  sock.ev.on("messages.upsert", (messageInfoUpsert) => {
    console.log(messageInfoUpsert);
  });
  sock.ev.on("creds.update", saveCreds);
}

// call this function in the dashboard it will generate a qr code, pass down the phone number in the parameter connectionLogic(phonenum);
