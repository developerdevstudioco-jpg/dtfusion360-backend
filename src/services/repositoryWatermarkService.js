const fs = require("fs")
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib")

const CONTROLLED_COPY_LABEL = "CONTROLLED COPY"
const FOOTER_HEIGHT = 24
const FOOTER_HORIZONTAL_PADDING = 12
const FONT_SIZE = 9

function extendBoxDown(box, footerHeight) {
  return {
    x: box.x,
    y: box.y - footerHeight,
    width: box.width,
    height: box.height + footerHeight,
  }
}

async function addControlledCopyFooter(sourceBytes) {
  const pdf = await PDFDocument.load(sourceBytes)
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  const textWidth = font.widthOfTextAtSize(CONTROLLED_COPY_LABEL, FONT_SIZE)

  for (const page of pdf.getPages()) {
    const mediaBox = page.getMediaBox()
    const cropBox = page.getCropBox()
    const footerBox = extendBoxDown(cropBox, FOOTER_HEIGHT)
    const mediaBottom = Math.min(mediaBox.y, footerBox.y)
    const mediaTop = mediaBox.y + mediaBox.height

    // Extend the page instead of painting over document content. This creates
    // guaranteed white footer space even when the source page has no margin.
    page.setMediaBox(mediaBox.x, mediaBottom, mediaBox.width, mediaTop - mediaBottom)
    page.setCropBox(footerBox.x, footerBox.y, footerBox.width, footerBox.height)
    page.drawRectangle({
      x: footerBox.x,
      y: footerBox.y,
      width: footerBox.width,
      height: FOOTER_HEIGHT,
      color: rgb(1, 1, 1),
    })
    page.drawText(CONTROLLED_COPY_LABEL, {
      x: footerBox.x + footerBox.width - FOOTER_HORIZONTAL_PADDING - textWidth,
      y: footerBox.y + (FOOTER_HEIGHT - FONT_SIZE) / 2,
      size: FONT_SIZE,
      font,
      color: rgb(0.75, 0.04, 0.04),
    })
  }

  return Buffer.from(await pdf.save())
}

async function watermarkControlledPdf(filePath) {
  return addControlledCopyFooter(await fs.promises.readFile(filePath))
}

module.exports = {
  CONTROLLED_COPY_LABEL,
  FOOTER_HEIGHT,
  addControlledCopyFooter,
  watermarkControlledPdf,
}
