import type { ImageMetadata } from 'astro';

const covers = import.meta.glob<{ default: ImageMetadata }>('../assets/covers/*/cover.jpg', { eager: true });

export function coverAssetFor(slug: string | undefined) {
  return slug ? covers[`../assets/covers/${slug}/cover.jpg`]?.default : undefined;
}
