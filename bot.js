const TelegramBot = require('node-telegram-bot-api');

const TOKEN = '8270250780:AAFSgyrx0fsSzklLJjFwEUVQHYzsNpPCPRs';
const bot = new TelegramBot(TOKEN, { polling: true });

// /giveaway Приз | @канал | 2 | 60 | ссылка_на_картинку
bot.onText(/\/giveaway (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const args = match[1].split('|');

    const prize = args[0].trim();
    const channel = args[1].trim();
    const winnersCount = parseInt(args[2]) || 1;
    const duration = parseInt(args[3]) || 60;
    const image = args[4]?.trim();

    const giveawayId = Date.now();

    giveaways[giveawayId] = {
        prize,
        channel,
        winnersCount,
        participants: [],
        chatId,
        messageId: null
    };

    const caption =
        `🎁 РОЗЫГРЫШ\n\n` +
        `🎉 Приз: ${prize}\n` +
        `📢 Подписка: ${channel}\n` +
        `👥 Победителей: ${winnersCount}\n` +
        `⏱ ${duration} сек\n\n` +
        `Участников: 0`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎉 Участвовать", callback_data: `join_${giveawayId}` }],
                [{ text: "✅ Проверить подписку", callback_data: `check_${giveawayId}` }]
            ]
        }
    };

    let sent;

    if (image) {
        sent = await bot.sendPhoto(chatId, image, { caption, ...keyboard });
    } else {
        sent = await bot.sendMessage(chatId, caption, keyboard);
    }

    giveaways[giveawayId].messageId = sent.message_id;

    setTimeout(() => finishGiveaway(giveawayId), duration * 1000);
});

// Проверка подписки
async function isSubscribed(userId, channel) {
    try {
        const member = await bot.getChatMember(channel, userId);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch {
        return false;
    }
}

// Кнопки
bot.on('callback_query', async (query) => {
    const data = query.data;
    const user = query.from;

    if (data.startsWith('join_')) {
        const id = data.split('_')[1];
        const g = giveaways[id];
        if (!g) return;

        const subscribed = await isSubscribed(user.id, g.channel);

        if (!subscribed) {
            return bot.answerCallbackQuery(query.id, {
                text: "❌ Подпишись на канал сначала",
                show_alert: true
            });
        }

        if (g.participants.find(p => p.id === user.id)) {
            return bot.answerCallbackQuery(query.id, { text: "Ты уже участвуешь" });
        }

        g.participants.push({
            id: user.id,
            name: user.first_name
        });

        bot.answerCallbackQuery(query.id, { text: "Ты участвуешь ✅" });

        updateMessage(id);
    }

    if (data.startsWith('check_')) {
        const id = data.split('_')[1];
        const g = giveaways[id];
        if (!g) return;

        const subscribed = await isSubscribed(user.id, g.channel);

        if (subscribed) {
            bot.answerCallbackQuery(query.id, { text: "✅ Подписка есть!" });
        } else {
            bot.answerCallbackQuery(query.id, {
                text: "❌ Ты не подписан",
                show_alert: true
            });
        }
    }
});

// Обновление сообщения
function updateMessage(id) {
    const g = giveaways[id];

    bot.editMessageCaption(
        `🎁 РОЗЫГРЫШ\n\n` +
        `🎉 Приз: ${g.prize}\n` +
        `📢 Подписка: ${g.channel}\n` +
        `👥 Победителей: ${g.winnersCount}\n\n` +
        `Участников: ${g.participants.length}`,
        {
            chat_id: g.chatId,
            message_id: g.messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🎉 Участвовать", callback_data: `join_${id}` }],
                    [{ text: "✅ Проверить подписку", callback_data: `check_${id}` }]
                ]
            }
        }
    ).catch(() => {});
}

// Завершение
function finishGiveaway(id) {
    const g = giveaways[id];
    if (!g) return;

    if (g.participants.length === 0) {
        bot.sendMessage(g.chatId, "❌ Нет участников");
        return;
    }

    let shuffled = g.participants.sort(() => 0.5 - Math.random());
    let winners = shuffled.slice(0, g.winnersCount);

    const text = winners
        .map(w => `[${w.name}](tg://user?id=${w.id})`)
        .join('\n');

    bot.sendMessage(g.chatId,
        `🏆 ПОБЕДИТЕЛИ:\n\n${text}`,
        { parse_mode: 'Markdown' }
    );

    delete giveaways[id];
}

console.log("🔥 Бот с проверкой подписки запущен");
