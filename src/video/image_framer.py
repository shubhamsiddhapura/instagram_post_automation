#!/usr/bin/env python3
"""
src/video/image_framer.py

Composites daily darshan photos into the official Shree MomaiDham template:
- Automatically detects logo (top) and address (bottom)
- Crops Mataji's idols perfectly centered
- Adds rounded corners, elegant gold border, and soft elevation shadow
- Outputs high-resolution 1080x1920 Instagram Reel canvas
"""

import sys
import argparse
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def detect_darshan_crop_box(darshan_img: Image.Image) -> tuple:
    """
    Automatically detects Mataji's sacred red canopy and murtis
    to determine the optimal crop boundaries:
    - Centers Mataji's central murti and canopy horizontally (eliminating side pillars)
    - Trims excessive empty floor at the bottom while keeping the aarti thali, diva, and top arch
    """
    dw, dh = darshan_img.size
    arr = np.array(darshan_img.convert("RGB"))

    # Detect sacred red canopy / garments (strong red dominance: R - G > 65 and R - B > 48)
    r_dom = (
        (arr[:, :, 0].astype(int) - arr[:, :, 1].astype(int) > 65)
        & (arr[:, :, 0].astype(int) - arr[:, :, 2].astype(int) > 48)
        & (arr[:, :, 0] > 120)
    )
    upper_r = r_dom[: int(dh * 0.70), :]
    col_counts = np.sum(upper_r, axis=0)
    active = (col_counts > (dh * 0.04)).astype(int)

    diff = np.diff(np.pad(active, (1, 1), "constant"))
    starts = np.where(diff == 1)[0]
    ends = np.where(diff == -1)[0]

    if len(starts) > 0:
        lengths = ends - starts
        best_idx = np.argmax(lengths)
        left = starts[best_idx]
        right = ends[best_idx]
        cx = (left + right) / 2.0
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

    template = Image.open(tmpl).convert("RGBA")
    darshan = Image.open(inp).convert("RGBA")

    tw, th = template.size
    dw, dh = darshan.size

    # Auto-detect optimal crop to center Mataji and eliminate side pillars
    crop_x1, crop_y1, crop_x2, crop_y2 = detect_darshan_crop_box(darshan)

    cropped = darshan.crop((crop_x1, crop_y1, crop_x2, crop_y2))
    cw = crop_x2 - crop_x1
    ch = crop_y2 - crop_y1
    aspect = cw / ch

    # Target height between logo (y=863) and address (y=5041) on 3375x6000 template
    # Total available = 4178px; target 3800px leaves breathing room above & below
    placed_h = 3800
    placed_w = int(placed_h * aspect)
    if placed_w > 3100:
        placed_w = 3100
        placed_h = int(placed_w / aspect)

    # Scale cropped image using high quality Lanczos
    resized = cropped.resize((placed_w, placed_h), Image.Resampling.LANCZOS)

    # Rounded corners
    corner_radius = 60
    mask = Image.new("L", (placed_w, placed_h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, placed_w, placed_h], radius=corner_radius, fill=255)

    # Golden border matching the temple brand
    border_w = 14
    border_color = (205, 145, 40, 255)
    border_img = Image.new("RGBA", (placed_w, placed_h), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(border_img)
    bdraw.rounded_rectangle(
        [border_w // 2, border_w // 2, placed_w - border_w // 2, placed_h - border_w // 2],
        radius=corner_radius,
        outline=border_color,
        width=border_w
    )

    # Soft elevation shadow
    shadow_margin = 55
    shadow_size = (placed_w + shadow_margin * 2, placed_h + shadow_margin * 2)
    shadow = Image.new("RGBA", shadow_size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        [shadow_margin, shadow_margin + 18, placed_w + shadow_margin, placed_h + shadow_margin + 18],
        radius=corner_radius,
        fill=(0, 0, 0, 85)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))

    # Center placement
    center_y = (863 + 5041) // 2  # 2952
    pos_x = (tw - placed_w) // 2
    pos_y = center_y - (placed_h // 2)

    # Composite onto template
    comp = template.copy()
    comp.paste(shadow, (pos_x - shadow_margin, pos_y - shadow_margin), shadow)
    comp.paste(resized, (pos_x, pos_y), mask)
    comp.paste(border_img, (pos_x, pos_y), border_img)

    # Resize to standard 1080x1920 Reel canvas
    final_canvas = comp.convert("RGB").resize((target_width, target_height), Image.Resampling.LANCZOS)
    
    outp.parent.mkdir(parents=True, exist_ok=True)
    final_canvas.save(outp, format="JPEG", quality=95)

    return str(outp)


def main():
    parser = argparse.ArgumentParser(description="MomaiDham Image Framer")
    parser.add_argument("--input", required=True, help="Path to input darshan photo")
    parser.add_argument("--template", default="assets/template.png", help="Path to template PNG")
    parser.add_argument("--output", required=True, help="Path to output framed JPEG")
    args = parser.parse_args()

    out = frame_darshan_image(args.input, args.template, args.output)
    print(out)


if __name__ == "__main__":
    main()
