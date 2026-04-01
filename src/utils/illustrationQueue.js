/**
 * Illustration Queue Manager
 * Manages sequential image generation to avoid rate limits
 * and provides progress tracking with resume capability
 */

class IllustrationQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentIndex = 0;
    this.results = [];
    this.errors = [];
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
    this.aborted = false;
  }

  /**
   * Add pages to the generation queue
   * @param {Array} pages - Array of page objects to generate illustrations for
   */
  addPages(pages) {
    this.queue = pages.map((page, index) => ({
      page,
      index,
      status: 'pending',
      attempts: 0
    }));
    this.currentIndex = 0;
    this.results = [];
    this.errors = [];
    this.aborted = false;
  }

  /**
   * Start processing the queue
   * @param {Function} generateFn - Function to generate illustration for a page
   */
  async start(generateFn) {
    if (this.isProcessing) {
      console.warn('Queue is already processing');
      return;
    }

    this.isProcessing = true;
    this.aborted = false;

    while (this.currentIndex < this.queue.length && !this.aborted) {
      const item = this.queue[this.currentIndex];
      
      try {
        item.status = 'processing';
        this.notifyProgress();

        const result = await generateFn(item.page, item.index);
        
        item.status = 'completed';
        item.result = result;
        this.results.push({ pageIndex: item.index, result });

      } catch (error) {
        item.attempts++;

        const retryable = error?.transient === true || error?.retryable === true;

        if (retryable && item.attempts < 3) {
          // Retry only when the upstream error is explicitly retryable.
          item.status = 'retrying';
          this.notifyProgress();
          await this.delay(2000); // Wait 2 seconds before retry
          continue; // Don't increment currentIndex, retry same item
        } else {
          // Max attempts reached
          item.status = 'failed';
          item.error = error.message;
          this.errors.push({ pageIndex: item.index, error: error.message });
          
          if (this.onError) {
            this.onError(item.page, error);
          }
        }
      }

      this.currentIndex++;
      this.notifyProgress();

      // Small delay between requests to avoid rate limits
      if (this.currentIndex < this.queue.length) {
        await this.delay(1000);
      }
    }

    this.isProcessing = false;

    if (this.onComplete && !this.aborted) {
      this.onComplete(this.results, this.errors);
    }
  }

  /**
   * Pause the queue processing
   */
  pause() {
    this.aborted = true;
    this.isProcessing = false;
  }

  /**
   * Resume queue processing from where it left off
   * @param {Function} generateFn - Function to generate illustration for a page
   */
  async resume(generateFn) {
    if (this.currentIndex >= this.queue.length) {
      console.warn('Queue is already complete');
      return;
    }

    this.aborted = false;
    await this.start(generateFn);
  }

  /**
   * Reset the queue
   */
  reset() {
    this.queue = [];
    this.currentIndex = 0;
    this.results = [];
    this.errors = [];
    this.isProcessing = false;
    this.aborted = false;
  }

  /**
   * Get current progress
   * @returns {Object} Progress information
   */
  getProgress() {
    const total = this.queue.length;
    const completed = this.queue.filter(item => item.status === 'completed').length;
    const failed = this.queue.filter(item => item.status === 'failed').length;
    const pending = this.queue.filter(item => item.status === 'pending').length;
    const processing = this.queue.filter(item => item.status === 'processing' || item.status === 'retrying').length;

    return {
      total,
      completed,
      failed,
      pending,
      processing,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      isComplete: completed + failed === total,
      currentIndex: this.currentIndex,
      queue: this.queue
    };
  }

  /**
   * Notify progress listeners
   */
  notifyProgress() {
    if (this.onProgress) {
      this.onProgress(this.getProgress());
    }
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set progress callback
   * @param {Function} callback - Progress callback function
   */
  setOnProgress(callback) {
    this.onProgress = callback;
  }

  /**
   * Set completion callback
   * @param {Function} callback - Completion callback function
   */
  setOnComplete(callback) {
    this.onComplete = callback;
  }

  /**
   * Set error callback
   * @param {Function} callback - Error callback function
   */
  setOnError(callback) {
    this.onError = callback;
  }
}

// Export singleton instance
const illustrationQueue = new IllustrationQueue();

export default illustrationQueue;

/**
 * Create a new queue instance (for multiple concurrent queues)
 * @returns {IllustrationQueue} New queue instance
 */
export function createQueue() {
  return new IllustrationQueue();
}
