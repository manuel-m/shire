type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export function createLogger(serviceName: string) {
  function log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      service: serviceName,
      level,
      message,
      ...metadata,
    };
    const output = JSON.stringify(entry);
    if (level === 'error') {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  return { log };
}
