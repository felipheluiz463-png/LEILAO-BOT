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
const OWNER_ID  = "1030955815114391592";
const COLOR     = 0xb300ff;
const CATEGORY_ID = "1497799987986436117";
const IMAGE_URL = "https://cdn.discordapp.com/attachments/1381714599442649138/1490162386122965042/file_000000008870720e9825f146362ee8a53.png";
const QR_CODE_URL = "https://cdn.discordapp.com/attachments/1474630270148804780/1497814586684866560/Screenshot_2026-04-26-00-18-21-340_br.com.intermedium.jpg";

// ─── Ticket store ─────────────────────────────────────────────────────────────
const tickets = new Map();

// ─── Client ──────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// ─── Função para gerenciar a categoria ───────────────────────────────────────
async function manageAuctionCategory(guild) {
  try {
    const category = guild.channels.cache.get(CATEGORY_ID);
    if (!category) return;
    
    const auctionChannels = category.children.cache.filter(channel => 
      tickets.has(channel.id) || channel.name.startsWith("leilao-")
    );
    
    if (auctionChannels.size === 0) {
      try {
        await category.delete();
        console.log(`[CATEGORY] Categoria LEILÕES deletada por estar vazia.`);
      } catch (err) {
        console.error("[ERROR] Falha ao deletar categoria:", err.message);
      }
    }
  } catch (err) {
    console.error("[ERROR] manageAuctionCategory:", err.message);
  }
}

// ─── Função para verificar categoria ─────────────────────────────────────────
async function ensureAuctionCategory(guild) {
  try {
    let category = guild.channels.cache.get(CATEGORY_ID);
    
    if (!category) {
      category = await guild.channels.create({
        name: "LEILÕES",
        type: ChannelType.GuildCategory,
        position: 0,
      });
      console.log(`[CATEGORY] Categoria LEILÕES criada.`);
    }
    
    return category;
  } catch (err) {
    console.error("[ERROR] ensureAuctionCategory:", err.message);
    return null;
  }
}

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
client.once("ready", async () => {
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
    await manageAuctionCategory(guild);
  }
});

client.on("guildCreate", async (guild) => {
  await registerCommandsForGuild(guild);
  await manageAuctionCategory(guild);
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
      const auctioneerId = OWNER_ID;

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

      const category = await ensureAuctionCategory(guild);
      if (!category) {
        return interaction.editReply({ content: "❌ Erro ao criar/verificar a categoria de leilões." });
      }

      const safeName = `leilao-${creator.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "user"}`;

      let channel;
      try {
        channel = await guild.channels.create({
          name: safeName,
          type: ChannelType.GuildText,
          parent: category.id,
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
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
              ],
            },
            {
              id: auctioneerId,
              type: OverwriteType.Member,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
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
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
              ],
            },
          ],
        });
      } catch (err) {
        console.error("[ERROR] Failed to create ticket channel:", err);
        return interaction.editReply({ content: "❌ Erro ao criar o canal. Verifique as permissões do bot." });
      }

      console.log(`[TICKET] Created channel ${channel.id} (${channel.name}) in category for user ${creator.id}`);
      tickets.set(channel.id, { creatorId: creator.id, auctioneer: auctioneerId, paymentConfirmed: false, paymentMessageId: null });

      const mainEmbed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle("💳 Taxa do Leilão")
        .setDescription(
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "Para iniciar seu leilão, é necessário realizar o pagamento da taxa clicando no botão 💳 Pagar Taxa abaixo.\n\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "📌 Após efetuar o pagamento, aguarde a confirmação do Leiloeiro.\n\n" +
          "✅ O botão Confirmar Pagamento será utilizado apenas pelo leiloeiro após verificar o recebimento.\n\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "⚠️ **Aviso Importante**\n" +
          "> - Não envie comprovantes falsos.\n" +
          "> - O leilão só será iniciado após a confirmação oficial do pagamento.\n\n" +
          "📎 **Você pode enviar imagens e arquivos neste canal para comprovar o pagamento.**"
        )
        .setFooter({ text: "🔥 𝙎𝙣𝙞𝙥𝙚𝙭ˡᵘᵃ ᶜᵒᵐᵐᵘⁿⁱᵗʸ 👻" });

      const payButtonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn-pagar-taxa")
          .setLabel("💳 Pagar Taxa")
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ 
        content: `<@${creator.id}> <@${auctioneerId}>`, 
        embeds: [mainEmbed], 
        components: [payButtonRow] 
      });
      
      await interaction.editReply({ content: `✅ Ticket criado: <#${channel.id}>` });
      return;
    }

    // ── Button: Pagar Taxa ───────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === "btn-pagar-taxa") {
      const ticketData = tickets.get(interaction.channelId);
      if (!ticketData || ticketData.creatorId !== interaction.user.id) {
        return interaction.reply({
          content: "❌ Você não tem permissão para usar este botão.",
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      // Embed de pagamento - APENAS TÍTULO E PIX
      const paymentEmbed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle("💳 Pagamento da Taxa do Leilão")
        .setDescription(`\`e6c45244-a7fa-4acc-8e94-e156f84ea2b2\``)
        .setThumbnail(QR_CODE_URL)
        .setFooter({ text: "🔥 𝙎𝙣𝙞𝙥𝙚𝙭ˡᵘᵃ ᶜᵒᵐᵐᵘⁿⁱᵗʸ 👻" });

      const confirmButtonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn-confirmar-pagamento")
          .setLabel("💵 Confirmar")
          .setStyle(ButtonStyle.Success)
      );

      const paymentMessage = await interaction.channel.send({ 
        embeds: [paymentEmbed], 
        components: [confirmButtonRow] 
      });

      ticketData.paymentMessageId = paymentMessage.id;
      tickets.set(interaction.channelId, ticketData);

      await interaction.editReply({ 
        content: "✅ Informações de pagamento enviadas!" 
      });
      return;
    }

    // ── Button: Confirmar Pagamento (apenas leiloeiro) ──────────────────────
    if (interaction.isButton() && interaction.customId === "btn-confirmar-pagamento") {
      const ticketData = tickets.get(interaction.channelId);
      
      if (!ticketData || interaction.user.id !== ticketData.auctioneer) {
        return interaction.reply({
          content: "❌ Você não tem permissão para confirmar este pagamento.",
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();

      ticketData.paymentConfirmed = true;
      tickets.set(interaction.channelId, ticketData);

      try {
        const paymentMessage = await interaction.channel.messages.fetch(ticketData.paymentMessageId);
        if (paymentMessage) {
          await paymentMessage.delete();
        }
      } catch (err) {
        console.error("[ERROR] Failed to delete payment message:", err.message);
      }

      const messages = await interaction.channel.messages.fetch({ limit: 10 });
      const mainMessage = messages.find(msg => msg.author.id === client.user.id && msg.components.length > 0 && msg.embeds.length > 0);
      
      if (mainMessage) {
        const confirmacaoEmbed = new EmbedBuilder()
          .setColor(COLOR)
          .setTitle("✅ Pagamento Confirmado!")
          .setDescription(
            "━━━━━━━━━━━━━━━━━━\n\n" +
            "**O pagamento foi verificado e confirmado pelo leiloeiro.**\n\n" +
            "O leilão será iniciado em breve.\n\n" +
            "Aguardem as próximas instruções!\n\n" +
            "━━━━━━━━━━━━━━━━━━\n\n" +
            "🔘 Utilize o botão abaixo para **encerrar o leilão** quando finalizado."
          )
          .setFooter({ text: "🔥 𝙎𝙣𝙞𝙥𝙚𝙭ˡᵘᵃ ᶜᵒᵐᵐᵘⁿⁱᵗʸ 👻" });

        const closeButtonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("btn-fechar-leilao")
            .setLabel("🔴 Fechar")
            .setStyle(ButtonStyle.Danger)
        );

        await mainMessage.edit({ 
          embeds: [mainMessage.embeds[0], confirmacaoEmbed],
          components: [closeButtonRow] 
        });
      }

      await interaction.channel.send({ 
        content: `✅ **Pagamento confirmado por** <@${interaction.user.id}>! O leilão será iniciado em breve.` 
      });

      return;
    }

    // ── Button: Fechar Leilão ────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === "btn-fechar-leilao") {
      const ticketData = tickets.get(interaction.channelId);
      
      if (!ticketData || interaction.user.id !== ticketData.auctioneer) {
        return interaction.reply({
          content: "❌ Você não tem permissão para fechar este leilão.",
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

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn-fechar-leilao")
          .setLabel("🔴 Fechar")
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
          
          if (interaction.guild) {
            await manageAuctionCategory(interaction.guild);
          }
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
