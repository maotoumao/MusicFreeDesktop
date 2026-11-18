import { NodeLogger } from './src';

declare const Logger: NodeLogger & {
  default: NodeLogger;
};
export = Logger;
