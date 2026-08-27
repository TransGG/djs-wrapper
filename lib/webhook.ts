import { WebhookClient } from "discord.js";
import type { SetupOptions } from "./types.ts";

export let name: string = "";
export let webhook: WebhookClient | null = null;

export async function startupWebhook(options: SetupOptions) {
    name = options.name;

    if (Bun.env.ALERT_WEBHOOK) {
        try {
            webhook = new WebhookClient({ url: Bun.env.ALERT_WEBHOOK }, { allowedMentions: { parse: [] } });
        } catch {
            console.error("[Error] ALERT_WEBHOOK does not point to a valid webhook URL. Continuing without it.");
        }
    } else {
        console.log(
            "[Hint] If you set environment variable ALERT_WEBHOOK, the bot will output status and error messages there.",
        );
    }
}
