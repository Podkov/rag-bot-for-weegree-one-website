import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import { join, resolve } from 'path';

// Konfiguracja zmiennych środowiskowych z pliku .env
const envPath = resolve(process.cwd(), 'D:/Workspace/AI Projects/rag-bot-for-weegree-one-website/src/.env');
const result = config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

// Sprawdzenie czy zmienne są poprawnie załadowane
console.log('Environment variables loaded:', {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Not set',
  QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
  QDRANT_COLLECTION_NAME: process.env.QDRANT_COLLECTION_NAME || 'weegree_one'
});

// Inicjalizacja aplikacji Express i ustawienie portu
const app = express();
const port = process.env.PORT || 3000;

// Interfejsy TypeScript definiujące strukturę danych
interface QuestionRequest {
  question: string;
}

interface SearchResult {
  payload?: {
    content: string;
    title: string;
    url: string;
    isFaq?: boolean;
  };
  score: number;
}

// Inicjalizacja klientów do komunikacji z zewnętrznymi serwisami
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware do obsługi CORS i parsowania JSON
app.use(cors());
app.use(express.json());

/**
 * Inicjalizuje kolekcję w Qdrant jeśli nie istnieje
 */
async function initCollection() {
  try {
    const collectionName = process.env.QDRANT_COLLECTION_NAME || 'weegree_one';
    const collections = await qdrant.getCollections();
    const collectionExists = collections.collections.some(
      (collection) => collection.name === collectionName
    );

    if (!collectionExists) {
      console.log(`Creating collection: ${collectionName}`);
      await qdrant.createCollection(collectionName, {
        vectors: {
          size: 1536, // OpenAI text-embedding-3-small wymiar
          distance: "Cosine"
        }
      });
      console.log("Collection created successfully");
    } else {
      console.log(`Collection ${collectionName} already exists`);
    }
  } catch (error) {
    console.error("Error initializing collection:", error);
    process.exit(1);
  }
}

// Inicjalizacja kolekcji przy starcie
initCollection();

/**
 * Generuje embedding dla tekstu używając OpenAI API
 * Embedding to wektor liczb reprezentujący semantyczne znaczenie tekstu
 */
async function getEmbedding(text: string): Promise<number[]> {
  console.log('[getEmbedding] Generowanie embeddingu dla tekstu (pierwsze 100 znaków):', text.slice(0, 100));
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });
  const embedding = response.data[0].embedding;
  console.log('[getEmbedding] Długość embeddingu:', embedding.length, '| Przykład:', embedding.slice(0, 3));
  return embedding;
}

/**
 * Wyszukuje najbardziej odpowiednie fragmenty tekstu w bazie Qdrant
 * Używa embeddingu pytania do znalezienia podobnych fragmentów
 */
async function searchRelevantChunks(query: string, limit: number = 5): Promise<SearchResult[]> {
  console.log('[searchRelevantChunks] Szukam fragmentów dla pytania:', query);
  const queryEmbedding = await getEmbedding(query);
  
  // Obniżamy próg podobieństwa i zwiększamy limit dla lepszego pokrycia
  const searchResults = await qdrant.search(
    process.env.QDRANT_COLLECTION_NAME || 'weegree_one',
    {
      vector: queryEmbedding,
      limit: 10,
      score_threshold: 0.65 // Obniżamy próg podobieństwa
    }
  );
  console.log('[searchRelevantChunks] Liczba trafionych fragmentów:', searchResults.length);
  
  if (searchResults.length > 0) {
    console.log('[searchRelevantChunks] Wyniki wyszukiwania:');
    
    // Sortujemy wyniki - najpierw FAQ, potem według score
    const sortedResults = [...searchResults].sort((a, b) => {
      const aIsFaq = a.payload?.isFaq === true;
      const bIsFaq = b.payload?.isFaq === true;
      
      if (aIsFaq && !bIsFaq) return -1;
      if (!aIsFaq && bIsFaq) return 1;
      return b.score - a.score;
    });
    
    // Bierzemy tylko najlepsze wyniki po sortowaniu
    const bestResults = sortedResults.slice(0, limit);
    
    bestResults.forEach((result, i) => {
      console.log(`[searchRelevantChunks] Trafienie #${i+1} (score: ${result.score.toFixed(4)}) ${result.payload?.isFaq ? '📋 FAQ' : '📄 Tekst'}:`);
      console.log(`  Tytuł: ${result.payload?.title}`);
      console.log(`  URL: ${result.payload?.url}`);
      if (result.payload?.isFaq) {
        console.log(`  Fragment FAQ (150 znaków): ${(result.payload?.content as string)?.slice(0, 150).replace(/\n/g, ' ')}...`);
      } else {
        console.log(`  Fragment (100 znaków): ${(result.payload?.content as string)?.slice(0, 100).replace(/\n/g, ' ')}...`);
      }
    });
    
    return bestResults as SearchResult[];
  } else {
    console.warn('[searchRelevantChunks] UWAGA: Nie znaleziono żadnych fragmentów dla pytania!');
    return [];
  }
}

/**
 * Generuje odpowiedź na pytanie używając GPT-4
 * Wykorzystuje znalezione fragmenty jako kontekst
 */
async function generateAnswer(question: string, context: string): Promise<string> {
  console.log('[generateAnswer] Generuję odpowiedź dla pytania:', question);
  console.log('[generateAnswer] Długość kontekstu:', context.length, 'znaków');
  
  // Szukaj w kontekście kluczowych słów z pytania
  const questionWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  console.log('[generateAnswer] Kluczowe słowa z pytania:', questionWords);
  
  let matchedWords = 0;
  questionWords.forEach(word => {
    if (context.toLowerCase().includes(word)) {
      console.log(`[generateAnswer] Znaleziono słowo kluczowe "${word}" w kontekście`);
      matchedWords++;
    }
  });
  
  console.log(`[generateAnswer] Dopasowano ${matchedWords}/${questionWords.length} słów kluczowych w kontekście`);
  console.log('[generateAnswer] Fragment kontekstu (pierwsze 300 znaków):', context.slice(0, 300).replace(/\n/g, ' '));
  
  const systemPrompt = "You are a helpful assistant that answers questions about Weegree One robots. Answer in Polish language only. If you cannot find the answer in the provided context, say 'Nie mam wystarczających informacji, aby odpowiedzieć na to pytanie.'";
  
  const prompt = `
    Based on the following context, please answer the question.
    If you cannot find the answer in the context, say "Nie mam wystarczających informacji, aby odpowiedzieć na to pytanie."
    
    Context:
    ${context}
    
    Question: ${question}
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ]
  });
  const answer = completion.choices[0].message.content || "Przepraszam, nie mogę wygenerować odpowiedzi.";
  console.log('[generateAnswer] Odpowiedź OpenAI:', answer);
  return answer;
}

/**
 * Endpoint do obsługi pytań
 * Używa wzorca z wewnętrzną funkcją asynchroniczną, aby uniknąć problemów z typowaniem Express
 * 
 * Struktura obsługi requestu:
 * 1. Pobiera pytanie z body requestu
 * 2. Wyszukuje odpowiednie fragmenty w bazie Qdrant
 * 3. Generuje odpowiedź używając GPT-4
 * 4. Zwraca odpowiedź wraz ze źródłami
 */
app.post('/ask', (req, res) => {
  // Wewnętrzna funkcja asynchroniczna do obsługi requestu
  const handleRequest = async () => {
    try {
      // Walidacja i pobranie pytania
      const { question } = req.body as QuestionRequest;
      console.log('[POST /ask] Otrzymano pytanie:', question);
      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }

      // Przetwarzamy oryginalne pytanie na wersję bez znaków specjalnych do lepszego wyszukiwania
      const cleanQuestion = question.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
      console.log('[POST /ask] Oczyszczone pytanie do wyszukiwania:', cleanQuestion);

      // Wyszukanie odpowiednich fragmentów
      const relevantChunks = await searchRelevantChunks(cleanQuestion, 7); // Zwiększam limit
      
      if (relevantChunks.length === 0) {
        console.warn('[POST /ask] UWAGA: Brak wyników wyszukiwania! Zwracam odpowiedź awaryjną.');
        return res.json({
          answer: "Nie mam wystarczających informacji, aby odpowiedzieć na to pytanie.",
          sources: []
        });
      }
      
      const context = relevantChunks
        .map(chunk => (chunk.payload as SearchResult['payload'])?.content)
        .filter(Boolean)
        .join('\n\n');

      // Generowanie odpowiedzi
      const answer = await generateAnswer(question, context);

      // Przygotowanie źródeł
      const sources = relevantChunks
        .map(chunk => ({
          title: (chunk.payload as SearchResult['payload'])?.title,
          url: (chunk.payload as SearchResult['payload'])?.url
        }))
        .filter(source => source.title && source.url);

      console.log('[POST /ask] Zwracane źródła:', sources.length);
      console.log('[POST /ask] Odpowiedź gotowa, wysyłam do klienta.');

      // Zwrócenie odpowiedzi ze źródłami
      res.json({
        answer,
        sources
      });
    } catch (error) {
      console.error('Error processing question:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Wywołanie funkcji obsługującej request
  handleRequest();
});

// Uruchomienie serwera na określonym porcie
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 