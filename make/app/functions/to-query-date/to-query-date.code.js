function toQueryDate(value) {
  const isDate = Object.prototype.toString.call(value) === '[object Date]';
  if (!isDate && (typeof value !== 'string' || value === '')) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date.toISOString();
}
