/** Application logging port accepting structured context and a message. */
export interface ILogger {
	info(obj: object, msg: string): void;
	error(obj: object, msg: string): void;
	warn(obj: object, msg: string): void;
}
