export const fakeObjectId = (seed: string) =>
  seed
    .toLowerCase()
    .replace(/[^a-f0-9]/g, 'a')
    .padEnd(24, '0')
    .slice(0, 24);

export const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createImageFile = (name = 'event-test.png') => {
  const base64Image =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const binaryString = atob(base64Image);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new File([new Blob([bytes], { type: 'image/png' })], name, { type: 'image/png' });
};
