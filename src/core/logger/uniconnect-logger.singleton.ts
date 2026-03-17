export class UniconnectLogger {

  private static instance: UniconnectLogger;

  private constructor() {
    console.log('UniconnectLogger inicializado - Instancia única creada con 6 niveles estándar');
  }

  public static getInstance(): UniconnectLogger {
    if (!UniconnectLogger.instance) {
      UniconnectLogger.instance = new UniconnectLogger();
    }
    return UniconnectLogger.instance;
  }

  public trace(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[TRACE] ${timestamp} - ${message}`);
  }

  public debug(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[DEBUG] ${timestamp} - ${message}`);
  }

  public info(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[INFO] ${timestamp} - ${message}`);
  }

  public warn(message: string): void {
    const timestamp = new Date().toISOString();
    console.warn(`[WARN] ${timestamp} - ${message}`);
  }

  public error(message: string, trace?: string): void {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR] ${timestamp} - ${message}`);
    if (trace) {
      console.error(`[ERROR] ${timestamp} - Stack Trace: ${trace}`);
    }
  }

  public fatal(message: string, trace?: string): void {
    const timestamp = new Date().toISOString();
    console.error(`[FATAL] ${timestamp} - ${message}`);
    if (trace) {
      console.error(`[FATAL] ${timestamp} - Stack Trace: ${trace}`);
    }
  }
}