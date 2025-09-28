const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("yaryadom.db");

function addColumnIfNotExists(table, column, type, defaultValue = null) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) return reject(err);

      const exists = rows.some(r => r.name === column);
      if (!exists) {
        let sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`;
        if (defaultValue !== null) {
          sql += ` DEFAULT ${defaultValue}`;
        }
        db.run(sql, (err2) => {
          if (err2) return reject(err2);
          console.log(`✅ Added column ${column} to ${table}`);
          resolve(true);
        });
      } else {
        resolve(false); // колонка уже есть
      }
    });
  });
}

// Создание таблицы пользователей
db.serialize(async () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      userId INTEGER PRIMARY KEY,
      questionsLeft INTEGER DEFAULT 100,
      email TEXT DEFAULT NULL,
      yookassaPaymentId TEXT DEFAULT NULL,
      paymentStatus TEXT DEFAULT 'pending',
      paymentAmount REAL DEFAULT 0,
      paymentDate DATETIME DEFAULT NULL,
      referral_code TEXT DEFAULT NULL,
      referrals_count INTEGER DEFAULT 0,
      invited_by TEXT DEFAULT NULL,
      dailyQuestions INTEGER DEFAULT 3,     -- ежедневные вопросы
      premium BOOLEAN DEFAULT FALSE,         -- премиум статус
      premiumSince DATETIME DEFAULT NULL,    -- дата начала премиума
      lastQuestionDate DATE DEFAULT NULL,    -- дата последнего вопроса (для сброса лимита)
      questionsUsedToday INTEGER DEFAULT 0  -- использовано сегодня
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_context (
      userId INTEGER PRIMARY KEY,
      context TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users (userId)
    )
  `);

  // Таблица для хранения истории платежей
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      paymentId TEXT,
      amount REAL,
      status TEXT,
      description TEXT,
      customer_email TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users (userId)
    )
  `);

  // Автоматическая миграция (добавляем новые колонки при необходимости)
  // await addColumnIfNotExists("users", "referral_code", "TEXT");
//   await addColumnIfNotExists("users", "referrals_count", "INTEGER", 0);
//   await addColumnIfNotExists("users", "invited_by", "TEXT"); // кто пригласил
});

// Получить данные пользователя
function getUser(userId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE userId = ?", [userId], (err, row) => {
      if (err) return reject(err);
      
      if (!row) {
        // Пользователя нет - создаем нового с обработкой конфликта
        db.run(
          "INSERT OR IGNORE INTO users (userId, questionsLeft) VALUES (?, 100)", 
          [userId], 
          function (err2) {
            if (err2) {
              // Если произошла ошибка (например, пользователь уже добавился в другом запросе)
              // Пробуем снова найти пользователя
              db.get("SELECT * FROM users WHERE userId = ?", [userId], (err3, row2) => {
                if (err3) return reject(err3);
                resolve(row2 || { userId, questionsLeft: 100});
              });
            } else {
              // Успешно создали нового пользователя
              resolve({ userId, questionsLeft: 100});
            }
          }
        );
      } else {
        // Пользователь уже существует
        resolve(row);
      }
    });
  });
}

// Обновить email пользователя
function updateUserEmail(userId, email) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE users SET email = ? WHERE userId = ?",
      [email, userId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

// Сохранить информацию о платеже
function savePayment(userId, paymentData) {
  return new Promise((resolve, reject) => {
    const { id, amount, status, description, email } = paymentData;

    // Обновляем пользователя
    db.run(
      `UPDATE users SET 
       yookassaPaymentId = ?, 
       paymentStatus = ?,
       paymentAmount = ?,
       paymentDate = datetime('now')
       WHERE userId = ?`,
      [id, status, amount.value, userId],
      function (err) {
        if (err) return reject(err);

        // Сохраняем в историю платежей с email
        db.run(
          `INSERT INTO payments (userId, paymentId, amount, status, description, customer_email) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, id, amount.value, status, description, email],
          function (err2) {
            if (err2) return reject(err2);
            resolve(this.lastID);
          }
        );
      }
    );
  });
}

// Обновить статус платежа
function updatePaymentStatus(paymentId, status) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE users SET paymentStatus = ? WHERE yookassaPaymentId = ?",
      [status, paymentId],
      function (err) {
        if (err) return reject(err);

        // Также обновляем в истории платежей
        db.run(
          "UPDATE payments SET status = ? WHERE paymentId = ?",
          [status, paymentId],
          function (err2) {
            if (err2) return reject(err2);
            resolve(this.changes > 0);
          }
        );
      }
    );
  });
}

// Добавить вопросы после успешной оплаты
function addQuestionsAfterPayment(userId, amount) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE users SET questionsLeft = questionsLeft + ? WHERE userId = ?",
      [amount, userId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

// Списать 1 вопрос
// function useQuestion(userId) {
//   return new Promise((resolve, reject) => {
//     db.run(
//       "UPDATE users SET questionsLeft = questionsLeft - 1 WHERE userId = ? AND questionsLeft > 0",
//       [userId],
//       function (err) {
//         if (err) return reject(err);
//         resolve(this.changes > 0);
//       }
//     );
//   });
// }

// Получить историю платежей пользователя
function getPaymentHistory(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM payments WHERE userId = ? ORDER BY created_at DESC",
      [userId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

function getTotalUsers() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
      if (err) return reject(err);
      resolve(row.count);
    });
  });
}

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Получить или создать реферальный код
async function getOrCreateReferralCode(userId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT referral_code FROM users WHERE userId = ?", [userId], (err, row) => {
      if (err) return reject(err);

      if (row && row.referral_code) {
        resolve(row.referral_code);
      } else {
        const newCode = generateReferralCode();
        db.run(
          "UPDATE users SET referral_code = ? WHERE userId = ?",
          [newCode, userId],
          function (err) {
            if (err) return reject(err);
            resolve(newCode);
          }
        );
      }
    });
  });
}

function rewardReferrer(referralCode) {
  return new Promise((resolve, reject) => {
    if (!referralCode) return resolve(false);

    db.get("SELECT userId FROM users WHERE referral_code = ?", [referralCode], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(false);

      const referrerId = row.userId;
      db.run(
        "UPDATE users SET questionsLeft = questionsLeft + 3, referrals_count = referrals_count + 1 WHERE userId = ?",
        [referrerId],
        function (err2) {
          if (err2) return reject(err2);
          resolve(referrerId);
        }
      );
    });
  });
}

// Сохраняем кто пригласил нового пользователя
function setInvitedBy(userId, referralCode) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE users SET invited_by = ? WHERE userId = ?",
      [referralCode, userId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

function getUserByReferralCode(referralCode) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM users WHERE referral_code = ?",
      [referralCode],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

  // Сохранить контекст
  async function saveContext(userId, context) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO user_context (userId, context, updated_at) 
         VALUES (?, ?, datetime('now'))`,
        [userId, context],
        function(err) {
          if (err) return reject(err);
          resolve(this.changes);
        }
      );
    });
  }
  
  // Получить контекст
  async function getContext(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT context FROM user_context WHERE userId = ?",
        [userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.context : null);
        }
      );
    });
  }

  // Проверить лимит и использовать вопрос
  async function useQuestion(userId) {
    return new Promise((resolve, reject) => {
      // Исправляем имена полей в SELECT запросе
      db.get("SELECT dailyQuestions, premium, questionsUsedToday, lastQuestionDate FROM users WHERE userId = ?", [userId], (err, user) => {
        if (err) return reject(err);
        if (!user) return resolve({ allowed: false, reason: 'user_not_found' });
  
        const today = new Date().toDateString();
        
        console.log('📊 User data:', user); // ДОБАВЬТЕ ЭТОТ ЛОГ
        console.log('📅 Today:', today, 'Last question date:', user.lastQuestionDate);
  
        let questionsUsedToday = user.questionsUsedToday; // Исправляем на questionsUsedToday
        let needsReset = false;
  
        // Сброс счетчика если новый день
        if (user.lastQuestionDate !== today) { // Исправляем на lastQuestionDate
          console.log('🔄 Resetting counter - new day');
          questionsUsedToday = 0;
          needsReset = true;
        }
  
        // Проверка лимита
        if (!user.premium && questionsUsedToday >= user.dailyQuestions) { // Исправляем на premium и dailyQuestions
          console.log('🚫 Limit reached:', questionsUsedToday, '/', user.dailyQuestions);
          return resolve({ 
            allowed: false, 
            reason: 'daily_limit_reached', 
            used: questionsUsedToday, 
            limit: user.dailyQuestions 
          });
        }
  
        // Обновляем БД
        const newCount = questionsUsedToday + 1;
        const updateQuery = needsReset 
          ? "UPDATE users SET questionsUsedToday = 1, lastQuestionDate = ? WHERE userId = ?"
          : "UPDATE users SET questionsUsedToday = questionsUsedToday + 1 WHERE userId = ?";
        
        const params = needsReset ? [today, userId] : [userId];

        console.log('💾 Executing:', updateQuery, 'Params:', params);
  
        db.run(updateQuery, params, function(err) {
          if (err) {
            console.error('❌ Update error:', err);
            return reject(err);
          }
          
          console.log('✅ Updated successfully. Changes:', this.changes);
          
          resolve({ 
            allowed: true, 
            used: newCount, 
            limit: user.dailyQuestions,
            premium: user.premium 
          });
        });
      });
    });
  }

// Получить информацию о лимитах
async function getQuestionInfo(userId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT dailyQuestions, premium, premiumSince, questionsUsedToday, lastQuestionDate FROM users WHERE userId = ?", [userId], (err, user) => {
      if (err) return reject(err);
      if (!user) return resolve(null);
      
      const today = new Date().toDateString();
      const isNewDay = user.lastQuestionDate !== today;
      
      resolve({
        dailyQuestions: user.dailyQuestions,
        premium: user.premium,
        premiumSince: user.premiumSince,
        questionsUsedToday: isNewDay ? 0 : user.questionsUsedToday,
        questionsLeft: isNewDay ? user.dailyQuestions : Math.max(0, user.dailyQuestions - user.questionsUsedToday),
        isNewDay: isNewDay
      });
    });
  });
}

// Активировать премиум
async function activatePremium(userId, days = 30) {
  return new Promise((resolve, reject) => {
    const premiumSince = new Date().toISOString();
    db.run("UPDATE users SET premium = 1, premiumSince = ? WHERE userId = ?", [premiumSince, userId], function(err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

module.exports = {
  getUser,
  useQuestion,
  updateUserEmail,
  savePayment,
  updatePaymentStatus,
  addQuestionsAfterPayment,
  getPaymentHistory,
  getTotalUsers,
  getOrCreateReferralCode,
  generateReferralCode,
  rewardReferrer,
  setInvitedBy,
  getUserByReferralCode,
  getContext,
  saveContext,
  getQuestionInfo,
  activatePremium
};