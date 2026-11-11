const PACKAGE_IMAGES: Partial<Record<string, string>> = {
  subject: '/ADRE-3.0-Subject-Wise-Practice-Thumbnail.png',
  pyq: '/ADRE-PYQ-Practice-ADRE-1.0-2.0-Thumbnail.png',
  mock: '/ADRE-3.0-10-Full-Length-Mock-Tests-Thumbnail.png',
  'police-subject': '/Assam-Police-Forest-Subject-Wise-Practice-Thumbnail.png',
  'police-mock': '/Assam-Police-Forest-10-Full-Length-Mock-Tests-Thumbnail.png'
};

export function packageImageFor(id: 'subject' | 'pyq' | 'mock' | 'police-subject' | 'police-mock'): string;
export function packageImageFor(id: string): string | undefined;
export function packageImageFor(id: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(PACKAGE_IMAGES, id) ? PACKAGE_IMAGES[id] : undefined;
}
