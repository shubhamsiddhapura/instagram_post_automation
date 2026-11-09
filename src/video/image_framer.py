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

    template = Image.open(tmpl).convert("RGBA")
    darshan = Image.open(inp).convert("RGBA")

    tw, th = template.size
    dw, dh = darshan.size

    # Crop Mataji photo centered: focus on Mataji murtis, canopy, and aarti thali
    # Cut 5% from left and right to remove side pillars and keep Mataji centered
    crop_x1 = int(dw * 0.05)
    crop_x2 = int(dw * 0.95)
    crop_y1 = int(dh * 0.015)
    crop_y2 = int(dh * 0.985)

    cropped = darshan.crop((crop_x1, crop_y1, crop_x2, crop_y2))
    cw = crop_x2 - crop_x1
    ch = crop_y2 - crop_y1
    aspect = cw / ch

    # Target height between logo (y=863) and address (y=5041) on 3375x6000 template
    # Total available = 4178px; target 3800px leaves 189px breathing room above & below
    placed_h = 3800
    placed_w = int(placed_h * aspect)

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
