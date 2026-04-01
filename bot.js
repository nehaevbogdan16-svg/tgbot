const TelegramBot = require('node-telegram-bot-api');

const TOKEN = 'ТВОЙ_ТОКЕН';
const bot = new TelegramBot(TOKEN, { polling: true });

// Хранилище розыгрышей
let giveaways = {};

// Создание розыгрыша
bot.onText(/\/giveaway (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1];

    const args = text.split('|');
    const prize = args[0];
    const winnersCount = parseInt(args[1]) || 1;

    const giveawayId = Date.now();

    giveaways[giveawayId] = {
        prize,
        winnersCount,
        participants: []
    };

    bot.sendMessage(chatId, 
        `🎁 РОЗЫГРЫШ!\n\nПриз: ${prize}\nПобедителей: ${winnersCount}`, 
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🎉 Участвовать", callback_data: `join_${giveawayId}` }]
                ]
            }
        }
    );
});

// Участие
bot.on('callback_query', (query) => {
    const data = query.data;
    const userId = query.from.id;

    if (data.startsWith('join_')) {
        const giveawayId = data.split('_')[1];
        const giveaway = giveaways[giveawayId];

        if (!giveaway) return;

        if (!giveaway.participants.includes(userId)) {
            giveaway.participants.push(userId);
            bot.answerCallbackQuery(query.id, { text: "Ты участвуешь!" });
        } else {
            bot.answerCallbackQuery(query.id, { text: "Ты уже участвуешь!" });
        }
    }
});

// Выбор победителя
bot.onText(/\/finish (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const giveawayId = match[1];

    const giveaway = giveaways[giveawayId];

    if (!giveaway) {
        return bot.sendMessage(chatId, "Розыгрыш не найден");
    }

    if (giveaway.participants.length === 0) {
        return bot.sendMessage(chatId, "Нет участников");
    }

    let winners = [];

    for (let i = 0; i < giveaway.winnersCount; i++) {
        const randomIndex = Math.floor(Math.random() * giveaway.participants.length);
        winners.push(giveaway.participants[randomIndex]);
    }

    bot.sendMessage(chatId, 
        `🏆 Победители:\n${winners.map(id => `[user](tg://user?id=${id})`).join('\n')}`, 
        { parse_mode: 'Markdown' }
    );

    delete giveaways[giveawayId];
});

console.log("Бот запущен 🚀");
