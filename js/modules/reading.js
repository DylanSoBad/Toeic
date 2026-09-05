import { ContentLoader } from './content-loader.js';
import { createPracticeUI } from './quiz-engine.js';

export const ReadingUI = createPracticeUI({ containerId: 'readingContent', skill: 'reading',
  defaultPart: 5, loadData: part => ContentLoader.getReadingData(part) });
