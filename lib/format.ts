import {
    ApplicationCommandOptionType,
    ChannelType,
    ComponentType,
    Guild,
    User,
    type Channel,
    type Interaction,
} from "discord.js";

interface Displayable {
    user?: User;
    author?: User;
    channel: Channel | null;
    channelId: string | null;
    guild: Guild | null;
    guildId: string | null;
}

export function stringifyError(error: unknown) {
    return error instanceof Error
        ? `${error.stack ?? `${error.name}(${error.message})`}${error.cause ? `\ncaused by ${error.cause}` : ""}`
        : `${error}`;
}

function displayUserAndLocation({ user, author, channel, channelId, guild, guildId }: Displayable) {
    const person = user ?? author;
    const displayUser = person ? `${user ? "user" : "author"} = ${person.tag} ${person.id}` : "no user";
    const displayChannel = channelId
        ? channel && channel.type !== ChannelType.DM
            ? `channel = #${channel.name} ${channelId}`
            : `channel = ${channelId}`
        : "no channel";
    const displayGuild = guildId ? (guild ? `guild = ${guild.name} ${guildId}` : `guild = ${guildId}`) : `dm`;

    return [displayUser, displayChannel, displayGuild].join(" | ");
}

function displayLogPrefix(interaction: Interaction) {
    if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
        const parts = [
            interaction.commandName,
            interaction.options.getSubcommandGroup(false),
            interaction.options.getSubcommand(false),
        ]
            .filter(Boolean)
            .join(" ");

        return `[Commands] Handling${interaction.isAutocomplete() ? " autocomplete for" : ""} \`/${parts}\``;
    } else if (interaction.isContextMenuCommand()) {
        return `[Commands] Handling ${interaction.isUserContextMenuCommand() ? "user" : "message"} context menu command \`${interaction.commandName}\``;
    } else if (interaction.isModalSubmit()) {
        return `[Modals] Handling modal at path \`${interaction.customId.split(":")[2]}\``;
    } else if (interaction.isMessageComponent()) {
        return `[Components] Handling ${
            Object.keys(ComponentType)
                .find((key) => interaction.componentType === ComponentType[key as keyof typeof ComponentType])
                ?.replace(/[a-z][A-Z]/g, (text) => `${text[0]} ${text[1]?.toLowerCase()}`)
                .replace(/$/, interaction.isAnySelectMenu() ? " menu" : "") ?? "message component with unknown type"
        } at path \`${interaction.customId.split(":")[2]}\``;
    } else {
        return `[Error] Unknown interaction type for log prefix. JSON dump: ${JSON.stringify(interaction.toJSON())}`;
    }
}

function displayLogSuffix(interaction: Interaction): string[] {
    if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
        const rawOptions = interaction.options.data
            .filter(
                (item) =>
                    item.type !== ApplicationCommandOptionType.SubcommandGroup &&
                    item.type !== ApplicationCommandOptionType.Subcommand,
            )
            .toSorted((x, y) => x.name.localeCompare(y.name));

        return rawOptions
            .map((item) => {
                switch (item.type) {
                    case ApplicationCommandOptionType.Attachment:
                        return item.attachment
                            ? `attachment \`${item.attachment.name}: ${JSON.stringify({ ...(item.attachment.toJSON() ?? {}), name: undefined })}`
                            : "attachment <empty>";
                    case ApplicationCommandOptionType.Boolean:
                        return item.value !== undefined ? `boolean \`${item.value}\`` : "boolean <empty>";
                    case ApplicationCommandOptionType.Channel:
                        return item.channel ? `channel #${item.channel.name} ${item.channel.id}` : "channel <empty>";
                    case ApplicationCommandOptionType.Integer:
                        return item.value !== undefined ? `integer \`${item.value}\`` : "integer <empty>";
                    case ApplicationCommandOptionType.Mentionable:
                        if (item.role) return `mentionable (role) @${item.role.name} ${item.role.id}`;
                        if (item.user) return `mentionable (user) ${item.user.tag} ${item.user.id}`;
                        return "mentionable <empty>";
                    case ApplicationCommandOptionType.Number:
                        return item.value !== undefined ? `number \`${item.value}\`` : "number <empty>";
                    case ApplicationCommandOptionType.Role:
                        return item.role ? `role @${item.role.name} ${item.role.id}` : "role <empty>";
                    case ApplicationCommandOptionType.String:
                        return item.value !== undefined ? `string ${JSON.stringify(item.value)}` : "string <empty>";
                    case ApplicationCommandOptionType.User:
                        return item.user ? `user ${item.user.tag} ${item.user.id}` : "user <empty>";
                    default:
                        return `unknown type ${item.type}`;
                }
            })
            .map(
                (line, index) =>
                    line && `${rawOptions[index]?.name ?? "[??]"}${rawOptions[index]?.focused ? "*" : ""} = ${line}`,
            )
            .filter(Boolean)
            .concat(interaction.isAutocomplete() ? ["* = focused option"] : []);
    } else if (interaction.isUserContextMenuCommand()) {
        return [`targeted user = ${interaction.targetUser.tag} ${interaction.targetUser.id}`];
    } else if (interaction.isMessageContextMenuCommand()) {
        return [
            `targeted message = ${interaction.targetMessage.url} [${displayUserAndLocation(interaction.targetMessage)}]`,
        ];
    } else if (interaction.isModalSubmit()) {
        return [
            `custom ID = ${interaction.customId}`,
            ...interaction.fields.fields
                .values()
                .map((field) => {
                    switch (field.type) {
                        case ComponentType.StringSelect:
                            return `string select [${field.values.map((item) => JSON.stringify(item)).join(", ")}]`;
                        case ComponentType.TextInput:
                            return `text input ${JSON.stringify(field.value)}`;
                        case ComponentType.UserSelect:
                            return `user select [${field.users?.map((user) => `${user.tag} ${user.id}`).join(", ") ?? field.values.join(", ")}]`;
                        case ComponentType.RoleSelect:
                            return `role select [${field.roles?.map((role) => (role ? `@${role.name} ${role.id}` : "<empty>")).join(", ") ?? field.values.join(", ")}]`;
                        case ComponentType.MentionableSelect:
                            return `mentionable select [${[
                                ...(field.users?.map((user) => `${user.tag} ${user.id}`) ?? []),
                                ...(field.roles?.map((role) => (role ? `@${role.name} ${role.id}` : "<empty>")) ?? []),
                                ...field.values.filter(
                                    (id) =>
                                        !field.users?.some((user) => user.id === id) &&
                                        !field.roles?.some((role) => role?.id === id),
                                ),
                            ].join(", ")}]`;
                        case ComponentType.ChannelSelect:
                            return `channel select [${
                                field.channels
                                    ?.map((channel) => (channel ? `#${channel.name} ${channel.id}` : "<empty>"))
                                    .join(", ") ?? field.values.join(", ")
                            }]`;
                        case ComponentType.FileUpload:
                            return `file upload [${field.attachments
                                .toJSON()
                                .map((file) => `${file.name} = ${JSON.stringify(file.toJSON())}`)
                                .join(", ")}]`;
                        case ComponentType.RadioGroup:
                            return `radio group ${field.value === null ? "<empty>" : JSON.stringify(field.value)}`;
                        case ComponentType.CheckboxGroup:
                            return `checkbox group [${field.values.map((value) => JSON.stringify(value)).join(", ")}]`;
                        case ComponentType.Checkbox:
                            return `checkbox ${field.value ? "`checked`" : "`unchecked`"}`;
                        default:
                            return `unknown type ${(field as any).type}`;
                    }
                })
                .map((line, index) => line && `field \`${interaction.fields.fields.at(index)?.customId}\` = ${line}`)
                .toArray()
                .filter(Boolean),
        ];
    } else if (interaction.isButton()) {
        return [`custom ID = ${interaction.customId}`];
    } else if (interaction.isChannelSelectMenu()) {
        return [
            `custom ID = ${interaction.customId}`,
            ...(interaction.channels.size === 0 ? ["no channels"] : []),
            ...interaction.channels
                .toJSON()
                .map(
                    (channel, index) =>
                        `channels[${index}] = ${channel.type === ChannelType.DM ? "[??]" : `#${channel.name}`} ${channel.id}`,
                ),
        ];
    } else if (interaction.isMentionableSelectMenu()) {
        return [
            `custom ID = ${interaction.customId}`,
            ...(interaction.users.size + interaction.roles.size === 0 ? ["no mentionables"] : []),
            ...interaction.users
                .toJSON()
                .map((user, index) => `values[${index}] = users[${index}] = ${user.tag} ${user.id}`),
            ...interaction.roles
                .toJSON()
                .map(
                    (role, index) =>
                        `values[${interaction.users.size + index}] = roles[${index}] = @${role.name} ${role.id}`,
                ),
        ];
    } else if (interaction.isRoleSelectMenu()) {
        return [
            `custom ID = ${interaction.customId}`,
            ...(interaction.roles.size === 0 ? ["no roles"] : []),
            ...interaction.roles.toJSON().map((role, index) => `roles[${index}] = @${role.name} ${role.id}`),
        ];
    } else if (interaction.isStringSelectMenu()) {
        return [
            `custom ID = ${interaction.customId}`,
            ...(interaction.values.length === 0 ? ["no values"] : []),
            ...interaction.values.map((value, index) => `values[${index}] = ${JSON.stringify(value)}`),
        ];
    } else if (interaction.isUserSelectMenu()) {
        return [
            `custom ID = ${interaction.customId}`,
            ...(interaction.users.size === 0 ? ["no users"] : []),
            ...interaction.users.toJSON().map((user, index) => `users[${index}] = ${user.tag} ${user.id}`),
        ];
    } else {
        return [];
    }
}

export function displayInteractionResult({
    interaction,
    result,
    sendError,
    uuid,
}: {
    interaction: Interaction;
    result: { success: true; value: unknown } | { success: false; error: unknown };
    sendError: unknown;
    uuid: string;
}) {
    return `${displayLogPrefix(interaction)} [${displayUserAndLocation(interaction)}]${displayLogSuffix(interaction)
        .map((line) => `\n-> ${line}`)
        .join("")}\n<- ${
        result.success
            ? "Success"
            : typeof result.error === "string"
              ? "Rejected"
              : `Errored(${uuid}): ${stringifyError(result.error).replace(/\n/g, "\n<- ")}`
    }${sendError ? `\n<- Error sending result message back to interaction: ${stringifyError(sendError).replace(/\n/g, "\n<- ")}` : ""}`;
}
