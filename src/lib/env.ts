export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? '온라인 재고관리 Agent',
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
  appStage: process.env.NEXT_PUBLIC_APP_STAGE ?? 'v0.9',
} as const;
