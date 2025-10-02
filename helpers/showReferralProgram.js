const db = require('../db/db');

async function showReferralProgram(ctx) {
    const userId = ctx.from.id;
    
    try {
      const referralCode = await db.getOrCreateReferralCode(userId);
      const botUsername = ctx.botInfo.username;
      const referralLink = `https://t.me/${botUsername}?start=ref_${referralCode}`;
      
      const shareText = `🧠 Привет! Я нашел(а) отличного психолога-бота с AI поддержкой!\n\nОн помогает разобраться в сложных ситуациях и дает мудрые советы. Попробуй и ты - первые 10 вопросов бесплатно каждый день!\n\n${referralLink}`;
  
      await ctx.reply(
        `🎁 **Получи 3 дня премиума бесплатно!**\n\n` +
        `Чтобы активировать 3 дня премиум-доступа, пригласи 1 друга по вашей ссылке:\n\n` +
        `🔗 Ваша реферальная ссылка:\n\`${referralLink}\`\n\n` +
        `**Как это работает:**\n` +
        `1. Отправьте ссылку другу\n` +
        `2. Друг должен перейти и начать общение с ботом\n` +
        `3. Как только друг отправит первое сообщение - вы получите +3 дня премиума!\n\n` +
        `💎 Премиум включает:\n` +
        `• Неограниченное общение\n` +
        `• Приоритетные ответы\n` +
        `• Расширанный анализ`,
        { 
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.url('📤 Поделиться ссылкой', `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`)],
              [Markup.button.callback('📊 Моя реферальная статистика', 'referral_stats')],
              [Markup.button.callback('❌ Закрыть', 'close_message')]
            ]
          }
        }
      );
      
    } catch (error) {
      console.error('Referral program error:', error);
      throw error;
    }
  }

  module.exports = showReferralProgram;
  