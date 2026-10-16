require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { User, Channel, Button } = require('./models');

// Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_ID = parseInt(process.env.ADMIN_ID); // Admin's Telegram Numeric ID

if (!BOT_TOKEN || !MONGO_URI || !ADMIN_ID) {
  console.error("❌ ERROR: BOT_TOKEN, MONGO_URI, or ADMIN_ID missing in environment variables!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==========================================
// 1. USER ONBOARDING & START
// ==========================================
bot.start(async (ctx) => {
  try {
    const { id, first_name, username } = ctx.from;

    let user = await User.findOne({ telegramId: id });
    if (!user) {
      user = new User({ telegramId: id, firstName: first_name, username });
      await user.save();
    }

    const buttons = await Button.find();
    let inlineKeyboard = buttons.map(b => [Markup.button.url(b.text, b.url)]);
    
    inlineKeyboard.push([Markup.button.callback('💎 Check Premium Status', 'check_status')]);

    await ctx.reply(
      `👋 Hello ${first_name}!\n\nWelcome to **Premium Prediction Bot** 🎯\nChoose an option below:`,
      Markup.inlineKeyboard(inlineKeyboard)
    );
  } catch (error) {
    console.error('Error in /start:', error);
  }
});

// Check Status Button Handler
bot.action('check_status', async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  if (user && user.isPremium) {
    const daysLeft = Math.ceil((new Date(user.premiumExpiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    ctx.reply(`💎 **VIP Status:** Active\n⏰ **Expires in:** ${daysLeft} Days`);
  } else {
    ctx.reply(`❌ You don't have active VIP Membership.\nContact Admin to buy VIP access.`);
  }
});

// ==========================================
// 8. ADMIN PANEL COMMANDS
// ==========================================

// Admin Middleware
const isAdmin = (ctx, next) => {
  if (ctx.from.id === ADMIN_ID) return next();
  return ctx.reply('⛔ Access Denied! Only Admin can use this command.');
};

bot.command('admin', isAdmin, (ctx) => {
  const adminMenu = `
⚙️ **Admin Control Panel**

1. \`/addpremium <userID> <days>\` - Grant VIP Membership
2. \`/removepremium <userID>\` - Revoke VIP
3. \`/addchannel <channelID>\` - Add Channel for Forwarding/Broadcast
4. \`/addbutton <Text> | <URL>\` - Add Custom Button
5. \`/broadcast <Message>\` - Send Bulk Msg to All Bot Users
6. \`/channelpost <Message>\` - Post to All Integrated Channels
7. \`/dm <userID> <Message>\` - Individual Direct Message / Follow-up
8. \`/stats\` - View Total Users & Revenue Metrics
`;
  ctx.replyWithMarkdown(adminMenu);
});

// 7. Add VIP Premium
bot.command('addpremium', isAdmin, async (ctx) => {
  const args = ctx.message.text.split(' ');
  const targetId = parseInt(args[1]);
  const days = parseInt(args[2]);

  if (!targetId || !days) return ctx.reply('Usage: `/addpremium <userID> <days>`');

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);

  await User.findOneAndUpdate(
    { telegramId: targetId },
    { isPremium: true, premiumExpiresAt: expiryDate },
    { upsert: true }
  );

  ctx.reply(`✅ Added User ${targetId} as VIP for ${days} days.`);
  bot.telegram.sendMessage(targetId, `🎉 **Congratulations!** Your VIP Premium Access has been activated for ${days} days!`).catch(() => {});
});

// 5. Add Integrated Channel
bot.command('addchannel', isAdmin, async (ctx) => {
  const channelId = ctx.message.text.split(' ')[1];
  if (!channelId) return ctx.reply('Usage: `/addchannel @channel_username` or `-100xxxxxxx`');

  try {
    await new Channel({ channelId }).save();
    ctx.reply(`✅ Channel ${channelId} integrated successfully.`);
  } catch (err) {
    ctx.reply(`❌ Channel already exists or invalid.`);
  }
});

// 6. Add Custom Inline Buttons
bot.command('addbutton', isAdmin, async (ctx) => {
  const input = ctx.message.text.replace('/addbutton ', '').split('|');
  if (input.length < 2) return ctx.reply('Usage: `/addbutton Button Name | https://link.com`');

  const text = input[0].trim();
  const url = input[1].trim();

  await new Button({ text, url }).save();
  ctx.reply(`✅ Custom button '${text}' added to main menu.`);
});

// 4. Bulk Broadcast to All Bot Users
bot.command('broadcast', isAdmin, async (ctx) => {
  const msg = ctx.message.text.replace('/broadcast ', '');
  if (!msg) return ctx.reply('Please provide text to broadcast.');

  const users = await User.find();
  let count = 0;

  ctx.reply(`📢 Sending broadcast to ${users.length} users...`);

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.telegramId, msg);
      count++;
    } catch (e) {
      // User blocked bot
    }
  }

  ctx.reply(`✅ Broadcast completed. Delivered to ${count} users.`);
});

// 2. Multi-Channel Instant Forwarding / Posting
bot.command('channelpost', isAdmin, async (ctx) => {
  const msg = ctx.message.text.replace('/channelpost ', '');
  const channels = await Channel.find();

  if (channels.length === 0) return ctx.reply('No integrated channels found. Add using `/addchannel`.');

  for (const ch of channels) {
    try {
      await bot.telegram.sendMessage(ch.channelId, msg);
    } catch (e) {
      ctx.reply(`❌ Failed sending to ${ch.channelId}: ${e.message}`);
    }
  }

  ctx.reply(`🚀 Instant prediction/message posted to all ${channels.length} integrated channels.`);
});

// 3. Individual Direct User Messaging & Follow-Up
bot.command('dm', isAdmin, async (ctx) => {
  const args = ctx.message.text.split(' ');
  const targetId = parseInt(args[1]);
  const msg = args.slice(2).join(' ');

  if (!targetId || !msg) return ctx.reply('Usage: `/dm <userID> <Your Message>`');

  try {
    await bot.telegram.sendMessage(targetId, `📩 **Message from Admin:**\n\n${msg}`);
    ctx.reply(`✅ DM Sent to user ${targetId}`);
  } catch (err) {
    ctx.reply(`❌ Failed to send DM. User might have blocked the bot.`);
  }
});

// 10. User Activity & Stats Tracking
bot.command('stats', isAdmin, async (ctx) => {
  const totalUsers = await User.countDocuments();
  const premiumUsers = await User.countDocuments({ isPremium: true });
  const totalChannels = await Channel.countDocuments();

  ctx.reply(`
📊 **Bot Activity & Statistics**
--------------------------------
👥 Total Bot Users: ${totalUsers}
💎 Active Premium Users: ${premiumUsers}
📢 Connected Channels: ${totalChannels}
  `);
});

// ==========================================
// 7. & 9. AUTOMATED CRON SCHEDULER (REMINDERS & EXPIRY)
// ==========================================

// 1. Check Expiry Daily at Midnight (00:00)
cron.schedule('0 0 * * *', async () => {
  console.log('🔄 Running Premium Expiry Check Cron...');
  const expiredUsers = await User.find({
    isPremium: true,
    premiumExpiresAt: { $lte: new Date() }
  });

  for (const user of expiredUsers) {
    user.isPremium = false;
    user.premiumExpiresAt = null;
    await user.save();

    bot.telegram.sendMessage(
      user.telegramId,
      '⚠️ Your VIP Premium Plan has expired. Re-subscribe now to keep receiving predictions!'
    ).catch(() => {});
  }
});

// 2. Automated Scheduled Prediction Post Example (Every day at 10:30 AM)
cron.schedule('30 10 * * *', async () => {
  console.log('⏰ Executing Scheduled Auto-Prediction Broadcast...');
  const channels = await Channel.find();
  const predictionMsg = "🎯 **SCHEDULED FREE PREDICTION** 🎯\n\nPeriod: 20261016001\nRecommendation: GREEN / 7\nConfidence: 95%";

  for (const ch of channels) {
    bot.telegram.sendMessage(ch.channelId, predictionMsg).catch(() => {});
  }
}, {
  timezone: "Asia/Kolkata"
});

// Launch Bot
bot.launch();
console.log('🤖 Premium Prediction Bot is Live!');

// Process Termination Handling
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
