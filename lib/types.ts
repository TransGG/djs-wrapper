import type { Wrappers } from "@hyperneutrino/djs-lite";
import type { ClientOptions } from "discord.js";

export type Handler<T> = (value: T, ...args: (string | undefined)[]) => unknown;

export interface SetupOptions extends Omit<ClientOptions, "allowedMentions"> {
    name: string;
    directories?: { commands?: string; interactions?: string; events?: string };
    recursivelyLoadEvents?: boolean;
    wrappers?: Wrappers;
}
