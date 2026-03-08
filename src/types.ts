// Re-export types from config.ts
export type {
  MiGPTConfig,
  MiGPTAccountConfig,
  ResolvedMiAccount,
  ExtendedOpenClawConfig,
} from './config.js';

// Message types
export interface IMessage {
  id: string;
  sender: 'user';
  text: string;
  timestamp: number;
  deviceId: string;
}

// Device types
export interface MiDevice {
  did: string;
  name: string;
  model?: string;
  mac?: string;
}

// Message event types
export interface MiMessageEvent {
  channel: 'migpt';
  accountId: string;
  from: string;
  fromName: string;
  text: string;
  timestamp: number;
}
