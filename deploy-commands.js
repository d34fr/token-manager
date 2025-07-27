const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config.json');

const commands = [
  new SlashCommandBuilder()
    .setName('token')
    .setDescription('Afficher les serveurs d’un bot via token')
    .addStringOption(opt =>
      opt.setName('token').setDescription('Token du bot à connecter').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Générer un lien d’invitation pour un bot via token')
    .addStringOption(opt =>
      opt.setName('token').setDescription('Token du bot à inviter').setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log('⏳ Déploiement des commandes...');
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log('✅ Commandes déployées avec succès.');
  } catch (error) {
    console.error('❌ Erreur lors du déploiement :', error);
  }
})();
