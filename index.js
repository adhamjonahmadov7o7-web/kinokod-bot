const { Bot, InlineKeyboard, Keyboard } = require("grammy");
const http = require("http");

// ==========================================
// 1. SOZLAMALAR VA BAZA (IN-MEMORY MAP)
// ==========================================
const BOT_TOKEN = process.env.BOT_TOKEN || "8937720285:AAG-qKGEE8dCMsH2CNQwRlSrAtRCPwsN7DQ";
const MY_ADMIN_ID = 8977292662; 
const ADMIN_USERNAME = "@ADHAMAJON_AHMADOV";

const bot = new Bot(BOT_TOKEN);

// Bazani xavfsiz saqlash
const moviesDatabase = new Map();
const requiredChannels = new Set();
const usersList = new Set();
let totalSearches = 0;

// ==========================================
// 2. SERVER (RENDER ANTI-SLEEP)
// ==========================================
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("KinoBot Server 24/7 Active");
}).listen(PORT, () => {
  console.log(`[SYSTEM] Server ${PORT}-portda muvaffaqiyatli ishga tushdi.`);
});

// ==========================================
// 3. MAJBURIY OBUNA TEKSHIRUVI (ASYNCHRONOUS)
// ==========================================
async function checkUserSub(ctx) {
  try {
    if (requiredChannels.size === 0 || ctx.from.id === MY_ADMIN_ID) return true;

    for (const channel of requiredChannels) {
      try {
        const member = await ctx.api.getChatMember(channel, ctx.from.id);
        if (["left", "kicked"].includes(member.status)) return false;
      } catch (err) {
        console.error(`[SUB CHECK ERROR] ${channel}:`, err.message);
      }
    }
    return true;
  } catch (e) {
    return true; // Xatolik bo'lsa bot to'xtab qolmaydi
  }
}

// Barcha xabarlarga ishlov beruvchi himoya qatlami
bot.use(async (ctx, next) => {
  try {
    if (ctx.from && !ctx.from.is_bot) {
      usersList.add(ctx.from.id);
    }

    if (ctx.chat?.type === "private" && ctx.message?.text !== "/start") {
      const isOk = await checkUserSub(ctx);
      if (!isOk) {
        const kb = new InlineKeyboard();
        for (const ch of requiredChannels) {
          kb.url(`📢 Kanalga obuna bo'lish`, `https://t.me/${ch.replace("@", "")}`).row();
        }
        kb.text("✅ Obunani tekshirish", "check_subscription_btn");

        return ctx.reply("⚠️ **Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:**", {
          parse_mode: "Markdown",
          reply_markup: kb,
        });
      }
    }
    await next();
  } catch (err) {
    console.error("[MIDDLEWARE ERROR]:", err.message);
  }
});

// ==========================================
// 4. KANAL POSTLARINI O'QISH VA SAQLASH
// ==========================================
bot.on("channel_post", async (ctx) => {
  try {
    const post = ctx.channelPost;
    
    // Video va izoh bo'lsa
    if (post.video && post.caption) {
      // Izohdan "Kod:" so'zidan keyingi yoki eng birinchi raqamni topadi
      const match = post.caption.match(/\d+/);
      if (match) {
        const code = match[0];
        moviesDatabase.set(code, {
          fileId: post.video.file_id,
          caption: post.caption
        });
        console.log(`[BAZA] Yangi kino qo'shildi! KOD: ${code}`);
      }
    }
  } catch (err) {
    console.error("[CHANNEL POST ERROR]:", err.message);
  }
});

// ==========================================
// 5. ASOSIY TUGBALAR VA BUYRUQLAR
// ==========================================
bot.command("start", async (ctx) => {
  try {
    const isOk = await checkUserSub(ctx);
    if (!isOk) {
      const kb = new InlineKeyboard();
      for (const ch of requiredChannels) {
        kb.url(`📢 Kanalga obuna bo'lish`, `https://t.me/${ch.replace("@", "")}`).row();
      }
      kb.text("✅ Obunani tekshirish", "check_subscription_btn");

      return ctx.reply("⚠️ **Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:**", {
        parse_mode: "Markdown",
        reply_markup: kb,
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
    console.error("[START COMMAND ERROR]:", err.message);
  }
});

bot.hears("🔍 Qanday foydalaniladi?", async (ctx) => {
  await ctx.reply(
    "📌 **Botdan foydalanish yo'riqnomasi:**\n\n" +
    "1. Telegram kanalimizdan o'zingizga yoqqan kinoning kodini oling.\n" +
    "2. Ushbu botga faqat o'sha **kod raqamini** yozib yuboring (Masalan: `21`).\n" +
    "3. Bot sizga kinoni barcha ma'lumotlari (nomi, janri, yili) bilan yuboradi!",
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
// 6. ADMIN PANEL BUYRUQLARI
// ==========================================
bot.command("addchannel", async (ctx) => {
  if (ctx.from.id !== MY_ADMIN_ID) return;
  const chName = ctx.message.text.split(" ")[1];
  if (!chName || !chName.startsWith("@")) {
    return ctx.reply("⚠️ Noto'g'ri format! Masalan: `/addchannel @kanal_nomi`", { parse_mode: "Markdown" });
  }
  requiredChannels.add(chName);
  await ctx.reply(`✅ **${chName}** majburiy obunalar ro'yxatiga qo'shildi!`, { parse_mode: "Markdown" });
});

bot.command("delchannels", async (ctx) => {
  if (ctx.from.id !== MY_ADMIN_ID) return;
  requiredChannels.clear();
  await ctx.reply("🗑 Barcha majburiy obuna kanallari o'chirib tashlandi!");
});

bot.command("send", async (ctx) => {
  if (ctx.from.id !== MY_ADMIN_ID) return;
  const msg = ctx.message.text.replace("/send", "").trim();
  if (!msg) return ctx.reply("⚠️ Yuborish uchun matn kiriting!");

  let count = 0;
  for (const uId of usersList) {
    try {
      await ctx.api.sendMessage(uId, msg);
      count++;
    } catch (e) {}
  }
  await ctx.reply(`✅ Xabar **${count}** ta foydalanuvchiga yuborildi.`);
});

// ==========================================
// 7. KINO QIDIRISH VA YUKLASH TIZIMI
// ==========================================
bot.on("message:text", async (ctx) => {
  try {
    const text = ctx.message.text.trim();

    // Menyu tugmalariga tegmaslik
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
    await ctx.reply("⚠️ Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
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

// Botni to'xtab qolishdan (Crash) saqlash
bot.catch((err) => {
  console.error("[GLOBAL BOT CRASH PREVENTED]:", err.error);
});

bot.start();
console.log("🚀 KinoBot muvaffaqiyatli ishga tushdi va xatoliklardan himoyalandi!");
