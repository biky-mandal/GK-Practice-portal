// Full-length mocks are identified by a question tag "MOCK <n>", the same way previous-year papers use tags.
export const MOCK_COUNT = 10;
export const MOCK_NUMBERS = Array.from({ length: MOCK_COUNT }, (_, index) => index + 1);

// Tolerates case and spacing differences, so "Mock 3", "mock-3" and "MOCK_3" all match.
const mockTag = (number: number) => new RegExp(`^MOCK[\\s_-]*0*${number}$`, 'i');
export const ANY_MOCK_TAG = /^MOCK[\s_-]*\d+$/i;

export const isMockNumber = (value: number) => Number.isInteger(value) && value >= 1 && value <= MOCK_COUNT;

// Mongo condition selecting every question of one mock.
export const mockFilter = (number: number) => ({ tags: { $all: [mockTag(number)] } });
