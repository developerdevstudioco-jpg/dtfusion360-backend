const test = require("node:test")
const assert = require("node:assert/strict")
const { PDFDocument, StandardFonts, decodePDFRawStream, PDFRawStream } = require("pdf-lib")
const {
  CONTROLLED_COPY_LABEL,
  FOOTER_HEIGHT,
  addControlledCopyFooter,
} = require("../src/services/repositoryWatermarkService")

function decodedStreams(pdf) {
  const streams = []
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream) streams.push(Buffer.from(decodePDFRawStream(object).decode()).toString("latin1"))
  }
  return streams.join("\n")
}

function pdfHex(text) {
  return Buffer.from(text, "ascii").toString("hex").toUpperCase()
}

test("adds CONTROLLED COPY in a new footer band without covering PDF content", async () => {
  const source = await PDFDocument.create()
  const page = source.addPage([300, 200])
  const font = await source.embedFont(StandardFonts.Helvetica)
  page.drawText("CONTENT AT ORIGINAL BOTTOM", { x: 8, y: 2, size: 8, font })

  const watermarkedBytes = await addControlledCopyFooter(await source.save())
  const watermarked = await PDFDocument.load(watermarkedBytes)
  const [outputPage] = watermarked.getPages()
  const cropBox = outputPage.getCropBox()

  assert.equal(watermarked.getPageCount(), 1)
  assert.equal(cropBox.y, -FOOTER_HEIGHT)
  assert.equal(cropBox.height, 200 + FOOTER_HEIGHT)
  assert.match(decodedStreams(watermarked), new RegExp(pdfHex("CONTENT AT ORIGINAL BOTTOM")))
  assert.match(decodedStreams(watermarked), new RegExp(pdfHex(CONTROLLED_COPY_LABEL)))
})

test("preserves every page and adds the footer to each one", async () => {
  const source = await PDFDocument.create()
  source.addPage([612, 792])
  source.addPage([792, 612])

  const watermarked = await PDFDocument.load(await addControlledCopyFooter(await source.save()))

  assert.equal(watermarked.getPageCount(), 2)
  for (const page of watermarked.getPages()) {
    assert.equal(page.getCropBox().y, -FOOTER_HEIGHT)
  }
})
