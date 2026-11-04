const WASM_URL = 'tcrg.wasm';
const TRANSPORT_URL = 'https://localhost:9000';
let tcrg = null;

export class TcrgClient extends EventTarget {
  #wasmUrl;
  #transportUrl;
  #tcrg = null;
  #transport = null;
  #abortController = null;
  #isListening = false;

  constructor(wasmUrl, transportUrl) {
    super();
    this.#wasmUrl = wasmUrl;
    this.#transportUrl = transportUrl;
  }

  async open() {
    if(this.#transport || this.#abortController) {
      throw new Error("A TCRG WebTransport client is already initialized or initializing.");
    }

    this.#abortController = new AbortController();

    try {
      this.#tcrg = tcrg;
      if(tcrg == null) {
        const wasmResult = await WebAssembly.instantiateStreaming(fetch(this.#wasmUrl, { signal: controller.signal }));
        this.#tcrg = wasmResult.instance;
      }

      await this.#transport.ready;

      if(controller.signal.aborted) {
        transport.close();
        return;
      }

      this.#tcrg.exports.tcrg_set_rand_seed(Date.now() >>> 0);
      this.#transport = new WebTransport(this.#transportUrl); 

      this.#isListening = true;
      this.#handleDisconnect(this.#transport);
      this.#ingest();
      this.dispatchEvent(new CustomEvent("connected"));
    } catch(error) {
      this.close();
      if(error.name === "AbortError") {
        return;
      }
      throw new Error(`Failed to initialize TCRG client: ${error.message}`, { cause: error });
    }
  }

  async #ingest() {
    const exports = this.#tcrg.exports;
    const bufferPtr = exports.tcrg_get_buf();

    try {
      const sessionReader = this.#transport.incomingUnidirectionalStreams.getReader();

      while(this.#isListening) {
        const { value: receiveStream, done: sessionDone } = await sessionReader.read();
        if(sessionDone) break;
        const byobReader = receiveStream.readable.getReader({ mode: "byob" });
        while(this.#isListening) {
          const bufferLen = exports.tcrg_get_buf_len();
          const view = new Uint8Array(exports.memory.buffer, bufferPtr, bufferLen);
          const {value, done: streamDone } = await byobReader.read(view);
          if(streamDone) break;

          exports.tcrg_set_nebv(value.byteLength);
        }
      }
    } catch (error) {
      if(this.#isListening) {
        this.dispatchEvent(new CustomEvent("error", { detail: error }));
      }
    }
  }

  async #handleDisconnect(transport) {
    try {
      await transport.closed;
      this.dispatchEvent(new CustomEvent("disconnected", { detail: { clean: true } }));
    } catch(error) {
      this.dispatchEvent(new CustomEvent("disconnected", { detail: { clean: false, error } }));
    } finally {
      if(this.#transport === transport) {
        this.close();
      }
    }
  }

  getNodeIndex() {
    if(this.#tcrg == null) {
      throw new Error("TCRG Client is not initialized.");
    }
    return this.#tcrg.exports.tcrg_get_node_index();
  }

  close() {
    this.#isListening = false;
    if(this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    if(this.#transport) {
      this.#transport.close();
      this.#transport = null;
    }
    
    this.#tcrg = null;
  }
} 
