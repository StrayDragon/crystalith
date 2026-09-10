/// <reference types="@rsbuild/core/types" />

interface ImportMetaEnv {
  readonly VITE_LAB_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
