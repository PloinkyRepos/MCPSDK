class InMemoryTransport {
  constructor() {
    this._messageQueue = [];
  }
  /**
   * Creates a pair of linked in-memory transports that can communicate with each other. One should be passed to a Client and one to a Server.
   */
  static createLinkedPair() {
    const clientTransport = new InMemoryTransport();
    const serverTransport = new InMemoryTransport();
    clientTransport._otherTransport = serverTransport;
    serverTransport._otherTransport = clientTransport;
    return [clientTransport, serverTransport];
  }
  async start() {
    while (this._messageQueue.length > 0) {
      const queuedMessage = this._messageQueue.shift();
      this.onmessage?.(queuedMessage.message, queuedMessage.extra);
    }
  }
  async close() {
    const other = this._otherTransport;
    this._otherTransport = void 0;
    await other?.close();
    this.onclose?.();
  }
  /**
   * Sends a message with optional auth info.
   * This is useful for testing authentication scenarios.
   */
  async send(message, options) {
    if (!this._otherTransport) {
      throw new Error("Not connected");
    }
    if (this._otherTransport.onmessage) {
      this._otherTransport.onmessage(message, { authInfo: options?.authInfo });
    } else {
      this._otherTransport._messageQueue.push({ message, extra: { authInfo: options?.authInfo } });
    }
  }
}
export {
  InMemoryTransport
};
//# sourceMappingURL=inMemory.js.map
