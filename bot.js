const TelegramBot = require('node-telegram-bot-api');

const TOKEN = '8270250780:AAFSgyrx0fsSzklLJjFwEUVQHYzsNpPCPRs';
const bot = new TelegramBot(TOKEN, { polling: true });

// Создание розыгрыша
// /giveaway Приз | 2 | 60
// (приз | победителей | секунд)
bot.onText(/\/giveaway (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const args = match[1].split('|');

    const prize = args[0].trim();
    const winnersCount = parseInt(args[1]) || 1;
    const duration = parseInt(args[2]) || 60;

    const giveawayId = Date.now();

    giveaways[giveawayId] = {
        prize,
        winnersCount,
        participants: [],
        chatId,
        messageId: null
    };

    bot.sendMessage(chatId,
        `🎁 РОЗЫГРЫШ\n\n` +
        `🎉 Приз: ${prize}\n` +
        `👥 Победителей: ${winnersCount}\n` +
        `⏱ Время: ${duration} сек\n\n` +
        `Участников: 0`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🎉 Участвовать", callback_data: `join_${giveawayId}` }]
                ]
            }
        }
    ).then(sentMsg => {
        giveaways[giveawayId].messageId = sentMsg.message_id;
    });

    // Таймер завершения
    setTimeout(() => finishGiveaway(giveawayId), duration * 1000);
});

// Участие
bot.on('callback_query', (query) => {
    const data = query.data;
    const user = query.from;

    if (data.startsWith('join_')) {
        const giveawayId = data.split('_')[1];
        const giveaway = giveaways[giveawayId];

        if (!giveaway) return;

        if (giveaway.participants.find(p => p.id === user.id)) {
            return bot.answerCallbackQuery(query.id, { text: "Ты уже участвуешь ❌" });
        }

        giveaway.participants.push({
            id: user.id,
            name: user.first_name
        });

        bot.answerCallbackQuery(query.id, { text: "Ты участвуешь ✅" });

        // Обновляем сообщение
        bot.editMessageText(
            `🎁 РОЗЫГРЫШ\n\n` +
            `🎉 Приз: ${giveaway.prize}\n` +
            `👥 Победителей: ${giveaway.winnersCount}\n\n` +
            `Участников: ${giveaway.participants.length}`,
            {
                chat_id: giveaway.chatId,
                message_id: giveaway.messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🎉 Участвовать", callback_data: `join_${giveawayId}` }]
                    ]
                }
            }
        );
    }
});

// Завершение
function finishGiveaway(giveawayId) {
    const giveaway = giveaways[giveawayId];
    if (!giveaway) return;

    const { participants, winnersCount, chatId } = giveaway;

    if (participants.length === 0) {
        bot.sendMessage(chatId, "❌ Нет участников");
        return;
    }

    let shuffled = participants.sort(() => 0.5 - Math.random());
    let winners = shuffled.slice(0, winnersCount);

    const winnersText = winners.map(w => `[${w.name}](tg://user?id=${w.id})`).join('\n');

    bot.sendMessage(chatId,
        `🏆 РЕЗУЛЬТАТЫ РОЗЫГРЫША\n\n${winnersText}`,
        { parse_mode: 'Markdown' }
    );

    delete giveaways[giveawayId];
}

console.log("Бот запущен 🚀");
