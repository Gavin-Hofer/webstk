import type { MetadataRoute } from 'next';

const CURRENT_DATE = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://www.webstk.com',
      lastModified: CURRENT_DATE,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: 'https://www.webstk.com/password-generator',
      lastModified: CURRENT_DATE,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.webstk.com/image-converter',
      lastModified: CURRENT_DATE,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
