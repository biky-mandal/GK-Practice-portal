import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { Question } from '../models/Question.js';

const questions = [
  {
    questionText: 'The Constitution of India came into effect on which date?',
    options: ['26 January 1950', '15 August 1947', '26 November 1949', '1 January 1951'],
    correctOption: 0,
    explanation: 'The Constitution of India was adopted on 26 November 1949 and came into force on 26 January 1950.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Indian Polity',
    topic: 'Constitution',
    tags: ['constitution', 'india'],
    isActive: true
  },
  {
    questionText: 'Who is known as the Father of the Indian Constitution?',
    options: ['Jawaharlal Nehru', 'B. R. Ambedkar', 'Mahatma Gandhi', 'Sardar Patel'],
    correctOption: 1,
    explanation: 'Dr. B. R. Ambedkar chaired the Drafting Committee and is widely recognised as the chief architect of the Indian Constitution.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Indian Polity',
    topic: 'Founding Fathers',
    tags: ['constitution', 'ambedkar'],
    isActive: true
  },
  {
    questionText: 'Which article of the Constitution guarantees the Right to Equality?',
    options: ['Article 14', 'Article 19', 'Article 21', 'Article 32'],
    correctOption: 0,
    explanation: 'Article 14 of the Constitution guarantees equality before the law and equal protection of the laws.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'Indian Polity',
    topic: 'Fundamental Rights',
    tags: ['rights', 'article'],
    isActive: true
  },
  {
    questionText: 'Which state has the largest population according to the 2011 Census?',
    options: ['Maharashtra', 'Uttar Pradesh', 'Bihar', 'West Bengal'],
    correctOption: 1,
    explanation: 'Uttar Pradesh is the most populous state in India, according to the 2011 Census.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Geography',
    topic: 'States',
    tags: ['population', 'india'],
    isActive: true
  },
  {
    questionText: 'The largest desert in India is:',
    options: ['Gobi Desert', 'Thar Desert', 'Kalahari Desert', 'Sahara Desert'],
    correctOption: 1,
    explanation: 'The Thar Desert, also known as the Great Indian Desert, is the largest desert in India.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Geography',
    topic: 'Deserts',
    tags: ['desert', 'india'],
    isActive: true
  },
  {
    questionText: 'The famous Gol Gumbaz is located in:',
    options: ['Delhi', 'Agra', 'Bijapur', 'Jaipur'],
    correctOption: 2,
    explanation: 'Gol Gumbaz is a historic mausoleum in Bijapur, Karnataka.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'History',
    topic: 'Monuments',
    tags: ['heritage', 'karnataka'],
    isActive: true
  },
  {
    questionText: 'Who was the first President of India?',
    options: ['Rajendra Prasad', 'Sarvepalli Radhakrishnan', 'Zakir Husain', 'V. V. Giri'],
    correctOption: 0,
    explanation: 'Dr. Rajendra Prasad served as the first President of India from 1950 to 1962.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Indian Polity',
    topic: 'Executive',
    tags: ['president', 'india'],
    isActive: true
  },
  {
    questionText: 'Which Indian city is known as the Pink City?',
    options: ['Jaipur', 'Jodhpur', 'Udaipur', 'Bikaner'],
    correctOption: 0,
    explanation: 'Jaipur is known as the Pink City because of its distinct pink-coloured buildings.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Geography',
    topic: 'Cities',
    tags: ['jaipur', 'city'],
    isActive: true
  },
  {
    questionText: 'The currency of Japan is:',
    options: ['Won', 'Yen', 'Baht', 'Ringgit'],
    correctOption: 1,
    explanation: 'The official currency of Japan is the Japanese Yen.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Economy',
    topic: 'Global Finance',
    tags: ['currency', 'japan'],
    isActive: true
  },
  {
    questionText: 'Which gas is most abundant in the Earth’s atmosphere?',
    options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
    correctOption: 2,
    explanation: 'Nitrogen makes up about 78% of the Earth’s atmosphere by volume.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'General Science',
    topic: 'Atmosphere',
    tags: ['science', 'atmosphere'],
    isActive: true
  },
  {
    questionText: 'The process by which plants make their own food is called:',
    options: ['Respiration', 'Photosynthesis', 'Transpiration', 'Digestion'],
    correctOption: 1,
    explanation: 'Photosynthesis is the process by which green plants synthesize food using sunlight, water and carbon dioxide.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'General Science',
    topic: 'Botany',
    tags: ['plants', 'biology'],
    isActive: true
  },
  {
    questionText: 'The River Brahmaputra enters India through which state?',
    options: ['Arunachal Pradesh', 'Assam', 'Meghalaya', 'Nagaland'],
    correctOption: 0,
    explanation: 'The Brahmaputra enters India through Arunachal Pradesh and then flows through Assam.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'Assam GK',
    topic: 'Rivers',
    tags: ['assam', 'brahmaputra'],
    isActive: true
  },
  {
    questionText: 'The capital of Assam is:',
    options: ['Silchar', 'Guwahati', 'Tezpur', 'Jorhat'],
    correctOption: 1,
    explanation: 'Guwahati is the largest city and the principal city of Assam, and the state capital is Dispur, a part of Guwahati.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Assam GK',
    topic: 'State Capitals',
    tags: ['assam', 'capital'],
    isActive: true
  },
  {
    questionText: 'Which festival is famously associated with Assam?',
    options: ['Bihu', 'Onam', 'Pongal', 'Navratri'],
    correctOption: 0,
    explanation: 'Bihu is a major festival of Assam and is celebrated with great enthusiasm across the state.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Assam GK',
    topic: 'Culture',
    tags: ['assam', 'festival'],
    isActive: true
  },
  {
    questionText: 'Who was the first Governor of Assam after independence?',
    options: ['Srimanta Sankardev', 'Lokanath Misra', 'S. K. Sinha', 'R. D. Pradhan'],
    correctOption: 2,
    explanation: 'S. K. Sinha became the first Governor of Assam after the state’s formation and post-independence reorganization.',
    category: 'General Knowledge',
    difficulty: 'Hard',
    subject: 'Assam GK',
    topic: 'History',
    tags: ['assam', 'governor'],
    isActive: true
  },
  {
    questionText: 'The Supreme Court of India was established in which year?',
    options: ['1947', '1948', '1950', '1951'],
    correctOption: 2,
    explanation: 'The Supreme Court of India came into existence on 28 January 1950, with the Constitution coming into force.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'Indian Polity',
    topic: 'Judiciary',
    tags: ['supreme court', 'judiciary'],
    isActive: true
  },
  {
    questionText: 'Which movement was launched by Mahatma Gandhi in 1930?',
    options: ['Quit India Movement', 'Non-Cooperation Movement', 'Salt Satyagraha', 'Civil Disobedience'],
    correctOption: 2,
    explanation: 'The Salt Satyagraha, also known as the Dandi March, was launched in 1930 as a major act of civil disobedience.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'History',
    topic: 'Freedom Struggle',
    tags: ['gandhi', 'salt'],
    isActive: true
  },
  {
    questionText: 'The largest river island in the world is located in which river?',
    options: ['Ganga', 'Brahmaputra', 'Narmada', 'Godavari'],
    correctOption: 1,
    explanation: 'Majuli in the Brahmaputra river is the largest river island in the world.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'Assam GK',
    topic: 'Geography',
    tags: ['majuli', 'brahmaputra'],
    isActive: true
  },
  {
    questionText: 'Which organ in the human body is primarily responsible for pumping blood?',
    options: ['Liver', 'Lungs', 'Heart', 'Kidney'],
    correctOption: 2,
    explanation: 'The heart is the muscular organ responsible for pumping blood throughout the body.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'General Science',
    topic: 'Human Body',
    tags: ['biology', 'human body'],
    isActive: true
  },
  {
    questionText: 'The Indian rupee symbol was adopted in which year?',
    options: ['2007', '2010', '2012', '2015'],
    correctOption: 1,
    explanation: 'The Indian rupee symbol was adopted in 2010.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'Economy',
    topic: 'Currency',
    tags: ['rupee', 'currency'],
    isActive: true
  },
  {
    questionText: 'Who is the current Chairperson of the National Human Rights Commission (as of common reference)?',
    options: ['Justice Arun Kumar Mishra', 'Justice Uday Umesh Lalit', 'Justice V. Ramasubramanian', 'Justice Hima Kohli'],
    correctOption: 3,
    explanation: 'Justice Hima Kohli served as a senior judge and has been associated with the NHRC structure in recent years; this question should be reviewed against current updates if used in production timelines.',
    category: 'General Knowledge',
    difficulty: 'Hard',
    subject: 'Indian Polity',
    topic: 'Institutions',
    tags: ['constitution', 'nhrc'],
    isActive: true
  },
  {
    questionText: 'Which planet is known as the Red Planet?',
    options: ['Mars', 'Venus', 'Jupiter', 'Mercury'],
    correctOption: 0,
    explanation: 'Mars is known as the Red Planet because of its iron oxide-rich surface.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'General Science',
    topic: 'Space',
    tags: ['solar system', 'planet'],
    isActive: true
  },
  {
    questionText: 'The first session of the Constituent Assembly of India was held in:',
    options: ['Bombay', 'Delhi', 'Calcutta', 'Madras'],
    correctOption: 1,
    explanation: 'The Constituent Assembly first met in New Delhi on 9 December 1946.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'Indian Polity',
    topic: 'Constitution',
    tags: ['assembly', 'india'],
    isActive: true
  },
  {
    questionText: 'Which of the following is a primary colour?',
    options: ['Orange', 'Green', 'Blue', 'Purple'],
    correctOption: 2,
    explanation: 'Blue is one of the primary colours in the traditional colour model.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'General Science',
    topic: 'Basic Science',
    tags: ['colour', 'science'],
    isActive: true
  },
  {
    questionText: 'Which is the longest river in India?',
    options: ['Ganga', 'Yamuna', 'Godavari', 'Brahmaputra'],
    correctOption: 0,
    explanation: 'The Ganga is the longest river in India, though the Brahmaputra is longer in some global comparisons in the region.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'Geography',
    topic: 'Rivers',
    tags: ['ganga', 'river'],
    isActive: true
  },
  {
    questionText: 'Who was the last Mughal emperor?',
    options: ['Bahadur Shah I', 'Aurangzeb', 'Bahadur Shah II', 'Shah Jahan'],
    correctOption: 2,
    explanation: 'Bahadur Shah Zafar, also known as Bahadur Shah II, was the last Mughal emperor.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'History',
    topic: 'Mughal Empire',
    tags: ['mughals', 'empire'],
    isActive: true
  },
  {
    questionText: 'Which Indian state is famous for Kaziranga National Park?',
    options: ['Manipur', 'Assam', 'Tripura', 'Meghalaya'],
    correctOption: 1,
    explanation: 'Kaziranga National Park is a UNESCO World Heritage Site located in Assam.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Assam GK',
    topic: 'Wildlife',
    tags: ['assam', 'kaziranga'],
    isActive: true
  },
  {
    questionText: 'The term “GDP” stands for:',
    options: ['Gross Domestic Product', 'General Development Price', 'Government Domestic Policy', 'Gross Demand Price'],
    correctOption: 0,
    explanation: 'GDP stands for Gross Domestic Product, a measure of the total economic output of a country.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Economy',
    topic: 'Macro Economics',
    tags: ['gdp', 'economy'],
    isActive: true
  },
  {
    questionText: 'Which of the following is not a fundamental right?',
    options: ['Right to Equality', 'Right to Freedom', 'Right to Property', 'Right against Exploitation'],
    correctOption: 2,
    explanation: 'The Right to Property was removed from the list of Fundamental Rights by the 44th Amendment Act, 1978.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'Indian Polity',
    topic: 'Fundamental Rights',
    tags: ['rights', 'property'],
    isActive: true
  },
  {
    questionText: 'The Himalayan range includes all except:',
    options: ['Himachal', 'Karakoram', 'Vindhyas', 'Kumaon'],
    correctOption: 2,
    explanation: 'The Vindhyas are not part of the Himalayan mountain range.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'Geography',
    topic: 'Mountain Ranges',
    tags: ['himalayas', 'mountains'],
    isActive: true
  },
  {
    questionText: 'Which of the following is the smallest prime number?',
    options: ['1', '2', '3', '5'],
    correctOption: 1,
    explanation: '2 is the smallest prime number and the only even prime number.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'General Science',
    topic: 'Mathematics',
    tags: ['math', 'numbers'],
    isActive: true
  },
  {
    questionText: 'The term “Bharat” appears in which article of the Constitution?',
    options: ['Article 1', 'Article 50', 'Article 343', 'Article 356'],
    correctOption: 2,
    explanation: 'Article 343 deals with the official language of the Union, and the Constitution names the country as India, Bharat and Hindustan in common usage.',
    category: 'General Knowledge',
    difficulty: 'Hard',
    subject: 'Indian Polity',
    topic: 'Constitution',
    tags: ['bharat', 'language'],
    isActive: true
  },
  {
    questionText: 'The ancient university of Nalanda was located in:',
    options: ['Bihar', 'Odisha', 'Madhya Pradesh', 'Uttar Pradesh'],
    correctOption: 0,
    explanation: 'Nalanda University was located in present-day Bihar and was one of the earliest centres of higher learning in the world.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'History',
    topic: 'Education',
    tags: ['nalanda', 'bihar'],
    isActive: true
  },
  {
    questionText: 'Which of the following diseases is caused by a virus?',
    options: ['Tuberculosis', 'Malaria', 'Influenza', 'Cholera'],
    correctOption: 2,
    explanation: 'Influenza is a viral disease; the others are commonly bacterial or parasitic diseases depending on context.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'General Science',
    topic: 'Health',
    tags: ['disease', 'science'],
    isActive: true
  },
  {
    questionText: 'The Reserve Bank of India was nationalised in:',
    options: ['1947', '1948', '1949', '1950'],
    correctOption: 1,
    explanation: 'The Reserve Bank of India was nationalised in 1949.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'Economy',
    topic: 'Banking',
    tags: ['rbi', 'bank'],
    isActive: true
  },
  {
    questionText: 'Which river is the lifeline of Assam?',
    options: ['Ganga', 'Brahmaputra', 'Mahanadi', 'Kaveri'],
    correctOption: 1,
    explanation: 'The Brahmaputra is vital to Assam’s geography, agriculture and transport.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Assam GK',
    topic: 'Rivers',
    tags: ['assam', 'brahmaputra'],
    isActive: true
  },
  {
    questionText: 'Which is the smallest continent in the world?',
    options: ['Europe', 'Australia', 'Antarctica', 'South America'],
    correctOption: 1,
    explanation: 'Australia is the smallest continent.',
    category: 'General Knowledge',
    difficulty: 'Easy',
    subject: 'Geography',
    topic: 'Continents',
    tags: ['geography', 'continents'],
    isActive: true
  },
  {
    questionText: 'The first Indian to win a Nobel Prize was:',
    options: ['C. V. Raman', 'Rabindranath Tagore', 'Homi Bhabha', 'Subhas Chandra Bose'],
    correctOption: 1,
    explanation: 'Rabindranath Tagore was the first Indian to win the Nobel Prize in Literature in 1913.',
    category: 'General Knowledge',
    difficulty: 'Medium',
    subject: 'History',
    topic: 'Awards',
    tags: ['nobel', 'history'],
    isActive: true
  }
];

const seedQuestions = async () => {
  await mongoose.connect(config.MONGO_URI);
  await Question.deleteMany({});
  await Question.insertMany(questions);
  console.log(`Seeded ${questions.length} questions.`);
  await mongoose.disconnect();
};

seedQuestions().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

export const validateSeed = () => {
  const uniqueText = new Set(questions.map((q) => q.questionText));
  return uniqueText.size === questions.length && questions.every((q) => q.options.length === 4 && q.correctOption >= 0 && q.correctOption <= 3);
};
