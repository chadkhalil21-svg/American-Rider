// Stitch two overlapping phone screenshots into one full-page image.
// Finds the vertical offset where the lower capture's top band matches the upper capture,
// so the seam is exact rather than guessed.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

func load(_ p: String) -> CGImage {
    let url = URL(fileURLWithPath: p) as CFURL
    let src = CGImageSourceCreateWithURL(url, nil)!
    return CGImageSourceCreateImageAtIndex(src, 0, nil)!
}
func pixels(_ img: CGImage) -> ([UInt8], Int, Int) {
    let w = img.width, h = img.height
    var buf = [UInt8](repeating: 0, count: w*h*4)
    let cs = CGColorSpaceCreateDeviceRGB()
    let ctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8,
                        bytesPerRow: w*4, space: cs,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    return (buf, w, h)
}
let args = CommandLine.arguments
let outPath = args[1]
// statusH: rows at the top of each capture that belong to the status bar, not the page.
let statusH = Int(args[2]) ?? 0
let inputs = Array(args[3...])

func join(_ top: CGImage, _ bot: CGImage) -> CGImage {
let (tp, w, th) = pixels(top)
let (bp, _, bh) = pixels(bot)

// Match a band from just under the bottom capture's status bar against the top capture.
let bandH = 240
let bandY = statusH + 20
func rowDiff(_ ty: Int, _ by: Int) -> Int64 {
    var d: Int64 = 0
    var x = 0
    while x < w {
        let ti = (ty*w + x)*4, bi = (by*w + x)*4
        d += Int64(abs(Int(tp[ti]) - Int(bp[bi])))
        x += 3
    }
    return d
}
var bestOffset = -1
var bestScore = Int64.max
var cand = statusH
while cand < th - bandH {
    // NO EARLY BREAK. Abandoning a candidate part-way and then comparing its partial score
    // with another candidate's complete score is comparing two different quantities: the
    // first stitch of the operator page chose a run of blank paper that way and silently
    // dropped the ledger card and the projection model out of the middle of the page.
    var score: Int64 = 0
    var k = 0
    while k < bandH {
        score += rowDiff(cand + k, bandY + k)
        k += 2
    }
    if score < bestScore { bestScore = score; bestOffset = cand }
    cand += 1
}
guard bestOffset > statusH else {
    fputs("no seam: these two captures do not overlap — scroll less between them\n", stderr)
    exit(1)
}
// The stitched page: the whole top capture down to the seam, then the bottom capture
// from its own status bar onward.
let keepTop = bestOffset - bandY + statusH
let outH = keepTop + (bh - statusH)
let cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: w, height: outH, bitsPerComponent: 8,
                    bytesPerRow: w*4, space: cs,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
// CoreGraphics origin is bottom-left; draw the bottom capture low and the top capture high.
let botCrop = bot.cropping(to: CGRect(x: 0, y: statusH, width: w, height: bh - statusH))!
ctx.draw(botCrop, in: CGRect(x: 0, y: 0, width: w, height: bh - statusH))
let topCrop = top.cropping(to: CGRect(x: 0, y: 0, width: w, height: keepTop))!
ctx.draw(topCrop, in: CGRect(x: 0, y: CGFloat(outH - keepTop), width: CGFloat(w), height: CGFloat(keepTop)))
    fputs("  seam at \(bestOffset), overlap \(th - bestOffset)px, score \(bestScore)\n", stderr)
    return ctx.makeImage()!
}

var page = load(inputs[0])
for next in inputs.dropFirst() {
    page = join(page, load(next))
}
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: outPath) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, page, nil)
CGImageDestinationFinalize(dest)
print("stitched \(page.width)x\(page.height) from \(inputs.count) captures")
