# OUR PARTS FOR THE FILMS, CUT OUT OF THE SHOP'S PHOTOS (08.11.2026; SARCLA: "O-ring is not realistic on video").
#
# The shop's product photos (www.apsoparts.com/media/catalog/product/std.lang.all/...) are 3D renders on white with a
# soft floor shadow. This cuts each one out of its white (and its floor shadow - the film draws its own, so the part can
# hop) into a PNG with a transparent background, for public/video/parts (src/lib/content/studio/kinds/video/parts.ts).
#
#   python scripts/content-video/parts-cutout.py <photo.jpg> <out.png> [--seal]
#
# --seal keeps a shaft seal's steel case: its light grey side is kept where it hugs the rubber's right edge above the
# floor (the floor shadow has the same grey). Needs numpy, scipy and Pillow.
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd


def _largest(mask):
    lab, n = nd.label(mask)
    if n <= 1:
        return mask
    sizes = nd.sum(mask, lab, range(1, n + 1))
    return np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.02])


def _save(a, m, dst):
    alpha = np.clip(nd.gaussian_filter(m.astype(float), 0.9) * 1.15 - 0.075, 0, 1)
    A = alpha[..., None]
    # the colour unmixed from the white it was drawn on, so the soft edge sits on any background
    col = np.clip(np.where(A > 0.02, (a - (1 - A) * 255) / np.maximum(A, 1e-3), a), 0, 255)
    ys, xs = np.nonzero(alpha > 0.01)
    pad = 6
    y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad)
    x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad)
    Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8)[y0:y1, x0:x1], "RGBA").save(dst, optimize=True)


def cut(src, dst, seal=False):
    a = np.asarray(Image.open(src).convert("RGB")).astype(float)
    mn, mx = a.min(2), a.max(2)
    dark = 1 - mn / 255
    sat = (mx - mn) / np.maximum(mx, 1)
    if not seal:
        core = _largest(nd.binary_closing((dark > 0.5) | ((sat > 0.22) & (dark > 0.12)), iterations=3))
        _save(a, nd.binary_dilation(core, iterations=1), dst)
        return
    core = _largest(nd.binary_closing(dark > 0.5, iterations=3))
    ys, xs = np.nonzero(core)
    cx, bottom = xs.mean(), ys.max()
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    steel = nd.binary_dilation(core, iterations=18) & ~core & (dark > 0.08) & (sat < 0.15) & (xx > cx + 40) & (yy < bottom - 18)
    m = nd.binary_closing(core | nd.binary_opening(steel, iterations=1), iterations=2)
    _save(a, nd.binary_dilation(m, iterations=1), dst)


if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    if len(args) != 2:
        sys.exit("usage: parts-cutout.py <photo.jpg> <out.png> [--seal]")
    cut(args[0], args[1], seal="--seal" in sys.argv)
    print(args[1])
