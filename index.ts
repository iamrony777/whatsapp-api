import { Socket } from "./src/core/socket.js";
import { LOGGER } from "./src/utils/logger.js";
import getQR from "./src/routes/getQR.js";
import sendMessage from "./src/routes/send.message.js";

const logger = LOGGER("core/bot", "trace");
logger.info("starting bot");
import express from "express";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/", getQR);
app.use("/", sendMessage);
const port = process.env.PORT || 5123;
app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});
