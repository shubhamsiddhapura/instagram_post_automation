import chalk from 'chalk';

function getTimestamp(): string {
  const d = new Date();
  return d.toLocaleTimeString('en-IN', { hour12: false });
}

export class Logger {
  public module: string;

  constructor(moduleName = 'App') {
    this.module = moduleName;
  }

  private _format(levelTag: string, message: string): string {
    const time = chalk.gray(`[${getTimestamp()}]`);
    const mod = chalk.magenta(`[${this.module}]`);
    return `${time} ${mod} ${levelTag} ${message}`;
  }

  public info(msg: string): void {
    console.log(this._format(chalk.cyan('[INFO]'), msg));
  }

  public success(msg: string): void {
    console.log(this._format(chalk.green('[SUCCESS]'), msg));
  }

  public warn(msg: string): void {
    console.warn(this._format(chalk.yellow('[WARN]'), msg));
  }

  public error(msg: string, err?: unknown): void {
    console.error(this._format(chalk.red('[ERROR]'), msg));
    if (err instanceof Error && err.stack) {
      console.error(chalk.red(err.stack));
    } else if (err) {
      console.error(chalk.red(String(err)));
    }
  }

  public static forModule(name: string): Logger {
    return new Logger(name);
  }
}

export default Logger;
