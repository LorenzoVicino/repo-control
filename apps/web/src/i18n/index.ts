import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

export const LANGUAGE_STORAGE_KEY = "repo-control-language";
export const APP_LANGUAGES = ["en", "it"] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && APP_LANGUAGES.includes(value as AppLanguage);
}

export function getInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") return "en";

  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isAppLanguage(storedLanguage) ? storedLanguage : "en";
  } catch {
    return "en";
  }
}

function persistLanguage(language: string): void {
  const nextLanguage: AppLanguage = isAppLanguage(language) ? language : "en";

  if (typeof document !== "undefined") {
    document.documentElement.lang = nextLanguage;
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // The interface still works when local storage is unavailable.
    }
  }
}

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: "en",
    supportedLngs: APP_LANGUAGES,
    defaultNS: "translation",
    interpolation: { escapeValue: false },
    initAsync: false,
    returnNull: false
  });

i18n.on("languageChanged", persistLanguage);
persistLanguage(i18n.resolvedLanguage ?? i18n.language);

export async function changeAppLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
}

export function getCurrentLanguage(): AppLanguage {
  const language = i18n.resolvedLanguage ?? i18n.language;
  return isAppLanguage(language) ? language : "en";
}

export default i18n;
