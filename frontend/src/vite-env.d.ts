/// <reference types="vite/client" />

/* Side-effect CSS imports (`import "./x.css"`) are resolved by Vite, not by
   TypeScript, which otherwise reports them as modules with no declaration. */
declare module "*.css";
