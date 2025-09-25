const db = require('../db/db')
const lastStartTime = new Map();

async function handleStart(ctx) {
    const userId = ctx.from.id;
    const text = ctx.message.text || "";
    const now = Date.now();
    const lastStart = lastStartTime.get(userId) || 0;
    
    // Если прошло меньше 2 секунд с последнего старта - игнорируем
    if (now - lastStart < 2000) {
        return;
    }
    lastStartTime.set(userId, now);
    const user = await db.getUser(userId);
    console.log(`🔄 START вызван для пользователя ${userId} в ${new Date().toISOString()}`);
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
  };


module.exports = handleStart;