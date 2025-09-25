const { Telegraf, Markup } = require("telegraf");
const db = require('./db/db')
const { getUser } = require("./db/db");
const { generatePsychologyResponse, parseAndSaveContext } = require("./ai/ai");
require('dotenv').config();
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

const bot = new Telegraf(TELEGRAM_TOKEN);

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text || "";
    const user = await db.getUser(userId);
    console.log(`🔄 START вызван для пользователя ${userId} в ${new Date().toISOString()}`);
    // console.log("Получил START:", ctx.message.text, "от", ctx.from.id);


    if (text.includes("ref_") && !user.invited_by) { // только если еще не приглашён
        const referralCode = text.split("ref_")[1];

        const referrer = await db.getUserByReferralCode(referralCode).catch(() => null);
        if (referrer && referrer.userId !== userId) {
            await db.rewardReferrer(referralCode);
            await db.setInvitedBy(userId, referralCode);

            ctx.telegram.sendMessage(
                referrer.userId,
                `🎉 Новый пользователь зарегистрировался по твоей ссылке! Ты получил +3 вопроса 🔮`
            );
        }
    }

    ctx.reply(
        `Привет, я рядом! ✨\n\n` +
        "Задай свой вопрос, и я помогу тебе получить психологическую поддержку 🤍"
    );
});

bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const message = ctx.message.text;
    // const user = await getUser(userId);
    try {
        await ctx.sendChatAction('typing');
        const aiResponse = await generatePsychologyResponse(userId, message);
        const cleanResponse = await parseAndSaveContext(userId, aiResponse);
        await ctx.reply(cleanResponse);
    } catch (error) {
        console.error('Error in message handler:', error);
        await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    }

    console.log(ctx.from.username, "User message");
});

bot.launch().then(() => {
    console.log("✅ Tarot Bot запущен");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));