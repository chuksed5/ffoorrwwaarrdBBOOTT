const TelegramBot = require('node-telegram-bot-api');

// Replace with your bot token from @BotFather
const BOT_TOKEN = '7515470465:AAGZOuqnT3rcm0_xaWF8XlACpVbfV7bjcq4';

// Replace with your source group chat ID and target channel ID
const SOURCE_GROUP_ID = '-1002845747985';
const TARGET_CHANNEL_ID = '-1002697085169';

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Test function - add this after bot creation
async function testChannelAccess() {
    try {
        await bot.sendMessage(TARGET_CHANNEL_ID, 'Bot test - can you see this?');
        console.log('✅ Bot can access the channel!');
    } catch (error) {
        console.log('❌ Bot cannot access channel:', error.message);
    }
}

// Call this when bot starts
testChannelAccess();

// Define signal patterns to match
const signalPatterns = [
    /Boom 1000 Index BUY Signal/i,
    /Crash 1000 Index BUY Signal/i,
    /Boom 1000 Index SELL Signal/i,
    /Crash 1000 Index SELL Signal/i,
    // Add more patterns as needed
    /Boom 500 Index (BUY|SELL) Signal/i,
    /Crash 500 Index (BUY|SELL) Signal/i,
    /Volatility.*Index.*(BUY|SELL) Signal/i
];

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
        
        console.log('Signal forwarded successfully:', messageText.substring(0, 50) + '...');
    } catch (error) {
        console.error('Error forwarding signal:', error.message);
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
        console.log('Trading signal detected:', messageText.substring(0, 100) + '...');
        await forwardSignal(msg);
    }
});

// Handle polling errors
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Start message
console.log('🤖 Trading Signal Bot started!');
console.log('Monitoring group:', SOURCE_GROUP_ID);
console.log('Forwarding to channel:', TARGET_CHANNEL_ID);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Bot shutting down...');
    bot.stopPolling();
    process.exit(0);
});