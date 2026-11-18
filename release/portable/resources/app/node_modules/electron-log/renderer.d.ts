import { RendererLogger } from './src';

declare const Logger: RendererLogger & {
  default: RendererLogger;
};
export = Logger;
