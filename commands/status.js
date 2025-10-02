const db = require('../db/db');

async function handleStatus(ctx) {
    const userId = ctx.from.id;
      const info = await db.getQuestionInfo(userId);
    
      if (!info) {
        await ctx.reply('❌ Пользователь не найден');
        return;
      }

      const userDate = new Date(info.premiumEnds).toLocaleString('ru-RU');
      let message = '';
      if (info.premium) {
        message = `💎 Премиум-доступ активен\n` +
          `📅 Активен до: ${userDate}\n` +
          `📊 Вопросов сегодня: ${info.questionsUsedToday}`;
      } else {
        message = `📊 Вопросов сегодня: ${info.questionsUsedToday}/${info.dailyQuestions}\n` +
          `🎯 Осталось: ${info.questionsLeft}\n\n` +
          `💡 Используйте /premium для неограниченного доступа`;
      }
    
      await ctx.reply(message);
}

module.exports = handleStatus;