// Jest mock for @sentry/nextjs.
// The real SDK initializes browser tracing at import time, which requires a
// Next.js router and breaks in jsdom. Tests only need the capture APIs to be
// callable no-ops.
export const init = jest.fn();
export const captureException = jest.fn();
export const captureMessage = jest.fn();
export const captureEvent = jest.fn();
export const addBreadcrumb = jest.fn();
export const setTag = jest.fn();
export const setExtra = jest.fn();
export const setUser = jest.fn();
export const withScope = jest.fn((callback) =>
  callback({ setTag: jest.fn(), setExtra: jest.fn() })
);
