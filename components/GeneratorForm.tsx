
import React, { useState } from 'react';
import { SparklesIcon } from './Icons';

interface GeneratorFormProps {
  onGenerate: (inputText: string) => void;
  isLoading: boolean;
  isColored: boolean;
  onColorChange: (colored: boolean) => void;
  realism: number;
  onRealismChange: (level: number) => void;
}

const initialItems = "Guitar, drums, electric guitar, flute, piano, violin, cello";

const REALISM_LABELS: Record<number, string> = {
  1: 'Cartoon',
  2: 'Stylized',
  3: 'Standard',
  4: 'Detailed',
  5: 'Photorealistic',
};

export const GeneratorForm: React.FC<GeneratorFormProps> = ({ onGenerate, isLoading, isColored, onColorChange, realism, onRealismChange }) => {
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
        <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">🎨</span>
            <label htmlFor="color-toggle" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
              Colored flashcards
            </label>
          </div>
          <button
            id="color-toggle"
            type="button"
            role="switch"
            aria-checked={isColored}
            onClick={() => onColorChange(!isColored)}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isColored ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isColored ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">🎯</span>
              <label htmlFor="realism-slider" className="text-sm font-medium text-gray-700 select-none">
                Realism / Fidelity
              </label>
            </div>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {REALISM_LABELS[realism]}
            </span>
          </div>
          <input
            id="realism-slider"
            type="range"
            min={1}
            max={5}
            step={1}
            value={realism}
            onChange={(e) => onRealismChange(Number(e.target.value))}
            disabled={isLoading}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between mt-1 px-0.5">
            {[1, 2, 3, 4, 5].map((level) => (
              <span
                key={level}
                className={`text-[10px] cursor-pointer select-none transition-colors ${realism === level ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}
                onClick={() => !isLoading && onRealismChange(level)}
              >
                {REALISM_LABELS[level]}
              </span>
            ))}
          </div>
        </div>
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

