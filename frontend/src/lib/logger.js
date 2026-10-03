/**
 * Frontend leveled logger.
 * Silent in production, active in development.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

export const logger = {
  info: (...args) => {
    if (!IS_PROD) console.log(...args);
  },
  warn: (...args) => {
    if (!IS_PROD) console.warn(...args);
  },
  error: (...args) => {
    if (!IS_PROD) console.error(...args);
  },
  debug: (...args) => {
    if (!IS_PROD) console.debug(...args);
  },
};
