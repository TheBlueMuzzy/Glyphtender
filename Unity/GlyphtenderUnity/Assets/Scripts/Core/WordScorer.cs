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

        // Letter point values
        private static readonly Dictionary<char, int> LetterValues = new Dictionary<char, int>
        {
            {'A', 1}, {'B', 3}, {'C', 3}, {'D', 2}, {'E', 1}, {'F', 4},
            {'G', 2}, {'H', 4}, {'I', 1}, {'J', 8}, {'K', 5}, {'L', 1},
            {'M', 3}, {'N', 1}, {'O', 1}, {'P', 3}, {'Q', 10}, {'R', 1},
            {'S', 1}, {'T', 1}, {'U', 1}, {'V', 4}, {'W', 4}, {'X', 8},
            {'Y', 4}, {'Z', 10}
        };

        public int WordCount => _dictionary.Count;

        public WordScorer()
        {
            _dictionary = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Loads dictionary from a list of words.
        /// </summary>
        public void LoadDictionary(IEnumerable<string> words)
        {
            _dictionary.Clear();
            foreach (var word in words)
            {
                if (!string.IsNullOrWhiteSpace(word) && word.Length >= 2)
                {
                    _dictionary.Add(word.Trim().ToUpperInvariant());
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
        /// Gets the point value of a single letter.
        /// </summary>
        public static int GetLetterValue(char letter)
        {
            char upper = char.ToUpperInvariant(letter);
            return LetterValues.TryGetValue(upper, out int value) ? value : 0;
        }

        /// <summary>
        /// Calculates score for a word (sum of letter values).
        /// </summary>
        public static int ScoreWord(string word)
        {
            int score = 0;
            foreach (char c in word.ToUpperInvariant())
            {
                score += GetLetterValue(c);
            }
            return score;
        }

        /// <summary>
        /// Finds all words formed on the board along leylines.
        /// Returns list of (word, positions, score).
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
                                word.Score = ScoreWord(word.Letters);
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
                if (state.Board.IsValidHex(prev) && state.HasTile(prev))
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
            while (state.Board.IsValidHex(current) && state.HasTile(current))
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
        /// </summary>
        public List<WordResult> FindWordsAt(GameState state, HexCoord position, char letter)
        {
            var results = new List<WordResult>();

            // Temporarily add the tile
            bool hadTile = state.Tiles.ContainsKey(position);
            Tile oldTile = hadTile ? state.Tiles[position] : null;
            state.Tiles[position] = new Tile(letter, state.CurrentPlayer, position);

            // Check all 6 directions for words passing through this position
            for (int dir = 0; dir < 3; dir++) // Only check 3 directions (0,1,2) since 3,4,5 are opposites
            {
                var word = ExtractWord(state, position, dir);

                if (word.Letters.Length >= 2 && IsValidWord(word.Letters))
                {
                    word.Score = ScoreWord(word.Letters);
                    results.Add(word);
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
    }

    /// <summary>
    /// Result of finding a word on the board.
    /// </summary>
    public class WordResult
    {
        public string Letters { get; set; }
        public List<HexCoord> Positions { get; set; }
        public int Direction { get; set; }
        public int Score { get; set; }
    }
}