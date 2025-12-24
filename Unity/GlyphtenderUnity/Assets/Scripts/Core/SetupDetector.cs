using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// Detects setup potential - positions that create opportunities for future words.
    /// Used for Builder's gap/pillar strategy without deep lookahead.
    /// </summary>
    public static class SetupDetector
    {
        /// <summary>
        /// Result of setup evaluation for a cast position.
        /// </summary>
        public class SetupEvaluation
        {
            public float TotalValue { get; set; }
            public int GapsCreated { get; set; }
            public int ExtensionPaths { get; set; }
            public int LeylineCrossings { get; set; }
            public float SpacingBonus { get; set; }
        }

        /// <summary>
        /// Evaluates the setup value of casting at a position.
        /// Higher value = better future word potential.
        /// </summary>
        public static SetupEvaluation Evaluate(
            GameState state,
            HexCoord castPosition,
            char letter,
            Player player,
            WordScorer wordScorer)
        {
            var eval = new SetupEvaluation();

            // Temporarily place the tile
            bool hadTile = state.Tiles.ContainsKey(castPosition);
            Tile oldTile = hadTile ? state.Tiles[castPosition] : null;
            state.Tiles[castPosition] = new Tile(letter, player, castPosition);

            // 1. Count productive gaps created
            eval.GapsCreated = CountProductiveGaps(state, castPosition, wordScorer);

            // 2. Count extension paths (empty hexes along leylines that could extend words)
            eval.ExtensionPaths = CountExtensionPaths(state, castPosition);

            // 3. Count leyline crossings (position touches multiple tile chains)
            eval.LeylineCrossings = CountLeylineCrossings(state, castPosition);

            // 4. Calculate spacing bonus (reward loose placements with room to grow)
            eval.SpacingBonus = CalculateSpacingBonus(state, castPosition);

            // Restore state
            if (hadTile)
            {
                state.Tiles[castPosition] = oldTile;
            }
            else
            {
                state.Tiles.Remove(castPosition);
            }

            // Calculate total value
            eval.TotalValue = CalculateTotalValue(eval);

            return eval;
        }

        /// <summary>
        /// Counts productive gaps - empty hexes between tiles where one letter could complete a word.
        /// </summary>
        private static int CountProductiveGaps(GameState state, HexCoord castPosition, WordScorer wordScorer)
        {
            int gaps = 0;

            // Check all 6 directions from the cast position
            for (int dir = 0; dir < 6; dir++)
            {
                // Look for pattern: TILE - GAP - TILE along this leyline
                var gapCandidates = FindGapsAlongLeyline(state, castPosition, dir);

                foreach (var gapPos in gapCandidates)
                {
                    // Check if filling this gap could complete any word
                    if (CouldCompleteWord(state, gapPos, wordScorer))
                    {
                        gaps++;
                    }
                }
            }

            return gaps;
        }

        /// <summary>
        /// Finds empty hexes along a leyline that have tiles on both sides.
        /// </summary>
        private static List<HexCoord> FindGapsAlongLeyline(GameState state, HexCoord start, int direction)
        {
            var gaps = new List<HexCoord>();
            int oppositeDir = (direction + 3) % 6;

            // Walk forward looking for gaps
            var current = start.GetNeighbor(direction);
            bool foundTileAfterStart = false;

            for (int i = 0; i < 10; i++) // Limit search distance
            {
                if (!state.Board.IsBoardHex(current)) break;

                if (state.Tiles.ContainsKey(current))
                {
                    foundTileAfterStart = true;
                }
                else if (foundTileAfterStart)
                {
                    // This is a gap - check if there's a tile after it
                    var next = current.GetNeighbor(direction);
                    if (state.Board.IsBoardHex(next) && state.Tiles.ContainsKey(next))
                    {
                        gaps.Add(current);
                    }
                }
                else
                {
                    // Empty hex right after start - check if it's a gap
                    var next = current.GetNeighbor(direction);
                    if (state.Board.IsBoardHex(next) && state.Tiles.ContainsKey(next))
                    {
                        gaps.Add(current);
                    }
                }

                current = current.GetNeighbor(direction);
            }

            // Also walk backward
            current = start.GetNeighbor(oppositeDir);
            foundTileAfterStart = false;

            for (int i = 0; i < 10; i++)
            {
                if (!state.Board.IsBoardHex(current)) break;

                if (state.Tiles.ContainsKey(current))
                {
                    foundTileAfterStart = true;
                }
                else if (foundTileAfterStart)
                {
                    var next = current.GetNeighbor(oppositeDir);
                    if (state.Board.IsBoardHex(next) && state.Tiles.ContainsKey(next))
                    {
                        gaps.Add(current);
                    }
                }
                else
                {
                    var next = current.GetNeighbor(oppositeDir);
                    if (state.Board.IsBoardHex(next) && state.Tiles.ContainsKey(next))
                    {
                        gaps.Add(current);
                    }
                }

                current = current.GetNeighbor(oppositeDir);
            }

            return gaps;
        }

        /// <summary>
        /// Checks if filling a gap position could complete any word (tries all 26 letters).
        /// </summary>
        private static bool CouldCompleteWord(GameState state, HexCoord gapPos, WordScorer wordScorer)
        {
            // Quick check - must have adjacent tiles
            bool hasAdjacentTile = false;
            for (int dir = 0; dir < 6; dir++)
            {
                var neighbor = gapPos.GetNeighbor(dir);
                if (state.Tiles.ContainsKey(neighbor))
                {
                    hasAdjacentTile = true;
                    break;
                }
            }

            if (!hasAdjacentTile) return false;

            // Try a subset of common letters for speed
            char[] commonLetters = { 'E', 'A', 'R', 'I', 'O', 'T', 'N', 'S', 'L', 'C' };

            foreach (char letter in commonLetters)
            {
                var words = wordScorer.FindWordsAt(state, gapPos, letter);
                if (words.Count > 0) return true;
            }

            return false;
        }

        /// <summary>
        /// Counts empty hexes along leylines that could extend existing words.
        /// </summary>
        private static int CountExtensionPaths(GameState state, HexCoord castPosition)
        {
            int paths = 0;

            // Check each direction
            for (int dir = 0; dir < 6; dir++)
            {
                // Look for empty hex at end of tile chain
                var neighbor = castPosition.GetNeighbor(dir);

                if (state.Board.IsBoardHex(neighbor) && !state.Tiles.ContainsKey(neighbor))
                {
                    // Empty neighbor - this is a potential extension path
                    // More valuable if there are tiles in the opposite direction (chain to extend)
                    int oppositeDir = (dir + 3) % 6;
                    var opposite = castPosition.GetNeighbor(oppositeDir);

                    if (state.Tiles.ContainsKey(opposite))
                    {
                        paths++;
                    }
                }
            }

            return paths;
        }

        /// <summary>
        /// Counts how many separate tile chains this position connects.
        /// Higher = better intersection for future multi-word plays.
        /// </summary>
        private static int CountLeylineCrossings(GameState state, HexCoord castPosition)
        {
            int chains = 0;

            // Check 3 leyline pairs (0-3, 1-4, 2-5)
            for (int dir = 0; dir < 3; dir++)
            {
                int oppositeDir = dir + 3;

                var neighbor1 = castPosition.GetNeighbor(dir);
                var neighbor2 = castPosition.GetNeighbor(oppositeDir);

                bool hasTile1 = state.Tiles.ContainsKey(neighbor1);
                bool hasTile2 = state.Tiles.ContainsKey(neighbor2);

                // Count as a chain if either side has tiles
                if (hasTile1 || hasTile2)
                {
                    chains++;
                }
            }

            return chains;
        }

        /// <summary>
        /// Calculates spacing bonus - rewards loose placements with room to grow.
        /// Best positions: 1-2 tile neighbors, 4-5 empty neighbors (connected but spacious).
        /// </summary>
        private static float CalculateSpacingBonus(GameState state, HexCoord castPosition)
        {
            int emptyNeighbors = 0;
            int tileNeighbors = 0;

            for (int dir = 0; dir < 6; dir++)
            {
                var neighbor = castPosition.GetNeighbor(dir);
                if (!state.Board.IsBoardHex(neighbor)) continue;

                if (state.Tiles.ContainsKey(neighbor))
                {
                    tileNeighbors++;
                }
                else
                {
                    emptyNeighbors++;
                }
            }

            // Not connected to anything = useless placement
            if (tileNeighbors == 0) return 0f;

            // Too clustered (3+ tile neighbors) = filling in, not building out
            if (tileNeighbors >= 3) return -2.0f;

            // Sweet spot: 1-2 tile neighbors with lots of empty space
            float bonus = 0f;

            if (tileNeighbors == 1 && emptyNeighbors >= 4)
            {
                bonus = 4.0f; // Extending outward, lots of room
            }
            else if (tileNeighbors == 2 && emptyNeighbors >= 3)
            {
                bonus = 3.0f; // Bridging with room
            }
            else if (emptyNeighbors >= 4)
            {
                bonus = 2.0f; // Good spacing
            }
            else if (emptyNeighbors >= 3)
            {
                bonus = 1.0f; // Decent spacing
            }

            return bonus;
        }

        /// <summary>
        /// Calculates total setup value from components.
        /// </summary>
        private static float CalculateTotalValue(SetupEvaluation eval)
        {
            float value = 0f;

            // Productive gaps are very valuable - future scoring opportunities
            value += eval.GapsCreated * 3.0f;

            // Extension paths show room to grow
            value += eval.ExtensionPaths * 2.0f;

            // Leyline crossings enable multi-word plays
            if (eval.LeylineCrossings >= 3)
            {
                value += 5.0f; // Excellent intersection
            }
            else if (eval.LeylineCrossings >= 2)
            {
                value += 3.0f; // Good intersection
            }

            // Spacing bonus - more empty neighbors = looser grid = better for Builder
            value += eval.SpacingBonus;

            return value;
        }

        /// <summary>
        /// Quick check if a position has good setup potential.
        /// </summary>
        public static bool HasSetupPotential(GameState state, HexCoord position)
        {
            // Position has setup potential if it has multiple empty neighbors
            // that could become extension points
            int emptyNeighbors = 0;
            int tileNeighbors = 0;

            for (int dir = 0; dir < 6; dir++)
            {
                var neighbor = position.GetNeighbor(dir);
                if (!state.Board.IsBoardHex(neighbor)) continue;

                if (state.Tiles.ContainsKey(neighbor))
                {
                    tileNeighbors++;
                }
                else
                {
                    emptyNeighbors++;
                }
            }

            // Good setup: has some tiles to connect to AND room to grow
            return tileNeighbors >= 1 && emptyNeighbors >= 3;
        }
    }
}