export function sniffAudioType(buf: Buffer): string {
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    return 'audio/wav';
  }
  if (buf.length >= 4 && buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) {
    return 'audio/flac';
  }
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'OggS') {
    return 'audio/ogg';
  }
  if (buf.length >= 3 && buf.toString('ascii', 0, 3) === 'ID3') {
    return 'audio/mpeg';
  }
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    return 'audio/mp4';
  }
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'audio/webm';
  }
  return 'application/octet-stream';
}
