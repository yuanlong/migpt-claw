import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setMiGPTRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getMiGPTRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("MiGPT runtime not initialized");
  }
  return runtime;
}
