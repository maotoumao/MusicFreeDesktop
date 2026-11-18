import { MainLogger } from './src';

declare const Logger: MainLogger & {
  default: MainLogger;
};
export = Logger;
