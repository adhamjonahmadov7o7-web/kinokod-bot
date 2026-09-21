require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const config = require('./config');

const bot = new Bot(process.env.BOT_TOKEN);
const moviesDatabase = {};

// Obunani tekshirish funksiyasi
async function checkSubscription(ctx) {
  const userId = ctx.from.id;
  const notSubscribedChannels = [];

  for (const channel of config.REQUIRED_CHANNELS) {
    try {
      const member = await ctx.api.getChatMember(channel, userId);
      // Agar foydalanuvchi kanalda bo'lmasa yoki chiqib ketgan bo'lsa
      if (['left', 'kicked'].includes(member.status)) {
        notSubscribedChannels.push(channel);
      }
    } catch (error) {
      console.error(`Kanalni tekshirishda xatolik (${channel}):`, error.message);
    }
  }

  return notSubscribedChannels;
}

bot.command('start', (ctx) => {
  ctx.reply(
    "🎬 **KinoKod botiga xush kelibsiz!**\n\nKino ko'rish uchun kino kodini yuboring (masalan: 101):",
    { parse_mode: 'Markdown' }
  );
});

// Kanaldan kelgan postlarni ushlash
bot.on('channel_post:video', async (ctx) => {
  const video = ctx.channelPost.video;
  const caption = ctx.channelPost.caption || '';
  const match = caption.match(/[\(\[]?(\d+)[\)\]]?/);

  if (match) {
    const movieCode = match[1];
    moviesDatabase[movieCode] = {
      fileId: video.file_id,
      caption: caption
    };
    console.log(`✅ YANGI KINO SAQLANDI: Kod [${movieCode}]`);
  }
});

// Foydalanuvchi kod yuborganda
bot.on('message:text', async (ctx) => {
  const userCode = ctx.message.text.trim();

  // 1. Obunani tekshiramiz
  const missingChannels = await checkSubscription(ctx);

  if (missingChannels.length > 0) {
    const keyboard = new InlineKeyboard();

    // Obuna bo'lmagan kanallarini tugma qilib chiqarish
    missingChannels.forEach((channel, index) => {
      const channelLink = channel.startsWith('@') 
        ? `https://t.me/${channel.replace('@', '')}` 
        : channel;
      keyboard.url(`📢 ${index + 1}-Kanalga obuna bo'lish`, channelLink).row();
    });

    keyboard.text("✅ Obunani tekshirish", `check_${userCode}`);

    return ctx.reply(
      "⚠️ **Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:**", 
      { reply_markup: keyboard, parse_mode: 'Markdown' }
    );
  }

  // 2. Kinoni topib beramiz
  if (moviesDatabase[userCode]) {
    const movie = moviesDatabase[userCode];
    await ctx.replyWithVideo(movie.fileId, { caption: movie.caption });
  } else {
    await ctx.reply("❌ Afsuski, bu kod bo'yicha kino topilmadi.");
  }
});

// "Obunani tekshirish" tugmasi bosilganda
bot.callbackQuery(/check_(.+)/, async (ctx) => {
  const userCode = ctx.match[1];
  const missingChannels = await checkSubscription(ctx);

  if (missingChannels.length === 0) {
    await ctx.answerCallbackQuery({ text: "✅ Rahmat! Obuna tasdiqlandi." });
    await ctx.deleteMessage();

    if (moviesDatabase[userCode]) {
      const movie = moviesDatabase[userCode];
      await ctx.replyWithVideo(movie.fileId, { caption: movie.caption });
    } else {
      await ctx.reply("❌ Afsuski, bu kod bo'yicha kino topilmadi.");
    }
  } else {
    await ctx.answerCallbackQuery({ 
      text: "❌ Hali hamma kanallarga obuna bo'lmadingiz!", 
      show_alert: true 
    });
  }
});

bot.start();
console.log('🤖 Bot obuna tekshiruvi bilan ishga tushdi!');
bot.catch((err) => {
  console.error("Botda xatolik yuz berdi:", err.error);
});