const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const app = express();
const QRCode = require("qrcode");
const useMongoDBAuthState = require("./mongoAuthState");
const {
    delay,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const makeWASocket = require("@whiskeysockets/baileys").default;
const axios = require('axios');
const fs = require('fs');
const pino = require('pino');
const { DisconnectReason, MessageType, MessageOptions, Mimetype } = require("@whiskeysockets/baileys");
const mongoURL = process.env.MONGO_URL || "mongodb://mongo:d2g6dEcDB51f4B6eGAad2h5F3D44eF65@roundhouse.proxy.rlwy.net:41363";
const { makeMongoStore } = require("@iamrony777/baileys");

app.use(express.json());
let mongoClient;


app.post("/send-message", async (req, res) => {
    try {
        const { id, phonenum, text, audio, video, gifPlayback, caption, image } = req.body;
        const jid = id + '@s.whatsapp.net';

            mongoClient = new MongoClient(mongoURL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        const dbExists = await mongoClient.db(phonenum).listCollections().toArray();

        if (dbExists.length === 0) {
            // The database doesn't exist
            res.status(404).json({ error: "Session not found in the database." });
            return;
        }

        const collection = mongoClient.db(phonenum).collection("auth_info_baileys");
        const { state, saveCreds } = await useMongoDBAuthState(collection);

        const sock = makeWASocket({
            defaultQueryTimeoutMs: undefined,
            markOnlineOnConnect: true,
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
                const store = makeMongoStore({
                    db: mongoClient.db(phonenum),
                    filterChats: false,
                  })
                store.bind(sock.ev)
        

                const exist = await sock.onWhatsApp(jid); // Correctly use `sock` instead of `socket`
                if (exist.length === 0) {
                    res.status(404).json({ error: "The number doesn't exist or isn't registered in WhatsApp." });
                    return;
                }
                if (text) {
                    const sentMsg = await sock.sendMessage(jid, { text });
                    console.log("Message sent:", sentMsg);
                    res.status(200).json({ message: "Message sent successfully." });
                } else if (audio) {
                    if (audio.startsWith("file://")) {
                        const filePath = audio.replace("file://", "");
                        const audioBuffer = await bufferRead(filePath);
                        await sock.sendMessage(jid, { audio: audioBuffer, mimetype: "audio/mp4" });
                        res.status(200).json({ message: "Message sent successfully." });

                    } else if (audio.startsWith("http")) {
                        // Use buffer read for audio link
                        const audioBuffer = await axios.get(audio, { responseType: 'arraybuffer' });
                        await sock.sendMessage(jid, { audio: audioBuffer.data, mimetype: "audio/mp4" });
                        res.status(200).json({ message: "Message sent successfully." });

                    }
                } else if (video) {
                    const videoResponse = await axios.get(video, { responseType: 'arraybuffer' });
                    const videoBuffer = Buffer.from(videoResponse.data);
                    await sock.sendMessage(jid, {
                        video: videoBuffer,
                        caption: caption,
                        gifPlayback: true,
                    });
                    res.status(200).json({ message: "Message sent successfully." });
                } else if (image) {
                    const imageResponse = await axios.get(image, { responseType: 'arraybuffer' });
                    const imageBuffer = Buffer.from(imageResponse.data);
                    await sock.sendMessage(jid, {
                        image: imageBuffer,
                        caption: caption,
                    });
                    res.status(200).json({ message: "Message sent successfully." });
                }
            }
        });

        sock.ev.on('chats.set', () => {
            console.log('got chats', store.chats.all())
        })

        sock.ev.on("messages.update", (messageInfo) => {
            console.log(messageInfo);
        });

        sock.ev.on("messages.upsert", (messageInfoUpsert) => {
            console.log(messageInfoUpsert);
        });

        sock.ev.on("creds.update", saveCreds);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while sending the message." });
    }
});
app.get("/status/:phonenum", async (req, res) => {
    try {
        const { phonenum } = req.params;

        mongoClient = new MongoClient(mongoURL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        const dbExists = await mongoClient.db(phonenum).listCollections().toArray();

        if (dbExists.length === 0) {
            // The database doesn't exist
            res.status(404).json({ error: "Session not found in the database." });
            return;
        }

        const collection = mongoClient.db(phonenum).collection("auth_info_baileys");
        const { state } = await useMongoDBAuthState(collection);

        const sock = makeWASocket({
            defaultQueryTimeoutMs: undefined,
            markOnlineOnConnect: true,
            printQRInTerminal: false,
            browser: ['Future-Forge-Shin', 'Safari', '3.1.0'],
            logger: pino({ level: 'silent' }),
            auth: state,
        });

        const isConnected = sock.ev.listeners('connection.update').length > 0;

        if (isConnected) {
            res.status(200).json({ isConnected, connectionStatus: 'Connected' });
        } else {
            res.status(401).json({ isConnected, connectionStatus: 'Disconnected' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while checking the connection status." });
    }
});

app.get("/remove", async (req, res) => {
    const { database } = req.query;
    if (!database) {
        res.status(400).json({ error: "database parameter is required." });
        return;
    }

    try {
            mongoClient = new MongoClient(mongoURL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        await mongoClient.connect();
        const dbExists = await mongoClient.db(database).listCollections().toArray();

        if (dbExists.length === 0) {
            res.status(404).json({ error: "Session not found in the database." });
            return;
        }
        await mongoClient.db(database).dropDatabase();

        res.status(200).json({ message: "Database removed successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while removing the database." });
    } finally {
        mongoClient.close();
    }
});

app.post("/remove", async (req, res) => {
    const { database } = req.body;
    if (!database) {
        res.status(400).json({ error: "database parameter is required." });
        return;
    }

    try {
            mongoClient = new MongoClient(mongoURL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        await mongoClient.connect();

        const dbExists = await mongoClient.db(database).listCollections().toArray();

        if (dbExists.length === 0) {
            res.status(404).json({ error: "Session not found in the database." });
            return;
        }
        await mongoClient.db(database).dropDatabase();

        res.status(200).json({ message: "Database removed successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while removing the database." });
    } finally {
        mongoClient.close();
    }
});

app.get("/check", async (req, res) => {
    const { id } = req.query;
    if (!id) {
        res.status(400).json({ error: "id parameter is required." });
        return;
    }
    const jid = id + '@s.whatsapp.net';

        mongoClient = new MongoClient(mongoURL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    const collection = mongoClient.db("whatsapp_api").collection("auth_info_baileys");
    const { state, saveCreds } = await useMongoDBAuthState(collection);

    const sock = makeWASocket({
        defaultQueryTimeoutMs: undefined,
        printQRInTerminal: false,
        markOnlineOnConnect: true,
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
            sock.ev.on("creds.update", saveCreds);
            const exist = await sock.onWhatsApp(jid);
            if (exist.length === 0) {
                res.status(404).json({ error: "The number doesn't exist or isn't registered in WhatsApp." });
            } else {
                res.status(200).json({ message: "The number is registered on WhatsApp." });
            }
        }
    });
});

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
                  markOnlineOnConnect: true,
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
                    const store = makeMongoStore({
                        db: mongoClient.db(phonenum),
                        filterChats: false,
                      })
                    store.bind(sock.ev)

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
              sock.ev.on('chats.set', () => {
                console.log('got chats', store.chats.all())
            })
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
    app.get('/get-chat', async (req, res) => {
        const phonenum = req.query.phonenum;
        const from = req.query.from;
    
        console.log("Start /get-chat endpoint");
    
        if (!phonenum) {
            res.status(400).json({ error: "Phone number parameter is missing." });
            return;
        }
    
        // MongoDB and WebSocket Setup
        mongoClient = new MongoClient(mongoURL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    
        try {
            console.log("Connecting to MongoDB");
            // Connect to MongoDB
            await mongoClient.connect();
    
            // Check if the database exists using listDatabases
            const databaseList = await mongoClient.db().admin().listDatabases();
            const databaseNames = databaseList.databases.map(db => db.name);
    
            console.log("Existing databases:", databaseNames);
    
            if (!databaseNames.includes(phonenum)) {
                // The database doesn't exist
                console.log(`Database ${phonenum} not found`);
                res.status(404).json({ error: "Session not found in the database." });
                return;
            }
    
            // Collection and auth state setup
            const collection = mongoClient.db(phonenum).collection("auth_info_baileys");
            const { state, saveCreds } = await useMongoDBAuthState(collection);
    
            // WebSocket setup
            const sock = makeWASocket({
                defaultQueryTimeoutMs: undefined,
                printQRInTerminal: false,
                markOnlineOnConnect: true,
                browser: ['Future-Forge-Shin', 'Safari', '3.1.0'],
                logger: pino({ level: 'silent' }),
                auth: state,
            });
    
            // Event handling
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update || {};
    
                if (connection === "close") {
                    const shouldReconnect =
                        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
    
                    if (shouldReconnect) {
                        // Handle reconnection logic if needed
                    }
                } else if (connection === "open") {
                    const store = makeMongoStore({
                        db: mongoClient.db(phonenum),
                        filterChats: false,
                    });
                    sock.ev.on('creds.update', saveCreds);
                    store.bind(sock.ev);
                }
            });
    
            const store = makeMongoStore({
                db: mongoClient.db(phonenum),
                filterChats: false,
            });
    
            const chatInfo = await store.getChatById(from + '@s.whatsapp.net');
    
            if (!chatInfo) {
                console.log("Chat not found for the specified phone number.");
                res.status(404).json({ error: "Chat not found for the specified phone number." });
                return;
            }            
            const messages = chatInfo.messages;
            const extractedMessages = [];
            
            for (const message of messages ?? []) {
                const key = message?.message?.key;
                const isFromMe = key?.fromMe;
            
                if (!isFromMe) {
                    const messageTimestamp = message?.message?.messageTimestamp?.toString();
                    const pushName = message?.message?.pushName;
                    const text = message?.message?.message?.extendedTextMessage?.text;
            
                    if (messageTimestamp && pushName && text) {
                        extractedMessages.push({
                            messageTimestamp,
                            pushName,
                            text
                        });
                    }
                }
            }
            
            res.setHeader('Content-Type', 'application/json');
            res.json({ extractedMessages });

        } catch (error) {
            console.error("Error:", error);
            res.status(500).json({ error: "Internal server error." });
        } 
    });
    
app.get('/chat', async (req, res) => {
    const phonenum = req.query.phonenum;

    console.log("Start /chat endpoint");

    if (!phonenum) {
        res.status(400).json({ error: "Phone number parameter is missing." });
        return;
    }

    try {
        console.log("Connecting to MongoDB");
        // Connect to MongoDB
        await mongoClient.connect();

        // Check if the database exists using listDatabases
        const databaseList = await mongoClient.db().admin().listDatabases();
        const databaseNames = databaseList.databases.map(db => db.name);

        console.log("Existing databases:", databaseNames);

        if (!databaseNames.includes(phonenum)) {
            // The database doesn't exist
            console.log(`Database ${phonenum} not found`);
            res.status(404).json({ error: "Session not found in the database." });
            return;
        }

        // Collection and auth state setup
        const collection = mongoClient.db(phonenum).collection("auth_info_baileys");
        const { state, saveCreds } = await useMongoDBAuthState(collection);

        // WebSocket setup
        const sock = makeWASocket({
            defaultQueryTimeoutMs: undefined,
            printQRInTerminal: false,
            markOnlineOnConnect: true,
            browser: ['Future-Forge-Shin', 'Safari', '3.1.0'],
            logger: pino({ level: 'silent' }),
            auth: state,
        });

        // Event handling
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update || {};

            if (connection === "close") {
                const shouldReconnect =
                    lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    // Handle reconnection logic if needed
                }
            } else if (connection === "open") {
                const store = makeMongoStore({
                    db: mongoClient.db(phonenum),
                    filterChats: false,
                });
                sock.ev.on('creds.update', saveCreds);
                store.bind(sock.ev);
            }
        });

        // Retrieve all chats
        const chatsCollection = mongoClient.db(phonenum).collection('chats');
        const chats = await chatsCollection.find({ id: { $regex: "@s.whatsapp.net$" } }).toArray();
        
        const allExtractedMessages = [];
        
        for (const chat of chats) {
            const messages = chat.messages;
            const extractedMessages = [];
            const chatIdWithoutSuffix = chat.id.replace(/@s.whatsapp.net$/, '');
        
            for (const message of messages ?? []) {
                const key = message.message.key;
                const isFromMe = key.fromMe;
        
                if (!isFromMe) {
                    const messageTimestamp = message?.message?.messageTimestamp?.toString();
                    const pushName = message?.message?.pushName;
                    const text = message?.message?.message?.extendedTextMessage?.text;
        
                    if (messageTimestamp && pushName && text) {
                        extractedMessages.push({
                            messageTimestamp,
                            pushName,
                            text,
                        });
                    }
                }
            }
        
            allExtractedMessages.push({ sender: chatIdWithoutSuffix, messages: extractedMessages });
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.json({ allExtractedMessages });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal server error." });
    } 
});    

mongoClient = new MongoClient(mongoURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoClient.connect()
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
  });

const port = process.env.PORT || 5123;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
