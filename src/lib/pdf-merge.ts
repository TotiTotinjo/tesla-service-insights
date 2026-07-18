import { PDFDocument } from "pdf-lib";

/**
 * Merge multiple PDF byte arrays into one document, preserving input order.
 * Uses Uint8Array (not Node Buffer) so this works on Cloudflare Workers.
 */
export async function mergePdfBuffers(buffers: Uint8Array[]): Promise<{
  buffer: Uint8Array;
  pageCount: number;
}> {
  if (buffers.length === 0) {
    throw new Error("No PDFs to merge.");
  }

  if (buffers.length === 1) {
    const doc = await loadPdf(buffers[0], 0);
    return {
      buffer: buffers[0],
      pageCount: doc.getPageCount(),
    };
  }

  const merged = await PDFDocument.create();
  let pageCount = 0;

  for (let i = 0; i < buffers.length; i++) {
    const src = await loadPdf(buffers[i], i);
    const indices = src.getPageIndices();
    const pages = await merged.copyPages(src, indices);
    for (const page of pages) {
      merged.addPage(page);
    }
    pageCount += pages.length;
  }

  const bytes = await merged.save();
  return {
    buffer: new Uint8Array(bytes),
    pageCount,
  };
}

async function loadPdf(
  buffer: Uint8Array,
  index: number
): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(buffer, {
      ignoreEncryption: false,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    throw new Error(
      `Could not read PDF #${index + 1}. It may be corrupted or password-protected (${reason}).`
    );
  }
}
