import { ContentLoader } from './content-loader.js';
import { createPracticeUI } from './quiz-engine.js';

export const ListeningUI = createPracticeUI({ containerId: 'listeningContent', skill: 'listening',
  defaultPart: 1, loadData: part => ContentLoader.getListeningData(part) });
