type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  logLevel: LogLevel;
  enableTimestamps: boolean;
  enableCallerInfo: boolean;
  enableColors: boolean;
  transports: Transport[];
  humanReadableTimestamp: boolean;
}

interface Transport {
  log: (level: LogLevel, message: string, meta: LogMeta) => void;
}

interface LogMeta {
  timestamp: string;
  callerInfo: string;
  optionalParams: any[];
}

class ConsoleTransport implements Transport {
  log(level: LogLevel, message: string, meta: LogMeta): void {
    const colorStyles: { [key in LogLevel]: string } = {
      debug: 'color: gray;',
      info: 'color: blue;',
      warn: 'color: orange;',
      error: 'color: red;',
    };

    const levelStr = level.toUpperCase();
    const { timestamp, callerInfo, optionalParams } = meta;
    const colorStyle = Log.getInstance().config.enableColors ? colorStyles[level] : '';

    console.log(
      `%c${levelStr}%c [${timestamp}] [${callerInfo}]:\n\n${message}`,
      colorStyle,
      'color: default;',
      ...optionalParams
    );
  }
}

class Log {
  private static instance: Log;
  private logQueue: { level: LogLevel; message: string; meta: LogMeta }[] = [];
  private isProcessing: boolean = false;

  private static logLevels: { [key in LogLevel]: number } = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private constructor(public config: LoggerConfig) {}

  public static getInstance(): Log {
    if (!Log.instance) {
      Log.instance = new Log({
        logLevel: (process.env.LOG_LEVEL as LogLevel) || 'debug',
        enableTimestamps: true,
        enableCallerInfo: true,
        enableColors: true,
        transports: [new ConsoleTransport()],
        humanReadableTimestamp: true,
      });
    }
    return Log.instance;
  }

  public configure(options: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...options };
  }

  public addTransport(transport: Transport): void {
    this.config.transports.push(transport);
  }

  private shouldLog(level: LogLevel): boolean {
    const env = process.env.NODE_ENV;
    if (env === 'production') {
      return false; // Disable logging in production
    }
    return Log.logLevels[level] >= Log.logLevels[this.config.logLevel];
  }

  private getCallerInfo(): string {
    if (!this.config.enableCallerInfo) {
      return 'caller info disabled';
    }

    try {
      const error = new Error();
      const stack = error.stack?.split('\n');
      if (stack && stack.length > 3) {
        const callerStackLine = stack[3];
        const match =
          callerStackLine.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) ||
          callerStackLine.match(/at\s+(.*):(\d+):(\d+)/);

        if (match) {
          const functionName = match[1].trim();
          const filePath = match[2];
          const lineNumber = match[3];
          return `${functionName} (${filePath}:${lineNumber})`;
        }
      }
    } catch (e) {
      console.error('Error getting caller info', e);
    }
    return 'unknown';
  }

  private getTimestamp(): string {
    if (!this.config.enableTimestamps) {
      return 'timestamp disabled';
    }

    const now = new Date();

    if (this.config.humanReadableTimestamp) {
      return now.toLocaleString(); // e.g., "3/15/2024, 2:30:45 PM"
    } else {
      return now.toISOString(); // e.g., "2024-03-15T14:30:45.123Z"
    }
  }

  private enqueueLog(level: LogLevel, message: string, optionalParams: any[]): void {
    const meta: LogMeta = {
      timestamp: this.getTimestamp(),
      callerInfo: this.getCallerInfo(),
      optionalParams,
    };

    this.logQueue.push({ level, message, meta });
    setTimeout(() => this.processQueue(), 0);
  }

  private processQueue(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.logQueue.length) {
      const logEntry = this.logQueue.shift();
      if (logEntry) {
        const { level, message, meta } = logEntry;
        this.config.transports.forEach((transport) =>
          transport.log(level, message, meta)
        );
      }
    }

    this.isProcessing = false;
  }

  // Logging methods
  public debug(message: string, ...optionalParams: any[]): Log {
    if (this.shouldLog('debug')) {
      this.enqueueLog('debug', message, optionalParams);
    }
    return this;
  }

  public info(message: string, ...optionalParams: any[]): Log {
    if (this.shouldLog('info')) {
      this.enqueueLog('info', message, optionalParams);
    }
    return this;
  }

  public warn(message: string, ...optionalParams: any[]): Log {
    if (this.shouldLog('warn')) {
      this.enqueueLog('warn', message, optionalParams);
    }
    return this;
  }

  public error(message: string, ...optionalParams: any[]): Log {
    if (this.shouldLog('error')) {
      this.enqueueLog('error', message, optionalParams);
    }
    return this;
  }
}

const Logger = Log.getInstance();
export default Logger;
