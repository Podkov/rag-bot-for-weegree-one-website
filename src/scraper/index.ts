import FirecrawlApp from '@mendable/firecrawl-js';
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { config } from 'dotenv';

// Konfiguracja zmiennych środowiskowych z pliku .env
const envPath = resolve(process.cwd(), 'D:/Workspace/AI Projects/rag-bot-for-weegree-one-website/src/.env');
const result = config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

// Sprawdzenie czy zmienne są poprawnie załadowane
console.log('Environment variables loaded:', {
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY ? 'Set' : 'Not set'
});

const BASE_URL = 'https://weegreeone.com/roboty-dla-firm/';

interface CrawlResponseItem {
  markdown: string;
  metadata?: {
    url?: string;
    // inne pola
  };
}

// Funkcja do zapisywania pliku markdown
function saveMarkdownFile(url: string = "", markdown: string): void {
  if (!url) return; // Jeśli url jest pusty, pomijamy ten plik
  
  // Pobierz nazwę endpointu z URL
  const endpoint = basename(url).replace(/\/$/, '');
  const markdownPath = join(__dirname, '../../data/markdown', `${endpoint}.md`);
  const markdownDir = dirname(markdownPath);

  // Utworzenie katalogu jeśli nie istnieje
  if (!existsSync(markdownDir)) {
    console.log(`Creating directory: ${markdownDir}`);
    mkdirSync(markdownDir, { recursive: true });
  }

  // Usunięcie istniejącego pliku jeśli istnieje
  if (existsSync(markdownPath)) {
    console.log(`Removing existing markdown file: ${markdownPath}`);
    unlinkSync(markdownPath);
  }

  // Zapisywanie pliku markdown
  writeFileSync(markdownPath, markdown);
  console.log(`Saved markdown file: ${markdownPath}`);
}

async function scrapeWithFirecrawl() {
  const app = new FirecrawlApp({
    apiKey: process.env.FIRECRAWL_API_KEY
  });

  try {
    // Crawl website with markdown format
    const crawlResponse = await app.crawlUrl(BASE_URL, {
      limit: 50, // Limit number of pages
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true
      }
    });

    if (!crawlResponse.success) {
      throw new Error(`Failed to crawl: ${crawlResponse.error}`);
    }

    // Przygotowanie ścieżki i katalogu dla JSON
    const outputPath = join(__dirname, '../../data/scraped-content.json');
    const outputDir = dirname(outputPath);

    // Utworzenie katalogu jeśli nie istnieje
    if (!existsSync(outputDir)) {
      console.log(`Creating directory: ${outputDir}`);
      mkdirSync(outputDir, { recursive: true });
    }

    // Usunięcie istniejącego pliku jeśli istnieje
    if (existsSync(outputPath)) {
      console.log(`Removing existing file: ${outputPath}`);
      unlinkSync(outputPath);
    }

    // Zapisywanie wyników JSON
    writeFileSync(outputPath, JSON.stringify(crawlResponse.data, null, 2));
    console.log(`Successfully scraped website and saved to ${outputPath}`);

    // Zapisywanie plików markdown dla każdej strony
    for (const page of crawlResponse.data as CrawlResponseItem[]) {
      if (page.metadata?.url) {
        // Użyj bezpiecznego cast-u do string
        const url = page.metadata.url as string;
        saveMarkdownFile(url, page.markdown);
      }
    }

    return crawlResponse.data;
  } catch (error) {
    console.error('Scraping failed:', error);
    process.exit(1);
  }
}

// Run scraper
scrapeWithFirecrawl(); 