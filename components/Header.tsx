
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 py-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
          Vocabulary Flashcard Generator
        </h1>
        <p className="mt-2 text-md md:text-lg text-gray-600">
          AI-powered learning tools for kids
        </p>
      </div>
    </header>
  );
};
