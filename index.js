const {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');
const config = require('./config.json');

const manager = new Client({ intents: [GatewayIntentBits.Guilds] });
const sessions = new Map();

manager.once(Events.ClientReady, () => {
  console.log(`✅ Bot manager connecté en tant que ${manager.user.tag}`);
  manager.user.setActivity(config.statusText || 'Gestion de bots', {
    type: ActivityType.Streaming,
    url: config.streamUrl || 'https://twitch.tv/d34fr'
  });
});

manager.on(Events.InteractionCreate, async inter => {
  if (inter.isChatInputCommand()) {
    const token = inter.options.getString('token');

    if (inter.commandName === 'invite') {
      try {
        const botApp = new Client({ intents: [] });
        await botApp.login(token);
        const id = botApp.user.id;
        botApp.destroy();
        const url = `https://discord.com/oauth2/authorize?client_id=${id}&scope=bot%20applications.commands&permissions=8`;
        await inter.reply(`🔗 Voici le lien d’invitation :\n${url}`);
      } catch {
        await inter.reply('❌ Token invalide.');
      }
      return;
    }

    if (inter.commandName === 'token') {
      await inter.deferReply(); // ✅ évite expiration

      try {
        const temp = new Client({ intents: [GatewayIntentBits.Guilds] });
        temp.once(Events.ClientReady, async () => {
          await Promise.all(temp.guilds.cache.map(g => g.fetch()));
          const guilds = [...temp.guilds.cache.values()];
          sessions.set(inter.user.id, { bot: temp, guilds, page: 0 });

          if (guilds.length === 0) {
            const embed = new EmbedBuilder()
              .setTitle('🕵️ Aucun serveur trouvé')
              .setDescription('Ce bot n’est actuellement sur **aucun serveur**.')
              .setColor(0xff5555);
            await inter.editReply({ embeds: [embed] });
          } else {
            await showPage(inter, true);
          }
        });
        await temp.login(token);
      } catch {
        await inter.editReply('❌ Token invalide ou bot déjà connecté.');
      }
    }
  }

  if (inter.isButton()) {
    const sess = sessions.get(inter.user.id);
    if (!sess) return;

    await inter.deferUpdate(); // ✅ évite erreur interaction expirée

    if (inter.customId === 'prev' && sess.page > 0) sess.page--;
    if (inter.customId === 'next' && sess.page < Math.ceil(sess.guilds.length / 3) - 1) sess.page++;
    await showPage(inter, true);
  }

  if (inter.isStringSelectMenu()) {
    const guildId = inter.values[0];
    const sess = sessions.get(inter.user.id);
    if (!sess) return;

    try {
      await sess.bot.guilds.leave(guildId);
      sess.guilds = sess.guilds.filter(g => g.id !== guildId);
      await inter.reply(`✅ Le bot a quitté le serveur **${guildId}**.`);
      await showPage(inter, true);
    } catch {
      await inter.reply('❌ Impossible de quitter ce serveur.');
    }
  }
});

async function showPage(inter, update = false) {
  const sess = sessions.get(inter.user.id);
  const start = sess.page * 3;
  const slice = sess.guilds.slice(start, start + 3);

  const embed = new EmbedBuilder()
    .setTitle(`🔍 Serveurs du bot (page ${sess.page + 1}/${Math.ceil(sess.guilds.length / 3)})`)
    .setColor(0x00ffcc);

  for (const g of slice) {
    let invite = '❌ Pas de permissions';
    let memberCount = 'Inconnu';
    let owner = 'Inconnu';

    try {
      const fetched = await g.fetch();
      memberCount = fetched.memberCount;
      owner = `<@!${fetched.ownerId}>`;

      await g.channels.fetch();
      const channel = g.channels.cache.find(c =>
        c.isTextBased() &&
        c.permissionsFor(g.members.me).has('CreateInstantInvite')
      );
      if (channel) {
        const inv = await channel.createInvite({ maxAge: 3600, maxUses: 1, unique: true });
        invite = `https://discord.gg/${inv.code}`;
      }
    } catch (err) {
      console.warn(`Erreur sur le serveur ${g.id} :`, err.message);
    }

    embed.addFields({
      name: g.name,
      value: `ID : ${g.id}\nPropriétaire : ${owner}\nMembres : ${memberCount}\nInvitation : ${invite}`
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId('select_leave')
    .setPlaceholder('Choisis un serveur à quitter')
    .addOptions(slice.map(g => ({
      label: g.name.slice(0, 100),
      description: g.id,
      value: g.id
    })));

  const navigation = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('page').setLabel(`${sess.page + 1}/${Math.ceil(sess.guilds.length / 3)}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Primary)
  );

  const selectRow = new ActionRowBuilder().addComponents(menu);

  const payload = { embeds: [embed], components: [selectRow, navigation] };

  if (update && inter.isRepliable()) {
    if (inter.deferred || inter.replied) {
      await inter.editReply(payload);
    } else {
      await inter.reply(payload);
    }
  } else {
    await inter.editReply(payload);
  }
}

manager.login(config.token);
