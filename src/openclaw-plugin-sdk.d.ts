// Type declarations for openclaw/plugin-sdk
declare module 'openclaw/plugin-sdk' {
  export const DEFAULT_ACCOUNT_ID: string;

  export function emptyPluginConfigSchema(): any;

  export interface PluginRuntime {
    channel: {
      activity: {
        record: (opts: { channel: string; accountId: string; direction: 'inbound' | 'outbound' }) => void;
      };
      reply: {
        finalizeInboundContext: (opts: {
          Body: string;
          BodyForAgent?: string;
          RawBody?: string;
          CommandBody?: string;
          From: string;
          To: string;
          SessionKey: string;
          AccountId: string;
          ChatType: 'direct' | 'group';
          SenderId: string;
          SenderName?: string;
          Provider: string;
          Surface: string;
          MessageSid: string;
          Timestamp: number;
          OriginatingChannel: string;
          OriginatingTo: string;
          CommandAuthorized?: boolean;
          MediaPaths?: string[];
          MediaPath?: string;
          MediaTypes?: string[];
          MediaType?: string;
          MediaUrls?: string[];
          MediaUrl?: string;
          ImageMediaTypes?: string[];
        }) => any;
        dispatchReplyWithBufferedBlockDispatcher: (opts: {
          ctx: any;
          cfg: any;
          dispatcherOptions?: {
            responsePrefix?: string;
            deliver?: (payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string }, info: { kind: string }) => Promise<void>;
          };
        }) => Promise<void>;
        resolveEffectiveMessagesConfig: (cfg: any, agentId?: string) => any;
        resolveEnvelopeFormatOptions: (cfg: any) => any;
        formatInboundEnvelope: (opts: {
          Body: string;
          BodyForAgent?: string;
          From: string;
          To: string;
          SessionKey: string;
          ChatType: 'direct' | 'group';
          SenderId: string;
          SenderName?: string;
          Provider: string;
          Surface: string;
          MessageSid: string;
          Timestamp: number;
          OriginatingChannel: string;
          envelopeOptions: any;
        }) => string;
      };
      routing: {
        resolveAgentRoute: (opts: {
          from: string;
          to: string;
          sessionKey: string;
          accountId: string;
          chatType: 'direct' | 'group';
          provider: string;
        }) => any;
      };
    };
  }

  export interface OpenClawPluginApi {
    runtime: PluginRuntime;
    logger: any;
    registerChannel(options: { plugin: any }): void;
    registerTool(tool: any): void;
    registerGatewayMethod(name: string, handler: any): void;
    registerHttpRoute(handler: any): void;
    registerCli(handler: any, options?: any): void;
    registerCommand(command: any): void;
    registerService(service: any): void;
    registerContextEngine(id: string, factory: any): void;
    registerHook(event: string, handler: any, options?: any): void;
    registerProvider(provider: any): void;
    on(event: string, handler: any, options?: any): void;
  }
  
  export interface ChannelPlugin<T = any> {
    id: string;
    meta: {
      id: string;
      label: string;
      selectionLabel: string;
      docsPath?: string;
      docsLabel?: string;
      blurb: string;
      aliases?: string[];
      order?: number;
    };
    capabilities: {
      chatTypes: string[];
      polls?: boolean;
      threads?: boolean;
      media?: boolean;
      reactions?: boolean;
      edit?: boolean;
      reply?: boolean;
      blockStreaming?: boolean;
    };
    reload?: { configPrefixes: string[] };
    onboarding?: ChannelOnboardingAdapter;
    config: {
      listAccountIds: (cfg: any) => string[];
      resolveAccount: (cfg: any, accountId?: string) => T;
      defaultAccountId: (cfg: any) => string;
      setAccountEnabled: (opts: { cfg: any; accountId: string; enabled: boolean }) => any;
      deleteAccount: (opts: { cfg: any; accountId: string }) => any;
      isConfigured: (account: T) => boolean;
      describeAccount: (account: T) => any;
      resolveAllowFrom?: (opts: { cfg: any; accountId?: string }) => string[];
      formatAllowFrom?: (opts: { allowFrom: Array<string | number> }) => string[];
    };
    setup?: {
      resolveAccountId?: (opts: any) => string;
      applyAccountConfig?: (opts: any) => any;
      validateInput?: (opts: any) => string | null;
      applyAccountName?: (opts: any) => any;
    };
    messaging?: {
      normalizeTarget: (target: string) => { ok: boolean; to?: string; error?: string };
      targetResolver: {
        looksLikeId: (id: string) => boolean;
        hint: string;
      };
    };
    outbound: ChannelOutboundAdapter;
    gateway?: {
      startAccount: (ctx: any) => Promise<void>;
      logoutAccount?: (opts: any) => Promise<any>;
    };
    status?: {
      defaultRuntime: any;
      buildChannelSummary?: (opts: any) => any;
      probeAccount?: (opts: any) => Promise<any>;
      buildAccountSnapshot?: (opts: any) => any;
    };
    pairing?: any;
    security?: any;
    groups?: any;
    agentPrompt?: any;
    directory?: any;
  }
  
  export interface ChannelOutboundAdapter {
    deliveryMode: string;
    chunker?: (text: string, limit: number) => string[];
    chunkerMode?: string;
    textChunkLimit?: number;
    sendText: (opts: { to: string; text: string; accountId?: string; cfg: any; replyToId?: string }) => Promise<any>;
    sendMedia?: (opts: { to: string; text?: string; mediaUrl: string; accountId?: string; cfg: any; replyToId?: string }) => Promise<any>;
  }
  
  export interface ChannelOnboardingAdapter {
    selectAccount?: (opts: any) => Promise<any>;
    promptCredentials?: () => Promise<any>;
    validateCredentials?: (opts: any) => Promise<any>;
    applyConfig?: (opts: any) => any;
  }
  
  export interface OpenClawConfig {
    channels?: Record<string, any>;
  }
}
