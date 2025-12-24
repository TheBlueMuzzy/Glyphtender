using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// Detects contested positions - hexes where the opponent could cast
    /// to complete a word. Used for denial-focused play (Vulture).
    /// </summary>
    public static class ContestDetector
    {
        /// <summary>
        /// A contested position with its potential value to opponent.
        /// </summary>
        public class ContestedPosition
        {
            public HexCoord Position { get; set; }
            public int PotentialWordCount { get; set; }
            public int BestWordLength { get; set; }
            public float DenialValue { get; set; }
        }

        /// <summary>
        /// Finds all positions the opponent could reach and complete words.
        /// Does NOT peek at opponent's hand - assumes they could have any letter.
        /// </summary>
        public static List<ContestedPosition> FindContestedPositions(
            GameState state,
            Player aiPlayer,
            WordScorer wordScorer)
        {
            var contested = new List<ContestedPosition>();
            var checkedPositions = new HashSet<HexCoord>();

            Player opponent = aiPlayer == Player.Yellow ? Player.Blue : Player.Yellow;

            // Find all opponent glyphlings
            foreach (var glyphling in state.Glyphlings)
            {
                if (glyphling.Owner != opponent) continue;

                // Get all positions this glyphling could move to
                var moveDestinations = GameRules.GetValidMoves(state, glyphling);

                foreach (var dest in moveDestinations)
                {
                    // Temporarily move glyphling to get cast positions
                    var originalPos = glyphling.Position;
                    glyphling.Position = dest;

                    var castPositions = GameRules.GetValidCastPositions(state, glyphling);

                    glyphling.Position = originalPos;

                    // Check each cast position
                    foreach (var castPos in castPositions)
                    {
                        // Skip if already checked
                        if (checkedPositions.Contains(castPos)) continue;
                        checkedPositions.Add(castPos);

                        // Check if any letter would complete a word here
                        var result = EvaluatePosition(state, castPos, wordScorer);

                        if (result.PotentialWordCount > 0)
                        {
                            contested.Add(result);
                        }
                    }
                }
            }

            return contested;
        }

        /// <summary>
        /// Checks if a specific position is contested (opponent could reach it).
        /// </summary>
        public static bool IsContested(
            GameState state,
            HexCoord position,
            Player aiPlayer)
        {
            Player opponent = aiPlayer == Player.Yellow ? Player.Blue : Player.Yellow;

            foreach (var glyphling in state.Glyphlings)
            {
                if (glyphling.Owner != opponent) continue;

                var moveDestinations = GameRules.GetValidMoves(state, glyphling);

                foreach (var dest in moveDestinations)
                {
                    var originalPos = glyphling.Position;
                    glyphling.Position = dest;

                    var castPositions = GameRules.GetValidCastPositions(state, glyphling);

                    glyphling.Position = originalPos;

                    if (castPositions.Contains(position))
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Evaluates a position's word-completion potential.
        /// Tries all 26 letters to see what words could be formed.
        /// </summary>
        private static ContestedPosition EvaluatePosition(
            GameState state,
            HexCoord position,
            WordScorer wordScorer)
        {
            var result = new ContestedPosition
            {
                Position = position,
                PotentialWordCount = 0,
                BestWordLength = 0,
                DenialValue = 0f
            };

            // Skip if position already has a tile
            if (state.Tiles.ContainsKey(position)) return result;

            // Count adjacent tiles - more = hotter setup
            int adjacentTiles = 0;
            for (int dir = 0; dir < 6; dir++)
            {
                var neighbor = position.GetNeighbor(dir);
                if (state.Tiles.ContainsKey(neighbor))
                {
                    adjacentTiles++;
                }
            }

            // No adjacent tiles = not a setup worth denying
            if (adjacentTiles == 0) return result;

            // Try each letter A-Z
            var wordsFound = new HashSet<string>();

            for (char letter = 'A'; letter <= 'Z'; letter++)
            {
                var words = wordScorer.FindWordsAt(state, position, letter);

                foreach (var word in words)
                {
                    // Track unique words
                    if (!wordsFound.Contains(word.Letters))
                    {
                        wordsFound.Add(word.Letters);

                        if (word.Letters.Length > result.BestWordLength)
                        {
                            result.BestWordLength = word.Letters.Length;
                        }
                    }
                }
            }

            result.PotentialWordCount = wordsFound.Count;

            // No words possible = not worth denying
            if (result.PotentialWordCount == 0) return result;

            // Base denial value from word potential
            result.DenialValue = result.PotentialWordCount * 1.0f;

            // Bonus for longer words being possible
            if (result.BestWordLength >= 5)
            {
                result.DenialValue += 4f;
            }
            else if (result.BestWordLength >= 4)
            {
                result.DenialValue += 2f;
            }

            // BIG bonus for adjacency - this is clearly a setup
            // 1 adjacent = minor setup, 2+ = hot target
            if (adjacentTiles >= 3)
            {
                result.DenialValue *= 2.5f;  // Prime denial target
            }
            else if (adjacentTiles >= 2)
            {
                result.DenialValue *= 2.0f;  // Good denial target
            }
            else
            {
                result.DenialValue *= 1.3f;  // Mild interest
            }

            return result;
        }

        /// <summary>
        /// Gets the denial value for casting at a specific position.
        /// Returns 0 if not contested or no word potential.
        /// </summary>
        public static float GetDenialValue(
            GameState state,
            HexCoord castPosition,
            Player aiPlayer,
            WordScorer wordScorer)
        {
            // First check if opponent could even reach this position
            if (!IsContested(state, castPosition, aiPlayer))
            {
                return 0f;
            }

            // Then evaluate the word potential
            var result = EvaluatePosition(state, castPosition, wordScorer);

            return result.DenialValue;
        }
    }
}