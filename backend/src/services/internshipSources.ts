import axios from 'axios';
import * as cheerio from 'cheerio';
import Internship, { IInternship } from '../models/Internship';

type NormalizedInternship = {
  title: string;
  company: string;
  location: string;
  description: string;
  skillsRequired: string[];
  isRemote: boolean;
  applyUrl: string;
  postedAt: Date;
  source: string;
  externalId: string;
};

// ----------- Source 1: Remotive (Remote internships) -----------
async function fetchFromRemotive(): Promise<NormalizedInternship[]> {
  const url = 'https://remotive.com/api/remote-jobs';
  const params = { search: 'internship', limit: 100 };

  const res = await axios.get(url, { params, timeout: 15000 });
  const jobs = (res.data?.jobs ?? []) as any[];

  return jobs
    .filter((job) => job.title && job.url)
    .map((job) => ({
      title: job.title,
      company: job.company_name ?? 'Unknown',
      location: job.candidate_required_location || 'Remote',
      description: job.description || job.title,
      skillsRequired: (job.tags || []) as string[],
      isRemote: true,
      applyUrl: job.url,
      postedAt: new Date(job.publication_date),
      source: 'remotive',
      externalId: String(job.id),
    }));
}

// ----------- Source 2: Arbeitnow (Large job board, Kenya/Africa filter) -----------
async function fetchFromArbeitnow(): Promise<NormalizedInternship[]> {
  // Arbeitnow is a free public jobs API with no auth required
  const url = 'https://www.arbeitnow.com/api/job-board-api';
  const res = await axios.get(url, { timeout: 15000 });
  const jobs = (res.data?.data ?? []) as any[];

  return jobs
    .filter(
      (job: any) =>
        (job.title?.toLowerCase().includes('intern') ||
          job.job_types?.some((t: string) => t.toLowerCase().includes('intern'))) &&
        job.title &&
        job.url,
    )
    .map((job: any) => ({
      title: job.title,
      company: job.company_name ?? 'Unknown',
      location: job.location || (job.remote ? 'Remote' : 'Unknown'),
      description: job.description || job.title,
      skillsRequired: (job.tags || []) as string[],
      isRemote: job.remote ?? false,
      applyUrl: job.url,
      postedAt: job.created_at ? new Date(job.created_at * 1000) : new Date(),
      source: 'arbeitnow',
      externalId: String(job.slug || job.url),
    }));
}

// ----------- Source 3: Adzuna (Global job search with Kenya region) -----------
async function fetchFromAdzuna(): Promise<NormalizedInternship[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    // Skip gracefully if credentials not configured
    return [];
  }

  const results: NormalizedInternship[] = [];

  // Fetch Kenya jobs
  const kenyaUrl = `https://api.adzuna.com/v1/api/jobs/ke/search/1`;
  const params = {
    app_id: appId,
    app_key: appKey,
    results_per_page: 50,
    what: 'internship',
    content_type: 'application/json',
  };

  try {
    const res = await axios.get(kenyaUrl, { params, timeout: 15000 });
    const jobs = (res.data?.results ?? []) as any[];
    for (const job of jobs) {
      if (!job.title || !job.redirect_url) continue;
      results.push({
        title: job.title,
        company: job.company?.display_name ?? 'Unknown',
        location: job.location?.display_name || 'Kenya',
        description: job.description || job.title,
        skillsRequired: [],
        isRemote: false,
        applyUrl: job.redirect_url,
        postedAt: job.created ? new Date(job.created) : new Date(),
        source: 'adzuna-ke',
        externalId: String(job.id),
      });
    }
  } catch {
    // ignore country-specific failures
  }

  return results;
}

// ----------- Source 4: Jooble (Global aggregator) -----------
async function fetchFromJooble(): Promise<NormalizedInternship[]> {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) return [];

  const url = `https://jooble.org/api/${apiKey}`;
  // Search Kenya internships
  const searches = [
    { keywords: 'internship', location: 'Kenya' },
    { keywords: 'intern software', location: 'Nairobi' },
  ];

  const results: NormalizedInternship[] = [];
  for (const search of searches) {
    try {
      const res = await axios.post(url, search, { timeout: 15000 });
      const jobs = (res.data?.jobs ?? []) as any[];
      for (const job of jobs) {
        if (!job.title || !job.link) continue;
        results.push({
          title: job.title,
          company: job.company ?? 'Unknown',
          location: job.location || 'Kenya',
          description: job.snippet || job.title,
          skillsRequired: [],
          isRemote: false,
          applyUrl: job.link,
          postedAt: job.updated ? new Date(job.updated) : new Date(),
          source: 'jooble',
          externalId: String(job.id || job.link),
        });
      }
    } catch {
      // ignore per-search failures
    }
  }
  return results;
}

// ----------- Source 5: GitHub Jobs / Public Kenyan postings (No auth needed) -----------
async function fetchFromReedCoUk(): Promise<NormalizedInternship[]> {
  const apiKey = process.env.REED_API_KEY;
  if (!apiKey) return [];

  const url = 'https://www.reed.co.uk/api/1.0/search';
  const params = {
    keywords: 'internship kenya africa',
    resultsToTake: 50,
  };

  try {
    const res = await axios.get(url, {
      auth: { username: apiKey, password: '' },
      params,
      timeout: 15000,
    });
    const jobs = (res.data?.results ?? []) as any[];
    return jobs
      .filter((job: any) => job.jobTitle && job.jobUrl)
      .map((job: any) => ({
        title: job.jobTitle,
        company: job.employerName ?? 'Unknown',
        location: job.locationName || 'Remote',
        description: job.jobDescription || job.jobTitle,
        skillsRequired: [],
        isRemote: false,
        applyUrl: job.jobUrl,
        postedAt: job.date ? new Date(job.date) : new Date(),
        source: 'reed',
        externalId: String(job.jobId),
      }));
  } catch {
    return [];
  }
}

// ----------- Source 6: Free Public Jobs API (Rise) -----------
async function fetchFromFreeJobsAPI(): Promise<NormalizedInternship[]> {
  const url = 'https://api.joinrise.io/api/v1/jobs/public?page=1&limit=100';
  const res = await axios.get(url, { timeout: 15000 });
  const jobs = (res.data?.jobs ?? res.data ?? []) as any[];

  return jobs
    .filter(
      (job: any) =>
        job.type?.toLowerCase().includes('intern') &&
        job.title &&
        (job.url || job.apply_url || job.applyUrl),
    )
    .map((job: any) => ({
      title: job.title,
      company: job.company ?? 'Unknown',
      location: job.location ?? 'Remote',
      description: job.description || job.title,
      skillsRequired: (job.tags || []) as string[],
      isRemote: job.remote ?? false,
      applyUrl: job.url || job.apply_url || job.applyUrl,
      postedAt: job.createdAt ? new Date(job.createdAt) : new Date(),
      source: 'rise-public',
      externalId: String(job.id),
    }));
}

// ----------- Source 7: Indeed (via SerpAPI or scraping-free public endpoint) -----------
async function fetchFromJSearch(): Promise<NormalizedInternship[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];

  const url = 'https://jsearch.p.rapidapi.com/search';
  const searches = [
    { query: 'internship in Kenya', page: '1' },
    { query: 'software intern Nairobi', page: '1' },
    { query: 'data intern Africa', page: '1' },
  ];

  const results: NormalizedInternship[] = [];
  for (const search of searches) {
    try {
      const res = await axios.get(url, {
        params: { ...search, num_pages: '1', date_posted: 'month' },
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
        timeout: 15000,
      });
      const jobs = (res.data?.data ?? []) as any[];
      for (const job of jobs) {
        if (!job.job_title || !job.job_apply_link) continue;
        results.push({
          title: job.job_title,
          company: job.employer_name ?? 'Unknown',
          location:
            job.job_city && job.job_country
              ? `${job.job_city}, ${job.job_country}`
              : job.job_country || 'Remote',
          description: job.job_description || job.job_title,
          skillsRequired: job.job_required_skills ?? [],
          isRemote: job.job_is_remote ?? false,
          applyUrl: job.job_apply_link,
          postedAt: job.job_posted_at_datetime_utc
            ? new Date(job.job_posted_at_datetime_utc)
            : new Date(),
          source: 'jsearch',
          externalId: String(job.job_id),
        });
      }
    } catch {
      // ignore per-search failures
    }
  }
  return results;
}


// ═══════════════════════════════════════════════════════════
// ═══════  KENYA-SPECIFIC  SCRAPERS  ════════════════════════
// ═══════════════════════════════════════════════════════════

/** Shared browser-like headers to reduce bot-detection blocks */
const SCRAPE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

// ----------- Kenya Source 1: BrighterMonday Kenya -----------
async function fetchFromBrighterMonday(): Promise<NormalizedInternship[]> {
  const urls = [
    'https://www.brightermonday.co.ke/jobs/internship-graduate',
    'https://www.brightermonday.co.ke/jobs?job_function=internship&experience=graduate-trainee',
  ];

  const results: NormalizedInternship[] = [];

  for (const url of urls) {
    try {
      const res = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 20000 });
      const $ = cheerio.load(res.data);

      // BrighterMonday injects JSON-LD structured data — parse it first (most reliable)
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html() ?? '{}');
          // Can be a single JobPosting or an array / ItemList
          const items: any[] = [];
          if (Array.isArray(json)) items.push(...json);
          else if (json['@type'] === 'JobPosting') items.push(json);
          else if (json['@graph']) items.push(...json['@graph']);
          else if (json.itemListElement) {
            json.itemListElement.forEach((e: any) => e.item && items.push(e.item));
          }

          for (const item of items) {
            if (item['@type'] !== 'JobPosting') continue;
            const applyUrl =
              item.url ||
              (item.sameAs ? item.sameAs : null) ||
              item.identifier?.value ||
              '';
            if (!applyUrl) continue;

            const location =
              item.jobLocation?.address?.addressLocality ||
              item.jobLocation?.address?.addressRegion ||
              'Kenya';

            results.push({
              title: item.title ?? item.name ?? 'Intern Position',
              company: item.hiringOrganization?.name ?? 'Unknown',
              location,
              description: item.description ?? item.title ?? '',
              skillsRequired: item.skills ? String(item.skills).split(',').map((s: string) => s.trim()) : [],
              isRemote:
                item.jobLocationType === 'TELECOMMUTE' ||
                String(location).toLowerCase().includes('remote'),
              applyUrl,
              postedAt: item.datePosted ? new Date(item.datePosted) : new Date(),
              source: 'brightermonday',
              externalId: `bm-${Buffer.from(applyUrl).toString('base64').slice(0, 32)}`,
            });
          }
        } catch {
          // malformed JSON-LD — skip
        }
      });

      // HTML card fallback: BrighterMonday SSR renders article[data-v-*] or div.search-result
      // Try multiple selector patterns for resilience across layout updates
      const cardSelectors = [
        'article[data-job-id]',
        '[data-testid="listing-card"]',
        'li.jobs-list__item',
        '.job-listing',
        'article.job',
      ];

      for (const cardSel of cardSelectors) {
        const cards = $(cardSel);
        if (cards.length === 0) continue;

        cards.each((_, card) => {
          const $c = $(card);
          const titleEl = $c.find('h2 a, h3 a, a[href*="/job/"], a[href*="/jobs/"]').first();
          const title = titleEl.text().trim();
          const href = titleEl.attr('href') ?? '';
          if (!title || !href) return;

          const applyUrl = href.startsWith('http')
            ? href
            : `https://www.brightermonday.co.ke${href}`;

          const company =
            $c.find('[data-company], .company-name, .employer, [class*="company"]').first().text().trim() ||
            'Unknown';
          const location =
            $c.find('[data-location], .location, [class*="location"]').first().text().trim() ||
            'Kenya';
          const description =
            $c.find('p, [class*="description"], [class*="summary"]').first().text().trim() ||
            title;

          results.push({
            title,
            company,
            location,
            description,
            skillsRequired: [],
            isRemote: location.toLowerCase().includes('remote'),
            applyUrl,
            postedAt: new Date(),
            source: 'brightermonday',
            externalId: `bm-${Buffer.from(applyUrl).toString('base64').slice(0, 32)}`,
          });
        });
        break; // found at least one card selector that worked
      }
    } catch {
      // ignore per-URL errors; other URL might succeed
    }
  }

  return results;
}

// ----------- Kenya Source 2: Fuzu Kenya -----------
async function fetchFromFuzu(): Promise<NormalizedInternship[]> {
  // Fuzu blocks headless requests with 403 / Cloudflare. We attempt with spoofed headers.
  // If it returns 403 we return [] gracefully so it doesn't block other sources.
  const url = 'https://fuzu.com/search?country=kenya&job_type=internship';

  try {
    const res = await axios.get(url, {
      headers: {
        ...SCRAPE_HEADERS,
        Referer: 'https://www.google.com/',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(res.data);
    const results: NormalizedInternship[] = [];

    // Try JSON-LD structured data first
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() ?? '{}');
        const items: any[] = [];
        if (Array.isArray(json)) items.push(...json);
        else if (json['@type'] === 'JobPosting') items.push(json);
        else if (json['@graph']) items.push(...json['@graph']);

        for (const item of items) {
          if (item['@type'] !== 'JobPosting') continue;
          const applyUrl = item.url || item.sameAs || '';
          if (!applyUrl) continue;
          results.push({
            title: item.title ?? item.name ?? 'Intern Position',
            company: item.hiringOrganization?.name ?? 'Unknown',
            location:
              item.jobLocation?.address?.addressLocality ??
              item.jobLocation?.address?.addressRegion ??
              'Kenya',
            description: item.description ?? '',
            skillsRequired: [],
            isRemote: item.jobLocationType === 'TELECOMMUTE',
            applyUrl,
            postedAt: item.datePosted ? new Date(item.datePosted) : new Date(),
            source: 'fuzu',
            externalId: `fuzu-${Buffer.from(applyUrl).toString('base64').slice(0, 32)}`,
          });
        }
      } catch {
        // skip
      }
    });

    // HTML card fallback
    const cardSelectors = [
      '.job-card',
      '[data-testid="job-card"]',
      '.opportunity-card',
      '.job-listing',
      'li.position',
    ];

    for (const cardSel of cardSelectors) {
      const cards = $(cardSel);
      if (cards.length === 0) continue;

      cards.each((_, card) => {
        const $c = $(card);
        const titleEl = $c.find('h2 a, h3 a, a[href*="/job"], a[href*="/position"]').first();
        const title = titleEl.text().trim();
        const href = titleEl.attr('href') ?? '';
        if (!title || !href) return;

        const applyUrl = href.startsWith('http')
          ? href
          : `https://fuzu.com${href}`;

        results.push({
          title,
          company: $c.find('[class*="company"], [class*="employer"]').first().text().trim() || 'Unknown',
          location: $c.find('[class*="location"]').first().text().trim() || 'Kenya',
          description: $c.find('p, [class*="description"]').first().text().trim() || title,
          skillsRequired: [],
          isRemote: false,
          applyUrl,
          postedAt: new Date(),
          source: 'fuzu',
          externalId: `fuzu-${Buffer.from(applyUrl).toString('base64').slice(0, 32)}`,
        });
      });
      break;
    }

    return results;
  } catch {
    // Fuzu blocking bots — return empty without noise
    return [];
  }
}

// ----------- Kenya Source 3: Safaricom Careers -----------
async function fetchFromSafaricom(): Promise<NormalizedInternship[]> {
  const url = 'https://www.safaricom.co.ke/careers/vacancies';
  try {
    const res = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const results: NormalizedInternship[] = [];

    // Their careers page lists vacancies in table rows / divs
    const selectors = [
      '.vacancy-item',
      '.career-listing',
      '.job-listing',
      'tr[data-href]',
      '.views-row',
    ];

    for (const sel of selectors) {
      const items = $(sel);
      if (items.length === 0) continue;

      items.each((_, el) => {
        const $el = $(el);
        const titleEl = $el.find('a, h2, h3').first();
        const title = titleEl.text().trim();
        let href = titleEl.attr('href') ?? $el.attr('data-href') ?? '';
        if (!title || !href) return;
        if (!href.startsWith('http')) href = `https://www.safaricom.co.ke${href}`;

        const intern = title.toLowerCase().includes('intern') ||
          $el.text().toLowerCase().includes('intern');
        if (!intern) return; // only collect intern roles

        results.push({
          title,
          company: 'Safaricom PLC',
          location: 'Nairobi, Kenya',
          description: $el.find('p, .description, .summary').first().text().trim() || title,
          skillsRequired: [],
          isRemote: false,
          applyUrl: href,
          postedAt: new Date(),
          source: 'safaricom',
          externalId: `saf-${Buffer.from(href).toString('base64').slice(0, 32)}`,
        });
      });
      if (results.length > 0) break;
    }

    return results;
  } catch {
    return [];
  }
}

// ----------- Kenya Source 4: Equity Bank Careers -----------
async function fetchFromEquityBank(): Promise<NormalizedInternship[]> {
  const url = 'https://equitygroupholdings.com/ke/careers/';
  try {
    const res = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const results: NormalizedInternship[] = [];

    // Equity uses WordPress / standard HTML
    const selectors = ['.career-post', '.job-listing', '.vacancy', '.entry-content a', 'article a'];

    for (const sel of selectors) {
      const items = $(sel);
      if (items.length === 0) continue;

      items.each((_, el) => {
        const $el = $(el);
        const title = $el.text().trim();
        const href = $el.attr('href') ?? '';
        if (!title || !href || !title.toLowerCase().match(/intern|attach|graduate|trainee/)) return;

        const applyUrl = href.startsWith('http')
          ? href
          : `https://equitygroupholdings.com${href}`;

        results.push({
          title,
          company: 'Equity Bank Kenya',
          location: 'Nairobi, Kenya',
          description: title,
          skillsRequired: [],
          isRemote: false,
          applyUrl,
          postedAt: new Date(),
          source: 'equity-bank',
          externalId: `eqb-${Buffer.from(applyUrl).toString('base64').slice(0, 32)}`,
        });
      });
      if (results.length > 0) break;
    }
    return results;
  } catch {
    return [];
  }
}

// ----------- Kenya Source 5: KCB Bank Careers -----------
async function fetchFromKCB(): Promise<NormalizedInternship[]> {
  const url = 'https://kcbgroup.com/careers/';
  try {
    const res = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const results: NormalizedInternship[] = [];

    // KCB uses a standard careers page with job listings
    const selectors = ['.job-item', '.career-item', '.vacancies-list li', 'article.job', '.entry a'];

    for (const sel of selectors) {
      const items = $(sel);
      if (items.length === 0) continue;

      items.each((_, el) => {
        const $el = $(el);
        const anchor = $el.is('a') ? $el : $el.find('a').first();
        const title = anchor.text().trim() || $el.find('h2, h3').first().text().trim();
        const href = anchor.attr('href') ?? '';
        if (!title || !href || !title.toLowerCase().match(/intern|attach|graduate|trainee/)) return;

        const applyUrl = href.startsWith('http') ? href : `https://kcbgroup.com${href}`;

        results.push({
          title,
          company: 'KCB Group',
          location: 'Nairobi, Kenya',
          description: $el.find('p, .description').first().text().trim() || title,
          skillsRequired: [],
          isRemote: false,
          applyUrl,
          postedAt: new Date(),
          source: 'kcb',
          externalId: `kcb-${Buffer.from(applyUrl).toString('base64').slice(0, 32)}`,
        });
      });
      if (results.length > 0) break;
    }
    return results;
  } catch {
    return [];
  }
}

// ----------- Kenya Source 6: Andela Talent Network -----------
async function fetchFromAndela(): Promise<NormalizedInternship[]> {
  // Andela's public-facing careers page lists open roles including internships
  const urls = [
    'https://andela.com/company/careers/',
    'https://andela.com/work/',
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 15000 });
      const $ = cheerio.load(res.data);
      const results: NormalizedInternship[] = [];

      // Andela uses Greenhouse or Lever for ATS — look for job links
      const selectors = [
        '.opening',
        '.job-post',
        '[class*="job"]',
        '[class*="career"]',
        '[class*="posting"]',
        'li a',
      ];

      for (const sel of selectors) {
        const items = $(sel);
        if (items.length === 0) continue;

        items.each((_, el) => {
          const $el = $(el);
          const anchor = $el.is('a') ? $el : $el.find('a').first();
          const title = anchor.text().trim() || $el.find('h2, h3, h4').text().trim();
          const href = anchor.attr('href') ?? '';
          if (!title || !href) return;
          if (!title.toLowerCase().match(/intern|fellowship|trainee|junior|graduate/)) return;

          const applyUrl = href.startsWith('http') ? href : `https://andela.com${href}`;

          results.push({
            title,
            company: 'Andela',
            location: 'Remote (Africa)',
            description: $el.find('p, [class*="desc"]').first().text().trim() || title,
            skillsRequired: [],
            isRemote: true,
            applyUrl,
            postedAt: new Date(),
            source: 'andela',
            externalId: `andela-${Buffer.from(applyUrl).toString('base64').slice(0, 32)}`,
          });
        });
        if (results.length > 0) break;
      }

      if (results.length > 0) return results;
    } catch {
      continue;
    }
  }
  return [];
}

// ----------- Kenya Source 7: Cellulant Careers -----------
async function fetchFromCellulant(): Promise<NormalizedInternship[]> {
  const url = 'https://cellulant.io/careers/';
  try {
    const res = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const results: NormalizedInternship[] = [];

    const selectors = ['.job-listing', '.role', '.opening', 'article.job', '.position', '[class*="career"]', 'a[href*="greenhouse"], a[href*="lever"], a[href*="apply"]'];

    for (const sel of selectors) {
      const items = $(sel);
      if (items.length === 0) continue;

      items.each((_, el) => {
        const $el = $(el);
        const anchor = $el.is('a') ? $el : $el.find('a').first();
        const title = anchor.text().trim() || $el.find('h2, h3, h4').text().trim();
        const href = anchor.attr('href') ?? '';
        if (!title || !href) return;
        if (!title.toLowerCase().match(/intern|attach|graduate|trainee|junior/)) return;

        const applyUrl = href.startsWith('http') ? href : `https://cellulant.io${href}`;

        results.push({
          title,
          company: 'Cellulant Africa',
          location: 'Nairobi, Kenya',
          description: $el.find('p, [class*="desc"]').first().text().trim() || title,
          skillsRequired: [],
          isRemote: false,
          applyUrl,
          postedAt: new Date(),
          source: 'cellulant',
          externalId: `cel-${Buffer.from(applyUrl).toString('base64').slice(0, 32)}`,
        });
      });
      if (results.length > 0) break;
    }
    return results;
  } catch {
    return [];
  }
}

// ----------- Main Sync Function -----------
export async function syncExternalInternships(): Promise<{
  inserted: number;
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];

  // Fetch from all sources independently — one failure doesn't block the other
  const results = await Promise.allSettled([
    fetchFromRemotive(),
    fetchFromArbeitnow(),
    fetchFromAdzuna(),
    fetchFromJooble(),
    fetchFromReedCoUk(),
    fetchFromFreeJobsAPI(),
    fetchFromJSearch(),
    // ── Kenya-specific sources ──────────────────
    fetchFromBrighterMonday(),
    fetchFromFuzu(),
    fetchFromSafaricom(),
    fetchFromEquityBank(),
    fetchFromKCB(),
    fetchFromAndela(),
    fetchFromCellulant(),
  ]);

  const normalized: NormalizedInternship[] = [];
  const sourceNames = [
    'Remotive', 'Arbeitnow', 'Adzuna', 'Jooble', 'Reed', 'Rise', 'JSearch',
    // Kenya
    'BrighterMonday', 'Fuzu', 'Safaricom', 'Equity Bank', 'KCB', 'Andela', 'Cellulant',
  ];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      normalized.push(...result.value);
    } else {
      const msg = `${sourceNames[i]} fetch failed: ${(result.reason as Error)?.message ?? 'unknown error'}`;
      console.error(msg);
      errors.push(msg);
    }
  });

  let inserted = 0;
  let updated = 0;

  // Upsert into MongoDB — each item independently so one bad record doesn't block others
  await Promise.all(
    normalized.map(async (item) => {
      try {
        const existing = await Internship.findOne({
          source: item.source,
          externalId: item.externalId,
        });

        if (!existing) {
          await Internship.create({
            ...item,
            seniority: 'intern',
          } as Partial<IInternship>);
          inserted += 1;
        } else {
          existing.title = item.title;
          existing.company = item.company;
          existing.location = item.location;
          existing.description = item.description;
          existing.skillsRequired = item.skillsRequired;
          existing.isRemote = item.isRemote;
          existing.applyUrl = item.applyUrl;
          existing.postedAt = item.postedAt;
          await existing.save();
          updated += 1;
        }
      } catch (err) {
        const msg = `Failed to upsert "${item.title}": ${(err as Error)?.message ?? 'unknown'}`;
        console.error(msg);
        errors.push(msg);
      }
    }),
  );

  return { inserted, updated, errors };
}

// ----------- Fallback seed internships (Kenya-focused) -----------
export async function seedFallbackIfEmpty() {
  const count = await Internship.estimatedDocumentCount();
  if (count > 0) return { seeded: 0 };

  const samples = [
    {
      title: 'Software Engineering Intern',
      company: 'Safaricom PLC',
      location: 'Nairobi, Kenya',
      source: 'sample',
      externalId: 'sample-ke-1',
      description:
        'Join Africa\'s leading telco for a summer engineering placement. Work with our engineering crews on M-Pesa backend systems, API integrations and internal tooling using Java and Node.js. Ideal for CS/IT students in their 3rd or 4th year.',
      skillsRequired: ['Java', 'Node.js', 'REST APIs', 'Git', 'SQL'],
      seniority: 'intern' as const,
      isRemote: false,
      applyUrl: 'https://www.safaricom.co.ke/careers',
      postedAt: new Date(),
    },
    {
      title: 'Data Science Intern',
      company: 'Equity Bank Kenya',
      location: 'Nairobi, Kenya',
      source: 'sample',
      externalId: 'sample-ke-2',
      description:
        'Work alongside the Analytics Centre of Excellence to build credit-scoring models, customer segmentation pipelines, and dashboards for business leaders. You will use Python, SQL and Power BI in a fast-paced fintech environment.',
      skillsRequired: ['Python', 'Pandas', 'SQL', 'Machine Learning', 'Power BI'],
      seniority: 'intern' as const,
      isRemote: false,
      applyUrl: 'https://equitygroupholdings.com/ke/careers/',
      postedAt: new Date(),
    },
    {
      title: 'Frontend Developer Intern',
      company: 'Andela (Remote, Kenya Track)',
      location: 'Remote',
      source: 'sample',
      externalId: 'sample-ke-3',
      description:
        'Collaborate with global engineering teams on React-based client applications. Build accessible, performant web interfaces and participate in code reviews, sprint planning, and pair programming sessions.',
      skillsRequired: ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript'],
      seniority: 'intern' as const,
      isRemote: true,
      applyUrl: 'https://andela.com/talent/',
      postedAt: new Date(),
    },
    {
      title: 'Cybersecurity Intern',
      company: 'KCB Group',
      location: 'Nairobi, Kenya',
      source: 'sample',
      externalId: 'sample-ke-4',
      description:
        'Support the information security team with vulnerability assessments, security log monitoring (SIEM), and documentation of security policies. Exposure to penetration testing and incident response processes.',
      skillsRequired: ['Networking', 'Linux', 'SIEM', 'Python', 'Security Fundamentals'],
      seniority: 'intern' as const,
      isRemote: false,
      applyUrl: 'https://kcbgroup.com/careers/',
      postedAt: new Date(),
    },
    {
      title: 'Product Design Intern',
      company: 'Mpesa Foundation Academy',
      location: 'Thika, Kenya',
      source: 'sample',
      externalId: 'sample-ke-5',
      description:
        'Conduct user research with students and teachers to redesign the learning management portal. Create wireframes, prototypes and usability test scripts. Work closely with the tech team to deliver hand-off-ready designs.',
      skillsRequired: ['Figma', 'User Research', 'Prototyping', 'UX Writing', 'Accessibility'],
      seniority: 'intern' as const,
      isRemote: false,
      applyUrl: 'https://www.mpesafoundationacademy.ac.ke/careers/',
      postedAt: new Date(),
    },
    {
      title: 'Machine Learning Intern',
      company: 'Africa AI Lab',
      location: 'Remote',
      source: 'sample',
      externalId: 'sample-ke-6',
      description:
        'Contribute to NLP and computer vision research projects focused on African languages and agricultural data. Help gather datasets, train models, write research summaries, and test model performance.',
      skillsRequired: ['Python', 'TensorFlow', 'PyTorch', 'NLP', 'Jupyter Notebooks'],
      seniority: 'intern' as const,
      isRemote: true,
      applyUrl: 'https://africaai.org/join',
      postedAt: new Date(),
    },
    {
      title: 'Business Analyst Intern',
      company: 'KPMG East Africa',
      location: 'Nairobi, Kenya',
      source: 'sample',
      externalId: 'sample-ke-7',
      description:
        'Support client engagements for digital transformation, fintech, and agribusiness projects. Conduct market research, create Excel/Power BI reports, and present findings to senior consultants.',
      skillsRequired: ['Excel', 'Power BI', 'SQL', 'Business Analysis', 'Report Writing'],
      seniority: 'intern' as const,
      isRemote: false,
      applyUrl: 'https://home.kpmg/ke/en/home/careers.html',
      postedAt: new Date(),
    },
    {
      title: 'DevOps / Cloud Intern',
      company: 'Liquid Intelligent Technologies',
      location: 'Nairobi, Kenya',
      source: 'sample',
      externalId: 'sample-ke-8',
      description:
        'Assist the cloud operations team with CI/CD pipeline setup, Kubernetes cluster management, and infrastructure-as-code using Terraform. Great exposure to Azure and AWS environments across the Africa network.',
      skillsRequired: ['Docker', 'Kubernetes', 'Terraform', 'Azure', 'Linux', 'CI/CD'],
      seniority: 'intern' as const,
      isRemote: false,
      applyUrl: 'https://www.liquidtelecom.com/about-us/careers.html',
      postedAt: new Date(),
    },
    {
      title: 'Backend Engineering Intern',
      company: 'Ajua (Powered by mSurvey)',
      location: 'Nairobi, Kenya',
      source: 'sample',
      externalId: 'sample-ke-9',
      description:
        'Help build and maintain REST microservices for our customer-experience platform used by businesses across Africa. Work with Node.js, PostgreSQL, and message queues in an agile team.',
      skillsRequired: ['Node.js', 'PostgreSQL', 'REST APIs', 'Docker', 'Git'],
      seniority: 'intern' as const,
      isRemote: true,
      applyUrl: 'https://ajua.com/careers/',
      postedAt: new Date(),
    },
    {
      title: 'Software Development Intern',
      company: 'Cellulant Africa',
      location: 'Nairobi, Kenya',
      source: 'sample',
      externalId: 'sample-ke-10',
      description:
        'Work on payment processing integrations across 18 African markets. Build and test API features, fix bugs, write documentation, and collaborate with QA engineers. Java and PHP experience is a plus.',
      skillsRequired: ['Java', 'PHP', 'REST APIs', 'MySQL', 'Git'],
      seniority: 'intern' as const,
      isRemote: false,
      applyUrl: 'https://cellulant.io/careers/',
      postedAt: new Date(),
    },
  ];

  await Internship.insertMany(samples);
  return { seeded: samples.length };
}
