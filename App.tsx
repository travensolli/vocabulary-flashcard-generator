
import React, { useState } from 'react';
import { Header } from './components/Header';
import { GeneratorForm } from './components/GeneratorForm';
import { ImageGrid } from './components/ImageGrid';
import { Spinner } from './components/Spinner';
import { generateFlashcard } from './services/geminiService';
import type { CardData } from './types';
import { parseItems, DEFAULT_MAX_ITEMS } from './utils/items';

const App: React.FC = () => {
  const [generatedCards, setGeneratedCards] = useState<CardData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const CONCURRENCY_LIMIT = 4;

  const handleGenerate = async (inputText: string) => {
    setIsLoading(true);
    setError(null);
    setGeneratedCards([]);

    const items = parseItems(inputText, DEFAULT_MAX_ITEMS);

    if (items.length === 0) {
      setError("Please enter at least one item to generate.");
      setIsLoading(false);
      return;
    }

    try {
      const results: CardData[] = [];
      const failures: string[] = [];

      for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
        const batch = items.slice(i, i + CONCURRENCY_LIMIT);

        const settled = await Promise.allSettled(
          batch.map(async (item) => ({ url: await generateFlashcard(item), name: item }))
        );

        settled.forEach((result, idx) => {
          const currentItem = batch[idx];
          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            failures.push(currentItem);
          }
        });
      }

      if (results.length === 0) {
        setError("Failed to generate images. Please ensure your API key is correctly configured and try again.");
        return;
      }

      if (failures.length > 0) {
        setError(`Could not generate flashcards for: ${failures.join(", ")}`);
      }

      setGeneratedCards(results);
    } catch (e) {
      console.error(e);
      setError("Failed to generate images. Please ensure your API key is correctly configured and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans text-gray-800 antialiased">
      <Header />
      <main className="container mx-auto px-4 py-8 md:py-12">
        <GeneratorForm onGenerate={handleGenerate} isLoading={isLoading} />

        <div className="mt-12">
          {isLoading && (
            <div className="flex flex-col items-center justify-center text-center">
              <Spinner />
              <p className="mt-4 text-lg text-gray-600">Generating your flashcards...</p>
              <p className="text-sm text-gray-500">This may take a moment.</p>
            </div>
          )}
          {error && (
            <div className="text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert">
              <strong className="font-bold">Oops!</strong>
              <span className="block sm:inline ml-2">{error}</span>
            </div>
          )}
          {!isLoading && generatedCards.length > 0 && (
            <ImageGrid cards={generatedCards} />
          )}
          {!isLoading && !error && generatedCards.length === 0 && (
            <div className="text-center text-gray-500 py-16 px-6 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                <h2 className="text-2xl font-semibold text-gray-700 mb-2">Welcome to the Flashcard Generator!</h2>
                <p className="max-w-2xl mx-auto">
                    Enter a list of words in the box above to create beautiful, print-ready vocabulary cards for kids.
                    For example: <span className="font-mono bg-gray-200 text-gray-800 py-1 px-2 rounded">apple, book, car</span>
                </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
