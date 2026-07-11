import { getValue, setValue } from "./storage";

export interface Provider {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const PROVIDERS_KEY = "providers";
const ACTIVE_KEY = "active_provider_id";
const THEME_KEY = "theme";

export async function loadProviders(): Promise<Provider[]> {
  const list = await getValue<Provider[]>(PROVIDERS_KEY);
  return Array.isArray(list) ? list : [];
}

export async function saveProviders(providers: Provider[]): Promise<void> {
  await setValue(PROVIDERS_KEY, providers);
}

export async function loadActiveId(): Promise<string | null> {
  return getValue<string>(ACTIVE_KEY);
}

export async function saveActiveId(id: string | null): Promise<void> {
  await setValue(ACTIVE_KEY, id);
}

export async function loadTheme(): Promise<"dark" | "light"> {
  const t = await getValue<"dark" | "light">(THEME_KEY);
  return t === "light" ? "light" : "dark";
}

export async function saveTheme(theme: "dark" | "light"): Promise<void> {
  await setValue(THEME_KEY, theme);
}
