"""Generate street-depth.png with Depth Anything V2.

Install once:
  python -m pip install torch transformers pillow
Then run this file from the repository root.
"""

from pathlib import Path

import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation


ROOT = Path(__file__).resolve().parents[4]
SOURCE = ROOT / "src/components/Hero/assets/street.png"
OUTPUT = ROOT / "src/components/Experience/assets/street-depth.png"
MODEL = "depth-anything/Depth-Anything-V2-Small-hf"


def main() -> None:
    image = Image.open(SOURCE).convert("RGB")
    processor = AutoImageProcessor.from_pretrained(MODEL)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL)
    inputs = processor(images=image, return_tensors="pt")

    with torch.no_grad():
        prediction = model(**inputs).predicted_depth

    prediction = torch.nn.functional.interpolate(
        prediction.unsqueeze(1),
        size=image.size[::-1],
        mode="bicubic",
        align_corners=False,
    ).squeeze()
    prediction = (prediction - prediction.min()) / (
        prediction.max() - prediction.min()
    )
    depth = Image.fromarray((prediction.cpu().numpy() * 255).astype("uint8"))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    depth.save(OUTPUT)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
