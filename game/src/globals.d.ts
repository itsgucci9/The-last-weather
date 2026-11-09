/** Game version from package.json, injected by vite.config.ts. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Public address of the web game, used in share messages and link previews. */
  readonly VITE_SITE_URL?: string;
}
