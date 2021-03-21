import {WritableStreamBuffer} from 'stream-buffers';
import archiver from 'archiver';

export const zipDirectory = (pathToDir: string): Promise<Buffer> =>
  new Promise<Buffer>((res, rej) => {
    const output = new WritableStreamBuffer();
    const archive = archiver('zip', {
      zlib: {level: 9},
    });
    archive.on('error', rej);
    output.on('error', rej);
    output.on('finish', () => {
      const contents = output.getContents();
      if (contents) res(contents);
      else rej(new Error('No buffer contents'));
    });
    archive.directory(pathToDir, false);
    archive.pipe(output);
    archive.finalize();
  });
