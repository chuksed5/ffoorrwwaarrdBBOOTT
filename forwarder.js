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

// Create bot instance with better error handling
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: {
        interval: 300,
        autoStart: false,
        params: {
            timeout: 10
        }
    }
});

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
        timestamp: new Date().toISOString(),
        bot_info: {
            polling: bot.isPolling(),
            source_group: SOURCE_GROUP_ID,
            target_channel: TARGET_CHANNEL_ID
        }
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot_running: bot.isPolling(),
        uptime: process.uptime()
    });
});

app.get('/restart', (req, res) => {
    console.log('🔄 Manual restart requested');
    restartBot();
    res.json({ message: 'Bot restart initiated' });
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
    }
}

// Function to safely start bot
async function startBot() {
    try {
        // Stop polling if already running
        if (bot.isPolling()) {
            console.log('🛑 Stopping existing polling...');
            await bot.stopPolling();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Clear any pending updates
        console.log('🧹 Clearing pending updates...');
        await bot.getUpdates({ offset: -1 });

        // Start polling
        console.log('🚀 Starting bot polling...');
        await bot.startPolling();
        
        console.log('✅ Bot polling started successfully');
        
        // Get bot info
        const botInfo = await bot.getMe();
        console.log('🤖 Trading Signal Bot started!');
        console.log('📋 Bot Info:', botInfo.username);
        console.log('👥 Monitoring group:', SOURCE_GROUP_ID);
        console.log('📢 Forwarding to channel:', TARGET_CHANNEL_ID);
        
        // Test channel access
        setTimeout(testChannelAccess, 3000);
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error.message);
        // Retry after 5 seconds
        setTimeout(startBot, 5000);
    }
}

// Function to restart bot
async function restartBot() {
    try {
        console.log('🔄 Restarting bot...');
        if (bot.isPolling()) {
            await bot.stopPolling();
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        await startBot();
    } catch (error) {
        console.error('❌ Error restarting bot:', error.message);
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
    try {
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
    } catch (error) {
        console.error('❌ Error processing message:', error.message);
    }
});

// Handle polling errors with restart logic
bot.on('polling_error', async (error) => {
    console.error('🚨 Polling error:', error.code, error.message);
    
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        console.log('🔄 Conflict detected, restarting bot in 5 seconds...');
        setTimeout(restartBot, 5000);
    } else if (error.code === 'ETELEGRAM' && error.message.includes('terminated by other getUpdates')) {
        console.log('🔄 Multiple instances detected, restarting bot in 10 seconds...');
        setTimeout(restartBot, 10000);
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Bot shutting down...');
    if (bot.isPolling()) {
        await bot.stopPolling();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Bot received SIGTERM, shutting down...');
    if (bot.isPolling()) {
        await bot.stopPolling();
    }
    process.exit(0);
});

// Start the bot
console.log('🔧 Initializing bot...');
setTimeout(startBot, 2000); // Wait 2 seconds before starting
