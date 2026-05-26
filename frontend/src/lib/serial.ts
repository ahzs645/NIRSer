import type { DeviceKind, NirsPacket, Point } from "../types/nirs";

type PacketCallback = (packet: NirsPacket, loadCell?: Point) => void;
type LoadCellCallback = (point: Point) => void;
type ErrorCallback = (error: Error) => void;

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo?(): SerialPortInfo;
};

type SerialPortInfo = {
  usbVendorId?: number;
  usbProductId?: number;
};

type SerialOptions = {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "even" | "odd";
};

type NavigatorWithSerial = Navigator & {
  serial?: {
    requestPort(): Promise<SerialPortLike>;
  };
};

export function supportsWebSerial() {
  return Boolean((navigator as NavigatorWithSerial).serial);
}

export function twoBytesToUint16(byte1: number, byte2: number) {
  return ((byte2 & 0xff) << 8) + (byte1 & 0xff);
}

function hexId(value: number) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

export function serialPortLabel(port: Pick<SerialPortLike, "getInfo"> | null) {
  const info = port?.getInfo?.();
  if (info?.usbVendorId !== undefined && info.usbProductId !== undefined) {
    return `USB ${hexId(info.usbVendorId)}:${hexId(info.usbProductId)}`;
  }
  if (info?.usbVendorId !== undefined) return `USB vendor ${hexId(info.usbVendorId)}`;
  return "Browser selected port";
}

export function pathonixBytesToPackets(bytes: number[]) {
  const packets: NirsPacket[] = [];
  for (let i = 0; i <= bytes.length - 16; i += 16) {
    packets.push([
      twoBytesToUint16(bytes[i], bytes[i + 1]),
      twoBytesToUint16(bytes[i + 2], bytes[i + 3]),
      twoBytesToUint16(bytes[i + 4], bytes[i + 5]),
      twoBytesToUint16(bytes[i + 6], bytes[i + 7]),
      twoBytesToUint16(bytes[i + 8], bytes[i + 9]),
      twoBytesToUint16(bytes[i + 10], bytes[i + 11]),
      twoBytesToUint16(bytes[i + 12], bytes[i + 13]),
      twoBytesToUint16(bytes[i + 14], bytes[i + 15]),
    ]);
  }
  return packets;
}

function looksLikeRawByteLine(values: number[]) {
  return (
    values.length >= 8 &&
    values.slice(0, 8).every((value) => Number.isInteger(value) && value >= -128 && value <= 255)
  );
}

export function parseUnbcLine(line: string): { packet?: NirsPacket; loadCell?: number } {
  const values = line
    .trim()
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
  if (values.length < 4) return {};
  const rawByteLine = looksLikeRawByteLine(values);
  const packet = rawByteLine
    ? ([
        twoBytesToUint16(values[0], values[1]),
        twoBytesToUint16(values[2], values[3]),
        twoBytesToUint16(values[4], values[5]),
        twoBytesToUint16(values[6], values[7]),
        0,
        0,
        0,
        0,
      ] as NirsPacket)
    : ([values[0], values[1], values[2], values[3], 0, 0, 0, 0] as NirsPacket);
  return { packet, loadCell: values.length > (rawByteLine ? 8 : 4) ? values.at(-1) : undefined };
}

export function parseLoadCellLine(line: string) {
  const values = line
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(Number.isFinite);
  return values.at(-1);
}

export class BrowserSerialAcquisition {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private abort = false;
  private streaming = false;
  private loadCellTime = 0;
  private readonly deviceKind: DeviceKind;
  private readonly loadCellTimePerPacket: number;
  private readonly onPacket: PacketCallback;
  private readonly onError?: ErrorCallback;

  constructor(
    deviceKind: DeviceKind,
    loadCellTimePerPacket: number,
    onPacket: PacketCallback,
    onError?: ErrorCallback,
  ) {
    this.deviceKind = deviceKind;
    this.loadCellTimePerPacket = loadCellTimePerPacket;
    this.onPacket = onPacket;
    this.onError = onError;
  }

  async connect() {
    const serial = (navigator as NavigatorWithSerial).serial;
    if (!serial) throw new Error("Web Serial is not available in this browser.");
    this.port = await serial.requestPort();
    await this.port.open(
      this.deviceKind === "unbc"
        ? { baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" }
        : { baudRate: 115200 },
    );
    this.reader = this.port.readable?.getReader() ?? null;
    this.writer = this.port.writable?.getWriter() ?? null;
  }

  getPortLabel() {
    return serialPortLabel(this.port);
  }

  async start() {
    if (!this.reader) throw new Error("Serial port is not connected.");
    if (this.streaming) return;
    this.abort = false;
    this.streaming = true;
    if (this.deviceKind === "unbc") {
      await this.writeText("1111");
      void this.readUnbc();
    } else {
      await this.writeBytes([212]);
      void this.readPathonix();
    }
  }

  async stop() {
    if (!this.streaming) return;
    this.abort = true;
    this.streaming = false;
    if (this.deviceKind === "unbc") {
      await this.writeText("2");
    } else {
      await this.writeBytes([213, 213]);
    }
  }

  async disconnect() {
    await this.stop().catch(() => undefined);
    await this.reader?.cancel().catch(() => undefined);
    this.reader?.releaseLock();
    this.writer?.releaseLock();
    await this.port?.close().catch(() => undefined);
    this.reader = null;
    this.writer = null;
    this.port = null;
  }

  private async writeBytes(bytes: number[]) {
    await this.writer?.write(new Uint8Array(bytes));
  }

  private async writeText(text: string) {
    await this.writeBytes(Array.from(text).map((char) => char.charCodeAt(0)));
  }

  private async readPathonix() {
    let buffer: number[] = [];
    try {
      while (!this.abort && this.reader) {
        const { done, value } = await this.reader.read();
        if (done) break;
        buffer = buffer.concat(Array.from(value));
        const complete = buffer.length - (buffer.length % 16);
        for (const packet of pathonixBytesToPackets(buffer.slice(0, complete))) {
          this.onPacket(packet);
        }
        buffer = buffer.slice(complete);
      }
    } catch (error) {
      if (!this.abort) this.onError?.(error instanceof Error ? error : new Error("Pathonix read failed"));
    } finally {
      this.streaming = false;
    }
  }

  private async readUnbc() {
    const decoder = new TextDecoder();
    let textBuffer = "";
    try {
      while (!this.abort && this.reader) {
        const { done, value } = await this.reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        const lines = textBuffer.split(/\r?\n/);
        textBuffer = lines.pop() ?? "";
        for (const line of lines) {
          const parsed = parseUnbcLine(line);
          if (parsed.packet) {
            const loadCell =
              parsed.loadCell === undefined
                ? undefined
                : { time: this.loadCellTime, value: parsed.loadCell };
            if (loadCell) this.loadCellTime += this.loadCellTimePerPacket;
            this.onPacket(parsed.packet, loadCell);
          }
        }
      }
    } catch (error) {
      if (!this.abort) this.onError?.(error instanceof Error ? error : new Error("UNBC read failed"));
    } finally {
      this.streaming = false;
    }
  }
}

export class BrowserLoadCellSerial {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private abort = false;
  private streaming = false;
  private loadCellTime = 0;
  private readonly timePerPacket: number;
  private readonly onPoint: LoadCellCallback;
  private readonly onError?: ErrorCallback;

  constructor(timePerPacket: number, onPoint: LoadCellCallback, onError?: ErrorCallback) {
    this.timePerPacket = timePerPacket;
    this.onPoint = onPoint;
    this.onError = onError;
  }

  async connect() {
    const serial = (navigator as NavigatorWithSerial).serial;
    if (!serial) throw new Error("Web Serial is not available in this browser.");
    this.port = await serial.requestPort();
    await this.port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" });
    this.reader = this.port.readable?.getReader() ?? null;
    this.writer = this.port.writable?.getWriter() ?? null;
  }

  getPortLabel() {
    return serialPortLabel(this.port);
  }

  async start() {
    if (!this.reader) throw new Error("Load-cell serial port is not connected.");
    if (this.streaming) return;
    this.abort = false;
    this.streaming = true;
    await this.writeText("start\n");
    void this.readLines();
  }

  async disconnect() {
    this.abort = true;
    if (this.streaming) {
      this.streaming = false;
      await this.writeText("stop\n").catch(() => undefined);
    }
    await this.reader?.cancel().catch(() => undefined);
    this.reader?.releaseLock();
    this.writer?.releaseLock();
    await this.port?.close().catch(() => undefined);
    this.reader = null;
    this.writer = null;
    this.port = null;
  }

  private async writeText(text: string) {
    await this.writer?.write(new TextEncoder().encode(text));
  }

  private async readLines() {
    const decoder = new TextDecoder();
    let textBuffer = "";
    try {
      while (!this.abort && this.reader) {
        const { done, value } = await this.reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        const lines = textBuffer.split(/\r?\n/);
        textBuffer = lines.pop() ?? "";
        for (const line of lines) {
          const value = parseLoadCellLine(line);
          if (value === undefined) continue;
          this.onPoint({ time: this.loadCellTime, value });
          this.loadCellTime += this.timePerPacket;
        }
      }
    } catch (error) {
      if (!this.abort) this.onError?.(error instanceof Error ? error : new Error("Load-cell read failed"));
    } finally {
      this.streaming = false;
    }
  }
}
