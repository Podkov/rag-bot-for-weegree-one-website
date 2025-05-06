import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from 'dotenv';

// Konfiguracja zmiennych środowiskowych (standardowy .env lub zmienne systemowe)
const result = config();
if (result.error) {
  console.warn('No .env file loaded (continuing):', result.error);
}

// Sprawdzenie czy zmienne są poprawnie załadowane
console.log('Environment variables loaded:', {
  QDRANT_URL: process.env.QDRANT_URL ? 'Set' : 'Not set',
  QDRANT_API_KEY: process.env.QDRANT_API_KEY ? 'Set' : 'Not set',
  QDRANT_COLLECTION_NAME: process.env.QDRANT_COLLECTION_NAME || 'weegree_one'
});

const collectionName = process.env.QDRANT_COLLECTION_NAME || 'weegree_one';

async function deleteCollection() {
  console.log(`Próbuję usunąć kolekcję ${collectionName}...`);
  
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY
  });

  try {
    // Sprawdź czy kolekcja istnieje
    const collections = await qdrant.getCollections();
    const collectionExists = collections.collections.some(
      (collection) => collection.name === collectionName
    );

    if (collectionExists) {
      console.log(`Kolekcja ${collectionName} istnieje, usuwam...`);
      await qdrant.deleteCollection(collectionName);
      console.log(`Kolekcja ${collectionName} została pomyślnie usunięta.`);
    } else {
      console.log(`Kolekcja ${collectionName} nie istnieje, nie ma czego usuwać.`);
    }
  } catch (error) {
    console.error(`Błąd podczas usuwania kolekcji:`, error);
  }
}

deleteCollection().catch(err => {
  console.error('Błąd:', err);
  process.exit(1);
}); 