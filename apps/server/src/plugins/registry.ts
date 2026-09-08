// Plugin registry — the single registration/discovery path for all plugin
// kinds (r7). Built-ins and external npm plugins register here; consumers
// (workspace tools diagnostics, extractor orchestration, slides workflow)
// read from this registry only.
//
// Load semantics (r11): `plugins.enabled` (allowlist, empty = all),
// `plugins.disabled` (denylist, always wins), `plugins.load_order` (listed
// ids instantiate in list order; later position wins determinism for
// same-id conflicts at registration time — later registration overwrites).
import { getDataRoot, getPluginsSettings } from '../shared/config.ts';
import { outboundFetch } from '../shared/net/outbound-fetch.ts';
import { builtinPlugins } from './builtin/index.ts';
import {
  discoverExternalPluginIds,
  importExternalPlugin,
  nodeModuleDirCandidates,
} from './loader.ts';
import type {
  CrystalithPlugin,
  CrystalithPluginKind,
  PluginLoadReport,
  PluginRegistration,
  PluginSkip,
} from './types.ts';

export interface PluginSettings {
  enabled: string[];
  disabled: string[];
  load_order: string[];
}

export interface RegistryDeps {
  builtins: () => CrystalithPlugin[];
  discoverExternal: (dirs: string[]) => string[];
  importExternal: (id: string) => Promise<CrystalithPlugin>;
  nodeModuleDirs: () => string[];
  settings: () => PluginSettings;
  dataRoot: () => string;
}

function defaultDeps(): RegistryDeps {
  return {
    builtins: () => builtinPlugins,
    discoverExternal: discoverExternalPluginIds,
    importExternal: importExternalPlugin,
    nodeModuleDirs: nodeModuleDirCandidates,
    settings: getPluginsSettings,
    dataRoot: getDataRoot,
  };
}

export class PluginRegistry {
  private readonly deps: RegistryDeps;
  private registrations = new Map<string, PluginRegistration>();
  private impls = new Map<string, unknown>();
  private report: PluginLoadReport = { loaded: [], skipped: {} };
  private loadPromise: Promise<PluginLoadReport> | null = null;

  constructor(deps: RegistryDeps = defaultDeps()) {
    this.deps = deps;
  }

  /**
   * Register a plugin. Same-id registration is allowed for deterministic
   * conflict resolution: the later registration wins ("loaded last wins").
   */
  register(registration: PluginRegistration): void {
    this.registrations.set(registration.plugin.id, registration);
  }

  /**
   * Idempotent boot-time load: register built-ins → discover/import external
   * scope packages → apply plugins policy → run factories. Failures land in
   * the load report as skipped entries and never block startup.
   */
  ensureLoaded(): Promise<PluginLoadReport> {
    this.loadPromise ??= this.load().catch((error: unknown) => {
      // Catastrophic loader failure (e.g. config unavailable): keep the server
      // serving with an empty plugin set instead of crashing startup.
      this.report = {
        loaded: [],
        skipped: {
          'plugins-loader': {
            errorCode: 'PLUGIN_LOADER_FAILED',
            message: String(error),
          },
        },
      };
      return this.report;
    });
    return this.loadPromise;
  }

  private async load(): Promise<PluginLoadReport> {
    const settings = this.deps.settings();
    const skipped: Record<string, PluginSkip> = {};

    for (const plugin of this.deps.builtins()) {
      this.register({ plugin, source: 'builtin' });
    }
    const builtinIds = new Set(this.deps.builtins().map((p) => p.id));
    for (const id of this.deps.discoverExternal(this.deps.nodeModuleDirs())) {
      if (builtinIds.has(id) || this.registrations.has(id)) continue;
      try {
        const plugin = await this.deps.importExternal(id);
        this.register({ plugin, source: 'external' });
      } catch (error: unknown) {
        skipped[id] = {
          errorCode: 'PLUGIN_IMPORT_FAILED',
          message: error instanceof Error ? error.message : String(error),
          hint: `确认 '${id}' 已安装且 default-export CrystalithPlugin，重启后重试`,
        };
      }
    }

    // Instantiation order: ids listed in plugins.load_order first (list order —
    // later listed loads later, "loaded last wins"), then the rest in
    // registration order.
    const listed = settings.load_order
      .map((id, i) => ({ id, i }))
      .filter(({ id }) => this.registrations.has(id));
    const listedIds = new Set(listed.map(({ id }) => id));
    const ordered = [
      ...listed.toSorted((a, b) => a.i - b.i).map(({ id }) => this.registrations.get(id)!),
      ...[...this.registrations.values()].filter(({ plugin }) => !listedIds.has(plugin.id)),
    ];

    const impls = new Map<string, unknown>();
    for (const { plugin } of ordered) {
      const deny = this.policyDecision(plugin.id, settings);
      if (deny) {
        skipped[plugin.id] = deny;
        continue;
      }
      try {
        impls.set(
          plugin.id,
          await plugin.factory({
            config: {},
            dataRoot: this.deps.dataRoot(),
            // Proxy-aware transport (proxy_settings + CL_PROXY_* overlay):
            // one network SSOT for built-ins and external plugins alike.
            fetch: outboundFetch,
          }),
        );
      } catch (error: unknown) {
        skipped[plugin.id] = {
          errorCode: 'PLUGIN_FACTORY_FAILED',
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    this.impls = impls;
    this.report = { loaded: [...impls.keys()], skipped };
    return this.report;
  }

  private policyDecision(
    id: string,
    settings: { enabled: string[]; disabled: string[] },
  ): PluginSkip | null {
    if (settings.disabled.includes(id)) {
      return {
        errorCode: 'PLUGIN_DISABLED',
        message: `插件 '${id}' 被 plugins.disabled 禁用`,
        hint: '从 config/app.yaml 的 plugins.disabled 移除后重启',
      };
    }
    if (settings.enabled.length > 0 && !settings.enabled.includes(id)) {
      return {
        errorCode: 'PLUGIN_NOT_ALLOWLISTED',
        message: `插件 '${id}' 不在 plugins.enabled 白名单内`,
        hint: '加入 config/app.yaml 的 plugins.enabled 后重启',
      };
    }
    return null;
  }

  // -- sync accessors: valid after ensureLoaded() --------------------------------

  isLoaded(id: string): boolean {
    return this.impls.has(id);
  }

  implOf<T = unknown>(id: string): T | undefined {
    return this.impls.get(id) as T | undefined;
  }

  /** Loaded plugins of a kind, in instantiation order (plugins.load_order aware). */
  loadedByKind(kind: CrystalithPluginKind): PluginRegistration[] {
    // Order by the actual instantiation sequence (impls insertion = load_order
    // aware), NOT registration order — otherwise load_order would not affect
    // consumer-facing chains like the extractor fallback order.
    const loadedIndex = new Map(this.report.loaded.map((id, i) => [id, i]));
    return [...this.registrations.values()]
      .filter(({ plugin }) => plugin.kind === kind && this.impls.has(plugin.id))
      .toSorted(
        (a, b) => (loadedIndex.get(a.plugin.id) ?? 0) - (loadedIndex.get(b.plugin.id) ?? 0),
      );
  }

  /** All registered (builtin + installed external) plugins — the official catalog face. */
  allRegistrations(): PluginRegistration[] {
    return [...this.registrations.values()];
  }

  loadReport(): PluginLoadReport {
    return this.report;
  }

  /** Test/bootstrap reset. */
  reset(): void {
    this.registrations = new Map();
    this.impls = new Map();
    this.report = { loaded: [], skipped: {} };
    this.loadPromise = null;
  }
}

/** Process-wide singleton (built-ins + npm-scope externals). */
export const pluginRegistry = new PluginRegistry();
