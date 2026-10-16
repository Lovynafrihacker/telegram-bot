const mongoose = require('mongoose');

// User Schema (Tracking, Expiry, Status)
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  username: String,
  isPremium: { type: Boolean, default: false },
  premiumExpiresAt: { type: Date, default: null },
  joinedAt: { type: Date, default: Date.now }
});

// Connected Channels/Groups Schema
const channelSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  channelName: String,
  addedAt: { type: Date, default: Date.now }
});

// Custom Buttons & Links Schema
const buttonSchema = new mongoose.Schema({
  text: String,
  url: String
});

module.exports = {
  User: mongoose.model('User', userSchema),
  Channel: mongoose.model('Channel', channelSchema),
  Button: mongoose.model('Button', buttonSchema)
};
