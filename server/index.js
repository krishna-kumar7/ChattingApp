require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'whatsapp';
const COLLECTION = 'processed_messages';

app.use(cors());
app.use(express.json());

// Serve static files from the dist directory
const path = require('path');
app.use(express.static(path.join(__dirname, 'dist')));

let db, collection;
let membersCollection;

// Socket.io connection
io.on('connection', (socket) => {
  // Join room by wa_id for private chats
  socket.on('join', (wa_id) => {
    socket.join(wa_id);
  });
});

// Connect to MongoDB
async function connectDB() {
  const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  db = client.db(DB_NAME);
  collection = db.collection(COLLECTION);
  membersCollection = db.collection('members');
  console.log('Connected to MongoDB');
// Add a new member
app.post('/api/members', async (req, res) => {
  try {
    const { wa_id, name } = req.body;
    if (!wa_id || !name) {
      return res.status(400).json({ error: 'wa_id and name are required' });
    }
    // Check if member already exists
    const exists = await membersCollection.findOne({ wa_id });
    if (exists) {
      return res.status(409).json({ error: 'Member already exists' });
    }
    const member = { wa_id, name };
    await membersCollection.insertOne(member);
    res.status(201).json({ success: true, member });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all members
app.get('/api/members', async (req, res) => {
  try {
    const members = await membersCollection.find().toArray();
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
}

// Get all conversations grouped by wa_id
app.get('/api/conversations', async (req, res) => {
  try {
    const pipeline = [
      { $group: { _id: '$wa_id', messages: { $push: '$$ROOT' } } },
      { $sort: { '_id': 1 } }
    ];
    const conversations = await collection.aggregate(pipeline).toArray();
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages for a specific wa_id
app.get('/api/messages/:wa_id', async (req, res) => {
  try {
    const wa_id = req.params.wa_id;
    const messages = await collection.find({ wa_id }).sort({ timestamp: 1 }).toArray();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new message
app.post('/api/messages', async (req, res) => {
  try {
    const message = req.body;
    if (!message.wa_id || !message.text) {
      return res.status(400).json({ error: 'wa_id and text are required' });
    }
    message.timestamp = Date.now();
    message.status = 'sent';
  await collection.insertOne(message);
  // Emit to all clients in the wa_id room (sender and receiver)
  io.to(message.wa_id).emit('new_message', message);
  res.status(201).json({ success: true, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// Catch-all route to serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
