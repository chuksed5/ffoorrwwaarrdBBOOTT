const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express server for Render (required for web services)
const app = express();
const PORT = process.env.PORT || 3000;

// Use environment variables for sensitive data
const BOT_TOKEN = process.env.BOT_TOKEN;
const SOURCE_GROUP_ID = process.env.SOURCE_GROUP_ID;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;

// Validation
if (!BOT_TOKEN || !SOURCE_GROUP_ID || !TARGET_CHANNEL_ID) {
    console.error('❌ Missing required environment variables:');
    console.error('BOT_TOKEN:', !!BOT_TOKEN);
    console.error('SOURCE_GROUP_ID:', !!SOURCE_GROUP_ID);
    console.error('TARGET_CHANNEL_ID:', !!TARGET_CHANNEL_ID);
    process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Define signal patterns to match
const signalPatterns = [
    /Boom 1000 Index BUY Signal/i,
    /Crash 1000 Index BUY Signal/i,
    /Boom 1000 Index SELL Signal/i,
    /Crash 1000 Index SELL Signal/i,
    /Boom 500 Index (BUY|SELL) Signal/i,
    /Crash 500 Index (BUY|SELL) Signal/i,
    /Volatility.*Index.*(BUY|SELL) Signal/i
];

// Express routes for health checking
app.get('/', (req, res) => {
    res.json({
        status: 'Bot is running!',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot_running: true,
        uptime: process.uptime(),
        environment: {
            bot_token_set: !!BOT_TOKEN,
            source_group_set: !!SOURCE_GROUP_ID,
            target_channel_set: !!TARGET_CHANNEL_ID
        }
    });
});

// Start Express server
app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

// Function to check if message contains trading signals
function containsSignal(text) {
    if (!text) return false;
    return signalPatterns.some(pattern => pattern.test(text));
}

// Function to forward message to channel
async function forwardSignal(message) {
    try {
        const messageText = message.text || message.caption || '';
        
        // Create formatted message
        const forwardedMessage = `🔥 TRADING SIGNAL 🔥\n\n${messageText}\n\n⏰ Time: ${new Date().toLocaleString()}`;
        
        // Send to channel
        await bot.sendMessage(TARGET_CHANNEL_ID, forwardedMessage);
        
        console.log('✅ Signal forwarded successfully:', messageText.substring(0, 50) + '...');
    } catch (error) {
        console.error('❌ Error forwarding signal:', error.message);
        
        if (error.message.includes('chat not found')) {
            console.log('🔍 Bot cannot access the target channel. Please check:');
            console.log('1. Bot is added as admin to the channel');
            console.log('2. Channel ID is correct');
            console.log('3. Bot has permission to post messages');
        }
    }
}

// Test function to verify bot can access channel
async function testChannelAccess() {
    try {
        await bot.sendMessage(TARGET_CHANNEL_ID, '🤖 Bot deployed and running on Render!');
        console.log('✅ Bot can access the target channel!');
    } catch (error) {
        console.log('❌ Bot cannot access channel:', error.message);
    }
}

// Listen for messages
bot.on('message', async (msg) => {
    // Only process messages from the source group
    if (msg.chat.id.toString() !== SOURCE_GROUP_ID.toString()) {
        return;
    }
    
    const messageText = msg.text || msg.caption || '';
    
    // Check if message contains trading signals
    if (containsSignal(messageText)) {
        console.log('🎯 Trading signal detected:', messageText.substring(0, 100) + '...');
        await forwardSignal(msg);
    }
});

// Handle polling errors
bot.on('polling_error', (error) => {
    console.error('🚨 Polling error:', error.code, error.message);
});

// Bot startup
bot.getMe().then((botInfo) => {
    console.log('🤖 Trading Signal Bot started!');
    console.log('📋 Bot Info:', botInfo.username);
    console.log('👥 Monitoring group:', SOURCE_GROUP_ID);
    console.log('📢 Forwarding to channel:', TARGET_CHANNEL_ID);
    
    // Test channel access after a short delay
    setTimeout(testChannelAccess, 3000);
}).catch((error) => {
    console.error('❌ Failed to start bot:', error.message);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Bot shutting down...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Bot received SIGTERM, shutting down...');
    bot.stopPolling();
    process.exit(0);
});
