export {};

declare global {
  interface Navigator {
    setAppBadge?(contents?: number): Promise<void>;
    clearAppBadge?(): Promise<void>;
  }

  interface WorkerNavigator {
    setAppBadge?(contents?: number): Promise<void>;
    clearAppBadge?(): Promise<void>;
  }
}
