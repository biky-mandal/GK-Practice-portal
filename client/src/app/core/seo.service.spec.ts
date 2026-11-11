import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { SeoService } from './seo.service';
import { routes } from '../app.routes';

@Component({ template: '' })
class EmptyPageComponent {}

describe('SeoService', () => {
  let router: Router;
  let seo: SeoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EmptyPageComponent],
      imports: [
        RouterTestingModule.withRoutes([
          {
            path: 'public',
            component: EmptyPageComponent,
            data: {
              seo: {
                title: 'Public title',
                description: 'Public description',
                canonicalPath: '/public',
                indexable: true,
                structuredData: 'website'
              }
            }
          },
          {
            path: 'private',
            component: EmptyPageComponent,
            data: { seo: { title: 'Private title', description: 'Private description', indexable: false } }
          }
        ])
      ]
    });
    router = TestBed.inject(Router);
    seo = TestBed.inject(SeoService);
  });

  afterEach(() => {
    document.head.querySelector('link[rel="canonical"]')?.remove();
    document.getElementById('website-jsonld')?.remove();
  });

  it('sets canonical, indexable social metadata and website structured data on a public route', async () => {
    await router.navigateByUrl('/public');

    seo.updateForRoute();

    expect(document.title).toBe('Public title');
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe('Public description');
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('index, follow');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe('https://letscrackadre.com/public');
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content).toBe('https://letscrackadre.com/public');

    const structuredData = document.getElementById('website-jsonld')?.textContent;
    expect(JSON.parse(structuredData ?? '{}')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: "Let's Crack ADRE",
      url: 'https://letscrackadre.com/'
    });
  });

  it('keeps exactly one canonical for homepage and /adre across navigation, using real route SEO data', async () => {
    const stale = document.createElement('link');
    stale.rel = 'canonical';
    stale.href = 'https://letscrackadre.com/';
    document.head.append(stale, stale.cloneNode() as HTMLLinkElement);

    const seoData = (path: string) => routes.find((r) => r.path === path)?.data?.['seo'];
    router.resetConfig([
      { path: '', pathMatch: 'full', component: EmptyPageComponent, data: { seo: seoData('') } },
      { path: 'adre', component: EmptyPageComponent, data: { seo: seoData('adre') } },
      { path: 'dashboard', component: EmptyPageComponent, data: { seo: seoData('dashboard') } }
    ]);
    const canonicals = () =>
      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')).map((l) => l.href);

    await router.navigateByUrl('/');
    seo.updateForRoute();
    expect(canonicals()).toEqual(['https://letscrackadre.com/']);

    await router.navigateByUrl('/adre');
    seo.updateForRoute();
    expect(canonicals()).toEqual(['https://letscrackadre.com/adre']);

    await router.navigateByUrl('/');
    seo.updateForRoute();
    expect(canonicals()).toEqual(['https://letscrackadre.com/']);

    await router.navigateByUrl('/dashboard');
    seo.updateForRoute();
    expect(canonicals()).toEqual([]);
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow');
  });

  it('removes canonical and social metadata and sets noindex on a private route', async () => {
    await router.navigateByUrl('/private');

    seo.updateForRoute();

    expect(document.title).toBe('Private title');
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[property="og:url"]')).toBeNull();
    expect(document.getElementById('website-jsonld')).toBeNull();
  });
});
