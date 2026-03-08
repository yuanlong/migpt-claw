import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { miGPTPlugin } from './src/channel.js';
import { setMiGPTRuntime } from './src/runtime.js';

const plugin = {
  id: 'migpt-claw',
  name: 'MiGPT',
  description: '小米小爱音箱 OpenClaw Channel 插件',
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setMiGPTRuntime(api.runtime);
    api.registerChannel({ plugin: miGPTPlugin });
  },
};

export default plugin;

export { miGPTPlugin } from './src/channel.js';
export { setMiGPTRuntime, getMiGPTRuntime } from './src/runtime.js';
export { miGPTOnboardingAdapter } from './src/onboarding.js';
export { MiService, type MiServiceConfig } from './src/service.js';
export { MiMessage, type IMessage } from './src/message.js';
export { MiSpeaker } from './src/speaker.js';
export * from './src/config.js';
export * from './src/types.js';
