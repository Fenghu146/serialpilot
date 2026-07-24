export interface PortInfo {
  port_name: string;
  port_type: string;
  pid?: number;
  vid?: number;
  serial_number?: string;
  manufacturer?: string;
  product?: string;
}

export interface PortConfig {
  baud_rate: number;
  data_bits: "Five" | "Six" | "Seven" | "Eight";
  stop_bits: "One" | "Two";
  parity: "None" | "Odd" | "Even" | "Mark" | "Space";
  flow_control: "None" | "Software" | "Hardware";
}

export type WriteMode = "Text" | "Hex";

export interface LogEntry {
  timestamp: string;
  direction: "TX" | "RX";
  data: string;
  is_hex: boolean;
}

export interface ConnectionStatus {
  connected: boolean;
  port_name: string;
  config: PortConfig;
  bytes_sent: number;
  bytes_received: number;
}

export const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
export const DATA_BITS_OPTIONS = ["5", "6", "7", "8"];
export const STOP_BITS_OPTIONS = ["1", "2"];
export const PARITY_OPTIONS = [
  { label: "None", value: "None" },
  { label: "Odd", value: "Odd" },
  { label: "Even", value: "Even" },
  { label: "Mark", value: "Mark" },
  { label: "Space", value: "Space" },
];
export const FLOW_CONTROL_OPTIONS = [
  { label: "None", value: "None" },
  { label: "Software", value: "Software" },
  { label: "Hardware", value: "Hardware" },
];
