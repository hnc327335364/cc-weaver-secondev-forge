import { lstat, open, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const value of data) crc = CRC_TABLE[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// 使用标准 ZIP32/UTF-8/deflate，在 Windows 和 macOS 上均无需系统 zip/unzip。
export async function writePortableZip(root, output) {
  const files = [];
  let uncompressedBytes = 0;
  async function collect(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const filename = path.join(directory, name);
      const info = await lstat(filename);
      if (info.isSymbolicLink()) throw new Error("ZIP 不接受符号链接");
      if (info.isDirectory()) await collect(filename);
      else if (info.isFile()) {
        const relative = path.relative(root, filename).split(path.sep).join("/");
        if (/[\x00-\x1f\\]/.test(relative) || relative.startsWith("../") || path.isAbsolute(relative))
          throw new Error("ZIP 文件路径不合法");
        uncompressedBytes += info.size;
        if (info.size > 256 * 1024 * 1024 || uncompressedBytes > 1024 * 1024 * 1024 || files.length >= 65534)
          throw new Error("ZIP 超出本地打包大小或文件数量上限");
        files.push({ filename, relative });
      } else throw new Error("ZIP 只允许普通文件");
    }
  }
  await collect(root);
  const stream = await open(output, "wx");
  const central = [];
  let offset = 0;
  // FileHandle.write 不承诺每次写完；循环处理部分写入，防止产物静默截断。
  async function write(data) {
    for (let position = 0; position < data.length;) {
      const { bytesWritten } = await stream.write(data, position, data.length - position, null);
      if (!bytesWritten) throw new Error("ZIP 写入未取得进展");
      position += bytesWritten;
      offset += bytesWritten;
    }
  }
  try {
    for (const file of files) {
      const name = Buffer.from(file.relative, "utf8"), data = await readFile(file.filename);
      if (name.length > 65535 || data.length > 256 * 1024 * 1024) throw new Error("ZIP 条目超出上限");
      const compressed = deflateRawSync(data);
      const checksum = crc32(data), start = offset;
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8);
      header.writeUInt16LE(33, 12); // 固定 DOS 日期 1980-01-01，避免本机时区差异。
      header.writeUInt32LE(checksum, 14);
      header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22);
      header.writeUInt16LE(name.length, 26);
      await write(header); await write(name); await write(compressed);
      const entry = Buffer.alloc(46);
      entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4);
      header.copy(entry, 6, 4, 30);
      entry.writeUInt32LE(start, 42);
      central.push(entry, name);
    }
    const centralStart = offset;
    for (const entry of central) await write(entry);
    const centralSize = offset - centralStart, end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(centralStart, 16);
    await write(end);
    await stream.sync();
  } finally {
    await stream.close();
  }
  return files.map(file => file.relative);
}
