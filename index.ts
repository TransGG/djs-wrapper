import { loadCommands, loadEvents, loadInteractions } from "@hyperneutrino/djs-lite";
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    Client,
    Events,
    type ChatInputApplicationCommandData,
    type ClientOptions,
    type MessageApplicationCommandData,
    type UserApplicationCommandData,
} from "discord.js";

interface SetupOptions extends Omit<ClientOptions, "allowedMentions"> {
    directories?: { commands?: string; interactions?: string; events?: string };
    recursivelyLoadEvents?: boolean;
}

export async function setup(options: SetupOptions) {
    if (!Bun.env.TOKEN) throw new Error("[Fatal] Missing environment variable TOKEN.");

    const client = new Client({ ...options, allowedMentions: { parse: [] } });

    const loadEventsPromise = options.directories?.events
        ? loadEvents(client, options.directories.events, options.recursivelyLoadEvents).then(({ filenames }) => {
              if (Object.keys(filenames).length === 0)
                  return console.log("[Startup] Event loader found no event handlers to load.");

              let message = "[Startup] Loaded events:";

              for (const [type, names] of Object.entries(filenames)) {
                  message += `\n- ${type}:`;

                  if (names.length === 1) message += ` ${names[0]}`;
                  else message += names.map((name) => `\n  - ${name}`).join("");
              }

              console.log(message);
          })
        : null;

    const loadInteractionsPromise = options.directories?.interactions
        ? loadInteractions(client, options.directories.interactions).then((handlers) => {
              if (Object.values(handlers).every((map) => map.size === 0))
                  return console.log("[Startup] Interaction loader found no interaction handlers to load.");

              let message = "[Startup] Loaded interaction handlers:";

              for (const [key, map] of Object.entries(handlers)) {
                  message += `\n- ${key.replace(/Handlers$/, "")}: ${map.size}`;
                  for (const path of map.keys()) message += `\n  - ${path}`;
              }

              console.log(message);
          })
        : null;

    const promise = new Promise<Client<true>>((res) => client.once(Events.ClientReady, res));
    await client.login(Bun.env.TOKEN);
    const bot = await promise;

    console.log(`[Startup] Authenticated as ${bot.user.tag}`);

    await Promise.all([
        loadEventsPromise,
        loadInteractionsPromise,
        options.directories?.commands
            ? loadCommands(bot, options.directories.commands, {
                  guildId: Bun.env.COMMANDS_GUILD_ID,
                  skipSettingCommands: !!Bun.env.NO_SET_COMMANDS,
              }).then(({ commands }) => {
                  if (commands.length === 0) return console.log("[Startup] Command loader found no commands to load.");

                  let message = "[Startup] Loaded commands";
                  if (Bun.env.NO_SET_COMMANDS) message += " but skipped updating them in Discord";
                  message += ":";

                  const userCommands: UserApplicationCommandData[] = [];
                  const messageCommands: MessageApplicationCommandData[] = [];
                  const slashCommands: ChatInputApplicationCommandData[] = [];

                  for (const cmd of commands)
                      if (cmd.type === ApplicationCommandType.User) userCommands.push(cmd);
                      else if (cmd.type === ApplicationCommandType.Message) messageCommands.push(cmd);
                      else if (!cmd.type || cmd.type === ApplicationCommandType.ChatInput) slashCommands.push(cmd);

                  for (const cmd of userCommands) message += `\n- ${cmd.name} (user context menu)`;
                  for (const cmd of messageCommands) message += `\n- ${cmd.name} (message context menu)`;

                  for (const cmd of slashCommands) {
                      const subcommandsAndGroups =
                          cmd.options
                              ?.filter(
                                  (option) =>
                                      option.type === ApplicationCommandOptionType.SubcommandGroup ||
                                      option.type === ApplicationCommandOptionType.Subcommand,
                              )
                              .sort((x, y) => x.name.localeCompare(y.name)) ?? [];

                      if (subcommandsAndGroups.length > 0) {
                          for (const option of subcommandsAndGroups) {
                              const subcommands =
                                  option.options
                                      ?.filter((option) => option.type === ApplicationCommandOptionType.Subcommand)
                                      .sort((x, y) => x.name.localeCompare(y.name)) ?? [];

                              if (subcommands.length > 0) {
                                  for (const suboption of subcommands)
                                      message += `\n- /${cmd.name} ${option.name} ${suboption.name}`;
                              } else message += `\n- /${cmd.name} ${option.name}`;
                          }
                      } else message += `\n- /${cmd.name}`;

                      console.log(message);
                  }
              })
            : null,
    ]);

    console.log("[Process Startup Complete]");

    return bot;
}
