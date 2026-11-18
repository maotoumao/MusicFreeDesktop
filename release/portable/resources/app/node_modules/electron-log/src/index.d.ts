import { ClientRequest, RequestOptions } from 'http';
import { InspectOptions } from 'util';

declare namespace Logger {
  type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug' |
    'silly';
  type LevelOption = LogLevel | false;

  interface FormatParams {
    data: any[];
    level: LogLevel;
    logger: Logger;
    message: LogMessage;
    transport: Transport;
  }

  type Format = string | ((params: FormatParams) => any[]);

  type FOpenFlags = 'r' | 'r+' | 'rs+' | 'w' | 'wx' | 'w+' | 'wx+' |
    'a' | 'ax' | 'a+' | 'ax+';

  type Hook = (
    message: LogMessage,
    transport?: Transport,
    transportName?: string,
  ) => LogMessage | false;

  interface Variables {
    processType: string;

    [name: string]: any;
  }

  type TransformFn = (options: {
    data: any[],
    message: LogMessage,
    transport: Transport,
    logger: Logger
  }) => any[];

  interface LogMessage {
    /**
     * Any arguments passed to a log function
     */
    data: any[];

    /**
     * When the log entry was created
     */
    date: Date;

    /**
     * From error to silly
     */
    level: LogLevel;

    /**
     * Id of Logger instance
     */
    logId?: string;

    /**
     * Message scope label
     */
    scope?: string;

    /**
     * Variables used by formatter
     */
    variables?: Variables;
  }

  interface Transport {
    (message: LogMessage): void;

    /**
     * Messages with level lower than will be dropped
     */
    level: LevelOption;

    transforms: TransformFn[];
  }

  interface ConsoleTransport extends Transport {
    /**
     * String template of function for message serialization
     */
    format: Format | string;

    /**
     * Use styles even if TTY isn't attached
     */
    useStyles: boolean;

    /**
     * Override message printing
     */
    writeFn(options: { message: LogMessage }): void;
  }

  interface PathVariables {
    /**
     * Per-user application data directory, which by default points to:
     * %APPDATA% on Windows
     * $XDG_CONFIG_HOME or ~/.config on Linux
     * ~/Library/Application Support on macOS
     */
    readonly appData: string;

    /**
     * Application name from productName or name of package.json
     */
    readonly appName: string;

    /**
     * Application version from package.json
     */
    readonly appVersion: string;

    /**
     * app.getPath('logs'). May be unavailable in old versions
     */
    readonly electronDefaultDir?: string;

    /**
     * Name of the log file without path
     */
    readonly fileName?: string;

    /**
     * User's home directory
     */
    readonly home: string;

    /**
     * userData + /logs/ + fileName on Linux and Windows
     * ~/Library/Logs/ + appName + / + fileName on macOS
     */
    readonly libraryDefaultDir: string;

    /**
     * Same as libraryDefaultDir, but contains '{appName}' template instead
     * of the real application name
     */
    readonly libraryTemplate: string;

    /**
     * OS temporary path
     */
    readonly tempDir: string;

    /**
     * The directory for storing your app's configuration files, which by
     * default it is the appData directory appended with your app's name.
     */
    readonly userData: string;
  }

  interface WriteOptions {
    /**
     * Default 'a'
     */
    flag?: FOpenFlags;

    /**
     * Default 0666
     */
    mode?: number;

    /**
     * Default 'utf8'
     */
    encoding?: string;
  }

  interface LogFile {
    /**
     * Full log file path
     */
    readonly path: string;

    /**
     * How many bytes were written since transport initialization
     */
    readonly bytesWritten: number;

    /**
     * Current file size
     */
    readonly size: number;

    /**
     * Clear the log file
     */
    clear(): boolean;

    /**
     * Emitted when there was some error while saving log file
     */
    on(event: 'error', listener: (error: Error, file: this) => void): this;
  }

  interface FileTransport extends Transport {
    /**
     * Deprecated alias of archiveLogFn
     * @deprecated
     */
    archiveLog: (oldLogFile: LogFile) => void;

    /**
     * Function which is called on log rotation. You can override it if you need
     * custom log rotation behavior. This function should remove old file
     * synchronously
     */
    archiveLogFn: (oldLogFile: LogFile) => void;

    /**
     * How deep to serialize complex objects
     * Deprecated in favor of inspectOptions
     * @deprecated
     */
    depth: number;

    /**
     * Filename without path, main.log (or renderer.log) by default
     */
    fileName: string;

    /**
     * String template of function for message serialization
     */
    format: Format | string;

    /**
     * Return the current log file instance
     * You only need to provide message argument if you define log path inside
     * resolvePath callback depending on a message.
     */
    getFile(message?: Partial<LogMessage>): LogFile;

    /**
     * Serialization options
     * @link https://nodejs.org/api/util.html#util_util_inspect_object_options
     */
    inspectOptions: InspectOptions;

    /**
     * Maximum size of log file in bytes, 1048576 (1mb) by default. When a log
     * file exceeds this limit, it will be moved to log.old.log file and the
     * current file will be cleared. You can set it to 0 to disable rotation
     */
    maxSize: number;

    /**
     * Reads content of all log files
     */
    readAllLogs(
      options?: { fileFilter?: (logPath: string) => boolean },
    ): Array<{ path: string, lines: string[] }>;

    /**
     * Alias for resolvePathFn
     * @deprecated
     */
    resolvePath: (variables: PathVariables, message?: LogMessage) => string;

    /**
     * Allow to change log file path dynamically
     */
    resolvePathFn: (variables: PathVariables, message?: LogMessage) => string;

    /**
     * Override appName used for resolving log path
     * @param appName
     */
    setAppName(appName: string): void;

    /**
     * Whether to write a log file synchronously. Default to true
     */
    sync: boolean;

    /**
     * Options used when writing a file
     */
    writeOptions?: WriteOptions;
  }

  interface RemoteTransport extends Transport {
    /**
     * Client information which will be sent in each request together with
     * a message body
     */
    client?: object;

    /**
     * How deep to serialize complex objects
     */
    depth?: number;

    /**
     * Additional options for the HTTP request
     */
    requestOptions?: RequestOptions;

    /**
     * Callback which is called on request error
     */
    processErrorFn: (error: Error) => void;

    /**
     * Callback which transforms request body to string
     */
    makeBodyFn: (
      options: { logger: Logger, message: LogMessage, transport: Transport },
    ) => any;

    /**
     * Callback which allows to customize request sending
     */
    sendRequestFn: (
      options: { serverUrl: string, requestOptions: RequestOptions, body: any }
    ) => ClientRequest;

    /**
     * Server URL
     */
    url: string;
  }

  interface MainTransports {
    /**
     * Writes logs to console
     */
    console: ConsoleTransport;

    /**
     * Writes logs to a file
     */
    file: FileTransport;

    /**
     * Display main process logs in the renderer dev tools console
     */
    ipc: Transport;

    /**
     * Sends a JSON POST request with LogMessage in the body to the specified url
     */
    remote: RemoteTransport;

    [key: string]: Transport | null;
  }

  interface RendererTransports {
    /**
     * Writes logs to console
     */
    console: ConsoleTransport;

    /**
     * Communicates with a main process logger
     */
    ipc: Transport;

    [key: string]: Transport | null;
  }

  interface Scope {
    (label: string): LogFunctions;

    /**
     * Label for log message without scope. If set to false and scope isn't
     * set, no padding is used
     */
    defaultLabel: string | false;

    /**
     * Pad scope label using spaces
     * false: disabled
     * true: automatically
     * number: set exact maximum label length. Helpful when a scope can
     * be created after some log messages were sent
     */
    labelPadding: boolean | number;
  }

  interface ReportData {
    body: string;
    title: string;

    assignee: string;
    labels: string;
    milestone: string;
    projects: string;
    template: string;
  }

  interface LogFunctions {
    /**
     * Log an error message
     */
    error(...params: any[]): void;

    /**
     * Log a warning message
     */
    warn(...params: any[]): void;

    /**
     * Log an informational message
     */
    info(...params: any[]): void;

    /**
     * Log a verbose message
     */
    verbose(...params: any[]): void;

    /**
     * Log a debug message
     */
    debug(...params: any[]): void;

    /**
     * Log a silly message
     */
    silly(...params: any[]): void;

    /**
     * Shortcut to info
     */
    log(...params: any[]): void;
  }

  interface ErrorHandlerOptions {
    /**
     * Default true for the main process. Set it to false to prevent showing a
     * default electron error dialog
     */
    showDialog?: boolean;

    /**
     * Attach a custom error handler. If the handler returns false, this error
     * will not be processed
     */
    onError?(options: {
      createIssue: (url: string, data: ReportData | any) => void,
      error: Error,
      errorName: 'Unhandled' | 'Unhandled rejection',
      processType: 'browser' | 'renderer',
      versions: { app: string; electron: string; os: string },
    }): void;
  }

  interface MainErrorHandlerOptions extends ErrorHandlerOptions {
    /**
     * Attach a custom error handler. If the handler returns false, this error
     * will not be processed
     */
    onError?(options: {
      createIssue: (url: string, data: ReportData | any) => void,
      error: Error,
      errorName: 'Unhandled' | 'Unhandled rejection',
      processType: 'browser' | 'renderer',
      versions: { app: string; electron: string; os: string },
    }): void;
  }

  interface RendererErrorHandlerOptions extends ErrorHandlerOptions {
    /**
     * Attach a custom error handler. If the handler returns false, this error
     * will not be processed
     */
    onError?(options: {
      error: Error,
      errorName: 'Unhandled' | 'Unhandled rejection',
      processType: 'browser' | 'renderer',
    }): void;

    /**
     * By default, error and unhandledrejection handlers call preventDefault to
     * prevent error duplicating in console. Set false to disable it
     */
    preventDefault?: boolean;
  }

  interface ErrorHandler<T = ErrorHandlerOptions> {
    /**
     * Process an error by the ErrorHandler
     */
    handle(error: Error, options?: T): void;

    /**
     * Change some options
     */
    setOptions(options: T): void;

    /**
     * Start catching unhandled errors and rejections
     */
    startCatching(options?: T): void;

    /**
     * Stop catching unhandled errors and rejections
     */
    stopCatching(): void;
  }

  type EventSource = 'app' | 'webContents';

  interface EventFormatterInput {
    args: unknown[];
    event: object;
    eventName: string;
    eventSource: string;
  }

  interface EventLoggerOptions {
    /**
     * String template or function which prepares event data for logging
     */
    format?: string | ((input: EventFormatterInput) => unknown[]);

    /**
     * Formatter callbacks for a specific event
     */
    formatters?: Record<
      EventSource,
      Record<string, (input: EventFormatterInput) => object | unknown[]>
    >;

    /**
     * Allow switching specific events on/off easily
     */
    events?: Record<EventSource, Record<string, boolean>>;

    /**
     * Which log level is used for logging. Default warn
     */
    level?: LogLevel;

    /**
     * Which log scope is used for logging. Default '' (none)
     */
    scope?: string;
  }

  interface EventLogger extends Required<EventLoggerOptions> {
    setOptions(options: EventLoggerOptions): void;
    startLogging(options?: EventLoggerOptions): void;
    stopLogging(): void;
  }

  interface Logger extends LogFunctions {
    /**
     * Error handling helper
     */
    errorHandler: ErrorHandler;

    /**
     * Object contained only log functions
     */
    functions: LogFunctions;

    /**
     * Array with all attached hooks
     */
    hooks: Hook[];

    /**
     * Array with all available levels
     */
    levels: string[];

    /**
     * ID of the current logger instance
     */
    logId: string;

    /**
     * Create a new scope
     */
    scope: Scope;

    /**
     * Transport instances
     */
    transports: { [key: string]: Transport | null; };

    /**
     * Variables used by formatters
     */
    variables: Variables;

    /**
     * Add a custom log level
     */
    addLevel(level: string, index?: number): void;

    /**
     * Catch and log unhandled errors/rejected promises
     * @deprecated
     */
    catchErrors(options?: ErrorHandlerOptions): ErrorHandler;

    /**
     * Create a new electron-log instance
     */
    create(options: { logId: string }): this;

    /**
     * Low level method which logs the message using specified transports
     */
    processMessage(
      message: LogMessage,
      options?: { transports?: Transport[] | string[] },
    ): void;
  }

  interface NodeLogger extends Logger {
    errorHandler: ErrorHandler<MainErrorHandlerOptions>;
    eventLogger: EventLogger;
    transports: MainTransports;
  }

  interface MainLogger extends NodeLogger {
    initialize(
      options?: {
        getSessions?: () => object[];
        includeFutureSessions?: boolean;
        preload?: string | boolean;
        spyRendererConsole?: boolean;
      },
    ): void;
  }

  interface RendererLogger extends Logger {
    errorHandler: ErrorHandler<RendererErrorHandlerOptions>;
    transports: RendererTransports;
  }
}

// Merge namespace with interface
declare const Logger: Logger.MainLogger & {
  default: Logger.MainLogger;
};
export = Logger;

declare global {
  const __electronLog: Logger.LogFunctions;
  interface Window {
    __electronLog: Logger.LogFunctions;
  }
}

