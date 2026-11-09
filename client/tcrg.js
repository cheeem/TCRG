const WASM_URL = 'tcrg.wasm';
const TRANSPORT_URL = 'https://localhost:9000';
let wasmModulePromise = null;

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
      if(wasmModulePromise == null) {
        wasmModulePromise = WebAssembly.compileStreaming(fetch(this.#wasmUrl, { signal: this.#abortController.signal }));
      }

      if(this.#abortController.signal.aborted) {
        return;
      }

      const module = await wasmModulePromise;
      const wasmResult = await WebAssembly.instantiate(module);
      this.#tcrg = wasmResult.instance;

      this.#transport = new WebTransport(this.#transportUrl); 
      await this.#transport.ready;

      if(this.#abortController.signal.aborted) {
        this.#transport.close();
        return;
      }

      this.#tcrg.exports.tcrg_set_rand_seed(Date.now() >>> 0);
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
    // changes to make
    // i have a js owned arraybuffer(BUF_CAP) 
    // and a wasm owned view (BUF_CAP)
    // and after i receive "value" which is just that filled arraybuffer, 
    // i copy my "value" bytes into the wasm owned view, 
    // accounting for an offset 
    // until the byob read returns done === true

    const exports = this.#tcrg.exports;
    const bufPtr = exports.tcrg_get_buf();
    const bufCap = exports.tcrg_get_buf_cap();
    const bufView = new Uint8Array(exports.memory.buffer, bufPtr, bufCap);

    let tmpBuf = new ArrayBuffer(bufcap);
    try {
      const sessionReader = this.#transport.incomingUnidirectionalStreams.getReader();

      while(this.#isListening) {
        const { value: stream, done: sessionDone } = await sessionReader.read();
        if(sessionDone) break;

        const byobReader = receiveStream.readable.getReader({ mode: "byob" });
        let offset = 0;

        try {
          while(this.#isListening) {
            const tmpBufView = new Uint8Array(tmpBuf, offset);

            const { value, done: streamDone } = await byobReader.read(tmpBufView);
            if(streamDone) break;

            tmpBuf = value.buffer;
            offset += value.byteLength;

            view = value;
          }

          if(offset > 16) {
            bufView.set(new Uint8Array(tmpBuf, 0, offset));
            exports.tcrg_on_set_nebv(value.byteLength);
          }
        } finally {
          reader.releaseLock();
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
