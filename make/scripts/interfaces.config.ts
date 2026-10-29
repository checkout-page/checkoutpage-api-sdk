export interface Target {
  module: string;
  method: 'GET';
  path: string;
  items: boolean;
  wrap?: { event: true; key: string; recoveryUrl?: boolean };
}

export const targets: Target[] = [];
