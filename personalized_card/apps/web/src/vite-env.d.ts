/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API when it is not served from the same host. */
  readonly VITE_API_BASE_URL?: string;
  /** Product name shown in the creator app chrome. */
  readonly VITE_APP_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
