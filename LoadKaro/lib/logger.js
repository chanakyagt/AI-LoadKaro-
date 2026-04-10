/**
 * Production-safe logger. Only logs in __DEV__ (Expo/Metro dev mode).
 * Use instead of raw console.log/warn throughout the app.
 */

/* global __DEV__ */

export const logger = {
  log: (...args) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    // Always log errors (for crash reporting integrations later)
    console.error(...args);
  },
};
