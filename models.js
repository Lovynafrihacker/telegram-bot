const express = require('express');
const app = express();

// Render ke liye chota sa web server
app.get('/', (req, res) => {
    sendResponse = "🤖 Telegram Prediction Bot is Active & Running 24/7!";
    res.send(sendResponse);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// --- Yahan se aapka pehla wala poora bot aur cron code shuru hoga ---
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { User, Channel, Button } = require('./models');

// (Baaki ka aapka saara code waisa ka waisa hi rahega...)

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
