// The .xlsx writer in the browser: the same parts as the server's (./xlsxParts.ts), deflated with the browser's own
// CompressionStream - or stored as they are where a browser has none (a larger file, the same workbook). A Datatracker
// export no longer travels to the server: a big table is far over the 8 KB request body the firewall lets through
// (31.10.2026, best selling products: "Export failed (HTTP 403)").

import { xlsxFiles, zip, type Sheet, type ZipEntry } from "./xlsxParts";

async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw" as CompressionFormat));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null; // a browser without deflate-raw: stored instead
  }
}

export async function xlsxBlob(sheets: Sheet[]): Promise<Blob> {
  const entries: ZipEntry[] = [];
  for (const f of xlsxFiles(sheets)) {
    const comp = await deflateRaw(f.data);
    entries.push(comp ? { ...f, comp, method: 8 } : { ...f, comp: f.data, method: 0 });
  }
  return new Blob([zip(entries) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
