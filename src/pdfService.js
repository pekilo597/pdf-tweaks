import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Vite emits the worker as a same-origin asset, avoiding fake-worker and MIME errors.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function readPdf(file) {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1.3, 240 / viewport.width, 310 / viewport.height);
    const scaledViewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(scaledViewport.width);
    canvas.height = Math.ceil(scaledViewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
    pages.push({
      id: crypto.randomUUID(),
      sourceName: file.name,
      sourceBytes: bytes,
      sourcePage: pageNumber - 1,
      rotation: 0,
      thumbnail: canvas.toDataURL('image/jpeg', 0.82),
    });
    page.cleanup();
  }

  await pdf.destroy();
  return pages;
}

export async function buildPdf(pages) {
  const output = await PDFDocument.create();
  const sourceCache = new Map();

  for (const page of pages) {
    let source = sourceCache.get(page.sourceBytes);
    if (!source) {
      source = await PDFDocument.load(page.sourceBytes);
      sourceCache.set(page.sourceBytes, source);
    }
    const [copied] = await output.copyPages(source, [page.sourcePage]);
    const originalRotation = copied.getRotation().angle;
    copied.setRotation(degrees((originalRotation + page.rotation) % 360));
    output.addPage(copied);
  }

  return output.save();
}
