const express = require("express");
const app = express();
const {
    DisconnectReason,
    useMultiFileAuthState,
  } = require("@whiskeysockets/baileys");
const useMongoDBAuthState = require("./mongoAuthState");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { MessageType, MessageOptions, Mimetype } = require("@whiskeysockets/baileys");
const { MongoClient } = require("mongodb");
const pino = require('pino');
const mongoURL = process.env.MONGO_URL || "mongodb+srv://ash:ash@cluster0.afau75l.mongodb.net";
 //replace with the required mongoURL
const axios = require('axios'); 
const { promisify } = require('util');
const { makeInMemoryStore } = require("@whiskeysockets/baileys");
const fs = require('fs');
const filePath = './baileys_store.json';
const store = makeInMemoryStore({});
const bufferRead = promisify(fs.readFile);

app.use(express.json());


setInterval(() => {
  try {
    const jsonData = JSON.stringify(store.toJSON(), null, 2);
    fs.writeFileSync(filePath, jsonData, 'utf8');
  } catch (error) {
    console.error('Error saving data to file:', error);
  }
}, 10_000);


app.post("/send-message", async (req, res) => {
  try {
    const { id, phonenum, text, audio, video, gifPlayback, caption,image } = req.body;
    const mongoClient = new MongoClient(mongoURL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    const collection = mongoClient.db(phonenum).collection("auth_info_baileys");
    const { state, saveCreds } = await useMongoDBAuthState(collection);

    const sock = makeWASocket({
      defaultQueryTimeoutMs: undefined,
      printQRInTerminal: false,
      browser: ['Future-Forge-Shin', 'Safari', '3.1.0'],
      logger: pino({ level: 'silent' }),
      auth: state,
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update || {};

      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
            
        }
      } else if (connection === "open") {
        if (text) {
          const sentMsg = await sock.sendMessage(id, { text });
          console.log("Message sent:", sentMsg);
        } else if (audio) {
          if (audio.startsWith("file://")) {
            const filePath = audio.replace("file://", "");
            const audioBuffer = await bufferRead(filePath);
            await sock.sendMessage(id, { audio: audioBuffer, mimetype: "audio/mp4" });
          } else if (audio.startsWith("http")) {
            // Use buffer read for audio link
            const audioBuffer = await axios.get(audio, { responseType: 'arraybuffer' });
            await sock.sendMessage(id, { audio: audioBuffer.data, mimetype: "audio/mp4" });
          }
        } else if (video) {
          {
            const videoResponse = await axios.get(video, { responseType: 'arraybuffer' });
            const videoBuffer = Buffer.from(videoResponse.data);
            await sock.sendMessage(id, {
              video: videoBuffer,
              caption: caption,
              gifPlayback:true,
            });
          
          }
        }  else if (image) {
            const imageResponse = await axios.get(image, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);
            await sock.sendMessage(id, {
              image: imageBuffer,
              caption: caption,
            });
          } 
      }
    });
    store.bind(sock.ev);

    sock.ev.on("chats.set", () => {

    console.log("got chats", store.chats.all());
    });

    sock.ev.on("contacts.set", () => {
    console.log("got contacts", Object.values(store.contacts));
    });

    sock.ev.on("messages.update", (messageInfo) => {
      console.log(messageInfo);
    });

    sock.ev.on("messages.upsert", (messageInfoUpsert) => {
      console.log(messageInfoUpsert);
    });

    sock.ev.on("creds.update", saveCreds);

    res.status(200).json({ message: "Message sent successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while sending the message." });
  }
});

const port = 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
