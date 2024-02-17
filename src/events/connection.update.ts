import { Boom } from "@hapi/boom";
import type { Response } from "express";
import {
  BaileysEventMap,
  Browsers,
  delay,
  DisconnectReason,
  makeMongoStore,
  WASocket,
} from "@iamrony777/baileys";
import { LOGGER } from "../utils/logger.js";
// import { removeCreds, socket } from "../core/socket.js";
import { Socket } from "../core/socket.js";
import { hostname } from "os";
import QRCode from "qrcode";
import { getOnCredsUpdate } from "./creds.update.js";
const logger = LOGGER("events/connection.update", "debug");

export const getOnConnectionUpdate = (
  response: Response<any, Record<string, any>> | undefined,
  waSocket: Socket,
  SocketClass: typeof Socket
) => {
  return async function onConnectionUpdate(
    update: BaileysEventMap["connection.update"]
  ) {
    if (update.qr !== undefined) {
      const qrDataUrl = await QRCode.toDataURL(update.qr);
      response.send(`<img src="${qrDataUrl}" alt="QR Code" />`);
    }

    if (update.connection === "close") {
      if (
        update.lastDisconnect &&
        update.lastDisconnect.error instanceof Boom &&
        update.lastDisconnect.error?.output
      ) {
        if (
          update.lastDisconnect.error.output.statusCode ===
          DisconnectReason.loggedOut
        ) {
          logger.error("Connection closed, you are logged out");
          // if logged out , remove previous session and relogin
          // await _ds.db(baileysAuth.name).dropDatabase();
          waSocket.mongoDb.dropDatabase();
          // exit(1);
        } else {
          logger.error(update.lastDisconnect.error.output);
          const waClient = new SocketClass(waSocket.phoneNumber);
          await waClient.connect();
          await waClient.eventsMap({
            socket: waClient.socket,
            onConnectionUpdate: getOnConnectionUpdate(
              undefined,
              waClient,
              Socket
            ),
            onCredsUpdate: getOnCredsUpdate(waClient.saveCreds),
          });
          // exit(1);
        }
      }
    }

    if (update.connection === "open") {
      const browser = [`Forge Bot`, "Safari", "3.0"];

      logger.info(
        `User: ${waSocket.socket.user?.id.match(/^\d+(?=[:@])/gm)[0]}`
      );
      logger.info(
        `Connected - ${hostname()} running ${browser[0]}, Kernel version: ${
          browser[2]
        }`
      );

      waSocket.store.bind(waSocket.socket.ev);
      await waSocket.socket.sendMessage(
        waSocket.socket.user?.id!,
        {
          text: `Succesfully Connected To Forge Whatsapp Service, Database-${
            waSocket.socket.user.id.match(/^\d+(?=[:@])/gm)[0]
          } Connected via *${hostname()}* running ${
            browser[0]
          }, Kernel version: ${browser[2]}`,
        },
        { ephemeralExpiration: 60 * 1 }
      );
      await delay(500 * 10);

      await waSocket.socket.sendMessage(waSocket.socket.user.id, {
        image: { url: "https://i.imgur.com/R8BwMSb.png" },
        caption: `Thank You For using our Service, Have a great day`,
      });
    }
  };
};

export const executeOnOpenConnection = (
  response: Response<any, Record<string, any>> | undefined,
  waSocket: Socket,
  funtionToExecute: () => Promise<void>
) => {
  return async function onConnectionUpdate(
    update: BaileysEventMap["connection.update"]
  ) {
    if (update.connection === "open") {
      waSocket.store.bind(waSocket.socket.ev);

      try {
        await funtionToExecute();
        delete waSocket.socket
      } catch (error: any) {
        response.status(500).json({ error: error.toString() });
      }
    }
  };
};
