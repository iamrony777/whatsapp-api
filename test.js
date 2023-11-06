const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const app = express();
const port = 3000; // Set your desired port
const QRCode = require("qrcode");
const useMongoDBAuthState = require("./mongoAuthState");
const {
    delay,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
  } = require('@whiskeysockets/baileys');
const mongoURL = process.env.MONGO_URL || "mongodb+srv://ash:ash@cluster0.afau75l.mongodb.net";
const makeWASocket = require("@whiskeysockets/baileys").default;
const path = require('path');
const SocketIO = require('socket.io');
const { toBuffer } = require('qrcode');
const axios = require('axios');
const fs = require('fs');
const pino = require('pino');
const { exec } = require('child_process');

app.get("/getQR/:phonenum", async (req, res) => {
    const phonenum = req.params.phonenum;

    const mongoClient = new MongoClient(mongoURL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    try {
        await mongoClient.connect(); // Establish the MongoDB connection

        const db = mongoClient.db(phonenum);
        const collection = db.collection("auth_info_baileys");

        // Check if the collection exists by listing all collections in the database
        const collections = await db.listCollections().toArray();
        const collectionExists = collections.some((coll) => coll.name === "auth_info_baileys");

        if (collectionExists) {
            // If the collection exists, delete the session by dropping the database
            await db.dropDatabase();
        }

        // Generate and return a QR code image
        async function Forge() {
            const { state, saveCreds } = await useMongoDBAuthState(collection);
            const { version, isLatest } = await fetchLatestBaileysVersion();
          
            try {
              await mongoClient.connect(); // Establish the MongoDB connection
              let sock = makeWASocket({
                  printQRInTerminal: false,
                  defaultQueryTimeoutMs: undefined,
                  logger: pino({ level: 'fatal' }),
                  auth: state,
                  browser: [`Forge Bot`, "Safari", "3.0"],
                  version,
              });
              sock.ev.on('connection.update', async (s) => {
                console.log(s);
              
                if (s.qr !== undefined) {
                    const qrDataUrl = await QRCode.toDataURL(s.qr);
                    res.send(`<img src="${qrDataUrl}" alt="QR Code" />`);

                }

                  const { connection, lastDisconnect } = s;

                  if (connection === 'open') {

                      await delay(1000 * 10);

                      await sock.sendMessage(sock.user.id, { text: 'Succesfully Connected To Forge Whatsapp Service, Database-' + phonenum })

                      await delay(500 * 10);

                      let anu = `Thank You For using our Service, Have a great day`;

                      await sock.sendMessage(sock.user.id, {
                          image: { url: 'https://i.imgur.com/R8BwMSb.png' },
                          caption: anu,
                      });
                      process.exit(1);

                  }
                  if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await Forge(); // Reconnect asynchronously
                    
                  
                  }
              });

              sock.ev.on('creds.update', saveCreds);

              sock.ev.on('messages.upsert', () => {});
            } catch (ferr) {
              console.error(ferr);
            }
          }
          
          Forge();
        } catch (error) {
            console.error(error);
        } finally {
            await mongoClient.close(); // Close the MongoDB connection
        }
    });

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
