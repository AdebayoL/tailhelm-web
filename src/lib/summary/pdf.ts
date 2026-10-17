/**
 * A plain PDF of text: A4 pages in Helvetica, one of the fonts every PDF
 * reader has, so nothing is embedded and no library is needed. Text is
 * written in Windows-1252, which covers English and the accented letters of
 * most European names; any other character prints as "?".
 */

export type Run = { text: string; bold?: boolean };

export type Block =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "line"; runs: Run[]; indent?: boolean; muted?: boolean; gap?: boolean };

export type PdfInput = {
  /** The document's title, as a PDF reader shows it. */
  title: string;
  /** Printed at the foot of every page, before the page number. */
  footer: string;
  blocks: Block[];
};

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { side: 56, top: 56, bottom: 64 };
const FOOT_Y = 36;
const INDENT = 14;
const STYLE = {
  title: { size: 18, leading: 24, before: 0 },
  heading: { size: 12, leading: 16, before: 18 },
  line: { size: 10, leading: 14, before: 0 },
  foot: { size: 8 },
};
const MUTED = 0.4;
const RULE = 0.82;

// Helvetica and Helvetica-Bold widths, in thousandths of the font size, for characters 32 to 126.
// prettier-ignore
const REGULAR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
// prettier-ignore
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
/** Windows-1252 punctuation and symbols above 127: [regular, bold]. */
const SPECIAL: Record<number, [number, number]> = {
  0x80: [556, 556], 0x85: [1000, 1000], 0x91: [222, 278], 0x92: [222, 278], 0x93: [333, 500], 0x94: [333, 500],
  0x95: [350, 350], 0x96: [556, 556], 0x97: [1000, 1000], 0xa0: [278, 278], 0xa3: [556, 556], 0xb0: [400, 400],
  0xb7: [278, 278], 0xd7: [584, 584],
};
/** Windows-1252 bytes 128 to 159 that are not Latin-1. */
const CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
  "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

/** The text as Windows-1252 bytes, one per character of the result, keeping line breaks. */
export function toWinAnsi(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if (code === 9) out += " ";
    else if (code === 10) out += "\n";
    else if ((code >= 32 && code <= 126) || (code >= 0xa0 && code <= 0xff)) out += ch;
    else if (CP1252[ch]) out += String.fromCharCode(CP1252[ch]);
    else out += "?";
  }
  return out;
}

function charWidth(code: number, bold: boolean): number {
  if (code >= 32 && code <= 126) return (bold ? BOLD : REGULAR)[code - 32];
  const special = SPECIAL[code];
  if (special) return special[bold ? 1 : 0];
  // An accented letter is about as wide as the letter itself.
  const base = String.fromCharCode(code).normalize("NFD").charCodeAt(0);
  if (base >= 32 && base <= 126) return (bold ? BOLD : REGULAR)[base - 32];
  return bold ? 611 : 556;
}

/** The width of Windows-1252 text, in points. */
export function textWidth(text: string, bold: boolean, size: number): number {
  let w = 0;
  for (let i = 0; i < text.length; i++) w += charWidth(text.charCodeAt(i), bold);
  return (w * size) / 1000;
}

type Piece = { text: string; bold: boolean };

/**
 * Lays the runs out in lines no wider than `max`, breaking between words, and
 * inside a word only when it is wider than a whole line. A newline in the text
 * starts a new line.
 */
export function wrap(runs: Run[], max: number, size: number): Piece[][] {
  const lines: Piece[][] = [];
  let line: Piece[] = [];
  let width = 0;
  let space: Piece | null = null;
  const add = (p: Piece) => {
    const last = line[line.length - 1];
    if (last && last.bold === p.bold) last.text += p.text;
    else line.push({ ...p });
    width += textWidth(p.text, p.bold, size);
  };
  const breakLine = () => {
    lines.push(line);
    line = [];
    width = 0;
    space = null;
  };

  for (const run of runs) {
    const bold = !!run.bold;
    for (const token of toWinAnsi(run.text.replace(/\r\n?/g, "\n")).match(/\n|[^\S\n]+|[^\s]+/g) ?? []) {
      if (token === "\n") {
        breakLine();
      } else if (/^\s+$/.test(token)) {
        if (line.length > 0) space = { text: " ", bold };
      } else {
        let word = token;
        const spaceWidth = space ? textWidth(space.text, space.bold, size) : 0;
        if (line.length > 0 && width + spaceWidth + textWidth(word, bold, size) > max) breakLine();
        if (space) add(space);
        space = null;
        // A word wider than a whole line starts its own line and is split at the edge.
        while (textWidth(word, bold, size) > max) {
          if (line.length > 0) breakLine();
          let fit = 1;
          while (fit < word.length && textWidth(word.slice(0, fit + 1), bold, size) <= max) fit++;
          add({ text: word.slice(0, fit), bold });
          word = word.slice(fit);
          breakLine();
        }
        if (word) add({ text: word, bold });
      }
    }
  }
  if (line.length > 0 || lines.length === 0) lines.push(line);
  return lines;
}

/** A PDF string literal of Windows-1252 text. */
function literal(text: string): string {
  let out = "(";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const ch = text[i];
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (code < 32 || code > 126) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += ch;
  }
  return `${out})`;
}

/** A PDF text string for the document's metadata, in UTF-16 so any name survives. */
function utf16(text: string): string {
  let hex = "FEFF";
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

const fixed = (n: number) => String(Math.round(n * 100) / 100);

function drawText(x: number, y: number, size: number, pieces: Piece[], gray: number): string {
  if (pieces.length === 0) return "";
  const parts = pieces.map((p) => `/${p.bold ? "F2" : "F1"} ${size} Tf ${literal(p.text)} Tj`);
  return `BT ${fixed(gray)} g ${fixed(x)} ${fixed(y)} Td ${parts.join(" ")} ET\n`;
}

/** The pages' drawing instructions, one string per page. */
function layout(blocks: Block[], footer: string): string[] {
  const pages: string[] = [];
  let page = "";
  const top = PAGE.height - MARGIN.top;
  let y = top;
  const left = MARGIN.side;
  const right = PAGE.width - MARGIN.side;
  const newPage = () => {
    pages.push(page);
    page = "";
    y = top;
  };
  const room = (height: number) => y - height >= MARGIN.bottom;

  for (const block of blocks) {
    if (block.kind === "line") {
      const { size, leading } = STYLE.line;
      const x = left + (block.indent ? INDENT : 0);
      const lines = wrap(block.runs, right - x, size);
      if (block.gap && y < top) y -= leading / 2;
      for (const l of lines) {
        if (!room(leading)) newPage();
        page += drawText(x, y - size, size, l, block.muted ? MUTED : 0);
        y -= leading;
      }
      continue;
    }
    const style = STYLE[block.kind];
    const lines = wrap([{ text: block.text, bold: true }], right - left, style.size);
    // A heading never sits alone at the foot of a page.
    const before = y < top ? style.before : 0;
    if (!room(before + style.leading * lines.length + STYLE.line.leading * 2)) newPage();
    else y -= before;
    if (block.kind === "heading" && y < top) page += `${fixed(RULE)} G 0.6 w ${fixed(left)} ${fixed(y + 6)} m ${fixed(right)} ${fixed(y + 6)} l S\n`;
    for (const l of lines) {
      page += drawText(left, y - style.size, style.size, l, 0);
      y -= style.leading;
    }
    if (block.kind === "title") y -= 4;
  }
  pages.push(page);

  const foot = toWinAnsi(footer);
  return pages.map((content, i) => {
    const number = `Page ${i + 1} of ${pages.length}`;
    const size = STYLE.foot.size;
    const numberX = right - textWidth(number, false, size);
    const footWidth = numberX - left - 16;
    const footPieces = wrap([{ text: foot }], footWidth, size)[0];
    return (
      content +
      drawText(left, FOOT_Y, size, footPieces, MUTED) +
      drawText(numberX, FOOT_Y, size, [{ text: number, bold: false }], MUTED)
    );
  });
}

/** The PDF file's bytes. */
export function renderPdf(input: PdfInput, created = new Date()): Uint8Array<ArrayBuffer> {
  const pages = layout(input.blocks, input.footer);
  const objects: string[] = [];
  /** Adds an object and returns its number. */
  const add = (body: string) => objects.push(body);

  const catalog = add("");
  const tree = add("");
  const regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const stamp = created.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const info = add(`<< /Title ${utf16(input.title)} /Producer (Tailhelm) /CreationDate (D:${stamp}Z) >>`);
  const kids = pages.map((content) => {
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    return add(
      `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
        `/Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${stream} 0 R >>`,
    );
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objects[tree - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  // Every character is one byte, so string lengths are byte offsets.
  let file = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets = objects.map((body, i) => {
    const at = file.length;
    file += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) file += `${String(at).padStart(10, "0")} 00000 n \n`;
  file += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(file.length);
  for (let i = 0; i < file.length; i++) bytes[i] = file.charCodeAt(i);
  return bytes;
}
