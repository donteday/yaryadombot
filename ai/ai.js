const db = require('../db/db');
require('dotenv').config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

async function getAIResponse(prompt) {
console.log(DEEPSEEK_API_KEY);

    try {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: `Ты — профессиональный психолог-консультант. Твоя задача — поддерживать и мотивировать клиента, давать мудрые советы и помогать разобраться в чувствах и проблеме.

Общайся тепло, по-человечески, но профессионально. В конце каждого ответа добавляй контекст для продолжения диалога в формате <!--CONTEXT_START-->
  [обновленный контекст сессии]
  <!--CONTEXT_END-->`
                    },
                    { role: "user", content: prompt },
                ],
                stream: false, // Без стриминга
                temperature: 0.7,
                max_tokens: 1500,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error('DeepSeek API error:', error);
        throw new Error('Ошибка связи с AI. Попробуйте позже.');
    }
}


async function generatePsychologyResponse(userId, message) {
    try {
        // Получаем предыдущий контекст из БД
        const previousContext = await db.getContext(userId);

        const prompt = `
  Ты — профессиональный психолог-консультант сервиса "Я рядом!". Твоя задача — поддерживать, мотивировать клиента и давать мудрые советы.
  
  КОНТЕКСТ ПРЕДЫДУЩИХ СЕАНСОВ:
  ${previousContext || 'Контекст отсутствует'}
  
  ТЕКУЩИЙ ЗАПРОС КЛИЕНТА:
  ${message}
  
  СОЗДАЙ ОТВЕТ:
  1. Дай поддерживающий и профессиональный ответ
  2. В конце добавь ОБНОВЛЕННЫЙ КОНТЕКСТ в формате:
  <!--CONTEXT_START-->
  [обновленный контекст сессии]
  <!--CONTEXT_END-->
  
  Важно: Контекст должен быть кратким и содержать ключевые моменты из всей истории диалога.
  `;

        const aiResponse = await getAIResponse(prompt);
        return aiResponse;
    } catch (error) {
        console.error('Error generating response:', error);
        throw error;
    }
}

async function parseAndSaveContext(userId, aiResponse) {
    try {
        // Регулярное выражение для поиска контекста
        const contextRegex = /<!--CONTEXT_START-->([\s\S]*?)<!--CONTEXT_END-->/;
        const match = aiResponse.match(contextRegex);

        let cleanResponse = aiResponse;
        let context = null;

        if (match && match[1]) {
            // Извлекаем и сохраняем контекст
            context = match[1].trim();
            await db.saveContext(userId, context);

            // Удаляем контекст из ответа для пользователя
            cleanResponse = aiResponse.replace(contextRegex, '').trim();
        }

        return cleanResponse;
    } catch (error) {
        console.error('Error parsing context:', error);
        return aiResponse; // Возвращаем оригинальный ответ в случае ошибки
    }
}

module.exports = {
    generatePsychologyResponse,
    parseAndSaveContext
}