// Script to process WhatsApp webhook payloads and update MongoDB
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'whatsapp';
const COLLECTION = 'processed_messages';
const PAYLOADS_DIR = path.join(__dirname, 'payloads');

async function main() {
  if (!MONGODB_URI) {
    console.error('Please set MONGODB_URI in your .env file');
    process.exit(1);
  }
  const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);
    const files = fs.readdirSync(PAYLOADS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(PAYLOADS_DIR, file);
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (payload.messages) {
        // Insert new messages
        for (const msg of payload.messages) {
          const existing = await collection.findOne({ id: msg.id });
          if (!existing) {
            await collection.insertOne(msg);
            console.log(`Inserted message: ${msg.id}`);
          } else {
            console.log(`Message already exists: ${msg.id}`);
          }
        }
      } else if (payload.statuses) {
        // Update message status
        for (const status of payload.statuses) {
          const filter = { id: status.id };
          const update = { $set: { status: status.status, status_timestamp: status.timestamp } };
          const result = await collection.updateOne(filter, update);
          if (result.matchedCount) {
            console.log(`Updated status for message: ${status.id}`);
          } else {
            console.log(`No message found for status update: ${status.id}`);
          }
        }
      } else {
        console.log(`Unknown payload type in file: ${file}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

main();
