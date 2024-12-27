import { type Request, type Response } from "express";
import { format } from "date-fns";

// Log levels enum
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

// Log entry interface
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
}

class Logger {
  private static formatTimestamp(): string {
    return format(new Date(), "HH:mm:ss.SSS");
  }

  private static log(level: LogLevel, message: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      metadata,
    };

    // Format the log entry
    let logMessage = `${entry.timestamp} [${entry.level}] ${entry.message}`;
    if (entry.metadata) {
      logMessage += `\n${JSON.stringify(entry.metadata, null, 2)}`;
    }

    // Output to console based on level
    switch (level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  static debug(message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  static info(message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.INFO, message, metadata);
  }

  static warn(message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.WARN, message, metadata);
  }

  static error(message: string, error?: Error, metadata?: Record<string, any>) {
    const errorMetadata = error ? {
      ...metadata,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    } : metadata;

    this.log(LogLevel.ERROR, message, errorMetadata);
  }

  static logRequest(req: Request, res: Response, duration: number) {
    const metadata = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };

    this.info(`${req.method} ${req.url}`, metadata);
  }

  static logAPIResponse(path: string, response: any, duration: number) {
    const metadata = {
      path,
      duration: `${duration}ms`,
      response: typeof response === "object" ? response : { data: response },
    };

    this.debug("API Response", metadata);
  }
}

export default Logger;
