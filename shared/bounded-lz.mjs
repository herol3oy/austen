// LZ-String URI bitstream decoder, compatible with lz-string 1.5.0.
// The decoded character budget is checked before appending dictionary entries.
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';
export function decompressShare(input, limit = 40000) {
  const text = input.replace(/ /g, '+'); let offset = 0;
  function bits(count) {
    let value = 0;
    for (let i = 0; i < count; i++) {
      if (offset >= text.length * 6) throw new Error('Truncated compressed share');
      const code = alphabet.indexOf(text[Math.floor(offset / 6)]);
      if (code < 0 || code > 63) throw new Error('Invalid compressed character');
      value |= ((code >> (5 - offset % 6)) & 1) << i; offset++;
    }
    return value;
  }
  const first = bits(2); if (first === 2) return ''; if (first > 1) throw new Error('Invalid compressed share');
  let previous = String.fromCharCode(bits(first === 0 ? 8 : 16));
  const dictionary = [null, null, null, previous], output = [previous];
  let width = 3, remaining = 4, size = 1;
  for (;;) {
    let code = bits(width);
    if (code === 2) return output.join('');
    if (code === 0 || code === 1) { dictionary.push(String.fromCharCode(bits(code === 0 ? 8 : 16))); code = dictionary.length - 1; remaining--; }
    if (remaining === 0) { remaining = 2 ** width; width++; }
    const entry = dictionary[code] ?? (code === dictionary.length ? previous + previous[0] : null);
    if (entry === null) throw new Error('Invalid compressed dictionary');
    size += entry.length; if (size > limit) throw new Error('Decoded share exceeds size limit');
    output.push(entry); dictionary.push(previous + entry[0]); remaining--; previous = entry;
    if (remaining === 0) { remaining = 2 ** width; width++; }
  }
}
