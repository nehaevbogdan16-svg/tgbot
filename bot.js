const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();

const bot = new TelegramBot(process.env.TOKEN, { polling: true });

// ВСТАВЬ СВОЙ ID
const ADMINS = [123456789];

function isAdmin(id) {
    return ADMINS.includes(id);
}

let giveaways = {};

// WEB (чтобы Railway не засыпал)
const app = express();
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(3000, () => console.log('Web server started'));

// СОЗДАНИЕ РОЗЫГРЫША
bot.onText(/\/giveaway (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;

    const chatId = msg.chat.id;
    const args = match[1].split('|');

    const prize = args[0].trim();
    const channel = args[1].trim();
    const winnersCount = parseInt(args[2]) || 1;
    const duration = parseInt(args[3]) || 60;
    const image = args[4]?.trim();

    const id = Date.now();

    giveaways[id] = {
        prize,
        channel,
        winnersCount,
        participants: [],
        chatId,
        messageId: null
    };

    const text =
        `🎁 РОЗЫГРЫШ\n\n` +
        `🎉 ${prize}\n` +
        `📢 Подписка: ${channel}\n` +
        `👥 Победителей: ${winnersCount}\n` +
        `⏱ ${duration} сек\n\n` +
        `Участников: 0`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎉 Участвовать", callback_data: `join_${id}` }],
                [{ text: "✅ Проверить подписку", callback_data: `check_${id}` }]
            ]
        }
    };

    let sent;

    if (image) {
        sent = await bot.sendPhoto(chatId, image, { caption: text, ...keyboard });
    } else {
        sent = await bot.sendMessage(chatId, text, keyboard);
    }

    giveaways[id].messageId = sent.message_id;

    setTimeout(() => finishGiveaway(id), duration * 1000);
});

// ПРОВЕРКА ПОДПИСКИ
async function isSubscribed(userId, channel) {
    try {
        const member = await bot.getChatMember(channel, userId);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch {
        return false;
    }
}

// КНОПКИ
bot.on('callback_query', async (query) => {
    const data = query.data;
    const user = query.from;

    // УЧАСТИЕ
    if (data.startsWith('join_')) {
        const id = data.split('_')[1];
        const g = giveaways[id];
        if (!g) return;

        const ok = await isSubscribed(user.id, g.channel);

        if (!ok) {
            return bot.answerCallbackQuery(query.id, {
                text: "Подпишись на канал ❌",
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

    // ПРОВЕРКА
    if (data.startsWith('check_')) {
        const id = data.split('_')[1];
        const g = giveaways[id];
        if (!g) return;

        const ok = await isSubscribed(user.id, g.channel);

        bot.answerCallbackQuery(query.id, {
            text: ok ? "✅ Подписан" : "❌ Не подписан",
            show_alert: !ok
        });
    }

    // АДМИНКА
    if (data === "admin_list") {
        if (!isAdmin(user.id)) return;

        let buttons = Object.keys(giveaways).map(id => [{
            text: `🎁 ${giveaways[id].prize}`,
            callback_data: `admin_view_${id}`
        }]);

        if (!buttons.length) {
            return bot.sendMessage(query.message.chat.id, "Нет розыгрышей");
        }

        bot.sendMessage(query.message.chat.id, "📊 Розыгрыши:", {
            reply_markup: { inline_keyboard: buttons }
        });
    }

    if (data.startsWith("admin_view_")) {
        if (!isAdmin(user.id)) return;

        const id = data.split("_")[2];
        const g = giveaways[id];
        if (!g) return;

        bot.sendMessage(query.message.chat.id,
            `🎁 ${g.prize}\n👥 ${g.participants.length}`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🏆 Завершить", callback_data: `admin_finish_${id}` }],
                        [{ text: "👥 Участники", callback_data: `admin_users_${id}` }],
                        [{ text: "🗑 Удалить", callback_data: `admin_delete_${id}` }]
                    ]
                }
            }
        );
    }

    if (data.startsWith("admin_finish_")) {
        if (!isAdmin(user.id)) return;

        const id = data.split("_")[2];
        finishGiveaway(id);
    }

    if (data.startsWith("admin_users_")) {
        if (!isAdmin(user.id)) return;

        const id = data.split("_")[2];
        const g = giveaways[id];
        if (!g) return;

        const list = g.participants.map(p => `${p.name} (${p.id})`).join("\n");

        bot.sendMessage(query.message.chat.id, list || "Нет участников");
    }

    if (data.startsWith("admin_delete_")) {
        if (!isAdmin(user.id)) return;

        const id = data.split("_")[2];
        delete giveaways[id];

        bot.sendMessage(query.message.chat.id, "Удалено");
    }
});

// ОБНОВЛЕНИЕ
function updateMessage(id) {
    const g = giveaways[id];

    bot.editMessageCaption(
        `🎁 РОЗЫГРЫШ\n\n` +
        `🎉 ${g.prize}\n` +
        `📢 ${g.channel}\n` +
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

// ЗАВЕРШЕНИЕ
function finishGiveaway(id) {
    const g = giveaways[id];
    if (!g) return;

    if (!g.participants.length) {
        bot.sendMessage(g.chatId, "Нет участников");
        return;
    }

    let winners = g.participants
        .sort(() => 0.5 - Math.random())
        .slice(0, g.winnersCount);

    const text = winners.map(w =>
        `[${w.name}](tg://user?id=${w.id})`
    ).join('\n');

    bot.sendMessage(g.chatId,
        `🏆 Победители:\n\n${text}`,
        { parse_mode: 'Markdown' }
    );

    delete giveaways[id];
}

// КОМАНДА АДМИНКИ
bot.onText(/\/admin/, (msg) => {
    if (!isAdmin(msg.from.id)) return;

    bot.sendMessage(msg.chat.id, "Админ-панель", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Розыгрыши", callback_data: "admin_list" }]
            ]
        }
    });
});

console.log("🚀 Бот запущен");
