using System;
using System.Collections.Generic;
using System.Linq;

namespace Glyphtender.Core
{
    /// <summary>
    /// Handles dictionary loading, word detection, and scoring.
    /// Pure C# with no Unity dependencies.
    /// </summary>
    public class WordScorer
    {
        private readonly HashSet<string> _dictionary;
        private readonly Dictionary<string, float> _wordFrequencies;

        public int WordCount => _dictionary.Count;

        public WordScorer()
        {
            _dictionary = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            _wordFrequencies = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Loads dictionary from CSV lines (WORD,ZIPF_SCORE).
        /// </summary>
        public void LoadDictionary(IEnumerable<string> lines)
        {
            _dictionary.Clear();
            _wordFrequencies.Clear();

            foreach (var line in lines)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;

                // Parse CSV: WORD,SCORE
                var parts = line.Split(',');
                string word = parts[0].Trim().ToUpperInvariant();

                if (word.Length >= 2)
                {
                    _dictionary.Add(word);

                    // Parse frequency score if present
                    if (parts.Length > 1 && float.TryParse(parts[1], out float score))
                    {
                        _wordFrequencies[word] = score;
                    }
                    else
                    {
                        _wordFrequencies[word] = 0f; // Unknown frequency
                    }
                }
            }
        }

        /// <summary>
        /// Checks if a word is valid.
        /// </summary>
        public bool IsValidWord(string word)
        {
            return _dictionary.Contains(word.ToUpperInvariant());
        }

        /// <summary>
        /// Gets the Zipf frequency score for a word.
        /// Higher = more common. Returns 0 if unknown.
        /// </summary>
        public float GetWordFrequency(string word)
        {
            string upper = word.ToUpperInvariant();
            return _wordFrequencies.TryGetValue(upper, out float score) ? score : 0f;
        }

        /// <summary>
        /// Checks if a word meets the minimum frequency for a given Verbosity.
        /// </summary>
        public bool IsWordAllowedForVerbosity(string word, float verbosity)
        {
            float minFreq = GetMinFrequencyForVerbosity(verbosity);
            float wordFreq = GetWordFrequency(word);
            return wordFreq >= minFreq;
        }

        /// <summary>
        /// Gets the minimum Zipf score for a given Verbosity trait (1-10).
        /// </summary>
        public static float GetMinFrequencyForVerbosity(float verbosity)
        {
            // Verbosity 1-3: Only very common words (Zipf >= 5.0)
            // Verbosity 4-6: Common words (Zipf >= 4.0)
            // Verbosity 7-9: Include uncommon (Zipf >= 3.0)
            // Verbosity 10: Full dictionary (no filter)

            if (verbosity >= 10) return 0f;
            if (verbosity >= 7) return 3.0f;
            if (verbosity >= 4) return 4.0f;
            return 5.0f;
        }

        /// <summary>
        /// Calculates score for a word based on Glyphtender rules:
        /// 1 point per letter + 1 bonus point for each tile owned by the scoring player.
        /// </summary>
        public static int ScoreWordForPlayer(string word, List<HexCoord> positions, GameState state, Player scoringPlayer)
        {
            // Base score: 1 point per letter
            int score = word.Length;

            // Bonus: 1 extra point for each tile owned by the scoring player
            foreach (var pos in positions)
            {
                if (state.Tiles.TryGetValue(pos, out Tile tile))
                {
                    if (tile.Owner == scoringPlayer)
                    {
                        score += 1;
                    }
                }
            }

            return score;
        }

        /// <summary>
        /// Finds all words formed on the board along leylines.
        /// Returns list of (word, positions).
        /// </summary>
        public List<WordResult> FindAllWords(GameState state)
        {
            var results = new List<WordResult>();
            var checkedLines = new HashSet<string>();

            // Check each tile as potential word start
            foreach (var pos in state.Tiles.Keys)
            {
                // Check all 6 directions
                for (int dir = 0; dir < 6; dir++)
                {
                    var word = ExtractWord(state, pos, dir);

                    if (word.Letters.Length >= 2)
                    {
                        // Create unique key for this line
                        string key = $"{word.Positions[0]}-{dir}";

                        if (!checkedLines.Contains(key))
                        {
                            checkedLines.Add(key);

                            if (IsValidWord(word.Letters))
                            {
                                results.Add(word);
                            }
                        }
                    }
                }
            }

            return results;
        }

        /// <summary>
        /// Extracts a continuous line of letters starting from a position.
        /// </summary>
        private WordResult ExtractWord(GameState state, HexCoord start, int direction)
        {
            var positions = new List<HexCoord>();
            var letters = new List<char>();

            // First, go backwards to find the real start
            var realStart = start;
            int oppositeDir = (direction + 3) % 6;

            while (true)
            {
                var prev = realStart.GetNeighbor(oppositeDir);
                if (state.Board.IsBoardHex(prev) && state.HasTile(prev))
                {
                    realStart = prev;
                }
                else
                {
                    break;
                }
            }

            // Now collect letters going forward
            var current = realStart;
            while (state.Board.IsBoardHex(current) && state.HasTile(current))
            {
                positions.Add(current);
                letters.Add(state.Tiles[current].Letter);
                current = current.GetNeighbor(direction);
            }

            return new WordResult
            {
                Letters = new string(letters.ToArray()),
                Positions = positions,
                Direction = direction
            };
        }

        /// <summary>
        /// Finds new words formed by placing a tile at a position.
        /// Used for preview before confirming a move.
        /// Finds all valid words within each leyline (like a word search).
        /// </summary>
        public List<WordResult> FindWordsAt(GameState state, HexCoord position, char letter)
        {
            var results = new List<WordResult>();
            var foundWords = new HashSet<string>();  // Prevent duplicates

            // Temporarily add the tile
            bool hadTile = state.Tiles.ContainsKey(position);
            Tile oldTile = hadTile ? state.Tiles[position] : null;
            state.Tiles[position] = new Tile(letter, state.CurrentPlayer, position);

            // Check all 6 directions for words passing through this position
            for (int dir = 0; dir < 3; dir++)  // Only check 3 directions (0,1,2) since 3,4,5 are opposites
            {
                // Get the full line of letters through this position
                var fullLine = ExtractWord(state, position, dir);

                if (fullLine.Letters.Length >= 2)
                {
                    // Find all valid words within this line
                    var wordsInLine = FindWordsInLine(fullLine.Letters, fullLine.Positions, position);

                    foreach (var word in wordsInLine)
                    {
                        // Create unique key using explicit coordinates (start AND end position)
                        var startPos = word.Positions[0];
                        var endPos = word.Positions[word.Positions.Count - 1];
                        string wordKey = $"{word.Letters}_{startPos.Column},{startPos.Row}_{endPos.Column},{endPos.Row}";

                        if (!foundWords.Contains(wordKey))
                        {
                            foundWords.Add(wordKey);
                            results.Add(word);
                        }
                    }
                }
            }

            // Restore original state
            if (hadTile)
            {
                state.Tiles[position] = oldTile;
            }
            else
            {
                state.Tiles.Remove(position);
            }

            return results;
        }

        /// <summary>
        /// Finds all valid words within a line of letters.
        /// The word must include the placed position to count.
        /// Only scores the largest word in any overlapping group (no subwords).
        /// </summary>
        private List<WordResult> FindWordsInLine(string letters, List<HexCoord> positions, HexCoord placedPosition)
        {
            var allWords = new List<WordResult>();

            // Find index of the placed tile in the line
            int placedIndex = positions.IndexOf(placedPosition);
            if (placedIndex < 0) return allWords;

            // Check all possible substrings that include the placed position
            for (int start = 0; start <= placedIndex; start++)
            {
                for (int end = placedIndex; end < letters.Length; end++)
                {
                    int length = end - start + 1;
                    if (length >= 2)
                    {
                        string substring = letters.Substring(start, length);

                        if (IsValidWord(substring))
                        {
                            var wordPositions = positions.GetRange(start, length);
                            allWords.Add(new WordResult
                            {
                                Letters = substring,
                                Positions = wordPositions,
                                Direction = -1
                            });
                        }
                    }
                }
            }

            // Filter to only keep largest non-overlapping words
            var finalWords = new List<WordResult>();

            foreach (var word in allWords)
            {
                bool isSubwordOfAnother = false;

                foreach (var otherWord in allWords)
                {
                    if (word == otherWord) continue;

                    // Check if word is entirely contained within otherWord
                    if (otherWord.Letters.Length > word.Letters.Length)
                    {
                        int wordStart = positions.IndexOf(word.Positions[0]);
                        int wordEnd = positions.IndexOf(word.Positions[word.Positions.Count - 1]);
                        int otherStart = positions.IndexOf(otherWord.Positions[0]);
                        int otherEnd = positions.IndexOf(otherWord.Positions[otherWord.Positions.Count - 1]);

                        // Word is a subword if it's fully contained in the other word's range
                        if (wordStart >= otherStart && wordEnd <= otherEnd)
                        {
                            isSubwordOfAnother = true;
                            break;
                        }
                    }
                }

                if (!isSubwordOfAnother)
                {
                    finalWords.Add(word);
                }
            }

            return finalWords;
        }
    }

    /// <summary>
    /// Result of finding a word on the board.
    /// </summary>
    public class WordResult
    {
        public string Letters { get; set; }
        public List<HexCoord> Positions { get; set; }
        public int Direction { get; set; }
    }
}