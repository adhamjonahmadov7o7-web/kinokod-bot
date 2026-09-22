const { Bot, InlineKeyboard, Keyboard } = require("grammy");
const http = require("http");
const fs = require("fs");

// Kanallar va Instagram havolalarini yuklash
let socialLinks = { telegramChannels: [], instagramLinks: [] };
try {
  socialLinks = require("./channels.js");
} catch (e) {
  socialLinks.telegramChannels = ["@Adhamjon_Live"];
}

// ==========================================
// 1. SOZLAMALAR VA BAZA
// ==========================================
const BOT_TOKEN = process.env.BOT_TOKEN || "8937720285:AAG-qKGEE8dCMsH2CNQwRlSrAtRCPwsN7DQ";
const MY_ADMIN_ID = 8977292662; 
const ADMIN_USERNAME = "@ADHAMAJON_AHMADOV";
const SECRET_CHANNEL_ID = -1003937523012; // Maxfiy kino baza kanali ID'si

const bot = new Bot(BOT_TOKEN);

// JSON fayldan kinolarni o'qib olish
let moviesDatabase = new Map();
if (fs.existsSync("movies.json")) {
  try {
    const rawData = fs.readFileSync("movies.json", "utf-8");
    const parsed = JSON.parse(rawData);
    moviesDatabase = new Map(Object.entries(parsed));
    console.log(`[BAZA] Fayldan ${moviesDatabase.size} ta kino yuklandi!`);
  } catch (err) {
    console.error("[BAZA XATOSI] JSON o'qishda xatolik:", err.message);
  }
}

// Baza o'zgarganda faylga saqlash
function saveDatabase() {
  try {
    const obj = Object.fromEntries(moviesDatabase);
    fs.writeFileSync("movies.json", JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("[BAZA XATOSI] Faylga yozishda xatolik:", err.message);
  }
}

const usersList = new Set();
let totalSearches = 0;

// ==========================================
// 2. SERVER (24/7 ONLINE TURLISHI UCHUN)
// ==========================================
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("KinoBot Server Active 24/7");
}).listen(PORT, () => {
  console.log(`[SYSTEM] Server ${PORT}-portda ishlamoqda.`);
});

// ==========================================
// 3. MAJBURIY OBUNA TEKSHIRUVI
// ==========================================
async function checkUserSub(ctx) {
  try {
    if (ctx.from.id === MY_ADMIN_ID) return true;

    for (const channel of socialLinks.telegramChannels) {
      try {
        const member = await ctx.api.getChatMember(channel, ctx.from.id);
        if (["left", "kicked"].includes(member.status)) return false;
      } catch (err) {
        console.error(`[SUB CHECK ERROR] ${channel}:`, err.message);
      }
    }
    return true;
  } catch (e) {
    return true;
  }
}

// Tugmalarni tayyorlash (Telegram + Instagram)
function getSubscriptionKeyboard() {
  const kb = new InlineKeyboard();

  // Telegram kanallari
  for (const ch of socialLinks.telegramChannels) {
    const cleanLink = ch.startsWith("http") ? ch : `https://t.me/${ch.replace("@", "")}`;
    kb.url(`📢 Telegram Kanalimiz`, cleanLink).row();
  }

  // Instagram havolalari
  if (socialLinks.instagramLinks) {
    for (const insta of socialLinks.instagramLinks) {
      kb.url(insta.name || "📸 Instagram", insta.url).row();
    }
  }

  kb.text("✅ Obunani tekshirish", "check_subscription_btn");
  return kb;
}

bot.use(async (ctx, next) => {
  try {
    if (ctx.from && !ctx.from.is_bot) {
      usersList.add(ctx.from.id);
    }

    if (ctx.chat?.type === "private" && ctx.message?.text !== "/start") {
      const isOk = await checkUserSub(ctx);
      if (!isOk) {
        return ctx.reply("⚠️ **Botdan foydalanish uchun quyidagi sahifalarga obuna bo'ling:**", {
          parse_mode: "Markdown",
          reply_markup: getSubscriptionKeyboard(),
        });
      }
    }
    await next();
  } catch (err) {
    console.error("[MIDDLEWARE ERROR]:", err.message);
  }
});

// ==========================================
// 4. MAXFIY BAZA KANALIDAN KINOLARNI QABUL QILISH
// ==========================================
bot.on("channel_post", async (ctx) => {
  try {
    const post = ctx.channelPost;

    // Faqat maxfiy bazangiz (-1003937523012) dan kelgan videolar
    if (post.chat.id === SECRET_CHANNEL_ID && post.video && post.caption) {
      const match = post.caption.match(/\d+/);
      if (match) {
        const code = match[0];
        moviesDatabase.set(code, {
          fileId: post.video.file_id,
          caption: post.caption
        });
        saveDatabase(); // movies.json fayliga yozadi
        console.log(`[BAZA] Yangi kino saqlandi! Kod: ${code}`);
      }
    }
  } catch (err) {
    console.error("[CHANNEL POST ERROR]:", err.message);
  }
});

// ==========================================
// 5. BUYRUQLAR VA TUGMALAR
// ==========================================
bot.command("start", async (ctx) => {
  try {
    const isOk = await checkUserSub(ctx);
    if (!isOk) {
      return ctx.reply("⚠️ **Botdan foydalanish uchun quyidagi sahifalarga obuna bo'ling:**", {
        parse_mode: "Markdown",
        reply_markup: getSubscriptionKeyboard(),
      });
    }

    const userKb = new Keyboard()
      .text("🔍 Qanday foydalaniladi?").text("📊 Statistika").row()
      .text("👨‍💻 Admin bilan aloqa").resized();

    await ctx.reply(
      `🎬 **Xush kelibsiz, ${ctx.from.first_name}!**\n\n` +
      `Kino yuklab olish uchun shunchaki **Kino kodi (raqam)**ni yuboring (Masalan: \`21\` yoki \`102\`).`,
      { parse_mode: "Markdown", reply_markup: userKb }
    );
  } catch (err) {
    console.error("[START ERROR]:", err.message);
  }
});

bot.hears("🔍 Qanday foydalaniladi?", async (ctx) => {
  await ctx.reply(
    "📌 **Botdan foydalanish yo'riqnomasi:**\n\n" +
    "1. Kanalimizdan o'zingizga yoqqan kinoning kodini oling.\n" +
    "2. Ushbu botga faqat o'sha **kod raqamini** yozib yuboring (Masalan: `21`).\n" +
    "3. Bot sizga kinoni barcha ma'lumotlari bilan yuboradi!",
    { parse_mode: "Markdown" }
  );
});

bot.hears("📊 Statistika", async (ctx) => {
  await ctx.reply(
    `📊 **Bot Statistikasi:**\n\n` +
    `👥 Jami foydalanuvchilar: **${usersList.size}** ta\n` +
    `🎬 Bazadagi kinolar: **${moviesDatabase.size}** ta\n` +
    `🔎 Qidiruvlar soni: **${totalSearches}** marta\n` +
    `⚡️ Server holati: **Online 24/7 (Protected)**`,
    { parse_mode: "Markdown" }
  );
});

bot.hears("👨‍💻 Admin bilan aloqa", async (ctx) => {
  await ctx.reply(`💬 Savollar va reklama bo'yicha admin: ${ADMIN_USERNAME}`);
});

// ==========================================
// 6. KINO QIDIRISH TIZIMI
// ==========================================
bot.on("message:text", async (ctx) => {
  try {
    const text = ctx.message.text.trim();

    if (["🔍 Qanday foydalaniladi?", "📊 Statistika", "👨‍💻 Admin bilan aloqa"].includes(text)) return;

    const match = text.match(/\d+/);
    if (!match) {
      return ctx.reply("❌ **Noto'g'ri kod!** Iltimos, faqat kino raqamini yuboring (Masalan: `21`).", { parse_mode: "Markdown" });
    }

    const code = match[0];

    if (moviesDatabase.has(code)) {
      await ctx.replyWithChatAction("upload_video");
      const movie = moviesDatabase.get(code);
      
      await ctx.replyWithVideo(movie.fileId, {
        caption: movie.caption
      });
      totalSearches++;
    } else {
      await ctx.reply(
        "❌ **Afsuski, bu kod bo'yicha kino topilmadi.**\n\n" +
        "Kino kodi noto'g'ri kiritilgan bo'lishi yoki kino hali bazaga qo'shilmagan bo'lishi mumkin.",
        { parse_mode: "Markdown" }
      );
    }
  } catch (err) {
    console.error("[SEARCH ERROR]:", err.message);
  }
});

bot.on("callback_query:data", async (ctx) => {
  try {
    if (ctx.callbackQuery.data === "check_subscription_btn") {
      const isOk = await checkUserSub(ctx);
      if (isOk) {
        await ctx.answerCallbackQuery({ text: "✅ Obuna tasdiqlandi!" });
        await ctx.deleteMessage();
        await ctx.reply("🎉 Obuna tasdiqlandi! Endi kino kodini yuborishingiz mumkin.");
      } else {
        await ctx.answerCallbackQuery({ text: "❌ Barcha kanallarga obuna bo'lmadingiz!", show_alert: true });
      }
    }
  } catch (err) {
    console.error("[CALLBACK ERROR]:", err.message);
  }
});

bot.catch((err) => {
  console.error("[CRASH PREVENTED]:", err.error);
});

bot.start();
console.log("🚀 KinoBot muvaffaqiyatli ishga tushdi!");
