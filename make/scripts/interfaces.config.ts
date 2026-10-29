export interface DataSource {
  key: string;
  method: 'GET';
  path: string;
  items: boolean;
}

export interface Target {
  module: string;
  method: 'GET';
  path: string;
  items: boolean;
  exclude?: string[];
  wrap?: { event: true; key?: string; recoveryUrl?: boolean; data?: DataSource[] };
}

export const targets: Target[] = [];
