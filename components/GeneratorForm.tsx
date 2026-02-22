
import React, { useState } from 'react';
import { SparklesIcon } from './Icons';

interface GeneratorFormProps {
  onGenerate: (inputText: string) => void;
  isLoading: boolean;
}

const initialItems = "Guitar, drums, electric guitar, flute, piano, violin, cello";

export const GeneratorForm: React.FC<GeneratorFormProps> = ({ onGenerate, isLoading }) => {
  const [inputText, setInputText] = useState<string>(initialItems);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(inputText);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-lg">
      <form onSubmit={handleSubmit}>
        <label htmlFor="items-input" className="block text-lg font-semibold text-gray-700 mb-2">
          Items to Generate
        </label>
        <p className="text-sm text-gray-500 mb-4">
          Enter a comma-separated list of words you want to turn into flashcards.
        </p>
        <textarea
          id="items-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="e.g., apple, banana, car, house"
          className="w-full h-28 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out resize-y"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </>
          ) : (
            <>
              <SparklesIcon className="w-5 h-5 mr-2" />
              Generate Flashcards
            </>
          )}
        </button>
      </form>
    </div>
  );
};
