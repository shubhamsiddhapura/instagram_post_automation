#!/usr/bin/env python3
"""
src/video/image_framer.py

Clean, As-Is Image Framing Engine:
- Preserves the full, uncropped photo exactly as sent (no heuristic face/color cropping)
- Proportionally scales and centers the complete image within the designated frame area
- Applies elegant rounded corners, gold temple border, and soft elevation drop shadow
- Composites seamlessly onto the 1080x1920 template canvas between top logo and bottom address
- Low memory footprint with explicit garbage collection for cloud stability
"""

import gc
import sys
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


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

    # 1. Load pre-scaled 1080x1920 template (or scale once if only 3375x6000 exists)
    template_1080_path = tmpl.parent / "template_1080.png"
    if template_1080_path.exists():
        template = Image.open(template_1080_path).convert("RGBA")
    else:
        orig = Image.open(tmpl)
        template = orig.resize((target_width, target_height), Image.Resampling.LANCZOS).convert("RGBA")
        del orig
        gc.collect()

    # 2. Load original darshan photo - preserve full image as-is (no cropping)
    darshan = Image.open(inp).convert("RGBA")
    orig_w, orig_h = darshan.size
    aspect = float(orig_w) / float(orig_h) if orig_h > 0 else 1.0

    # 3. Available frame area between top logo (y ~276) and bottom address (y ~1613)
    max_w = 992
    max_h = 1260

    # Proportional scaling (strict aspect ratio preservation)
    placed_w = max_w
    placed_h = int(placed_w / aspect)
    if placed_h > max_h:
        placed_h = max_h
        placed_w = int(placed_h * aspect)

    # High-quality Lanczos resize of the uncropped photo
    resized = darshan.resize((placed_w, placed_h), Image.Resampling.LANCZOS)
    del darshan
    gc.collect()

    # 4. Rounded corners mask
    corner_radius = 18
    mask = Image.new("L", (placed_w, placed_h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, placed_w, placed_h], radius=corner_radius, fill=255)

    # 5. Golden temple brand border
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

    # 6. Soft elevation drop shadow
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

    # 7. Exact center placement between top logo and bottom address
    center_y = 945
    pos_x = (target_width - placed_w) // 2
    pos_y = center_y - (placed_h // 2)

    # 8. Composite cleanly onto template canvas
    template.paste(shadow, (pos_x - shadow_margin, pos_y - shadow_margin), shadow)
    template.paste(resized, (pos_x, pos_y), mask)
    template.paste(border_img, (pos_x, pos_y), border_img)

    del shadow, resized, mask, border_img
    gc.collect()

    # 9. Export final 1080x1920 JPEG
    final_canvas = template.convert("RGB")
    del template
    gc.collect()

    outp.parent.mkdir(parents=True, exist_ok=True)
    final_canvas.save(outp, format="JPEG", quality=95)
    del final_canvas
    gc.collect()

    return str(outp)


def main():
    parser = argparse.ArgumentParser(description="MomaiDham Image Framer (As-Is Proportional Centering)")
    parser.add_argument("--input", required=True, help="Path to input darshan photo")
    parser.add_argument("--template", default="assets/template.png", help="Path to template PNG")
    parser.add_argument("--output", required=True, help="Path to output framed JPEG")
    args = parser.parse_args()

    out = frame_darshan_image(args.input, args.template, args.output)
    print(out)


if __name__ == "__main__":
    main()
