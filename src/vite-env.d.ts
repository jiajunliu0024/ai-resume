/// <reference types="vite/client" />

declare module "*.tex?raw" {
  const src: string;
  export default src;
}
