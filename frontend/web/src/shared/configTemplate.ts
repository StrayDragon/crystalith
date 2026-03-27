import nunjucks from "nunjucks";
import type { LoaderSource } from "nunjucks";

export type ConfigTemplateContext = {
  env: Record<string, string>;
  secret: Record<string, string>;
};

class DisabledTemplateLoader extends nunjucks.Loader {
  async = false;

  getSource(name: string): LoaderSource {
    throw new Error(`Template loading is disabled: ${name}`);
  }
}

function createTemplateEnv(): nunjucks.Environment {
  const env = new nunjucks.Environment(new DisabledTemplateLoader(), {
    autoescape: false,
    throwOnUndefined: true,
  });

  env.addFilter("default", (value: unknown, fallback: unknown = "", treatFalsy = false) => {
    const isUndefined = value === undefined || value === null;
    if (isUndefined) return fallback;
    if (treatFalsy && !value) return fallback;
    return value;
  });

  env.addGlobal("default", (value: unknown, fallback: unknown = "", treatFalsy = false) => {
    const isUndefined = value === undefined || value === null;
    if (isUndefined) return fallback;
    if (treatFalsy && !value) return fallback;
    return value;
  });

  return env;
}

const TEMPLATE_ENV = createTemplateEnv();

export function renderConfigTemplate(template: string, context: ConfigTemplateContext): string {
  if (!template) return "";
  return TEMPLATE_ENV.renderString(template, context);
}
