import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, Router } from '@angular/router';

interface RouteSeo {
  title: string;
  description: string;
  canonicalPath?: string;
  indexable: boolean;
  structuredData?: 'website';
}

const SITE_ORIGIN = 'https://letscrackadre.com';
const SITE_NAME = "Let's Crack ADRE";
const SOCIAL_IMAGE = `${SITE_ORIGIN}/ADRE%203.0%20Assam%20Preparation%20Banner-2.png`;

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly router = inject(Router);

  updateForRoute(): void {
    const seo = this.findRouteSeo(this.router.routerState.snapshot.root) ?? {
      title: SITE_NAME,
      description: 'Practice resources for the Assam Direct Recruitment Examination.',
      indexable: false
    };

    this.title.setTitle(seo.title);
    this.meta.updateTag({ name: 'description', content: seo.description });
    this.meta.updateTag({ name: 'robots', content: seo.indexable ? 'index, follow' : 'noindex, nofollow' });

    if (seo.indexable && seo.canonicalPath) {
      const canonicalUrl = `${SITE_ORIGIN}${seo.canonicalPath}`;
      this.setCanonical(canonicalUrl);
      this.updateSocialMetadata(seo, canonicalUrl);
    } else {
      this.removeCanonical();
      this.removeSocialMetadata();
    }

    this.updateStructuredData(seo);
  }

  private findRouteSeo(route: ActivatedRouteSnapshot): RouteSeo | undefined {
    const routeSeo = route.data['seo'] as RouteSeo | undefined;
    if (route.firstChild) {
      return this.findRouteSeo(route.firstChild) ?? routeSeo;
    }
    return routeSeo;
  }

  private setCanonical(url: string): void {
    const links = Array.from(this.document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
    links.slice(1).forEach((duplicate) => duplicate.remove());
    let link = links[0];
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }

  private removeCanonical(): void {
    this.document.head.querySelectorAll('link[rel="canonical"]').forEach((link) => link.remove());
  }

  private updateSocialMetadata(seo: RouteSeo, url: string): void {
    this.meta.updateTag({ property: 'og:title', content: seo.title });
    this.meta.updateTag({ property: 'og:description', content: seo.description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: SOCIAL_IMAGE });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: seo.title });
    this.meta.updateTag({ name: 'twitter:description', content: seo.description });
    this.meta.updateTag({ name: 'twitter:image', content: SOCIAL_IMAGE });
  }

  private removeSocialMetadata(): void {
    for (const selector of [
      'property="og:title"',
      'property="og:description"',
      'property="og:type"',
      'property="og:url"',
      'property="og:image"',
      'property="og:site_name"',
      'name="twitter:card"',
      'name="twitter:title"',
      'name="twitter:description"',
      'name="twitter:image"'
    ]) {
      this.meta.removeTag(selector);
    }
  }

  private updateStructuredData(seo: RouteSeo): void {
    this.document.getElementById('website-jsonld')?.remove();
    if (seo.structuredData !== 'website') {
      return;
    }

    const script = this.document.createElement('script');
    script.id = 'website-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${SITE_ORIGIN}/`
    });
    this.document.head.appendChild(script);
  }
}
