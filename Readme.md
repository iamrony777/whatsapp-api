
# WhatsApp Messaging Server API with Node.js

This is a Node.js server application that allows you to send WhatsApp messages using the WhiskeySockets Baileys library. It also stores chat data in-memory and provides an API for sending messages.

## **IMPORTANT**: Before running the api, please follow these steps in the sample directory of the repository:

1. Navigate to the `sample` directory:

   ```bash
   cd sample
   ```
3. Get QR Code by running `node script.js <phone-number>`
   For eg.
    ```bash
    node script.js 919321654780
    ```
4. Scan the QR code to register your phone number in the database. Do not log out of the session.

## Before running this application, make sure you have the following installed:

- Node.js: [Download Node.js](https://nodejs.org/)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/FutureForge-Studios/whatsapp-api.git
   cd whatsapp-api 
   ```
   
2. Install the required dependencies:
    ```
    npm install
    ```

3. Set up MongoDB :
If you want to store authentication data in MongoDB, make sure you have a MongoDB URL, and set the MONGO_URL environment variable to your MongoDB connection string.
create a .env file to put your MongoDB url in refer sample.env.

4. Start the server:
    ```
    npm start
    ```
## Send a WhatsApp Message

To send a WhatsApp message, make a POST request to the `/send-message` endpoint with the following parameters in the request body:

- `id`: The recipient's WhatsApp ID (format: `phone_number@s.whatsapp.net`).
- `phonenum`: Your phone number.
- `text`: The text message (optional).
- `audio`: URL or file path to an audio message (optional).
- `video`: URL to a video message (optional).
- `gifPlayback`: Whether to enable GIF playback (optional).
- `caption`: Caption for the message (optional).
- `image`: URL to an image message (optional).

**Example POST request:**

```bash
curl -X POST http://localhost:5000/send-message -H "Content-Type: application/json" -d '{
  "id": "recipient_phone_number",
  "phonenum": "your_phone_number",
  "text": "Hello, world!"
}'
```

## TODO List

1. Add Bulk Message sender.
2. Implement Client Custom actions.
3. Enable Broadcast Messages.
4. Provide an endpoint to show server logs (e.g., /chats).
5. Error Handlings 
