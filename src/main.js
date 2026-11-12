import { buildPdf, readPdf } from './pdfService.js';
import './style.css';

const fileInput = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const grid = document.querySelector('#page-grid');
const editor = document.querySelector('#editor');
const countLabel = document.querySelector('#page-count');
const status = document.querySelector('#status');
const addButton = document.querySelector('#add-files');
const pages = [];
let draggedId = null;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function parsePageSelection(value, pageCount) {
  const selected = new Set();
  const parts = value.split(',').map((part) => part.trim());
  if (!parts.length || parts.some((part) => !part)) throw new Error('Escribe páginas como "1, 3-5".');

  for (const part of parts) {
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Formato no válido. Usa números y rangos, por ejemplo: 1, 3-5.');
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`El rango "${part}" debe estar entre 1 y ${pageCount}.`);
    }
    for (let page = start; page <= end; page += 1) selected.add(page - 1);
  }
  return [...selected].sort((a, b) => a - b).map((index) => pages[index]);
}

function downloadPdf(selection, filename) {
  return buildPdf(selection).then((bytes) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.replace(/\.pdf$/i, '') || 'documento'}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function render() {
  grid.replaceChildren();
  pages.forEach((page, index) => {
    const card = document.createElement('article');
    card.className = 'page-card';
    card.draggable = true;
    card.dataset.id = page.id;
    card.setAttribute('aria-label', `Página ${index + 1}, ${page.sourceName}`);
    card.innerHTML = `<div class="thumbnail-wrap"><img class="thumbnail" alt="Vista previa de página ${index + 1}" src="${page.thumbnail}" /><span class="page-badge">${index + 1}</span><span class="drag-hint" aria-hidden="true">⠿</span></div><div class="card-meta"><span class="source-icon" aria-hidden="true">▤</span><span class="source-name" title="${escapeHtml(page.sourceName)}">${escapeHtml(page.sourceName)}</span></div><div class="card-actions"><button class="icon-button rotate-button" type="button" aria-label="Rotar página ${index + 1} 90 grados a la derecha" title="Rotar 90°">↻</button><button class="icon-button delete-button" type="button" aria-label="Eliminar página ${index + 1}" title="Eliminar página">×</button></div>`;
    card.querySelector('.rotate-button').addEventListener('click', () => {
      page.rotation = (page.rotation + 90) % 360;
      card.querySelector('.thumbnail').style.transform = `rotate(${page.rotation}deg)`;
      card.querySelector('.thumbnail-wrap').classList.toggle('rotated', page.rotation % 180 !== 0);
    });
    card.querySelector('.delete-button').addEventListener('click', () => { pages.splice(index, 1); render(); });
    card.addEventListener('dragstart', (event) => {
      draggedId = page.id;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', page.id);
    });
    card.addEventListener('dragend', () => {
      draggedId = null;
      card.classList.remove('dragging');
      grid.querySelectorAll('.drag-over').forEach((item) => item.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (event) => { event.preventDefault(); if (page.id !== draggedId) card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      const from = pages.findIndex((item) => item.id === (draggedId || event.dataTransfer.getData('text/plain')));
      const to = pages.findIndex((item) => item.id === page.id);
      if (from < 0 || to < 0 || from === to) return;
      pages.splice(to, 0, pages.splice(from, 1)[0]);
      render();
    });
    grid.append(card);
  });

  const total = pages.length;
  editor.hidden = total === 0;
  dropZone.classList.toggle('compact', total > 0);
  countLabel.textContent = total ? `${total} ${total === 1 ? 'página' : 'páginas'} en el espacio de trabajo` : 'Añade documentos para empezar';
}

async function addFiles(fileList) {
  const files = [...fileList].filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  if (!files.length) return setStatus('Selecciona archivos PDF para continuar.', true);
  addButton.disabled = true;
  setStatus(`Preparando ${files.length === 1 ? 'documento' : `${files.length} documentos`} y creando miniaturas…`);
  try {
    for (const file of files) pages.push(...await readPdf(file));
    render();
    setStatus(`${files.length === 1 ? 'Documento añadido' : 'Documentos añadidos'} correctamente.`);
  } catch (error) {
    console.error(error);
    setStatus('No se pudo leer un archivo. Comprueba que sea un PDF válido y sin contraseña.', true);
  } finally {
    addButton.disabled = false;
    fileInput.value = '';
  }
}

addButton.addEventListener('click', () => fileInput.click());
document.querySelector('#browse-files').addEventListener('click', (event) => { event.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', () => addFiles(fileInput.files));
for (const eventName of ['dragenter', 'dragover']) dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add('is-over');
});
for (const eventName of ['dragleave', 'drop']) dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-over');
});
dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));

document.querySelector('#clear-all').addEventListener('click', () => {
  pages.length = 0;
  document.querySelector('#filename').value = 'documento-unido';
  document.querySelector('#extract-pages').value = '';
  document.querySelector('#extract-filename').value = 'paginas-extraidas';
  render();
  setStatus('Espacio de trabajo vacío. Ya puedes empezar de nuevo.');
});

document.querySelector('#export-pdf').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (!pages.length) return setStatus('Añade al menos una página antes de exportar.', true);
  button.disabled = true;
  setStatus('Uniendo páginas y preparando la descarga…');
  try {
    await downloadPdf(pages, document.querySelector('#filename').value.trim());
    setStatus('El PDF unido está listo y se ha descargado.');
  } catch (error) {
    console.error(error);
    setStatus('No se pudo crear el PDF. Comprueba que los documentos no estén protegidos.', true);
  } finally { button.disabled = false; }
});

document.querySelector('#extract-pdf').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (!pages.length) return setStatus('Añade páginas antes de extraer.', true);
  let selection;
  try { selection = parsePageSelection(document.querySelector('#extract-pages').value, pages.length); }
  catch (error) { return setStatus(error.message, true); }
  button.disabled = true;
  setStatus(`Extrayendo ${selection.length} ${selection.length === 1 ? 'página' : 'páginas'}…`);
  try {
    await downloadPdf(selection, document.querySelector('#extract-filename').value.trim());
    setStatus(`Se descargaron ${selection.length} ${selection.length === 1 ? 'página' : 'páginas'} seleccionadas.`);
  } catch (error) {
    console.error(error);
    setStatus('No se pudieron extraer las páginas seleccionadas.', true);
  } finally { button.disabled = false; }
});

render();
