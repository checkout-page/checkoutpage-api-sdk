export const fakeObjectId = (seed: string) =>
  seed
    .toLowerCase()
    .replace(/[^a-f0-9]/g, 'a')
    .padEnd(24, '0')
    .slice(0, 24);

export const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
