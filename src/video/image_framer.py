#!/usr/bin/env python3
"""
src/video/image_framer.py

Memory-Optimized Compositing Engine:
- Automatically detects Mataji's sacred red canopy and idols via a lightweight thumbnail preview (<1MB RAM)
- Operates directly at native 1080x1920 Instagram Reel dimensions (saving ~350MB of RAM vs 3375x6000)
- Applies rounded corners, elegant gold border, and soft elevation shadow
- Supports pure Pillow fallback (zero dependency crash risk if numpy is not installed)
- Forces explicit garbage collection to prevent memory spikes on cloud instances (e.g. Render 512MB RAM)
"""

import gc
import sys
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


def detect_darshan_crop_box(darshan_img: Image.Image) -> tuple:
    """
    Detects Mataji's sacred red canopy and murtis using a lightweight downscaled preview.
    Uses less than 1MB of RAM compared to 36MB+ on full-resolution raw array.
    Works seamlessly with NumPy or pure Pillow fallback.
    """
    dw, dh = darshan_img.size

    # Downscale to small 600px preview for fast and memory-safe color detection
    preview_h = 600
    scale = preview_h / float(dh)
    preview_w = max(1, int(dw * scale))
    upper_h = int(preview_h * 0.70)
    col_counts = [0] * preview_w

    thumb = darshan_img.resize((preview_w, preview_h), Image.Resampling.BILINEAR).convert("RGB")

    if HAS_NUMPY:
        arr = np.array(thumb)
        r_dom = (
            (arr[:, :, 0].astype(int) - arr[:, :, 1].astype(int) > 65)
            & (arr[:, :, 0].astype(int) - arr[:, :, 2].astype(int) > 48)
            & (arr[:, :, 0] > 120)
        )
        upper_r = r_dom[:upper_h, :]
        col_counts = np.sum(upper_r, axis=0).tolist()
        del arr, r_dom, upper_r
    else:
        # Pure Pillow fallback (takes ~50ms, requires zero third-party packages)
        pixels = thumb.load()
        for y in range(upper_h):
            for x in range(preview_w):
                r, g, b = pixels[x, y]
                if (r - g > 65) and (r - b > 48) and (r > 120):
                    col_counts[x] += 1

    del thumb
    gc.collect()

    threshold = preview_h * 0.04
    active = [1 if c > threshold else 0 for c in col_counts]

    starts = []
    ends = []
    in_active = False
    for i, val in enumerate(active):
        if val == 1 and not in_active:
            starts.append(i)
            in_active = True
        elif val == 0 and in_active:
            ends.append(i)
            in_active = False
    if in_active:
        ends.append(len(active))

    if starts and ends:
        lengths = [e - s for s, e in zip(starts, ends)]
        best_idx = lengths.index(max(lengths))
        left = starts[best_idx]
        right = ends[best_idx]
        cx_preview = (left + right) / 2.0
        cx = cx_preview / scale
    else:
        cx = dw / 2.0

    # Symmetrical crop around detected center cx so Mataji is dead-center
    half_w = min(cx, dw - cx)
    min_half = dw * 0.40
    if half_w < min_half:
        half_w = min_half
        cx = max(half_w, min(dw - half_w, cx))

    crop_x1 = max(0, int(cx - half_w))
    crop_x2 = min(dw, int(cx + half_w))

    # Vertical framing: preserve canopy top arch and thali, trim excessive floor
    crop_y1 = max(0, int(dh * 0.012))
    crop_y2 = min(dh, int(dh * 0.93))

    return crop_x1, crop_y1, crop_x2, crop_y2


def frame_darshan_image(
    input_path: str,
    template_path: str,
    output_path: str,
    target_width: int = 1080,
    target_height: int = 1920
) -> str:
    inp = Path(input_path).resolve()
    tmpl = Path(template_path).resolve()
    outp = Path(output_path).resolve()

    if not inp.exists():
        raise FileNotFoundError(f"Input image not found: {inp}")
    if not tmpl.exists():
        raise FileNotFoundError(f"Template image not found: {tmpl}")

    # Check if a pre-scaled 1080x1920 template exists to save memory and CPU
    template_1080_path = tmpl.parent / "template_1080.png"
    if template_1080_path.exists():
        template = Image.open(template_1080_path).convert("RGBA")
    else:
        orig = Image.open(tmpl)
        template = orig.resize((target_width, target_height), Image.Resampling.LANCZOS).convert("RGBA")
        del orig
        gc.collect()

    darshan = Image.open(inp).convert("RGBA")
    crop_x1, crop_y1, crop_x2, crop_y2 = detect_darshan_crop_box(darshan)

    cropped = darshan.crop((crop_x1, crop_y1, crop_x2, crop_y2))
    del darshan
    gc.collect()

    cw = crop_x2 - crop_x1
    ch = crop_y2 - crop_y1
    aspect = float(cw) / float(ch) if ch > 0 else 0.5625

    # Proportions directly for native 1080x1920 canvas
    # Target height 1216px (equivalent to 3800px on 3375x6000 template)
    placed_h = 1216
    placed_w = int(placed_h * aspect)
    if placed_w > 992:
        placed_w = 992
        placed_h = int(placed_w / aspect)

    resized = cropped.resize((placed_w, placed_h), Image.Resampling.LANCZOS)
    del cropped
    gc.collect()

    # Rounded corners
    corner_radius = 19
    mask = Image.new("L", (placed_w, placed_h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, placed_w, placed_h], radius=corner_radius, fill=255)

    # Golden border matching the temple brand
    border_w = 4
    border_color = (205, 145, 40, 255)
    border_img = Image.new("RGBA", (placed_w, placed_h), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(border_img)
    bdraw.rounded_rectangle(
        [border_w // 2, border_w // 2, placed_w - border_w // 2, placed_h - border_w // 2],
        radius=corner_radius,
        outline=border_color,
        width=border_w
    )

    # Soft elevation shadow (calculated on compact 1080 canvas, saving 200MB+ RAM during blur)
    shadow_margin = 18
    shadow_size = (placed_w + shadow_margin * 2, placed_h + shadow_margin * 2)
    shadow = Image.new("RGBA", shadow_size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        [shadow_margin, shadow_margin + 6, placed_w + shadow_margin, placed_h + shadow_margin + 6],
        radius=corner_radius,
        fill=(0, 0, 0, 85)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(9))

    # Center placement between top logo and bottom address
    center_y = 945
    pos_x = (target_width - placed_w) // 2
    pos_y = center_y - (placed_h // 2)

    # Composite directly onto template (no extra full-canvas copy needed)
    template.paste(shadow, (pos_x - shadow_margin, pos_y - shadow_margin), shadow)
    template.paste(resized, (pos_x, pos_y), mask)
    template.paste(border_img, (pos_x, pos_y), border_img)

    del shadow, resized, mask, border_img
    gc.collect()

    # Final RGB output
    final_canvas = template.convert("RGB")
    del template
    gc.collect()

    outp.parent.mkdir(parents=True, exist_ok=True)
    final_canvas.save(outp, format="JPEG", quality=95)
    del final_canvas
    gc.collect()

    return str(outp)


def main():
    parser = argparse.ArgumentParser(description="MomaiDham Image Framer (Memory Optimized)")
    parser.add_argument("--input", required=True, help="Path to input darshan photo")
    parser.add_argument("--template", default="assets/template.png", help="Path to template PNG")
    parser.add_argument("--output", required=True, help="Path to output framed JPEG")
    args = parser.parse_args()

    out = frame_darshan_image(args.input, args.template, args.output)
    print(out)


if __name__ == "__main__":
    main()
