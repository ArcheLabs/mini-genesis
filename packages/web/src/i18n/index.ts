export const supportedLanguages = ["zh-CN", "en"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];
export const localeNames: Record<SupportedLanguage, string> = { "zh-CN": "简体中文", en: "English" };
