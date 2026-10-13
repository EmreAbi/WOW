/**
 * Independent, read-only audit against the supplied PowerPoint source.
 * Run: node scripts/verify-content.mjs [path/to/WoW_Retail_Hikaye_Atlasi.pptx]
 * Uses only Node built-ins; does not call or reuse the extraction script.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = process.argv[2] || join(homedir(), 'Downloads', 'WoW_Retail_Hikaye_Atlasi.pptx')
const atlas = JSON.parse(readFileSync(join(root, 'src/data/atlas.json'), 'utf8'))
const catalog = JSON.parse(readFileSync(join(root, 'src/data/catalog.json'), 'utf8'))
const original = readFileSync(sourcePath)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const expectedSourceHash = 'ee90e70d030485032c92af437e2173611bab0bd07686fd356713342058f86aeb'
assert.equal(sha256(original), expectedSourceHash, 'The audit requires the original, unmodified supplied PPTX')
assert.equal(atlas.source.sha256, expectedSourceHash, 'Source provenance differs from the supplied PPTX')

// Read ZIP central-directory sizes, including archives using data descriptors.
// This deck uses ordinary ZIP entries (stored or DEFLATE), not ZIP64/encryption.
function readZip(buffer) {
  let end = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break }
  }
  assert.ok(end >= 0, 'PPTX ZIP central directory is missing')
  const entries = new Map()
  const count = buffer.readUInt16LE(end + 10)
  let offset = buffer.readUInt32LE(end + 16)
  for (let i = 0; i < count; i += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50, 'Invalid ZIP entry')
    const flags = buffer.readUInt16LE(offset + 8)
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const local = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    assert.equal(flags & 1, 0, `Encrypted ZIP entry: ${name}`)
    assert.equal(buffer.readUInt32LE(local), 0x04034b50, `Invalid local header: ${name}`)
    const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)
    assert.ok(method === 0 || method === 8, `Unsupported ZIP method: ${name}`)
    const data = method === 8 ? inflateRawSync(compressed) : compressed
    assert.equal(data.length, uncompressedSize, `ZIP size mismatch: ${name}`)
    entries.set(name, data)
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

// These bounded matchers read OOXML paragraph and table elements in this fixed,
// SHA-256-identified source; they are not a general-purpose XML parser.
function decodeXml(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
  return text.replace(/\r\n?/g, '\n').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16))
    if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)))
    return named[entity]
  })
}
function elements(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'g'))].map(m => m[1])
}
function paragraphs(xml) {
  return elements(xml, 'a:p').map(para => [...para.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\b[^>]*\/?\s*>/g)]
    .map(token => token[1] === undefined ? '\n' : decodeXml(token[1])).join('')).filter(text => text.trim())
}
function multiset(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1)
  return [...counts].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
}
function publicFile(src) {
  assert.ok(src.startsWith('/'), `Asset must use a root-relative path: ${src}`)
  const publicRoot = join(root, 'public')
  const file = resolve(publicRoot, src.slice(1))
  assert.ok(file.startsWith(publicRoot + sep), `Asset escapes public directory: ${src}`)
  assert.ok(statSync(file).isFile(), `Missing image: ${src}`)
  return file
}

const zip = readZip(original)
const sourceSlides = [...zip.keys()].filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
  .sort((a, b) => Number(a.match(/slide(\d+)\.xml/)[1]) - Number(b.match(/slide(\d+)\.xml/)[1]))
assert.equal(sourceSlides.length, 327, 'Expected 327 original slides')
assert.equal(atlas.slides.length, 327, 'All source slides must be available to the reader')
assert.equal(atlas.source.slideCount, 327)
assert.equal(catalog.slideCount, 327)
assert.equal(catalog.slides.length, 327)

const expectedChapters = [
  ['giris', -1, 1, 4], ['onsoz', 0, 5, 13], ['vanilla', 1, 14, 31],
  ['the-burning-crusade', 2, 32, 48], ['wrath-of-the-lich-king', 3, 49, 64],
  ['cataclysm', 4, 65, 87], ['mists-of-pandaria', 5, 88, 110],
  ['warlords-of-draenor', 6, 111, 130], ['legion', 7, 131, 153],
  ['battle-for-azeroth', 8, 154, 180], ['shadowlands', 9, 181, 210],
  ['dragonflight', 10, 211, 239], ['the-war-within', 11, 240, 267],
  ['midnight', 12, 268, 303], ['the-last-titan', 13, 304, 312],
  ['butun-resim', 14, 313, 325], ['kaynaklar', 15, 326, 327],
]
assert.deepEqual(atlas.chapters.map(c => [c.id, c.index, c.start, c.end]), expectedChapters)
assert.deepEqual(catalog.chapters, atlas.chapters, 'Landing catalog must expose the exact reader chapters')
for (let i = 0; i < atlas.chapters.length; i += 1) {
  const chapter = atlas.chapters[i]
  assert.equal(chapter.start, i ? atlas.chapters[i - 1].end + 1 : 1, 'Chapter ranges must be contiguous')
  assert.ok(chapter.end >= chapter.start)
  if (chapter.coverImage) publicFile(chapter.coverImage)
}
assert.equal(atlas.chapters.at(-1).end, 327, 'Final reference slide must be reachable')

let paragraphCount = 0
let nonDecorativeCount = 0
let tableCount = 0
let cellCount = 0
let noteCount = 0
const groupIds = new Set()
for (let i = 0; i < 327; i += 1) {
  const page = i + 1
  const slide = atlas.slides[i]
  const xml = zip.get(sourceSlides[i]).toString('utf8')
  const originalParagraphs = paragraphs(xml)
  assert.equal(sourceSlides[i], `ppt/slides/slide${page}.xml`)
  assert.equal(slide.number, page, 'Slides must remain sequential')
  assert.equal(slide.id, `sayfa-${page}`)
  assert.deepEqual(slide.paragraphs, originalParagraphs, `Page ${page}: changed or missing original paragraphs`)
  assert.deepEqual(multiset(slide.groups.flatMap(g => g.texts)), multiset(originalParagraphs), `Page ${page}: grouped reader content loses or duplicates paragraphs`)
  assert.equal(slide.groups.filter(g => g.role === 'title').flatMap(g => g.texts).join('\n'), slide.title)
  assert.equal(slide.chapterId, atlas.chapters.find(c => page >= c.start && page <= c.end)?.id)
  assert.deepEqual(catalog.slides[i], { number: page, title: slide.title, chapterId: slide.chapterId }, `Page ${page}: catalog points to different content`)
  for (const group of slide.groups) {
    assert.ok(!groupIds.has(group.id), `Duplicate group identity: ${group.id}`)
    groupIds.add(group.id)
    assert.ok(['title', 'body', 'table', 'kicker', 'chapterNumber', 'pageNumber'].includes(group.role))
    assert.ok(group.texts.length > 0)
    if (!['pageNumber', 'chapterNumber'].includes(group.role)) nonDecorativeCount += group.texts.length
  }
  const originalTables = elements(xml, 'a:tbl').map(table => elements(table, 'a:tr')
    .map(row => elements(row, 'a:tc').map(cell => paragraphs(cell).join('\n'))))
  const readerTables = slide.groups.filter(g => g.role === 'table').map(g => g.tableRows)
  assert.deepEqual(readerTables, originalTables, `Page ${page}: table rows, columns, or cells differ from PowerPoint`)
  tableCount += originalTables.length
  cellCount += originalTables.flat(2).length
  paragraphCount += originalParagraphs.length
  noteCount += slide.notes.length
  const notesXml = zip.get(`ppt/notesSlides/notesSlide${page}.xml`)
  if (notesXml) {
    const notesSource = notesXml.toString('utf8')
    assert.deepEqual(slide.notesRaw, paragraphs(notesSource), `Page ${page}: raw speaker notes changed`)
    const meaningfulNotes = elements(notesSource, 'p:sp').filter(shape => {
      const type = shape.match(/<p:ph\b[^>]*\btype="([^"]+)"/)?.[1]
      return !['sldNum', 'hdr', 'ftr', 'dt'].includes(type)
    }).flatMap(shape => paragraphs(shape))
    assert.deepEqual(slide.notes, meaningfulNotes, `Page ${page}: meaningful speaker note changed or was omitted`)
  }
  for (const image of slide.images) publicFile(image.src)
}

assert.equal(paragraphCount, 5664, 'Expected every one of the 5664 original nonempty paragraphs')
assert.equal(atlas.source.paragraphCount, paragraphCount)
assert.equal(nonDecorativeCount, 5323, 'Non-decorative source paragraphs must all remain available')
assert.equal(tableCount, 45, 'Expected all 45 native PowerPoint tables')
assert.equal(atlas.source.tableCount, tableCount)
assert.equal(cellCount, 1326, 'Expected all 1326 table cells in source order')
assert.equal(noteCount, 1, 'The meaningful speaker note must be retained')
assert.equal(atlas.source.noteParagraphCount, noteCount)
assert.equal(groupIds.size, 3556)

const sourceImages = [...zip.keys()].filter(name => name.startsWith('ppt/media/') && !name.endsWith('/'))
assert.equal(sourceImages.length, 405)
assert.equal(atlas.images.length, sourceImages.length, 'All original embedded images must be present')
assert.equal(atlas.source.imageCount, sourceImages.length)
assert.equal(new Set(atlas.images.map(image => image.src)).size, 405, 'Image paths must remain unique')
for (const image of atlas.images) {
  const sourceBytes = zip.get(`ppt/media/${image.name}`)
  assert.ok(sourceBytes, `Image was not in the original PPTX: ${image.name}`)
  const outputBytes = readFileSync(publicFile(image.src))
  assert.deepEqual(outputBytes, sourceBytes, `Original image bytes changed: ${image.src}`)
  assert.equal(outputBytes.length, image.bytes)
  assert.equal(sha256(outputBytes), image.sha256)
}
for (const thread of catalog.threads) publicFile(thread.image)

console.log(`PASS: 327 slides; 17 contiguous chapters; ${paragraphCount} verbatim paragraphs (${nonDecorativeCount} non-decorative); ${tableCount} tables / ${cellCount} cells; ${sourceImages.length} byte-identical images; ${noteCount} meaningful note.`)
console.log('PASS: Reader groups, paragraph multisets, chapter boundaries, landing catalog, asset paths, and original source SHA-256 verified independently.')
