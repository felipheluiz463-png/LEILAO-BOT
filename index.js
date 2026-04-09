import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  OverwriteType,
} from "discord.js";

// ─── Global error safety ────────────────────────────────────────────────────
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));
process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));

// ─── Constants ───────────────────────────────────────────────────────────────
const TOKEN     = process.env.TOKEN;
const CLIENT_ID = "1488382349472305304";
const OWNER_ID  = "1030955815114391592"; // Felipe | Kpax — only user allowed to run /setup-auction and use buttons
const COLOR     = 0xb300ff;
// URL SEM parâmetros de expiração (use o attachment ID direto)
const IMAGE_URL = "https://cdn.discordapp.com/attachments/1381714599442649138/1490162386122965042/file_000000008870720e9825f146362ee8a53.png";

// ─── Ticket store ─────────────────────────────────────────────────────────────
// channelId → { creatorId, paymentConfirmed }
const tickets = new Map();

// ─── Client ──────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ─── Register guild command helper ───────────────────────────────────────────
async function registerCommandsForGuild(guild) {
  try {
    await guild.commands.set([
      {
        name: "setup-auction",
        description: "Configura o painel de leilão",
      },
    ]);
    console.log(`[BOT] Command registered for guild: ${guild.name} (${guild.id})`);
  } catch (err) {
    console.error(`[ERROR] Failed to register command for guild ${guild.id}:`, err.message);
  }
}

// ─── Ready ───────────────────────────────────────────────────────────────────
client.once("clientReady", async () => {
  console.log(`[BOT] Logged in as ${client.user.tag}`);

  const rest = new REST().setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    console.log("[BOT] Global commands cleared.");
  } catch (err) {
    console.error("[ERROR] Failed to clear global commands:", err.message);
  }

  for (const guild of client.guilds.cache.values()) {
    await registerCommandsForGuild(guild);
  }
});

client.on("guildCreate", async (guild) => {
  await registerCommandsForGuild(guild);
});

// ─── Single interactionCreate listener ───────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  try {

    // ── /setup-auction ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand() && interaction.commandName === "setup-auction") {

      if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({
          content: "You do not have permission to use this command.",
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle("🏷️ Como Criar Seu Leilão")
        .setDescription(
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "## 📖 Como Funciona?\n\n" +
          "> - Após o pagamento da **taxa de 50c**, o leiloeiro iniciará o leilão.\n" +
          "> - Quando o leilão for finalizado, o vencedor será definido.\n" +
          "> - O vendedor deverá entregar o item ao **Leiloeiro**.\n" +
          "> - Após a confirmação da entrega, o pagamento será repassado ao vendedor.\n\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "## 📝 O Que Você Precisa Informar\n\n" +
          "> - 📦 Item que será leiloado\n" +
          "> - 💰 Valor mínimo inicial\n" +
          "> - 📈 Valor mínimo de cada lance\n\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "## 💸 Taxa do Leilão\n\n" +
          "> - Para abrir um leilão é cobrada uma **taxa fixa de 50c**.\n\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "⚠️ O leilão só será iniciado após o pagamento da taxa."
        )
        .setImage(IMAGE_URL)
        .setFooter({ text: "🔥 𝙎𝙣𝙞𝙥𝙚𝙭ˡᵘᵃ ᶜᵒᵐᵐᵘⁿⁱᵗʸ 👻" });

      const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("select-auctioneer")
          .setPlaceholder("Selecione um leiloeiro")
          .addOptions([
            {
              label: "Felipe | Kpax",
              description: "Realizar Leilão com Felipe",
              value: "felipe",
            },
          ])
      );

      await interaction.channel.send({ embeds: [embed], components: [selectRow] });
      await interaction.editReply({ content: "✅ Painel criado com sucesso!" });
      return;
    }

    // ── Select menu: choose auctioneer ──────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === "select-auctioneer") {
      if (interaction.values[0] !== "felipe") return;

      const guild   = interaction.guild;
      const creator = interaction.user;

      if (!guild) {
        console.error("[ERROR] interaction.guild is null on select menu");
        return interaction.reply({ content: "Erro interno: guild não encontrada.", ephemeral: true });
      }

      for (const [channelId, data] of tickets.entries()) {
        if (data.creatorId === creator.id) {
          const existing = guild.channels.cache.get(channelId);
          if (existing) {
            return interaction.reply({
              content: `Você já tem um ticket aberto: <#${channelId}>`,
              ephemeral: true,
            });
          }
          tickets.delete(channelId);
        }
      }

      await interaction.deferReply({ ephemeral: true });

      const safeName = `leilao-${creator.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "user"}`;

      let channel;
      try {
        channel = await guild.channels.create({
          name: safeName,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              type: OverwriteType.Role,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: creator.id,
              type: OverwriteType.Member,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
            {
              id: OWNER_ID,
              type: OverwriteType.Member,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
              ],
            },
            {
              id: client.user.id,
              type: OverwriteType.Member,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
              ],
            },
          ],
        });
      } catch (err) {
        console.error("[ERROR] Failed to create ticket channel:", err);
        return interaction.editReply({ content: "Erro ao criar o canal. Verifique as permissões do bot." });
      }

      console.log(`[TICKET] Created channel ${channel.id} (${channel.name}) for user ${creator.id}`);
      tickets.set(channel.id, { creatorId: creator.id, paymentConfirmed: false });

      const paymentEmbed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle("💳 Pagamento da Taxa do Leilão")
        .setDescription(
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "Para iniciar seu leilão, realize o pagamento da taxa utilizando o Pix abaixo:\n\n" +
          "💵 **Chave Pix**\n" +
          "`a88da2f9-c136-41ec-86e5-9315312cd3dd`\n\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "📌 Após efetuar o pagamento, aguarde a confirmação do **Leiloeiro**.\n\n" +
          "✅ O botão **Confirmar Pagamento** será utilizado apenas pelo leiloeiro após verificar o recebimento.\n\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "⚠️ **Aviso Importante**\n" +
          "> - Não envie comprovantes falsos.\n" +
          "> - O leilão só será iniciado após a confirmação oficial do pagamento."
        )
        .setFooter({ text: "🔥 𝙎𝙣𝙞𝙥𝙚𝙭ˡᵘᵃ ᶜᵒᵐᵐᵘⁿⁱᵗʸ 👻" });

      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn-confirmar")
          .setLabel("Confirmar Pagamento")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("btn-fechar")
          .setLabel("Fechar")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ content: `<@${creator.id}> <@${OWNER_ID}>`, embeds: [paymentEmbed], components: [buttonRow] });
      await interaction.editReply({ content: `✅ Ticket criado: <#${channel.id}>` });
      return;
    }

    // ── Button: Confirmar (Felipe only) ─────────────────────────────────────
    if (interaction.isButton() && interaction.customId === "btn-confirmar") {
      if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({
          content: "You are not allowed to use this button.",
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();

      // Marcar que o pagamento foi confirmado
      const ticketData = tickets.get(interaction.channelId);
      if (ticketData) {
        ticketData.paymentConfirmed = true;
        tickets.set(interaction.channelId, ticketData);
      }

      const confirmacaoEmbed = new EmbedBuilder()
        .setColor(COLOR)
        .setDescription(
          "✅ **Pagamento Confirmado!**\n\n" +
          "O pagamento foi verificado e confirmado pelo leiloeiro.\n\n" +
          "O leilão será iniciado em breve.\n\n" +
          "Aguardem as próximas instruções!\n\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "🔘 Utilize o botão abaixo para fechar este ticket quando o leilão for finalizado."
        )
        .setFooter({ text: "🔥 𝙎𝙣𝙞𝙥𝙚𝙭ˡᵘᵃ ᶜᵒᵐᵐᵘⁿⁱᵗʸ 👻" });

      // Criar nova linha de botões apenas com o botão Fechar
      const closeButtonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn-fechar-pos-confirmacao")
          .setLabel("🔒 Fechar Ticket")
          .setStyle(ButtonStyle.Danger)
      );

      // Atualizar a mensagem: remover botões antigos e adicionar apenas o de fechar
      await interaction.message.edit({ 
        embeds: [interaction.message.embeds[0], confirmacaoEmbed],
        components: [closeButtonRow] 
      });
      
      return;
    }

    // ── Button: Fechar após confirmação ─────────────────────────────────────
    if (interaction.isButton() && interaction.customId === "btn-fechar-pos-confirmacao") {
      if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({
          content: "You are not allowed to use this button.",
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();

      const closingEmbed = new EmbedBuilder()
        .setColor(COLOR)
        .setDescription(
          "🔒 **Ticket Encerrado**\n\n" +
          "✅ Leilão finalizado com sucesso!\n\n" +
          "📌 Todas as informações relacionadas ao leilão já foram registradas pelo sistema.\n\n" +
          "🧾 Caso precise revisar algo futuramente, entre em contato com a equipe de suporte.\n\n" +
          "Agradecemos por utilizar o sistema de leilões 💜\n\n" +
          "⏳ O canal será excluído em instantes..."
        )
        .setFooter({ text: "🔥 𝙎𝙣𝙞𝙥𝙚𝙭ˡᵘᵃ ᶜᵒᵐᵐᵘⁿⁱᵗʸ 👻" });

      // Desabilitar o botão de fechar
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn-fechar-pos-confirmacao")
          .setLabel("🔒 Fechar Ticket")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true)
      );

      await interaction.message.edit({ components: [disabledRow] });
      await interaction.channel.send({ embeds: [closingEmbed] });

      // Remover do mapa de tickets
      tickets.delete(interaction.channelId);

      // Aguardar 5 segundos e deletar o canal
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
          console.log(`[TICKET] Channel ${interaction.channelId} deleted.`);
        } catch (err) {
          console.error("[ERROR] Failed to delete channel:", err.message);
        }
      }, 5000);

      return;
    }

    // ── Button: Fechar original (antes da confirmação) ─────────────────────
    if (interaction.isButton() && interaction.customId === "btn-fechar") {
      if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({
          content: "You are not allowed to use this button.",
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();

      const closingEmbed = new EmbedBuilder()
        .setColor(COLOR)
        .setDescription(
          "🔒 **Ticket Cancelado**\n\n" +
          "❌ O ticket foi fechado antes da confirmação do pagamento.\n\n" +
          "📌 Para abrir um novo leilão, utilize o painel novamente.\n\n" +
          "⏳ O canal será excluído em instantes..."
        )
        .setFooter({ text: "🔥 𝙎𝙣𝙞𝙥𝙚𝙭ˡᵘᵃ ᶜᵒᵐᵐᵘⁿⁱᵗʸ 👻" });

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn-confirmar")
          .setLabel("Confirmar Pagamento")
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("btn-fechar")
          .setLabel("Fechar")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true)
      );

      await interaction.message.edit({ components: [disabledRow] });
      await interaction.channel.send({ embeds: [closingEmbed] });

      tickets.delete(interaction.channelId);

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
          console.log(`[TICKET] Channel ${interaction.channelId} deleted.`);
        } catch (err) {
          console.error("[ERROR] Failed to delete channel:", err.message);
        }
      }, 5000);

      return;
    }

  } catch (err) {
    console.error("[ERROR] interactionCreate:", err);
  }
});

// ─── Login ───────────────────────────────────────────────────────────────────
client.login(TOKEN);
