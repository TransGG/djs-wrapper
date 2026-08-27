import { Colors, ComponentType, MessageFlags, type Interaction, type RepliableInteraction } from "discord.js";
import { displayInteractionResult } from "./format.ts";
import type { Handler } from "./types.ts";
import { name, webhook } from "./webhook.ts";

const identity = <T>(value: T): T => value;

async function safeExecute<T extends (...args: any) => any>(
    fn: T,
    ...args: Parameters<T>
): Promise<{ success: true; value: ReturnType<T> } | { success: false; error: unknown }> {
    try {
        return { success: true, value: await fn(...args) };
    } catch (error) {
        return { success: false, error };
    }
}

async function sendReply(interaction: RepliableInteraction, content: string) {
    if (interaction.replied || interaction.deferred)
        await interaction.followUp({ flags: MessageFlags.Ephemeral, content });
    else await interaction.reply({ flags: MessageFlags.Ephemeral, content });
}

async function maybeRespond<T extends Interaction>(
    interaction: T,
    result: { success: true; value: unknown } | { success: false; error: unknown },
    uuid: string,
) {
    if (interaction.isAutocomplete()) {
        if (result.success) {
            if (!Array.isArray(result.value)) return;

            if (result.value.some((item) => !item || typeof item.name !== "string" || typeof item.value !== "string"))
                return;

            await interaction.respond(result.value);
        } else {
            await interaction.respond([
                {
                    name:
                        typeof result.error === "string"
                            ? `[Error] ${result.error}`
                            : `Unexpected error with ID ${uuid}. If this persists, contact staff.`,
                    value: "-",
                },
            ]);
        }
    } else {
        if (result.success) {
            if (typeof result.value !== "string") return;
            await sendReply(interaction, result.value);
        } else {
            await sendReply(
                interaction,
                typeof result.error === "string"
                    ? `**Error:** ${result.error}`
                    : `**Unexpected error:** The ID of your error is \`${uuid}\`. If this persists, please contact staff and provide this ID.`,
            );
        }
    }
}

function wrapInteraction<T extends Interaction>(fn: Handler<T>): Handler<T> {
    return async (interaction, ...args) => {
        const result = await safeExecute(fn, interaction, ...args);
        const uuid = crypto.randomUUID();

        const sendError = await maybeRespond(interaction, result, uuid)
            .then(() => null)
            .catch((error) => error);

        const display = displayInteractionResult({ interaction, result, sendError, uuid });
        console.log(display);

        if (!result.success && typeof result.error !== "string" && webhook)
            webhook.send({
                flags: MessageFlags.IsComponentsV2,
                withComponents: true,
                username: `[Alerts] ${name}`,
                components: [
                    {
                        type: ComponentType.Container,
                        accentColor: Colors.Red,
                        components: [
                            {
                                type: ComponentType.TextDisplay,
                                content: `### Error thrown by handler\n\`\`\`\n${display.slice(0, 4000 - 40)}\n\`\`\``,
                            },
                        ],
                    },
                ],
            });
    };
}

export function applyWrap<T extends Interaction>(
    wrapper?: (fn: Handler<T>) => Handler<T>,
): (fn: Handler<T>) => Handler<T> {
    return (fn) => wrapInteraction((wrapper ?? identity)(fn));
}
