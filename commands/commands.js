async function handlePremium(ctx) {
    await ctx.reply(
        `💎 **Премиум доступ**\n\n` +
        `Получите неограниченное общение с психологом!\n\n` +
        `✨ **Что входит:**\n` +
        `• Неограниченные вопросы\n` +
        `• Приоритетные ответы\n` +
        `• Расширенный анализ\n` +
        `• Персональные рекомендации\n\n` +
        `Выберите тариф:`,
        Markup.inlineKeyboard([
          [Markup.button.callback("💫 Неделя - 149₽", "buy_1")],
          [Markup.button.callback("✨ Месяц - 399₽", "buy_2")],
          [Markup.button.callback("💎 Навсегда - 1999₽", "buy_3")],
          [Markup.button.callback("🎁 3 дня бесплатно за друга", "get_free_trial")]
        ])
      );
}

async function handleSupport(ctx) {
    await ctx.reply(
        `🆘 **Поддержка**\n\n` +
        `Если у вас возникли проблемы:\n\n` +
        `• Технические неполадки\n` +
        `• Вопросы по оплате\n` +
        `• Предложения по улучшению\n\n` +
        `📧 Напишите нам: @amoraske\n` 
      );    
}

module.exports = {
    handlePremium,
    handleSupport
}