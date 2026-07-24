import { BoardProfile } from '../types/ai';

const profiles: Record<string, BoardProfile> = {
  'esp32-c3': {
    id: 'esp32-c3',
    name: 'ESP32-C3',
    manufacturer: 'Espressif',
    category: 'WiFi+BLE SoC',
    default_serial: {
      baud_rate: 115200,
      data_bits: 'Eight',
      parity: 'None',
      stop_bits: 'One',
    },
    protocol: {
      type: 'AT command',
      line_ending: '\r\n',
      response_ok: 'OK',
      response_error: 'ERROR',
    },
    at_commands: {
      'AT': '测试连接',
      'AT+GMR': '查询固件版本',
      'AT+RST': '重启模块',
      'AT+CWMODE=1': '设置 Station 模式',
      'AT+CWMODE=2': '设置 AP 模式',
      'AT+CWLAP': '扫描 WiFi 列表',
      'AT+CWJAP="SSID","PWD"': '连接 WiFi',
      'AT+CIFSR': '查询 IP 地址',
      'AT+CIPSTART="TCP","host",port': '建立 TCP 连接',
      'AT+CIPSEND=len': '发送 TCP 数据',
      'AT+CIPSERVER=1,80': '创建 TCP Server',
      'AT+UART_DEF=115200,8,1,0,0': '配置串口参数',
    },
    debug_tips: [
      '上电时 GPIO9 拉低进入下载模式',
      '默认波特率 115200，高速下载可达 1500000',
      'AT 指令以 \\r\\n 结尾',
      'WiFi 连接需要等待 STA 启动完成',
    ],
    common_issues: [
      {
        symptom: '发送 AT 无响应',
        causes: ['波特率不匹配', 'TX/RX 接反', '未共地', '模块未上电'],
        solutions: ['尝试 9600/115200', '交换 TX/RX', '确认 GND 连接', '检查 3.3V 供电'],
      },
      {
        symptom: 'WiFi 连接失败',
        causes: ['SSID/密码错误', '信号太弱', '不支持 5GHz', '未设置 Station 模式'],
        solutions: ['确认 2.4GHz WiFi', '检查密码', 'AT+CWMODE=1', '靠近路由器'],
      },
    ],
  },
  'arduino-uno': {
    id: 'arduino-uno',
    name: 'Arduino Uno',
    manufacturer: 'Arduino',
    category: 'AVR 开发板',
    default_serial: {
      baud_rate: 9600,
      data_bits: 'Eight',
      parity: 'None',
      stop_bits: 'One',
    },
    protocol: {
      type: 'Serial text',
      line_ending: '\n',
    },
    debug_tips: [
      '默认 bootloader 使用 115200 波特率',
      '上传程序时按复位键',
      'Serial.begin() 后需等待 1-2 秒',
      'D0/RX 和 D1/TX 用于串口通信',
    ],
    common_issues: [
      {
        symptom: '上传失败',
        causes: ['未选择正确端口', '未选择正确板卡', 'bootloader 损坏', 'USB 线缆问题'],
        solutions: ['检查端口和板卡设置', '重新烧录 bootloader', '更换 USB 线', '按复位键'],
      },
      {
        symptom: '串口无输出',
        causes: ['波特率不匹配', 'TX/RX 接反', '代码未调用 Serial.begin()', 'USB 芯片故障'],
        solutions: ['匹配波特率', '检查接线', '添加 Serial.begin(9600)', '更换板卡'],
      },
    ],
  },
  'stm32-f4': {
    id: 'stm32-f4',
    name: 'STM32F4xx',
    manufacturer: 'STMicroelectronics',
    category: 'ARM Cortex-M4 MCU',
    default_serial: {
      baud_rate: 115200,
      data_bits: 'Eight',
      parity: 'None',
      stop_bits: 'One',
    },
    protocol: {
      type: 'Serial text / Modbus RTU',
      line_ending: '\r\n',
    },
    debug_tips: [
      'USART1_TX=PA9, USART1_RX=PA10',
      '进入 ISP 模式：BOOT0=1 后复位',
      'STM32CubeProgrammer 支持串口烧录',
      '支持 SWD 调试 (PA13/SWDIO, PA14/SWCLK)',
    ],
    common_issues: [
      {
        symptom: '无法连接',
        causes: ['BOOT 引脚配置错误', '复位电路异常', 'SWD 接口被禁用', '电源不稳定'],
        solutions: ['检查 BOOT0/BOOT1', '检查复位引脚', '解除 RDP 保护', '检查 3.3V 供电'],
      },
      {
        symptom: '程序不运行',
        causes: ['时钟配置错误', '堆栈溢出', '中断向量表偏移', 'Flash 写保护'],
        solutions: ['检查 HSE/HSE 配置', '增大堆栈', '配置 SCB->VTOR', '解除写保护'],
      },
    ],
  },
  'esp8266': {
    id: 'esp8266',
    name: 'ESP8266 (NodeMCU)',
    manufacturer: 'Espressif',
    category: 'WiFi SoC',
    default_serial: {
      baud_rate: 115200,
      data_bits: 'Eight',
      parity: 'None',
      stop_bits: 'One',
    },
    protocol: {
      type: 'AT command / Arduino',
      line_ending: '\r\n',
      response_ok: 'OK',
      response_error: 'ERROR',
    },
    at_commands: {
      'AT': '测试连接',
      'AT+GMR': '查询版本',
      'AT+RST': '重启',
      'AT+CWMODE=1': 'Station 模式',
      'AT+CWJAP="SSID","PWD"': '连接 WiFi',
      'AT+CIFSR': '查询 IP',
      'AT+CIPSTART="TCP","host",port': 'TCP 连接',
      'AT+CIPSEND=n': '发送数据',
    },
    debug_tips: [
      '默认波特率 115200，部分固件为 9600',
      'GPIO0 拉低进入下载模式',
      '需外接 3.3V 稳压器（板载 AMS1117）',
      'CH340/CP2102 USB 转串口芯片',
    ],
    common_issues: [
      {
        symptom: '启动乱码',
        causes: ['波特率不对（启动信息 74880）', '电源不足', '晶振频率偏移'],
        solutions: ['尝试 74880 查看启动日志', '使用 3.3V 供电', '更换模块'],
      },
    ],
  },
  'imx6ull': {
    id: 'imx6ull',
    name: 'i.MX6ULL',
    manufacturer: 'NXP',
    category: 'ARM Cortex-A7 应用处理器',
    default_serial: {
      baud_rate: 115200,
      data_bits: 'Eight',
      parity: 'None',
      stop_bits: 'One',
    },
    protocol: {
      type: 'Linux console / U-Boot',
      line_ending: '\r\n',
    },
    debug_tips: [
      '调试串口 UART1_TX:AD01, UART1_RX:AD00',
      '进入 U-Boot：上电时按复位键',
      '支持 TFTP 启动和 NFS 根文件系统',
      'Device Tree 配置在 arch/arm/boot/dts/',
    ],
    common_issues: [
      {
        symptom: 'U-Boot 无输出',
        causes: ['BOOT 模式配置错误', 'DDR 初始化失败', '串口参数不匹配'],
        solutions: ['检查 BOOT_CFG 引脚', '检查 DDR 配置', '确认 115200 8N1'],
      },
    ],
  },
  'riscv-k210': {
    id: 'riscv-k210',
    name: 'K210 (RISC-V)',
    manufacturer: 'Kendryte',
    category: 'RISC-V AIoT SoC',
    default_serial: {
      baud_rate: 115200,
      data_bits: 'Eight',
      parity: 'None',
      stop_bits: 'One',
    },
    protocol: {
      type: 'Serial command / MicroPython',
      line_ending: '\r\n',
    },
    debug_tips: [
      '双核 RISC-V 64位，带 KPU 神经网络加速器',
      '支持 MicroPython 和 C 开发',
      'JTAG 调试需要 OpenOCD',
      'DVP 接口连接摄像头',
    ],
    common_issues: [
      {
        symptom: '无法启动',
        causes: ['Crystal 频率配置错误', 'Flash 固件损坏', '供电不足'],
        solutions: ['重新烧录固件', '检查 1.8V/3.3V 供电', '使用 kflash 工具'],
      },
    ],
  },
  'rp2040': {
    id: 'rp2040',
    name: 'Raspberry Pi Pico (RP2040)',
    manufacturer: 'Raspberry Pi',
    category: 'Dual Cortex-M0+ MCU',
    default_serial: {
      baud_rate: 115200,
      data_bits: 'Eight',
      parity: 'None',
      stop_bits: 'One',
    },
    protocol: {
      type: 'MicroPython REPL / USB CDC',
      line_ending: '\r\n',
    },
    debug_tips: [
      '按住 BOOTSEL 插入 USB 进入下载模式',
      'USB 串口和 SWD 调试均支持',
      'MicroPython: 串口直接 REPL 交互',
      'SWD: GP26(SWDIO), GP27(SWCLK)',
    ],
    common_issues: [
      {
        symptom: 'USB 不识别',
        causes: ['线缆问题', '驱动未安装', 'BOOTSEL 未按住'],
        solutions: ['更换数据线', '安装驱动', '按住 BOOTSEL 插入'],
      },
    ],
  },
};

export function getAllBoardProfiles(): BoardProfile[] {
  return Object.values(profiles);
}

export function getBoardProfile(id: string): BoardProfile | undefined {
  return profiles[id];
}

export function detectBoardProfile(
  portInfo: { manufacturer?: string; product?: string; vid?: number; pid?: number }
): BoardProfile | null {
  const text = `${portInfo.manufacturer || ''} ${portInfo.product || ''}`.toLowerCase();
  const vid = portInfo.vid;
  const pid = portInfo.pid;

  if (vid === 0x10c4 && pid === 0xea60) return profiles['esp32-c3'];
  if (vid === 0x1a86 && pid === 0x7523) return profiles['esp32-c3'];
  if (vid === 0x0403 && pid === 0x6001) return profiles['stm32-f4'];
  if (vid === 0x2341) return profiles['arduino-uno'];
  if (vid === 0x239a) return profiles['rp2040'];
  if (text.includes('ch340') || text.includes('ch341')) return profiles['esp8266'];
  if (text.includes('cp210')) return profiles['esp32-c3'];
  if (text.includes('stm32') || text.includes('stlink')) return profiles['stm32-f4'];
  if (text.includes('jlink')) return profiles['stm32-f4'];
  if (text.includes('usb serial')) return profiles['arduino-uno'];

  return null;
}
