// Normalize a tag name for comparison
export function normalizeTagName(name: string): string {
  return name.toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

// Calculate similarity between two strings (Levenshtein distance)
export function calculateStringSimilarity(str1: string, str2: string): number {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }

  const distance = track[str2.length][str1.length];
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - distance / maxLength; // Return similarity score (0 to 1)
}

// Find similar tags with a similarity threshold
export function findSimilarTags(newTagName: string, existingTags: string[], threshold = 0.8): string[] {
  const normalizedNew = normalizeTagName(newTagName);
  return existingTags
    .map(tag => ({
      name: tag,
      similarity: calculateStringSimilarity(normalizedNew, normalizeTagName(tag))
    }))
    .filter(result => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .map(result => result.name);
}
