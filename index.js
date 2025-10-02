const { Telegraf, Markup } = require("telegraf");
const db = require('./db/db')
const { generatePsychologyResponse, parseAndSaveContext } = require("./ai/ai");
const handleStatus = require("./commands/status");
const { handlePremium, handleSupport } = require("./commands/commands");
const showReferralProgram = require("./helpers/showReferralProgram");
require('dotenv').config();
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

const bot = new Telegraf(TELEGRAM_TOKEN);

const commands = [
  { command: 'start', description: '🚀 Начать общение' },
  { command: 'status', description: '📊 Мои лимиты и статус' },
  { command: 'premium', description: '💎 Премиум доступ' },
  { command: 'referral', description: '🎁 Получить 3 дня премиума' },
  { command: 'support', description: '🆘 Техподдержка' }
];

bot.telegram.setMyCommands(commands);

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text || "";
  const user = await db.getUser(userId);

  if (text.includes("ref_") && !user.invited_by) { // только если еще не приглашён
    const referralCode = text.split("ref_")[1];

    const referrer = await db.getUserByReferralCode(referralCode).catch(() => null);
    if (referrer && referrer.userId !== userId) {
      await db.rewardReferrer(referralCode);
      await db.setInvitedBy(userId, referralCode);

      ctx.telegram.sendMessage(
        referrer.userId,
        `🎉 Новый пользователь зарегистрировался по твоей ссылке! Вы получили 3 дня премиума бесплатно 🎁`
      );
    }
  }

  ctx.reply(
    `Привет, я рядом! ✨\n\n` +
    "Задай свой вопрос, и я помогу тебе получить психологическую поддержку 🤍"
  );
});

bot.command('status', handleStatus);
bot.command('premium', handlePremium);
bot.command('support', handleSupport);
bot.command('referral', showReferralProgram);
bot.action("get_free_trial", showReferralProgram);

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
      [Markup.button.callback("💫 Неделя - 149₽", "buy_1")],
      [Markup.button.callback("✨ Месяц - 399₽", "buy_2")],
      [Markup.button.callback("💎 Навсегда - 1999₽", "buy_3")],
      [Markup.button.callback("🎁 3 дня премиума бесплатно", "get_free_trial")]
    ])
  );
}

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const message = ctx.message.text;
  
  try {
  const premiumStatus = await db.checkAndUpdatePremiumStatus(userId);

  if (premiumStatus.ended) {
    await ctx.reply(
        `🚫 Ваш премиум период закончился ${premiumStatus.endedDaysAgo}.\n\n` +
        `💎 Хотите снова получить неограниченное общение? /premium`
    );
}
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