
import React from 'react';
import type { CardData } from '../types';
import { DownloadIcon } from './Icons';

interface ImageGridProps {
  cards: CardData[];
  isColored: boolean;
  realism: number;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ cards, isColored, realism }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
      {cards.map((card) => {
        const cardKey = card.name.trim().toLowerCase().replace(/\s+/g, "-") || card.url;
        const safeName = card.name.replace(/\s+/g, '_').toLowerCase();
        const colorSuffix = isColored ? '_color' : '';
        const downloadName = `${safeName}_r${realism}${colorSuffix}_flashcard.png`;
        return (
          <div key={cardKey} className="group relative bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden transition-shadow duration-300 hover:shadow-xl">
            <img
              src={card.url}
              alt={`Flashcard for ${card.name}`}
              className="w-full h-auto aspect-square object-contain p-4"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
              <a
                href={card.url}
                download={downloadName}
                className="flex items-center gap-2 bg-white text-gray-800 font-semibold py-2 px-4 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-300"
              >
                <DownloadIcon className="w-5 h-5" />
                Download
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

