import type { ChoiceIndex, QuestionPublic } from '@nodigloo/shared';

export interface QuizQuestion extends QuestionPublic {
  correctChoice: ChoiceIndex;
}

export const QUESTION_BANK: QuizQuestion[] = [
  {
    id: 'q01',
    text: 'Quelle est la capitale du Portugal ?',
    choices: ['Porto', 'Lisbonne', 'Coimbra', 'Braga'],
    correctChoice: 1,
  },
  {
    id: 'q02',
    text: 'Quelle planète est surnommée la planète rouge ?',
    choices: ['Mars', 'Vénus', 'Mercure', 'Jupiter'],
    correctChoice: 0,
  },
  {
    id: 'q03',
    text: 'Quelle est la formule chimique de l’eau ?',
    choices: ['CO2', 'H2O', 'O2', 'NaCl'],
    correctChoice: 1,
  },
  {
    id: 'q04',
    text: 'Quel est le plus grand océan du monde ?',
    choices: ['Atlantique', 'Indien', 'Arctique', 'Pacifique'],
    correctChoice: 3,
  },
  {
    id: 'q05',
    text: 'En quelle année commence la Révolution française ?',
    choices: ['1776', '1789', '1815', '1848'],
    correctChoice: 1,
  },
  {
    id: 'q06',
    text: 'Quel est le symbole chimique de l’or ?',
    choices: ['Ag', 'Or', 'Au', 'Fe'],
    correctChoice: 2,
  },
  {
    id: 'q07',
    text: 'Qui a écrit le roman Les Misérables ?',
    choices: ['Émile Zola', 'Jules Verne', 'Victor Hugo', 'Molière'],
    correctChoice: 2,
  },
  {
    id: 'q08',
    text: 'Quel est le satellite naturel de la Terre ?',
    choices: ['Phobos', 'La Lune', 'Europe', 'Titan'],
    correctChoice: 1,
  },
  {
    id: 'q09',
    text: 'Quel est le plus vaste désert du monde, tous types confondus ?',
    choices: ['Sahara', 'Gobi', 'Kalahari', 'Antarctique'],
    correctChoice: 3,
  },
  {
    id: 'q10',
    text: 'Dans quel pays se trouve la ville d’Ottawa ?',
    choices: ['Australie', 'Canada', 'Irlande', 'Nouvelle-Zélande'],
    correctChoice: 1,
  },
  {
    id: 'q11',
    text: 'Quel est l’animal terrestre le plus rapide ?',
    choices: ['Guépard', 'Lion', 'Autruche', 'Antilope'],
    correctChoice: 0,
  },
  {
    id: 'q12',
    text: 'Combien de côtés possède un hexagone ?',
    choices: ['Cinq', 'Six', 'Sept', 'Huit'],
    correctChoice: 1,
  },
  {
    id: 'q13',
    text: 'Quel gaz les plantes absorbent-elles pour la photosynthèse ?',
    choices: ['Oxygène', 'Azote', 'Dioxyde de carbone', 'Hélium'],
    correctChoice: 2,
  },
  {
    id: 'q14',
    text: 'Quelle est l’étoile la plus proche de la Terre ?',
    choices: ['Sirius', 'Proxima du Centaure', 'Le Soleil', 'Véga'],
    correctChoice: 2,
  },
  {
    id: 'q15',
    text: 'Quelle langue est principalement parlée au Brésil ?',
    choices: ['Espagnol', 'Portugais', 'Français', 'Italien'],
    correctChoice: 1,
  },
  {
    id: 'q16',
    text: 'Qui a écrit Le Petit Prince ?',
    choices: [
      'Antoine de Saint-Exupéry',
      'Albert Camus',
      'Jules Verne',
      'Marcel Pagnol',
    ],
    correctChoice: 0,
  },
  {
    id: 'q17',
    text: 'Quelle est la plus grande planète du système solaire ?',
    choices: ['Saturne', 'Neptune', 'Jupiter', 'Uranus'],
    correctChoice: 2,
  },
  {
    id: 'q18',
    text: 'Quelle est la monnaie officielle du Japon ?',
    choices: ['Won', 'Yuan', 'Yen', 'Baht'],
    correctChoice: 2,
  },
  {
    id: 'q19',
    text: 'Combien de notes différentes compte une gamme diatonique majeure ?',
    choices: ['Cinq', 'Six', 'Sept', 'Huit'],
    correctChoice: 2,
  },
  {
    id: 'q20',
    text: 'Quel organe propulse le sang dans le corps humain ?',
    choices: ['Le foie', 'Le cœur', 'Le poumon', 'Le rein'],
    correctChoice: 1,
  },
];
