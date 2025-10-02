async function handleStatus(ctx) {
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
}

module.exports = handleStatus;