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

bot.command('status', async (ctx) => {
    const userId = ctx.from.id;
    const info = await db.getQuestionInfo(userId);
    
    if (!info) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }
    
    let message = '';
    if (info.premium) {
      message = `💎 Премиум-доступ активен\n` +
                `📅 С: ${info.premiumSince}\n` +
                `📊 Вопросов сегодня: ${info.questionsUsedToday}`;
    } else {
      message = `📊 Вопросов сегодня: ${info.questionsUsedToday}/${info.dailyQuestions}\n` +
                `🎯 Осталось: ${info.questionsLeft}\n\n` +
                `💡 Используйте /premium для неограниченного доступа`;
    }
    
    await ctx.reply(message);
  });

async function showPremiumOffer(ctx, limitCheck) {
    const { used, limit } = limitCheck;
    
    await ctx.reply(
      `🚫 Вы использовали все ${limit} вопросов на сегодня.\n\n` +
      `💎 Премиум-доступ даст вам:\n` +
      `• Неограниченное общение\n` +
      `• Приоритетные ответы\n` +
      `• Расширенный анализ\n\n` +
      `Выберите тариф:`,
      Markup.inlineKeyboard([
        [Markup.button.callback("💫 Неделя - 149₽", "buy_week")],
        [Markup.button.callback("✨ Месяц - 399₽", "buy_month")],
        [Markup.button.callback("💎 Навсегда - 1999₽", "buy_forever")],
        [Markup.button.callback("🆓 Завтра продолжим", "continue_tomorrow")]
      ])
    );
  }

bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const message = ctx.message.text;
    // const user = await getUser(userId);
    try {
        const limitCheck = await db.useQuestion(userId);
        console.log(limitCheck);
        
        if (!limitCheck.allowed) {
          if (limitCheck.reason === 'daily_limit_reached') {
            await showPremiumOffer(ctx, limitCheck);
            return;
          }
          await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
          return;
        }

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