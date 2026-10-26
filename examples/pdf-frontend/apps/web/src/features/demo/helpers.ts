export const str = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
export const num = (d: FormData, k: string) => Number(d.get(k));
export const attachmentName = (d: FormData, key = 'attachment') => {
  const f = d.get(key);
  return f instanceof File ? f.name : '';
};
