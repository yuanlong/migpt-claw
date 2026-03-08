import { randomUUID } from 'node:crypto';
import { MiService } from './service.js';
import { firstOf, lastOf } from './utils/parse.js';

export interface IMessage {
  id: string;
  sender: 'user';
  text: string;
  timestamp: number;
  deviceId: string;
}

class _MiMessage {
  private _lastQueryMsg: Record<string, IMessage | undefined> = {};
  private _tempQueryMsgs: Record<string, IMessage[]> = {};

  /**
   * 获取下一条消息
   * @param deviceId 设备 ID
   */
  async fetchNextMessage(deviceId: string): Promise<IMessage | undefined> {
    if (!this._lastQueryMsg[deviceId]) {
      return this._fetchFirstMessage(deviceId);
    }
    return this._fetchNextMessage(deviceId);
  }

  /**
   * 拉取第一条消息（初始化）
   */
  private async _fetchFirstMessage(deviceId: string) {
    const msgs = await this._fetchHistoryMsgs(deviceId, {
      limit: 1,
      filterAnswer: false,
    });
    this._lastQueryMsg[deviceId] = msgs[0];
    return undefined;
  }

  /**
   * 拉取下一条消息
   */
  private async _fetchNextMessage(deviceId: string): Promise<IMessage | undefined> {
    if (this._tempQueryMsgs[deviceId] && this._tempQueryMsgs[deviceId].length > 0) {
      // 当前有暂存的新消息（从新到旧），依次处理之
      return this._fetchNextTempMessage(deviceId);
    }
    // 拉取最新的 2 条 msg（用于和上一条消息比对是否连续）
    const nextMsg = await this._fetchNext2Messages(deviceId);
    if (nextMsg !== 'continue') {
      return nextMsg;
    }
    // 继续向上拉取其他新消息
    return this._fetchNextRemainingMessages(deviceId);
  }

  /**
   * 拉取最新的 2 条消息，用于和上一条消息比对是否连续
   */
  private async _fetchNext2Messages(deviceId: string): Promise<IMessage | 'continue' | undefined> {
    const msgs = await this._fetchHistoryMsgs(deviceId, { limit: 2 });
    if (msgs.length < 1 || firstOf(msgs)!.timestamp <= this._lastQueryMsg[deviceId]!.timestamp) {
      // 没有拉到新消息
      return;
    }
    if (
      firstOf(msgs)!.timestamp > this._lastQueryMsg[deviceId]!.timestamp &&
      (msgs.length === 1 || lastOf(msgs)!.timestamp <= this._lastQueryMsg[deviceId]!.timestamp)
    ) {
      // 刚好收到一条新消息
      this._lastQueryMsg[deviceId] = firstOf(msgs);
      return this._lastQueryMsg[deviceId];
    }
    // 还有其他新消息，暂存当前的新消息
    for (const msg of msgs) {
      if (msg.timestamp > this._lastQueryMsg[deviceId]!.timestamp) {
        if (!this._tempQueryMsgs[deviceId]) {
          this._tempQueryMsgs[deviceId] = [];
        }
        this._tempQueryMsgs[deviceId].push(msg);
      }
    }
    return 'continue';
  }

  /**
   * 继续向上拉取其他新消息
   */
  private async _fetchNextRemainingMessages(deviceId: string, options?: {
    maxPage?: number;
    pageSize?: number;
  }) {
    let currentPage = 0;
    const { maxPage = 3, pageSize = 10 } = options ?? {};
    while (true) {
      currentPage++;
      if (currentPage > maxPage) {
        // 拉取新消息超长，取消拉取
        return this._fetchNextTempMessage(deviceId);
      }
      const nextTimestamp = lastOf(this._tempQueryMsgs[deviceId]!)!.timestamp;
      const msgs = await this._fetchHistoryMsgs(deviceId, {
        limit: pageSize,
        timestamp: nextTimestamp,
      });
      for (const msg of msgs) {
        if (msg.timestamp >= nextTimestamp) {
          // 忽略上一页的消息
        } else if (msg.timestamp > this._lastQueryMsg[deviceId]!.timestamp) {
          // 继续添加新消息
          this._tempQueryMsgs[deviceId].push(msg);
        } else {
          // 拉取到历史消息处
          return this._fetchNextTempMessage(deviceId);
        }
      }
    }
  }

  /**
   * 读取暂存的消息
   */
  private _fetchNextTempMessage(deviceId: string): IMessage | undefined {
    const nextMsg = this._tempQueryMsgs[deviceId].pop();
    if (nextMsg) {
      this._lastQueryMsg[deviceId] = nextMsg;
    }
    return nextMsg;
  }

  /**
   * 拉取历史消息
   */
  private async _fetchHistoryMsgs(
    deviceId: string,
    options?: {
      limit?: number;
      timestamp?: number;
      filterAnswer?: boolean;
    },
  ): Promise<IMessage[]> {
    const filterAnswer = options?.filterAnswer ?? true;
    const conversation = await MiService.MiNA?.getConversations({
      limit: options?.limit,
      timestamp: options?.timestamp,
    });
    let records = conversation?.records ?? [];
    
    if (filterAnswer) {
      // 过滤有小爱回答的消息
      records = records.filter(
        (e) =>
          ['TTS', 'LLM'].includes(e.answers[0]?.type ?? '') && // 过滤 TTS 和 LLM 消息
          e.answers.length === 1, // 播放音乐时会有 TTS、Audio 两个 Answer
      );
    }
    
    return records.map((e) => {
      return {
        id: randomUUID(),
        sender: 'user',
        text: e.query,
        timestamp: e.time,
        deviceId,
      };
    });
  }

  /**
   * 清除设备消息缓存
   */
  clear(deviceId: string) {
    delete this._lastQueryMsg[deviceId];
    delete this._tempQueryMsgs[deviceId];
  }

  /**
   * 清除所有缓存
   */
  clearAll() {
    this._lastQueryMsg = {};
    this._tempQueryMsgs = {};
  }
}

export const MiMessage = new _MiMessage();
