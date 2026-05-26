import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BrowserLoadCellSerial,
  BrowserSerialAcquisition,
  parseLoadCellLine,
  parseUnbcLine,
  pathonixBytesToPackets,
  serialPortLabel,
  twoBytesToUint16,
} from "./serial";

function createReadableFixture() {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const readable = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
    },
  });
  return {
    readable,
    enqueue(bytes: number[] | Uint8Array) {
      controller?.enqueue(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    },
    close() {
      controller?.close();
    },
  };
}

function createErrorReadableFixture(error: Error) {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const readable = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
    },
  });
  return {
    readable,
    error() {
      controller?.error(error);
    },
  };
}

function mockSerialPort(readable = new ReadableStream<Uint8Array>()) {
  const writes: number[][] = [];
  const port = {
    readable,
    writable: new WritableStream<Uint8Array>({
      write(chunk) {
        writes.push(Array.from(chunk));
      },
    }),
    open: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  vi.stubGlobal("navigator", { serial: { requestPort: vi.fn(async () => port) } });
  return { writes, port };
}

async function flushSerialLoop() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("serial packet parsing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses little-endian uint16 conversion", () => {
    expect(twoBytesToUint16(0x34, 0x12)).toBe(0x1234);
  });

  it("parses Pathonix 16-byte packets into 8 uint16 values", () => {
    expect(pathonixBytesToPackets([1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8, 0])).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8],
    ]);
  });

  it("parses UNBC space-delimited lines with optional load cell value", () => {
    expect(parseUnbcLine("10 20 30 40 99")).toEqual({
      packet: [10, 20, 30, 40, 0, 0, 0, 0],
      loadCell: 99,
    });
  });

  it("parses UNBC raw byte lines into uint16 channel values", () => {
    expect(parseUnbcLine("[1, 0, 2, 0, 3, 0, 4, 0, 99]")).toEqual({
      packet: [1, 2, 3, 4, 0, 0, 0, 0],
      loadCell: 99,
    });
    expect(parseUnbcLine("-1 -1 0 1 52 18 120 86")).toEqual({
      packet: [65535, 256, 4660, 22136, 0, 0, 0, 0],
    });
  });

  it("parses load-cell text lines by using the last numeric value", () => {
    expect(parseLoadCellLine("12.5")).toBe(12.5);
    expect(parseLoadCellLine("0.04, 13.25")).toBe(13.25);
    expect(parseLoadCellLine("bad")).toBeUndefined();
  });

  it("formats Web Serial USB metadata into a stable port label", () => {
    expect(serialPortLabel({ getInfo: () => ({ usbVendorId: 0x123, usbProductId: 0xab }) })).toBe("USB 0123:00AB");
    expect(serialPortLabel({ getInfo: () => ({ usbVendorId: 0x123 }) })).toBe("USB vendor 0123");
    expect(serialPortLabel({ getInfo: () => ({}) })).toBe("Browser selected port");
  });

  it("writes the legacy Pathonix start and stop command bytes", async () => {
    const { writes } = mockSerialPort();
    const bridge = new BrowserSerialAcquisition("pathonix", 0.04, () => undefined);

    await bridge.connect();
    await bridge.start();
    await bridge.stop();

    expect(writes).toEqual([[212], [213, 213]]);
  });

  it("does not start duplicate Pathonix read loops or command writes", async () => {
    const { writes } = mockSerialPort();
    const bridge = new BrowserSerialAcquisition("pathonix", 0.04, () => undefined);

    await bridge.connect();
    await bridge.start();
    await bridge.start();

    expect(writes).toEqual([[212]]);
  });

  it("writes the legacy UNBC start and stop text commands", async () => {
    const { writes } = mockSerialPort();
    const bridge = new BrowserSerialAcquisition("unbc", 0.04, () => undefined);

    await bridge.connect();
    await bridge.start();
    await bridge.stop();

    expect(writes).toEqual([
      [49, 49, 49, 49],
      [50],
    ]);
  });

  it("buffers Pathonix byte chunks until complete 16-byte packets are available", async () => {
    const readable = createReadableFixture();
    const packets: number[][] = [];
    mockSerialPort(readable.readable);
    const bridge = new BrowserSerialAcquisition("pathonix", 0.04, (packet) => {
      packets.push(packet);
    });

    await bridge.connect();
    await bridge.start();
    readable.enqueue([1, 0, 2, 0, 3, 0, 4, 0]);
    await flushSerialLoop();
    expect(packets).toEqual([]);

    readable.enqueue([5, 0, 6, 0, 7, 0, 8, 0]);
    await flushSerialLoop();
    expect(packets).toEqual([[1, 2, 3, 4, 5, 6, 7, 8]]);

    readable.enqueue([9, 0, 10, 0, 11, 0, 12, 0, 13, 0, 14, 0, 15, 0, 16, 0]);
    await flushSerialLoop();
    expect(packets).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8],
      [9, 10, 11, 12, 13, 14, 15, 16],
    ]);
    readable.close();
  });

  it("reports Pathonix read-loop errors to the caller", async () => {
    const readError = new Error("device removed");
    const readable = createErrorReadableFixture(readError);
    const errors: Error[] = [];
    mockSerialPort(readable.readable);
    const bridge = new BrowserSerialAcquisition("pathonix", 0.04, () => undefined, (error) => errors.push(error));

    await bridge.connect();
    await bridge.start();
    readable.error();
    await flushSerialLoop();

    expect(errors).toEqual([readError]);
  });

  it("buffers UNBC text chunks across line breaks and timestamps load-cell points", async () => {
    const readable = createReadableFixture();
    const encoder = new TextEncoder();
    const packets: Array<{ packet: number[]; loadCell?: { time: number; value: number } }> = [];
    mockSerialPort(readable.readable);
    const bridge = new BrowserSerialAcquisition("unbc", 0.04, (packet, loadCell) => {
      packets.push({ packet, loadCell });
    });

    await bridge.connect();
    await bridge.start();
    readable.enqueue(encoder.encode("10 20"));
    await flushSerialLoop();
    expect(packets).toEqual([]);

    readable.enqueue(encoder.encode(" 30 40 99\r\nbad\n11 21 31 41 101\n"));
    await flushSerialLoop();

    expect(packets).toEqual([
      { packet: [10, 20, 30, 40, 0, 0, 0, 0], loadCell: { time: 0, value: 99 } },
      { packet: [11, 21, 31, 41, 0, 0, 0, 0], loadCell: { time: 0.04, value: 101 } },
    ]);
    readable.close();
  });

  it("streams standalone load-cell serial lines into timestamped points", async () => {
    const readable = createReadableFixture();
    const encoder = new TextEncoder();
    const points: Array<{ time: number; value: number }> = [];
    const { writes } = mockSerialPort(readable.readable);
    const bridge = new BrowserLoadCellSerial(0.04, (point) => points.push(point));

    await bridge.connect();
    await bridge.start();
    readable.enqueue(encoder.encode("10."));
    await flushSerialLoop();
    expect(points).toEqual([]);

    readable.enqueue(encoder.encode("5\n0.04, 11.25\r\nbad\n"));
    await flushSerialLoop();
    expect(points).toEqual([
      { time: 0, value: 10.5 },
      { time: 0.04, value: 11.25 },
    ]);
    expect(writes).toEqual([[115, 116, 97, 114, 116, 10]]);
    readable.close();
  });

  it("reports standalone load-cell read-loop errors to the caller", async () => {
    const readError = new Error("load cell disconnected");
    const readable = createErrorReadableFixture(readError);
    const errors: Error[] = [];
    mockSerialPort(readable.readable);
    const bridge = new BrowserLoadCellSerial(0.04, () => undefined, (error) => errors.push(error));

    await bridge.connect();
    await bridge.start();
    readable.error();
    await flushSerialLoop();

    expect(errors).toEqual([readError]);
  });

  it("writes legacy FUTEK start and stop commands around standalone load-cell streaming", async () => {
    const readable = createReadableFixture();
    const { port, writes } = mockSerialPort(readable.readable);
    const bridge = new BrowserLoadCellSerial(0.04, () => undefined);

    await bridge.connect();
    await bridge.start();
    await bridge.disconnect();

    expect(writes).toEqual([
      [115, 116, 97, 114, 116, 10],
      [115, 116, 111, 112, 10],
    ]);
    expect(port.close).toHaveBeenCalledOnce();
  });

  it("does not send duplicate FUTEK start commands while already streaming", async () => {
    const readable = createReadableFixture();
    const { writes } = mockSerialPort(readable.readable);
    const bridge = new BrowserLoadCellSerial(0.04, () => undefined);

    await bridge.connect();
    await bridge.start();
    await bridge.start();

    expect(writes).toEqual([[115, 116, 97, 114, 116, 10]]);
    readable.close();
  });
});
