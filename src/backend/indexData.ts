import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import { config } from 'dotenv';
import { readdirSync, readFileSync } from 'fs';
import { join, resolve, basename } from 'path';

// Wczytaj zmienne środowiskowe
const envPath = resolve(process.cwd(), 'D:/Workspace/AI Projects/rag-bot-for-weegree-one-website/src/.env');
config({ path: envPath });

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const collectionName = process.env.QDRANT_COLLECTION_NAME || 'weegree_one';
const VECTOR_SIZE = 1536; // Rozmiar wektora dla OpenAI text-embedding-3-small
const CHUNK_SIZE = 500; // Zwiększam rozmiar chunka
const CHUNK_OVERLAP = 200; // Nakładanie się chunków

/**
 * Generuje unikalne ID dla punktu w Qdrant
 */
function generatePointId(fileId: string, chunkId: number): number {
  // Konwertuje string na liczbę za pomocą prostego hashowania
  let hash = 0;
  for (let i = 0; i < fileId.length; i++) {
    hash = ((hash << 5) - hash) + fileId.charCodeAt(i);
    hash = hash & hash; // Konwersja do 32bit integer
  }
  // Dodaj indeks chunka aby wszystkie ID były unikalne
  return Math.abs(hash) * 1000 + chunkId;
}

/**
 * Inicjalizuje kolekcję w Qdrant jeśli nie istnieje, lub sprawdza czy ma odpowiedni rozmiar wektora
 */
async function initializeCollection() {
  try {
    console.log(`[indexData] Sprawdzanie kolekcji ${collectionName}...`);
    
    // Sprawdź czy kolekcja istnieje
    const collections = await qdrant.getCollections();
    const collectionExists = collections.collections.some(
      (collection) => collection.name === collectionName
    );

    // Jeśli kolekcja istnieje, sprawdź jej konfigurację
    if (collectionExists) {
      const collectionInfo = await qdrant.getCollection(collectionName);
      const vectorSize = collectionInfo.config?.params?.vectors?.size;
      
      if (vectorSize === VECTOR_SIZE) {
        console.log(`[indexData] Kolekcja ${collectionName} istnieje i ma prawidłowy rozmiar wektora (${VECTOR_SIZE}).`);
        return true;
      } else {
        console.log(`[indexData] Kolekcja ${collectionName} istnieje, ale ma niewłaściwy rozmiar wektora (${vectorSize} zamiast ${VECTOR_SIZE}).`);
        console.log(`[indexData] Usuwanie istniejącej kolekcji...`);
        await qdrant.deleteCollection(collectionName);
        console.log(`[indexData] Kolekcja usunięta.`);
        // Kontynuuj z tworzeniem nowej kolekcji
      }
    }

    // Tworzenie kolekcji
    console.log(`[indexData] Tworzenie kolekcji ${collectionName} z rozmiarem wektora ${VECTOR_SIZE}...`);
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine"
      }
    });
    console.log(`[indexData] Kolekcja utworzona pomyślnie.`);
    return true;
  } catch (error) {
    console.error(`[indexData] Błąd podczas inicjalizacji kolekcji:`, error);
    return false;
  }
}

// Chunkowanie tekstu na fragmenty po ~300 znaków (mniejsze chunki)
function chunkText(text: string, chunkSize = CHUNK_SIZE): string[] {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize;
  }
  return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return response.data[0].embedding;
}

/**
 * Inteligentny chunking dla FAQ - wyodrębnia pytania i odpowiedzi jako całość
 */
function extractFaqChunks(content: string): {chunks: string[], isFaq: boolean[]} {
  const chunks = [];
  const isFaq = [];
  
  // Wyodrębnianie sekcji FAQ z formatu markdown
  const faqRegex = /#### \[([^\]]+)\]\([^)]+\)([^#]*?)(?=#### \[|\n## |$)/g;
  let match;
  let lastIndex = 0;
  
  // Zbieramy wszystkie dopasowania FAQ
  while ((match = faqRegex.exec(content)) !== null) {
    // Dodajemy tekst przed FAQ jako normalny chunk
    if (match.index > lastIndex) {
      const normalText = content.substring(lastIndex, match.index);
      const normalChunks = chunkTextWithOverlap(normalText, CHUNK_SIZE, CHUNK_OVERLAP);
      chunks.push(...normalChunks);
      isFaq.push(...Array(normalChunks.length).fill(false));
    }
    
    // Dodajemy całe pytanie FAQ i odpowiedź jako osobny chunk
    const question = match[1];
    const answer = match[2].trim();
    const faqChunk = `#### [${question}] \n${answer}`;
    chunks.push(faqChunk);
    isFaq.push(true);
    
    lastIndex = match.index + match[0].length;
  }
  
  // Dodajemy pozostały tekst po ostatnim FAQ
  if (lastIndex < content.length) {
    const normalText = content.substring(lastIndex);
    const normalChunks = chunkTextWithOverlap(normalText, CHUNK_SIZE, CHUNK_OVERLAP);
    chunks.push(...normalChunks);
    isFaq.push(...Array(normalChunks.length).fill(false));
  }
  
  return { chunks, isFaq };
}

/**
 * Chunking tekstu z nakładaniem się fragmentów
 */
function chunkTextWithOverlap(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += (chunkSize - overlap);
  }
  return chunks;
}

async function indexMarkdownFiles() {
  // Inicjalizacja kolekcji przed indeksowaniem
  const initialized = await initializeCollection();
  if (!initialized) {
    console.error('[indexData] Nie udało się zainicjalizować kolekcji. Przerywam indeksowanie.');
    return;
  }

  const markdownDir = resolve(__dirname, '../../data/markdown');
  const files = readdirSync(markdownDir).filter(f => f.endsWith('.md'));
  console.log(`[indexData] Znaleziono plików markdown: ${files.length}`);

  for (const file of files) {
    const filePath = join(markdownDir, file);
    const url = `https://weegreeone.com/${file.replace(/\.md$/, '')}`;
    const title = basename(file, '.md');
    const content = readFileSync(filePath, 'utf-8');
    
    // Używamy inteligentnego chunkingu dla FAQ
    const { chunks, isFaq } = extractFaqChunks(content);
    console.log(`[indexData] Plik: ${file} | Tytuł: ${title} | URL: ${url} | Liczba chunków: ${chunks.length} (w tym FAQ: ${isFaq.filter(Boolean).length})`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // Oczyść chunk z potencjalnie problematycznych znaków
      const cleanChunk = chunk.replace(/[\r\n]+/g, ' ').trim();
      const embedding = await getEmbedding(cleanChunk);
      const pointId = generatePointId(file, i);
      
      console.log(`[indexData]  - Chunk #${i + 1} | ${isFaq[i] ? 'FAQ' : 'Tekst'} | Długość: ${cleanChunk.length} | Długość embeddingu: ${embedding.length} | ID: ${pointId}`);
      if (isFaq[i]) {
        console.log(`[indexData]  - Fragment FAQ: ${cleanChunk.slice(0, 150).replace(/\n/g, ' ')}...`);
      } else {
        console.log(`[indexData]  - Fragment: ${cleanChunk.slice(0, 100).replace(/\n/g, ' ')}...`);
      }

      try {
        // Wstaw do Qdrant z liczbowym ID
        await qdrant.upsert(collectionName, {
          points: [
            {
              id: pointId,
              vector: embedding,
              payload: {
                content: cleanChunk,
                title,
                url,
                isFaq: isFaq[i] // Dodajemy flagę czy to jest FAQ
              }
            }
          ]
        });
        console.log(`[indexData]  - Zindeksowano chunk #${i + 1} do Qdrant.`);
      } catch (error) {
        console.error(`[indexData]  - Błąd podczas indeksowania chunka #${i + 1}:`, error);
        console.log(`[indexData]  - Sprawdzanie statusu API Qdrant...`);
        
        try {
          // Spróbuj wykonać prostą operację aby sprawdzić API
          const collections = await qdrant.getCollections();
          console.log(`[indexData]  - API Qdrant działa: ${collections.collections.length} kolekcji`);
          console.log(`[indexData]  - To może być problem z ograniczeniami planu Qdrant Cloud`);
        } catch (apiError) {
          console.error(`[indexData]  - Problem z API Qdrant:`, apiError);
        }
        
        // Po pierwszym błędzie zatrzymaj proces - ograniczenia API
        console.log(`[indexData]  - Przerywam indeksowanie - sprawdź plan Qdrant Cloud i limity API`);
        return;
      }
    }
  }
  console.log('[indexData] Indeksowanie zakończone.');
}

indexMarkdownFiles().catch(err => {
  console.error('[indexData] Błąd podczas indeksowania:', err);
  process.exit(1);
}); 