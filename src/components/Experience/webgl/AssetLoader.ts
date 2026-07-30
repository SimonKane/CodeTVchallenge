import {
  LinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";

export interface ExperienceAssets {
  street: Texture;
  depth: Texture;
  child: Texture;
  childLookback: Texture;
}

const loadTexture = (loader: TextureLoader, url: string) =>
  new Promise<Texture>((resolve, reject) => loader.load(url, resolve, undefined, reject));

export const loadExperienceAssets = async (
  streetUrl: string,
  depthUrl: string,
  childUrl: string,
  childLookbackUrl: string,
): Promise<ExperienceAssets> => {
  const loader = new TextureLoader();
  const [street, depth, child, childLookback] = await Promise.all([
    loadTexture(loader, streetUrl),
    loadTexture(loader, depthUrl),
    loadTexture(loader, childUrl),
    loadTexture(loader, childLookbackUrl),
  ]);

  street.colorSpace = SRGBColorSpace;
  child.colorSpace = SRGBColorSpace;
  childLookback.colorSpace = SRGBColorSpace;
  depth.minFilter = LinearFilter;
  depth.magFilter = LinearFilter;

  return { street, depth, child, childLookback };
};
