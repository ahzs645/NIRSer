export type DeviceKind = "pathonix" | "unbc";

export type NirsPacket = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type Point = {
  time: number;
  value: number;
};

export type NirsPoint = {
  time: number;
  o2hb: number;
  hhb: number;
  thb: number;
  hbdiff: number;
  /** Tissue Oxygenation Index (%). Derived from both channels, so it is identical on channel1/channel2. */
  toi: number;
};

export type ProcessedNirsSample = {
  time: number;
  channel1: NirsPoint;
  channel2: NirsPoint;
  raw: NirsPacket;
  sourceValues?: number[];
};

export type Section = {
  id: string;
  name: string;
  initialTime: number;
  endTime: number;
};

export type DataInfo = {
  min: Point;
  max: Point;
  average: number;
  slope: number;
  r: number;
  intercept: number;
};

export type ChannelStats = {
  o2hb: DataInfo;
  hhb: DataInfo;
  thb: DataInfo;
  hbdiff: DataInfo;
  toi: DataInfo;
};

export type AnalysisStats = {
  channel1: ChannelStats;
  channel2: ChannelStats;
  loadCell: DataInfo;
};

export type CalculatedValuesSnapshot = {
  id: string;
  sectionName: string;
  initialTime: number;
  endTime: number;
  filterPasses: number;
  filterOrder: number;
  filterCutoff: number;
  calculatedAt: string;
  stats: AnalysisStats;
};

export type SerialEvent = {
  timestamp: string;
  source: "nirs" | "load-cell" | "extra-device";
  event: string;
  detail: string;
};

export type AppSettings = {
  deviceKind: DeviceKind;
  useToi: boolean;
  nirsTimePerPacket: number;
  loadCellTimePerPacket: number;
  nirsFrameRate: number;
  loadCellFrameRate: number;
  loadCellSerialNumber: string;
  loadCellPointsPerSecond: number;
};
