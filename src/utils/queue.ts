import Logger from './logger';

const logger = Logger.forModule('Queue');

export interface QueuedTask {
  taskName: string;
  taskFn: () => Promise<void>;
}

export class TaskQueue {
  private _queue: QueuedTask[] = [];
  private _isProcessing = false;
  private _delayBetweenTasksMs = 20_000; // 20s safety cooldown between Instagram posts

  /**
   * Adds an async task function to the FIFO queue.
   */
  public add(taskName: string, taskFn: () => Promise<void>): void {
    logger.info(`📥 Enqueued task: "${taskName}" (Pending: ${this._queue.length + 1})`);
    this._queue.push({ taskName, taskFn });
    this._processNext();
  }

  private async _processNext(): Promise<void> {
    if (this._isProcessing || this._queue.length === 0) {
      return;
    }

    this._isProcessing = true;
    const task = this._queue.shift();
    if (!task) {
      this._isProcessing = false;
      return;
    }

    const { taskName, taskFn } = task;

    try {
      logger.info(`🚀 Starting processing for: "${taskName}"`);
      await taskFn();
      logger.success(`✅ Completed task: "${taskName}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`❌ Task "${taskName}" failed: ${msg}`, err);
    } finally {
      if (this._queue.length > 0) {
        logger.info(`⏳ Waiting ${this._delayBetweenTasksMs / 1000}s safety cooldown before next task...`);
        setTimeout(() => {
          this._isProcessing = false;
          this._processNext();
        }, this._delayBetweenTasksMs);
      } else {
        this._isProcessing = false;
        logger.info('✨ Queue is now idle. Listening for new images...');
      }
    }
  }

  public get pendingCount(): number {
    return this._queue.length;
  }
}

const reelQueue = new TaskQueue();
export default reelQueue;
